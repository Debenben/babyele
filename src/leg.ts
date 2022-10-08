import { BrowserWindow, ipcMain } from "electron";
import { MotorAbstraction, TiltSensorAbstraction } from "./interfaces";
import { MotorName, motorNames, LegName, Position, fromArray, toArray, parsePosition, cosLaw, invCosLaw } from "./tools";
import { NO_MOVE_MOTOR_ANGLE, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_MOUNT_HEIGHT, LEG_MOUNT_WIDTH, LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH } from "./param";

const mountAngleOffset = invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH);
const setMotorAngle = (motor: MotorAbstraction, motorAngle: number) => {
  const buffer = Buffer.from([0x81, motor.portId, 0x10, 0x51, 0x02, 0x00, 0x00, 0x00, 0x00]);
  buffer.writeInt32LE(motorAngle, 5);
  return motor.send(buffer);
}

export class Leg {
  legName: LegName
  mainWindow: BrowserWindow
  tiltSensors: Record<string, TiltSensorAbstraction> = {top: null, bottom: null}
  tilts: Record<string, Position> = {}
  tiltAngles: Record<MotorName, number> = {top: null, bottom: null, mount: null}
  motors: Record<MotorName, MotorAbstraction> = {top: null, bottom: null, mount: null}
  motorRanges: Record<MotorName, number> = {top: 10, bottom: 10, mount: 10}
  motorAngles: Record<MotorName, number> = {top: 0, bottom: 0, mount: 0}
  destMotorAngles: Record<MotorName, number> = {top: 0, bottom: 0, mount: 0}
  bendForward: boolean = true
  positionSpeed: Position
  startMovePosition: Position
  positionSpeedIntervalID: NodeJS.Timeout

  constructor(legName: LegName, mainWindow: BrowserWindow) {
    this.legName = legName;
    this.mainWindow = mainWindow;
    ipcMain.on(this.legName, (event, arg1, arg2) => {
      if(arg1.startsWith("requestPositionSpeed")) {
        ipcMain.emit('requestMode', 'internal', 'MANUAL');
        this.requestPositionSpeed(parsePosition(arg1, arg2));
      }
      else if(arg1 == "setBendForward") {
        this.bendForward = arg2;
      }
      else if(arg1 === "getProperties") {
        this.send('notifyBendForward', this.legName, this.bendForward);
        for(let id in this.motors) {
          if(this.motors[id]) this.motors[id].requestUpdate();
        }
        this.calculateTiltAngles();
      }
    });
  }

  async addTiltSensor(deviceName: string, sensor: TiltSensorAbstraction) {
    const sensorName = deviceName.replace(this.legName, "").replace("Tilt","").toLowerCase();
    if(!sensor) {
      this.send("notifyState", deviceName, "offline");
      ipcMain.removeAllListeners(deviceName);
      this.tiltSensors[sensorName] = null;
      return false;
    }
    if(this.tiltSensors[sensorName]) {
      return true;
    }
    this.tiltSensors[sensorName] = sensor;
    if(sensor) {
      sensor.removeAllListeners('accel');
      sensor.on("accel", (accel) => {
        const abs = Math.sqrt(accel.x**2 + accel.y**2 + accel.z**2);
        if(abs < 950 || abs > 1050) return;
        this.tilts[sensorName] = {forward: Math.atan2(accel.y, -accel.x), height: 0, sideways: Math.atan2(accel.z, Math.sqrt(accel.x**2 + accel.y**2))};
        this.send('notifyTilt', deviceName, this.tilts[sensorName]);
        this.calculateTiltAngles();
      });
      if(sensor.portId === 0x61) { // ACCELEROMETER of TechnicMediumHub
        sensor.send(Buffer.from([0x41, sensor.portId, 0x00, 0x20, 0x00, 0x00, 0x00, 0x01])); // subscribe again with larger delta interval
      }
      this.send("notifyState", deviceName, "online");
      return true;
    }
  }

  async addMotor(deviceName: string, motor: MotorAbstraction, motorRange: number) {
    const motorName = deviceName.replace(this.legName, "").toLowerCase();
    if(!motor) {
      this.send("notifyState", deviceName, "offline");
      ipcMain.removeAllListeners(deviceName);
      this.motors[motorName] = null;
      return false;
    }
    if(this.motors[motorName]) {
      return true;
    }
    this.motors[motorName] = motor;
    this.motorRanges[motorName] = motorRange;
    if(motor) {
      motor.setBrakingStyle(127); //Consts.BrakingStyle.BRAKE
      motor.useAccelerationProfile = false;
      motor.useDecelerationProfile = false;
      await this.requestRotationSpeed(motorName, 0);
      await setMotorAngle(motor, this.motorAngles[motorName]);
      ipcMain.on(deviceName, (event, arg1, arg2) => {
        switch(arg1) {
          case "requestRotationSpeed":
            ipcMain.emit('requestMode', 'internal', 'MANUAL');
            return this.requestRotationSpeed(motorName, arg2);
          case "requestRotation":
            ipcMain.emit('requestMode', 'internal', 'MANUAL');
            return this.requestRotation(motorName, arg2);
          case "requestSync":
            return this.synchronize(motorName);
          case "requestReset":
            return setMotorAngle(motor, 0);
        }
      });
      motor.removeAllListeners('rotate');
      motor.on('rotate', ({degrees}) => {
        this.motorAngles[motorName] = degrees;
        ipcMain.emit("dog", "rotationEvent", "getProperties");
        this.send('notifyLegRotation', deviceName, this.getAngle(motorName));
        this.send('notifyLegPosition', this.legName, this.getPosition());
      });
      motor.send(Buffer.from([0x41, motor.portId, 0x02, 0x30, 0x00, 0x00, 0x00, 0x01])); // subscribe again with delta interval 48 instead of 1
      this.send("notifyState", deviceName, "online");
      return true;
    }
  }

  async setDogTilt(dogTilt: Position) {
    this.tilts["dog"] = dogTilt;
    this.calculateTiltAngles();
  }

  async calculateTiltAngles() {
    if(this.tilts["dog"] && this.tilts["top"] && this.tilts["bottom"]) {
      if(this.legName.includes("Right")) {
        this.tiltAngles.top = -this.tilts["dog"].sideways + this.tilts["top"].forward;
        this.tiltAngles.bottom = -this.tilts["bottom"].forward + this.tilts["top"].forward;
        this.tiltAngles.mount = -this.tilts["dog"].forward + this.tilts["top"].sideways;
      }
      else {
        this.tiltAngles.top = -this.tilts["dog"].sideways - this.tilts["top"].forward;
        this.tiltAngles.bottom = this.tilts["bottom"].forward - this.tilts["top"].forward;
        this.tiltAngles.mount = this.tilts["dog"].forward + this.tilts["top"].sideways;
      }
      for(let id of motorNames) {
        this.send('notifyTilt', this.legName + id.charAt(0).toUpperCase() + id.slice(1), this.tiltAngles[id]);
      }
    }
  }

  async synchronize(motorName: string) {
    const motor = this.motors[motorName];
    if(motorName === 'mount') {
      const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, this.tiltAngles['mount'] + mountAngleOffset);
      setMotorAngle(motor, (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges['mount']);
    }
    else {
      setMotorAngle(motor, this.tiltAngles[motor]*this.motorRanges[motor]/Math.PI);
    }
    motor.requestUpdate();
  }

  motorLoop() {
    let motorNames = Object.keys(this.motors);
    motorNames = motorNames.filter(n => this.motors[n] && Math.abs(this.destMotorAngles[n] - this.motorAngles[n]) > NO_MOVE_MOTOR_ANGLE);
    const diffMotorAngles = motorNames.map(n => (this.destMotorAngles[n] - this.motorAngles[n]));
    const motorSpeeds = diffMotorAngles.map(diff => (10*Math.sign(diff) + 90*diff/Math.max.apply(null, diffMotorAngles.map(Math.abs))));
    const promises = motorNames.map((n,i) => this.motors[n].rotateByDegrees(Math.abs(diffMotorAngles[i]), motorSpeeds[i], true));
    return Promise.all(promises);
  }

  requestRotation(motorName: string, angle: number) {
    if(!(motorName === 'mount')) {
      this.destMotorAngles[motorName] = angle*this.motorRanges[motorName]/Math.PI;
      return this.motorLoop();
    }
    else {
      const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, angle + mountAngleOffset);
      this.destMotorAngles['mount'] = (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges['mount'];
      return this.motorLoop();
    }
  }

  requestRotationSpeed(motorName: string, speed: number) {
    return this.motors[motorName].setSpeed(speed, undefined, true).then((ret) => {
      if(speed === 0) {
        this.destMotorAngles[motorName] = this.motorAngles[motorName];
      }
    });
  }

  setPosition(position: Position) {
    if(this.legName.endsWith("Left")) {
      position.sideways *= -1;
    }
    const mAngle = Math.atan2(position.sideways + LEG_MOUNT_WIDTH, position.height + LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM - LEG_MOUNT_HEIGHT);
    const mLength = (position.height + LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM - LEG_MOUNT_HEIGHT)/Math.cos(mAngle);
    const mHeight = Math.sqrt(Math.abs(mLength**2 - LEG_MOUNT_WIDTH**2));
    const destMountAngle = mAngle - Math.atan2(LEG_MOUNT_WIDTH, mHeight);
    const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, destMountAngle + mountAngleOffset);
    this.destMotorAngles['mount'] = (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges['mount'];
    const tbHeight = mHeight + LEG_MOUNT_HEIGHT
    const tbLength = Math.sqrt(tbHeight**2 + position.forward**2);
    const phi = Math.atan2(position.forward, tbHeight);
    const alpha = invCosLaw(tbLength, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM);
    let destTopAngle = phi + alpha;
    let destBottomAngle = Math.acos((LEG_LENGTH_TOP/LEG_LENGTH_BOTTOM)*Math.cos(Math.PI/2 - alpha)) - alpha - Math.PI/2;
    if(!this.bendForward) {
      destTopAngle = phi - alpha;
      destBottomAngle *= -1;
    }
    this.destMotorAngles['top'] = destTopAngle*this.motorRanges['top']/Math.PI;
    this.destMotorAngles['bottom'] = destBottomAngle*this.motorRanges['bottom']/Math.PI;
  }

  requestPosition(position: Position) {
    this.setPosition(position);
    return this.motorLoop();
  }

  requestPositionSpeed(speed: Position) {
    this.positionSpeed = speed;
    if(!speed) {
      clearInterval(this.positionSpeedIntervalID);
      this.positionSpeedIntervalID = null;
    }
    else if(this.positionSpeedIntervalID) {
      return;
    }
    else {
      this.startMovePosition = this.getPosition();
      this.positionSpeedIntervalID = setInterval(() => {
        const position = toArray(this.startMovePosition).map((n,i) => {
          if(toArray(this.positionSpeed)[i] != 0) {
            return toArray(this.getPosition())[i] + toArray(this.positionSpeed)[i]/10;
          }
          return n;
        });
        this.requestPosition(fromArray(position));
      }, 100);
    }
  }

  getAngle(motorName: string) {
    if(!(motorName === 'mount')) {
      return Math.PI*this.motorAngles[motorName]/this.motorRanges[motorName];
    }
    else {
      const pistonLength = LEG_PISTON_LENGTH + this.motorAngles['mount']/this.motorRanges['mount'];
      return invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, pistonLength) - mountAngleOffset;
    }
  }

  getPosition() {
    const tAngle = this.getAngle('top');
    const bAngle = this.getAngle('bottom') + tAngle;
    const forward = (LEG_LENGTH_TOP*Math.sin(tAngle) + LEG_LENGTH_BOTTOM*Math.sin(bAngle));
    const mHeight = LEG_LENGTH_TOP*Math.cos(tAngle) + LEG_LENGTH_BOTTOM*Math.cos(bAngle) - LEG_MOUNT_HEIGHT;
    const mAngle = this.getAngle('mount') + Math.atan2(LEG_MOUNT_WIDTH, mHeight);
    const mLength = Math.sqrt(Math.abs(mHeight**2 + LEG_MOUNT_WIDTH**2));
    const height = mLength*Math.cos(mAngle) + LEG_MOUNT_HEIGHT - (LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM);
    let sideways = mLength*Math.sin(mAngle) - LEG_MOUNT_WIDTH;
    if(this.legName.endsWith("Left")) {
      sideways *= -1;
    }
    return {forward:forward, height:height, sideways:sideways};
  }

  send = (arg1, arg2, arg3) => {
    if(!this.mainWindow.isDestroyed()) return this.mainWindow.webContents.send(arg1, arg2, arg3);
  }
}

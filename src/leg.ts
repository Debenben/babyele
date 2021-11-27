import { BrowserWindow, ipcMain } from "electron";
import { MotorAbstraction } from "./interfaces";
import { MotorName, LegName, Position, fromArray, toArray, parsePosition, cosLaw, invCosLaw } from "./tools";
import { NO_MOVE_MOTOR_ANGLE, TOP_MOTOR_RANGE, BOTTOM_MOTOR_RANGE, MOUNT_MOTOR_RANGE, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_MOUNT_HEIGHT, LEG_MOUNT_WIDTH, LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH } from "./param";

export class Leg {
  legName: LegName
  mainWindow: BrowserWindow
  motors: Record<MotorName, MotorAbstraction> = {top: null, bottom: null, mount: null}
  motorRanges: Record<MotorName, number> = {top: TOP_MOTOR_RANGE, bottom: BOTTOM_MOTOR_RANGE, mount: MOUNT_MOTOR_RANGE}
  motorAngles: Record<MotorName, number> = {top: 0, bottom: 0, mount: 0}
  destMotorAngles: Record<MotorName, number> = {top: 0, bottom: 0, mount: 0}
  bendForward: boolean = false
  positionSpeed: Position
  startMovePosition: Position
  positionSpeedIntervalID: NodeJS.Timeout

  constructor(legName: LegName, mainWindow: BrowserWindow) {
    this.legName = legName;
    this.mainWindow = mainWindow;
    ipcMain.on(this.legName, (event, arg1, arg2) => {
      if(arg1.startsWith("requestPositionSpeed")) {
        this.requestPositionSpeed(parsePosition(arg1, arg2));
      }
      else if(arg1 == "setBendForward") {
        this.bendForward = arg2;
      }
      else if(arg1 === "getProperties") {
        this.mainWindow.webContents.send('notifyLegPosition', this.legName, this.getPosition());
        this.mainWindow.webContents.send('notifyBendForward', this.legName, this.bendForward);
      }
    });
  }

  async addMotor(legMotorName: string, motor: MotorAbstraction) {
    if(!legMotorName.startsWith(this.legName)) {
      return true;
    }
    const motorName = legMotorName.replace(this.legName, "").toLowerCase();
    if(!motor) {
      this.mainWindow.webContents.send("notifyState", legMotorName, "offline");
      ipcMain.removeAllListeners(legMotorName);
      this.motors[motorName] = null;
      return false;
    }
    if(this.motors[motorName]) {
      return true;
    }
    this.motors[motorName] = motor;
    if(motor) {
      motor.setBrakingStyle(127); //Consts.BrakingStyle.BRAKE
      motor.setAccelerationTime(200);
      motor.setDecelerationTime(200);
      await this.requestRotation(motorName, 0);
      await motor.resetZero();
      ipcMain.on(legMotorName, (event, arg1, arg2) => {
        switch(arg1) {
          case "requestRotationSpeed":
            return this.requestRotationSpeed(motorName, arg2);
          case "requestRotation":
            return this.requestRotation(motorName, arg2);
          case "requestReset":
            return motor.resetZero();
        }
      });
      motor.on('rotate', ({degrees}) => {
        this.motorAngles[motorName] = degrees;
	ipcMain.emit("dog","rotationEvent","getProperties");
        this.mainWindow.webContents.send('notifyLegRotation', legMotorName, this.getAngle(motorName));
        this.mainWindow.webContents.send('notifyLegPosition', this.legName, this.getPosition());
      });
      this.mainWindow.webContents.send("notifyState", legMotorName, "online");
      return true;
    }
  }

  motorLoop() {
    let motorNames = Object.keys(this.motors);
    motorNames = motorNames.filter(n => this.motors[n] && Math.abs(this.destMotorAngles[n] - this.motorAngles[n]) > NO_MOVE_MOTOR_ANGLE);
    const diffMotorAngles = motorNames.map(n => (this.destMotorAngles[n] - this.motorAngles[n]));
    const motorSpeeds = diffMotorAngles.map(diff => (10*Math.sign(diff) + 90*diff/Math.max.apply(null, diffMotorAngles.map(Math.abs))));
    const promises = motorNames.map((n,i) => this.motors[n].rotateByDegrees(Math.abs(diffMotorAngles[i]), motorSpeeds[i]));
    return Promise.all(promises);
  }

  requestRotation(motorName: string, angle: number) {
    if(!(motorName === 'mount')) {
      this.destMotorAngles[motorName] = angle*this.motorRanges[motorName]/Math.PI;
      return this.motorLoop();
    }
    else {
      const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, angle+Math.PI/2);
      this.destMotorAngles['mount'] = (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges['mount'];
      return this.motorLoop();
    }
  }

  requestRotationSpeed(motorName: string, speed: number) {
    this.motors[motorName].setPower(speed);
    if(speed === 0) {
      this.destMotorAngles[motorName] = this.motorAngles[motorName];
    }
  }

  setPosition(position: Position) {
    if(this.legName.endsWith("Left")) {
      position.sideways *= -1;
    }
    const mAngle = Math.atan2(position.sideways + LEG_MOUNT_WIDTH, position.height + LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM - LEG_MOUNT_HEIGHT);
    const mLength = (position.height + LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM - LEG_MOUNT_HEIGHT)/Math.cos(mAngle);
    const mHeight = Math.sqrt(Math.abs(mLength**2 - LEG_MOUNT_WIDTH**2));
    const destMountAngle = mAngle - Math.atan2(LEG_MOUNT_WIDTH, mHeight);
    const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, destMountAngle+Math.PI/2);
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
      return invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, pistonLength)-Math.PI/2;
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
}

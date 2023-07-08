import { BrowserWindow, ipcMain } from "electron";
import { Leg } from "./leg";
import { HubAbstraction, LEDAbstraction, TiltSensorAbstraction, MotorAbstraction } from "./interfaces";
import { legNames, LegName, motorNames, Vector3, Quaternion, Pose, LegPositions } from "./tools";
import { MotorMap, NO_MOVE_MOTOR_ANGLE, MOTOR_UPDATE_INTERVAL, LEG_SEPARATION_LENGTH, LEG_SEPARATION_WIDTH, TILT_TYPES, ACCEL_NORM_MIN, ACCEL_NORM_MAX } from "./param";

const defaultLegPositions: LegPositions =
  {legFrontRight: new Vector3(LEG_SEPARATION_LENGTH/2,  0, -LEG_SEPARATION_WIDTH/2),
   legBackRight:  new Vector3(-LEG_SEPARATION_LENGTH/2, 0, -LEG_SEPARATION_WIDTH/2),
   legFrontLeft:  new Vector3(LEG_SEPARATION_LENGTH/2,  0,  LEG_SEPARATION_WIDTH/2),
   legBackLeft:   new Vector3(-LEG_SEPARATION_LENGTH/2, 0,  LEG_SEPARATION_WIDTH/2)};

const setHubProperty =
  (hub: HubAbstraction, property: number, value: number) => {
    return hub.send(Buffer.from([0x01, property, value]), "00001624-1212-efde-1623-785feabcd123");
  };

const dogPositionFromLegPositions = (legPositions: LegPositions) => {
    let position = new Vector3(0, 0, 0);
    for(const id of legNames) {
      position.addInPlace(legPositions[id].scale(0.25));
    }
    return position;
  };

const dogRotationFromLegPositions = (legPositions: LegPositions) => {
  const dogPosition = dogPositionFromLegPositions(legPositions);
  let averageRotation = Quaternion.Zero();
  for(const id of legNames) {
    const absolutePosition = legPositions[id].subtract(dogPosition);
    let legRotation = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(absolutePosition.normalize(), defaultLegPositions[id].normalizeToNew(), legRotation);
    legRotation.scaleAndAddToRef(0.25, averageRotation);
  }
  return averageRotation;
};

export class Dog {
  mainWindow: BrowserWindow
  legs: Record<LegName, Leg> = {} as Record<LegName, Leg>
  hubs: Record<string, HubAbstraction> = {}
  leds: Record<string, LEDAbstraction> = {}
  positionSpeed: Vector3
  rotationSpeed: Vector3
  startMovePositions: LegPositions = {} as LegPositions
  dogTilt: Quaternion = Quaternion.Identity()
  moveSpeedIntervalID: NodeJS.Timeout
  isComplete: boolean = false

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    for(const id of legNames) {
      this.legs[id] = new Leg(id, mainWindow);
      this.legs[id].setDogTilt(this.dogTilt);
    }
    ipcMain.on("dog", (event, arg1, arg2) => {
      if(arg1 === "requestPositionSpeed") {
        ipcMain.emit('requestMode', 'internal', 'MANUAL');
        this.positionSpeed = new Vector3(...arg2)
        this.requestMoveSpeed();
      }
      else if(arg1 === "requestRotationSpeed") {
        ipcMain.emit('requestMode', 'internal', 'MANUAL');
        this.rotationSpeed = new Vector3(...arg2);
        this.requestMoveSpeed();
      }
      else if(arg1 === "getProperties") {
        this.send('notifyDogPosition', "dog", this.getDogPosition());
        this.send('notifyDogRotation', "dog", this.getDogRotation().toEulerAngles());
        this.send('notifyTilt', "dog", this.getDogTilt());
      }
    });
  }

  async addHub(hub: HubAbstraction) {
    await hub.connect();
    console.log("Connected to " + hub.name + " firmware " + hub.firmwareVersion);
    if(MotorMap[hub.name]) {
      const hubName = MotorMap[hub.name]["name"];
      this.hubs[hubName] = hub;
      this.leds[hubName] = await hub.waitForDeviceByType(23); // Consts.DeviceType.HUB_LED
      this.send('notifyState', hubName, 'online');
      hub.removeAllListeners("attach");
      hub.on("attach", (device) => {
        this.init();
      });
      hub.removeAllListeners("detach");
      hub.on("detach", (device) => {
        this.init();
      });
      hub.removeAllListeners("button");
      hub.on("button", ({ event }) => {
        if(event === 2) { // Consts.ButtonState.PRESSED
          ipcMain.emit('requestMode', 'internal', 'BUTTON');
        }
      });
      hub.removeAllListeners("disconnect");
      hub.on("disconnect", () => {
        ipcMain.removeAllListeners(hubName);
        this.send('notifyState', hubName, 'offline');
        delete this.hubs[hubName];
        delete this.leds[hubName];
        this.init();
      });
      hub.removeAllListeners("batteryLevel");
      hub.on("batteryLevel", (level) => {
        return this.send('notifyBattery', hubName, Number(level.batteryLevel));
      });
      hub.removeAllListeners("rssi");
      hub.on("rssi", (rssi) => {
        return this.send('notifyRssi', hubName, Number(rssi.rssi));
      });
      ipcMain.on(hubName, (event, arg1) => {
        if(arg1 === "getProperties") {
          this.send('notifyBattery', hubName, hub.batteryLevel); // battery is only emitted on change
          setHubProperty(hub, 0x05, 0x05); // request rssi update
          setHubProperty(hub, 0x06, 0x05); // request battery update
        }
      });
      setHubProperty(hub, 0x05, 0x03); // disable rssi update
      setHubProperty(hub, 0x06, 0x03); // disable battery update
      this.init();
      return;
    }
    console.log("HubName " + hub.name + " not known, disconnecting");
    hub.disconnect();
  }

  async addDogTiltSensor(sensor: TiltSensorAbstraction, rotation, offset) {
    if(!sensor || !TILT_TYPES.includes(sensor.type)) return false;
    sensor.removeAllListeners("accel");
    sensor.on('accel', (accel) => {
      let acceleration = new Vector3(accel.x, accel.z, accel.y)
      acceleration.addInPlaceFromFloats(offset.x, offset.y, offset.z);
      if(acceleration.length() < ACCEL_NORM_MIN || acceleration.length() > ACCEL_NORM_MAX) return;
      acceleration.normalize();
      acceleration.applyRotationQuaternionInPlace(Quaternion.FromEulerAngles(rotation.x, rotation.y, rotation.z));
      Quaternion.FromUnitVectorsToRef(new Vector3(0, 1, 0), acceleration, this.dogTilt);
      this.send('notifyTilt', "dog", this.getDogTilt());
      for(const id of legNames) {
        this.legs[id].setDogTilt(this.dogTilt);
      }
    });
    sensor.send(Buffer.from([0x41, 0x61, 0x00, 0x20, 0x00, 0x00, 0x00, 0x01])); // subscribing again with larger delta interval
    return true
  }

  async init() {
    let complete = true;
    for(const hubNum of Object.keys(MotorMap)) {
      const hub = this.hubs[MotorMap[hubNum]["name"]];
      for(const portNum in MotorMap[hubNum]) {
        if(portNum === "name") continue;
        const deviceName = MotorMap[hubNum][portNum]["name"].toString();
        let device = null;
        if(hub) {
          device = hub.getDeviceAtPort(portNum);
	  if(!device) complete = false;
        }
        else {
          complete = false;
        }
	if(deviceName.startsWith("dog")) {
          const rotation = MotorMap[hubNum][portNum]["rotation"];
          const offset = MotorMap[hubNum][portNum]["offset"];
          complete = await this.addDogTiltSensor(device, rotation, offset) && complete;
	}
        for(const legNum in this.legs) {
          if(deviceName.startsWith(legNum)) {
            if(deviceName.endsWith("Tilt")) {
              const rotation = MotorMap[hubNum][portNum]["rotation"];
              const offset = MotorMap[hubNum][portNum]["offset"];
              complete = await this.legs[legNum].addTiltSensor(deviceName, device, rotation, offset) && complete;
            }
            else {
              const range = MotorMap[hubNum][portNum]["range"];
              const speed = MotorMap[hubNum][portNum]["speed"];
              complete = await this.legs[legNum].addMotor(deviceName, device, range, speed) && complete;
            }
          }
        }
      }
    }
    try {
      if(this.isComplete !== complete) {
        this.isComplete = complete;
        const state = this.isComplete ? "online" : "offline";
        this.send('notifyState', 'dog', state);
        ipcMain.emit('notifyState', 'internal', 'dog', state);
      }
    }
    catch(e) {
      console.log("unable to notify state change: " + e);
      return;
    }
  }

  buildLegRecord = (recordName) => {
    const record = {}
    for(const legName of legNames) {
      for(const motorName of motorNames) {
        record[legName + motorName] = this.legs[legName][recordName][motorName];
      }
    }
    return record;
  }

  getPose() {
    const pose = {} as Pose;
    for(const id of legNames) {
      pose[id] = JSON.parse(JSON.stringify(this.legs[id].motorAngles));
    }
    return pose;
  }

  getDogTilt() {
    return this.dogTilt.toEulerAngles();
  }

  getDogPosition() {
    return dogPositionFromLegPositions(this.legPositionsFromPose(this.getPose()));
  }

  getDogRotation() {
    return dogRotationFromLegPositions(this.legPositionsFromPose(this.getPose()));
  }

  motorLoop() {
    const motors = this.buildLegRecord('motors');
    const motorAngles = this.buildLegRecord('motorAngles');
    const motorSpeeds = this.buildLegRecord('motorSpeeds');
    const destMotorAngles = this.buildLegRecord('destMotorAngles');
    let motorNames = Object.keys(motors);
    motorNames = motorNames.filter(n => motors[n] && Math.abs(destMotorAngles[n] - motorAngles[n]) > NO_MOVE_MOTOR_ANGLE);
    const diffMotorAngles = motorNames.map(n => (destMotorAngles[n] - motorAngles[n]))
    const durations = motorNames.map((n,i) => Math.abs(diffMotorAngles[i])/motorSpeeds[n]);
    const maxDuration = Math.max.apply(null, durations);
    const speeds = diffMotorAngles.map((n,i) => Math.sign(n)*(90*durations[i]/maxDuration + 10));
    const promises = motorNames.map((n,i) => motors[n].rotateByDegrees(Math.abs(diffMotorAngles[i]), Math.round(speeds[i]), true));
    return Promise.all(promises);
  }

  requestMoveSpeed() {
    if((!this.positionSpeed || this.positionSpeed.length() === 0) && (!this.rotationSpeed || this.rotationSpeed.length() === 0)) {
      this.stop();
    }
    else if(this.moveSpeedIntervalID) {
      return;
    }
    else {
      this.startMovePositions = this.legPositionsFromPose(this.getPose());
      this.moveSpeedIntervalID = setInterval(() => {
        const startDogPosition = dogPositionFromLegPositions(this.startMovePositions);
        const averagePositionDiff = this.getDogPosition().subtract(startDogPosition);
        const startDogRotation = dogRotationFromLegPositions(this.startMovePositions);
        const averageRotation = this.getDogRotation().multiply(startDogRotation.invert());
	const destPositions = {} as LegPositions;
	for(const id of legNames) {
	  destPositions[id] = this.startMovePositions[id].clone();
	  if(this.rotationSpeed) {
            destPositions[id].applyRotationQuaternionInPlace(Quaternion.RotationAxis(this.rotationSpeed.normalizeToNew(), averageRotation.toEulerAngles().length()));
            destPositions[id].applyRotationQuaternionInPlace(Quaternion.RotationAxis(this.rotationSpeed.normalizeToNew(), this.rotationSpeed.length()*0.001));
	  }
	  if(this.positionSpeed) {
            destPositions[id].addInPlace(this.positionSpeed.normalizeToNew().scale(averagePositionDiff.length()));
            destPositions[id].addInPlace(this.positionSpeed.scale(0.1));
	  }
	}
	return this.requestPose(this.poseFromLegPositions(destPositions));
      }, MOTOR_UPDATE_INTERVAL);
    }
  }

  legPositionsFromPose(pose: Pose) {
    const legPositions = {} as LegPositions;
    for(const id of legNames) {
      legPositions[id] = this.legs[id].positionFromMotorAngles(pose[id]);
      legPositions[id].addInPlace(defaultLegPositions[id]);
    }
    return legPositions;
  }

  poseFromLegPositions(legPositions: LegPositions) {
    const pose: Pose = {} as Pose;
    for(const id of legNames) {
      const position = legPositions[id].subtractInPlace(defaultLegPositions[id]);
      pose[id] = this.legs[id].motorAnglesFromPosition(position);
    }
    return pose;
  }

  durationOfMoveTo(pose: Pose) {
    const durations = legNames.map(n => this.legs[n].durationOfMoveTo(this.legs[n].positionFromMotorAngles[n]));
    return Math.max.apply(null, durations);
  }

  requestPose(pose: Pose) {
    for(const id of legNames) {
      this.legs[id].destMotorAngles = JSON.parse(JSON.stringify(pose[id]));
    }
    return this.motorLoop();
  }

  stop() {
    clearInterval(this.moveSpeedIntervalID);
    this.moveSpeedIntervalID = null;
    for(const id of legNames) {
      this.legs[id].stop();
    }
  }

  synchronize() {
    for(const id of legNames) {
      for(const motorName of motorNames) {
        this.legs[id].synchronize(motorName);
      }
    }
  }

  shutdown() {
    this.stop();
    for(const hubNum of Object.keys(this.hubs)) {
      this.hubs[hubNum].shutdown();
    }
  }

  send = (arg1, arg2, arg3) => {
    if(!this.mainWindow.isDestroyed()) return this.mainWindow.webContents.send(arg1, arg2, arg3);
  }
}

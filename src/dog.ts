import { BrowserWindow, ipcMain } from "electron";
import { CommanderAbstraction } from "./commanderinterface";
import { SensorAbstraction } from "./sensorinterface";
import { legAnglesFromMotorAngles, legPositionsFromMotorAngles, dogRotationFromMotorAngles, dogPositionFromMotorAngles, motorAnglesFromLegPositions, motorAnglesFromLegAngles, durationsFromMotorAngles, dogRotationFromAcceleration, legAnglesFromAcceleration } from "./conversions";
import { Vec3, Vec43, Vector3, Quaternion, hubNames, motorNames, legNames } from "./tools";

const MOTOR_UPDATE_INTERVAL = 100; // interval in milliseconds for updating motor commands

const compareArrays = (a, b) => a.length === b.length && a.every((element, index) => element === b[index]);
const vec3IsZero = (vec: Vec3) => compareArrays(vec, [0,0,0]);
const vec43IsZero = (vec: Vec43) => vec.every(e => vec3IsZero(e));
const absMax = (vec: Vec43) => Math.max.apply(null, vec.map(e => Math.max.apply(null, e.map(f => Math.abs(f)))));

export interface DogAbstraction extends SensorAbstraction, CommanderAbstraction {
  attachCommander: (commander : CommanderAbstraction) => void;
}

export class Dog implements DogAbstraction {
  mainWindow: BrowserWindow
  commander: CommanderAbstraction

  _hubStatus: boolean[] = new Array(6).fill(false)
  _motorStatus: boolean[] = new Array(12).fill(false)
  _accelerometerStatus: boolean[] = new Array(10).fill(false)

  _motorAngles: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _topAcceleration: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _bottomAcceleration: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _dogAcceleration: Vec3 = [0,0,0]

  _bendForward: boolean[] = [false, true, false, true]
  _positionSpeed: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _rotationSpeed: Vec3 = [0,0,0]
  _startMoveMotorAngles: Vec43 = null
  moveSpeedIntervalID: NodeJS.Timeout = null

  get hubStatus() {
    return JSON.parse(JSON.stringify(this._hubStatus));
  }

  get motorStatus() {
    return JSON.parse(JSON.stringify(this._motorStatus));
  }

  get accelerometerStatus() {
    return JSON.parse(JSON.stringify(this._accelerometerStatus));
  }

  get motorAngles() {
    return JSON.parse(JSON.stringify(this._motorAngles));
  }

  get topAcceleration() {
    return JSON.parse(JSON.stringify(this._topAcceleration));
  }

  get bottomAcceleration() {
    return JSON.parse(JSON.stringify(this._bottomAcceleration));
  }

  get dogAcceleration() {
    return JSON.parse(JSON.stringify(this._dogAcceleration));
  }

  get bendForward() {
    return JSON.parse(JSON.stringify(this._bendForward));
  }

  get positionSpeed() {
    return JSON.parse(JSON.stringify(this._positionSpeed));
  }

  get rotationSpeed() {
    return JSON.parse(JSON.stringify(this._rotationSpeed));
  }

  get startMoveMotorAngles() {
    return JSON.parse(JSON.stringify(this._startMoveMotorAngles));
  }

  connect() {
    return this.commander.connect();
  }

  disconnect() {
    return this.commander.disconnect();
  }

  requestShutdown() {
    return this.commander.requestShutdown();
  }

  requestMotorSpeeds(motorSpeeds) {
    clearInterval(this.moveSpeedIntervalID);
    this.moveSpeedIntervalID = null;
    return this.commander.requestMotorSpeeds(motorSpeeds);
  }

  requestMotorAngles(motorAngles) {
    clearInterval(this.moveSpeedIntervalID);
    this.moveSpeedIntervalID = null;
    return this.commander.requestMotorAngles(motorAngles);
  }

  requestSync(motorAngles) {
    return this.commander.requestSync(motorAngles);
  }

  attachCommander(commander: CommanderAbstraction) {
    this.commander = commander;
  }

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    ipcMain.on("dog", (event, arg1, arg2) => {
      if(arg1 === "requestPositionSpeed") {
        this._positionSpeed = [arg2, arg2, arg2, arg2];
        this.requestMoveSpeed();
      }
      else if(arg1 === "requestRotationSpeed") {
        this._rotationSpeed = arg2;
        this.requestMoveSpeed();
      }
      if(arg1 === "getProperties") {
        this.send('notifyDogPosition', "dog", dogPositionFromMotorAngles(this.motorAngles));
        const rotation = dogRotationFromMotorAngles(this.motorAngles).toEulerAngles();
        this.send('notifyDogRotation', "dog", [rotation.x, rotation.y, rotation.z]);
      }
    });
    for(let i = 0; i < 4; i++)  {
      ipcMain.on(legNames[i], (event, arg1, arg2) => {
        if(arg1 === "requestPositionSpeed") {
          this._positionSpeed[i] = arg2;
          this.requestMoveSpeed();
        }
        else if(arg1 === "setBendForward") {
          this._bendForward[i] = arg2;
          this.send('notifyBendForward', legNames[i], this.bendForward[i]);
        }
        else if(arg1 === "getProperties") {
          this.send('notifyBendForward', legNames[i], this.bendForward[i]);
          this.send('notifyLegPosition', legNames[i], legPositionsFromMotorAngles(this.motorAngles)[i]);
          this.send('notifyLegRotation', legNames[i], legAnglesFromMotorAngles(this.motorAngles)[i]);
        }
      });
    }
    for(let i = 0; i < 12; i++) {
      ipcMain.on(motorNames[i], (event, arg1, arg2) => {
        if(arg1 === "requestRotationSpeed") {
          const speeds = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]];
          speeds[Math.floor(i/3)][i%3] = arg2;
          this.requestMotorSpeeds(speeds as Vec43);
        }
	else if(arg1 === "requestRotationAngle") {
          const angles = legAnglesFromMotorAngles(this.motorAngles);
          angles[Math.floor(i/3)][i%3] = arg2;
          this.requestMotorAngles(motorAnglesFromLegAngles(angles));
        }
      });
    }
  }

  async notifyHubStatus(hubStatus: boolean[]) {
    if(compareArrays(this._hubStatus, hubStatus)) return;
    this._hubStatus = hubStatus;
    for(let i = 0; i < 6; i++) {
      this.send('notifyStatus', hubNames[i], this.hubStatus[i]);
    }
    this.send('notifyStatus', 'dog', this.getDogStatus());
    ipcMain.emit('notifyStatus', 'internal', 'dog', this.getDogStatus());
  }

  async notifyMotorStatus(motorStatus: boolean[]) {
    if(compareArrays(this._motorStatus, motorStatus)) return;
    this._motorStatus = motorStatus;
    for(let i = 0; i < 12; i++) {
      this.send('notifyStatus', motorNames[i], this.motorStatus[i]);
    }
    this.send('notifyStatus', 'dog', this.getDogStatus());
    ipcMain.emit('notifyStatus', 'internal', 'dog', this.getDogStatus());
  }

  async notifyAccelerometerStatus(accelerometerStatus: boolean[]) {
    if(compareArrays(this._accelerometerStatus, accelerometerStatus)) return;
    this._accelerometerStatus = accelerometerStatus;
    this.send('notifyStatus', 'dog', this.getDogStatus());
    ipcMain.emit('notifyStatus', 'internal', 'dog', this.getDogStatus());
  }

  async notifyMotorAngles(motorAngles: Vec43) {
    this._motorAngles = motorAngles;
    const legAngles = legAnglesFromMotorAngles(this.motorAngles);
    for(let i = 0; i < 4; i++) {
      this.send('notifyLegRotation', legNames[i], legAngles[i]);
    }
    const legPositions = legPositionsFromMotorAngles(this.motorAngles);
    for(let i = 0; i < 4; i++) {
      this.send('notifyLegPosition', legNames[i], legPositions[i]);
    }
    this.send('notifyDogPosition', 'dog', dogPositionFromMotorAngles(this.motorAngles));
    const rotation = dogRotationFromMotorAngles(this.motorAngles).toEulerAngles();
    this.send('notifyDogRotation', 'dog', [rotation.x, rotation.y, rotation.z]);
  }

  async notifyTopAcceleration(acceleration: Vec43) {
    this._topAcceleration = acceleration;
    for(let i = 0; i < 4; i++) {
      this.send('notifyAcceleration', legNames[i] + "Top", this.topAcceleration[i]);
    }
    for(let i = 0; i < 4; i++) {
      this.send('notifyTilt', legNames[i], legAnglesFromAcceleration(this.dogAcceleration, this.topAcceleration, this.bottomAcceleration)[i]);
    }
  }

  async notifyBottomAcceleration(acceleration: Vec43) {
    this._bottomAcceleration = acceleration;
    for(let i = 0; i < 4; i++) {
      this.send('notifyAcceleration', legNames[i] + "Bottom", this.bottomAcceleration[i]);
    }
    for(let i = 0; i < 4; i++) {
      this.send('notifyTilt', legNames[i], legAnglesFromAcceleration(this.dogAcceleration, this.topAcceleration, this.bottomAcceleration)[i]);
    }
  }

  async notifyDogAcceleration(acceleration: Vec3) {
    this._dogAcceleration = acceleration;
    this.send('notifyAcceleration', "dog", this.dogAcceleration);
    this.send('notifyTilt', "dog", dogRotationFromAcceleration(this.dogAcceleration));
    for(let i = 0; i < 4; i++) {
      this.send('notifyTilt', legNames[i], legAnglesFromAcceleration(this.dogAcceleration, this.topAcceleration, this.bottomAcceleration)[i]);
    }
  }

  requestMoveSpeed() {
    ipcMain.emit('requestMode', 'internal', 'MANUAL');
    if(vec43IsZero(this.positionSpeed) && vec3IsZero(this.rotationSpeed)) {
      this.requestMotorSpeeds([[0,0,0], [0,0,0], [0,0,0], [0,0,0]]);
    }
    else if(this.moveSpeedIntervalID) {
      return;
    }
    else {
      this._startMoveMotorAngles = this.motorAngles;
      this.moveSpeedIntervalID = setInterval(() => {
        const averagePositionDiff = Vector3.FromArray(dogPositionFromMotorAngles(this.motorAngles)).subtract(Vector3.FromArray(dogPositionFromMotorAngles(this.startMoveMotorAngles)));
        const averageRotation = dogRotationFromMotorAngles(this.motorAngles).multiply(dogRotationFromMotorAngles(this.startMoveMotorAngles).invert());
	const destPositions = [];
	for(let i = 0; i < 4; i++) {
          destPositions[i] = Vector3.FromArray(legPositionsFromMotorAngles(this.startMoveMotorAngles)[i]);
          if(!vec3IsZero(this.rotationSpeed)) {
            destPositions[i].applyRotationQuaternionInPlace(Quaternion.RotationAxis(Vector3.FromArray(this.rotationSpeed).normalize(), averageRotation.toEulerAngles().length()));
            destPositions[i].applyRotationQuaternionInPlace(Quaternion.RotationAxis(Vector3.FromArray(this.rotationSpeed).normalize(), Vector3.FromArray(this.rotationSpeed).length()*0.001));
          }
          if(!vec43IsZero(this.positionSpeed)) {
            destPositions[i].addInPlace(Vector3.FromArray(this.positionSpeed[i]).normalize().scale(averagePositionDiff.length()));
            destPositions[i].addInPlace(Vector3.FromArray(this.positionSpeed[i]).scale(0.1));
          }
	}
	const destMotorAngles = motorAnglesFromLegPositions(destPositions.map(e => [e.x, e.y, e.z]) as Vec43, this.bendForward);
	const durations = durationsFromMotorAngles(this.motorAngles, destMotorAngles);
	const maxDuration = absMax(JSON.parse(JSON.stringify(durations)));
        const destMotorSpeeds = durations.map(e => e.map(f => 1000*f/maxDuration));
	return this.commander.requestMotorSpeeds(destMotorSpeeds as Vec43);
      }, MOTOR_UPDATE_INTERVAL);
    }
  }

  getDogStatus() {
    return this.hubStatus.concat(this.motorStatus).concat(this.accelerometerStatus).every(e => e);
  }

  send = (arg1, arg2, arg3) => {
    if(!this.mainWindow.isDestroyed()) return this.mainWindow.webContents.send(arg1, arg2, arg3);
  }
}

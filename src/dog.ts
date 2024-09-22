import { BrowserWindow, ipcMain } from "electron";
import { CommanderAbstraction } from "./commanderinterface";
import { SensorAbstraction } from "./sensorinterface";
import { legAnglesFromMotorAngles, legPositionsFromMotorAngles, dogRotationFromMotorAngles, dogPositionFromMotorAngles, motorAnglesFromLegPositions, motorAnglesFromLegAngles, durationsFromMotorAngles, dogRotationFromAcceleration, legAnglesFromAcceleration } from "./conversions";
import { Vec3, Vec43, Vector3, Quaternion, hubNames, motorNames, legNames } from "./tools";

const MOTOR_UPDATE_INTERVAL = 100; // interval in milliseconds for updating motor commands

const compareArrays = (a, b) => a.length === b.length && a.every((element, index) => element === b[index]);
const vec3IsZero = (vec: Vec3) => compareArrays(vec, [0,0,0]);
const vec43IsZero = (vec: Vec43) => vec.every(e => vec3IsZero(e));
const vec3AbsMax = (vec: Vec3) => Math.max.apply(null, vec.map(e => Math.abs(e)));
const vec43AbsMax = (vec: Vec43) => Math.max.apply(null, vec.map(e => Math.max.apply(null, e.map(f => Math.abs(f)))));
const vec3Copy = (vec: Vec3) => vec.slice(0) as Vec3;
const vec43Copy = (vec: Vec43) => [vec[0].slice(0), vec[1].slice(0), vec[2].slice(0), vec[3].slice(0)] as Vec43;

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
    return this._hubStatus.slice(0);
  }

  get motorStatus() {
    return this._motorStatus.slice(0);
  }

  get accelerometerStatus() {
    return this._accelerometerStatus.slice(0);
  }

  get motorAngles() {
    return vec43Copy(this._motorAngles);
  }

  get topAcceleration() {
    return vec43Copy(this._topAcceleration);
  }

  get bottomAcceleration() {
    return vec43Copy(this._bottomAcceleration);
  }

  get dogAcceleration() {
    return vec3Copy(this._dogAcceleration);
  }

  get bendForward() {
    return this._bendForward.slice(0);
  }

  get positionSpeed() {
    return vec43Copy(this._positionSpeed);
  }

  get rotationSpeed() {
    return vec3Copy(this._rotationSpeed);
  }

  get startMoveMotorAngles() {
    return vec43Copy(this._startMoveMotorAngles);
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
	else if(arg1 === "requestSync") {
          const syncAngle = motorAnglesFromLegAngles(legAnglesFromAcceleration(this.dogAcceleration, this.topAcceleration, this.bottomAcceleration))[Math.floor(i/3)][i%3];
	  const angles = this.motorAngles;
	  angles[Math.floor(i/3)][i%3] = syncAngle;
	  this.requestSync(angles);
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
      // stop
      return this.requestMotorSpeeds([[0,0,0], [0,0,0], [0,0,0], [0,0,0]]);
    }
    else if(this.moveSpeedIntervalID) {
      // already in progress
      return;
    }
    else if(vec3IsZero(this.rotationSpeed) && this.positionSpeed.filter(v => !vec3IsZero(v)).length === 1) {
      // one leg only
      this._startMoveMotorAngles = this.motorAngles;
      this.moveSpeedIntervalID = setInterval(() => {
        const currentPositions = legPositionsFromMotorAngles(this.motorAngles);
        const startPositions = legPositionsFromMotorAngles(this.startMoveMotorAngles);
        const destPositions = vec43Copy(startPositions);
	const speed = 0.01*vec43AbsMax(vec43Copy(this.positionSpeed));
	const legId = this.positionSpeed.findIndex(v => !vec3IsZero(v));
        const moveDirection = Vector3.FromArray(this.positionSpeed[legId]).normalize();
        const currentPositionLength = Vector3.FromArray(currentPositions[legId]).subtract(Vector3.FromArray(startPositions[legId])).length();
	let durations = null as Vec43;
        let maxDuration = 0;
	let moveLength = 1.0;
        for(let ni = 0; ni < 10; ni++) {
          const destPosition = Vector3.FromArray(startPositions[legId]).addInPlace(moveDirection.scale(currentPositionLength + moveLength));
          destPositions[legId] = [destPosition.x, destPosition.y, destPosition.z];
          const destMotorAngles = motorAnglesFromLegPositions(vec43Copy(destPositions), this.bendForward);
          durations = durationsFromMotorAngles(this.motorAngles, destMotorAngles);
          maxDuration = vec43AbsMax(vec43Copy(durations));
          if((1000*maxDuration - MOTOR_UPDATE_INTERVAL*speed)**2 < 100) break;
	  moveLength *= (MOTOR_UPDATE_INTERVAL*speed/(maxDuration*1000));
        }
	return this.commander.requestMotorSpeeds(durations.map(e => e.map(f => 1000*speed*f/maxDuration)) as Vec43);
      }, MOTOR_UPDATE_INTERVAL);
    }
    else {
      // complete dog
      this._startMoveMotorAngles = this.motorAngles;
      this.moveSpeedIntervalID = setInterval(() => {
	const speed = 0.01*Math.max(vec43AbsMax(vec43Copy(this.positionSpeed)), vec3AbsMax(vec3Copy(this.rotationSpeed)));
        const averagePositionDiff = Vector3.FromArray(dogPositionFromMotorAngles(this.motorAngles)).subtract(Vector3.FromArray(dogPositionFromMotorAngles(this.startMoveMotorAngles)));
        const averageRotation = dogRotationFromMotorAngles(this.motorAngles).multiply(dogRotationFromMotorAngles(this.startMoveMotorAngles).invert());
	const destPositions = [];
	let durations = null as Vec43;
        let maxDuration = 0;
	let moveLength = 1.0;
        for(let ni = 0; ni < 10; ni++) {
          for(let i = 0; i < 4; i++) {
            destPositions[i] = Vector3.FromArray(legPositionsFromMotorAngles(this.startMoveMotorAngles)[i]);
            if(!vec3IsZero(this.rotationSpeed)) {
              destPositions[i].applyRotationQuaternionInPlace(Quaternion.RotationAxis(Vector3.FromArray(this.rotationSpeed).normalize(), averageRotation.toEulerAngles().length()));
              destPositions[i].applyRotationQuaternionInPlace(Quaternion.RotationAxis(Vector3.FromArray(this.rotationSpeed).normalize(), moveLength));
            }
            if(!vec43IsZero(this.positionSpeed)) {
              destPositions[i].addInPlace(Vector3.FromArray(this.positionSpeed[i]).normalize().scale(averagePositionDiff.length()));
              destPositions[i].addInPlace(Vector3.FromArray(this.positionSpeed[i]).scale(moveLength));
            }
          }
          const destMotorAngles = motorAnglesFromLegPositions(destPositions.map(e => [e.x, e.y, e.z]) as Vec43, this.bendForward);
          durations = durationsFromMotorAngles(this.motorAngles, destMotorAngles);
          maxDuration = vec43AbsMax(vec43Copy(durations));
          if((1000*maxDuration - MOTOR_UPDATE_INTERVAL*speed)**2 < 100) break;
	  moveLength *= (MOTOR_UPDATE_INTERVAL*speed/(maxDuration*1000));
        }
	return this.commander.requestMotorSpeeds(durations.map(e => e.map(f => 1000*speed*f/maxDuration)) as Vec43);
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

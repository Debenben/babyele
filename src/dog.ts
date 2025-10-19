import { BrowserWindow, ipcMain } from "electron";
import { CommanderAbstraction } from "./commanderinterface";
import { SensorAbstraction } from "./sensorinterface";
import { legAnglesFromMotorAngles, legPositionsFromMotorAngles, dogRotationFromMotorAngles, dogPositionFromMotorAngles, motorAnglesFromLegPositions, motorAnglesFromLegAngles, durationsFromMotorAngles, dogRotationFromAcceleration, legAnglesFromAcceleration, motorAnglesTimeEvolution, quatFromAxisAngle } from "./conversions";
import { Vec3, Vec4, Vec43, hubNames, motorNames, legNames, compareArrays, vec3IsZero, vec43IsZero, vec3AbsMax, vec43AbsMax, vec3Copy, vec43Copy, vec43Sum, vec3Len, vec3Normalize, vec4Normalize, vec3Sub, vec4Cross, vec3Rotate } from "./tools";

const MOTOR_UPDATE_INTERVAL = 200; // interval in milliseconds for updating motor commands
const HUB_TIMEOUT = 10000; // timeout in milliseconds for showing hub as offline

const quatToAngle = (q: Vec4) => Math.abs(q[3]) >= 1 ? 0 : 2.0*Math.acos(q[3]);

export interface DogAbstraction extends SensorAbstraction, CommanderAbstraction {
  attachCommander: (commander : CommanderAbstraction) => void;
}

export class Dog implements DogAbstraction {
  mainWindow: BrowserWindow
  commander: CommanderAbstraction

  _hubStatus = [0,0,0,0,0,0]
  _hubTimestamps = [[0],[0],[0],[0],[0],[0]]
  _hubRssis = [[0],[0],[0],[0],[0],[0]]
  _hubTimestampsIntervalID: NodeJS.Timeout = null

  _motorAngles: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _motorAnglesTimestamps: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _topAcceleration: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _bottomAcceleration: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _dogAcceleration: Vec3 = [0,0,0]

  _bendForward: boolean[] = [false, true, false, true]
  _positionSpeed: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _rotationSpeed: Vec3 = [0,0,0]
  _startMoveMotorAngles: Vec43 = null
  _moveSpeed: Vec43 = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]
  _moveSpeedIntervalID: NodeJS.Timeout = null

  get hubStatus() {
    return this._hubStatus.slice(0);
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

  requestMotorSpeeds(motorSpeeds: Vec43) {
    clearInterval(this._moveSpeedIntervalID);
    this._moveSpeedIntervalID = null;
    return this.commander.requestMotorSpeeds(motorSpeeds);
  }

  requestMotorAngles(motorAngles: Vec43) {
    clearInterval(this._moveSpeedIntervalID);
    this._moveSpeedIntervalID = null;
    return this.commander.requestMotorAngles(motorAngles);
  }

  requestSync(motorAngles: Vec43) {
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
        this.send('notifyDogRotation', "dog", dogRotationFromMotorAngles(this.motorAngles));
      }
    });
    for(let i = 0; i < 6; i++) {
      ipcMain.on(hubNames[i], (event, arg1, arg2) => {
        if(arg1 === "getProperties") {
          this.send('notifyStatus', hubNames[i], this.hubStatus[i]);
           this.send('notifyTimestamps', hubNames[i], this._hubTimestamps[i].slice(0));
           this.send('notifyRssis', hubNames[i], this._hubRssis[i].slice(0));
        }
      });
    }
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
    this._hubTimestampsIntervalID = setInterval(async () => {
      for(let id=0; id<6; id++) {
        const last = this._hubTimestamps[id].slice(-1)[0];
        if(last > 0 && Date.now() - last > HUB_TIMEOUT) this.notifyHubStatus(id, 0, 0, 0);
	if(this._hubTimestamps[id].length > 1200) {
          this._hubTimestamps[id].splice(0, this._hubTimestamps[id].length - 1000);
          this._hubRssis[id].splice(0, this._hubRssis[id].length - 1000);
	}
      }
    }, 200);
  }

  async notifyHubStatus(id: number, status: number, timestamp: number, rssi: number) {
    this._hubTimestamps[id].push(timestamp);
    this._hubRssis[id].push(rssi);
    if(this._hubStatus[id] == status) return;
    this._hubStatus[id] = status;
    this.send('notifyStatus', hubNames[id], status);
    if(id < 4) {
      this.send('notifyStatus', motorNames[3*id + 2], (status & 0b00000010) == 0b00000010);
    }
    else {
      this.send('notifyStatus', motorNames[(id - 4)*6], (status & 0b00000010) == 0b00000010);
      this.send('notifyStatus', motorNames[(id - 4)*6 + 1], (status & 0b00000100) == 0b00000100);
      this.send('notifyStatus', motorNames[(id - 4)*6 + 3], (status & 0b00001000) == 0b00001000);
      this.send('notifyStatus', motorNames[(id - 4)*6 + 4], (status & 0b00010000) == 0b00010000);
    }
    this.send('notifyStatus', 'dog', this.getDogStatus());
    ipcMain.emit('notifyStatus', 'internal', 'dog', this.getDogStatus());
  }

  async notifyMotorAngles(motorAngles: Vec43) {
    for(let i = 0; i < 4; i++) {
      motorAngles[i].forEach((e,j) => {
        if(!isNaN(e)) {
          this._motorAngles[i][j] = e;
          this._motorAnglesTimestamps[i][j] = Date.now();
        }
      });
    }
    const legAngles = legAnglesFromMotorAngles(this.motorAngles);
    const legPositions = legPositionsFromMotorAngles(this.motorAngles);
    for(let i = 0; i < 4; i++) {
      if(motorAngles[i].every(isNaN)) continue;
      this.send('notifyLegRotation', legNames[i], legAngles[i]);
      this.send('notifyLegPosition', legNames[i], legPositions[i]);
    }
    this.send('notifyDogPosition', 'dog', dogPositionFromMotorAngles(this.motorAngles));
    this.send('notifyDogRotation', 'dog', dogRotationFromMotorAngles(this.motorAngles));
  }

  async notifyLegAcceleration(topA: Vec43, bottomA: Vec43) {
    for(let i = 0; i < 4; i++) {
      if(topA[i].every(isNaN) && bottomA[i].every(isNaN)) continue;
      for(let j = 0; j < 3; j++) {
        if(!isNaN(topA[i][j])) this._topAcceleration[i][j] = topA[i][j];
        if(!isNaN(bottomA[i][j])) this._bottomAcceleration[i][j] = bottomA[i][j];
      }
      this.send('notifyAcceleration', legNames[i] + "Top", this.topAcceleration[i]);
      this.send('notifyAcceleration', legNames[i] + "Bottom", this.bottomAcceleration[i]);
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
      this._moveSpeed = [[0,0,0], [0,0,0], [0,0,0], [0,0,0]];
      return this.requestMotorSpeeds(this._moveSpeed);
    }
    else if(this._moveSpeedIntervalID) {
      // already in progress
      return;
    }
    else if(vec3IsZero(this.rotationSpeed) && this.positionSpeed.filter(v => !vec3IsZero(v)).length === 1) {
      // one leg only
      this._startMoveMotorAngles = this.motorAngles;
      this._moveSpeedIntervalID = setInterval(() => {
        const motorAnglesEvolved = motorAnglesTimeEvolution(this.motorAngles, this._motorAnglesTimestamps, this._moveSpeed);
        const currentPositions = legPositionsFromMotorAngles(vec43Copy(motorAnglesEvolved));
        const startPositions = legPositionsFromMotorAngles(this.startMoveMotorAngles);
        const destPositions = vec43Copy(startPositions);
	const speed = 0.01*vec43AbsMax(vec43Copy(this.positionSpeed));
	const legId = this.positionSpeed.findIndex(v => !vec3IsZero(v));
        const moveDirection = vec3Normalize(this.positionSpeed[legId]);
        const currentPositionLength = vec3Len(vec3Sub(currentPositions[legId], startPositions[legId]));
	let durations = null as Vec43;
        let maxDuration = 0;
	let moveLength = 1.0;
        for(let ni = 0; ni < 10; ni++) {
          destPositions[legId] = startPositions[legId].map((e,i) => e + moveDirection[i]*(currentPositionLength + moveLength));
          const destMotorAngles = motorAnglesFromLegPositions(vec43Copy(destPositions), this.bendForward);
          durations = durationsFromMotorAngles(motorAnglesEvolved, destMotorAngles);
          maxDuration = vec43AbsMax(vec43Copy(durations));
          if((1000*maxDuration - MOTOR_UPDATE_INTERVAL*speed)**2 < 100) break;
          moveLength *= (MOTOR_UPDATE_INTERVAL*speed/(maxDuration*1000));
        }
	this._moveSpeed = durations.map(e => e.map(f => 1000*speed*f/maxDuration)) as Vec43;
	return this.commander.requestMotorSpeeds(this._moveSpeed);
      }, MOTOR_UPDATE_INTERVAL);
    }
    else {
      // complete dog
      this._startMoveMotorAngles = this.motorAngles;
      this._moveSpeedIntervalID = setInterval(() => {
        const motorAnglesEvolved = motorAnglesTimeEvolution(this.motorAngles, this._motorAnglesTimestamps, this._moveSpeed);
	const speed = 0.01*Math.max(vec43AbsMax(vec43Copy(this.positionSpeed)), vec3AbsMax(vec3Copy(this.rotationSpeed)));
        const averagePositionDiff = vec3Len(vec43Sum(legPositionsFromMotorAngles(vec43Copy(motorAnglesEvolved))).map((e,i) => e - vec43Sum(legPositionsFromMotorAngles(this.startMoveMotorAngles))[i]));
        const averageRotation = vec4Cross(dogRotationFromMotorAngles(vec43Copy(this.startMoveMotorAngles)), dogRotationFromMotorAngles(vec43Copy(motorAnglesEvolved)));
        const averageRotationAngle = quatToAngle(vec4Normalize(averageRotation));
        const destPositions = legPositionsFromMotorAngles(vec43Copy(this.startMoveMotorAngles));
	let durations = null as Vec43;
        let maxDuration = 0;
        let moveLength = 0.1;
        // iteratively improve speeds for up to 10 iterations
        for(let ni = 0; ni < 10; ni++) {
          for(let i = 0; i < 4; i++) {
            // reset destPosition every iteration
            destPositions[i] = legPositionsFromMotorAngles(vec43Copy(this.startMoveMotorAngles))[i];
            destPositions[i] = destPositions[i].map((e,j) => e + vec3Normalize(this.positionSpeed[i])[j]*(averagePositionDiff + moveLength));
            destPositions[i] = vec3Rotate(destPositions[i], quatFromAxisAngle(this.rotationSpeed, averageRotationAngle + moveLength));
          }
          const destMotorAngles = motorAnglesFromLegPositions(destPositions, this.bendForward);
          durations = durationsFromMotorAngles(motorAnglesEvolved, destMotorAngles);
          maxDuration = vec43AbsMax(vec43Copy(durations));
          if((1000*maxDuration - MOTOR_UPDATE_INTERVAL*speed)**2 < 100) break;
          moveLength *= (MOTOR_UPDATE_INTERVAL*speed/(maxDuration*1000));
        }
	this._moveSpeed = durations.map(e => e.map(f => 1000*speed*f/maxDuration)) as Vec43;
	return this.commander.requestMotorSpeeds(this._moveSpeed);
      }, MOTOR_UPDATE_INTERVAL);
    }
  }

  getDogStatus() {
    for(let i = 0; i < 4; i++) {
      if((this.hubStatus[i] & 0b01100111) != 0b00100111) return false;
    }
    for(let i = 4; i < 6; i++) {
      if((this.hubStatus[i] & 0b01111111) != 0b00111111) return false;
    }
    return true;
  }

  send = (arg1, arg2, arg3) => {
    if(!this.mainWindow.isDestroyed()) return this.mainWindow.webContents.send(arg1, arg2, arg3);
  }
}

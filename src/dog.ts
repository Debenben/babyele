import { BrowserWindow, ipcMain } from "electron";
import { Leg } from "./leg";
import { HubAbstraction, LEDAbstraction, MotorAbstraction } from "./interfaces";
import { legNames, LegName, motorNames, Position, Pose, fromArray, toArray, parsePosition, add, multiply, getRotation, rotate } from "./tools";
import { Modes, MotorMap, allowSwitch, NO_MOVE_MOTOR_ANGLE, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_SEPARATION_LENGTH, LEG_SEPARATION_WIDTH } from "./param";

export class Dog {
  mainWindow: BrowserWindow
  mode: Modes = Modes.OFFLINE
  modeQueue: Modes [] = []
  legs: Record<LegName, Leg> = {} as Record<LegName, Leg>
  hubs: Record<string, HubAbstraction> = {}
  leds: Record<string, LEDAbstraction> = {}
  color: number = 0
  positionSpeed: Position
  rotationSpeed: Position
  defaultLegPositions: Record<LegName, Position> = 
    {legFrontRight: {forward:LEG_SEPARATION_LENGTH/2, height:0, sideways:LEG_SEPARATION_WIDTH/2},
     legBackRight: {forward:-LEG_SEPARATION_LENGTH/2, height:0, sideways:LEG_SEPARATION_WIDTH/2},
     legFrontLeft: {forward:LEG_SEPARATION_LENGTH/2, height:0, sideways:-LEG_SEPARATION_WIDTH/2},
     legBackLeft: {forward:-LEG_SEPARATION_LENGTH/2, height:0, sideways:-LEG_SEPARATION_WIDTH/2}}; 
  startMovePositions: Record<LegName, Position>
  moveSpeedIntervalID: NodeJS.Timeout
  stepForward: number = 80 // (pos0) <-- stepWidth --> (pos1) <-- stepWidth --> (pos2) <-- stepWidth --> (pos3)
  stepHeight: number = -40 // height when repositioning leg
  stepSideways: number = 40 // additional separation of legs
  stepPositionLevel: Position = {forward:(20 - 1.5*this.stepForward), height:-80, sideways:0}; 
  stepRotationLevel: Position = {forward:0, height:0, sideways:0}

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    for(let id of legNames) {
      this.legs[id] = new Leg(id, mainWindow);
    }
    setInterval(() => {
      for(let ledNum in this.leds) {
        if(this.leds[ledNum]) {
          this.leds[ledNum].setColor(((this.mode+7)%10+1)*(this.color%2));
        }
      }
      this.color++;
    }, 1000);
    ipcMain.on("getHubProperties", () => {
      for(let hubNum in this.hubs) {
        this.mainWindow.webContents.send('notifyBattery', hubNum, this.hubs[hubNum].batteryLevel);
        this.mainWindow.webContents.send('notifyRssi', hubNum, this.hubs[hubNum].rssi);
      }
    });
    ipcMain.on("dog", (event, arg1, arg2) => {
      if(arg1.startsWith("requestPositionSpeed")) {
        this.positionSpeed = parsePosition(arg1, arg2);
	      this.requestMoveSpeed();
      }
      else if(arg1.startsWith("requestRotationSpeed")) {
        this.rotationSpeed = parsePosition(arg1, arg2);
	      this.requestMoveSpeed();
      }
      else if(arg1 === "requestMode") {
        this.requestMode(arg2);
      }
      else if(arg1 === "getProperties") {
        this.mainWindow.webContents.send('notifyDogPosition', "dog", this.getDogPosition());
        this.mainWindow.webContents.send('notifyDogRotation', "dog", this.getDogRotation());
      }
    });
  }

  async addHub(hub: HubAbstraction) {
    await hub.connect();
    console.log("Connected to " + hub.name);
    if(MotorMap[hub.name]) {
      const hubName = MotorMap[hub.name]["name"];
      this.hubs[hubName] = hub;
      this.leds[hubName] = await hub.waitForDeviceByType(23); //Consts.DeviceType.HUB_LED
      this.mainWindow.webContents.send('notifyState', hubName, 'online');
      hub.on("attach", (device) => {
        this.init();
      });
      hub.on("detach", (device) => {
        this.init();
      });
      hub.on("button", ({ event }) => {
        if(event === 2) { //Consts.ButtonState.PRESSED
          if(this.mode === Modes.STANDING) {
            this.requestMode(Modes.FORWARD);
          }
          else if(this.mode === Modes.READY0) {
            this.requestMode(Modes.STANDING);
          }
          else {
            this.requestMode(Modes.READY0);
          }
        }
      });
      hub.on("disconnect", () => {
        this.mainWindow.webContents.send('notifyState', hubName, 'offline');
        this.hubs[hubName] = null;
        this.leds[hubName] = null;
	      this.init();
      });
      hub.on("batteryLevel", (level) => {
        return this.mainWindow.webContents.send('notifyBattery', hubName, Number(level.batteryLevel));
      });
      hub.on("rssi", (rssi) => {
        return this.mainWindow.webContents.send('notifyRssi', hubName, Number(rssi.rssi));
      });
      if(hubName === 'hubBackCenter') {
        hub.on('tilt', (device, tilt) => {
          const x = tilt.x;
          const y = tilt.z;
          const z = tilt.y;
          return this.mainWindow.webContents.send('notifyTilt', hubName, { x, y, z });
        });
      }
      else if(hubName === 'hubFrontCenter') {
        hub.on('tilt', (device, tilt) => {
          const x = -tilt.x;
          const y = tilt.z;
          const z = -tilt.y;
          return this.mainWindow.webContents.send('notifyTilt', hubName, { x, y, z });
        });
      }
      this.init();
      return;
    }
    console.log("HubName " + hub.name + " not known, disconnecting");
    hub.disconnect();
  }

  async init() {
    let deviceComplete = true;
    let hubComplete = true;
    for(let hubNum in MotorMap) {
      for(let portNum in MotorMap[hubNum]) {
        for(let legNum in this.legs) {
          try {
            deviceComplete = await this.legs[legNum].addMotor(MotorMap[hubNum][portNum], this.hubs[MotorMap[hubNum]["name"]].getDeviceAtPort(portNum)) && deviceComplete;
          }
          catch(e) {
            hubComplete = false;
            this.legs[legNum].addMotor(MotorMap[hubNum][portNum], null);
          }
	}
      }
    }
    if(hubComplete) {
      this.mode = Modes.WAITING;
      if(deviceComplete) {
        getStanding(this);
        this.modeQueue = [];
      }
    }
    else {
      this.mode = Modes.OFFLINE;
    }
    try {
      this.mainWindow.webContents.send('notifyMode', this.mode);
    }
    catch(e) {
      console.log("unable to notify mode change: " + e);
      return;
    }
  }

  requestMode(destMode: Modes) {
    if(this.modeQueue.length && allowSwitch(this.modeQueue[this.modeQueue.length-1], destMode)) {
      return this.modeQueue.push(destMode);
    }
    else if(allowSwitch(this.mode, destMode)) {
      this.modeQueue.push(destMode);
      this.modeLoop();
      return Promise.resolve();
    }
    else {
      console.log("Cannot switch to " + Modes[destMode]);
      return;
    }
  }

  async modeLoop() {
    while(this.modeQueue.length) {
      let dest = this.modeQueue[0];
      if(this.mode === dest) {
        this.modeQueue.shift();
        continue;
      }
      if(dest === Modes.FORWARD && this.modeQueue.length > 1) {
        this.modeQueue.shift();
        continue;
      }
      if(dest === Modes.OFFLINE) {
        return shutdown(this);
      }
      if(dest === Modes.STANDING) {
        await getStanding(this);
        continue;
      }
      if(dest === Modes.DOWN) {
        await getDown(this);
        continue;
      }
      if(this.mode === Modes.STANDING && dest === Modes.READY0) {
        await getReady(this);
        continue;
      }
      if(this.mode === Modes.STANDING && dest === Modes.FORWARD) {
        await getReady(this);
        continue;
      }
      await forward(this);
    }
    return Promise.resolve();
  }

  setBendForward() {
    for(let i in this.legs) {
      this.legs[i].bendForward = true;
    }
  }

  buildLegRecord = (recordName) => {
    let record = {}
    for(let legName of legNames) {
      for(let motorName of motorNames) {
        record[legName + motorName] = this.legs[legName][recordName][motorName];
      }
    }
    return record;
  }

  getPose() {
    let pose = {} as Pose;
    for(let id of legNames) {
      pose[id] = {position: this.legs[id].getPosition(), bendForward: this.legs[id].bendForward};
    }
    return pose;
  }

  getDogPosition() {
    let averagePosition = {forward:0, height:0, sideways:0};
    for(let id of legNames) {
      averagePosition = add(averagePosition, multiply(0.25,(this.legs[id].getPosition())));
    }
    return averagePosition;
  }

  getDogRotation() {
    let averageRotation = {forward:0, height:0, sideways:0};
    const dogPosition = this.getDogPosition();
    for(let id of legNames) {
      const absolutePosition = add(this.legs[id].getPosition(), add(this.defaultLegPositions[id], multiply(-1,dogPosition)));
      averageRotation = add(averageRotation, multiply(0.25, getRotation(absolutePosition)));
    }
    return averageRotation;
  }

  motorLoop() {
    const motors = this.buildLegRecord('motors');
    const motorAngles = this.buildLegRecord('motorAngles');
    const destMotorAngles = this.buildLegRecord('destMotorAngles');
    let motorNames = Object.keys(motors);
    motorNames = motorNames.filter(n => motors[n] && Math.abs(destMotorAngles[n] - motorAngles[n]) > NO_MOVE_MOTOR_ANGLE);
    const diffMotorAngles = motorNames.map(n => (destMotorAngles[n] - motorAngles[n]))
    const motorSpeeds = diffMotorAngles.map(diff => (10*Math.sign(diff) + 90*diff/Math.max.apply(null, diffMotorAngles.map(Math.abs))));
    const promises = motorNames.map((n,i) => motors[n].rotateByDegrees(Math.abs(diffMotorAngles[i]), motorSpeeds[i]));
    return Promise.all(promises);
  }

  requestMoveSpeed() {
    if(!this.positionSpeed && !this.rotationSpeed) {
      clearInterval(this.moveSpeedIntervalID);
      this.moveSpeedIntervalID = null;
    }
    else if(this.moveSpeedIntervalID) {
      return;
    }
    else {
      this.startMovePositions = {} as Record<LegName, Position>;
      for(let id of legNames) {
        this.startMovePositions[id] = this.legs[id].getPosition();
      };
      this.moveSpeedIntervalID = setInterval(() => {
        /* calculate initial dog position */
        let startDogPosition = {forward:0, height:0, sideways:0};
        for(let id of legNames) {
          startDogPosition = add(startDogPosition, multiply(0.25,this.startMovePositions[id]))
        }
        const averagePositionDiff = add(this.getDogPosition(), multiply(-1,startDogPosition));
        /* calculate dog rotation with respect to initial position */
        let startDogRotation = {forward:0, height:0, sideways:0};
        for(let id of legNames) {
          const startAbsolute = add(this.startMovePositions[id], add(this.defaultLegPositions[id], multiply(-1,startDogPosition)));
          const currentAbsolute = add(this.legs[id].getPosition(), add(this.defaultLegPositions[id], multiply(-1,this.getDogPosition())));
          const startRotation = getRotation(startAbsolute);
          const currentRotation = getRotation(currentAbsolute);
          startDogRotation = add(startDogRotation, multiply(0.25,startRotation));
        }
        const averageRotation = add(this.getDogRotation(), multiply(-1,startDogRotation));
        /* determine new positions */
        for(let id of legNames) {
          const startAbsolute = add(this.startMovePositions[id], add(this.defaultLegPositions[id], multiply(-1,startDogPosition)));
          let rotationMove = {forward:0, height:0, sideways:0};
          if(this.rotationSpeed) {
            for(let i in rotationMove) {
              if(this.rotationSpeed[i] == 0) rotationMove[i] = 0;
              else rotationMove[i] = averageRotation[i] + this.rotationSpeed[i]/10000;
            }
          }
          let positionMove = {forward:0, height:0, sideways:0};
          if(this.positionSpeed) {
            for(let i in positionMove) {
              if(this.positionSpeed[i] == 0) positionMove[i] = 0;
              else positionMove[i] = averagePositionDiff[i] + this.positionSpeed[i]/10;
            }
          }
          const newPosition = add(rotate(startAbsolute, rotationMove), add(startDogPosition, add(multiply(-1,this.defaultLegPositions[id]), positionMove)));
          this.legs[id].setPosition(newPosition);
        }
        return this.motorLoop();
      }, 100);
    }
  }

  move(backLeftForward, backLeftHeight, backLeftSideways, frontLeftForward, frontLeftHeight, frontLeftSideways, frontRightForward, frontRightHeight, frontRightSideways, backRightForward, backRightHeight, backRightSideways) {
    const bl = this.legs['legBackLeft'].setPosition.bind(this.legs['legBackLeft']);
    const blp = add(this.stepPositionLevel, {forward:backLeftForward*this.stepForward, height:backLeftHeight*this.stepHeight, sideways:backLeftSideways*this.stepSideways});
    const fl = this.legs['legFrontLeft'].setPosition.bind(this.legs['legFrontLeft']);
    const flp = add(this.stepPositionLevel, {forward:frontLeftForward*this.stepForward, height:frontLeftHeight*this.stepHeight, sideways:frontLeftSideways*this.stepSideways});
    const fr = this.legs['legFrontRight'].setPosition.bind(this.legs['legFrontRight']);
    const frp = add(this.stepPositionLevel, {forward:frontRightForward*this.stepForward, height:frontRightHeight*this.stepHeight, sideways:frontRightSideways*this.stepSideways});
    const br = this.legs['legBackRight'].setPosition.bind(this.legs['legBackRight']);
    const brp = add(this.stepPositionLevel, {forward:backRightForward*this.stepForward, height:backRightHeight*this.stepHeight, sideways:backRightSideways*this.stepSideways});
    Promise.all([ bl(blp), fl(flp), fr(frp), br(brp)]);
    return this.motorLoop();
  }
}

const getReady = async (dog: Dog) => {
  await dog.setBendForward();
  if(dog.mode === Modes.STANDING) {
    await dog.move(   0,   0,   0,     0,   0,   0,        0,   0,   0,     0,   0,   0 );
    await dog.move(   0,   0,   1,     0,   0,   1,        0,   0,   1,     0,   1,   1 );
    await dog.move(   0,   0,   1,     0,   0,   1,        0,   0,   1,     1,   1,   1 );
    await dog.move(   0,   0,   1,     0,   0,   1,        0,   0,   1,     1,   0,   1 );
    await dog.move(   0,   0,  -1,     0,   1,  -2,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   0,  -1,     2,   1,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   0,  -1,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   1,  -1,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   3,   1,  -3,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   3,   0,  -3,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
  }
  await dog.move(   3,   0,  -1,     2,   0,  -1,        0,   0,   1,     1,   0,   1 );
  dog.mode = Modes.READY0;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}

const getStanding = async (dog: Dog) => {
  if(dog.mode === Modes.READY0) {
    await dog.move(   3,   0,  -1,     2,   0,  -1,        0,   0,   1,     1,   0,   1 );
    await dog.move(   3,   0,  -3,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   3,   1,  -3,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   1,  -1,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   0,  -1,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   0,  -1,     2,   1,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   0,  -1,     0,   1,  -2,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   0,   0,   1,     0,   0,   1,        0,   0,   1,     1,   0,   1 );
    await dog.move(   0,   0,   1,     0,   0,   1,        0,   0,   1,     1,   1,   1 );
    await dog.move(   0,   0,   1,     0,   0,   1,        0,   0,   1,     0,   1,   1 );
    await dog.move(   0,   0,   0,     0,   0,   0,        0,   0,   0,     0,   0,   0 );
  }
  await dog.setBendForward();
  for(let id in dog.legs) {
    dog.legs[id].setPosition({forward:0, height:0, sideways:0});
  }
  await dog.motorLoop();
  dog.mode = Modes.STANDING;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}

const forward = async (dog: Dog) => {
  await dog.setBendForward();
  if(dog.mode === Modes.READY0) {
    await dog.move(   3,   0,  -1,     2,   0,  -1,        0,   0,   1,     1,   0,   1 );
    await dog.move(   3,   0,  -3,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   3,   1,  -3,     2,   0,  -3,        0,   0,  -1,     1,   0,  -1 );
    await dog.move(   2,   2,  -3,   2.4,   0,  -3,      0.4,   0,  -1,   1.4,   0,  -1 );
    await dog.move(   1,   2,  -3,   2.6,   0,  -3,      0.6,   0,  -1,   1.6,   0,  -1 );
    await dog.move(   0,   1,  -3,     3,   0,  -3,        1,   0,  -1,     2,   0,  -1 );
    await dog.move(   0,   0,  -3,     3,   0,  -3,        1,   0,  -1,     2,   0,  -1 );
    dog.mode += 1;
  }
  else if(dog.mode === Modes.READY1) {
    await dog.move(   0,   0,  -3,     3,   0,  -3,        1,   0,  -1,     2,   0,  -1 );
    await dog.move(   0,   0,  -3,     3,   1,  -3,        1,   0,  -1,     2,   0,  -1 );
    await dog.move( 0.4,   0,  -3,     2,   2,  -3,      1.4,   0,  -1,   2.4,   0,  -1 );
    await dog.move( 0.6,   0,  -3,     1,   2,  -3,      1.6,   0,  -1,   2.6,   0,  -1 );
    await dog.move(   1,   0,  -3,     0,   1,  -3,        2,   0,  -1,     3,   0,  -1 );
    await dog.move(   1,   0,  -1,     0,   0,  -1,        2,   0,   1,     3,   0,   1 );
    dog.mode += 1;
  }
  else if(dog.mode === Modes.READY2) {
    await dog.move(   1,   0,  -1,     0,   0,  -1,        2,   0,   1,     3,   0,   1 );
    await dog.move(   1,   0,   1,     0,   0,   1,        2,   0,   3,     3,   0,   3 );
    await dog.move(   1,   0,   1,     0,   0,   1,        2,   0,   3,     3,   1,   3 );
    await dog.move( 1.4,   0,   1,   0.4,   0,   1,      2.4,   0,   3,     2,   2,   3 );
    await dog.move( 1.6,   0,   1,   0.6,   0,   1,      2.6,   0,   3,     1,   2,   3 );
    await dog.move(   2,   0,   1,     1,   0,   1,        3,   0,   3,     0,   1,   3 );
    await dog.move(   2,   0,   1,     1,   0,   1,        3,   0,   3,     0,   0,   3 );
    dog.mode += 1;
  }
  else if(dog.mode === Modes.READY3) {
    await dog.move(   2,   0,   1,     1,   0,   1,        3,   0,   3,     0,   0,   3 );
    await dog.move(   2,   0,   1,     1,   0,   1,        3,   1,   3,     0,   0,   3 );
    await dog.move( 2.4,   0,   1,   1.4,   0,   1,        2,   2,   3,   0.4,   0,   3 );
    await dog.move( 2.6,   0,   1,   1.6,   0,   1,        1,   2,   3,   0.6,   0,   3 );
    await dog.move(   3,   0,   1,     2,   0,   1,        0,   1,   3,     1,   0,   3 );
    await dog.move(   3,   0,  -1,     2,   0,  -1,        0,   0,   1,     1,   0,   1 );
    dog.mode -= 3;
  }
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}

const getDown = async (dog: Dog) => {
  const d = -0.9*(LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM);
  const bl = dog.legs['legBackLeft'].setPosition.bind(dog.legs['legBackLeft']);
  const fl = dog.legs['legFrontLeft'].setPosition.bind(dog.legs['legFrontLeft']);
  const fr = dog.legs['legFrontRight'].setPosition.bind(dog.legs['legFrontRight']);
  const br = dog.legs['legBackRight'].setPosition.bind(dog.legs['legBackRight']);
  dog.legs['legBackLeft'].bendForward = true;
  dog.legs['legFrontLeft'].bendForward = false;
  dog.legs['legFrontRight'].bendForward = false;
  dog.legs['legBackRight'].bendForward = true;
  await dog.move( 0,   0, 0,   0,   0,0,       0,   0,0,   0,   0,0 );//0
  await Promise.all([ bl({forward:0.5*d, height:d, sideways:0}), fl({forward:-0.5*d, height:d, sideways:0}), fr({forward:-0.5*d, height:d, sideways:0}), br({forward:0.5*d, height:d, sideways:0}) ]);
  await dog.motorLoop();
  dog.mode = Modes.DOWN;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}

const shutdown = async (dog: Dog) => {
  for(let hubNum in dog.hubs) {
    dog.hubs[hubNum].shutdown();
  }
}

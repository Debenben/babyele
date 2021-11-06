import { BrowserWindow, ipcMain } from "electron";
import { Leg } from "./leg";
import { HubAbstraction, LEDAbstraction, MotorAbstraction } from "./interfaces";
import { LegName, Position, fromArray, toArray, add, multiply } from "./tools";
import { Modes, MotorMap, allowSwitch, NO_MOVE_MOTOR_ANGLE, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_SEPARATION_WIDTH } from "./param";

export class Dog {
  mainWindow: BrowserWindow
  mode: Modes = Modes.OFFLINE
  modeQueue: Modes [] = []
  legs: Record<LegName, Leg>
  hubs: Record<string, HubAbstraction> = {}
  leds: Record<string, LEDAbstraction> = {}
  color: number = 0
  dogPosition: Position = {forward: 0, height: 0, sideways: 0}
  moveSpeed: Position
  startMovePositions: Record<LegName, Position>
  moveSpeedIntervalID: NodeJS.Timeout
  stepWidth: number = 80 // (pos0) <-- stepWidth --> (pos1) <-- stepWidth --> (pos2) <-- stepWidth --> (pos3)
  stepHeight: number = Math.sqrt((LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM)**2 - (2*this.stepWidth)**2) - (LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM) // min height for (pos0) and (pos3)
  stepLow: number = this.stepHeight - 0.18*LEG_SEPARATION_WIDTH**2/(LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM) // CM moves 0.17*width from center to side
  stepUp: number = this.stepLow - 20

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.legs = {legFrontRight: new Leg('legFrontRight', mainWindow), legFrontLeft: new Leg('legFrontLeft', mainWindow), legBackRight: new Leg('legBackRight', mainWindow), legBackLeft: new Leg('legBackLeft', mainWindow)};
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
      if(arg1.startsWith("requestMoveSpeed")) {
	if(arg2 === 0) {
          this.requestMoveSpeed(null);
        }
	else {
          switch(arg1) {
            case "requestMoveSpeedForward":
              this.requestMoveSpeed({forward: arg2, height: 0, sideways: 0});
	      return;
            case "requestMoveSpeedHeight":
              this.requestMoveSpeed({forward: 0, height: arg2, sideways: 0});
	      return;
            case "requestMoveSpeedSideways":
              this.requestMoveSpeed({forward: 0, height: 0, sideways: arg2});
	      return;
	  }
        }
      }
      else if(arg1 === "requestMode") {
        this.requestMode(arg2);
      }
      else if(arg1 === "getProperties") {
        this.mainWindow.webContents.send('notifyDogPosition', "dog", this.dogPosition);
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
    for(let legName of Object.keys(this.legs)) {
      for(let motorName of ['Top', 'Bottom', 'Mount']) {
        record[legName + motorName] = this.legs[legName][recordName][motorName];
      }
    }
    return record;
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

  requestMoveSpeed(speed: Position) {
    this.moveSpeed = speed;
    if(!speed) {
      clearInterval(this.moveSpeedIntervalID);
      this.moveSpeedIntervalID = null;
    }
    else if(this.moveSpeedIntervalID) {
      return;
    }
    else {
      this.startMovePositions = {legBackLeft: this.legs.legBackLeft.getPosition(), legBackRight: this.legs.legBackRight.getPosition(), legFrontLeft: this.legs.legFrontLeft.getPosition(), legFrontRight: this.legs.legFrontRight.getPosition()};
      this.moveSpeedIntervalID = setInterval(() => {
        let averageDiff = {forward:0, height:0, sideways:0};
        let averageStart = {forward:0, height:0, sideways:0};
        for(let id in this.legs) {
          averageDiff = add(averageDiff, multiply(0.25,(add(this.legs[id].getPosition(), multiply(-1,this.startMovePositions[id])))))
          averageStart = add(averageStart, multiply(0.25,this.startMovePositions[id]))
	}
	this.dogPosition = add(averageStart, averageDiff);
        this.mainWindow.webContents.send('notifyDogPosition', "dog", this.dogPosition);
	for(let id in this.legs) {
          const diffPosition = add(this.legs[id].getPosition(), multiply(-1,this.startMovePositions[id]));
	  const syncSpeed = add(averageDiff, multiply(-1,diffPosition));
          const position = toArray(this.startMovePositions[id]).map((n,i) => {
            if(toArray(this.moveSpeed)[i] != 0) {
              return toArray(this.legs[id].getPosition())[i] + toArray(syncSpeed)[i] + toArray(this.moveSpeed)[i]/10;
            }
            return n;
	  });
          this.legs[id].setPosition(fromArray(position));
	}
	return this.motorLoop();
      }, 100);
    }
  }

  move(backLeftHeight, backLeftXPos, frontLeftHeight, frontLeftXPos, frontRightHeight, frontRightXPos, backRightHeight, backRightXPos) {
    const bl = this.legs['legBackLeft'].setPosition.bind(this.legs['legBackLeft']);
    const blp = add(this.dogPosition, {forward:backLeftXPos*this.stepWidth, height:backLeftHeight, sideways:0});
    const fl = this.legs['legFrontLeft'].setPosition.bind(this.legs['legFrontLeft']);
    const flp = add(this.dogPosition, {forward:frontLeftXPos*this.stepWidth, height:frontLeftHeight, sideways:0});
    const fr = this.legs['legFrontRight'].setPosition.bind(this.legs['legFrontRight']);
    const frp = add(this.dogPosition, {forward:frontRightXPos*this.stepWidth, height:frontRightHeight, sideways:0});
    const br = this.legs['legBackRight'].setPosition.bind(this.legs['legBackRight']);
    const brp = add(this.dogPosition, {forward:backRightXPos*this.stepWidth, height:backRightHeight, sideways:0});
    Promise.all([ bl(blp), fl(flp), fr(frp), br(brp)]);
    return this.motorLoop();
  }
}

const getReady = async (dog: Dog) => {
  const g = dog.stepHeight + 5;
  const h = dog.stepHeight;
  const k = dog.stepLow + 5;
  const l = dog.stepLow;
  const u = dog.stepUp;
  await dog.setBendForward();
  if(dog.mode === Modes.STANDING) {
    await dog.move( 0,   0,   0,   0,       0,   0,   0,   0 );//0
    await dog.move( g,  -1,   h,  -1,       h,  -1,   g,  -1 );//1
    await dog.move( k,  -1,   l,  -1,       h,  -1,   g,  -1 );//2
    await dog.move( k,  -1,   l,  -1,       h,  -1,   u,  -1 );//3
    await dog.move( k,  -1,   l,  -1,       h,  -1,   g,   0 );//4
    await dog.move( h,  -1,   h,  -1,       h,  -1,   h,   0 );//5
    await dog.move( g,  -1,   h,  -1,       l,  -1,   k,   0 );//6
    await dog.move( u,  -1,   h,  -1,       l,  -1,   k,   0 );//7
    await dog.move( u,  -2,   h,  -1,       l,  -1,   l,   0 );//8
    await dog.move( h,  -1,   h,   0,       l,   0,   l,   1 );//9
    await dog.move( h,  -1,   g,   0,       k,   0,   l,   1 );//10
    await dog.move( h,  -1,   u,   0,       k,   0,   l,   1 );//11
    await dog.move( h,  -1,   u,   2,       k,   0,   l,   1 );//12
    await dog.move( h,  -1,   h,   2,       l,   0,   l,   1 );//13
    await dog.move( h,  -2,   h,   1,       l,  -1,   l,   0 );//14
  }
  await dog.move( h,  -2,   h,   1,       l,  -1,   l,   0 );//20
  dog.mode = Modes.READY0;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}

const getStanding = async (dog: Dog) => {
  const g = dog.stepHeight + 5;
  const h = dog.stepHeight;
  const k = dog.stepLow + 5;
  const l = dog.stepLow;
  const u = dog.stepUp;
  if(dog.mode === Modes.READY0) {
    await dog.move( h,  -2,   h,   1,       l,  -1,   l,   0 );//20
    await dog.move( h,  -2,   h,   1,       l,  -1,   l,   0 );//14
    await dog.move( h,  -1,   h,   2,       l,   0,   l,   1 );//13
    await dog.move( h,  -1,   u,   2,       k,   0,   l,   1 );//12
    await dog.move( h,  -1,   u,   0,       k,   0,   l,   1 );//11
    await dog.move( h,  -1,   g,   0,       k,   0,   l,   1 );//10
    await dog.move( h,  -1,   h,   0,       l,   0,   l,   1 );//9
    await dog.move( u,  -2,   h,  -1,       l,  -1,   l,   0 );//8
    await dog.move( u,  -1,   h,  -1,       l,  -1,   k,   0 );//7
    await dog.move( g,  -1,   h,  -1,       l,  -1,   k,   0 );//6
    await dog.move( h,  -1,   h,  -1,       h,  -1,   h,   0 );//5
    await dog.move( k,  -1,   l,  -1,       h,  -1,   g,   0 );//4
    await dog.move( k,  -1,   l,  -1,       h,  -1,   u,  -1 );//3
    await dog.move( k,  -1,   l,  -1,       h,  -1,   g,  -1 );//2
    await dog.move( g,  -1,   h,  -1,       h,  -1,   g,  -1 );//1
  }
  await dog.setBendForward();
  await dog.move( 0,   0,   0,   0,       0,   0,   0,   0 );//0
  dog.mode = Modes.STANDING;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}

const forward = async (dog: Dog) => {
  const h = dog.stepHeight;
  const k = dog.stepLow + 5;
  const l = dog.stepLow;
  const u = dog.stepUp;
  await dog.setBendForward();
  if(dog.mode === Modes.READY0) {
    await dog.move( h,  -2,   h,   1,       l,  -1,   l,   0 );//20
    await dog.move( h,-2.5,   h,   0,       l,  -2,   k,  -1 );//21
    await dog.move( u,  -2,   h,   0,       l,  -2,   k,  -1 );//22
    await dog.move( u,   0,   h,   0,       l,  -2,   k,  -1 );//23
    await dog.move( u,   2,   h,   0,       l,  -2,   k,  -1 );//24
    await dog.move( h,   1,   h,   0,       h,  -2,   h,  -1 );//25
    dog.mode += 1;
  }
  else if(dog.mode === Modes.READY1) {
    await dog.move( h,   1,   h,   0,       h,  -2,   h,  -1 );//25
    await dog.move( l,   1,   k,   0,       u,  -2,   h,  -1 );//31
    await dog.move( l,   1,   k,   0,       u,   0,   h,  -1 );//32
    await dog.move( l,   1,   k,   0,       u, 1.5,   h,  -1 );//33
    await dog.move( l,   1,   k,   0,       h,   2,   h,  -1 );//34
    await dog.move( l,   0,   l,  -1,       h,   1,   h,  -2 );//35
    dog.mode += 1;
  }
  else if(dog.mode === Modes.READY2) {
    await dog.move( l,   0,   l,  -1,       h,   1,   h,  -2 );//35
    await dog.move( k,  -1,   l,  -2,       h,   0,   h,-2.5 );//41
    await dog.move( k,  -1,   l,  -2,       h,   0,   u,  -2 );//42
    await dog.move( k,  -1,   l,  -2,       h,   0,   u,   0 );//43
    await dog.move( k,  -1,   l,  -2,       h,   0,   u,   2 );//44
    await dog.move( h,  -1,   h,  -2,       h,   0,   h,   1 );//45
    dog.mode += 1;
  }
  else if(dog.mode === Modes.READY3) {
    await dog.move( h,  -1,   h,  -2,       h,   0,   h,   1 );//45
    await dog.move( h,  -1,   u,  -2,       k,   0,   l,   1 );//51
    await dog.move( h,  -1,   u,   0,       k,   0,   l,   1 );//52
    await dog.move( h,  -1,   u, 1.5,       k,   0,   l,   1 );//53
    await dog.move( h,  -1,   h,   2,       k,   0,   l,   1 );//54
    await dog.move( h,  -2,   h,   1,       l,  -1,   l,   0 );//20
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
  await dog.move( 0,   0,   0,   0,       0,   0,   0,   0 );//0
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

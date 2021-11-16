import { BrowserWindow, ipcMain } from "electron";
import { Leg } from "./leg";
import { HubAbstraction, LEDAbstraction, MotorAbstraction } from "./interfaces";
import { legNames, LegName, motorNames, Position, Pose, fromArray, toArray, parsePosition, add, multiply, getRotation, rotate } from "./tools";
import { MotorMap, NO_MOVE_MOTOR_ANGLE, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_SEPARATION_LENGTH, LEG_SEPARATION_WIDTH } from "./param";

export class Dog {
  mainWindow: BrowserWindow
  legs: Record<LegName, Leg> = {} as Record<LegName, Leg>
  hubs: Record<string, HubAbstraction> = {}
  leds: Record<string, LEDAbstraction> = {}
  positionSpeed: Position
  rotationSpeed: Position
  defaultLegPositions: Record<LegName, Position> = 
    {legFrontRight: {forward:LEG_SEPARATION_LENGTH/2, height:0, sideways:LEG_SEPARATION_WIDTH/2},
     legBackRight: {forward:-LEG_SEPARATION_LENGTH/2, height:0, sideways:LEG_SEPARATION_WIDTH/2},
     legFrontLeft: {forward:LEG_SEPARATION_LENGTH/2, height:0, sideways:-LEG_SEPARATION_WIDTH/2},
     legBackLeft: {forward:-LEG_SEPARATION_LENGTH/2, height:0, sideways:-LEG_SEPARATION_WIDTH/2}}; 
  startMovePositions: Record<LegName, Position>
  moveSpeedIntervalID: NodeJS.Timeout

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    for(let id of legNames) {
      this.legs[id] = new Leg(id, mainWindow);
    }
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
          ipcMain.emit('requestMode', 'internal', 'BUTTON');
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
    try {
      if(hubComplete && deviceComplete) {
        this.mainWindow.webContents.send('notifyState', 'dog', 'online');
        ipcMain.emit('notifyState', 'internal', 'dog', 'online');
      }
      else {
        this.mainWindow.webContents.send('notifyState', 'dog', 'offline');
        ipcMain.emit('notifyState', 'internal', 'dog', 'offline');
      }
    }
    catch(e) {
      console.log("unable to notify state change: " + e);
      return;
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

  requestPose(pose: Pose) {
    for(let id of legNames) {
      this.legs[id].bendForward = pose[id].bendForward;
      this.legs[id].setPosition(pose[id].position);
    }
    return this.motorLoop();
  }

  shutdown() {
    for(let hubNum in this.hubs) {
      this.hubs[hubNum].shutdown();
    }
  }
}

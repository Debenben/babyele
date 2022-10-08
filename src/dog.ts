import { BrowserWindow, ipcMain } from "electron";
import { Leg } from "./leg";
import { HubAbstraction, LEDAbstraction, TiltSensorAbstraction, MotorAbstraction } from "./interfaces";
import { legNames, LegName, motorNames, Position, Pose, fromArray, toArray, parsePosition, add, multiply, getRotation, rotate } from "./tools";
import { MotorMap, NO_MOVE_MOTOR_ANGLE, LEG_SEPARATION_LENGTH, LEG_SEPARATION_WIDTH } from "./param";

const defaultLegPositions: Record<LegName, Position> = 
  {legFrontRight: {forward:LEG_SEPARATION_LENGTH/2, height:0, sideways:LEG_SEPARATION_WIDTH/2},
   legBackRight: {forward:-LEG_SEPARATION_LENGTH/2, height:0, sideways:LEG_SEPARATION_WIDTH/2},
   legFrontLeft: {forward:LEG_SEPARATION_LENGTH/2, height:0, sideways:-LEG_SEPARATION_WIDTH/2},
   legBackLeft: {forward:-LEG_SEPARATION_LENGTH/2, height:0, sideways:-LEG_SEPARATION_WIDTH/2}};
const setHubProperty = 
  (hub: HubAbstraction, property: number, value: number) => {
    return hub.send(Buffer.from([0x01, property, value]), "00001624-1212-efde-1623-785feabcd123");
  };

export class Dog {
  mainWindow: BrowserWindow
  legs: Record<LegName, Leg> = {} as Record<LegName, Leg>
  hubs: Record<string, HubAbstraction> = {}
  leds: Record<string, LEDAbstraction> = {}
  positionSpeed: Position
  rotationSpeed: Position
  startMovePositions: Record<LegName, Position>
  dogTilt: Position
  moveSpeedIntervalID: NodeJS.Timeout
  isComplete: boolean = false

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    for(let id of legNames) {
      this.legs[id] = new Leg(id, mainWindow);
    }
    ipcMain.on("dog", (event, arg1, arg2) => {
      if(arg1.startsWith("requestPositionSpeed")) {
        ipcMain.emit('requestMode', 'internal', 'MANUAL');
        this.positionSpeed = parsePosition(arg1, arg2);
        this.requestMoveSpeed();
      }
      else if(arg1.startsWith("requestRotationSpeed")) {
        ipcMain.emit('requestMode', 'internal', 'MANUAL');
        this.rotationSpeed = parsePosition(arg1, arg2);
        this.requestMoveSpeed();
      }
      else if(arg1 === "getProperties") {
        this.send('notifyDogPosition', "dog", this.getDogPosition());
        this.send('notifyDogRotation', "dog", this.getDogRotation());
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
      this.leds[hubName] = await hub.waitForDeviceByType(23); //Consts.DeviceType.HUB_LED
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
        if(event === 2) { //Consts.ButtonState.PRESSED
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
      if(hubName == "hubFrontCenter") this.addDogAccelerometer(hub);
      this.init();
      return;
    }
    console.log("HubName " + hub.name + " not known, disconnecting");
    hub.disconnect();
  }

  async addDogAccelerometer(hub: HubAbstraction) {
    const accelerometer = await hub.waitForDeviceByType(57); //Consts.DeviceType.TECHNIC_MEDIUM_HUB_ACCELEROMETER
    accelerometer.removeAllListeners("accel");
    accelerometer.on('accel', (accel) => {
      const abs = Math.sqrt(accel.x**2 + accel.y**2 + accel.z**2);
      if(abs < 950 || abs > 1050) return;
      this.dogTilt = {forward: -Math.atan2(accel.y, accel.z), height: 0, sideways: Math.atan2(accel.x, Math.sqrt(accel.y**2 + accel.z**2))};
      this.send('notifyTilt', "dog", this.dogTilt);
      for(let id of legNames) {
        this.legs[id].setDogTilt(this.dogTilt);
      }
    });
    accelerometer.send(Buffer.from([0x41, 0x61, 0x00, 0x20, 0x00, 0x00, 0x00, 0x01])); // subscribing again with larger delta interval
  }

  async init() {
    let deviceComplete = true;
    let hubComplete = true;
    for(let hubNum in MotorMap) {
      for(let portNum in MotorMap[hubNum]) {
        if(portNum === "name") continue;
        for(let legNum in this.legs) {
          const deviceName = MotorMap[hubNum][portNum]["name"].toString();
          if(deviceName.startsWith(legNum)) {
            const hub = this.hubs[MotorMap[hubNum]["name"]];
            let device = null;
            if(hub) {
              device = hub.getDeviceAtPort(portNum);
            }
            else {
              hubComplete = false;
            }
            if(deviceName.endsWith("Tilt")) {
              deviceComplete = await this.legs[legNum].addTiltSensor(deviceName, device) && deviceComplete;
            }
            else {
              const range = MotorMap[hubNum][portNum]["range"];
              deviceComplete = await this.legs[legNum].addMotor(deviceName, device, range) && deviceComplete;
            }
          }
        }
      }
    }
    try {
      if(this.isComplete != (hubComplete && deviceComplete)) {
        this.isComplete = (hubComplete && deviceComplete);
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
      pose[id] = JSON.parse(JSON.stringify(this.legs[id].motorAngles));
    }
    return pose;
  }

  getDogTilt() {
    return this.dogTilt;
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
      const absolutePosition = add(this.legs[id].getPosition(), add(defaultLegPositions[id], multiply(-1,dogPosition)));
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
    const promises = motorNames.map((n,i) => motors[n].rotateByDegrees(Math.abs(diffMotorAngles[i]), motorSpeeds[i], true));
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
          const startAbsolute = add(this.startMovePositions[id], add(defaultLegPositions[id], multiply(-1,startDogPosition)));
          const currentAbsolute = add(this.legs[id].getPosition(), add(defaultLegPositions[id], multiply(-1,this.getDogPosition())));
          const startRotation = getRotation(startAbsolute);
          const currentRotation = getRotation(currentAbsolute);
          startDogRotation = add(startDogRotation, multiply(0.25,startRotation));
        }
        const averageRotation = add(this.getDogRotation(), multiply(-1,startDogRotation));
        /* determine new positions */
        for(let id of legNames) {
          const startAbsolute = add(this.startMovePositions[id], add(defaultLegPositions[id], multiply(-1,startDogPosition)));
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
          const newPosition = add(rotate(startAbsolute, rotationMove), add(startDogPosition, add(multiply(-1, defaultLegPositions[id]), positionMove)));
          this.legs[id].setPosition(newPosition);
        }
        return this.motorLoop();
      }, 100);
    }
  }

  async requestPose(pose: Pose) {
    for(let id of legNames) {
      this.legs[id].destMotorAngles = JSON.parse(JSON.stringify(pose[id]));
    }
    return this.motorLoop();
  }

  stop() {
    const motors = this.buildLegRecord('motors');
    for(let i in motors) {
      motors[i].setSpeed(0, undefined, true);
    }
  }

  shutdown() {
    for(let hubNum in this.hubs) {
      this.hubs[hubNum].shutdown();
    }
  }

  send = (arg1, arg2, arg3) => {
    if(!this.mainWindow.isDestroyed()) return this.mainWindow.webContents.send(arg1, arg2, arg3);
  }
}

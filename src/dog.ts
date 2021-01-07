import { TechnicMediumHub, HubLED, Consts } from "node-poweredup";
import { BrowserWindow, ipcMain } from "electron";
import { Leg } from "./leg";
import { Modes, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_SEPARATION_WIDTH } from "./param";

export class Dog {
  mainWindow: BrowserWindow
  mode: Modes = Modes.OFFLINE
  hubFront: TechnicMediumHub
  hubBack: TechnicMediumHub
  ledFront: HubLED
  ledBack: HubLED
  legFrontLeft: Leg
  legFrontRight: Leg
  legBackLeft: Leg
  legBackRight: Leg
  color: number = 0
  stepWidth: number = 50 // (pos0) <-- stepWidth --> (pos1) <-- stepWidth --> (pos2) <-- stepWidth --> (pos3)
  stepHeight: number = Math.sqrt((LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM)**2 - (1.5*this.stepWidth)**2) // max radius for (pos0) and (pos3)
  stepLow: number = this.stepHeight - 0.15*LEG_SEPARATION_WIDTH**2/this.stepHeight // CM moves 0.15*width from center to side
  stepUp: number = this.stepLow - 15

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.legFrontLeft = new Leg("legFrontLeft", this.mainWindow, 7415, -8064);
    this.legFrontRight = new Leg("legFrontRight", this.mainWindow, -7415, 8064);
    this.legBackLeft = new Leg("legBackLeft", this.mainWindow, 7415, -13593);
    this.legBackRight = new Leg("legBackRight", this.mainWindow, -7415, 13593);
    setInterval(() => {
      if(this.ledFront) {
        this.ledFront.setColor((this.mode+8)*(this.color%2));
      }
      if(this.ledBack) {
        this.ledBack.setColor((this.mode+8)*(this.color%2));
      }
      this.color++;
    }, 1000);
    ipcMain.on("getHubProperties", () => {
      if(this.hubFront) {
        this.mainWindow.webContents.send('notifyBattery', 'frontHub', this.hubFront.batteryLevel);
        this.mainWindow.webContents.send('notifyRssi', 'frontHub', this.hubFront.rssi);
      }
      if(this.hubBack) {
        this.mainWindow.webContents.send('notifyBattery', 'backHub', this.hubBack.batteryLevel);
        this.mainWindow.webContents.send('notifyRssi', 'backHub', this.hubBack.rssi);
      }
    });
  }

  async addHub(hub) {
    await hub.connect();
    console.log("Connected to " + hub.name);
    hub.on("attach", (device) => {
      this.init();
    });
    hub.on("detach", (device) => {
      this.init();
    });
    hub.on("button", ({ event }) => {
      if(event === Consts.ButtonState.PRESSED) {
        if(this.mode == Modes.STANDING) {
          this.requestMode(Modes.READY);
        }
        else {
          this.requestMode(Modes.STANDING);
	}
      }
    });
    if(hub.name === "BeneLego2") {
      this.hubBack = hub;
      this.ledBack = await hub.waitForDeviceByType(Consts.DeviceType.HUB_LED);
      hub.on('disconnect', () => {
        this.hubBack = null;
        this.ledBack = null;
        this.init();
      });
      hub.on('tilt', (device, tilt) => {
        const x = tilt.x;
	const y = tilt.z;
	const z = tilt.y;
	return this.mainWindow.webContents.send('notifyTilt', 'backHub', { x, y, z });
      });
      hub.on("batteryLevel", (level) => {
        return this.mainWindow.webContents.send('notifyBattery', 'backHub', Number(level.batteryLevel));
      });
      hub.on("rssi", (rssi) => {
        return this.mainWindow.webContents.send('notifyRssi', 'backHub', Number(rssi.rssi));
      });
    }
    if(hub.name === "BeneLego3") {
      this.hubFront = hub;
      this.ledFront = await hub.waitForDeviceByType(Consts.DeviceType.HUB_LED);
      hub.on("disconnect", () => {
        this.hubFront = null;
        this.ledFront = null;
        this.init();
      });
      hub.on('tilt', (device, tilt) => {
        const x = -tilt.x;
	const y = tilt.z;
        const z = -tilt.y;
	return this.mainWindow.webContents.send('notifyTilt', 'frontHub', { x, y, z });
      });
      hub.on("batteryLevel", (level) => {
        return this.mainWindow.webContents.send('notifyBattery', 'frontHub', Number(level.batteryLevel));
      });
      hub.on("rssi", (rssi) => {
        return this.mainWindow.webContents.send('notifyRssi', 'frontHub', Number(rssi.rssi));
      });
    }
    this.init();
  }

  init() {
    if(this.hubFront && this.hubBack) {
      this.mode = Modes.WAITING;
    }
    else {
      this.mode = Modes.OFFLINE;
    }
    this.mainWindow.webContents.send('notifyMode', this.mode);
    var res = true;
    if(this.hubFront) {
      this.mainWindow.webContents.send('notifyState', 'frontHub', 'online');
      res = this.legFrontRight.addTopMotor(this.hubFront.getDeviceAtPort("A")) && res;
      res = this.legFrontRight.addBottomMotor(this.hubFront.getDeviceAtPort("C")) && res;
      res = this.legFrontLeft.addTopMotor(this.hubFront.getDeviceAtPort("B")) && res;
      res = this.legFrontLeft.addBottomMotor(this.hubFront.getDeviceAtPort("D")) && res;
    }
    else {
      this.mainWindow.webContents.send('notifyState', 'frontHub', 'offline');
      res = false;
      this.legFrontRight.addTopMotor(null);
      this.legFrontRight.addBottomMotor(null);
      this.legFrontLeft.addTopMotor(null);
      this.legFrontLeft.addBottomMotor(null);
    }
    if(this.hubBack) {
      this.mainWindow.webContents.send('notifyState', 'backHub', 'online');
      res = this.legBackRight.addTopMotor(this.hubBack.getDeviceAtPort("B")) && res;
      res = this.legBackRight.addBottomMotor(this.hubBack.getDeviceAtPort("D")) && res;
      res = this.legBackLeft.addTopMotor(this.hubBack.getDeviceAtPort("A")) && res;
      res = this.legBackLeft.addBottomMotor(this.hubBack.getDeviceAtPort("C")) && res;
    }
    else {
      this.mainWindow.webContents.send('notifyState', 'backHub', 'offline');
      res = false;
      this.legBackRight.addTopMotor(null);
      this.legBackRight.addBottomMotor(null);
      this.legBackLeft.addTopMotor(null);
      this.legBackLeft.addBottomMotor(null);
    }
    if(res) {
      getStanding(this);
    }
  }

  async requestMode(destMode: Modes) {
    if(destMode === Modes.OFFLINE) {
      return shutdown(this);
    }
    if(this.mode === Modes.OFFLINE) {
      console.log("Cannot switch from mode " + Modes[this.mode] + " to " + Modes[destMode]);
      return;
    }
    if(this.mode === Modes.WAITING) {
      console.log("Cannot switch from mode " + Modes[this.mode] + " to " + Modes[destMode]);
      return;
    }
    switch(destMode) {
      case Modes.STANDING:
        return getStanding(this);
      case Modes.READY:
        return getReady(this);
      default:
        console.log("Cannot switch from mode " + Modes[this.mode] + " to " + Modes[destMode]);
    }
  }

  async move(backLeftHeight, backLeftXPos, frontLeftHeight, frontLeftXPos, frontRightHeight, frontRightXPos, backRightHeight, backRightXPos) {
    const bl = this.legBackLeft.setPosition.bind(this.legBackLeft);
    const fl = this.legFrontLeft.setPosition.bind(this.legFrontLeft);
    const fr = this.legFrontRight.setPosition.bind(this.legFrontRight);
    const br = this.legBackRight.setPosition.bind(this.legBackRight);
    return Promise.all([ bl(backLeftHeight, backLeftXPos*this.stepWidth), fl(frontLeftHeight, frontLeftXPos*this.stepWidth), fr(frontRightHeight, frontRightXPos*this.stepWidth), br(backRightHeight, backRightXPos*this.stepWidth) ]);
  }
}

const getReady = async (dog: Dog) => {
  const s = LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM;
  const h = dog.stepHeight;
  const l = dog.stepLow;
  const u = dog.stepUp;
  if(dog.mode === Modes.STANDING) {
    await dog.move( s,   0,   s,   0,       s,   0,   s,   0 );//0
    await dog.move( h,   0,   h,   0,       h,   0,   h,   0 );//1
    await dog.move( h,  -1,   h,  -1,       h,  -1,   h,  -1 );//2
    await dog.move( h,  -1,   h,  -1,       l,  -1,   l,  -1 );//3
    await dog.move( u,  -1,   h,  -1,       l,  -1,   l,  -1 );//4
    await dog.move( u,-1.5,   h,  -1,       l,  -1,   l,  -1 );//5
    await dog.move( l,-1.5,   h,   0,       l,   0,   l,   0 );//6
    await dog.move( h,-1.5,   h,   0,       l,   0,   l,   0 );//7
    await dog.move( h,-1.5,   u,   0,       l,   0,   l,   0 );//8
    await dog.move( h,-1.5,   u,-0.5,       l,   0,   l,   0 );//9
    await dog.move( l,-1.5,   l,-0.5,       l,   0,   l,   0 );//10
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   h,   0 );//11
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   u,   0 );//12
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   u, 0.5 );//13
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   h, 0.5 );//14
    await dog.move( l,-1.5,   l,-0.5,       u,   0,   h, 0.5 );//15
    await dog.move( l,-1.5,   l,-0.5,       u, 1.5,   h, 0.5 );//16
    await dog.move( l,-1.5,   l,-0.5,       h, 1.5,   h, 0.5 );//17
  }
  await dog.move( h,-1.5,   h,-0.5,       h, 1.5,   h, 0.5 );//18
  dog.mode = Modes.READY;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}
const getStanding = async (dog: Dog) => {
  const s = LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM;
  const h = dog.stepHeight;
  const l = dog.stepLow;
  const u = dog.stepUp;
  if(dog.mode === Modes.READY) {
    await dog.move( h,-1.5,   h,-0.5,       h, 1.5,   h, 0.5 );//18
    await dog.move( l,-1.5,   l,-0.5,       h, 1.5,   h, 0.5 );//17
    await dog.move( l,-1.5,   l,-0.5,       u, 1.5,   h, 0.5 );//16
    await dog.move( l,-1.5,   l,-0.5,       u,   0,   h, 0.5 );//15
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   h, 0.5 );//14
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   u, 0.5 );//13
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   u,   0 );//12
    await dog.move( l,-1.5,   l,-0.5,       h,   0,   h,   0 );//11
    await dog.move( l,-1.5,   l,-0.5,       l,   0,   l,   0 );//10
    await dog.move( h,-1.5,   u,-0.5,       l,   0,   l,   0 );//9
    await dog.move( h,-1.5,   u,   0,       l,   0,   l,   0 );//8
    await dog.move( h,-1.5,   h,   0,       l,   0,   l,   0 );//7
    await dog.move( l,-1.5,   h,   0,       l,   0,   l,   0 );//6
    await dog.move( u,-1.5,   h,  -1,       l,  -1,   l,  -1 );//5
    await dog.move( u,  -1,   h,  -1,       l,  -1,   l,  -1 );//4
    await dog.move( h,  -1,   h,  -1,       l,  -1,   l,  -1 );//3
    await dog.move( h,  -1,   h,  -1,       h,  -1,   h,  -1 );//2
    await dog.move( h,   0,   h,   0,       h,   0,   h,   0 );//1
  }
  await dog.move( s,   0,   s,   0,       s,   0,   s,   0 );//0
  dog.mode = Modes.STANDING;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}

const shutdown = async (dog: Dog) => {
  let promiseFront, promiseBack;
  if(dog.hubFront) { 
    promiseFront = dog.hubFront.shutdown();
  }
  if(dog.hubBack) { 
    promiseBack = dog.hubBack.shutdown();
  }
  return Promise.all( [ promiseFront, promiseBack ]);
}


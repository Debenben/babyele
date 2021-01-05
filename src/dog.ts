import { TechnicMediumHub, HubLED, Consts } from "node-poweredup";
import { BrowserWindow, ipcMain } from "electron";
import { Leg } from "./leg";
import { Modes, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM } from "./param";

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
  stepWidth: number = 58 // (pos0) <-- stepWidth --> (pos1) <-- stepWidth --> (pos2) <-- stepWidth --> (pos3)
  stepHeight: number = Math.sqrt((LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM)**2 - (1.5*this.stepWidth)**2);
  stepLow: number = 365
  stepUp: number = 345

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
        const x = Math.PI*tilt.x/180;
	const y = Math.PI*tilt.z/180;
	const z = Math.PI*tilt.y/180;
	return this.mainWindow.webContents.send('notifyTilt', 'backHub', { x, y, z });
      });
      hub.on("batteryLevel", (level) => {
        return this.mainWindow.webContents.send('notifyBattery', 'backHub', Number(level.batteryLevel));
      });
      hub.on("rssi", (rssi) => {
        return this.mainWindow.webContents.send('notifyRssi', 'backHub', Number(rssi.rssi));
      });
      ipcMain.on("getHubProperties", () => {
        this.mainWindow.webContents.send('notifyBattery', 'backHub', hub.batteryLevel);
        this.mainWindow.webContents.send('notifyRssi', 'backHub', hub.rssi);
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
        const x = -Math.PI*tilt.x/180;
	const y = Math.PI*tilt.z/180;
        const z = -Math.PI*tilt.y/180;
	return this.mainWindow.webContents.send('notifyTilt', 'frontHub', { x, y, z });
      });
      hub.on("batteryLevel", (level) => {
        return this.mainWindow.webContents.send('notifyBattery', 'frontHub', Number(level.batteryLevel));
      });
      hub.on("rssi", (rssi) => {
        return this.mainWindow.webContents.send('notifyRssi', 'frontHub', Number(rssi.rssi));
      });
      ipcMain.on("getHubProperties", () => {
        this.mainWindow.webContents.send('notifyBattery', 'frontHub', hub.batteryLevel);
        this.mainWindow.webContents.send('notifyRssi', 'frontHub', hub.rssi);
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
}

const getReady = async (dog: Dog) => {
  const w = dog.stepWidth;
  const h = dog.stepHeight;
  const l = dog.stepLow;
  const u = dog.stepUp;
  const fr = dog.legFrontRight.setPosition.bind(dog.legFrontRight);
  const fl = dog.legFrontLeft.setPosition.bind(dog.legFrontLeft);
  const br = dog.legBackRight.setPosition.bind(dog.legBackRight);
  const bl = dog.legBackLeft.setPosition.bind(dog.legBackLeft);
  if(dog.mode === Modes.STANDING) {
    await Promise.all([ fr(h,0), fl(h,0), br(h,0), bl(h,0) ]);
    await Promise.all([ fr(l,0), br(l,0) ]);
    await bl(u,0);
    await bl(u,-1.5*w);
    await bl(h,-1.5*w);
    await Promise.all([ fr(l,0.5*w), fl(h,0.5*w), br(l,0.5*w), bl(h,-w) ]);
    await Promise.all([ fr(l,1.5*w), fl(h,1.5*w), br(l,1.5*w), bl(h,0) ]);
    await fl(u,1.5*w);
    await fl(u,w);
    await fl(h,w);
    await Promise.all([ fr(h,0), fl(l,-0.5*w), br(h,0), bl(l,-1.5*w) ]);
    await br(u,0);
    await br(u,0.5*w);
    await br(h,0.5*w);
    await fr(u,0);
    await fr(u,1.5*w);
    await fr(h,1.5*w);
  }
  await Promise.all([ fr(h,1.5*w), fl(h,-0.5*w), br(h,0.5*w), bl(h,-1.5*w) ]);
  dog.mode = Modes.READY;
  return dog.mainWindow.webContents.send('notifyMode', dog.mode);
}
const getStanding = async (dog: Dog) => {
  const w = dog.stepWidth;
  const h = dog.stepHeight;
  const l = dog.stepLow;
  const u = dog.stepUp;
  const fr = dog.legFrontRight.setPosition.bind(dog.legFrontRight);
  const fl = dog.legFrontLeft.setPosition.bind(dog.legFrontLeft);
  const br = dog.legBackRight.setPosition.bind(dog.legBackRight);
  const bl = dog.legBackLeft.setPosition.bind(dog.legBackLeft);
  if(dog.mode === Modes.READY) {
    await Promise.all([ fr(h,1.5*w), fl(l,-0.5*w), br(h,0.5*w), bl(l,-1.5*w) ]);
    await fr(u,1.5*w);
    await fr(u,0);
    await fr(h,0);
    await br(u,0.5*w);
    await br(u,0);
    await br(h,0);
    await Promise.all([ fr(l,1.5*w), fl(h,w), br(l,1.5*w), bl(h,0) ]);
    await fl(u, w);
    await fl(u, 1.5*w);
    await fl(h, 1.5*w);
    await Promise.all([ fr(l,0.5*w), fl(h,0.5*w), br(l,0.5*w), bl(h,-w) ]);
    await Promise.all([ fr(l,0), fl(h,0), br(l,0), bl(h,-1.5*w) ]);
    await bl(u,-1.5*w);
    await bl(u,0);
    await bl(h,0);
    await Promise.all([ fr(h,0), fl(h,0), br(h,0), bl(h,0) ]);
  }
  await Promise.all([ fr(385,0), fl(385,0), br(385,0), bl(385,0) ]);
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


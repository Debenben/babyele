import { TechnicMediumHub, HubLED, Consts } from "node-poweredup";
import { BrowserWindow } from "electron";
import { Leg } from "./leg";
import { Modes } from "./param";

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

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    setInterval(() => {
      if(this.ledFront) {
        this.ledFront.setColor(this.mode*(this.color%2));
      }
      if(this.ledBack) {
        this.ledBack.setColor(this.mode*(this.color%2));
      }
      this.color++;
    }, 1000);
    this.legFrontLeft = new Leg("legFrontLeft", this.mainWindow, 7415, -8064);
    this.legFrontRight = new Leg("legFrontRight", this.mainWindow, -7415, 8064);
    this.legBackLeft = new Leg("legBackLeft", this.mainWindow, 7415, -13593);
    this.legBackRight = new Leg("legBackRight", this.mainWindow, -7415, 13593);
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
	this.mainWindow.webContents.send('notifyTilt', 'backHub', { x, y, z });
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
	this.mainWindow.webContents.send('notifyTilt', 'frontHub', { x, y, z });
      });
    }
    this.init();
  }

  async init() {
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
      this.getStanding();
    }
  }

  async requestMode(destMode: Modes) {
    if(this.mode === Modes.OFFLINE) {
      console.log("Cannot switch from mode " + Modes[this.mode] + " to " + Modes[destMode]);
      return;
    }
    if(destMode === Modes.OFFLINE) {
      this.shutdown();
      return;
    }
    if(this.mode === Modes.WAITING) {
      console.log("Cannot switch from mode " + Modes[this.mode] + " to " + Modes[destMode]);
      return;
    }
    switch(destMode) {
      case Modes.STANDING:
        this.getStanding();
        break;
      case Modes.READY:
        this.getReady();
	break;
      default:
        console.log("Cannot switch from mode " + Modes[this.mode] + " to " + Modes[destMode]);
    }
  }

  async getReady() {
    await Promise.all([ this.legFrontRight.setPosition(375,0), this.legFrontLeft.setPosition(375,0), this.legBackRight.setPosition(375,0), this.legBackLeft.setPosition(375,0) ]);
    this.mode = Modes.READY;
    this.mainWindow.webContents.send('notifyMode', this.mode);
  }
  async getStretching() {
    await Promise.all([ this.legFrontRight.setPosition(0,384.999), this.legFrontLeft.setPosition(0,384.999), this.legBackRight.setPosition(0,-384.999), this.legBackLeft.setPosition(0,-384.999) ]);
    this.mode = Modes.STRETCHING;
    this.mainWindow.webContents.send('notifyMode', this.mode);
  }
  async getStanding() {
    await Promise.all([ this.legFrontRight.setPosition(385,0), this.legFrontLeft.setPosition(385,0), this.legBackRight.setPosition(385,0), this.legBackLeft.setPosition(385,0) ]);
    this.mode = Modes.STANDING;
    this.mainWindow.webContents.send('notifyMode', this.mode);
  }
  async shutdown() {
    if(this.hubFront) {
      this.hubFront.shutdown();
    }
    if(this.hubBack) {
      this.hubBack.shutdown();
    }
  }
}

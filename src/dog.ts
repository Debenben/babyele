import { TechnicMediumHub, HubLED, Consts } from "node-poweredup";
import { BrowserWindow } from "electron";
import { Leg } from "./leg";
import { Modes } from "./consts";

export class Dog {
  mainWindow: BrowserWindow
  mode: Modes = Modes.WAITING
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
  }

  async addHub(hub) {
    await hub.connect();
    console.log(`Connected to ${hub.name}`);
    hub.on("attach", (device) => {
      console.log(`Device attached to hub ${hub.name} port ${device.portName} (Device ID: ${device.type})`);
      this.init();
    });
    hub.on("detach", (device) => {
      console.log(`Device detached from hub ${hub.name} port ${device.portName}`);
      this.mode = Modes.WAITING;
    });
    hub.on("button", ({ event }) => {
      if(event === 2) {
        if(this.mode == Modes.STANDING) {
          this.setMode(Modes.READY);
        }
        else {
          this.setMode(Modes.STANDING);
	}
      }
    });
    if(hub.name === "BeneLego2") {
      this.hubBack = hub;
      this.ledBack = await hub.waitForDeviceByType(Consts.DeviceType.HUB_LED);
      this.mainWindow.webContents.send('setState', 'backHub', 'online');
      hub.on('disconnect', () => {
	this.mode = Modes.WAITING;
        this.mainWindow.webContents.send('setState', 'backHub', 'offline');
      });
      hub.on('tilt', (device, tilt) => {
        const x = Math.PI*tilt.x/180;
	const y = Math.PI*tilt.z/180;
	const z = Math.PI*tilt.y/180;
	this.mainWindow.webContents.send('tilt', 'backHub', { x, y, z });
      });
    }
    if(hub.name === "BeneLego3") {
      this.hubFront = hub;
      this.ledFront = await hub.waitForDeviceByType(Consts.DeviceType.HUB_LED);
      this.mainWindow.webContents.send('setState', 'frontHub', 'online');
      hub.on("disconnect", () => {
	this.mode = Modes.WAITING;
        this.mainWindow.webContents.send('setState', 'frontHub', 'offline');
      });
      hub.on('tilt', (device, tilt) => {
        const x = -Math.PI*tilt.x/180;
	const y = Math.PI*tilt.z/180;
        const z = -Math.PI*tilt.y/180;
	this.mainWindow.webContents.send('tilt', 'frontHub', { x, y, z });
      });
    }
    this.init();
  }

  async init() {
    if(this.hubFront && this.hubBack) {
      let motorFrontA = this.hubFront.getDeviceAtPort("A");
      let motorFrontB = this.hubFront.getDeviceAtPort("B");
      let motorFrontC = this.hubFront.getDeviceAtPort("C");
      let motorFrontD = this.hubFront.getDeviceAtPort("D");
      let motorBackA = this.hubBack.getDeviceAtPort("A");
      let motorBackB = this.hubBack.getDeviceAtPort("B");
      let motorBackC = this.hubBack.getDeviceAtPort("C");
      let motorBackD = this.hubBack.getDeviceAtPort("D");
      const motors = [ motorFrontA, motorFrontB, motorFrontC, motorFrontD, motorBackA, motorBackB, motorBackC, motorBackD ];
      let count = 0;
      motors.forEach(async (motor) => {
	if(motor) {
          count++;
        }
      })
      if(count === 8) {
        this.legFrontRight = new Leg("legFrontRight", this.mainWindow, motorFrontA, -6500, motorFrontC, 5500);
	this.legFrontLeft = new Leg("legFrontLeft", this.mainWindow, motorFrontB, 6500, motorFrontD, -5500);
	this.legBackRight = new Leg("legBackRight", this.mainWindow, motorBackB, -6500, motorBackD, 9500);
	this.legBackLeft = new Leg("legBackLeft", this.mainWindow, motorBackA, 6500, motorBackC, -9500);

        this.mode = Modes.STANDING;
        console.log("Good to go");
      }
      else {
        console.log(`Only ${count} motors attached`);
      }
    }
  }

  async setMode(mode: Modes) {
    console.log("setting mode to " + mode);
    switch(mode) {
      case Modes.STANDING:
        this.getStanding();
        break;
      case Modes.READY:
        this.getReady();
        break;
      default:
        console.log("Cannot switch from mode " + this.mode + " to " + mode);
    }
  }

  async getReady() {
    console.log('getting ready');
    await Promise.all([ this.legFrontRight.setPosition(375,0), this.legFrontLeft.setPosition(375,0), this.legBackRight.setPosition(375,0), this.legBackLeft.setPosition(375,0) ]);
    console.log('setting mode to ready');
    this.mode = Modes.READY;
  }
  async getStretching() {
    await Promise.all([ this.legFrontRight.setPosition(0,384.999), this.legFrontLeft.setPosition(0,384.999), this.legBackRight.setPosition(0,-384.999), this.legBackLeft.setPosition(0,-384.999) ]);
    this.mode = Modes.STRETCHING;
  }
  async getStanding() {
    await Promise.all([ this.legFrontRight.setPosition(385,0), this.legFrontLeft.setPosition(385,0), this.legBackRight.setPosition(385,0), this.legBackLeft.setPosition(385,0) ]);
    this.mode = Modes.STANDING;
  }
}

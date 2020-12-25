import { Hub, HubLED, Consts } from "node-poweredup";
import { BrowserWindow } from "electron";
import { Leg } from "./leg";

export enum Modes {
  WAITING = 0,
  STANDING = 1,
  READY = 2,
  WALKING = 3
}

export class Dog {
  mainWindow: BrowserWindow
  mode: Modes = Modes.WAITING
  hubFront: Hub
  hubBack: Hub
  ledFront: HubLED
  ledBack: HubLED
  legFrontLeft: Leg 
  legFrontRight: Leg 
  legBackLeft: Leg 
  legBackRight: Leg

  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async addHub(hub) {
    await hub.connect();
    console.log(`Connected to ${hub.name}`);
    if(hub.name === "BeneLego2") {
      this.hubBack = hub;
      this.ledBack = await hub.waitForDeviceByType(Consts.DeviceType.HUB_LED);
      this.mainWindow.webContents.send('backHub', hub.name);
    }
    if(hub.name === "BeneLego3") {
      this.hubFront = hub;
      this.ledFront = await hub.waitForDeviceByType(Consts.DeviceType.HUB_LED);
      this.mainWindow.webContents.send('frontHub', hub.name);
    }
  }
}


/*
let motorFrontA;
let motorFrontB;
let motorFrontC; // +-5500 +65
let motorFrontD; // +-5500 -65
let motorBackA;
let motorBackB;
let motorBackC; // +-9000 -100
let motorBackD; // +-9000 +100

const init = async() => {
    if(hubFront && hubBack) {
        motorFrontA = hubFront.getDeviceAtPort("A");
        motorFrontB = hubFront.getDeviceAtPort("B");
        motorFrontC = hubFront.getDeviceAtPort("C");
        motorFrontD = hubFront.getDeviceAtPort("D");
        motorBackA = hubBack.getDeviceAtPort("A");
        motorBackB = hubBack.getDeviceAtPort("B");
        motorBackC = hubBack.getDeviceAtPort("C");
        motorBackD = hubBack.getDeviceAtPort("D");
        const motors = [ motorFrontA, motorFrontB, motorFrontC, motorFrontD, motorBackA, motorBackB, motorBackC, motorBackD ];
        let count = 0;
        motors.forEach(async (motor) => {
            if(motor) {
                count++;
            }
        })
        if(count === 8) {
	    legFrontRight = new Leg(motorFrontA, -6500, motorFrontC, 5500);
	    legFrontLeft = new Leg(motorFrontB, 6500, motorFrontD, -5500);
	    legBackRight = new Leg(motorBackB, -6500, motorBackD, 9000);
	    legBackLeft = new Leg(motorBackA, 6500, motorBackC, -9000);

            mode = Modes.STANDING;
            console.log("Good to go");
        }
        else {
            console.log(`Only ${count} motors attached`);
        }
    }
}

const getReady = async() => {
	await Promise.all([ legFrontRight.setPosition(375,0), legFrontLeft.setPosition(375,0), legBackRight.setPosition(375,0), legBackLeft.setPosition(375,0) ]);
	await Promise.all([ legFrontRight.setPosition(360,0), legFrontLeft.setPosition(360,0), legBackRight.setPosition(360,0), legBackLeft.setPosition(360,0) ]);
	await Promise.all([ legFrontRight.setPosition(0,384.999), legFrontLeft.setPosition(0,384.999), legBackRight.setPosition(0,-384.999), legBackLeft.setPosition(0,-384.999) ]);
	mode = Modes.READY;
}

const getStanding = async() => {
	await Promise.all([ legFrontRight.setPosition(385,0), legFrontLeft.setPosition(385,0), legBackRight.setPosition(385,0), legBackLeft.setPosition(385,0) ]);
	mode = Modes.STANDING;
}

poweredUP.on("discover", async (hub) => {
    hub.on("disconnect", () => {
        console.log(`Hub ${hub.name} disconnected`);
        mode = Modes.WAITING;
    })
    hub.on("attach", (device) => {
       console.log(`Device attached to hub ${hub.name} port ${device.portName} (Device ID: ${device.type})`);
       init();
    });
    hub.on("detach", (device) => {
        console.log(`Device detached from hub ${hub.name} port ${device.portName}`);
        mode = Modes.WAITING;
    });
    hub.on("button", ({ event }) => {
	if(event === 2) {
            switch(mode) {
                case Modes.STANDING:
                    getReady();
                    break;
                case Modes.READY:
                    getStanding();
                    break;
                case Modes.WAITING:
                    console.log(hub);
                    break;
	    }
	}
    });

    init();
});

let color = 1;
setInterval(() => {
    if(ledFront) {
	ledFront.setColor(color%2 + mode);
    }
    if(ledBack) {
	ledBack.setColor((color+1)%2 + mode);
    }
    color++;
}, 1000);
*/

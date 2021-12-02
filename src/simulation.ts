import { EventEmitter } from "events";
import { PoweredAbstraction, HubAbstraction, LEDAbstraction, MotorAbstraction } from "./interfaces";

export class SimulationPowered extends EventEmitter implements PoweredAbstraction {
  hubList: string[] = ["BeneLego1", "BeneLego2", "BeneLego3", "BeneLego4", "differentHub", "BeneLego5", "BeneLego6"]
  restart: boolean = true
  public async scan() {
    if(!this.restart) return;
    console.log("scanning for simulation hubs");
    for(let hubName of this.hubList) {
      this.emit('discover', new SimulationHub(hubName));
    }
  }
  public stop() {
    console.log("stop scanning for simulation hubs");
    this.restart = false;
  }
}

export class SimulationHub extends EventEmitter implements HubAbstraction {
  name: string
  batteryLevel: number
  rssi: number
  tiltIntervalID: NodeJS.Timeout

  constructor(hubName: string) {
    super();
    this.name = hubName;
    this.batteryLevel = Math.floor(100 * Math.random());
    this.rssi = Math.floor(100 * Math.random() - 80);
    console.log("creating simulation hub " + this.name);
    let time = 0;
    this.tiltIntervalID = setInterval(() => {
      try {
        time++;
        this.emit('tilt', 'device', {x: 30*Math.sin(time/100), y: 20*Math.sin(time/90), z: 10*Math.sin(time/80)});
      }
      catch(e) {
        console.log("discard error " + e);
        return;
      }
    }, 50);
  }
  connect() {
    console.log("connecting to simulation hub " + this.name);
    return Promise.resolve();
  }
  disconnect() {
    console.log("disconnecting from simulation hub " + this.name);
    this.emit('disconnect');
    return Promise.resolve();
  }
  shutdown() {
    console.log("shutdown simulation hub " + this.name);
    clearInterval(this.tiltIntervalID);
    this.emit('disconnect');
    return Promise.resolve();
  }
  getDeviceAtPort(portName: string) {
    switch(this.name) {
      case "BeneLego2":
      case "BeneLego3":
        switch(portName) {
          case "A":
          case "B":
	        case "C":
	        case "D":
	        case "test":
            console.log("simulation hub " + this.name + " returns motor at port " + portName);
	          return new SimulationMotor();
        }
      case "BeneLego1":
      case "BeneLego4":
        switch(portName) {
	        case "test":
	        case "tess":
	        case "tese":
            console.log("simulation hub " + this.name + " returns motor at port " + portName);
	    return new SimulationMotor();
        }
      default:
        console.log("simulation hub " + this.name + " returns null at port " + portName);
        return null;
    }
  }
  waitForDeviceByType(deviceType: number) {
    return new Promise((resolve) => {
      if(deviceType == 23) {
        console.log("simulation hub " + this.name + " returns simulationLED");
        return resolve(new SimulationLED());
      }
      return true;
    });
  }
}

export class SimulationLED extends EventEmitter implements LEDAbstraction {
  color: number

  setColor(color: number) {
    this.color = color;
    //console.log("simulation led showing color " + this.color);
    return Promise.resolve();
  }
}

export class SimulationMotor extends EventEmitter implements MotorAbstraction {
  rotation: number
  destRotation: number
  speed: number
  speedIntervalID: NodeJS.Timeout
  token: Token

  constructor() {
    super();
    this.rotation = 0;
  }
  setBrakingStyle(style: number) {
    return Promise.resolve();
  }
  setAccelerationTime(time: number) {
    return Promise.resolve();
  }
  setDecelerationTime(time: number) {
    return Promise.resolve();
  }
  resetZero() {
    this.rotation = 0;
    this.emit('rotate', {degrees: this.rotation});
    return Promise.resolve();
  }
  setPower(power: number) {
    console.log("simulation motor setting power to " + this.speed);
    this.speed = power;
    if(power === 0) {
      clearInterval(this.speedIntervalID);
      this.speedIntervalID = null;
      return Promise.resolve();
    }
    if(this.speedIntervalID) {
      return Promise.resolve();
    }
    if(this.token) {
      this.token.isCancellationRequested = true;
      this.token = null;
    }
    this.speedIntervalID = setInterval(() => {
      this.rotation += this.speed;
      this.emit('rotate', {degrees: this.rotation});
    }, 100);
    return Promise.resolve();
  }
  rotateByDegrees(degrees: number, speed: number) {
    if(this.speedIntervalID) {
      this.setPower(0);
    }
    if(this.token) {
      this.token.isCancellationRequested = true;
    }
    this.speed = speed;
    this.destRotation = this.rotation + degrees*Math.sign(speed);
    this.token = new Token();
    return this.motorLoop(this.token);
  }

  async motorLoop(token: Token) {
    try {
      while(this.rotation != this.destRotation) {
        if(token.isCancellationRequested) {
          console.log("simulation motor rotateByDegree is cancelled");
          return Promise.resolve();
        }
        console.log("simulation motor rotating with speed " + this.speed + " from " + this.rotation + " to " + this.destRotation);
        if(Math.abs(this.destRotation - this.rotation) < Math.abs(this.speed)) {
          this.rotation = this.destRotation;
        }
        else {
          this.rotation += this.speed;
        }
        await sleep(100);
        this.emit('rotate', {degrees: this.rotation});
      }
      return Promise.resolve();
    }
    catch(e) {
      console.log("discard error " + e);
      return Promise.resolve();
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class Token {
  isCancellationRequested: boolean = false; 
}

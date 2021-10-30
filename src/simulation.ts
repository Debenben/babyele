import { EventEmitter } from "events";
import { HubAbstraction, LEDAbstraction, MotorAbstraction } from "./interfaces";

export class SimulationHub extends EventEmitter implements HubAbstraction {
  name: string
  batteryLevel: number
  rssi: number

  constructor(hubName: string) {
    super();
    this.name = hubName;
    this.batteryLevel = Math.floor(100 * Math.random());
    this.rssi = Math.floor(100 * Math.random() - 80);
    console.log("creating simulation hub " + this.name);
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
            console.log("simulation hub " + this.name + " returns device at port " + portName);
	    return new SimulationMotor();
          default:
            return null; 
        }
      default:
        return null;
    }
    return null;
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
    console.log("simulation led showing color " + this.color);
    return Promise.resolve();
  }
}

export class SimulationMotor extends EventEmitter implements MotorAbstraction {
  rotation: number
  destRotation: number
  speed: number

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
    this.speed = power;
    return Promise.resolve();
  }
  rotateByDegrees(degrees: number, speed: number) {
    this.speed = speed;
    this.destRotation = this.rotation + degrees*Math.sign(speed);
    return this.motorLoop();
  }

  async motorLoop() {
    while(this.rotation != this.destRotation) {
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
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

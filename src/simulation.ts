import { EventEmitter } from "events";
import { HubAbstraction, MotorAbstraction } from "./interfaces";

export class SimulationHub extends EventEmitter implements HubAbstraction {
  name: string
  batteryLevel: number
  rssi: number

  constructor(hubName: string) {
    super();
    this.name = hubName;
    console.log("creating simulation hub " + this.name);
  }

  connect() {
    console.log("connecting to simulation hub " + this.name);
    return Promise.resolve();
  }

  shutdown() {
    console.log("shutdown simulation hub " + this.name);
    this.emit('disconnect');
    return Promise.resolve();
  }

  getDeviceAtPort(portName: string) {
    console.log("simulation hub " + this.name + " returns device at port " + portName);
    return new SimulationMotor();
  }

  waitForDeviceByType(deviceType: number) {
    console.log("simulation hub " + this.name + " waiting for device of type " + deviceType);
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

  motorLoop() {
    while(this.rotation != this.destRotation) {
      console.log("simulation motor rotating with speed " + this.speed + " from " + this.rotation + " to " + this.destRotation);
      if(Math.abs(this.destRotation - this.rotation) < Math.abs(this.speed)) {
        this.rotation = this.destRotation;
      }
      else {
        this.rotation += this.speed;
      }
      this.emit('rotate', {degrees: this.rotation});
    }
    return Promise.resolve();
  }
}

import { EventEmitter } from "events";
import { PoweredAbstraction, HubAbstraction, LEDAbstraction, MotorAbstraction, TiltSensorAbstraction } from "./interfaces";

export class SimulationPowered extends EventEmitter implements PoweredAbstraction {
  hubList: string[] = ["BeneLego6", "BeneLego1", "BeneLego2", "BeneLego3", "BeneLego4", "BeneLego5", "differentHub"]
  restart: boolean = false

  public async scan() {
    console.log("scanning for simulation hubs");
    if(this.restart) {
      console.log("waiting 10 seconds before turning on simulation hubs");
      await sleep(10000);
    }
    for(const hubName of this.hubList.sort(() => Math.random() - 0.5)) {
      await setTimeout(() => this.emit('discover', new SimulationHub(hubName)), 1000 * Math.random());
    }
  }
  public stop() {
    console.log("stop scanning for simulation hubs");
    this.restart = true;
  }
}


export class SimulationHub extends EventEmitter implements HubAbstraction {
  name: string
  firmwareVersion: string = "simulation"
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
    if(portName === "ACCELEROMETER") {
      console.log("simulation hub " + this.name + " returns tilt sensor at port " + portName);
      return new SimulationTiltSensor(portName, this.name);
    }
    switch(this.name) {
      case "BeneLego4":
      case "BeneLego6":
        switch(portName) {
          case "A":
          case "B":
            console.log("simulation hub " + this.name + " returns motor at port " + portName);
            return new SimulationMotor(portName, 882);
          case "C":
          case "D":
            console.log("simulation hub " + this.name + " returns motor at port " + portName);
            return new SimulationMotor(portName, 630);
        }
      case "BeneLego2":
      case "BeneLego3":
      case "BeneLego1":
        if(portName === "A") {
          console.log("simulation hub " + this.name + " returns motor at port " + portName);
          return new SimulationMotor(portName, 846);
        }
        else {
          console.log("simulation hub " + this.name + " returns tilt sensor at port " + portName);
          return new SimulationTiltSensor(portName, this.name);
        }
      case "BeneLego5":
        if(portName === "B") {
          console.log("simulation hub " + this.name + " returns motor at port " + portName);
          return new SimulationMotor(portName, 846);
        }
        else {
          console.log("simulation hub " + this.name + " returns tilt sensor at port " + portName);
          return new SimulationTiltSensor(portName, this.name);
        }
      default:
        console.log("simulation hub " + this.name + " returns null at port " + portName);
        return null;
    }
  }
  waitForDeviceByType(deviceType: number) {
    return new Promise((resolve) => {
      if(deviceType === 23) {
        console.log("simulation hub " + this.name + " returns simulationLED");
        return resolve(new SimulationLED());
      }
      else if(deviceType === 57) {
        console.log("simulation hub " + this.name + " returns simulationAccelerometer");
        return resolve(new SimulationTiltSensor("ACCELEROMETER", this.name));
      }
      return true;
    });
  }
  send(message: Buffer, characteristic: string) {
    console.log("sending raw message " + message.toString("hex"));
    if(message.length === 3 && message[0] === 0x01 && message[1] === 0x05 && message[2] === 0x05) {
      this.emit('rssi', {rssi: this.rssi});
    }
    return Promise.resolve();
  }
}


export class SimulationLED extends EventEmitter implements LEDAbstraction {
  color: number

  get type() {
    return 23;
  }
  setColor(color: number) {
    this.color = color;
    return Promise.resolve();
  }
  send(message: Buffer) {
    if(message.length === 6 && message[0] === 0x81 && message[1] === 0x32 && message[3] === 0x51 && message[4] === 0x00) {
      return this.setColor(message[5]);
    }
  }
}


export class SimulationTiltSensor extends EventEmitter implements TiltSensorAbstraction {
  portId: number
  x: number
  y: number
  z: number

  get type() {
    return 57;
  }
  constructor(portName: string, hubName: string) {
    super();
    this.portId = toPortId(portName);
    if(hubName === "BeneLego4" || hubName === "BeneLego0") {
      this.x = 0;
      this.y = 0;
      this.z = 1000;
    }
    else {
      this.x = -1000;
      this.y = 0;
      this.z = 0;
    }
    setInterval(() => this.emit('accel', {x: this.x, y: this.y, z: this.z}), 10000*Math.random());
  }
  send(message: Buffer) {
    return Promise.resolve();
  }
  requestUpdate() {
    console.log("simulation tilt sensor sending acceleration " + this.x + " " + this.y + " " + this.z);
    this.emit('accel', {x: this.x, y: this.y, z: this.z});
    return Promise.resolve();
  }
}


export class SimulationMotor extends EventEmitter implements MotorAbstraction {
  portId: number
  useAccelerationProfile: boolean
  useDecelerationProfile: boolean
  rotation: number
  destRotation: number
  maxSpeed: number
  speed: number
  speedIntervalID: NodeJS.Timeout
  token: Token

  get type() {
    return 46;
  }
  constructor(portName: string, maximumSpeed: number) {
    super();
    this.portId = toPortId(portName);
    this.maxSpeed = maximumSpeed;
    this.rotation = 0;
    this.speed = 0;
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
  resetZero(rotation: number) {
    console.log("simulation motor setting rotation to " + rotation);
    this.rotation = rotation;
    this.emit('rotate', {degrees: this.rotation});
    return Promise.resolve();
  }
  setSpeed(speed: number, time: number | undefined) {
    if(speed > 100 || speed < -100) {
      console.log("simulation motor requested speed " + speed + " is out of bounds");
      return;
    }
    console.log("simulation motor setting speed to " + speed);
    this.speed = speed;
    if(this.token) {
      this.token.isCancellationRequested = true;
      this.token = null;
    }
    if(speed === 0) {
      clearInterval(this.speedIntervalID);
      this.speedIntervalID = null;
      return Promise.resolve();
    }
    if(this.speedIntervalID) {
      return Promise.resolve();
    }
    let count = 0;
    this.speedIntervalID = setInterval(() => {
      count++;
      this.rotation += 0.0001*this.maxSpeed*(this.speed + 4*(Math.random() - 0.5));
      if(count%10 === 1) this.emit('rotate', {degrees: this.rotation});
    }, 10 + Math.random() - 0.5);
    return Promise.resolve();
  }
  send(message: Buffer) {
    if(message.length === 6 && message[0] === 0x81 && message[1] === this.portId && message[3] === 0x51 && message[4] === 0x00) {
      return this.setSpeed(message.readInt8(5), undefined);
    }
    else if(message.length === 9 && message[0] === 0x81 && message[1] === this.portId && message[3] === 0x51 && message[4] === 0x02) {
      return this.resetZero(message.readInt32LE(5));
    }
  }
  requestUpdate() {
    console.log("simulation motor sending rotation " + this.rotation);
    this.emit('rotate', {degrees: this.rotation});
    return Promise.resolve();
  }
  rotateByDegrees(degrees: number, speed: number) {
    if(speed > 100 || speed < -100 || speed === 0) {
      console.log("simulation motor requested speed " + speed + " is out of bounds");
      return;
    }
    if(this.speedIntervalID) {
      this.setSpeed(0, undefined);
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
      let count = 0;
      while(this.rotation !== this.destRotation) {
        await sleep(10 + Math.random() - 0.5);
        count++;
        if(token.isCancellationRequested) {
          console.log("simulation motor rotateByDegree is cancelled");
          return Promise.resolve();
        }
        if(Math.abs(this.destRotation - this.rotation) < Math.abs(0.0001*this.maxSpeed*this.speed)) {
          console.log("simulation motor reached destination", Math.round(this.destRotation), "at", Date.now());
          this.rotation = this.destRotation;
        }
        else {
          console.log("simulation motor speed", this.speed, "from", Math.round(this.rotation), "to", Math.round(this.destRotation), "count:", count, "now:", Date.now());
          this.rotation += 0.0001*this.maxSpeed*(this.speed + 4*(Math.random() - 0.5));
        }
        if(count%10 === 1) this.emit('rotate', {degrees: this.rotation});
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

function toPortId(portName) {
    switch(portName) {
      case "A":
        return 0;
      case "B":
        return 1;
      case "C":
        return 2;
      case "D":
        return 3;
      case "E":
        return 4;
      case "F":
        return 5;
      case "ACCELEROMETER":
        return 97;
    }
}

class Token {
  isCancellationRequested: boolean = false;
}

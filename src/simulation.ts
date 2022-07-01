import { EventEmitter } from "events";
import { PoweredAbstraction, HubAbstraction, LEDAbstraction, AccelerometerAbstraction, MotorAbstraction, DistanceSensorAbstraction } from "./interfaces";

export class SimulationPowered extends EventEmitter implements PoweredAbstraction {
  hubList: string[] = ["BeneLego0", "BeneLego1", "BeneLego2", "BeneLego3", "BeneLego4", "BeneLego5", "differentHub"]
  restart: boolean = false

  public async scan() {
    console.log("scanning for simulation hubs");
    if(this.restart) {
      console.log("waiting 10 seconds before turning on simulation hubs");
      await sleep(10000);
    }
    for(let hubName of this.hubList.sort(() => Math.random() - 0.5)) {
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
    switch(this.name) {
      case "BeneLego4":
      case "BeneLego0":
        switch(portName) {
          case "A":
          case "B":
          case "C":
          case "D":
            console.log("simulation hub " + this.name + " returns motor at port " + portName);
            return new SimulationMotor(portName);
        }
      case "BeneLego1":
      case "BeneLego2":
        if(portName === "C") {
          console.log("simulation hub " + this.name + " returns motor at port " + portName);
          return new SimulationMotor(portName);
        }
        else {
          console.log("simulation hub " + this.name + " returns distance sensor at port " + portName);
          return new SimulationDistanceSensor(portName);
        }
      case "BeneLego3":
      case "BeneLego5":
        if(portName === "D") {
          console.log("simulation hub " + this.name + " returns motor at port " + portName);
          return new SimulationMotor(portName);
        }
        else {
          console.log("simulation hub " + this.name + " returns distance sensor at port " + portName);
          return new SimulationDistanceSensor(portName);
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
      else if(deviceType == 57) {
        console.log("simulation hub " + this.name + " returns simulationAccelerometer");
        return resolve(new SimulationAccelerometer(this.name));
      }
      return true;
    });
  }
  send(message: Buffer, characteristic: string) {
    console.log("sending raw message " + message.toString("hex"));
    if(message.length == 3 && message[0] == 0x01 && message[1] == 0x05 && message[2] == 0x05) {
      this.emit('rssi', {rssi: this.rssi});
    }
    return Promise.resolve();
  }
}


export class SimulationLED extends EventEmitter implements LEDAbstraction {
  color: number

  setColor(color: number) {
    this.color = color;
    return Promise.resolve();
  }
  send(message: Buffer) {
    if(message.length == 6 && message[0] == 0x81 && message[1] == 0x32 && message[3] == 0x51 && message[4] == 0x00) {
      return this.setColor(message[5]);
    }
  }
}


export class SimulationAccelerometer extends EventEmitter implements AccelerometerAbstraction {
  x: number
  y: number
  z: number

  constructor(hubName: string) {
    super();
    if(hubName == "BeneLego4" || hubName == "BeneLego0") {
      this.x = 0;
      this.y = 0;
      this.z = 1000;
    }
    else {
      this.x = -1000;
      this.y = 0;
      this.z = 0;
    }
    setInterval(() => this.emit('accel', {x: this.x, y: this.y, z: this.z}), 1000*Math.random());
  }
  send(message: Buffer) {
    return Promise.resolve();
  }
  requestUpdate() {
    console.log("simulation accelerometer sending acceleration " + this.x + " " + this.y + " " + this.z);
    this.emit('accel', {x: this.x, y: this.y, z: this.z});
    return Promise.resolve();
  }
}


export class SimulationDistanceSensor extends EventEmitter implements DistanceSensorAbstraction {
  distance: number

  constructor(portName: string) {
    super();
    this.distance = Math.floor(25.4*Math.floor(10 * Math.random()));
    const distance = this.distance;
    this.emit('distance', {distance});
    this.distance = Math.floor(25.4*0xff);
  }
  requestUpdate() {
    const distance = this.distance;
    console.log("simulation distance sensor sending update " + distance);
    this.emit('distance', {distance});
    return Promise.resolve();
  }
}


export class SimulationMotor extends EventEmitter implements MotorAbstraction {
  portId: number
  useAccelerationProfile: boolean
  useDecelerationProfile: boolean
  rotation: number
  destRotation: number
  speed: number
  speedIntervalID: NodeJS.Timeout
  token: Token

  constructor(portName: string) {
    super();
    switch(portName) {
      case "A":
        this.portId = 0;
      case "B":
        this.portId = 1;
      case "C":
        this.portId = 2;
      case "D":
        this.portId = 3;
    } 
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
  resetZero(rotation: number) {
    console.log("simulation motor setting rotation to " + rotation);
    this.rotation = rotation;
    this.emit('rotate', {degrees: this.rotation});
    return Promise.resolve();
  }
  setSpeed(speed: number, time: number | undefined) {
    console.log("simulation motor setting speed to " + this.speed);
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
    this.speedIntervalID = setInterval(() => {
      this.rotation += this.speed;
      this.emit('rotate', {degrees: this.rotation});
    }, 50);
    return Promise.resolve();
  }
  send(message: Buffer) {
    if(message.length == 6 && message[0] == 0x81 && message[1] == this.portId && message[3] == 0x51 && message[4] == 0x00) {
      return this.setSpeed(message.readInt8(5), undefined);
    }
    else if(message.length == 9 && message[0] == 0x81 && message[1] == this.portId && message[3] == 0x51 && message[4] == 0x02) {
      return this.resetZero(message.readInt32LE(5));
    }
  }
  requestUpdate() {
    this.emit('rotate', {degrees: this.rotation});
    return Promise.resolve();
  }
  rotateByDegrees(degrees: number, speed: number) {
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
      while(this.rotation != this.destRotation) {
        await sleep(50);
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

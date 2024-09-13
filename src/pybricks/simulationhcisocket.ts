import { EventEmitter } from "events";
import { SocketAbstraction } from "./socketinterface";
import { randomBytes } from 'crypto'

export class SimulationHciSocket extends EventEmitter implements SocketAbstraction {
  bleHubs : SimulationPybricksHub[] = []
  bleRandom : RandomBleDevice[] = []
  bindRaw() {
    console.log("binding to raw hci simulation socket");
  }

  start() {
    console.log("starting simulation socket");
    for (let i = 1; i<7; i++) {
      this.bleHubs.push(new SimulationPybricksHub(this, i))
      this.bleRandom.push(new RandomBleDevice(this))
    }
  }

  stop() {
    console.log("stopping simulation socket");
    this.bleHubs = []
    this.bleRandom = []
  }

  setFilter(filter: Buffer) {
    console.log("setting simulation socket filter");
  }

  write(data: Buffer) {
    console.log("simulation socket received", data);
    if(data.length != 36) return;
    if(data.readUInt8(6) != 0xff) return; // manufacturer data
    if(data.readUInt16LE(7) != 0x0397) return; // lego
    if(data.readUInt8(9) != 0x00) return; // channel nr
    if(data.readUInt8(10) != 0xd9) return; // binary array and length
    this.bleHubs.forEach(hub => hub.processBroadcast(data));
  }
}

class SimulationMotor {
  rotation: number
  destRotation: number
  maxSpeed: number
  speed: number
  lastRequestTime: number

  constructor(maxSpeed: number) {
    console.log("simulation motor created with maxSpeed", maxSpeed)
    this.maxSpeed = maxSpeed;
    this.rotation = 0;
    this.speed = 0;
    this.destRotation = null
    this.lastRequestTime = Date.now()
  }

  setSpeed(speed: number) {
    this.getRotation()
    // console.log("simulation motor setting speed to", speed)
    this.speed = speed*this.maxSpeed/1000;
    this.destRotation = null;
    this.lastRequestTime = Date.now()
  }

  reset(rotation: number) {
    console.log("simulation motor resetting rotation to", rotation)
    this.rotation = rotation;
    this.speed = 0;
    this.destRotation = null;
    this.lastRequestTime = Date.now()
  }

  setDestRotation(rotation: number) {
    this.getRotation()
    console.log("simulation motor setting rotation destination", rotation)
    this.destRotation = rotation;
    this.lastRequestTime = Date.now()
  }

  getRotation() {
    const timeDifference = Date.now() - this.lastRequestTime;
    this.lastRequestTime = Date.now()
    if(this.destRotation != null) {
      const targetDifference = this.destRotation - this.rotation;
      this.rotation += Math.sign(targetDifference)*Math.min(this.maxSpeed*timeDifference, Math.abs(targetDifference));
    }
    else {
      this.rotation += timeDifference*this.speed;
    }
    //console.log("simulation motor rotated", timeDifference, "with speed", this.speed)
    return this.rotation;
  }
}

class SimulationTiltSensor {
  acceleration: number[]
  constructor(acceleration: number[]) {
    this.acceleration = acceleration;
  }
  getAcceleration() {
    return this.acceleration;
  }
}

class SimulationPybricksHub {
  socket: SimulationHciSocket
  hubId: number
  broadcastIntervalId: NodeJS.Timeout
  motors: SimulationMotor[]
  tiltSensors : SimulationTiltSensor[]
  currentCommand : number

  constructor(socket: SimulationHciSocket, hubId: number) {
    console.log("construction simulation hub with id", hubId);
    this.socket = socket;
    this.hubId = hubId;
    this.currentCommand = 0;
    if(this.hubId < 5) {
      this.motors = [new SimulationMotor(0.0756)];
      this.tiltSensors = [new SimulationTiltSensor([1000, 0, 0]), new SimulationTiltSensor([1000, 0, 0])];
    }
    else {
      this.motors = [new SimulationMotor(0.0882), new SimulationMotor(0.0882), new SimulationMotor(0.0756), new SimulationMotor(0.0756)];
      this.tiltSensors = [new SimulationTiltSensor([0, 0, 1000])];
    }
    this.broadcastIntervalId = setInterval(() => {
      const data = Buffer.allocUnsafe(36);
      data.writeUInt8(0xff, 15); // manufacturer data
      data.writeUInt16LE(0x0397, 16) // lego
      data.writeUInt8(this.hubId, 18);
      if(this.hubId < 5) {
        data.writeUInt8(0xd2, 19);
        data.writeUInt8(0b00101111, 20);
      }
      else {
        data.writeUInt8(0xd0, 19);
        data.writeUInt8(0b00111111, 20);
      }
      data.writeUInt8(this.currentCommand, 21);
      const hubAcceleration = this.tiltSensors[0].getAcceleration();
      data.writeInt16LE(hubAcceleration[0], 22);
      data.writeInt16LE(hubAcceleration[1], 24);
      data.writeInt16LE(hubAcceleration[2], 26);
      data.writeInt16LE(this.motors[0].getRotation(), 28);
      if(this.hubId < 5) {
        const bottomAcceleration = this.tiltSensors[1].getAcceleration();
	data.writeInt16LE(bottomAcceleration[0], 30);
	data.writeInt16LE(bottomAcceleration[1], 32);
	data.writeInt16LE(bottomAcceleration[2], 34);
      }
      else {
        data.writeInt16LE(this.motors[1].getRotation(), 30);
        data.writeInt16LE(this.motors[2].getRotation(), 32);
        data.writeInt16LE(this.motors[3].getRotation(), 34);
      }
      this.socket.emit('data', data);
    }, 100 + Math.random());
  }

  processBroadcast(data: Buffer) {
    this.currentCommand = data.readUInt8(11);
    if(this.currentCommand == 1) {
      if(this.hubId < 5) {
        this.motors[0].setSpeed(data.readInt16LE(10 + 6*this.hubId));
      }
      else {
        this.motors[0].setSpeed(data.readInt16LE(12*this.hubId - 48));
        this.motors[1].setSpeed(data.readInt16LE(12*this.hubId - 46));
        this.motors[2].setSpeed(data.readInt16LE(12*this.hubId - 42));
        this.motors[3].setSpeed(data.readInt16LE(12*this.hubId - 40));
      }
    }
    else if(this.currentCommand == 2) {
      if(this.hubId < 5) {
        this.motors[0].setDestRotation(data.readInt16LE(10 + 6*this.hubId));
      }
      else {
        this.motors[0].setDestRotation(data.readInt16LE(12*this.hubId - 48));
        this.motors[1].setDestRotation(data.readInt16LE(12*this.hubId - 46));
        this.motors[2].setDestRotation(data.readInt16LE(12*this.hubId - 42));
        this.motors[3].setDestRotation(data.readInt16LE(12*this.hubId - 40));
      }
    }
    else if(this.currentCommand == 3) {
      if(this.hubId < 5) {
        this.motors[0].reset(data.readInt16LE(10 + 6*this.hubId));
      }
      else {
        this.motors[0].reset(data.readInt16LE(12*this.hubId - 48));
        this.motors[1].reset(data.readInt16LE(12*this.hubId - 46));
        this.motors[2].reset(data.readInt16LE(12*this.hubId - 42));
        this.motors[3].reset(data.readInt16LE(12*this.hubId - 40));
      }
    }
    else if(this.currentCommand == 4) {
      console.log("shutting down simulation hub id", this.hubId);
      clearInterval(this.broadcastIntervalId);
      this.broadcastIntervalId = null;
    }
  }
}

class RandomBleDevice {
  socket: SimulationHciSocket
  broadcastIntervalId: NodeJS.Timeout

  constructor(socket: SimulationHciSocket) {
    console.log("construction random ble device");
    this.socket = socket;
    this.broadcastIntervalId = setInterval(() => {
      const data = randomBytes(Math.floor(Math.random()*256))
      this.socket.emit('data', data);
    }, 100 + Math.random());
  }
}

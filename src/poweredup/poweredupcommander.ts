import { CommanderAbstraction } from "../commanderinterface"
import { SensorAbstraction } from "../sensorinterface"
import { PoweredAbstraction, HubAbstraction, MotorAbstraction, AccelerometerAbstraction } from "./poweredupinterfaces"
import { Vec43 } from "../tools"


const MOTOR_TYPES = [46, 47, 48, 49, 65, 75, 76]; // list of ids of accepted motor types
const ACCELEROMETER_TYPES = [34, 57]; // list of ids of accepted accelerometer types
const NO_MOVE_MOTOR_ANGLE = 2;

const setMotorAngle = (motor: MotorAbstraction, motorAngle: number) => {
  const buffer = Buffer.from([0x81, motor.portId, 0x10, 0x51, 0x02, 0x00, 0x00, 0x00, 0x00]);
  buffer.writeInt32LE(motorAngle, 5);
  return motor.send(buffer);
};

const setHubProperty = (hub: HubAbstraction, property: number, value: number) => {
  return hub.send(Buffer.from([0x01, property, value]), "00001624-1212-efde-1623-785feabcd123");
};

export class PoweredUpCommander implements CommanderAbstraction {
  dog: SensorAbstraction;
  poweredUp: PoweredAbstraction;
  hubs: HubAbstraction[] = new Array(6).fill(null);
  motors: MotorAbstraction[] = new Array(12).fill(null);
  accelerometers: AccelerometerAbstraction[] = new Array(10).fill(null);

  color = 0
  ledTimerID: NodeJS.Timeout

  constructor(dog: SensorAbstraction, poweredUp: PoweredAbstraction) {
    this.dog = dog;
    this.poweredUp = poweredUp;
    this.poweredUp.on('discover', (hub) => {
      this.addHub(hub);
    });
  }

  async connect() {
    this.ledTimerID = setInterval(async () => {
      for(const id in this.hubs) {
        if(this.hubs[id]) {
          const led = await this.hubs[id].waitForDeviceByType(23); // Consts.DeviceType.HUB_LED
          led.send(Buffer.from([0x81, 0x32, 0x10, 0x51, 0x00, this.color%2]));
        }
      }
      this.color++;
    }, 1000);
    return this.poweredUp.scan();
  }

  async disconnect() {
    clearInterval(this.ledTimerID);
    this.poweredUp.stop();
    console.log("disconnecting");
  }

  async addHub(hub: HubAbstraction) {
    await hub.connect();
    console.log("Connected to " + hub.name + " firmware " + hub.firmwareVersion);
    for(let i = 0; i < 6; i++) {
      if(hub.name == "bene" + (i + 1)) {
        this.hubs[i] = hub;
	if(hub) this.dog.notifyHubStatus(i, this.dog.hubStatus[i] | 0b00100001, 0, 0);
	else this.dog.notifyHubStatus(i, 0, 0, 0);
        hub.removeAllListeners("disconnect");
        hub.on("disconnect", () => {
          this.hubs[i] = null;
	  this.dog.notifyHubStatus(i, 0, 0, 0);
          this.initializeDevices(hub);
	});
        hub.removeAllListeners("attach");
        hub.on("attach", () => {
          this.initializeDevices(hub);
        });
        hub.removeAllListeners("detach");
        hub.on("detach", () => {
          this.initializeDevices(hub);
        });
        setHubProperty(hub, 0x05, 0x03); // disable rssi update
        setHubProperty(hub, 0x06, 0x03); // disable battery update
        return this.initializeDevices(hub);
      }
    }
    console.log("HubName " + hub.name + " not known, disconnecting");
    hub.disconnect();
  }

  async initializeDevices(hub: HubAbstraction) {
    const id = parseInt(hub.name.substring(4)) - 1;
    let status = this.dog.hubStatus[id] & 0b11100001;
    if(id < 4) {
      if(this.setupMotor(hub, "A", 3*id + 2)) status |= 0b00000010;
      if(this.setupAccelerometer(hub, "B", 2*id + 1)) status |= 0b00000100;
      this.setupAccelerometer(hub, "ACCELEROMETER", 2*id);
    }
    else {
      if(this.setupMotor(hub, "A", 6*(id - 4))) status |= 0b00000010;
      if(this.setupMotor(hub, "B", 6*(id - 4) + 1)) status |= 0b00000100;
      if(this.setupMotor(hub, "C", 6*(id - 4) + 3)) status |= 0b00001000;
      if(this.setupMotor(hub, "D", 6*(id - 4) + 4)) status |= 0b00010000;
      this.setupAccelerometer(hub, "ACCELEROMETER", 4 + id);
    }
    this.dog.notifyHubStatus(id, status, 0, 0);
  }

  setupMotor(hub: HubAbstraction, port: string, id: number) {
    const motor = hub.getDeviceAtPort(port);
    if(motor && MOTOR_TYPES.includes(motor.type)) {
      this.motors[id] = motor;
      motor.setBrakingStyle(127); // Consts.BrakingStyle.BRAKE
      motor.useAccelerationProfile = false;
      motor.useDecelerationProfile = false;
      motor.setSpeed(0, undefined, true);
      motor.removeAllListeners('rotate');
      motor.on('rotate', ({degrees}) => {
        const angles = [[NaN,NaN,NaN],[NaN,NaN,NaN],[NaN,NaN,NaN],[NaN,NaN,NaN]] as Vec43
	angles[Math.floor(id/3)][id%3] = degrees;
	this.dog.notifyMotorAngles(angles);
      });
      motor.send(Buffer.from([0x41, motor.portId, 0x02, 0x30, 0x00, 0x00, 0x00, 0x01])); // subscribe again with delta interval 48 instead of 1
    }
    else this.motors[id] = null;
    return motor;
  }

  setupAccelerometer(hub: HubAbstraction, port: string, id: number) {
    const accelerometer = hub.getDeviceAtPort(port);
    if(accelerometer && ACCELEROMETER_TYPES.includes(accelerometer.type)) {
      this.accelerometers[id] = accelerometer;
      accelerometer.removeAllListeners('accel');
      accelerometer.on("accel", (accel) => {
        if(id == 8) {
          this.dog.notifyDogAcceleration([accel.x, accel.z, accel.y]);
        }
	else if(port == "B") {
          const acceleration = this.dog.bottomAcceleration;
          acceleration[Math.floor(id/2)] = [accel.x, accel.z, accel.y];
          this.dog.notifyBottomAcceleration(acceleration);
        }
        else {
          const acceleration = this.dog.topAcceleration;
          acceleration[Math.round(id/2)] = [accel.x, accel.z, accel.y];
          this.dog.notifyTopAcceleration(acceleration);
        }
      });
      if(port == "ACCELEROMETER") {
        accelerometer.send(Buffer.from([0x41, accelerometer.portId, 0x00, 0x20, 0x00, 0x00, 0x00, 0x01])); // subscribe again with larger delta interval
      }
    }
    else this.accelerometers[id] = null;
    return accelerometer;
  }

  requestShutdown() {
    return Promise.all(this.hubs.map(async e => {if(e) await e.shutdown();}))
  }

  requestMotorSpeeds (motorAngles: Vec43) {
    return Promise.all(this.motors.map(async (e, i) => {if(e) await e.setSpeed(Math.round(motorAngles[Math.floor(i/3)][i%3]/10), undefined, true);}));
  }

  requestMotorAngles (motorAngles: Vec43) {
    return Promise.all(this.motors.map(async (e, i) => {
      if(e) {
        const diff = motorAngles[Math.floor(i/3)][i%3] - this.dog.motorAngles[Math.floor(i/3)][i%3];
        if(diff**2 > NO_MOVE_MOTOR_ANGLE**2) await e.rotateByDegrees(Math.abs(diff), Math.sign(diff)*100, true);
      }
    }));
  }

  requestSync (motorAngles: Vec43) {
    return Promise.all(this.motors.map(async (e, i) => {if(e) await setMotorAngle(e, motorAngles[Math.floor(i/3)][i%3])}));
  }
}

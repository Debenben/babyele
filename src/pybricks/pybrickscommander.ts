import { CommanderAbstraction } from "../commanderinterface"
import { SensorAbstraction } from "../sensorinterface"
import { Vec43 } from "../tools"
import { SocketAbstraction } from "./socketinterface"

const HCI_COMMAND_PKT = 0x01;
const HCI_EVENT_PKT = 0x04;

const EVT_LE_META_EVENT = 0x3e;

const OGF_LE_CTL = 0x08;
const OCF_LE_SET_SCAN_PARAMETERS = 0x000b;
const OCF_LE_SET_SCAN_ENABLE = 0x000c;
const OCF_LE_SET_ADVERTISING_PARAMETERS = 0x0006;
const OCF_LE_SET_ADVERTISING_DATA = 0x0008;
const OCF_LE_SET_ADVERTISE_ENABLE = 0x000a;

const LE_SET_SCAN_PARAMETERS_CMD = OCF_LE_SET_SCAN_PARAMETERS | OGF_LE_CTL << 10;
const LE_SET_SCAN_ENABLE_CMD = OCF_LE_SET_SCAN_ENABLE | OGF_LE_CTL << 10;
const LE_SET_ADVERTISING_PARAMETERS_CMD = OCF_LE_SET_ADVERTISING_PARAMETERS | OGF_LE_CTL << 10;
const LE_SET_ADVERTISING_DATA_CMD = OCF_LE_SET_ADVERTISING_DATA | OGF_LE_CTL << 10;
const LE_SET_ADVERTISE_ENABLE_CMD = OCF_LE_SET_ADVERTISE_ENABLE | OGF_LE_CTL << 10;

class Command {
  command: number
  data: Vec43
  promise: Promise<any>
  callback: any
  constructor(command: number, data: Vec43) {
    this.command = command;
    this.data = data;
    this.promise = new Promise<any>((resolve) => {
      this.callback = (exitStatus) => resolve(exitStatus);
    });
  }
}

export class PybricksCommander implements CommanderAbstraction {
  dog: SensorAbstraction;
  socket: SocketAbstraction;
  currentCommand: Command;

  constructor(dog: SensorAbstraction, socket: SocketAbstraction) {
    this.dog = dog;
    this.socket = socket;
    this.socket.on('data', this.onData.bind(this))
    this.socket.on('error', (e) => console.error(e));
  }

  async onData(data) {
    //console.log(data);
    if(data.length < 35) return;
    if(data.readUInt8(15) != 0xff) return; // manufacturer data
    if(data.readUInt16LE(16) != 0x0397) return; // lego
    const id = data.readUInt8(18);
    if(id < 1 || id > 6) return;
    if(id < 5 && data.readUInt8(19) != 0xd2) return;
    if(id > 4 && data.readUInt8(19) != 0xd0) return;
    this.dog.notifyHubStatus(id - 1, data.readUInt8(20), Date.now(), data.readInt8(data.length - 1));
    if(id == 5) this.dog.notifyDogAcceleration([-data.readInt16LE(22), data.readInt16LE(26), -data.readInt16LE(24)]); // [-x, z, -y]
    const motorAngles = this.dog.motorAngles;
    if(id < 5) {
      const topAcceleration = this.dog.topAcceleration;
      const bottomAcceleration = this.dog.bottomAcceleration;
      topAcceleration[id - 1] = [-data.readInt16LE(22), data.readInt16LE(26), -data.readInt16LE(24)];
      motorAngles[id - 1][2] = 10*data.readInt16LE(28);
      bottomAcceleration[id - 1] = [data.readInt16LE(32), data.readInt16LE(30), data.readInt16LE(34)];
      this.dog.notifyTopAcceleration(topAcceleration);
      this.dog.notifyBottomAcceleration(bottomAcceleration);
    }
    else  {
      motorAngles[2*(id - 5)][0] = 10*data.readInt16LE(28);
      motorAngles[2*(id - 5)][1] = 10*data.readInt16LE(30);
      motorAngles[2*(id - 5) + 1][0] = 10*data.readInt16LE(32);
      motorAngles[2*(id - 5) + 1][1] = 10*data.readInt16LE(34);
    }
    this.dog.notifyMotorAngles(motorAngles);
    if(this.currentCommand) {
      if(motorAngles.every((e,i) => e.every((f,j) => Math.abs(f - 10*this.currentCommand.data[i][j]) < 20.0))) {
        this.currentCommand.callback(0x22);
        this.currentCommand = null;
      }
    }
  }

  async connect() {
    this.socket.bindRaw();

    const filter = Buffer.allocUnsafe(16).fill(0);
    const typeMask = (1 << HCI_EVENT_PKT);
    const eventMask2 = (1 << (EVT_LE_META_EVENT - 32));
    filter.writeUInt32LE(typeMask, 0);
    filter.writeUInt32LE(eventMask2, 8);
    this.socket.setFilter(filter);

    this.socket.start();

    this.setScanEnable(false);
    this.setAdvertiseEnable(false);
    this.setScanParameters();
    this.setAdvertiseParameters();
    this.setScanEnable(true);
    this.setAdvertiseEnable(true);

    this.sendCommand(0, [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]);
  }

  async disconnect() {
    if(this.currentCommand) this.currentCommand.callback(0x24);
    this.currentCommand = null;
    this.setScanEnable(false);
    this.setAdvertiseEnable(false);

    this.socket.stop();
    console.log("disconnecting");
  }

  setScanParameters() {
    const cmd = Buffer.allocUnsafe(11);
    cmd.writeUInt8(HCI_COMMAND_PKT, 0);
    cmd.writeUInt16LE(LE_SET_SCAN_PARAMETERS_CMD, 1); // command
    cmd.writeUInt8(0x07, 3); // length

    cmd.writeUInt8(0x00, 4); // type: 0 -> passive, 1 -> active
    cmd.writeUInt16LE(0x003e, 5); // internal, ms * 1.6
    cmd.writeUInt16LE(0x003e, 7); // window, ms * 1.6
    cmd.writeUInt8(0x00, 9); // own address type: 0 -> public, 1 -> random
    cmd.writeUInt8(0x00, 10); // filter: 0 -> all event types

    return this.socket.write(cmd);
  }

  setScanEnable(enabled) {
    const cmd = Buffer.allocUnsafe(6);
    cmd.writeUInt8(HCI_COMMAND_PKT, 0);
    cmd.writeUInt16LE(LE_SET_SCAN_ENABLE_CMD, 1); // command
    cmd.writeUInt8(0x02, 3); // length

    cmd.writeUInt8(enabled ? 0x01 : 0x00, 4); // enable: 0 -> disabled, 1 -> enabled
    cmd.writeUInt8(0x00, 5); // filter duplicates: 1 -> filter, 0 -> duplicates

    return this.socket.write(cmd);
  }

  setAdvertiseParameters() {
    const cmd = Buffer.allocUnsafe(19).fill(0);
    cmd.writeUInt8(HCI_COMMAND_PKT, 0);
    cmd.writeUInt16LE(LE_SET_ADVERTISING_PARAMETERS_CMD, 1); // command
    cmd.writeUInt8(15, 3); // length

    cmd.writeUInt16LE(0x00a0, 4); // min interval
    cmd.writeUInt16LE(0x00a0, 6); // max interval
    cmd.writeUInt8(0x03, 8); // adv type: 3 -> ADV_NONCONN_IND
    cmd.writeUInt8(0x07, 17);

    return this.socket.write(cmd);
  }

  setAdvertiseData(data) {
    const cmd = Buffer.allocUnsafe(36).fill(0);
    cmd.writeUInt8(HCI_COMMAND_PKT, 0);
    cmd.writeUInt16LE(LE_SET_ADVERTISING_DATA_CMD, 1); // command
    cmd.writeUInt8(32, 3); // length

    cmd.writeUInt8(data.length, 4);
    data.copy(cmd, 5);

    return this.socket.write(cmd);
  }

  setAdvertiseEnable(enabled) {
    const cmd = Buffer.allocUnsafe(5).fill(0);
    cmd.writeUInt8(HCI_COMMAND_PKT, 0);
    cmd.writeUInt16LE(LE_SET_ADVERTISE_ENABLE_CMD, 1); // command
    cmd.writeUInt8(0x01, 3); // length

    cmd.writeUInt8(enabled ? 0x01 : 0x00, 4); // enable: 0 -> disabled, 1 -> enabled

    return this.socket.write(cmd);
  }

  setBroadcast(channel, data) {
    const header = Buffer.allocUnsafe(5);
    header.writeUInt8(data.length + 4, 0); // length
    header.writeUInt8(0xff, 1); // manufacturer data
    header.writeUInt16LE(0x0397, 2); // lego
    header.writeUInt8(channel, 4); // pybricks channel nr

    return this.setAdvertiseData(Buffer.concat([header, data]));
  }

  sendCommand(command: number, data: Vec43) {
    if(this.currentCommand) this.currentCommand.callback(0x24);
    this.currentCommand = null;
    const msg = Buffer.alloc(26, 0);
    msg.writeUInt8((6 << 5) | (25 & 0x1F), 0); // type: byte=6, length: 25
    msg.writeUInt8(command, 1);
    for(let i = 0; i < 4; i++) {
      for(let j = 0; j < 3; j++) {
        msg.writeInt16LE(data[i][j], 2 + 6*i + 2*j);
      }
    }
    // console.log("sending command", msg);
    if(command == 2) {
      this.setBroadcast(0, msg);
      this.currentCommand = new Command(command, data);
      return this.currentCommand.promise;
    }
    else return this.setBroadcast(0, msg);
  }

  async requestShutdown() {
    return this.sendCommand(4, [[0,0,0], [0,0,0], [0,0,0], [0,0,0]]);
  }

  async requestMotorSpeeds (motorSpeeds: Vec43) {
    return this.sendCommand(1, motorSpeeds);
  }

  async requestMotorAngles (motorAngles: Vec43) {
    return this.sendCommand(2, motorAngles.map(e => e.map(v => v/10)) as Vec43);
  }

  async requestSync (motorAngles: Vec43) {
    return this.sendCommand(3, motorAngles.map(e => e.map(v => v/10)) as Vec43);
  }
}

import { EventEmitter } from "events";
import { SocketAbstraction } from "./socketinterface"

const HCI_COMMAND_PKT = 0x01;
const LE_SET_ADVERTISING_DATA_CMD = 0x2008;

export class InventorHciSocket extends EventEmitter implements SocketAbstraction {
  realSocket: SocketAbstraction;
  simSocket: SocketAbstraction;

  constructor(realSocket: SocketAbstraction, simSocket: SocketAbstraction) {
    super();
    this.realSocket = realSocket;
    this.simSocket = simSocket;
    this.realSocket.on('data', d => this.advertiseRecievedData(simSocket, d));
    this.simSocket.on('data', d => this.advertiseRecievedData(realSocket, d));
    this.realSocket.on('error', e => this.emit('error', e));
    this.simSocket.on('error', e => this.emit('error', e));
  }

  bindRaw() {
    this.realSocket.bindRaw();
    this.simSocket.bindRaw();
  }

  start() {
    this.realSocket.start();
    this.simSocket.start();
  }

  stop() {
    this.realSocket.stop();
    this.simSocket.stop();
  }

  setFilter(filter: Buffer) {
    this.realSocket.setFilter(filter);
    this.simSocket.setFilter(filter);
  }

  write(data: Buffer) {
    if(data.readUInt16LE(1) == LE_SET_ADVERTISING_DATA_CMD && data.readUInt8(9) == 0) return; // drop control command
    this.realSocket.write(data);
    this.simSocket.write(data);
  }

  advertiseRecievedData(socket: SocketAbstraction, data: Buffer) {
    this.emit('data', data);

    if(data.length < 35) return;
    if(data.readUInt8(15) != 0xff) return; // manufacturer data
    if(data.readUInt16LE(16) != 0x0397) return; // lego
    const len = data.readUInt8(19) & 0x1F;
 
    const cmd = Buffer.allocUnsafe(36).fill(0);
    cmd.writeUInt8(HCI_COMMAND_PKT, 0);
    cmd.writeUInt16LE(LE_SET_ADVERTISING_DATA_CMD, 1); // command
    cmd.writeUInt8(len + 6, 3); // length
    cmd.writeUInt8(len + 5, 4); // length
    cmd.writeUInt8(len + 4, 5); // length
    data.copy(cmd, 6, 15, 15 + len + 5);
    socket.write(cmd);
  }


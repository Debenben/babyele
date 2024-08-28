import { EventEmitter } from "events";

export interface SocketAbstraction extends EventEmitter {
  bindRaw: () => any;
  start: () => any;
  stop: () => any;
  setFilter: (filter: Buffer) => any;
  write: (data: Buffer) => any;
}

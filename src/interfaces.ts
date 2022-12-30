import { EventEmitter } from "events";

export interface PoweredAbstraction extends EventEmitter {
  scan: () => any;
  stop: () => any;
}

export interface HubAbstraction extends EventEmitter {
  readonly name: string;
  readonly firmwareVersion: string;
  readonly batteryLevel: number;
  readonly rssi: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  shutdown: () => Promise<void>;
  getDeviceAtPort: (portName: string) => any;
  waitForDeviceByType: (deviceType: number) => Promise<any>;
  send: (message: Buffer, characteristic: string) => Promise<void>;
}

export interface LEDAbstraction {
  readonly type: number;
  send: (message: Buffer) => Promise<void>;
}

export interface TiltSensorAbstraction extends EventEmitter {
  readonly portId: number;
  readonly type: number;
  send: (message: Buffer) => Promise<void>;
  requestUpdate: () => Promise<void>;
}

export interface MotorAbstraction extends EventEmitter {
  readonly portId: number;
  readonly type: number;
  useAccelerationProfile: boolean;
  useDecelerationProfile: boolean;
  setBrakingStyle: (style: number) => Promise<void>;
  setAccelerationTime: (time: number) => Promise<void>;
  setDecelerationTime: (time: number) => Promise<void>;
  send: (message: Buffer) => Promise<void>;
  setSpeed: (speed: number, time: number | undefined, interrupt: boolean) => Promise<void>;
  rotateByDegrees: (degrees: number, speed: number, interrupt: boolean) => Promise<void>;
  requestUpdate: () => Promise<void>;
}

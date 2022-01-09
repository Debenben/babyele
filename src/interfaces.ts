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
  send: (message: Buffer) => Promise<void>;
}

export interface AccelerometerAbstraction {
  send: (message: Buffer) => Promise<void>;
  requestUpdate: () => Promise<void>;
}

export interface MotorAbstraction extends EventEmitter {
  readonly portId: number;
  setBrakingStyle: (style: number) => Promise<void>;
  setAccelerationTime: (time: number) => Promise<void>;
  setDecelerationTime: (time: number) => Promise<void>;
  send: (message: Buffer) => Promise<void>;
  rotateByDegrees: (degrees: number, speed: number) => Promise<void>;
  requestUpdate: () => Promise<void>;
}

export interface DistanceSensorAbstraction extends EventEmitter {
  requestUpdate: () => Promise<void>;
}

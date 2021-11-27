import { EventEmitter } from "events";

export interface PoweredAbstraction extends EventEmitter {
  scan: () => any;
  stop: () => any;
}

export interface HubAbstraction extends EventEmitter {
  readonly name: string;
  readonly batteryLevel: number;
  readonly rssi: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  shutdown: () => Promise<void>;
  getDeviceAtPort: (portName: string) => any;
  waitForDeviceByType: (deviceType: number) => Promise<any>;
}

export interface LEDAbstraction {
  setColor: (color: number) => Promise<void>;
}

export interface MotorAbstraction extends EventEmitter {
  setBrakingStyle: (style: number) => Promise<void>;
  setAccelerationTime: (time: number) => Promise<void>;
  setDecelerationTime: (time: number) => Promise<void>;
  resetZero: () => Promise<void>;
  setPower: (power: number) => Promise<void>;
  rotateByDegrees: (degrees: number, speed: number) => Promise<void>;
}

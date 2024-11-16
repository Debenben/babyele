import { Vec43, Vec3 } from "./tools";

export interface SensorAbstraction {
  readonly hubStatus: number[]

  readonly motorAngles: Vec43
  readonly topAcceleration: Vec43
  readonly bottomAcceleration: Vec43
  readonly dogAcceleration: Vec3

  notifyHubStatus: (hubId: number, status: number, timestamp: number, rssi: number) => Promise<void>;

  notifyMotorAngles: (motorAngles: Vec43) => Promise<void>;
  notifyTopAcceleration: (acceleration: Vec43) => Promise<void>;
  notifyBottomAcceleration: (acceleration: Vec43) => Promise<void>;
  notifyDogAcceleration: (acceleration: Vec3) => Promise<void>;
}

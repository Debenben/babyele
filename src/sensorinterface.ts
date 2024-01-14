import { Vec43, Vec3 } from "./tools";

export interface SensorAbstraction {
  readonly hubStatus: boolean[]
  readonly motorStatus: boolean[]
  readonly accelerometerStatus: boolean[]

  readonly motorAngles: Vec43
  readonly topAcceleration: Vec43
  readonly bottomAcceleration: Vec43
  readonly dogAcceleration: Vec3

  notifyHubStatus: (hubStatus: boolean[]) => Promise<void>;
  notifyMotorStatus: (motorStatus: boolean[]) => Promise<void>;
  notifyAccelerometerStatus: (accelerometerStatus: boolean[]) => Promise<void>;

  notifyMotorAngles: (motorAngles: Vec43) => Promise<void>;
  notifyTopAcceleration: (acceleration: Vec43) => Promise<void>;
  notifyBottomAcceleration: (acceleration: Vec43) => Promise<void>;
  notifyDogAcceleration: (acceleration: Vec3) => Promise<void>;
}

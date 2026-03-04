import { Vec43 } from "./tools";

export interface CommanderAbstraction {
  connect: () => Promise;
  disconnect: () => Promise;
  requestShutdown: () => Promise;
  requestMotorSpeeds: (motorSpeeds: Vec43) => Promise;
  requestMotorAngles: (motorAngles: Vec43) => Promise;
  requestSync: (motorAngles: Vec43) => Promise;
}

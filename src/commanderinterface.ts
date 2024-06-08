import { Vec43 } from "./tools";

export interface CommanderAbstraction {
  connect: () => Promise<any>;
  disconnect: () => Promise<any>;
  requestShutdown: () => Promise<any>;
  requestMotorSpeeds: (motorSpeeds: Vec43) => Promise<any>;
  requestMotorAngles: (motorAngles: Vec43) => Promise<any>;
  requestSync: (motorAngles: Vec43) => Promise<any>;
}

import { Vec43 } from "./tools";

export interface CommanderAbstraction {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  requestShutdown: () => Promise<void>;
  requestMotorSpeeds: (motorSpeeds: Vec43) => Promise<void>;
  requestMotorAngles: (motorAngles: Vec43) => Promise<void>;
  requestSync: (motorAngles: Vec43) => Promise<void>;
}

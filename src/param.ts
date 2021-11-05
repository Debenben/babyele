export enum Modes {
  OFFLINE    =  0,
  WAITING    =  1,
  STANDING   =  2,
  FORWARD    =  3,
  READY0     = 10,
  READY1     = 11,
  READY2     = 12,
  READY3     = 13,
  DOWN       = 20,
}

export const allowSwitch = (fromMode: Modes, toMode: Modes) => {
  switch(fromMode) {
    case Modes.OFFLINE:
      return [ Modes.OFFLINE ].includes(toMode);
    case Modes.WAITING:
      return [ Modes.OFFLINE, Modes.WAITING ].includes(toMode);
    case Modes.STANDING:
      return [ Modes.OFFLINE, Modes.STANDING, Modes.READY0, Modes.FORWARD, Modes.DOWN ].includes(toMode);
    case Modes.READY0:
      return [ Modes.OFFLINE, Modes.STANDING, Modes.READY0, Modes.READY1, Modes.READY2, Modes.READY3, Modes.FORWARD ].includes(toMode);
    case Modes.READY1:
    case Modes.READY2:
    case Modes.READY3:
    case Modes.FORWARD:
      return [ Modes.OFFLINE, Modes.READY0, Modes.READY1, Modes.READY2, Modes.READY3, Modes.FORWARD ].includes(toMode);
    case Modes.DOWN:
      return [ Modes.OFFLINE, Modes.STANDING, Modes.DOWN ].includes(toMode);
    default:
      return false;
  }
}

export const MotorMap = {
  "BeneLego3": {
    "name": "hubFrontCenter",
    "A"   : "legFrontRightTop",
    "C"   : "legFrontRightBottom",
    "B"   : "legFrontLeftTop",
    "D"   : "legFrontLeftBottom",
    "test": "legFrontRightMount",
  },
  "BeneLego2": {
    "name": "hubBackCenter",
    "B"   : "legBackRightTop",
    "D"   : "legBackRightBottom",
    "A"   : "legBackLeftTop",
    "C"   : "legBackLeftBottom",
  },
  "BeneLego1": {
    "name": "hubFrontLeft",
    "test": "legFrontLeftMount",
    "tess": "legBackLeftMount",
    "tese": "legBackRightMount",
  },
  "BeneLego4": {
    "name": "hubFrontRight",
  },
  "BeneLego5": {
    "name": "hubBackRight",
  },
  "BeneLego6": {
    "name": "hubBackLeft",
  },
}

export const LEG_LENGTH_TOP = 185.0; // length of top part of the leg
export const LEG_LENGTH_BOTTOM = 200.0; // length of bottom part of the leg
export const LEG_SEPARATION_WIDTH = 225.0; // distance between left and right legs
export const LEG_SEPARATION_LENGTH = 288.0; // distance between front and back legs
export const LEG_MOUNT_HEIGHT = 45.0; // distance from top leg rotation axis to bottom of leg mount
export const LEG_MOUNT_WIDTH = 60.0; // distance from middle of leg to mount rotation axis
export const LEG_PISTON_HEIGHT = 120.0; // distance from bootom of leg mount to top of piston
export const LEG_PISTON_WIDTH = 140.0; // distance from bootom of leg mount to bottom of piston
export const LEG_PISTON_LENGTH = 184.3; // length of piston when leg is vertical

export const NO_MOVE_MOTOR_ANGLE = 3;
export const TOP_MOTOR_RANGE = 7415; // motor rotation in degree needed for rotation of top leg segment by pi
export const BOTTOM_MOTOR_RANGE = 13593; // motor rotation in degree needed for rotation of bottom leg segment by pi
export const MOUNT_MOTOR_RANGE = 100; // motor rotation in degree needed for one millimeter piston extension

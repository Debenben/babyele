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

export enum Legs {
  FRONTRIGHT = "legFrontRight",
  FRONTLEFT = "legFrontLeft",
  BACKRIGHT = "legBackRight",
  BACKLEFT = "legBackLeft",
}

export const MotorMap = {
  "BeneLego3": {
    "name": "hubFrontCenter",
    "A": "legFrontRightTop",
    "C": "legFrontRightBottom",
    "B": "legFrontLeftTop",
    "D": "legFrontLeftBottom",
    "test": "legFrontRightMount",
  },
  "BeneLego2": {
    "name": "hubBackCenter",
    "B": "legBackRightTop",
    "D": "legBackRightBottom",
    "A": "legBackLeftTop",
    "C": "legBackLeftBottom",
  },
  "BeneLego1": {
    "name": "hubFrontLeft",
  },
  "BeneLego4": {
    "name": "hubFrontRight",
  },
}

export const LEG_LENGTH_TOP = 185.0; // length of top part of the leg
export const LEG_LENGTH_BOTTOM = 200.0; // length of bottom part of the leg
export const LEG_SEPARATION_WIDTH = 225.0; // distance between left and right legs
export const LEG_SEPARATION_LENGTH = 288.0; // distance between front and back legs
export const LEG_MOUNT_HEIGHT = 90.0; // distance from top leg rotation axis to bottom of leg mount
export const LEG_MOUNT_WIDTH = 60.0; // distance from middle of leg to mount rotation axis 

export const LEG_LENGTH_TOP = 240.0; // length of top part of the leg
export const LEG_LENGTH_BOTTOM = 264.0; // length of bottom part of the leg
export const LEG_SEPARATION_WIDTH = 300.0; // distance between left and right legs
export const LEG_SEPARATION_LENGTH = 385.0; // distance between front and back legs
export const LEG_MOUNT_HEIGHT = 47.0; // distance from top leg rotation axis to bottom of leg mount
export const LEG_MOUNT_WIDTH = 84.0; // distance from middle of leg to mount rotation axis
export const LEG_PISTON_HEIGHT = 101.0; // distance from bottom of leg mount to top of piston
export const LEG_PISTON_WIDTH = 112.0; // distance from bottom of leg mount to bottom of piston
export const LEG_PISTON_LENGTH = 175.0; // length of piston when leg is vertical

export const NO_MOVE_MOTOR_ANGLE = 16;
const TOP_MOTOR_RANGE = 12272; // motor rotation in degree needed for rotation of top leg segment by pi
const BOTTOM_MOTOR_RANGE = 22486; // motor rotation in degree needed for rotation of bottom leg segment by pi
const MOUNT_MOTOR_RANGE = 433; // motor rotation in degree needed for one millimeter piston extension

export const MotorMap = {
  "BeneLego0": {
    "name": "hubBackCenter",
    "A"   : {"name": "legBackLeftMount", "range": MOUNT_MOTOR_RANGE},
    "B"   : {"name": "legBackRightMount", "range": -MOUNT_MOTOR_RANGE},
    "C"   : {"name": "legBackRightTop", "range": TOP_MOTOR_RANGE},
    "D"   : {"name": "legBackLeftTop", "range": -TOP_MOTOR_RANGE},
  },
  "BeneLego4": {
    "name": "hubFrontCenter",
    "A"   : {"name": "legFrontRightTop", "range": TOP_MOTOR_RANGE},
    "C"   : {"name": "legFrontLeftTop", "range": -TOP_MOTOR_RANGE},
    "B"   : {"name": "legFrontLeftMount", "range": MOUNT_MOTOR_RANGE},
    "D"   : {"name": "legFrontRightMount", "range": -MOUNT_MOTOR_RANGE},
  },
  "BeneLego2": {
    "name": "hubFrontLeft",
    "C"   : {"name": "legFrontLeftBottom", "range": -BOTTOM_MOTOR_RANGE},
    "A"   : {"name": "legFrontLeftDistance"},
  },
  "BeneLego3": {
    "name": "hubFrontRight",
    "D"   : {"name": "legFrontRightBottom", "range": BOTTOM_MOTOR_RANGE},
    "B"   : {"name": "legFrontRightDistance"},
  },
  "BeneLego1": {
    "name": "hubBackRight",
    "C"   : {"name": "legBackRightBottom", "range": BOTTOM_MOTOR_RANGE},
    "D"   : {"name": "legBackRightDistance"},
  },
  "BeneLego5": {
    "name": "hubBackLeft",
    "D"   : {"name": "legBackLeftBottom", "range": -BOTTOM_MOTOR_RANGE},
    "C"   : {"name": "legBackLeftDistance"},
  },
}

export const DistanceAngleMap = {
 0xfe: {min: -150.00, max:  150.00},
 0xff: {min: -150.00, max:  150.00},
    0: {min: -150.00, max: -124.80},
    1: {min: -124.03, max: -118.26},
    2: {min: -117.87, max: -110.45},
    3: {min: -110.44, max: -100.79},
    4: {min: -100.40, max:  -93.06},
    5: {min:  -93.03, max:  -75.28},
    6: {min:  -74.13, max:  -66.74},
    7: {min:  -65.57, max:  -58.99},
    8: {min:  -57.45, max:  -51.35},
    9: {min:  -49.81, max:  -40.84},
   10: {min:  -40.46, max:  150.00},
}

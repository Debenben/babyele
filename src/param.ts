export const LEG_LENGTH_TOP = 240.0; // length of top part of the leg
export const LEG_LENGTH_BOTTOM = 264.0; // length of bottom part of the leg
export const LEG_SEPARATION_WIDTH = 300.0; // distance between left and right legs
export const LEG_SEPARATION_LENGTH = 385.0; // distance between front and back legs
export const LEG_MOUNT_HEIGHT = 47.0; // distance from top leg rotation axis to bottom of leg mount
export const LEG_MOUNT_WIDTH = 84.0; // distance from middle of leg to mount rotation axis
export const LEG_PISTON_HEIGHT = 101.0; // distance from bottom of leg mount to top of piston
export const LEG_PISTON_WIDTH = 112.0; // distance from bottom of leg mount to bottom of piston
export const LEG_PISTON_LENGTH = 175.0; // length of piston when leg is vertical

export const ACCEL_NORM_MAX = 1050.0; // acceleration in mG, values above are ignored
export const ACCEL_NORM_MIN = 950.0; // acceleration in mG, values below are ignored
export const ACCEL_SIDEWAYS_TOLERANCE = 0.1; // difference in sideways tilt angle of legs

export const NO_MOVE_MOTOR_ANGLE = 16;
const TOP_MOTOR_RANGE = 4168; // motor rotation in degree needed for rotation of top leg segment by pi
const BOTTOM_MOTOR_RANGE = 22486; // motor rotation in degree needed for rotation of bottom leg segment by pi
const MOUNT_MOTOR_RANGE = 433; // motor rotation in degree needed for one millimeter piston extension
const POSITION_ZERO = {forward: 0, height: 0, sideways: 0};
const POSITION_TOP = {forward: 0, height: 0, sideways: Math.PI/2};
const POSITION_DOWN = {forward: Math.PI/2, height: 0, sideways: 0};
const POSITION_UP = {forward: -Math.PI/2, height: 0, sideways: 0};

export const MOTOR_TYPES = [46, 47, 48, 49, 65, 75, 76]; // list of ids of accepted motor types
export const TILT_TYPES = [34, 57]; // list of ids of accepted accelerometer types

// BeneLego6 "offset": {forward: -1.6396414210587527 , height: -20.485073051430724 , sideways: 6.226506645503237 }
export const MotorMap = {

  "BeneLego6":
  {
    "name"          : "hubBackCenter",
    "A"             : {"name": "legBackLeftMount", "range": MOUNT_MOTOR_RANGE},
    "B"             : {"name": "legBackRightMount", "range": -MOUNT_MOTOR_RANGE},
    "C"             : {"name": "legBackLeftTop", "range": TOP_MOTOR_RANGE},
    "D"             : {"name": "legBackRightTop", "range": -TOP_MOTOR_RANGE},
  },

  "BeneLego4":
  {
    "name"          : "hubFrontCenter",
    "ACCELEROMETER" : {"name": "dogTilt", "rotation": POSITION_ZERO, "offset": {forward: 19.393014183424288 , height: -27.001327682538353 , sideways: -9.472666413278418 }},
    "A"             : {"name": "legFrontLeftMount", "range": MOUNT_MOTOR_RANGE},
    "B"             : {"name": "legFrontRightMount", "range": -MOUNT_MOTOR_RANGE},
    "C"             : {"name": "legFrontLeftTop", "range": TOP_MOTOR_RANGE},
    "D"             : {"name": "legFrontRightTop", "range": -TOP_MOTOR_RANGE},
  },

  "BeneLego2":
  {
    "name"          : "hubFrontLeft",
    "ACCELEROMETER" : {"name": "legFrontLeftTopTilt", "rotation": POSITION_TOP, "offset": {forward: -0.08344213308973626 , height: -15.080626602566387 , sideways: -8.196183317198305 }},
    "A"             : {"name": "legFrontLeftBottom", "range": -BOTTOM_MOTOR_RANGE},
    "B"             : {"name": "legFrontLeftBottomTilt", "rotation": POSITION_DOWN, "offset": POSITION_ZERO},
  },

  "BeneLego3":
  {
    "name"          : "hubFrontRight",
    "ACCELEROMETER" : {"name": "legFrontRightTopTilt", "rotation": POSITION_TOP, "offset": {forward: 11.298255866719538 , height: -31.71790512403232 , sideways: 10.033798832447475 }},
    "A"             : {"name": "legFrontRightBottom", "range": BOTTOM_MOTOR_RANGE},
    "B"             : {"name": "legFrontRightBottomTilt", "rotation": POSITION_DOWN, "offset": POSITION_ZERO},
  },

  "BeneLego1":
  {
    "name"          : "hubBackRight",
    "ACCELEROMETER" : {"name": "legBackRightTopTilt", "rotation": POSITION_TOP, "offset": {forward: 9.14052648462668 , height: -11.399257997403645 , sideways: 6.6247577529308685 }},
    "A"             : {"name": "legBackRightBottom", "range": BOTTOM_MOTOR_RANGE},
    "C"             : {"name": "legBackRightBottomTilt", "rotation": POSITION_UP, "offset": POSITION_ZERO},
  },

  "BeneLego5":
  {
    "name"          : "hubBackLeft",
    "ACCELEROMETER" : {"name": "legBackLeftTopTilt", "rotation": POSITION_TOP, "offset": {forward: -2.4691926825874586 , height: -37.32943122852581 , sideways: -8.373090629947134 }},
    "B"             : {"name": "legBackLeftBottom", "range": -BOTTOM_MOTOR_RANGE},
    "D"             : {"name": "legBackLeftBottomTilt", "rotation": POSITION_UP, "offset": POSITION_ZERO},
  },
}

export const LEG_LENGTH_TOP = 240.0; // length of top part of the leg
export const LEG_LENGTH_BOTTOM = 264.0; // length of bottom part of the leg
export const LEG_SEPARATION_WIDTH = 300.0; // distance between left and right legs
export const LEG_SEPARATION_LENGTH = 385.0; // distance between front and back legs
export const LEG_MOUNT_HEIGHT = 47.0; // distance from top leg rotation axis to bottom of leg mount
export const LEG_MOUNT_WIDTH = 84.0; // distance from middle of leg to mount rotation axis
export const LEG_PISTON_HEIGHT = 101.0; // distance from bottom of leg mount to top of piston
export const LEG_PISTON_WIDTH = 112.0; // distance from bottom of leg mount to bottom of piston
export const LEG_PISTON_LENGTH = 175.0; // length of piston when leg is vertical
export const LEG_FOOT_DIAMETER = 86.0; // diameter of turntable at foot

export const ACCEL_NORM_MAX = 1050.0; // acceleration in mG, values above are ignored
export const ACCEL_NORM_MIN = 950.0; // acceleration in mG, values below are ignored
export const ACCEL_SIDEWAYS_TOLERANCE = 9999999; // maximum difference in sideways tilt angle of legs, measured in radians

export const NO_MOVE_MOTOR_ANGLE = 4; // minimum motor rotation in degree, values below are ignored
export const MOTOR_UPDATE_INTERVAL = 100; // interval in milliseconds for updating motor commands
const TOP_MOTOR_RANGE = 20833; // motor rotation in degree needed for rotation of top leg segment by pi
const TOP_MOTOR_SPEED = 756; // degree per second at 7.5V
const BOTTOM_MOTOR_RANGE = 24300; // motor rotation in degree needed for rotation of bottom leg segment by pi
const BOTTOM_MOTOR_SPEED = 630; // degree per second at 7.5V
const MOUNT_MOTOR_RANGE = 433; // motor rotation in degree needed for one millimeter piston extension
const MOUNT_MOTOR_SPEED = 882; // degree per second at 7.5V
const POSITION_ZERO = {x: 0, y: 0, z: 0};
const POSITION_DOWN = {x: Math.PI/2, y: 0, z: 0};
const POSITION_UP = {x: -Math.PI/2, y: 0, z: 0};
const POSITION_UP_LEFT = {x: 0, y: Math.PI/2, z: -Math.PI/2};
const POSITION_UP_RIGHT = {x: 0, y: -Math.PI/2, z: -Math.PI/2};

export const MOTOR_TYPES = [46, 47, 48, 49, 65, 75, 76]; // list of ids of accepted motor types
export const TILT_TYPES = [34, 57]; // list of ids of accepted accelerometer types

// BeneLego6 "offset": {x: -1.6396414210587527 , y: -20.485073051430724 , z: 6.226506645503237 }
export const MotorMap = {

  "BeneLego6":
  {
    "name"          : "hubBackCenter",
    "A"             : {"name": "legBackLeftMount", "range": MOUNT_MOTOR_RANGE, "speed": MOUNT_MOTOR_SPEED},
    "B"             : {"name": "legBackRightMount", "range": -MOUNT_MOTOR_RANGE, "speed": MOUNT_MOTOR_SPEED},
    "C"             : {"name": "legBackLeftTop", "range": TOP_MOTOR_RANGE, "speed": TOP_MOTOR_SPEED},
    "D"             : {"name": "legBackRightTop", "range": -TOP_MOTOR_RANGE, "speed": TOP_MOTOR_SPEED},
  },

  "BeneLego4":
  {
    "name"          : "hubFrontCenter",
    "ACCELEROMETER" : {"name": "dogTilt", "rotation": POSITION_ZERO, "offset": {x: 19.393014183424288 , y: -27.001327682538353 , z: -9.472666413278418 }},
    "A"             : {"name": "legFrontLeftMount", "range": MOUNT_MOTOR_RANGE, "speed": MOUNT_MOTOR_SPEED},
    "B"             : {"name": "legFrontRightMount", "range": -MOUNT_MOTOR_RANGE, "speed": MOUNT_MOTOR_SPEED},
    "C"             : {"name": "legFrontLeftTop", "range": TOP_MOTOR_RANGE, "speed": TOP_MOTOR_SPEED},
    "D"             : {"name": "legFrontRightTop", "range": -TOP_MOTOR_RANGE, "speed": TOP_MOTOR_SPEED},
  },

  "BeneLego2":
  {
    "name"          : "hubFrontLeft",
    "ACCELEROMETER" : {"name": "legFrontLeftTopTilt", "rotation": POSITION_UP_LEFT, "offset": {x: -0.08344213308973626 , y: -15.080626602566387 , z: -8.196183317198305 }},
    "A"             : {"name": "legFrontLeftBottom", "range": -BOTTOM_MOTOR_RANGE, "speed": BOTTOM_MOTOR_SPEED},
    "B"             : {"name": "legFrontLeftBottomTilt", "rotation": POSITION_DOWN, "offset": POSITION_ZERO},
  },

  "BeneLego3":
  {
    "name"          : "hubFrontRight",
    "ACCELEROMETER" : {"name": "legFrontRightTopTilt", "rotation": POSITION_UP_RIGHT, "offset": {x: 11.298255866719538 , y: -31.71790512403232 , z: 10.033798832447475 }},
    "A"             : {"name": "legFrontRightBottom", "range": BOTTOM_MOTOR_RANGE, "speed": BOTTOM_MOTOR_SPEED},
    "B"             : {"name": "legFrontRightBottomTilt", "rotation": POSITION_DOWN, "offset": POSITION_ZERO},
  },

  "BeneLego1":
  {
    "name"          : "hubBackRight",
    "ACCELEROMETER" : {"name": "legBackRightTopTilt", "rotation": POSITION_UP_RIGHT, "offset": {x: 9.14052648462668 , y: -11.399257997403645 , z: 6.6247577529308685 }},
    "A"             : {"name": "legBackRightBottom", "range": BOTTOM_MOTOR_RANGE, "speed": BOTTOM_MOTOR_SPEED},
    "B"             : {"name": "legBackRightBottomTilt", "rotation": POSITION_UP, "offset": POSITION_ZERO},
  },

  "BeneLego5":
  {
    "name"          : "hubBackLeft",
    "ACCELEROMETER" : {"name": "legBackLeftTopTilt", "rotation": POSITION_UP_LEFT, "offset": {x: -2.4691926825874586 , y: -37.32943122852581 , z: -8.373090629947134 }},
    "A"             : {"name": "legBackLeftBottom", "range": -BOTTOM_MOTOR_RANGE, "speed": BOTTOM_MOTOR_SPEED},
    "B"             : {"name": "legBackLeftBottomTilt", "rotation": POSITION_UP, "offset": POSITION_ZERO},
  },
}

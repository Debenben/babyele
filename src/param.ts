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
const TOP_MOTOR_RANGE = 12272; // motor rotation in degree needed for rotation of top leg segment by pi
const BOTTOM_MOTOR_RANGE = 22486; // motor rotation in degree needed for rotation of bottom leg segment by pi
const MOUNT_MOTOR_RANGE = 433; // motor rotation in degree needed for one millimeter piston extension

export const MotorMap = {
  "BeneLego0": {
    "name"          : "hubBackCenter",
    "A"             : {"name": "legBackLeftMount", "range": MOUNT_MOTOR_RANGE},
    "B"             : {"name": "legBackRightMount", "range": -MOUNT_MOTOR_RANGE},
    "C"             : {"name": "legBackRightTop", "range": TOP_MOTOR_RANGE},
    "D"             : {"name": "legBackLeftTop", "range": -TOP_MOTOR_RANGE},
  },
  "BeneLego4": {
    "name"          : "hubFrontCenter",
    "ACCELEROMETER" : {"name": "dogTilt", "offset": {forward: 19.393014183424288 , height: -27.001327682538353 , sideways: -9.472666413278418 }},
    "A"             : {"name": "legFrontRightTop", "range": TOP_MOTOR_RANGE},
    "C"             : {"name": "legFrontLeftTop", "range": -TOP_MOTOR_RANGE},
    "B"             : {"name": "legFrontLeftMount", "range": MOUNT_MOTOR_RANGE},
    "D"             : {"name": "legFrontRightMount", "range": -MOUNT_MOTOR_RANGE},
  },
  "BeneLego2": {
    "name"          : "hubFrontLeft",
    "ACCELEROMETER" : {"name": "legFrontLeftTopTilt", "offset": {forward:0, height:0, sideways:0}},
    "C"             : {"name": "legFrontLeftBottom", "range": -BOTTOM_MOTOR_RANGE},
    "A"             : {"name": "legFrontLeftBottomTilt", "offset": {forward:0, height:0, sideways:0}},
  },
  "BeneLego3": {
    "name"          : "hubFrontRight",
    "ACCELEROMETER" : {"name": "legFrontRightTopTilt", "offset": {forward:0, height:0, sideways:0}},
    "D"             : {"name": "legFrontRightBottom", "range": BOTTOM_MOTOR_RANGE},
    "B"             : {"name": "legFrontRightBottomTilt", "offset": {forward:0, height:0, sideways:0}},
  },
  "BeneLego1": {
    "name"          : "hubBackRight",
    "ACCELEROMETER" : {"name": "legBackRightTopTilt", "offset": {forward:0, height:0, sideways:0}},
    "C"             : {"name": "legBackRightBottom", "range": BOTTOM_MOTOR_RANGE},
    "D"             : {"name": "legBackRightBottomTilt", "offset": {forward:0, height:0, sideways:0}},
  },
  "BeneLego5": {
    "name"          : "hubBackLeft",
    "ACCELEROMETER" : {"name": "legBackLeftTopTilt", "offset": {forward:0, height:0, sideways:0}},
    "D"             : {"name": "legBackLeftBottom", "range": -BOTTOM_MOTOR_RANGE},
    "C"             : {"name": "legBackLeftBottomTilt", "offset": {forward:0, height:0, sideways:0}},
  },
}


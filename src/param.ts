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

export const TOP_MOTOR_RANGE = 20833; // motor rotation in degree needed for rotation of top leg segment by pi
export const TOP_MOTOR_MAX_SPEED = 756; // degree per second at 7.5V
export const BOTTOM_MOTOR_RANGE = 24300; // motor rotation in degree needed for rotation of bottom leg segment by pi
export const BOTTOM_MOTOR_MAX_SPEED = 630; // degree per second at 7.5V
export const MOUNT_MOTOR_RANGE = 433; // motor rotation in degree needed for one millimeter piston extension
export const MOUNT_MOTOR_MAX_SPEED = 882; // degree per second at 7.5V

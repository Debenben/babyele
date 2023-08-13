import { Vector3 } from 'babylonjs';
export { Vector3 } from 'babylonjs';
// x: forward
// y: height
// z: sideways
export { Quaternion } from 'babylonjs';

export const legNames = ['legFrontRight', 'legFrontLeft', 'legBackRight', 'legBackLeft'] as const
export type LegName = typeof legNames[number];

export const jointNames = [...legNames.map(e => e+'Shoulder'), ...legNames.map(e => e+'Knee'), ...legNames.map(e => e+'Foot')] as const

export const motorNames = ['top', 'bottom', 'mount'] as const
export type MotorName = typeof motorNames[number];

export type MotorVec = Record <MotorName, number>;

export type Pose = Record <LegName, MotorVec>

export type LegPositions = Record <LegName, Vector3>

export type Move = string[]

export const reservedNames = ["OFFLINE", "MANUAL", "STOP", "BUTTON", "SYNC"] as const

export const pad = (str: string, size: number) => {
  const s = "          " + str;
  return s.substr(s.length - size);
}
export const printPosition = (pos: Vector3) => {
  return pad(pos.x.toFixed(0), 5) + pad(pos.y.toFixed(0), 5) + pad(pos.z.toFixed(0), 5);
}

export const printDegree = (rad: number) => {
  return pad((180*rad/Math.PI).toFixed(2), 8) + "°";
}

export const cosLaw = (rSide: number, lSide: number, angle: number) => {
  // returns the side length opposite of the angle in a triangle with rSide and lSide side lengths adjacent to the angle
  return Math.sqrt(Math.abs(rSide**2 + lSide**2 - 2*rSide*lSide*Math.cos(angle)));
}

export const invCosLaw = (rSide: number, lSide: number, oSide: number) => {
  // returns angle in a triangle with rSide and lSide adjacent side lengths and oSide the side length opposite of the angle
  const cosVal = (rSide**2 + lSide**2 - oSide**2)/(2*rSide*lSide);
  return Math.acos(cosVal > 1.0 ? 1.0 : (cosVal < -1.0 ? -1.0 : cosVal));
}


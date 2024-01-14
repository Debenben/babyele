export { Vector3 } from 'babylonjs';
// x: forward
// y: height
// z: sideways
export { Quaternion } from 'babylonjs';

export const hubNames = ['hubFrontLeft', 'hubFrontRight', 'hubBackLeft', 'hubBackRight', 'hubFrontCenter', 'hubBackCenter'] as const
export type HubName = typeof hubNames[number];

export const legNames = ['legFrontLeft', 'legFrontRight', 'legBackLeft', 'legBackRight'] as const
export type LegName = typeof legNames[number];

export const jointNames = [...legNames.map(e => e+'Shoulder'), ...legNames.map(e => e+'Knee'), ...legNames.map(e => e+'Foot')] as const
export type JointName = typeof jointNames[number];

export const motorNames = [].concat(...legNames.map(e => [e+'Mount', e+'Top', e+'Bottom']))// as const
export type MotorName = typeof motorNames[number];

export type Move = string[];

export type Vec3 = [number, number, number];

export type Vec43 = [Vec3, Vec3, Vec3, Vec3];

export const reservedNames = ["OFFLINE", "MANUAL", "STOP", "BUTTON", "SYNC"] as const


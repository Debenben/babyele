export const legNames = ['legFrontRight', 'legFrontLeft', 'legBackRight', 'legBackLeft'] as const
export type LegName = typeof legNames[number];

export const motorNames = ['top', 'bottom', 'mount'] as const
export type MotorName = typeof motorNames[number];

export type Pose = Record <LegName, Record<MotorName, number>>

export type Move = string[]

export type Position = {
  forward: number
  height: number
  sideways: number
}

export const reservedNames = ["OFFLINE", "WAITING", "MANUAL", "BUTTON"] as const

export const toArray = (position: Position) => {
  if(position) {
    return [position.forward, position.height, position.sideways];
  }
  return null;
}

export const toDegree = (rad: Position) => {
  return {forward: 180*rad.forward/Math.PI, height: 180*rad.height/Math.PI, sideways: 180*rad.sideways/Math.PI};
}

export const pad = (str: string, size: number) => {
  const s = "          " + str;
  return s.substr(s.length - size);
}
export const printPosition = (pos: Position) => {
  return pad(pos.forward.toFixed(0), 5) + pad(pos.height.toFixed(0), 5) + pad(pos.sideways.toFixed(0), 5);
}

export const printDegree = (rad: number) => {
  return pad((180*rad/Math.PI).toFixed(2), 8) + "°";
}

export const fromArray = (array: number[]) => {
  return {forward:array[0], height:array[1], sideways:array[2]};
}

export const parsePosition = (directionName: string, value: number) => {
  if(!value) return null;
  else if(directionName.endsWith("Forward")) return {forward:value, height:0, sideways:0};
  else if(directionName.endsWith("Height")) return {forward:0, height:value, sideways:0};
  else if(directionName.endsWith("Sideways")) return {forward:0, height:0, sideways:value};
  return null;
}

export const add = (pos1: Position, pos2: Position) => {
  if(pos1 && pos2) {
    return {forward: pos1.forward + pos2.forward, height: pos1.height + pos2.height, sideways: pos1.sideways + pos2.sideways};
  }
  return null;
}

export const multiply = (factor: number, pos: Position) => {
  if(pos) {
    return {forward: pos.forward*factor, height: pos.height*factor, sideways: pos.sideways*factor};
  }
  return null;
}

export const norm = (pos: Position) => {
  return Math.sqrt(pos.forward**2 + pos.height**2 + pos.sideways**2);
}

export const getTilt = (accel: Position) => {
  return {forward: Math.atan2(accel.sideways, accel.height), height: 0, sideways: Math.atan2(-accel.forward, Math.sqrt(accel.height**2 + accel.sideways**2))};
}

export const getRotation = (absolute: Position) => {
  return {forward:-Math.atan2(absolute.sideways, absolute.height), height:-Math.atan2(absolute.forward, absolute.sideways), sideways:Math.atan2(absolute.forward, absolute.height)};
}

export const rotate = (position: Position, angles: Position) => {
  // rotation in Taid-Bryan convention, first forward, then height, then siedeways
  const forward = Math.cos(angles.height)*Math.cos(angles.sideways)*position.forward + Math.cos(angles.height)*Math.sin(angles.sideways)*position.height - Math.sin(angles.height)*position.sideways;
  const height = (Math.sin(angles.forward)*Math.sin(angles.height)*Math.cos(angles.sideways) - Math.cos(angles.forward)*Math.sin(angles.sideways))*position.forward + (Math.sin(angles.forward)*Math.sin(angles.height)*Math.sin(angles.sideways) + Math.cos(angles.forward)*Math.cos(angles.sideways))*position.height + Math.sin(angles.forward)*Math.cos(angles.height)*position.sideways;
  const sideways = (Math.cos(angles.forward)*Math.sin(angles.height)*Math.cos(angles.sideways) + Math.sin(angles.forward)*Math.sin(angles.sideways))*position.forward + (Math.cos(angles.forward)*Math.sin(angles.height)*Math.sin(angles.sideways) - Math.sin(angles.forward)*Math.cos(angles.sideways))*position.height + Math.cos(angles.forward)*Math.cos(angles.height)*position.sideways;
  return {forward, height, sideways};
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


export type LegName = 'legFrontRight' | 'legFrontLeft' | 'legBackRight' | 'legBackLeft'

export type MotorName = 'Top'|'Bottom'|'Mount'

export type Position = {
  forward: number
  height: number
  sideways: number
}

export const toArray = (position: Position) => {
  if(position) {
    return [position.forward, position.height, position.sideways];
  }
  return null;
}

export const fromArray = (array: number[]) => {
  return {forward:array[0], height:array[1], sideways:array[2]};
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

export const cosLaw = (rSide: number, lSide: number, angle: number) => {
  // returns the side length opposite of the angle in a triangle with rSide and lSide side lengths adjacent to the angle
  return Math.sqrt(Math.abs(rSide**2 + lSide**2 - 2*rSide*lSide*Math.cos(angle)));
}

export const invCosLaw = (rSide: number, lSide: number, oSide: number) => {
  // returns angle in a triangle with rSide and lSide adjacent side lengths and oSide the side length opposite of the angle
  const cosVal = (rSide**2 + lSide**2 - oSide**2)/(2*rSide*lSide);
  return Math.acos(cosVal > 1.0 ? 1.0 : (cosVal < -1.0 ? -1.0 : cosVal));  
}

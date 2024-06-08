import { LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_MOUNT_HEIGHT, LEG_MOUNT_WIDTH, LEG_SEPARATION_LENGTH, LEG_SEPARATION_WIDTH, LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH, MOUNT_MOTOR_RANGE, TOP_MOTOR_RANGE, BOTTOM_MOTOR_RANGE, MOUNT_MOTOR_MAX_SPEED, TOP_MOTOR_MAX_SPEED, BOTTOM_MOTOR_MAX_SPEED } from "./param";
import { Vec43, Vec3, Vector3, Quaternion } from "./tools";

const cosLaw = (rSide: number, lSide: number, angle: number) => {
  // returns the side length opposite of the angle in a triangle with rSide and lSide side lengths adjacent to the angle
  return Math.sqrt(Math.abs(rSide**2 + lSide**2 - 2*rSide*lSide*Math.cos(angle)));
}

const invCosLaw = (rSide: number, lSide: number, oSide: number) => {
  // returns angle in a triangle with rSide and lSide adjacent side lengths and oSide the side length opposite of the angle
  const cosVal = (rSide**2 + lSide**2 - oSide**2)/(2*rSide*lSide);
  return Math.acos(cosVal > 1.0 ? 1.0 : (cosVal < -1.0 ? -1.0 : cosVal));
}

const defaultLegPositions = [[ LEG_SEPARATION_LENGTH/2, 0,  LEG_SEPARATION_WIDTH/2],
                             [ LEG_SEPARATION_LENGTH/2, 0, -LEG_SEPARATION_WIDTH/2],
                             [-LEG_SEPARATION_LENGTH/2, 0,  LEG_SEPARATION_WIDTH/2],
                             [-LEG_SEPARATION_LENGTH/2, 0, -LEG_SEPARATION_WIDTH/2]];

const motorMaxSpeeds = new Array(4).fill([MOUNT_MOTOR_MAX_SPEED, TOP_MOTOR_MAX_SPEED, BOTTOM_MOTOR_MAX_SPEED]);

const mountAngleOffset = invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH);

export const legAnglesFromMotorAngles = (motorAngles: Vec43): Vec43 => {
  for(let i = 0; i < 4; i++) {
    const pistonLength = LEG_PISTON_LENGTH + motorAngles[i][0]/MOUNT_MOTOR_RANGE;
    motorAngles[i][0] = invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, pistonLength) - mountAngleOffset;
    motorAngles[i][1] *= Math.PI/TOP_MOTOR_RANGE;
    motorAngles[i][2] *= Math.PI/BOTTOM_MOTOR_RANGE;
  }
  return motorAngles;
};

export const motorAnglesFromLegAngles = (legAngles: Vec43): Vec43 => {
  for(let i = 0; i < 4; i++) {
    const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, legAngles[i][0] + mountAngleOffset);
    legAngles[i][0] = (pistonLength - LEG_PISTON_LENGTH)*MOUNT_MOTOR_RANGE;
    legAngles[i][1] *= TOP_MOTOR_RANGE/Math.PI;
    legAngles[i][2] *= BOTTOM_MOTOR_RANGE/Math.PI;
  }
  return legAngles;
}

export const legPositionsFromMotorAngles = (motorAngles: Vec43): Vec43 => {
  const vec = legAnglesFromMotorAngles(motorAngles);
  for(let i = 0; i < 4; i++) {
    const tAngle = vec[i][1];
    const bAngle = vec[i][2] + tAngle;
    const forward = (LEG_LENGTH_TOP*Math.sin(tAngle) + LEG_LENGTH_BOTTOM*Math.sin(bAngle));
    const mHeight = LEG_LENGTH_TOP*Math.cos(tAngle) + LEG_LENGTH_BOTTOM*Math.cos(bAngle) - LEG_MOUNT_HEIGHT;
    const mAngle = vec[i][0] + Math.atan2(LEG_MOUNT_WIDTH, mHeight);
    const mLength = Math.sqrt(Math.abs(mHeight**2 + LEG_MOUNT_WIDTH**2));
    const height = -mLength*Math.cos(mAngle);
    const sideways = mLength*Math.sin(mAngle) - LEG_MOUNT_WIDTH;
    vec[i] = [forward, height, sideways];
  }
  vec[0][0] *= -1;
  vec[1][2] *= -1;
  vec[2][0] *= -1;
  vec[3][2] *= -1;
  for(let i = 0; i < 4; i++) {
    for(let j = 0; j < 3; j++) {
      vec[i][j] += defaultLegPositions[i][j];
    }
  }
  return vec
};

export const motorAnglesFromLegPositions = (positions: Vec43, bendForward: boolean[]): Vec43 => {
  for(let i = 0; i < 4; i++) {
    for(let j = 0; j < 3; j++) {
      positions[i][j] -= defaultLegPositions[i][j];
    }
  }
  positions[0][0] *= -1;
  positions[1][2] *= -1;
  positions[2][0] *= -1;
  positions[3][2] *= -1;
  for(let i = 0; i < 4; i++) {
    const mAngle = Math.atan2(positions[i][2] + LEG_MOUNT_WIDTH, -positions[i][1]);
    const mLength = -positions[i][1]/Math.cos(mAngle);
    const mHeight = Math.sqrt(Math.abs(mLength**2 - LEG_MOUNT_WIDTH**2));
    const mountAngle = mAngle - Math.atan2(LEG_MOUNT_WIDTH, mHeight);
    const tbHeight = mHeight + LEG_MOUNT_HEIGHT;
    const tbLength = Math.sqrt(tbHeight**2 + positions[i][0]**2);
    const phi = Math.atan2(positions[i][0], tbHeight);
    const alpha = invCosLaw(tbLength, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM);
    let topAngle = phi + alpha;
    let bottomAngle = Math.acos((LEG_LENGTH_TOP/LEG_LENGTH_BOTTOM)*Math.cos(Math.PI/2 - alpha)) - alpha - Math.PI/2;
    if(bendForward[i]) {
      topAngle = phi - alpha;
      bottomAngle *= -1;
    }
    positions[i] = [mountAngle, topAngle, bottomAngle];
  }
  return motorAnglesFromLegAngles(positions);
};

export const dogPositionFromMotorAngles = (motorAngles: Vec43): Vec3 => {
  const legPositions = legPositionsFromMotorAngles(motorAngles);
  const dogPosition = [0, 0, 0];
  for(let i = 0; i < 4; i++) {
    for(let j = 0; j < 3; j++) dogPosition[j] += 0.25*legPositions[i][j];
  }
  return dogPosition as Vec3;
};

export const dogRotationFromMotorAngles = (motorAngles: Vec43): Quaternion => {
  const legPositions = legPositionsFromMotorAngles(JSON.parse(JSON.stringify(motorAngles)));
  const dogPosition = dogPositionFromMotorAngles(motorAngles);
  const averageRotation = Quaternion.Zero();
  for(let i = 0; i < 4; i++) {
    const relativePosition = Vector3.FromArray(legPositions[i].map((e, j) => e  - dogPosition[j])).normalize();
    const legRotation = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(relativePosition, Vector3.FromArray(defaultLegPositions[i]).normalize(), legRotation);
    legRotation.scaleAndAddToRef(0.25, averageRotation);
  }
  return averageRotation;
};

export const durationsFromMotorAngles = (startMotorAngles: Vec43, endMotorAngles: Vec43): Vec43 => {
  const durations = endMotorAngles;
  for(let i = 0; i < 4; i++) {
    for(let j = 0; j < 3; j++) {
      durations[i][j] -= startMotorAngles[i][j];
      durations[i][j] /= motorMaxSpeeds[i][j];
    }
  }
  return durations;
}

export const dogRotationFromAcceleration = (acceleration: Vec3): Vec3 => {
  const zangle = Math.atan2(acceleration[0], acceleration[1]);
  const xangle = -Math.atan2(acceleration[2], Math.sqrt(acceleration[1]**2 + acceleration[0]**2));
  return [xangle, 0, zangle];
}

export const legAnglesFromAcceleration = (dogAcceleration: Vec3, topAcceleration: Vec43, bottomAcceleration: Vec43): Vec43 => {
  const legAngles = [];
  const x = dogAcceleration[0];
  const y = dogAcceleration[1];
  const z = dogAcceleration[2];
  const ref = [[-y, z, -x], [-y, -z, x], [-y, z, -x], [-y, -z, x]] as Vec43;
  for(let i = 0; i < 4; i++) {
    const r = ref[i];
    const t = topAcceleration[i];
    const b = bottomAcceleration[i];
    const mountAngle = Math.atan2(t[1], Math.sqrt(t[0]**2 + t[2]**2)) - Math.atan2(r[1], Math.sqrt(r[0]**2 + r[2]**2)); 
    const topAngle = -Math.atan2(t[2], t[0]) + Math.atan2(r[2], r[0]);
    const bottomAngle = -Math.atan2(b[2], b[0]) + Math.atan2(t[2], t[0]);
    legAngles.push([mountAngle, topAngle, bottomAngle]);
  }
  return legAngles as Vec43;
}

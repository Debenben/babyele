import { LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_MOUNT_HEIGHT, LEG_MOUNT_WIDTH, LEG_SEPARATION_LENGTH, LEG_SEPARATION_WIDTH, LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH, MOUNT_MOTOR_RANGE, TOP_MOTOR_RANGE, BOTTOM_MOTOR_RANGE, MOUNT_MOTOR_MAX_SPEED, TOP_MOTOR_MAX_SPEED, BOTTOM_MOTOR_MAX_SPEED, LEG_TOP_HUB_ANGLE } from "./param";
import { Vec43, Vec3, Vec4, vec43Copy, vec43Sum, vec3Len, vec43Sub, vec3Rotate, vec43Centroid, vec3Outer, vec3Sub, vec4Normalize, mat3T, mat3Mul, mat3Det, svd3x3 } from "./tools";

const cosLaw = (rSide: number, lSide: number, angle: number) => {
  // returns the side length opposite of the angle in a triangle with rSide and lSide side lengths adjacent to the angle
  return Math.sqrt(Math.abs(rSide**2 + lSide**2 - 2*rSide*lSide*Math.cos(angle)));
}

const invCosLaw = (rSide: number, lSide: number, oSide: number) => {
  // returns angle in a triangle with rSide and lSide adjacent side lengths and oSide the side length opposite of the angle
  const cosVal = (rSide**2 + lSide**2 - oSide**2)/(2*rSide*lSide);
  return Math.acos(cosVal > 1.0 ? 1.0 : (cosVal < -1.0 ? -1.0 : cosVal));
}

const defaultLegPositions = [[ 0.5*LEG_SEPARATION_LENGTH, -LEG_MOUNT_HEIGHT,  (0.5*LEG_SEPARATION_WIDTH - LEG_MOUNT_WIDTH)],
                             [ 0.5*LEG_SEPARATION_LENGTH, -LEG_MOUNT_HEIGHT, -(0.5*LEG_SEPARATION_WIDTH - LEG_MOUNT_WIDTH)],
                             [-0.5*LEG_SEPARATION_LENGTH, -LEG_MOUNT_HEIGHT,  (0.5*LEG_SEPARATION_WIDTH - LEG_MOUNT_WIDTH)],
                             [-0.5*LEG_SEPARATION_LENGTH, -LEG_MOUNT_HEIGHT, -(0.5*LEG_SEPARATION_WIDTH - LEG_MOUNT_WIDTH)]] as Vec43;

const motorMaxSpeeds = new Array(4).fill([MOUNT_MOTOR_MAX_SPEED, TOP_MOTOR_MAX_SPEED, BOTTOM_MOTOR_MAX_SPEED]);

const mountAngleOffset = invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH);

export const quatFromAxisAngle = (axis: Vec3, angle: number): Vec4 => {
  if(vec3Len(axis) > 0) {
    const s = Math.sin(0.5*angle) / vec3Len(axis);
    return [s*axis[0], s*axis[1], s*axis[2], Math.cos(0.5*angle)] as Vec4;
  }
  else return [0, 0, 0, 1] as Vec4;
}

export const legAnglesFromMotorAngles = (motorAngles: Vec43): Vec43 => {
  for(let i = 0; i < 4; i++) {
    const pistonLength = LEG_PISTON_LENGTH + motorAngles[i][0]/MOUNT_MOTOR_RANGE;
    motorAngles[i][0] = invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, pistonLength) - mountAngleOffset;
    motorAngles[i][1] *= Math.PI/TOP_MOTOR_RANGE;
    motorAngles[i][2] *= Math.PI/BOTTOM_MOTOR_RANGE;
  }
  return motorAngles;
}

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
    const sideways = mLength*Math.sin(mAngle);
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
}

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
    const mAngle = Math.atan2(positions[i][2], -positions[i][1]);
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
}

export const dogPositionFromMotorAngles = (motorAngles: Vec43): Vec3 => {
  const averagePosition = vec43Sum(legPositionsFromMotorAngles(vec43Copy(motorAngles)));
  return vec3Rotate(averagePosition, dogRotationFromMotorAngles(motorAngles));
}

export const quatFromRotationMatrix = (m: number[][]): Vec4 => {
  const trace = m[0][0] + m[1][1] + m[2][2];
  let q: [number,number,number,number];
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    const w = 0.25 * s;
    const x = (m[2][1] - m[1][2]) / s;
    const y = (m[0][2] - m[2][0]) / s;
    const z = (m[1][0] - m[0][1]) / s;
    q = [x,y,z,w];
  } else {
    if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
      const s = Math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2;
      const x = 0.25 * s;
      const y = (m[0][1] + m[1][0]) / s;
      const z = (m[0][2] + m[2][0]) / s;
      const w = (m[2][1] - m[1][2]) / s;
      q = [x,y,z,w];
    } else if (m[1][1] > m[2][2]) {
      const s = Math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2;
      const x = (m[0][1] + m[1][0]) / s;
      const y = 0.25 * s;
      const z = (m[1][2] + m[2][1]) / s;
      const w = (m[0][2] - m[2][0]) / s;
      q = [x,y,z,w];
    } else {
      const s = Math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2;
      const x = (m[0][2] + m[2][0]) / s;
      const y = (m[1][2] + m[2][1]) / s;
      const z = 0.25 * s;
      const w = (m[1][0] - m[0][1]) / s;
      q = [x,y,z,w];
    }
  }
  return q;
}

export const dogRotationFromMotorAngles = (motorAngles: Vec43): Vec4 => {
  const A = legPositionsFromMotorAngles(motorAngles);
  const B = defaultLegPositions;
  const centroidA = vec43Centroid(A);
  const centroidB = vec43Centroid(B);
  const AA = A.map(v => vec3Sub(v, centroidA));
  const BB = B.map(v => vec3Sub(v, centroidB));
  let H = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 4; i++) {
    const outer = vec3Outer(AA[i], BB[i]);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        H[r][c] += outer[r][c];
  }
  const { U, V } = svd3x3(H);
  let R = mat3Mul(V, mat3T(U));
  if (mat3Det(R) < 0) {
    V[0][2] *= -1;
    V[1][2] *= -1;
    V[2][2] *= -1;
    R = mat3Mul(V, mat3T(U));
  }
  const q = quatFromRotationMatrix(R);
  return vec4Normalize(q);
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

export const permilleOfMaxSpeed = (motorSpeeds: Vec43): Vec43 => {
  return motorSpeeds.map((v,i) => v.map((e,j) => e*1000/motorMaxSpeeds[i][j]));
}

export const motorAnglesTimeEvolution = (startMotorAngles: Vec43, timestamps: Vec43, speed: Vec43): Vec43 => {
  for(let i = 0; i < 4; i++) {
    for(let j = 0; j < 3; j++) {
      const timediff = Date.now() - timestamps[i][j];
      if(timediff > 0 && timediff < 2000) startMotorAngles[i][j] += speed[i][j]*timediff/motorMaxSpeeds[i][j];
    }
  }
  return startMotorAngles;
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
  const sign = [-1, 1, -1, 1]; // direction of default hub tilt angle
  for(let i = 0; i < 4; i++) {
    const r = ref[i];
    const t = vec3Rotate(topAcceleration[i], [0, sign[i]*Math.sin(0.5*LEG_TOP_HUB_ANGLE), 0, Math.cos(0.5*LEG_TOP_HUB_ANGLE)]);
    const b = bottomAcceleration[i];
    const mountAngle = Math.atan2(t[1], Math.sqrt(t[0]**2 + t[2]**2)) - Math.atan2(r[1], Math.sqrt(r[0]**2 + r[2]**2)); 
    const topAngle = -Math.atan2(t[2], t[0]) + Math.atan2(r[2], r[0]);
    const bottomAngle = -Math.atan2(b[2], b[0]) + Math.atan2(t[2], t[0]);
    legAngles.push([mountAngle, topAngle, bottomAngle]);
  }
  // map angles to range -PI .. +PI
  return legAngles.map(v => v.map(e => e > Math.PI ? e - 2*Math.PI : e < -Math.PI ? e + 2*Math.PI : e)) as Vec43;
}

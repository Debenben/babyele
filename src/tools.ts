export const hubNames = ['hubFrontLeft', 'hubFrontRight', 'hubBackLeft', 'hubBackRight', 'hubFrontCenter', 'hubBackCenter'] as const
export type HubName = typeof hubNames[number];

export const legNames = ['legFrontLeft', 'legFrontRight', 'legBackLeft', 'legBackRight'] as const
export type LegName = typeof legNames[number];

export const jointNames = [...legNames.map(e => e+'Shoulder'), ...legNames.map(e => e+'Knee'), ...legNames.map(e => e+'Foot')] as const
export type JointName = typeof jointNames[number];

export const motorNames = [].concat(...legNames.map(e => [e+'Mount', e+'Top', e+'Bottom']))// as const
export type MotorName = typeof motorNames[number];

export type Move = string[];

// forward, up, left
export type Vec3 = [number, number, number];

// x, y, z, w
export type Vec4 = [number, number, number, number];

// front-left, front-right, back-left, back-right
export type Vec43 = [Vec3, Vec3, Vec3, Vec3];

export const reservedNames = ["OFFLINE", "MANUAL", "STOP", "BUTTON", "SYNC"] as const


export const compareArrays = (a: any[], b: any[]) => a.length === b.length && a.every((element, index) => element === b[index]);

export const vec3IsZero = (vec: Vec3) => compareArrays(vec, [0,0,0]);

export const vec43IsZero = (vec: Vec43) => vec.every(e => vec3IsZero(e));

export const vec3AbsMax = (vec: Vec3) => Math.max.apply(null, vec.map(e => Math.abs(e)));

export const vec43AbsMax = (vec: Vec43) => Math.max.apply(null, vec.map(e => Math.max.apply(null, e.map(f => Math.abs(f)))));

export const vec3Copy = (vec: Vec3) => vec.slice(0) as Vec3;

export const vec43Copy = (vec: Vec43) => [vec[0].slice(0), vec[1].slice(0), vec[2].slice(0), vec[3].slice(0)] as Vec43;

export const vec43Sum = (vec: Vec43) => vec.reduce((s, v) => [s[0] + 0.25*v[0], s[1] + 0.25*v[1], + s[2] + 0.25*v[2]], [0, 0, 0]) as Vec3;

export const vec3Len = (vec: Vec3) => Math.sqrt(vec[0]**2 + vec[1]**2 + vec[2]**2);

export const vec3Normalize = (vec: Vec3) => {
  const l = vec3Len(vec);
  if(l > 0) return [vec[0]/l, vec[1]/l, vec[2]/l] as Vec3;
  else return vec;
}

export const vec3Sub = (l: Vec3, r: Vec3) => [l[0] - r[0], l[1] - r[1], l[2] - r[2]] as Vec3;

export const vec43Sub = (l: Vec43, r: Vec3) => [vec3Sub(l[0], r), vec3Sub(l[1], r), vec3Sub(l[2], r), vec3Sub(l[3], r)] as Vec43;

export const vec3Dot = (l: Vec3, r: Vec3) => l[0]*r[0] + l[1]*r[1] + l[2]*r[2];

export const vec3Cross = (l: Vec3, r: Vec3) => [l[1]*r[2] - l[2]*r[1], l[2]*r[0] - l[0]*r[2], l[0]*r[1] - l[1]*r[0]] as Vec3;

// project v onto plain perpendicular to a
export const vec3Proj = (v: Vec3, a: Vec3) => {
  const s = vec3Dot(v, a);
  if(s != 0) return [v[0] - s*a[0], v[1] - s*a[1], v[2] - s*a[2]] as Vec3;
  else return [0, 0, 0] as Vec3;
}

export const vec3Rotate = (v: Vec3, q: Vec4) => {
  const vx = v[0];
  const vy = v[1];
  const vz = v[2];
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  // t = 2q x v
  const tx = 2*(qy*vz - qz*vy);
  const ty = 2*(qz*vx - qx*vz);
  const tz = 2*(qx*vy - qy*vx);
  // v + w t + q x t
  return [vx + qw*tx + qy*tz - qz*ty,
          vy + qw*ty + qz*tx - qx*tz,
          vz + qw*tz + qx*ty - qy*tx] as Vec3;
}

export const vec4Cross = (l: Vec4, r: Vec4) => [
  l[3]*r[0] + l[0]*r[3] + l[1]*r[2] - l[2]*r[1],
  l[3]*r[1] - l[0]*r[2] + l[1]*r[3] + l[2]*r[0], 
  l[3]*r[2] + l[0]*r[1] - l[1]*r[0] + l[2]*r[3], 
  l[3]*r[3] - l[0]*r[0] - l[1]*r[1] - l[2]*r[2]] as Vec4;

export const vec4Len = (vec: Vec4) => Math.sqrt(vec[0]**2 + vec[1]**2 + vec[2]**2 + vec[3]**2);

export const vec4Normalize = (vec: Vec4) => {
  const l = vec4Len(vec);
  if(l > 0) return [vec[0]/l, vec[1]/l, vec[2]/l, vec[3]/l] as Vec4;
  else return vec;
}


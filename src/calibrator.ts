import { HubAbstraction } from "./interfaces";
import { Matrix, solve } from 'ml-matrix';

const numSamples = 50; // number of samples in each direction
const ignoreBelow = 900; // minimum absolute value for acceleration in main direction
const directions = ['+x', '-x', '+y', '-y', '+z', '-z'];

export class Calibrator {
  async calibrate(hub: HubAbstraction) {
    await hub.connect();
    const sensor = hub.getDeviceAtPort("ACCELEROMETER");
    console.log("Calibrating", hub.name, "firmware", hub.firmwareVersion);

    const vals = [];
    let dir = null;

    sensor.on("accel", (a) => {

      if(!dir) {
        const m = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z));
	if(m < ignoreBelow) {
          console.log("please put the hub in a stable position with one side facing up");
	  return;
	}
	else if(m ===  a.x) dir = '+x';
	else if(m === -a.x) dir = '-x';
	else if(m ===  a.y) dir = '+y';
	else if(m === -a.y) dir = '-y';
	else if(m ===  a.z) dir = '+z';
	else if(m === -a.z) dir = '-z';
      }

      if(!vals[dir]) {
	vals[dir] = [a];
        console.log(a);
	return;
      }

      if(vals[dir].length < numSamples) {
	const l = vals[dir].reduce((s,c) => {return { x: Math.min(s.x, c.x), y: Math.min(s.y, c.y), z: Math.min(s.z, c.z) }});
	const u = vals[dir].reduce((s,c) => {return { x: Math.max(s.x, c.x), y: Math.max(s.y, c.y), z: Math.max(s.z, c.z) }});
	if((l.x + 1) < a.x || (a.x + 1) < u.x || (l.y + 1) < a.y || (a.y + 1) < u.y || (l.z + 1) < a.z || (a.z + 1) < u.z) {
          console.log("please put the hub in a stable position with one side facing up");
	  vals[dir] = null
	  dir = null
	  return;
	}
        vals[dir].push(a);
        console.log(a);
      }

      else if(directions.every(d => vals[d])) {
	console.log("all directions finished");
	sensor.removeAllListeners("accel");
	for(const d of directions) {
	  vals[d] = vals[d].reduce((s,c) => {return { x: s.x + c.x, y: s.y + c.y, z: s.z + c.z }});
	  vals[d] = [vals[d].x, vals[d].y, vals[d].z].map(e => e/numSamples);
	}
	const As = []
	const Bs = []
	for(const d1 of directions) {
	  for(const d2 of directions) {
            if(d1 === d2) continue;
	    As.push([2*(vals[d1][0] - vals[d2][0]), 2*(vals[d1][1] - vals[d2][1]), 2*(vals[d1][2] - vals[d2][2])]);
	    Bs.push(vals[d1][0]**2 - vals[d2][0]**2 + vals[d1][1]**2 - vals[d2][1]**2 + vals[d1][2]**2 - vals[d2][2]**2);
	  }
	}
	const A = new Matrix(As);
	const B = Matrix.columnVector(Bs);
	    
	const result = solve(A, B);
	console.log("result for hub", hub.name);
	console.log('"offset": {forward:', -result.get(0,0), ', height:', -result.get(2,0), ', sideways:', -result.get(1,0), '}');
	return;
      }

      else {
	console.log("direction", dir, "finished; please turn the hub to a different side");
        dir = null;
      }

    });
  }
}


import { BrowserWindow, ipcMain } from "electron";
import { MotorAbstraction } from "./interfaces";
import { LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM, LEG_MOUNT_HEIGHT, LEG_MOUNT_WIDTH, LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, LEG_PISTON_LENGTH } from "./param";

export class Leg {
  legName: string
  mainWindow: BrowserWindow
  motors: Record<string, MotorAbstraction> = {}
  motorRanges: Record<string, number> = {}
  motorAngles: Record<string, number> = {}
  destMotorAngles: Record<string, number> = {}
  bendForward: boolean = true
  noMoveMotorAngle: number = 3

  constructor(legName, mainWindow, topMotorRange, bottomMotorRange, mountMotorRange) {
  //motorRange for top and bottom motor = rotation in degree needed for pi forward rotation of segment
  //motorRange for mount motor = rotation in degree needed for one millimeter piston extension
    this.legName = legName;
    this.mainWindow = mainWindow;
    this.motorRanges["Top"] = topMotorRange;
    this.motorRanges["Bottom"] = bottomMotorRange;
    this.motorRanges["Mount"] = mountMotorRange;
  }

  async addMotor(legMotorName: string, motor: MotorAbstraction) {
    if(!legMotorName.startsWith(this.legName)) {
      return true;
    }
    const motorName = legMotorName.replace(this.legName, "");
    if(!motor) {
      this.mainWindow.webContents.send("notifyState", legMotorName, "offline");
      ipcMain.removeAllListeners(legMotorName);
      this.motors[motorName] = null;
      return false;
    }
    if(this.motors[motorName]) {
      return true;
    }
    this.motors[motorName] = motor;
    this.motorAngles[motorName] = 0;
    this.destMotorAngles[motorName] = 0;
    if(motor) {
      motor.setBrakingStyle(127); //Consts.BrakingStyle.BRAKE
      motor.setAccelerationTime(200);
      motor.setDecelerationTime(200);
      await this.requestRotation(motorName, 0);
      await motor.resetZero();
      ipcMain.on(legMotorName, (event, arg1, arg2) => {
        switch(arg1) {
          case "requestPower":
            motor.setPower(arg2);
            if(arg2 === 0) {
              this.destMotorAngles[motorName] = this.motorAngles[motorName];
            }
            break;
          case "requestRotation":
            return this.requestRotation(motorName, arg2);
          case "requestReset":
            return motor.resetZero();
        }
      });
      motor.on('rotate', ({degrees}) => {
        this.motorAngles[motorName] = degrees;
        this.mainWindow.webContents.send('notifyLegRotation', legMotorName, this.getAngle(motorName));
      });
      this.mainWindow.webContents.send("notifyState", legMotorName, "online");
      return true;
    }
  }

  motorLoop() {
    var motorNames = ['Top', 'Bottom', 'Mount'];
    motorNames = motorNames.filter(n => this.motors[n] && Math.abs(this.destMotorAngles[n] - this.motorAngles[n]) > this.noMoveMotorAngle);
    var diffMotorAngles = motorNames.map(n => (this.destMotorAngles[n] - this.motorAngles[n]));
    var motorSpeeds = diffMotorAngles.map(diff => (10*Math.sign(diff) + 90*diff/Math.max.apply(null, diffMotorAngles.map(Math.abs))));
    var promises = motorNames.map((n,i) => this.motors[n].rotateByDegrees(Math.abs(diffMotorAngles[i]), motorSpeeds[i]));
    return Promise.all(promises);
  }

  requestRotation(motorName: string, angle: number) {
    if(!(motorName === 'Mount')) {
      this.destMotorAngles[motorName] = angle*this.motorRanges[motorName]/Math.PI;
      return this.motorLoop();
    }
    else {
      const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, angle+Math.PI/2);
      this.destMotorAngles[motorName] = (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges[motorName];
      return this.motorLoop();
    }
  }

  requestPosition(forward: number, sideways: number, height: number) {
  
  }

  setPosition(h: number, x: number) {
    const l = Math.sqrt(h**2 + x**2);
    const phi = Math.atan2(x, h);
    const t = LEG_LENGTH_TOP;
    const b = LEG_LENGTH_BOTTOM;
    const alpha = invCosLaw(l, t, b);
    let destTopAngle = phi + alpha;
    let destBottomAngle = Math.acos((t/b)*Math.cos(Math.PI/2 - alpha)) - alpha - Math.PI/2;
    if(this.bendForward) {
      destTopAngle = phi - alpha;
      destBottomAngle *= -1;
    }

    this.destMotorAngles['Top'] = destTopAngle*this.motorRanges['Top']/Math.PI;
    this.destMotorAngles['Bottom'] = destBottomAngle*this.motorRanges['Bottom']/Math.PI;
    return this.motorLoop();
  }

  getAngle(motorName: string) {
    if(!(motorName === 'Mount')) {
      return Math.PI*this.motorAngles[motorName]/this.motorRanges[motorName];
    }
    else {
      const pistonLength = LEG_PISTON_LENGTH + this.motorAngles['Mount']/this.motorRanges['Mount'];
      return invCosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, pistonLength)-Math.PI/2;
    }
  }

  getPos() {
    const tAngle = this.getAngle('Top');
    const bAngle = this.getAngle('Bottom') - tAngle;
    const mAngle = this.getAngle('Mount');
    const mLength = LEG_LENGTH_TOP*Math.cos(tAngle) + LEG_LENGTH_BOTTOM*Math.cos(bAngle) - LEG_MOUNT_HEIGHT;
    const height = mLength*Math.cos(mAngle) + LEG_MOUNT_WIDTH*Math.sin(mAngle);
    const sideways = -mLength*Math.sin(mAngle) + LEG_MOUNT_WIDTH*(Math.cos(mAngle)-1);
    const forward = (LEG_LENGTH_TOP*Math.sin(tAngle) + LEG_LENGTH_BOTTOM*Math.sin(bAngle));
    return {forward: forward, sideways: sideways, height: height};
  } 
}

const cosLaw = (rSide: number, lSide: number, angle: number) => {
  // returns the side length opposite of the angle in a triangle with rSide and lSide side lengths adjacent to the angle
  return Math.sqrt(Math.abs(rSide**2 + lSide**2 - 2*rSide*lSide*Math.cos(angle)));
}

const invCosLaw = (rSide: number, lSide: number, oSide: number) => {
  // returns angle in a triangle with rSide and lSide adjacent side lengths and oSide the side length opposite of the angle
  const cosVal = (rSide**2 + lSide**2 - oSide**2)/(2*rSide*lSide);
  return Math.acos(cosVal > 1.0 ? 1.0 : (cosVal < -1.0 ? -1.0 : cosVal));  
}

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
  moveSpeed: Position
  startMovePosition: Position
  moveSpeedIntervalID: NodeJS.Timeout

  constructor(legName, mainWindow, topMotorRange, bottomMotorRange, mountMotorRange) {
  //motorRange for top and bottom motor = rotation in degree needed for pi forward rotation of segment
  //motorRange for mount motor = rotation in degree needed for one millimeter piston extension
    this.legName = legName;
    this.mainWindow = mainWindow;
    this.motorRanges["Top"] = topMotorRange;
    this.motorRanges["Bottom"] = bottomMotorRange;
    this.motorRanges["Mount"] = mountMotorRange;
    ipcMain.on(this.legName, (event, arg1, arg2) => {
      if(arg1.startsWith("requestMoveSpeed")) {
	if(arg2 === 0) {
          this.requestMoveSpeed(null);
        }
	else {
          switch(arg1) {
            case "requestMoveSpeedForward":
              this.requestMoveSpeed({forward: arg2, height: 0, sideways: 0});
	      return;
            case "requestMoveSpeedHeight":
              this.requestMoveSpeed({forward: 0, height: arg2, sideways: 0});
	      return;
            case "requestMoveSpeedSideways":
              this.requestMoveSpeed({forward: 0, height: 0, sideways: arg2});
	      return;
	  }
        }
      }
      else if(arg1 === "getProperties") {
        this.mainWindow.webContents.send('notifyLegPosition', this.legName, this.getPosition());
      }
    });
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
        this.mainWindow.webContents.send('notifyLegPosition', this.legName, this.getPosition());
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
      this.destMotorAngles['Mount'] = (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges['Mount'];
      return this.motorLoop();
    }
  }

  requestPosition(position: Position) {
    const mAngle = Math.atan2(position.sideways + LEG_MOUNT_WIDTH, position.height + LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM - LEG_MOUNT_HEIGHT);
    const mLength = (position.height + LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM - LEG_MOUNT_HEIGHT)/Math.cos(mAngle);
    const mHeight = Math.sqrt(Math.abs(mLength**2 - LEG_MOUNT_WIDTH**2));
    const destMountAngle = mAngle - Math.atan2(LEG_MOUNT_WIDTH, mHeight);
    const pistonLength = cosLaw(LEG_PISTON_HEIGHT, LEG_PISTON_WIDTH, destMountAngle+Math.PI/2);
    this.destMotorAngles['Mount'] = (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges['Mount'];
    const tbHeight = mHeight + LEG_MOUNT_HEIGHT
    const tbLength = Math.sqrt(tbHeight**2 + position.forward**2);
    const phi = Math.atan2(position.forward, tbHeight);
    const alpha = invCosLaw(tbLength, LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM);
    let destTopAngle = phi + alpha;
    let destBottomAngle = Math.acos((LEG_LENGTH_TOP/LEG_LENGTH_BOTTOM)*Math.cos(Math.PI/2 - alpha)) - alpha - Math.PI/2;
    if(this.bendForward) {
      destTopAngle = phi - alpha;
      destBottomAngle *= -1;
    }
    this.destMotorAngles['Top'] = destTopAngle*this.motorRanges['Top']/Math.PI;
    this.destMotorAngles['Bottom'] = destBottomAngle*this.motorRanges['Bottom']/Math.PI;
    return this.motorLoop();
  }

  requestMoveSpeed(speed: Position) {
    this.moveSpeed = speed;
    if(!speed) {
      clearInterval(this.moveSpeedIntervalID);
      this.moveSpeedIntervalID = null;
    }
    else if(this.moveSpeedIntervalID) {
      return;
    }
    else {
      this.startMovePosition = this.getPosition();
      this.moveSpeedIntervalID = setInterval(() => {
        const position = toArray(this.startMovePosition).map((n,i) => {
          if(toArray(this.moveSpeed)[i] != 0) {
            return toArray(this.getPosition())[i] + toArray(this.moveSpeed)[i]/10;
	  }
	  return n;
	});
        this.requestPosition(fromArray(position));
      }, 100);
    }
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

  getPosition() {
    const position = new Position();
    const tAngle = this.getAngle('Top');
    const bAngle = this.getAngle('Bottom') + tAngle;
    position.forward = (LEG_LENGTH_TOP*Math.sin(tAngle) + LEG_LENGTH_BOTTOM*Math.sin(bAngle));
    const mHeight = LEG_LENGTH_TOP*Math.cos(tAngle) + LEG_LENGTH_BOTTOM*Math.cos(bAngle) - LEG_MOUNT_HEIGHT;
    const mAngle = this.getAngle('Mount') + Math.atan2(LEG_MOUNT_WIDTH, mHeight);
    const mLength = Math.sqrt(Math.abs(mHeight**2 + LEG_MOUNT_WIDTH**2));
    position.height = mLength*Math.cos(mAngle) + LEG_MOUNT_HEIGHT - (LEG_LENGTH_TOP + LEG_LENGTH_BOTTOM);
    position.sideways = mLength*Math.sin(mAngle) - LEG_MOUNT_WIDTH;
    return position;
  } 
}

class Position {
  forward: number
  height: number
  sideways: number
}

const toArray = (position: Position) => {
  if(position) {
    return [position.forward, position.height, position.sideways];
  }
  return null;
}

const fromArray = (array: number[]) => {
  return {forward: array[0], height: array[1], sideways: array[2]};
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

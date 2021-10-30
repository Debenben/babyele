import { BrowserWindow, ipcMain } from "electron";
import { MotorAbstraction } from "./interfaces";
import { LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM } from "./param";

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
  //motorRange = motor rotation in degree needed for pi forward rotation of segment
    this.legName = legName;
    this.mainWindow = mainWindow;
    this.motorRanges[legName+"Top"] = topMotorRange;
    this.motorRanges[legName+"Bottom"] = bottomMotorRange;
    this.motorRanges[legName+"Mount"] = mountMotorRange;
  }

  async addMotor(motorName: string, motor: MotorAbstraction) {
    if(!motorName.startsWith(this.legName)) {
      return true;
    }
    ipcMain.removeAllListeners(motorName);
    this.motors[motorName] = motor;
    this.motorAngles[motorName] = 0;
    if(motor) {
      motor.setBrakingStyle(127); //Consts.BrakingStyle.BRAKE
      motor.setAccelerationTime(200);
      motor.setDecelerationTime(200);
      await this.requestRotation(motorName, 0);
      await motor.resetZero();
      ipcMain.on(motorName, (event, arg1, arg2) => {
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
        this.mainWindow.webContents.send('notifyLegRotation', motorName, Math.PI*this.motorAngles[motorName]/this.motorRanges[motorName]);
      });
      this.mainWindow.webContents.send("notifyState", motorName, "online");
      return true;
    }
    else {
      this.mainWindow.webContents.send("notifyState", motorName, "offline");
      return false;
    }
  }

  motorLoop() {
    if(this.motors[this.legName+'Top'] && this.motors[this.legName+'Bottom'] && Math.abs(this.motorAngles[this.legName+'Top'] - this.destMotorAngles[this.legName+'Top']) > this.noMoveMotorAngle && Math.abs(this.motorAngles[this.legName+'Bottom'] - this.destMotorAngles[this.legName+'Bottom']) > this.noMoveMotorAngle) {
      const diffTopMotorAngle = this.destMotorAngles[this.legName+'Top'] - this.motorAngles[this.legName+'Top'];
      const diffBottomMotorAngle = this.destMotorAngles[this.legName+'Bottom'] - this.motorAngles[this.legName+'Bottom'];
      const topMotorSpeed = 10*Math.sign(diffTopMotorAngle) + 90*diffTopMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle));
      const bottomMotorSpeed = 10*Math.sign(diffBottomMotorAngle) + 90*diffBottomMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle));
      return Promise.all([ this.motors[this.legName+'Top'].rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed), this.motors[this.legName+'Bottom'].rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed) ]);
    }
    if(this.motors[this.legName+'Top'] && Math.abs(this.motorAngles[this.legName+'Top'] - this.destMotorAngles[this.legName+'Top']) > this.noMoveMotorAngle) {
      const diffTopMotorAngle = this.destMotorAngles[this.legName+'Top'] - this.motorAngles[this.legName+'Top'];
      const topMotorSpeed = 10*Math.sign(diffTopMotorAngle) + 0.9*Math.min(Math.max(diffTopMotorAngle, -100), 100);
      return this.motors[this.legName+'Top'].rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed);
    }
    if(this.motors[this.legName+'Bottom'] && Math.abs(this.motorAngles[this.legName+'Bottom'] - this.destMotorAngles[this.legName+'Bottom']) > this.noMoveMotorAngle) {
      const diffBottomMotorAngle = this.destMotorAngles[this.legName+'Bottom'] - this.motorAngles[this.legName+'Bottom'];
      const bottomMotorSpeed = 10*Math.sign(diffBottomMotorAngle) + 0.9*Math.min(Math.max(diffBottomMotorAngle, -100), 100);
      return this.motors[this.legName+'Bottom'].rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed);
    }
    return Promise.resolve();
  }

  requestRotation(motorName: string, angle: number) {
    this.destMotorAngles[motorName] = angle*this.motorRanges[motorName]/Math.PI;
    return this.motorLoop();
  }

  getHeight() {
    const topAngle = Math.PI*this.motorAngles[this.legName+'Top']/this.motorRanges[this.legName+'Top'];
    const bottomAngle = Math.PI*this.motorAngles[this.legName+'Bottom']/this.motorRanges[this.legName+'Bottom'] - topAngle;
    return LEG_LENGTH_TOP*Math.cos(topAngle) + LEG_LENGTH_BOTTOM*Math.cos(bottomAngle);
  }

  getXPos() {
    const topAngle = Math.PI*this.motorAngles[this.legName+'Top']/this.motorRanges[this.legName+'Top'];
    const bottomAngle = Math.PI*this.motorAngles[this.legName+'Bottom']/this.motorRanges[this.legName+'Bottom'] - topAngle;
    return LEG_LENGTH_TOP*Math.sin(topAngle) + LEG_LENGTH_BOTTOM*Math.sin(bottomAngle);
  }

  setPosition(h, x) {
    const l = Math.sqrt(h**2 + x**2);
    const phi = Math.atan2(x, h);
    const t = LEG_LENGTH_TOP;
    const b = LEG_LENGTH_BOTTOM;
    let cosval = (l**2 + t**2 - b**2)/(2*l*t);
    if(cosval > 1.0) {
      cosval = 1.0;
    }
    const alpha = Math.acos(cosval);
    let destTopAngle = phi + alpha;
    let destBottomAngle = Math.acos((t/b)*Math.cos(Math.PI/2 - alpha)) - alpha - Math.PI/2;
    if(this.bendForward) {
      destTopAngle = phi - alpha;
      destBottomAngle *= -1;
    }

    this.destMotorAngles[this.legName+'Top'] = destTopAngle*this.motorRanges[this.legName+'Top']/Math.PI;
    this.destMotorAngles[this.legName+'Bottom'] = destBottomAngle*this.motorRanges[this.legName+'Bottom']/Math.PI;
    return this.motorLoop();
  }
}

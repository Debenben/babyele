import { AbsoluteMotor, Consts } from "node-poweredup";
import { BrowserWindow, ipcMain } from "electron";
import { LEG_LENGTH_TOP, LEG_LENGTH_BOTTOM } from "./param";

export class Leg {
  legName: string
  mainWindow: BrowserWindow
  topMotor: AbsoluteMotor
  bottomMotor: AbsoluteMotor
  topMotorRange: number
  bottomMotorRange: number
  topMotorAngle: number = 0.0
  destTopMotorAngle: number = 0.0
  bottomMotorAngle: number = 0.0
  destBottomMotorAngle: number = 0.0
  bendForward: boolean = true
  noMoveMotorAngle: number = 3

  constructor(legName, mainWindow, topMotorRange, bottomMotorRange) {
  //motorRange = motor rotation in degree needed for pi forward rotation of segment
    this.legName = legName;
    this.mainWindow = mainWindow;
    this.topMotorRange = topMotorRange;
    this.bottomMotorRange = bottomMotorRange;
  }

  addBottomMotor(motor) {
    ipcMain.removeAllListeners(this.legName+"Bottom");
    this.bottomMotor = motor;
    if(motor) {
      motor.setBrakingStyle(Consts.BrakingStyle.BRAKE);
      motor.setAccelerationTime(10);
      motor.setDecelerationTime(10);
      ipcMain.on(this.legName+"Bottom", (event, arg1, arg2) => {
        switch(arg1) {
          case "requestPower":
            motor.setPower(arg2);
            if(arg2 === 0) {
              this.destBottomMotorAngle = this.bottomMotorAngle;
            }
            break;
          case "requestRotation":
            return this.requestBottomRotation(arg2);
          case "requestReset":
            this.topMotorAngle = 0;
            this.destTopMotorAngle = 0;
            return motor.resetZero();
        }
      });
      motor.on('rotate', ({degrees}) => {
        this.bottomMotorAngle = degrees;
        this.mainWindow.webContents.send('notifyLegRotation', this.legName+"Bottom", Math.PI*this.bottomMotorAngle/this.bottomMotorRange);
      });
      this.mainWindow.webContents.send("notifyState", this.legName+"Bottom", "online");
      return true;
    }
    else {
      this.mainWindow.webContents.send("notifyState", this.legName+"Bottom", "offline");
      return false;
    }
  }

  addTopMotor(motor) {
    ipcMain.removeAllListeners(this.legName+"Top");
    this.topMotor = motor;
    if(motor) {
      motor.setBrakingStyle(Consts.BrakingStyle.BRAKE);
      motor.setAccelerationTime(10);
      motor.setDecelerationTime(10);
      ipcMain.on(this.legName+"Top", (event, arg1, arg2) => {
        switch(arg1) {
          case "requestPower":
            motor.setPower(arg2);
            if(arg2 === 0) {
              this.destTopMotorAngle = this.topMotorAngle;
            }
            break;
          case "requestRotation":
            return this.requestTopRotation(arg2);
          case "requestReset":
            this.topMotorAngle = 0;
            this.destTopMotorAngle = 0;
            return motor.resetZero();
        }
      });
      motor.on('rotate', ({degrees}) => {
        this.topMotorAngle = degrees;
        this.mainWindow.webContents.send('notifyLegRotation', this.legName+"Top", Math.PI*this.topMotorAngle/this.topMotorRange);
      });
      this.mainWindow.webContents.send("notifyState", this.legName+"Top", "online");
      return true;
    }
    else {
      this.mainWindow.webContents.send("notifyState", this.legName+"Top", "offline");
      return false;
    }
  }

  motorLoop() {
    //this.topMotorAngle = this.destTopMotorAngle;
    //this.bottomMotorAngle = this.destBottomMotorAngle;
    //this.mainWindow.webContents.send('notifyLegRotation', this.legName+"Top", Math.PI*this.topMotorAngle/this.topMotorRange);
    //this.mainWindow.webContents.send('notifyLegRotation', this.legName+"Bottom", Math.PI*this.bottomMotorAngle/this.bottomMotorRange);

    if(Math.abs(this.topMotorAngle - this.destTopMotorAngle) > this.noMoveMotorAngle && Math.abs(this.bottomMotorAngle - this.destBottomMotorAngle) > this.noMoveMotorAngle) {
      const diffTopMotorAngle = this.destTopMotorAngle - this.topMotorAngle;
      const diffBottomMotorAngle = this.destBottomMotorAngle - this.bottomMotorAngle;
      const topMotorSpeed = 10*Math.sign(diffTopMotorAngle) + 90*diffTopMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle));
      const bottomMotorSpeed = 10*Math.sign(diffBottomMotorAngle) + 90*diffBottomMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle));
      return Promise.all([ this.topMotor.rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed), this.bottomMotor.rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed) ]);
    }
    if(Math.abs(this.topMotorAngle - this.destTopMotorAngle) > this.noMoveMotorAngle) {
      const diffTopMotorAngle = this.destTopMotorAngle - this.topMotorAngle;
      const topMotorSpeed = 10*Math.sign(diffTopMotorAngle) + 0.9*Math.min(Math.max(diffTopMotorAngle, -100), 100);
      return this.topMotor.rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed);
    }
    if(Math.abs(this.bottomMotorAngle - this.destBottomMotorAngle) > this.noMoveMotorAngle) {
      const diffBottomMotorAngle = this.destBottomMotorAngle - this.bottomMotorAngle;
      const bottomMotorSpeed = 10*Math.sign(diffBottomMotorAngle) + 0.9*Math.min(Math.max(diffBottomMotorAngle, -100), 100);
      return this.bottomMotor.rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed);
    }
    return Promise.resolve();
  }

  requestTopRotation(angle: number) {
    this.destTopMotorAngle = angle*this.topMotorRange/Math.PI;
    return this.motorLoop();
  }

  requestBottomRotation(angle: number) {
    this.destBottomMotorAngle = angle*this.bottomMotorRange/Math.PI;
    return this.motorLoop();
  }

  getHeight() {
    const topAngle = Math.PI*this.topMotorAngle/this.topMotorRange;
    const bottomAngle = Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle;
    return LEG_LENGTH_TOP*Math.cos(topAngle) + LEG_LENGTH_BOTTOM*Math.cos(bottomAngle);
  }

  getXPos() {
    const topAngle = Math.PI*this.topMotorAngle/this.topMotorRange;
    const bottomAngle = Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle;
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

    this.destTopMotorAngle = destTopAngle*this.topMotorRange/Math.PI;
    this.destBottomMotorAngle = destBottomAngle*this.bottomMotorRange/Math.PI;
    return this.motorLoop();
  }
}

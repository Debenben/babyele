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

  constructor(legName, mainWindow, topMotorRange, bottomMotorRange) {
  //motorRange = motor rotation in degree needed for pi forward rotation of segment
    this.legName = legName;
    this.mainWindow = mainWindow;
    this.topMotorRange = topMotorRange;
    this.bottomMotorRange = bottomMotorRange;
  }

  addBottomMotor(motor) {
    this.bottomMotor = motor;
    if(motor) {
      motor.setBrakingStyle(Consts.BrakingStyle.BRAKE);
      motor.setAccelerationTime(10);
      motor.setDecelerationTime(10);
      ipcMain.on(this.legName+"Bottom", (event, arg1, arg2) => {
        switch(arg1) {
          case "requestPower":
            motor.setPower(arg2);
            break;
          case "requestRotation":
            this.requestBottomRotation(arg2);
            break;
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
    this.topMotor = motor;
    if(motor) {
      motor.setBrakingStyle(Consts.BrakingStyle.BRAKE);
      motor.setAccelerationTime(10);
      motor.setDecelerationTime(10);
      ipcMain.on(this.legName+"Top", (event, arg1, arg2) => {
        switch(arg1) {
          case "requestPower":
            motor.setPower(arg2);
            break;
          case "requestRotation":
            this.requestTopRotation(arg2);
            break;
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
    if(this.topMotorAngle == this.destTopMotorAngle && this.bottomMotorAngle == this.destBottomMotorAngle) {
      return;
    }
    const diffTopMotorAngle = this.destTopMotorAngle - this.topMotorAngle;
    const diffBottomMotorAngle = this.destBottomMotorAngle - this.bottomMotorAngle;
    const topMotorSpeed = 100*diffTopMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle))
    const bottomMotorSpeed = 100*diffBottomMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle))
    return Promise.all([ this.topMotor.rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed), this.bottomMotor.rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed) ])  
  }

  requestTopRotation(angle: number) {
    this.destTopMotorAngle = angle*this.topMotorRange/Math.PI;
    this.motorLoop();
  }

  requestBottomRotation(angle: number) {
    this.destBottomMotorAngle = angle*this.bottomMotorRange/Math.PI
    this.motorLoop();
  }

  getHeight() {
    const topAngle = Math.PI*this.topMotorAngle/this.topMotorRange
    const bottomAngle = Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle
    return LEG_LENGTH_TOP*Math.cos(topAngle) + LEG_LENGTH_BOTTOM*Math.cos(bottomAngle)
  }

  getXPos() {
    const topAngle = Math.PI*this.topMotorAngle/this.topMotorRange
    const bottomAngle = Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle
    return LEG_LENGTH_TOP*Math.sin(topAngle) + LEG_LENGTH_BOTTOM*Math.sin(bottomAngle)
  }

  async setPosition(height, xPos) {
    const h = height
    const p = xPos
    const t = LEG_LENGTH_TOP
    const b = LEG_LENGTH_BOTTOM
    const root = Math.sqrt(0.0 - b**4*p**2*t**2 + 2*b**2*h**2*p**2*t**2 + 2*b**2*p**4*t**2 + 2*b**2*p**2*t**4 - h**4*p**2*t**2 - 2*h**2*p**4*t**2 + 2*h**2*p**2*t**4 - p**6*t**2 + 2*p**4*t**4 - p**2*t**6) + h**3*t + h*p**2*t + h*t**3
    let cosval = (0.0 - b**2*h*t - root)/(2*(h**2*t**2 + p**2*t**2))
    if(cosval < -1.0) {
      cosval = (0.0 - b**2*h*t + root)/(2*(h**2*t**2 + p**2*t**2))
    }
    let topAngle = Math.acos(cosval)
    if((p-t*Math.sin(topAngle))/b < -1.0) {
      topAngle = -topAngle
    }
    const bottomAngle = Math.asin((p-t*Math.sin(topAngle))/b) - topAngle

    this.destTopMotorAngle = topAngle*this.topMotorRange/Math.PI;
    this.destBottomMotorAngle = bottomAngle*this.bottomMotorRange/Math.PI;
    await this.motorLoop();
  }
}

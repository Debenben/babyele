import { AbsoluteMotor, Consts } from "node-poweredup"
import { BrowserWindow } from "electron";

export class Leg {
  legName: string
  mainWindow: BrowserWindow
  topMotor: AbsoluteMotor
  bottomMotor: AbsoluteMotor
  isMoving: boolean = false;
  topMotorAngle: number = 0.0
  destTopMotorAngle: number = 0.0
  bottomMotorAngle: number = 0.0
  destBottomMotorAngle: number = 0.0
  topMotorRange: number
  bottomMotorRange: number
  topLength: number = 185
  bottomLength: number = 200

  constructor(legName, mainWindow, topMotor, topMotorRange, bottomMotor, bottomMotorRange) {
  //motorRange = motor rotation in degree needed for pi forward rotation of segment
    this.legName = legName;
    this.mainWindow = mainWindow;
    this.topMotor = topMotor;
    this.topMotorRange = topMotorRange;
    this.bottomMotor = bottomMotor;
    this.bottomMotorRange = bottomMotorRange;

    [topMotor, bottomMotor].forEach(async (motor) => {
      motor.resetZero();
      motor.setBrakingStyle(Consts.BrakingStyle.HOLD);
      motor.setAccelerationTime(10);
      motor.setDecelerationTime(10);
      motor.gotoAngle(0);
    });
    topMotor.on('rotate', ({degrees}) => {
      this.topMotorAngle = degrees;
      this.mainWindow.webContents.send('legRotation', this.legName+"Top", Math.PI*this.topMotorAngle/this.topMotorRange); 
    });
    bottomMotor.on('rotate', ({degrees}) => {
      this.bottomMotorAngle = degrees;
      this.mainWindow.webContents.send('legRotation', this.legName+"Bottom", Math.PI*this.bottomMotorAngle/this.bottomMotorRange);
    });
    const { ipcMain } = require('electron');
    ipcMain.on(legName+"Top", (event, arg1, arg2) => {
      switch(arg1) {
	case "setPower":
          topMotor.setPower(arg2);
          break;
	case "setRotation":
          this.setTopRotation(arg2);
          break;
      } 
    });
    ipcMain.on(legName+"Bottom", (event, arg1, arg2) => {
      switch(arg1) {
        case "setPower":
          bottomMotor.setPower(arg2);
          break;
        case "setRotation":
          this.setBottomRotation(arg2);
          break;
      }
    });
    this.mainWindow.webContents.send("setState", this.legName+"Top", "online");
    this.mainWindow.webContents.send("setState", this.legName+"Bottom", "online");
  }

  motorLoop() {
    if(this.isMoving || (this.topMotorAngle == this.destTopMotorAngle && this.bottomMotorAngle == this.destBottomMotorAngle)) {
      console.log("rejected, isMoving is " + this.isMoving);
      return;
    }
    console.log("accepted, isMoving is " + this.isMoving);
    this.isMoving = true;
    const diffTopMotorAngle = this.destTopMotorAngle - this.topMotorAngle;
    const diffBottomMotorAngle = this.destBottomMotorAngle - this.bottomMotorAngle;
    const topMotorSpeed = 100*diffTopMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle))
    const bottomMotorSpeed = 100*diffBottomMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle))
    return Promise.all([ this.topMotor.rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed), this.bottomMotor.rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed) ]).then( (resolve) => {
      console.log("promise is kept !!!" + diffTopMotorAngle + " and " + diffBottomMotorAngle);
      this.isMoving = false;
      this.motorLoop();
    }, (reject) => {
      console.log("promise rejected !!!");
      this.isMoving = false;
    });
  }

  setTopRotation(angle: number) {
    this.destTopMotorAngle = angle*this.topMotorRange/Math.PI;
    this.motorLoop();
  }

  setBottomRotation(angle: number) {
    this.destBottomMotorAngle = angle*this.bottomMotorRange/Math.PI
    this.motorLoop();
  }

  getHeight() {
    const topAngle = Math.PI*this.topMotorAngle/this.topMotorRange
    const bottomAngle = Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle
    return this.topLength*Math.cos(topAngle) + this.bottomLength*Math.cos(bottomAngle)
  }

  getXPos() {
    const topAngle = Math.PI*this.topMotorAngle/this.topMotorRange
    const bottomAngle = Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle
    return this.topLength*Math.sin(topAngle) + this.bottomLength*Math.sin(bottomAngle)
  }

  async setPosition(height, xPos) {
    const h = height
    const p = xPos
    const t = this.topLength
    const b = this.bottomLength
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
    this.motorLoop();
  }
}

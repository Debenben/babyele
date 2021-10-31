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
    if(this.motors['Top'] && this.motors['Bottom'] && Math.abs(this.motorAngles['Top'] - this.destMotorAngles['Top']) > this.noMoveMotorAngle && Math.abs(this.motorAngles['Bottom'] - this.destMotorAngles['Bottom']) > this.noMoveMotorAngle) {
      const diffTopMotorAngle = this.destMotorAngles['Top'] - this.motorAngles['Top'];
      const diffBottomMotorAngle = this.destMotorAngles['Bottom'] - this.motorAngles['Bottom'];
      const topMotorSpeed = 10*Math.sign(diffTopMotorAngle) + 90*diffTopMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle));
      const bottomMotorSpeed = 10*Math.sign(diffBottomMotorAngle) + 90*diffBottomMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle));
      return Promise.all([ this.motors['Top'].rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed), this.motors['Bottom'].rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed) ]);
    }
    if(this.motors['Top'] && Math.abs(this.motorAngles['Top'] - this.destMotorAngles['Top']) > this.noMoveMotorAngle) {
      const diffTopMotorAngle = this.destMotorAngles['Top'] - this.motorAngles['Top'];
      const topMotorSpeed = 10*Math.sign(diffTopMotorAngle) + 0.9*Math.min(Math.max(diffTopMotorAngle, -100), 100);
      return this.motors['Top'].rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed);
    }
    if(this.motors['Bottom'] && Math.abs(this.motorAngles['Bottom'] - this.destMotorAngles['Bottom']) > this.noMoveMotorAngle) {
      const diffBottomMotorAngle = this.destMotorAngles['Bottom'] - this.motorAngles['Bottom'];
      const bottomMotorSpeed = 10*Math.sign(diffBottomMotorAngle) + 0.9*Math.min(Math.max(diffBottomMotorAngle, -100), 100);
      return this.motors['Bottom'].rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed);
    }
    if(this.motors['Mount'] && Math.abs(this.motorAngles['Mount'] - this.destMotorAngles['Mount']) > this.noMoveMotorAngle) {
      const diffMountMotorAngle = this.destMotorAngles['Mount'] - this.motorAngles['Mount'];
      const mountMotorSpeed = 10*Math.sign(diffMountMotorAngle) + 0.9*Math.min(Math.max(diffMountMotorAngle, -100), 100);
      return this.motors['Mount'].rotateByDegrees(Math.abs(diffMountMotorAngle), mountMotorSpeed);
    }
    return Promise.resolve();
  }

  requestRotation(motorName: string, angle: number) {
    if(!(motorName === 'Mount')) {
      this.destMotorAngles[motorName] = angle*this.motorRanges[motorName]/Math.PI;
      return this.motorLoop();
    }
    else {
      const pistonLength = Math.sqrt(Math.abs(LEG_PISTON_HEIGHT**2 + LEG_PISTON_WIDTH**2 - 2*LEG_PISTON_HEIGHT*LEG_PISTON_WIDTH*Math.cos(angle+Math.PI/2)));
      this.destMotorAngles[motorName] = (pistonLength - LEG_PISTON_LENGTH)*this.motorRanges[motorName];
      return this.motorLoop();
    }
  }

  getAngle(motorName: string) {
    if(!(motorName === 'Mount')) {
      return Math.PI*this.motorAngles[motorName]/this.motorRanges[motorName];
    }
    else {
      const pistonLength = LEG_PISTON_LENGTH + this.motorAngles['Mount']/this.motorRanges['Mount'];
      return Math.acos((LEG_PISTON_HEIGHT**2 + LEG_PISTON_WIDTH**2 - pistonLength**2) / (2*LEG_PISTON_HEIGHT*LEG_PISTON_WIDTH))-Math.PI/2;
    }
  }

  getHeight() {
    const topAngle = this.getAngle('Top');
    const bottomAngle = this.getAngle('Bottom') - topAngle;
    return LEG_LENGTH_TOP*Math.cos(topAngle) + LEG_LENGTH_BOTTOM*Math.cos(bottomAngle);
  }

  getXPos() {
    const topAngle = this.getAngle('Top');
    const bottomAngle = this.getAngle('Bottom') - topAngle;
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

    this.destMotorAngles['Top'] = destTopAngle*this.motorRanges['Top']/Math.PI;
    this.destMotorAngles['Bottom'] = destBottomAngle*this.motorRanges['Bottom']/Math.PI;
    return this.motorLoop();
  }
}

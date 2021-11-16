import { BrowserWindow, ipcMain } from "electron";
import * as fs from 'fs';
import { Dog } from "./dog"
import { Pose, allowSwitch } from "./tools";

export class MoveController {
  mainWindow: BrowserWindow
  dog: Dog
  poses: Record<string, Pose> = {}
  mode: string = "OFFLINE"
  color: number = 0
  modeQueue: string[] = []

  constructor(mainWindow: BrowserWindow, dog: Dog) {
    this.mainWindow = mainWindow;
    this.dog = dog;

    setInterval(() => {
      for(let ledNum in this.dog.leds) {
        if(this.dog.leds[ledNum]) {
          this.dog.leds[ledNum].setColor((Number(this.mode)%10+1)*(this.color%2));
        }
      }
      this.color++;
    }, 1000);

    this.retrievePoses();

    ipcMain.on('notifyState', (event, arg1, arg2) => {
      if(arg1 === 'dog') {
        if(arg2 === 'offline') {
          this.mode = "OFFLINE";
          this.mainWindow.webContents.send('notifyMode', this.mode, true);
        }
        else if (this.mode === "OFFLINE") {
          this.mode = "WAITING";
          this.mainWindow.webContents.send('notifyMode', this.mode, true);
        }
      }
    });

    ipcMain.on('deletePose', (event, poseName) => {
      this.storePose(poseName, null);
    });

    ipcMain.on('storePose', (event, poseName) => {
      this.storePose(poseName, this.dog.getPose());
    });

    ipcMain.on('requestMode', (event, modeName) => {
      this.requestMode(modeName);
    });
  };

  retrievePoses() {
    fs.readFile('storage.json', (err, data) => {
      if(err) {
        console.log("error reading file: " + err);
        this.mainWindow.webContents.send('notifyPosesAvailable', this.poses);
        return Promise.resolve();
      }
      this.poses = JSON.parse(data.toString());
      this.mainWindow.webContents.send('notifyPosesAvailable', this.poses);
    });
  }

  storePose = async (poseId: string, pose: Pose) => {
    if(!pose) {
      delete this.poses[poseId];
    }
    else {
      this.poses[poseId] = pose;
    }
    let data = JSON.stringify(this.poses, null, 2);
    return fs.writeFile('storage.json', data, (err) => {
      if(err) {
        console.log("error writing file: " + err);
        return Promise.resolve();
      }
      this.mainWindow.webContents.send('notifyPosesAvailable', this.poses);
      this.mainWindow.webContents.send('notifyMode', poseId, true);
    });
  }

  getNewPoseName() {
    let num = [];
    const prefix = this.mode.split('-')[0]
    for(let id in this.poses) {
      if(id.split('-')[0] == prefix) {
        num.push(id.split('-')[1]);
      }
    }
    num.sort((a, b) => {return a-b});
    let available = 0;
    for(let i in num) {
      if(num[i] == available) available++;
    }
    return prefix + '-' + available;
  }

  requestMode(destMode: string) {
    /* special predefined mode requests */
    if(destMode === "OFFLINE") {
      this.modeQueue = [];
      this.dog.shutdown();
      return;
    }
    else if (this.mode === "OFFLINE") { // prevent predefined mode handling below
      console.log("Cannot switch from " + this.mode + " to " + destMode);
      return;
    }
    else if (destMode === "MANUAL") {
      this.modeQueue = [];
      this.mainWindow.webContents.send('notifyMode', this.getNewPoseName(), false);
      return;
    }
    else if (destMode === "BUTTON") {
      console.log("request mode change by button push");
      return;
    }
    /* individual pose requests */
    else if (this.poses.hasOwnProperty(destMode)) {
      this.modeQueue = [ destMode ];
      this.modeLoop();
      return Promise.resolve();
    }
    /* normal mode requests */
    if(this.modeQueue.length && allowSwitch(this.modeQueue[this.modeQueue.length-1], destMode)) {
      return this.modeQueue.push(destMode);
    }
    else if(allowSwitch(this.mode, destMode)) {
      this.modeQueue.push(destMode);
      this.modeLoop();
      return Promise.resolve();
    }
    else {
      console.log("Cannot switch from " + this.mode + " to " + destMode);
      return;
    }
  }

  async modeLoop() {
    while(this.modeQueue.length) {
      let dest = this.modeQueue[0];
      console.log("@@@@@@@@@@@@ modequeue dest " + dest);
      if(this.mode === dest) {
        this.modeQueue.shift();
        continue;
      }
      if(this.poses.hasOwnProperty(dest)) {
        await this.dog.requestPose(this.poses[dest]);
        this.mode = dest;
        this.mainWindow.webContents.send('notifyMode', dest, true);
        continue;
      }
    }
    return Promise.resolve();
  }
}

import { BrowserWindow, ipcMain } from "electron";
import * as fs from 'fs';
import { Dog } from "./dog"
import { Pose, Move, allowSwitch } from "./tools";

export class MoveController {
  mainWindow: BrowserWindow
  dog: Dog
  poses: Record<string, Pose> = {}
  moves: Record<string, Move> = {}
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

    this.retrieveData();

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

    ipcMain.on('deleteMode', (event, modeName) => {
      if(modeName === "OFFLINE") {
        console.log("deleting pose " + modeName + " not allowed");
        return;
      }
      if(this.moves.hasOwnProperty(modeName)) {
        delete this.moves[modeName];
      }
      else {
        delete this.poses[modeName];
        for(let id in this.moves) {
          this.moves[id] = this.moves[id].filter(el => el != modeName);
        }
      }
      return this.storeData();
    });

    ipcMain.on('storePose', (event, poseName) => {
      this.poses[poseName] = this.dog.getPose();
      const prefix = poseName.split('-')[0];
      const num = poseName.split('-')[1];
      if(this.moves.hasOwnProperty(prefix)) {
        this.moves[prefix].splice(this.moves[prefix].indexOf(prefix + '-' + (num - 1)) + 1, 0, poseName);
      }
      return this.storeData().then(() => {
        this.mainWindow.webContents.send('notifyMode', poseName, true);
      });
    });

    ipcMain.on('storeMove', (event, moveName, content) => {
      let newMove = [];
      for(let modeName of content) {
        if(this.poses.hasOwnProperty(modeName)) {
          newMove.push(modeName);
        }
        else if (this.moves.hasOwnProperty(modeName)) {
          newMove.push(...this.moves[modeName]);
        }
        else {
          console.log("new move " + moveName + " cannot be stored, incorrect content " + modeName);
          return;
        }
      }
      if(content) {
        this.moves[moveName] = newMove;
      }
      else {
        delete this.moves[moveName];
      }
      return this.storeData();
    });

    ipcMain.on('requestMode', (event, modeName) => {
      this.requestMode(modeName);
    });
  };

  retrieveData() {
    fs.readFile('storage.json', (err, data) => {
      if(err) {
        console.log("error reading file: " + err);
        this.mainWindow.webContents.send('notifyPosesAvailable', this.poses);
        this.mainWindow.webContents.send('notifyMovesAvailable', this.moves);
        return Promise.resolve();
      }
      const object = JSON.parse(data.toString());
      this.poses = object['poses'];
      this.moves = object['moves'];
      this.mainWindow.webContents.send('notifyPosesAvailable', this.poses);
      this.mainWindow.webContents.send('notifyMovesAvailable', this.moves);
    });
  }

  storeData = async () => {
    let data = JSON.stringify({poses: this.poses, moves: this.moves}, null, 2);
    return fs.writeFile('storage.json', data, (err) => {
      if(err) {
        console.log("error writing file: " + err);
        return Promise.resolve();
      }
      this.mainWindow.webContents.send('notifyPosesAvailable', this.poses);
      this.mainWindow.webContents.send('notifyMovesAvailable', this.moves);
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
    else if (this.moves.hasOwnProperty(destMode)) {
      if(this.moves[destMode].length == 0) {
        this.modeQueue = [];
        this.mode = destMode;
        this.mainWindow.webContents.send('notifyMode', this.getNewPoseName(), false);
      }
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
      else {
        console.log("@@@@@@@@@@@@ modequeue SHIFTING RUGBBISCH");
        this.modeQueue.shift();
      }
    }
    return Promise.resolve();
  }
}

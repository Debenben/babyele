import { BrowserWindow, ipcMain } from "electron";
import * as fs from 'fs';
import { Dog } from "./dog"
import { Pose, Move, reservedNames } from "./tools";

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
      for(const ledNum in this.dog.leds) {
        if(this.dog && this.dog.leds[ledNum]) {
          this.dog.leds[ledNum].send(Buffer.from([0x81, 0x32, 0x10, 0x51, 0x00, this.color%2]));
        }
      }
      this.color++;
    }, 1000);

    this.retrieveData();

    ipcMain.on('notifyState', (event, arg1, arg2) => {
      if(arg1 === 'dog') {
        if(arg2 === 'offline') {
          this.mode = "OFFLINE";
          this.send('notifyMode', this.mode, true);
          this.notifyAvailability();
        }
        else if (this.mode === "OFFLINE") {
          this.mode = "WAITING";
          this.send('notifyMode', this.mode, true);
          this.notifyAvailability();
        }
      }
    });

    ipcMain.on('deleteMode', (event, modeName) => {
      if(reservedNames.includes(modeName)) return;
      if(this.moves.hasOwnProperty(modeName)) {
        delete this.moves[modeName];
      }
      else {
        delete this.poses[modeName];
        for(const id of Object.keys(this.moves)) {
          this.moves[id] = this.moves[id].filter(el => el !== modeName);
        }
        this.send('notifyMode', modeName, false);
      }
      return this.storeData();
    });

    ipcMain.on('storePose', (event, poseName) => {
      if(reservedNames.includes(poseName)) return;
      this.poses[poseName] = this.dog.getPose();
      const prefix = poseName.split('-')[0];
      const num = poseName.split('-')[1];
      if(this.moves.hasOwnProperty(prefix)) {
        this.moves[prefix].splice(this.moves[prefix].indexOf(prefix + '-' + (num - 1)) + 1, 0, poseName);
      }
      this.storeData();
      this.send('notifyMode', poseName, true);
    });

    ipcMain.on('storeMove', (event, moveName, content) => {
      if(reservedNames.includes(moveName)) return;
      const newMove = [];
      for(const modeName of content) {
        if(this.poses.hasOwnProperty(modeName) || modeName === "OFFLINE") {
          newMove.push(modeName);
        }
        else if (this.moves.hasOwnProperty(modeName)) {
          newMove.push(...this.moves[modeName]);
        }
        else {
          console.log("move " + moveName + " not storing incorrect content " + modeName);
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

  retrieveData = () => {
    fs.readFile('storage.json', (err, data) => {
      if(err) {
        console.log("error reading file: " + err);
        this.notifyAvailability();
        return;
      }
      const object = JSON.parse(data.toString());
      this.poses = object['poses'];
      this.moves = object['moves'];
      this.notifyAvailability();
    });
  }

  storeData = () => {
    const data = JSON.stringify({poses: this.poses, moves: this.moves}, null, 2);
    return fs.writeFile('storage.json', data, (err) => {
      if(err) {
        console.log("error writing file: " + err);
        return;
      }
      this.notifyAvailability();
    });
  }

  notifyAvailability = () => {
    const lastMode = this.modeQueue.length ? this.modeQueue[this.modeQueue.length-1] : this.mode;
    const enabled: Record<string, boolean> = {};
    for(const id of Object.keys(this.moves)) {
      enabled[id] = this.allowSwitch(lastMode, id);
    }
    this.send('notifyPosesAvailable', Object.keys(this.poses));
    this.send('notifyMovesAvailable', this.moves, enabled);
  }

  getNewPoseName = () => {
    const num = [];
    const prefix = this.mode.split('-')[0]
    for(const id in this.poses) {
      if(id.split('-')[0] === prefix) {
        num.push(parseInt(id.split('-')[1]));
      }
    }
    num.sort((a, b) => {return a-b});
    let available = 0;
    for(const i in num) {
      if(num[i] === available) available++;
    }
    return prefix + '-' + available;
  }

  requestMode = (destMode: string) => {
    /* special predefined mode requests */
    if(destMode === "OFFLINE") {
      this.modeQueue = [];
      this.dog.shutdown();
      this.notifyAvailability();
      return;
    }
    else if (this.mode === "OFFLINE") { // prevent predefined mode handling below
      return;
    }
    else if (destMode === "MANUAL") {
      this.modeQueue = [];
      // do not stop, manual request might be in progress already
      this.notifyAvailability();
      this.send('notifyMode', this.getNewPoseName(), false);
      return;
    }
    else if (destMode === "BUTTON") {
      if(this.modeQueue.length) {
        this.modeQueue = [];
        this.dog.stop();
        this.notifyAvailability();
      }
      else {
        for(const moveName in this.moves) {
          if(this.allowSwitch(this.mode, moveName)) {
            this.modeQueue.push(moveName);
            this.notifyAvailability();
            this.modeLoop();
            return;
          }
        }
      }
      return;
    }
    /* individual pose requests */
    else if (this.poses.hasOwnProperty(destMode)) {
      this.modeQueue = [ destMode ];
      this.notifyAvailability();
      this.modeLoop();
      return Promise.resolve();
    }
    /* allow switching to empty modes */
    else if (this.moves.hasOwnProperty(destMode)) {
      if(this.moves[destMode].length === 0) {
        this.modeQueue = [];
        this.mode = destMode;
        this.notifyAvailability();
        this.send('notifyMode', this.getNewPoseName(), false);
        return Promise.resolve();
      }
    }
    /* normal mode requests */
    if(this.modeQueue.length && this.allowSwitch(this.modeQueue[this.modeQueue.length-1], destMode)) {
      this.modeQueue.push(destMode);
      this.notifyAvailability();
    }
    else if(this.modeQueue.length === 0 && this.allowSwitch(this.mode, destMode)) {
      this.modeQueue.push(destMode);
      this.notifyAvailability();
      this.modeLoop();
    }
    else {
      console.log("Cannot switch from " + this.modeQueue.length ? this.modeQueue[this.modeQueue.length-1] : this.mode + " to " + destMode);
    }
  }

  async modeLoop() {
    while(this.modeQueue.length) {
      const dest = this.modeQueue[0];
      if(this.poses.hasOwnProperty(dest)) {
        await this.dog.requestPose(this.poses[dest]);
        this.mode = dest;
        this.send('notifyMode', dest, true);
        this.modeQueue.shift();
      }
      else if(this.moves.hasOwnProperty(dest)) {
        if(!this.moves[dest].length) return Promise.resolve();
        for(const poseId of this.moves[dest]) {
          await Promise.all([this.dog.requestPose(this.poses[poseId]), new Promise(res => setTimeout(res, 10))]);
          this.mode = poseId;
          this.send('notifyMode', poseId, true);
        }
        if(this.modeQueue.length === 1 && this.allowSwitch(dest, dest)) continue;
        this.modeQueue.shift();
      }
      else {
        console.log("Move or pose " + dest + " is unknown, discarding");
        this.modeQueue.shift();
      }
    }
    return Promise.resolve();
  }

  allowSwitch = (origin, destination) => {
    if(origin === "OFFLINE") return false;
    if(destination === "OFFLINE") return true;
    if(origin === "WAITING") return true;
    if(this.poses.hasOwnProperty(destination)) return true;
    if(this.moves.hasOwnProperty(destination) && this.moves[destination].length === 0) return true;
    if(this.poses.hasOwnProperty(origin) && this.moves.hasOwnProperty(destination)) return (origin === this.moves[destination][0]);
    if(this.moves.hasOwnProperty(origin) && this.moves.hasOwnProperty(destination)) return (this.moves[origin][this.moves[origin].length-1] === this.moves[destination][0]);
    return false;
  }

  send = (arg1, arg2, arg3 = null) => {
    if(!this.mainWindow.isDestroyed()) return this.mainWindow.webContents.send(arg1, arg2, arg3);
  }
}

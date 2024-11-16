import { BrowserWindow, ipcMain } from "electron";
import * as fs from 'fs';
import { DogAbstraction } from "./dog"
import { Vec43, Move, reservedNames } from "./tools";
import { motorAnglesFromLegAngles, legAnglesFromAcceleration } from "./conversions";

export class MoveController {
  mainWindow: BrowserWindow
  dog: DogAbstraction
  poses: Record<string, Vec43> = {}
  moves: Record<string, Move> = {}
  mode = "OFFLINE"
  modeQueue: string[] = []

  constructor(mainWindow: BrowserWindow, dog: DogAbstraction) {
    this.mainWindow = mainWindow;
    this.dog = dog;

    this.retrieveData();

    ipcMain.on('notifyStatus', (event, arg1, arg2) => {
      if(arg1 === 'dog') {
        if(!arg2) {
          this.mode = "OFFLINE";
          this.send('notifyMode', this.mode, true);
          this.notifyAvailability();
        }
        else if (this.mode === "OFFLINE") {
          this.mode = "MANUAL";
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
      this.poses[poseName] = this.dog.motorAngles;
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
  }
  
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

  emptyNodeQueue = () => {
    this.modeQueue = [];
    this.send('notifyModeQueue', this.modeQueue);
    this.notifyAvailability();
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
      this.emptyNodeQueue();
      this.dog.requestShutdown();
      return;
    }
    else if (destMode === "STOP") {
      this.dog.requestMotorSpeeds([[0,0,0], [0,0,0], [0,0,0], [0,0,0]]);
      this.emptyNodeQueue();
      return;
    }
    else if (this.mode === "OFFLINE") { // prevent predefined mode handling below
      return;
    }
    else if (destMode === "MANUAL") {
      this.emptyNodeQueue();
      // do not stop, manual request might be in progress already
      this.send('notifyMode', this.getNewPoseName(), false);
      return;
    }
    else if (destMode === "SYNC") {
      const legAngles = legAnglesFromAcceleration(this.dog.dogAcceleration, this.dog.topAcceleration, this.dog.bottomAcceleration);
      return this.dog.requestSync(motorAnglesFromLegAngles(legAngles));
    }
    else if (destMode === "BUTTON") {
      if(this.modeQueue.length) {
        this.dog.requestMotorSpeeds([[0,0,0], [0,0,0], [0,0,0], [0,0,0]]);
        this.emptyNodeQueue();
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
      this.send('notifyModeQueue', this.modeQueue);
      const dest = this.modeQueue[0];
      if(this.poses.hasOwnProperty(dest)) {
        await this.dog.requestMotorAngles(this.poses[dest]);
        this.mode = dest;
        this.send('notifyMode', dest, true);
        this.modeQueue.shift();
      }
      else if(this.moves.hasOwnProperty(dest)) {
        if(!this.moves[dest].length) return Promise.resolve();
        for(const poseId of this.moves[dest]) {
          if(!this.modeQueue.length) return Promise.resolve();
          if(reservedNames.includes(poseId as any)) this.requestMode(poseId);
          else if(this.poses.hasOwnProperty(poseId)) {
            await Promise.all([this.dog.requestMotorAngles(this.poses[poseId]), new Promise(res => setTimeout(res, 10))]);
            this.mode = poseId;
            this.send('notifyMode', poseId, true);
          }
          else {
            console.log("Pose " + poseId + " is unknown, discarding");
          }
        }
        if(this.modeQueue.length === 1 && this.allowSwitch(dest, dest)) continue;
        this.modeQueue.shift();
      }
      else {
        console.log("Move or pose " + dest + " is unknown, discarding");
        this.modeQueue.shift();
      }
    }
    return this.send('notifyModeQueue', []);
  }

  allowSwitch = (origin, destination) => {
    if(origin === "OFFLINE") return false;
    if(destination === "OFFLINE") return true;
    if(origin === "MANUAL") return true;
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

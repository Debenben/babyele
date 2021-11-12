import { ipcMain, BrowserWindow } from "electron";
import * as fs from 'fs';
import { Pose } from "./tools";

export class Storage {
  mainWindow: BrowserWindow
  poses: Record<string, Pose> = {}

  constructor(window: BrowserWindow) {
    this.mainWindow = window;
    ipcMain.on('retrievePoses', (event) => {
      fs.readFile('storage.json', (err, data) => {
        if(err) {
          console.log("error reading file: " + err);
          event.sender.send('storedPoses', this.poses);
          return Promise.resolve();
        }
        this.poses = JSON.parse(data.toString());
        event.sender.send('storedPoses', this.poses);
      });
    });
    ipcMain.on('deletePose', (event, arg1) => {
      this.storePose(arg1, null);
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
      this.mainWindow.webContents.send('storedPoses', this.poses);
      this.mainWindow.webContents.send('notifyMode', poseId);
    });
  }
}

import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as url from "url";
import PoweredUP, { Consts } from "node-poweredup";
import { Dog } from "./dog";
import { Modes } from "./param"

let mainWindow: Electron.BrowserWindow;
let dog: Dog;
let poweredUP: PoweredUP = new PoweredUP();

function createWindow() {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, "../index.html"),
      protocol: "file:",
      slashes: true,
  }));

  mainWindow.webContents.openDevTools();
  dog = new Dog(mainWindow);

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    if(dog) {
      dog.requestMode(Modes.OFFLINE).then(() => {dog = null;}).then(() => {mainWindow = null;});
    }
    else {
      mainWindow = null;
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on('requestMode', (event, arg) => {
  dog.requestMode(arg);
});

poweredUP.on('discover', (hub) => {
  dog.addHub(hub);
});
poweredUP.scan();
console.log("Looking for Hubs...");

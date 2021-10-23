import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as url from "url";
import { Dog } from "./dog";
import { Modes } from "./param"

let mainWindow: Electron.BrowserWindow;
let dog: Dog;
const simulation: boolean = true;

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

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

function createDog() {
  dog = new Dog(mainWindow);
  if(simulation) {
    console.log("Starting simulation...");
    let simulation = import("./simulation").then( module => {
      dog.addHub(new module.SimulationHub("BeneLego2"));
      dog.addHub(new module.SimulationHub("BeneLego3"));
    });
  }
  else {
    let poweredUP = import("node-poweredup").then( module => {
      let poweredUP = new module.PoweredUP();
      poweredUP.on('discover', (hub) => {
	dog.addHub(hub);
      });
      poweredUP.scan();
      console.log("Looking for Hubs...");
    });
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  if(dog) {
    if(dog.hubFront) {
      dog.hubFront.shutdown();
    }
    if(dog.hubBack) {
      dog.hubBack.shutdown();
    }
  }
  dog = null;
  mainWindow = null;
  app.quit();
});

app.on("activate", () => {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on('rendererInitialized', (event, arg) => {
  createDog();
});

ipcMain.on('requestMode', (event, arg) => {
  if(dog) {
    dog.requestMode(arg);
  }
});

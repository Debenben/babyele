import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as url from "url";
import { Dog } from "./dog";
import { MoveController } from "./movecontroller"

let mainWindow: Electron.BrowserWindow;
let dog: Dog;
let controller: MoveController;

function createWindow() {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const fileName = process.argv.includes('--txt') ? "../txtindex.html" : "../guiindex.html";
  mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, fileName),
      protocol: "file:",
      slashes: true,
  }));

  mainWindow.removeMenu();
  //mainWindow.webContents.openDevTools();
}

async function createDog() {
  dog = new Dog(mainWindow);
  let poweredUP;
  if(process.argv.includes('--simulation')) {
    console.log("Starting simulation...");
    let library = await import("./simulation");
    poweredUP = new library.SimulationPowered();
  }
  else {
    let library = await import("@debenben/node-poweredup");
    poweredUP = new library.PoweredUP();
  }
  poweredUP.on('discover', (hub) => {
    dog.addHub(hub);
  });
  ipcMain.on('notifyState', (event, arg1, arg2) => {
    if(arg1 === "dog" && arg2 === "online") {
      poweredUP.stop();
    }
    else if (arg1 === "dog" && arg2 === "offline") {
      poweredUP.scan();
    }
  });
  poweredUP.scan();
  console.log("Looking for Hubs...");
}

app.on("ready", () => {
  if(process.argv.includes('--version')) {
    console.log(app.getName() + " " + app.getVersion());
    return app.quit();
  }
  createWindow();
});

app.on("window-all-closed", () => {
  controller.requestMode("OFFLINE");
  dog = null;
  controller = null;
  mainWindow = null;
  app.quit();
});

ipcMain.on('rendererInitialized', (event, arg) => {
  createDog();
  controller = new MoveController(mainWindow, dog);
});

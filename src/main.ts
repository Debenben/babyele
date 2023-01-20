import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as url from "url";
import { MoveController } from "./movecontroller"

let mainWindow: Electron.BrowserWindow;
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
  mainWindow.webContents.openDevTools();
}

async function createPoweredUP() {
  if(process.argv.includes('--simulation')) {
    console.log("Starting simulation...");
    const library = await import("./simulation");
    return new library.SimulationPowered();
  }
  const library = await import("@debenben/node-poweredup");
  return new library.PoweredUP();
}

async function createCalibrator() {
  const library = await import("./calibrator");
  const calibrator = new library.Calibrator();
  const poweredUP = await createPoweredUP();
  poweredUP.on('discover', async (hub) => {
    calibrator.calibrate(hub);
  });
  poweredUP.scan();
  console.log("Looking for Hubs...");
}

async function createDog() {
  const library = await import("./dog");
  const dog = new library.Dog(mainWindow);
  controller = new MoveController(mainWindow, dog);
  const poweredUP = await createPoweredUP();
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
  if(process.argv.includes('--calibrate')) {
    createCalibrator();
    return;
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if(controller) {
    controller.requestMode("OFFLINE");
  }
  controller = null;
  mainWindow = null;
  app.quit();
});

ipcMain.on('rendererInitialized', async (event, arg) => {
  createDog();
});

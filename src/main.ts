import { app, BrowserWindow, ipcMain, Menu } from "electron";
import * as path from "path";
import { MoveController } from "./movecontroller"
import { CommanderAbstraction } from "./commanderinterface"
import { Dog } from "./dog"

let mainWindow: Electron.BrowserWindow;
let controller: MoveController;
let commander: CommanderAbstraction;

async function createWindow() {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
  });

  const fileName = process.argv.includes('--txt') ? "../public/txtindex.html" : "../public/guiindex.html";
  mainWindow.loadFile(path.join(__dirname, fileName));

  Menu.setApplicationMenu(null)
  // mainWindow.webContents.openDevTools();
}

async function createPoweredUP() {
  if(process.argv.includes('--simulation')) {
    console.log("Starting simulation...");
    const library = await import("./poweredup/poweredupsimulation");
    return new library.SimulationPowered();
  }
  const library = await import("@debenben/node-poweredup");
  return new library.PoweredUP();
}

async function createHciSocket() {
  if(process.argv.includes('--simulation')) {
    console.log("Starting simulation...");
    const library = await import("./pybricks/simulationhcisocket");
    return new library.SimulationHciSocket();
  }
  const library = require('@abandonware/bluetooth-hci-socket');
  return new library();
}

app.on("ready", () => {
  if(process.argv.includes('--version')) {
    console.log(app.getName() + " " + app.getVersion());
    return app.quit();
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if(commander) commander.disconnect();
  controller = null;
  commander = null;
  mainWindow = null;
  app.quit();
});

ipcMain.on('rendererInitialized', async () => {
  const dog = new Dog(mainWindow);
  if(process.argv.includes('--poweredup')) {
    const library = await import("./poweredup/poweredupcommander");
    commander = new library.PoweredUpCommander(dog, await createPoweredUP());
  }
  else {
    const library = await import("./pybricks/pybrickscommander");
    commander = new library.PybricksCommander(dog, await createHciSocket());
  }
  controller = new MoveController(mainWindow, dog);
  dog.attachCommander(commander);
  dog.connect();
});

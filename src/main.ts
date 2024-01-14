import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { MoveController } from "./movecontroller"
import { PoweredUpCommander } from "./poweredup/poweredupcommander"
import { Dog } from "./dog"

let mainWindow: Electron.BrowserWindow;
let controller: MoveController;

async function createWindow() {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const fileName = process.argv.includes('--txt') ? "../public/txtindex.html" : "../public/guiindex.html";
  mainWindow.loadFile(path.join(__dirname, fileName));

  mainWindow.removeMenu();
  // mainWindow.webContents.openDevTools();
}

async function createPoweredUP() {
  if(process.argv.includes('--simulation')) {
    console.log("Starting simulation...");
    const library = await import("./poweredup/simulation");
    return new library.SimulationPowered();
  }
  const library = await import("@debenben/node-poweredup");
  return new library.PoweredUP();
}

app.on("ready", () => {
  if(process.argv.includes('--version')) {
    console.log(app.getName() + " " + app.getVersion());
    return app.quit();
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if(controller) controller.destructor();
  controller = null;
  mainWindow = null;
  app.quit();
});

ipcMain.on('rendererInitialized', async () => {
  const dog = new Dog(mainWindow);
  const commander = new PoweredUpCommander(dog, await createPoweredUP());
  const controller = new MoveController(mainWindow, dog);
  dog.attachCommander(commander);
  dog.connect();
});

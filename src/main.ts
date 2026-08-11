import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { MoveController } from "./movecontroller"
import { CommanderAbstraction } from "./commanderinterface"
import { Dog } from "./dog"
declare const GUI_WINDOW_WEBPACK_ENTRY: string;
declare const TXT_WINDOW_WEBPACK_ENTRY: string;

let mainWindow: Electron.BrowserWindow;
let controller: MoveController;
let commander: CommanderAbstraction;

async function createWindow() {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    backgroundColor: '#0f0f1f',
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
  });

  const windowUrl = process.argv.includes('--txt') ? TXT_WINDOW_WEBPACK_ENTRY : GUI_WINDOW_WEBPACK_ENTRY;
  mainWindow.loadURL(windowUrl);
  Menu.setApplicationMenu(null)
  // mainWindow.webContents.openDevTools();
}

async function createPoweredUP() {
  if(process.argv.includes('--simulation')) {
    console.log("Starting simulation...");
    const library = await import("./poweredup/poweredupsimulation");
    return new library.SimulationPowered();
  }
  const library = await import("node-poweredup");
  return new library.PoweredUP();
}

async function createHciSocket() {
  if(process.argv.includes('--simulation')) {
    console.log("Starting simulation...");
    const sim = await import("./pybricks/simulationhcisocket");
    return new sim.SimulationHciSocket();
  }
  else if(process.argv.includes('--inventor')) {
    console.log("Starting simulation for inventorhub...");
    const inventor = await import("./pybricks/inventorhcisocket");
    const real = await import('@stoprocent/bluetooth-hci-socket');
    const sim = await import("./pybricks/simulationhcisocket");
    return new inventor.InventorHciSocket(new real.default(), new sim.SimulationHciSocket());
  }
  const real = await import('@stoprocent/bluetooth-hci-socket');
  return new real.default();
}

app.on("ready", () => {
  if(process.argv.includes('--version')) {
    console.log(app.getName() + " " + app.getVersion());
    return app.quit();
  }
  createWindow();
});

app.on("window-all-closed", () => { app.quit(); });

app.on("will-quit", async() => {
  if(commander) commander.disconnect();
  controller = null;
  commander = null;
  mainWindow = null;
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

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

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
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
    let library = await import("node-poweredup");
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  try {
    dog.shutdown();
  }
  catch(e) {
    console.log("discard error " + e + " during shutdown");
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
  controller = new MoveController(mainWindow, dog);
});

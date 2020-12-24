import { app, BrowserWindow } from "electron";
import * as path from "path";
import * as url from "url";

let mainWindow: Electron.BrowserWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: { nodeIntegration: true },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, "../index.html"),
      protocol: "file:",
      slashes: true,
  }));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
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

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
import PoweredUP, { Consts } from "node-poweredup"
var poweredUP: PoweredUP = new PoweredUP();
console.log("Looking for Hubs...");
poweredUP.scan();


poweredUP.on("discover", async (hub) => {
    await hub.connect();
    console.log(`Connected to ${hub.name}`);
    hub.on("disconnect", () => {
        console.log(`Hub ${hub.name} disconnected`);
    })
    hub.on("attach", (device) => {
       console.log(`Device attached to hub ${hub.name} port ${device.portName} (Device ID: ${device.type})`);
    });
    hub.on("detach", (device) => {
        console.log(`Device detached from hub ${hub.name} port ${device.portName}`);
    });
    hub.on("button", ({ event }) => {
                    console.log(hub);
    });
});


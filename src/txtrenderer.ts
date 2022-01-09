import { ipcRenderer } from 'electron';

ipcRenderer.send("rendererInitialized");

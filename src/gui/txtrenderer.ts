import { ipcRenderer } from 'electron';
import { motorNames } from '../tools';
import { printDegree } from './infobox';

ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
  document.getElementById('title').innerHTML = "lego walker: " + modeName;
  document.getElementById('currentMode').innerHTML = modeName;
});

ipcRenderer.on('notifyLegRotation', (event, legName, value) => {
  document.getElementById(legName).innerHTML = printDegree(value);
});

ipcRenderer.on('notifyStatus', (event, legName, value) => {
  const element = document.getElementById(legName);
  if(!element) return
  if(value) element.style.color = 'green';
  else element.style.color = 'red';
});

for(const id of motorNames) {
  document.getElementById(id).addEventListener("mousedown", (eventData) => {
    ipcRenderer.send(id, 'requestRotationSpeed', eventData.button ? -100 : 100);
  });
  document.getElementById(id).addEventListener("mouseup", () => {
    ipcRenderer.send(id, 'requestRotationSpeed', 0);
  });
}

ipcRenderer.send("rendererInitialized");

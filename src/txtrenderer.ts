import { ipcRenderer } from 'electron';
import { printDegree, legNames, motorNames } from './tools';

ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
  document.getElementById('currentMode').innerHTML = modeName;
});

ipcRenderer.on('notifyLegRotation', (event, legName, value) => {
  document.getElementById(legName).innerHTML = printDegree(value);
});

ipcRenderer.on('notifyState', (event, legName, value) => {
  const element = document.getElementById(legName);
  if(!element) return
  if(value === 'offline') {
    element.style.color = 'red';
    return
  }
  element.style.color = 'green';
});

for(const legName of legNames) {
  for(const motorName of motorNames) {
    const id = legName + motorName.charAt(0).toUpperCase() + motorName.slice(1);
    document.getElementById(id).addEventListener("mousedown", (eventData) => {
      ipcRenderer.send(id, 'requestRotationSpeed', eventData.button ? -100 : 100);
    });
    document.getElementById(id).addEventListener("mouseup", () => {
      ipcRenderer.send(id, 'requestRotationSpeed', 0);
    });
  }
}

ipcRenderer.send("rendererInitialized");

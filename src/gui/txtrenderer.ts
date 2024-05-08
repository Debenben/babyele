import { ipcRenderer } from 'electron';
import { motorNames, legNames } from '../tools';

ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
  document.getElementById('title').innerHTML = "lego walker: " + modeName;
  document.getElementById('currentMode').innerHTML = modeName;
});

ipcRenderer.on('notifyLegRotation', (event, legName, value) => {
  document.getElementById(legName + "Mount").innerHTML = (180*value[0]/Math.PI).toFixed(2) + "°";
  document.getElementById(legName + "Top").innerHTML = (180*value[1]/Math.PI).toFixed(2) + "°";
  document.getElementById(legName + "Bottom").innerHTML = (180*value[2]/Math.PI).toFixed(2) + "°";
});
ipcRenderer.on('notifyLegPosition', (event, legName, value) => {
  document.getElementById(legName + "X").innerHTML = value[0].toFixed(0);
  document.getElementById(legName + "Y").innerHTML = value[1].toFixed(0);
  document.getElementById(legName + "Z").innerHTML = value[2].toFixed(0);
});
ipcRenderer.on('notifyDogPosition', (event, name, value) => {
  document.getElementById(name + "X").innerHTML = value[0].toFixed(0);
  document.getElementById(name + "Y").innerHTML = value[1].toFixed(0);
  document.getElementById(name + "Z").innerHTML = value[2].toFixed(0);
});

ipcRenderer.on('notifyStatus', (event, legName, value) => {
  const element = document.getElementById(legName);
  if(!element) return
  if(value) element.style.color = 'green';
  else element.style.color = 'red';
  ipcRenderer.send(legName.replace("Top","").replace("Bottom","").replace("Mount",""), "getProperties");
});

for(const id of motorNames) {
  document.getElementById(id).addEventListener("mousedown", (eventData) => {
    ipcRenderer.send(id, 'requestRotationSpeed', eventData.button ? -1000 : 1000);
  });
  document.getElementById(id).addEventListener("mouseup", () => {
    ipcRenderer.send(id, 'requestRotationSpeed', 0);
  });
}

for(const id of ["dog"].concat(legNames)) {
  document.getElementById(id + "X").addEventListener("mousedown", (eventData) => {
    ipcRenderer.send(id, 'requestPositionSpeed', eventData.button ? [-100,0,0] : [100,0,0]);
  });
  document.getElementById(id + "X").addEventListener("mouseup", () => {
    ipcRenderer.send(id, 'requestPositionSpeed', [0,0,0]);
  });
  document.getElementById(id + "Y").addEventListener("mousedown", (eventData) => {
    ipcRenderer.send(id, 'requestPositionSpeed', eventData.button ? [0,-100,0] : [0,100,0]);
  });
  document.getElementById(id + "Y").addEventListener("mouseup", () => {
    ipcRenderer.send(id, 'requestPositionSpeed', [0,0,0]);
  });
  document.getElementById(id + "Z").addEventListener("mousedown", (eventData) => {
    ipcRenderer.send(id, 'requestPositionSpeed', eventData.button ? [0,0,-100] : [0,0,100]);
  });
  document.getElementById(id + "Z").addEventListener("mouseup", () => {
    ipcRenderer.send(id, 'requestPositionSpeed', [0,0,0]);
  });
}

ipcRenderer.send("rendererInitialized");

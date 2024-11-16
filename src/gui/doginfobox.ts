import { TextBlock, Button } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, Gauge, buildGauge, ToggleButton, ThreePrint } from './infobox';

export class DogInfobox extends Infobox {
  tiltText: ThreePrint;
  rotationText: ThreePrint;
  positionText: ThreePrint;
  rotationGauge: Gauge;
  positionGauge: Gauge;
  toggle: ToggleButton;

  constructor(name: string, preview: boolean, guiTexture) {
    super(name, preview, guiTexture);
    this.addControls();
  }
  addControls() {
    this.toggle = new ToggleButton("Position", "Rotation", this.toggleGauge);
    this.panel.addControl(this.toggle);
    this.tiltText = new ThreePrint("tilt");
    ipcRenderer.on('notifyTilt', this.updateTilt);
    this.panel.addControl(this.tiltText);
    this.rotationText = new ThreePrint("rot");
    this.panel.addControl(this.rotationText);
    ipcRenderer.on('notifyDogRotation', this.updateRotation);
    this.rotationGauge = buildGauge(this, true);
    this.panel.addControl(this.rotationGauge);
    this.positionText = new ThreePrint("pos");
    this.panel.addControl(this.positionText);
    ipcRenderer.on('notifyDogPosition', this.updatePosition);
    this.positionGauge = buildGauge(this, false);
    this.panel.addControl(this.positionGauge);
    ipcRenderer.send("dog", "getProperties");
    this.toggle.onPointerClickObservable.add(this.toggleGauge);
    this.toggleGauge(this.toggle.enabled);
  }
  removeControls() {
    ipcRenderer.removeListener('notifyTilt', this.updateTilt);
    ipcRenderer.removeListener('notifyDogPosition', this.updatePosition);
    ipcRenderer.removeListener('notifyDogRotation', this.updateRotation);
  }
  toggleGauge = (isPosition) => {
    this.rotationGauge.isVisible = isPosition;
    this.positionGauge.isVisible = !isPosition;
    this.tiltText.isVisible = isPosition;
    this.rotationText.isVisible = isPosition;
    this.positionText.isVisible = !isPosition;
  }
  updateTilt = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.tiltText.setThreeText(arg2.map(e => (e*180/Math.PI).toFixed(2) + "°"));
    }
  }
  updateRotation = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.rotationText.setThreeText(arg2.map(e => (e*180/Math.PI).toFixed(2) + "°"));
      this.rotationGauge.setIndicatorPosition(arg2);
    }
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.positionText.setThreeText(arg2.map(e => e.toFixed(2)));
      this.positionGauge.setIndicatorPosition(arg2.map(e => 0.002*e));
    }
  }
}


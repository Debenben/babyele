import { TextBlock, Button } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, Gauge, buildText, buildGauge, printPosition, buildToggleButton } from './infobox';

export class DogInfobox extends Infobox {
  tiltText: TextBlock;
  rotationText: TextBlock;
  positionText: TextBlock;
  rotationGauge: Gauge;
  positionGauge: Gauge;
  toggle: Button;

  constructor(name: string, preview: boolean, guiTexture) {
    super(name, preview, guiTexture);
    this.addControls();
  }
  addControls() {
    this.toggle = buildToggleButton();
    this.panel.addControl(this.toggle);
    this.tiltText = buildText("tilt: --");
    ipcRenderer.on('notifyTilt', this.updateTilt);
    this.panel.addControl(this.tiltText);
    this.rotationText = buildText("rot.: --");
    this.panel.addControl(this.rotationText);
    ipcRenderer.on('notifyDogRotation', this.updateRotation);
    this.rotationGauge = buildGauge(this, true);
    this.panel.addControl(this.rotationGauge);
    this.positionText = buildText("pos.: --");
    this.panel.addControl(this.positionText);
    ipcRenderer.on('notifyDogPosition', this.updatePosition);
    this.positionGauge = buildGauge(this, false);
    this.panel.addControl(this.positionGauge);
    ipcRenderer.send("dog", "getProperties");
    this.toggle.onPointerClickObservable.add(this.toggleGauge);
    this.toggleGauge();
  }
  removeControls() {
    ipcRenderer.removeListener('notifyTilt', this.updateTilt);
    ipcRenderer.removeListener('notifyDogPosition', this.updatePosition);
    ipcRenderer.removeListener('notifyDogRotation', this.updateRotation);
  }
  toggleGauge = () => {
    const isPosition = this.toggle.textBlock.text == "Position";
    this.toggle.textBlock.text = isPosition ? "Rotation" : "Position";
    this.rotationGauge.isVisible = isPosition;
    this.positionGauge.isVisible = !isPosition;
    this.tiltText.isVisible = isPosition;
    this.rotationText.isVisible = isPosition;
    this.positionText.isVisible = !isPosition;
  }
  updateTilt = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.tiltText.text = "tilt:" + printPosition(arg2.map(e => e*180/Math.PI));
    }
  }
  updateRotation = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.rotationText.text = "rot.:" + printPosition(arg2.map(e => e*180/Math.PI));
      this.rotationGauge.setIndicatorPosition(arg2);
    }
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.positionText.text = "pos.:" + printPosition(arg2);
      this.positionGauge.setIndicatorPosition(arg2.map(e => 0.002*e));
    }
  }
}


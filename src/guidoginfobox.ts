import * as BABYLON from 'babylonjs';
import { TextBlock, Control } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, buildText, buildCorrectionSlider } from './guiinfobox';
import { printPosition } from './tools';

export class DogInfobox extends Infobox {
  tiltText: TextBlock;
  rotationText: TextBlock;
  positionText: TextBlock;

  constructor(name: string, preview: boolean, scene: BABYLON.Scene) {
    super(name, preview, scene);
    this.addControls();
  }
  addControls() {
    this.tiltText = buildText("tilt: --");
    ipcRenderer.on('notifyTilt', this.updateTilt);
    this.panel.addControl(this.tiltText);
    this.rotationText = buildText("rot.: --");
    this.panel.addControl(this.rotationText);
    ipcRenderer.on('notifyDogRotation', this.updateRotation);
    this.panel.addControl(buildCorrectionSlider("dog", "requestRotationSpeedForward", "⮊"));
    this.panel.addControl(buildCorrectionSlider("dog", "requestRotationSpeedHeight", "🗘"));
    this.panel.addControl(buildCorrectionSlider("dog", "requestRotationSpeedSideways", "⮉"));
    this.positionText = buildText("pos.: --");
    this.panel.addControl(this.positionText);
    ipcRenderer.on('notifyDogPosition', this.updatePosition);
    this.panel.addControl(buildCorrectionSlider("dog", "requestPositionSpeedForward", "⮿"));
    this.panel.addControl(buildCorrectionSlider("dog", "requestPositionSpeedHeight", "⭥"));
    this.panel.addControl(buildCorrectionSlider("dog", "requestPositionSpeedSideways", "⭤"));
    ipcRenderer.send("dog", "getProperties");
  }
  removeControls() {
    ipcRenderer.removeListener('notifyTilt', this.updateTilt);
    ipcRenderer.removeListener('notifyDogPosition', this.updatePosition);
    ipcRenderer.removeListener('notifyDogRotation', this.updateRotation);
  }
  updateTilt = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.tiltText.text = "tilt:" + printPosition(new BABYLON.Vector3(arg2._x, arg2._y, arg2._z).scale(180/Math.PI));
    }
  }
  updateRotation = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.rotationText.text = "rot.:" + printPosition(new BABYLON.Vector3(arg2._x, arg2._y, arg2._z).scale(180/Math.PI));
    }
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.positionText.text = "pos.:" + printPosition(new BABYLON.Vector3(arg2._x, arg2._y, arg2._z));
    }
  }
}

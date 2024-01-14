import { Grid, TextBlock, Button } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, buildText, buildGauge, printPosition } from './infobox';
import { Vector3 } from '../tools';

export class HubInfobox extends Infobox {
  batteryText: TextBlock;
  rssiText: TextBlock;
  positionText: TextBlock;
  bendForward: Button;

  constructor(name: string, preview: boolean, guiTexture) {
    super(name, preview, guiTexture);
    this.addControls();
  }

  addControls() {
    const grid = new Grid("hubColumn");
    this.batteryText = buildText("battery: --");
    grid.heightInPixels = this.batteryText.heightInPixels;
    grid.widthInPixels = this.widthInPixels - 20;
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    grid.addControl(this.batteryText, 0, 0);
    this.rssiText = buildText("rssi: --");
    ipcRenderer.on('notifyBattery', this.updateBattery);
    grid.addControl(this.rssiText, 0, 1);
    ipcRenderer.on('notifyRssi', this.updateRssi);
    this.panel.addControl(grid);
    if(!this.name.endsWith("Center")) {
      const sliderDest = this.name.replace("hub","leg");
      ipcRenderer.on('notifyBendForward', this.updateBendForward);
      this.positionText = buildText("pos.: --");
      ipcRenderer.on('notifyLegPosition', this.updatePosition);
      this.panel.addControl(this.positionText);
      const gauge = buildGauge(this, false);
      this.panel.addControl(gauge);
      this.bendForward = buildToggleButton(sliderDest, "setBendForward");
      this.panel.addControl(this.bendForward);
      ipcRenderer.send(sliderDest, "getProperties");
    }
    ipcRenderer.send(this.name, "getProperties");
  }
  removeControls() {
    ipcRenderer.removeListener('notifyBattery', this.updateBattery);
    ipcRenderer.removeListener('notifyRssi', this.updateRssi);
    ipcRenderer.removeListener('notifyLegPosition', this.updatePosition);
    ipcRenderer.removeListener('notifyBendForward', this.updateBendForward);
  }
  updateBattery = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.batteryText.text = "battery: " + String(arg2);
    }
  }
  updateRssi = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.rssiText.text = "rssi: " + String(arg2);
    }
  }
  updateBendForward = (event, arg1, arg2) => {
    if(arg1 === this.name.replace("hub", "leg")) {
      this.bendForward.textBlock.text = arg2 ? "bend backward >" : "< bend forward";
    }
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name.replace("hub", "leg")) {
      this.positionText.text = "pos.:" + printPosition(arg2);
    }
  }
}

const buildToggleButton = (meshName: string, requestName: string) => {
  const button = Button.CreateSimpleButton("button", "");
  button.paddingBottom = "5px";
  button.width = "200px";
  button.height = "30px";
  button.background = "black";
  button.thickness = 0
  button.alpha = 0.8;
  button.fontSize = "20px";
  button.onPointerEnterObservable.add(() => button.thickness = 1);
  button.onPointerOutObservable.add(() => button.thickness = 0);
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send(meshName, requestName, button.textBlock.text.includes("forward"));
  });
  return button;
}

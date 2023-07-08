import * as BABYLON from 'babylonjs';
import { Grid, TextBlock, Checkbox, StackPanel, Control } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, buildText, buildCorrectionSlider } from './guiinfobox';
import { printPosition } from './tools';

export class HubInfobox extends Infobox {
  batteryText: TextBlock;
  rssiText: TextBlock;
  positionText: TextBlock;
  bendForward: StackPanel;

  constructor(name: string, preview: boolean, scene: BABYLON.Scene) {
    super(name, preview, scene);
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
      ipcRenderer.on('notifyLegPosition', this.updatePosition);
      this.bendForward = buildCheckBox(sliderDest, "setBendForward");
      this.panel.addControl(this.bendForward);
      ipcRenderer.on('notifyBendForward', this.updateBendForward);
      this.positionText = buildText("pos.: --");
      this.panel.addControl(this.positionText);
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedForward", "⮿"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedHeight", "⭥"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedSideways", "⭤"));
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
      (this.bendForward.getChildByName("bendForwardBox") as Checkbox).isChecked = arg2;
    }
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name.replace("hub", "leg")) {
      this.positionText.text = "pos.:" + printPosition(new BABYLON.Vector3(arg2._x, arg2._y, arg2._z));
    }
  }
}

const buildCheckBox = (meshName: string, requestName: string) => {
  const panel = new StackPanel("checkBoxPanel");
  panel.isVertical = false;
  panel.height = "25px";
  panel.paddingLeft = "5px";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  const box = new Checkbox("bendForwardBox");
  box.width = "20px";
  box.height = "20px";
  box.color = "lightgrey";
  box.onIsCheckedChangedObservable.add((checked) => {
    ipcRenderer.send(meshName, requestName, checked);
  });
  panel.addControl(box);
  const label = buildText(requestName);
  label.width = "200px";
  panel.addControl(label);
  return panel;
}

import * as BABYLON from 'babylonjs';
import { Rectangle, Control, Slider, Checkbox, TextBlock, Button, StackPanel, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { toDegree, printPosition, printDegree } from './tools';

export class Infobox extends Container {
  scene: BABYLON.Scene;
  panel: StackPanel;
  fillRectangle: Rectangle;
  heading: Rectangle;
  batteryText: TextBlock;
  rssiText: TextBlock;
  tiltText: TextBlock;
  rotationText: TextBlock;
  positionText: TextBlock;
  angleText: TextBlock;
  angleSlider: Grid;
  bendForward: StackPanel;
  constructor(name: string, preview: boolean, scene: BABYLON.Scene) {
    super(name);
    this.scene = scene;
    this.widthInPixels = Math.min(Math.max(0.4*window.innerWidth, 300), 600);
    this.adaptHeightToChildren = true;
    this.setPaddingInPixels(10);
    this.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.fillRectangle = new Rectangle("background");
    this.fillRectangle.alpha = 0.6;
    this.fillRectangle.thickness = 0;
    this.fillRectangle.cornerRadius = 5;
    this.isPointerBlocker = true;
    this.addControl(this.fillRectangle);
    this.panel = new StackPanel("infoboxPanel");
    this.addControl(this.panel);
    this.addControls();
    this.setPreview(preview);
  }
  setPreview(preview: boolean) {
    if(preview) this.color = "rgb(60,215,60)"
    else this.color = "rgb(255,110,90)"
    this.fillRectangle.background = this.color;
    this.heading.background = this.color;
  }
  addControls() {
    this.heading = buildHeading(this);
    this.panel.addControl(this.heading);
    if(this.name.startsWith("hub")) {
      const grid = new Grid("hubColumn");
      this.batteryText = buildText("battery: --");
      grid.heightInPixels = this.batteryText.heightInPixels;
      grid.widthInPixels = this.widthInPixels - 20;
      grid.addColumnDefinition(0.5);
      grid.addColumnDefinition(0.5);
      ipcRenderer.on('notifyBattery', this.updateBattery);
      grid.addControl(this.batteryText, 0, 0);
      this.rssiText = buildText("rssi: --");
      ipcRenderer.on('notifyRssi', this.updateRssi);
      grid.addControl(this.rssiText, 0, 1);
      this.panel.addControl(grid);
      ipcRenderer.send(this.name, "getProperties");
    }
    let sliderDest;
    if(this.name === "dog") {
      this.tiltText = buildText("tilt: --");
      ipcRenderer.on('notifyTilt', this.updateTilt);
      this.panel.addControl(this.tiltText);
      sliderDest = "dog";
      this.rotationText = buildText("rot.: --");
      this.panel.addControl(this.rotationText);
      ipcRenderer.on('notifyDogRotation', this.updateRotation);
      ipcRenderer.on('notifyDogPosition', this.updatePosition);
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestRotationSpeedForward", "⮊"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestRotationSpeedHeight", "🗘"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestRotationSpeedSideways", "⮉"));
    }
    if(this.name.startsWith("hub") && !this.name.endsWith("Center")) {
      sliderDest = this.name.replace("hub","leg");
      ipcRenderer.on('notifyLegPosition', this.updatePosition);
      this.bendForward = buildCheckBox(sliderDest, "setBendForward");
      this.panel.addControl(this.bendForward);
      ipcRenderer.on('notifyBendForward', this.updateBendForward);
    }
    if(sliderDest) {
      this.positionText = buildText("pos.: --");
      this.panel.addControl(this.positionText);
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedForward", "⮿"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedHeight", "⭥"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedSideways", "⭤"));
      ipcRenderer.send(sliderDest, "getProperties");
    }
    if(this.name.startsWith("leg")) {
      this.tiltText = buildText("tilt angle: --");
      ipcRenderer.on('notifyTilt', this.updateTilt);
      this.panel.addControl(this.tiltText);
      this.angleText = buildText("rot. angle: --");
      this.panel.addControl(this.angleText);
      this.angleSlider = buildAngleSlider(this);
      this.panel.addControl(this.angleSlider);
      ipcRenderer.on('notifyLegRotation', this.updateAngle);
      const syncButton = buildButton(this.name, "requestSync", "synchronize");
      const resetButton = buildButton(this.name, "requestReset", "reset");
      const grid = new Grid("hubColumn");
      grid.heightInPixels = syncButton.heightInPixels;
      grid.widthInPixels = this.widthInPixels - 20;
      grid.addColumnDefinition(0.5);
      grid.addColumnDefinition(0.5);
      grid.addControl(syncButton, 0, 0);
      grid.addControl(resetButton, 0, 1);
      this.panel.addControl(grid);
      this.panel.addControl(buildText("power:"));
      this.panel.addControl(buildCorrectionSlider(this.name, "requestRotationSpeed", "⌁"));
      ipcRenderer.send(this.name.replace("Top","").replace("Bottom","").replace("Mount",""), "getProperties");
    }
  }
  removeControls() {
    ipcRenderer.removeListener('notifyBattery', this.updateBattery);
    ipcRenderer.removeListener('notifyRssi', this.updateRssi);
    ipcRenderer.removeListener('notifyTilt', this.updateTilt);
    ipcRenderer.removeListener('notifyDogPosition', this.updatePosition);
    ipcRenderer.removeListener('notifyDogRotation', this.updateRotation);
    ipcRenderer.removeListener('notifyBendForward', this.updateBendForward);
    ipcRenderer.removeListener('notifyLegPosition', this.updatePosition);
    ipcRenderer.removeListener('notifyLegRotation', this.updateAngle);
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
  updateTilt = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      if(this.name.startsWith("leg")) {
        this.tiltText.text = "tilt angle:" + printDegree(arg2);;
      }
      else {
        this.tiltText.text = "tilt:" + printPosition(toDegree(arg2));
      }
    }
  }
  updateRotation = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.rotationText.text = "rot.:" + printPosition(toDegree(arg2));
    } 
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name || arg1 === this.name.replace("hub", "leg")) {
      this.positionText.text = "pos.:" + printPosition(arg2);
    }
  }
  updateAngle = (event, arg1, arg2) => {
    const slider = this.angleSlider.getChildByName("angleSlider") as Slider;
    if(arg1 === this.name && !slider.displayValueBar) {
      this.scene.render(); // force calculation of slider.widthInPixels
      this.angleText.text = "rot. angle:" + printDegree(arg2);
      slider.value = arg2;
    }
  }
}

const buildHeading = (infobox: Infobox) => {
  let heading = new Rectangle("headingBackground");
  heading.height = "30px";
  heading.thickness = 0;
  heading.alpha = 0.8;
  heading.cornerRadius = 5;
  const block = new TextBlock("headingText");
  block.text = infobox.name;
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.fontSize = 20;
  block.fontFamily = "monospace";
  block.paddingLeft = "5px";
  block.color = "black";
  block.onPointerDownObservable.add((vec) => {
    ipcRenderer.emit('startGuiDrag', 'dragEvent', infobox, vec);
    heading.thickness = 1;
  });
  block.onPointerUpObservable.add((vec) => {
    ipcRenderer.emit('stopGuiDrag', 'dragEvent', infobox, vec);
    heading.thickness = 0;
  });
  block.onPointerEnterObservable.add(() => {
    heading.alpha = 0.6;
    infobox.fillRectangle.thickness = 1;
  });
  block.onPointerOutObservable.add(() => {
    if(heading.thickness > 0) return;
    heading.alpha = 0.8;
    infobox.fillRectangle.thickness = 0;
  });
  heading.addControl(block);
  const button = Button.CreateSimpleButton("closeButton","🗙");
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.width = "30px";
  button.height = "30px";
  button.setPaddingInPixels(2);
  button.color = "lightgrey";
  button.textBlock.color = "black";
  button.thickness = 0;
  button.onPointerEnterObservable.add(() => button.thickness = 1);
  button.onPointerOutObservable.add(() => button.thickness = 0);
  button.onPointerClickObservable.add(() => {
    ipcRenderer.emit("notifyState", "closeEvent", infobox.name, "online");
  });
  heading.addControl(button);
  return heading;
}

const buildText = (content: string) => {
  const block = new TextBlock("infoText");
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = content;
  block.fontFamily = "monospace";
  block.height = "25px";
  block.paddingLeft = "5px";
  block.color = "black";
  return block;
}

const buildButton = (meshName: string, requestName: string, buttonText: string) => {
  const button = Button.CreateSimpleButton("button", buttonText);
  button.paddingTop = "5px";
  button.paddingRight = "5px";
  button.width = "120px";
  button.height = "30px";
  button.background = "black";
  button.onPointerClickObservable.add(() => ipcRenderer.send(meshName, requestName));
  return button;
}

const buildAngleSlider = (infobox: Infobox) => {
  const grid = new Grid("sliderGrid");
  grid.width = 1;
  grid.height = "35px";
  grid.paddingTop = "5px";
  grid.paddingBottom = "5px";
  const slider = new Slider("angleSlider");
  slider.minimum = -Math.PI;
  slider.maximum = Math.PI;
  slider.displayValueBar = false;
  grid.addControl(slider);
  const sliderThumb = Button.CreateSimpleButton("sliderThumb", "∠");
  sliderThumb.widthInPixels = slider.thumbWidthInPixels;
  sliderThumb.thickness = 0;
  sliderThumb.isEnabled = false;
  grid.addControl(sliderThumb);
  slider.onPointerDownObservable.add(() => slider.displayValueBar = true);
  slider.onPointerUpObservable.add(() => slider.displayValueBar = false);
  slider.onValueChangedObservable.add((value) => {
    sliderThumb.leftInPixels = value/(slider.maximum - slider.minimum)*(slider.widthInPixels - slider.thumbWidthInPixels);
    if(!slider.displayValueBar) return;
    infobox.angleText.text = "req. angle:" + printDegree(value);
    ipcRenderer.send(infobox.name, "requestRotation", value);
  });
  return grid;
}

const buildCorrectionSlider = (meshName: string, requestName: string, buttonText: string) => {
  const grid = new Grid("sliderGrid");
  grid.width = 1;
  grid.height = "35px";
  grid.paddingTop = "5px";
  grid.paddingBottom = "5px";
  const slider = new Slider("correctionSlider");
  slider.minimum = -100;
  slider.maximum = 100;
  slider.value = 0;
  grid.addControl(slider);
  const sliderThumb = Button.CreateSimpleButton("sliderThumb", buttonText);
  sliderThumb.widthInPixels = slider.thumbWidthInPixels;
  sliderThumb.thickness = 0;
  sliderThumb.isEnabled = false;
  grid.addControl(sliderThumb);
  slider.onValueChangedObservable.add((value) => {
    sliderThumb.leftInPixels = value/(slider.maximum - slider.minimum)*(slider.widthInPixels - slider.thumbWidthInPixels);
    ipcRenderer.send(meshName, requestName, value);
  });
  slider.onPointerUpObservable.add(() => slider.value = 0);
  return grid;
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
  var label = buildText(requestName);
  label.width = "200px";
  panel.addControl(label);
  return panel;
}

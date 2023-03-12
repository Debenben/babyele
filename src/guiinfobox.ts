import * as BABYLON from 'babylonjs';
import { Rectangle, Ellipse, Control, Slider, Checkbox, TextBlock, Button, StackPanel, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { printPosition, printDegree } from './tools';

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
  angleSlider: Container;
  rotValue: number;
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
      ipcRenderer.on('notifyTilt', this.updateTilt);
      this.angleSlider = buildAngleSlider(this);
      this.panel.addControl(this.angleSlider);
      ipcRenderer.on('notifyLegRotation', this.updateAngle);
      const syncButton = buildButton(this.name, "requestSync", "synchronize");
      const resetButton = buildButton(this.name, "requestReset", "reset");
      const grid = new Grid("hubColumn");
      grid.heightInPixels = syncButton.heightInPixels + 20;
      grid.widthInPixels = this.widthInPixels - 20;
      grid.addColumnDefinition(0.5);
      grid.addColumnDefinition(0.5);
      grid.addControl(syncButton, 0, 0);
      grid.addControl(resetButton, 0, 1);
      this.panel.addControl(grid);
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
        const slider = this.angleSlider.getChildByName("tiltSlider") as Container;
        slider.rotation = arg2 + Math.PI;
      }
      else {
        this.tiltText.text = "tilt:" + printPosition(new BABYLON.Vector3(arg2._x, arg2._y, arg2._z).scale(180/Math.PI));
      }
    }
  }
  updateRotation = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.rotationText.text = "rot.:" + printPosition(new BABYLON.Vector3(arg2._x, arg2._y, arg2._z).scale(180/Math.PI));
    }
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name || arg1 === this.name.replace("hub", "leg")) {
      this.positionText.text = "pos.:" + printPosition(new BABYLON.Vector3(arg2._x, arg2._y, arg2._z));
    }
  }
  updateAngle = (event, arg1, arg2) => {
    const slider = this.angleSlider.getChildByName("rotationSlider") as Container;
    const text = this.angleSlider.getChildByName("infoText") as TextBlock;
    if(arg1 === this.name) {
      this.scene.render(); // force calculation of slider.widthInPixels
      this.rotValue = arg2;
      slider.rotation = Math.PI - this.rotValue;
      if(text.color == "black") text.text = printDegree(this.rotValue);
    }
  }
}

const buildHeading = (infobox: Infobox) => {
  const heading = new Rectangle("headingBackground");
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
  button.thickness = 0
  button.onPointerEnterObservable.add(() => button.thickness = 1);
  button.onPointerOutObservable.add(() => button.thickness = 0);
  button.onPointerClickObservable.add(() => ipcRenderer.send(meshName, requestName));
  return button;
}

const buildAngleSlider = (infobox: Infobox) => {
  const gauge = new Container();
  gauge.widthInPixels = 0.8*infobox.widthInPixels;
  gauge.heightInPixels = 0.8*infobox.widthInPixels;
  gauge.paddingBottomInPixels = -0.1*infobox.widthInPixels;
  const innerRadius = 0.25*gauge.widthInPixels;
  const middleRadius = 0.375*gauge.widthInPixels;
  const outerRadius = 0.5*gauge.widthInPixels;

  const clip1 = new Container();
  clip1.widthInPixels = 2*outerRadius;
  clip1.heightInPixels = outerRadius;
  clip1.topInPixels = -0.5*outerRadius;
  const ellipse1 = new Ellipse();
  ellipse1.widthInPixels = 2*outerRadius;
  ellipse1.heightInPixels = 2*outerRadius;
  ellipse1.topInPixels = -clip1.topInPixels;
  ellipse1.thickness = outerRadius - middleRadius;
  ellipse1.color = "black";
  ellipse1.alpha = 0.6;
  clip1.addControl(ellipse1);
  gauge.addControl(clip1);

  const arrow1 = new Container("speedSlider");
  arrow1.widthInPixels = 2*outerRadius;
  arrow1.heightInPixels = 2*outerRadius;
  const clip2 = new Container();
  clip2.widthInPixels = 0.1*gauge.widthInPixels;
  clip2.heightInPixels = 0.5*gauge.widthInPixels;
  clip2.topInPixels = -0.65*gauge.widthInPixels;
  const rect1 = new Rectangle("speedRect");
  rect1.widthInPixels = gauge.widthInPixels*0.68;
  rect1.heightInPixels = gauge.widthInPixels*0.68;
  rect1.rotation = Math.PI/4;
  rect1.background = "black";
  rect1.color = "black";
  rect1.topInPixels = -clip2.topInPixels;
  clip2.addControl(rect1);
  arrow1.addControl(clip2);
  gauge.addControl(arrow1);

  const arrow2 = new Container("rotationSlider");
  arrow2.widthInPixels = 2*middleRadius;
  arrow2.heightInPixels = 2*middleRadius;
  const clip3 = new Container();
  clip3.widthInPixels = 0.1*gauge.widthInPixels;
  clip3.heightInPixels = 0.5*gauge.widthInPixels;
  clip3.topInPixels = -0.1*gauge.widthInPixels;
  const rect2 = new Rectangle("rotationRect");
  rect2.widthInPixels = gauge.widthInPixels*0.5;
  rect2.heightInPixels = gauge.widthInPixels*0.5;
  rect2.rotation = Math.PI/4;
  rect2.background = "black";
  rect2.color = "black";
  rect2.topInPixels = -0.52*gauge.widthInPixels;
  clip3.addControl(rect2);
  arrow2.addControl(clip3);
  gauge.addControl(arrow2);

  const ellipse3 = new Ellipse();
  ellipse3.widthInPixels = 2*innerRadius;
  ellipse3.heightInPixels = 2*innerRadius;
  ellipse3.thickness = 0.25*gauge.widthInPixels;
  ellipse3.color = "black";
  ellipse3.alpha = 0.6;
  gauge.addControl(ellipse3);

  const arrow3 = new Container("tiltSlider");
  arrow3.widthInPixels = 2*innerRadius;
  arrow3.heightInPixels = 2*innerRadius;
  const clip4 = new Container();
  clip4.widthInPixels = 0.1*gauge.widthInPixels;
  clip4.heightInPixels = 0.5*gauge.widthInPixels;
  clip4.topInPixels = -0.4*gauge.widthInPixels;
  const rect3 = new Rectangle();
  rect3.widthInPixels = gauge.widthInPixels*0.33;
  rect3.heightInPixels = gauge.widthInPixels*0.33;
  rect3.rotation = Math.PI/4;
  rect3.background = "black";
  rect3.color = "black";
  rect3.topInPixels = -clip4.topInPixels;
  clip4.addControl(rect3);
  arrow3.addControl(clip4);
  gauge.addControl(arrow3);

  const text = buildText("---");
  text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  gauge.addControl(text);

  const gaugeToRotation = (angle: number) => {
    return angle < -0.5*Math.PI ? -1.5*Math.PI - angle : 0.5*Math.PI - angle;
  }
  const gaugeToSpeed = (angle: number) => {
    return Math.round(100 + 200*angle/Math.PI);
  }
  const mouseOverlay = new Container();
  mouseOverlay.widthInPixels = gauge.widthInPixels;
  mouseOverlay.heightInPixels = gauge.heightInPixels;
  mouseOverlay.onPointerMoveObservable.add((vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = vec.y - mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)
    const angle = Math.atan2(yval, xval);
    if(radius < outerRadius && radius > middleRadius && angle < 0 && rect2.background == "black") {
      rect1.color = "lightgrey";
      ellipse1.alpha = 0.5;
      rect2.color = "black";
      ellipse3.alpha = 0.6;
      arrow1.rotation = angle + 0.5*Math.PI;
      arrow2.rotation = Math.PI - infobox.rotValue;
      text.color = "lightgrey";
      text.text = gaugeToSpeed(angle).toString();
      if(rect1.background != "black") {
        ipcRenderer.send(infobox.name, "requestRotationSpeed", gaugeToSpeed(angle));
      }
    }
    else if (radius < middleRadius && radius > innerRadius && rect1.background == "black") {
      rect1.color = "black";
      ellipse1.alpha = 0.6;
      rect2.color = "lightgrey";
      ellipse3.alpha = 0.5;
      arrow1.rotation = 0;
      arrow2.rotation = angle + 0.5*Math.PI;
      text.color = "lightgrey";
      text.text = printDegree(gaugeToRotation(angle));
      if(rect2.background != "black"){
        ipcRenderer.send(infobox.name, "requestRotation", gaugeToRotation(angle));
      }
    }
    else {
      rect1.color = "black";
      ellipse1.alpha = 0.6;
      rect2.color = "black";
      ellipse3.alpha = 0.6;
      arrow1.rotation = 0;
      arrow2.rotation = Math.PI - infobox.rotValue;
      text.color = "black";
      text.text = printDegree(infobox.rotValue);
    }
  });
  mouseOverlay.onPointerDownObservable.add((vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = vec.y - mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)
    const angle = Math.atan2(yval, xval);
    if(radius < outerRadius && radius > middleRadius && angle < 0) {
      rect1.background = infobox.color;
      ipcRenderer.send(infobox.name, "requestRotationSpeed", gaugeToSpeed(angle));
    }
    else if (radius < middleRadius && radius > innerRadius) {
      rect2.background = infobox.color;
      ipcRenderer.send(infobox.name, "requestRotation", gaugeToRotation(angle));
    }
  });
  mouseOverlay.onPointerUpObservable.add((vec) => {
    if(rect1.background == infobox.color) {
      rect1.background = "black";
      ipcRenderer.send(infobox.name, "requestRotationSpeed", 0);
    }
    rect2.background = "black";
  });
  gauge.addControl(mouseOverlay);
  return gauge;
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
  const label = buildText(requestName);
  label.width = "200px";
  panel.addControl(label);
  return panel;
}

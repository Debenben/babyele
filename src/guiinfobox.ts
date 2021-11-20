import * as BABYLON from 'babylonjs';
import { Rectangle, Control, Slider, TextBlock, Button, StackPanel, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';

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
  constructor(name: string, preview: boolean, scene: BABYLON.Scene) {
    super(name);
    this.scene = scene;
    this.widthInPixels = window.innerWidth > 650 ? 0.4*window.innerWidth : 260;
    this.adaptHeightToChildren = true;
    this.paddingLeft = 10; 
    this.paddingRight = 10; 
    this.paddingTop = 10; 
    this.paddingBottom = 10; 
    this.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.fillRectangle = new Rectangle("background");
    this.fillRectangle.alpha = 0.6;
    this.fillRectangle.color = "black";
    this.fillRectangle.thickness = 0;
    this.fillRectangle.cornerRadius = 5;
    this.isPointerBlocker = true;
    this.addControl(this.fillRectangle);
    this.panel = new StackPanel();
    this.addControl(this.panel);
    this.addControls();
    this.setPreview(preview);
  }
  setPreview(preview: boolean) {
    if(preview) {
      this.color = "rgb(60,215,60)";
    }
    else {
      this.color = "rgb(255,110,90)";
    }
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
      this.tiltText = buildText("tilt: --");
      ipcRenderer.on('notifyTilt', this.updateTilt);
      this.panel.addControl(this.tiltText);
      let sliderDest;
      if(this.name.endsWith("Center")) {
        sliderDest = "dog";
        this.rotationText = buildText("rotation: --");
        this.panel.addControl(this.rotationText);
        ipcRenderer.on('notifyDogRotation', this.updateRotation);
        ipcRenderer.on('notifyDogPosition', this.updatePosition);
        this.panel.addControl(buildCorrectionSlider(sliderDest, "requestRotationSpeedForward"));
        this.panel.addControl(buildCorrectionSlider(sliderDest, "requestRotationSpeedHeight"));
        this.panel.addControl(buildCorrectionSlider(sliderDest, "requestRotationSpeedSideways"));
      }
      else {
        sliderDest = this.name.replace("hub","leg");
        ipcRenderer.on('notifyLegPosition', this.updatePosition);
      }
      this.positionText = buildText("position: --");
      this.panel.addControl(this.positionText);
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedForward"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedHeight"));
      this.panel.addControl(buildCorrectionSlider(sliderDest, "requestPositionSpeedSideways"));
      ipcRenderer.send(sliderDest, "getProperties");
      ipcRenderer.send("getHubProperties");
    }
    else {
      this.angleText = buildText("current angle: " + (180*getLegRotation(this.name, this.scene)/Math.PI).toFixed(2) + "°");
      ipcRenderer.on('notifyLegRotation', this.updateAngle);
      this.panel.addControl(this.angleText);
      this.panel.addControl(buildAngleSlider(this));
      this.panel.addControl(buildResetButton(this.name));
      this.panel.addControl(buildText("power:"));
      this.panel.addControl(buildCorrectionSlider(this.name, "requestRotationSpeed"));
    }
  }
  removeControls() {
    if(this.name.startsWith("hub")) {
      ipcRenderer.removeListener('notifyBattery', this.updateBattery);
      ipcRenderer.removeListener('notifyRssi', this.updateRssi);
      ipcRenderer.removeListener('notifyTilt', this.updateTilt);
      if(this.name.endsWith("Center")) {
        ipcRenderer.removeListener('notifyDogPosition', this.updatePosition);
        ipcRenderer.removeListener('notifyDogRotation', this.updateRotation);
      }
      else {
        ipcRenderer.removeListener('notifyLegPosition', this.updatePosition);
      }
    }
    else {
      ipcRenderer.removeListener('notifyLegRotation', this.updateAngle);
    }
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
  updateTilt = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.tiltText.text = "tilt: " + arg2.x + "  " + arg2.y + "  " + arg2.z;
    }
  }
  updateRotation = (event, arg1, arg2) => {
    if(arg1 === "dog") {
      this.rotationText.text = "rotation: " + (180*arg2.forward/Math.PI).toFixed(0) + "  " + (180*arg2.height/Math.PI).toFixed(0) + "  " + (180*arg2.sideways/Math.PI).toFixed(0);
    } 
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name.replace("hub","leg") || (this.name.endsWith("Center") && arg1 === "dog")) {
      this.positionText.text = "position: " + arg2.forward.toFixed(0) + "  " + arg2.height.toFixed(0) + "  " + arg2.sideways.toFixed(0);
    }
  }
  updateAngle = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.angleText.text = "current angle: " + (180*arg2/Math.PI).toFixed(2) + "°";
    }
  }
}

const buildHeading = (infobox: Infobox) => {
  let heading = new Rectangle("headingBackground");
  heading.height = "30px";
  heading.color = "black";
  heading.thickness = 0;
  heading.alpha = 0.8;
  heading.cornerRadius = 5;
  const block = new TextBlock();
  block.text = infobox.name;
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.fontSize = 20;
  block.paddingLeft = "5px";
  block.color = "black";
  block.onPointerDownObservable.add((vec) => {
    ipcRenderer.emit('startGuiDrag', 'dragEvent', infobox, vec);
  });
  block.onPointerUpObservable.add((vec) => {
    ipcRenderer.emit('stopGuiDrag', 'dragEvent', infobox, vec);
  });
  block.onPointerEnterObservable.add(() => {
    heading.thickness = 1;
    infobox.fillRectangle.thickness = 1;
  });
  block.onPointerOutObservable.add(() => {
    heading.thickness = 0;
    infobox.fillRectangle.thickness = 0;
  });
  heading.addControl(block);
  const button = Button.CreateSimpleButton("closeButton","x");
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.width = "30px";
  button.height = "30px";
  button.paddingRight = "2px";
  button.paddingTop = "2px";
  button.color = "black";
  button.thickness = 0;
  button.onPointerEnterObservable.add(() => {
    button.thickness = 1;
  });
  button.onPointerOutObservable.add(() => {
    button.thickness = 0;
  });
  button.onPointerClickObservable.add(() => {
    ipcRenderer.emit("notifyState", "closeEvent", infobox.name, "online");
  });
  heading.addControl(button);
  return heading;
}

const buildText = (content: string) => {
  const block = new TextBlock();
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = content;
  block.height = "25px";
  block.paddingLeft = "5px";
  block.color = "black";
  return block;
}

const getLegRotation = (meshName: string, scene: BABYLON.Scene) => {
  if(scene) {
    const mesh = scene.getMeshByName(meshName);
    if(mesh) {
      if(meshName.endsWith("Mount")) {
        return mesh.rotation.x;
      }
      else {
        return mesh.rotation.z;
      }
    }
  }
}

const buildAngleSlider = (infobox: Infobox) => {
  const slider = new Slider();
  slider.height = "35px";
  slider.paddingTop = "5px";
  slider.paddingBottom = "5px";
  slider.thumbColor = "grey";
  slider.borderColor = "black";
  slider.displayValueBar = false;
  slider.minimum = -Math.PI;
  slider.maximum = Math.PI;
  slider.value = getLegRotation(infobox.name, infobox.scene);
  slider.onValueChangedObservable.add((value) => {
    infobox.angleText.text = "requested angle: " + (180*slider.value/Math.PI).toFixed(2) + "°";
  });
  slider.onPointerUpObservable.add(() => {
    ipcRenderer.send(infobox.name, "requestRotation", slider.value);
    ipcRenderer.send("requestMode", "MANUAL"); 
  });
  return slider;
}

const buildResetButton = (meshName: string) => {
  const button = Button.CreateSimpleButton("resetButton", "reset angle");
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.paddingTop = "5px";
  button.paddingRight = "5px";
  button.width = "120px";
  button.height = "30px";
  button.color = "black";
  button.background = "grey";
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send(meshName, "requestReset");
    ipcRenderer.send("requestMode", "MANUAL"); 
  });
  return button;
}

const buildCorrectionSlider = (meshName: string, requestName: string) => {
  const slider = new Slider();
  slider.height = "35px";
  slider.paddingTop = "5px";
  slider.paddingBottom = "5px";
  slider.minimum = -100;
  slider.maximum = 100;
  slider.value = 0;
  slider.displayValueBar = false;
  slider.thumbColor = "grey";
  slider.borderColor = "black";
  slider.onPointerDownObservable.add(() => {
    ipcRenderer.send("requestMode", "MANUAL"); 
  });
  slider.onValueChangedObservable.add((value) => {
    ipcRenderer.send(meshName, requestName, value);
  });
  slider.onPointerUpObservable.add(() => {
    slider.value = 0;
  });
  return slider;
}

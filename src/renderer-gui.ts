import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Rectangle, Control, Slider, TextBlock, Button, StackPanel } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Modes } from './param';
import * as Param from './param';

export class GuiTexture {
  scene: BABYLON.Scene;
  texture: AdvancedDynamicTexture;
  infobox: Infobox;
  modeSelection: StackPanel;
  modeDisplayButton: Button;
  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    this.modeDisplayButton = buildModeDisplayButton(this);
    this.texture.addControl(this.modeDisplayButton);
    this.modeSelection = buildModeSelection(this);
    this.texture.addControl(this.modeSelection);
  }
  removeInfobox() {
    if(this.infobox) {
      this.texture.removeControl(this.infobox);
      this.infobox.removeControls();
      this.infobox = null;
    }
  }
  showInfobox(meshName: string, preview: boolean) {
    if(this.infobox && this.infobox.name === meshName) {
      this.infobox.setPreview(preview);
      return;
    }
    else if (this.infobox) {
      this.removeInfobox();
    }
    this.infobox = new Infobox(meshName, preview, this.scene);
    this.texture.addControl(this.infobox);
  }  
}

class Infobox extends StackPanel {
  scene: BABYLON.Scene;
  batteryText: TextBlock;
  rssiText: TextBlock;
  tiltText: TextBlock;
  constructor(name: string, preview: boolean, scene: BABYLON.Scene) {
    super(name);
    this.scene = scene;
    this.setPreview(preview);
    this.width = "300px";
    this.height = "220px";
    this.alpha = 0.7;
    this.isPointerBlocker = true;
    this.shadowBlur = 15;
    this.paddingLeft = 10; 
    this.paddingRight = 10; 
    this.paddingTop = 10; 
    this.paddingBottom = 10; 
    this.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.addControl(buildHeading(name));
    this.addControls();
  }
  setPreview(preview: boolean) {
    if(preview) {
      this.background = "green";
    }
    else {
      this.background = "red";
    }
  }
  addControls() {
    if(this.name.endsWith("Hub")) {
      this.batteryText = buildText("battery: --");
      ipcRenderer.on('notifyBattery', this.updateBattery);
      this.addControl(this.batteryText);
      this.rssiText = buildText("rssi: --");
      ipcRenderer.on('notifyRssi', this.updateRssi);
      this.addControl(this.rssiText);
      this.tiltText = buildText("tilt: --");
      ipcRenderer.on('notifyTilt', this.updateTilt);
      this.addControl(this.tiltText);
      ipcRenderer.send("getHubProperties");
    }
    else {
      this.addControl(buildText("angle:"));
      this.addControl(buildAngleSlider(this));
      this.addControl(buildResetButton(this.name));
      this.addControl(buildText("power:"));
      this.addControl(buildCorrectionSlider(this.name));
    }
  }
  removeControls() {
    if(this.name.endsWith("Hub")) {
      ipcRenderer.removeListener('notifyBattery', this.updateBattery);
      ipcRenderer.removeListener('notifyRssi', this.updateRssi);
      ipcRenderer.removeListener('notifyTilt', this.updateTilt);
    }
  }
  updateBattery(event, arg1, arg2) {
    if(arg1 === this.name) {
      this.batteryText.text = "battery: " + String(arg2);
    }
  }
  updateRssi(event, arg1, arg2) {
    if(arg1 === this.name) {
      this.rssiText.text = "rssi: " + String(arg2);
    }
  }
  updateTilt(event, arg1, arg2) {
    if(arg1 === this.name) {
      this.tiltText.text = "tilt: " + arg2.x + " " + arg2.y + " " + arg2.z;
    }
  }
}

const buildHeading = (content: string) => {
  const heading = new TextBlock();
  heading.text = content;
  heading.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  heading.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  heading.height = "30px";
  heading.width = "260px";
  heading.fontSize = 20;
  return heading;
}

const buildText = (content: string) => {
  const block = new TextBlock();
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = content;
  block.height = "30px";
  block.width = "260px";
  return block;
}

const getLegRotation = (meshName: string, scene: BABYLON.Scene) => {
  if(scene) {
    const mesh = scene.getMeshByName(meshName);
    if(mesh) {
      return mesh.rotation.z;
    }
  }
}

const buildAngleSlider = (infobox: Infobox) => {
  const slider = new Slider();
  slider.height = "30px";
  slider.width = "260px";
  slider.minimum = -Math.PI;
  slider.maximum = Math.PI;
  slider.value = getLegRotation(infobox.name, infobox.scene);
  slider.onValueChangedObservable.add((value) => {
    //header
  });
  slider.onPointerUpObservable.add(() => {
    ipcRenderer.send(infobox.name, "requestRotation", slider.value);
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
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send(meshName, "requestReset");
  });
  return button;
}

const buildCorrectionSlider = (meshName: string) => {
  const slider = new Slider();
  slider.height = "30px";
  slider.width = "260px";
  slider.minimum = -100;
  slider.maximum = 100;
  slider.value = 0;
  slider.onValueChangedObservable.add((value) => {
    ipcRenderer.send(meshName, "requestPower", value);
  });
  slider.onPointerUpObservable.add(() => {
    slider.value = 0;
  });
  return slider;
}

const buildModeDisplayButton = (guiTexture) => {
  const button = Button.CreateSimpleButton("modeDisplayButton", String(Modes[Modes.OFFLINE]));
  button.width = "250px";
  button.paddingTop = "5px"
  button.height = "35px";
  button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  button.background = "grey";
  button.onPointerClickObservable.add(() => {
    if(guiTexture.modeSelection) {
      guiTexture.modeSelection.isVisible = !guiTexture.modeSelection.isVisible;
    }
  });
  ipcRenderer.on('notifyMode', (event, arg) => {
    button.textBlock.text = String(Modes[arg]);
  });
  return button;
}

const buildModeSelection = (guiTexture) => {
  const panel = new StackPanel("modeSelection");
  let keys = Object.keys(Modes).filter(k => typeof (Modes as any)[k] === 'number') as any;
  keys.forEach((key) => {
    panel.addControl(buildModeButton(Modes[key], guiTexture));
  });
  panel.zIndex = 10;
  panel.isPointerBlocker = true;
  panel.isVisible = false;
  return panel;
}

const buildModeButton = (mode, guiTexture) => {
  const button = Button.CreateSimpleButton("modeButton", String(Modes[mode]));
  button.width = "180px";
  button.paddingTop = "5px"
  button.height = "35px";
  button.background = "grey";
  button.color = "darkgrey";
  button.isEnabled = false;
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send("requestMode", mode); 
    guiTexture.modeSelection.isVisible = false;
  });
  ipcRenderer.on('notifyMode', (event, arg) => {
    if(Param.allowSwitch(arg, mode)) {
      button.color = "black";
      button.isEnabled = true;
    }
    else {
      button.color = "darkgrey";
      button.isEnabled = false;
    }
  });
  return button; 
}

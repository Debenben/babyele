import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Rectangle, Control, Slider, TextBlock, Button, StackPanel, ScrollViewer, InputText, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';

export class GuiTexture {
  scene: BABYLON.Scene;
  texture: AdvancedDynamicTexture;
  infobox: Infobox;
  modeSelection: Container;
  topMenu: Grid;
  dragHelper: DragHelper;
  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    this.topMenu = buildTopMenu(this);
    this.texture.addControl(this.topMenu);
    this.modeSelection = buildModeSelection(this);
    this.dragHelper = new DragHelper(this);
  }
  removeInfobox() {
    if(this.infobox) {
      this.texture.removeControl(this.infobox);
      this.infobox.removeControls();
      this.infobox = null;
    }
  }
  showInfobox(meshName: string, preview: boolean) {
    if(!meshName) {
      this.removeInfobox();
      return;
    }
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

class DragHelper extends Container {
  guiTexture: GuiTexture;
  container: Container;
  startPosition: BABYLON.Vector2;
  constructor(guiTexture: GuiTexture) {
    super();
    this.guiTexture = guiTexture;
    this.isVisible = false;
    this.isPointerBlocker = true;
    this.zIndex = 30;
    this.onPointerMoveObservable.add((vec) => {
      if(this.container && this.startPosition) {
        this.container.leftInPixels = vec.x - this.startPosition.x;
        this.container.topInPixels = vec.y - this.startPosition.y;
        ipcRenderer.emit("notifyGuiDrag", "dragEvent", vec.x, vec.y);
        if(!this.container.isVisible) {
          this.container.isVisible = true; // switch moveDummy to visible only on Pointer move
        }
      }
    });
    this.onPointerUpObservable.add((vec) => {
      //only used if stopDrag was not called by container.onPointerUpObservable
      this.stopDrag();
    });
    ipcRenderer.on("startGuiDrag", (event, original, startPosition, moveDummy) => {
      if(moveDummy) {
        this.startPosition = new BABYLON.Vector2(0.5*original.widthInPixels,0.5*original.heightInPixels);
        this.container = Button.CreateSimpleButton("moveDummy", original.textBlock.text);
        this.container.widthInPixels = original.widthInPixels;
        this.container.heightInPixels = original.heightInPixels;
        this.container.color = original.color;
        this.container.background = original.background;
        this.container.paddingTop = original.paddingTop;
        this.container.paddingLeft = original.paddingLeft;
        this.container.paddingRight = original.paddingRight;
        this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.container.scaleX = 0.9;
        this.container.scaleY = 0.9;
        this.container.isVisible = false; //switch to visible after Pointer move
        this.container.isEnabled = false;
        this.addControl(this.container);
      }
      else {
        this.container = original;
        this.startPosition = startPosition;
        this.startPosition.x -= this.container.leftInPixels;
        this.startPosition.y -= this.container.topInPixels;
      }
      this.isVisible = true;
      this.guiTexture.texture.addControl(this);
    });
    ipcRenderer.on("stopGuiDrag", () => {
      this.stopDrag();
    });
  }
  stopDrag = () => {
    this.removeControl(this.container);
    this.isVisible = false;
    this.container = null;
    this.guiTexture.texture.removeControl(this);
  }
}

class Infobox extends Container {
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

const buildTopMenu = (guiTexture: GuiTexture) => {
  const grid = new Grid("topMenu");
  grid.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  grid.paddingTop = "5px"
  grid.zIndex = 20;
  grid.heightInPixels = 35;
  grid.widthInPixels = 260;
  grid.addColumnDefinition(0.5);
  grid.addColumnDefinition(0.5);
  const modeDisplayButton = buildTopMenuButton("OFFLINE");
  modeDisplayButton.onPointerClickObservable.add(() => {
    guiTexture.modeSelection.isVisible = !guiTexture.modeSelection.isVisible;
    if(guiTexture.modeSelection.isVisible) {
      guiTexture.texture.addControl(guiTexture.modeSelection);
    }
    else {
      guiTexture.texture.removeControl(guiTexture.modeSelection);
    }
  });
  const addPoseButton = buildTopMenuButton("Save Position");
  addPoseButton.isEnabled = false;
  addPoseButton.color = "darkgrey";
  ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
    modeDisplayButton.textBlock.text = modeName;
    addPoseButton.isEnabled = !isKnown;
    if(isKnown) {
      modeDisplayButton.color = 'black';
      addPoseButton.color = "darkgrey";
    }
    else {
      modeDisplayButton.color = 'green';
      addPoseButton.color = "black";
    }
  });
  addPoseButton.onPointerClickObservable.add(() => {
    ipcRenderer.send('storePose', modeDisplayButton.textBlock.text);
  });
  grid.addControl(addPoseButton, 0, 0);
  grid.addControl(modeDisplayButton, 0, 1);
  return grid;
}

const buildTopMenuButton = (text: string) => {
  const button = Button.CreateSimpleButton("topMenuButton", text);
  button.color = "black";
  button.isEnabled = true;
  button.background = "grey";
  ipcRenderer.on('noitfyState', (event, arg1, arg2) => {
    if(arg1 === 'dog') {
      if(arg2 === 'offline') {
        button.isEnabled = false;
        button.color = "darkgrey";
      }
      else {
        button.isEnabled = true;
        button.color = "black";
      }
    }
  });
  return button;
}

const buildModeSelection = (guiTexture: GuiTexture) => {
  const selection = new Container("modeSelection");
  const rect = new Rectangle("modeBackground");
  rect.alpha = 0.8;
  rect.background = "black";
  rect.isPointerBlocker = true;
  rect.onPointerClickObservable.add(() => {
    selection.isVisible = false;
    guiTexture.texture.removeControl(selection);
  });
  selection.addControl(rect);
  const grid = new Grid("layout");
  grid.width = 0.7;
  grid.addColumnDefinition(0.5);
  grid.addColumnDefinition(0.5);
  grid.paddingTop = "50px";
  grid.paddingBottom = "20px";
  grid.isPointerBlocker = true;
  selection.addControl(grid);
  const modesScroll = new ScrollViewer("modesScroll");
  modesScroll.color = "#303030";
  const modesPanel = new StackPanel("modePanel");
  modesScroll.addControl(modesPanel);
  grid.addControl(modesScroll, 0, 0);
  const posesScroll = new ScrollViewer("posesScroll");
  posesScroll.color = "#303030";
  const posesPanel = new StackPanel("posesPanel");
  posesScroll.addControl(posesPanel);
  grid.addControl(posesScroll, 0, 1);
  ipcRenderer.on('notifyPosesAvailable', (event, poses) => {
    posesPanel.clearControls();
    posesPanel.addControl(buildPoseButton("OFFLINE"));
    for(let id in poses) {
      posesPanel.addControl(buildPoseButton(id));
    }
  });
  ipcRenderer.on('notifyMovesAvailable', (event, modes, enabled) => {
    modesPanel.clearControls();
    for(let id in modes) {
      modesPanel.addControl(buildModeButton(id, enabled, modes[id]));
    }
    modesPanel.addControl(buildInput());
  });
  selection.addControl(buildTrashIcon(selection));
  selection.zIndex = 10;
  selection.isVisible = false;
  return selection;
}

const buildModeButton = (modeName: string, enabled: boolean, poses: string[]) => {
  const container = new Container("modeContainer");
  container.paddingTop = "5px";
  container.paddingLeft = "5px";
  container.paddingRight = "5px";
  container.adaptHeightToChildren = true;
  const button = Button.CreateSimpleButton("modeButton", modeName);
  button.height = "25px";
  button.paddingRight = "25px";
  button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  button.background = "grey";
  button.onPointerDownObservable.add((vec) => {
    ipcRenderer.emit('startGuiDrag', 'dragEvent', button, vec, true);
    button.color = "red";
  });
  button.onPointerUpObservable.add((vec) => {
    ipcRenderer.emit('stopGuiDrag', 'dragEvent', button, vec);
    if(enabled) {
      button.color = "black";
    } 
    else {
      button.color = "darkgrey";
    }
  });
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send('requestMode', modeName);
  });
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send("requestMode", modeName); 
  });
  if(enabled) {
    button.color = "black";
  } 
  else {
    button.color = "darkgrey";
  }
  container.addControl(button);
  const expandView = buildExpandView(modeName, poses);
  const expand = Button.CreateSimpleButton("ModeExpand","v");
  expand.width = "25px";
  expand.height = "25px";
  expand.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  expand.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  expand.background = "grey";
  expand.color = "black";
  expand.onPointerClickObservable.add(() => {
    expandView.isVisible = !expandView.isVisible;
    if(expandView.isVisible) {
      expand.textBlock.text = "ʌ";
      expand.color = "green";
      container.addControl(expandView);
    }
    else {
      expand.textBlock.text = "v";
      expand.color = "black";
      container.removeControl(expandView);
    }
    return;
  });
  container.addControl(button);
  container.addControl(expand);
  return container; 
}

const buildPoseButton = (text: string) => {
  const button = Button.CreateSimpleButton("poseButton", text);
  button.paddingTop = "5px";
  button.paddingRight = "5px";
  button.paddingLeft = "5px";
  button.height = "30px";
  button.background = "grey";
  button.color = "black";
  button.onPointerDownObservable.add((vec) => {
    button.color = "red";
    ipcRenderer.emit('startGuiDrag', 'dragEvent', button, vec, true);
  });
  button.onPointerUpObservable.add((vec) => {
    button.color = "black";
    ipcRenderer.emit('stopGuiDrag', 'dragEvent', button, vec);
  });
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send('requestMode', text);
  });
  return button;
}

const buildExpandView = (moveName: string, poses: string[]) => {
  const panel = new StackPanel("expandPanel");
  panel.paddingTop = "25px";
  panel.background = "#303030";
  panel.isVisible = false;
  for(let poseName of poses) {
    panel.addControl(buildPoseButton(poseName));
  }
  const spacer = new Rectangle("spacer");
  spacer.color = "transparent";
  spacer.height = "10px";
  panel.addControl(spacer);
  ipcRenderer.on('notifyGuiDrag', (event, vecx, vecy) => {
    if(!panel.isVisible) return;
    const coords = panel.getLocalCoordinates(new BABYLON.Vector2(vecx, vecy));
    if(coords.x > 0 && coords.x < panel.widthInPixels && coords.y > 0 && coords.y < panel.heightInPixels) {
      panel.background = "green";
    }
    else {
      panel.background = "lightgrey";
    }
  });
  ipcRenderer.on('stopGuiDrag', (event, control) => {
    if(!panel.isVisible) return;
    if(control && control.textBlock && panel.background == "green") {
      ipcRenderer.send('storeMove', moveName, poses.concat([control.textBlock.text]));
    }
    panel.background = "#303030";
  });
  return panel;
}

const buildInput = () => {
  const input = new InputText("input");
  input.height = "55px";
  input.width = 1;
  input.paddingTop = "20px";
  input.paddingRight = "5px";
  input.paddingLeft = "5px";
  input.paddingBottom = "10px";
  input.placeholderText = "+++ ADD NEW +++";
  input.background = "grey";
  input.color = "black";
  input.placeholderColor = "black";
  input.focusedBackground = "rgb(60,215,60)";
  input.onBlurObservable.add(() => {
    if(input.text) {
      ipcRenderer.send("storeMove", input.text, []);
      input.text = "";
    }
  });
  return input;
}

const buildTrashIcon = (modeSelection: Container) => {
  const button = Button.CreateSimpleButton("trashIcon", "🗑");
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  button.paddingRight = "10px";
  button.topInPixels = 50;
  button.width = 0.15;
  button.height = 0.25;
  button.color = "#303030";
  button.isEnabled = false;
  button.textBlock.fontSize = "90%";
  button.isPointerBlocker = true;
  ipcRenderer.on("notifyGuiDrag", (event, vecx, vecy) => {
    if(!modeSelection.isVisible) return;
    const coords = button.getLocalCoordinates(new BABYLON.Vector2(vecx, vecy));
    if(coords.x > 0 && coords.x < button.widthInPixels && coords.y > 0 && coords.y < button.heightInPixels) {
      button.color = "green";
    }
    else {
      button.color = "lightgrey";
    }
  });
  ipcRenderer.on("stopGuiDrag", (event, control) => {
    if(!modeSelection.isVisible) return;
    if(control && control.textBlock && button.color == "green") {
      ipcRenderer.send('deleteMode', control.textBlock.text);
    }
    button.color = "#303030";
  });
  return button;
}

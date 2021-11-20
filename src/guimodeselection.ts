import * as BABYLON from 'babylonjs';
import { Rectangle, Control, TextBlock, Button, StackPanel, ScrollViewer, InputText, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';

export class ModeSelection extends Container {
  constructor(guiTexture) {
    super();
    const rect = new Rectangle("modeBackground");
    rect.alpha = 0.8;
    rect.background = "black";
    rect.isPointerBlocker = true;
    rect.onPointerClickObservable.add(() => {
      guiTexture.texture.toggleModeSelectionVisibility();
    });
    this.addControl(rect);
    const grid = new Grid("layout");
    grid.width = 0.7;
    grid.addColumnDefinition(0.5);
    grid.addColumnDefinition(0.5);
    grid.paddingTop = "50px";
    grid.paddingBottom = "20px";
    grid.isPointerBlocker = true;
    this.addControl(grid);
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
    this.addControl(buildTrashIcon(this));
    this.zIndex = 10;
    this.isVisible = false;
  }
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

import * as BABYLON from 'babylonjs';
import { Rectangle, Control, TextBlock, Button, StackPanel, ScrollViewer, InputText, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Move, reservedNames } from './tools';

export class ModeSelection extends Container {
  modalBlocker : Rectangle
  layoutGrid: Grid
  trash: Button

  constructor() {
    super();
    this.name = "modeSelection"
    this.modalBlocker = buildModalBlocker();
    this.modalBlocker.onPointerClickObservable.add(() => {
      ipcRenderer.emit("toggleModeSelectionVisibility");
    });
    this.addControl(this.modalBlocker);
    this.layoutGrid = buildLayoutGrid();
    this.addControl(this.layoutGrid);
    this.trash = buildTrashIcon(this);
    this.addControl(this.trash);
    this.zIndex = 10;
    this.isVisible = false;
  }
}

class ModesScroll extends ScrollViewer {
  panel: StackPanel;

  constructor(isMovePanel: boolean) {
    super();
    this.name = "modesScroll";
    this.thickness = 0;
    this.color = "#303030";
    this.barColor = "#222222";
    this.verticalBar.onPointerEnterObservable.add(() => this.color = "grey");
    this.verticalBar.onPointerMoveObservable.add(() => this.color = "grey");
    this.verticalBar.onPointerOutObservable.add(() => this.color= "#303030");
    this.verticalBar.onPointerUpObservable.add(() => this.color= "#303030");
    if(isMovePanel) this.paddingBottom = "40px";
    this.panel = new StackPanel("modesPanel");
    this.addControl(this.panel);
    const channelName = isMovePanel? 'notifyMovesAvailable' : 'notifyPosesAvailable';
    ipcRenderer.on(channelName, (event, modes, enabled) => {
      if(isMovePanel) {
        updateMovesPanel(this.panel, modes, enabled);
      }
      else {
        updatePosesPanel(this.panel, reservedNames.concat(modes));
      }
    });
  }
}

class MoveButton extends Container {
  moveButton: Button
  moveButtonAvailable: boolean
  expandButton: Button
  expandView: ExpandView

  constructor(modeName: string, poses: string[], enabled: boolean) {
    super(modeName);
    this.moveButtonAvailable = enabled;
    this.paddingTop = "5px";
    this.paddingLeft = "5px";
    this.paddingRight = "5px";
    this.adaptHeightToChildren = true;
    this.moveButton = Button.CreateSimpleButton("moveButton", modeName);
    this.moveButton.height = "25px";
    this.moveButton.fontSize = "20px";
    this.moveButton.paddingRight = "25px";
    this.moveButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.moveButton.background = "grey";
    this.moveButton.onPointerDownObservable.add((vec) => {
      ipcRenderer.emit('startGuiDrag', 'dragEvent', this.moveButton, vec, true);
      this.moveButton.color = "red";
    });
    this.moveButton.onPointerUpObservable.add((vec) => {
      ipcRenderer.emit('stopGuiDrag', 'dragEvent', this.moveButton);
      this.updateMoveColor();
    });
    this.moveButton.onPointerClickObservable.add(() => {
      ipcRenderer.send('requestMode', modeName);
    });
    this.addControl(this.moveButton);
    this.expandButton = Button.CreateSimpleButton("expandMove","▼");
    this.expandButton.width = "25px";
    this.expandButton.height = "25px";
    this.expandButton.fontSize = "15px";
    this.expandButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.expandButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.expandButton.background = "grey";
    this.expandButton.color = "black";
    this.expandView = new ExpandView(modeName);
    this.update(poses, enabled);
    this.addControl(this.moveButton);
    this.addControl(this.expandButton);
    this.expandButton.onPointerClickObservable.add(() => {
      this.expandView.isVisible = !this.expandView.isVisible;
      if(this.expandView.isVisible) this.showExpandView()
      else this.removeExpandView();
    });
  }

  showExpandView = () => {
    ipcRenderer.on('notifyGuiDrag', this.expandView.onNotifyGuiDrag);
    ipcRenderer.on('stopGuiDrag', this.expandView.onStopGuiDrag);
    this.expandButton.textBlock.text = "▲";
    this.expandButton.color = "green";
    this.addControl(this.expandView);
  }

  removeExpandView = () => {
    ipcRenderer.removeListener('notifyGuiDrag', this.expandView.onNotifyGuiDrag);
    ipcRenderer.removeListener('stopGuiDrag', this.expandView.onStopGuiDrag);
    this.expandButton.textBlock.text = "▼";
    this.expandButton.color = "black";
    this.removeControl(this.expandView);
  }

  updateMoveColor = () => {
    if(this.moveButtonAvailable) {
      this.moveButton.color = "black";
    }
    else {
      this.moveButton.color = "darkgrey";
    }
  }

  update = (poses: string[], enabled: boolean) => {
    this.moveButtonAvailable = enabled;
    this.updateMoveColor();
    updatePosesPanel(this.expandView, poses);
    this.expandView.addControl(this.expandView.spacer);
  }
}

class ExpandView extends StackPanel {
  moveName: string;
  spacer: Rectangle;

  constructor(moveName: string) {
    super();
    this.name = "expandView";
    this.moveName = moveName;
    this.paddingTop = "25px";
    this.background = "#303030";
    this.isVisible = false;
    this.spacer = new Rectangle("spacer");
    this.spacer.height = "15px";
    this.spacer.paddingTop = "5px";
    this.spacer.paddingLeft = "5px";
    this.spacer.paddingRight = "5px";
    this.spacer.color = "transparent";
    this.spacer.background = "transparent";
  }

  onNotifyGuiDrag = (event, vec, scale) => {
    if(this.contains(vec.x, vec.y)) {
      const coords = this.getLocalCoordinates(vec);
      this.background = "green";
      const sectionHeight = 30; // height of poseButton
      const spacerLocation = Math.floor(coords.y/(sectionHeight*scale));
      this.updateSpacerLocation(spacerLocation);
      this.spacer.background = "red";
    }
    else {
      if(this.background === "green" || "#303030") {
        this.background = "lightgrey";
        this.spacer.background = "transparent";
        this.removeControl(this.spacer);
        this.addControl(this.spacer);
      }
    }
  }

  onStopGuiDrag = (event, control) => {
    let storeChanges = false;
    for(const item of this.children) {
      if(item.color === "red" && item.name !== "spacer") {
        storeChanges = true;
        this.removeControl(item);
      }
    }
    let poses = [];
    if(control && control.textBlock && this.background === "green") {
      storeChanges = true;
      poses = this.children.map(e => e.name === "spacer" ? control.textBlock.text : e.name);
    }
    else {
      poses = this.children.map(e => e.name);
      poses = poses.filter(e => e !== "spacer");
    }
    if(storeChanges) ipcRenderer.send('storeMove', this.moveName, poses);
    this.background = "#303030";
    this.spacer.background = "transparent";
  }

  updateSpacerLocation = (position: number) => {
    const temp = new StackPanel("temp");
    let pos = 0;
    for(const control of this.children) {
      if(control.name === "spacer") continue;
      if(pos === position) temp.addControl(this.spacer);
      temp.addControl(control);
      pos++;
    }
    if(pos === position) temp.addControl(this.spacer);
    this.clearControls();
    for(const control of temp.children) {
      this.addControl(control);
    }
  }
}

const updatePosesPanel = (panel: StackPanel, poseNames: string[]) => {
  panel.clearControls();
  for(const id of poseNames) {
    panel.addControl(buildPoseButton(id));
  }
}

const updateMovesPanel = (panel: StackPanel, moves: Record<string, Move>, enabled: Record<string, boolean>) => {
  const deleted = panel.children.filter(e => !moves.hasOwnProperty(e.name));
  deleted.forEach(e => {
    let move = e as MoveButton
    move.removeExpandView();
    move.expandView = null;
    panel.removeControl(move);
    move = null;
  });
  for(const id of Object.keys(moves)) {
    const move = panel.getChildByName(id);
    if(move) {
      (move as MoveButton).update(moves[id], enabled[id]);
    }
    else {
      panel.addControl(new MoveButton(id, moves[id], enabled[id]));
    }
  }
}

const buildLayoutGrid = () => {
  const grid = new Grid("layout");
  grid.widthInPixels = Math.min(Math.max(0.8*window.innerWidth, 300), 1000);
  window.addEventListener('resize', () => {
    grid.widthInPixels = Math.min(Math.max(0.8*window.innerWidth, 300), 1000);
  });
  grid.addColumnDefinition(0.45);
  grid.addColumnDefinition(0.1);
  grid.addColumnDefinition(0.45);
  grid.paddingTop = "40px";
  grid.paddingBottom = "20px";
  grid.isPointerBlocker = true;
  grid.addControl(new ModesScroll(true), 0, 0);
  grid.addControl(buildInput(), 0, 0);
  grid.addControl(new ModesScroll(false), 0, 2);
  return grid;
}

const buildModalBlocker = () => {
  const rect = new Rectangle("modalBlocker");
  rect.alpha = 0.8;
  rect.background = "black";
  rect.isPointerBlocker = true;
  return rect;
}

const buildPoseButton = (poseName: string) => {
  const button = Button.CreateSimpleButton(poseName, poseName);
  button.paddingTop = "5px";
  button.paddingRight = "5px";
  button.paddingLeft = "5px";
  button.height = "30px";
  button.fontSize = "20px";
  button.background = "grey";
  button.color = "black";
  button.onPointerDownObservable.add((vec) => {
    button.color = "red";
    ipcRenderer.emit('startGuiDrag', 'dragEvent', button, vec, true);
  });
  button.onPointerUpObservable.add((vec) => {
    button.color = "black";
    ipcRenderer.emit('stopGuiDrag', 'dragEvent', button);
  });
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send('requestMode', poseName);
  });
  return button;
}


const buildInput = () => {
  const input = new InputText("input");
  input.height = "30px";
  input.fontSize = "20px";
  input.width = 1;
  input.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  input.paddingRight = "5px";
  input.paddingLeft = "5px";
  input.placeholderText = "🞣";
  input.color = "white";
  input.focusedBackground = "green";
  input.onBlurObservable.add(() => {
    if(input.text) {
      ipcRenderer.send("storeMove", input.text, []);
      input.text = "";
    }
  });
  input.thickness = 0;
  input.onPointerEnterObservable.add(() => input.thickness = 1);
  input.onPointerOutObservable.add(() => input.thickness = 0);
  return input;
}

const buildTrashIcon = (modeSelection: Container) => {
  const button = Button.CreateSimpleButton("trashIcon", "🗑");
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  button.height = 0.15;
  button.color = "#303030";
  button.isEnabled = false;
  button.textBlock.fontSize = "80%";
  button.textBlock.textWrapping = false;
  button.textBlock.resizeToFit = true;
  button.adaptWidthToChildren = true;
  button.thickness = 0;
  ipcRenderer.on("notifyGuiDrag", (event, vec, scale) => {
    if(!modeSelection.isVisible) return;
    if(button.contains(vec.x, vec.y)) button.color = "red"
    else button.color = "lightgrey";
  });
  ipcRenderer.on("stopGuiDrag", (event, control) => {
    if(!modeSelection.isVisible) return;
    if(control && control.textBlock && button.color === "red" && event as any === "dragEvent") {
      ipcRenderer.send('deleteMode', control.textBlock.text);
    }
    button.color = "#303030";
  });
  return button;
}

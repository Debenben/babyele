import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Rectangle, Control, TextBlock, Button, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox } from './guiinfobox';
import { ModeSelection } from './guimodeselection';
import { reservedNames } from './tools';

export class GuiTexture {
  scene: BABYLON.Scene;
  texture: AdvancedDynamicTexture;
  infobox: Infobox;
  modeSelection: ModeSelection;
  topMenu: Grid;
  dragHelper: DragHelper;
  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.scene.onKeyboardObservable.add(onKeyPress);
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    this.topMenu = buildTopMenu();
    this.texture.addControl(this.topMenu);
    this.modeSelection = new ModeSelection();
    this.dragHelper = new DragHelper(this);
    ipcRenderer.on("toggleModeSelectionVisibility", () => {
      this.toggleModeSelectionVisibility();
    });
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
  toggleModeSelectionVisibility() {
    this.modeSelection.isVisible = !this.modeSelection.isVisible;
    if(this.modeSelection.isVisible) {
      this.texture.addControl(this.modeSelection);
    }
    else {
      this.texture.removeControl(this.modeSelection);
    }
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
    this.onPointerDownObservable.add((vec) => {
      // used if stopDrag was not called by container.onPointerUpObservable
      // when dragging poses from moves, "dropClickEvent" does not delete pose
      ipcRenderer.emit('stopGuiDrag', 'dropClickEvent', this.container, vec);
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
    ipcRenderer.on("stopGuiDrag", () => this.stopDrag());
  }
  stopDrag = () => {
    this.removeControl(this.container);
    this.isVisible = false;
    this.guiTexture.texture.removeControl(this);
  }
}

const buildTopMenu = () => {
  const grid = new Grid("topMenu");
  grid.heightInPixels = 35;
  grid.widthInPixels = Math.min(Math.max(0.4*window.innerWidth, 300), 500);
  window.addEventListener('resize', () => {
    grid.widthInPixels = Math.min(Math.max(0.4*window.innerWidth, 300), 500);
  });
  grid.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  grid.zIndex = 20;
  grid.paddingTop = "5px";
  grid.isPointerBlocker = true;
  grid.addColumnDefinition(35, true);
  grid.addColumnDefinition(1.0);
  grid.addColumnDefinition(35, true);
  grid.color = "white";
  const modeDisplayButton = buildTopMenuButton(currentMode);
  modeDisplayButton.onPointerClickObservable.add(() => {
    ipcRenderer.emit("toggleModeSelectionVisibility");
  });
  const storePoseButton = buildTopMenuButton("🖫");
  const deletePoseButton = buildTopMenuButton("🗑");
  ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
    currentMode = modeName;
    modeDisplayButton.textBlock.text = modeName;
    storePoseButton.isVisible = !isKnown;
    deletePoseButton.isVisible = isKnown && !reservedNames.includes(modeName);
    if(isKnown) grid.color = "white"
    else grid.color = "green";
  });
  storePoseButton.onPointerClickObservable.add(() => {
    ipcRenderer.send('storePose', currentMode);
  });
  deletePoseButton.onPointerClickObservable.add(() => {
    ipcRenderer.send('deleteMode', currentMode);
  });
  deletePoseButton.onPointerEnterObservable.add(() => grid.color = "red");
  deletePoseButton.onPointerOutObservable.add(() => grid.color = "white");
  storePoseButton.isVisible = false;
  deletePoseButton.isVisible = false;
  grid.addControl(modeDisplayButton, 0, 1);
  grid.addControl(storePoseButton, 0, 2);
  grid.addControl(deletePoseButton, 0, 2);
  return grid;
}

const buildTopMenuButton = (displayText: string) => {
  const button = Button.CreateSimpleButton("topMenuButton", displayText);
  button.fontSize = "80%";
  button.thickness = 0;
  button.onPointerEnterObservable.add(() => button.thickness = 1);
  button.onPointerOutObservable.add(() => button.thickness = 0);
  return button;
}

const onKeyPress = (kbInfo: BABYLON.KeyboardInfo) => {
  switch (kbInfo.type) {
    case BABYLON.KeyboardEventTypes.KEYDOWN:
      switch (kbInfo.event.key) {
        case " ":
          ipcRenderer.send('requestMode', "BUTTON");
          break;
        case "PrintScreen":
          ipcRenderer.send('storePose', currentMode);
          break;
        case "Delete":
          ipcRenderer.send('deleteMode', currentMode);
          break;
        case "m":
        case "M":
          ipcRenderer.emit("toggleModeSelectionVisibility");
          break;
      }
    case BABYLON.KeyboardEventTypes.KEYUP:
      const value = kbInfo.type == BABYLON.KeyboardEventTypes.KEYDOWN ? 100 : 0
      switch (kbInfo.event.key) {
        case "a":
        case "A":
          ipcRenderer.send("dog", "requestPositionSpeedSideways", -value);
          break;
        case "d":
        case "D":
          ipcRenderer.send("dog", "requestPositionSpeedSideways", value);
          break;
        case "w":
        case "W":
          ipcRenderer.send("dog", "requestPositionSpeedForward", value);
          break;
        case "s":
        case "S":
          ipcRenderer.send("dog", "requestPositionSpeedForward", -value);
          break;
        case "CapsLock":
          ipcRenderer.send("dog", "requestPositionSpeedHeight", value);
          break;
        case "Shift":
          ipcRenderer.send("dog", "requestPositionSpeedHeight", -value);
          break;
      }
      break;
  }
}

let currentMode = "OFFLINE";

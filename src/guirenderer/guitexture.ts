import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Control, Button, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { GuiRenderer } from './guirenderer';
import { Infobox } from './infobox';
import { LegInfobox } from './leginfobox';
import { HubInfobox } from './hubinfobox';
import { DogInfobox } from './doginfobox';
import { ModeSelection } from './modeselection';
import { Settings } from './settings';
import { reservedNames } from '../tools';

export class GuiTexture {
  renderer: GuiRenderer;
  texture: AdvancedDynamicTexture;
  infobox: Infobox;
  modeSelection: ModeSelection;
  settings: Settings;
  topMenu: Grid;
  dragHelper: DragHelper;
  constructor(renderer: GuiRenderer) {
    this.renderer = renderer;
    this.renderer.scene.onKeyboardObservable.add(onKeyPress);
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, this.renderer.scene);
    this.texture.idealHeight = 600;
    this.topMenu = buildTopMenu(this);
    this.texture.addControl(this.topMenu);
    this.modeSelection = new ModeSelection();
    this.texture.addControl(this.modeSelection);
    this.settings = new Settings(renderer);
    this.texture.addControl(this.settings);
    this.dragHelper = new DragHelper(this);
  }
  getScale() {
    return this.texture.getSize().height/this.texture.idealHeight;
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
    if (this.infobox) {
      this.removeInfobox();
    }
    if(meshName.startsWith("leg")) {
      this.infobox = new LegInfobox(meshName, preview, this);
    }
    else if(meshName.startsWith("hub")) {
      this.infobox = new HubInfobox(meshName, preview, this);
    }
    else if(meshName === "dog") {
      this.infobox = new DogInfobox(meshName, preview, this);
    }
    else {
      this.infobox = new Infobox(meshName, preview, this);
    }
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
        this.container.leftInPixels = (vec.x - this.startPosition.x)/this.guiTexture.getScale();
        this.container.topInPixels = (vec.y - this.startPosition.y)/this.guiTexture.getScale();
        ipcRenderer.emit("notifyGuiDrag", "dragEvent", vec, this.guiTexture.getScale());
        if(!this.container.isVisible) {
          this.container.isVisible = true; // switch moveDummy to visible only on Pointer move
        }
      }
    });
    this.onPointerDownObservable.add(() => {
      // used if stopDrag was not called by container.onPointerUpObservable
      // when dragging poses from moves, "dropClickEvent" does not delete pose
      ipcRenderer.emit('stopGuiDrag', 'dropClickEvent', this.container);
      this.stopDrag();
    });
    ipcRenderer.on("startGuiDrag", (event, original, startPosition, moveDummy) => {
      if(moveDummy) {
        this.startPosition = new BABYLON.Vector2(original.widthInPixels,original.heightInPixels).scaleInPlace(0.5);
        this.container = original.clone();
        this.container.widthInPixels = original.widthInPixels; // fixed width
        this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.container.scaleX = 0.9/this.guiTexture.getScale();
        this.container.scaleY = 0.9/this.guiTexture.getScale();
        this.container.isVisible = false; // switch to visible after Pointer move
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

const buildTopMenu = (guiTexture : GuiTexture) => {
  const grid = new Grid("topMenu");
  grid.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  grid.heightInPixels = 35;
  grid.paddingTop = "5px";
  grid.paddingRight = "5px";
  grid.paddingLeft = "5px";
  grid.color = "lightgrey";
  grid.zIndex = 20;
  grid.addColumnDefinition(70, true);
  grid.addColumnDefinition(0.5);
  grid.addColumnDefinition(180, true);
  grid.addColumnDefinition(35, true);
  grid.addColumnDefinition(0.5);
  grid.addColumnDefinition(35, true);
  const modeDisplayButton = buildTopMenuButton(currentMode);
  modeDisplayButton.onPointerClickObservable.add(() => {
    guiTexture.modeSelection.isVisible = !guiTexture.modeSelection.isVisible;
    grid.isPointerBlocker = guiTexture.modeSelection.isVisible || guiTexture.settings.isVisible;
  });
  const storePoseButton = buildTopMenuButton("🖫");
  const deletePoseButton = buildTopMenuButton("🗑");
  ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
    currentMode = modeName;
    modeDisplayButton.textBlock.text = modeName;
    storePoseButton.isVisible = !isKnown;
    deletePoseButton.isVisible = isKnown && !reservedNames.includes(modeName);
    if(isKnown) grid.color = "lightgrey"
    else grid.color = "green";
  });
  let a = 0;
  const modeAnimation = () => {
    a += 0.2;
    modeDisplayButton.alpha = Math.sin(a)*0.2 + 0.8;
  };
  ipcRenderer.on('notifyModeQueue', (event, modeQueue) => {
    guiTexture.renderer.scene.onBeforeRenderObservable.removeCallback(modeAnimation);
    modeDisplayButton.alpha = 1;
    if(modeQueue.length) guiTexture.renderer.scene.onBeforeRenderObservable.add(modeAnimation);
  });
  storePoseButton.onPointerClickObservable.add(() => {
    ipcRenderer.send('storePose', currentMode);
  });
  deletePoseButton.onPointerClickObservable.add(() => {
    ipcRenderer.send('deleteMode', currentMode);
  });
  deletePoseButton.onPointerEnterObservable.add(() => grid.color = "red");
  deletePoseButton.onPointerOutObservable.add(() => grid.color = "lightgrey");
  storePoseButton.isVisible = false;
  deletePoseButton.isVisible = false;
  const settingsButton = buildTopMenuButton("⚙");
  settingsButton.onPointerClickObservable.add(() => {
    guiTexture.settings.isVisible = !guiTexture.settings.isVisible;
    grid.isPointerBlocker = guiTexture.modeSelection.isVisible || guiTexture.settings.isVisible;
    settingsButton.textBlock.rotation = guiTexture.settings.isVisible ? 0.2 : 0;
  });
  grid.addControl(modeDisplayButton, 0, 2);
  grid.addControl(storePoseButton, 0, 3);
  grid.addControl(deletePoseButton, 0, 3);
  grid.addControl(settingsButton, 0, 5);
  return grid;
}

const buildTopMenuButton = (displayText: string) => {
  const button = Button.CreateSimpleButton("topMenuButton", displayText);
  button.fontSize = "80%";
  button.color = "lightgrey";
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
        case "a":
        case "A":
          ipcRenderer.send("dog", "requestPositionSpeed", [0, 0, 100]);
          break;
        case "d":
        case "D":
          ipcRenderer.send("dog", "requestPositionSpeed", [0, 0, -100]);
          break;
        case "w":
        case "W":
          ipcRenderer.send("dog", "requestPositionSpeed", [100, 0, 0]);
          break;
        case "s":
        case "S":
          ipcRenderer.send("dog", "requestPositionSpeed", [-100, 0, 0]);
          break;
        case "CapsLock":
          ipcRenderer.send("dog", "requestPositionSpeed", [0, 100, 0]);
          break;
        case "Shift":
          ipcRenderer.send("dog", "requestPositionSpeed", [0, -100, 0]);
          break;
      }
      break;
    case BABYLON.KeyboardEventTypes.KEYUP:
      ipcRenderer.send("dog", "requestPositionSpeed", [0, 0, 0]);
      break;
  }
}

let currentMode = "OFFLINE";

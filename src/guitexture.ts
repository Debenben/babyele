import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Rectangle, Control, TextBlock, Button, Grid, Container } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox } from './guiinfobox';
import { ModeSelection } from './guimodeselection';

export class GuiTexture {
  scene: BABYLON.Scene;
  texture: AdvancedDynamicTexture;
  infobox: Infobox;
  modeSelection: ModeSelection;
  topMenu: Grid;
  dragHelper: DragHelper;
  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    this.topMenu = buildTopMenu(this);
    this.texture.addControl(this.topMenu);
    this.modeSelection = new ModeSelection(this);
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
    guiTexture.toggleModeSelectionVisibility();
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

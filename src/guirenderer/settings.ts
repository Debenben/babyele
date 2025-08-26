import { Container, Rectangle, SelectionPanel, CheckboxGroup } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { GuiRenderer } from './guirenderer';
import { jointNames, legNames } from '../tools';

export class Settings extends Container {
  modalBlocker : Rectangle
  selectionPanel : SelectionPanel

  constructor(renderer : GuiRenderer) {
    super();
    this.name = "settings"
    this.modalBlocker = buildModalBlocker();
    this.modalBlocker.onPointerClickObservable.add(() => {
      this.isVisible = false;
    });
    this.addControl(this.modalBlocker);
    this.selectionPanel = buildSelectionPanel(renderer);
    this.addControl(this.selectionPanel);
    this.zIndex = 10;
    this.isVisible = false;
  }
}

const buildSelectionPanel = (renderer : GuiRenderer) => {
  const checkboxGroup = new CheckboxGroup("Settings");
  checkboxGroup.header = "";
  checkboxGroup.addCheckbox("auto rotation", (checked) => {
    renderer.camera.useAutoRotationBehavior = checked;
  });
  checkboxGroup.addCheckbox("use tilt", (checked) => {
    renderer.useTilt = checked;
    ["dog"].concat(legNames).map(e => ipcRenderer.send(e, "getProperties"));
  });
  checkboxGroup.addCheckbox("adjust height", (checked) => {
    renderer.adjustHeight = checked;
  });
  checkboxGroup.addCheckbox("wireframe", (checked) => {
    renderer.greyMaterial.wireframe = checked;
    renderer.greenMaterial.wireframe = checked;
    renderer.pickMaterial.wireframe = checked;
    renderer.redMaterial.wireframe = checked;
  });
  checkboxGroup.addCheckbox("displacement lines", (checked) => {
    renderer.displacementLines.isVisible = checked;
  });
  checkboxGroup.addCheckbox("gravity lines", (checked) => {
    renderer.gravityLines.isVisible = checked;
  });
  checkboxGroup.addCheckbox("position lines", (checked) => {
    renderer.positionLines.isVisible = checked;
    renderer.defaultPositionLines.isVisible = checked;
  });
  checkboxGroup.addCheckbox("rotation plane", (checked) => {
    renderer.rotationPlane.setEnabled(checked);
  });
  checkboxGroup.addCheckbox("joint markers", (checked) => {
    jointNames.map(e => renderer.scene.getMeshByName(e).isVisible = checked);
  });
  checkboxGroup.addCheckbox("accelerations", (checked) => {
    legNames.map(e => renderer.scene.getMeshByName(e + "TopAcceleration").setEnabled(checked));
    legNames.map(e => renderer.scene.getMeshByName(e + "BottomAcceleration").setEnabled(checked));
    renderer.scene.getMeshByName("dogAcceleration").setEnabled(checked);
  });
  const panel = new SelectionPanel("panel", [checkboxGroup]);
  panel.isPointerBlocker = true;
  panel.thickness = 0;
  panel.width = "250px";
  panel.paddingTop = "40px";
  panel.adaptHeightToChildren = true;
  panel.verticalAlignment = Container.VERTICAL_ALIGNMENT_TOP;
  panel.color = "lightgrey";
  panel.fontSize = "20px";
  return panel;
}

const buildModalBlocker = () => {
  const rect = new Rectangle("modalBlocker");
  rect.alpha = 0.8;
  rect.background = "black";
  rect.isPointerBlocker = true;
  return rect;
}

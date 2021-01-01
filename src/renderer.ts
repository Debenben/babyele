import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Rectangle, Control, Slider, TextBlock, Button, StackPanel } from "babylonjs-gui";
import { Modes } from './consts';

export default class Renderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  advancedTexture: AdvancedDynamicTexture;
  infobox: StackPanel;
  modeSelection: StackPanel;
  modeDisplayButton: Button;
  greenMaterial: BABYLON.StandardMaterial;
  greyMaterial: BABYLON.StandardMaterial;
  redMaterial: BABYLON.StandardMaterial;

  createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
    this.canvas = canvas;
    this.engine = engine;
    const scene = new BABYLON.Scene(engine);
    scene.onPointerDown = selectItem;
    this.scene = scene;

    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/2, Math.PI/2.5, 12, new BABYLON.Vector3(0,3,0), scene);
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    const ground = buildGround(scene);
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);

    this.greyMaterial = new BABYLON.StandardMaterial("greyMat", scene);
    this.greyMaterial.diffuseColor = new BABYLON.Color3(0.2,0.2,0.2);
    this.greenMaterial = new BABYLON.StandardMaterial("greenMat", scene);
    this.greenMaterial.diffuseColor = new BABYLON.Color3(0,1,0);
    this.redMaterial = new BABYLON.StandardMaterial("redMat", scene);
    this.redMaterial.diffuseColor = new BABYLON.Color3(1,0,0);

    const frontHub = buildHub(scene, "frontHub");
    frontHub.position.x = 1.5;
    frontHub.setPivotPoint(new BABYLON.Vector3(-1.5,0,0));
    const backHub = buildHub(scene, "backHub");
    backHub.position.x = -1.5;
    backHub.setPivotPoint(new BABYLON.Vector3(1.5,0,0));

    const legFrontLeft = buildLeg(scene, "legFrontLeft");
    legFrontLeft.position.x = 0.7;
    legFrontLeft.position.z = 1.2;
    legFrontLeft.parent = frontHub;
    const legFrontRight = buildLeg(scene, "legFrontRight");
    legFrontRight.position.x = 0.7;
    legFrontRight.position.z = -1.2;
    legFrontRight.parent = frontHub;
    const legBackLeft = buildLeg(scene, "legBackLeft");
    legBackLeft.position.x = -0.7;
    legBackLeft.position.z = 1.2;
    legBackLeft.parent = backHub;
    const legBackRight = buildLeg(scene, "legBackRight");
    legBackRight.position.x = -0.7;
    legBackRight.position.z = -1.2;
    legBackRight.parent = backHub;
  }

  setHubTilt(meshName: string, tilt) {
    const mesh = this.scene.getMeshByName(meshName);
    mesh.rotation.z = tilt.z;
    mesh.rotation.y = tilt.y;
    mesh.rotation.x = tilt.x;
  }

  getLegRotation(meshName: string) {
    const mesh = this.scene.getMeshByName(meshName);
    return mesh.rotation.z;
  }

  setLegRotation(meshName: string, rotation: number) {
    const mesh = this.scene.getMeshByName(meshName);
    mesh.rotation.z = rotation;
  }

  setState(meshName: string, state: string) {
    const mesh = this.scene.getMeshByName(meshName);
    if(!mesh) {
      console.log(meshName + " not found");
    }
    switch(state) {
      case "select":
        mesh.material = this.redMaterial;
        mesh.isPickable = true;
        this.infobox = buildInfoBox(meshName);
        this.advancedTexture.addControl(this.infobox);
        break;
      case "offline":
	if(this.infobox && this.infobox.name === meshName) {
	  this.advancedTexture.removeControl(this.infobox);
          this.infobox = null;
        }
        mesh.material = this.greyMaterial;
	mesh.isPickable = false;
	break;
      case "online":
      default:
	if(this.infobox && this.infobox.name === meshName) {
	  this.advancedTexture.removeControl(this.infobox);
          this.infobox = null;
        }
        mesh.material = this.greenMaterial;
        mesh.isPickable = true;
    }
  }

  initialize(canvas: HTMLCanvasElement) {
    const engine = new BABYLON.Engine(canvas, true);
    this.createScene(canvas, engine);

    engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', function () {
      engine.resize();
    });
    this.modeSelection = buildModeSelection();
    this.advancedTexture.addControl(this.modeSelection);
    this.modeDisplayButton = buildModeDisplayButton();
    this.advancedTexture.addControl(this.modeDisplayButton);
  }
}

const selectItem = (event, pickResult) => {
  if(pickResult.hit) {
    if(renderer.infobox) {
      if(pickResult.pickedMesh.name === renderer.infobox.name) {
	renderer.setState(renderer.infobox.name, "online");
        return;
      }
      renderer.setState(renderer.infobox.name, "online");
    }
    renderer.setState(pickResult.pickedMesh.name, "select");
  }
}

const buildInfoBox = (name: string) => {
  const box = new StackPanel(name);
  box.width = "300px";
  box.height = "120px";
  box.background = "red";
  box.alpha = 0.7;
  box.paddingLeft = 10; 
  box.paddingRight = 10; 
  box.paddingTop = 10; 
  box.paddingBottom = 10; 
  box.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  box.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  box.addControl(buildHeading(name));
  if(!name.endsWith("Hub")) {
    box.addControl(buildAngleSlider(name));
    box.addControl(buildCorrectionSlider(name));
  }
  return box;
}

const buildHeading = (content: string) => {
  const heading = new TextBlock();
  heading.text = content;
  heading.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  heading.height = "30px";
  heading.width = "260px";
  heading.fontSize = 20;
  return heading;
}

const buildAngleSlider = (meshName: string) => {
  const slider = new Slider();
  slider.height = "30px";
  slider.width = "260px";
  slider.paddingTop = "5px";
  slider.minimum = -Math.PI;
  slider.maximum = Math.PI;
  slider.value = renderer.getLegRotation(meshName);
  slider.onValueChangedObservable.add((value) => {
    //header
  });
  slider.onPointerUpObservable.add(() => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send(meshName, "requestRotation", slider.value);
  });
  return slider;
}

const buildCorrectionSlider = (meshName: string) => {
  const slider = new Slider();
  slider.height = "30px";
  slider.width = "260px";
  slider.paddingTop = "5px";
  slider.minimum = -100;
  slider.maximum = 100;
  slider.value = 0;
  slider.onValueChangedObservable.add((value) => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send(meshName, "requestPower", value);
  });
  slider.onPointerUpObservable.add(() => {
    slider.value = 0;
  });
  return slider;
}

const buildModeDisplayButton = () => {
  const button = Button.CreateSimpleButton("modeDisplayButton", "openSelection");
  button.width = "250px";
  button.height = "30px";
  button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  button.background = "grey";
  button.onPointerClickObservable.add(() => {
    if(renderer.modeSelection) {
      renderer.modeSelection.isVisible = !renderer.modeSelection.isVisible;
    }
  });
  return button;
}

const buildModeSelection = () => {
  const panel = new StackPanel("modeSelection");
  for (var val in Object.values(Modes)) {
    if(Modes[Number(val)]) {
      panel.addControl(buildModeButton(Number(val)));
    }
  }
  panel.isVisible = false;
  return panel;
}

const buildModeButton = (mode: number) => {
  const button = Button.CreateSimpleButton("modeButton", String(Modes[mode]));
  button.width = "180px";
  button.height = "30px";
  button.background = "grey";
  button.onPointerClickObservable.add(() => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send("requestMode", mode); 
    renderer.modeSelection.isVisible = false;
  });
  return button; 
}

const buildGround = (scene: BABYLON.Scene) => {
  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.1,0.3,0.1);
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:10,height:10}, scene);
  ground.material = groundMat;
  ground.isPickable = false;
  return ground;
}

const buildHub = (scene: BABYLON.Scene, meshName: string) => {
  const hub = BABYLON.MeshBuilder.CreateBox(meshName, {width:2.5, height:1.2, depth:2}, scene);
  hub.material = renderer.greyMaterial;
  hub.isPickable = false;
  hub.position.y = 3.85;
  return hub;
}

const buildLeg = (scene: BABYLON.Scene, meshName: string) => {
  const topLeg = BABYLON.MeshBuilder.CreateBox(meshName+"Top", {width:0.7, height:1.85, depth:0.4}, scene);
  topLeg.setPivotPoint(new BABYLON.Vector3(0,0.925,0));
  topLeg.material = renderer.greyMaterial;
  topLeg.isPickable = false;
  const bottomLeg = BABYLON.MeshBuilder.CreateBox(meshName+"Bottom", {width:0.6, height:2.0, depth:0.3}, scene);
  bottomLeg.setPivotPoint(new BABYLON.Vector3(0,1.0,0));
  bottomLeg.parent = topLeg;
  bottomLeg.position.y = -1.85;
  bottomLeg.material = renderer.greyMaterial;
  bottomLeg.isPickable = false;
  topLeg.position.y = -1.0;
  return topLeg;
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);

const { ipcRenderer } = require('electron');
ipcRenderer.on('notifyState', (event, arg1, arg2) => {
  renderer.setState(arg1, arg2);
});
ipcRenderer.on('notifyLegRotation', (event, arg1, arg2) => {
  renderer.setLegRotation(arg1, arg2);
});
ipcRenderer.on('notifyTilt', (event, arg1, arg2) => {
  renderer.setHubTilt(arg1, arg2);
});

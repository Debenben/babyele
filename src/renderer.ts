import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Rectangle, Control, Slider, TextBlock } from "babylonjs-gui";
import { Modes } from './consts';

export default class Renderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  advancedTexture: AdvancedDynamicTexture;
  label: Rectangle;
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
    const backHub = buildHub(scene, "backHub");
    backHub.position.x = -1.5;

    const legFrontLeft = buildLeg(scene, "legFrontLeft");
    legFrontLeft.position.x = 2.2;
    legFrontLeft.position.z = 1.2;
    const legFrontRight = buildLeg(scene, "legFrontRight");
    legFrontRight.position.x = 2.2;
    legFrontRight.position.z = -1.2;
    const legBackLeft = buildLeg(scene, "legBackLeft");
    legBackLeft.position.x = -2.2;
    legBackLeft.position.z = 1.2;
    const legBackRight = buildLeg(scene, "legBackRight");
    legBackRight.position.x = -2.2;
    legBackRight.position.z = -1.2;
  }

  setLegRotation(meshName: string, rotation: number) {
    const mesh = this.scene.getMeshByName(meshName);
    mesh.rotation.z = rotation;
  }

  setState(meshName: string, state: string) {
    const mesh = this.scene.getMeshByName(meshName);
    switch(state) {
      case "select":
        mesh.material = this.redMaterial;
        mesh.isPickable = true;
        break;
      case "offline":
        mesh.material = this.greyMaterial;
	mesh.isPickable = false;
	break;
      case "online":
      default:
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
  }
}

const selectItem = (event, pickResult) => {
  if(pickResult.hit) {
    if(renderer.label) {
      renderer.advancedTexture.removeControl(renderer.label);
      renderer.setState(renderer.label.name, "normal");
      if(renderer.label.name == pickResult.pickedMesh.name) {
        renderer.label = null;
        return;
      }
    }
    renderer.setState(pickResult.pickedMesh.name, "select");
    renderer.label = new Rectangle(pickResult.pickedMesh.name);
    renderer.label.height = "100px";
    renderer.label.width = "300px";
    renderer.label.background = "red";
    renderer.label.alpha = 0.8;
    renderer.label.cornerRadius = 10;
    renderer.label.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    renderer.label.top = "2%";
    renderer.advancedTexture.addControl(renderer.label);
    const text = new TextBlock();
    text.text = pickResult.pickedMesh.name;
    text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    text.top = "10%";
    renderer.label.addControl(text);
    const slider = new Slider();
    slider.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    slider.paddingBottom = "10%";
    slider.height = "30px";
    slider.width = "250px";
    slider.minimum = -100;
    slider.maximum = 100;
    slider.value = 0;
    slider.onValueChangedObservable.add((value) => {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send(pickResult.pickedMesh.name, "setPower", value);
    });
    slider.onPointerUpObservable.add(() => {
      slider.value = 0;
    });
    renderer.label.addControl(slider);
  }
}

const buildGround = (scene: BABYLON.Scene) => {
  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.1,0.4,0.1);
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:10,height:10}, scene);
  ground.material = groundMat;
  ground.isPickable = false;
  return ground;
}

const buildHub = (scene: BABYLON.Scene, meshName: string) => {
  const hub = BABYLON.MeshBuilder.CreateBox(meshName, {width:2.5, height:1.2, depth:2}, scene);
  hub.material = renderer.greyMaterial;
  hub.position.y = 4;
  hub.isPickable = false;
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
  topLeg.position.y = 3;
  return topLeg;
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);

const { ipcRenderer } = require('electron');
ipcRenderer.on('setState', (event, arg1, arg2) => {
  renderer.setState(arg1, arg2);
});
ipcRenderer.on('legRotation', (event, arg1, arg2) => {
  renderer.setLegRotation(arg1, arg2);
});

import * as BABYLON from 'babylonjs';

export default class Renderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  frontHub: BABYLON.Mesh;
  backHub: BABYLON.Mesh;
  greenMaterial: BABYLON.StandardMaterial;
  greyMaterial: BABYLON.StandardMaterial;

  createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
    this.canvas = canvas;
    this.engine = engine;
    const scene = new BABYLON.Scene(engine);
    this.scene = scene;

    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/2, Math.PI/2.5, 12, new BABYLON.Vector3(0,3,0), scene);
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    const ground = buildGround(scene);

    this.greyMaterial = new BABYLON.StandardMaterial("greyMat", scene);
    this.greyMaterial.diffuseColor = new BABYLON.Color3(0.2,0.2,0.2);
    this.greenMaterial = new BABYLON.StandardMaterial("greenMat", scene);
    this.greenMaterial.diffuseColor = new BABYLON.Color3(0,1,0);

    this.frontHub = buildHub(scene);
    this.frontHub.position.x = 1.5;
    this.backHub = buildHub(scene);
    this.backHub.position.x = -1.5;

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
    mesh.material = this.greenMaterial;
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

const buildGround = (scene: BABYLON.Scene) => {
  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.1,0.4,0.1);
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:10,height:10}, scene);
  ground.material = groundMat;
  return ground;
}

const buildHub = (scene: BABYLON.Scene) => {
  const hub = BABYLON.MeshBuilder.CreateBox("hub", {width:2.5, height:1.2, depth:2}, scene);
  hub.material = renderer.greyMaterial;
  hub.position.y = 4;
  return hub;
}

const buildLeg = (scene: BABYLON.Scene, meshName: string) => {
  const topLeg = BABYLON.MeshBuilder.CreateBox(meshName+"Top", {width:0.7, height:1.85, depth:0.4}, scene);
  topLeg.setPivotPoint(new BABYLON.Vector3(0,0.925,0));
  topLeg.material = renderer.greyMaterial;
  const bottomLeg = BABYLON.MeshBuilder.CreateBox(meshName+"Bottom", {width:0.6, height:2.0, depth:0.3}, scene);
  bottomLeg.setPivotPoint(new BABYLON.Vector3(0,1.0,0));
  bottomLeg.parent = topLeg;
  bottomLeg.position.y = -1.85;
  bottomLeg.material = renderer.greyMaterial;
  topLeg.position.y = 3;
  return topLeg;
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);

const { ipcRenderer } = require('electron');
ipcRenderer.on('frontHub', (event, arg) => {
  renderer.frontHub.material = renderer.greenMaterial;
});
ipcRenderer.on('backHub', (event, arg) => {
  renderer.backHub.material = renderer.greenMaterial;
});
ipcRenderer.on('legRotation', (event, arg1, arg2) => {
  console.log('event is ' + event);
  console.log('and arg is ' + arg1 + ' and ' + arg2);
  renderer.setLegRotation(arg1, arg2);
});

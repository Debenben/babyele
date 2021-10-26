import * as BABYLON from 'babylonjs';
import { ipcRenderer } from 'electron';
import { GuiTexture } from "./renderer-gui";
import { Modes } from './param';
import * as Param from './param';

export default class Renderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  actionManager: BABYLON.ActionManager;
  guiTexture: GuiTexture;
  greenMaterial: BABYLON.StandardMaterial;
  greyMaterial: BABYLON.StandardMaterial;
  redMaterial: BABYLON.StandardMaterial;
  selectedItem: string;
  selectedItemIsPreview: boolean;

  createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
    this.canvas = canvas;
    this.engine = engine;
    const scene = new BABYLON.Scene(engine);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0002;
    this.scene = scene;
    const glow = new BABYLON.GlowLayer("glow", scene);
    glow.intensity = 0.5;
    const background = buildBackground(scene, engine);
    const ground = buildGround(scene);
    scene.registerBeforeRender(() => {
      if(!this.selectedItem) {
        ground.rotation.y += 0.001;
      }
    });
    this.actionManager = new BABYLON.ActionManager(scene);
    this.guiTexture = new GuiTexture(scene);

    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/2, Math.PI/2.5, 900, new BABYLON.Vector3(0,250,0), scene);
    camera.attachControl(canvas, true);
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(1000, -2000, 1000), scene);
    dirLight.intensity = 0.2;
    const hemLight = new BABYLON.HemisphericLight("hemLight", new BABYLON.Vector3(0, 1, 0), scene);
    hemLight.intensity = 0.5;

    this.greyMaterial = new BABYLON.StandardMaterial("greyMat", scene);
    this.greyMaterial.diffuseColor = new BABYLON.Color3(0.5,0.5,0.5);
    this.greyMaterial.specularColor = new BABYLON.Color3(0.2,0.2,0.2);
    this.greenMaterial = new BABYLON.StandardMaterial("greenMat", scene);
    this.greenMaterial.diffuseColor = new BABYLON.Color3(0,1,0);
    this.greenMaterial.specularColor = new BABYLON.Color3(0.1,0.4,0.1);
    this.greenMaterial.emissiveColor = new BABYLON.Color3(0,0.05,0);
    this.redMaterial = new BABYLON.StandardMaterial("redMat", scene);
    this.redMaterial.diffuseColor = new BABYLON.Color3(1,0,0);
    this.redMaterial.specularColor = new BABYLON.Color3(0.4,0.1,0.1);
    this.redMaterial.emissiveColor = new BABYLON.Color3(0.05,0,0);

    const frontHub = buildHub(scene, "frontHub");
    frontHub.parent = ground;
    frontHub.position.x = 100;
    frontHub.setPivotPoint(frontHub.position.negate());
    const backHub = buildHub(scene, "backHub");
    backHub.parent = ground;
    backHub.position.x = -100;
    backHub.setPivotPoint(backHub.position.negate());

    const legFrontLeft = buildLeg(scene, "legFrontLeft");
    legFrontLeft.position.x = Param.LEG_SEPARATION_LENGTH/2 - frontHub.position.x;
    legFrontLeft.position.z = Param.LEG_SEPARATION_WIDTH/2;
    legFrontLeft.parent = frontHub;
    const legFrontRight = buildLeg(scene, "legFrontRight");
    legFrontRight.position.x = Param.LEG_SEPARATION_LENGTH/2 - frontHub.position.x;
    legFrontRight.position.z = -Param.LEG_SEPARATION_WIDTH/2;
    legFrontRight.parent = frontHub;
    const legBackLeft = buildLeg(scene, "legBackLeft");
    legBackLeft.position.x = -Param.LEG_SEPARATION_LENGTH/2 - backHub.position.x;
    legBackLeft.position.z = Param.LEG_SEPARATION_WIDTH/2;
    legBackLeft.parent = backHub;
    const legBackRight = buildLeg(scene, "legBackRight");
    legBackRight.position.x = -Param.LEG_SEPARATION_LENGTH/2 - backHub.position.x;
    legBackRight.position.z = -Param.LEG_SEPARATION_WIDTH/2;
    legBackRight.parent = backHub;

    const shadowCaster = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowCaster.addShadowCaster(frontHub);
    shadowCaster.addShadowCaster(backHub);
    shadowCaster.usePoissonSampling = true;
    shadowCaster.blurScale = 5;

    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickDownTrigger, selectItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, previewItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, unpreviewItem));
  }

  setHubTilt(meshName: string, tilt) {
    const mesh = this.scene.getMeshByName(meshName);
    mesh.rotation.z = Math.PI*tilt.z/180;
    mesh.rotation.y = Math.PI*tilt.y/180;
    mesh.rotation.x = Math.PI*tilt.x/180;
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
      return;
    }
    switch(state) {
      case "select":
        renderer.selectedItem = meshName;
        renderer.selectedItemIsPreview = false;
        mesh.material = this.redMaterial;
        mesh.isPickable = true;
        this.guiTexture.showInfobox(meshName, false);
        break;
      case "offline":
        if(renderer.selectedItem === meshName) {
          renderer.selectedItem = null;
          this.guiTexture.removeInfobox();
        }
        mesh.material = this.greyMaterial;
	mesh.isPickable = false;
        break;
      case "preview":
        renderer.selectedItem = meshName;
        renderer.selectedItemIsPreview = true;
        mesh.material = this.greenMaterial;
        mesh.isPickable = true;
        this.guiTexture.showInfobox(meshName, true);
        break;
      case "online":
      default:
        if(renderer.selectedItem === meshName) {
          renderer.selectedItem = null;
          this.guiTexture.removeInfobox();
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
  }
}

const selectItem = (event) => {
  if(renderer.selectedItem) {
    if(event.meshUnderPointer.name === renderer.selectedItem && !renderer.selectedItemIsPreview) {
      renderer.setState(renderer.selectedItem, "preview");
      return;
    }
    renderer.setState(renderer.selectedItem, "online");
  }
  renderer.setState(event.meshUnderPointer.name, "select");
}

const previewItem = (event) => {
  if(renderer.selectedItem) {
    if(!renderer.selectedItemIsPreview) {
      return;
    }
    renderer.setState(renderer.selectedItem, "online");
  }
  renderer.setState(event.meshUnderPointer.name, "preview");
}

const unpreviewItem = (event) => {
  if(renderer.selectedItem) {
    if(!renderer.selectedItemIsPreview) {
      return;
    }
    renderer.setState(renderer.selectedItem, "online");
  }
}

const buildBackground = (scene: BABYLON.Scene, engine: BABYLON.Engine) => {
  var rtt = new BABYLON.RenderTargetTexture("", 200, scene)
  var background = new BABYLON.Layer("back", null, scene);
  background.isBackground = true;
  background.texture = rtt;
  var renderImage = new BABYLON.EffectWrapper({
    engine: engine,
    fragmentShader: `
      varying vec2 vUV;
      void main(void) {
        gl_FragColor = vec4(0.1*vUV.x, 0.1*vUV.y, 0.2*vUV.y, 1.0);
      }
    `
  });
  renderImage.effect.executeWhenCompiled(() => {
    var effectRenderer = new BABYLON.EffectRenderer(engine);
    effectRenderer.render(renderImage, rtt);
  });
  return background;
}

const buildGround = (scene: BABYLON.Scene) => {
  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.1,0.2,0.2);
  groundMat.specularColor = new BABYLON.Color3(0,0.0,0.1);
  groundMat.alpha = 0.7;
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:800,height:800}, scene);
  ground.material = groundMat;
  ground.receiveShadows = true;
  ground.isPickable = false;
  return ground;
}

const buildHub = (scene: BABYLON.Scene, meshName: string) => {
  const hub = BABYLON.MeshBuilder.CreateBox(meshName, {width:200, height:100, depth:190}, scene);
  hub.position.y = Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM;
  hub.material = renderer.greyMaterial;
  hub.isPickable = false;
  hub.actionManager = renderer.actionManager;
  return hub;
}

const buildLeg = (scene: BABYLON.Scene, meshName: string) => {
  const topLeg = BABYLON.MeshBuilder.CreateBox(meshName+"Top", {width:70, height:Param.LEG_LENGTH_TOP, depth:40}, scene);
  topLeg.setPivotPoint(new BABYLON.Vector3(0,Param.LEG_LENGTH_TOP/2,0));
  topLeg.material = renderer.greyMaterial;
  topLeg.isPickable = false;
  topLeg.receiveShadows = true;
  topLeg.actionManager = renderer.actionManager;
  const bottomLeg = BABYLON.MeshBuilder.CreateBox(meshName+"Bottom", {width:60, height:Param.LEG_LENGTH_BOTTOM, depth:30}, scene);
  bottomLeg.setPivotPoint(new BABYLON.Vector3(0,Param.LEG_LENGTH_BOTTOM/2,0));
  bottomLeg.parent = topLeg;
  bottomLeg.position.y = -Param.LEG_LENGTH_TOP;
  bottomLeg.material = renderer.greyMaterial;
  bottomLeg.isPickable = false;
  bottomLeg.receiveShadows = true;
  bottomLeg.actionManager = renderer.actionManager;
  topLeg.position.y = -Param.LEG_LENGTH_BOTTOM/2;
  return topLeg;
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);

ipcRenderer.on('notifyState', (event, arg1, arg2) => {
  renderer.setState(arg1, arg2);
});
ipcRenderer.on('notifyLegRotation', (event, arg1, arg2) => {
  renderer.setLegRotation(arg1, arg2);
});
ipcRenderer.on('notifyTilt', (event, arg1, arg2) => {
  renderer.setHubTilt(arg1, arg2);
});
ipcRenderer.send("rendererInitialized");

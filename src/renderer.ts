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
  greyMaterial: BABYLON.StandardMaterial;
  greenMaterial: BABYLON.StandardMaterial;
  pickMaterial: BABYLON.StandardMaterial;
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
      setBodyHeight(scene);
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
    this.pickMaterial = new BABYLON.StandardMaterial("greenMat", scene);
    this.pickMaterial.diffuseColor = new BABYLON.Color3(0,1,0);
    this.pickMaterial.specularColor = new BABYLON.Color3(0,0,0);
    this.pickMaterial.emissiveColor = new BABYLON.Color3(0.1,0.2,0.1);
    this.redMaterial = new BABYLON.StandardMaterial("redMat", scene);
    this.redMaterial.diffuseColor = new BABYLON.Color3(1,0,0);
    this.redMaterial.specularColor = new BABYLON.Color3(0,0,0);
    this.redMaterial.emissiveColor = new BABYLON.Color3(0.2,0.1,0.1);

    const frontHub = buildBody(scene, "hubFrontCenter");
    frontHub.parent = ground;
    frontHub.position.x = Param.LEG_SEPARATION_LENGTH/2;
    frontHub.position.y = Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM;
    frontHub.setPivotPoint(frontHub.position.negate());
    const backHub = buildBody(scene, "hubBackCenter");
    backHub.parent = ground;
    backHub.position.x = -Param.LEG_SEPARATION_LENGTH/2;
    backHub.position.y = Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM;
    backHub.setPivotPoint(backHub.position.negate());

    const legFrontLeft = buildLeg(scene, "legFrontLeft");
    legFrontLeft.position.x = Param.LEG_SEPARATION_LENGTH/2 - frontHub.position.x;
    legFrontLeft.position.z = Param.LEG_SEPARATION_WIDTH/2;
    legFrontLeft.scaling.z = -1;
    legFrontLeft.parent = frontHub;
    const legFrontRight = buildLeg(scene, "legFrontRight");
    legFrontRight.position.x = Param.LEG_SEPARATION_LENGTH/2 - frontHub.position.x;
    legFrontRight.position.z = -Param.LEG_SEPARATION_WIDTH/2;
    legFrontRight.parent = frontHub;
    const legBackLeft = buildLeg(scene, "legBackLeft");
    legBackLeft.position.x = -Param.LEG_SEPARATION_LENGTH/2 - backHub.position.x;
    legBackLeft.position.z = Param.LEG_SEPARATION_WIDTH/2;
    legBackLeft.scaling.z = -1;
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

  setLegRotation(meshName: string, rotation: number) {
    const mesh = this.scene.getMeshByName(meshName);
    if(meshName.endsWith("Mount")) {
      mesh.rotation.x = rotation;
    }
    else {
      mesh.rotation.z = rotation;
    }
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
        mesh.material = this.pickMaterial;
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

const setBodyHeight = (scene: BABYLON.Scene) => {
  const frontHub = scene.getMeshByName('hubFrontCenter');
  const backHub = scene.getMeshByName('hubBackCenter');
  const shift = Math.min(getClearance(scene,'legFrontRightFoot') - 30, getClearance(scene,'legFrontLeftFoot') - 30, getClearance(scene,'legBackRightFoot') - 30, getClearance(scene,'legBackLeftFoot') - 30);
  frontHub.position.y -= shift;
  backHub.position.y -= shift;
}

const getClearance = (scene: BABYLON.Scene, meshName: string) => {
  const mesh = scene.getMeshByName(meshName);
  const ground = scene.getMeshByName('ground');
  const origin = mesh.position;
  const position = BABYLON.Vector3.TransformCoordinates(mesh.position, mesh.getWorldMatrix());
  return position.y;
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

const buildBody = (scene: BABYLON.Scene, meshName: string) => {
  const inner = BABYLON.MeshBuilder.CreateBox(meshName + "Inner", {width:120, height:120, depth:200}, scene);
  const outer = BABYLON.MeshBuilder.CreateBox(meshName + "Outer", {width:160, height:160, depth:160}, scene);
  outer.position.y = -30;
  outer.rotation.x = Math.PI/4;
  const innerCSG = BABYLON.CSG.FromMesh(inner);
  const outerCSG = BABYLON.CSG.FromMesh(outer);
  const bodyCSG = innerCSG.intersect(outerCSG);
  const body = bodyCSG.toMesh(meshName, null, scene);
  inner.dispose();
  outer.dispose();
  scene.removeMesh(inner);
  scene.removeMesh(outer);
  body.material = renderer.greyMaterial;
  body.isPickable = false;
  body.receiveShadows = true;
  body.actionManager = renderer.actionManager;
  return body;
}

const buildHub = (scene: BABYLON.Scene, meshName: string) => {
  const hub = BABYLON.MeshBuilder.CreateBox(meshName, {width:80, height:50, depth:60}, scene);
  hub.material = renderer.greyMaterial;
  hub.isPickable = false;
  hub.receiveShadows = true;
  hub.actionManager = renderer.actionManager;
  return hub;
}

const buildBone = ({width, height, depth}, scene: BABYLON.Scene) => {
  const rect = BABYLON.MeshBuilder.CreateBox("rect", {width:width, height:height, depth:depth}, scene);
  const topCyl = BABYLON.MeshBuilder.CreateCylinder("topCyl", {diameter:width, height:depth}, scene);
  topCyl.rotation.x = Math.PI/2;
  topCyl.position.y = height/2.0;
  topCyl.parent = rect;
  const bottomCyl = BABYLON.MeshBuilder.CreateCylinder("bottomCyl", {diameter:width, height:depth}, scene);
  bottomCyl.rotation.x = Math.PI/2;
  bottomCyl.position.y = -height/2.0;
  bottomCyl.parent = rect;
  const bone = BABYLON.Mesh.MergeMeshes([rect, topCyl, bottomCyl], true);
  bone.setPivotPoint(new BABYLON.Vector3(0,height/2,0));
  bone.material = renderer.greyMaterial;
  bone.isPickable = false;
  bone.receiveShadows = true;
  bone.actionManager = renderer.actionManager;
  return bone;
}

const buildLeg = (scene: BABYLON.Scene, meshName: string) => {
  const leg = new BABYLON.Mesh(meshName, scene);
  const mount = BABYLON.MeshBuilder.CreateBox(meshName + "Mount", {width:2*Param.LEG_MOUNT_HEIGHT, height:2*Param.LEG_MOUNT_HEIGHT, depth:Param.LEG_MOUNT_WIDTH}, scene);
  mount.parent = leg;
  mount.setPivotPoint(new BABYLON.Vector3(0,-Param.LEG_MOUNT_HEIGHT,Param.LEG_MOUNT_WIDTH/2));
  mount.position.z = Param.LEG_MOUNT_WIDTH/2;
  mount.material = renderer.greyMaterial;
  mount.isPickable = false;
  mount.receiveShadows = true;
  mount.actionManager = renderer.actionManager;
  const topLeg = buildBone({width:70, height:Param.LEG_LENGTH_TOP, depth:40}, scene);
  topLeg.name = meshName + "Top";
  topLeg.parent = mount;
  topLeg.position.z = -Param.LEG_MOUNT_WIDTH/2;
  const hub = buildHub(scene, meshName.replace("leg","hub"));
  hub.parent = topLeg;
  const bottomLeg = buildBone({width:60, height:Param.LEG_LENGTH_BOTTOM, depth:30}, scene);
  bottomLeg.name = meshName+"Bottom";
  bottomLeg.parent = topLeg;
  bottomLeg.position.y = -Param.LEG_LENGTH_TOP;
  topLeg.position.y = -Param.LEG_LENGTH_BOTTOM/2;
  const foot = new BABYLON.Mesh(meshName + "Foot", scene);
  foot.parent=bottomLeg;
  foot.position.y = -Param.LEG_LENGTH_BOTTOM/4;
  return leg;
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

import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { ipcRenderer } from 'electron';
import { GuiTexture } from "./guitexture";
import { legNames, jointNames, Vector3, Quaternion } from "../tools";
import * as Param from '../param';

export class Renderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.ArcRotateCamera;
  greyMaterial: BABYLON.PBRMetallicRoughnessMaterial;
  greenMaterial: BABYLON.PBRMetallicRoughnessMaterial;
  pickMaterial: BABYLON.PBRMetallicRoughnessMaterial;
  redMaterial: BABYLON.PBRMetallicRoughnessMaterial;
  actionManager: BABYLON.ActionManager;
  gravityLines: BABYLON.LinesMesh;
  displacementLines: BABYLON.LinesMesh;
  selectedItem: string;
  selectedItemIsPreview: boolean;
  useTilt = false;
  guiTexture: GuiTexture;

  async createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
    this.canvas = canvas;
    this.engine = engine;
    const scene = new BABYLON.Scene(engine);
    // scene.debugLayer.show();
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene = scene;

    const glow = new BABYLON.GlowLayer("glow", scene);
    glow.intensity = 0.5;
    buildBackground(scene, engine);
    buildGround(scene, engine);
    this.actionManager = new BABYLON.ActionManager(scene);
    this.guiTexture = new GuiTexture(this);

    const cameraCenter = new Vector3(0, Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM, 0).scale(0.5);
    this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/3, Math.PI/3, 3*Param.LEG_SEPARATION_LENGTH, cameraCenter, scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 0.5*Param.LEG_SEPARATION_LENGTH;
    this.camera.minZ = 0.1*this.camera.lowerRadiusLimit;
    this.camera.upperRadiusLimit = 5.0*Param.LEG_SEPARATION_LENGTH;
    this.camera.maxZ = 10*this.camera.upperRadiusLimit;
    this.camera.wheelPrecision = 10/this.camera.minZ;
    const dirLight = new BABYLON.DirectionalLight("dirLight", new Vector3(1, -2, 1).scale(Param.LEG_SEPARATION_LENGTH), scene);
    dirLight.intensity = 0.8;
    dirLight.parent = this.camera;
    const hemLight = new BABYLON.HemisphericLight("hemLight", new Vector3(0, 1, 0), scene);
    hemLight.intensity = 0.4;

    this.greyMaterial = new BABYLON.PBRMetallicRoughnessMaterial("greyMat", scene);
    this.greyMaterial.baseColor = new BABYLON.Color3(0.5,0.5,0.5);
    this.greenMaterial = new BABYLON.PBRMetallicRoughnessMaterial("greenMat", scene);
    this.greenMaterial.baseColor = new BABYLON.Color3(0.1,0.9,0.1);
    this.pickMaterial = new BABYLON.PBRMetallicRoughnessMaterial("pickMat", scene);
    this.pickMaterial.baseColor = new BABYLON.Color3(0.1,0.9,0.1);
    this.pickMaterial.emissiveColor = new BABYLON.Color3(0.01,0.1,0.01);
    this.redMaterial = new BABYLON.PBRMetallicRoughnessMaterial("redMat", scene);
    this.redMaterial.baseColor = new BABYLON.Color3(0.9,0.3,0.3);
    this.redMaterial.emissiveColor = new BABYLON.Color3(0.1,0.01,0.01);

    const dogScaling = new Vector3(Param.LEG_SEPARATION_WIDTH - Param.LEG_MOUNT_WIDTH, 4.0*Param.LEG_MOUNT_HEIGHT, Param.LEG_SEPARATION_LENGTH - 4.0*Param.LEG_MOUNT_HEIGHT);
    const dog = await importMesh(scene, "dog", "middle.glb", dogScaling);
    const dogAcceleration = await buildAcceleration(scene, "dog");
    dogAcceleration.parent = dog;
    dog.position.y = Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM;

    const axleScaling = new Vector3(4.0*Param.LEG_MOUNT_HEIGHT, 4.0*Param.LEG_MOUNT_HEIGHT, Param.LEG_SEPARATION_WIDTH - Param.LEG_MOUNT_WIDTH);
    const frontHub = await importMesh(scene, "hubFrontCenter", "axle.glb", axleScaling);
    frontHub.parent = dog;
    frontHub.position.z = Param.LEG_SEPARATION_LENGTH/2;
    frontHub.rotation.y = Math.PI/2;
    const backHub = await importMesh(scene, "hubBackCenter", "axle.glb", axleScaling);
    backHub.parent = dog;
    backHub.position.z = -Param.LEG_SEPARATION_LENGTH/2;
    backHub.rotation.y = -Math.PI/2;

    const legFrontLeft = await buildLeg(scene, "legFrontLeft");
    legFrontLeft.parent = frontHub;
    legFrontLeft.position = new Vector3(0, -Param.LEG_MOUNT_HEIGHT, -(Param.LEG_SEPARATION_WIDTH/2 - Param.LEG_MOUNT_WIDTH));
    const legFrontRight = await buildLeg(scene, "legFrontRight");
    legFrontRight.parent = frontHub;
    legFrontRight.position = new Vector3(0, -Param.LEG_MOUNT_HEIGHT, Param.LEG_SEPARATION_WIDTH/2 - Param.LEG_MOUNT_WIDTH);
    legFrontRight.rotation.y = Math.PI;
    const legBackLeft = await buildLeg(scene, "legBackLeft");
    legBackLeft.parent = backHub;
    legBackLeft.position = new Vector3(0, -Param.LEG_MOUNT_HEIGHT, Param.LEG_SEPARATION_WIDTH/2 - Param.LEG_MOUNT_WIDTH);
    legBackLeft.rotation.y = Math.PI;
    const legBackRight = await buildLeg(scene, "legBackRight");
    legBackRight.parent = backHub;
    legBackRight.position = new Vector3(0, -Param.LEG_MOUNT_HEIGHT, -(Param.LEG_SEPARATION_WIDTH/2 - Param.LEG_MOUNT_WIDTH));

    const shadowCaster = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowCaster.addShadowCaster(dog);
    shadowCaster.useCloseExponentialShadowMap = true;

    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickDownTrigger, selectItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, previewItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, unpreviewItem));

    this.gravityLines = await buildGravityLines(scene);
    this.displacementLines = await buildDisplacementLines(scene);
    scene.registerBeforeRender(() => {
      setBodyHeight(scene);
      if(this.gravityLines.isVisible) {
        BABYLON.MeshBuilder.CreateLineSystem("gravityLines", {lines: getGravityLinesPath(scene), instance: this.gravityLines}, scene);
      }
    });
  }

  setDogRotation(rotation: Vector3) {
    const dog = this.scene.getMeshByName("dogRoot");
    for(const i of ['x', 'y', 'z']) {
      if(!(rotation[i] === null)) dog.rotation[i] = rotation[i];
    }
  }

  setDogPosition(position: Vector3) {
    const dog = this.scene.getMeshByName("dogRoot");
    for(const i of ['x', 'y', 'z']) {
      if(!(position[i] === null)) dog.position[i] = position[i];
    }
  }

  setLegRotation(legName: string, rotation: Vector3) {
    this.scene.getMeshByName(legName + "MountRoot").rotation.x = rotation.x;
    this.scene.getMeshByName(legName + "TopRoot").rotation.z = rotation.y;
    this.scene.getMeshByName(legName + "BottomRoot").rotation.z = rotation.z;
  }

  setAcceleration(meshName: string, vec: Vector3) {
    const xangle = Math.atan2(vec.z, vec.y);
    const zangle = -Math.atan2(vec.x, vec.y*Math.cos(xangle) + vec.z*Math.sin(xangle));
    this.scene.getMeshByName(meshName + "Acceleration").rotation = new Vector3(xangle, 0, zangle);
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
        mesh.showBoundingBox = this.redMaterial.wireframe;
        mesh.isPickable = true;
        break;
      case "offline":
        if(renderer.selectedItem === meshName) {
          renderer.selectedItem = null;
        }
        mesh.material = this.greyMaterial;
        mesh.showBoundingBox = false;
        mesh.isPickable = false;
        break;
      case "preview":
        renderer.selectedItem = meshName;
        renderer.selectedItemIsPreview = true;
        mesh.material = this.pickMaterial;
        mesh.showBoundingBox = this.pickMaterial.wireframe;
        mesh.isPickable = true;
        break;
      case "online":
      default:
        if(renderer.selectedItem === meshName) {
          renderer.selectedItem = null;
        }
        mesh.material = this.greenMaterial;
        mesh.showBoundingBox = false;
        mesh.isPickable = true;
    }
    this.guiTexture.showInfobox(renderer.selectedItem, renderer.selectedItemIsPreview);
  }

  async initialize(canvas: HTMLCanvasElement) {
    const engine = new BABYLON.Engine(canvas, true);
    await this.createScene(canvas, engine);

    engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', () => {
      engine.resize();
    });
    ipcRenderer.send("rendererInitialized");
    engine.resize();
  }
}

const setBodyHeight = (scene: BABYLON.Scene) => {
  const dog = scene.getMeshByName('dogRoot');
  dog.position.y -= Math.min(...jointNames.map(e => getClearance(scene, e)));
}

const getClearance = (scene: BABYLON.Scene, meshName: string) => {
  const mesh = scene.getMeshByName(meshName);
  const position = Vector3.TransformCoordinates(new Vector3(0, 0, 0), mesh.getWorldMatrix());
  return position.y - Param.LEG_FOOT_DIAMETER/2;
}

const getProjection = (scene: BABYLON.Scene, meshName: string) => {
  const mesh = scene.getMeshByName(meshName);
  const position = Vector3.TransformCoordinates(new Vector3(0, 0, 0), mesh.getWorldMatrix());
  position.y = 0;
  return position;
}

const getGravityLinesPath = (scene: BABYLON.Scene) => {
  const system = [];
  for (const i in legNames) {
    for (const j in legNames) {
      if(i > j) system.push([i, j].map(e => getProjection(scene, legNames[e].concat('Foot'))));
    }
  }
  const dogProjection = getProjection(scene, 'dogRoot');
  system.push([dogProjection, dogProjection.add(new Vector3(0, Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM, 0))]);
  return system;
}

const getDisplacementLinesPath = () => {
  const system = [];
  for (let x=-12; x<=12; x++) {
    const path = [];
    path.push(new Vector3(x*Param.LEG_SEPARATION_LENGTH/12, 0, Param.LEG_SEPARATION_WIDTH));
    path.push(new Vector3(x*Param.LEG_SEPARATION_LENGTH/12, 0, -Param.LEG_SEPARATION_WIDTH));
    system.push(path);
  }
  return system;
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
    if(!renderer.selectedItemIsPreview) return;
    renderer.setState(renderer.selectedItem, "online");
  }
  renderer.setState(event.meshUnderPointer.name, "preview");
}

const unpreviewItem = () => {
  if(renderer.selectedItem) {
    if(!renderer.selectedItemIsPreview) return;
    renderer.setState(renderer.selectedItem, "online");
  }
}

const buildBackground = (scene: BABYLON.Scene, engine: BABYLON.Engine) => {
  const backTexture = new BABYLON.RenderTargetTexture("backgroundTexture", 400, scene)
  const background = new BABYLON.Layer("background", null, scene);
  background.isBackground = true;
  background.texture = backTexture;
  const renderImage = new BABYLON.EffectWrapper({
    engine,
    fragmentShader: `
      varying vec2 vUV;
      void main(void) {
        float rnd = abs(fract(sin(vUV.x)*sin(vUV.y)*9999999.9));
        gl_FragColor = vec4(vec3(0.5*vUV.x, 0.5*vUV.y, 1.0*vUV.y)*(0.2 + 0.02*rnd), 1.0);
      }
    `
  });
  renderImage.effect.executeWhenCompiled(() => {
    const effectRenderer = new BABYLON.EffectRenderer(engine);
    effectRenderer.render(renderImage, backTexture);
  });
  return background;
}

const buildGround = (scene: BABYLON.Scene, engine: BABYLON.Engine) => {
  const groundTexture = new BABYLON.RenderTargetTexture("groundTexture", 1200, scene)
  groundTexture.hasAlpha = true;
  const renderImage = new BABYLON.EffectWrapper({
    engine,
    fragmentShader: `
      varying vec2 vUV;
      void main(void) {
        float cx = vUV.x - 0.5;
        float cy = vUV.y - 0.5;
        float d = cx*cx + cy*cy;
        float lf = 20.0;
        float hf = 100.0;
        float rnd = abs(fract(sin(vUV.x)*sin(vUV.y)*9999999.9));
        vec4 lv = pow(cos(lf*cx)*cos(lf*cy), 800.0)*vec4(0.8, 0.8, 1.0, 1.0) * (1.0 - 16.0*d*d);
        vec4 hv = pow(cos(hf*cx)*cos(hf*cy), 80.0)*vec4(0.5, 0.6, 0.4, 1.0) * (1.0 - 16.0*d*d);
        vec4 gr = vec4(0.05, 0.1, 0.1, 1.0) * (1.0 - 0.1*rnd - 70.0*d*d);
        gl_FragColor = max(max(lv, hv), gr);
      }
    `
  });
  renderImage.effect.executeWhenCompiled(() => {
    const effectRenderer = new BABYLON.EffectRenderer(engine);
    effectRenderer.render(renderImage, groundTexture);
  });
  const groundMat = new BABYLON.PBRMetallicRoughnessMaterial("groundMat", scene);
  groundMat.baseTexture = groundTexture;
  groundMat.alphaCutOff = 0.4;
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:8*Param.LEG_SEPARATION_WIDTH, height:8*Param.LEG_SEPARATION_WIDTH}, scene);
  ground.material = groundMat;
  ground.receiveShadows = true;
  ground.isPickable = false;
  return ground;
}

const buildAcceleration = async (scene: BABYLON.Scene, meshName: string) => {
  const arrow = BABYLON.MeshBuilder.CreateCylinder(meshName + "Acceleration", {height: 3*Param.LEG_LENGTH_TOP, diameterTop: 0.04*Param.LEG_LENGTH_TOP, diameterBottom: 0});
  arrow.isPickable = false;
  const hubScaling = new Vector3(56, 40, 70).scale(Param.LEG_LENGTH_TOP/160);
  const hub = await importMesh(scene, meshName + "AccelerationHub", "hub.glb", hubScaling);
  hub.parent = arrow;
  hub.isPickable = false;
  arrow.setEnabled(false);
  return arrow;
}

const buildGravityLines = async (scene: BABYLON.Scene) => {
  const lines = BABYLON.MeshBuilder.CreateLineSystem("gravityLines", {lines: getGravityLinesPath(scene), updatable: true}, scene);
  lines.color = new BABYLON.Color3(0.9, 0.6, 0.6);
  lines.isVisible = false;
  return lines;
}

const buildDisplacementLines = async (scene: BABYLON.Scene) => {
  const lines = BABYLON.MeshBuilder.CreateLineSystem("displacementLines", {lines: getDisplacementLinesPath(), updatable: false}, scene);
  lines.color = new BABYLON.Color3(0.1, 0.3, 0.2);
  lines.isVisible = false;
  return lines;
}

const importMesh = async (scene: BABYLON.Scene, meshName: string, fileName: string, scaling: Vector3) => {
  const {meshes} = await BABYLON.SceneLoader.ImportMeshAsync("", "../public/", fileName, scene);
  meshes[0].name = meshName + "Root";
  meshes[0].rotation = new Vector3(0, 0, 0);
  meshes[0].scaling = new Vector3(1, 1, 1);
  meshes[1].name = meshName;
  meshes[1].scaling = scaling
  meshes[1].material.dispose();
  meshes[1].material = renderer.greyMaterial;
  meshes[1].isPickable = false;
  meshes[1].receiveShadows = true;
  meshes[1].actionManager = renderer.actionManager;
  return meshes[0];
}

const buildLeg = async (scene: BABYLON.Scene, meshName: string) => {
  const leg = new BABYLON.TransformNode(meshName);
  const mountScaling = new Vector3(2*Param.LEG_MOUNT_HEIGHT, 2*Param.LEG_MOUNT_HEIGHT, 2*Param.LEG_MOUNT_WIDTH);
  const mount = await importMesh(scene, meshName + "Mount", "mount.glb", mountScaling);
  mount.parent = leg;
  const shoulder = BABYLON.MeshBuilder.CreateSphere(meshName + "Shoulder", {diameter: Param.LEG_FOOT_DIAMETER}, scene);
  shoulder.parent = mount;
  shoulder.position = new Vector3(0, Param.LEG_MOUNT_HEIGHT, -Param.LEG_MOUNT_WIDTH);
  shoulder.isPickable = false;
  shoulder.isVisible = false;
  const topScaling = new Vector3(Param.LEG_LENGTH_TOP, Param.LEG_LENGTH_TOP, Param.LEG_MOUNT_WIDTH);
  const topLeg = await importMesh(scene, meshName + "Top", "upper.glb", topScaling);
  topLeg.parent = shoulder;
  const knee = BABYLON.MeshBuilder.CreateSphere(meshName + "Knee", {diameter: Param.LEG_FOOT_DIAMETER}, scene);
  knee.position.y = -Param.LEG_LENGTH_TOP;
  knee.parent = topLeg;
  knee.isPickable = false;
  knee.isVisible = false;
  const hubScaling = new Vector3(56, 40, 70).scale(Param.LEG_LENGTH_TOP/160);
  const hub = await importMesh(scene, meshName.replace("leg", "hub"), "hub.glb", hubScaling);
  hub.parent = topLeg;
  hub.position.y = -Param.LEG_LENGTH_TOP/2;
  hub.rotation = new Vector3(Math.PI/2, Math.PI, 0);
  const topAcceleration = await buildAcceleration(scene, meshName + "Top");
  topAcceleration.parent = hub;
  const bottomScaling = new Vector3(Param.LEG_LENGTH_BOTTOM, Param.LEG_LENGTH_BOTTOM, Param.LEG_MOUNT_WIDTH);
  const bottomLeg = await importMesh(scene, meshName + "Bottom", "lower.glb", bottomScaling);
  bottomLeg.parent = knee;
  const bottomAccelerometer = new BABYLON.TransformNode(meshName + "BottomAccelerometer");
  bottomAccelerometer.parent = bottomLeg;
  bottomAccelerometer.position.y = -Param.LEG_LENGTH_BOTTOM/2;
  bottomAccelerometer.rotation = new Vector3(Math.PI/2, Math.PI, 0);
  const bottomAcceleration = await buildAcceleration(scene, meshName + "Bottom");
  bottomAcceleration.parent = bottomAccelerometer;
  const foot = BABYLON.MeshBuilder.CreateSphere(meshName + "Foot", {diameter: Param.LEG_FOOT_DIAMETER}, scene);
  foot.position.y = -Param.LEG_LENGTH_BOTTOM;
  foot.parent = bottomLeg;
  foot.isPickable = false;
  foot.isVisible = false;
  return leg;
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('canvas') as HTMLCanvasElement);

ipcRenderer.on('notifyStatus', (event, arg1, arg2) => {
  renderer.setState(arg1, arg2 ? 'online' : 'offline');
});
ipcRenderer.on('notifyLegRotation', (event, arg1, arg2) => {
  if(renderer.useTilt) return;
  renderer.setLegRotation(arg1, Vector3.FromArray(arg2));
});
ipcRenderer.on('notifyTilt', (event, arg1, arg2) => {
  if(!renderer.useTilt) return;
  if(arg1 === "dog") {
    renderer.setDogRotation(new Vector3(arg2[0], null, arg2[2]));
  }
  else if(arg1.startsWith("leg")) {
    renderer.setLegRotation(arg1, Vector3.FromArray(arg2));
  }
});
ipcRenderer.on('notifyAcceleration', (event, arg1, arg2) => {
  renderer.setAcceleration(arg1, Vector3.FromArray(arg2));
});
ipcRenderer.on('notifyDogRotation', (event, arg1, arg2) => {
  if(!renderer.useTilt) {
    renderer.setDogRotation(Vector3.FromArray(arg2));
  }
  else renderer.setDogRotation(new Vector3(null, arg2[1], null));
});
ipcRenderer.on('notifyDogPosition', (event, arg1, arg2) => {
  renderer.setDogPosition(new Vector3(-arg2[0], null, -arg2[2]));
});
ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
  document.getElementById('title').innerHTML = "lego walker: " + modeName;
});


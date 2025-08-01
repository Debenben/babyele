import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { ipcRenderer } from 'electron';
import { GuiTexture } from "./guitexture";
import { legNames, jointNames, Vector3, Quaternion } from "../tools";
import * as Param from '../param';

export class GuiRenderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.ArcRotateCamera;
  greyMaterial: BABYLON.NodeMaterial;
  greenMaterial: BABYLON.NodeMaterial;
  pickMaterial: BABYLON.NodeMaterial;
  redMaterial: BABYLON.NodeMaterial;
  actionManager: BABYLON.ActionManager;
  gravityLines: BABYLON.LinesMesh;
  displacementLines: BABYLON.LinesMesh;
  positionLines: BABYLON.LinesMesh;
  defaultPositionLines: BABYLON.LinesMesh;
  selectedItem: string;
  selectedItemIsPreview: boolean;
  useTilt = false;
  adjustHeight = false;
  guiTexture: GuiTexture;

  async createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
    this.canvas = canvas;
    this.engine = engine;
    const scene = new BABYLON.Scene(engine);
    // scene.debugLayer.show();
    this.scene = scene;

    buildBackground(scene, engine);
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

    this.greyMaterial = await buildMaterial(scene, new BABYLON.Color3(0.1,0.1,0.1), new BABYLON.Color3(0.2,0.2,0.2));
    this.greenMaterial = await buildMaterial(scene, new BABYLON.Color3(0.05,0.4,0.05), new BABYLON.Color3(0.1,0.95,0.1));
    this.pickMaterial = await buildMaterial(scene, new BABYLON.Color3(0.1,0.9,0.1), new BABYLON.Color3(0.1,0.95,0.1));
    this.redMaterial = await buildMaterial(scene, new BABYLON.Color3(0.9,0.1,0.1), new BABYLON.Color3(0.95,0.1,0.1));

    const dogScaling = new Vector3(Param.LEG_SEPARATION_LENGTH - 4.0*Param.LEG_MOUNT_HEIGHT, 4.0*Param.LEG_MOUNT_HEIGHT, Param.LEG_SEPARATION_WIDTH - Param.LEG_MOUNT_WIDTH);
    const dog = await importMesh(scene, "dog", "middle.glb", dogScaling);
    const dogAcceleration = await buildAcceleration(scene, "dog");
    dogAcceleration.parent = dog;
    dog.position.y = Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM;

    const axleScaling = new Vector3(4.0*Param.LEG_MOUNT_HEIGHT, 4.0*Param.LEG_MOUNT_HEIGHT, Param.LEG_SEPARATION_WIDTH - Param.LEG_MOUNT_WIDTH);
    const frontHub = await importMesh(scene, "hubFrontCenter", "axle.glb", axleScaling);
    frontHub.parent = dog;
    frontHub.position.x = Param.LEG_SEPARATION_LENGTH/2;
    frontHub.rotation.y = Math.PI;
    const backHub = await importMesh(scene, "hubBackCenter", "axle.glb", axleScaling);
    backHub.parent = dog;
    backHub.position.x = -Param.LEG_SEPARATION_LENGTH/2;

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
    buildGround(scene, engine);

    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickDownTrigger, selectItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, previewItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, unpreviewItem));

    this.gravityLines = await buildGravityLines(scene);
    this.displacementLines = await buildDisplacementLines(scene);
    this.positionLines = await buildPositionLines(scene);
    this.positionLines.parent = dog;
    this.defaultPositionLines = await buildDefaultPositionLines(scene);
    this.defaultPositionLines.parent = dog;
    scene.registerBeforeRender(() => {
      if(this.adjustHeight) setBodyHeight(scene);
      if(this.gravityLines.isVisible) BABYLON.MeshBuilder.CreateLineSystem("gravityLines", {lines: getGravityLinesPath(scene), instance: this.gravityLines}, scene);
      if(this.positionLines.isVisible) BABYLON.MeshBuilder.CreateLineSystem("positionLines", {lines: getPositionLinesPath(scene), instance: this.positionLines}, scene);
      if(this.defaultPositionLines.isVisible) BABYLON.MeshBuilder.CreateLineSystem("defaultPositionLines", {lines: getDefaultPositionLinesPath(scene), instance: this.defaultPositionLines}, scene);
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
    const zangle = Math.atan2(vec.x, vec.y);
    const xangle = -Math.atan2(vec.z, Math.sqrt(vec.y**2 + vec.x**2));
    const rotation = Quaternion.FromEulerAngles(xangle, 0, zangle).invert().toEulerAngles();
    this.scene.getMeshByName(meshName + "Acceleration").rotation = rotation;
  }

  setFootPosition(meshName: string, vec: Vector3) {
    this.scene.getMeshByName(meshName + "Foot").position = vec;
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

const hubScaling = new Vector3(70, 40, 56).scale(Param.LEG_LENGTH_TOP/160);

const defaultRelativeLegPositions = [new Vector3( 0.5*Param.LEG_SEPARATION_LENGTH, 0.001,  0.5*Param.LEG_SEPARATION_WIDTH),
                                     new Vector3( 0.5*Param.LEG_SEPARATION_LENGTH, 0.001, -0.5*Param.LEG_SEPARATION_WIDTH),
                                     new Vector3(-0.5*Param.LEG_SEPARATION_LENGTH, 0.001,  0.5*Param.LEG_SEPARATION_WIDTH),
                                     new Vector3(-0.5*Param.LEG_SEPARATION_LENGTH, 0.001, -0.5*Param.LEG_SEPARATION_WIDTH)];

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
  system.push([dogProjection, dogProjection.add(new Vector3(0, Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM + 0.5*Param.LEG_FOOT_DIAMETER, 0))]);
  return system;
}

const getDisplacementLinesPath = () => {
  const system = [];
  for (let i=-10; i<=10; i++) {
    const zPath = [new Vector3(i*Param.LEG_SEPARATION_LENGTH/10, 0.001, -Param.LEG_SEPARATION_WIDTH)];
    zPath.push(new Vector3(i*Param.LEG_SEPARATION_LENGTH/10, 0.001, Param.LEG_SEPARATION_WIDTH));
    system.push(zPath);
    const xPath = [new Vector3(-Param.LEG_SEPARATION_LENGTH, 0.001, i*Param.LEG_SEPARATION_WIDTH/10)];
    xPath.push(new Vector3(Param.LEG_SEPARATION_LENGTH, 0.001, i*Param.LEG_SEPARATION_WIDTH/10));
    system.push(xPath);
  }
  return system;
}

const getPositionLinesPath = (scene: BABYLON.Scene) => {
  const system = [];
  const average = new Vector3(0, 0, 0);
  for (const i in legNames) {
    const mesh = scene.getMeshByName(legNames[i].concat('Foot'));
    average.addInPlace(mesh.position.scale(0.25));
  }
  for (const i in legNames) {
    const mesh = scene.getMeshByName(legNames[i].concat('Foot'));
    system.push([average, mesh.position]);
    system.push([new Vector3(0, 0, 0), mesh.position.subtract(average)]);
  }
  return system;
}

const getDefaultPositionLinesPath = (scene: BABYLON.Scene) => {
  const system = [];
  const average = new Vector3(0, 0, 0);
  for (const i in legNames) {
    const mesh = scene.getMeshByName(legNames[i].concat('Foot'));
    average.addInPlace(mesh.position.scale(0.25));
  }
  for (const i in legNames) {
    system.push([average, defaultRelativeLegPositions[i].add(average)]);
    system.push([new Vector3(0, 0, 0), defaultRelativeLegPositions[i]]);
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
      float noise(vec2 v) {
        vec2 i = floor(v);
        vec2 f = smoothstep(vec2(0.0), vec2(1.0), fract(v));
        float a = dot(i, vec2(1.0, 57.0)) + 1.0;
        float b = dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)) + 1.0;
        float c = dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0)) + 1.0;
        float d = dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)) + 1.0;
        return mix(mix(fract(sin(a)*43217.6543), fract(sin(b)*43217.6543), f.x), mix(fract(sin(c)*43217.6543), fract(sin(d)*43217.6543), f.x), f.y);
      }
      void main() {
        float n = noise(vUV*4.0) + 0.2*noise(vUV*12.0) + 0.04*noise(vUV*333.0);
        gl_FragColor = vec4(mix(vec3(0.01), vec3(0.2*vUV.x, 0.2*vUV.y, 0.4*vUV.y), n), 1.0);
      }
    `
  });
  renderImage.effect.executeWhenCompiled(() => {
    const effectRenderer = new BABYLON.EffectRenderer(engine);
    effectRenderer.render(renderImage, backTexture);
  });
  return background;
}

const buildGround = async (scene: BABYLON.Scene, engine: BABYLON.Engine) => {
  const radius = 4*Param.LEG_SEPARATION_WIDTH;
  const groundMat = await BABYLON.NodeMaterial.ParseFromFileAsync("groundMat", "../public/groundMaterial.json", scene);
  (groundMat.getBlockByName("BaseRadius") as BABYLON.InputBlock).value = radius;
  (groundMat.getBlockByName("XTicsSpacing") as BABYLON.InputBlock).value = 0.1*Param.LEG_SEPARATION_LENGTH;
  (groundMat.getBlockByName("ZTicsSpacing") as BABYLON.InputBlock).value = 0.1*Param.LEG_SEPARATION_WIDTH;
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:2*radius, height:2*radius}, scene);
  ground.material = groundMat;
  ground.receiveShadows = true;
  const reflectionTexture = new BABYLON.MirrorTexture("mirrorTexture", 1024, scene, true);
  reflectionTexture.mirrorPlane = BABYLON.Plane.FromPositionAndNormal(ground.position, ground.getFacetNormal(0).scale(-1));
  reflectionTexture.renderList = scene.getMeshByName("dogRoot").getChildMeshes().filter(m => !m.name.endsWith("Lines"));
  (groundMat.getBlockByName("Reflection") as BABYLON.ReflectionBlock).texture = reflectionTexture;
  scene.customRenderTargets.push(reflectionTexture);
  return ground;
}

const buildMaterial = async (scene: BABYLON.Scene, diffuseColor: BABYLON.Color3, lineColor: BABYLON.Color3) => {
  const material = await BABYLON.NodeMaterial.ParseFromFileAsync("gridMaterial", "../public/gridMaterial.json", scene);
  (material.getBlockByName("Line color") as BABYLON.InputBlock).value = lineColor;
  (material.getBlockByName("Diffuse color") as BABYLON.InputBlock).value = diffuseColor;
  return material;
}

const buildAcceleration = async (scene: BABYLON.Scene, meshName: string) => {
  const arrow = BABYLON.MeshBuilder.CreateCylinder(meshName + "Acceleration", {height: 3*Param.LEG_LENGTH_TOP, diameterTop: 0.04*Param.LEG_LENGTH_TOP, diameterBottom: 0});
  arrow.isPickable = false;
  const hub = await importMesh(scene, meshName + "AccelerationHub", "hub.glb", hubScaling);
  hub.parent = arrow;
  hub.isPickable = false;
  hub.getChildMeshes()[0].material = arrow.material;
  arrow.setEnabled(false);
  return arrow;
}

const buildGravityLines = async (scene: BABYLON.Scene) => {
  const lines = BABYLON.MeshBuilder.CreateLineSystem("gravityLines", {lines: getGravityLinesPath(scene), updatable: true}, scene);
  lines.color = new BABYLON.Color3(0.7, 0.6, 0.6);
  lines.isVisible = false;
  lines.material.depthFunction = BABYLON.Constants.ALWAYS;
  return lines;
}

const buildDisplacementLines = async (scene: BABYLON.Scene) => {
  const lines = BABYLON.MeshBuilder.CreateLineSystem("displacementLines", {lines: getDisplacementLinesPath(), updatable: false}, scene);
  lines.color = new BABYLON.Color3(0.3, 0.35, 0.3);
  lines.isVisible = false;
  lines.material.depthFunction = BABYLON.Constants.ALWAYS;
  return lines;
}

const buildPositionLines = async (scene: BABYLON.Scene) => {
  const lines = BABYLON.MeshBuilder.CreateLineSystem("positionLines", {lines: getPositionLinesPath(scene), updatable: true}, scene);
  lines.color = new BABYLON.Color3(0.3, 0.5, 0.8);
  lines.isVisible = false;
  lines.material.depthFunction = BABYLON.Constants.ALWAYS;
  return lines;
}

const buildDefaultPositionLines = async (scene: BABYLON.Scene) => {
  const lines = BABYLON.MeshBuilder.CreateLineSystem("defaultPositionLines", {lines: getDefaultPositionLinesPath(scene), updatable: true}, scene);
  lines.color = new BABYLON.Color3(0.8, 0.8, 0.2);
  lines.isVisible = false;
  lines.material.depthFunction = BABYLON.Constants.ALWAYS;
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
  const hub = await importMesh(scene, meshName.replace("leg", "hub"), "hub.glb", hubScaling);
  hub.parent = topLeg;
  hub.position.y = -Param.LEG_LENGTH_TOP/2;
  hub.rotation = new Vector3(0, Math.PI/2, -Math.PI/2);
  const topAcceleration = await buildAcceleration(scene, meshName + "Top");
  topAcceleration.parent = hub;
  const bottomScaling = new Vector3(Param.LEG_LENGTH_BOTTOM, Param.LEG_LENGTH_BOTTOM, Param.LEG_MOUNT_WIDTH);
  const bottomLeg = await importMesh(scene, meshName + "Bottom", "lower.glb", bottomScaling);
  bottomLeg.parent = knee;
  const bottomAccelerometer = new BABYLON.TransformNode(meshName + "BottomAccelerometer");
  bottomAccelerometer.parent = bottomLeg;
  bottomAccelerometer.position.y = -Param.LEG_LENGTH_BOTTOM/2;
  bottomAccelerometer.rotation = new Vector3(0, Math.PI/2, -Math.PI/2);
  const bottomAcceleration = await buildAcceleration(scene, meshName + "Bottom");
  bottomAcceleration.parent = bottomAccelerometer;
  const foot = BABYLON.MeshBuilder.CreateSphere(meshName + "Foot", {diameter: Param.LEG_FOOT_DIAMETER}, scene);
  foot.parent = scene.getMeshByName("dogRoot");
  //foot.parent = bottomLeg;
  //foot.position.y = -Param.LEG_LENGTH_BOTTOM;
  foot.isPickable = false;
  foot.isVisible = false;
  return leg;
}

const renderer = new GuiRenderer();
renderer.initialize(document.getElementById('canvas') as HTMLCanvasElement);

ipcRenderer.on('notifyStatus', (event, arg1, arg2) => {
  if(arg2 && renderer.selectedItem == arg1) return;
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
  if(renderer.adjustHeight) renderer.setDogPosition(new Vector3(-arg2[0], null, -arg2[2]));
  else renderer.setDogPosition(new Vector3(-arg2[0], 0.5*Param.LEG_FOOT_DIAMETER - arg2[1], -arg2[2]));
});
ipcRenderer.on('notifyMode', (event, modeName, isKnown) => {
  document.getElementById('title').innerHTML = "lego walker: " + modeName;
});
ipcRenderer.on('notifyLegPosition', (event, arg1, arg2) => {
  renderer.setFootPosition(arg1, Vector3.FromArray(arg2));
});

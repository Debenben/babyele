import * as BABYLON from 'babylonjs';
import { ipcRenderer } from 'electron';
import { GuiTexture } from "./guitexture";
import * as Param from './param';

export default class Renderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  greyMaterial: BABYLON.StandardMaterial;
  greenMaterial: BABYLON.StandardMaterial;
  pickMaterial: BABYLON.StandardMaterial;
  redMaterial: BABYLON.StandardMaterial;
  actionManager: BABYLON.ActionManager;
  gravityLines: BABYLON.LinesMesh;
  displacementLines: BABYLON.LinesMesh;
  selectedItem: string;
  selectedItemIsPreview: boolean;
  guiTexture: GuiTexture;

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
    const ground = buildGround(scene, engine);
    this.actionManager = new BABYLON.ActionManager(scene);
    this.guiTexture = new GuiTexture(scene);

    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/3, Math.PI/3, 1200, new BABYLON.Vector3(0,250,0), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 0.2;
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
    this.pickMaterial = new BABYLON.StandardMaterial("pickMat", scene);
    this.pickMaterial.diffuseColor = new BABYLON.Color3(0,1,0);
    this.pickMaterial.specularColor = new BABYLON.Color3(0,0,0);
    this.pickMaterial.emissiveColor = new BABYLON.Color3(0.1,0.2,0.1);
    this.redMaterial = new BABYLON.StandardMaterial("redMat", scene);
    this.redMaterial.diffuseColor = new BABYLON.Color3(1,0.2,0.2);
    this.redMaterial.specularColor = new BABYLON.Color3(0,0,0);
    this.redMaterial.emissiveColor = new BABYLON.Color3(0.3,0.1,0.1);

    const dog = buildBody(scene, "dog");
    dog.position.y = Param.LEG_LENGTH_TOP + Param.LEG_LENGTH_BOTTOM;
    dog.parent = ground;

    const frontHub = buildBody(scene, "hubFrontCenter");
    frontHub.parent = dog;
    frontHub.position.x = Param.LEG_SEPARATION_LENGTH/2;
    frontHub.setPivotPoint(frontHub.position.negate());
    const backHub = buildBody(scene, "hubBackCenter");
    backHub.parent = dog;
    backHub.position.x = -Param.LEG_SEPARATION_LENGTH/2;
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
    shadowCaster.addShadowCaster(dog);
    shadowCaster.useCloseExponentialShadowMap = true;

    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickDownTrigger, selectItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, previewItem));
    this.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, unpreviewItem));

    this.gravityLines = buildGravityLines(scene);
    this.displacementLines = buildDisplacementLines(scene);
    this.displacementLines.parent = ground;
    scene.registerBeforeRender(() => {
      setBodyHeight(scene);
      if(!this.selectedItem) {
        ground.rotation.y += 0.001;
        this.gravityLines.isVisible = false;
        this.displacementLines.isVisible = false;
      }
      else {
        if(!this.selectedItemIsPreview) {
          this.gravityLines.isVisible = true;
          this.displacementLines.isVisible = true;
        }
        this.gravityLines = BABYLON.Mesh.CreateLines(null, getGravityLinesPath(scene), null, null, this.gravityLines);
      }
    });
  }

  setTilt(meshName: string, tilt) {
    const mesh = this.scene.getMeshByName(meshName);
    const ground = this.scene.getMeshByName("ground");
    mesh.rotation = new BABYLON.Vector3(0, -ground.rotation.y, 0);
    mesh.rotate(BABYLON.Axis.X, tilt.forward, BABYLON.Space.WORLD);
    mesh.rotate(BABYLON.Axis.Z, tilt.sideways, BABYLON.Space.WORLD);
    mesh.rotate(BABYLON.Axis.Y, tilt.height + ground.rotation.y, BABYLON.Space.WORLD);
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
        break;
      case "offline":
        if(renderer.selectedItem === meshName) {
          renderer.selectedItem = null;
        }
        mesh.material = this.greyMaterial;
        mesh.isPickable = false;
        break;
      case "preview":
        renderer.selectedItem = meshName;
        renderer.selectedItemIsPreview = true;
        mesh.material = this.pickMaterial;
        mesh.isPickable = true;
        break;
      case "online":
      default:
        if(renderer.selectedItem === meshName) {
          renderer.selectedItem = null;
        }
        mesh.material = this.greenMaterial;
        mesh.isPickable = true;
    }
    this.guiTexture.showInfobox(renderer.selectedItem, renderer.selectedItemIsPreview);
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
  const dog = scene.getMeshByName('dog');
  const shift = Math.min(getClearance(scene,'legFrontRightFoot'), getClearance(scene,'legFrontLeftFoot'), getClearance(scene,'legBackRightFoot'), getClearance(scene,'legBackLeftFoot'));
  dog.position.y -= shift;
}

const getClearance = (scene: BABYLON.Scene, meshName: string) => {
  const mesh = scene.getMeshByName(meshName);
  const origin = mesh.position;
  const position = BABYLON.Vector3.TransformCoordinates(mesh.position, mesh.getWorldMatrix());
  return position.y - 45;
}

const getProjection = (scene: BABYLON.Scene, meshName: string) => {
  const mesh = scene.getMeshByName(meshName);
  if(!mesh) {
    console.log("cannot find " + meshName);
    return new BABYLON.Vector3(0,0,0);
  };
  const origin = mesh.position;
  let position = BABYLON.Vector3.TransformCoordinates(mesh.position, mesh.getWorldMatrix());
  position.y = 0;
  return position;
}

const getGravityLinesPath = (scene: BABYLON.Scene) => {
  let path = [];
  path.push(getProjection(scene, 'legBackLeftFoot'));
  path.push(getProjection(scene, 'legFrontLeftFoot'));
  path.push(getProjection(scene, 'legBackRightFoot'));
  path.push(getProjection(scene, 'legFrontRightFoot'));
  path.push(getProjection(scene, 'legBackLeftFoot'));
  path.push(getProjection(scene, 'legBackRightFoot'));
  path.push(getProjection(scene, 'legFrontLeftFoot'));
  path.push(getProjection(scene, 'legFrontRightFoot'));
  path.push(getProjection(scene, 'legBackLeftFoot'));
  return path;
}

const getDisplacementLinesPath = () => {
  let path = [];
  for (let x=-120; x<=120; x+=30) {
    path.push(new BABYLON.Vector3(Param.LEG_SEPARATION_LENGTH/2 + x,0,0));
    path.push(new BABYLON.Vector3(Param.LEG_SEPARATION_LENGTH/2 + x,0,Param.LEG_SEPARATION_WIDTH/2));
    path.push(new BABYLON.Vector3(Param.LEG_SEPARATION_LENGTH/2 + x,0,-Param.LEG_SEPARATION_WIDTH/2));
    path.push(new BABYLON.Vector3(Param.LEG_SEPARATION_LENGTH/2 + x,0,0));
    path.push(new BABYLON.Vector3(-Param.LEG_SEPARATION_LENGTH/2 + x,0,0));
    path.push(new BABYLON.Vector3(-Param.LEG_SEPARATION_LENGTH/2 + x,0,Param.LEG_SEPARATION_WIDTH/2));
    path.push(new BABYLON.Vector3(-Param.LEG_SEPARATION_LENGTH/2 + x,0,-Param.LEG_SEPARATION_WIDTH/2));
    path.push(new BABYLON.Vector3(-Param.LEG_SEPARATION_LENGTH/2 + x,0,0));
  }
  return path;
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
  const backTexture = new BABYLON.RenderTargetTexture("backgroundTexture", 400, scene)
  const background = new BABYLON.Layer("background", null, scene);
  background.isBackground = true;
  background.texture = backTexture;
  const renderImage = new BABYLON.EffectWrapper({
    engine: engine,
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
    engine: engine,
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
  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseTexture = groundTexture;
  groundMat.emissiveTexture = groundTexture;
  groundMat.alphaCutOff = 0.4;
  groundMat.useAlphaFromDiffuseTexture = true;
  groundMat.specularColor = new BABYLON.Color3(0,0.0,0.1);
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:2000,height:2000}, scene);
  ground.material = groundMat;
  ground.receiveShadows = true;
  ground.isPickable = false;
  return ground;
}

const buildGravityLines = (scene: BABYLON.Scene) => {
  const lines = BABYLON.Mesh.CreateLines("gravityLines", getGravityLinesPath(scene), scene, true);
  lines.color = new BABYLON.Color3(0.8, 0.2, 0.2);
  lines.isVisible = false;
  return lines;
}

const buildDisplacementLines = (scene: BABYLON.Scene) => {
  const lines = BABYLON.Mesh.CreateLines("displacementLines", getDisplacementLinesPath(), scene, true);
  lines.color = new BABYLON.Color3(0.4, 0.6, 0.6);
  lines.isVisible = false;
  return lines;
}

const buildBody = (scene: BABYLON.Scene, meshName: string) => {
  const inner = BABYLON.MeshBuilder.CreateBox(meshName + "Inner", {width:160, height:120, depth:200}, scene);
  const outer = BABYLON.MeshBuilder.CreateBox(meshName + "Outer", {width:180, height:160, depth:160}, scene);
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
  const hub = BABYLON.MeshBuilder.CreateBox(meshName, {width:80, height:120, depth:80}, scene);
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
  const topCSG = BABYLON.CSG.FromMesh(topCyl);
  const bottomCSG = BABYLON.CSG.FromMesh(bottomCyl);
  let rectCSG = BABYLON.CSG.FromMesh(rect);
  rectCSG = rectCSG.union(topCSG);
  rectCSG = rectCSG.union(bottomCSG);
  topCyl.dispose();
  rect.dispose();
  bottomCyl.dispose();
  scene.removeMesh(topCyl);
  scene.removeMesh(rect);
  scene.removeMesh(bottomCyl);
  const bone = rectCSG.toMesh("bone", null, scene);
  bone.setPivotPoint(new BABYLON.Vector3(0,height/2,0));
  bone.material = renderer.greyMaterial;
  bone.isPickable = false;
  bone.receiveShadows = true;
  bone.actionManager = renderer.actionManager;
  return bone;
}

const buildMount = (scene: BABYLON.Scene, meshName: string) => {
  const inner = BABYLON.MeshBuilder.CreateBox(meshName + "Inner", {width:140, height:125, depth:180}, scene);
  const outer = BABYLON.MeshBuilder.CreateBox(meshName + "Outer", {width:160, height:160, depth:160}, scene);
  outer.position.z = 60;
  const innerCSG = BABYLON.CSG.FromMesh(inner);
  const outerCSG = BABYLON.CSG.FromMesh(outer);
  outer.rotation.x = Math.PI/6;
  outer.position.z = -30;
  const rotCSG = BABYLON.CSG.FromMesh(outer);
  let mountCSG = innerCSG.intersect(outerCSG);
  mountCSG = mountCSG.intersect(rotCSG);
  const mount = mountCSG.toMesh(meshName, null, scene);
  inner.dispose();
  outer.dispose();
  scene.removeMesh(inner);
  scene.removeMesh(outer);
  mount.material = renderer.greyMaterial;
  mount.isPickable = false;
  mount.receiveShadows = true;
  mount.actionManager = renderer.actionManager;
  return mount;
}

const buildLeg = (scene: BABYLON.Scene, meshName: string) => {
  const leg = new BABYLON.Mesh(meshName, scene);
  const mount = buildMount(scene, meshName);
  mount.name = meshName + "Mount";
  mount.parent = leg;
  mount.position.z = Param.LEG_MOUNT_WIDTH/2;
  mount.setPivotPoint(new BABYLON.Vector3(0,-Param.LEG_MOUNT_HEIGHT,Param.LEG_MOUNT_WIDTH/2));
  const topLeg = buildBone({width:110, height:Param.LEG_LENGTH_TOP, depth:60}, scene);
  topLeg.name = meshName + "Top";
  topLeg.parent = mount;
  topLeg.position.z = -Param.LEG_MOUNT_WIDTH/2;
  topLeg.position.y = -Param.LEG_LENGTH_TOP/2;
  const hub = buildHub(scene, meshName.replace("leg","hub"));
  hub.parent = topLeg;
  const bottomLeg = buildBone({width:90, height:Param.LEG_LENGTH_BOTTOM, depth:50}, scene);
  bottomLeg.name = meshName+"Bottom";
  bottomLeg.parent = topLeg;
  bottomLeg.position.y = -Param.LEG_LENGTH_TOP/2 - Param.LEG_LENGTH_BOTTOM/2;
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
  if(arg1 === "dog") {
    renderer.setTilt(arg1, arg2);
  }
});
ipcRenderer.send("rendererInitialized");

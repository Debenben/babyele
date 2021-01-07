import * as BABYLON from 'babylonjs';
import { AdvancedDynamicTexture, Rectangle, Control, Slider, TextBlock, Button, StackPanel } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Modes } from './param';
import * as Param from './param';

export default class Renderer {
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  actionManager: BABYLON.ActionManager;
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
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0002;
    this.scene = scene;
    const glow = new BABYLON.GlowLayer("glow", scene);
    glow.intensity = 0.5;
    const background = buildBackground(scene, engine);
    const ground = buildGround(scene);
    scene.registerBeforeRender(() => {
      if(!this.infobox) {
        ground.rotation.y += 0.001;
      }
    });
    this.actionManager = new BABYLON.ActionManager(scene);

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

    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
    this.modeSelection = buildModeSelection();
    this.advancedTexture.addControl(this.modeSelection);
    this.modeDisplayButton = buildModeDisplayButton();
    this.advancedTexture.addControl(this.modeDisplayButton);
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
    }
    switch(state) {
      case "select":
        if(this.infobox) {
          this.advancedTexture.removeControl(this.infobox);
          this.infobox = null;
        }
        mesh.material = this.redMaterial;
        mesh.isPickable = true;
        this.infobox = buildInfoBox(meshName, false);
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
      case "preview":
        if(this.infobox) {
          this.advancedTexture.removeControl(this.infobox);
          this.infobox = null;
        }
        mesh.material = this.greenMaterial;
        mesh.isPickable = true;
        this.infobox = buildInfoBox(meshName, true);
        this.advancedTexture.addControl(this.infobox);
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
  }
}

const selectItem = (event) => {
  if(renderer.infobox) {
    if(event.meshUnderPointer.name === renderer.infobox.name && renderer.infobox.background === "red") {
      renderer.setState(renderer.infobox.name, "preview");
      return;
    }
    renderer.setState(renderer.infobox.name, "online");
  }
  renderer.setState(event.meshUnderPointer.name, "select");
}

const previewItem = (event) => {
  if(renderer.infobox) {
    if(renderer.infobox.background === "red") {
      return;
    }
    renderer.setState(renderer.infobox.name, "online");
  }
  renderer.setState(event.meshUnderPointer.name, "preview");
}

const unpreviewItem = (event) => {
  if(renderer.infobox) {
    if(renderer.infobox.background === "red") {
      return;
    }
    renderer.setState(renderer.infobox.name, "online");
  }
}

const buildInfoBox = (name: string, preview: boolean) => {
  const box = new StackPanel(name);
  box.width = "300px";
  box.height = "220px";
  box.alpha = 0.7;
  box.paddingLeft = 10; 
  box.paddingRight = 10; 
  box.paddingTop = 10; 
  box.paddingBottom = 10; 
  box.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  box.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  box.addControl(buildHeading(name));
  if(preview) {
    box.background = "green";
  }
  else {
    box.background = "red";
  }
  if(name.endsWith("Hub")) {
    ipcRenderer.send("getHubProperties");
    box.addControl(buildBatteryText(name));
    box.addControl(buildRssiText(name));
    box.addControl(buildTiltText(name));
  }
  else {
    box.addControl(buildText("angle:"));
    box.addControl(buildAngleSlider(name));
    box.addControl(buildResetButton(name));
    box.addControl(buildText("power:"));
    box.addControl(buildCorrectionSlider(name));
  }
  return box;
}

const buildHeading = (content: string) => {
  const heading = new TextBlock();
  heading.text = content;
  heading.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  heading.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  heading.height = "30px";
  heading.width = "260px";
  heading.fontSize = 20;
  return heading;
}

const buildText = (content: string) => {
  const block = new TextBlock();
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = content;
  block.height = "30px";
  block.width = "260px";
  return block;
}

const buildBatteryText = (meshName: string) => {
  const block = new TextBlock();
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = "battery: --";
  block.height = "30px";
  block.width = "260px";
  ipcRenderer.on("notifyBattery", (event, arg1, arg2) => {
    if(arg1===meshName) {
      block.text = "battery: " + String(arg2);
    }
  });
  return block;
}

const buildRssiText = (meshName: string) => {
  const block = new TextBlock();
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = "rssi: --";
  block.height = "30px";
  block.width = "260px";
  ipcRenderer.on("notifyRssi", (event, arg1, arg2) => {
    if(arg1===meshName) {
      block.text = "rssi: " + String(arg2);
    }
  });
  return block;
}

const buildTiltText = (meshName: string) => {
  const block = new TextBlock();
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = "tilt: --";
  block.height = "30px";
  block.width = "260px";
  ipcRenderer.on('notifyTilt', (event, arg1, arg2) => {
    if(arg1===meshName) {
      block.text = "tilt: " + arg2.x + " " + arg2.y + " " + arg2.z;
    }
  });
  return block;
}

const buildAngleSlider = (meshName: string) => {
  const slider = new Slider();
  slider.height = "30px";
  slider.width = "260px";
  slider.minimum = -Math.PI;
  slider.maximum = Math.PI;
  slider.value = renderer.getLegRotation(meshName);
  slider.onValueChangedObservable.add((value) => {
    //header
  });
  slider.onPointerUpObservable.add(() => {
    ipcRenderer.send(meshName, "requestRotation", slider.value);
  });
  return slider;
}

const buildResetButton = (meshName: string) => {
  const button = Button.CreateSimpleButton("resetButton", "reset angle");
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.paddingTop = "5px";
  button.paddingRight = "5px";
  button.width = "120px";
  button.height = "30px";
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send(meshName, "requestReset");
  });
  return button;
}

const buildCorrectionSlider = (meshName: string) => {
  const slider = new Slider();
  slider.height = "30px";
  slider.width = "260px";
  slider.minimum = -100;
  slider.maximum = 100;
  slider.value = 0;
  slider.onValueChangedObservable.add((value) => {
    ipcRenderer.send(meshName, "requestPower", value);
  });
  slider.onPointerUpObservable.add(() => {
    slider.value = 0;
  });
  return slider;
}

const buildModeDisplayButton = () => {
  const button = Button.CreateSimpleButton("modeDisplayButton", String(Modes[Modes.OFFLINE]));
  button.width = "250px";
  button.height = "30px";
  button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  button.background = "grey";
  button.onPointerClickObservable.add(() => {
    if(renderer.modeSelection) {
      renderer.modeSelection.isVisible = !renderer.modeSelection.isVisible;
    }
  });
  ipcRenderer.on('notifyMode', (event, arg) => {
    button.textBlock.text = String(Modes[arg]);
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
  panel.zIndex = 10;
  panel.isPointerBlocker = true;
  panel.isVisible = false;
  return panel;
}

const buildModeButton = (mode: number) => {
  const button = Button.CreateSimpleButton("modeButton", String(Modes[mode]));
  button.width = "180px";
  button.height = "30px";
  button.background = "grey";
  button.onPointerClickObservable.add(() => {
    ipcRenderer.send("requestMode", mode); 
    renderer.modeSelection.isVisible = false;
  });
  return button; 
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

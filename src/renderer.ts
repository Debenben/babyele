import * as BABYLON from 'babylonjs';

export default class Renderer {
    private _canvas: HTMLCanvasElement;
    private _engine: BABYLON.Engine;
    private _scene: BABYLON.Scene;
    frontHub: BABYLON.Mesh;
    backHub: BABYLON.Mesh;
    greenMaterial: BABYLON.StandardMaterial;
    greyMaterial: BABYLON.StandardMaterial;

    createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
        this._canvas = canvas;
        this._engine = engine;

        const scene = new BABYLON.Scene(engine);
        this._scene = scene;

        const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(7, 7, -10), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.attachControl(canvas, true);

        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

	this.greyMaterial = new BABYLON.StandardMaterial("greyMat", scene);
	this.greyMaterial.diffuseColor = new BABYLON.Color3(0.2,0.2,0.2);
	this.greenMaterial = new BABYLON.StandardMaterial("greenMat", scene);
	this.greenMaterial.diffuseColor = new BABYLON.Color3(0,1,0);

	this.frontHub = buildHub(scene);
	this.frontHub.position.y = 4;
	this.frontHub.position.x = 2;
	this.frontHub.material = this.greyMaterial;
	this.backHub = buildHub(scene);
        this.backHub.position.y = 4;
	this.backHub.position.x = -2;
	this.backHub.material = this.greyMaterial;

	const ground = buildGround(scene);
    }

    initialize(canvas: HTMLCanvasElement) {
        const engine = new BABYLON.Engine(canvas, true);
        this.createScene(canvas, engine);

        engine.runRenderLoop(() => {
            this._scene.render();
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
    const hub = BABYLON.MeshBuilder.CreateBox("hub", {width:3, height:1.2, depth:2}, scene);
    return hub;
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

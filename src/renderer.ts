import * as BABYLON from 'babylonjs';

export default class Renderer {
    private _canvas: HTMLCanvasElement;
    private _engine: BABYLON.Engine;
    private _scene: BABYLON.Scene;

    createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
        this._canvas = canvas;

        this._engine = engine;

        // This creates a basic Babylon Scene object (non-mesh)
        const scene = new BABYLON.Scene(engine);
        this._scene = scene;

        // This creates and positions a free camera (non-mesh)
        const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(7, 7, -10), scene);

        // This targets the camera to scene origin
        camera.setTarget(BABYLON.Vector3.Zero());

        // This attaches the camera to the canvas
        camera.attachControl(canvas, true);

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

	const frontHub = BABYLON.MeshBuilder.CreateBox("frontHub", {width:3, height:1.2, depth:2});
        frontHub.position.y = 4;
        frontHub.position.x = 2;
	const backHub = BABYLON.MeshBuilder.CreateBox("backHub", {width:3, height:1.2, depth:2});
        backHub.position.y = 4;
        backHub.position.x = -2;

        // Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
	const ground = BABYLON.Mesh.CreateGround("ground1", 10, 10, 2, scene);
	const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
	groundMat.diffuseColor = new BABYLON.Color3(0.1,0.4,0.1);
	ground.material = groundMat;
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

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);

const { ipcRenderer } = require('electron');
ipcRenderer.on('test', (event, arg) => {
    console.log("got message");
    console.log(arg);
});

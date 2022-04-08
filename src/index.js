import * as THREE from 'three';

// import {AmbientLight} from "three/src/lights/AmbientLight";
// import {AnimationMixer} from "three/src/animation/AnimationMixer";
// import {Box3} from "three/src/math/Box3";
// import {Clock} from "three/src/core/Clock";
// import {Color} from "three/src/math/Color";
// import {DirectionalLight} from "three/src/lights/DirectionalLight";
// import {HemisphereLight} from "three/src/lights/HemisphereLight";
// import {LoopPingPong} from "three/src/constants";
// import {Mesh} from "three/src/objects/Mesh";
// import {PerspectiveCamera} from "three/src/cameras/PerspectiveCamera.js";
// import {Scene} from "three/src/scenes/Scene";
// import {TextureLoader} from "three/src/loaders/TextureLoader";
// import {Vector3} from "three/src/math/Vector3";
// import {WebGLRenderer} from "three/src/renderers/WebGLRenderer";

import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader';
import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';


class AnimationController {
    constructor(model, onLoop) {
        this._clock = new THREE.Clock();
        this._onLoopCallback = onLoop;

        if (model)
            this._init(model);
    }

    _init(model) {
        if (!model || !model.animations || model.animations.length === 0)
            return;

        this._model = model;
        this._mixer = new THREE.AnimationMixer(model);

        this._action = this._mixer.clipAction(model.animations[0]);
        this._action.setLoop(THREE.LoopPingPong);

        this._mixer.addEventListener('loop', this._onLoop);
    }

    _onLoop = (ev) => {
        // properties of ev: type, action and loopDelta
        this._action.paused = true;
        this._onLoopCallback();
    }

    _update() {
        if (this._mixer) {
            const delta = this._clock.getDelta();
            this._mixer.update(delta);
        }
    }

    set model(value) {
        this.stop();

        if (this._mixer) {
            this._mixer.removeEventListener('loop', this._onLoop);
            this._mixer.uncacheAction(this._action);
        }

        this._action = undefined;
        this._mixer = undefined;
        this._model = undefined;

        this._init(value);
    }

    changeTimeScale(amount) {
        if (!this._action)
            return null;

        let value = this._action.timeScale + amount;
        value = Math.max(0.2, value);
        value = Math.min(2, value);
        this._action.timeScale = value;
        return value;
    }

    pause() {
        if (this._action && !this._action.paused)
            this._action.warp(this._action.timeScale, 0, 0.1);
    }

    play() {
        if (this._action) {
            if (this._action.paused) {
                this._action.paused = false;
                this._action.warp(0, this._action.timeScale, 0.1);
            } else {
                this._action.play();
            }
        }
    }

    stop() {
        if (this._action) {
            this._action.stop();
        }
    }
}


class Grid {
    constructor(scene) {
        if (!scene)
            throw new Error("Scene must be provided");

        this._grid = new THREE.GridHelper(400, 20, 0x0000ff, 0x808080);
        this._grid.material.opacity = 0.5;
        scene.add(this._grid);
    }

    reveal() {
        this._grid.visible = true;
    }

    hide() {
        this._grid.visible = false;
    }

    toggle() {
        this._grid.visible = !this._grid.visible;
        return this._grid.visible;
    }
}


class Controls {
    constructor(camera, renderer, params = {}) {
        if (!camera || !renderer)
            throw new Error("Controls: camera and renderer must be provided");

        this._controls = new OrbitControls(camera, renderer.domElement);

        const {minDistance = 100, maxDistance = 1000} = params;
        this._controls.maxDistance = maxDistance;
        this._controls.minDistance = minDistance;
    }

    changeRotationSpeed(changeAmount) {
        let value = this._controls.rotateSpeed + changeAmount;
        value = Math.max(0.2, value);
        value = Math.min(2, value);
        this._controls.rotateSpeed = value;
        return value;
    }
}


class ModelMovement {
    static targetPosition = undefined;
    static smoothness = 0.5;

    static _update(model) {
        if (ModelMovement.targetPosition)
            model.position.lerp(ModelMovement.targetPosition, ModelMovement.smoothness);
    }
}


class BoxVisualization {
    constructor({containerElementId}) {
        if (!containerElementId)
            throw new Error("You must provide containerElementId");

        this._containerElement = document.getElementById(containerElementId);

        if (!this._containerElement)
            throw new Error(`DOM element with id=${containerElementId} not found`);

        this._camera = undefined;
        this._scene = undefined;
        this._lights = undefined;
        this._renderer = undefined;
        this._model = undefined;

        this.controls = undefined;
        this.animation = undefined;
        this.grid = undefined;

        this._sceneLocked = false;

        this.init();
        this.animate();
    }

    init() {
        const {offsetWidth: width, offsetHeight: height} = this._containerElement;

        this._renderer = new THREE.WebGLRenderer({antialias: true});
        this._renderer.setSize(width, height);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        this._renderer.setClearColor(new THREE.Color('hsl(0, 0%, 10%)'));

        this._containerElement.appendChild(this._renderer.domElement); // needs to execute before adding TrackballControls for the latter to work

        // ---------------

        this._scene = new THREE.Scene();
        this._scene.background = new THREE.Color(0xffffff);

        this._camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1500);

        this.controls = new Controls(this._camera, this._renderer);

        this.grid = new Grid(this._scene);
        this.grid.hide();

        // ---------------

        const ambient = new THREE.AmbientLight(0xffffff, 1);
        this._scene.add(ambient);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        const keyLight = new THREE.DirectionalLight(new THREE.Color('#EEEEEE'), 0.3);
        const fillLight = new THREE.DirectionalLight(new THREE.Color('#EEEEEE'), 0.2);
        keyLight.position.set(-100, 0, 100);
        fillLight.position.set(100, 0, 100);
        backLight.position.set(100, 0, -100).normalize();
        this._scene.add(keyLight);
        this._scene.add(fillLight);
        this._scene.add(backLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
        hemiLight.groundColor.setHSL(0.095, 1, 0.95);
        hemiLight.position.set(0, 500, 0);
        this._scene.add(hemiLight);

        this._lights = {keyLight, fillLight, backLight, ambient};

        // ---------------

        this.animation = new AnimationController(undefined, this.moveModelToZero);

        this.animate();

        window.addEventListener('resize', this.onWindowResize, false);
    }

    onWindowResize = () => {
        const isFullscreen = document.fullscreenElement !== null;

        const width = isFullscreen ? window.innerWidth : this._containerElement.offsetWidth;
        const height = isFullscreen ? window.innerHeight : this._containerElement.offsetHeight;

        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();

        this._renderer.setSize(width, height);
    }

    animate = () => {
        this.animation._update();

        ModelMovement._update(this._model);

        // trackball controls needs to be updated in the animation loop before it will work
        // this.controls._update();

        this._renderer.render(this._scene, this._camera);

        requestAnimationFrame(this.animate);
    }

    // ---------

    _emitEvent(eventName, data) {
        const event = new window.CustomEvent(eventName, {detail: data});
        this._containerElement.dispatchEvent(event);
    }

    loadFBX(url) {
        if (this._sceneLocked)
            return Promise.reject(new Error("Other model is already being loaded."));

        this._sceneLocked = true;

        return new Promise((resolve, reject) => {
            const fbxLoader = new FBXLoader();

            fbxLoader.load(url,
                (obj) => {
                    obj.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    this._scene.add(obj);
                    this._model = obj;
                    this._fitCameraToModel(obj);
                    this.animation.model = obj;
                    this._sceneLocked = false;

                    this._emitEvent('loaded', {obj});
                    resolve(obj);
                },
                (xhr) => {
                    if (xhr.total === 0) {
                        this._emitEvent('loading', {loaded: 0, total: 100});
                    } else {
                        this._emitEvent('loading', {loaded: xhr.loaded, total: xhr.total});
                    }
                },
                (err) => {
                    this._emitEvent('error', {err});
                    this._sceneLocked = false;
                    reject(err);
                }
            );
        });
    }

    loadTexture(url) {
        if (!this._model)
            return Promise.reject(new Error("You should load model first."));

        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();

            textureLoader.load(
                url,
                (texture) => {

                    this._model.traverse(function (child) {
                        if (child.isMesh) {
                            child.material.map = texture;
                            child.material.map.needsUpdate = true;
                            child.material.needsUpdate = true;
                            child.needsUpdate = true;
                        }
                    });

                    this._emitEvent('loaded', {})
                    resolve(texture);
                },
                (xhr) => {
                    if (xhr.total === 0) {
                        this._emitEvent('loading', {loaded: 0, total: 100});
                    } else {
                        this._emitEvent('loading', {loaded: xhr.loaded, total: xhr.total});
                    }
                },
                function (err) {
                    console.error('Texture loading error.');
                    reject(err);
                }
            );
        });
    }

    // ---------

    changePullAnimationSpeed(changeAmount) {
        let value = ModelMovement.smoothness + changeAmount;
        value = Math.max(0.1, value);
        value = Math.min(1, value);
        ModelMovement.smoothness = value;
        return value;
    }

    moveModelToZero = () => {
        const boundingBox = new THREE.Box3();
        const center = new THREE.Vector3();

        boundingBox.setFromObject(this._model);
        boundingBox.getCenter(center);

        // this._model.translateX(-center.x);
        // this._model.translateY(-center.y);
        // this._model.translateZ(-center.z);

        ModelMovement.targetPosition = new THREE.Vector3(
            this._model.position.x - center.x,
            this._model.position.y - center.y,
            this._model.position.z - center.z
        );
    }

    // ---------

    _fitCameraToModel() {
        const boundingBox = new THREE.Box3();
        const size = new THREE.Vector3();

        boundingBox.setFromObject(this._model);
        boundingBox.getSize(size);

        // reset object position
        this._model.position.x = -boundingBox.min.x - size.x / 2;
        this._model.position.y = -boundingBox.min.y - size.y / 2;
        this._model.position.z = -boundingBox.min.z - size.z / 2;
        this._model.rotation.z = 0;

        // change camera position
        const fov = this._camera.fov;
        const cameraZ = Math.abs(size.y / 2 * Math.tan(fov * 2));
        const z = Math.max(cameraZ, size.z) * 1.5;
        this._camera.position.z = z;
        this._camera.updateProjectionMatrix();

        // change lights position
        this._lights.keyLight.position.set(-z, 0, z);
        this._lights.fillLight.position.set(z, 0, z);
        this._lights.backLight.position.set(z, 0, -z);
    }

    clearScene() {
        this.animation.model = undefined;

        for (const obj of this._scene.children) {
            if (obj.type === "Group") {
                this._scene.remove(obj);

                obj.traverse(child => {
                    if (child.geometry)
                        child.geometry.dispose();

                    if (child.material) {
                        if (child.material.map)
                            child.material.map.dispose();

                        child.material.dispose();
                    }
                })
            }
        }
    }

    goFullScreen() {
        if (document.fullscreenEnabled && !document.fullscreenElement)
            this._containerElement.requestFullscreen();
    }
}


export {BoxVisualization};
import * as THREE from 'three';

import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

// import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls';
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



class BoxVisualization {
    constructor({containerElementId}) {
        if (!containerElementId)
            throw new Error("You must provide containerElementId");

        this._containerElement = document.getElementById(containerElementId);

        if (!this._containerElement)
            throw new Error(`DOM element with id=${containerElementId} not found`);

        this._init();
        this._animate();
    }

    _init() {
        const {offsetWidth: width, offsetHeight: height} = this._containerElement;

        this._renderer = new THREE.WebGLRenderer({antialias: true});
        this._renderer.setSize(width, height);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        this._renderer.setClearColor(new THREE.Color('hsl(0, 0%, 10%)'));

        this._containerElement.appendChild(this._renderer.domElement); // needs to execute before adding TrackballControls for the latter to work

        // ---------------

        this._scene = new THREE.Scene();
        this._scene.background = new THREE.Color(0xFFFFFF);

        this._camera = new THREE.PerspectiveCamera(45, width / height, 25, 3000);

        this._controls = new OrbitControls(this._camera, this._renderer.domElement);
        this._controls.minDistance = 250;  // will be changed after model load
        this._controls.maxDistance = 2000;
        this._controls.enablePan = false;

        // -------------

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        const keyLight = new THREE.DirectionalLight(new THREE.Color('#FFFFFF'), 0.3);
        const fillLight = new THREE.DirectionalLight(new THREE.Color('#FFFFFF'), 0.3);
        keyLight.position.set(-100, 0, 100);
        fillLight.position.set(100, 0, 100);
        backLight.position.set(100, 0, -100).normalize();
        this._scene.add(keyLight);
        this._scene.add(fillLight);
        this._scene.add(backLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5);
        hemiLight.groundColor.setHSL(0.095, 1, 0.95);
        hemiLight.position.set(0, 500, 0);
        this._scene.add(hemiLight);

        this._lights = {keyLight, fillLight, backLight};

        // ---------------

        this._backLightHelper = new THREE.DirectionalLightHelper(backLight, 50, new THREE.Color(0,0,0));
        this._keyLightHelper = new THREE.DirectionalLightHelper(keyLight, 50, new THREE.Color(0,0,0));
        this._fillLightHelper = new THREE.DirectionalLightHelper(fillLight, 50, new THREE.Color(0,0,0));
        this._hemiLightHelper = new THREE.HemisphereLightHelper( hemiLight, 50, new THREE.Color(0,0,0));
        this._scene.add(this._backLightHelper);
        this._scene.add(this._keyLightHelper);
        this._scene.add(this._fillLightHelper);
        this._scene.add(this._hemiLightHelper);

        this._gridHelper = new THREE.GridHelper(800, 20, 0x0000ff, 0x808080);
        this._gridHelper.material.opacity = 0.5;
        this._scene.add(this._gridHelper);

        this.toggleHelpers();  // turn off by default

        // ---------------

        this._animationMixer = undefined;  // not undefined when there is model in animation
        this._animationAction = undefined;  // not undefined when there is model in animation
        this._animationClock = new THREE.Clock();

        // ---------------

        // we initially position model so that its bottom side center is at (0, 0, 0) - when the box is assembled, it's perfectly at the center of view.
        // when model loaded, it's unassembled and not in the center of the view.
        // we then use boundingBox approach to center the model and save its centered position to this._modelPositions[0]
        // so we have two positions in this._modelPositions - the first corresponds to unassembled state; the second one is zeros and corresponds to assembled state
        // those positions are switched in this._onAnimationLoop based on rounding and compare with the this._modelPositions[1]
        this._modelPositions = [undefined, new THREE.Vector3(0, 0, 0)];
        this._pullAnimationTargetPosition = undefined;  // animate centering the box after each model's animation loop
        this._pullAnimationSmoothness = 0.2;

        // ---------------

        this._sceneLocked = false;  // true when model is loading

        // ---------------

        window.addEventListener('resize', this._onWindowResize, false);
    }

    _onWindowResize = () => {
        const isFullscreen = document.fullscreenElement !== null;

        const width = isFullscreen ? window.innerWidth : this._containerElement.offsetWidth;
        const height = isFullscreen ? window.innerHeight : this._containerElement.offsetHeight;

        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();

        this._renderer.setSize(width, height);
    }

    _animate = () => {
        if (this._animationMixer) {
            const delta = this._animationClock.getDelta();
            this._animationMixer.update(delta);
        }

        if (this._pullAnimationTargetPosition)
            this._model.position.lerp(this._pullAnimationTargetPosition, this._pullAnimationSmoothness);

        // trackball controls needs to be updated in the animation loop before it will work
        // this._controls.update();

        this._renderer.render(this._scene, this._camera);

        requestAnimationFrame(this._animate);
    }

    _emitEvent(eventName, data = {}) {
        const event = new window.CustomEvent(eventName, {detail: data});
        this._containerElement.dispatchEvent(event);
    }

    // ---------

    loadModel(url) {
        if (this._sceneLocked)
            return Promise.reject(new Error("Other model is already being loaded."));
        this._sceneLocked = true;

        const fbxLoader = new FBXLoader();

        return new Promise((resolve, reject) => {
            fbxLoader.load(url,
                (obj) => {
                    obj.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshPhongMaterial();
                        }
                    });

                    this._model = obj;
                    this._scene.add(obj);
                    this._fitCameraToModel();

                    this._modelPositions[0] = this._model.position.clone();
                    this._pullAnimationTargetPosition = this._modelPositions[0];

                    this._setupAnimation(obj, obj.animations);
                    this._sceneLocked = false;

                    this._emitEvent('modelLoaded', {obj});
                    resolve(obj);
                },
                (xhr) => {
                    if (xhr.total === 0) {
                        this._emitEvent('modelLoading', {loaded: 0, total: 100});
                    } else {
                        this._emitEvent('modelLoading', {loaded: xhr.loaded, total: xhr.total});
                    }
                },
                (err) => {
                    this._emitEvent('modelLoadingError', {err});
                    this._sceneLocked = false;
                    reject(err);
                }
            );
            this._emitEvent('modelLoading', {loaded: 0, total: 100});
        });
    }

    loadTexture(url) {
        if (!this._model)
            return Promise.reject(new Error("You should load model first."));

        if (this._sceneLocked)
            return Promise.reject(new Error("Something other is already being loaded."));
        this._sceneLocked = true;

        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();

            textureLoader.load(
                url,
                (texture) => {
                    this._model.traverse(function (child) {
                        if (child.isMesh) {
                            child.material = new THREE.MeshBasicMaterial();
                            child.material.color.setHex(0xFFFFFF);
                            child.material.map = texture;
                            child.material.needsUpdate = true;
                        }
                    });

                    this._sceneLocked = false;
                    this._emitEvent('textureLoaded', {})
                    resolve(texture);
                },
                (xhr) => {
                    if (xhr.total === 0) {
                        this._emitEvent('textureLoading', {loaded: 0, total: 100});
                    } else {
                        this._emitEvent('textureLoading', {loaded: xhr.loaded, total: xhr.total});
                    }
                },
                (err) => {
                    this._emitEvent('textureLoadingError', {err});
                    this._sceneLocked = false;
                    reject(err);
                }
            );
            this._emitEvent('textureLoading', {loaded: 0, total: 100});
        });
    }

    _fitCameraToModel() { // TODO: split/refactor method
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
        const z = Math.max(cameraZ, size.z);
        this._camera.position.set(-z, z, z);
        this._camera.lookAt(new THREE.Vector3(0, 0, 0));

        // change lights position
        this._lights.keyLight.position.set(-z, 0, z);
        this._lights.fillLight.position.set(z, 0, z);
        this._lights.backLight.position.set(z, 0, -z);

        // set controls minDistance - half the size + something (depends on camera's near attribute)
        const maxLen = Math.max(size.x, size.y, size.z);
        this._controls.minDistance = Math.trunc(maxLen / 2 + 75);
    }

    // ---------

    _setupAnimation(scene, animations) {
        if (!scene || !animations || animations.length === 0)
            return;

        this._animationMixer = new THREE.AnimationMixer(scene);
        this._animationAction = this._animationMixer.clipAction(animations[0]);
        this._animationAction.setLoop(THREE.LoopPingPong);
        this._animationMixer.addEventListener('loop', this._onAnimationLoop);
    }

    _onAnimationLoop = (ev) => {
        // properties of ev: type, action and loopDelta
        this._emitEvent('animationPaused');
        this._animationAction.paused = true;

        const index = this._model.position.clone().roundToZero().equals(this._modelPositions[1]) ? 0 : 1;
        this._pullAnimationTargetPosition = this._modelPositions[index];
    }

    _disposeAnimations() {
        this.stopAnimation();

        if (this._animationMixer) {
            this._animationMixer.removeEventListener('loop', this._onAnimationLoop);
            this._animationMixer.uncacheAction(this._animationAction);
        }

        this._animationAction = undefined;
        this._animationMixer = undefined;
    }

    pauseAnimation() {
        if (this._animationAction && !this._animationAction.paused) {
            this._animationAction.warp(this._animationAction.timeScale, 0, 0.1);

            this._emitEvent('animationPaused');
        }
    }

    playAnimation() {
        if (this._animationAction) {
            this._emitEvent('animationStarted');

            if (this._animationAction.paused) {
                this._animationAction.paused = false;
                this._animationAction.warp(0, this._animationAction.timeScale, 0.1);
            } else {
                this._animationAction.play();
            }
        }
    }

    stopAnimation() {
        if (this._animationAction && this._animationAction) {
            this._animationAction.stop();

            this._emitEvent('animationStopped');
        }
    }

    // ---------

    clearScene() {
        this._disposeAnimations()

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

    // ---------

    changeAnimationTimeScale(amount) {
        if (!this._animationAction)
            return null;

        let value = this._animationAction.timeScale + amount;
        value = Math.max(0.2, value);
        value = Math.min(2, value);
        this._animationAction.timeScale = value;
        return value;
    }

    changeControlsRotateSpeed(amount) {
        let value = this._controls.rotateSpeed + amount;
        value = Math.max(0.2, value);
        value = Math.min(2, value);
        this._controls.rotateSpeed = value;
        return value;
    }

    changePullAnimationSpeed(amount) {
        let value = this._pullAnimationSmoothness + amount;
        value = Math.max(0.01, value);
        value = Math.min(1, value);
        this._pullAnimationSmoothness = value;
        return value;
    }

    togglePan() {
        this._controls.enablePan = !this._controls.enablePan;
        return this._controls.enablePan;
    }

    toggleHelpers() {
        this._gridHelper.visible = !this._gridHelper.visible;
        this._backLightHelper.visible = !this._backLightHelper.visible;
        this._keyLightHelper.visible = !this._keyLightHelper.visible;
        this._fillLightHelper.visible = !this._fillLightHelper.visible;
        this._hemiLightHelper.visible = !this._hemiLightHelper.visible;

        return this._gridHelper.visible;
    }
}


export {BoxVisualization};
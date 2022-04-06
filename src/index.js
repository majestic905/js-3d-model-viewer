import * as THREE from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader';
import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls'



class AnimationController {
    constructor(model) {
        this._clock = new THREE.Clock();

        if (model)
            this._init(model);
    }

    _init(model) {
        if (!model || !model.animations || model.animations.length === 0)
            return;

        this._mixer = new THREE.AnimationMixer(model);

        this._action = this._mixer.clipAction(model.animations[0]);
        this._action.setLoop(THREE.LoopPingPong);

        this._mixer.addEventListener( 'loop', this.onLoop );
    }

    onLoop = (ev) => {
        // properties of ev: type, action and loopDelta
        this._action.paused = true;
    }

    set model(value) {
        this.stopAnimation();

        if (this._mixer) {
            this._mixer.removeEventListener('loop', this.onLoop);
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
        value = Math.max(0.3, value);
        value = Math.min(1.5, value);
        this._action.timeScale = value;
        return value;
    }

    pauseAnimation() {
        if (this._action && !this._action.paused)
            this._action.warp(this._action.timeScale, 0, 0.1);
    }

    playAnimation() {
        if (this._action) {
            if (this._action.paused) {
                this._action.paused = false;
                this._action.warp(0, this._action.timeScale, 0.1);
            } else {
                this._action.play();
            }
        }
    }

    stopAnimation() {
        if (this._action) {
            this._action.stop();
        }
    }

    update() {
        if (this._mixer) {
            const delta = this._clock.getDelta();
            this._mixer.update(delta);
        }
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
        this._controls = undefined;

        this._animationController = new AnimationController();

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
        this._camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1500);
        this._controls = new TrackballControls(this._camera, this._renderer.domElement);
        this._controls.maxDistance = 1000;
        this._controls.minDistance = 100;

        const ambient = new THREE.AmbientLight(0xffffff, 1);
        this._scene.add(ambient);

        // ---------------

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
        this._animationController.update();

        // trackball controls needs to be updated in the animation loop before it will work
        this._controls.update();

        this._renderer.render(this._scene, this._camera);

        requestAnimationFrame(this.animate);
    }

    changeRotationSpeed(changeAmount) {
        let value = this._controls.rotateSpeed + changeAmount;
        value = Math.max(0.5, value);
        value = Math.min(2, value);
        this._controls.rotateSpeed = value;
        return value;
    }

    // ---------

    _emitEvent(eventName, data) {
        const event = new window.CustomEvent(eventName, {detail: data});
        this._containerElement.dispatchEvent(event);
    }

    _fitCameraToObject(object) {
        const boundingBox = new THREE.Box3();
        const size = new THREE.Vector3();

        boundingBox.setFromObject(object);
        boundingBox.getSize(size);

        // reset object position
        object.position.x = -boundingBox.min.x - size.x / 2;
        object.position.y = -boundingBox.min.y - size.y / 2;
        object.position.z = -boundingBox.min.z - size.z / 2;
        object.rotation.z = 0;

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
                    this._fitCameraToObject(obj);
                    this._animationController.model = obj;
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

    stopAnimation() {
        return this._animationController.stopAnimation();
    }

    playAnimation() {
        return this._animationController.playAnimation();
    }

    pauseAnimation() {
        return this._animationController.pauseAnimation();
    }

    changeAnimationSpeed(changeAmount) {
        return this._animationController.changeTimeScale(changeAmount);
    }

    // ---------

    resetCamera() {
        this._controls.reset();
    }

    clearScene() {
        this._animationController.model = undefined;

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
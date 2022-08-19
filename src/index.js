class Helpers {
    constructor(scene, lights) {
        this._backLightHelper = new THREE.DirectionalLightHelper(lights.backLight, 50, new THREE.Color(0,0,0));
        this._keyLightHelper = new THREE.DirectionalLightHelper(lights.keyLight, 50, new THREE.Color(0,0,0));
        this._fillLightHelper = new THREE.DirectionalLightHelper(lights.fillLight, 50, new THREE.Color(0,0,0));
        this._hemiLightHelper = new THREE.HemisphereLightHelper(lights.hemiLight, 50, new THREE.Color(0,0,0));
        scene.add(this._backLightHelper);
        scene.add(this._keyLightHelper);
        scene.add(this._fillLightHelper);
        scene.add(this._hemiLightHelper);

        this._gridHelper = new THREE.GridHelper(1000, 20, 0x0000ff, 0x808080);
        this._gridHelper.material.opacity = 0.5;
        scene.add(this._gridHelper);
    }

    get visible() {
        return this._gridHelper.visible;
    }

    set visible(value) {
        this._gridHelper.visible = value;
        this._backLightHelper.visible = value;
        this._keyLightHelper.visible = value;
        this._fillLightHelper.visible = value;
        this._hemiLightHelper.visible = value;
    }

    toggle() {
        this.visible = !this.visible;
        return this.visible;
    }
}


class Viewer {
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

        this._camera = new THREE.PerspectiveCamera(45, width / height, 25, 2500);

        this._controls = new THREE.OrbitControls(this._camera, this._renderer.domElement);
        this._controls.minDistance = 250;  // will be changed after model load
        this._controls.maxDistance = 2000;
        this._controls.enablePan = true;

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

        this._lights = {keyLight, fillLight, backLight, hemiLight};

        // ---------------

        this._helpers = new Helpers(this._scene, this._lights);
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
        const isFullscreen = ('webkitFullscreenElement' in document) ? !!document.webkitFullscreenElement : !!document.fullscreenElement;

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

    // ----------

    async importModel(url, fitCamera = true) {
        this._model = await this.loadModel(url);

        this._scaleModel();

        // TODO: need to split fitCamera into 1) changing initial model position, which will be then copied into this._modelPositions[0] and 2) actually fitting camera
        // if (fitCamera)
        this._fitCameraToModel();

        this._modelPositions[0] = this._model.position.clone();
        this._pullAnimationTargetPosition = this._modelPositions[0];

        this._setupAnimation(this._model, this._model.animations);

        this._scene.add(this._model);
    }

    loadModel(url) {
        if (this._sceneLocked)
            return Promise.reject(new Error("Other model is already being loaded."));
        this._sceneLocked = true;

        const fbxLoader = new THREE.FBXLoader();

        return new Promise((resolve, reject) => {
            fbxLoader.load(url,
                (obj) => {
                    obj.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshPhongMaterial();
                        }
                    });

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

    _scaleModel() {
        const boundingBox = new THREE.Box3();
        const size = new THREE.Vector3();

        boundingBox.setFromObject(this._model);
        boundingBox.getSize(size);

        const scale = 1000 / Math.max(size.x, size.y, size.z);
        this._model.scale.set(scale, scale, scale);
    }

    _fitCameraToModel() { // TODO: split/refactor method
        // console.log('before', this._model.position, this._camera.position);

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
        const cameraX = Math.abs(size.x / 2 * Math.tan(fov * 2));
        // when using ._scaleModel(), this will (almost?) always be 1000 (factor from that method)
        // and (probably?)can be discarded by using constant
        const x = Math.max(cameraX, size.x, size.y, size.z);
        this._camera.position.set(-x, x, x);
        this._camera.lookAt(new THREE.Vector3(0, 0, 0));

        // change lights position
        this._lights.keyLight.position.set(-x, 0, x);
        this._lights.fillLight.position.set(x, 0, x);
        this._lights.backLight.position.set(x, 0, -x);

        // set controls minDistance - half the size + something (depends on camera's near attribute)
        const maxLen = Math.max(size.x, size.y, size.z);
        this._controls.minDistance = Math.trunc(maxLen / 2 + 75);

        // console.log('after', this._model.position, this._camera.position);
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
        // dispose animations
        this.stopAnimation();

        if (this._animationMixer) {
            this._animationMixer.removeEventListener('loop', this._onAnimationLoop);
            this._animationMixer.uncacheAction(this._animationAction);
        }

        this._animationAction = undefined;
        this._animationMixer = undefined;

        // dispose objects
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

    resetModelPosition() {
        this._controls.reset();
        this._fitCameraToModel();
    }

    // ---------

    get background() { return this._scene.background; }
    set background(value) { this._scene.background = value; }

    get maxDistance() { return this._controls.maxDistance; }
    set maxDistance(value) { this._controls.maxDistance = parseInt(value, 10); }

    get minDistance() { return this._controls.minDistance; }
    set minDistance(value) { this._controls.minDistance = parseInt(value, 10); }

    get enablePan() { return this._controls.enablePan; }
    set enablePan(value) { this._controls.enablePan = Boolean(value); }

    get rotateSpeed() { return this._controls.rotateSpeed; }
    set rotateSpeed(value) { this._controls.rotateSpeed = Math.min(2, Math.max(0.2, parseFloat(value))); }

    get cameraNear() { return this._camera.near; }
    set cameraNear(value) { this._camera.near = parseInt(value, 10); this._camera.updateProjectionMatrix(); }

    get cameraFar() { return this._camera.far; }
    set cameraFar(value) { this._camera.far = parseInt(value, 10); this._camera.updateProjectionMatrix(); }

    get animationTimeScale() { return this._animationAction.timeScale; }
    set animationTimeScale(value) { this._animationAction.timeScale = Math.min(2, Math.max(0.2, parseFloat(value))); }

    get pullSmoothness() { return this._pullAnimationSmoothness; }
    set pullSmoothness(value) { return this._pullAnimationSmoothness = Math.min(1, Math.max(0.01, parseFloat(value))); }

    get helpersVisible() { return this._helpers.visible; }
    set helpersVisible(value) { this._helpers.visible = Boolean(value); }

    set endLoopPosition(array3) { this._modelPositions[1] = new THREE.Vector3(...array3); }

    set cameraPosition(array3) { this._camera.position.copy(new THREE.Vector3(...array3)); }
    set cameraRotation(array3) { this._camera.rotation.copy(new THREE.Euler(...array3)); }

    get hasAnimation() { return this._model && this._model.animations && this._model.animations.length > 0; }

    set animationTime(value) {
        if (!this.hasAnimation)
            return;

        if (value < 0 || value > this._animationAction.getClip().duration)
            return;

        this.playAnimation();
        this._animationMixer.update(value);
        this.pauseAnimation();
    }
    get animationTime() { return this._animationAction?.time || 0; }

    togglePan() {
        this.enablePan = !this.enablePan;
        return this.enablePan;
    }

    toggleHelpers() {
        this.helpersVisible = !this.helpersVisible;
        return this.helpersVisible;
    }
}


window.BoxViewer = Viewer;

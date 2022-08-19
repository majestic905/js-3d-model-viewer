function round(value, n=2) {
    if (n === 0)
        return Math.round(value);

    return Math.round(value * Math.pow(10, n)) / (Math.pow(10, n));
}

document.addEventListener('DOMContentLoaded', function() {
    const BoxViewer = window.BoxViewer;

    const boxVis = new BoxViewer({containerElementId: 'viewer'});

    const MODEL_URL = './assets/2604.fbx';
    const TEXTURE_URL = './assets/texture.logo.kraft.png';

    const divs = {
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        viewer: document.getElementById('viewer'),
    };

    const numberInputs = {
        animationTimeScale: document.getElementById('animationTimeScale'),
        pullSmoothness: document.getElementById('pullSmoothness'),
        rotateSpeed: document.getElementById('rotateSpeed'),
        minDistance: document.getElementById('minDistance'),
        maxDistance: document.getElementById('maxDistance'),
        cameraNear: document.getElementById('cameraNear'),
        cameraFar: document.getElementById('cameraFar'),
    };

    const checkboxInputs = {
        enablePan: document.getElementById('enablePan'),
        helpersVisible: document.getElementById('helpersVisible')
    }

    const buttons = {
        fullscreen: document.getElementById('fullscreen-button'),
        resetModelPosition: document.getElementById('reset-model-position-button'),
        playAnimation: document.getElementById('play-animation-button'),
        stopAnimation: document.getElementById('stop-animation-button'),
    }

    const readonlyInputs = {
        cameraPosition: document.getElementById('cameraPosition'),
        cameraRotation: document.getElementById('cameraRotation'),
        animationTime: document.getElementById('animationTime')
    }

    // ---------

    const onLoading = (ev) => {
        const progress = Math.floor(100 * ev.detail.loaded / ev.detail.total);
        divs.loading.innerHTML = 'Loading... ' + progress + '%';
        divs.error.innerHTML = '';
    }

    const onLoaded = () => {
        divs.loading.innerHTML = '';
        divs.error.innerHTML = '';
    }

    const onLoadingError = (ev) => {
        divs.loading.innerHTML = '';
        divs.error.innerHTML = 'Error: ' + ev.detail.err.message;
    }

    divs.viewer.addEventListener('modelLoading', onLoading);
    divs.viewer.addEventListener('textureLoading', onLoading);
    divs.viewer.addEventListener('modelLoaded', onLoaded);
    divs.viewer.addEventListener('textureLoaded', onLoaded);
    divs.viewer.addEventListener('modelLoadingError', onLoadingError);
    divs.viewer.addEventListener('textureLoadingError', onLoadingError);

    // ---------

    const playAnimation = () => { boxVis.playAnimation(); };
    const pauseAnimation = () => { boxVis.pauseAnimation(); };
    const stopAnimation = () => { boxVis.stopAnimation(); };

    buttons.playAnimation.addEventListener('click', playAnimation);
    buttons.stopAnimation.addEventListener('click', stopAnimation);

    divs.viewer.addEventListener('animationStarted', function (ev) {
        buttons.playAnimation.removeEventListener('click', playAnimation);

        buttons.playAnimation.children[0].innerHTML = 'pause';
        buttons.playAnimation.children[1].innerHTML = 'Pause';
        buttons.playAnimation.addEventListener('click', pauseAnimation);
    });

    const onPauseOrStop = () => {
        buttons.playAnimation.removeEventListener('click', pauseAnimation);

        buttons.playAnimation.children[0].innerHTML = 'play_arrow';
        buttons.playAnimation.children[1].innerHTML = 'Play';
        buttons.playAnimation.addEventListener('click', playAnimation);
    }

    divs.viewer.addEventListener('animationPaused', onPauseOrStop);
    divs.viewer.addEventListener('animationStopped', onPauseOrStop);

    function disableOrEnableAnimationButtons() {
        if (boxVis.hasAnimation) {
            buttons.playAnimation.classList.remove('disabled');
            buttons.stopAnimation.classList.remove('disabled');
        } else {
            buttons.playAnimation.classList.add('disabled');
            buttons.stopAnimation.classList.add('disabled');
        }
    }

    // ---------

    document.getElementById('open-fbx-model-input')
        .addEventListener('change', (ev) => {
            const uploadedFile = ev.target.files[0];
            const url = URL.createObjectURL(uploadedFile);
            boxVis.clearScene();
            boxVis.importModel(url, true)
                .then(() => URL.revokeObjectURL(url))
                .then(() => disableOrEnableAnimationButtons())
                .catch((err) => {
                    console.error(err);
                    URL.revokeObjectURL(url)
                });
        });

    document.getElementById('open-texture-input')
        .addEventListener('change', (ev) => {
            const uploadedFile = ev.target.files[0];
            const url = URL.createObjectURL(uploadedFile);
            boxVis.loadTexture(url)
                .then(() => URL.revokeObjectURL(url))
                .catch((err) => {
                    console.error(err);
                    URL.revokeObjectURL(url)
                });
        });

    checkboxInputs.helpersVisible.addEventListener('change', function(ev) {
        boxVis.helpersVisible = ev.target.checked;
    });

    checkboxInputs.enablePan.addEventListener('change', function(ev) {
        boxVis.enablePan = ev.target.checked;
    });

    buttons.fullscreen.addEventListener('click', function () {
        if (document.fullscreenEnabled && !document.fullscreenElement)
            divs.viewer.requestFullscreen();
    });

    buttons.resetModelPosition.addEventListener('click', function() {
        boxVis.resetModelPosition();
    })

    for (const input of Object.values(numberInputs)) {
        input.addEventListener('change', function(ev) {
            const name = ev.target.name;
            const value = ev.target.value;
            boxVis[name] = value;
        });
    }

    // ---------

    function getCameraPosition() {
        const {x, y, z} = boxVis._camera.position;
        return [round(x), round(y), round(z)];
    }

    function getCameraRotation() {
        const {x, y, z} = boxVis._camera.rotation;
        return [round(x), round(y), round(z)];
    }

    function getOptions() {
        return {
            animationTimeScale: round(boxVis.animationTimeScale),
            pullSmoothness: round(boxVis.pullSmoothness),
            rotateSpeed: round(boxVis.rotateSpeed),
            minDistance: round(boxVis.minDistance),
            maxDistance: round(boxVis.maxDistance),
            cameraNear: round(boxVis.cameraNear),
            cameraFar: round(boxVis.cameraFar),
            helpersVisible: boxVis.helpersVisible,
            enablePan: boxVis.enablePan,
            cameraPosition: getCameraPosition().join(','),
            cameraRotation: getCameraRotation().join(','),
            animationTime: round(boxVis.animationTime, 1)
        }
    }

    let defaultOptions = {};

    function getChangedOptions() {
        const allOptions = getOptions();
        const changedOptions = {};

        for (const key in allOptions)
            if (allOptions[key] !== defaultOptions[key])
                changedOptions[key] = allOptions[key];

        return changedOptions;
    }

    const optionsTextarea = document.getElementById("serialized-options");

    // ---------

    function saveDefaultOptions() {
        defaultOptions = getOptions();
    }

    function setCurrentModelOptions() {
        boxVis.enablePan = true;
        boxVis.cameraPosition = [-1099.7,-1124.38,725.56];
        boxVis.cameraRotation = [1,-0.69,0.78];
        boxVis.animationTime = 3.36;
    }

    function setInitialInputValues() {
        numberInputs.pullSmoothness.value = boxVis.pullSmoothness;
        numberInputs.rotateSpeed.value = boxVis.rotateSpeed;
        numberInputs.minDistance.value = boxVis.minDistance;
        numberInputs.maxDistance.value = boxVis.maxDistance;
        numberInputs.cameraNear.value = boxVis.cameraNear;
        numberInputs.cameraFar.value = boxVis.cameraFar;

        if (boxVis.hasAnimation)
            numberInputs.animationTimeScale.value = boxVis.animationTimeScale;

        checkboxInputs.helpersVisible.checked = boxVis.helpersVisible;
        checkboxInputs.enablePan.checked = boxVis.enablePan;
    }

    function setupStateUpdates() {
        setInterval(() => {
            readonlyInputs.cameraPosition.value = getCameraPosition().join(',');
            readonlyInputs.cameraRotation.value = getCameraRotation().join(',');

            if (boxVis.hasAnimation)
                readonlyInputs.animationTime.value = round(boxVis._animationAction.time).toString();

            optionsTextarea.value = JSON.stringify(getChangedOptions());
        }, 500);
    }

    boxVis.importModel(MODEL_URL, false)
        .then(() => {
            disableOrEnableAnimationButtons();
            saveDefaultOptions();
            setCurrentModelOptions();
            setInitialInputValues();
            setupStateUpdates();
        })
        .then(() => boxVis.loadTexture(TEXTURE_URL))
        .catch(err => console.error(err));

    // ---------
});
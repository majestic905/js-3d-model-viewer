function round(value, n) {
    if (n === 0)
        return Math.round(value);

    return Math.round(value * Math.pow(10, n)) / (Math.pow(10, n));
}

document.addEventListener('DOMContentLoaded', function() {
    const Viewer = window.Viewer;

    const MODEL_URL = './assets/VinePremium.fbx';
    const TEXTURE_URL = './assets/Ns2604.png';

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

    const buttons = {
        fullscreen: document.getElementById('fullscreen-button'),
        speedUpAnimation: document.getElementById('speed-up-animation-button'),
        slowDownAnimation: document.getElementById('slow-down-animation-button'),
        speedUpPullAnimation: document.getElementById('speed-up-pull-animation-button'),
        slowDownPullAnimation: document.getElementById('slow-down-pull-animation-button'),
        speedUpRotation: document.getElementById('speed-up-rotation-button'),
        slowDownRotation: document.getElementById('slow-down-rotation-button'),
        resetModelPosition: document.getElementById('reset-model-position-button'),
        playAnimation: document.getElementById('play-animation-button'),
        stopAnimation: document.getElementById('stop-animation-button'),
        toggleHelpers: document.getElementById('toggle-helpers-button'),
        togglePan: document.getElementById('toggle-pan-button'),
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

    // ---------

    const boxVis = new Viewer({containerElementId: 'viewer'});

    document.getElementById('open-fbx-model-input')
        .addEventListener('change', (ev) => {
            const uploadedFile = ev.target.files[0];
            const url = URL.createObjectURL(uploadedFile);
            boxVis.clearScene();
            boxVis.loadModel(url)
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

    // ---------

    buttons.toggleHelpers.addEventListener('click', function() {
        const isVisible = boxVis.toggleHelpers();
        buttons.toggleHelpers.children[0].innerText = isVisible ? 'grid_on' : 'grid_off';
    });

    buttons.togglePan.addEventListener('click', function() {
        const isEnabled = boxVis.togglePan();
        buttons.togglePan.children[0].innerText = isEnabled ? 'pan_tool' : 'do_not_touch';
    });

    buttons.fullscreen.addEventListener('click', function () {
        if (document.fullscreenEnabled && !document.fullscreenElement)
            divs.viewer.requestFullscreen();
    });

    buttons.resetModelPosition.addEventListener('click', function() {
        boxVis.resetModelPosition();
    })

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

    for (const input of Object.values(numberInputs)) {
        input.addEventListener('change', function(ev) {
            const name = ev.target.name;
            const value = ev.target.value;
            boxVis[name] = value;
        });
    }

    // ---------

    boxVis.loadModel(MODEL_URL)
        .then(() => buttons.togglePan.click())
        .then(() => {
            for (const [inputName, input] of Object.entries(numberInputs))
                input.value = boxVis[inputName];
        })
        .then(() => disableOrEnableAnimationButtons())
        .catch(err => console.error(err));
});
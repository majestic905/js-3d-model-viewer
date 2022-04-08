# Javascript 3D Model Viewer 

A web viewer to display 3D models in the browser.

[Demo](https://threejs-d62be.web.app/)


## How to run


Then run this snippet after the HTML of your page is loaded:

```javascript
import {BoxVisualization} from 'js-3d-model-viewer'
const boxVis = new BoxVisualization({containerElementId: 'viewer'});
boxVis.loadFBX(modelUrl)
    .then(() => boxVis.loadTexture(textureUrl));
```

You're done!

If you want to go fullscreen, you can do it like this:

```javascript
boxVis.goFullScreen()
```

## Why
 
Animation studios want to be able to perform a quick review of 3D models. Displaying a
model in the browser could help in solving this problem. On a broader aspect,
there is no open source 3D model viewer. Which is sad whent technologies like
WebGL and Three.js allow to display easily 3D geometries.


## Development status

* Currently the viewer supports only `.fbx` files.
* It can load textures.
* Unit tests are missing


## Technologies

This viewer is based on [Three.js](https://threejs.org/)


## Development environment

First install dependencies:

```
npm install
```

All the code is in the `src/index.js` file. Once you did your changes you have to run the dev build:

```
npm run dev
```

You can see the result in the browser by connecting to
[http://localhost:8080](http://localhost:8080).

To build the projects for production you have to run the following command:

```
npm run build
```

You will obtain a minified version of the sources in the `dist` folder.


## Resources

* Tutorial: https://manu.ninja/webgl-3d-model-viewer-using-three-js/
* Three.js docs: https://threejs.org/docs/index.html
* Sketchfab viewer: https://sketchfab.com/developers/viewer


## About authors

This viewer is written by CG Wire, a company based in France. We help
animations studios to manage their production and build pipeline efficiently.

We apply software craftmanship principles as much as possible. We love coding
and consider that strong quality and good developer experience matter a lot.
Our extensive experience allows studios to get better at doing software and
focus more on the artistic work.

Visit [cg-wire.com](https://cg-wire.com) for more information.

[![CGWire Logo](https://zou.cg-wire.com/cgwire.png)](https://cg-wire.com)

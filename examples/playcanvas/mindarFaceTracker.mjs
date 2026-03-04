// Adapted from https://github.com/hiukim/mind-ar-js/blob/master/src/face-target/three.js

import { Script, Mat4, Entity, Quat } from 'playcanvas';
import { MindarFaceAnchor } from './mindarFaceAnchor.mjs'

export class MindarFaceTracker extends Script {
  static scriptName = 'mindarFaceTracker';

  /**
   * Use the front/user-facing camera.
   * @attribute
   * @title Use User Camera
   */
  useUserCamera = true;

  /**
   * Disable mirroring for front camera.
   * @attribute
   * @title Disable Face Mirror
   */
  disableFaceMirror = false;

  /**
   * Camera entity used for AR projection.
   * @attribute
   * @type {Entity}
   * @title Camera Entity
   */
  cameraEntity;

  /**
   * Tag used to find anchor entities.
   * @attribute
   * @title Anchor Tag
   */
  anchorTag = 'mindar-face-anchor';

  get latestEstimate() {
    return this._latestEstimate
  }

  initialize() {
    this._anchorsByLandmark = {};
    this._faceMat = new Mat4();
    this._latestEstimate = null;

    this._onResizeBound = this.onResize.bind(this);
    window.addEventListener('resize', this._onResizeBound, false);

    this.refreshAnchors();
    this.start();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResizeBound, false);
  }

  refreshAnchors() {
    this._anchorsByLandmark = {};
    const entities = this.app.root.findByTag(this.anchorTag || 'mindar-face-anchor');
    for (let i = 0; i < entities.length; i++) {
      /** @type {Entity} */
      // @ts-ignore
      const e = entities[i];
      if (!e.script || !e.script.has(MindarFaceAnchor.scriptName)) {
        continue;
      }

      /** @type {MindarFaceAnchor} */
      // @ts-ignore
      const anchorScript = e.script.get(MindarFaceAnchor.scriptName)
      const landmarkIndex = anchorScript.landmarkIndex;

      if (!this._anchorsByLandmark[landmarkIndex]) {
        this._anchorsByLandmark[landmarkIndex] = [];
      }

      this._anchorsByLandmark[landmarkIndex].push(e);
      e.enabled = false
    }
  }

  async start() {
    if (!window.MINDAR || !window.MINDAR.FACE || !window.MINDAR.FACE.Controller) {
      console.error('MindAR face controller not found. Ensure mindar-face.prod.js is loaded first.');
      return;
    }

    try {
      await this.startVideo()
      await this.startAR()
    }
    catch (e) {
      console.error('failed to start video', e);
    }
  }

  stop() {
    if (this.controller) {
      this.controller.stopProcessVideo();
    }
    if (this.video && "srcObject" in this.video) {
      /** @type {MediaStream} */
      // @ts-ignore
      const src = this.video.srcObject
      const tracks = src.getTracks();
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].stop();
      }
    }
    if (this.video && this.video.parentElement) {
      this.video.parentElement.removeChild(this.video);
    }
    this.video = null;
    this.controller = null;
  }

  startVideo() {
    return new Promise((resolve, reject) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reject(new Error('getUserMedia not supported'));
        return;
      }

      // create and add the video element

      const video = document.createElement('video');

      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.style.position = 'absolute';
      video.style.top = '0px';
      video.style.left = '0px';
      // video.style.zIndex = '-2';

      this.app.graphicsDevice.canvas.before(video)
      this.video = video;

      // stream the user's camera to the video element

      const constraints = {
        audio: false,
        video: {}
      };

      constraints.video.facingMode = this.useUserCamera ? 'user' : 'environment';

      navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        this.video.addEventListener('loadedmetadata', () => {
          this.video.setAttribute('width', this.video.videoWidth.toString());
          this.video.setAttribute('height', this.video.videoHeight.toString());
          resolve();
        });
        if ("srcObject" in this.video) {
          this.video.srcObject = stream;
        } else {
          // Avoid using this in new browsers, as it is going away.
          this.video.src = URL.createObjectURL(stream);
        }
      }).catch(reject);
    });
  }

  startAR() {
    return new Promise(async (resolve, reject) => {
      const video = this.video;

      this.controller = new window.MINDAR.FACE.Controller({
        filterMinCF: 1.0,
        filterBeta: 10000,
        onUpdate: this.onUpdate.bind(this)
      });

      const flipFace = this.useUserCamera && !this.disableFaceMirror;

      await this.controller.setup(flipFace);
      this.controller.onInputResized(video);

      await this.controller.dummyRun(video);

      this.onResize();

      this.controller.processVideo(video);
      resolve()
    })
  }

  onUpdate(data) {
    if (!data.hasFace) {
      this._latestEstimate = null;
      this.setAnchorsVisible(false);
      return;
    }

    this._latestEstimate = data.estimateResult;

    const landmarks = Object.keys(this._anchorsByLandmark);
    for (let i = 0; i < landmarks.length; i++) {
      const landmarkIndex = parseInt(landmarks[i], 10);
      const anchors = this._anchorsByLandmark[landmarkIndex];
      if (!anchors) {
        continue;
      }

      const landmarkMatrix = this.controller.getLandmarkMatrix(landmarkIndex);
      this._setMat4FromRowMajor(this._faceMat, landmarkMatrix);

      for (let j = 0; j < anchors.length; j++) {
        // anchors[j].setLocalTransform(this._faceMat);
        const translation = this._faceMat.getTranslation()
        const rotation = new Quat().setFromMat4(this._faceMat)
        const scale = this._faceMat.getScale()
        anchors[j].setPosition(translation)
        anchors[j].setRotation(rotation)
        anchors[j].setLocalScale(scale)

        anchors[j].enabled = true;
      }
    }
  }

  setAnchorsVisible(visible) {
    const keys = Object.keys(this._anchorsByLandmark);
    for (let i = 0; i < keys.length; i++) {
      const anchors = this._anchorsByLandmark[keys[i]];
      if (!anchors) {
        continue;
      }
      for (let j = 0; j < anchors.length; j++) {
        anchors[j].enabled = visible;
      }
    }
  }

  onResize() {
    if (!this.video || !this.controller || !this.cameraEntity || !this.cameraEntity.camera) {
      return;
    }

    const container = this.app.graphicsDevice.canvas.parentElement || this.app.graphicsDevice.canvas;
    const video = this.video;

    this.video.setAttribute('width', this.video.videoWidth.toString());
    this.video.setAttribute('height', this.video.videoHeight.toString());
    this.controller.onInputResized(video);

    const params = this.controller.getCameraParams();
    const camera = this.cameraEntity.camera;
    camera.fov = params.fov;
    camera.nearClip = params.near;
    camera.farClip = params.far;
    camera.aspectRatio = params.aspect;
    // @ts-ignore
    camera._camera._evaluateProjectionMatrix()

    let vw;
    let vh;
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = container.clientWidth / container.clientHeight;
    if (videoRatio > containerRatio) {
      vh = container.clientHeight;
      vw = vh * videoRatio;
    } else {
      vw = container.clientWidth;
      vh = vw / videoRatio;
    }

    video.style.top = (-(vh - container.clientHeight) / 2) + 'px';
    video.style.left = (-(vw - container.clientWidth) / 2) + 'px';
    video.style.width = vw + 'px';
    video.style.height = vh + 'px';

    if (this.useUserCamera && !this.disableFaceMirror) {
      video.style.transform = 'scaleX(-1)';
    } else {
      video.style.transform = 'scaleX(1)';
    }
  }

  _setMat4FromRowMajor(out, m) {
    const d = out.data;
    d[0] = m[0];
    d[1] = m[4];
    d[2] = m[8];
    d[3] = m[12];
    d[4] = m[1];
    d[5] = m[5];
    d[6] = m[9];
    d[7] = m[13];
    d[8] = m[2];
    d[9] = m[6];
    d[10] = m[10];
    d[11] = m[14];
    d[12] = m[3];
    d[13] = m[7];
    d[14] = m[11];
    d[15] = m[15];
  }
}

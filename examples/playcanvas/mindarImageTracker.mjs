// Adapted from https://github.com/hiukim/mind-ar-js/blob/master/src/image-target/three.js

import { Script, Mat4, Vec3, Quat, Asset, Entity } from 'playcanvas';
import { MindarImageAnchor } from './mindarImageAnchor.mjs'

export class MindarImageTracker extends Script {
  static scriptName = 'mindarImageTracker';

  /**
   * .mind image target asset from the PlayCanvas project.
   * @attribute
   * @type {Asset}
   * @resource binary
   * @title Image Target Asset
   */
  imageTargetAsset;

  /**
   * Max number of targets to track at once.
   * @attribute
   * @title Max Track
   */
  maxTrack = 1;

  /**
   * Use the front/user-facing camera.
   * @attribute
   * @title Use User Camera
   */
  useUserCamera = false;

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
  anchorTag = 'mindar-image-anchor';

  initialize() {
    this._anchorsByTarget = {};
    this._postMatrices = [];
    this._worldMat = new Mat4();
    this._finalMat = new Mat4();

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
    this._anchorsByTarget = {};
    const entities = this.app.root.findByTag(this.anchorTag || 'mindar-image-anchor');
    for (let i = 0; i < entities.length; i++) {
      /** @type {Entity} */
      // @ts-ignore
      const e = entities[i];
      if (!e.script || !e.script.has(MindarImageAnchor.scriptName)) {
        continue;
      }

      /** @type {MindarImageAnchor} */
      // @ts-ignore
      const anchorScript = e.script.get(MindarImageAnchor.scriptName)
      const targetIndex = anchorScript.targetIndex;

      if (!this._anchorsByTarget[targetIndex]) {
        this._anchorsByTarget[targetIndex] = [];
      }

      this._anchorsByTarget[targetIndex].push(e);
      e.enabled = false
    }
  }

  async start() {
    if (!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.Controller) {
      console.error('MindAR image controller not found. Ensure mindar-image.prod.js is loaded first.');
      return;
    }

    if (!this.imageTargetAsset) {
      console.error('Missing or invalid imageTargetAsset');
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
      if (this.controller.dispose) {
        this.controller.dispose();
      }
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

      this.controller = new window.MINDAR.IMAGE.Controller({
        inputWidth: video.videoWidth,
        inputHeight: video.videoHeight,
        maxTrack: this.maxTrack,
        filterMinCF: 1.0,
        filterBeta: 10000,
        warmupTolerance: 0,
        missTolerance: 0,
        onUpdate: this.onUpdate.bind(this)
      });

      this.onResize();

      const url = this.imageTargetAsset.getFileUrl()
      const fullUrl = `${location.origin}${url}`

      const { dimensions: imageTargetDimensions } = await this.controller.addImageTargets(fullUrl);
      this.buildPostMatrices(imageTargetDimensions);

      await this.controller.dummyRun(this.video)

      this.controller.processVideo(this.video)
      resolve()
    })
  }

  buildPostMatrices(dimensions) {
    this._postMatrices = [];

    const pos = new Vec3();
    const rot = new Quat();
    const scale = new Vec3();
    for (let i = 0; i < dimensions.length; i++) {
      const markerWidth = dimensions[i][0];
      const markerHeight = dimensions[i][1];

      pos.set(markerWidth / 2, markerWidth / 2 + (markerHeight - markerWidth) / 2, 0);
      rot.set(0, 0, 0, 1);
      scale.set(markerWidth, markerWidth, markerWidth);

      const post = new Mat4();
      post.setTRS(pos, rot, scale);
      this._postMatrices.push(post);
    }
  }

  onUpdate(data) {
    if (data.type !== 'updateMatrix') {
      return;
    }

    const { targetIndex, worldMatrix } = data;
    const anchors = this._anchorsByTarget[targetIndex];
    if (!anchors) {
      return;
    }

    for (let i = 0; i < anchors.length; i++) {
      /** @type {Entity} */
      const anchor = anchors[i];
      if (worldMatrix === null) {
        anchor.enabled = false;
        continue;
      }

      this._worldMat.data.set(worldMatrix);
      this._finalMat.mul2(this._worldMat, this._postMatrices[targetIndex]);

      const translation = this._finalMat.getTranslation()
      const rotation = new Quat().setFromMat4(this._finalMat)
      const scale = this._finalMat.getScale()
      anchor.setPosition(translation)
      anchor.setRotation(rotation)
      anchor.setLocalScale(scale)

      anchor.enabled = true;
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

    // display css width, height
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

    // Handle when phone is rotated, video width and height are swapped
    const inputRatio = this.controller.inputWidth / this.controller.inputHeight;
    let inputAdjust;
    if (inputRatio > containerRatio) {
      inputAdjust = this.video.width / this.controller.inputWidth;
    } else {
      inputAdjust = this.video.height / this.controller.inputHeight;
    }

    let videoDisplayHeight;
    let videoDisplayWidth;
    if (inputRatio > containerRatio) {
      videoDisplayHeight = container.clientHeight;
      videoDisplayHeight *= inputAdjust;
    } else {
      videoDisplayWidth = container.clientWidth;
      videoDisplayHeight = videoDisplayWidth / this.controller.inputWidth * this.controller.inputHeight;
      videoDisplayHeight *= inputAdjust;
    }
    const fovAdjust = container.clientHeight / videoDisplayHeight;

    const proj = this.controller.getProjectionMatrix();
    // vertical fov
    const fov = 2 * Math.atan(1 / proj[5] * fovAdjust) * 180 / Math.PI;
    const near = proj[14] / (proj[10] - 1.0);
    const far = proj[14] / (proj[10] + 1.0);
    const ratio = proj[5] / proj[0]; // (r-l) / (t-b)

    const camera = this.cameraEntity.camera;
    camera.fov = fov;
    camera.nearClip = near;
    camera.farClip = far;
    camera.aspectRatio = container.clientWidth / container.clientHeight;
    // @ts-ignore
    camera._camera._evaluateProjectionMatrix()

    // finally, resize the video element

    video.style.top = (-(vh - container.clientHeight) / 2) + 'px';
    video.style.left = (-(vw - container.clientWidth) / 2) + 'px';
    video.style.width = vw + 'px';
    video.style.height = vh + 'px';
  }
}

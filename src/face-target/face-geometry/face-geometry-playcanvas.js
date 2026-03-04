import { uvs, faces } from "./face-data.js";

const nLandmarks = uvs.length;

const createPlayCanvasFaceGeometry = (pc, graphicsDevice) => {
  class FaceGeometry {
    constructor(options = {}) {
      const device = options.graphicsDevice || graphicsDevice;
      if (!device) {
        throw new Error(
          "createPlayCanvasFaceGeometry requires a PlayCanvas graphicsDevice",
        );
      }

      this.mesh = new pc.Mesh(device);
      this.positions = new Float32Array(nLandmarks * 3);
      this.uvs = new Float32Array(nLandmarks * 2);
      this.indices = new Uint16Array(faces);

      this.setUvs();
      this.mesh.setIndices(this.indices);
      this.mesh.setUvs(0, this.uvs);
      this.mesh.setPositions(this.positions);
      this.mesh.setNormals(pc.calculateNormals(this.positions, this.indices))
      this.mesh.update();
    }

    setUvs() {
      for (let j = 0; j < nLandmarks; j++) {
        this.uvs[j * 2] = uvs[j][0];
        this.uvs[j * 2 + 1] = uvs[j][1];
      }
    }

    updatePositions(landmarks) {
      for (let i = 0; i < nLandmarks; i++) {
        this.positions[i * 3 + 0] = landmarks[i][0];
        this.positions[i * 3 + 1] = landmarks[i][1];
        this.positions[i * 3 + 2] = landmarks[i][2];
      }

      this.mesh.setPositions(this.positions);
      this.mesh.setNormals(pc.calculateNormals(this.positions, this.indices))
      this.mesh.update();
    }
  }
  return new FaceGeometry();
};

export { createPlayCanvasFaceGeometry };

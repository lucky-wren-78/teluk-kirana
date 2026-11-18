// geometry.js — builds the game's low-poly meshes out of coloured boxes,
// cylinders and planes merged into single BufferGeometries with vertex colours,
// so a car, a pedestrian or a palm costs one draw call and no texture files.

import * as THREE from '../vendor/three.module.min.js';

const tmpColor = new THREE.Color();

// One coloured part: a geometry, a hex colour and a local transform.
export function coloredPart(geometry, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const matrix = new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(rx, ry, rz))
    .setPosition(x, y, z);
  if (sx !== 1 || sy !== 1 || sz !== 1) {
    matrix.multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
  }
  return { geometry, hex, matrix };
}

export function boxPart(w, h, d, hex, x, y, z, rx = 0, ry = 0, rz = 0) {
  return coloredPart(new THREE.BoxGeometry(w, h, d), hex, x, y, z, rx, ry, rz);
}

export function cylinderPart(rt, rb, h, seg, hex, x, y, z, rx = 0, ry = 0, rz = 0) {
  return coloredPart(new THREE.CylinderGeometry(rt, rb, h, seg), hex, x, y, z, rx, ry, rz);
}

export function spherePart(r, hex, x, y, z, wSeg = 10, hSeg = 8) {
  return coloredPart(new THREE.SphereGeometry(r, wSeg, hSeg), hex, x, y, z);
}

export function planePart(w, h, hex, x, y, z, rx = 0, ry = 0, rz = 0) {
  return coloredPart(new THREE.PlaneGeometry(w, h), hex, x, y, z, rx, ry, rz);
}

// Merge parts into one geometry with a baked `color` attribute. Every part is
// de-indexed so positions, normals and colours line up one to one.
export function mergeColoredParts(parts) {
  let vertexTotal = 0;
  const prepared = parts.map((part) => {
    const geom = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    geom.applyMatrix4(part.matrix);
    const count = geom.attributes.position.count;
    vertexTotal += count;
    tmpColor.setHex(part.hex);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    return { geom, colors };
  });
  const positions = new Float32Array(vertexTotal * 3);
  const normals = new Float32Array(vertexTotal * 3);
  const colors = new Float32Array(vertexTotal * 3);
  let offset = 0;
  for (const { geom, colors: partColors } of prepared) {
    positions.set(geom.attributes.position.array, offset * 3);
    normals.set(geom.attributes.normal.array, offset * 3);
    colors.set(partColors, offset * 3);
    offset += geom.attributes.position.count;
    geom.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

export function coloredMesh(parts, options = {}) {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(mergeColoredParts(parts), material);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow === true;
  return mesh;
}

// A canvas texture painted in code — building facades with lit windows, the
// road markings, the sea shimmer. No image files, so the game stays offline.
export function makeCanvasTexture(width, height, painter, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  painter(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

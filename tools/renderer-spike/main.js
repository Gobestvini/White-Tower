import * as THREE from 'three';

const width = 720;
const height = 1280;
const palette = { blue: 0x60c0fe, top: 0xf4f4f4, side: 0xdddfdc, seam: 0xc9cfca, yellow: 0xffdd28, arrow: 0xff951c };
const tiles = [
  { u: 0, v: 0, h: 1, direction: true }, { u: 1, v: 0, h: 1 },
  { u: 2, v: 0, h: 1 }, { u: 3, v: 0, h: 1 },
  { u: 4.6, v: 0.7, h: 14 },
];
const origin = { x: 210, y: 930 };
const project = (u, v, layer = 0) => ({
  x: origin.x + (u - v) * 100,
  y: origin.y - (u + v) * 100 - layer * 12.8,
});

function makeGeometry(points, depth) {
  const vertices = [];
  for (let index = 1; index < points.length - 1; index++) {
    for (const point of [points[0], points[index], points[index + 1]]) vertices.push(point.x, point.y, depth);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const canvas = document.querySelector('#three');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(1);
renderer.setSize(width, height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.blue);
const camera = new THREE.OrthographicCamera(0, width, 0, height, -20, 20);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);
const materials = Object.fromEntries(Object.entries(palette).map(([name, value]) =>
  [name, new THREE.MeshBasicMaterial({ color: value, side: THREE.DoubleSide })]));
const owned = [];

function drawPolygon(points, depth, material) {
  const geometry = makeGeometry(points, depth);
  const mesh = new THREE.Mesh(geometry, materials[material]);
  scene.add(mesh);
  owned.push(geometry);
}

function diamond(u, v, size, layer = 0) {
  const center = project(u, v, layer);
  const half = size / 2;
  return [
    { x: center.x, y: center.y - half },
    { x: center.x + half, y: center.y },
    { x: center.x, y: center.y + half },
    { x: center.x - half, y: center.y },
  ];
}

function makeArtBatches() {
  const batches = new Map(Object.keys(palette).map(name => [name, []]));
  function add(points, name, elevation = 0) {
    const target = batches.get(name);
    for (let index = 1; index < points.length - 1; index++) {
      for (const point of [points[0], points[index], points[index + 1]]) target.push(point.x, height - point.y, elevation);
    }
  }
  for (const tile of tiles) {
    if (tile.blocked) continue;
    add(diamond(tile.u, tile.v, 157).map(point => ({ x: point.x, y: point.y + 14 })), 'yellow');
    for (let layer = 0; layer < tile.h; layer++) {
      const top = diamond(tile.u, tile.v, 148, layer);
      const bottom = top.map(point => ({ x: point.x, y: point.y + 12 }));
      add([top[2], top[3], bottom[3], bottom[2]], 'seam', layer + 0.2);
      add([top[1], top[2], bottom[2], bottom[1]], 'side', layer + 0.2);
      add(top, 'top', layer + 1);
    }
    if (tile.direction) {
      const point = project(tile.u, tile.v, tile.h);
      add([
        { x: point.x - 18, y: point.y + 6 }, { x: point.x - 8, y: point.y + 16 },
        { x: point.x + 2, y: point.y + 6 }, { x: point.x - 8, y: point.y - 4 },
      ], 'arrow', tile.h + 1.2);
      add([
        { x: point.x - 8, y: point.y + 8 }, { x: point.x + 10, y: point.y - 10 },
        { x: point.x + 21, y: point.y + 1 }, { x: point.x + 3, y: point.y + 19 },
      ], 'arrow', tile.h + 1.2);
    }
  }
  return batches;
}

function compileShader(gl, kind, source) {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error('Shader allocation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Shader compilation failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function renderRawWebGl() {
  const canvas = document.querySelector('#raw-webgl');
  const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL2 unavailable');
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.clearColor(96 / 255, 192 / 255, 254 / 255, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec3 point; uniform vec2 extent;
    void main() { vec2 clip = point.xy / extent * 2.0 - 1.0; gl_Position = vec4(clip.x, clip.y, 1.0 - point.z / 20.0, 1.0); }`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision mediump float; uniform vec4 tint; out vec4 color;
    void main() { color = tint; }`);
  const program = gl.createProgram();
  if (!program) throw new Error('Program allocation failed');
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
  const vao = gl.createVertexArray(); const buffer = gl.createBuffer();
  if (!vao || !buffer) throw new Error('Buffer allocation failed');
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const location = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  gl.useProgram(program); gl.uniform2f(gl.getUniformLocation(program, 'extent'), width, height);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const batches = makeArtBatches();
  const pixels = Object.fromEntries(Object.entries(palette).map(([key, value]) =>
    [key, [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1]]));
  for (const key of ['yellow', 'seam', 'side', 'top', 'arrow']) {
    const points = new Float32Array(batches.get(key));
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    gl.uniform4fv(gl.getUniformLocation(program, 'tint'), pixels[key]);
    gl.drawArrays(gl.TRIANGLES, 0, points.length / 2);
  }
  return { gl, program, vertex, fragment, vao, buffer };
}

for (const tile of tiles) {
  if (tile.blocked) continue;
  const floor = diamond(tile.u, tile.v, 157).map(point => ({ x: point.x, y: point.y + 14 }));
  drawPolygon(floor, -0.2, 'yellow');

  for (let layer = 0; layer < tile.h; layer++) {
    const depth = layer * 0.02;
    const top = diamond(tile.u, tile.v, 148, layer);
    const bottom = top.map(point => ({ x: point.x, y: point.y + 12 }));
    drawPolygon([top[2], top[3], bottom[3], bottom[2]], depth - 0.01, 'seam');
    drawPolygon([top[1], top[2], bottom[2], bottom[1]], depth - 0.01, 'side');
    drawPolygon(top, depth, 'top');
  }

  if (tile.direction) {
    const point = project(tile.u, tile.v, tile.h);
      drawPolygon([
        { x: point.x - 18, y: point.y + 6 }, { x: point.x - 8, y: point.y + 16 },
        { x: point.x + 2, y: point.y + 6 }, { x: point.x - 8, y: point.y - 4 },
      ], 1, 'arrow');
      drawPolygon([
        { x: point.x - 8, y: point.y + 8 }, { x: point.x + 10, y: point.y - 10 },
        { x: point.x + 21, y: point.y + 1 }, { x: point.x + 3, y: point.y + 19 },
      ], 1, 'arrow');
  }
}
renderer.render(scene, camera);
const rawWebGl = renderRawWebGl();

const canvas2d = document.querySelector('#canvas');
canvas2d.width = width;
canvas2d.height = height;
const context = canvas2d.getContext('2d');
context.fillStyle = '#60c0fe';
context.fillRect(0, 0, width, height);
function drawCanvasPolygon(points, fill) {
  context.beginPath();
  points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}
const hex = value => `#${value.toString(16).padStart(6, '0')}`;

for (const tile of tiles) {
  if (tile.blocked) continue;
  drawCanvasPolygon(diamond(tile.u, tile.v, 157).map(point => ({ x: point.x, y: point.y + 14 })), hex(palette.yellow));
  for (let layer = 0; layer < tile.h; layer++) {
    const top = diamond(tile.u, tile.v, 148, layer);
    const bottom = top.map(point => ({ x: point.x, y: point.y + 12 }));
    drawCanvasPolygon([top[2], top[3], bottom[3], bottom[2]], hex(palette.seam));
    drawCanvasPolygon([top[1], top[2], bottom[2], bottom[1]], hex(palette.side));
    drawCanvasPolygon(top, hex(palette.top));
  }
  if (tile.direction) {
    const point = project(tile.u, tile.v, tile.h);
    drawCanvasPolygon([
      { x: point.x - 18, y: point.y + 6 }, { x: point.x - 8, y: point.y + 16 },
      { x: point.x + 2, y: point.y + 6 }, { x: point.x - 8, y: point.y - 4 },
    ], hex(palette.arrow));
    drawCanvasPolygon([
      { x: point.x - 8, y: point.y + 8 }, { x: point.x + 10, y: point.y - 10 },
      { x: point.x + 21, y: point.y + 1 }, { x: point.x + 3, y: point.y + 19 },
    ], hex(palette.arrow));
  }
}

function renderHud(selector) {
  const overlay = document.querySelector(selector);
  overlay.width = width; overlay.height = height;
  const hud = overlay.getContext('2d');
  hud.fillStyle = '#3c7ea9';
  for (const [x, y] of [[76, 93], [644, 93], [360, 125], [360, 1123]]) { hud.beginPath(); hud.arc(x, y, 44, 0, Math.PI * 2); hud.fill(); }
  hud.fillStyle = '#fff'; hud.font = 'bold 32px system-ui'; hud.textAlign = 'center'; hud.textBaseline = 'middle';
  for (const [x, y, label] of [[76, 93, '⚙'], [644, 93, '↻'], [360, 125, '0 / 4'], [360, 1123, '↶ UNDO']]) hud.fillText(label, x, y);
  hud.fillStyle = '#657d89'; hud.font = '32px system-ui'; hud.textAlign = 'left'; hud.fillText('Lv.1', 35, 158);
}
for (const selector of ['#three-ui', '#raw-ui', '#canvas-ui']) renderHud(selector);

window.rendererComparison = {
  three: renderer.info.render,
  rawWebGl: { drawCalls: 5, colourBatches: 5 },
  artboard: { width, height },
  dispose() {
    for (const geometry of owned) geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
    renderer.dispose();
    const { gl, program, vertex, fragment, vao, buffer } = rawWebGl;
    gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
  },
};

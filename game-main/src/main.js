import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils.js";
import planeModelUrl from "../assets/plane.glb?url";
import missileModelUrl from "../assets/rocket.glb?url";
import cityModelUrl from "../assets/city.glb?url";
import hokageModelUrl from "../assets/hokage_mountain.glb?url";
import reactorModelUrl from "../assets/arc_reactor.glb?url";
import animeGirlModelUrl from "../assets/anime_girl.glb?url";
import campusModelUrl from "../assets/ccnb_campus.glb?url";
import ghostModelUrl from "../assets/ghost_daughter.glb?url";

const canvas = document.getElementById("game");
const speedValue = document.getElementById("speedValue");
const altitudeValue = document.getElementById("altitudeValue");
const healthValue = document.getElementById("healthValue");
const playersValue = document.getElementById("playersValue");
const playerSignalsList = document.getElementById("playerSignalsList");
const startBtn = document.getElementById("startBtn");
const boostBtn = document.getElementById("boostBtn");
const missileBtn = document.getElementById("missileBtn");
const statusLine = document.getElementById("statusLine");
const controlPad = document.getElementById("controlPad");
const padBoostBtn = document.getElementById("padBoostBtn");
const padMissileBtn = document.getElementById("padMissileBtn");
const padViewBtn = document.getElementById("padViewBtn");
const padStartBtn = document.getElementById("padStartBtn");
const holdControlButtons = controlPad ? [...controlPad.querySelectorAll(".hold-btn")] : [];
const introVideoOverlay = document.getElementById("introVideoOverlay");
const introVideo = document.getElementById("introVideo");

if (introVideoOverlay && introVideo) {
  let introDone = false;

  const finishIntro = () => {
    if (introDone) return;
    introDone = true;
    introVideoOverlay.classList.add("done");
    window.setTimeout(() => {
      introVideoOverlay.remove();
    }, 280);
  };

  const tryPlayIntro = () => {
    const playPromise = introVideo.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  };

  introVideo.addEventListener("ended", finishIntro, { once: true });
  introVideo.addEventListener("error", finishIntro, { once: true });
  tryPlayIntro();

  window.addEventListener(
    "pointerdown",
    () => {
      if (introDone) return;
      tryPlayIntro();
      if (introVideo.paused) {
        finishIntro();
      }
    },
    { once: true }
  );

  // Fallback: if playback never starts, continue to the game.
  window.setTimeout(() => {
    if (introDone) return;
    if (introVideo.paused && introVideo.currentTime < 0.01) {
      finishIntro();
    }
  }, 4000);
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9d6ff, 180, 7000);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 18000);
camera.position.set(0, 8, 18);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const hemi = new THREE.HemisphereLight(0xd9efff, 0x4f89a8, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff7e8, 1.25);
sun.position.set(260, 380, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color(0x64afff) },
    midColor: { value: new THREE.Color(0x9dd5ff) },
    bottomColor: { value: new THREE.Color(0xeef8ff) }
  },
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    varying vec3 vWorld;
    uniform vec3 topColor;
    uniform vec3 midColor;
    uniform vec3 bottomColor;
    void main() {
      float h = normalize(vWorld).y * 0.5 + 0.5;
      vec3 c1 = mix(bottomColor, midColor, smoothstep(0.0, 0.58, h));
      vec3 c2 = mix(c1, topColor, smoothstep(0.56, 1.0, h));
      gl_FragColor = vec4(c2, 1.0);
    }
  `
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), skyMat);
scene.add(skyDome);

const oceanUniforms = {
  uTime: { value: 0 },
  deepColor: { value: new THREE.Color(0x1f5d96) },
  shallowColor: { value: new THREE.Color(0x3d8fd1) },
  horizonColor: { value: new THREE.Color(0xaad8ff) }
};

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(18000, 18000, 300, 300),
  new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    transparent: false,
    vertexShader: `
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float w1 = sin((p.x * 0.025) + (uTime * 1.0));
        float w2 = cos((p.y * 0.02) - (uTime * 0.8));
        float w3 = sin((p.x + p.y) * 0.015 + uTime * 0.6);
        p.z += (w1 + w2 * 0.7 + w3 * 0.5) * 2.8;
        vWave = p.z;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 horizonColor;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        float h = clamp((vWorld.y + 20.0) / 80.0, 0.0, 1.0);
        float wave = clamp((vWave + 4.0) / 8.0, 0.0, 1.0);
        vec3 water = mix(deepColor, shallowColor, wave * 0.7 + h * 0.2);
        float horizonBlend = smoothstep(800.0, 6000.0, length(vWorld.xz));
        vec3 col = mix(water, horizonColor, horizonBlend * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = 0;
scene.add(ocean);

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);

function createCloud() {
  const g = new THREE.Group();
  const puffGeo = new THREE.SphereGeometry(1, 11, 9);
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 });
  const count = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i += 1) {
    const puff = new THREE.Mesh(puffGeo, puffMat);
    puff.position.set((Math.random() - 0.5) * 10, Math.random() * 2.4, (Math.random() - 0.5) * 8);
    puff.scale.setScalar(1.2 + Math.random() * 2.6);
    g.add(puff);
  }
  g.position.set((Math.random() - 0.5) * 5200, 130 + Math.random() * 460, (Math.random() - 0.5) * 5200);
  g.userData.drift = 2 + Math.random() * 4;
  return g;
}

for (let i = 0; i < 95; i += 1) {
  cloudGroup.add(createCloud());
}

const islandGroup = new THREE.Group();
scene.add(islandGroup);
const cityGroup = new THREE.Group();
scene.add(cityGroup);
const hokageGroup = new THREE.Group();
scene.add(hokageGroup);
const reactorGroup = new THREE.Group();
scene.add(reactorGroup);
const animeGirlGroup = new THREE.Group();
scene.add(animeGirlGroup);
const campusGroup = new THREE.Group();
scene.add(campusGroup);

const landmarkLayout = {
  city: { span: 2200, sinkDepth: 12, x: 0, z: 3200, rotationY: Math.PI * 0.16 },
  hokage: { span: 1200, sinkDepth: 10, x: -3600, z: 3400, rotationY: -Math.PI * 0.18 },
  reactor: { span: 420, sinkDepth: 8, x: 3600, z: 3400, rotationY: Math.PI * 0.28 },
  animeGirl: { span: 120, sinkDepth: 1, x: 0, z: -3000, rotationY: -Math.PI * 0.12 },
  campus: { span: 1800, sinkDepth: 12, x: 4200, z: -3600, rotationY: Math.PI * 0.08 }
};

const islandPlacement = {
  spread: 9800,
  minDistanceFromLandmark: 1450,
  maxAttempts: 16
};

const landmarkAvoidZones = [
  { x: landmarkLayout.city.x, z: landmarkLayout.city.z },
  { x: landmarkLayout.hokage.x, z: landmarkLayout.hokage.z },
  { x: landmarkLayout.reactor.x, z: landmarkLayout.reactor.z },
  { x: landmarkLayout.animeGirl.x, z: landmarkLayout.animeGirl.z },
  { x: landmarkLayout.campus.x, z: landmarkLayout.campus.z }
];

function pickIslandPosition() {
  for (let i = 0; i < islandPlacement.maxAttempts; i += 1) {
    const x = (Math.random() - 0.5) * islandPlacement.spread;
    const z = (Math.random() - 0.5) * islandPlacement.spread;

    let tooClose = false;
    for (const zone of landmarkAvoidZones) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      if (dx * dx + dz * dz < islandPlacement.minDistanceFromLandmark * islandPlacement.minDistanceFromLandmark) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) return { x, z };
  }

  return {
    x: (Math.random() < 0.5 ? -1 : 1) * islandPlacement.spread * 0.46,
    z: (Math.random() - 0.5) * islandPlacement.spread
  };
}

function createIsland() {
  const radius = 26 + Math.random() * 80;
  const height = 20 + Math.random() * 95;
  const geo = new THREE.ConeGeometry(radius, height, 20, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6f7f58, roughness: 0.88, metalness: 0.02 });
  const island = new THREE.Mesh(geo, mat);
  const islandPos = pickIslandPosition();
  island.position.set(islandPos.x, (height * 0.5) - 7, islandPos.z);
  island.rotation.y = Math.random() * Math.PI;
  island.castShadow = true;
  island.receiveShadow = true;
  islandGroup.add(island);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.45, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x7b8f61, roughness: 0.9, metalness: 0 })
  );
  cap.position.copy(island.position).add(new THREE.Vector3(0, height * 0.43, 0));
  cap.scale.set(1, 0.5, 1);
  cap.castShadow = true;
  cap.receiveShadow = true;
  islandGroup.add(cap);
}

for (let i = 0; i < 44; i += 1) {
  createIsland();
}

const planeRoot = new THREE.Group();
scene.add(planeRoot);
const planeSpeedMultiplier = 1.5;

const planeState = {
  speed: 0,
  throttle: 0,
  throttleVel: 0,
  minSpeed: -70 * planeSpeedMultiplier,
  maxSpeed: 135 * planeSpeedMultiplier,
  yawVel: 0,
  pitchVel: 0,
  rollVel: 0,
  turnRate: 1.85,
  pitchRate: 1.35,
  rollRate: 2.25,
  climbForce: 38,
  forward: new THREE.Vector3(0, 0, -1),
  velocity: new THREE.Vector3()
};

let running = false;
let planeMesh = null;
let cityMesh = null;
let hokageMesh = null;
let reactorMesh = null;
let animeGirlMesh = null;
let campusMesh = null;
let animeGirlMixer = null;
let localPlayerId = null;
let localHp = 100;
let socket = null;
let socketConnected = false;
let stateSyncTimer = 0;
let signalsUiTimer = 0;
let missileSerial = 0;
const remotePlayers = new Map();
const remoteMissiles = [];
const propellers = [];
const missiles = [];
const keys = {};
const dragState = { active: false, lastX: 0, lastY: 0 };
const cameraModes = ["back", "side", "front"];
const cameraPresets = {
  back: { offset: new THREE.Vector3(0.0, 4.8, 14.0), lookForward: 7.0 },
  side: { offset: new THREE.Vector3(8.0, 5.0, 10.0), lookForward: 6.0 },
  front: { offset: new THREE.Vector3(0.0, 4.0, -11.0), lookForward: 0.0 }
};
let cameraModeIndex = 2;
const speedControlConfig = {
  minThrottle: -0.72,
  maxThrottle: 0.9,
  cruiseThrottle: 0,
  throttleRate: 0.7,
  throttleReturn: 0,
  speedResponse: 4.2,
  airDrag: 0.12
};
const multiplayerConfig = {
  wsPort: 8080,
  stateRate: 0.05,
  missileHitRadius: 3.2,
  missileDamage: 20,
  maxHp: 100
};
const boostTargetSpeed = 100 * planeSpeedMultiplier;
const missileConfig = { speed: 220, lifetime: 4.2, cooldown: 0.22, maxActive: 18 };
const missileFocusConfig = { duration: 0.1, timeScale: 0.2 };
let missileCooldown = 0;
let missileFocusTimer = 0;
let missileSide = 1;
const fallbackMissileForwardAxis = new THREE.Vector3(0, 0, -1);
const missileTemplateForwardAxis = new THREE.Vector3(0, 0, -1);
let missileTemplate = null;
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpPropPos = new THREE.Vector3();
const tmpSignalPos = new THREE.Vector3();
const tmpSize = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();
const missileBodyGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.2, 10);
missileBodyGeo.rotateX(Math.PI / 2);
const missileTipGeo = new THREE.ConeGeometry(0.11, 0.35, 10);
missileTipGeo.rotateX(Math.PI / 2);
const missileBodyMat = new THREE.MeshStandardMaterial({
  color: 0xd6dce2,
  roughness: 0.32,
  metalness: 0.78
});
const missileTipMat = new THREE.MeshStandardMaterial({
  color: 0xff8d3a,
  emissive: 0x331000,
  roughness: 0.35,
  metalness: 0.3
});

function getCameraModeLabel() {
  const mode = cameraModes[cameraModeIndex];
  if (mode === "back") return "Back view";
  if (mode === "side") return "Side view";
  return "Front view";
}

function setCameraMode(index) {
  cameraModeIndex = ((index % cameraModes.length) + cameraModes.length) % cameraModes.length;
  camera.userData.snapFrames = 8;
  setStatus(`Running | ${getCameraModeLabel()}`);
}

function cycleCameraMode() {
  setCameraMode(cameraModeIndex + 1);
}

function setStatus(msg) {
  statusLine.textContent = msg;
}

function updateHealthDisplay() {
  if (!healthValue) return;
  healthValue.textContent = `${Math.round(localHp)}%`;
}

function updatePlayersCount() {
  if (!playersValue) return;
  playersValue.textContent = String(1 + remotePlayers.size);
}

function getCompassDirection(fromPos, toPos) {
  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  const angle = Math.atan2(dx, -dz);
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const sector = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  return directions[sector];
}

function updatePlayerSignalsPanel() {
  if (!playerSignalsList) return;
  if (remotePlayers.size === 0) {
    playerSignalsList.innerHTML = '<div class="signal-empty">No other players</div>';
    return;
  }

  const sourcePos = planeRoot.position;
  const entries = [];
  for (const remote of remotePlayers.values()) {
    if (!remote.initialized) continue;
    const dist = sourcePos.distanceTo(remote.root.position);
    entries.push({
      id: remote.id,
      dist,
      hp: remote.hp,
      dir: getCompassDirection(sourcePos, remote.root.position)
    });
  }

  if (entries.length === 0) {
    playerSignalsList.innerHTML = '<div class="signal-empty">Syncing players...</div>';
    return;
  }

  entries.sort((a, b) => a.dist - b.dist);
  const frag = document.createDocumentFragment();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "signal-item";
    row.textContent = `${entry.id} | ${entry.dir} | ${entry.dist.toFixed(0)}m | HP ${Math.round(entry.hp)}`;
    frag.appendChild(row);
  }
  playerSignalsList.replaceChildren(frag);
}

function getMultiplayerWsUrl() {
  const override = new URLSearchParams(window.location.search).get("ws");
  if (override) return override;

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  const devPorts = new Set(["5173", "4173", "4174"]);
  if (devPorts.has(window.location.port)) {
    return `${protocol}://${host}:${multiplayerConfig.wsPort}`;
  }

  const port = window.location.port ? `:${window.location.port}` : "";
  return `${protocol}://${host}${port}/ws`;
}

function sendSocket(payload) {
  if (!socket || !socketConnected || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function makeRemoteFallbackPlaneVisual() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x57b2ff,
    roughness: 0.45,
    metalness: 0.18
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xc8ecff,
    roughness: 0.62,
    metalness: 0.08
  });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 6.4, 14), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  g.add(fuselage);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 6.2), wingMat);
  wing.position.set(0.2, 0.08, 0);
  g.add(wing);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.73, 1.6, 14), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 3.7;
  g.add(nose);

  g.rotation.y = Math.PI;
  return g;
}

function createRemotePlaneVisual() {
  const root = planeMesh ? planeMesh.clone(true) : makeRemoteFallbackPlaneVisual();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  return root;
}

function ensureRemotePlayer(id) {
  if (!id || id === localPlayerId) return null;
  if (remotePlayers.has(id)) return remotePlayers.get(id);

  const root = new THREE.Group();
  const visual = createRemotePlaneVisual();
  root.add(visual);
  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.72, 1.8, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4f6a })
  );
  beacon.position.set(0, 6.6, 0);
  beacon.rotation.x = Math.PI;
  root.add(beacon);
  scene.add(root);

  const state = {
    id,
    hp: multiplayerConfig.maxHp,
    root,
    beacon,
    targetPos: new THREE.Vector3(),
    targetQuat: new THREE.Quaternion(),
    initialized: false
  };
  remotePlayers.set(id, state);
  updatePlayersCount();
  updatePlayerSignalsPanel();
  return state;
}

function removeRemotePlayer(id) {
  const state = remotePlayers.get(id);
  if (!state) return;
  scene.remove(state.root);
  remotePlayers.delete(id);
  updatePlayersCount();
  updatePlayerSignalsPanel();
}

function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) {
    removeRemotePlayer(id);
  }
}

function clearRemoteMissiles() {
  for (const missile of remoteMissiles) {
    scene.remove(missile.mesh);
  }
  remoteMissiles.length = 0;
}

function spawnRemoteMissile(payload) {
  if (!payload || payload.ownerId === localPlayerId) return;
  const missileSpawn = makeMissileMesh();
  const missileMesh = missileSpawn.mesh;
  const position = Array.isArray(payload.position) ? payload.position : [0, 0, 0];
  const velocity = Array.isArray(payload.velocity) ? payload.velocity : [0, 0, 0];
  const velocityVec = new THREE.Vector3(velocity[0] || 0, velocity[1] || 0, velocity[2] || 0);

  missileMesh.position.set(position[0] || 0, position[1] || 0, position[2] || 0);
  if (velocityVec.lengthSq() > 0.0001) {
    missileMesh.quaternion.setFromUnitVectors(missileSpawn.forwardAxis, velocityVec.clone().normalize());
  }
  scene.add(missileMesh);

  remoteMissiles.push({
    ownerId: payload.ownerId,
    missileId: payload.missileId || `${payload.ownerId}-${Date.now()}`,
    mesh: missileMesh,
    velocity: velocityVec,
    life: missileConfig.lifetime
  });
}

function handleMultiplayerMessage(msg) {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "welcome") {
    localPlayerId = msg.id || null;
    if (Number.isFinite(msg.maxHp)) {
      multiplayerConfig.maxHp = msg.maxHp;
    }
    localHp = multiplayerConfig.maxHp;
    updateHealthDisplay();
    clearRemotePlayers();

    if (Array.isArray(msg.players)) {
      for (const p of msg.players) {
        if (!p?.id || p.id === localPlayerId) continue;
        const remote = ensureRemotePlayer(p.id);
        if (!remote) continue;
        const pos = Array.isArray(p.position) ? p.position : [0, 0, 0];
        const quat = Array.isArray(p.quaternion) ? p.quaternion : [0, 0, 0, 1];
        remote.root.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0);
        remote.targetPos.copy(remote.root.position);
        remote.root.quaternion.set(quat[0] || 0, quat[1] || 0, quat[2] || 0, quat[3] || 1);
        remote.targetQuat.copy(remote.root.quaternion);
        remote.initialized = true;
        remote.hp = Number.isFinite(p.hp) ? p.hp : multiplayerConfig.maxHp;
      }
    }
    updatePlayersCount();
    updatePlayerSignalsPanel();
    return;
  }

  if (msg.type === "player_join" && msg.player?.id) {
    ensureRemotePlayer(msg.player.id);
    setStatus(`Player joined: ${msg.player.id} | ${getCameraModeLabel()}`);
    return;
  }

  if (msg.type === "player_leave" && msg.id) {
    removeRemotePlayer(msg.id);
    setStatus(`Player left: ${msg.id} | ${getCameraModeLabel()}`);
    return;
  }

  if (msg.type === "state" && msg.id && msg.id !== localPlayerId) {
    const remote = ensureRemotePlayer(msg.id);
    if (!remote) return;
    const pos = Array.isArray(msg.position) ? msg.position : [0, 0, 0];
    const quat = Array.isArray(msg.quaternion) ? msg.quaternion : [0, 0, 0, 1];
    remote.targetPos.set(pos[0] || 0, pos[1] || 0, pos[2] || 0);
    remote.targetQuat.set(quat[0] || 0, quat[1] || 0, quat[2] || 0, quat[3] || 1);
    if (!remote.initialized) {
      remote.root.position.copy(remote.targetPos);
      remote.root.quaternion.copy(remote.targetQuat);
      remote.initialized = true;
    }
    return;
  }

  if (msg.type === "fire") {
    spawnRemoteMissile(msg);
    return;
  }

  if (msg.type === "hp" && msg.id) {
    if (msg.id === localPlayerId) {
      localHp = Number.isFinite(msg.hp) ? THREE.MathUtils.clamp(msg.hp, 0, multiplayerConfig.maxHp) : localHp;
      updateHealthDisplay();
      if (localHp <= 0) {
        running = false;
        setStatus("You are destroyed. Press Restart.");
      }
      return;
    }
    const remote = remotePlayers.get(msg.id);
    if (remote) {
      remote.hp = Number.isFinite(msg.hp) ? msg.hp : remote.hp;
      updatePlayerSignalsPanel();
    }
  }
}

function connectMultiplayer() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const wsUrl = getMultiplayerWsUrl();
  try {
    socket = new WebSocket(wsUrl);
  } catch (err) {
    console.warn("Multiplayer socket create failed", err);
    setTimeout(connectMultiplayer, 2500);
    return;
  }

  socket.addEventListener("open", () => {
    socketConnected = true;
    stateSyncTimer = 0;
    setStatus(`Connected | ${getCameraModeLabel()}`);
  });
  socket.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    handleMultiplayerMessage(msg);
  });
  socket.addEventListener("close", () => {
    socketConnected = false;
    localPlayerId = null;
    clearRemotePlayers();
    clearRemoteMissiles();
    updatePlayersCount();
    updatePlayerSignalsPanel();
    setStatus(`Offline mode | ${getCameraModeLabel()}`);
    setTimeout(connectMultiplayer, 2500);
  });
  socket.addEventListener("error", () => {
    socketConnected = false;
  });
}

function syncLocalPlayerState(dt) {
  if (!socketConnected || !localPlayerId || !planeMesh) return;
  stateSyncTimer += dt;
  if (stateSyncTimer < multiplayerConfig.stateRate) return;
  stateSyncTimer = 0;

  sendSocket({
    type: "state",
    position: [planeRoot.position.x, planeRoot.position.y, planeRoot.position.z],
    quaternion: [planeRoot.quaternion.x, planeRoot.quaternion.y, planeRoot.quaternion.z, planeRoot.quaternion.w],
    speed: planeState.speed
  });
}

function updateRemotePlayers(dt) {
  const blend = 1 - Math.exp(-10 * dt);
  for (const remote of remotePlayers.values()) {
    if (!remote.initialized) continue;
    remote.root.position.lerp(remote.targetPos, blend);
    remote.root.quaternion.slerp(remote.targetQuat, blend);
    if (remote.beacon) {
      remote.root.getWorldPosition(tmpSignalPos);
      remote.beacon.rotation.y += dt * 2.4;
      remote.beacon.position.y = 6.2 + Math.sin((performance.now() * 0.005) + tmpSignalPos.x * 0.01) * 0.35;
    }
  }
}

function applyLocalDamage(amount) {
  localHp = THREE.MathUtils.clamp(localHp - amount, 0, multiplayerConfig.maxHp);
  updateHealthDisplay();
  sendSocket({ type: "damage", amount });
  if (localHp <= 0) {
    running = false;
    setStatus("You are destroyed. Press Restart.");
  }
}

function updateRemoteMissiles(dt) {
  for (let i = remoteMissiles.length - 1; i >= 0; i -= 1) {
    const missile = remoteMissiles[i];
    missile.mesh.position.addScaledVector(missile.velocity, dt);
    missile.mesh.rotateZ(11 * dt);
    missile.life -= dt;

    let hitLocal = false;
    if (running && planeMesh && missile.ownerId !== localPlayerId) {
      const dist = missile.mesh.position.distanceTo(planeRoot.position);
      if (dist < multiplayerConfig.missileHitRadius) {
        hitLocal = true;
        applyLocalDamage(multiplayerConfig.missileDamage);
      }
    }

    if (
      hitLocal ||
      missile.life <= 0 ||
      missile.mesh.position.y < -30 ||
      missile.mesh.position.lengthSq() > 17000 * 17000
    ) {
      scene.remove(missile.mesh);
      remoteMissiles.splice(i, 1);
    }
  }
}

function setControlKeyState(keyCode, isDown) {
  keys[keyCode] = isDown;
}

function setControlKeyStates(keyCodes, isDown) {
  for (const keyCode of keyCodes) {
    setControlKeyState(keyCode, isDown);
  }
}

function clearAllControlKeys() {
  for (const key of Object.keys(keys)) {
    keys[key] = false;
  }
  for (const button of holdControlButtons) {
    button.classList.remove("active");
  }
}

function bindHoldControlButton(button) {
  const keyCodes = (button.dataset.key || "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  if (keyCodes.length === 0) return;

  const release = () => {
    setControlKeyStates(keyCodes, false);
    button.classList.remove("active");
  };

  const pointerSupported = typeof window !== "undefined" && "PointerEvent" in window;

  if (pointerSupported) {
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      setControlKeyStates(keyCodes, true);
      button.classList.add("active");
      if (button.setPointerCapture) {
        try {
          button.setPointerCapture(e.pointerId);
        } catch {
          // Ignore pointer capture failures on browsers that reject capture.
        }
      }
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && e.buttons === 0) {
        release();
      }
    });
    return;
  }

  button.addEventListener("touchstart", (e) => {
    e.preventDefault();
    setControlKeyStates(keyCodes, true);
    button.classList.add("active");
  }, { passive: false });
  button.addEventListener("touchend", release);
  button.addEventListener("touchcancel", release);
  button.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    setControlKeyStates(keyCodes, true);
    button.classList.add("active");
  });
  button.addEventListener("mouseup", release);
  button.addEventListener("mouseleave", (e) => {
    if ((e.buttons & 1) === 0) {
      release();
    }
  });
}

function applySpeedBoost() {
  if (!running || !planeMesh) return;

  const maxForwardSpeed = Math.max(0, planeState.maxSpeed);
  const targetSpeed = THREE.MathUtils.clamp(boostTargetSpeed, 0, maxForwardSpeed);
  const throttleForTarget = maxForwardSpeed <= 0
    ? 0
    : (targetSpeed / maxForwardSpeed) * speedControlConfig.maxThrottle;

  planeState.throttle = THREE.MathUtils.clamp(
    throttleForTarget,
    speedControlConfig.minThrottle,
    speedControlConfig.maxThrottle
  );
  planeState.speed = targetSpeed;
  speedValue.textContent = `${targetSpeed.toFixed(0)} km/h`;
}

function setMissileButtonState() {
  if (!missileBtn) return;
  const ready = running && planeMesh && missileCooldown <= 0;
  missileBtn.disabled = !ready;
}

function makeFallbackMissileMesh() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(missileBodyGeo, missileBodyMat);
  body.castShadow = true;
  body.receiveShadow = false;
  g.add(body);

  const tip = new THREE.Mesh(missileTipGeo, missileTipMat);
  tip.position.z = -0.77;
  tip.castShadow = true;
  tip.receiveShadow = false;
  g.add(tip);

  return {
    mesh: g,
    forwardAxis: fallbackMissileForwardAxis
  };
}

function inferForwardAxisFromBox(box) {
  const size = box.getSize(tmpSize);
  let axis = "x";
  if (size.y >= size.x && size.y >= size.z) axis = "y";
  if (size.z >= size.x && size.z >= size.y) axis = "z";

  let minVal = box.min.x;
  let maxVal = box.max.x;
  if (axis === "y") {
    minVal = box.min.y;
    maxVal = box.max.y;
  } else if (axis === "z") {
    minVal = box.min.z;
    maxVal = box.max.z;
  }

  const sign = Math.abs(minVal) > Math.abs(maxVal) ? -1 : 1;
  if (axis === "x") return new THREE.Vector3(sign, 0, 0);
  if (axis === "y") return new THREE.Vector3(0, sign, 0);
  return new THREE.Vector3(0, 0, sign);
}

function prepareMissileTemplate(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = false;
  });

  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return null;

  const inferredForward = inferForwardAxisFromBox(box).normalize();
  const longest = Math.max(tmpSize.x, tmpSize.y, tmpSize.z) || 1;
  const scale = 2.1 / longest;
  root.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(root);
  scaledBox.getCenter(tmpCenter);
  root.position.sub(tmpCenter);

  return {
    root,
    forwardAxis: inferredForward
  };
}

function makeMissileMesh() {
  if (missileTemplate) {
    return {
      mesh: missileTemplate.clone(true),
      forwardAxis: missileTemplateForwardAxis
    };
  }
  return makeFallbackMissileMesh();
}

function clearMissiles() {
  for (const missile of missiles) {
    scene.remove(missile.mesh);
  }
  missiles.length = 0;
}

function getMissileLaunchDirection(outDir) {
  outDir.copy(planeState.forward).normalize();
  if (propellers.length === 0) return outDir;

  propellers[0].getWorldPosition(tmpPropPos);
  tmpPropPos.sub(planeRoot.position);
  if (tmpPropPos.lengthSq() < 0.0001) return outDir;

  tmpPropPos.normalize();
  if (tmpPropPos.dot(outDir) > 0) outDir.multiplyScalar(-1);
  return outDir;
}

function getPlaneNoseDirection(outDir) {
  outDir.set(0, 0, -1).applyQuaternion(planeRoot.quaternion).normalize();
  if (propellers.length === 0) return outDir;

  propellers[0].getWorldPosition(tmpPropPos);
  tmpPropPos.sub(planeRoot.position);
  if (tmpPropPos.lengthSq() < 0.0001) return outDir;

  outDir.copy(tmpPropPos).normalize();
  return outDir;
}

function fireMissile() {
  if (!running || !planeMesh || missileCooldown > 0) return;

  if (missiles.length >= missileConfig.maxActive) {
    const oldest = missiles.shift();
    scene.remove(oldest.mesh);
  }

  getMissileLaunchDirection(tmpForward);
  tmpRight.set(1, 0, 0).applyQuaternion(planeRoot.quaternion).normalize();
  tmpUp.set(0, 1, 0).applyQuaternion(planeRoot.quaternion).normalize();

  const missileSpawn = makeMissileMesh();
  const missileMesh = missileSpawn.mesh;
  const side = missileSide;
  missileSide *= -1;

  missileMesh.position.copy(planeRoot.position)
    .addScaledVector(tmpForward, 7.8)
    .addScaledVector(tmpRight, side * 1.5)
    .addScaledVector(tmpUp, 0.5);
  missileMesh.quaternion.setFromUnitVectors(missileSpawn.forwardAxis, tmpForward);
  scene.add(missileMesh);

  const missileVelocity = tmpForward.clone().multiplyScalar(missileConfig.speed).add(planeState.velocity.clone());
  const missileId = `${localPlayerId || "local"}-${Date.now()}-${missileSerial++}`;

  missiles.push({
    missileId,
    mesh: missileMesh,
    velocity: missileVelocity,
    life: missileConfig.lifetime
  });

  sendSocket({
    type: "fire",
    missileId,
    position: [missileMesh.position.x, missileMesh.position.y, missileMesh.position.z],
    velocity: [missileVelocity.x, missileVelocity.y, missileVelocity.z]
  });

  missileCooldown = missileConfig.cooldown;
  missileFocusTimer = missileFocusConfig.duration;
  setMissileButtonState();
}

function updateMissiles(simDt, realDt = simDt) {
  missileCooldown = Math.max(0, missileCooldown - realDt);

  for (let i = missiles.length - 1; i >= 0; i -= 1) {
    const missile = missiles[i];
    missile.mesh.position.addScaledVector(missile.velocity, simDt);
    missile.mesh.rotateZ(11 * simDt);
    missile.life -= simDt;

    if (missile.life <= 0 || missile.mesh.position.y < -30 || missile.mesh.position.lengthSq() > 17000 * 17000) {
      scene.remove(missile.mesh);
      missiles.splice(i, 1);
    }
  }

  setMissileButtonState();
}

function makeFallbackPlane() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc13b2e, roughness: 0.52, metalness: 0.2 });
  const light = new THREE.MeshStandardMaterial({ color: 0xe7e0d4, roughness: 0.84, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.35, metalness: 0.58 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 10.5, 16), red);
  fuselage.rotation.z = Math.PI / 2;
  g.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.5, 16), red);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 6.4;
  g.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 11.8), light);
  wing.position.set(0.5, 0.15, 0);
  g.add(wing);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 3.1), light);
  tailWing.position.set(-4.8, 0.8, 0);
  g.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.15), light);
  fin.position.set(-5.05, 1.35, 0);
  g.add(fin);

  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 2.8), dark);
  prop.position.set(7.4, 0, 0);
  prop.rotation.x = Math.PI / 2;
  g.add(prop);
  propellers.push(prop);

  g.rotation.y = Math.PI;
  return g;
}

function mountPlane(root) {
  if (planeMesh) planeRoot.remove(planeMesh);
  propellers.length = 0;
  planeMesh = root;

  planeMesh.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const n = obj.name.toLowerCase();
    if (n.includes("prop") || n.includes("blade") || n.includes("rotor")) {
      propellers.push(obj);
    }
  });

  const box = new THREE.Box3().setFromObject(planeMesh);
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const scale = 34 / maxSize;
  planeMesh.scale.setScalar(scale);

  const centeredBox = new THREE.Box3().setFromObject(planeMesh);
  const center = centeredBox.getCenter(new THREE.Vector3());
  planeMesh.position.sub(center);

  if (propellers.length === 0) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 3.1),
      new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.34, metalness: 0.6 })
    );
    const ext = new THREE.Box3().setFromObject(planeMesh).getSize(new THREE.Vector3());
    p.position.set(0, 0, -ext.z * 0.5);
    planeMesh.add(p);
    propellers.push(p);
  }

  planeRoot.add(planeMesh);
  for (const remote of remotePlayers.values()) {
    const currentPos = remote.root.position.clone();
    const currentQuat = remote.root.quaternion.clone();
    remote.root.clear();
    remote.root.add(createRemotePlaneVisual());
    remote.root.position.copy(currentPos);
    remote.root.quaternion.copy(currentQuat);
  }
  setStatus("Plane ready");
  resetGame();
}

function mountCity(root) {
  if (cityMesh) {
    cityGroup.remove(cityMesh);
  }

  cityMesh = root;
  const layout = landmarkLayout.city;
  if (!placeModelInWater(cityMesh, layout.span, layout.sinkDepth, layout.x, layout.z, layout.rotationY)) return;
  cityGroup.add(cityMesh);
}

function mountHokage(root) {
  if (hokageMesh) {
    hokageGroup.remove(hokageMesh);
  }

  hokageMesh = root;
  const layout = landmarkLayout.hokage;
  if (!placeModelInWater(hokageMesh, layout.span, layout.sinkDepth, layout.x, layout.z, layout.rotationY)) return;
  hokageGroup.add(hokageMesh);
}

function mountReactor(root) {
  if (reactorMesh) {
    reactorGroup.remove(reactorMesh);
  }

  reactorMesh = root;
  const layout = landmarkLayout.reactor;
  if (!placeModelInWater(reactorMesh, layout.span, layout.sinkDepth, layout.x, layout.z, layout.rotationY)) return;
  reactorGroup.add(reactorMesh);
}

function mountAnimeGirl(root, animations = []) {
  if (animeGirlMesh) {
    animeGirlGroup.remove(animeGirlMesh);
  }
  if (animeGirlMixer) {
    animeGirlMixer.stopAllAction();
    animeGirlMixer = null;
  }

  animeGirlMesh = root;
  const layout = landmarkLayout.animeGirl;
  if (!placeModelInWater(animeGirlMesh, layout.span, layout.sinkDepth, layout.x, layout.z, layout.rotationY)) return;
  animeGirlMesh.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      mat.fog = false;
      mat.needsUpdate = true;
    }
  });
  animeGirlGroup.add(animeGirlMesh);

}

function mountCampus(root) {
  if (campusMesh) {
    campusGroup.remove(campusMesh);
  }

  campusMesh = root;
  const layout = landmarkLayout.campus;
  if (!placeModelInWater(campusMesh, layout.span, layout.sinkDepth, layout.x, layout.z, layout.rotationY)) return;
  campusGroup.add(campusMesh);
}
function placeModelInWater(model, targetSpan, sinkDepth, offsetX, offsetZ, rotationY) {
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return false;

  const size = box.getSize(new THREE.Vector3());
  const maxSpan = Math.max(size.x, size.z) || 1;
  model.scale.setScalar(targetSpan / maxSpan);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const alignedBox = new THREE.Box3().setFromObject(model);
  model.position.y -= alignedBox.min.y + sinkDepth;
  model.position.x += offsetX;
  model.position.z += offsetZ;
  model.rotation.y = rotationY;

  return true;
}

function resetGame() {
  if (!planeMesh) {
    setStatus("Plane still loading...");
    return;
  }

  clearMissiles();
  clearRemoteMissiles();
  missileCooldown = 0;
  missileFocusTimer = 0;
  missileSide = 1;
  localHp = multiplayerConfig.maxHp;
  updateHealthDisplay();
  sendSocket({ type: "reset_hp" });

  running = true;
  planeState.speed = 0;
  planeState.throttle = speedControlConfig.cruiseThrottle;
  planeState.throttleVel = 0;
  planeState.yawVel = 0;
  planeState.pitchVel = 0;
  planeState.rollVel = 0;
  planeState.velocity.set(0, 0, 0);

  planeRoot.position.set(0, 120, 180);
  planeRoot.rotation.set(0, Math.PI, 0);

  const forwardNow = getPlaneNoseDirection(new THREE.Vector3());
  planeState.forward.copy(forwardNow);

  const startCam = planeRoot.position.clone()
    .add(forwardNow.clone().multiplyScalar(-10))
    .add(new THREE.Vector3(0, 4.2, 0));
  camera.position.copy(startCam);
  const startLook = planeRoot.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  camera.lookAt(startLook);
  camera.userData.smoothLook = startLook.clone();
  camera.userData.snapFrames = 10;

  // Clear sticky key states on restart.
  clearAllControlKeys();

  setStatus(`Running | ${getCameraModeLabel()}`);
  setMissileButtonState();
}

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("/draco/");
gltfLoader.setDRACOLoader(draco);

setStatus("Loading GLB model...");
gltfLoader.load(
  planeModelUrl,
  (gltf) => mountPlane(gltf.scene),
  undefined,
  () => {
    setStatus("GLB failed, using fallback plane");
    mountPlane(makeFallbackPlane());
  }
);

gltfLoader.load(
  missileModelUrl,
  (gltf) => {
    const prepared = prepareMissileTemplate(gltf.scene);
    if (!prepared) {
      console.warn("Missile model is empty, using fallback missile.");
      return;
    }
    missileTemplate = prepared.root;
    missileTemplateForwardAxis.copy(prepared.forwardAxis);
  },
  undefined,
  (err) => {
    console.warn("Missile model failed to load, using fallback missile.", err);
  }
);

gltfLoader.load(
  cityModelUrl,
  (gltf) => {
    mountCity(gltf.scene);
  },
  undefined,
  (err) => {
    console.warn("City model failed to load.", err);
  }
);

gltfLoader.load(
  hokageModelUrl,
  (gltf) => {
    mountHokage(gltf.scene);
  },
  undefined,
  (err) => {
    console.warn("Hokage mountain model failed to load.", err);
  }
);

gltfLoader.load(
  reactorModelUrl,
  (gltf) => {
    mountReactor(gltf.scene);
  },
  undefined,
  (err) => {
    console.warn("Arc reactor model failed to load.", err);
  }
);

gltfLoader.load(
  animeGirlModelUrl,
  (gltf) => {
    mountAnimeGirl(gltf.scene, gltf.animations || []);
  },
  undefined,
  (err) => {
    console.warn("Anime girl model failed to load.", err);
  }
);

gltfLoader.load(
  campusModelUrl,
  (gltf) => {
    mountCampus(gltf.scene);
  },
  undefined,
  (err) => {
    console.warn("Campus model failed to load.", err);
  }
);
function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function updateFlight(dt) {
  const w = keys.KeyS || keys.ArrowDown ? 1 : 0;
  const s = keys.KeyW || keys.ArrowUp ? 1 : 0;
  const a = keys.KeyA || keys.ArrowLeft ? 1 : 0;
  const d = keys.KeyD || keys.ArrowRight ? 1 : 0;
  const climbUp = keys.Space ? 1 : 0;
  const climbDown = keys.ShiftLeft || keys.ShiftRight ? 1 : 0;

  const throttleInput = w - s;
  planeState.throttle = THREE.MathUtils.clamp(
    planeState.throttle + throttleInput * dt * speedControlConfig.throttleRate,
    speedControlConfig.minThrottle,
    speedControlConfig.maxThrottle
  );

  if (speedControlConfig.throttleReturn > 0 && w === 0 && s === 0) {
    planeState.throttle = damp(planeState.throttle, speedControlConfig.cruiseThrottle, speedControlConfig.throttleReturn, dt);
  }

  const forwardThrottle = speedControlConfig.maxThrottle <= 0
    ? 0
    : THREE.MathUtils.clamp(planeState.throttle / speedControlConfig.maxThrottle, 0, 1);
  const reverseThrottle = speedControlConfig.minThrottle >= 0
    ? 0
    : THREE.MathUtils.clamp(planeState.throttle / speedControlConfig.minThrottle, 0, 1);

  let targetSpeed = 0;
  if (planeState.throttle >= 0) {
    targetSpeed = THREE.MathUtils.lerp(0, planeState.maxSpeed, forwardThrottle);
  } else {
    targetSpeed = THREE.MathUtils.lerp(0, planeState.minSpeed, reverseThrottle);
  }

  if (Math.abs(planeState.throttle) < 0.015 && w === 0 && s === 0) {
    targetSpeed = 0;
  }

  planeState.speed = damp(planeState.speed, targetSpeed, speedControlConfig.speedResponse, dt);
  planeState.speed *= 1 - (speedControlConfig.airDrag * dt);
  if (targetSpeed === 0 && Math.abs(planeState.speed) < 1.2) {
    planeState.speed = 0;
  }
  planeState.speed = THREE.MathUtils.clamp(planeState.speed, planeState.minSpeed, planeState.maxSpeed);

  // Only left/right yaw turn is enabled.
  const yawInput = a - d;
  const yawTarget = yawInput * 1.35;
  planeState.yawVel = damp(planeState.yawVel, yawTarget, 5.5, dt);
  planeState.pitchVel = damp(planeState.pitchVel, 0, 8, dt);
  planeState.rollVel = damp(planeState.rollVel, 0, 8, dt);
  planeRoot.rotateOnAxis(new THREE.Vector3(0, 1, 0), planeState.yawVel * dt);

  const forward = getPlaneNoseDirection(new THREE.Vector3());
  planeState.forward.copy(forward);

  const prevVerticalVelocity = planeState.velocity.y;
  planeState.velocity.copy(forward).multiplyScalar(planeState.speed);
  const climbInput = climbUp - climbDown;
  const verticalTarget = climbInput * planeState.climbForce;
  planeState.velocity.y = damp(prevVerticalVelocity, verticalTarget, 7.5, dt);

  planeRoot.position.addScaledVector(planeState.velocity, dt);

  if (planeRoot.position.y < 22) {
    planeRoot.position.y = 22;
  }

  const spin = 25 + Math.abs(planeState.speed) * 3.2;
  for (const prop of propellers) {
    prop.rotateX(spin * dt);
  }

  speedValue.textContent = `${planeState.speed.toFixed(0)} km/h`;
  altitudeValue.textContent = `${planeRoot.position.y.toFixed(0)} m`;
}

function updateCamera(dt) {
  const moveDir = planeState.forward.clone();
  const mode = cameraModes[cameraModeIndex];
  const preset = cameraPresets[mode];
  const desiredPos = planeRoot.position.clone().add(preset.offset.clone().applyQuaternion(planeRoot.quaternion));

  camera.position.lerp(desiredPos, 1 - Math.exp(-6.2 * dt));

  let lookAt;
  if (mode === "front") {
    lookAt = planeRoot.position.clone().add(new THREE.Vector3(0, 1.8, 0));
  } else {
    lookAt = planeRoot.position.clone()
      .add(moveDir.clone().multiplyScalar(preset.lookForward))
      .add(new THREE.Vector3(0, 2.0, 0));
  }

  if ((camera.userData.snapFrames || 0) > 0) {
    camera.position.copy(desiredPos);
    camera.userData.smoothLook = lookAt.clone();
    camera.lookAt(lookAt);
    camera.userData.snapFrames -= 1;
    return;
  }

  const smoothLook = camera.userData.smoothLook || lookAt.clone();
  smoothLook.lerp(lookAt, 1 - Math.exp(-8 * dt));
  camera.userData.smoothLook = smoothLook;
  camera.lookAt(smoothLook);
}

function updateClouds(dt) {
  for (const cloud of cloudGroup.children) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > 2600) {
      cloud.position.x = -2600;
      cloud.position.z = (Math.random() - 0.5) * 5200;
      cloud.position.y = 130 + Math.random() * 460;
    }
  }
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.repeat) return;

  if (e.code === "KeyC") {
    cycleCameraMode();
    return;
  }
  if (e.code === "Digit1") {
    setCameraMode(0);
    return;
  }
  if (e.code === "Digit2") {
    setCameraMode(1);
    return;
  }
  if (e.code === "Digit3") {
    setCameraMode(2);
    return;
  }
  if (e.code === "KeyF") {
    fireMissile();
    return;
  }

  // Tap-turn behavior: one press changes heading, then it flies straight.
  if (e.code === "KeyA" || e.code === "ArrowLeft") planeState.yawVel += 0.55;
  if (e.code === "KeyD" || e.code === "ArrowRight") planeState.yawVel -= 0.55;

  if (e.code === "KeyW" || e.code === "ArrowUp") {
    planeState.throttle = THREE.MathUtils.clamp(
      planeState.throttle - 0.05,
      speedControlConfig.minThrottle,
      speedControlConfig.maxThrottle
    );
  }
  if (e.code === "KeyS" || e.code === "ArrowDown") {
    planeState.throttle = THREE.MathUtils.clamp(
      planeState.throttle + 0.05,
      speedControlConfig.minThrottle,
      speedControlConfig.maxThrottle
    );
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});
window.addEventListener("blur", () => {
  clearAllControlKeys();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  dragState.active = true;
  dragState.lastX = e.clientX;
  dragState.lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", (e) => {
  dragState.active = false;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragState.active || !planeMesh) return;
  dragState.lastX = e.clientX;
  dragState.lastY = e.clientY;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

startBtn.addEventListener("click", () => {
  resetGame();
});
for (const button of holdControlButtons) {
  bindHoldControlButton(button);
}
if (boostBtn) {
  boostBtn.addEventListener("click", () => {
    applySpeedBoost();
  });
}
if (missileBtn) {
  missileBtn.addEventListener("click", () => {
    fireMissile();
  });
}
if (padBoostBtn) {
  padBoostBtn.addEventListener("click", () => {
    applySpeedBoost();
  });
}
if (padMissileBtn) {
  padMissileBtn.addEventListener("click", () => {
    fireMissile();
  });
}
if (padViewBtn) {
  padViewBtn.addEventListener("click", () => {
    cycleCameraMode();
  });
}
if (padStartBtn) {
  padStartBtn.addEventListener("click", () => {
    resetGame();
  });
}
setMissileButtonState();
updateHealthDisplay();
updatePlayersCount();
updatePlayerSignalsPanel();
connectMultiplayer();

const clock = new THREE.Clock();

function animate() {
  const rawDt = Math.min(0.033, clock.getDelta());
  let flightDt = rawDt;
  let missileDt = rawDt;

  if (missileFocusTimer > 0) {
    missileFocusTimer = Math.max(0, missileFocusTimer - rawDt);
    missileDt = rawDt * missileFocusConfig.timeScale;
    flightDt = 0;
  }

  oceanUniforms.uTime.value += flightDt;
  if (animeGirlMixer) {
    animeGirlMixer.update(rawDt);
  }
  updateMissiles(missileDt, rawDt);
  updateRemoteMissiles(rawDt);
  updateRemotePlayers(rawDt);
  signalsUiTimer += rawDt;
  if (signalsUiTimer >= 0.15) {
    signalsUiTimer = 0;
    updatePlayerSignalsPanel();
  }

  if (running && planeMesh) {
    updateFlight(flightDt);
    updateCamera(flightDt);
    updateClouds(flightDt);
    syncLocalPlayerState(rawDt);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

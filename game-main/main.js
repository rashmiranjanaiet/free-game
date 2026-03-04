import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.162.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://unpkg.com/three@0.162.0/examples/jsm/loaders/DRACOLoader.js";

const canvas = document.getElementById("game");
const speedValue = document.getElementById("speedValue");
const altitudeValue = document.getElementById("altitudeValue");
const startBtn = document.getElementById("startBtn");
const hud = document.getElementById("hud");

const statusLine = document.createElement("div");
statusLine.className = "help";
statusLine.id = "statusLine";
statusLine.textContent = "Loading plane model...";
hud.appendChild(statusLine);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec7ff);
scene.fog = new THREE.Fog(0x8ec7ff, 300, 4000);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 8, 28);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const hemiLight = new THREE.HemisphereLight(0xe6f3ff, 0x5aa0d8, 0.95);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(300, 420, 180);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(12000, 12000, 8, 8),
  new THREE.MeshStandardMaterial({
    color: 0x2f74bf,
    roughness: 0.38,
    metalness: 0.08,
    transparent: true,
    opacity: 0.96
  })
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = 0;
scene.add(ocean);

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);

function makeCloud() {
  const g = new THREE.Group();
  const puffGeo = new THREE.SphereGeometry(1, 12, 10);
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const puffCount = 3 + Math.floor(Math.random() * 5);

  for (let i = 0; i < puffCount; i += 1) {
    const puff = new THREE.Mesh(puffGeo, puffMat);
    puff.position.set((Math.random() - 0.5) * 9, Math.random() * 2.4, (Math.random() - 0.5) * 7);
    puff.scale.setScalar(1.1 + Math.random() * 2.0);
    g.add(puff);
  }

  g.position.set((Math.random() - 0.5) * 3500, 120 + Math.random() * 380, (Math.random() - 0.5) * 3500);
  g.userData.drift = 2 + Math.random() * 6;
  g.userData.spin = (Math.random() - 0.5) * 0.03;
  return g;
}

for (let i = 0; i < 85; i += 1) {
  cloudGroup.add(makeCloud());
}

const checkpointGroup = new THREE.Group();
scene.add(checkpointGroup);
const checkpointRings = [];
let nextRingIndex = 0;

function createCheckpoints() {
  checkpointGroup.clear();
  checkpointRings.length = 0;
  let anchor = new THREE.Vector3(0, 80, -220);

  for (let i = 0; i < 12; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(14, 1.5, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0xffcc52, emissive: 0x2f1900, metalness: 0.2, roughness: 0.55 })
    );
    anchor = anchor.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 220,
        (Math.random() - 0.5) * 34,
        -220 - Math.random() * 190
      )
    );
    anchor.y = THREE.MathUtils.clamp(anchor.y, 38, 320);
    ring.position.copy(anchor);
    ring.rotation.x = (Math.random() - 0.5) * 0.3;
    ring.rotation.y = Math.random() * Math.PI;
    ring.userData.passed = false;
    checkpointGroup.add(ring);
    checkpointRings.push(ring);
  }

  nextRingIndex = 0;
}

createCheckpoints();

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://unpkg.com/three@0.162.0/examples/jsm/libs/draco/");
loader.setDRACOLoader(dracoLoader);

const planeRoot = new THREE.Group();
scene.add(planeRoot);

const planeState = {
  speed: 0,
  throttle: 0.45,
  minSpeed: 18,
  maxSpeed: 220,
  accel: 35,
  turnRate: 1.45,
  pitchRate: 1.25,
  climbRate: 28,
  forward: new THREE.Vector3(0, 0, -1),
  velocity: new THREE.Vector3(0, 0, 0)
};

let planeMesh = null;
const propellers = [];
let running = false;
const keys = {};

function resetGame() {
  running = true;
  planeState.speed = 58;
  planeState.throttle = 0.45;
  planeRoot.position.set(0, 75, 140);
  planeRoot.rotation.set(0, Math.PI, 0);
  planeRoot.quaternion.normalize();

  checkpointRings.forEach((ring, i) => {
    ring.userData.passed = false;
    ring.material.color.setHex(i === 0 ? 0x4cff9b : 0xffcc52);
    ring.material.emissive.setHex(i === 0 ? 0x003c1f : 0x2f1900);
    ring.visible = true;
  });

  nextRingIndex = 0;
}

function updateTargetRingHighlight() {
  checkpointRings.forEach((ring, idx) => {
    if (ring.userData.passed) {
      ring.material.color.setHex(0x2f7d46);
      ring.material.emissive.setHex(0x07210f);
      return;
    }

    if (idx === nextRingIndex) {
      ring.material.color.setHex(0x4cff9b);
      ring.material.emissive.setHex(0x003c1f);
    } else {
      ring.material.color.setHex(0xffcc52);
      ring.material.emissive.setHex(0x2f1900);
    }
  });
}

function createFallbackPlane() {
  const bodyGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc33d2f, roughness: 0.5, metalness: 0.2 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d8, roughness: 0.7, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.4, metalness: 0.45 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 7.8, 14), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  bodyGroup.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.8, 14), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 4.6;
  bodyGroup.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 7.8), wingMat);
  wing.position.set(0.3, 0.1, 0);
  bodyGroup.add(wing);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 2.4), wingMat);
  tailWing.position.set(-3.3, 0.58, 0);
  bodyGroup.add(tailWing);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.12), wingMat);
  tailFin.position.set(-3.5, 1.0, 0);
  bodyGroup.add(tailFin);

  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 2.1), darkMat);
  prop.position.set(5.35, 0, 0);
  prop.rotation.x = Math.PI / 2;
  bodyGroup.add(prop);
  propellers.push(prop);

  bodyGroup.rotation.y = Math.PI;
  return bodyGroup;
}

function initPlane(gltf) {
  if (planeMesh) {
    planeRoot.remove(planeMesh);
  }
  propellers.length = 0;

  planeMesh = gltf.scene;
  planeMesh.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const n = obj.name.toLowerCase();
      if (n.includes("prop") || n.includes("blade") || n.includes("rotor")) {
        propellers.push(obj);
      }
    }
  });

  const box = new THREE.Box3().setFromObject(planeMesh);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  const scale = 20 / maxDimension;
  planeMesh.scale.setScalar(scale);

  const centered = new THREE.Box3().setFromObject(planeMesh);
  const center = centered.getCenter(new THREE.Vector3());
  planeMesh.position.sub(center);

  if (propellers.length === 0) {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.02, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x202020, metalness: 0.55, roughness: 0.35 })
    );
    const ext = new THREE.Box3().setFromObject(planeMesh).getSize(new THREE.Vector3());
    fallback.position.set(0, 0, -ext.z * 0.5);
    planeMesh.add(fallback);
    propellers.push(fallback);
  }

  planeRoot.add(planeMesh);
  statusLine.textContent = "Plane loaded";
  resetGame();
}

loader.load(
  "./assets/plane.glb",
  (gltf) => initPlane(gltf),
  undefined,
  (err) => {
    console.error("Failed to load model", err);
    statusLine.textContent = "Model load failed, using fallback plane";
    initPlane({ scene: createFallbackPlane() });
  }
);

function handleInput(dt) {
  const accelerate = keys.KeyW ? 1 : 0;
  const decelerate = keys.KeyS ? 1 : 0;
  const yawLeft = keys.KeyA ? 1 : 0;
  const yawRight = keys.KeyD ? 1 : 0;
  const climb = keys.Space ? 1 : 0;
  const descend = keys.ShiftLeft || keys.ShiftRight ? 1 : 0;

  const throttleDelta = (accelerate - decelerate) * dt * 0.55;
  planeState.throttle = THREE.MathUtils.clamp(planeState.throttle + throttleDelta, 0.08, 1);

  const targetSpeed = THREE.MathUtils.lerp(planeState.minSpeed, planeState.maxSpeed, planeState.throttle);
  const speedError = targetSpeed - planeState.speed;
  planeState.speed += speedError * Math.min(1, planeState.accel * dt * 0.025);

  const yawInput = yawLeft - yawRight;
  const pitchInput = climb - descend;

  const turnStrength = THREE.MathUtils.mapLinear(planeState.speed, planeState.minSpeed, planeState.maxSpeed, 0.6, 1);
  const yawAmount = yawInput * planeState.turnRate * turnStrength * dt;
  const pitchAmount = pitchInput * planeState.pitchRate * turnStrength * dt;

  planeRoot.rotateY(yawAmount);
  planeRoot.rotateX(pitchAmount);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(planeRoot.quaternion).normalize();
  planeState.forward.copy(forward);

  planeState.velocity.copy(forward).multiplyScalar(planeState.speed);
  planeState.velocity.y += (climb - descend) * planeState.climbRate;

  planeRoot.position.addScaledVector(planeState.velocity, dt);

  if (planeRoot.position.y < 8) {
    planeRoot.position.y = 8;
  }

  const rollTarget = -yawInput * 0.45;
  planeRoot.rotation.z = THREE.MathUtils.lerp(planeRoot.rotation.z, rollTarget, 0.08);
}

function updateCamera(dt) {
  const backOffset = new THREE.Vector3(0, 8, 28).applyQuaternion(planeRoot.quaternion);
  const camTargetPos = planeRoot.position.clone().add(backOffset);
  camera.position.lerp(camTargetPos, 1 - Math.exp(-4.4 * dt));

  const lookAtTarget = planeRoot.position.clone().add(planeState.forward.clone().multiplyScalar(55));
  const smoothedLookAt = camera.userData.lookAt || lookAtTarget.clone();
  smoothedLookAt.lerp(lookAtTarget, 1 - Math.exp(-5.5 * dt));
  camera.userData.lookAt = smoothedLookAt;
  camera.lookAt(smoothedLookAt);
}

function updatePropellers(dt) {
  const spin = 38 + planeState.speed * 1.9;
  propellers.forEach((prop) => {
    prop.rotation.z += spin * dt;
  });
}

function updateClouds(dt) {
  cloudGroup.children.forEach((cloud) => {
    cloud.position.x += cloud.userData.drift * dt;
    cloud.rotation.y += cloud.userData.spin * dt;

    if (cloud.position.x > 2200) {
      cloud.position.x = -2200;
      cloud.position.z = (Math.random() - 0.5) * 3500;
      cloud.position.y = 120 + Math.random() * 380;
    }
  });
}

function updateCheckpoints() {
  const ring = checkpointRings[nextRingIndex];
  if (!ring) {
    return;
  }

  const dist = ring.position.distanceTo(planeRoot.position);
  if (dist < 16) {
    ring.userData.passed = true;
    ring.visible = false;
    nextRingIndex += 1;

    if (nextRingIndex >= checkpointRings.length) {
      createCheckpoints();
    }

    updateTargetRingHighlight();
  }
}

function updateHud() {
  speedValue.textContent = `${planeState.speed.toFixed(0)} km/h`;
  altitudeValue.textContent = `${Math.max(0, planeRoot.position.y).toFixed(0)} m`;
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

startBtn.addEventListener("click", () => {
  resetGame();
});

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (running) {
    handleInput(dt);
    updatePropellers(dt);
    updateCamera(dt);
    updateClouds(dt);
    updateCheckpoints();
    updateHud();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

updateTargetRingHighlight();
animate();

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { App } from "locar";

const btn = document.getElementById("start");
const statusEl = document.getElementById("status");
const coordsEl = document.getElementById("coords");
const accuracyEl = document.getElementById("accuracy");
const distanceEl = document.getElementById("distance");
const canvas = document.getElementById("ar-canvas");

const TARGET = {
  lat: -2.299114,
  lon: -78.118125,
  name: "LABORATORIO DE REDES"
};

function setStatus(msg) {
  statusEl.textContent = msg;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const p1 = toRad(lat1), p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a = Math.sin(dp/2)**2 +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function prepareModel(model) {
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.frustumCulled = false;

      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        });
      }
    }
  });

  // Normalizar tamaño.
  let box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);

  // AUMENTADO: antes 10/14. Ahora se usa un tamaño virtual de 22 m
  // para que el router sea claramente visible a decenas de metros.
  const desiredSize = 20;

  if (maxDim > 0) {
    const s = desiredSize / maxDim;
    model.scale.setScalar(s);
  }

  // Recalcular caja después de escalar.
  box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Centrar horizontalmente.
  model.position.x -= center.x;
  model.position.z -= center.z;

  // Apoyar el modelo sobre su base y elevarlo ligeramente.
  model.position.y -= box.min.y;
  model.position.y += 1.5;

  // Orientación ajustada para este router.glb.
  model.rotation.y = THREE.MathUtils.degToRad(90);

  return model;
}

function createInfoLabel() {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1200;
  labelCanvas.height = 700;

  const ctx = labelCanvas.getContext("2d");

  // Fondo con esquinas visualmente limpias.
  ctx.fillStyle = "rgba(5, 15, 25, 0.88)";
  ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

  // Borde cian.
  ctx.strokeStyle = "#00E5FF";
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, labelCanvas.width - 16, labelCanvas.height - 16);

  ctx.textAlign = "center";

  // Título.
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 82px Arial";
  ctx.fillText("ROUTER DE RED", labelCanvas.width / 2, 125);

  // IP.
  ctx.font = "56px Arial";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("IP: 192.168.1.1", labelCanvas.width / 2, 265);

  // Estado.
  ctx.font = "bold 58px Arial";
  ctx.fillStyle = "#00FF66";
  ctx.fillText("Estado: ACTIVO", labelCanvas.width / 2, 390);

  // Puertos.
  ctx.font = "56px Arial";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("24 puertos", labelCanvas.width / 2, 515);

  // Línea de apoyo didáctica.
  ctx.font = "38px Arial";
  ctx.fillStyle = "#B8D9E8";
  ctx.fillText("Infraestructura de red", labelCanvas.width / 2, 615);

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);

  // Etiqueta grande para ser legible a distancia.
  sprite.scale.set(24, 14, 1);

  // La colocamos claramente por encima del router.
  sprite.position.set(0, 32, 0);

  // Siempre delante en caso de superposición.
  sprite.renderOrder = 999;

  return sprite;
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "INICIANDO...";
  setStatus("Solicitando cámara y sensores...");

  try {
    const app = new App({
      canvas,
      cameraOptions: {
        hFov: 80,
        near: 0.001,
        far: 2500
      },
      videoConstraints: {
        video: { facingMode: "environment" }
      }
    });

    const locar = await app.start();

    // Fondo transparente para ver el vídeo de la cámara.
    app.renderer.setClearColor(0x000000, 0);

    // Iluminación para materiales glTF.
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5);
    app.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 3.0);
    dir.position.set(10, 20, 10);
    app.scene.add(dir);

    locar.setGpsOptions({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30000
    });

    let modelAdded = false;
    let routerGroup = null;

    setStatus("Cargando router.glb...");
    const loader = new GLTFLoader();

    try {
      const gltf = await loader.loadAsync("/models/router.glb");

      const router = prepareModel(gltf.scene);
      const infoLabel = createInfoLabel();

      routerGroup = new THREE.Group();
      routerGroup.add(router);
      routerGroup.add(infoLabel);

      setStatus("Router e información cargados. Esperando GPS...");
    } catch (modelError) {
      console.error(modelError);
      setStatus("ERROR al cargar /models/router.glb");
      btn.disabled = false;
      btn.textContent = "REINTENTAR";
      return;
    }

    locar.on("gpserror", (err) => {
      const code = err?.code ?? "";
      const msg = err?.message ?? "Error desconocido";
      setStatus(`Error GPS ${code}: ${msg}`);
      btn.disabled = false;
      btn.textContent = "REINTENTAR";
    });

    locar.on("gpsupdate", (ev) => {
      const c = ev.position.coords;

      coordsEl.textContent =
        `GPS: ${c.latitude.toFixed(7)}, ${c.longitude.toFixed(7)}`;

      accuracyEl.textContent =
        `Precisión: ${Math.round(c.accuracy)} m`;

      const dist = haversineMeters(
        c.latitude,
        c.longitude,
        TARGET.lat,
        TARGET.lon
      );

      distanceEl.textContent =
        `Distancia al router: ${Math.round(dist)} m`;

      if (!modelAdded && routerGroup) {
        locar.add(
          routerGroup,
          TARGET.lon,
          TARGET.lat,
          2
        );

        modelAdded = true;

        setStatus(
          "Router agregado. Gira lentamente hacia la ubicación objetivo."
        );

        btn.style.display = "none";
      }
    });

    setStatus("Cámara iniciada. Solicitando ubicación GPS...");
    await locar.startGps();

  } catch (e) {
    console.error(e);
    setStatus(`No se pudo iniciar AR: ${e?.message || e}`);
    btn.disabled = false;
    btn.textContent = "REINTENTAR";
  }
});

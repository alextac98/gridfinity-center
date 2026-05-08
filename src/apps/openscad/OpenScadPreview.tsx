"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Home, LoaderCircle, TriangleAlert } from "lucide-react";
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import styles from "./openscad-preview.module.css";

type OpenScadPreviewProps = {
  stl?: Uint8Array;
  errorMessage?: string;
  isLoading?: boolean;
  loadingMessage?: string;
};

type OrientationView =
  | "home"
  | "top"
  | "bottom"
  | "front"
  | "back"
  | "right"
  | "left";

type PreviewTheme = {
  background: string;
  model: string;
  modelDetail: string;
  modelDark: string;
  keyLight: string;
  fillLight: string;
  orientationTop: string;
  orientationSide: string;
  orientationSideAlt: string;
  orientationBottom: string;
  orientationText: string;
  orientationStroke: string;
};

const orientationDirections: Record<OrientationView, Vector3> = {
  home: new Vector3(-1.1, -1.25, 0.85).normalize(),
  top: new Vector3(0, 0, 1),
  bottom: new Vector3(0, 0, -1),
  front: new Vector3(0, -1, 0),
  back: new Vector3(0, 1, 0),
  right: new Vector3(1, 0, 0),
  left: new Vector3(-1, 0, 0),
};

function getPreviewTheme(element: HTMLElement): PreviewTheme {
  const style = window.getComputedStyle(element);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    background: read("--viewer-bg", "#eef4f0"),
    model: read("--viewer-model", "#5db29c"),
    modelDetail: read("--viewer-model-detail", "#2f6f61"),
    modelDark: read("--viewer-model-dark", "#17332e"),
    keyLight: read("--viewer-key-light", "#ffffff"),
    fillLight: read("--viewer-fill-light", "#b8d8ce"),
    orientationTop: read("--viewer-cube-top", "#fafcfb"),
    orientationSide: read("--viewer-cube-side", "#e2e9e7"),
    orientationSideAlt: read("--viewer-cube-side-alt", "#d6dfdc"),
    orientationBottom: read("--viewer-cube-bottom", "#ccd7d4"),
    orientationText: read("--viewer-cube-text", "#4f5f5b"),
    orientationStroke: read("--viewer-cube-stroke", "rgba(42, 63, 59, 0.45)"),
  };
}

function createLabelTexture(text: string, background: string, theme: PreviewTheme) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (!context) {
    return new CanvasTexture(canvas);
  }

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = theme.orientationStroke;
  context.lineWidth = 12;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.fillStyle = theme.orientationText;
  context.font = "bold 92px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createOrientationScene(theme: PreviewTheme) {
  const scene = new Scene();
  const cube = new Mesh(
    new BoxGeometry(1.45, 1.45, 1.45),
    [
      new MeshBasicMaterial({ map: createLabelTexture("RIGHT", theme.orientationSideAlt, theme) }),
      new MeshBasicMaterial({ map: createLabelTexture("LEFT", theme.orientationSideAlt, theme) }),
      new MeshBasicMaterial({ map: createLabelTexture("BACK", theme.orientationSide, theme) }),
      new MeshBasicMaterial({ map: createLabelTexture("FRONT", theme.orientationSide, theme) }),
      new MeshBasicMaterial({ map: createLabelTexture("TOP", theme.orientationTop, theme) }),
      new MeshBasicMaterial({ map: createLabelTexture("BOTTOM", theme.orientationBottom, theme) }),
    ],
  );
  scene.add(cube);

  return { scene, cube };
}

function getCubeFaceView(normal: Vector3): OrientationView {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);

  if (absX >= absY && absX >= absZ) {
    return normal.x > 0 ? "right" : "left";
  }

  if (absY >= absX && absY >= absZ) {
    return normal.y > 0 ? "back" : "front";
  }

  return normal.z > 0 ? "top" : "bottom";
}

function createStlMesh(bytes: Uint8Array, theme: PreviewTheme) {
  const loader = new STLLoader();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const geometry = loader.parse(copy.buffer);
  geometry.computeVertexNormals();
  geometry.center();

  const material = new MeshStandardMaterial({
    color: theme.model,
    roughness: 0.56,
    metalness: 0.05,
  });
  material.userData.viewerRole = "model";

  const mesh = new Mesh(
    geometry,
    material,
  );

  return mesh;
}

export function OpenScadPreview({
  stl,
  errorMessage,
  isLoading = false,
  loadingMessage,
}: OpenScadPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const orientationHostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const modelRef = useRef<Mesh<BufferGeometry> | null>(null);
  const modelCenterRef = useRef(new Vector3(0, 0, 16));
  const modelRadiusRef = useRef(96);
  const hasSetInitialViewRef = useRef(false);
  const themeRef = useRef<PreviewTheme | null>(null);
  const [viewerError, setViewerError] = useState<{
    stl: Uint8Array;
    message: string;
  } | null>(null);

  const snapToView = useCallback((view: OrientationView) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) {
      return;
    }

    const center = modelCenterRef.current;
    const distance = Math.max(modelRadiusRef.current * 2.45, 92);
    const direction = orientationDirections[view];
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.up.set(0, 0, 1);

    if (view === "top" || view === "bottom") {
      camera.up.set(0, 1, 0);
    }

    controls.target.copy(center);
    controls.update();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const orientationHost = orientationHostRef.current;

    if (!host || !orientationHost) {
      return;
    }

    const theme = getPreviewTheme(host);
    themeRef.current = theme;
    const scene = new Scene();
    scene.background = new Color(theme.background);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(42, 1, 0.1, 3000);
    camera.position.set(-118, -116, 92);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.append(renderer.domElement);

    const orientationCamera = new OrthographicCamera(-1.85, 1.85, 1.85, -1.85, 0.1, 20);
    const orientationRenderer = new WebGLRenderer({ alpha: true, antialias: true });
    orientationRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    orientationHost.append(orientationRenderer.domElement);
    const orientationScene = createOrientationScene(theme);
    const raycaster = new Raycaster();
    const pointer = new Vector2();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 14);
    controlsRef.current = controls;

    scene.add(new AmbientLight(0xffffff, 0.7));
    const keyLight = new DirectionalLight(theme.keyLight, 1.7);
    keyLight.position.set(90, 110, 140);
    scene.add(keyLight);
    const fillLight = new DirectionalLight(theme.fillLight, 0.8);
    fillLight.position.set(-130, -70, 80);
    scene.add(fillLight);

    const applyCurrentTheme = () => {
      const nextTheme = getPreviewTheme(host);
      themeRef.current = nextTheme;
      scene.background = new Color(nextTheme.background);
      keyLight.color.set(nextTheme.keyLight);
      fillLight.color.set(nextTheme.fillLight);

      if (modelRef.current) {
        modelRef.current.traverse((object) => {
          if (!(object instanceof Mesh)) {
            return;
          }

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          for (const material of materials) {
            if (!(material instanceof MeshStandardMaterial)) {
              continue;
            }

            if (material.userData.viewerRole === "detail") {
              material.color.set(nextTheme.modelDetail);
            } else if (material.userData.viewerRole === "dark") {
              material.color.set(nextTheme.modelDark);
            } else {
              material.color.set(nextTheme.model);
            }
          }
        });
      }

      const cubeMaterials = Array.isArray(orientationScene.cube.material)
        ? orientationScene.cube.material
        : [orientationScene.cube.material];
      const faceThemes = [
        ["RIGHT", nextTheme.orientationSideAlt],
        ["LEFT", nextTheme.orientationSideAlt],
        ["BACK", nextTheme.orientationSide],
        ["FRONT", nextTheme.orientationSide],
        ["TOP", nextTheme.orientationTop],
        ["BOTTOM", nextTheme.orientationBottom],
      ] as const;

      cubeMaterials.forEach((material, index) => {
        if (!(material instanceof MeshBasicMaterial)) {
          return;
        }

        material.map?.dispose();
        const [label, color] = faceThemes[index];
        material.map = createLabelTexture(label, color, nextTheme);
        material.needsUpdate = true;
      });
    };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      orientationRenderer.setSize(
        orientationHost.clientWidth,
        orientationHost.clientHeight,
        false,
      );
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    observer.observe(orientationHost);
    resize();
    const themeObserver = new MutationObserver(applyCurrentTheme);
    const themeRoot = host.closest("[class*='page']") ?? document.body;
    themeObserver.observe(themeRoot, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const syncOrientation = () => {
      const direction = camera.position.clone().sub(controls.target).normalize();
      orientationCamera.position.copy(direction.multiplyScalar(6));
      orientationCamera.up.copy(camera.up);
      orientationCamera.lookAt(0, 0, 0);
    };

    const handleOrientationPointerDown = (event: PointerEvent) => {
      const rect = orientationRenderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, orientationCamera);
      const [hit] = raycaster.intersectObject(orientationScene.cube, false);

      if (hit?.face) {
        snapToView(getCubeFaceView(hit.face.normal));
      }
    };

    orientationRenderer.domElement.addEventListener("pointerdown", handleOrientationPointerDown);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      syncOrientation();
      orientationRenderer.render(orientationScene.scene, orientationCamera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      orientationRenderer.dispose();
      renderer.domElement.remove();
      orientationRenderer.domElement.removeEventListener("pointerdown", handleOrientationPointerDown);
      orientationRenderer.domElement.remove();
      scene.clear();
      orientationScene.scene.clear();
      cameraRef.current = null;
      controlsRef.current = null;
      sceneRef.current = null;
    };
  }, [snapToView]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    if (modelRef.current) {
      scene.remove(modelRef.current);
    }

    if (!stl) {
      modelRef.current = null;
      return;
    }

    const host = hostRef.current;
    const theme = themeRef.current ?? (host ? getPreviewTheme(host) : null);

    if (!theme) {
      return;
    }

    let model: Mesh<BufferGeometry>;

    try {
      model = createStlMesh(stl, theme);
    } catch (error) {
      console.error("STL preview failed to load.", error);
      const failedStl = stl;
      queueMicrotask(() =>
        setViewerError({
          stl: failedStl,
          message: "The STL was generated, but the 3D preview could not load it.",
        }),
      );
      return;
    }

    const bounds = new Box3().setFromObject(model);
    const size = new Vector3();
    bounds.getCenter(modelCenterRef.current);
    bounds.getSize(size);
    modelRadiusRef.current = Math.max(size.x, size.y, size.z, 42);
    controlsRef.current?.target.copy(modelCenterRef.current);
    controlsRef.current?.update();
    modelRef.current = model;
    scene.add(model);

    if (!hasSetInitialViewRef.current) {
      snapToView("home");
      hasSetInitialViewRef.current = true;
    }

    return () => {
      scene.remove(model);
    };
  }, [snapToView, stl]);

  const viewerErrorMessage = viewerError && viewerError.stl === stl ? viewerError.message : "";
  const visibleError = errorMessage || viewerErrorMessage;
  const showOverlay = Boolean(visibleError) || isLoading || !stl;

  return (
    <div className={styles.previewHost}>
      <div ref={hostRef} className={styles.canvasHost} />
      {showOverlay ? (
        <div className={styles.previewOverlay} role={visibleError ? "alert" : "status"}>
          <div className={styles.previewDialog}>
            {visibleError || isLoading ? (
              <div className={visibleError ? styles.errorIcon : styles.loadingIcon} aria-hidden="true">
                {visibleError ? <TriangleAlert size={22} /> : <LoaderCircle size={22} />}
              </div>
            ) : null}
            <strong>
              {visibleError
                ? "OpenSCAD could not generate a preview"
                : isLoading
                  ? "Generating OpenSCAD preview"
                  : "No preview generated"}
            </strong>
            <span>
              {visibleError
                ? "Adjust the model settings or reset the bin. Technical details were written to the browser console."
                : isLoading
                  ? loadingMessage ?? "The exact STL model will appear when rendering finishes."
                  : loadingMessage ?? "Click Generate to create an exact STL preview."}
            </span>
          </div>
        </div>
      ) : null}
      <div
        className={`${styles.orientationWidget} ${
          showOverlay ? styles.orientationWidgetHidden : ""
        }`}
        aria-label="View orientation controls"
      >
        <button
          aria-label="Home view"
          className={styles.homeIconButton}
          onClick={() => snapToView("home")}
          type="button"
          title="Home view"
        >
          <Home aria-hidden="true" size={18} />
        </button>
        <div ref={orientationHostRef} className={styles.orientationCanvas} />
      </div>
    </div>
  );
}

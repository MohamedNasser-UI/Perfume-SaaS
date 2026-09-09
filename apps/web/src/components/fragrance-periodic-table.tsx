import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import TWEEN from "three/addons/libs/tween.module.js";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { familyColors, familyRgba, FRAGRANCE_FAMILIES, type FragranceFamily } from "@/lib/fragrance-families";
import { FRAGRANCE_NOTES, type FragranceNote } from "@/lib/fragrance-notes";
import { tablePosition } from "@/lib/fragrance-pt-slots";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import "./fragrance-periodic-table.css";

type LayoutName = "table" | "sphere" | "helix" | "grid";

type Engine = {
  transform: (layout: LayoutName) => void;
  setFocusFamily: (family: FragranceFamily | null) => void;
  dispose: () => void;
};

function cameraDistance(width: number) {
  if (width < 640) return 5200;
  if (width < 1100) return 3800;
  return 3000;
}

function paintCard(el: HTMLDivElement, note: FragranceNote, hot: boolean) {
  const fill = familyRgba(note.family, hot ? 0.55 : 0.32);
  const border = familyRgba(note.family, hot ? 0.9 : 0.45);
  const glow = familyRgba(note.family, hot ? 0.85 : 0.55);
  el.style.setProperty("--pt-fill", fill);
  el.style.setProperty("--pt-border", border);
  el.style.setProperty("--pt-border-hot", familyRgba(note.family, 0.95));
  el.style.setProperty("--pt-glow", glow);
  el.style.setProperty("--pt-glow-hot", familyRgba(note.family, 0.95));
}

function createCard(note: FragranceNote): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "fragrance-element";
  element.dataset.noteId = note.id;
  element.dataset.family = note.family;
  paintCard(element, note, false);

  const inner = document.createElement("div");
  inner.className = "fragrance-element-inner";

  const number = document.createElement("div");
  number.className = "number";
  number.textContent = note.code;

  const symbol = document.createElement("div");
  symbol.className = "symbol";
  symbol.textContent = note.symbol;

  const details = document.createElement("div");
  details.className = "details";
  details.innerHTML = `${note.name}<br>${note.family}`;

  inner.append(number, symbol, details);
  element.append(inner);
  return element;
}

function buildEngine(
  container: HTMLElement,
  hooks: {
    onHover: (note: FragranceNote | null, clientX: number, clientY: number) => void;
    onSelect: (note: FragranceNote) => void;
  },
): Engine {
  const objects: CSS3DObject[] = [];
  const targets = {
    table: [] as THREE.Object3D[],
    sphere: [] as THREE.Object3D[],
    helix: [] as THREE.Object3D[],
    grid: [] as THREE.Object3D[],
  };
  const cards = new Map<string, HTMLDivElement>();

  const camera = new THREE.PerspectiveCamera(40, Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1), 1, 10000);
  camera.position.z = cameraDistance(container.clientWidth);

  const scene = new THREE.Scene();

  for (const note of FRAGRANCE_NOTES) {
    const element = createCard(note);
    cards.set(note.id, element);

    let downX = 0;
    let downY = 0;
    element.addEventListener("pointerdown", (event) => {
      downX = event.clientX;
      downY = event.clientY;
    });
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
      hooks.onSelect(note);
    });
    element.addEventListener("pointerenter", (event) => {
      element.classList.add("is-hot");
      paintCard(element, note, true);
      hooks.onHover(note, event.clientX, event.clientY);
    });
    element.addEventListener("pointermove", (event) => {
      if (!element.classList.contains("is-hot")) return;
      hooks.onHover(note, event.clientX, event.clientY);
    });
    element.addEventListener("pointerleave", () => {
      element.classList.remove("is-hot");
      paintCard(element, note, false);
      hooks.onHover(null, 0, 0);
    });

    const objectCSS = new CSS3DObject(element);
    objectCSS.position.x = Math.random() * 4000 - 2000;
    objectCSS.position.y = Math.random() * 4000 - 2000;
    objectCSS.position.z = Math.random() * 4000 - 2000;
    scene.add(objectCSS);
    objects.push(objectCSS);

    const tableObject = new THREE.Object3D();
    const pos = tablePosition(note.column, note.row);
    tableObject.position.x = pos.x;
    tableObject.position.y = pos.y;
    targets.table.push(tableObject);
  }

  const vector = new THREE.Vector3();
  for (let i = 0, l = objects.length; i < l; i++) {
    const phi = Math.acos(-1 + (2 * i) / l);
    const theta = Math.sqrt(l * Math.PI) * phi;
    const object = new THREE.Object3D();
    object.position.setFromSphericalCoords(800, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }

  for (let i = 0, l = objects.length; i < l; i++) {
    const theta = i * 0.175 + Math.PI;
    const y = -(i * 8) + 450;
    const object = new THREE.Object3D();
    object.position.setFromCylindricalCoords(900, theta, y);
    vector.x = object.position.x * 2;
    vector.y = object.position.y;
    vector.z = object.position.z * 2;
    object.lookAt(vector);
    targets.helix.push(object);
  }

  for (let i = 0; i < objects.length; i++) {
    const object = new THREE.Object3D();
    object.position.x = (i % 5) * 400 - 800;
    object.position.y = -(Math.floor(i / 5) % 5) * 400 + 800;
    object.position.z = Math.floor(i / 25) * 1000 - 2000;
    targets.grid.push(object);
  }

  const renderer = new CSS3DRenderer();
  renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
  container.appendChild(renderer.domElement);

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.rotateSpeed = 0.6;
  controls.keys = ["", "", ""];

  const render = () => {
    renderer.render(scene, camera);
  };
  controls.addEventListener("change", render);

  let frame = 0;
  let running = true;
  const animate = () => {
    if (!running) return;
    frame = requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
  };

  const transform = (layout: LayoutName) => {
    const duration = 2000;
    TWEEN.removeAll();
    const group = targets[layout];
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i]!;
      const target = group[i]!;
      new TWEEN.Tween(object.position)
        .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();
      new TWEEN.Tween(object.rotation)
        .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();
    }
    new TWEEN.Tween({})
      .to({}, duration * 2)
      .onUpdate(render)
      .start();
  };

  const onResize = () => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.position.z = cameraDistance(width);
    renderer.setSize(width, height);
    controls.handleResize();
    render();
  };

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);
  window.addEventListener("resize", onResize);
  transform("table");
  animate();
  render();

  return {
    transform,
    setFocusFamily(family) {
      for (const note of FRAGRANCE_NOTES) {
        const el = cards.get(note.id);
        if (!el) continue;
        el.classList.toggle("is-dimmed", Boolean(family) && note.family !== family);
      }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      TWEEN.removeAll();
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      controls.removeEventListener("change", render);
      controls.dispose();
      scene.clear();
      renderer.domElement.remove();
    },
  };
}

export function FragrancePeriodicTable() {
  const { t, dir } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const hoverRef = useRef<(note: FragranceNote | null, x: number, y: number) => void>(() => {});
  const selectRef = useRef<(note: FragranceNote) => void>(() => {});

  const [layout, setLayout] = useState<LayoutName>("table");
  const [focusFamily, setFocusFamily] = useState<FragranceFamily | null>(null);
  const [selected, setSelected] = useState<FragranceNote | null>(null);
  const [tooltip, setTooltip] = useState<{ note: FragranceNote; x: number; y: number } | null>(null);

  hoverRef.current = (note, x, y) => {
    setTooltip(note ? { note, x, y } : null);
  };
  selectRef.current = (note) => {
    setSelected(note);
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const engine = buildEngine(stage, {
      onHover: (note, x, y) => hoverRef.current(note, x, y),
      onSelect: (note) => selectRef.current(note),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const chooseLayout = useCallback((next: LayoutName) => {
    setLayout(next);
    engineRef.current?.transform(next);
  }, []);

  const toggleFamily = useCallback((family: FragranceFamily) => {
    setFocusFamily((current) => {
      const next = current === family ? null : family;
      engineRef.current?.setFocusFamily(next);
      return next;
    });
  }, []);

  const side = dir === "rtl" ? "rtl" : "ltr";

  return (
    <div className="fragrance-pt-stage" aria-hidden={false}>
      <div ref={stageRef} className="fragrance-pt-canvas" />
      <div className="fragrance-pt-hud">
        <div className={`fragrance-pt-legend is-${side}`}>
          {FRAGRANCE_FAMILIES.map((family) => (
            <button
              key={family}
              type="button"
              className={focusFamily === family ? "is-active" : undefined}
              onClick={() => toggleFamily(family)}
            >
              <span className="fragrance-pt-swatch" style={{ background: familyColors[family], color: familyColors[family] }} />
              {t(`pt.family.${family}` as MessageKey)}
            </button>
          ))}
        </div>
        <div className="fragrance-pt-menu">
          {(["table", "sphere", "helix", "grid"] as const).map((name) => (
            <button
              key={name}
              type="button"
              className={layout === name ? "is-active" : undefined}
              onClick={() => chooseLayout(name)}
            >
              {t(`pt.${name}` as MessageKey)}
            </button>
          ))}
        </div>
        {selected ? (
          <aside className={`fragrance-pt-panel is-${side}`}>
            <button type="button" className="close" onClick={() => setSelected(null)}>
              {t("close")}
            </button>
            <h2>{selected.name}</h2>
            <p className="text-sm text-gold-light">
              {selected.symbol} · {selected.code}
            </p>
            <dl>
              <dt>{t("pt.family")}</dt>
              <dd>{t(`pt.family.${selected.family}` as MessageKey)}</dd>
              <dt>{t("pt.layer")}</dt>
              <dd>{t(`pt.layer.${selected.layer}` as MessageKey)}</dd>
              <dt>{t("pt.intensity")}</dt>
              <dd>{selected.intensity}/10</dd>
              <dt>{t("pt.freshness")}</dt>
              <dd>{selected.freshness}/10</dd>
              <dt>{t("pt.longevity")}</dt>
              <dd>{selected.longevity}/10</dd>
              {selected.compatibleWith?.length ? (
                <>
                  <dt>{t("pt.compatible")}</dt>
                  <dd>{selected.compatibleWith.join(", ")}</dd>
                </>
              ) : null}
            </dl>
          </aside>
        ) : null}
      </div>
      {tooltip ? (
        <div
          className="fragrance-pt-tooltip"
          style={{
            left: Math.min(tooltip.x + 16, window.innerWidth - 240),
            top: Math.min(tooltip.y + 16, window.innerHeight - 120),
          }}
        >
          <strong>{tooltip.note.name}</strong>
          <div>
            {tooltip.note.code} · {t(`pt.family.${tooltip.note.family}` as MessageKey)}
          </div>
          <div>
            {t(`pt.layer.${tooltip.note.layer}` as MessageKey)} · {t("pt.intensity")} {tooltip.note.intensity}/10
          </div>
        </div>
      ) : null}
    </div>
  );
}

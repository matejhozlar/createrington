import { useEffect } from "react";

const LAND_AT = 0.3;
const STAGGER = 0.16;
const ARC = 90;
const FOLLOW_MS = 140;
const LEAN_MS = 220;
const MAX_LEAN = 12;
const LIFT = 0.12;
const PAGE_LAYER_FROM = 0.5;

interface Flight {
  key: string;
  delay: number;
  target: number;
  t: number;
  lean: number;
  lastX: number | null;
}

interface FlyCopy {
  node: HTMLElement;
  shadow: HTMLElement | null;
}

interface FlightNodes {
  from: HTMLElement;
  to: HTMLElement;
  fixed: FlyCopy;
  page: FlyCopy;
  body: HTMLElement | null;
  card: HTMLElement | null;
}

interface FlightLayout {
  origin: DOMRect;
  target: DOMRect;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function approach(current: number, target: number, dt: number, ms: number) {
  return current + (target - current) * (1 - Math.exp(-dt / ms));
}

function query(attribute: string, key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${attribute}="${key}"]`);
}

function flyCopy(layer: HTMLElement, key: string): FlyCopy | null {
  const node = layer.querySelector<HTMLElement>(`[data-dock-fly="${key}"]`);
  return node
    ? {
        node,
        shadow: node.querySelector<HTMLElement>("[data-dock-fly-shadow]"),
      }
    : null;
}

function nodesFor(
  key: string,
  layers: { fixed: HTMLElement; page: HTMLElement },
): FlightNodes | null {
  const from = query("data-dock-from", key);
  const to = query("data-dock-to", key);
  const fixed = flyCopy(layers.fixed, key);
  const page = flyCopy(layers.page, key);
  if (!from || !to || !fixed || !page) return null;
  return {
    from,
    to,
    fixed,
    page,
    body: from.querySelector<HTMLElement>("[data-dock-body]"),
    card: to.closest<HTMLElement>("[data-dock-card]"),
  };
}

function targetFor(flight: Flight, target: DOMRect): number {
  const landing = target.top + window.scrollY - window.innerHeight * LAND_AT;
  const overall = clamp(window.scrollY / Math.max(1, landing), 0, 1);
  return clamp((overall - flight.delay) / (1 - STAGGER), 0, 1);
}

function advance(flight: Flight, layout: FlightLayout, dt: number): void {
  flight.target = targetFor(flight, layout.target);
  flight.t = approach(flight.t, flight.target, dt, FOLLOW_MS);
  if (Math.abs(flight.target - flight.t) < 0.001) flight.t = flight.target;
}

function paint(
  flight: Flight,
  nodes: FlightNodes,
  layout: FlightLayout,
  pageOrigin: DOMRect,
  dt: number,
): boolean {
  const { t } = flight;
  nodes.card?.style.setProperty("--land", t.toFixed(4));
  nodes.from.style.setProperty("--flight", t.toFixed(4));
  if (nodes.body) nodes.body.style.opacity = t > 0 ? "0" : "";
  nodes.to.style.opacity = t >= 1 ? "" : "0";

  if (t <= 0 || t >= 1) {
    nodes.fixed.node.style.visibility = "hidden";
    nodes.page.node.style.visibility = "hidden";
    flight.lean = 0;
    flight.lastX = null;
    return t !== flight.target;
  }

  const { origin, target } = layout;
  const eased = easeInOut(t);
  const height = Math.sin(Math.PI * t);
  const scale = lerp(1, target.height / origin.height, eased);
  const x = lerp(origin.left, target.left, eased);
  const y = lerp(origin.top, target.top, eased) - height * ARC;

  const velocity = flight.lastX === null ? 0 : (x - flight.lastX) / dt;
  flight.lastX = x;
  flight.lean = approach(
    flight.lean,
    clamp(velocity * 6, -MAX_LEAN, MAX_LEAN),
    dt,
    LEAN_MS,
  );

  const onPage = t >= PAGE_LAYER_FROM;
  const active = onPage ? nodes.page : nodes.fixed;
  (onPage ? nodes.fixed : nodes.page).node.style.visibility = "hidden";
  const offsetX = onPage ? pageOrigin.left : 0;
  const offsetY = onPage ? pageOrigin.top : 0;

  const cx = origin.width / 2;
  const cy = origin.height / 2;
  active.node.style.visibility = "visible";
  active.node.style.width = `${origin.width}px`;
  active.node.style.height = `${origin.height}px`;
  active.node.style.transform = [
    `translate3d(${x - offsetX}px, ${y - offsetY}px, 0)`,
    `scale(${scale})`,
    `translate(${cx}px, ${cy}px)`,
    `rotate(${flight.lean.toFixed(2)}deg)`,
    `scale(${1 + height * LIFT})`,
    `translate(${-cx}px, ${-cy}px)`,
  ].join(" ");
  if (active.shadow) {
    active.shadow.style.opacity = (height * 0.55).toFixed(3);
    active.shadow.style.transform = `translate3d(-50%, ${height * 60}px, 0) scale(${1 + height * 0.5})`;
  }

  return flight.t !== flight.target || Math.abs(flight.lean) > 0.05;
}

export function useChampionDock(keys: string[], delays: number[]): void {
  const signature = keys.join(",");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fixedLayer = document.querySelector<HTMLElement>(
      '[data-dock-layer="fixed"]',
    );
    const pageLayer = document.querySelector<HTMLElement>(
      '[data-dock-layer="page"]',
    );
    if (!fixedLayer || !pageLayer) return;
    const layers = { fixed: fixedLayer, page: pageLayer };

    const flights: Flight[] = signature.split(",").map((key, index) => ({
      key,
      delay: delays[index] ?? 0,
      target: 0,
      t: 0,
      lean: 0,
      lastX: null,
    }));
    for (const flight of flights) {
      const to = query("data-dock-to", flight.key);
      if (to) {
        flight.t = flight.target = targetFor(
          flight,
          to.getBoundingClientRect(),
        );
      }
    }

    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? clamp(now - last, 1, 64) : 16;
      last = now;

      const measured = flights.map((flight) => {
        const nodes = nodesFor(flight.key, layers);
        if (!nodes) return null;
        const layout = {
          origin: nodes.from.getBoundingClientRect(),
          target: nodes.to.getBoundingClientRect(),
        };
        return { flight, nodes, layout };
      });
      const pageOrigin = pageLayer.getBoundingClientRect();

      let moving = false;
      for (const entry of measured) {
        if (!entry) continue;
        advance(entry.flight, entry.layout, dt);
        if (paint(entry.flight, entry.nodes, entry.layout, pageOrigin, dt)) {
          moving = true;
        }
      }

      frame = moving ? requestAnimationFrame(tick) : 0;
      if (!moving) last = 0;
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    wake();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    const observer = new ResizeObserver(wake);
    observer.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      observer.disconnect();
      for (const { key } of flights) {
        const nodes = nodesFor(key, layers);
        if (!nodes) continue;
        nodes.from.style.removeProperty("--flight");
        if (nodes.body) nodes.body.style.opacity = "";
        nodes.to.style.opacity = "";
        nodes.card?.style.removeProperty("--land");
      }
    };
  }, [signature, delays]);
}

import { useEffect } from "react";

const LAND_AT = 0.3;
const STAGGER = 0.16;
const ARC = 90;
const FOLLOW_MS = 140;
const LEAN_MS = 220;
const MAX_LEAN = 12;
const LIFT = 0.12;

interface Flight {
  key: string;
  delay: number;
  target: number;
  t: number;
  lean: number;
  lastX: number | null;
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

function targetFor(flight: Flight, to: HTMLElement): number {
  const rect = to.getBoundingClientRect();
  const landing = rect.top + window.scrollY - window.innerHeight * LAND_AT;
  const overall = clamp(window.scrollY / Math.max(1, landing), 0, 1);
  return clamp((overall - flight.delay) / (1 - STAGGER), 0, 1);
}

function render(flight: Flight, dt: number): boolean {
  const from = query("data-dock-from", flight.key);
  const to = query("data-dock-to", flight.key);
  const fly = query("data-dock-fly", flight.key);
  if (!from || !to || !fly) return false;

  flight.target = targetFor(flight, to);
  flight.t = approach(flight.t, flight.target, dt, FOLLOW_MS);
  if (Math.abs(flight.target - flight.t) < 0.001) flight.t = flight.target;

  const { t } = flight;
  const card = to.closest<HTMLElement>("[data-dock-card]");
  card?.style.setProperty("--land", t.toFixed(4));
  from.style.setProperty("--flight", t.toFixed(4));
  const body = from.querySelector<HTMLElement>("[data-dock-body]");
  if (body) body.style.opacity = t > 0 ? "0" : "";
  to.style.opacity = t >= 1 ? "" : "0";

  if (t <= 0 || t >= 1) {
    fly.style.visibility = "hidden";
    flight.lean = 0;
    flight.lastX = null;
    return t !== flight.target;
  }

  const origin = from.getBoundingClientRect();
  const target = to.getBoundingClientRect();
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

  const cx = origin.width / 2;
  const cy = origin.height / 2;
  fly.style.visibility = "visible";
  fly.style.width = `${origin.width}px`;
  fly.style.height = `${origin.height}px`;
  fly.style.transform = [
    `translate3d(${x}px, ${y}px, 0)`,
    `scale(${scale})`,
    `translate(${cx}px, ${cy}px)`,
    `rotate(${flight.lean.toFixed(2)}deg)`,
    `scale(${1 + height * LIFT})`,
    `translate(${-cx}px, ${-cy}px)`,
  ].join(" ");
  fly.style.filter = `drop-shadow(0 ${height * 60}px ${height * 50}px rgba(0, 0, 0, ${height * 0.55}))`;

  return flight.t !== flight.target || Math.abs(flight.lean) > 0.05;
}

export function useChampionDock(keys: string[], delays: number[]): void {
  const signature = keys.join(",");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
      if (to) flight.t = flight.target = targetFor(flight, to);
    }

    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? clamp(now - last, 1, 64) : 16;
      last = now;
      const moving = flights.map((flight) => render(flight, dt)).some(Boolean);
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
        const from = query("data-dock-from", key);
        const to = query("data-dock-to", key);
        if (from) {
          from.style.removeProperty("--flight");
          const body = from.querySelector<HTMLElement>("[data-dock-body]");
          if (body) body.style.opacity = "";
        }
        if (to) {
          to.style.opacity = "";
          to.closest<HTMLElement>("[data-dock-card]")?.style.removeProperty(
            "--land",
          );
        }
      }
    };
  }, [signature, delays]);
}

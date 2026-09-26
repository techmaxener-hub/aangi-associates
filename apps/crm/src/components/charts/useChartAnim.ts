import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** false on first paint, true a frame later — lets CSS transitions animate from the empty state. */
export function useAnimateIn(): boolean {
  const [ready, setReady] = useState(prefersReducedMotion());
  useEffect(() => {
    if (ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [ready]);
  return ready;
}

/** Counts up to `value` (easeOutCubic). Returns the final value immediately for reduced motion. */
export function useCountUp(value: number, ms = 900): number {
  const [n, setN] = useState(prefersReducedMotion() ? value : 0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}

/**
 * Measures an element's width (updates on resize) so charts can draw their
 * viewBox at real pixel size — otherwise a 640-wide chart squeezed onto a
 * 350px phone shrinks its axis text to ~5px.
 */
export function useContainerWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

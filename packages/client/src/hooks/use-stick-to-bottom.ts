import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

const NEAR_BOTTOM_PX = 64;
const AT_BOTTOM_PX = 4;

interface StickToBottomOptions {
  onReachBottom?: () => void;
}

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

export function useStickToBottom<T extends HTMLElement>({
  onReachBottom,
}: StickToBottomOptions = {}) {
  const [element, setElement] = useState<T | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const nearBottomRef = useRef(true);
  const atBottomRef = useRef(true);
  const pinnedTopRef = useRef<number | null>(null);
  const smoothScrollingRef = useRef(false);

  const pin = useCallback((el: T): void => {
    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;
    pinnedTopRef.current = el.scrollTop === before ? null : el.scrollTop;
  }, []);

  const syncPosition = useEffectEvent((el: T): void => {
    const dist = distanceFromBottom(el);
    const wasNearBottom = nearBottomRef.current;
    nearBottomRef.current = dist < NEAR_BOTTOM_PX;
    atBottomRef.current = dist < AT_BOTTOM_PX;
    setPinnedToBottom(nearBottomRef.current);
    if (!wasNearBottom && nearBottomRef.current) onReachBottom?.();
  });

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth"): void => {
      if (!element) return;
      if (behavior !== "smooth") {
        pin(element);
        return;
      }
      if (distanceFromBottom(element) < AT_BOTTOM_PX) return;
      smoothScrollingRef.current = true;
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    },
    [element, pin],
  );

  const keepAtBottom = useCallback((): void => {
    if (element && atBottomRef.current) pin(element);
  }, [element, pin]);

  const followNewContent = useCallback((): void => {
    if (nearBottomRef.current || smoothScrollingRef.current) {
      scrollToBottom("smooth");
    }
  }, [scrollToBottom]);

  const isNearBottom = useCallback(() => nearBottomRef.current, []);

  useEffect(() => {
    if (!element) return;
    pin(element);
    const onScroll = (): void => {
      const pinnedTop = pinnedTopRef.current;
      pinnedTopRef.current = null;
      if (pinnedTop !== null && Math.abs(element.scrollTop - pinnedTop) < 1) {
        return;
      }
      if (smoothScrollingRef.current) {
        if (distanceFromBottom(element) >= AT_BOTTOM_PX) return;
        smoothScrollingRef.current = false;
      }
      syncPosition(element);
    };
    const onScrollEnd = (): void => {
      smoothScrollingRef.current = false;
      syncPosition(element);
    };
    const onUserScroll = (): void => {
      smoothScrollingRef.current = false;
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("scrollend", onScrollEnd);
    element.addEventListener("wheel", onUserScroll, { passive: true });
    element.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("scrollend", onScrollEnd);
      element.removeEventListener("wheel", onUserScroll);
      element.removeEventListener("touchmove", onUserScroll);
    };
  }, [element, pin]);

  useEffect(() => {
    if (!element) return;
    let last: { width: number; height: number } | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const changed =
        last !== null && (last.width !== width || last.height !== height);
      last = { width, height };
      if (!changed) return;
      if (atBottomRef.current) pin(element);
      else syncPosition(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, pin]);

  return {
    ref: setElement,
    pinnedToBottom,
    isNearBottom,
    scrollToBottom,
    followNewContent,
    keepAtBottom,
  };
}

import { useCallback, useState } from "react";

export function useInView<T extends Element>(
  threshold = 0.3,
): [(node: T | null) => (() => void) | undefined, boolean] {
  const [inView, setInView] = useState(false);

  const ref = useCallback(
    (node: T | null) => {
      if (!node) return undefined;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          setInView(true);
          observer.disconnect();
        },
        { threshold },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [threshold],
  );

  return [ref, inView];
}

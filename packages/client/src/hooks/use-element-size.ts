import { useLayoutEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

function contentBox(element: HTMLElement): ElementSize {
  const style = getComputedStyle(element);
  return {
    width:
      element.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight),
    height:
      element.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom),
  };
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = ({ width, height }: ElementSize) =>
      setSize((current) =>
        current?.width === width && current.height === height
          ? current
          : { width, height },
      );
    update(contentBox(element));
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

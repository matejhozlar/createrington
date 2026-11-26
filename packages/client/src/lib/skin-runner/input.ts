const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const SLIDE_KEYS = new Set(["ArrowDown", "KeyS", "ShiftLeft", "ShiftRight"]);
const INTERACTIVE = "input, textarea, select, button, a, [contenteditable]";
const SWIPE_DOWN_PX = 24;

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

export class Input {
  jumpHeld = false;
  downHeld = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly onPress: () => void;
  private readonly viewObserver: IntersectionObserver | null;
  private inView = true;
  private jumpQueued = false;
  private pointerId: number | null = null;
  private pointerStartY = 0;

  constructor(canvas: HTMLCanvasElement, onPress: () => void) {
    this.canvas = canvas;
    this.onPress = onPress;
    canvas.style.touchAction = "none";

    if (typeof IntersectionObserver !== "undefined") {
      this.viewObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) this.inView = entry.isIntersecting;
      });
      this.viewObserver.observe(canvas);
    } else {
      this.viewObserver = null;
    }

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.release);
  }

  readonly release = (): void => {
    this.pointerId = null;
    this.jumpHeld = false;
    this.downHeld = false;
  };

  queueJump(): void {
    this.jumpQueued = true;
  }

  takeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  destroy(): void {
    this.viewObserver?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.release);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.inView || isInteractive(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (JUMP_KEYS.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) this.onPress();
      this.jumpHeld = true;
    } else if (SLIDE_KEYS.has(event.code)) {
      event.preventDefault();
      this.downHeld = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (JUMP_KEYS.has(event.code)) this.jumpHeld = false;
    if (SLIDE_KEYS.has(event.code)) this.downHeld = false;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.pointerId !== null) return;
    event.preventDefault();
    this.canvas.focus({ preventScroll: true });
    this.pointerId = event.pointerId;
    this.pointerStartY = event.clientY;
    this.onPress();
    this.jumpHeld = true;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    if (event.clientY - this.pointerStartY > SWIPE_DOWN_PX) {
      this.downHeld = true;
      this.jumpHeld = false;
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.jumpHeld = false;
    this.downHeld = false;
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };
}

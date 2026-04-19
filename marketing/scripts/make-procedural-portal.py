"""Generate a blue portal atlas for the marketing scene.

Reproduces Minecraft's procedural two-spiral nether-portal algorithm on a
16×16 toroidal grid over 32 frames. Integer-periodic in space and time, so
the output tiles cleanly and loops without a seam. Color is blue instead of
vanilla purple.

Writes to assets/parallel-worlds/pw-portal.png (the marketing-local staging
dir that scripts/sync-assets.mjs merges into public/).

    python scripts/make-procedural-portal.py
"""

import math
import random
from pathlib import Path

from PIL import Image

OUT = Path("assets/parallel-worlds/pw-portal.png")

FRAME = 16
N_FRAMES = 32


def torus_signed(x, center, size):
    return ((x - center + size / 2) % size) - size / 2


def main() -> None:
    img = Image.new("RGBA", (FRAME, FRAME * N_FRAMES))
    dst = img.load()

    rng = random.Random(100)
    shimmer = [[rng.random() for _ in range(FRAME)] for _ in range(FRAME)]

    for frame in range(N_FRAMES):
        t = frame / N_FRAMES
        for y in range(FRAME):
            for x in range(FRAME):
                n = 0.0
                # Spiral centers offset by 0.5 so no pixel sits on the atan2
                # singularity at magnitude=0.
                for direction in range(2):
                    cx = -0.5 if direction == 0 else FRAME / 2 - 0.5
                    cy = -0.5 if direction == 0 else FRAME / 2 - 0.5
                    dx = torus_signed(x, cx, FRAME) / (FRAME / 2)
                    dy = torus_signed(y, cy, FRAME) / (FRAME / 2)
                    magnitude = math.sqrt(dx * dx + dy * dy)
                    angle = math.atan2(dy, dx)
                    arg = angle + t * 2 * math.pi - magnitude * 10 + direction * 2
                    val = (math.sin(arg) * 0.5 + 0.5) / (magnitude + 1)
                    n += val

                n *= 0.7
                n += (shimmer[y][x] - 0.5) * 0.08
                n = max(0.0, min(1.0, n))

                r = min(255, int(n ** 3 * 142 + 18))
                g = min(255, int(n * n * 165 + 30))
                b = min(255, int(n * 155 + 60))
                dst[x, frame * FRAME + y] = (r, g, b, 255)

    img.save(OUT, optimize=True)
    print(f"wrote {OUT}  ({FRAME}×{FRAME * N_FRAMES})")


if __name__ == "__main__":
    main()

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

// Decorative hexagonal "SEO / data" network behind the 404 card: glowing nodes,
// animated connection lines, one severed node (the missing page) and a central
// hexagon accent standing in for the brand core. Purely ornamental, so the SVG
// is aria-hidden; all copy/CTAs live in the surrounding Astro page. Motion is
// GPU-cheap (transform/opacity only) and fully disabled under
// prefers-reduced-motion.

interface NetNode {
  x: number;
  y: number;
  r: number;
  glow?: boolean; // renders a soft halo + pulse
  hex?: boolean; // the central brand hexagon
}

// Coordinates live in a 1200×760 viewBox; the SVG is scaled to cover the
// viewport (preserveAspectRatio slice), so exact placement is not critical.
const nodes: NetNode[] = [
  { x: 600, y: 300, r: 9, glow: true, hex: true }, // core
  { x: 430, y: 220, r: 5, glow: true },
  { x: 760, y: 210, r: 5 },
  { x: 330, y: 380, r: 4 },
  { x: 860, y: 360, r: 6, glow: true },
  { x: 500, y: 430, r: 4 },
  { x: 700, y: 440, r: 5 },
  { x: 240, y: 250, r: 4 },
  { x: 930, y: 230, r: 5, glow: true },
  { x: 600, y: 150, r: 4 },
  { x: 390, y: 520, r: 5 },
  { x: 820, y: 520, r: 4 },
];

// Connected edges (indices into `nodes`).
const edges: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 5],
  [0, 6],
  [0, 9],
  [1, 3],
  [1, 7],
  [1, 9],
  [2, 4],
  [2, 8],
  [2, 9],
  [3, 10],
  [5, 10],
  [5, 6],
  [6, 11],
  [4, 11],
  [4, 8],
];

// The severed node: sits apart, its links to the network are broken (they stop
// short with a gap), symbolising the page that no longer connects.
const broken = { x: 1040, y: 440, r: 6 };
const severedFrom = [4, 11]; // node indices whose link to `broken` is cut

function path(a: { x: number; y: number }, b: { x: number; y: number }) {
  return `M${a.x} ${a.y} L${b.x} ${b.y}`;
}

// End the severed line `gap` px before the broken node, leaving a visible break.
function severedPath(a: NetNode, gap = 46) {
  const dx = broken.x - a.x;
  const dy = broken.y - a.y;
  const len = Math.hypot(dx, dy);
  const ex = broken.x - (dx / len) * gap;
  const ey = broken.y - (dy / len) * gap;
  return `M${a.x} ${a.y} L${ex} ${ey}`;
}

// Regular hexagon points for the brand core node.
function hexPoints(cx: number, cy: number, size: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

// Deterministic particle field (no Math.random → no SSR/client hydration
// mismatch). Positions in %, plus per-particle size/delay for staggered drift.
const particles = [
  { x: 12, y: 24, s: 3, d: 0 },
  { x: 22, y: 68, s: 2, d: 1.4 },
  { x: 34, y: 16, s: 2, d: 2.1 },
  { x: 44, y: 82, s: 3, d: 0.7 },
  { x: 58, y: 28, s: 2, d: 3.2 },
  { x: 66, y: 74, s: 3, d: 1.1 },
  { x: 74, y: 40, s: 2, d: 2.6 },
  { x: 82, y: 62, s: 2, d: 0.4 },
  { x: 88, y: 22, s: 3, d: 1.8 },
  { x: 16, y: 48, s: 2, d: 2.9 },
  { x: 50, y: 58, s: 2, d: 3.6 },
  { x: 92, y: 50, s: 2, d: 0.9 },
];

const root = ref<HTMLElement | null>(null);
const reduce = ref(false);

let frame = 0;
let targetX = 0;
let targetY = 0;
let curX = 0;
let curY = 0;
let mql: MediaQueryList | null = null;

function onPointerMove(e: PointerEvent) {
  // Normalise pointer to -1..1 around the viewport centre.
  targetX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  const el = root.value;
  if (el) {
    el.style.setProperty('--nf-glow-x', `${(e.clientX / window.innerWidth) * 100}%`);
    el.style.setProperty('--nf-glow-y', `${(e.clientY / window.innerHeight) * 100}%`);
  }
}

function tick() {
  // Ease current toward target for a soft, lag-following parallax.
  curX += (targetX - curX) * 0.06;
  curY += (targetY - curY) * 0.06;
  const el = root.value;
  if (el) {
    el.style.setProperty('--nf-px', curX.toFixed(3));
    el.style.setProperty('--nf-py', curY.toFixed(3));
  }
  frame = requestAnimationFrame(tick);
}

function applyReduce(matches: boolean) {
  reduce.value = matches;
}

onMounted(() => {
  mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  applyReduce(mql.matches);
  mql.addEventListener('change', (e) => applyReduce(e.matches));

  // Parallax + mouse-glow are enhancements only; skip entirely when the user
  // prefers reduced motion or on touch (no hover pointer).
  const canHover = window.matchMedia('(hover: hover)').matches;
  if (!reduce.value && canHover) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    frame = requestAnimationFrame(tick);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove);
  if (frame) cancelAnimationFrame(frame);
});
</script>

<template>
  <div
    ref="root"
    class="nf-net"
    :class="{ 'nf-net--still': reduce }"
    aria-hidden="true"
  >
    <!-- Soft light that follows the cursor (enhancement only). -->
    <div class="nf-net__glow"></div>

    <div class="nf-net__parallax">
      <svg
        class="nf-net__svg"
        viewBox="0 0 1200 760"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <filter id="nf-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <linearGradient id="nf-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#436bef" stop-opacity="0.05" />
            <stop offset="0.5" stop-color="#436bef" stop-opacity="0.35" />
            <stop offset="1" stop-color="#436bef" stop-opacity="0.05" />
          </linearGradient>
        </defs>

        <!-- Base connection lines. -->
        <g class="nf-net__edges">
          <path
            v-for="(e, i) in edges"
            :key="`b${i}`"
            :d="path(nodes[e[0]], nodes[e[1]])"
            class="nf-net__edge"
          />
        </g>

        <!-- Travelling pulse along each line (data flow). -->
        <g class="nf-net__pulses">
          <path
            v-for="(e, i) in edges"
            :key="`p${i}`"
            :d="path(nodes[e[0]], nodes[e[1]])"
            class="nf-net__pulse"
            :style="{ animationDelay: `${(i % 6) * 0.7}s` }"
          />
        </g>

        <!-- Severed links to the broken node. -->
        <g class="nf-net__severed">
          <path
            v-for="idx in severedFrom"
            :key="`s${idx}`"
            :d="severedPath(nodes[idx])"
            class="nf-net__cut"
          />
        </g>

        <!-- Halos for glowing nodes. -->
        <g filter="url(#nf-soft)">
          <circle
            v-for="(n, i) in nodes"
            v-show="n.glow"
            :key="`h${i}`"
            :cx="n.x"
            :cy="n.y"
            :r="n.r * 2.4"
            class="nf-net__halo"
          />
        </g>

        <!-- Nodes. -->
        <g class="nf-net__nodes">
          <template v-for="(n, i) in nodes" :key="`n${i}`">
            <polygon
              v-if="n.hex"
              :points="hexPoints(n.x, n.y, n.r * 2.2)"
              class="nf-net__hex"
            />
            <circle
              :cx="n.x"
              :cy="n.y"
              :r="n.r"
              class="nf-net__node"
              :class="{ 'nf-net__node--pulse': n.glow }"
              :style="{ animationDelay: `${(i % 5) * 0.5}s` }"
            />
          </template>
        </g>

        <!-- The broken node: dashed, muted, disconnected. -->
        <g class="nf-net__broken">
          <circle :cx="broken.x" :cy="broken.y" :r="broken.r + 6" class="nf-net__broken-ring" />
          <circle :cx="broken.x" :cy="broken.y" :r="broken.r" class="nf-net__broken-core" />
        </g>
      </svg>
    </div>

    <!-- Floating particles (light dust). -->
    <div class="nf-net__particles">
      <span
        v-for="(p, i) in particles"
        :key="`pt${i}`"
        class="nf-net__particle"
        :style="{
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: `${p.s}px`,
          height: `${p.s}px`,
          animationDelay: `${p.d}s`,
        }"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.nf-net {
  position: absolute;
  inset: 0;
  overflow: hidden;
  --nf-px: 0;
  --nf-py: 0;
  --nf-glow-x: 70%;
  --nf-glow-y: 30%;
}

/* Cursor-following soft light. */
.nf-net__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    22rem 22rem at var(--nf-glow-x) var(--nf-glow-y),
    rgba(67, 107, 239, 0.1),
    transparent 60%
  );
  transition: background-position 0.2s ease;
}

.nf-net__parallax {
  position: absolute;
  inset: -4%;
  transform: translate3d(
    calc(var(--nf-px) * 16px),
    calc(var(--nf-py) * 16px),
    0
  );
  animation: nf-float 14s ease-in-out infinite;
  will-change: transform;
}

.nf-net__svg {
  width: 100%;
  height: 100%;
  opacity: 0.9;
}

/* Edges */
.nf-net__edge {
  fill: none;
  stroke: url(#nf-line);
  stroke-width: 1.2;
}

.nf-net__pulse {
  fill: none;
  stroke: #436bef;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-dasharray: 5 260;
  stroke-dashoffset: 265;
  opacity: 0.9;
  animation: nf-flow 4.6s linear infinite;
}

/* Severed links */
.nf-net__cut {
  fill: none;
  stroke: #b9c0d0;
  stroke-width: 1.2;
  stroke-dasharray: 4 6;
  opacity: 0.7;
}

/* Nodes */
.nf-net__halo {
  fill: rgba(67, 107, 239, 0.35);
}

.nf-net__node {
  fill: #436bef;
}

.nf-net__node--pulse {
  animation: nf-node 3.4s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

.nf-net__hex {
  fill: rgba(67, 107, 239, 0.08);
  stroke: #436bef;
  stroke-width: 1.6;
}

/* Broken node */
.nf-net__broken-ring {
  fill: none;
  stroke: #c2492f;
  stroke-width: 1.4;
  stroke-dasharray: 3 5;
  opacity: 0.65;
  transform-box: fill-box;
  transform-origin: center;
  animation: nf-spin 22s linear infinite;
}

.nf-net__broken-core {
  fill: #d1d5df;
}

/* Particles */
.nf-net__particles {
  position: absolute;
  inset: 0;
  transform: translate3d(
    calc(var(--nf-px) * 26px),
    calc(var(--nf-py) * 26px),
    0
  );
  will-change: transform;
}

.nf-net__particle {
  position: absolute;
  border-radius: 999px;
  background: rgba(67, 107, 239, 0.45);
  animation: nf-drift 9s ease-in-out infinite;
  will-change: transform, opacity;
}

@keyframes nf-flow {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes nf-node {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.78);
  }
}

@keyframes nf-float {
  0%,
  100% {
    transform: translate3d(
      calc(var(--nf-px) * 16px),
      calc(var(--nf-py) * 16px),
      0
    );
  }
  50% {
    transform: translate3d(
      calc(var(--nf-px) * 16px),
      calc(var(--nf-py) * 16px + 12px),
      0
    );
  }
}

@keyframes nf-drift {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-16px);
    opacity: 0.9;
  }
}

@keyframes nf-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Reduced motion: freeze everything, keep the static composition. */
.nf-net--still .nf-net__parallax,
.nf-net--still .nf-net__particle,
.nf-net--still .nf-net__pulse,
.nf-net--still .nf-net__node--pulse,
.nf-net--still .nf-net__broken-ring {
  animation: none;
}

.nf-net--still .nf-net__parallax,
.nf-net--still .nf-net__particles {
  transform: none;
}

.nf-net--still .nf-net__pulse {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .nf-net__parallax,
  .nf-net__particle,
  .nf-net__pulse,
  .nf-net__node--pulse,
  .nf-net__broken-ring {
    animation: none;
  }
  .nf-net__pulse {
    opacity: 0;
  }
}
</style>

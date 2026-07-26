import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import NotFound from './NotFound.vue';

// Captured 'change' listener registered on the reduced-motion media query, so
// tests can simulate the OS toggling the preference at runtime.
let reducedChange: ((e: { matches: boolean }) => void) | null = null;

// Control prefers-reduced-motion / hover via matchMedia so we can exercise both
// the animated and the frozen code paths.
function stubMatchMedia(reduced: boolean, hover = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduced-motion')
      ? reduced
      : q.includes('hover')
        ? hover
        : false,
    media: q,
    addEventListener: (_ev: string, cb: (e: { matches: boolean }) => void) => {
      if (q.includes('reduced-motion')) reducedChange = cb;
    },
    removeEventListener: vi.fn(),
  }));
}

describe('NotFound (decorative network island)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    reducedChange = null;
    // No-op the animation frame by default so mounts that enable motion don't
    // start a real happy-dom rAF loop that leaks across tests (each test that
    // needs a live frame re-stubs these).
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the full network: nodes, edges, pulses, severed links, hex core, particles', () => {
    stubMatchMedia(false);
    const w = mount(NotFound);

    // 12 nodes total, but node 0 is drawn as the brand mark, not a plain dot.
    expect(w.findAll('.nf-net__node')).toHaveLength(11);
    expect(w.findAll('.nf-net__edge')).toHaveLength(17);
    expect(w.findAll('.nf-net__pulse')).toHaveLength(17);
    // The broken node is fed by exactly two severed connections.
    expect(w.findAll('.nf-net__cut')).toHaveLength(2);
    expect(w.findAll('.nf-net__particle')).toHaveLength(12);
    expect(w.find('.nf-net__broken-core').exists()).toBe(true);
  });

  it('renders the inlined Evix brand mark as the source node', () => {
    stubMatchMedia(false);
    const w = mount(NotFound);

    expect(w.find('.nf-net__mark').exists()).toBe(true);
    expect(w.find('.nf-net__mark-hex').exists()).toBe(true);
    // Six hexagon vertices + one central accent node.
    expect(w.findAll('.nf-net__mark-vtx')).toHaveLength(7);
    // The "E" is four strokes.
    expect(w.findAll('.nf-net__mark-e path')).toHaveLength(4);
  });

  it('stops the severed line short of the broken node (leaves a visible gap)', () => {
    stubMatchMedia(false);
    const w = mount(NotFound);

    // severedPath ends ~46px before the broken node (1040,440), so no endpoint
    // should land exactly on it.
    for (const cut of w.findAll('.nf-net__cut')) {
      expect(cut.attributes('d')).not.toContain('L1040 440');
    }
  });

  it('freezes under prefers-reduced-motion and skips the animation loop', async () => {
    stubMatchMedia(true);
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);

    const w = mount(NotFound);
    await flushPromises(); // let the reactive `reduce` flag flush to the DOM

    expect(w.find('.nf-net').classes()).toContain('nf-net--still');
    expect(raf).not.toHaveBeenCalled();

    // OS toggles the preference off at runtime → the 'change' listener unfreezes.
    expect(reducedChange).toBeTypeOf('function');
    reducedChange!({ matches: false });
    await flushPromises();
    expect(w.find('.nf-net').classes()).not.toContain('nf-net--still');

    // Unmount with no frame scheduled exercises the `if (frame)` guard's false arm.
    w.unmount();
  });

  it('runs parallax + cursor glow when motion is allowed and pointer can hover', async () => {
    stubMatchMedia(false, true);

    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const w = mount(NotFound, { attachTo: document.body });
    const root = w.find('.nf-net').element as HTMLElement;

    expect(w.find('.nf-net').classes()).not.toContain('nf-net--still');
    // onMounted scheduled the tick loop.
    expect(rafCb).toBeTypeOf('function');

    // Move the cursor → glow position tracks it.
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 100, clientY: 50 }),
    );
    expect(root.style.getPropertyValue('--nf-glow-x')).toContain('%');

    // Advance one animation frame → parallax offset gets written.
    rafCb!(0);
    expect(root.style.getPropertyValue('--nf-px')).not.toBe('');

    w.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('does not attach pointer/raf handlers on touch (no hover)', () => {
    stubMatchMedia(false, false);
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);

    mount(NotFound);
    expect(raf).not.toHaveBeenCalled();
  });
});

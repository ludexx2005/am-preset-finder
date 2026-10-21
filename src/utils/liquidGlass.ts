import React from 'react';

let rafPending = false;
let pendingEl: HTMLElement | null = null;
let pendingX = 0;
let pendingY = 0;

/**
 * Lightweight, GPU-friendly pointer coordinate updater.
 * Skips continuous getBoundingClientRect() layout reads on mobile touch move
 * so touch scrolling remains 100% smooth at 60fps on Android & iOS.
 */
export function updateLiquidPointerCoords(
  el: HTMLElement | null,
  clientX: number,
  clientY: number,
  active = true
): void {
  if (!el) return;
  pendingEl = el;
  pendingX = clientX;
  pendingY = clientY;

  if (!active) {
    el.style.setProperty('--pointer-opacity', '0');
    return;
  }

  if (rafPending) return;
  rafPending = true;

  window.requestAnimationFrame(() => {
    rafPending = false;
    if (!pendingEl) return;
    const rect = pendingEl.getBoundingClientRect();
    const x = Math.round(pendingX - rect.left);
    const y = Math.round(pendingY - rect.top);
    pendingEl.style.setProperty('--mouse-x', `${x}px`);
    pendingEl.style.setProperty('--mouse-y', `${y}px`);
    pendingEl.style.setProperty('--pointer-opacity', '1');
  });
}

export interface LiquidPointerHandlers<T extends HTMLElement = HTMLElement> {
  onPointerMove: React.PointerEventHandler<T>;
  onPointerDown: React.PointerEventHandler<T>;
  onPointerUp: React.PointerEventHandler<T>;
  onPointerLeave: React.PointerEventHandler<T>;
}

/**
 * Reusable pointer handlers optimized for mobile 60fps performance:
 * Ignores continuous touch-move reflows while preserving desktop hover glow.
 */
export const liquidPointerHandlers: LiquidPointerHandlers<HTMLElement> = {
  onPointerMove: (e) => {
    if (e.pointerType === 'touch') return;
    updateLiquidPointerCoords(e.currentTarget, e.clientX, e.clientY, true);
  },
  onPointerDown: (e) => {
    if (e.pointerType !== 'touch') {
      updateLiquidPointerCoords(e.currentTarget, e.clientX, e.clientY, true);
    }
    e.currentTarget.setAttribute('data-pressed', 'true');
  },
  onPointerUp: (e) => {
    e.currentTarget.removeAttribute('data-pressed');
  },
  onPointerLeave: (e) => {
    e.currentTarget.removeAttribute('data-pressed');
    if (e.pointerType !== 'touch') {
      e.currentTarget.style.setProperty('--pointer-opacity', '0');
    }
  },
};

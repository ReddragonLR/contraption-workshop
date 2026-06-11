/**
 * Celebration confetti (DOM-based, visual only — allowed to use Math.random
 * because nothing here touches the simulation). Honors reduced motion.
 */
const COLORS = ['#e8a33d', '#58a55c', '#d64545', '#4f86c6', '#e05c7a', '#cde24e'];

export function burstConfetti(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden;';
  document.body.appendChild(host);
  const count = 90;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const size = 6 + Math.random() * 8;
    const x = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const duration = 1.6 + Math.random() * 1.4;
    const rot = Math.random() * 720 - 360;
    piece.style.cssText = `
      position:absolute;top:-20px;left:${x}vw;width:${size}px;height:${size * 0.6}px;
      background:${COLORS[i % COLORS.length]};border-radius:2px;
      animation:cw-confetti ${duration}s ${delay}s cubic-bezier(.2,.6,.4,1) forwards;
      --rot:${rot}deg;`;
    host.appendChild(piece);
  }
  ensureKeyframes();
  setTimeout(() => host.remove(), 3600);
}

let injected = false;
function ensureKeyframes(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `@keyframes cw-confetti {
    to { transform: translateY(105vh) rotate(var(--rot)); opacity: 0.9; }
  }`;
  document.head.appendChild(style);
}

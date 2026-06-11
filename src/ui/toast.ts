let current: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string): void {
  current?.remove();
  clearTimeout(timer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  current = el;
  timer = setTimeout(() => {
    el.remove();
    if (current === el) current = null;
  }, 2200);
}

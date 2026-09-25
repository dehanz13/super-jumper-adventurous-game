export const DIRECTION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function readGameplayInput(keys) {
  return {
    left: Boolean(keys.ArrowLeft || keys.KeyA),
    right: Boolean(keys.ArrowRight || keys.KeyD),
    jump: Boolean(keys.ArrowUp || keys.KeyW || keys.Space),
    fire: Boolean(keys.KeyX || keys.KeyZ),
  };
}

export function directionAtPoint(rect, clientX, clientY) {
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const deadZone = Math.min(rect.width, rect.height) * 0.12;

  if (Math.hypot(dx, dy) < deadZone) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'ArrowLeft' : 'ArrowRight';
  return dy < 0 ? 'ArrowUp' : 'ArrowDown';
}

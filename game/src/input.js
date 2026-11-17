// input.js — keyboard + mouse state for the arena. Tracks held keys, edge
// presses (pressed once per physical press), and the mouse in canvas space.
// The canvas is 1280x720 internally and CSS-scaled, so mouse coordinates
// are converted from client space into canvas space on every event.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),       // edge-triggered: consumed by main loop each tick
    mouse: { x: 640, y: 360, down: false, clicked: false, rightDown: false },
    anyKey: false,
  };

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  function onKeyDown(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
    input.anyKey = true;
  }
  function onKeyUp(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys.delete(k);
  }
  function onMouseMove(e) {
    const p = canvasPos(e);
    input.mouse.x = p.x; input.mouse.y = p.y;
  }
  function onMouseDown(e) {
    const p = canvasPos(e);
    input.mouse.x = p.x; input.mouse.y = p.y;
    if (e.button === 0) { input.mouse.down = true; input.mouse.clicked = true; }
    if (e.button === 2) input.mouse.rightDown = true;
  }
  function onMouseUp(e) {
    if (e.button === 0) input.mouse.down = false;
    if (e.button === 2) input.mouse.rightDown = false;
  }
  function onBlur() { input.keys.clear(); input.mouse.down = false; input.mouse.rightDown = false; }
  function onContext(e) { e.preventDefault(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContext);

  input.detach = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('contextmenu', onContext);
  };
  return input;
}

// Held-key helpers. WASD plus arrows both move the Warden.
export function moveVector(input) {
  let x = 0, y = 0;
  if (input.keys.has('a') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('d') || input.keys.has('ArrowRight')) x += 1;
  if (input.keys.has('w') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('s') || input.keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}

export function wasPressed(input, ...keys) {
  for (const k of keys) if (input.pressed.has(k)) return true;
  return false;
}

// Called once per tick by the main loop: edge presses live exactly one tick.
export function endTick(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
  input.anyKey = false;
}

// Synthetic input for deterministic scenes and scripted playtests: the
// shot builder drives the same fields a real player would.
export function fakeInput() {
  return {
    keys: new Set(), pressed: new Set(),
    mouse: { x: 640, y: 360, down: false, clicked: false, rightDown: false },
    anyKey: false, detach() {},
  };
}

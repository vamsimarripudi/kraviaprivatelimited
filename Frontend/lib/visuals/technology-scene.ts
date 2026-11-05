/** Decorative, locally rendered network. No tracking, remote assets or data. */
export function createTechnologyScene(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return null;

  let width = 0;
  let height = 0;
  let time = 0;
  let frame = 0;
  let previousTime = 0;
  let enabled = false;
  let visible = true;
  let destroyed = false;

  function draw() {
    if (!context || !width || !height) return;
    context.clearRect(0, 0, width, height);
    const mobile = width < 700;
    const columns = mobile ? 44 : 64;
    const rows = mobile ? 23 : 31;
    const radius = mobile ? Math.min(width * .75, 340) : Math.min(width * .32, 440);
    const centerX = width * (mobile ? .75 : .79);
    const centerY = height * (mobile ? .72 : .49);
    const rotation = time * .07 + .5;
    const points: { x: number; y: number; depth: number }[][] = [];

    for (let row = 0; row <= rows; row++) {
      const latitude = -Math.PI / 2 + (row / rows) * Math.PI;
      const ring = [];
      for (let column = 0; column <= columns; column++) {
        const longitude = (column / columns) * Math.PI * 2;
        const ripple = 1 + .1 * Math.sin(longitude * 3 + time * .28) * Math.cos(latitude * 4 - time * .15);
        const x = ripple * Math.cos(latitude) * Math.cos(longitude + rotation);
        const y = ripple * Math.sin(latitude);
        const z = ripple * Math.cos(latitude) * Math.sin(longitude + rotation);
        const tiltedY = y * .94 - z * .34;
        const tiltedZ = y * .34 + z * .94;
        const perspective = 2.9 / (2.9 - tiltedZ * .5);
        ring.push({ x: centerX + x * radius * perspective, y: centerY + tiltedY * radius * perspective, depth: (tiltedZ + 1.2) / 2.4 });
      }
      points.push(ring);
    }

    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column < columns; column++) {
        const point = points[row][column];
        const alpha = .04 + Math.max(0, point.depth) ** 3 * .43;
        context.strokeStyle = `rgba(134, 211, 231, ${alpha})`;
        context.lineWidth = .65;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(points[row][column + 1].x, points[row][column + 1].y);
        if (row < rows) {
          context.moveTo(point.x, point.y);
          context.lineTo(points[row + 1][column].x, points[row + 1][column].y);
        }
        context.stroke();
        if ((row + column) % 3 === 0 && point.depth > .5) {
          context.fillStyle = `rgba(210, 245, 249, ${alpha + .14})`;
          context.beginPath();
          context.arc(point.x, point.y, point.depth * 1.25, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  function canAnimate() { return enabled && visible && !document.hidden && !destroyed; }

  function tick(timestamp: number) {
    frame = 0;
    if (!canAnimate()) return;
    if (!previousTime || timestamp - previousTime >= 1000 / 30) {
      if (previousTime) time += Math.min(timestamp - previousTime, 80) / 1000;
      previousTime = timestamp;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function updateMotion() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    if (canAnimate()) frame = requestAnimationFrame(tick);
  }

  function resize() {
    if (destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateMotion();
  });
  intersectionObserver.observe(canvas);
  document.addEventListener("visibilitychange", updateMotion);
  resize();

  return {
    setMotion(value: boolean) { enabled = value; updateMotion(); },
    destroy() {
      destroyed = true;
      updateMotion();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", updateMotion);
    },
  };
}

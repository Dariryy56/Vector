import { makeId } from './svg.js';

export function fitBox(viewBox, maxWidth, maxHeight) {
  const ratio = viewBox.width / viewBox.height || 1;
  let width = Math.min(maxWidth, maxHeight * ratio);
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  return { width, height };
}

export function makeCanvasObject(item, index, canvasWidth, canvasHeight) {
  if (item.kind === 'canvas-background') {
    return {
      id: makeId('layer'),
      libraryId: item.id,
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      rotation: 0,
      role: 'background',
      locked: false,
    };
  }

  const { width, height } = fitBox(item.viewBox, 240, 220);
  const columns = Math.max(1, Math.floor((canvasWidth - 48) / 300));
  const rows = Math.max(1, Math.floor((canvasHeight - 48) / 270));
  const slot = index % (columns * rows);
  const column = slot % columns;
  const row = Math.floor(slot / columns);
  const cellWidth = canvasWidth / columns;
  const cellHeight = canvasHeight / rows;
  return {
    id: makeId('layer'),
    libraryId: item.id,
    x: Math.max(0, column * cellWidth + (cellWidth - width) / 2),
    y: Math.max(0, row * cellHeight + (cellHeight - height) / 2),
    width,
    height,
    rotation: 0,
    role: item.preferredRole === 'background' ? 'background' : 'main',
    locked: false,
  };
}

function clampLayout(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function makeAutoLayout(items, canvasWidth, canvasHeight, currentCount, objectLimit = 100) {
  const usable = items.slice(0, Math.max(0, objectLimit - currentCount));
  const count = usable.length;
  if (!count) return [];

  // The first matched component is the visual anchor; supporting objects are smaller and offset around it.
  // Positions are relative to the artboard, so the logic works in all three formats.
  const focalAnchors = [
    { x: 0.50, y: 0.52 },
    { x: count === 2 ? 0.80 : 0.20, y: 0.25 },
    { x: 0.80, y: 0.76 },
    { x: 0.79, y: 0.25 },
    { x: 0.20, y: 0.77 },
  ];

  if (count <= focalAnchors.length) {
    return usable.map((item, index) => {
      if (item.kind === 'canvas-background') {
        return makeCanvasObject(item, currentCount + index, canvasWidth, canvasHeight);
      }
      const isHero = index === 0;
      const maxWidth = canvasWidth * (isHero ? 0.37 : 0.19);
      const maxHeight = canvasHeight * (isHero ? 0.34 : 0.18);
      const { width, height } = fitBox(item.viewBox, maxWidth, maxHeight);
      const anchor = focalAnchors[index];
      return {
        id: makeId('layer'),
        libraryId: item.id,
        x: clampLayout(anchor.x * canvasWidth - width / 2, 0, canvasWidth - width),
        y: clampLayout(anchor.y * canvasHeight - height / 2, 0, canvasHeight - height),
        width,
        height,
        rotation: 0,
        role: item.preferredRole === 'background' ? 'background' : 'main',
        locked: false,
      };
    });
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(count * canvasWidth / canvasHeight)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellWidth = canvasWidth / columns;
  const cellHeight = canvasHeight / rows;
  return usable.map((item, index) => {
    if (item.kind === 'canvas-background') {
      return makeCanvasObject(item, currentCount + index, canvasWidth, canvasHeight);
    }
    const { width, height } = fitBox(item.viewBox, cellWidth * 0.62, cellHeight * 0.62);
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: makeId('layer'),
      libraryId: item.id,
      x: Math.max(0, column * cellWidth + (cellWidth - width) / 2),
      y: Math.max(0, row * cellHeight + (cellHeight - height) / 2),
      width,
      height,
      rotation: 0,
      role: item.preferredRole === 'background' ? 'background' : 'main',
      locked: false,
    };
  });
}

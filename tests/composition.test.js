import assert from 'node:assert/strict';
import test from 'node:test';
import { makeAutoLayout } from '../src/utils/composition.js';

const makeItems = (count) => Array.from({ length: count }, (_, index) => ({
  id: `item-${index}`,
  name: `Компонент ${index + 1}`,
  kind: 'component',
  viewBox: { x: 0, y: 0, width: 100, height: 150 },
}));

test('creates a focal layout for a short selection and preserves proportions', () => {
  const layout = makeAutoLayout(makeItems(4), 1000, 1000, 0, 100);
  assert.equal(layout.length, 4);
  assert.ok(layout[0].width > layout[1].width);
  for (const item of layout) {
    assert.ok(item.x >= 0 && item.y >= 0);
    assert.ok(item.x + item.width <= 1000);
    assert.ok(item.y + item.height <= 1000);
    assert.ok(Math.abs(item.width / item.height - 100 / 150) < 1e-8);
  }
});

test('does not add more objects than the available layer limit', () => {
  const layout = makeAutoLayout(makeItems(8), 800, 1200, 97, 100);
  assert.equal(layout.length, 3);
});

test('keeps large automatic layouts inside their grid cells on a landscape canvas', () => {
  const canvasWidth = 1200;
  const canvasHeight = 630;
  const layout = makeAutoLayout(makeItems(100), canvasWidth, canvasHeight, 0, 100);
  const columns = Math.max(1, Math.ceil(Math.sqrt(layout.length * canvasWidth / canvasHeight)));
  const rows = Math.max(1, Math.ceil(layout.length / columns));
  const cellWidth = canvasWidth / columns;
  const cellHeight = canvasHeight / rows;

  assert.equal(layout.length, 100);
  for (const item of layout) {
    assert.ok(item.x >= 0 && item.y >= 0);
    assert.ok(item.x + item.width <= canvasWidth);
    assert.ok(item.y + item.height <= canvasHeight);
    assert.ok(item.width <= cellWidth * 0.62 + 1e-8);
    assert.ok(item.height <= cellHeight * 0.62 + 1e-8);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parsePaletteJson, INITIAL_PALETTES } from '../src/utils/palettes.js';

const examplePalette = readFileSync(new URL('../public/palette-example.json', import.meta.url), 'utf8');

test('ships three built-in palettes and uses background1 for the base canvas color role', () => {
  assert.equal(INITIAL_PALETTES.length, 3);
  assert.equal(INITIAL_PALETTES[0].colors.background.background1, '#D7CDF5');
});

test('accepts the example palette and normalizes its HEX colors', () => {
  const palette = parsePaletteJson(examplePalette, INITIAL_PALETTES.map((item) => item.id));
  assert.ok(palette.id);
  assert.equal(palette.colors.objects.object1, palette.colors.objects.object1.toUpperCase());
});

test('rejects a duplicate palette ID', () => {
  const parsed = JSON.parse(examplePalette);
  assert.throws(() => parsePaletteJson(examplePalette, [parsed.id]), /уже существует/);
});

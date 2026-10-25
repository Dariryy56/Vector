import assert from 'node:assert/strict';
import test from 'node:test';
import { findComponentByName, findMetaphorComponents, normalizeSearchText } from '../src/utils/metaphor.js';

const library = [
  'Книга', 'Ручка', 'Папка', 'Наушники', 'Кошелек',
  'Монета', 'Лампа', 'Ваза', 'Телефон', 'Пазлы',
].map((name, index) => ({ id: `item-${index}`, name }));

test('normalizes ё, case, and punctuation', () => {
  assert.equal(normalizeSearchText('  УЧЁБА!!! '), 'учеба');
});

test('maps common education metaphors to existing SVG components', () => {
  const names = findMetaphorComponents('Учёба и подготовка к экзамену', library).map((item) => item.name);
  assert.deepEqual(names, ['Книга', 'Ручка', 'Папка', 'Наушники']);
});

test('combines signals in a title without creating new components', () => {
  const names = findMetaphorComponents('Семейный бюджет', library).map((item) => item.name);
  assert.ok(names.includes('Кошелек'));
  assert.ok(names.includes('Монета'));
  assert.ok(names.every((name) => library.some((item) => item.name === name)));
});

test('recognizes inflected component names', () => {
  assert.equal(findComponentByName('карандашом', library)?.name, 'Ручка');
  assert.equal(findComponentByName('кошельке', library)?.name, 'Кошелек');
  assert.equal(findComponentByName('папкой', library)?.name, 'Папка');
});

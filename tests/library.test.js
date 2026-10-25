import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeEscapedUnicodePath } from '../src/utils/library.js';

test('decodes Unicode-escaped ZIP paths before classifying SVG variants', () => {
  const sourcePath = 'L #U043e#U0441#U043d#U043e#U0432#U0430/Книга.svg';

  assert.equal(decodeEscapedUnicodePath(sourcePath), 'L основа/Книга.svg');
});

test('leaves ordinary Unicode asset paths unchanged', () => {
  const sourcePath = 'S фон/Книга.svg';

  assert.equal(decodeEscapedUnicodePath(sourcePath), sourcePath);
});

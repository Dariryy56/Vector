import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSvgDocument, namespaceSvgIds, safeFilename } from '../src/utils/svg.js';

test('exported SVG includes the composition title and XML-escapes it', () => {
  const svg = buildSvgDocument([], [], 1000, 1000, '#ffffff', 'Учёба & планы <2026>');
  assert.match(svg, /<title>Учёба &amp; планы &lt;2026&gt;<\/title>/);
});

test('composition names are converted to safe SVG filenames', () => {
  assert.equal(`${safeFilename('Моя композиция №1')}.svg`, 'моя-композиция-1.svg');
  assert.equal(`${safeFilename('   ')}.svg`, 'svg-composition.svg');
});

test('namespaces SVG definitions and references without corrupting color literals', () => {
  const source = '<defs><clipPath id="fff"><path d="M0 0h1v1z"/></clipPath></defs>'
    + '<path fill="#fff" clip-path="url(#fff)"/>';
  const result = namespaceSvgIds(source, 'layer-1');

  assert.match(result, /id="layer-1-fff"/);
  assert.match(result, /clip-path="url\(#layer-1-fff\)"/);
  assert.match(result, /fill="#fff"/);
});

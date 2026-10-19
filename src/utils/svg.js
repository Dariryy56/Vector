const SVG_NS = 'http://www.w3.org/2000/svg';
const SHARED_TAGS = new Set([
  'defs', 'style', 'title', 'desc', 'metadata', 'lineargradient',
  'radialgradient', 'clippath', 'mask', 'filter', 'pattern', 'marker', 'symbol',
]);
const DRAWABLE_TAGS = new Set([
  'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'use', 'image',
]);
const ROOT_ATTRS_TO_SKIP = new Set([
  'xmlns', 'xmlns:xlink', 'width', 'height', 'viewbox', 'version',
  'x', 'y', 'preserveaspectratio',
]);

export function makeId(prefix = 'item') {
  const value = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${value}`;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function sanitizeDocument(source) {
  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;

  if (root.localName !== 'svg' || document.querySelector('parsererror')) {
    throw new Error('Файл не похож на корректный SVG.');
  }

  root.querySelectorAll('script, foreignObject, iframe, object, embed, audio, video')
    .forEach((node) => node.remove());
  root.querySelectorAll('style').forEach((node) => {
    const safeCss = (node.textContent || '')
      .replace(/@import[^;]*;?/gi, '')
      .replace(/url\(\s*["']?(?:https?:|\/\/|javascript:)[^)]*\)/gi, 'none');
    node.textContent = safeCss;
  });

  [root, ...root.querySelectorAll('*')].forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const hasExternalUrl = /url\(\s*["']?(?:https?:|\/\/|javascript:)/i.test(value);
      const unsafeLink = (name === 'href' || name === 'xlink:href')
        && value !== '' && !value.startsWith('#');

      if (name.startsWith('on') || unsafeLink || hasExternalUrl) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return root;
}

function readViewBox(root) {
  const values = (root.getAttribute('viewBox') || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (values.length === 4 && values.every(Number.isFinite)
    && values[2] > 0 && values[3] > 0) {
    return { x: values[0], y: values[1], width: values[2], height: values[3] };
  }

  const width = Number.parseFloat(root.getAttribute('width')) || 500;
  const height = Number.parseFloat(root.getAttribute('height')) || 500;
  return { x: 0, y: 0, width, height };
}

function rootPresentationAttributes(root) {
  return [...root.attributes]
    .filter((attribute) => !ROOT_ATTRS_TO_SKIP.has(attribute.name.toLowerCase()))
    .filter((attribute) => !attribute.name.toLowerCase().startsWith('xmlns:'))
    .filter((attribute) => !attribute.name.toLowerCase().startsWith('on'))
    .map((attribute) => `${attribute.name}="${escapeAttribute(attribute.value)}"`)
    .join(' ');
}

function isSharedNode(node) {
  return SHARED_TAGS.has(node.localName.toLowerCase());
}

function wrapRootContent(root, content) {
  const attributes = rootPresentationAttributes(root);
  return `<g${attributes ? ` ${attributes}` : ''}>${content}</g>`;
}

function childrenToMarkup(nodes) {
  return nodes.map((node) => node.outerHTML).join('');
}

export function parseArtwork(source, name = 'SVG-иллюстрация') {
  const root = sanitizeDocument(source);
  const viewBox = readViewBox(root);
  const children = [...root.children];
  const sharedNodes = children.filter(isSharedNode);
  const artworkNodes = children.filter((node) => !isSharedNode(node));
  const sharedMarkup = childrenToMarkup(sharedNodes);
  const artworkMarkup = wrapRootContent(root, childrenToMarkup(artworkNodes));

  return {
    id: makeId('artwork'),
    name,
    sourceName: name,
    content: `${sharedMarkup}${artworkMarkup}`,
    viewBox,
    source: root.outerHTML,
    kind: 'illustration',
  };
}

function stripExtractionMarkers(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  node.removeAttribute('data-extract-id');
  [...node.children].forEach(stripExtractionMarkers);
}

function cloneWithAncestors(node, root) {
  let branch = node.cloneNode(true);
  stripExtractionMarkers(branch);
  let parent = node.parentElement;

  while (parent && parent !== root) {
    const wrapper = parent.cloneNode(false);
    wrapper.appendChild(branch);
    branch = wrapper;
    parent = parent.parentElement;
  }

  return branch.outerHTML;
}

function candidateName(node, index) {
  const label = node.getAttribute('aria-label')
    || node.getAttribute('data-name')
    || node.getAttribute('inkscape:label')
    || node.getAttribute('id');

  if (label) return label.replaceAll(/[-_]+/g, ' ').trim();
  const type = node.localName.toLowerCase() === 'g' ? 'Группа' : 'Контур';
  return `${type} ${index + 1}`;
}

function getCandidateNodes(root) {
  const nodes = [...root.querySelectorAll('*')]
    .filter((node) => DRAWABLE_TAGS.has(node.localName.toLowerCase()))
    .filter((node) => !node.closest('defs, clipPath, mask, pattern, marker, symbol'))
    .filter((node) => node.localName.toLowerCase() !== 'g'
      || node.querySelector('path, rect, circle, ellipse, line, polyline, polygon, text, use, image'));

  return nodes.slice(0, 150);
}

export function analyzeSvgForExtraction(source) {
  const root = sanitizeDocument(source);
  const viewBox = readViewBox(root);
  const children = [...root.children];
  const sharedNodes = children.filter(isSharedNode);
  const artworkNodes = children.filter((node) => !isSharedNode(node));
  const sharedMarkup = childrenToMarkup(sharedNodes);
  const attributes = rootPresentationAttributes(root);
  const attrPrefix = attributes ? ` ${attributes}` : '';
  const sharedContent = sharedMarkup;
  const candidates = getCandidateNodes(root);

  candidates.forEach((node, index) => node.setAttribute('data-extract-id', String(index)));

  const measureContent = `${sharedContent}<g${attrPrefix}>${childrenToMarkup(artworkNodes)}</g>`;
  const previewContent = `${sharedContent}<g${attrPrefix}>${childrenToMarkup(artworkNodes)}</g>`;
  const elements = candidates.map((node, index) => {
    const ancestorMarkup = cloneWithAncestors(node, root);
    const kind = node.localName.toLowerCase() === 'g' ? 'Группа' : 'Объект';
    return {
      id: String(index),
      name: candidateName(node, index),
      tag: node.localName.toLowerCase(),
      kind,
      content: `${sharedContent}<g${attrPrefix}>${ancestorMarkup}</g>`,
      viewBox: { ...viewBox },
    };
  });

  return { viewBox, previewContent, measureContent, elements };
}

export function buildSvgDocument(objects, library, width = 1920, height = 1048) {
  const itemById = new Map(library.map((item) => [item.id, item]));
  const body = objects.map((object) => {
    const item = itemById.get(object.libraryId);
    if (!item) return '';
    const box = item.viewBox;
    const centerX = object.width / 2;
    const centerY = object.height / 2;
    const content = item.content.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    return `\n  <g transform="translate(${object.x} ${object.y}) rotate(${object.rotation} ${centerX} ${centerY})">\n    <svg x="0" y="0" width="${object.width}" height="${object.height}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" preserveAspectRatio="xMidYMid meet">${content}</svg>\n  </g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <rect width="${width}" height="${height}" fill="#ffffff"/>${body}\n</svg>`;
}

export function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(value) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-zа-яё0-9_-]+/gi, '-')
    .replaceAll(/^-+|-+$/g, '') || 'svg-composition';
}


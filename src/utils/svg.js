const SVG_NS = 'http://www.w3.org/2000/svg';
const SHARED_TAGS = new Set([
  'defs', 'style', 'title', 'desc', 'metadata', 'lineargradient',
  'radialgradient', 'clippath', 'mask', 'filter', 'pattern', 'marker', 'symbol',
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

function sanitizeCssUrls(value) {
  return String(value).replace(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi,
    (match, doubleQuoted, singleQuoted, unquoted) => {
      const target = String(doubleQuoted ?? singleQuoted ?? unquoted ?? '').trim();
      // SVG components are self-contained: preserve local references, but never
      // allow an imported asset to fetch data, files, or remote resources.
      return /^#[^\s"'()]+$/.test(target) ? match : 'none';
    },
  );
}

function sanitizeCss(value) {
  return sanitizeCssUrls(String(value)
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, 'none')
    .replace(/(?:^|[;{])\s*(?:behavior|-moz-binding)\s*:[^;}]*;?/gi, ''));
}

function sanitizeDocument(source) {
  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;

  if (root.localName?.toLowerCase() !== 'svg' || document.querySelector('parsererror')) {
    throw new Error('Файл не похож на корректный SVG.');
  }

  const unsafeElements = new Set([
    'script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video',
    'animate', 'animatemotion', 'animatetransform', 'set',
  ]);
  [...root.querySelectorAll('*')].forEach((node) => {
    if (unsafeElements.has(node.localName.toLowerCase())) node.remove();
  });

  [root, ...root.querySelectorAll('*')].forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const isLink = name === 'href' || name === 'xlink:href';
      const unsafeLink = isLink && value !== '' && !/^#[^\s]+$/.test(value);

      if (name.startsWith('on') || unsafeLink) {
        node.removeAttribute(attribute.name);
      } else if (name === 'style' || /url\s*\(/i.test(value)) {
        const safeValue = sanitizeCss(value);
        if (safeValue !== attribute.value) node.setAttribute(attribute.name, safeValue);
      }
    });
    if (node.localName.toLowerCase() === 'style') {
      node.textContent = sanitizeCss(node.textContent || '');
    }
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

  const parsedWidth = Number.parseFloat(root.getAttribute('width'));
  const parsedHeight = Number.parseFloat(root.getAttribute('height'));
  const width = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 500;
  const height = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 500;
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
    kind: 'illustration',
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Gives embedded SVG definitions per-instance IDs so repeated components keep their own masks and clip paths. */
export function namespaceSvgIds(markup, prefix = 'svg-instance') {
  if (!markup) return markup;
  const safePrefix = String(prefix).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'svg-instance';
  const foundIds = [...markup.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2]);
  if (!foundIds.length) return markup;
  let output = markup;
  const idMappings = [...new Set(foundIds)].map((id) => ({
    id,
    escapedId: escapeRegExp(id),
    nextId: `${safePrefix}-${id.replace(/[^A-Za-z0-9_-]+/g, '-')}`,
  }));

  // Rewrite explicit SVG references first. This lets the later broad pass
  // handle CSS ID selectors without accidentally changing color literals.
  idMappings.forEach(({ escapedId, nextId }) => {
    output = output
      .replace(new RegExp(`(\\bid\\s*=\\s*["'])${escapedId}(["'])`, 'g'), `$1${nextId}$2`)
      .replace(new RegExp(`url\\(\\s*(["']?)#${escapedId}\\1\\s*\\)`, 'g'), `url(#${nextId})`)
      .replace(new RegExp(`((?:xlink:)?href\\s*=\\s*["'])#${escapedId}(["'])`, 'g'), `$1#${nextId}$2`);
  });

  // Do not treat a CSS color literal (for example, fill="#fff") as a reference
  // to an element whose ID happens to be "fff".
  const colorTokens = [];
  output = output.replace(/(?<![\w-])#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi, (color) => {
    const token = `__SVG_COLOR_LITERAL_${colorTokens.length}__`;
    colorTokens.push([token, color]);
    return token;
  });

  idMappings.forEach(({ escapedId, nextId }) => {
    output = output.replace(new RegExp(`#${escapedId}(?![A-Za-z0-9_-])`, 'g'), `#${nextId}`);
  });
  return colorTokens.reduce((result, [token, color]) => result.replaceAll(token, color), output);
}

export function buildSvgDocument(objects, library, width = 1000, height = 1000, canvasBackgroundColor = '#FFFFFF', documentTitle = 'SVG-композиция') {
  const itemById = new Map(library.map((item) => [item.id, item]));
  const body = objects.map((object, index) => {
    const item = object.resolvedItem || itemById.get(object.libraryId);
    if (!item) return '';
    const box = item.viewBox;
    const centerX = object.width / 2;
    const centerY = object.height / 2;
    const content = namespaceSvgIds((item.content || '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ''), object.id || `layer-${index + 1}`);
    const componentId = escapeAttribute(object.libraryId || 'component');
    const role = escapeAttribute(object.role || item.role || 'main');
    const sourceName = escapeAttribute(item.sourceName || item.name || 'SVG-компонент');
    const locked = object.locked ? 'true' : 'false';
    return `\n  <g id="layer-${index + 1}" data-component-id="${componentId}" data-component-name="${sourceName}" data-role="${role}" data-locked="${locked}" transform="translate(${object.x} ${object.y}) rotate(${object.rotation} ${centerX} ${centerY})">\n    <svg x="0" y="0" width="${object.width}" height="${object.height}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" preserveAspectRatio="xMidYMid meet">${content}</svg>\n  </g>`;
  }).join('');

  const safeBackgroundColor = /^#[0-9a-f]{6}$/i.test(canvasBackgroundColor) ? canvasBackgroundColor : '#FFFFFF';
  const safeTitle = String(documentTitle || 'SVG-композиция')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <title>${safeTitle}</title>\n  <rect id="canvas-background-color" data-canvas-background="true" width="${width}" height="${height}" fill="${safeBackgroundColor}"/>${body}\n</svg>`;
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


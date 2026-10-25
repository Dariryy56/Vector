import { parseArtwork } from './svg.js';
import { recolorSvgContent } from './palettes.js';

const PALETTE_FOLDER_MARKER = 'палитры';
const SIZE_ROLE_FOLDER = /^(L|S)\s+(основа|фон)$/i;
const CANVAS_BACKGROUND_FILE = /^Фон\s+(линии|стол)\s+(верт|гориз|квадрат)$/i;
const FORMAT_BY_LABEL = { квадрат: 'square', верт: 'portrait', гориз: 'landscape' };
const BACKGROUND_KIND_LABEL = { линии: 'lines', стол: 'table' };

// Palette changes and L/S switches must not re-parse the same large SVG strings.
// Cache only rendered color content; original SVG sources remain untouched.
const recoloredContentCache = new Map();
const MAX_RECOLORED_CACHE_ENTRIES = 320;

function fileBase(filename) {
  return filename.replace(/\.svg$/i, '');
}

/** Decode paths escaped by some Windows ZIP tools (for example, #U043e -> о). */
export function decodeEscapedUnicodePath(value) {
  return String(value).replace(/#U([0-9a-f]{4})/gi, (_, codePoint) =>
    String.fromCharCode(Number.parseInt(codePoint, 16)));
}

function safeKey(value) {
  return value.toLocaleLowerCase('ru').replaceAll(/[^a-zа-яё0-9]+/gi, '-').replaceAll(/^-+|-+$/g, '');
}

function parsedItem(source, name, path) {
  return {
    ...parseArtwork(source, name),
    sourceName: name.endsWith('.svg') ? name : `${name}.svg`,
    sourcePath: path,
  };
}

function chooseBaseVariant(variants) {
  return variants?.L?.main
    || variants?.S?.main
    || variants?.L?.background
    || variants?.S?.background
    || null;
}

export function loadBuiltInLibrary(files) {
  const componentGroups = new Map();
  const backgroundGroups = new Map();
  const standalone = [];

  Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .forEach(([path, source]) => {
      const normalizedPath = path.replaceAll('\\', '/');
      const rawRelativePath = normalizedPath.split('illustrations/').at(-1) || normalizedPath;
      const relativePath = decodeEscapedUnicodePath(rawRelativePath);
      const segments = relativePath.split('/');
      const filename = segments.at(-1) || relativePath;
      const folder = segments.length > 1 ? segments.at(-2) : '';
      const name = fileBase(filename);

      if (relativePath.toLocaleLowerCase('ru').includes(PALETTE_FOLDER_MARKER)) return;

      const descriptor = folder.match(SIZE_ROLE_FOLDER);
      if (descriptor) {
        const size = descriptor[1].toUpperCase();
        const role = descriptor[2].toLocaleLowerCase('ru') === 'основа' ? 'main' : 'background';
        const groupId = `builtin:component:${safeKey(name)}`;
        let group = componentGroups.get(groupId);
        if (!group) {
          group = {
            id: groupId,
            name,
            sourceName: filename,
            sourcePath: relativePath,
            builtin: true,
            kind: 'component',
            variants: { L: {}, S: {} },
          };
          componentGroups.set(groupId, group);
        }
        try {
          group.variants[size][role] = parsedItem(source, filename, relativePath);
        } catch (error) {
          console.warn(`Не удалось загрузить SVG «${relativePath}»:`, error);
        }
        return;
      }

      const backgroundMatch = name.match(CANVAS_BACKGROUND_FILE);
      if (folder.toLocaleLowerCase('ru') === 'фон' && backgroundMatch) {
        const groupType = BACKGROUND_KIND_LABEL[backgroundMatch[1].toLocaleLowerCase('ru')];
        const canvasFormat = FORMAT_BY_LABEL[backgroundMatch[2].toLocaleLowerCase('ru')];
        const groupId = `builtin:canvas-background:${groupType}`;
        let group = backgroundGroups.get(groupId);
        if (!group) {
          group = {
            id: groupId,
            name: groupType === 'lines' ? 'Фон — линии' : 'Фон — стол',
            sourceName: filename,
            builtin: true,
            kind: 'canvas-background',
            preferredRole: 'background',
            canvasFormats: {},
          };
          backgroundGroups.set(groupId, group);
        }
        try {
          group.canvasFormats[canvasFormat] = parsedItem(source, filename, relativePath);
        } catch (error) {
          console.warn(`Не удалось загрузить SVG-фон «${relativePath}»:`, error);
        }
        return;
      }

      // Any additional SVG under a folder, or directly in illustrations/, remains discoverable.
      // Unrecognized folders do not crash the library; only known folder conventions bind L/S roles.
      try {
        const item = parsedItem(source, filename, relativePath);
        standalone.push({
          ...item,
          id: `builtin:standalone:${safeKey(relativePath)}`,
          name,
          builtin: true,
          kind: 'component',
          preferredRole: folder.toLocaleLowerCase('ru') === 'фон' ? 'background' : 'main',
          sourcePath: relativePath,
        });
      } catch (error) {
        console.warn(`Не удалось загрузить SVG «${relativePath}»:`, error);
      }
    });

  const components = [...componentGroups.values()].map((group) => {
    const base = chooseBaseVariant(group.variants);
    return base ? { ...base, ...group, content: base.content, viewBox: base.viewBox } : null;
  }).filter(Boolean);

  const canvasBackgrounds = [...backgroundGroups.values()].map((group) => {
    const base = group.canvasFormats.square || group.canvasFormats.landscape || group.canvasFormats.portrait;
    return base ? { ...base, ...group, content: base.content, viewBox: base.viewBox } : null;
  }).filter(Boolean);

  return [...components, ...standalone, ...canvasBackgrounds].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function hasRoleVariant(item, size, role) {
  if (!item || item.kind === 'canvas-background') return false;
  const normalizedSize = String(size || 'L').toUpperCase() === 'S' ? 'S' : 'L';
  const otherSize = normalizedSize === 'L' ? 'S' : 'L';
  const normalizedRole = role === 'background' || role === 'фон' ? 'background' : 'main';
  const hasUsableContent = (variant) => Boolean(variant && typeof variant.content === 'string' && variant.content.length > 0);
  // A prepared counterpart in either folder is a real variant, not a generated fallback.
  // This avoids disabling role switching just because the other-size folder is being used.
  return hasUsableContent(item.variants?.[normalizedSize]?.[normalizedRole])
    || hasUsableContent(item.variants?.[otherSize]?.[normalizedRole]);
}

function resolveVariant(item, size, role, canvasFormat) {
  if (item.kind === 'canvas-background' && item.canvasFormats) {
    return item.canvasFormats[canvasFormat]
      || item.canvasFormats.square
      || item.canvasFormats.landscape
      || item.canvasFormats.portrait
      || item;
  }
  if (!item.variants) return item;

  const normalizedSize = String(size || 'L').toUpperCase() === 'S' ? 'S' : 'L';
  const otherSize = normalizedSize === 'L' ? 'S' : 'L';
  const normalizedRole = role === 'background' || role === 'фон' ? 'background' : 'main';

  // Prefer the exact size+role. If it is absent, use the real opposite-size
  // variant with the same role before considering any generic base fallback.
  // Never silently substitute an S main object for an L/S background object.
  return item.variants?.[normalizedSize]?.[normalizedRole]
    || item.variants?.[otherSize]?.[normalizedRole]
    || chooseBaseVariant(item.variants)
    || item;
}

function resolveContent(item, variant, size, role, palette) {
  if (!palette) return variant.content;
  const sourceKey = variant.sourcePath || variant.sourceName || variant.id || item.id;
  // IDs can be reused after a custom palette is deleted. Include its colors so
  // importing a different palette with the same ID cannot reuse stale SVG data.
  const paletteKey = `${palette.id || palette.name || 'palette'}:${JSON.stringify(palette.colors || {})}`;
  const cacheKey = `${item.id}|${sourceKey}|${size}|${role}|${paletteKey}`;
  if (recoloredContentCache.has(cacheKey)) return recoloredContentCache.get(cacheKey);

  const content = recolorSvgContent(variant.content, palette, role);
  if (recoloredContentCache.size >= MAX_RECOLORED_CACHE_ENTRIES) recoloredContentCache.clear();
  recoloredContentCache.set(cacheKey, content);
  return content;
}

export function resolveLibraryItem(item, size, role, palette, canvasFormat = 'square') {
  if (!item) return null;
  const variant = resolveVariant(item, size, role, canvasFormat);
  const resolvedRole = item.kind === 'canvas-background' ? 'background' : (role === 'background' ? 'background' : 'main');
  return {
    ...item,
    ...variant,
    id: item.id,
    name: item.name,
    sourceName: variant.sourceName || item.sourceName,
    sourcePath: variant.sourcePath || item.sourcePath,
    kind: item.kind,
    builtin: item.builtin,
    variants: item.variants,
    canvasFormats: item.canvasFormats,
    role: resolvedRole,
    content: resolveContent(item, variant, size, resolvedRole, palette),
    viewBox: variant.viewBox || item.viewBox,
  };
}

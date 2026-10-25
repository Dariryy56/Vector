const ROLE_KEYS = {
  objects: ['object1', 'object2', 'object3', 'object4'],
  background: ['background1', 'background2', 'background3', 'background4'],
};

export const INITIAL_PALETTES = [
  {
    id: 'palette-violet',
    name: 'Фиолетовая',
    version: 1,
    colors: {
      objects: { object1: '#F9ECB0', object2: '#F9A3AA', object3: '#FFE3E1', object4: '#FFFFFF' },
      background: { background1: '#D7CDF5', background2: '#AA9BF0', background3: '#7864D7', background4: '#181817' },
    },
  },
  {
    id: 'palette-peach',
    name: 'Персиковая',
    version: 1,
    colors: {
      objects: { object1: '#F9ECB0', object2: '#80DADA', object3: '#BEEBEB', object4: '#FFFFFF' },
      background: { background1: '#FDD7B9', background2: '#FAC896', background3: '#D27532', background4: '#181817' },
    },
  },
  {
    id: 'palette-turquoise',
    name: 'Бирюзовая',
    version: 1,
    colors: {
      objects: { object1: '#FFD4F2', object2: '#B6C6FE', object3: '#6D7BFC', object4: '#FFFFFF' },
      background: { background1: '#BEEBEB', background2: '#80DADA', background3: '#5ABEBE', background4: '#181817' },
    },
  },
];

const HEX_COLOR = /^#(?:[0-9a-f]{6})$/i;

export function validatePaletteData(value, existingIds = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Файл палитры должен содержать JSON-объект.');
  }
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!id || id.length > 100 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) {
    throw new Error('Укажи id палитры: латинские буквы, цифры, точка, дефис или подчёркивание.');
  }
  if (existingIds.includes(id)) {
    throw new Error(`Палитра с id «${id}» уже существует. Измени id в JSON-файле.`);
  }
  if (!name || name.length > 80) {
    throw new Error('Поле name обязательно и должно содержать от 1 до 80 символов.');
  }
  if (value.version !== 1) {
    throw new Error('Поддерживается только version: 1.');
  }
  if (!value.colors || typeof value.colors !== 'object') {
    throw new Error('В JSON отсутствует объект colors.');
  }

  const normalizedColors = {};
  for (const group of Object.keys(ROLE_KEYS)) {
    const sourceGroup = value.colors[group];
    if (!sourceGroup || typeof sourceGroup !== 'object' || Array.isArray(sourceGroup)) {
      throw new Error(`В colors отсутствует группа «${group}».`);
    }
    const extraRoles = Object.keys(sourceGroup).filter((role) => !ROLE_KEYS[group].includes(role));
    if (extraRoles.length) {
      throw new Error(`В группе ${group} не должно быть дополнительных цветовых ролей: ${extraRoles.join(', ')}.`);
    }
    normalizedColors[group] = {};
    for (const role of ROLE_KEYS[group]) {
      const color = typeof sourceGroup[role] === 'string' ? sourceGroup[role].trim() : '';
      if (!HEX_COLOR.test(color)) {
        throw new Error(`Цветовая роль ${group}.${role} должна быть HEX-кодом вида #A1B2C3.`);
      }
      normalizedColors[group][role] = color.toUpperCase();
    }
  }

  return { id, name, version: 1, colors: normalizedColors };
}

export function parsePaletteJson(text, existingIds = []) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Не удалось прочитать JSON. Проверь запятые, кавычки и фигурные скобки.');
  }
  return validatePaletteData(parsed, existingIds);
}

const SOURCE_ROLE_MAP = {
  '#F9ECB0': ['objects', 'object1'],
  '#F9A3AA': ['objects', 'object2'],
  '#FFE3E1': ['objects', 'object3'],
  '#FFFFFF': ['objects', 'object4'],
  '#D7CDF5': ['background', 'background1'],
  '#AA9BF0': ['background', 'background2'],
  '#7864D7': ['background', 'background3'],
  '#181817': ['background', 'background4'],
};

function normalizeColor(color) {
  const value = String(color || '').trim().toUpperCase();
  if (value === 'WHITE') return '#FFFFFF';
  if (value === 'BLACK') return '#000000';
  return value;
}

function roleColor(palette, sourceColor, objectRole) {
  const mapped = SOURCE_ROLE_MAP[sourceColor];
  if (!mapped) return null;
  const [group, role] = mapped;
  if (objectRole === 'background' && group === 'objects') {
    if (role === 'object4') return '#FFFFFF';
    return palette.colors.background.background4;
  }
  return palette.colors[group][role];
}

function replaceCssColors(css, palette, objectRole) {
  const colorPattern = /#[0-9a-f]{6}\b|\bwhite\b|\bblack\b/gi;
  // A hex-looking fragment inside url(#id) is an SVG reference, not a color.
  return String(css)
    .split(/(url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\))/gi)
    .map((part) => {
      if (/^url\(/i.test(part.trim())) return part;
      return part.replace(colorPattern, (match) => {
        const normalized = normalizeColor(match);
        return roleColor(palette, normalized, objectRole) || match;
      });
    })
    .join('');
}

/** Recolors only the known source-library color roles; geometry and SVG structure remain unchanged. */
export function recolorSvgContent(content, palette, objectRole = 'main') {
  if (!content || !palette || typeof DOMParser === 'undefined') return content;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return content;
    const root = doc.documentElement;

    [root, ...root.querySelectorAll('*')].forEach((node) => {
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase();
        if (['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color'].includes(name)) {
          const original = normalizeColor(attribute.value);
          const nextColor = roleColor(palette, original, objectRole);
          if (nextColor) node.setAttribute(attribute.name, nextColor);
        } else if (name === 'style') {
          node.setAttribute(attribute.name, replaceCssColors(attribute.value, palette, objectRole));
        }
      }
      if (node.localName?.toLowerCase() === 'style') {
        node.textContent = replaceCssColors(node.textContent || '', palette, objectRole);
      }
    });
    return [...root.childNodes].map((node) => node.outerHTML ?? node.textContent ?? '').join('');
  } catch (error) {
    console.warn('Не удалось применить палитру к SVG-компоненту:', error);
    return content;
  }
}


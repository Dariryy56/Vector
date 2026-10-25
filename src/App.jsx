import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from './components/Canvas.jsx';
import { Icon } from './components/Icon.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { buildSvgDocument, downloadText, makeId, parseArtwork, safeFilename } from './utils/svg.js';
import { INITIAL_PALETTES, parsePaletteJson } from './utils/palettes.js';
import { hasRoleVariant, loadBuiltInLibrary, resolveLibraryItem } from './utils/library.js';
import { makeAutoLayout, makeCanvasObject } from './utils/composition.js';
import { findComponentByName, findMetaphorComponents } from './utils/metaphor.js';
import './App.css';

const OBJECT_LIMIT = 100;
const LIBRARY_KEY = 'vector-studio.custom-library.v1';
const PALETTES_KEY = 'vector-studio.custom-palettes.v1';
const ACTIVE_PALETTE_KEY = 'vector-studio.active-palette.v1';
const COMPOSITION_NAME_KEY = 'vector-studio.composition-name.v1';
const CANVAS_FORMATS = {
  square: { label: 'Квадратный', width: 1000, height: 1000, icon: 'square' },
  portrait: { label: 'Вертикальный', width: 800, height: 1200, icon: 'rectangle-vertical' },
  landscape: { label: 'Горизонтальный', width: 1200, height: 630, icon: 'rectangle-horizontal' },
};

const CANVAS_BACKGROUND_OPTIONS = [
  { id: 'plain', label: 'Цвет палитры' },
  { id: 'lines', label: 'Линии' },
  { id: 'table', label: 'Рабочий стол' },
];

const illustrationFiles = import.meta.glob('./assets/illustrations/**/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const builtInLibrary = loadBuiltInLibrary(illustrationFiles);

function CanvasBackgroundPreview({ mode, item, palette, canvasFormat }) {
  const resolved = useMemo(() => {
    if (!item) return null;
    return resolveLibraryItem(item, 'L', 'background', palette, canvasFormat);
  }, [item, palette, canvasFormat]);

  if (mode === 'plain') {
    return (
      <span className="canvas-background-preview canvas-background-preview-plain" style={{ backgroundColor: palette?.colors?.background?.background1 || '#D7CDF5' }}>
        <span className="canvas-background-preview-dot" />
      </span>
    );
  }

  if (!resolved?.viewBox) {
    return <span className={`canvas-background-preview canvas-background-preview-${mode} is-missing`} aria-hidden="true" />;
  }

  const box = resolved.viewBox;
  return (
    <span className={`canvas-background-preview canvas-background-preview-${mode}`}>
      <svg viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: resolved.content }} />
    </span>
  );
}

function readCustomLibrary() {
  try {
    const saved = localStorage.getItem(LIBRARY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.content && item?.viewBox) : [];
  } catch {
    return [];
  }
}

function readCustomPalettes() {
  try {
    const saved = localStorage.getItem(PALETTES_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    const ids = new Set(INITIAL_PALETTES.map((palette) => palette.id));
    return parsed.filter((palette) => {
      if (!palette?.id || ids.has(palette.id)) return false;
      try {
        parsePaletteJson(JSON.stringify(palette), [...ids]);
        ids.add(palette.id);
        return true;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function readActivePaletteId() {
  try {
    return localStorage.getItem(ACTIVE_PALETTE_KEY) || INITIAL_PALETTES[0].id;
  } catch {
    return INITIAL_PALETTES[0].id;
  }
}

function readCompositionName() {
  try {
    return localStorage.getItem(COMPOSITION_NAME_KEY) || 'Новая композиция';
  } catch {
    return 'Новая композиция';
  }
}


function safeItemName(item) {
  return item.name?.trim() || item.sourceName?.trim() || 'SVG-компонент';
}


export default function App() {
  const [customLibrary, setCustomLibrary] = useState(readCustomLibrary);
  const library = useMemo(() => [...builtInLibrary, ...customLibrary], [customLibrary]);
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('elements');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedCustomIds, setSelectedCustomIds] = useState(() => new Set());
  const [libraryDeleteDialog, setLibraryDeleteDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [illustrationSize, setIllustrationSize] = useState('L');
  const [canvasFormat, setCanvasFormat] = useState('square');
  const [canvasBackground, setCanvasBackground] = useState('plain');
  const [compositionName, setCompositionName] = useState(readCompositionName);
  const [customPalettes, setCustomPalettes] = useState(readCustomPalettes);
  const [activePaletteId, setActivePaletteId] = useState(readActivePaletteId);
  const [paletteDeleteDialog, setPaletteDeleteDialog] = useState(null);
  const importInputRef = useRef(null);
  const paletteInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const selectedObject = objects.find((object) => object.id === selectedId);
  const canvasWidth = CANVAS_FORMATS[canvasFormat].width;
  const canvasHeight = CANVAS_FORMATS[canvasFormat].height;
  const palettes = useMemo(() => [...INITIAL_PALETTES, ...customPalettes], [customPalettes]);
  const activePalette = palettes.find((palette) => palette.id === activePaletteId) || INITIAL_PALETTES[0];
  const itemById = useMemo(() => new Map(library.map((item) => [item.id, item])), [library]);
  const displayLibrary = useMemo(() => library.map((item) => resolveLibraryItem(
    item, illustrationSize, 'main', activePalette, canvasFormat,
  )), [library, illustrationSize, activePalette, canvasFormat]);
  const canvasBackgroundItems = useMemo(() => ({
    lines: itemById.get('builtin:canvas-background:lines') || null,
    table: itemById.get('builtin:canvas-background:table') || null,
  }), [itemById]);
  const nextSelectedRole = selectedObject?.role === 'background' ? 'main' : 'background';
  const canToggleSelectedRole = selectedObject
    ? hasRoleVariant(itemById.get(selectedObject.libraryId), illustrationSize, nextSelectedRole)
    : false;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(customLibrary));
    } catch {
      console.warn('Не удалось сохранить библиотеку в localStorage.');
    }
  }, [customLibrary]);

  useEffect(() => {
    try {
      localStorage.setItem(PALETTES_KEY, JSON.stringify(customPalettes));
    } catch (error) {
      console.warn('Не удалось сохранить импортированные палитры в localStorage:', error);
    }
  }, [customPalettes]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_PALETTE_KEY, activePalette.id);
    } catch {
      // Палитра продолжает работать в текущей сессии, даже если localStorage недоступен.
    }
  }, [activePalette.id]);

  useEffect(() => {
    try {
      localStorage.setItem(COMPOSITION_NAME_KEY, compositionName);
    } catch {
      // Название остаётся доступным в текущей сессии, даже если localStorage недоступен.
    }
  }, [compositionName]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const addToCanvas = useCallback((item) => {
    if (objects.length >= OBJECT_LIMIT) {
      showToast(`На холсте может быть не больше ${OBJECT_LIMIT} объектов.`, 'warning');
      return;
    }
    const object = makeCanvasObject(item, objects.length, canvasWidth, canvasHeight);
    if (item.kind === 'canvas-background') {
      setObjects((current) => current.length >= OBJECT_LIMIT ? current : [object, ...current]);
    } else {
      setObjects((current) => current.length >= OBJECT_LIMIT ? current : [...current, object]);
    }
    setSelectedId(object.id);
  }, [objects.length, canvasWidth, canvasHeight, showToast]);

  const updateObject = useCallback((id, updates) => {
    setObjects((current) => current.map((object) => {
      if (object.id !== id) return object;
      const attemptsGeometryChange = ['x', 'y', 'width', 'height', 'rotation'].some((key) => key in updates);
      if (object.locked && attemptsGeometryChange) return object;
      return { ...object, ...updates };
    }));
  }, []);

  const removeObject = useCallback((id) => {
    setObjects((current) => current.filter((object) => object.id !== id));
    setSelectedId((current) => current === id ? null : current);
  }, []);

  const duplicateObject = useCallback((id) => {
    if (objects.length >= OBJECT_LIMIT) {
      showToast(`На холсте может быть не больше ${OBJECT_LIMIT} объектов.`, 'warning');
      return;
    }
    const original = objects.find((object) => object.id === id);
    if (!original) return;
    const duplicate = {
      ...original,
      id: makeId('layer'),
      x: Math.min(Math.max(0, canvasWidth - original.width), original.x + 28),
      y: Math.min(Math.max(0, canvasHeight - original.height), original.y + 28),
    };
    setObjects((current) => current.length >= OBJECT_LIMIT ? current : [...current, duplicate]);
    setSelectedId(duplicate.id);
  }, [objects, canvasWidth, canvasHeight, showToast]);

  const toggleLock = useCallback((id) => {
    setObjects((current) => current.map((object) => object.id === id ? { ...object, locked: !object.locked } : object));
  }, []);

  const toggleObjectRole = useCallback((id) => {
    const object = objects.find((entry) => entry.id === id);
    const item = object ? itemById.get(object.libraryId) : null;
    if (!object || !item) return;
    const nextRole = object.role === 'background' ? 'main' : 'background';
    if (!hasRoleVariant(item, illustrationSize, nextRole)) {
      showToast(`Для «${item.name}» нет подготовленного варианта «${nextRole === 'background' ? 'Фон' : 'Объект'}» размера ${illustrationSize}. Исходник не будет заменён выдуманным SVG.`, 'warning');
      return;
    }
    setObjects((current) => current.map((entry) => entry.id === id ? { ...entry, role: nextRole } : entry));
  }, [objects, itemById, illustrationSize, showToast]);

  const moveLayer = useCallback((id, direction) => {
    setObjects((current) => {
      const index = current.findIndex((object) => object.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }, []);

  const reorderLayers = useCallback((sourceId, targetId) => {
    setObjects((current) => {
      const frontToBack = [...current].reverse();
      const fromIndex = frontToBack.findIndex((object) => object.id === sourceId);
      const toIndex = frontToBack.findIndex((object) => object.id === targetId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const [moved] = frontToBack.splice(fromIndex, 1);
      frontToBack.splice(toIndex, 0, moved);
      return frontToBack.reverse();
    });
  }, []);

  const exportSvg = useCallback(() => {
    const exportObjects = [];
    if (canvasBackground !== 'plain') {
      const backgroundItem = canvasBackgroundItems[canvasBackground];
      const resolvedBackground = resolveLibraryItem(backgroundItem, illustrationSize, 'background', activePalette, canvasFormat);
      if (backgroundItem && resolvedBackground) {
        exportObjects.push({
          id: `canvas-background-${canvasFormat}-${canvasBackground}`,
          libraryId: backgroundItem.id,
          x: 0,
          y: 0,
          width: canvasWidth,
          height: canvasHeight,
          rotation: 0,
          role: 'background',
          locked: true,
          resolvedItem: resolvedBackground,
        });
      }
    }
    exportObjects.push(...objects.map((object) => ({
      ...object,
      resolvedItem: resolveLibraryItem(
        itemById.get(object.libraryId), illustrationSize, object.role || 'main', activePalette, canvasFormat,
      ),
    })));
    const canvasColor = activePalette.colors.background.background1;
    const title = compositionName.trim() || 'Новая композиция';
    const content = buildSvgDocument(exportObjects, [], canvasWidth, canvasHeight, canvasColor, title);
    downloadText(`${safeFilename(title)}.svg`, content, 'image/svg+xml;charset=utf-8');
    showToast(`SVG «${title}» скачан. Название записано в файл, а композиция сохранена как редактируемая векторная графика.`);
  }, [objects, itemById, canvasBackground, canvasBackgroundItems, illustrationSize, activePalette, canvasFormat, canvasWidth, canvasHeight, compositionName, showToast]);

  const changeCanvasFormat = useCallback((nextFormat) => {
    setCanvasFormat(nextFormat);
    const nextDimensions = CANVAS_FORMATS[nextFormat];
    setObjects((current) => current.map((object) => {
      const item = itemById.get(object.libraryId);
      if (item?.kind !== 'canvas-background') return object;
      return { ...object, x: 0, y: 0, width: nextDimensions.width, height: nextDimensions.height, rotation: 0 };
    }));
  }, [itemById]);

  const changeIllustrationSize = useCallback((nextSize) => {
    setIllustrationSize(nextSize);
    const missing = objects.filter((object) => {
      const item = itemById.get(object.libraryId);
      return item?.variants && !item.variants[nextSize]?.[object.role || 'main'];
    });
    if (missing.length) {
      showToast(`Для ${missing.length} размещённых компонент(ов) нет варианта ${nextSize}; существующие исходники сохранены, фиктивные варианты не создавались.`, 'warning');
    }
  }, [objects, itemById, showToast]);

  const runAutoBuild = useCallback((mode, rawText) => {
    const input = rawText.trim();
    if (!input) {
      showToast(mode === 'metaphor' ? 'Введи метафору или заголовок композиции.' : 'Введи названия компонентов через запятую.', 'warning');
      return;
    }
    const candidates = library.filter((item) => item.kind !== 'canvas-background');
    const matched = [];
    const notFound = [];

    if (mode === 'names') {
      const requestedNames = input.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
      requestedNames.forEach((name) => {
        const item = findComponentByName(name, candidates);
        if (item && !matched.some((entry) => entry.id === item.id)) matched.push(item);
        else if (!item) notFound.push(name);
      });
    } else {
      matched.push(...findMetaphorComponents(input, candidates));
    }

    if (!matched.length) {
      showToast(mode === 'metaphor'
        ? 'Не нашлось компонентов по этой метафоре. Попробуй более конкретный заголовок или введи названия предметов.'
        : `Не нашлись компоненты: ${notFound.join(', ')}. Проверь названия в библиотеке.`, 'warning');
      return;
    }

    const availableSlots = OBJECT_LIMIT - objects.length;
    const toPlace = matched.slice(0, availableSlots);
    const placed = makeAutoLayout(toPlace, canvasWidth, canvasHeight, objects.length);
    setObjects((current) => [...current, ...placed]);
    if (placed.length) setSelectedId(placed[placed.length - 1].id);
    setActiveTab('layers');
    const missingText = notFound.length ? ` Не найдены: ${notFound.join(', ')}.` : '';
    const limitText = placed.length < matched.length ? ` На холст добавлено только ${placed.length}: достигнут лимит ${OBJECT_LIMIT}.` : '';
    showToast(`Добавлено на холст: ${placed.length} из ${matched.length} найденных компонент(ов).${missingText}${limitText}`, notFound.length || placed.length < matched.length ? 'warning' : 'success');
  }, [library, objects.length, canvasWidth, canvasHeight, showToast]);

  const importSvgFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const source = await file.text();
      const item = parseArtwork(source, file.name.replace(/\.svg$/i, ''));
      item.sourceName = file.name;
      addWholeArtworkToLibrary(item);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось импортировать SVG.', 'error');
    }
  };

  const importPaletteFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const existingIds = palettes.map((palette) => palette.id);
      const palette = parsePaletteJson(text, existingIds);
      setCustomPalettes((current) => [...current, palette]);
      setActivePaletteId(palette.id);
      showToast(`Палитра «${palette.name}» импортирована и применена.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось импортировать палитру.', 'error');
    }
  };

  const requestDeletePalette = useCallback((palette) => {
    if (!customPalettes.some((entry) => entry.id === palette.id)) return;
    setPaletteDeleteDialog({ id: palette.id, name: palette.name });
  }, [customPalettes]);

  const confirmDeletePalette = useCallback(() => {
    if (!paletteDeleteDialog) return;
    const { id, name } = paletteDeleteDialog;
    setCustomPalettes((current) => current.filter((palette) => palette.id !== id));
    setActivePaletteId((current) => current === id ? INITIAL_PALETTES[0].id : current);
    setPaletteDeleteDialog(null);
    showToast(`Палитра «${name}» удалена. Встроенные палитры сохранены.`);
  }, [paletteDeleteDialog, showToast]);

  const addWholeArtworkToLibrary = (item) => {
    const prepared = {
      ...item,
      id: makeId('imported'),
      name: safeItemName(item),
      builtin: false,
      kind: 'component',
      variants: undefined,
    };
    setCustomLibrary((current) => [...current, prepared]);
    setActiveTab('elements');
    showToast(`«${prepared.name}» добавлена в библиотеку.`);
  };

  const toggleCustomSelection = useCallback((id) => {
    if (!customLibrary.some((item) => item.id === id)) return;
    setSelectedCustomIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [customLibrary]);

  const requestDeleteSelectedCustom = useCallback(() => {
    const ids = [...selectedCustomIds].filter((id) => customLibrary.some((item) => item.id === id));
    if (ids.length) setLibraryDeleteDialog({ mode: 'selected', ids });
  }, [customLibrary, selectedCustomIds]);

  const requestDeleteAllCustom = useCallback(() => {
    if (customLibrary.length) {
      setLibraryDeleteDialog({ mode: 'all', ids: customLibrary.map((item) => item.id) });
    }
  }, [customLibrary]);

  const deleteCustomItems = useCallback((ids) => {
    const deletableIds = new Set(customLibrary.filter((item) => ids.includes(item.id)).map((item) => item.id));
    if (deletableIds.size === 0) {
      setLibraryDeleteDialog(null);
      return;
    }

    const removedLayerIds = new Set(objects
      .filter((object) => deletableIds.has(object.libraryId))
      .map((object) => object.id));

    setCustomLibrary((current) => current.filter((item) => !deletableIds.has(item.id)));
    setObjects((current) => current.filter((object) => !deletableIds.has(object.libraryId)));
    setSelectedId((current) => removedLayerIds.has(current) ? null : current);
    setSelectedCustomIds((current) => new Set([...current].filter((id) => !deletableIds.has(id))));
    setLibraryDeleteDialog(null);
    showToast(`Удалено элементов из библиотеки: ${deletableIds.size}. Встроенные иллюстрации и палитры сохранены.`);
  }, [customLibrary, objects, showToast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
      if (typing) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        if (selectedId) duplicateObject(selectedId);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        exportSvg();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        removeObject(selectedId);
      } else if (event.key === 'Escape') {
        setSelectedId(null);
        setClearDialogOpen(false);
        setLibraryDeleteDialog(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, duplicateObject, exportSvg, removeObject]);

  return (
    <main className="app-shell">
      <div className="app-body">
        <Sidebar
          library={displayLibrary}
          objects={objects}
          selectedId={selectedId}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onAdd={addToCanvas}
          onImport={() => importInputRef.current?.click()}
          onSelect={setSelectedId}
          onDuplicate={duplicateObject}
          onDelete={removeObject}
          onMove={moveLayer}
          onReorder={reorderLayers}
          onToggleLock={toggleLock}
          onToggleRole={toggleObjectRole}
          canToggleRole={(object) => {
            const item = itemById.get(object.libraryId);
            const nextRole = object.role === 'background' ? 'main' : 'background';
            return hasRoleVariant(item, illustrationSize, nextRole);
          }}
          selectedCustomIds={selectedCustomIds}
          onToggleCustomSelection={toggleCustomSelection}
          onDeleteSelectedCustom={requestDeleteSelectedCustom}
          onDeleteAllCustom={requestDeleteAllCustom}
          onCompose={runAutoBuild}
          illustrationSize={illustrationSize}
          palette={activePalette}
          canvasFormat={canvasFormat}
        />

        <Canvas
          library={library}
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateObject={updateObject}
          illustrationSize={illustrationSize}
          canvasFormat={canvasFormat}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          palette={activePalette}
          canvasBackground={canvasBackground}
          onChangeIllustrationSize={changeIllustrationSize}
          compositionName={compositionName}
          onCompositionNameChange={setCompositionName}
        />

        <aside className="action-rail panel-surface" aria-label="Настройки проекта">
          <div className="rail-label">ПРОЕКТ</div>
          <button className="action-button action-save" type="button" onClick={exportSvg} title="Скачать композицию в SVG">
            <span className="action-icon"><Icon name="download" size={18} /></span>
            <span className="action-copy">Сохранить<small>SVG</small></span>
          </button>
          <button className="action-button action-clear" type="button" onClick={() => setClearDialogOpen(true)}>
            <span className="action-icon"><Icon name="trash" size={17} /></span>
            <span className="action-copy">Очистить<small>Холст</small></span>
          </button>
          {selectedObject && (
            <div className="selection-quick-actions">
              <span>ВЫБРАНО</span>
              <button
                type="button"
                className="selection-role-action"
                disabled={!canToggleSelectedRole}
                title={canToggleSelectedRole ? 'Использовать подготовленный SVG-вариант другой роли' : `Для размера ${illustrationSize} нет подготовленного противоположного варианта`}
                onClick={() => toggleObjectRole(selectedObject.id)}
              ><Icon name="layers" size={14} /> {selectedObject.role === 'background' ? 'Сделать объектом' : 'Сделать фоном'}</button>
              <button type="button" onClick={() => duplicateObject(selectedObject.id)}><Icon name="copy" size={14} /> Дублировать</button>
              <button type="button" onClick={() => removeObject(selectedObject.id)}><Icon name="trash" size={14} /> Удалить</button>
            </div>
          )}

          <div className="settings-divider" />

          <section className="settings-section canvas-format-section" aria-labelledby="canvas-format-title">
            <div className="settings-section-heading"><h2 id="canvas-format-title">Формат холста</h2></div>
            <div className="format-choice-list" role="group" aria-label="Формат холста">
              {Object.entries(CANVAS_FORMATS).map(([key, format]) => (
                <button
                  key={key}
                  type="button"
                  className={`format-choice${canvasFormat === key ? ' active' : ''}`}
                  aria-pressed={canvasFormat === key}
                  title={`${format.label}: ${format.width} × ${format.height}`}
                  onClick={() => changeCanvasFormat(key)}
                >
                  <Icon name={format.icon} size={19} />
                </button>
              ))}
            </div>
            <div className="active-format-caption">{CANVAS_FORMATS[canvasFormat].label} · {canvasWidth} × {canvasHeight}</div>
          </section>

          <section className="settings-section canvas-background-section" aria-labelledby="canvas-background-title">
            <div className="settings-section-heading"><h2 id="canvas-background-title">Фон холста</h2></div>
            <div className="canvas-background-options" role="group" aria-label="Фон холста">
              {CANVAS_BACKGROUND_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`canvas-background-choice${canvasBackground === option.id ? ' active' : ''}`}
                  aria-pressed={canvasBackground === option.id}
                  title={`Использовать фон: ${option.label}`}
                  onClick={() => setCanvasBackground(option.id)}
                >
                  <CanvasBackgroundPreview
                    mode={option.id}
                    item={canvasBackgroundItems[option.id]}
                    palette={activePalette}
                    canvasFormat={canvasFormat}
                  />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section palette-section" aria-labelledby="palette-title">
            <div className="settings-section-heading">
              <h2 id="palette-title">Цветовая гамма</h2>
              <button className="icon-button palette-import-button" type="button" onClick={() => paletteInputRef.current?.click()} title="Импортировать JSON-палитру" aria-label="Импортировать JSON-палитру">
                <Icon name="plus" size={16} />
              </button>
            </div>
            <p className="settings-section-note">Импорт палитры из JSON</p>
            <div className="palette-list">
              {palettes.map((palette) => (
                <div
                  className={`palette-option-row${INITIAL_PALETTES.some((builtInPalette) => builtInPalette.id === palette.id) ? '' : ' has-delete'}`}
                  key={palette.id}
                >
                  <button
                    type="button"
                    className={`palette-option${activePalette.id === palette.id ? ' active' : ''}`}
                    aria-pressed={activePalette.id === palette.id}
                    onClick={() => setActivePaletteId(palette.id)}
                    title={`Применить палитру «${palette.name}»`}
                  >
                    <span className="palette-option-name">{palette.name}</span>
                    <span className="palette-color-groups">
                      <span className="palette-color-group">
                        <span className="palette-group-label">Объекты</span>
                        <span className="palette-color-column">
                          {Object.values(palette.colors.objects).map((color, index) => (
                            <span key={`${palette.id}-o-${index}`} className="palette-swatch" style={{ backgroundColor: color }} title={color} />
                          ))}
                        </span>
                      </span>
                      <span className="palette-color-group">
                        <span className="palette-group-label">Фон</span>
                        <span className="palette-color-column">
                          {Object.values(palette.colors.background).map((color, index) => (
                            <span key={`${palette.id}-b-${index}`} className="palette-swatch" style={{ backgroundColor: color }} title={color} />
                          ))}
                        </span>
                      </span>
                    </span>
                  </button>
                  {!INITIAL_PALETTES.some((builtInPalette) => builtInPalette.id === palette.id) && (
                    <button
                      type="button"
                      className="icon-button palette-delete-button"
                      aria-label={`Удалить импортированную палитру «${palette.name}»`}
                      title={`Удалить палитру «${palette.name}»`}
                      onClick={() => requestDeletePalette(palette)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <a className="palette-format-hint" href="/palette-example.json" target="_blank" rel="noreferrer">
              JSON-пример для проверки импорта
            </a>
          </section>
        </aside>
      </div>

      <input ref={importInputRef} className="visually-hidden-input" type="file" accept="image/svg+xml,.svg" onChange={importSvgFile} />
      <input ref={paletteInputRef} className="visually-hidden-input" type="file" accept="application/json,.json" onChange={importPaletteFile} />

      {clearDialogOpen && (
        <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setClearDialogOpen(false); }}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-title">
            <div className="confirm-icon"><Icon name="trash" size={22} /></div>
            <h2 id="clear-title">Очистить холст?</h2>
            <p>Все {objects.length} {objects.length === 1 ? 'объект' : 'объектов'} будут удалены с холста. Элементы библиотеки и импортированные палитры останутся.</p>
            <div className="confirm-actions"><button className="button-secondary" type="button" onClick={() => setClearDialogOpen(false)}>Отмена</button><button className="button-danger" type="button" onClick={() => { setObjects([]); setSelectedId(null); setClearDialogOpen(false); showToast('Холст очищен. Библиотека и палитры сохранены.'); }}>Очистить холст</button></div>
          </section>
        </div>
      )}

      {libraryDeleteDialog && (
        <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLibraryDeleteDialog(null); }}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="library-delete-title">
            <div className="confirm-icon"><Icon name="trash" size={22} /></div>
            <h2 id="library-delete-title">{libraryDeleteDialog.mode === 'all' ? 'Удалить все добавленные элементы?' : 'Удалить выбранные элементы?'}</h2>
            <p>
              {libraryDeleteDialog.mode === 'all'
                ? `Будут удалены все добавленные в библиотеку элементы (количество: ${libraryDeleteDialog.ids.length}), включая импортированные SVG. Встроенные иллюстрации останутся.`
                : `Будут удалены выбранные элементы (количество: ${libraryDeleteDialog.ids.length}). Встроенные иллюстрации останутся.`}
              {' '}Объекты этих элементов, размещённые на холсте, тоже будут удалены.
            </p>
            <div className="confirm-actions">
              <button className="button-secondary" type="button" onClick={() => setLibraryDeleteDialog(null)}>Отмена</button>
              <button className="button-danger" type="button" onClick={() => deleteCustomItems(libraryDeleteDialog.ids)}>
                <Icon name="trash" size={14} /> Удалить
              </button>
            </div>
          </section>
        </div>
      )}

      {paletteDeleteDialog && (
        <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteDeleteDialog(null); }}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="palette-delete-title">
            <div className="confirm-icon"><Icon name="trash" size={22} /></div>
            <h2 id="palette-delete-title">Удалить палитру?</h2>
            <p>
              Палитра «{paletteDeleteDialog.name}» будет удалена из этого браузера. Если она сейчас активна, вместо неё применится встроенная фиолетовая палитра. Исходные SVG не изменятся.
            </p>
            <div className="confirm-actions">
              <button className="button-secondary" type="button" onClick={() => setPaletteDeleteDialog(null)}>Отмена</button>
              <button className="button-danger" type="button" onClick={confirmDeletePalette}>
                <Icon name="trash" size={14} /> Удалить палитру
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className={`toast-message toast-${toast.type}`} role="status"><span className="toast-icon"><Icon name={toast.type === 'error' ? 'close' : 'check'} size={16} /></span>{toast.message}<button type="button" aria-label="Закрыть уведомление" onClick={() => setToast(null)}><Icon name="close" size={14} /></button></div>}
    </main>
  );
}

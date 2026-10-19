import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from './components/Canvas.jsx';
import { ExtractionDialog } from './components/ExtractionDialog.jsx';
import { Icon } from './components/Icon.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { buildSvgDocument, downloadText, makeId, parseArtwork } from './utils/svg.js';
import './App.css';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1048;
const OBJECT_LIMIT = 100;
const LIBRARY_KEY = 'vector-studio.custom-library.v1';

const illustrationFiles = import.meta.glob('./assets/illustrations/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function readableName(filename) {
  return filename
    .replace(/\.svg$/i, '')
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim() || 'SVG-иллюстрация';
}

function loadBuiltInLibrary() {
  return Object.entries(illustrationFiles)
    .sort(([first], [second]) => first.localeCompare(second, 'ru'))
    .flatMap(([path, source]) => {
      const filename = path.split('/').pop();
      try {
        const item = parseArtwork(source, readableName(filename));
        return [{ ...item, id: `builtin:${filename}`, sourceName: filename, builtin: true }];
      } catch (error) {
        console.warn(`Не удалось загрузить ${filename}:`, error);
        return [];
      }
    });
}

const builtInLibrary = loadBuiltInLibrary();

function readCustomLibrary() {
  try {
    const saved = localStorage.getItem(LIBRARY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.content && item?.viewBox) : [];
  } catch {
    return [];
  }
}

function makeCanvasObject(item, index) {
  const aspectRatio = item.viewBox.width / item.viewBox.height || 1;
  const width = Math.min(300, Math.max(120, item.viewBox.width));
  const height = width / aspectRatio;
  const shift = (index % 5) * 24;
  return {
    id: makeId('layer'),
    libraryId: item.id,
    x: Math.max(0, (CANVAS_WIDTH - width) / 2 + shift - 48),
    y: Math.max(0, (CANVAS_HEIGHT - height) / 2 + shift - 36),
    width,
    height,
    rotation: 0,
  };
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
  const [extractSource, setExtractSource] = useState(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedCustomIds, setSelectedCustomIds] = useState(() => new Set());
  const [libraryDeleteDialog, setLibraryDeleteDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const importInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const selectedObject = objects.find((object) => object.id === selectedId);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(customLibrary));
    } catch {
      console.warn('Не удалось сохранить библиотеку в localStorage.');
    }
  }, [customLibrary, showToast]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const addToCanvas = useCallback((item) => {
    if (objects.length >= OBJECT_LIMIT) {
      showToast(`На холсте может быть не больше ${OBJECT_LIMIT} объектов.`, 'warning');
      return;
    }
    const object = makeCanvasObject(item, objects.length);
    setObjects((current) => current.length >= OBJECT_LIMIT ? current : [...current, object]);
    setSelectedId(object.id);
  }, [objects.length, showToast]);

  const updateObject = useCallback((id, updates) => {
    setObjects((current) => current.map((object) => object.id === id ? { ...object, ...updates } : object));
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
    const duplicate = { ...original, id: makeId('layer'), x: original.x + 28, y: original.y + 28 };
    setObjects((current) => current.length >= OBJECT_LIMIT ? current : [...current, duplicate]);
    setSelectedId(duplicate.id);
  }, [objects, showToast]);

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
    const content = buildSvgDocument(objects, library, CANVAS_WIDTH, CANVAS_HEIGHT);
    downloadText('vector-composition.svg', content, 'image/svg+xml;charset=utf-8');
    showToast('SVG скачан. Композиция осталась векторной.');
  }, [objects, library, showToast]);


  const openExtractForItem = (item) => {
    const source = item.source || `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="${item.viewBox.x} ${item.viewBox.y} ${item.viewBox.width} ${item.viewBox.height}">${item.content}</svg>`;
    setExtractSource({ name: item.sourceName || item.name, text: source });
  };

  const importSvgFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      // Анализ и очистка SVG выполняются в окне извлечения перед отрисовкой.
      setExtractSource({ name: file.name, text });
    } catch {
      showToast('Не удалось прочитать файл. Попробуй выбрать SVG ещё раз.', 'error');
    }
  };

  const addComponentsToLibrary = (components) => {
    const prepared = components.map((component) => ({
      ...component,
      id: makeId('component'),
      name: safeItemName(component),
      builtin: false,
      kind: 'component',
    }));
    setCustomLibrary((current) => [...current, ...prepared]);
    setExtractSource(null);
    setActiveTab('elements');
    showToast(`В библиотеку добавлено: ${prepared.length} ${prepared.length === 1 ? 'компонент' : prepared.length < 5 ? 'компонента' : 'компонентов'}.`);
  };

  const addWholeArtworkToLibrary = (item) => {
    const prepared = {
      ...item,
      id: makeId('imported'),
      name: safeItemName(item),
      builtin: false,
    };
    setCustomLibrary((current) => [...current, prepared]);
    setExtractSource(null);
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

    const count = deletableIds.size;
    showToast(`Удалено элементов из библиотеки: ${count}. Встроенные иллюстрации сохранены.`);
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
        setExtractSource(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, duplicateObject, exportSvg, removeObject]);

  return (
    <main className="app-shell">

      <div className="app-body">
        <Sidebar
          library={library}
          objects={objects}
          selectedId={selectedId}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onAdd={addToCanvas}
          onExtract={openExtractForItem}
          onImport={() => importInputRef.current?.click()}
          onSelect={setSelectedId}
          onDuplicate={duplicateObject}
          onDelete={removeObject}
          onMove={moveLayer}
          onReorder={reorderLayers}
          selectedCustomIds={selectedCustomIds}
          onToggleCustomSelection={toggleCustomSelection}
          onDeleteSelectedCustom={requestDeleteSelectedCustom}
          onDeleteAllCustom={requestDeleteAllCustom}
        />

        <Canvas
          library={library}
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateObject={updateObject}
        />

        <aside className="action-rail" aria-label="Действия с проектом">
          <div className="rail-label">ПРОЕКТ</div>
          <button className="action-button action-save" type="button" onClick={exportSvg} title="Скачать композицию в SVG">
            <span className="action-icon"><Icon name="download" size={19} /></span>
            <span className="action-copy">Сохранить<small>SVG</small></span>
          </button>
          <button className="action-button action-clear" type="button" onClick={() => setClearDialogOpen(true)}>
            <span className="action-icon"><Icon name="trash" size={18} /></span>
            <span className="action-copy">Очистить<small>Холст</small></span>
          </button>
          {selectedObject && (
            <div className="selection-quick-actions">
              <span>ВЫБРАНО</span>
              <button type="button" onClick={() => duplicateObject(selectedObject.id)}><Icon name="copy" size={15} /> Дублировать</button>
              <button type="button" onClick={() => removeObject(selectedObject.id)}><Icon name="trash" size={15} /> Удалить</button>
            </div>
          )}
        </aside>
      </div>

      <input ref={importInputRef} className="visually-hidden-input" type="file" accept="image/svg+xml,.svg" onChange={importSvgFile} />

      {extractSource && (
        <ExtractionDialog
          source={extractSource}
          onClose={() => setExtractSource(null)}
          onAddComponents={addComponentsToLibrary}
          onAddWhole={addWholeArtworkToLibrary}
        />
      )}

      {clearDialogOpen && (
        <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setClearDialogOpen(false); }}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-title">
            <div className="confirm-icon"><Icon name="trash" size={22} /></div>
            <h2 id="clear-title">Очистить холст?</h2>
            <p>Все {objects.length} {objects.length === 1 ? 'объект' : 'объектов'} будут удалены с холста. Элементы в библиотеке останутся.</p>
            <div className="confirm-actions"><button className="button-secondary" type="button" onClick={() => setClearDialogOpen(false)}>Отмена</button><button className="button-danger" type="button" onClick={() => { setObjects([]); setSelectedId(null); setClearDialogOpen(false); showToast('Холст очищен. Библиотека сохранена.'); }}>Очистить холст</button></div>
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
                ? `Будут удалены все добавленные в библиотеку элементы (количество: ${libraryDeleteDialog.ids.length}), включая извлечённые компоненты и импортированные SVG. Встроенные иллюстрации останутся.`
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

      {toast && <div className={`toast-message toast-${toast.type}`} role="status"><span className="toast-icon"><Icon name={toast.type === 'error' ? 'close' : 'check'} size={16} /></span>{toast.message}<button type="button" aria-label="Закрыть уведомление" onClick={() => setToast(null)}><Icon name="close" size={14} /></button></div>}
    </main>
  );
}

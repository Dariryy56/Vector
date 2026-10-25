import { useMemo, useState } from 'react';
import { Icon } from './Icon.jsx';
import { hasRoleVariant, resolveLibraryItem } from '../utils/library.js';

function ArtworkPreview({ item }) {
  if (!item?.viewBox) return null;
  const box = item.viewBox;
  return (
    <svg
      className="artwork-preview"
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      role="img"
      aria-label={item.name}
      preserveAspectRatio="xMidYMid meet"
      dangerouslySetInnerHTML={{ __html: item.content }}
    />
  );
}

function ElementCard({ item, onAdd, isCustom, selectedForDeletion, onToggleCustomSelection }) {
  return (
    <article className={`element-card${selectedForDeletion ? ' is-marked-for-deletion' : ''}`}>
      <button className="element-card-main" type="button" onClick={() => onAdd(item)} title={`Добавить «${item.name}» на холст`}>
        <span className="element-image-wrap"><ArtworkPreview item={item} key={`${item.sourcePath || item.id}-${item.role || 'main'}`} /></span>
        <span className="element-name" title={item.name}>{item.name}</span>
        <span className="element-card-hint">Нажми, чтобы добавить</span>
      </button>
      {isCustom && (
        <button
          className={`element-select${selectedForDeletion ? ' selected' : ''}`}
          type="button"
          aria-label={`${selectedForDeletion ? 'Снять выбор' : 'Выбрать'} элемента «${item.name}» для удаления`}
          aria-pressed={selectedForDeletion}
          title={selectedForDeletion ? 'Снять выбор для удаления' : 'Выбрать для удаления'}
          onClick={() => onToggleCustomSelection(item.id)}
        >
          {selectedForDeletion && <Icon name="check" size={13} />}
        </button>
      )}
    </article>
  );
}

function LayerRow({
  object,
  item,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
  onReorder,
  onToggleLock,
  onToggleRole,
  canToggleRole,
  illustrationSize,
  palette,
  canvasFormat,
}) {
  const [dragging, setDragging] = useState(false);
  const handleDrop = (event) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    setDragging(false);
    if (sourceId && sourceId !== object.id) onReorder(sourceId, object.id);
  };
  const roleItem = resolveLibraryItem(item, illustrationSize, object.role || 'main', palette, canvasFormat);
  const roleLabel = object.role === 'background' ? 'Фон' : 'Объект';
  const nextRole = object.role === 'background' ? 'main' : 'background';
  // Check the actual variant attached to this library item as well as the app-level guard.
  // This keeps valid L/S role buttons available even when a previously resolved preview is passed in.
  const roleSwitchAvailable = hasRoleVariant(item, illustrationSize, nextRole) || canToggleRole(object);

  return (
    <div
      className={`layer-row${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${object.locked ? ' is-locked' : ''}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', object.id);
        event.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <button
        className={`layer-role-toggle${object.role === 'background' ? ' role-background' : ''}`}
        type="button"
        disabled={!roleSwitchAvailable}
        title={roleSwitchAvailable ? 'Переключить состояние объекта' : `Для размера ${illustrationSize} нет подготовленного противоположного SVG-варианта`}
        aria-label={`Текущее состояние: ${roleLabel}. Нажми, чтобы переключить.`}
        onClick={() => onToggleRole(object.id)}
      >{roleLabel}</button>
      <button className="layer-main" type="button" onClick={() => onSelect(object.id)}>
        <span className="layer-thumb">
          {roleItem && <ArtworkPreview item={roleItem} key={`${roleItem.sourcePath || roleItem.id}-${object.role || 'main'}-${illustrationSize}`} />}
          {object.locked && <span className="layer-lock-badge"><Icon name="lock" size={10} /></span>}
        </span>
        <span className="layer-text">
          <span className="layer-name">{item?.name ?? 'Неизвестный элемент'}</span>
          <span className="layer-meta">SVG · {Math.round(object.width)} × {Math.round(object.height)}</span>
        </span>
      </button>
      <div className="layer-actions" aria-label="Действия со слоем">
        <button type="button" title="Переместить выше" aria-label="Переместить выше" onClick={() => onMove(object.id, 1)}>
          <Icon name="arrow-up" size={14} />
        </button>
        <button type="button" title="Переместить ниже" aria-label="Переместить ниже" onClick={() => onMove(object.id, -1)}>
          <Icon name="arrow-down" size={14} />
        </button>
        <button type="button" title="Дублировать слой" aria-label="Дублировать слой" onClick={() => onDuplicate(object.id)}>
          <Icon name="copy" size={14} />
        </button>
        <button
          type="button"
          className={`layer-lock-action${object.locked ? ' locked' : ''}`}
          title={object.locked ? 'Разблокировать положение' : 'Заблокировать положение'}
          aria-label={object.locked ? 'Разблокировать положение' : 'Заблокировать положение'}
          aria-pressed={Boolean(object.locked)}
          onClick={() => onToggleLock(object.id)}
        >
          <Icon name={object.locked ? 'lock' : 'unlock'} size={14} />
        </button>
        <button className="layer-delete" type="button" title="Удалить слой" aria-label="Удалить слой" onClick={() => onDelete(object.id)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

export function Sidebar({
  library,
  objects,
  selectedId,
  activeTab,
  onChangeTab,
  onAdd,
  onImport,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
  onReorder,
  onToggleLock,
  onToggleRole,
  canToggleRole,
  selectedCustomIds,
  onToggleCustomSelection,
  onDeleteSelectedCustom,
  onDeleteAllCustom,
  onCompose,
  illustrationSize,
  palette,
  canvasFormat,
}) {
  const [query, setQuery] = useState('');
  const [metaphor, setMetaphor] = useState('');
  const [componentNames, setComponentNames] = useState('');
  const itemById = useMemo(() => new Map(library.map((item) => [item.id, item])), [library]);
  // Dedicated canvas backgrounds are selected in the right panel, not inserted as ordinary objects.
  // Keep them in itemById so any existing background layer can still be rendered and managed.
  const drawableLibrary = useMemo(() => library.filter((item) => item.kind !== 'canvas-background'), [library]);
  const customItemsCount = drawableLibrary.filter((item) => !item.builtin).length;
  const filteredLibrary = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
    if (!normalized) return drawableLibrary;
    return drawableLibrary.filter((item) => `${item.name} ${item.sourceName}`.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(normalized));
  }, [drawableLibrary, query]);
  const orderedObjects = [...objects].reverse();

  return (
    <aside className="sidebar panel-surface">
      <div className="sidebar-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Библиотека</h1>
        </div>
      </div>

      <div className="sidebar-tabs" role="tablist" aria-label="Разделы боковой панели">
        <button
          className={activeTab === 'elements' ? 'active' : ''}
          role="tab"
          aria-selected={activeTab === 'elements'}
          type="button"
          onClick={() => onChangeTab('elements')}
        >
          <Icon name="grid" size={16} /> Элементы
        </button>
        <button
          className={activeTab === 'layers' ? 'active' : ''}
          role="tab"
          aria-selected={activeTab === 'layers'}
          type="button"
          onClick={() => onChangeTab('layers')}
        >
          <Icon name="layers" size={16} /> Слои
          <span className="tab-count">{objects.length}</span>
        </button>
      </div>

      {activeTab === 'elements' ? (
        <div className="sidebar-content">
          <div className="section-intro">
            <div>
              <h2>Исходные элементы</h2>
              <p>Нажми на карточку, чтобы добавить её на холст.</p>
            </div>
            <button className="icon-button import-trigger" type="button" onClick={onImport} title="Импортировать SVG" aria-label="Импортировать SVG">
              <Icon name="upload" size={17} />
            </button>
          </div>

          <section className="auto-build-panel" aria-labelledby="auto-build-title">
            <div className="auto-build-heading">
              <Icon name="sparkles" size={15} />
              <h2 id="auto-build-title">Автосборка композиции</h2>
            </div>
            <form className="auto-build-row" onSubmit={(event) => { event.preventDefault(); onCompose('metaphor', metaphor); }}>
              <input value={metaphor} onChange={(event) => setMetaphor(event.target.value)} placeholder="Метафора, например: учёба" aria-label="Метафора или заголовок" />
              <button type="submit" title="Собрать по метафоре" aria-label="Собрать по метафоре"><Icon name="sparkles" size={15} /></button>
            </form>
            <form className="auto-build-row" onSubmit={(event) => { event.preventDefault(); onCompose('names', componentNames); }}>
              <input value={componentNames} onChange={(event) => setComponentNames(event.target.value)} placeholder="Книга, Ручка, Телефон…" aria-label="Названия компонентов через запятую" />
              <button type="submit" title="Собрать по названиям" aria-label="Собрать по названиям"><Icon name="plus" size={15} /></button>
            </form>
            
          </section>

          <label className="search-field">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти элемент..." />
            {query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}><Icon name="close" size={14} /></button>}
          </label>
          {customItemsCount > 0 && selectedCustomIds.size > 0 && (
            <section className="library-manage-panel" aria-label="Управление добавленными элементами">
              <div className="library-manage-heading">
                <strong>Добавленные элементы</strong>
                <span>{customItemsCount}</span>
              </div>
              <p>Можно удалить свои импортированные SVG. Встроенные иллюстрации останутся.</p>
              <div className="library-manage-actions">
                <button className="button-secondary library-delete-selected" type="button" disabled={selectedCustomIds.size === 0} onClick={onDeleteSelectedCustom}>
                  <Icon name="trash" size={13} /> Удалить выбранные ({selectedCustomIds.size})
                </button>
                <button className="button-danger library-delete-all" type="button" onClick={onDeleteAllCustom}>
                  <Icon name="trash" size={13} /> Удалить все добавленные
                </button>
              </div>
            </section>
          )}
          <div className="elements-caption">
            <span>{filteredLibrary.length} {filteredLibrary.length === 1 ? 'элемент' : 'элементов'}</span>
          </div>
          {filteredLibrary.length > 0 ? (
            <div className="elements-grid">
              {filteredLibrary.map((item) => (
                <ElementCard
                  key={item.id}
                  item={item}
                  onAdd={onAdd}
                  isCustom={!item.builtin}
                  selectedForDeletion={selectedCustomIds.has(item.id)}
                  onToggleCustomSelection={onToggleCustomSelection}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state library-empty">
              <span className="empty-icon"><Icon name="image" size={24} /></span>
              <strong>{query ? 'Ничего не найдено' : 'Библиотека пока пуста'}</strong>
              <p>{query ? 'Попробуй другое название.' : 'Импортируй SVG-файл или добавь иллюстрации в папку проекта.'}</p>
              {!query && <button className="button-secondary" type="button" onClick={onImport}><Icon name="upload" size={15} /> Импортировать SVG</button>}
            </div>
          )}
        </div>
      ) : (
        <div className="sidebar-content layers-content">
          <div className="section-intro">
            <div>
              <h2>Слои композиции</h2>
              <p>Перетаскивай строки, чтобы менять порядок.</p>
            </div>
            <span className="layer-count-pill">{objects.length} / 100</span>
          </div>
          {orderedObjects.length > 0 ? (
            <div className="layers-list">
              {orderedObjects.map((object) => (
                <LayerRow
                  key={object.id}
                  object={object}
                  item={itemById.get(object.libraryId)}
                  selected={object.id === selectedId}
                  onSelect={onSelect}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  onMove={onMove}
                  onReorder={onReorder}
                  onToggleLock={onToggleLock}
                  onToggleRole={onToggleRole}
                  canToggleRole={canToggleRole}
                  illustrationSize={illustrationSize}
                  palette={palette}
                  canvasFormat={canvasFormat}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state layers-empty">
              <span className="empty-icon"><Icon name="layers" size={24} /></span>
              <strong>Здесь появятся слои</strong>
              <p>Добавь элемент из библиотеки, чтобы начать композицию.</p>
              <button className="button-secondary" type="button" onClick={() => onChangeTab('elements')}><Icon name="grid" size={15} /> Открыть элементы</button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

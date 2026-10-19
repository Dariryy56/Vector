import { useMemo, useState } from 'react';
import { Icon } from './Icon.jsx';

function ArtworkPreview({ item }) {
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

function ElementCard({ item, onAdd, onExtract, isCustom, selectedForDeletion, onToggleCustomSelection }) {
  return (
    <article className={`element-card${selectedForDeletion ? ' is-marked-for-deletion' : ''}`}>
      <button className="element-card-main" type="button" onClick={() => onAdd(item)} title={`Добавить «${item.name}» на холст`}>
        <span className="element-image-wrap"><ArtworkPreview item={item} /></span>
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
      <button
        className="element-extract"
        type="button"
        title="Извлечь объект из SVG"
        aria-label={`Извлечь объекты из ${item.name}`}
        onClick={() => onExtract(item)}
      >
        <Icon name="scissors" size={14} />
      </button>
    </article>
  );
}

function LayerRow({ object, item, selected, onSelect, onDuplicate, onDelete, onMove, onReorder }) {
  const [dragging, setDragging] = useState(false);
  const handleDrop = (event) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    setDragging(false);
    if (sourceId && sourceId !== object.id) onReorder(sourceId, object.id);
  };

  return (
    <div
      className={`layer-row${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}`}
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
      <button className="layer-main" type="button" onClick={() => onSelect(object.id)}>
        <span className="layer-thumb">
          {item && <ArtworkPreview item={item} />}
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
  onExtract,
  onImport,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
  onReorder,
  selectedCustomIds,
  onToggleCustomSelection,
  onDeleteSelectedCustom,
  onDeleteAllCustom,
}) {
  const [query, setQuery] = useState('');
  const itemById = useMemo(() => new Map(library.map((item) => [item.id, item])), [library]);
  const customItemsCount = library.filter((item) => !item.builtin).length;
  const filteredLibrary = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    if (!normalized) return library;
    return library.filter((item) => `${item.name} ${item.sourceName}`.toLocaleLowerCase('ru').includes(normalized));
  }, [library, query]);
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
              <p>Можно удалить свои SVG и извлечённые компоненты. Встроенные иллюстрации останутся.</p>
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
            <span className="caption-tip"><Icon name="scissors" size={12} /> — извлечь части SVG</span>
          </div>
          {filteredLibrary.length > 0 ? (
            <div className="elements-grid">
              {filteredLibrary.map((item) => (
                <ElementCard
                  key={item.id}
                  item={item}
                  onAdd={onAdd}
                  onExtract={onExtract}
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
          {objects.length > 0 && (
            <div className="layers-footer"><span className="footer-dot" /> Верхний элемент списка находится на переднем плане.</div>
          )}
        </div>
      )}

    </aside>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { analyzeSvgForExtraction, parseArtwork } from '../utils/svg.js';

export function ExtractionDialog({ source, onClose, onAddComponents, onAddWhole }) {
  const [initialAnalysis] = useState(() => {
    try {
      return { value: analyzeSvgForExtraction(source.text), error: '' };
    } catch (caughtError) {
      return { value: null, error: caughtError.message || 'Не получилось прочитать SVG.' };
    }
  });
  const analysis = initialAnalysis.value;
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [boxes, setBoxes] = useState({});
  const [hoveredElementId, setHoveredElementId] = useState(null);
  const [error, setError] = useState(initialAnalysis.error);
  const measureRef = useRef(null);


  useEffect(() => {
    if (!analysis || !measureRef.current) return;
    const svg = measureRef.current;
    const svgMatrix = svg.getScreenCTM();
    if (!svgMatrix) return;

    let inverse;
    try {
      inverse = svgMatrix.inverse();
    } catch {
      return;
    }

    const nextBoxes = {};
    analysis.elements.forEach((element) => {
      const node = svg.querySelector(`[data-extract-id="${element.id}"]`);
      if (!node || typeof node.getBBox !== 'function') return;

      try {
        const box = node.getBBox();
        const matrix = inverse.multiply(node.getScreenCTM());
        const corners = [
          [box.x, box.y],
          [box.x + box.width, box.y],
          [box.x, box.y + box.height],
          [box.x + box.width, box.y + box.height],
        ].map(([x, y]) => ({
          x: matrix.a * x + matrix.c * y + matrix.e,
          y: matrix.b * x + matrix.d * y + matrix.f,
        }));
        const xs = corners.map((point) => point.x);
        const ys = corners.map((point) => point.y);
        const bounds = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
        if (bounds.width > 0 && bounds.height > 0) nextBoxes[element.id] = bounds;
      } catch {
        // Some SVG nodes (for example, an empty group) do not expose a useful box.
      }
    });
    setBoxes(nextBoxes);
  }, [analysis]);

  const visibleElements = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    if (!normalized || !analysis) return analysis?.elements ?? [];
    return analysis.elements.filter((element) => `${element.name} ${element.tag}`.toLocaleLowerCase('ru').includes(normalized));
  }, [analysis, query]);

  const toggleElement = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    if (!analysis || selected.size === 0) return;
    const selectedElements = analysis.elements
      .filter((element) => selected.has(element.id))
      .map((element) => ({
        ...element,
        name: element.name,
        sourceName: source.name,
        viewBox: boxes[element.id] ?? element.viewBox,
        kind: 'component',
      }));
    onAddComponents(selectedElements);
  };

  const addWhole = () => {
    try {
      const wholeArtwork = parseArtwork(source.text, source.name);
      onAddWhole({ ...wholeArtwork, sourceName: source.name, kind: 'illustration' });
    } catch (caughtError) {
      setError(caughtError.message || 'Не получилось добавить SVG.');
    }
  };

  const toggleAll = () => {
    if (!analysis) return;
    setSelected((current) => current.size === visibleElements.length
      ? new Set()
      : new Set(visibleElements.map((element) => element.id)));
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="extract-modal" role="dialog" aria-modal="true" aria-labelledby="extract-title">
        <header className="modal-header">
          <div className="modal-title-icon"><Icon name="scissors" size={20} /></div>
          <div className="modal-title-copy">
            <h2 id="extract-title">Извлечь элементы из SVG</h2>
            <p>Наведи на строку, чтобы подсветить объект на иллюстрации. Выбери нужные части и сохрани их как компоненты.</p>
          </div>
          <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Закрыть окно"><Icon name="close" size={18} /></button>
        </header>

        {error ? (
          <div className="extract-error"><Icon name="close" size={18} /><strong>{error}</strong><p>Проверь, что файл содержит SVG-разметку.</p></div>
        ) : analysis ? (
          <>
            <div className="extract-source-row">
              <div className="source-file-icon"><Icon name="file" size={18} /></div>
              <div className="source-file-name"><strong>{source.name}</strong><span>SVG · {analysis.elements.length} объектов для выбора</span></div>
              <button className="button-secondary whole-artwork-button" type="button" onClick={addWhole}><Icon name="plus" size={15} /> Добавить целиком</button>
            </div>

            <div className="extract-body">
              <div className="extract-preview-column">
                <div className="mini-section-heading"><span>Предпросмотр</span><span>Исходная иллюстрация</span></div>
                <div className={`source-artwork-preview${hoveredElementId !== null ? ' has-highlight' : ''}`}>
                  <svg
                    className="source-artwork-svg"
                    viewBox={`${analysis.viewBox.x} ${analysis.viewBox.y} ${analysis.viewBox.width} ${analysis.viewBox.height}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {hoveredElementId !== null && (
                      <style>{`.source-artwork-svg [data-extract-id="${hoveredElementId}"] { filter: drop-shadow(0 0 1.5px #ff308d) drop-shadow(0 0 6px rgba(123, 97, 242, .95)) !important; }`}</style>
                    )}
                    <g dangerouslySetInnerHTML={{ __html: analysis.previewContent }} />
                  </svg>
                </div>
                
              </div>

              <div className="extract-list-column">
                <div className="extract-list-heading">
                  <div><strong>Объекты в файле</strong><span>{selected.size} выбрано</span></div>
                  <button type="button" className="text-button" onClick={toggleAll}>{selected.size === visibleElements.length && visibleElements.length > 0 ? 'Снять выбор' : 'Выбрать все'}</button>
                </div>
                <label className="search-field extract-search">
                  <Icon name="search" size={15} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти группу или контур..." />
                  {query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}><Icon name="close" size={13} /></button>}
                </label>
                <div className="extract-element-list">
                  {visibleElements.map((element) => (
                    <button
                      key={element.id}
                      type="button"
                      className={`extract-element-row${selected.has(element.id) ? ' chosen' : ''}${hoveredElementId === element.id ? ' is-hovered' : ''}`}
                      onClick={() => toggleElement(element.id)}
                      onMouseEnter={() => setHoveredElementId(element.id)}
                      onMouseLeave={() => setHoveredElementId(null)}
                      onFocus={() => setHoveredElementId(element.id)}
                      onBlur={() => setHoveredElementId(null)}
                    >
                      <span className={`node-type node-${element.tag === 'g' ? 'group' : 'shape'}`}><Icon name={element.tag === 'g' ? 'layers' : 'image'} size={15} /></span>
                      <span className="extract-element-label"><strong>{element.name}</strong><span>{element.kind} · &lt;{element.tag}&gt;</span></span>
                      <span className={`selection-check${selected.has(element.id) ? ' checked' : ''}`}>{selected.has(element.id) && <Icon name="check" size={13} />}</span>
                    </button>
                  ))}
                  {visibleElements.length === 0 && <div className="extract-list-empty">Подходящих объектов не найдено.</div>}
                </div>
              </div>
            </div>

            <svg
              ref={measureRef}
              className="svg-measurement-stage"
              width="1000"
              height="1000"
              viewBox={`${analysis.viewBox.x} ${analysis.viewBox.y} ${analysis.viewBox.width} ${analysis.viewBox.height}`}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: analysis.measureContent }}
            />

            <footer className="modal-footer">
              <span className="modal-footer-note">Компоненты сохраняются в локальной библиотеке браузера.</span>
              <div className="modal-footer-actions">
                <button className="button-secondary" type="button" onClick={onClose}>Отмена</button>
                <button className="button-primary" type="button" disabled={selected.size === 0} onClick={addSelected}><Icon name="plus" size={16} /> Добавить выбранные ({selected.size})</button>
              </div>
            </footer>
          </>
        ) : (
          <div className="extract-loading">Читаю SVG…</div>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { resolveLibraryItem } from '../utils/library.js';
import { namespaceSvgIds } from '../utils/svg.js';

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 1.4;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(value) {
  return ((value % 360) + 360) % 360;
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getStagePoint(event, svg, zoom) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom,
  };
}

function Artwork({ object, item, selected, onPointerDown }) {
  const namespacedContent = useMemo(() => item ? namespaceSvgIds(item.content, object.id) : '', [item, object.id]);
  if (!item) return null;
  const box = item.viewBox;
  const centerX = object.width / 2;
  const centerY = object.height / 2;
  const isLocked = Boolean(object.locked);

  return (
    <g
      transform={`translate(${object.x} ${object.y}) rotate(${object.rotation} ${centerX} ${centerY})`}
      onPointerDown={(event) => onPointerDown(event, object, 'move')}
      className={`canvas-object${selected ? ' canvas-object-selected' : ''}${isLocked ? ' canvas-object-locked' : ''}`}
      data-object-id={object.id}
      data-object-role={object.role || 'main'}
    >
      <svg
        x="0"
        y="0"
        width={object.width}
        height={object.height}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        dangerouslySetInnerHTML={{ __html: namespacedContent }}
      />
    </g>
  );
}

function SelectionControls({ object, onPointerDown }) {
  const { x, y, width, height, rotation } = object;
  const centerX = width / 2;
  const rotateY = -32;
  const transform = `translate(${x} ${y}) rotate(${rotation} ${centerX} ${height / 2})`;

  if (object.locked) {
    return (
      <g transform={transform} className="selection-controls selection-controls-locked">
        <rect className="selection-outline" x="0" y="0" width={width} height={height} rx="2" />
        <g transform={`translate(${Math.max(8, width - 15)} 6)`} className="canvas-lock-indicator">
          <rect x="-8" y="0" width="16" height="13" rx="3" />
          <path d="M-5 0v-3a5 5 0 0 1 10 0v3" />
        </g>
      </g>
    );
  }

  const handles = [
    { x: 0, y: 0, cursor: 'nwse-resize' },
    { x: width, y: 0, cursor: 'nesw-resize' },
    { x: 0, y: height, cursor: 'nesw-resize' },
    { x: width, y: height, cursor: 'nwse-resize' },
  ];

  return (
    <g transform={transform} className="selection-controls">
      <rect className="selection-outline" x="0" y="0" width={width} height={height} rx="2" />
      <path className="rotate-stem" d={`M ${centerX} 0 V ${rotateY + 5}`} />
      <circle
        className="rotate-handle"
        cx={centerX}
        cy={rotateY}
        r="9"
        onPointerDown={(event) => onPointerDown(event, object, 'rotate')}
      />
      {handles.map((handle, index) => (
        <rect
          key={index}
          className="resize-handle"
          x={handle.x - 5}
          y={handle.y - 5}
          width="10"
          height="10"
          rx="2"
          style={{ cursor: handle.cursor }}
          onPointerDown={(event) => onPointerDown(event, object, 'resize')}
        />
      ))}
    </g>
  );
}

export function Canvas({
  library,
  objects,
  selectedId,
  onSelect,
  onUpdateObject,
  illustrationSize,
  canvasFormat,
  canvasWidth,
  canvasHeight,
  palette,
  canvasBackground = 'plain',
  onChangeIllustrationSize,
  compositionName = 'Новая композиция',
  onCompositionNameChange,
}) {
  const viewportRef = useRef(null);
  const svgRef = useRef(null);
  const gestureRef = useRef(null);
  const spacePressedRef = useRef(false);
  const zoomTouchedRef = useRef(false);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const selectedObject = objects.find((object) => object.id === selectedId);

  const itemById = useMemo(() => {
    const result = new Map();
    library.forEach((item) => {
      result.set(item.id, {
        main: resolveLibraryItem(item, illustrationSize, 'main', palette, canvasFormat),
        background: resolveLibraryItem(item, illustrationSize, 'background', palette, canvasFormat),
      });
    });
    return result;
  }, [library, illustrationSize, palette, canvasFormat]);
  const canvasBackgroundItem = useMemo(() => {
    if (canvasBackground === 'plain') return null;
    const source = library.find((item) => item.id === `builtin:canvas-background:${canvasBackground}`);
    return resolveLibraryItem(source, illustrationSize, 'background', palette, canvasFormat);
  }, [library, canvasBackground, illustrationSize, palette, canvasFormat]);
  const canvasBackgroundContent = useMemo(() => canvasBackgroundItem
    ? namespaceSvgIds(canvasBackgroundItem.content, `artboard-${canvasFormat}-${canvasBackground}`)
    : '', [canvasBackgroundItem, canvasFormat, canvasBackground]);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const nextZoom = clamp(Math.min((rect.width - 84) / canvasWidth, (rect.height - 84) / canvasHeight), MIN_ZOOM, 0.9);
    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
    zoomTouchedRef.current = true;
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const resizeObserver = new ResizeObserver(() => {
      if (!zoomTouchedRef.current) {
        const rect = viewport.getBoundingClientRect();
        setZoom(clamp(Math.min((rect.width - 84) / canvasWidth, (rect.height - 84) / canvasHeight), MIN_ZOOM, 0.9));
      }
    });
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    fitToView();
  }, [canvasWidth, canvasHeight, fitToView]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !event.repeat && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        spacePressedRef.current = true;
      }
    };
    const onKeyUp = (event) => {
      if (event.code === 'Space') spacePressedRef.current = false;
    };
    const clearSpace = () => { spacePressedRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearSpace);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearSpace);
    };
  }, []);

  const onWheel = (event) => {
    event.preventDefault();
    zoomTouchedRef.current = true;
    setZoom((current) => clamp(current * (event.deltaY < 0 ? 1.08 : 0.92), MIN_ZOOM, MAX_ZOOM));
  };

  const startGesture = (event, object, type) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(object.id);
    if (object.locked) return;

    const svg = svgRef.current;
    if (!svg) return;
    const point = getStagePoint(event, svg, zoom);
    const center = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
    gestureRef.current = {
      type,
      id: object.id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: object.x,
      startY: object.y,
      startWidth: object.width,
      startHeight: object.height,
      startRotation: object.rotation,
      center,
      startDistance: distance(point, center),
      startAngle: Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI,
      zoom,
      startPan: pan,
    };
    svg.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerDown = (event) => {
    if (event.target.closest?.('[data-object-id]') || event.target.closest?.('.selection-controls')) return;
    if (spacePressedRef.current || event.button === 1) {
      event.preventDefault();
      gestureRef.current = {
        type: 'pan',
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        startPan: pan,
      };
      setIsPanning(true);
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    onSelect(null);
  };

  const onPointerMove = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if (gesture.type === 'pan') {
      setPan({
        x: gesture.startPan.x + event.clientX - gesture.clientX,
        y: gesture.startPan.y + event.clientY - gesture.clientY,
      });
      return;
    }

    const object = objects.find((entry) => entry.id === gesture.id);
    if (!object || object.locked) return;
    const dx = (event.clientX - gesture.clientX) / gesture.zoom;
    const dy = (event.clientY - gesture.clientY) / gesture.zoom;

    if (gesture.type === 'move') {
      onUpdateObject(gesture.id, { x: gesture.startX + dx, y: gesture.startY + dy });
    } else {
      const point = getStagePoint(event, svgRef.current, gesture.zoom);
      if (gesture.type === 'resize') {
        const currentDistance = distance(point, gesture.center);
        const ratio = currentDistance / Math.max(gesture.startDistance, 1);
        const minimumScale = Math.max(32 / gesture.startWidth, 32 / gesture.startHeight);
        const maximumScale = Math.min(1700 / gesture.startWidth, 980 / gesture.startHeight);
        const scale = clamp(ratio, minimumScale, maximumScale);
        onUpdateObject(gesture.id, {
          width: gesture.startWidth * scale,
          height: gesture.startHeight * scale,
        });
      } else if (gesture.type === 'rotate') {
        const angle = Math.atan2(point.y - gesture.center.y, point.x - gesture.center.x) * 180 / Math.PI;
        onUpdateObject(gesture.id, { rotation: normalizeAngle(gesture.startRotation + angle - gesture.startAngle) });
      }
    }
  };

  const onPointerUp = (event) => {
    if (!gestureRef.current || gestureRef.current.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setIsPanning(false);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const currentSizeLabel = `${canvasWidth} × ${canvasHeight}`;

  return (
    <section className="workspace" aria-label="Рабочий холст">
      <div className="workspace-topline">
        <div className="breadcrumb">
          <span>Проект</span>
          <span className="breadcrumb-separator">/</span>
          <input
            className="composition-name-input"
            type="text"
            value={compositionName}
            onChange={(event) => onCompositionNameChange?.(event.target.value)}
            placeholder="Новая композиция"
            maxLength={80}
            aria-label="Название композиции"
            title="Нажми и введи название композиции"
          />
          <span className="unsaved-dot" title="Название сохраняется в этом браузере" />
        </div>
        <div className="canvas-top-actions">
          <div className="illustration-size-control" role="group" aria-label="Детализация иллюстраций">
            <span>Детали</span>
            {['L', 'S'].map((size) => (
              <button
                key={size}
                type="button"
                className={illustrationSize === size ? 'active' : ''}
                aria-pressed={illustrationSize === size}
                title={`Использовать SVG-варианты ${size}`}
                onClick={() => onChangeIllustrationSize(size)}
              >{size}</button>
            ))}
          </div>
          <div className="canvas-size-label"><span className="status-dot" />{currentSizeLabel}</div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`canvas-viewport${isPanning ? ' is-panning' : ''}`}
        onWheel={onWheel}
      >
        <div className="canvas-backdrop-glow" />
        <div
          className="artboard"
          style={{ width: canvasWidth, height: canvasHeight, transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg
            ref={svgRef}
            className="composition-svg"
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Редактируемый SVG-холст"
          >
            <rect
              className="artboard-background"
              width={canvasWidth}
              height={canvasHeight}
              style={{ fill: palette?.colors?.background?.background1 || '#D7CDF5' }}
            />
            {canvasBackgroundItem?.viewBox && (
              <svg
                key={`${canvasBackground}-${canvasFormat}-${palette?.id || 'palette'}`}
                className="canvas-template-background"
                x="0"
                y="0"
                width={canvasWidth}
                height={canvasHeight}
                viewBox={`${canvasBackgroundItem.viewBox.x} ${canvasBackgroundItem.viewBox.y} ${canvasBackgroundItem.viewBox.width} ${canvasBackgroundItem.viewBox.height}`}
                preserveAspectRatio="xMidYMid meet"
                pointerEvents="none"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: canvasBackgroundContent }}
              />
            )}
            {objects.map((object) => {
              const variants = itemById.get(object.libraryId);
              const item = variants?.[object.role || 'main'];
              return (
                <Artwork
                  key={`${object.id}-${illustrationSize}-${object.role || 'main'}-${item?.sourcePath || ''}`}
                  object={object}
                  item={item}
                  selected={object.id === selectedId}
                  onPointerDown={startGesture}
                />
              );
            })}
            {selectedObject && itemById.has(selectedObject.libraryId) && (
              <SelectionControls object={selectedObject} onPointerDown={startGesture} />
            )}
          </svg>
          <div className="artboard-dimension"><span />{currentSizeLabel}</div>
        </div>

        {objects.length === 0 && (
          <div className="canvas-empty-hint">
            <div className="canvas-empty-icon"><Icon name="layersPlus" size={27} /></div>
            <h2>Здесь начинается композиция</h2>
            <p>Выбери иллюстрацию слева и добавь её на холст.</p>
            <span><Icon name="mouse" size={14} /> Перетаскивай объекты · Space + движение — перемещение холста</span>
          </div>
        )}
      </div>

      <div className="canvas-controls">
        <div className="zoom-group" aria-label="Масштаб холста">
          <button type="button" title="Уменьшить масштаб" aria-label="Уменьшить масштаб" onClick={() => { zoomTouchedRef.current = true; setZoom((value) => clamp(value * 0.88, MIN_ZOOM, MAX_ZOOM)); }}><Icon name="zoom-out" size={16} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" title="Увеличить масштаб" aria-label="Увеличить масштаб" onClick={() => { zoomTouchedRef.current = true; setZoom((value) => clamp(value * 1.12, MIN_ZOOM, MAX_ZOOM)); }}><Icon name="zoom-in" size={16} /></button>
          <span className="zoom-separator" />
          <button type="button" title="Вписать холст в экран" aria-label="Вписать холст в экран" onClick={fitToView}><Icon name="fit" size={16} /></button>
        </div>
        <div className="canvas-interaction-note"><span className="keyboard-key">Space</span> + перетаскивание для перемещения холста</div>
      </div>
    </section>
  );
}

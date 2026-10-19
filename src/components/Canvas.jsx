import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1048;
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
  if (!item) return null;
  const box = item.viewBox;
  const centerX = object.width / 2;
  const centerY = object.height / 2;

  return (
    <g
      transform={`translate(${object.x} ${object.y}) rotate(${object.rotation} ${centerX} ${centerY})`}
      onPointerDown={(event) => onPointerDown(event, object, 'move')}
      className={`canvas-object${selected ? ' canvas-object-selected' : ''}`}
      data-object-id={object.id}
    >
      <svg
        x="0"
        y="0"
        width={object.width}
        height={object.height}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        dangerouslySetInnerHTML={{ __html: item.content }}
      />
    </g>
  );
}

function SelectionControls({ object, onPointerDown }) {
  const { x, y, width, height, rotation } = object;
  const handles = [
    { x, y, type: 'resize', cursor: 'nwse-resize' },
    { x: x + width, y, type: 'resize', cursor: 'nesw-resize' },
    { x, y: y + height, type: 'resize', cursor: 'nesw-resize' },
    { x: x + width, y: y + height, type: 'resize', cursor: 'nwse-resize' },
  ];
  const centerX = width / 2;
  const rotateY = -32;

  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation} ${centerX} ${height / 2})`} className="selection-controls">
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
          x={handle.x - x - 5}
          y={handle.y - y - 5}
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

export function Canvas({ library, objects, selectedId, onSelect, onUpdateObject }) {
  const viewportRef = useRef(null);
  const svgRef = useRef(null);
  const gestureRef = useRef(null);
  const spacePressedRef = useRef(false);
  const zoomTouchedRef = useRef(false);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const itemById = new Map(library.map((item) => [item.id, item]));
  const selectedObject = objects.find((object) => object.id === selectedId);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const nextZoom = clamp(Math.min((rect.width - 84) / CANVAS_WIDTH, (rect.height - 84) / CANVAS_HEIGHT), MIN_ZOOM, 0.9);
    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
    zoomTouchedRef.current = true;
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const resizeObserver = new ResizeObserver(() => {
      if (!zoomTouchedRef.current) {
        const rect = viewport.getBoundingClientRect();
        setZoom(clamp(Math.min((rect.width - 84) / CANVAS_WIDTH, (rect.height - 84) / CANVAS_HEIGHT), MIN_ZOOM, 0.9));
      }
    });
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !event.repeat && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
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
    const svg = svgRef.current;
    const point = getStagePoint(event, svg, zoom);
    onSelect(object.id);
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
      svgRef.current.setPointerCapture(event.pointerId);
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
    if (!object) return;
    const dx = (event.clientX - gesture.clientX) / gesture.zoom;
    const dy = (event.clientY - gesture.clientY) / gesture.zoom;

    if (gesture.type === 'move') {
      onUpdateObject(gesture.id, { x: gesture.startX + dx, y: gesture.startY + dy });
    } else {
      const point = getStagePoint(event, svgRef.current, gesture.zoom);
      if (gesture.type === 'resize') {
        const currentDistance = distance(point, gesture.center);
        const ratio = currentDistance / Math.max(gesture.startDistance, 1);
        const scale = clamp(ratio, 0.12, 6);
        onUpdateObject(gesture.id, {
          width: clamp(gesture.startWidth * scale, 32, 1700),
          height: clamp(gesture.startHeight * scale, 32, 980),
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

  return (
    <section className="workspace" aria-label="Рабочий холст">
      <div className="workspace-topline">
        <div className="breadcrumb"><span>Проект</span><span className="breadcrumb-separator">/</span><strong>Новая композиция</strong><span className="unsaved-dot" title="Локальный проект" /></div>
        <div className="canvas-size-label"><span className="status-dot" /> </div>
      </div>

      <div
        ref={viewportRef}
        className={`canvas-viewport${isPanning ? ' is-panning' : ''}`}
        onWheel={onWheel}
      >
        <div className="canvas-backdrop-glow" />
        <div
          className="artboard"
          style={{ transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg
            ref={svgRef}
            className="composition-svg"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Редактируемый SVG-холст"
          >
            <rect className="artboard-background" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
            {objects.map((object) => (
              <Artwork
                key={object.id}
                object={object}
                item={itemById.get(object.libraryId)}
                selected={object.id === selectedId}
                onPointerDown={startGesture}
              />
            ))}
            {selectedObject && itemById.has(selectedObject.libraryId) && (
              <SelectionControls object={selectedObject} onPointerDown={startGesture} />
            )}
          </svg>
          <div className="artboard-dimension"><span />1920 × 1048</div>
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

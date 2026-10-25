const shared = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></>,
  upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v4h16v-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></>,
  'arrow-up': <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></>,
  'arrow-down': <><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></>,
  trash: <><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m6 7 1 13h10l1-13"/><path d="M9 7V4h6v3"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  download: <><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></>,
  'chevron-down': <><path d="m6 9 6 6 6-6"/></>,
  'chevron-up': <><path d="m6 15 6-6 6 6"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  'zoom-in': <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2M10.8 7.8v6M7.8 10.8h6"/></>,
  'zoom-out': <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2M7.8 10.8h6"/></>,
  fit: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 8h8v8H8z"/></>,
  mouse: <><rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 2.5v5"/></>,
  move: <><path d="M12 2v20M2 12h20"/><path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/></>,
  rotate: <><path d="M20 7v5h-5"/><path d="M20 12a8 8 0 1 1-2.34-5.66L20 9"/></>,
  sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z"/></>,
  file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7M8 14h8M8 18h8"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
  layersPlus: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/><path d="M19 3v6M16 6h6"/></>,
  arrowUpRight: <><path d="M7 17 17 7M7 7h10v10"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  unlock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.7-1.5"/></>,
  square: <><rect x="4" y="4" width="16" height="16" rx="1.5"/></>,
  'rectangle-vertical': <><rect x="6" y="2" width="12" height="20" rx="1.5"/></>,
  'rectangle-horizontal': <><rect x="2" y="6" width="20" height="12" rx="1.5"/></>,
};

export function Icon({ name, size = 18, strokeWidth }) {
  const content = icons[name] ?? icons.sparkles;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={shared.fill}
      stroke={shared.stroke}
      strokeWidth={strokeWidth ?? shared.strokeWidth}
      strokeLinecap={shared.strokeLinecap}
      strokeLinejoin={shared.strokeLinejoin}
      focusable="false"
    >
      {content}
    </svg>
  );
}

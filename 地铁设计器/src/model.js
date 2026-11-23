// 地铁设计器的数据模型与存档（v2）。
// 核心概念：
// - stations 是全局的（一个站可以被多条线路共用 → 换乘站）
// - line.stationIds 是按顺序引用的站 ID 列表；loop=true 时首尾相连
// - 每个站有自己独立的标签位置、旋转、字号
// - texts 是自由文字标注（标题 / 图例 / 说明）

export const LINE_PATTERNS = [
  { id: 'solid', name: '实线' },
  { id: 'dashed', name: '虚线' },
  { id: 'dotted', name: '点线' },
  { id: 'dashdot', name: '点划线' },
  { id: 'double', name: '双线' },
  { id: 'stripe', name: '条纹' },
  { id: 'zigzag', name: '锯齿' },
];

export const LABEL_POSITIONS = [
  { id: 'auto', name: '自动' },
  { id: 'top', name: '上' },
  { id: 'bottom', name: '下' },
  { id: 'left', name: '左' },
  { id: 'right', name: '右' },
  { id: 'topleft', name: '左上' },
  { id: 'topright', name: '右上' },
  { id: 'bottomleft', name: '左下' },
  { id: 'bottomright', name: '右下' },
  { id: 'custom', name: '自定义' },
];

export const STATION_SHAPES = [
  { id: 'circle', name: '圆形' },
  { id: 'square', name: '方形' },
  { id: 'diamond', name: '菱形' },
  { id: 'pill', name: '胶囊' },
];

export const CANVAS_PRESETS = [
  { w: 2400, h: 1600, name: '2400×1600' },
  { w: 3200, h: 2000, name: '3200×2000' },
  { w: 3600, h: 2700, name: '3600×2700' },
  { w: 4800, h: 3600, name: '4800×3600' },
  { w: 6000, h: 4000, name: '6000×4000' },
];

export const PALETTE = [
  '#e4002b', '#0072ce', '#00a651', '#f5a623', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#a855f7', '#ef4444', '#22c55e', '#eab308',
  '#78716c', '#0f172a', '#dc2626',
];

let seq = 0;
const uid = (p) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const newStation = (x, y, name) => ({
  id: uid('st'),
  x: Math.round(x),
  y: Math.round(y),
  name: name || '新站',
  labelPos: 'auto',
  labelDx: 0,
  labelDy: 0,
  fontSize: 13,
  rotate: 0,
  shape: 'circle',
  open: true,
});

export const newLine = (index) => ({
  id: uid('ln'),
  name: `${index + 1} 号线`,
  color: PALETTE[index % PALETTE.length],
  pattern: 'solid',
  width: 9,
  curve: 0,          // 0 = 直线折角；>0 = 平滑曲线强度
  loop: false,       // 首尾相连（环线）
  visible: true,
  opacity: 1,
  stationIds: [],
});

export const newText = (x, y, text) => ({
  id: uid('tx'),
  x: Math.round(x),
  y: Math.round(y),
  text: text || '文字标注',
  size: 20,
  color: '#0f172a',
  weight: 600,
  align: 'left',
  rotate: 0,
});

export function createDoc(name = '未命名线路网') {
  return {
    version: 2,
    name,
    canvas: {
      width: 2400,
      height: 1600,
      background: {
        type: 'white',      // white | city | china | tiles
        cityCode: '310000',
        opacity: 1,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        showNames: true,
        fit: 'contain',     // contain | cover | manual
        // ---- 街道级瓦片 ----
        tileZoom: 15,
        tileScale: 1,
        centerLon: 121.4737,
        centerLat: 31.2304,
        tileOpacity: 1,
      },
      showGrid: true,
      gridSize: 80,
      snap: 10,           // 拖动吸附格（0 = 不吸附）
      showScaleBar: false,
    },
    stations: [],
    lines: [newLine(0)],
    texts: [],
    activeLineId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** 把文档补齐成可用的形状（读旧存档时做一次迁移） */
export function normalizeDoc(doc) {
  if (!doc || typeof doc !== 'object') return createDoc();

  const bgIn = doc.canvas?.background || {};
  const d = {
    version: 2,
    name: doc.name || '未命名线路网',
    canvas: {
      width: Number(doc.canvas?.width) || 2400,
      height: Number(doc.canvas?.height) || 1600,
      background: {
        type: ['white', 'city', 'china', 'tiles'].includes(bgIn.type) ? bgIn.type : 'white',
        cityCode: bgIn.cityCode || '310000',
        opacity: typeof bgIn.opacity === 'number' ? bgIn.opacity : 1,
        scale: typeof bgIn.scale === 'number' ? bgIn.scale : 1,
        offsetX: Number(bgIn.offsetX) || 0,
        offsetY: Number(bgIn.offsetY) || 0,
        showNames: bgIn.showNames !== false,
        fit: ['contain', 'cover', 'manual'].includes(bgIn.fit) ? bgIn.fit : 'contain',
        tileZoom: Number(bgIn.tileZoom) || 15,
        tileScale: Number(bgIn.tileScale) || 1,
        centerLon: Number.isFinite(Number(bgIn.centerLon)) ? Number(bgIn.centerLon) : 121.4737,
        centerLat: Number.isFinite(Number(bgIn.centerLat)) ? Number(bgIn.centerLat) : 31.2304,
        tileOpacity: typeof bgIn.tileOpacity === 'number' ? bgIn.tileOpacity : 1,
      },
      showGrid: doc.canvas?.showGrid !== false,
      gridSize: Number(doc.canvas?.gridSize) || 80,
      snap: Number.isFinite(doc.canvas?.snap) ? Number(doc.canvas.snap) : 10,
      showScaleBar: !!doc.canvas?.showScaleBar,
    },
    stations: Array.isArray(doc.stations) ? doc.stations.map((s) => ({
      id: s.id || uid('st'),
      x: Number(s.x) || 0,
      y: Number(s.y) || 0,
      name: String(s.name ?? '新站'),
      labelPos: s.labelPos || 'auto',
      labelDx: Number(s.labelDx) || 0,
      labelDy: Number(s.labelDy) || 0,
      fontSize: Number(s.fontSize) || 13,
      rotate: Number(s.rotate) || 0,
      shape: STATION_SHAPES.some((x) => x.id === s.shape) ? s.shape : 'circle',
      open: s.open !== false,
    })) : [],
    lines: Array.isArray(doc.lines) && doc.lines.length ? doc.lines.map((l, i) => ({
      id: l.id || uid('ln'),
      name: l.name || `${i + 1} 号线`,
      color: l.color || PALETTE[i % PALETTE.length],
      pattern: LINE_PATTERNS.some((p) => p.id === l.pattern) ? l.pattern : 'solid',
      width: Number(l.width) || 9,
      curve: Number(l.curve) || 0,
      loop: !!l.loop,
      visible: l.visible !== false,
      opacity: typeof l.opacity === 'number' ? l.opacity : 1,
      stationIds: Array.isArray(l.stationIds) ? l.stationIds : [],
    })) : [newLine(0)],
    texts: Array.isArray(doc.texts) ? doc.texts.map((t, i) => ({
      id: t.id || uid(`tx${i}`),
      x: Number(t.x) || 0,
      y: Number(t.y) || 0,
      text: String(t.text ?? ''),
      size: Number(t.size) || 20,
      color: t.color || '#0f172a',
      weight: Number(t.weight) || 600,
      align: t.align || 'left',
      rotate: Number(t.rotate) || 0,
    })) : [],
    createdAt: doc.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  d.activeLineId = doc.activeLineId && d.lines.some((l) => l.id === doc.activeLineId)
    ? doc.activeLineId
    : d.lines[0].id;
  return d;
}

// ---------------- 存档 ----------------
const PREFIX = 'metro-save:';
export const SLOTS = ['auto', '1', '2', '3'];
export const SLOT_LABELS = { auto: '自动存档', 1: '存档 1', 2: '存档 2', 3: '存档 3' };

export function saveDoc(slot, doc) {
  try {
    const payload = { version: 2, savedAt: Date.now(), doc: { ...doc, updatedAt: Date.now() } };
    localStorage.setItem(PREFIX + slot, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

export function loadDoc(slot) {
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.doc) return null;
    return { savedAt: p.savedAt, doc: normalizeDoc(p.doc) };
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  localStorage.removeItem(PREFIX + slot);
}

export function describe(doc) {
  const bg = doc.canvas?.background?.type || 'white';
  return {
    name: doc.name,
    lines: doc.lines.length,
    stations: doc.stations.length,
    bg,
    tileZoom: doc.canvas?.background?.tileZoom || 0,
    size: `${doc.canvas.width}×${doc.canvas.height}`,
  };
}

export function listSaves() {
  return SLOTS.map((slot) => {
    const s = loadDoc(slot);
    return s ? { slot, label: SLOT_LABELS[slot], savedAt: s.savedAt, meta: describe(s.doc) }
      : { slot, label: SLOT_LABELS[slot], savedAt: null, meta: null };
  });
}

export function exportDoc(doc) {
  const blob = new Blob([JSON.stringify({ version: 2, savedAt: Date.now(), doc }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `地铁线路-${doc.name || '未命名'}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result));
        if (!p || !p.doc) { resolve({ ok: false, message: '不是有效的线路文件' }); return; }
        resolve({ ok: true, doc: normalizeDoc(p.doc) });
      } catch (e) {
        resolve({ ok: false, message: '解析失败：' + e.message });
      }
    };
    reader.onerror = () => resolve({ ok: false, message: '读取失败' });
    reader.readAsText(file);
  });
}

export function timeAgo(ts) {
  if (!ts) return '';
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

// ---------------- 自动标签方向 ----------------
/** 根据站点在折线中的走向，给出默认标签位置 */
export function autoLabelPos(station, neighbors) {
  if (!neighbors.length) return 'right';
  const ax = neighbors.reduce((a, n) => a + n.x, 0) / neighbors.length;
  const ay = neighbors.reduce((a, n) => a + n.y, 0) / neighbors.length;
  const dx = station.x - ax;
  const dy = station.y - ay;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

// ---------------- 示例线路网 ----------------
/**
 * 生成一个示例：3 条线 + 若干换乘站 + 环线，方便第一次打开时看到效果。
 * 坐标系基于 2400×1600 的画布。
 */
export function createDemoDoc() {
  const doc = createDoc('示例 · 三线换乘');
  // 同名站复用同一个 id → 自动成为换乘站
  const byName = new Map();
  const S = (x, y, name, labelPos = 'auto') => {
    if (byName.has(name)) return byName.get(name);
    const s = newStation(x, y, name);
    s.labelPos = labelPos;
    doc.stations.push(s);
    byName.set(name, s.id);
    return s.id;
  };
  const L = (name, color, pattern, width, ids) => {
    const l = newLine(doc.lines.length);
    Object.assign(l, { name, color, pattern, width, stationIds: ids });
    doc.lines.push(l);
    return l;
  };

  const l1 = [
    S(300, 700, '西站', 'left'),
    S(600, 700, '人民广场'),
    S(900, 700, '中山公园'),
    S(1200, 700, '中央枢纽'),
    S(1500, 700, '科技园'),
    S(1800, 700, '东站', 'right'),
  ];
  const l2 = [
    S(1200, 300, '北苑', 'top'),
    S(1200, 500, '体育中心'),
    S(1200, 700, '中央枢纽'),
    S(1200, 900, '老城区'),
    S(1200, 1100, '南湖', 'bottom'),
  ];
  const l3 = [
    S(900, 700, '中山公园'),
    S(1000, 900, '文化街'),
    S(1200, 900, '老城区'),
    S(1500, 1000, '滨江', 'right'),
  ];
  // 4 号线：环线
  const l4 = [
    S(700, 1150, '环西'),
    S(950, 1250, '环南'),
    S(1250, 1250, '环东'),
    S(1450, 1150, '环北'),
  ];

  Object.assign(doc.lines[0], { name: '1 号线', color: '#e4002b', stationIds: l1 });
  L('2 号线', '#0072ce', 'solid', 9, l2);
  L('3 号线', '#00a651', 'dashed', 8, l3);
  const loop = L('4 号线（环线）', '#8b5cf6', 'solid', 7, l4);
  loop.loop = true;
  loop.curve = 1;

  doc.activeLineId = doc.lines[0].id;
  return normalizeDoc(doc);
}

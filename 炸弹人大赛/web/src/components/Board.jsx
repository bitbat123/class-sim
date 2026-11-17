import React, { useEffect, useRef, useState } from 'react';

// 位图风格：墙深灰、空地透明、玩家1 青色、玩家2 橙色、敌人红色、炸弹黄色（闪烁）、爆炸橙红
const CELL = 34;

/** 炸弹人棋盘：把坐标画成格子。纯展示，不含任何游戏逻辑。 */
export default function Board({ snapshot, title, highlight }) {
  const ref = useRef(null);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 220);
    return () => clearInterval(t);
  }, []);

  if (!snapshot) {
    return (
      <div className="board-empty">
        <p className="muted">{title || '棋盘'}：等待开局…</p>
      </div>
    );
  }

  const { width, height, grid, players, enemies, bombs, explosions } = snapshot;
  const bombSet = new Set(bombs.map((b) => `${b.x},${b.y}`));
  const boomSet = new Set((explosions || []).map(([x, y]) => `${x},${y}`));
  const enemySet = new Set((enemies || []).map((e) => `${e.x},${e.y}`));
  const playerAt = new Map((players || []).map((p, i) => [`${p.x},${p.y}`, { ...p, id: i }]));

  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const isWall = grid[y][x] === '#';
      const p = playerAt.get(key);
      const cls = ['cell'];
      if (isWall) cls.push('wall');
      if (boomSet.has(key)) cls.push('boom');
      if (bombSet.has(key)) cls.push('bomb');
      if (blink && bombSet.has(key)) cls.push('bomb-blink');
      if (enemySet.has(key)) cls.push('enemy');
      if (p) cls.push(p.alive ? (p.id === 0 ? 'p1' : 'p2') : 'dead');
      cells.push(
        <div
          key={key}
          className={cls.join(' ')}
          style={{ width: CELL, height: CELL }}
          title={`(${x},${y})${isWall ? ' 墙' : ''}`}
        >
          {p && !isWall && <span className="dot">{p.id === 0 ? '1' : '2'}</span>}
          {!p && enemySet.has(key) && <span className="dot enemy-dot">E</span>}
          {!p && !enemySet.has(key) && bombSet.has(key) && <span className="dot bomb-dot">●</span>}
        </div>
      );
    }
  }

  return (
    <div className={`board ${highlight ? 'hl' : ''}`} ref={ref}>
      {title && <div className="board-title">{title}</div>}
      <div className="board-grid" style={{ gridTemplateColumns: `repeat(${width}, ${CELL}px)` }}>
        {cells}
      </div>
      <div className="board-meta muted small">
        回合 {snapshot.turn} · 玩家1 炸弹 {snapshot.players?.[0]?.bombsPlaced ?? 0} · 玩家2 炸弹 {snapshot.players?.[1]?.bombsPlaced ?? 0}
        {snapshot.over && <strong> · 结果：{snapshot.result}</strong>}
      </div>
    </div>
  );
}

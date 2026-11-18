import React from 'react';
import { SIZE, EMPTY } from '@shared/game.js';

const CELL = 30;
const STAR = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];

/** 五子棋棋盘：把坐标画成格子。纯展示。 */
export default function Board({ snapshot, title }) {
  if (!snapshot) {
    return (
      <div className="board-empty">
        <p className="muted">{title || '棋盘'}：等待开局…</p>
      </div>
    );
  }
  const { board, lastMove, winnerLine, result, turn } = snapshot;
  const winSet = new Set((winnerLine || []).map(([x, y]) => `${x},${y}`));
  const starSet = new Set(STAR.map(([x, y]) => `${x},${y}`));

  const cells = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const key = `${x},${y}`;
      const v = board[y][x];
      const cls = ['gcell'];
      if (v === 1) cls.push('black');
      if (v === 2) cls.push('white');
      if (lastMove && lastMove.x === x && lastMove.y === y) cls.push('last');
      if (winSet.has(key)) cls.push('win');
      cells.push(
        <div key={key} className={cls.join(' ')} style={{ width: CELL, height: CELL }} title={`(${x},${y})`}>
          {v !== EMPTY && <span className="stone" />}
          {v === EMPTY && starSet.has(key) && <span className="star" />}
        </div>
      );
    }
  }

  return (
    <div className="gb-wrap">
      {title && <div className="board-title">{title}</div>}
      <div className="gb" style={{ gridTemplateColumns: `repeat(${SIZE}, ${CELL}px)` }}>
        {cells}
      </div>
      <div className="board-meta muted small">
        第 {turn} 手 · {result ? `结果：${result === 'black' ? '黑方胜' : result === 'white' ? '白方胜' : '平局'}` : '进行中'}
      </div>
    </div>
  );
}

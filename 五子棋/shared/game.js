// 五子棋规则（纯逻辑）。棋盘 15×15，双方轮流落子，先连成五子者胜。
import { createDialect } from './dialect.js';

export const SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const MAX_TURNS = 225;

export const goDialect = createDialect({ namespace: 'go', header: 'go.h', label: '五子棋方言' });
export const { checkCode, parse, Interpreter, Pair, DialectError, TimeLimitError } = goDialect;

export function createGame() {
  return {
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY)),
    turn: 0,
    current: BLACK,        // 黑先
    over: false,
    result: null,          // 'black' | 'white' | 'draw'
    winnerLine: null,      // 连成五子的坐标
    events: [],
    lastMove: null,
    moves: [],             // 落子历史，用于回放
    illegal: { black: 0, white: 0 },
    pendingMove: null,
  };
}

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

/** 判断某点落下后是否连成五子，返回连续的坐标数组或 null */
export function findFive(board, x, y) {
  const color = board[y][x];
  if (color === EMPTY) return null;
  for (const [dx, dy] of DIRS) {
    const line = [[x, y]];
    for (const sign of [1, -1]) {
      let cx = x + dx * sign;
      let cy = y + dy * sign;
      while (inside(cx, cy) && board[cy][cx] === color) {
        line.push([cx, cy]);
        cx += dx * sign;
        cy += dy * sign;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

/** 落子。坐标非法或已有棋子会记一次违规并判负（每方最多 3 次机会） */
export function place(g, color, x, y) {
  g.events = [];
  if (g.over) return g;
  const who = color === BLACK ? 'black' : 'white';
  const isIllegal = !inside(x, y) || g.board[y][x] !== EMPTY;
  if (isIllegal) {
    g.illegal[who]++;
    g.events.push(`${who === 'black' ? '黑方' : '白方'}违规落子（${x},${y}），第 ${g.illegal[who]} 次`);
    if (g.illegal[who] >= 3) {
      g.over = true;
      g.result = who === 'black' ? 'white' : 'black';
      g.events.push('违规三次，判负');
    }
    return g;
  }
  g.board[y][x] = color;
  g.turn++;
  g.lastMove = { x, y, color };
  g.moves.push({ turn: g.turn, color, x, y });
  const five = findFive(g.board, x, y);
  if (five) {
    g.over = true;
    g.result = who;
    g.winnerLine = five;
    g.events.push(`${who === 'black' ? '黑方' : '白方'}连成五子，获胜`);
  } else if (g.turn >= MAX_TURNS) {
    g.over = true;
    g.result = 'draw';
    g.events.push('棋盘已满，平局');
  } else {
    g.current = color === BLACK ? WHITE : BLACK;
  }
  return g;
}

/** 给一方生成 go:: 宿主接口（只读局面 + 一个可写的落子坐标） */
export function makeHost(g, color) {
  const my = color;
  const opp = color === BLACK ? WHITE : BLACK;
  const meName = color === BLACK ? 'black' : 'white';

  const cellsOf = (c) => {
    const out = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (g.board[y][x] === c) out.push(new Pair(x, y));
    return out;
  };

  const readers = {
    me: () => my,
    my_color: () => my,
    opp_color: () => opp,
    size: () => SIZE,
    turn: () => g.turn,
    last_move: () => (g.lastMove ? new Pair(g.lastMove.x, g.lastMove.y) : new Pair(-1, -1)),
    last_color: () => (g.lastMove ? g.lastMove.color : 0),
    my_stones: () => cellsOf(my),
    opp_stones: () => cellsOf(opp),
    move_x: () => (g.pendingMove ? g.pendingMove.x : -1),
    move_y: () => (g.pendingMove ? g.pendingMove.y : -1),
    illegal_count: () => g.illegal[meName],
  };

  const funcs = {
    at: (args) => {
      const [x, y] = args;
      if (!inside(x, y)) return -1;
      return g.board[y][x];
    },
    is_empty: (args) => {
      const [x, y] = args;
      return inside(x, y) && g.board[y][x] === EMPTY;
    },
    in_board: (args) => inside(args[0], args[1]),
    // 返回 (x,y) 落子后我方能连成几个
    count_line: (args) => {
      const [x, y] = args;
      if (!inside(x, y) || g.board[y][x] !== EMPTY) return -1;
      let best = 1;
      for (const [dx, dy] of DIRS) {
        let n = 1;
        for (const sign of [1, -1]) {
          let cx = x + dx * sign;
          let cy = y + dy * sign;
          while (inside(cx, cy) && g.board[cy][cx] === my) { n++; cx += dx * sign; cy += dy * sign; }
        }
        if (n > best) best = n;
      }
      return best;
    },
  };

  return {
    read(name, line) {
      if (!(name in readers)) throw new DialectError(`go::${name} 不存在`, line);
      return readers[name]();
    },
    writableType(name) {
      if (name === 'move_x' || name === 'move_y') return 'int';
      return null;
    },
    write(name, value) {
      if (!g.pendingMove) g.pendingMove = { x: -1, y: -1 };
      if (name === 'move_x') g.pendingMove.x = value;
      if (name === 'move_y') g.pendingMove.y = value;
    },
    call(name, args, line) {
      if (!(name in funcs)) throw new DialectError(`go::${name}() 不存在`, line);
      return funcs[name](args);
    },
  };
}

/** 走一手：调用当前方的 main()，读取 go::move_x / move_y 落子 */
export function runTurn(g, interpreters) {
  const color = g.current;
  const interp = interpreters[color === BLACK ? 'black' : 'white'];
  g.pendingMove = null;
  let error = null;
  if (!interp) {
    error = { message: '没有提供程序' };
  } else {
    try {
      interp.runMain(makeHost(g, color));
    } catch (e) {
      error = { message: e.message, line: e.line };
    }
  }
  const mv = g.pendingMove;
  if (!mv || mv.x < 0 || mv.y < 0) {
    // 没给出落子：按顺序找第一个空格，保证对局能继续
    let placed = false;
    for (let y = 0; y < SIZE && !placed; y++) {
      for (let x = 0; x < SIZE && !placed; x++) {
        if (g.board[y][x] === EMPTY) { place(g, color, x, y); placed = true; }
      }
    }
  } else {
    place(g, color, mv.x, mv.y);
  }
  return { error, move: g.lastMove };
}

export function snapshot(g) {
  return {
    board: g.board.map((r) => r.slice()),
    turn: g.turn,
    current: g.current,
    over: g.over,
    result: g.result,
    winnerLine: g.winnerLine,
    lastMove: g.lastMove,
    events: g.events,
    illegal: { ...g.illegal },
  };
}

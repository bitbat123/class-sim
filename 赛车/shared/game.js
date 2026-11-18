// 赛车规则（纯逻辑）：随机跑道 + 简化物理。
// 物理采用街机式模型（避免车辆原地打转）：
//   - 前进速度 speed：油门加速、阻力减速；
//   - 横向位置 x：转向改变横向速度；
//   - 沿赛道的进度 progress = y / 赛道长度，单调增加。
// 赛道由固定种子生成，同一场比赛双方看到同一条道。
import { createDialect } from './dialect.js';

export const raceDialect = createDialect({ namespace: 'car', header: 'car.h', label: '赛车方言' });
export const { checkCode, parse, Interpreter, Pair, DialectError, TimeLimitError } = raceDialect;

export const TRACK_LEN = 9000;     // 赛道长度（世界单位）
export const TRACK_W = 240;        // 赛道宽度（中心线左右各 120）
export const MAX_TICKS = 1800;     // 最多模拟帧数（约 30 秒）
export const MAX_SPEED = 26;       // 每帧最大前进位移
export const ACCEL = 0.09;         // 油门加速度（每帧速度增量）
export const DRAG = 0.012;         // 速度自然衰减系数
export const STEER_RATE = 1.9;     // 横向速度上限（每帧位移）
export const OFFTRACK_SLOW = 0.55; // 出界后速度保留比例（每帧）
export const LATERAL_DAMP = 0.82;  // 横向速度衰减

/** 用固定种子生成跑道：中心线横向偏移随进度平滑变化 */
export function buildTrack(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const SEGS = 8;
  const base = [];
  for (let i = 0; i <= SEGS; i++) base.push((rnd() * 2 - 1) * (TRACK_W * 0.42));

  const centerAt = (progress) => {
    const t = Math.max(0, Math.min(1, progress)) * SEGS;
    const i = Math.min(SEGS - 1, Math.floor(t));
    const f = t - i;
    const s = (1 - Math.cos(f * Math.PI)) / 2;
    return base[i] * (1 - s) + base[i + 1] * s;
  };
  return { seed, centerAt, width: TRACK_W, length: TRACK_LEN };
}

export function createRace(seed) {
  const track = buildTrack(seed);
  const startCenter = track.centerAt(0);
  const race = {
    track,
    tick: 0,
    over: false,
    result: null,
    cars: [0, 1].map((id) => ({
      id,
      x: 0,
      y: 0,
      speed: 0,
      lateral: 0,
      progress: 0,
      offTrack: false,
      finished: false,
      finishTick: null,
      throttleInput: 0,
      steerInput: 0,
      crashes: 0,
      lastError: null,
      trail: [],
    })),
    events: [],
  };
  race.cars[0].x = startCenter - 40;
  race.cars[1].x = startCenter + 40;
  return race;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 给一方生成 car:: 宿主接口。可写：throttle（0–100）、steer（-100–100） */
export function makeHost(race, id) {
  const me = race.cars[id];
  const other = race.cars[1 - id];
  const center = race.track.centerAt(me.progress);

  const readers = {
    my_x: () => Math.round(me.x),
    my_y: () => Math.round(me.y),
    my_speed: () => Math.round(me.speed * 10),
    my_progress: () => Math.round(me.progress * 1000),
    opp_progress: () => Math.round(other.progress * 1000),
    opp_x: () => Math.round(other.x),
    opp_y: () => Math.round(other.y),
    track_width: () => race.track.width,
    track_left: () => Math.round(-race.track.width / 2),
    track_right: () => Math.round(race.track.width / 2),
    center_offset: () => Math.round(center),
    off_track: () => me.offTrack,
    tick: () => race.tick,
    throttle: () => me.throttleInput,
    steer: () => me.steerInput,
  };

  const funcs = {
    distance_to_center: () => Math.round(Math.abs(me.x - center)),
    // 前方 d 处中心线的横向位置
    center_ahead: (args) => {
      const aheadY = me.y + (args[0] || 0);
      return Math.round(race.track.centerAt(clamp(aheadY / TRACK_LEN, 0, 1)));
    },
    // 前方 d 处的允许横向范围 [left, right]
    boundary_ahead: (args) => {
      const aheadY = me.y + (args[0] || 0);
      const c = race.track.centerAt(clamp(aheadY / TRACK_LEN, 0, 1));
      return [Math.round(c - race.track.width / 2), Math.round(c + race.track.width / 2)];
    },
    abs: (args) => Math.abs(args[0]),
    max: (args) => Math.max(args[0], args[1]),
    min: (args) => Math.min(args[0], args[1]),
  };

  return {
    read(name, line) {
      if (!(name in readers)) throw new DialectError(`car::${name} 不存在`, line);
      return readers[name]();
    },
    writableType(name) {
      if (name === 'throttle' || name === 'steer') return 'int';
      return null;
    },
    write(name, value) {
      if (name === 'throttle') me.throttleInput = clamp(value, 0, 100);
      if (name === 'steer') me.steerInput = clamp(value, -100, 100);
    },
    call(name, args, line) {
      if (!(name in funcs)) throw new DialectError(`car::${name}() 不存在`, line);
      return funcs[name](args);
    },
  };
}

/** 一帧物理：throttle 0–100，steer -100（左）到 100（右） */
export function stepRace(race) {
  if (race.over) return race;
  race.tick++;
  race.events = [];

  for (const car of race.cars) {
    if (car.finished) continue;

    car.speed += (car.throttleInput / 100) * ACCEL;
    car.speed -= car.speed * DRAG;
    if (car.offTrack) car.speed *= OFFTRACK_SLOW;
    car.speed = clamp(car.speed, 0, MAX_SPEED);

    const steerAuthority = (car.speed / MAX_SPEED) * STEER_RATE * (car.offTrack ? 0.5 : 1);
    car.lateral += (car.steerInput / 100) * steerAuthority * 0.35;
    car.lateral *= LATERAL_DAMP;
    car.lateral = clamp(car.lateral, -STEER_RATE, STEER_RATE);

    car.y += car.speed;
    car.x += car.lateral;
    car.progress = clamp(car.y / TRACK_LEN, 0, 1);

    const centerNow = race.track.centerAt(car.progress);
    const off = Math.abs(car.x - centerNow) > race.track.width / 2;
    if (off && !car.offTrack) {
      car.crashes++;
      race.events.push(`车 ${car.id + 1} 冲出赛道`);
    }
    car.offTrack = off;

    if (race.tick % 3 === 0) {
      car.trail.push([Math.round(car.x), Math.round(car.y)]);
      if (car.trail.length > 120) car.trail.shift();
    }

    if (car.y >= TRACK_LEN && !car.finished) {
      car.finished = true;
      car.finishTick = race.tick;
      race.events.push(`车 ${car.id + 1} 冲线`);
    }
  }

  const done = race.cars.filter((c) => c.finished);
  if (done.length === 2) {
    race.over = true;
    race.result = done[0].finishTick === done[1].finishTick
      ? 'draw'
      : (done[0].finishTick < done[1].finishTick ? 'car1' : 'car2');
  } else if (done.length === 1 && race.tick > done[0].finishTick + 300) {
    race.over = true;
    race.result = done[0].id === 0 ? 'car1' : 'car2';
  } else if (race.tick >= MAX_TICKS) {
    race.over = true;
    race.result = Math.abs(race.cars[0].progress - race.cars[1].progress) < 1e-9
      ? 'draw'
      : (race.cars[0].progress > race.cars[1].progress ? 'car1' : 'car2');
    race.events.push('时间到，按进度判定');
  }
  return race;
}

export function runFrame(race, id, interp) {
  const car = race.cars[id];
  car.console = [];
  if (!interp || car.finished) return { ok: true, console: car.console };
  car.throttleInput = 0;
  car.steerInput = 0;
  try {
    // 捕获 cout 输出，供前端控制台面板显示
    const host = makeHost(race, id);
    host.console = (line) => {
      if (car.console.length < 60) car.console.push(line);
    };
    interp.runMain(host);
    return { ok: true, console: car.console };
  } catch (e) {
    car.throttleInput = 0;
    car.steerInput = 0;
    return { ok: false, console: car.console, error: e.message, line: e.line };
  }
}

export function snapshot(race) {
  return {
    tick: race.tick,
    over: race.over,
    result: race.result,
    cars: race.cars.map((c) => ({
      id: c.id,
      x: Math.round(c.x),
      y: Math.round(c.y),
      speed: Math.round(c.speed * 10) / 10,
      progress: Math.round(c.progress * 1000) / 1000,
      offTrack: c.offTrack,
      finished: c.finished,
      crashes: c.crashes,
      trail: c.trail.slice(-60),
    })),
    track: {
      length: race.track.length,
      width: race.track.width,
      seed: race.track.seed,
      samples: Array.from({ length: 61 }, (_, i) => {
        const p = i / 60;
        return [Math.round(race.track.centerAt(p) * 10) / 10, Math.round(p * 1000) / 1000];
      }),
    },
    events: race.events,
  };
}

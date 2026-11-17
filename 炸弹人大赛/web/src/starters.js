import { BASELINES } from '@shared/baselines.js';

// 编辑器里默认展示的模板：演示方言与普通 C++ 的差异，并且能直接跑起来
export const DEFAULT_CODE = `#include<bomb.h>
// 这是炸弹人方言，不是普通 C++：
// 1) 必须引入 <bomb.h>，不能引入 iostream 等输入输出头文件；
// 2) 没有 std、没有字符串、没有指针，也不能用 cout / cin；
// 3) 访问游戏状态一律加 bomb:: 前缀，例如 bomb::player_pos；
// 4) 只能写 bomb::player_dir（0上 1右 2下 3左）和 bomb::player_bomb（true/false）；
//    其他 bomb:: 变量（敌人、炸弹、墙壁、对手位置…）都是只读的；
// 5) 每回合调用一次 void main()，单次运行超过 50ms 会被判超时。

void main() {
  pair me = bomb::player_pos;
  pair foe = bomb::enemy_pos[0];

  int dx = foe.first - me.first;
  int dy = foe.second - me.second;

  int d = 0;
  if (dx > 0) d = 1;
  if (dy > 0) d = 2;
  if (dx < 0) d = 3;

  if (bomb::can_move(d)) {
    bomb::player_dir = d;
  }

  if (bomb::dist(me, foe) <= 2 && bomb::cooldown == 0) {
    bomb::player_bomb = true;
  }
}`;

// 可插值的列表：把基准程序也放进来，方便选手参考
export const STARTERS = [
  { id: 'default', name: '默认模板', src: DEFAULT_CODE },
  { id: 'weak', name: BASELINES.weak.name, src: BASELINES.weak.src },
  { id: 'medium', name: BASELINES.medium.name, src: BASELINES.medium.src },
  { id: 'strong', name: BASELINES.strong.name, src: BASELINES.strong.src },
];

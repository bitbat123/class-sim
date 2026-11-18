import { BASELINES } from '@shared/baselines.js';

// 编辑器里默认展示的模板：演示方言与普通 C++ 的差异，并且能直接跑起来
export const DEFAULT_CODE = `#include<bomb.h>
// 这是炸弹人方言，不是普通 C++：
// 1) 必须引入 <bomb.h>，不能引入 iostream 头文件（但可以用 cout 调试）；
// 2) 访问游戏状态一律加 bomb:: 前缀；
// 3) 只能写 bomb::player_dir（0上 1右 2下 3左）和 bomb::player_bomb（true/false）；
// 4) 每回合调用一次 void main()，单次运行超过 50ms 判超时。
//
// 调试：cout << "我的位置 " << bomb::player_pos.first << endl;
//      输出会显示在右侧「控制台」面板里。

void main() {
  int n = bomb::enemy_pos.size();
  if (n == 0) return;

  pair me = bomb::player_pos;
  pair foe = bomb::enemy_pos[0];

  // 选一个离敌人最近、且能走的方向
  int best = -1;
  int bestd = 999;
  for (int d = 0; d < 4; d++) {
    if (!bomb::can_move(d)) continue;
    int nx = me.first, ny = me.second;
    switch (d) {
      case 0: ny--; break;
      case 1: nx++; break;
      case 2: ny++; break;
      default: nx--; break;
    }
    int dd = bomb::dist(pair(nx, ny), foe);
    if (dd < bestd) { bestd = dd; best = d; }
  }

  // 脚下有炸弹且能安全撤离时，先跑
  if (bomb::in_danger(me)) {
    if (best >= 0) bomb::player_dir = best;
    return;
  }

  if (best >= 0) bomb::player_dir = best;

  // 距离够近、冷却好了、且炸完能逃掉，才放炸弹
  if (bestd <= 2 && bomb::cooldown == 0 && bomb::can_retreat()) {
    bomb::player_bomb = true;
    cout << "放炸弹！回合 " << bomb::turn << endl;
  }
}`;

// 可插值的列表：把基准程序也放进来，方便选手参考
export const STARTERS = [
  { id: 'default', name: '默认模板', src: DEFAULT_CODE },
  { id: 'weak', name: BASELINES.weak.name, src: BASELINES.weak.src },
  { id: 'medium', name: BASELINES.medium.name, src: BASELINES.medium.src },
  { id: 'strong', name: BASELINES.strong.name, src: BASELINES.strong.src },
];

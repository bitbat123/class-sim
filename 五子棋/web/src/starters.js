import { BASELINES } from '@shared/baselines.js';
import { goDialect } from '@shared/game.js';

const { Pair } = goDialect;

// 编辑器默认模板：演示五子棋方言与普通 C++ 的差异
export const DEFAULT_CODE = `#include<go.h>
// 这是五子棋方言，不是普通 C++：
// 1) 必须引入 <go.h>，不能引入 iostream 等输入输出头文件；
// 2) 没有 std、没有字符串、没有指针，不能用 cout / cin；
// 3) 访问局面一律加 go:: 前缀，例如 go::my_stones、go::opp_stones；
// 4) 只能写 go::move_x 和 go::move_y（本回合落子的坐标）；
//    其他 go:: 变量（棋盘、对手棋子、上一步…）都是只读的；
// 5) 每回合调用一次 void main()，单次运行超过 50ms 判超时。

void main() {
  int best = -100000;
  int bx = -1;
  int by = -1;

  for (int y = 0; y < go::size; y++) {
    for (int x = 0; x < go::size; x++) {
      if (go::is_empty(x, y)) {
        // 落在这里能连成几个自己的子
        int mine = go::count_line(x, y);
        // 落在这里能挡住对手几个子
        int theirs = 0;
        for (int dy = -1; dy <= 1; dy++) {
          for (int dx = -1; dx <= 1; dx++) {
            if (go::at(x + dx, y + dy) == go::opp_color) theirs = theirs + 1;
          }
        }
        int score = mine * 100 + theirs * 60;
        if (score > best) {
          best = score;
          bx = x;
          by = y;
        }
      }
    }
  }

  if (bx >= 0) {
    go::move_x = bx;
    go::move_y = by;
  }
}`;

export const STARTERS = [
  { id: 'default', name: '默认模板', src: DEFAULT_CODE },
  { id: 'easy', name: BASELINES.easy.name, src: BASELINES.easy.src },
  { id: 'mid', name: BASELINES.mid.name, src: BASELINES.mid.src },
  { id: 'hard', name: BASELINES.hard.name, src: BASELINES.hard.src },
];

export { Pair };

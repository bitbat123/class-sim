// 五子棋基准程序：入门 / 进阶 / 高手
export const BASELINES = {
  easy: {
    name: '基准 · 入门',
    src: `#include<go.h>
// 入门：能成五就连，否则找第一个能连成 3 个的点。
void main() {
  int best = 0;
  int bx = -1;
  int by = -1;
  for (int y = 0; y < go::size; y++) {
    for (int x = 0; x < go::size; x++) {
      if (go::is_empty(x, y)) {
        int n = go::count_line(x, y);
        if (n > best) {
          best = n;
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
}`,
  },
  mid: {
    name: '基准 · 进阶',
    src: `#include<go.h>
// 进阶：优先占据已有棋子附近，并且优先连自己、堵对手。
int near_own(int x, int y) {
  int n = 0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      if (go::at(x + dx, y + dy) == go::my_color) n = n + 1;
    }
  }
  return n;
}
int near_opp(int x, int y) {
  int n = 0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      if (go::at(x + dx, y + dy) == go::opp_color) n = n + 1;
    }
  }
  return n;
}
void main() {
  int best = -100000;
  int bx = -1;
  int by = -1;
  for (int y = 0; y < go::size; y++) {
    for (int x = 0; x < go::size; x++) {
      if (go::is_empty(x, y)) {
        int score = go::count_line(x, y) * 100 + near_own(x, y) * 3 + near_opp(x, y) * 2;
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
}`,
  },
  hard: {
    name: '基准 · 高手',
    src: `#include<go.h>
// 高手：先找能直接成五的点；再找能堵住对手成五的点；否则用位置评分。
int around(int x, int y, int c) {
  int n = 0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      if (go::at(x + dx, y + dy) == c) n = n + 1;
    }
  }
  return n;
}
void main() {
  int bx = -1;
  int by = -1;
  int best = -1000000;
  for (int y = 0; y < go::size; y++) {
    for (int x = 0; x < go::size; x++) {
      if (go::is_empty(x, y)) {
        int mine = go::count_line(x, y);
        int theirs = around(x, y, go::opp_color);
        int score = 0;
        if (mine >= 5) score = 1000000;
        else if (theirs >= 4) score = 900000;
        else score = mine * 1000 + theirs * 300 + around(x, y, go::my_color) * 20;
        // 中心点略加分
        int cx = go::size / 2;
        score = score - (x - cx) * (x - cx) - (y - cx) * (y - cx);
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
}`,
  },
};

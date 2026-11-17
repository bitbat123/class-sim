// 三个基准程序（同一套炸弹人方言，编辑器里可以直接看）。
// 最弱：随机走，偶尔放炸弹，不看危险。
// 中等：朝最近的敌人走，但不会站进炸弹范围；敌人在射程内才放炸弹。
// 最强：每回合对四个方向打分：躲开炸弹与爆炸范围、靠近敌人、保留逃生路线；
//       只在放炸弹后能安全撤离时才放炸弹。

export const BASELINES = {
  weak: {
    name: '基准 · 最弱',
    src: `#include<bomb.h>
// 最弱基准：不看危险，随便走，偶尔放炸弹。
void main() {
  int d = bomb::turn % 4;
  if (bomb::can_move(d)) {
    bomb::player_dir = d;
  }
  if (bomb::turn % 9 == 0) {
    bomb::player_bomb = true;
  }
}`,
  },
  medium: {
    name: '基准 · 中等',
    src: `#include<bomb.h>
// 中等基准：朝最近的敌人走；敌人在炸弹射程内时放炸弹。不主动避开炸弹。
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
}`,
  },
  strong: {
    name: '基准 · 最强',
    src: `#include<bomb.h>
// 最强基准：先看四个方向的安全性，再选靠近敌人的安全方向；
// 只有在放炸弹后仍有安全撤离方向时才放炸弹。
void main() {
  pair me = bomb::player_pos;
  pair foe = bomb::enemy_pos[0];
  int best = -1;
  int bestscore = -100000;
  for (int d = 0; d < 4; d++) {
    if (bomb::can_move(d)) {
      int nx = me.first;
      int ny = me.second;
      if (d == 0) ny = ny - 1;
      if (d == 1) nx = nx + 1;
      if (d == 2) ny = ny + 1;
      if (d == 3) nx = nx - 1;
      pair np = pair(nx, ny);
      int score = 0 - bomb::dist(np, foe);
      // 在炸弹射程内的格子扣很多分（危险）
      if (bomb::in_danger(np)) score = score - 50;
      if (score > bestscore) {
        bestscore = score;
        best = d;
      }
    }
  }
  if (best >= 0) {
    bomb::player_dir = best;
  }
  if (bomb::dist(me, foe) <= 2 && bomb::cooldown == 0 && bomb::can_retreat()) {
    bomb::player_bomb = true;
  }
}`,
  },
};

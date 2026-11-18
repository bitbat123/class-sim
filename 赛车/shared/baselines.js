// 赛车基准程序：稳 / 中 / 快
export const BASELINES = {
  slow: {
    name: '基准 · 稳',
    src: `#include<car.h>
// 稳：低速直行，几乎不转向。
void main() {
  car::throttle = 35;
  car::steer = 0;
}`,
  },
  mid: {
    name: '基准 · 中',
    src: `#include<car.h>
// 中：全油门 + 按前方中心线简单修正方向。
void main() {
  car::throttle = 80;
  int ahead = car::center_ahead(300);
  int d = ahead - car::my_x;
  int s = 0;
  if (d > 10) s = 60;
  if (d < -10) s = -60;
  car::steer = s;
}`,
  },
  fast: {
    name: '基准 · 快',
    src: `#include<car.h>
// 快：预判更远，按偏差大小连续调整，直道全油门。
void main() {
  int ahead = car::center_ahead(500);
  int d = ahead - car::my_x;
  int s = 0;
  if (d > 40) s = 100;
  else if (d > 15) s = 55;
  else if (d < -40) s = -100;
  else if (d < -15) s = -55;
  int t = 100;
  if (car::off_track) t = 40;
  car::throttle = t;
  car::steer = s;
}`,
  },
};

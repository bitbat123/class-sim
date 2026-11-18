import { BASELINES } from '@shared/baselines.js';

// 赛车方言默认模板：演示与普通 C++ 的差异
export const DEFAULT_CODE = `#include<car.h>
// 这是赛车方言，不是普通 C++：
// 1) 必须引入 <car.h>，不能引入 iostream 等输入输出头文件；
// 2) 没有 std、没有字符串、没有指针，不能用 cout / cin；
// 3) 所有传感器都要加 car:: 前缀，例如 car::my_x、car::my_speed；
// 4) 只能写 car::throttle（0–100 油门）和 car::steer（-100 左 到 100 右）；
//    其他 car:: 变量（位置、速度、进度、赛道宽度…）都是只读的；
// 5) 每帧调用一次 void main()，单次运行超过 50ms 判超时。

void main() {
  // 看前方 400 个单位的中心线在哪
  int ahead = car::center_ahead(400);
  int diff = ahead - car::my_x;

  int steer = 0;
  if (diff > 40) steer = 100;
  else if (diff > 12) steer = 55;
  else if (diff < -40) steer = -100;
  else if (diff < -12) steer = -55;

  // 出界时收油，避免越跑越偏
  int throttle = 100;
  if (car::off_track) throttle = 35;

  car::steer = steer;
  car::throttle = throttle;
}`;

export const STARTERS = [
  { id: 'default', name: '默认模板', src: DEFAULT_CODE },
  { id: 'slow', name: BASELINES.slow.name, src: BASELINES.slow.src },
  { id: 'mid', name: BASELINES.mid.name, src: BASELINES.mid.src },
  { id: 'fast', name: BASELINES.fast.name, src: BASELINES.fast.src },
];

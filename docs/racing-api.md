# 赛车 API 参考（`car::`）

头文件：`#include<car.h>`　命名空间：`car::`　入口：`void main()`，**每一帧调用一次**。

## 一、可写变量（只有这两个）

| 变量 | 类型 | 取值范围 | 说明 |
|---|---|---|---|
| `car::throttle` | `int` | `0` ~ `100` | 油门。`0` 松油门，`100` 全油门；超出范围会被夹紧 |
| `car::steer` | `int` | `-100` ~ `100` | 转向。负数向左，正数向右，`0` 直行；超出范围会被夹紧 |

> 写其他 `car::` 变量会报错「是只读的，不能修改」，该帧车辆保持上次输入。

## 二、只读变量

| 变量 | 类型 | 说明 |
|---|---|---|
| `car::my_x` | `int` | 我的横向位置（世界坐标，已取整） |
| `car::my_y` | `int` | 我已跑过的距离（沿赛道，0 ~ 9000） |
| `car::my_speed` | `int` | 我的当前速度 ×10（即 250 表示 25.0） |
| `car::my_progress` | `int` | 我的进度 ×1000（即 500 表示 50%） |
| `car::opp_progress` | `int` | 对手进度 ×1000 |
| `car::opp_x` | `int` | 对手横向位置 |
| `car::opp_y` | `int` | 对手已跑距离 |
| `car::track_width` | `int` | 赛道宽度，固定 `240`（中心线左右各 120） |
| `car::track_left` | `int` | 赛道左边界，固定 `-120` |
| `car::track_right` | `int` | 赛道右边界，固定 `120` |
| `car::center_offset` | `int` | 我当前位置的赛道中心线横向坐标 |
| `car::off_track` | `bool` | 我是否已经出界 |
| `car::tick` | `int` | 当前帧号（从 1 开始） |
| `car::throttle` | `int` | 我本帧已设置的油门（默认 `0`） |
| `car::steer` | `int` | 我本帧已设置的转向（默认 `0`） |

## 三、只读函数

| 函数 | 返回 | 说明 |
|---|---|---|
| `car::center_ahead(d)` | `int` | 前方 `d` 距离处中心线的横向坐标 |
| `car::boundary_ahead(d)` | `pair` 数组（`[左边界, 右边界]`） | 前方 `d` 处的左右边界，用 `[0]` / `[1]` 取值 |
| `car::distance_to_center()` | `int` | 我离当前中心线的横向距离 |
| `car::abs(v)` | `int` | 绝对值 |
| `car::max(a, b)` | `int` | 较大值 |
| `car::min(a, b)` | `int` | 较小值 |

> `center_ahead(d)` 的 `d` 是**前进距离**（与 `my_y` 同单位），常用 `200` ~ `600`。

## 四、物理模型（简化街机式，非真实刚体）

| 项目 | 数值 / 规则 |
|---|---|
| 单帧加速度 | `throttle/100 × 0.09` |
| 速度衰减 | 每帧 `× 0.988` |
| 最高速度 | 26 / 帧 |
| 转向强度 | 与速度成正比，上限 1.9 / 帧 |
| 出界惩罚 | 速度每帧 `× 0.55`，转向能力减半 |
| 出界判定 | 离中心线横向距离 > 120 |
| 赛程 | 9000 单位 |
| 时限 | 1800 帧（约 30 秒），超时按进度判定 |

> 这是**简化的街机模型**，不包含轮胎摩擦、侧滑角、碰撞形变等真实物理。

## 五、最小可运行示例

```cpp
#include<car.h>
void main() {
  // 看前方 400 处的中心线
  int ahead = car::center_ahead(400);
  int diff = ahead - car::my_x;

  int steer = 0;
  if (diff > 40) steer = 100;
  else if (diff > 12) steer = 55;
  else if (diff < -40) steer = -100;
  else if (diff < -12) steer = -55;

  int throttle = 100;
  if (car::off_track) throttle = 35;

  car::steer = steer;
  car::throttle = throttle;
}
```

## 六、常见错误

| 错误写法 | 结果 |
|---|---|
| `#include<go.h>` | 语法错误：只允许 `<car.h>` |
| `car::my_x = 100;` | 运行时错误：只读变量 |
| `car::throttle = 500;` | 会被夹紧为 `100`（不报错） |
| 复杂循环超过 50ms | 运行时错误：超时，该帧不收油也不转向 |

更完整的语言差异见 [通用方言说明](./dialect.md)。

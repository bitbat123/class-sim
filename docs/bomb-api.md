# 炸弹人大赛 API 参考（`bomb::`）

头文件：`#include<bomb.h>`　命名空间：`bomb::`　入口：`void main()`，**每一回合调用一次**。

## 一、可写变量（只有这两个）

| 变量 | 类型 | 取值范围 | 说明 |
|---|---|---|---|
| `bomb::player_dir` | `int` | `-1` ~ `3` | 本回合移动方向。`0`=上 `1`=右 `2`=下 `3`=左；`-1` 或不设置 = 不动 |
| `bomb::player_bomb` | `bool` | `true` / `false` | 本回合是否尝试放炸弹。有冷却或脚下已有炸弹时无效 |

> 写其他 `bomb::` 变量会报错「是只读的，不能修改」，该回合作废（不动、不放炸弹）。

## 二、只读变量

| 变量 | 类型 | 说明 |
|---|---|---|
| `bomb::player_pos` | `pair` | 我的坐标 `(x, y)` |
| `bomb::other_pos` | `pair` | 对手坐标 `(x, y)` |
| `bomb::enemy_pos` | `pair` 数组 | **存活**敌人的坐标列表；用 `.size()` 取数量，`[i]` 取值 |
| `bomb::bomb_pos` | `pair` 数组 | 场上所有炸弹的坐标；`.size()` 取数量 |
| `bomb::wall_pos` | `pair` 数组 | 所有墙格坐标（地图固定，可用一次缓存） |
| `bomb::map_w` | `int` | 地图宽（格数，当前地图为 15） |
| `bomb::map_h` | `int` | 地图高（格数，当前地图为 11） |
| `bomb::my_score` | `int` | 我的得分（炸死敌人 +10） |
| `bomb::other_score` | `int` | 对手得分 |
| `bomb::turn` | `int` | 当前回合数（从 1 开始） |
| `bomb::is_alive` | `bool` | 我是否存活 |
| `bomb::cooldown` | `int` | 炸弹冷却剩余回合数，`0` 表示可以放 |
| `bomb::player_dir` | `int` | 我本回合已设置的方向（默认 `-1`） |
| `bomb::player_bomb` | `bool` | 我本回合已设置的放炸弹请求（默认 `false`） |

## 三、只读函数

| 函数 | 返回 | 说明 |
|---|---|---|
| `bomb::can_move(d)` | `bool` | 方向 `d` 的下一格能否走（不越界、不是墙、没有炸弹） |
| `bomb::is_wall(x, y)` | `bool` | 该格是否是墙（越界也返回 `true`） |
| `bomb::dist(a, b)` | `int` | 两个 `pair` 的曼哈顿距离 `\|a.x-b.x\| + \|a.y-b.y\|` |
| `bomb::in_danger(p)` | `bool` | 坐标 `p` 是否在**现有炸弹**的爆炸范围内 |
| `bomb::can_retreat()` | `bool` | 是否存在一个相邻可走且不在爆炸范围内的格子 |

## 四、规则要点

- 每回合最多移动一格；撞墙或被炸弹挡住则原地不动。
- 放炸弹后冷却 1 回合；同一格不能叠放炸弹。
- 炸弹引信 3 回合，爆炸范围向四个方向各 2 格，遇墙停止。
- 炸死敌人 +10 分；被炸到或撞到敌人即死亡。
- **先死者输**：只剩一方存活时，存活方赢下本局。
- 单局超过 **2 分钟**（300 回合）未结束，**放炸弹次数少的一方获胜**，相同则平局。
- **三局两胜**；每局换一张地图（共 10 张，固定不随机）。

## 五、最小可运行示例

```cpp
#include<bomb.h>
void main() {
  if (bomb::enemy_pos.size() == 0) return;

  pair me = bomb::player_pos;
  pair foe = bomb::enemy_pos[0];

  // 朝敌人走
  int d = 0;
  if (foe.first > me.first) d = 1;
  else if (foe.second > me.second) d = 2;
  else if (foe.first < me.first) d = 3;

  if (bomb::can_move(d)) bomb::player_dir = d;

  // 距离够近且能撤离时放炸弹
  if (bomb::dist(me, foe) <= 2 && bomb::cooldown == 0 && bomb::can_retreat()) {
    bomb::player_bomb = true;
  }
}
```

## 六、常见错误

| 错误写法 | 结果 |
|---|---|
| `#include<iostream>` | 语法错误：只允许 `<bomb.h>` |
| `int main()` / `return 0;` | 语法错误：必须 `void main()` |
| `std::cout << ...` | 语法错误：不认识 `std::` |
| `bomb::enemy_pos = 1;` | 运行时错误：只读变量 |
| `bomb::enemy_pos[99]` | 运行时错误：数组下标越界 |
| `while(true){}` | 运行时错误：步数过多 |
| 复杂循环超过 50ms | 运行时错误：超时 |

更完整的语言差异见 [通用方言说明](./dialect.md)。

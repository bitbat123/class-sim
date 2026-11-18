# 五子棋 API 参考（`go::`）

头文件：`#include<go.h>`　命名空间：`go::`　入口：`void main()`，**每回合调用一次**。

## 一、可写变量（只有这两个）

| 变量 | 类型 | 取值范围 | 说明 |
|---|---|---|---|
| `go::move_x` | `int` | `0` ~ `14` | 本回合落子的横坐标；不设置或设为 `-1` 表示放弃 |
| `go::move_y` | `int` | `0` ~ `14` | 本回合落子的纵坐标 |

> 必须**同时**设置 `move_x` 和 `move_y` 才会落子。两个值都是 `-1` 时视为弃权，系统自动替你填第一个空格。

## 二、只读变量

| 变量 | 类型 | 说明 |
|---|---|---|
| `go::size` | `int` | 棋盘边长，固定 `15`（即 15×15） |
| `go::me` | `int` | 我的身份常量：`1` = 黑，`2` = 白 |
| `go::my_color` | `int` | 同上，我执的颜色（`1` 黑 / `2` 白） |
| `go::opp_color` | `int` | 对手颜色（`1` 黑 / `2` 白） |
| `go::turn` | `int` | 已落子总数（从 0 开始） |
| `go::last_move` | `pair` | 对手上一步的坐标；开局时为 `pair(-1, -1)` |
| `go::last_color` | `int` | 上一步是谁下的（`1` / `2`，开局为 `0`） |
| `go::my_stones` | `pair` 数组 | 我方所有棋子的坐标，`.size()` 是数量 |
| `go::opp_stones` | `pair` 数组 | 对手所有棋子的坐标 |
| `go::move_x` | `int` | 我本回合已设置的 x（默认 `-1`） |
| `go::move_y` | `int` | 我本回合已设置的 y（默认 `-1`） |
| `go::illegal_count` | `int` | 我已累计的违规次数（达到 3 次判负） |

## 三、只读函数

| 函数 | 返回 | 说明 |
|---|---|---|
| `go::at(x, y)` | `int` | 该格内容：`0` 空 / `1` 黑 / `2` 白；越界返回 `-1` |
| `go::is_empty(x, y)` | `bool` | 该格是否为空（越界返回 `false`） |
| `go::in_board(x, y)` | `bool` | 坐标是否在棋盘内 |
| `go::count_line(x, y)` | `int` | **假设我在此处落子**，能连成几个我方棋子（含该点）；该格已有子或越界返回 `-1` |

## 四、规则要点

- 15×15 棋盘，**黑先**。
- 横、竖、斜任一方向连成 **5 个或以上**即获胜。
- 落子位置必须是空格；越界或重复落子算**违规**。
- 每方违规累计 **3 次即判负**。
- 棋盘填满且无人连五则为平局。
- 单次 `main()` 超过 50ms 判超时，本回合作废（视为弃权，系统填第一个空格）。

## 五、最小可运行示例

```cpp
#include<go.h>
void main() {
  int best = -100000;
  int bx = -1;
  int by = -1;

  for (int y = 0; y < go::size; y++) {
    for (int x = 0; x < go::size; x++) {
      if (go::is_empty(x, y)) {
        int mine = go::count_line(x, y);
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
}
```

## 六、常见错误

| 错误写法 | 结果 |
|---|---|
| `#include<bomb.h>` | 语法错误：只允许 `<go.h>` |
| `go::my_stones = 1;` | 运行时错误：只读变量 |
| `go::move_x = 20;` | 运行时错误：越界坐标，计一次违规 |
| 重复落在已有棋子处 | 计一次违规，累计 3 次判负 |
| 不设置 `move_x` / `move_y` | 视为弃权，系统替你落第一个空格 |

更完整的语言差异见 [通用方言说明](./dialect.md)。

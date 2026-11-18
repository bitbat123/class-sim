# 五子棋程序大赛

15×15 棋盘，双方各写一段类 C++ 代码，程序自动落子。

## 运行

`ash
npm install
npm run web:dev      # http://127.0.0.1:5182
npm run web:build    # 产物到 dist/
npm test             # 引擎测试（15 项）
`

## 方言（go.h）

| 差异 | 说明 |
|---|---|
| 头文件 | 必须 #include<go.h>；写 #include<iostream> 或 omb.h 都会报错 |
| 可写变量 | **只有** go::move_x 和 go::move_y（本回合落子坐标） |
| 只读变量 | my_color、opp_color、size、	urn、last_move、my_stones、opp_stones、illegal_count |
| 函数 | go::at(x,y)、go::is_empty(x,y)、go::in_board(x,y)、go::count_line(x,y) |

规则：黑先；连成五子获胜；违规落子（越界 / 重复）累计 3 次判负；棋盘填满为平局。

## 基准程序

- 入门：找能连成最多子的点
- 进阶：连自己 + 堵对手 + 靠近已有棋子
- 高手：先成五、再堵五，再用位置评分（含中心点权重）

## 部署

发布在 https://bitbat123.github.io/class-sim/gomoku/

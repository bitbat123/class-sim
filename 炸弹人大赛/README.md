# C++ 炸弹人程序大赛

两人各自写一段「类 C++」代码，让程序自动操作炸弹人，三局两胜。

## 目录结构

```
shared/            服务端与浏览器共用的核心（纯逻辑，无 DOM）
  interp.js        炸弹人方言解释器（词法/语法/求值，含 50ms 超时与步数上限）
  game.js          规则：移动、炸弹、爆炸、敌人、胜负判定、三局两胜
  maps.js          10 张硬编码地图（15×11，墙约 12%）
  match.js         赛制状态机：20 分钟编写 → 双方同意 → 三局两胜
  baselines.js     三个基准程序（最弱 / 中等 / 最强）
server/index.js    WebSocket 服务端（唯一裁判）
web/               React 前端（Monaco 编辑器 + 棋盘 + 联机）
scripts/           测试与工具脚本
```

## 运行

```bash
npm install

# 终端 1：服务端（默认 ws://127.0.0.1:8790）
npm run server

# 终端 2：前端开发服务器（http://127.0.0.1:5180）
npm run web:dev
```

构建与预览：

```bash
npm run web:build
npx vite preview --config web/vite.config.js --port 5181
```

## 测试

```bash
npm test                      # 地图校验 + 引擎/赛制测试（21 项）
node scripts/test-server.mjs  # WebSocket 服务端集成测试（17 项）
```

## 炸弹人方言（不是普通 C++）

| 差异 | 说明 |
|---|---|
| 头文件 | 必须 `#include<bomb.h>`；写 `#include<iostream>` 会直接报错 |
| 标准库 | 没有 `std`、字符串、指针，不能用 `cout` / `cin` |
| 命名空间 | 访问游戏状态必须加 `bomb::` 前缀 |
| 可写变量 | **只有** `bomb::player_dir`（0上 1右 2下 3左）和 `bomb::player_bomb`（bool） |
| 只读变量 | `player_pos`、`enemy_pos`、`bomb_pos`、`other_pos`、`wall_pos`、`turn`、`cooldown`、`my_score` 等 |
| 类型 | `int`、`bool`、`pair`、`void`；`pair` 有 `.first` / `.second` |
| 入口 | 每回合调用一次 `void main()`，不要写 `int main`，也不要 `return 0` |
| 限制 | 单次运行超过 **50ms** 判超时；死循环由步数上限拦住 |

辅助函数（只读，不改游戏状态）：

- `bomb::can_move(d)` — 方向 d 能否走
- `bomb::is_wall(x, y)` — 该格是否是墙
- `bomb::dist(a, b)` — 曼哈顿距离
- `bomb::in_danger(p)` — 该格是否在现有炸弹的爆炸范围内
- `bomb::can_retreat()` — 是否存在安全撤离方向

## 赛制

1. **编写阶段 20 分钟**，双方可随时暂停（暂停时时间不走）。
2. 时间结束后进入**确认阶段**：双方都点「同意开始」才开第一局。
3. 每局：**先死者输**；超过 **2 分钟**（300 回合）未结束，**放炸弹少的一方赢**，相同为平局。
4. **三局两胜**，每局使用 `mapOrder` 中不同的一张地图。
5. 每局结束需要重新双方确认才开下一局；整场有录像（`replay`）。

## 联机说明

- 服务端默认只监听 `127.0.0.1`；需要局域网访问时设 `HOST=0.0.0.0`。
- 前端默认连 `ws://<当前主机>:8790`，可用 `VITE_BOMB_WS` 覆盖。
- 服务端是唯一裁判：代码检查、计时、暂停、同意、对局推进全部在服务端完成，客户端只发意图。

## 部署注意

GitHub Pages 是 HTTPS 静态托管，**不能**直接连接 `ws://`，浏览器会拦截混合内容。
线上联机需要：

1. 一台能跑 Node 常驻进程的服务器（或支持 WebSocket 的托管平台）；
2. 配置 `wss://`（带证书）；
3. 前端构建时用 `VITE_BOMB_WS=wss://你的域名` 指定地址。

在解决 `wss` 之前，联机功能仅在本地可用。

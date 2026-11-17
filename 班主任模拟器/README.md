# 班主任模拟器

带好每一个学生，见证他们从 F 走到 SSSS+ 。

## 功能概览

- **时长模式**（开局选择）
  - 完整模式：按学制走完全部学年（六三制 / 五四制）
  - 三年模式：只模拟高一、高二、高三；学习增幅 ×2.2
  - 一年模式：只模拟高三（2 个学期）；学习增幅 ×4.5
  - 倍率定义在 `src/constants.js` 的 `TIME_SCALE`，在 `src/engine.js` 的学习结算中生效
- **班级玩法**
  - 班级士气（0–100）：好事件 +、坏事件 −、考试、减压、崩溃、小目标都会影响
  - 学期小目标：每学期开始随机抽 2 个，学期末结算并发放奖励
  - 成就墙：全班及格、全科A、零病假一学期、班费破万、士气爆表
  - 班主任便签：每周随机一条，语气随士气变化
- **联机对战**：两人同房间，各自经营一个班级，面板并排对比

## 目录

```
src/engine.js        核心 reducer（纯函数，前端与服务端共用）
src/constants.js     全部可调参数（含 TIME_SCALE、MORALE、MODES）
src/goals.js         学期小目标与成就定义
src/net/useRoom.js   联机客户端（只发送意图，状态来自服务端）
server/index.js      WebSocket 联机服务端（依赖 ws）
scripts/test-engine.mjs  引擎 + 联机服务端自动化测试
```

## 安装

```bash
npm install
```

## 运行

### 单机（开发 / 预览）

```bash
npm run dev        # 打开终端提示的本地地址
npm run build      # 生产构建，输出到 dist/
npm run preview    # 预览构建产物
```

### 联机（本机双人测试）

1. 启动服务端（默认监听 `ws://localhost:8787`）：

   ```bash
   npm run server
   ```

   可用环境变量修改端口：`PORT=9000 npm run server`（此时客户端地址需对应改为 `ws://localhost:9000`）。

2. 启动前端：

   ```bash
   npm run dev
   ```

3. 在两个浏览器窗口（或一个普通窗口 + 一个无痕窗口）中打开前端地址，
   选择「🌐 联机」，填写**相同的房间号**（如 `class01`）和不同的昵称，点击「连接房间」。
4. 两人都连接后，各自设置学制 / 时长模式 / 难度 / 人数，点击「开始班级生活」。之后每个人的行动都由服务端校验并结算，并广播给房间内两人。

服务端地址可在联机表单里修改，也可以通过环境变量 `VITE_GAME_SERVER_URL` 设置默认值（例如 `VITE_GAME_SERVER_URL=ws://192.168.1.10:8787 npm run dev`）。
项目中不写死任何正式域名。

> 注意：若前端通过 HTTPS 部署（例如 GitHub Pages），浏览器会阻止连接非加密的 `ws://` 地址，
> 需要把服务端部署到支持 `wss://` 的地址，并通过 `VITE_GAME_SERVER_URL` 指定。本项目不包含部署配置。

## 联机设计

- 服务端为每个房间保存每位玩家的权威状态（`rooms` → `slots[i].state`）。
- 客户端只发送**意图**，例如 `{ type: 'intent', intent: { type: 'STUDY', actionId, students, subjects } }`，不发送结算结果。
- 服务端先用 `validateIntent`（`src/engine.js`）校验：学生 ID、科目、班费、行动次数等；不合法则返回 `error`，状态不变。
- 校验通过后，服务端用与前端完全相同的 `gameReducer` 结算，随机种子由服务端生成（`crypto.randomInt`），客户端无法指定。
- 结算后的状态广播给房间内所有玩家（`{ type: 'room', players: [...] }`）。
- 每房间最多 2 名玩家；全部离线后房间自动销毁。

## 测试

```bash
npm test
```

覆盖内容：

- 时长模式：同一行动下，完整 < 三年 < 一年 的熟练度增幅，且比例等于 `TIME_SCALE`
- reducer 确定性：相同种子与动作序列结果完全一致；reducer 不修改输入状态（纯净性）
- 联机服务端：拒绝非法意图（未开始、人数、学生 ID、行动 ID），接受合法开局与学习，两名玩家状态相互隔离

## 存档兼容

旧版存档 / 旧开局参数 `fast: true` 会被映射为「一年模式」；缺失的新字段（士气、小目标、成就等）由 `migrateState` 补全默认值。

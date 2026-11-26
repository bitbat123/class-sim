# Hello.md — 中预三班游戏&工具盒 项目交接说明书

> **这份文档写给下一个接手这个项目的 AI Agent。**
> 读完它，你应该能独立维护、扩展、部署这个项目，并且知道怎么跟用户说话。

---

## 0. 先读这一段（30 秒版）

这是一个**班级同学自用的网页游戏/工具合集**，部署在 GitHub Pages，后端只有腾讯云 CloudBase（云函数 + PostgreSQL），**没有任何常驻服务器**。

- 主页：<https://bitbat123.github.io/>
- 游戏站：<https://bitbat123.github.io/class-sim/>
- 代码在用户电脑上：`C:\Users\pipihou\Music\班主任模拟器\`
- 里面是**两个独立的 git 仓库**（见 §2），别搞混。

用户是**中学生**（上海某中学中预年级三班的学生），自称 Bitbat。他要的是**能玩、好看、能炫耀**的东西，不是企业级架构。做决定时优先"能不能真的跑起来"，其次才是"代码优不优雅"。

---

## 1. 这个项目是做什么的

一共 **8 个可访问的站点**，全部挂在同一个 GitHub Pages 域名下：

| 路径 | 名称 | 类型 | 谁在用 |
|---|---|---|---|
| `/` | 中预三班游戏&工具盒（主页） | 门户 + 登录 + 成员名单 + 聊天 + 反馈 | 全班 |
| `/class-sim/` | 班主任模拟器 | 模拟经营游戏 | 全班 |
| `/class-sim/bomb-contest/` | C++ 炸弹人程序大赛 | 编程对战 | 全班 |
| `/class-sim/gomoku/` | C++ 五子棋程序大赛 | 编程对战 | 全班 |
| `/class-sim/racing/` | C++ 赛车程序大赛 | 编程对战 | 全班 |
| `/class-sim/metro/` | 地铁线路设计器 | 绘图工具 | 全班 |
| `/class-sim/chat/` | 聊天室（全屏版） | 通讯 | 全班 |
| `/class-sim/custom-games/` | 自制游戏平台 | 管理员做游戏、大家玩 | 管理员/全班 |

### 1.1 各项目的核心玩法

**班主任模拟器**（最复杂的一个）
- 你当班主任，带一个班 6 年（六三制）或 7 年（五四制）
- 每学期 20 周，每周 3 次行动（学习/放松/医疗）
- 9 个科目，熟练度 0–100 映射到 F→E→D→C→B→A→S→SS→SSS→SSSS→SSSS+→US 十二个等级
- 有班费、士气、压力、病假、随机事件、小目标、成就
- **毕业时会有一场高考**：9 科按熟练度折算成分数（语数英各 150 + 其余 6 科各 100 = 总分 1050），按分数匹配 13 档录取学校（清华→复读）
- 有存档（3 个手动槽 + 1 个自动槽）、5 套主题皮肤

**三个 C++ 编程对战游戏**
- 玩家写一段**自定义方言**（长得像 C++，但不是真 C++）的代码
- 引擎解释执行这段代码，驱动炸弹人/棋子/赛车与 AI 对战
- 有 Monaco 编辑器、语法检查、cout 控制台、回放系统、基准程序

**地铁线路设计器**
- 画任意多条地铁线路、任意多个站
- 站点可拖动、站名可放 10 个方向、线路颜色/花纹/线宽/平滑度可调
- 背景可选：白纸 / 中国城市区县轮廓 / 中国全图 / **高德街道级瓦片**
- 支持环线、换乘站、文字标注、PNG/SVG 导出、存档

**聊天室**
- 公共频道 + 成员私聊
- Markdown 或纯文本（发送时可选）
- 单条消息最多 **20000 字**，可带 **最多 6 个文件**（单个 ≤900KB）
- Enter 换行，Ctrl+Enter 发送（这条约定很重要，见 §6）

**自制游戏平台**
- 管理员粘贴一段 HTML → 变成一个能玩的游戏
- 用 iframe sandbox 隔离运行
- 主页有两个入口：「制作游戏」（仅管理员）和「查看所有自制游戏」

---

## 2. 仓库结构（非常重要）

⚠️ **外层目录 `班主任模拟器\` 本身是一个 git 仓库，里面的 `主页\` 又是另一个独立的 git 仓库。**

```
C:\Users\pipihou\Music\班主任模拟器\        ← 仓库 A，remote: bitbat123/class-sim
│                                            发布到 https://bitbat123.github.io/class-sim/
├── .github/workflows/deploy.yml             仓库 A 的部署流水线（构建全部子项目）
├── .gitignore                               必须包含 `主页/`（否则会把子仓库塞进来）
│
├── 班主任模拟器/                             ← 班主任模拟器（发布到 /class-sim/ 根）
├── 炸弹人大赛/                               ← 发布到 /class-sim/bomb-contest/
├── 五子棋/                                   ← 发布到 /class-sim/gomoku/
├── 赛车/                                     ← 发布到 /class-sim/racing/
├── 地铁设计器/                                ← 发布到 /class-sim/metro/
├── 自制游戏/                                  ← 发布到 /class-sim/custom-games/
├── chat/                                     ← 聊天室，发布到 /class-sim/chat/
├── 聊天室/                                    ← 【遗留】旧 WebSocket 版聊天室，已废弃，勿动
├── docs/                                     ← 方言与 API 文档（Markdown）
│
└── 主页/                                     ← 仓库 B，remote: bitbat123/bitbat123.github.io
                                             发布到 https://bitbat123.github.io/（域名根）
```

**两个仓库必须分别提交、分别推送。** 只推一个，另一个的改动不会上线。

| 仓库 | 目录 | remote | 发布地址 |
|---|---|---|---|
| A | `班主任模拟器\` | `github.com/bitbat123/class-sim` | `https://bitbat123.github.io/class-sim/` |
| B | `班主任模拟器\主页\` | `github.com/bitbat123/bitbat123.github.io` | `https://bitbat123.github.io/` |

---

## 3. 把每个文件讲清楚

### 3.1 顶层文件

| 文件 | 说明 |
|---|---|
| `.gitignore` | 忽略 `主页/`、`node_modules/`、`dist/`、`site/`、`*.log`。**`主页/` 这一行绝对不能删**，否则 git 会把子仓库当成 submodule 报错。 |
| `.github/workflows/deploy.yml` | 仓库 A 的 CI。依次 `npm ci` + `npm run build` 七个前端项目，再把各自 `dist/` 拷进 `site/` 的不同子目录，最后上传到 GitHub Pages。 |
| `Hello.md` | 你正在读的这份文档。 |
| `docs/dialect.md` | **最关键的技术文档**：50 项自定义 C++ 方言与真 C++ 的差异对照表 + 方言子集速查。 |
| `docs/bomb-api.md` | 炸弹人可用的所有 `bomb::` 变量和函数表。 |
| `docs/gomoku-api.md` | 五子棋可用的所有 `go::` 变量和函数表。 |
| `docs/racing-api.md` | 赛车可用的所有 `car::` 变量和函数表。 |

### 3.2 `主页/`（仓库 B — 门户）

**配置**

| 文件 | 说明 |
|---|---|
| `package.json` | React 18 + Vite 5。脚本：`dev` / `build` / `preview`。 |
| `vite.config.js` | `base: '/'`（部署在域名根）。 |
| `cloudbaserc.json` | CloudBase 部署配置。声明了云函数 `auth`，运行时 `Nodejs18.15`，超时 10 秒。 |
| `.github/workflows/deploy.yml` | 仓库 B 自己的 CI，只构建这一个项目。 |
| `index.html` | 入口 HTML。**必须包含** `<script src="./notify.js" defer></script>` 和 `<script src="./feedback.js" defer></script>`。 |

**源码 `src/`**

| 文件 | 说明 |
|---|---|
| `main.jsx` | React 挂载入口。 |
| `App.jsx` | **主页总控**。未登录 → `AuthPanel`；登录后 → 管理员面板 + 房间大厅 + 轮询对战 + 自制游戏入口 + 成员列表 + 游戏卡片网格 + 反馈按钮 + 聊天侧边栏。 |
| `cloud.js` | CloudBase SDK 封装。导出 `callAuth(action, payload)`、`getToken()`、`clearToken()`。**关键设计**：因为免费版 CloudBase 不允许匿名调云函数，这里用共享账号 `Temp / TestTest123` 先登录一次，之后所有 `callFunction` 才可用。`PUBLISHABLE_KEY` 是公开的匿名密钥，可以出现在前端。 |
| `games.js` | **游戏清单**。加新游戏就在数组里加一项（`id / name / icon / tagline / tags / href / multiplayer`），主页自动出卡片。 |
| `markdown.js` | `marked` + `DOMPurify` 渲染 Markdown，带标签白名单。 |
| `styles.css` | 全部样式（暗色主题）。 |

**组件 `src/components/`**

| 文件 | 说明 |
|---|---|
| `AuthPanel.jsx` | 登录 / 注册 / 免登录游玩。注册需要填用户名 + 真实学号 + 密码 ×2，提交后等管理员审核。 |
| `AdminPanel.jsx` | 【旧】早期管理员面板，已被 `AdminManager.jsx` 取代，**当前未使用**但文件还在。 |
| `AdminManager.jsx` | **当前的管理员面板**。超级管理员可增删管理员、升降角色；管理员可审核注册申请。 |
| `CustomGamesSection.jsx` | 自制游戏的两个入口卡片（制作 / 查看）。管理员才看到「制作游戏」。 |
| `MemberList.jsx` | 班级成员名单，分「本班」和「外班」两组，显示学号和是否管理员。test 类账号会隐藏。 |
| `DeleteAccountDialog.jsx` | 注销账号二次确认弹窗。管理员账号禁止注销。 |
| `RoomLobby.jsx` | 联机房间大厅：创建房间 / 输入房间号加入 / 房间列表。 |
| `RoomView.jsx` | 房间内部视图：成员、房主审批、离开。 |
| `PollingMatch.jsx` | 轮询式联机对战面板（炸弹人/五子棋/赛车通用）：创建对战号、双方提交代码、回合同步。 |
| `ChatSidebar.jsx` | 主页右下角的聊天侧边栏（公共 + 私聊、Markdown/纯文本切换）。 |
| `ChatRoom.jsx` | 【旧】早期聊天组件，已被 `ChatSidebar` 取代，**当前未使用**。 |
| `FeedbackPanel.jsx` | 反馈抽屉：写反馈 / 我的反馈 / 管理反馈（管理员）。 |
| `net/usePollingMatch.js` | 轮询对战的 React hook，1.2 秒一次 `matchState`。 |

**云函数 `cloudfunctions/auth/`**

这是**整个项目的后端**，一个函数处理所有 action。

| 文件 | 说明 |
|---|---|
| `index.js` | **总路由**。先 `sessionUser()` 验 token，再按 `action` 分发。`socialActions` 集合里的走 `handleSocial()`，其余走 `handle()`。 |
| `logic.js` | 账号核心逻辑（纯函数 + `handle`）。注册/登录/会话校验/注销/审核。密码用 **scrypt + 每用户独立 salt**，会话令牌 HMAC 签名存 `localStorage['authToken']`，7 天过期。 |
| `pgstore.js` | `auth_private.users` 表的读写（用户名、学号、密码哈希、salt、状态、分组）。 |
| `social.js` | 房间 + 聊天室。**所有 SQL 都用 `ExecutePGSql` 手写拼接**，因为该接口不支持绑定参数，靠 `lit()`（白名单字符）和 `litText()`（只转义单引号）防注入。**关键坑**：`INSERT ... RETURNING` 在该接口下返回 `Rows: null`，必须用 CTE 包一层 `WITH ins AS (INSERT ... RETURNING ...) SELECT ... FROM ins` 才能拿到结果。 |
| `matches.js` | 轮询式联机对战。用 `UPDATE ... WHERE turns = 期望值` 做**乐观锁**，两个客户端同时推进只有一个生效。 |
| `feedback.js` | 反馈系统 + 管理员表。`social.feedback` 存反馈，`social.admins` 存管理员（`role` 为 `super` 或 `admin`）。 |
| `customGames.js` | 自制游戏。`social.custom_games` 存 slug/title/html 等。只允许管理员写。 |
| `package.json` | 依赖：`tencentcloud-sdk-nodejs-tcb`（用于 `ExecutePGSql`）。 |

**静态资源 `public/`**

| 文件 | 说明 |
|---|---|
| `.nojekyll` | 让 GitHub Pages 不要用 Jekyll 处理（否则下划线开头的文件会被忽略）。 |
| `favicon.svg` | 网站图标。 |
| `notify.js` | **全站聊天通知脚本**。注入右下角「💬 聊天室」按钮 + 未读红点，每 2 秒轮询一次，点按钮在新标签打开 `/class-sim/chat/`。每 2 秒还会检查新消息并显示顶部横幅。 |
| `feedback.js` | **全站反馈按钮脚本**。注入左下角「📮 反馈」按钮 + 浮层表单。 |

> ⚠️ `notify.js` 和 `feedback.js` 在**每个子项目里都有一份副本**（`班主任模拟器/public/`、`炸弹人大赛/web/public/` 等）。改其中一个必须同步到全部，否则各站点行为不一致。

### 3.3 `班主任模拟器/`（游戏 1）

| 文件 | 说明 |
|---|---|
| `src/engine.js` | **游戏核心，纯函数，无 React 依赖**。`createGame()` 开局、`gameReducer(state, action)` 统一 reducer、`runGaokao()` 高考、`makeExam()` 考试、`classStats()` 统计。前端和联机服务端共用。 |
| `src/constants.js` | 所有数值常量：`GRADES`、`SUBJECTS`（9 科）、`SYSTEMS`、`MODES`、`DIFFICULTY`、`STUDY_ACTIONS`、`RELIEF_ACTIONS`、`TRAITS`、`CALENDAR`、`MORALE`、`GAOKAO`（高考 1050 分 + 13 档学校）、`SCORE_BANDS`。 |
| `src/goals.js` | 学期小目标池 + 成就定义。 |
| `src/themes.js` | 5 套主题的 CSS 变量（星云紫/樱花粉/森林绿/浅色纸感/赛博霓虹）。 |
| `src/save.js` | 存档：`buildSave / saveTo / loadFrom / listSaves / exportSave / importSaveFile / timeAgo`。存 `localStorage`，键前缀 `dsh-save:`。 |
| `src/App.jsx` | 主界面：周信息、行动面板、学生看板、成绩单、日志、高考弹窗、存档面板、主题切换。 |
| `src/components/SetupScreen.jsx` | 开局设置：学制、时长模式、难度、人数、姓名，以及「继续之前的存档」列表。 |
| `src/components/ActionPanel.jsx` | 行动面板：16 种学习行动 + 放松 + 医疗，选科目、选学生、估算花费。 |
| `src/components/StudentCard.jsx` | 单个学生卡片：9 科等级、压力条、特质标签、病假标记。 |
| `src/components/ExamResult.jsx` | 成绩单：总分、班内排名、全校排名、各科分数。 |
| `src/components/GaokaoResult.jsx` | **高考成绩单**：全班平均分、最高分、录取分布、排名表格、点「各科」展开 9 科明细。 |
| `src/components/SavePanel.jsx` | 存档抽屉：4 个槽位 + 保存/读取/删除 + 导出/导入文件。 |
| `src/components/MoralePanel.jsx` | 士气 + 小目标 + 成就展示。 |
| `src/components/EventLog.jsx` | 日志流 + 随机事件弹窗。 |
| `src/components/Legend.jsx` | 图例：12 个等级、100 分制/150 分制分数段、压力颜色。 |
| `src/components/ThemePicker.jsx` | 主题切换按钮组。 |
| `src/components/PeerPanel.jsx` | 联机时显示对手状态。 |
| `src/components/colors.js` | `scoreColor(score, max)` 等颜色工具。 |
| `src/net/useRoom.js` | 【部分失效】早期 WebSocket 联机 hook。**现在没用服务器了，联机走轮询**（见 `主页/src/net/usePollingMatch.js`），这个文件是历史遗留。 |
| `server/index.js` | 【遗留】早期 WebSocket 服务端。已不需要。 |
| `scripts/test-engine.mjs` | 引擎单元测试，`npm test` 跑。**7 项必须全过**。 |
| `public/notify.js`、`public/feedback.js` | 全站脚本副本（见 3.2）。 |

### 3.4 `炸弹人大赛/`、`五子棋/`、`赛车/`（游戏 2–4）

三个项目结构高度相似：

```
<游戏>/
├── shared/                 引擎（纯逻辑，无 DOM，Node 和浏览器共用）
│   ├── dialect.js          ★ 自定义 C++ 方言解释器（三个游戏共用同一份）
│   ├── game.js             规则 + 状态机
│   ├── baselines.js        基准 AI 程序（入门/进阶/高手）
│   └── interp.js / maps.js / match.js   （炸弹人特有）
├── web/                    浏览器版
│   ├── src/App.jsx         主界面
│   ├── src/components/     Board / Track / CodeEditor / DocsPanel
│   ├── src/localMatch.js   本地对局 → 生成回放帧
│   ├── src/starters.js     代码模板
│   ├── src/apiData.js      DocsPanel 用的 API 元数据
│   └── src/monacoSetup.js  Monaco 编辑器本地打包 + 自定义语言高亮
├── scripts/test-*.mjs      引擎测试
└── server/index.js         （炸弹人有）早期服务端
```

**`shared/dialect.js` 是最重要的文件。** 它是三个游戏共用的方言解释器：

- 词法分析 → 递归下降语法分析 → 树遍历求值
- 支持：`int/long/short/char/unsigned/bool/pair/string`、`const`、局部数组、`if/else`、`while`、`do-while`、`for`、`switch/case/default`、`break/continue/return`、三元运算符、位运算、`#define`、`cout`
- 限制：无指针、无 `std::`、无结构体、无浮点、单次运行 50ms 超时、步数上限 20 万、递归深度 100
- **改了它，三个游戏要同步**（`五子棋/shared/dialect.js`、`赛车/shared/dialect.js` 都是副本）

### 3.5 `地铁设计器/`

| 文件 | 说明 |
|---|---|
| `src/model.js` | 文档模型 + 存档。`createDoc()` 默认 6000×4000 画布；`normalizeDoc()` 容错迁移旧存档；`createDemoDoc()` 生成示例线路网（4 线 18 站 3 换乘）。 |
| `src/background.js` | 区县/全国背景。读 `public/geo/<adcode>.json`，墨卡托投影后归一化到 0..1，`fitToCanvas()` 支持 `contain / cover / manual` 三种适配。 |
| `src/tiles.js` | **街道级瓦片**。高德 `webrd01-04` 栅格瓦片，含 `lonLatToTile` / `tileUrl` / `ZOOM_HINTS`。 |
| `src/cities.js` | 40 个城市：adcode + 中心经纬度。 |
| `src/components/MetroCanvas.jsx` | SVG 画布。线路绘制（折线圆角 / Catmull-Rom 平滑曲线 / 环线闭合）、4 种站点形状、站名 10 方向定位、文字标注、拖动。 |
| `src/components/TileLayer.jsx` | 瓦片图层。`mapZoom` 是连续值，整数部分决定瓦片级别（路网详细度），小数部分是视觉放大。 |
| `src/components/Inspector.jsx` | 右侧属性面板：线路 / 站点 / 文字 / 画布 四个 tab。 |
| `src/components/SavePanel.jsx` | 4 槽位存档 + 导入导出。 |
| `src/App.jsx` | 总控。含 hash-less 路由、自动存档（防抖 800ms）、PNG/SVG 导出、键盘快捷键（Delete 删除、Esc 取消）。 |
| `scripts/fetch-geo.mjs` | **构建时脚本**：从 DataV 下载 41 份区县 GeoJSON，精简坐标（3 位小数）、丢弃小岛（<8km²），输出到 `public/geo/`，共约 2.6MB。 |
| `public/geo/*.json` | 已打包的地图数据（41 个文件）。**不要手改**，用脚本重新生成。 |

### 3.6 `chat/`（聊天室全屏版）

| 文件 | 说明 |
|---|---|
| `src/App.jsx` | 全屏聊天。左侧会话列表、右侧消息流、底部输入框。**附件逻辑都在这里**：`readAsBase64()` 读文件 → `attachments` 状态 → 发送时带 `attachments` 数组；收到的消息里 `m.files` 是元数据数组，点击时调 `chatFile` 拉 base64 再 `downloadBase64()`。 |
| `src/cloud.js` | 同主页的 CloudBase 封装。 |
| `src/markdown.js` | 同主页。 |
| `notify-inject.js` | **通知脚本的源文件**。改完要复制到 5 个位置（见 §3.2 的警告）。 |
| `feedback-inject.js` | 反馈脚本的源文件，同样要复制。 |
| `public/notify.js`、`public/feedback.js` | 上面两个的副本。 |

### 3.7 `自制游戏/`

| 文件 | 说明 |
|---|---|
| `src/App.jsx` | 单页应用，三个视图用 hash 路由：`#/build`（制作，仅管理员）、`#/browse`（游戏库）、`#/play/<slug>`（全屏玩）。**安全核心**：iframe `sandbox="allow-scripts allow-forms allow-modals allow-popups"` —— **故意不给 `allow-same-origin`**，这样游戏脚本拿不到本页的 token 和 localStorage。 |
| `src/cloud.js` | 同主页。 |
| `src/styles.css` | 全部样式。 |
| `src/main.jsx` | React 挂载。 |

### 3.8 `聊天室/`（遗留，勿动）

这是**最早的 WebSocket 版聊天室**，需要 `npm run server` 起服务端。已完全被 `chat/`（轮询版）取代。留在这里只是没删。**不要在这个目录上开发，也不要部署它。**

---

## 4. 技术架构

### 4.1 部署拓扑

```
GitHub Pages（纯静态）
├── /                     ← 仓库 B 的 dist/
└── /class-sim/           ← 仓库 A 的 site/（7 个子项目拼装而成）
    ├── /                 ← 班主任模拟器
    ├── /bomb-contest/    ← 炸弹人大赛
    ├── /gomoku/          ← 五子棋
    ├── /racing/          ← 赛车
    ├── /metro/           ← 地铁设计器（含 /geo/*.json）
    ├── /chat/            ← 聊天室
    └── /custom-games/    ← 自制游戏

腾讯云 CloudBase（唯一后端）
├── 云函数 auth           ← 所有业务逻辑，单函数多 action
└── PostgreSQL (PG 模式)
    ├── auth_private.users      账号
    └── social.*                rooms / room_members / messages / chat_files /
                                matches / feedback / admins / custom_games
```

**没有常驻服务器。** 所有"实时"功能都是**前端轮询**：聊天 1.5 秒、通知 2 秒、联机对战 1.2 秒。

### 4.2 CloudBase 环境

| 项 | 值 |
|---|---|
| 环境 ID | `interim-toucan-d4g2tnti4470549e1` |
| 地域 | `ap-shanghai` |
| 套餐 | 个人版（¥19.9/月）— 免费版不支持自定义域名和部分 API |
| 云函数 | `auth`（Nodejs 18.15，超时 10 秒） |

用 `@cloudbase/cli` 操作：

```bash
cd 主页
npx tcb fn deploy auth -e interim-toucan-d4g2tnti4470549e1 --force     # 部署云函数
npx tcb db execute -e interim-toucan-d4g2tnti4470549e1 --sql "SELECT ..." --json   # 跑 SQL
```

### 4.3 认证链路（重要，容易踩坑）

1. 用户在 `AuthPanel` 输入用户名密码
2. `callAuth('login', ...)` → 云函数 `logic.js` 用 scrypt 校验
3. 成功则返回 HMAC 签名的 token，存 `localStorage['authToken']`
4. 之后每次 `callAuth(action, payload)` 自动把 token 塞进 `data.token`
5. 云函数用 `verifySession(event.token, secret)` 解出用户名

**但还有一层**：免费/个人版 CloudBase 不允许匿名调云函数（会报 `EXCEED_AUTHORITY`）。所以前端 `cloud.js` 里先用一个**共享账号 `Temp / TestTest123`** 登录 SDK，拿到调用云函数的权限，**然后**才用自己的 token 走业务逻辑。这个密码写在所有前端代码里，是用户明确同意的设计。

### 4.4 ExecutePGSql 的三个坑

1. **不支持绑定参数** —— 所有 SQL 都是手写拼接，靠 `lit()` / `litText()` 转义
2. **`INSERT ... RETURNING` 返回 `Rows: null`** —— 必须包 CTE：
   ```sql
   WITH ins AS (INSERT INTO t (...) VALUES (...) RETURNING id, ...)
   SELECT * FROM ins
   ```
3. **CLI 单条命令不能太长** —— 超过约 8KB（Windows 命令行限制）会失败，大 SQL 要拆成多次调用

### 4.5 数据表清单

| 表 | 用途 | 关键列 |
|---|---|---|
| `auth_private.users` | 账号 | `username`, `student_id`, `hash`, `salt`, `status`, `grp` |
| `social.rooms` | 联机房间 | `game`, `code`, `owner`, `pass_key`, `status` |
| `social.room_members` | 房间成员 | `room_id`, `username`, `seat` |
| `social.messages` | 聊天消息 | `channel`, `sender`, `body`, `format`, `files`(JSON) |
| `social.chat_files` | 聊天附件 | `channel`, `sender`, `name`, `mime`, `size`, `data`(base64) |
| `social.matches` | 轮询对战 | `code`, `game`, `seed`, `p1`, `p2`, `turns`, `status` |
| `social.feedback` | 反馈 | `sender`, `game`, `body`, `status`, `reply` |
| `social.admins` | 管理员 | `username`, `role`(`super`/`admin`), `granted_by` |
| `social.custom_games` | 自制游戏 | `slug`, `title`, `html`, `published`, `plays` |

---

## 5. 代码规范

### 5.1 文件编码 —— 这是最容易出事的地方

**所有含中文的文件必须写成 UTF-8 无 BOM。**

**禁止**用 PowerShell 的 `-replace` 或 `Set-Content -Encoding utf8` 改中文文件 —— 实测多次把文件改成乱码（`馃帗`、`鐝` 这种）。正确做法：

```powershell
$c = [System.IO.File]::ReadAllText($path)
$c = $c.Replace('旧', '新')
[System.IO.File]::WriteAllText($path, $c, (New-Object System.Text.UTF8Encoding($false)))
```

新建文件同理。改完**必须验证**：

```powershell
[System.IO.File]::ReadAllText($path).Substring(0, 200)
```

### 5.2 React

- 函数组件 + hooks，不用 class
- 状态提升到 `App.jsx`，子组件只接收 props + 回调
- 列表渲染必须有稳定 `key`（用业务 id，不用 index）
- 复杂状态用 `useReducer`（见班主任模拟器）
- 组件文件用 `.jsx`，纯逻辑用 `.js`

### 5.3 样式

- 每个项目一个 `styles.css`，**不引入 CSS 框架**
- 颜色用 CSS 变量（`var(--border)` 等），主题切换靠改 `:root` 变量
- 类名用短横线小写：`.chat-nav`、`.game-card`、`.cg-mini`
- 暗色主题为主

### 5.4 中文文案

- 全部中文，标点用全角
- 按钮用「动词 + 名词」：`提交反馈`、`创建房间`、`保存到存档 1`
- 空状态要有引导：`还没有房间，创建一个吧。`
- 错误提示要具体：`班费不足：看病需要 3600，余额 1200`（不要只说"操作失败"）

### 5.5 Git

提交信息用英文祈使句，一行说清做了什么：

```
Add metro line designer with save slots
Fix chat sender showing as 'public'
Chat: 20000-char messages + file attachments
```

不要写 "update" "fix bug" 这种没信息量的。**不要加 Co-Authored-By 或任何 AI 署名。**

### 5.6 部署前必须检查

```powershell
# 1. 每个改过的项目都要构建成功
cd <项目>; npm run build

# 2. 班主任模拟器要跑测试（7 项必须全过）
cd 班主任模拟器; npm test

# 3. package-lock.json 必须被 git 跟踪（CI 用 npm ci，缺 lock 会失败）
git ls-files <项目>/package-lock.json

# 4. 新增项目要同时改三处：
#    - .github/workflows/deploy.yml（cache 路径 + install + build + cp）
#    - 主页/src/games.js（如果要出现在主页游戏网格）
#    - 该项目的 vite.config.js base 路径
```

---

## 6. 用户的硬性约定（不能违反）

这些是用户明确要求过的，改之前一定要问：

1. **聊天键盘**：Enter 换行，Ctrl+Enter 发送。IME 输入法组合中（`isComposing`）不能触发发送。
2. **聊天格式**：Markdown / 纯文本由**发送者**选择，纯文本必须完全转义。
3. **联机不要服务器**：用 CloudBase 云函数轮询，不能让用户去跑 `npm run server`。
4. **多端一致**：改了 `notify.js` / `feedback.js`，5 个副本全部同步。
5. **`主页/` 必须留在 `.gitignore`**：否则外层仓库会报 submodule 错误。
6. **不要把 node_modules 提交进 git**：仓库曾因此膨胀到 2263 个文件。
7. **学号唯一**：注册时校验，不能重复。
8. **管理员账号不能自助注销**。
9. **方言改了要同步**：`炸弹人大赛/shared/dialect.js` 是主版本，`五子棋/` 和 `赛车/` 的副本要一起覆盖。

---

## 7. 我（上一个 Agent）跟你说话的方式

**这一节是给你的行为指南。**

### 7.1 语气

- **中文回答，直接、平实、不客套。** 不用"您好""希望对您有帮助""如有疑问请随时告知"这类。
- **不说"我们"**，说"我"和"你"。
- **不吹牛。** 做完了就说做完了，没做完就说没做完。做了一半要明说哪一半没做。
- **遇到自己搞不定的事，直接讲清楚卡在哪**，不要含糊其辞或假装做到了。
- **不轻易承诺**。说"我试试"就够了，别说"保证没问题"。

### 7.2 回答结构

**先说结论，再说细节。**

```
改好了。三个地方：A、B、C。

[具体做了什么]

实测：
- 打开页面 → 看到 X
- 点按钮 → 弹出 Y

说明：
- 限制 1
- 限制 2
```

**每次做完功能，必须单独列一段「实测」**，写清楚：
- 在浏览器里真的点了什么
- 看到了什么
- **哪些只构建了没验证**

这是用户最看重的 —— 他之前因为"说做好了其实没做"发过火。

### 7.3 遇到问题时

- 先自己尝试，别一上来就问
- 试了 2–3 种方案都不行，再问，并且**说清楚试过什么**
- 能自己决定的小事（命名、样式细节）直接决定，不打扰用户
- 涉及**删数据、改账号、花钱、发布上线**，先问

### 7.4 用户不满时

用户说"太简陋了""不对""还是不行"，不要辩解、不要解释设计取舍，**直接问清楚他要什么，然后做**。

典型对话：
- 用户：「功能太简陋，城市背景画布太小，需要导入详细的城市地图」
- 我：（没有解释为什么之前那样做，直接去做了区县级地图 + 街道级瓦片）

### 7.5 不要做的事

- ❌ 不要用 emoji 堆砌回答
- ❌ 不要在代码里加 `// 由 AI 生成` 之类的注释
- ❌ 不要主动重构用户没要求的地方
- ❌ 不要为了"更优雅"而改掉能跑的代码
- ❌ 不要在回答里贴大段代码（用户看仓库，不看聊天）
- ❌ 不要说"我无法"而不给替代方案

---

## 8. 开发工作流

### 8.1 本地起服务

```powershell
cd C:\Users\pipihou\Music\班主任模拟器\<项目>
npm run dev          # 或 npm run web:dev（三个编程游戏）
```

各项目默认端口：

| 项目 | 端口 | 访问路径 |
|---|---|---|
| 班主任模拟器 | 5173 | `/class-sim/` |
| 炸弹人大赛 | 5180 | `/class-sim/bomb-contest/` |
| 五子棋 | 5181 | `/class-sim/gomoku/` |
| 赛车 | 5182 | `/class-sim/racing/` |
| 地铁设计器 | 5186 | `/class-sim/metro/` |
| chat | 5190 | `/class-sim/chat/` |
| 自制游戏 | 5197 | `/class-sim/custom-games/` |
| 主页 | 5174 | `/` |

> ⚠️ `vite preview` 的端口经常起不来（被占用/进程残留），起不来就换一个端口，别死磕。用完记得 kill 掉，否则会堆积一堆 node 进程。

### 8.2 改完代码的标准流程

```powershell
# 1. 构建
cd <项目>; npm run build

# 2. 提交（注意仓库 A 和 B 是分开的）
cd C:\Users\pipihou\Music\班主任模拟器
git add -A "<项目>"
git commit -m "简短说明"
git push origin main

# 3. 如果要改主页
cd 主页
git add -A
git commit -m "..."
git push origin main

# 4. 等 CI
#    GitHub Actions 约 1–3 分钟。轮询：
#    https://api.github.com/repos/bitbat123/class-sim/actions/runs?per_page=1
```

### 8.3 推送失败怎么办

`git push` 经常报 `Failed to connect to github.com:443`。这是网络问题，**不是代码问题**。重试即可：

```powershell
for ($i=1; $i -le 5; $i++) {
  git -c http.lowSpeedLimit=1 -c http.lowSpeedTime=180 push origin main
  if ($LASTEXITCODE -eq 0) { break } else { Start-Sleep -Seconds 20 }
}
```

通常第 2–4 次成功。

### 8.4 验证线上

```powershell
# 等 CI 完成后
curl.exe -s -o NUL -w "%{http_code}" https://bitbat123.github.io/class-sim/<项目>/
```

**注意**：GitHub Pages 有 CDN 缓存，刚部署完可能还是旧版本，等 30–60 秒再试。

---

## 9. 已知问题与待办

### 9.1 已知问题

| 问题 | 严重度 | 说明 |
|---|---|---|
| 大 JS 包下载截断 | 中 | 炸弹人大赛的 bundle 约 2.7MB（含 Monaco），用 curl 下载经常只拿到一部分。浏览器能正常加载但慢。根治要拆 Monaco 或改按需加载。 |
| 坐标系偏移 | 低 | 高德瓦片用 GCJ-02，区县边界用 WGS84，国内差 100–700 米。街道级尺度下能看出来。两者不能同时精准叠加。 |
| PNG/SVG 导出可能缺地图 | 低 | 导出是序列化 SVG，`<image href="外部URL">` 跨域可能导致地图空白。未实测。 |
| 聊天附件不能预览大图 | 低 | 图片走 `window.open(blobURL)`，超大图可能卡。 |
| 联机对战是"协调层"不是"服务端权威" | 中 | 双方同步回合数，但真正的推演在各自浏览器跑。要服务端权威得把引擎搬进云函数。 |
| `五子棋` 基准 AI 偏弱 | 低 | 三个基准都能在 9 步内结束，黑棋必胜，防守很弱。 |
| `赛车` 是街机物理不是真实物理 | 低 | 用户最初要求"模拟真实物理"，实际是简化的横向模型。 |
| 旧文件未清理 | 低 | `聊天室/`、`使用 WebSocket 的 server/index.js`、`AdminPanel.jsx`、`ChatRoom.jsx` 都是遗留，未删。 |

### 9.2 可以做的事（按价值排序）

1. **拆分炸弹人的 bundle** —— 让首屏加载可靠
2. **服务端权威联机** —— 把引擎搬进云函数，双方只看回放
3. **地铁设计器导出真正的图片** —— 用 canvas 逐瓦片绘制，绕开跨域
4. **五子棋基准 AI 加强** —— 目前太弱，玩起来没挑战
5. **给聊天附件加缩略图** —— 图片直接在消息流里显示小图
6. **自制游戏加代码模板库** —— 现在只有 1 个计数器模板
7. **清理遗留文件** —— `聊天室/`、旧的 WebSocket server

---

## 10. 快速索引

**想加一个新游戏？**
1. 建目录 `新游戏/`，`package.json` + `vite.config.js`（`base: '/class-sim/新游戏/'`）
2. 改 `.github/workflows/deploy.yml`：cache 路径 + install + build + `cp -r 新游戏/dist/. site/新游戏/`
3. 改 `主页/src/games.js` 加一项
4. 复制 `public/notify.js` 和 `public/feedback.js`
5. `index.html` 加两个 `<script>` 标签

**想加一个新的云函数 action？**
1. `主页/cloudfunctions/auth/index.js` 里加 `case`，并且**把 action 名加进 `socialActions` 集合**（否则不会走 `handleSocial`）
2. 业务逻辑放对应模块（`social.js` / `matches.js` / `feedback.js` / `customGames.js`）
3. `node --check` 验语法
4. `npx tcb fn deploy auth -e interim-toucan-d4g2tnti4470549e1 --force`

**想加一个新的数据表？**
```powershell
cd 主页
npx tcb db execute -e interim-toucan-d4g2tnti4470549e1 --sql "CREATE TABLE IF NOT EXISTS social.xxx (...)" --json
```
一条一条建，别拼成一条长 SQL（会超命令行长度限制）。

**想改方言？**
1. 改 `炸弹人大赛/shared/dialect.js`（主版本）
2. 覆盖到 `五子棋/shared/dialect.js` 和 `赛车/shared/dialect.js`
3. 更新 `docs/dialect.md` 的 50 项对照表
4. 更新各游戏的 `web/src/components/DocsPanel.jsx`（内嵌的差异表）
5. 三个游戏都跑 `npm test` + `npm run web:build`

**想知道管理员是谁？**
```powershell
npx tcb db execute -e interim-toucan-d4g2tnti4470549e1 --sql "SELECT username, role FROM social.admins" --json
```
超级管理员是 `bitbat`（授予人 `system`）。

---

## 11. 最后

这个项目的用户是个中学生，他用它给全班做了一个游戏站。他不懂技术细节，但他**非常清楚自己想要什么效果**，而且会直接说"太简陋了"。

**他真正需要你做的**：
- 把功能做出来，能真的用
- 老实告诉他哪里没做好
- 别把简单的事复杂化

**他不需要的**：
- 架构设计讲座
- 代码风格建议
- "最佳实践"说教

祝你好运。这个项目比看起来大，但结构是清晰的 —— 只要记住「两个仓库 + 一个云函数 + 一堆轮询」这个骨架，剩下的都是细节。

# 聊天室（Shared Chat Room）

一个实时共享聊天室：所有连接的用户在同一个公共房间里聊天，支持 Markdown 渲染、私聊和在线用户列表。

- `server/`：Node.js WebSocket 服务器（`ws`），只在内存中保存在线用户和最近 200 条公共消息。
- `web/`：React + Vite 前端（`marked` + `DOMPurify` 渲染 Markdown）。
- `scripts/test-chat.mjs`：端到端测试脚本。

## 环境要求

- Node.js 18 或更高版本（开发时使用 Node 24 验证）。

## 安装依赖

```powershell
cd 聊天室\server
npm install

cd ..\web
npm install
```

## 启动

需要两个终端。

**终端 1：启动 WebSocket 服务器**（默认端口 8080）

```powershell
cd 聊天室\server
npm start
# 等价于: node index.js
# 可选环境变量: PORT=8080  HOST=0.0.0.0
```

**终端 2：启动 Web 开发服务器**（默认 http://127.0.0.1:5173）

```powershell
cd 聊天室\web
npm run dev
```

打开 http://127.0.0.1:5173 ，输入昵称即可加入。前端默认连接 `ws://<当前主机名>:8080`；如需修改，设置环境变量 `VITE_WS_URL`（例如 `VITE_WS_URL=ws://192.168.1.10:8080 npm run dev`）。

## 构建前端

```powershell
cd 聊天室\web
npm run build      # 输出到 web/dist
npm run preview    # 预览构建产物
```

## 运行测试

先确保 `server` 已执行过 `npm install`，然后在项目根目录运行：

```powershell
cd 聊天室
node scripts/test-chat.mjs
```

测试会在随机端口启动服务器，验证：公共消息到达所有人；私聊只到达发送者和接收者（第三方收不到）；超过 2000 字符的消息被拒绝；重复昵称被拒绝；昵称校验规则。

## 功能说明

| 功能 | 说明 |
| --- | --- |
| 昵称 | 1-20 个字符，不能包含控制字符，去除首尾空格后不能与在线用户重名（不区分大小写）。不实现登录，留待与主页登录集成。 |
| 公共消息 | 发送给所有在线用户，服务器保留最近 200 条用于新用户加载历史。 |
| 私聊 | 点击左侧在线用户即可打开私聊。服务器只把私聊消息发给发送者和接收者，不保存、不广播。 |
| Markdown | 消息按 Markdown 渲染（GFM）。渲染结果经 DOMPurify 净化，不直接渲染原始 HTML。 |
| 消息长度 | 最多 2000 个字符，服务器端拒绝超长消息。 |

## 键盘操作

- **Enter**：在输入框中换行，**不会发送**。
- **Ctrl+Enter**：发送消息。
- 输入法组合输入期间（IME composition）的按键不会触发发送。

## WebSocket 协议（简述）

客户端 → 服务器（JSON）：

- `{"type":"join","name":"Alice"}`
- `{"type":"public","text":"hello **world**"}`
- `{"type":"private","to":"Bob","text":"hi"}`

服务器 → 客户端：

- `welcome`（含在线用户和历史）、`users`（在线列表更新）、`public`、`private`、`error`。

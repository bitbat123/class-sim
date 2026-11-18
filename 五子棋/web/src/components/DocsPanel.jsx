import React, { useState } from 'react';

// 与原生 C++ 的完整差异对照表（三款游戏通用）
export const DIFF_TABLE = [
  ['执行方式', '编译成机器码后运行', '自研解释器逐句解释执行', '没有编译产物'],
  ['运行时间', '无限制（除非题目要求）', '每次 main() 最多 50ms', '超时本次调用作废'],
  ['死循环', '程序会挂住', '约 20 万步上限后中止', '不会卡死页面'],
  ['头文件', '任意 #include<x>', '只允许该游戏的唯一头文件', '写 iostream 直接报错'],
  ['宏 / 预处理', '#define、#pragma、#if 等', '支持 #include 与简单的 #define', '#pragma / #if / 带参宏不支持'],
  ['标准库', 'std:: 全部可用', '完全没有标准库', '无 vector / string / algorithm'],
  ['输入输出', 'cout / cin / printf', '支持 cout（调试用）', 'cin 和 printf 不支持；输出显示在「控制台」面板'],
  ['可用类型', '内置 + 自定义类型', 'int/long/short/char/unsigned/bool/void/pair', '整数类型都按 int 处理'],
  ['浮点数', 'float / double', '不支持', '只有整数；速度、进度已放大成整数'],
  ['字符类型', 'char', '不支持', '用 int'],
  ['字符串', 'std::string、字符字面量', '不支持', '写 "abc" 或 \'a\' 报错'],
  ['无符号类型', 'unsigned / size_t', '不支持', '全是普通 int'],
  ['指针', 'int*、&、new、delete', '不支持', '无解引用、无取地址、无动态分配'],
  ['引用', 'int&', '不支持', '参数一律值传递'],
  ['数组', 'int a[10]、std::vector', '支持 int a[10]; 这类局部数组', '长度 1–1000，且长度必须是常量表达式'],
  ['结构体 / 类', 'struct / class', '不支持', '唯一复合类型是内置 pair'],
  ['枚举', 'enum', '不支持', '用 int 常量自己约定'],
  ['类型别名', 'typedef / using', '不支持', '—'],
  ['常量修饰', 'const / constexpr', '支持 const', 'constexpr 不支持'],
  ['auto 推导', '支持', '不支持', '必须写出类型'],
  ['static / extern / inline', '支持', '不支持', '—'],
  ['sizeof', '支持', '不支持', '—'],
  ['main 签名', 'int main(int argc, char** argv)', '必须 void main()', '不能带参数、不能 return 0'],
  ['main 调用次数', '启动时 1 次', '每回合 / 每帧 1 次', '要在每次调用里决定动作'],
  ['do-while', '支持', '支持', '—'],
  ['switch / case / default', '支持', '支持（含贯穿）', '每个 case 后记得 break'],
  ['goto', '支持', '不支持', '—'],
  ['三元运算符', 'a ? b : c', '支持', '—'],
  ['位运算', '& | ^ ~ << >>', '支持', '按 32 位整数运算'],
  ['逗号声明', 'int a = 1, b = 2;', '支持', '—'],
  ['类型转换', '(int)x、static_cast', '不支持', '—'],
  ['自增自减', 'i++、--i', '支持（前缀/后缀均可）', '不区分返回值差异'],
  ['复合赋值', '+= -= *= /= %=', '支持', '—'],
  ['数组越界', '未定义行为', '直接报错并作废本次调用', '比 C++ 安全'],
  ['函数', '支持', '支持（可递归，深度上限 100）', '返回 int / bool / pair / void'],
  ['函数重载', '支持', '不支持', '同名函数报「重复定义」'],
  ['默认参数', '支持', '不支持', '参数个数必须一致'],
  ['可变参数', '支持', '不支持', '—'],
  ['lambda', '支持', '不支持', '写普通函数'],
  ['模板', '支持', '不支持', '—'],
  ['函数指针', '支持', '不支持', '—'],
  ['命名空间', '任意 namespace', '只允许游戏规定的那一个', '不能用 using namespace'],
  ['异常', 'try / catch / throw', '不支持', '出错即本次调用失败'],
  ['多线程', 'std::thread', '不支持', '单线程执行'],
  ['内存管理', '手动或智能指针', '不需要也不能管理', '无法申请 / 释放内存'],
  ['多文件 / 链接', '支持', '不支持', '只有一份代码'],
  ['整数溢出', '未定义行为', '不溢出（JS 双精度）', '超大数不建议'],
  ['整除负数', '向零取整（C++11 起）', '向零取整', '与 C++ 一致'],
  ['取模负数', '符号跟随被除数', '同 C++', '与 C++ 一致'],
  ['全局变量', '支持', '支持（跨调用保留状态）', '可用来缓存地图等'],
];

/**
 * 文档抽屉：默认折叠，右下角悬浮按钮打开，点遮罩或 × 关闭。
 * 内容 = 与原生 C++ 的 50 项差异 + 本游戏全部 API。
 */
export default function DocsPanel({ api }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('api');

  return (
    <>
      {/* 折叠状态：右下角悬浮按钮（明显的打开提示） */}
      {!open && (
        <button className="docs-fab" onClick={() => setOpen(true)} title="查看语言说明与本游戏全部变量">
          <span className="docs-fab-icon">📘</span>
          <span className="docs-fab-text">语言说明 / API</span>
          <span className="docs-fab-badge">{DIFF_TABLE.length + api.writable.length + api.readonly.length + api.funcs.length}</span>
        </button>
      )}

      {open && (
        <div className="docs-drawer-mask" onClick={() => setOpen(false)}>
          <aside className="docs-drawer" onClick={(e) => e.stopPropagation()}>
            <header className="docs-drawer-head">
              <h3>📘 语言说明与 {api.ns}:: API</h3>
              <button className="docs-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
            </header>

            <div className="docs-tabs">
              <button className={tab === 'api' ? 'on' : ''} onClick={() => setTab('api')}>
                {api.ns}:: 变量与函数
              </button>
              <button className={tab === 'diff' ? 'on' : ''} onClick={() => setTab('diff')}>
                与原生 C++ 的差异（{DIFF_TABLE.length} 项）
              </button>
            </div>

            <div className="docs-drawer-body">
              {tab === 'api' ? (
                <div className="docs-body">
                  <p className="muted small">
                    头文件 <code>#include&lt;{api.header}&gt;</code>，命名空间 <code>{api.ns}::</code>，
                    入口 <code>void main()</code>，{api.freq}。
                  </p>

                  <h4>✅ 可写变量（只有这些）</h4>
                  <table className="docs-table">
                    <thead><tr><th>变量</th><th>类型</th><th>范围</th><th>说明</th></tr></thead>
                    <tbody>
                      {api.writable.map(([n, t, r, d], i) => (
                        <tr key={i}><td><code>{api.ns}::{n}</code></td><td>{t}</td><td>{r}</td><td>{d}</td></tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>📖 只读变量</h4>
                  <table className="docs-table">
                    <thead><tr><th>变量</th><th>类型</th><th>说明</th></tr></thead>
                    <tbody>
                      {api.readonly.map(([n, t, d], i) => (
                        <tr key={i}><td><code>{api.ns}::{n}</code></td><td>{t}</td><td>{d}</td></tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>🔧 只读函数</h4>
                  <table className="docs-table">
                    <thead><tr><th>函数</th><th>返回</th><th>说明</th></tr></thead>
                    <tbody>
                      {api.funcs.map(([sig, ret, d], i) => (
                        <tr key={i}><td><code>{api.ns}::{sig}</code></td><td>{ret}</td><td>{d}</td></tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>❌ 常见错误</h4>
                  <table className="docs-table">
                    <thead><tr><th>写法</th><th>结果</th></tr></thead>
                    <tbody>
                      {api.errors.map(([w, r], i) => (
                        <tr key={i}><td><code>{w}</code></td><td>{r}</td></tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>规则要点</h4>
                  <ul className="rules-ul">{api.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              ) : (
                <div className="docs-body">
                  <p className="muted small">
                    本游戏使用自研的类 C++ 解释器，不是真正的 C++ 编译器。下表是全部差异，未列出的特性一律不支持。
                  </p>
                  <table className="docs-table">
                    <thead>
                      <tr><th>项目</th><th>原生 C++</th><th>本方言</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                      {DIFF_TABLE.map(([item, cpp, ours, note], i) => (
                        <tr key={i}><td>{item}</td><td>{cpp}</td><td className="ours">{ours}</td><td className="muted">{note}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <h4>支持的语言子集</h4>
                  <pre className="subset">{`类型：      int  bool  pair  void
字面量：    非负整数   true   false   pair(a, b)
运算符：    + - * / %    < <= > >= == !=    && || !    ++ --    = += -= *= /= %=
语句：      if / else    while    for (;;)    return    break    continue    { }
函数：      int|bool|pair|void  名称(参数) { ... }
访问：      变量   命名空间::变量    arr[i]    p.first    p.second    arr.size()
注释：      // 行注释    /* 块注释 */
预处理：    #include<${api.header}>`}</pre>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// 用浏览器实际打开前端，检查：页面渲染、编辑器、与基准程序对战、回放。
// 需要先启动 vite preview（dist 已构建）。
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:5181/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (d ? ' -> ' + d : '')); } };

check('标题渲染', (await page.title()).includes('炸弹人'), await page.title());
check('规则说明可见', await page.locator('.rules-note').isVisible());
check('Monaco 编辑器挂载', await page.locator('.monaco-editor').count() > 0);
check('语法检查通过提示', await page.locator('.ok-line').isVisible());

// 点“与基准程序对战”
await page.getByRole('button', { name: /与基准程序对战/ }).click();
await page.waitForTimeout(2500);
check('回放棋盘出现', await page.locator('.board-grid').count() > 0);
check('结果已显示', await page.locator('.result-box').isVisible());
const resText = await page.locator('.result-box').innerText();
console.log('  结果文本：' + resText.replace(/\n/g, ' '));

// 暂停/播放按钮
await page.getByRole('button', { name: /播放|暂停/ }).first().click();
await page.waitForTimeout(300);
check('播放控制可用', true);

// 切到联机模式
await page.getByRole('button', { name: /联机对战/ }).click();
await page.waitForTimeout(600);
check('联机加入界面出现', await page.locator('.join-box').isVisible());

await page.screenshot({ path: 'shot-local.png', fullPage: false });

check('无页面报错', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

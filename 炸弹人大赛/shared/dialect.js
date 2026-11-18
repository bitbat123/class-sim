// 通用「类 C++」方言解释器（炸弹人 / 五子棋 / 赛车共用）。
// 支持：int/long/short/char/unsigned 等整数类型、bool、pair、局部数组、
//      if/else、while、do-while、for、switch/case/default、break/continue/return、
//      const、#define、三元运算符、位运算、字符串字面量、cout 调试输出。
// 通过工厂参数化命名空间与头文件，例如 { namespace: 'bomb', header: 'bomb.h' }。

export class DialectError extends Error {
  constructor(message, line = 0) {
    super(message);
    this.name = 'DialectError';
    this.line = line;
  }
}

export class TimeLimitError extends DialectError {
  constructor(line = 0, limit = 50) {
    super(`单次运行超过时间限制（${limit}ms）`, line);
    this.name = 'TimeLimitError';
  }
}

export const TIME_LIMIT_MS = 50;
const STEP_LIMIT = 200000;
const RECURSION_LIMIT = 100;
const MAX_STRING = 500;
const MAX_CONSOLE_LINES = 200;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class Pair {
  constructor(first, second) {
    this.first = first;
    this.second = second;
  }
}

/** 整数类型别名：最终都按 int 处理 */
const INT_TYPES = new Set(['int', 'long', 'short', 'char', 'unsigned', 'signed', 'size_t', 'long long']);
const TYPES = new Set(['int', 'bool', 'void', 'pair', 'string']);
const KEYWORDS = new Set([
  'int', 'bool', 'void', 'pair', 'string', 'long', 'short', 'char', 'unsigned', 'signed', 'size_t',
  'if', 'else', 'while', 'do', 'for', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'const', 'true', 'false', 'cout', 'endl',
]);
const OPS2 = ['<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '<<', '>>', '++', '--'];
const OPS1 = '+-*/%<>=!(){}[];,.&|^~?:';
const ASSIGN_OPS = ['=', '+=', '-=', '*=', '/=', '%='];

/** 把类型名归一化：long/short/char/unsigned → int */
const normType = (t) => (INT_TYPES.has(t) ? 'int' : (t === 'string' ? 'string' : t));

/** 创建方言 */
export function createDialect({ namespace, header, timeLimitMs = TIME_LIMIT_MS, label = '方言' }) {
  const NS = namespace;
  const HEADER_RE = new RegExp(`^#\\s*include\\s*<\\s*${header.replace('.', '\\.')}\\s*>$`);

  // ---------------- 词法分析 ----------------
  function lex(src, defines = new Map()) {
    const toks = [];
    const n = src.length;
    let i = 0;
    let line = 1;
    let sawInclude = false;
    const push = (t, v) => toks.push({ t, v, line });
    const isIdStart = (c) => /[A-Za-z_]/.test(c);
    const isIdChar = (c) => /[A-Za-z0-9_]/.test(c);

    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++;
          i++;
        }
        if (i >= n) throw new DialectError('块注释没有结束（缺少 */）', line);
        i += 2;
        continue;
      }
      if (c === '#') {
        let end = src.indexOf('\n', i);
        if (end < 0) end = n;
        const directive = src.slice(i, end).trim();
        if (HEADER_RE.test(directive)) {
          sawInclude = true;
        } else if (/^#\s*define\s+\w+\s+.+$/.test(directive)) {
          // 简单对象宏：#define NAME value
          const m = directive.match(/^#\s*define\s+(\w+)\s+(.+)$/);
          defines.set(m[1], m[2].trim());
        } else if (/^#\s*define\s+\w+$/.test(directive)) {
          const m = directive.match(/^#\s*define\s+(\w+)$/);
          defines.set(m[1], '1');
        } else {
          throw new DialectError(`只允许 #include<${header}> 和 #define，不要引入其他头文件（比如 iostream）`, line);
        }
        i = end;
        continue;
      }
      // 字符串字面量：只允许在 cout 里做调试输出
      if (c === '"') {
        let j = i + 1;
        let out = '';
        while (j < n && src[j] !== '"') {
          if (src[j] === '\\') {
            const e = src[j + 1];
            out += e === 'n' ? '\n' : e === 't' ? '\t' : e === '"' ? '"' : e === '\\' ? '\\' : e;
            j += 2;
            continue;
          }
          if (src[j] === '\n') throw new DialectError('字符串不能跨行', line);
          out += src[j];
          j++;
        }
        if (j >= n) throw new DialectError('字符串没有结束（缺少引号）', line);
        if (out.length > MAX_STRING) throw new DialectError('字符串太长', line);
        push('str', out);
        i = j + 1;
        continue;
      }
      if (c === "'") throw new DialectError('不支持字符字面量，请用数字（如 65 表示 A）', line);
      if (isIdStart(c)) {
        let j = i;
        while (j < n && isIdChar(src[j])) j++;
        let word = src.slice(i, j);
        // 宏替换
        if (defines.has(word)) word = defines.get(word);
        if (src.startsWith('::', j)) {
          if (word !== NS) throw new DialectError(`只能使用 ${NS}:: 命名空间，不支持 ${word}::`, line);
          const m = j + 2;
          let k = m;
          while (k < n && isIdChar(src[k])) k++;
          const name = src.slice(m, k);
          if (!name) throw new DialectError(`${NS}:: 后面要写名字`, line);
          push('id', `${NS}::${name}`);
          i = k;
          continue;
        }
        if (KEYWORDS.has(word)) push('kw', word);
        else if (/^\d+$/.test(word)) push('num', Number(word));
        else push('id', word);
        i = j;
        continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i;
        while (j < n && /[0-9]/.test(src[j])) j++;
        push('num', Number(src.slice(i, j)));
        i = j;
        continue;
      }
      const two = src.slice(i, i + 2);
      if (OPS2.includes(two)) { push('op', two); i += 2; continue; }
      if (OPS1.includes(c)) { push('op', c); i++; continue; }
      throw new DialectError(`无法识别的字符 "${c}"`, line);
    }
    if (!sawInclude) throw new DialectError(`第一行必须写 #include<${header}>`, 1);
    push('eof', null);
    return toks;
  }

  // ---------------- 语法分析 ----------------
  class Parser {
    constructor(toks) { this.toks = toks; this.p = 0; }
    peek(o = 0) { return this.toks[Math.min(this.p + o, this.toks.length - 1)]; }
    next() { return this.toks[this.p++]; }
    isOp(v, o = 0) { const t = this.peek(o); return t.t === 'op' && t.v === v; }
    isKw(v, o = 0) { const t = this.peek(o); return t.t === 'kw' && t.v === v; }
    accept(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
    acceptKw(v) { if (this.isKw(v)) { this.p++; return true; } return false; }
    fail(msg, tok = this.peek()) { throw new DialectError(msg, tok.line); }
    expectOp(v) {
      if (!this.isOp(v)) this.fail(`这里应该是 "${v}"`);
      return this.next();
    }
    ident() {
      const t = this.peek();
      if (t.t !== 'id') this.fail('这里应该是一个名字');
      this.p++;
      return t.v;
    }
    /** 是否是类型名起始（含 const 前缀与类型别名） */
    atType() {
      const t = this.peek();
      return t.t === 'kw' && (TYPES.has(t.v) || INT_TYPES.has(t.v) || t.v === 'const');
    }
    readType() {
      let isConst = false;
      while (this.isKw('const')) { isConst = true; this.p++; }
      let t = this.next();
      const names = [t.v];
      // long long / unsigned int 之类的两段类型
      while (this.peek().t === 'kw' && (INT_TYPES.has(this.peek().v) || this.peek().v === 'int')) {
        names.push(this.next().v);
      }
      const base = names[0];
      if (!(TYPES.has(base) || INT_TYPES.has(base))) {
        throw new DialectError(`不支持的类型 ${names.join(' ')}`, t.line);
      }
      return { type: normType(base), isConst };
    }

    program() {
      const funcs = {};
      const globals = [];
      while (this.peek().t !== 'eof') {
        if (!this.atType()) this.fail('这里应该是类型名：int / long / bool / void / pair / string');
        const { type, isConst } = this.readType();
        const nameTok = this.peek();
        const name = this.ident();
        if (this.isOp('(')) {
          if (funcs[name]) this.fail(`函数 ${name} 重复定义`, nameTok);
          funcs[name] = this.funcRest(type, name, nameTok.line);
        } else {
          globals.push(this.varRest(type, name, nameTok.line, isConst));
        }
      }
      if (!funcs.main) throw new DialectError('缺少 void main()：每一帧都会调用它', 1);
      if (funcs.main.type !== 'void' || funcs.main.params.length) {
        throw new DialectError('main 必须是 void main()，不带参数（不要写 int main，也不要 return 0）', funcs.main.line);
      }
      return { funcs, globals };
    }

    funcRest(type, name, line) {
      this.expectOp('(');
      const params = [];
      if (!this.isOp(')')) {
        if (this.isKw('void') && this.isOp(')', 1)) {
          this.p++;
        } else {
          do {
            const pt = this.readType();
            if (pt.type === 'void') this.fail('参数不能是 void');
            params.push({ type: pt.type, name: this.ident() });
          } while (this.accept(','));
        }
      }
      this.expectOp(')');
      const body = this.block();
      return { type, name, params, body, line };
    }

    /** 变量声明（支持 int a[10]; 与 const） */
    varRest(type, name, line, isConst = false) {
      if (type === 'void') this.fail('变量不能是 void', { line });
      let arraySize = null;
      if (this.isOp('[')) {
        this.p++;
        const sizeExpr = this.expr();
        this.expectOp(']');
        arraySize = sizeExpr;
      }
      let init = null;
      if (this.accept('=')) init = this.expr();
      // 支持 int a = 1, b = 2, c; 这种一行多个声明
      const decls = [{ k: 'decl', type, name, init, line, isConst, arraySize }];
      while (this.accept(',')) {
        const n2 = this.ident();
        let size2 = null;
        if (this.isOp('[')) {
          this.p++;
          size2 = this.expr();
          this.expectOp(']');
        }
        let init2 = null;
        if (this.accept('=')) init2 = this.expr();
        decls.push({ k: 'decl', type, name: n2, init: init2, line, isConst, arraySize: size2 });
      }
      this.expectOp(';');
      return decls.length === 1 ? decls[0] : { k: 'decls', list: decls, line };
    }

    block() {
      const open = this.expectOp('{');
      const body = [];
      while (!this.isOp('}')) {
        if (this.peek().t === 'eof') this.fail('代码没写完，缺少 }', open);
        body.push(this.stmt());
      }
      this.p++;
      return { k: 'block', body, line: open.line };
    }

    stmt() {
      const t = this.peek();
      if (this.isOp('{')) return this.block();
      if (this.isOp(';')) { this.p++; return { k: 'block', body: [], line: t.line }; }

      // cout << a << b << endl;
      if (this.isKw('cout')) {
        this.p++;
        const parts = [];
        while (this.accept('<<')) parts.push(this.binary(9));
        this.expectOp(';');
        if (!parts.length) this.fail('cout 后面要写 << 表达式', t);
        return { k: 'cout', parts, line: t.line };
      }

      if (this.atType()) {
        const { type, isConst } = this.readType();
        const name = this.ident();
        return this.varRest(type, name, t.line, isConst);
      }
      if (this.isKw('if')) {
        this.p++;
        this.expectOp('(');
        const cond = this.expr();
        this.expectOp(')');
        const then = this.stmt();
        let els = null;
        if (this.acceptKw('else')) els = this.stmt();
        return { k: 'if', cond, then, else: els, line: t.line };
      }
      if (this.isKw('while')) {
        this.p++;
        this.expectOp('(');
        const cond = this.expr();
        this.expectOp(')');
        return { k: 'while', cond, body: this.stmt(), line: t.line };
      }
      if (this.isKw('do')) {
        this.p++;
        const body = this.stmt();
        if (!this.acceptKw('while')) this.fail('do 后面必须跟 while (条件);');
        this.expectOp('(');
        const cond = this.expr();
        this.expectOp(')');
        this.expectOp(';');
        return { k: 'do', cond, body, line: t.line };
      }
      if (this.isKw('for')) {
        this.p++;
        this.expectOp('(');
        let init = null;
        if (this.isOp(';')) {
          this.p++;
        } else if (this.atType()) {
          init = this.stmt();
        } else {
          init = { k: 'expr', e: this.expr(), line: t.line };
          this.expectOp(';');
        }
        let cond = null;
        if (!this.isOp(';')) cond = this.expr();
        this.expectOp(';');
        let step = null;
        if (!this.isOp(')')) step = this.expr();
        this.expectOp(')');
        return { k: 'for', init, cond, step, body: this.stmt(), line: t.line };
      }
      if (this.isKw('switch')) {
        this.p++;
        this.expectOp('(');
        const subject = this.expr();
        this.expectOp(')');
        this.expectOp('{');
        const cases = [];
        let def = null;
        while (!this.isOp('}')) {
          if (this.acceptKw('case')) {
            const value = this.expr();
            this.expectOp(':');
            const body = [];
            while (!this.isOp('}') && !this.isKw('case') && !this.isKw('default')) body.push(this.stmt());
            cases.push({ value, body });
          } else if (this.acceptKw('default')) {
            this.expectOp(':');
            const body = [];
            while (!this.isOp('}') && !this.isKw('case') && !this.isKw('default')) body.push(this.stmt());
            def = body;
          } else {
            this.fail('switch 里只能写 case 或 default');
          }
        }
        this.p++;
        return { k: 'switch', subject, cases, def, line: t.line };
      }
      if (this.isKw('return')) {
        this.p++;
        let e = null;
        if (!this.isOp(';')) e = this.expr();
        this.expectOp(';');
        return { k: 'return', e, line: t.line };
      }
      if (this.isKw('break')) { this.p++; this.expectOp(';'); return { k: 'break', line: t.line }; }
      if (this.isKw('continue')) { this.p++; this.expectOp(';'); return { k: 'continue', line: t.line }; }
      const e = this.expr();
      this.expectOp(';');
      return { k: 'expr', e, line: t.line };
    }

    expr() { return this.assign(); }

    assign() {
      const left = this.ternary();
      const t = this.peek();
      if (t.t === 'op' && ASSIGN_OPS.includes(t.v)) {
        if (left.k !== 'name' && left.k !== 'host' && left.k !== 'index') {
          this.fail(`赋值的左边只能是变量、数组元素或 ${NS}:: 变量`, t);
        }
        this.p++;
        const value = this.assign();
        return { k: 'assign', op: t.v, target: left, value, line: t.line };
      }
      return left;
    }

    ternary() {
      const cond = this.binary(0);
      if (this.isOp('?')) {
        const t = this.next();
        const a = this.assign();
        this.expectOp(':');
        const b = this.assign();
        return { k: 'tern', cond, a, b, line: t.line };
      }
      return cond;
    }

    // 优先级从低到高
    binary(level) {
      const LEVELS = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '<=', '>', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
      if (level >= LEVELS.length) return this.unary();
      let left = this.binary(level + 1);
      for (;;) {
        const t = this.peek();
        if (t.t === 'op' && LEVELS[level].includes(t.v)) {
          this.p++;
          const right = this.binary(level + 1);
          left = { k: 'bin', op: t.v, a: left, b: right, line: t.line };
        } else break;
      }
      return left;
    }

    unary() {
      const t = this.peek();
      if (t.t === 'op' && ['-', '!', '~'].includes(t.v)) {
        this.p++;
        return { k: 'un', op: t.v, a: this.unary(), line: t.line };
      }
      return this.postfix();
    }

    postfix() {
      let e = this.primary();
      for (;;) {
        const t = this.peek();
        if (this.isOp('++') || this.isOp('--')) {
          if (e.k !== 'name' && e.k !== 'host' && e.k !== 'index') this.fail('++ / -- 只能用在变量上', t);
          this.p++;
          e = { k: 'assign', op: t.v === '++' ? '+=' : '-=', target: e, value: { k: 'lit', v: 1, line: t.line }, line: t.line };
          continue;
        }
        if (this.isOp('(')) {
          if (e.k !== 'name' && e.k !== 'host') this.fail('只能调用函数', t);
          this.p++;
          const args = [];
          if (!this.isOp(')')) {
            do { args.push(this.expr()); } while (this.accept(','));
          }
          this.expectOp(')');
          e = { k: 'call', name: e.name, builtin: e.k === 'host', args, line: t.line };
          continue;
        }
        if (this.isOp('[')) {
          this.p++;
          const idx = this.expr();
          this.expectOp(']');
          e = { k: 'index', a: e, idx, line: t.line };
          continue;
        }
        if (this.isOp('.')) {
          this.p++;
          const m = this.ident();
          if (this.isOp('(')) {
            this.p++;
            this.expectOp(')');
            e = { k: 'method', a: e, name: m, line: t.line };
          } else {
            e = { k: 'member', a: e, name: m, line: t.line };
          }
          continue;
        }
        break;
      }
      return e;
    }

    primary() {
      const t = this.next();
      if (t.t === 'num') return { k: 'lit', v: t.v, line: t.line };
      if (t.t === 'str') return { k: 'lit', v: t.v, line: t.line };
      if (t.t === 'kw' && (t.v === 'true' || t.v === 'false')) return { k: 'lit', v: t.v === 'true', line: t.line };
      if (t.t === 'kw' && t.v === 'endl') return { k: 'lit', v: '\n', line: t.line };
      if (t.t === 'kw' && t.v === 'pair') {
        this.expectOp('(');
        const a = this.expr();
        this.expectOp(',');
        const b = this.expr();
        this.expectOp(')');
        return { k: 'pairLit', a, b, line: t.line };
      }
      if (t.t === 'id') {
        if (t.v.startsWith(`${NS}::`)) return { k: 'host', name: t.v.slice(NS.length + 2), line: t.line };
        return { k: 'name', name: t.v, line: t.line };
      }
      if (t.t === 'op' && t.v === '(') {
        const e = this.expr();
        this.expectOp(')');
        return e;
      }
      this.fail('这里缺少一个值或表达式', t);
      return null;
    }
  }

  function parse(src) {
    const defines = new Map();
    return new Parser(lex(src, defines)).program();
  }

  function checkCode(src) {
    try {
      parse(src);
      return [];
    } catch (e) {
      if (e instanceof DialectError) return [{ line: e.line, message: e.message }];
      return [{ line: 1, message: String(e && e.message) }];
    }
  }

  // ---------------- 运行 ----------------
  function defaultOf(type) {
    if (type === 'int') return 0;
    if (type === 'bool') return false;
    if (type === 'pair') return new Pair(0, 0);
    if (type === 'string') return '';
    return undefined;
  }

  class Interpreter {
    constructor(ast) {
      this.ast = ast;
      this.globals = new Map();
      this.inited = false;
      this.env = [];
      this.host = null;
      this.depth = 0;
      this.steps = 0;
      this.deadline = 0;
      this.out = [];
    }

    /** 每帧调用一次；host 提供 :: 变量、函数，以及可选的 console(line) */
    runMain(host) {
      this.host = host;
      this.env = [];
      this.depth = 0;
      this.steps = 0;
      this.out = [];
      this.deadline = now() + timeLimitMs;
      if (!this.inited) {
        this.inited = true;
        for (const g of this.ast.globals) {
          const v = g.init ? this.coerce(g.type, this.eval(g.init), g.line) : defaultOf(g.type);
          this.globals.set(g.name, { type: g.type, value: v, isConst: g.isConst });
        }
      }
      this.callUser('main', [], 0);
      return this.out;
    }

    budget(line) {
      this.steps++;
      if ((this.steps & 255) === 0 && now() > this.deadline) throw new TimeLimitError(line, timeLimitMs);
      if (this.steps > STEP_LIMIT) throw new DialectError('单次运行步数过多，可能是死循环', line);
    }

    fail(msg, line) { throw new DialectError(msg, line); }

    coerce(type, v, line) {
      if (type === 'int') {
        if (typeof v === 'number') return Math.trunc(v);
        if (typeof v === 'boolean') return v ? 1 : 0;
        this.fail('类型错误：这里需要 int', line);
      }
      if (type === 'bool') {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        this.fail('类型错误：这里需要 bool', line);
      }
      if (type === 'pair') {
        if (v instanceof Pair) return v;
        this.fail('类型错误：这里需要 pair', line);
      }
      if (type === 'string') {
        if (typeof v === 'string') return v;
        this.fail('类型错误：这里需要 string', line);
      }
      this.fail('类型错误', line);
      return v;
    }

    needInt(v, line) {
      if (typeof v === 'number') return Math.trunc(v);
      if (typeof v === 'boolean') return v ? 1 : 0;
      this.fail('类型错误：这里需要 int', line);
      return 0;
    }

    truthy(v, line) {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      this.fail('条件必须是 bool 或 int', line);
      return false;
    }

    findVar(name, line) {
      for (let i = this.env.length - 1; i >= 0; i--) {
        const v = this.env[i].get(name);
        if (v) return v;
      }
      const g = this.globals.get(name);
      if (g) return g;
      this.fail(`没有定义名为 ${name} 的变量`, line);
      return null;
    }

    callUser(name, args, line) {
      const fn = this.ast.funcs[name];
      if (!fn) this.fail(`没有这个函数：${name}`, line);
      if (args.length !== fn.params.length) this.fail(`函数 ${name} 需要 ${fn.params.length} 个参数`, line);
      if (++this.depth > RECURSION_LIMIT) this.fail('递归太深', line);
      const saved = this.env;
      const scope = new Map();
      fn.params.forEach((p, i) => scope.set(p.name, { type: p.type, value: this.coerce(p.type, args[i], line) }));
      this.env = [scope];
      let ret;
      try {
        const sig = this.execBlock(fn.body.body);
        if (sig && sig.kind === 'return') ret = sig.value;
      } finally {
        this.env = saved;
        this.depth--;
      }
      if (fn.type === 'void') return undefined;
      if (ret === undefined) this.fail(`函数 ${name} 缺少 return 返回值`, fn.line);
      return this.coerce(fn.type, ret, fn.line);
    }

    execBlock(stmts) {
      this.env.push(new Map());
      try {
        for (const s of stmts) {
          const sig = this.exec(s);
          if (sig) return sig;
        }
        return null;
      } finally {
        this.env.pop();
      }
    }

    exec(s) {
      this.budget(s.line);
      switch (s.k) {
        case 'block':
          return this.execBlock(s.body);
        case 'decls': {
          for (const d of s.list) this.exec(d);
          return null;
        }
        case 'decl': {
          const scope = this.env[this.env.length - 1];
          if (scope.has(s.name)) this.fail(`变量 ${s.name} 已经定义过了`, s.line);
          let value;
          if (s.arraySize) {
            const size = this.needInt(this.eval(s.arraySize), s.line);
            if (size <= 0 || size > 1000) this.fail(`数组长度必须在 1–1000 之间（当前 ${size}）`, s.line);
            value = { array: Array.from({ length: size }, () => defaultOf(s.type)), elemType: s.type };
          } else {
            value = s.init ? this.coerce(s.type, this.eval(s.init), s.line) : defaultOf(s.type);
          }
          scope.set(s.name, { type: s.type, value, isConst: s.isConst });
          return null;
        }
        case 'cout': {
          let text = '';
          for (const p of s.parts) {
            const v = this.eval(p);
            text += typeof v === 'boolean' ? (v ? 'true' : 'false') : (v instanceof Pair ? `(${v.first}, ${v.second})` : String(v));
          }
          if (this.out.length >= MAX_CONSOLE_LINES) {
            this.fail(`cout 输出超过 ${MAX_CONSOLE_LINES} 行，请减少调试输出`, s.line);
          }
          this.out.push(text);
          if (this.host && typeof this.host.console === 'function') this.host.console(text);
          return null;
        }
        case 'expr':
          this.eval(s.e);
          return null;
        case 'if':
          if (this.truthy(this.eval(s.cond), s.line)) return this.exec(s.then);
          if (s.else) return this.exec(s.else);
          return null;
        case 'while':
          while (this.truthy(this.eval(s.cond), s.line)) {
            const sig = this.exec(s.body);
            if (sig) {
              if (sig.kind === 'break') break;
              if (sig.kind === 'return') return sig;
            }
          }
          return null;
        case 'do':
          do {
            const sig = this.exec(s.body);
            if (sig) {
              if (sig.kind === 'break') break;
              if (sig.kind === 'return') return sig;
            }
          } while (this.truthy(this.eval(s.cond), s.line));
          return null;
        case 'for': {
          this.env.push(new Map());
          try {
            if (s.init) this.exec(s.init);
            while (!s.cond || this.truthy(this.eval(s.cond), s.line)) {
              const sig = this.exec(s.body);
              if (sig) {
                if (sig.kind === 'break') break;
                if (sig.kind === 'return') return sig;
              }
              if (s.step) this.eval(s.step);
            }
            return null;
          } finally {
            this.env.pop();
          }
        }
        case 'switch': {
          const subject = this.eval(s.subject);
          let matched = false;
          for (const c of s.cases) {
            const v = this.eval(c.value);
            if (!matched && v === subject) matched = true;
            if (matched) {
              const sig = this.execBlock(c.body);
              if (sig) {
                if (sig.kind === 'break') return null;
                if (sig.kind === 'return') return sig;
              }
            }
          }
          if (!matched && s.def) {
            const sig = this.execBlock(s.def);
            if (sig) {
              if (sig.kind === 'break') return null;
              if (sig.kind === 'return') return sig;
            }
          }
          return null;
        }
        case 'break': return { kind: 'break' };
        case 'continue': return { kind: 'continue' };
        case 'return': return { kind: 'return', value: s.e ? this.eval(s.e) : undefined };
        default:
          this.fail('内部错误：未知语句', s.line);
          return null;
      }
    }

    arith(op, a, b, line) {
      switch (op) {
        case '+': return this.needInt(a, line) + this.needInt(b, line);
        case '-': return this.needInt(a, line) - this.needInt(b, line);
        case '*': return this.needInt(a, line) * this.needInt(b, line);
        case '/': {
          this.needInt(a, line); this.needInt(b, line);
          if (b === 0) this.fail('除数不能为 0', line);
          return Math.trunc(a / b);
        }
        case '%': {
          this.needInt(a, line); this.needInt(b, line);
          if (b === 0) this.fail('除数不能为 0', line);
          return a % b;
        }
        case '&': return this.needInt(a, line) & this.needInt(b, line);
        case '|': return this.needInt(a, line) | this.needInt(b, line);
        case '^': return this.needInt(a, line) ^ this.needInt(b, line);
        case '<<': return this.needInt(a, line) << this.needInt(b, line);
        case '>>': return this.needInt(a, line) >> this.needInt(b, line);
        default:
          this.fail(`未知运算符 ${op}`, line);
          return 0;
      }
    }

    equal(a, b, line) {
      if (typeof a === 'number' && typeof b === 'number') return a === b;
      if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
      if (typeof a === 'string' && typeof b === 'string') return a === b;
      if (a instanceof Pair && b instanceof Pair) return a.first === b.first && a.second === b.second;
      this.fail('类型不同，不能比较', line);
      return false;
    }

    eval(e) {
      this.budget(e.line);
      switch (e.k) {
        case 'lit': return e.v;
        case 'pairLit': {
          const a = this.needInt(this.eval(e.a), e.line);
          const b = this.needInt(this.eval(e.b), e.line);
          return new Pair(a, b);
        }
        case 'name': return this.findVar(e.name, e.line).value;
        case 'host': return this.host.read(e.name, e.line);
        case 'un': {
          const v = this.eval(e.a);
          if (e.op === '-') return -this.needInt(v, e.line);
          if (e.op === '~') return ~this.needInt(v, e.line);
          return !this.truthy(v, e.line);
        }
        case 'tern':
          return this.truthy(this.eval(e.cond), e.line) ? this.eval(e.a) : this.eval(e.b);
        case 'bin': return this.binop(e);
        case 'assign': return this.assign(e);
        case 'call': {
          const args = e.args.map((a) => this.eval(a));
          if (e.builtin) return this.host.call(e.name, args, e.line);
          return this.callUser(e.name, args, e.line);
        }
        case 'index': {
          const arr = this.eval(e.a);
          const idx = this.needInt(this.eval(e.idx), e.line);
          if (Array.isArray(arr)) {
            if (idx < 0 || idx >= arr.length) this.fail(`数组下标越界：${idx}（长度 ${arr.length}）`, e.line);
            return arr[idx];
          }
          if (arr && Array.isArray(arr.array)) {
            if (idx < 0 || idx >= arr.array.length) this.fail(`数组下标越界：${idx}（长度 ${arr.array.length}）`, e.line);
            return arr.array[idx];
          }
          this.fail('只有数组可以用 [ ]', e.line);
          return 0;
        }
        case 'member': {
          const obj = this.eval(e.a);
          if (obj instanceof Pair) {
            if (e.name === 'first') return obj.first;
            if (e.name === 'second') return obj.second;
            this.fail(`pair 没有成员 ${e.name}`, e.line);
          }
          if (e.name === 'size' && Array.isArray(obj)) return obj.length;
          this.fail(`没有成员 ${e.name}`, e.line);
          return 0;
        }
        case 'method': {
          const obj = this.eval(e.a);
          if (Array.isArray(obj) && e.name === 'size') return obj.length;
          if (obj && Array.isArray(obj.array) && e.name === 'size') return obj.array.length;
          this.fail(`没有方法 ${e.name}()`, e.line);
          return 0;
        }
        default:
          this.fail('内部错误：未知表达式', e.line);
          return 0;
      }
    }

    binop(e) {
      if (e.op === '&&') {
        if (!this.truthy(this.eval(e.a), e.line)) return false;
        return this.truthy(this.eval(e.b), e.line);
      }
      if (e.op === '||') {
        if (this.truthy(this.eval(e.a), e.line)) return true;
        return this.truthy(this.eval(e.b), e.line);
      }
      const a = this.eval(e.a);
      const b = this.eval(e.b);
      switch (e.op) {
        case '==': return this.equal(a, b, e.line);
        case '!=': return !this.equal(a, b, e.line);
        case '<': return this.needInt(a, e.line) < this.needInt(b, e.line);
        case '<=': return this.needInt(a, e.line) <= this.needInt(b, e.line);
        case '>': return this.needInt(a, e.line) > this.needInt(b, e.line);
        case '>=': return this.needInt(a, e.line) >= this.needInt(b, e.line);
        default: return this.arith(e.op, a, b, e.line);
      }
    }

    assign(e) {
      const value = this.eval(e.value);
      const op = e.op === '=' ? null : e.op.slice(0, 1);

      // 数组元素赋值
      if (e.target.k === 'index') {
        const container = this.eval(e.target.a);
        const idx = this.needInt(this.eval(e.target.idx), e.target.line);
        if (container && Array.isArray(container.array)) {
          if (idx < 0 || idx >= container.array.length) {
            this.fail(`数组下标越界：${idx}（长度 ${container.array.length}）`, e.target.line);
          }
          const cur = container.array[idx];
          const nv = op ? this.arith(op, cur, value, e.target.line) : value;
          container.array[idx] = this.coerce(container.elemType, nv, e.target.line);
          return container.array[idx];
        }
        if (Array.isArray(container)) {
          if (idx < 0 || idx >= container.length) this.fail('数组下标越界', e.target.line);
          const nv = op ? this.arith(op, container[idx], value, e.target.line) : value;
          container[idx] = this.coerce(typeof nv === 'boolean' ? 'bool' : 'int', nv, e.target.line);
          return container[idx];
        }
        this.fail('不能给这个下标赋值', e.target.line);
      }

      if (e.target.k === 'name') {
        const slot = this.findVar(e.target.name, e.target.line);
        if (slot.isConst) this.fail(`常量 ${e.target.name} 不能修改`, e.target.line);
        const nv = op ? this.arith(op, slot.value, value, e.target.line) : value;
        slot.value = this.coerce(slot.type, nv, e.target.line);
        return slot.value;
      }

      const name = e.target.name;
      const ty = this.host.writableType(name);
      if (!ty) this.fail(`${NS}::${name} 是只读的，不能修改`, e.target.line);
      const cur = this.host.read(name, e.target.line);
      const nv = op ? this.arith(op, cur, value, e.target.line) : value;
      const coerced = this.coerce(ty, nv, e.target.line);
      this.host.write(name, coerced, e.target.line);
      return coerced;
    }
  }

  function makeInterpreter(src) {
    return new Interpreter(parse(src));
  }

  return {
    namespace: NS,
    header,
    label,
    timeLimitMs,
    lex,
    parse,
    checkCode,
    Interpreter,
    makeInterpreter,
    Pair,
    DialectError,
    TimeLimitError,
  };
}

export { DialectError as BombError };

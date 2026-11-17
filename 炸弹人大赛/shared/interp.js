// 炸弹人方言解释器：一个 C++ 风格的子集，专门给炸弹人大赛用。
// 不是真正的 C++ 编译器：没有头文件、没有 std、没有字符串、没有指针。
// 唯一的外部接口是 bomb:: 命名空间。每一帧调用一次 void main()。

export class BombError extends Error {
  constructor(message, line = 0) {
    super(message);
    this.name = 'BombError';
    this.line = line;
  }
}

export class TimeLimitError extends BombError {
  constructor(line = 0) {
    super('单次运行超过时间限制（50ms）', line);
    this.name = 'TimeLimitError';
  }
}

export const TIME_LIMIT_MS = 50;      // 每次 main() 的最长运行时间
const STEP_LIMIT = 200000;            // 防止死循环的步数上限（确定性兜底）
const RECURSION_LIMIT = 100;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class Pair {
  constructor(first, second) {
    this.first = first;
    this.second = second;
  }
}

const KEYWORDS = new Set(['int', 'bool', 'void', 'pair', 'if', 'else', 'while', 'for', 'return', 'break', 'continue', 'true', 'false']);
const TYPES = new Set(['int', 'bool', 'void', 'pair']);
const OPS2 = ['<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '++', '--'];
const OPS1 = '+-*/%<>=!(){}[];,.';
const ASSIGN_OPS = ['=', '+=', '-=', '*=', '/=', '%='];

// ---------------- 词法分析 ----------------
export function lex(src) {
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
      if (i >= n) throw new BombError('块注释没有结束（缺少 */）', line);
      i += 2;
      continue;
    }
    if (c === '#') {
      let end = src.indexOf('\n', i);
      if (end < 0) end = n;
      const directive = src.slice(i, end).trim();
      if (/^#\s*include\s*<\s*bomb\.h\s*>$/.test(directive)) {
        sawInclude = true;
      } else {
        throw new BombError('只允许 #include<bomb.h>，不要引入其他头文件（比如 iostream）', line);
      }
      i = end;
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < n && isIdChar(src[j])) j++;
      const word = src.slice(i, j);
      if (src.startsWith('::', j)) {
        if (word !== 'bomb') throw new BombError(`只能使用 bomb:: 命名空间，不支持 ${word}::`, line);
        let m = j + 2;
        let k = m;
        while (k < n && isIdChar(src[k])) k++;
        const name = src.slice(m, k);
        if (!name) throw new BombError('bomb:: 后面要写名字，比如 bomb::player_pos', line);
        push('id', `bomb::${name}`);
        i = k;
        continue;
      }
      if (KEYWORDS.has(word)) push('kw', word);
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
    if (c === '"' || c === "'") throw new BombError('本游戏不支持字符串', line);
    throw new BombError(`无法识别的字符 "${c}"`, line);
  }
  if (!sawInclude) throw new BombError('第一行必须写 #include<bomb.h>', 1);
  push('eof', null);
  return toks;
}

// ---------------- 语法分析 ----------------
class Parser {
  constructor(toks) {
    this.toks = toks;
    this.p = 0;
  }
  peek(o = 0) { return this.toks[Math.min(this.p + o, this.toks.length - 1)]; }
  next() { return this.toks[this.p++]; }
  isOp(v, o = 0) { const t = this.peek(o); return t.t === 'op' && t.v === v; }
  isKw(v, o = 0) { const t = this.peek(o); return t.t === 'kw' && t.v === v; }
  accept(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
  fail(msg, tok = this.peek()) { throw new BombError(msg, tok.line); }
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

  program() {
    const funcs = {};
    const globals = [];
    while (this.peek().t !== 'eof') {
      const t = this.peek();
      if (!(t.t === 'kw' && TYPES.has(t.v))) this.fail('这里应该是类型名：int / bool / void / pair');
      this.p++;
      const nameTok = this.peek();
      const name = this.ident();
      if (this.isOp('(')) {
        if (funcs[name]) this.fail(`函数 ${name} 重复定义`, nameTok);
        funcs[name] = this.funcRest(t.v, name, nameTok.line);
      } else {
        globals.push(this.varRest(t.v, name, nameTok.line));
      }
    }
    if (!funcs.main) throw new BombError('缺少 void main()：每一帧都会调用它', 1);
    if (funcs.main.type !== 'void' || funcs.main.params.length) {
      throw new BombError('main 必须是 void main()，不带参数（不要写 int main，也不要 return 0）', funcs.main.line);
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
          const t = this.peek();
          if (!(t.t === 'kw' && (t.v === 'int' || t.v === 'bool' || t.v === 'pair'))) this.fail('参数类型应该是 int / bool / pair');
          this.p++;
          params.push({ type: t.v, name: this.ident() });
        } while (this.accept(','));
      }
    }
    this.expectOp(')');
    const body = this.block();
    return { type, name, params, body, line };
  }

  varRest(type, name, line) {
    if (type === 'void') this.fail('变量不能是 void', { line });
    let init = null;
    if (this.accept('=')) init = this.expr();
    this.expectOp(';');
    return { k: 'decl', type, name, init, line };
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
    if (t.t === 'kw' && (t.v === 'int' || t.v === 'bool' || t.v === 'pair')) {
      this.p++;
      const name = this.ident();
      return this.varRest(t.v, name, t.line);
    }
    if (this.isKw('if')) {
      this.p++;
      this.expectOp('(');
      const cond = this.expr();
      this.expectOp(')');
      const then = this.stmt();
      let els = null;
      if (this.isKw('else')) { this.p++; els = this.stmt(); }
      return { k: 'if', cond, then, else: els, line: t.line };
    }
    if (this.isKw('while')) {
      this.p++;
      this.expectOp('(');
      const cond = this.expr();
      this.expectOp(')');
      return { k: 'while', cond, body: this.stmt(), line: t.line };
    }
    if (this.isKw('for')) {
      this.p++;
      this.expectOp('(');
      let init = null;
      if (this.isOp(';')) {
        this.p++;
      } else if (this.peek().t === 'kw' && TYPES.has(this.peek().v)) {
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
    const left = this.or();
    const t = this.peek();
    if (t.t === 'op' && ASSIGN_OPS.includes(t.v)) {
      if (left.k !== 'name' && left.k !== 'bomb') this.fail('赋值的左边只能是变量或 bomb:: 变量', t);
      this.p++;
      const value = this.assign();
      return { k: 'assign', op: t.v, target: left, value, line: t.line };
    }
    return left;
  }

  bin(ops, sub) {
    let left = sub();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && ops.includes(t.v)) {
        this.p++;
        const right = sub();
        left = { k: 'bin', op: t.v, a: left, b: right, line: t.line };
      } else break;
    }
    return left;
  }
  or() { return this.bin(['||'], () => this.and()); }
  and() { return this.bin(['&&'], () => this.eq()); }
  eq() { return this.bin(['==', '!='], () => this.rel()); }
  rel() { return this.bin(['<', '<=', '>', '>='], () => this.add()); }
  add() { return this.bin(['+', '-'], () => this.mul()); }
  mul() { return this.bin(['*', '/', '%'], () => this.unary()); }

  unary() {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '!')) {
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
        if (e.k !== 'name' && e.k !== 'bomb') this.fail('++ / -- 只能用在变量上', t);
        this.p++;
        // x++ 当作 x += 1（结果为增加前的值，但在 for 步进里不关心）
        e = { k: 'assign', op: t.v === '++' ? '+=' : '-=', target: e, value: { k: 'lit', v: 1, line: t.line }, line: t.line };
        continue;
      }
      if (this.isOp('(')) {
        if (e.k !== 'name' && e.k !== 'bomb') this.fail('只能调用函数', t);
        this.p++;
        const args = [];
        if (!this.isOp(')')) {
          do { args.push(this.expr()); } while (this.accept(','));
        }
        this.expectOp(')');
        e = { k: 'call', name: e.name, builtin: e.k === 'bomb', args, line: t.line };
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
    if (t.t === 'kw' && (t.v === 'true' || t.v === 'false')) return { k: 'lit', v: t.v === 'true', line: t.line };
    if (t.t === 'kw' && t.v === 'pair') {
      this.expectOp('(');
      const a = this.expr();
      this.expectOp(',');
      const b = this.expr();
      this.expectOp(')');
      return { k: 'pairLit', a, b, line: t.line };
    }
    if (t.t === 'id') {
      if (t.v.startsWith('bomb::')) return { k: 'bomb', name: t.v.slice(6), line: t.line };
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

/** 只做语法检查（编辑器用），返回错误列表 */
export function parse(src) {
  const toks = lex(src);
  return new Parser(toks).program();
}

export function checkCode(src) {
  try {
    parse(src);
    return [];
  } catch (e) {
    if (e instanceof BombError) return [{ line: e.line, message: e.message }];
    return [{ line: 1, message: String(e && e.message) }];
  }
}

// ---------------- 运行 ----------------
export function defaultOf(type) {
  if (type === 'int') return 0;
  if (type === 'bool') return false;
  if (type === 'pair') return new Pair(0, 0);
  return undefined;
}

export class Interpreter {
  constructor(ast) {
    this.ast = ast;
    this.globals = new Map();
    this.inited = false;
    this.env = [];
    this.host = null;
    this.depth = 0;
    this.steps = 0;
    this.deadline = 0;
  }

  /** 每一帧调用一次 main()。host 提供 bomb:: 变量与函数。 */
  runMain(host) {
    this.host = host;
    this.env = [];
    this.depth = 0;
    this.steps = 0;
    this.deadline = now() + TIME_LIMIT_MS;
    if (!this.inited) {
      this.inited = true;
      for (const g of this.ast.globals) {
        const v = g.init ? this.coerce(g.type, this.eval(g.init), g.line) : defaultOf(g.type);
        this.globals.set(g.name, { type: g.type, value: v });
      }
    }
    return this.callUser('main', [], 0);
  }

  budget(line) {
    this.steps++;
    if ((this.steps & 255) === 0 && now() > this.deadline) throw new TimeLimitError(line);
    if (this.steps > STEP_LIMIT) throw new BombError('单次运行步数过多，可能是死循环', line);
  }

  fail(msg, line) { throw new BombError(msg, line); }

  coerce(type, v, line) {
    if (type === 'int') {
      if (typeof v !== 'number') this.fail('类型错误：这里需要 int', line);
      return v;
    }
    if (type === 'bool') {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      this.fail('类型错误：这里需要 bool', line);
    }
    if (type === 'pair') {
      if (!(v instanceof Pair)) this.fail('类型错误：这里需要 pair', line);
      return v;
    }
    this.fail('类型错误', line);
    return v;
  }

  needInt(v, line) {
    if (typeof v !== 'number') this.fail('类型错误：这里需要 int', line);
    return v;
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
      case 'decl': {
        const scope = this.env[this.env.length - 1];
        if (scope.has(s.name)) this.fail(`变量 ${s.name} 已经定义过了`, s.line);
        const v = s.init ? this.coerce(s.type, this.eval(s.init), s.line) : defaultOf(s.type);
        scope.set(s.name, { type: s.type, value: v });
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
      case 'break':
        return { kind: 'break' };
      case 'continue':
        return { kind: 'continue' };
      case 'return':
        return { kind: 'return', value: s.e ? this.eval(s.e) : undefined };
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
        this.needInt(a, line);
        this.needInt(b, line);
        if (b === 0) this.fail('除数不能为 0', line);
        return Math.trunc(a / b);
      }
      case '%': {
        this.needInt(a, line);
        this.needInt(b, line);
        if (b === 0) this.fail('除数不能为 0', line);
        return a % b;
      }
      default:
        this.fail(`未知运算符 ${op}`, line);
        return 0;
    }
  }

  equal(a, b, line) {
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
    if (a instanceof Pair && b instanceof Pair) return a.first === b.first && a.second === b.second;
    this.fail('类型不同，不能比较', line);
    return false;
  }

  eval(e) {
    this.budget(e.line);
    switch (e.k) {
      case 'lit':
        return e.v;
      case 'pairLit': {
        const a = this.needInt(this.eval(e.a), e.line);
        const b = this.needInt(this.eval(e.b), e.line);
        return new Pair(a, b);
      }
      case 'name':
        return this.findVar(e.name, e.line).value;
      case 'bomb':
        return this.host.read(e.name, e.line);
      case 'un': {
        const v = this.eval(e.a);
        if (e.op === '-') return -this.needInt(v, e.line);
        return !this.truthy(v, e.line);
      }
      case 'bin':
        return this.binop(e);
      case 'assign':
        return this.assign(e);
      case 'call': {
        const args = e.args.map((a) => this.eval(a));
        if (e.builtin) return this.host.call(e.name, args, e.line);
        return this.callUser(e.name, args, e.line);
      }
      case 'index': {
        const arr = this.eval(e.a);
        const idx = this.needInt(this.eval(e.idx), e.line);
        if (!Array.isArray(arr)) this.fail('只有数组可以用 [ ]', e.line);
        if (idx < 0 || idx >= arr.length) this.fail(`数组下标越界：${idx}（长度 ${arr.length}）`, e.line);
        return arr[idx];
      }
      case 'member': {
        const obj = this.eval(e.a);
        if (!(obj instanceof Pair)) this.fail('只有 pair 有 .first / .second', e.line);
        if (e.name === 'first') return obj.first;
        if (e.name === 'second') return obj.second;
        this.fail(`pair 没有成员 ${e.name}`, e.line);
        return 0;
      }
      case 'method': {
        const obj = this.eval(e.a);
        if (Array.isArray(obj) && e.name === 'size') return obj.length;
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
    if (e.target.k === 'name') {
      const slot = this.findVar(e.target.name, e.line);
      const nv = op ? this.arith(op, slot.value, value, e.line) : value;
      slot.value = this.coerce(slot.type, nv, e.line);
      return slot.value;
    }
    // bomb:: 变量：只有两个可写，其他全部只读
    const name = e.target.name;
    const ty = this.host.writableType(name);
    if (!ty) this.fail(`bomb::${name} 是只读的，不能修改`, e.line);
    const cur = this.host.read(name, e.line);
    const nv = op ? this.arith(op, cur, value, e.line) : value;
    const coerced = this.coerce(ty, nv, e.line);
    this.host.write(name, coerced, e.line);
    return coerced;
  }
}

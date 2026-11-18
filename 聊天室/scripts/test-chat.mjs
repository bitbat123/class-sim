// End-to-end test for the chat server.
// Starts the server in-process on a random port, connects real WebSocket clients, and checks:
//   1. a public message reaches every connected client
//   2. a private message reaches only sender and recipient (a third client must NOT get it)
//   3. a 2001-character message is rejected; a 2000-character message is accepted
//   4. a duplicate name (case-insensitive) is rejected
// Run: node scripts/test-chat.mjs   (from the project root, after `npm install` in ./server)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(here, '..', 'server');
const require = createRequire(path.join(serverDir, 'package.json'));
const { WebSocket } = require('ws');
const { createChatServer, MAX_MESSAGE_LENGTH } = await import(
  pathToFileURL(path.join(serverDir, 'index.js')).href
);

let passed = 0;
let failed = 0;
const log = (...a) => console.log(...a);

function check(label, cond, detail = '') {
  if (cond) {
    passed++;
    log(`  PASS  ${label}`);
  } else {
    failed++;
    log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Minimal client that records every frame it receives and offers waitFor(). */
function connect(port, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const received = [];
    const waiters = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      received.push(msg);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].pred(msg)) {
          waiters[i].resolve(msg);
          waiters.splice(i, 1);
        }
      }
    });
    ws.once('open', () => resolve({ ws, label, received, send: (o) => ws.send(JSON.stringify(o)), waitFor, close: () => ws.close() }));
    ws.once('error', reject);

    function waitFor(pred, timeoutMs = 2000) {
      const existing = received.find(pred);
      if (existing) return Promise.resolve(existing);
      return new Promise((res, rej) => {
        const waiter = { pred, resolve: res };
        waiters.push(waiter);
        setTimeout(() => {
          const idx = waiters.indexOf(waiter);
          if (idx >= 0) {
            waiters.splice(idx, 1);
            rej(new Error(`[${label}] timed out waiting for message`));
          }
        }, timeoutMs);
      });
    }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = createChatServer({ port: 0, host: '127.0.0.1' });
  const addr = await server.ready;
  const port = addr.port;
  log(`server started on 127.0.0.1:${port}\n`);

  const clients = [];
  try {
    // --- Join: Alice and Bob ---
    const alice = await connect(port, 'Alice');
    clients.push(alice);
    alice.send({ type: 'join', name: 'Alice' });
    const aliceWelcome = await alice.waitFor((m) => m.type === 'welcome');
    check('Alice joins and gets welcome', aliceWelcome.name === 'Alice');

    const bob = await connect(port, 'Bob');
    clients.push(bob);
    bob.send({ type: 'join', name: 'Bob' });
    await bob.waitFor((m) => m.type === 'welcome');
    const usersMsg = await alice.waitFor((m) => m.type === 'users' && m.users.includes('Bob'));
    check('Alice sees Bob in online list', usersMsg.users.includes('Alice') && usersMsg.users.includes('Bob'));

    // --- 1. Public message reaches both ---
    log('\n[1] Public message');
    alice.send({ type: 'public', text: 'hello **everyone**' });
    const pubA = await alice.waitFor((m) => m.type === 'public' && m.text === 'hello **everyone**');
    const pubB = await bob.waitFor((m) => m.type === 'public' && m.text === 'hello **everyone**');
    check('public message reaches sender (Alice)', pubA.from === 'Alice');
    check('public message reaches recipient (Bob)', pubB.from === 'Alice');

    // --- Join: Carol (third client, must not see private traffic) ---
    const carol = await connect(port, 'Carol');
    clients.push(carol);
    carol.send({ type: 'join', name: 'Carol' });
    await carol.waitFor((m) => m.type === 'welcome');
    // Carol's welcome history should include the earlier public message.
    const carolWelcome = carol.received.find((m) => m.type === 'welcome');
    check('late joiner receives recent public history', carolWelcome.history.some((m) => m.text === 'hello **everyone**'));

    // --- 2. Private message: only sender and recipient ---
    log('\n[2] Private message isolation');
    const secret = 'secret-' + Date.now();
    alice.send({ type: 'private', to: 'Bob', text: secret });
    const privA = await alice.waitFor((m) => m.type === 'private' && m.text === secret);
    const privB = await bob.waitFor((m) => m.type === 'private' && m.text === secret);
    check('private message reaches sender (Alice)', privA.from === 'Alice' && privA.to === 'Bob');
    check('private message reaches recipient (Bob)', privB.from === 'Alice' && privB.to === 'Bob');
    // Give the server time to (wrongly) deliver to Carol.
    await sleep(300);
    const carolSaw = carol.received.some((m) => m.type === 'private' || (m.text && m.text.includes(secret)));
    check('third client (Carol) does NOT receive the private message', !carolSaw);
    // Private messages must not leak into the public history either.
    alice.send({ type: 'join', name: 'Probe' }); // harmless probe; should error (already joined)
    const probeErr = await alice.waitFor((m) => m.type === 'error' && m.message.includes('已经加入'));
    check('server state sanity: already-joined rejection works', !!probeErr);
    const dave = await connect(port, 'Dave');
    clients.push(dave);
    dave.send({ type: 'join', name: 'Dave' });
    const daveWelcome = await dave.waitFor((m) => m.type === 'welcome');
    check('private message is not stored in public history', !daveWelcome.history.some((m) => m.text === secret));

    // --- 3. Length limit ---
    log('\n[3] Message length limit');
    alice.send({ type: 'public', text: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) });
    const tooLong = await alice.waitFor((m) => m.type === 'error' && m.message.includes('2000'));
    check('2001-character message is rejected', !!tooLong, JSON.stringify(tooLong));
    const exact = 'y'.repeat(MAX_MESSAGE_LENGTH);
    alice.send({ type: 'public', text: exact });
    const okExact = await bob.waitFor((m) => m.type === 'public' && m.text === exact);
    check('exactly 2000-character message is accepted', okExact.text.length === 2000);
    alice.send({ type: 'private', to: 'Bob', text: 'z'.repeat(MAX_MESSAGE_LENGTH + 1) });
    const privTooLong = await alice.waitFor((m) => m.type === 'error' && m.message.includes('2000') && m !== tooLong);
    check('2001-character private message is rejected', !!privTooLong);

    // --- 4. Duplicate name ---
    log('\n[4] Duplicate name');
    const dup = await connect(port, 'Dup');
    clients.push(dup);
    dup.send({ type: 'join', name: 'alice' }); // case-insensitive collision with Alice
    const dupErr = await dup.waitFor((m) => m.type === 'error');
    check('duplicate online name (case-insensitive) is rejected', dupErr.message.includes('已在线'), dupErr.message);
    dup.send({ type: 'join', name: 'Eve' });
    const eveWelcome = await dup.waitFor((m) => m.type === 'welcome');
    check('after rejection, a free name can still join', eveWelcome.name === 'Eve');

    // --- Name validation sanity ---
    log('\n[5] Name validation');
    const bad = await connect(port, 'Bad');
    clients.push(bad);
    const errorsBefore = () => bad.received.filter((m) => m.type === 'error').length;
    bad.send({ type: 'join', name: '' });
    await sleep(200);
    check('empty name rejected', errorsBefore() === 1 && bad.received.at(-1).message.includes('1-20'));
    bad.send({ type: 'join', name: 'a'.repeat(21) });
    await sleep(200);
    check('21-character name rejected', errorsBefore() === 2 && bad.received.at(-1).message.includes('1-20'));
    bad.send({ type: 'join', name: 'bad\u0007name' });
    await sleep(200);
    check('name with control character rejected', errorsBefore() === 3 && bad.received.at(-1).message.includes('控制字符'));
    bad.send({ type: 'join', name: 'a'.repeat(20) });
    await bad.waitFor((m) => m.type === 'welcome');
    check('20-character name accepted', true);
  } catch (err) {
    failed++;
    log(`  FAIL  unexpected error: ${err.message}`);
  } finally {
    for (const c of clients) c.close();
    await sleep(100);
    await server.close();
  }

  log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();

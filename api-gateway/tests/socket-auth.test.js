const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.REDIS_URL = 'redis://127.0.0.1:1'; // unreachable; the subscriber just retries quietly

const OWNER = '11111111-1111-1111-1111-111111111111';
const OWN_PROJECT = '22222222-2222-2222-2222-222222222222';
const OTHER_PROJECT = '33333333-3333-3333-3333-333333333333';

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@supabase/supabase-js') {
    return {
      createClient: () => ({
        auth: {
          getUser: async (token) => (token === 'good-token'
            ? { data: { user: { id: OWNER } }, error: null }
            : { data: { user: null }, error: new Error('bad token') }),
        },
        from: () => {
          const filters = {};
          const builder = {
            select: () => builder,
            eq: (col, val) => { filters[col] = val; return builder; },
            maybeSingle: async () => ({
              data: filters.id === OWN_PROJECT && filters.owner_id === OWNER ? { id: OWN_PROJECT } : null,
              error: null,
            }),
          };
          return builder;
        },
      }),
    };
  }
  return originalLoad.call(this, request, ...rest);
};

const { io: connect } = require(path.join(__dirname, '../../frontend/node_modules/socket.io-client'));
const { initializeSockets } = require('../socket');

async function withServer(fn) {
  const server = http.createServer();
  const io = initializeSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(`http://localhost:${server.address().port}`);
  } finally {
    io.close();
    server.close();
  }
}

test('rejects sockets without a valid token', async () => {
  await withServer(async (url) => {
    const client = connect(url, { transports: ['websocket'], auth: { token: 'nope' }, reconnection: false });
    const err = await new Promise((resolve) => client.on('connect_error', resolve));
    assert.strictEqual(err.message, 'unauthorized');
    client.close();
  });
});

test('only lets a user join rooms for projects they own', async () => {
  await withServer(async (url) => {
    const client = connect(url, { transports: ['websocket'], auth: { token: 'good-token' }, reconnection: false });
    await new Promise((resolve) => client.on('connect', resolve));

    const own = await new Promise((resolve) => client.emit('join_project', OWN_PROJECT, resolve));
    assert.deepStrictEqual(own, { ok: true });

    const other = await new Promise((resolve) => client.emit('join_project', OTHER_PROJECT, resolve));
    assert.strictEqual(other.ok, false);

    const garbage = await new Promise((resolve) => client.emit('join_project', '../../etc', resolve));
    assert.strictEqual(garbage.ok, false);
    client.close();
  });
});

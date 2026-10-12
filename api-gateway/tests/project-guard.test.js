const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

// Stub supabase-js so the guard can be exercised without a network or database.
const calls = [];
let rowForQuery = null;
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@supabase/supabase-js') {
    return {
      createClient: () => ({
        from: (table) => {
          const q = { table, filters: {} };
          const builder = {
            select: () => builder,
            eq: (col, val) => { q.filters[col] = val; return builder; },
            maybeSingle: async () => { calls.push(q); return { data: rowForQuery(q), error: null }; },
          };
          return builder;
        },
      }),
    };
  }
  return originalLoad.call(this, request, ...rest);
};

const { requireProjectOwner } = require('../middlewares/project.middleware');

const OWNER = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';

function run(projectId, userId) {
  return new Promise((resolve) => {
    const req = { params: { projectId }, user: { sub: userId } };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body, nextCalled: false }); },
    };
    requireProjectOwner(req, res, (err) => resolve({ status: 200, nextCalled: true, err }));
  });
}

test('rejects malformed project ids without querying the database', async () => {
  calls.length = 0;
  const result = await run('not-a-uuid', OWNER);
  assert.strictEqual(result.status, 404);
  assert.strictEqual(calls.length, 0);
});

test('rejects a project owned by someone else', async () => {
  rowForQuery = (q) => (q.filters.owner_id === OWNER && q.filters.id === PROJECT ? { id: PROJECT } : null);
  const result = await run(PROJECT, '33333333-3333-3333-3333-333333333333');
  assert.strictEqual(result.status, 404);
  assert.strictEqual(result.nextCalled, false);
});

test('allows the owner through and scopes the lookup by id and owner', async () => {
  calls.length = 0;
  const result = await run(PROJECT, OWNER);
  assert.strictEqual(result.nextCalled, true);
  assert.deepStrictEqual(calls[0].filters, { id: PROJECT, owner_id: OWNER });
  assert.strictEqual(calls[0].table, 'projects');
});

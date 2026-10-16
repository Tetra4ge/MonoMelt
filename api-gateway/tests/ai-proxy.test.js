const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// Stub axios so the proxy can be exercised without a network.
let nextResponse;
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'axios') {
    return { create: () => ({ request: async () => { throw nextResponse; } }) };
  }
  return originalLoad.call(this, request, ...rest);
};

const { proxyToAiService } = require('../services/ai.service');

const downstream = (status, data) => Object.assign(new Error('downstream'), { response: { status, data } });

test('an internal-key rejection from the AI service is not forwarded as a 401', async () => {
  for (const status of [401, 403]) {
    nextResponse = downstream(status, { detail: 'Invalid or missing internal API key' });
    await assert.rejects(proxyToAiService('GET', '/x'), (err) => {
      assert.strictEqual(err.statusCode, 502);
      assert.strictEqual(err.expose, true);
      assert.match(err.message, /INTERNAL_API_KEY/);
      return true;
    });
  }
});

test('other AI errors keep their status and FastAPI validation details are readable', async () => {
  nextResponse = downstream(422, { detail: [{ loc: ['body', 'team_count'], msg: 'must be <= 20' }] });
  await assert.rejects(proxyToAiService('POST', '/x', {}), (err) => {
    assert.strictEqual(err.statusCode, 422);
    assert.match(err.message, /team_count: must be <= 20/);
    return true;
  });
  nextResponse = downstream(409, { detail: 'Source ingestion is not complete' });
  await assert.rejects(proxyToAiService('POST', '/x', {}), (err) => err.statusCode === 409 && err.expose === true);
});

test('an unreachable AI service becomes a 503', async () => {
  nextResponse = new Error('connect ECONNREFUSED');
  await assert.rejects(proxyToAiService('GET', '/x'), (err) => err.statusCode === 503);
});

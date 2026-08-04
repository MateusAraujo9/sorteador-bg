const { test } = require('node:test');
const assert = require('node:assert/strict');
const rateLimit = require('../src/middleware/rateLimit');

function mockReqRes(ip, path = '/') {
  const req = { baseUrl: '/api/test', path, ip };
  let statusCode = null;
  let jsonBody = null;
  const headers = {};
  const res = {
    set: (k, v) => { headers[k] = v; return res; },
    status: code => { statusCode = code; return res; },
    json: body => { jsonBody = body; return res; }
  };
  return { req, res, getStatus: () => statusCode, getJson: () => jsonBody, getHeaders: () => headers };
}

test('rateLimit deixa passar até o máximo e bloqueia depois com 429', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 3, message: 'Muitas tentativas' });
  const ip = '203.0.113.1';

  for (let i = 0; i < 3; i++) {
    const { req, res, getStatus } = mockReqRes(ip);
    let nextCalled = false;
    limiter(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, `chamada ${i + 1} deveria passar`);
    assert.equal(getStatus(), null);
  }

  const { req, res, getStatus, getJson, getHeaders } = mockReqRes(ip);
  let nextCalled = false;
  limiter(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 429);
  assert.equal(getJson().error, 'Muitas tentativas');
  assert.ok(getHeaders()['Retry-After']);
});

test('rateLimit mantém contadores separados por IP', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 1, message: 'Limite' });

  const a1 = mockReqRes('203.0.113.10');
  limiter(a1.req, a1.res, () => {});
  assert.equal(a1.getStatus(), null);

  const b1 = mockReqRes('203.0.113.20');
  let bNext = false;
  limiter(b1.req, b1.res, () => { bNext = true; });
  assert.equal(bNext, true, 'IP diferente não deveria ser afetado pelo limite do outro');
});

test('rateLimit mantém contadores separados por rota', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 1, message: 'Limite' });
  const ip = '203.0.113.30';

  const first = mockReqRes(ip, '/login');
  limiter(first.req, first.res, () => {});
  assert.equal(first.getStatus(), null);

  const second = mockReqRes(ip, '/register');
  let nextCalled = false;
  limiter(second.req, second.res, () => { nextCalled = true; });
  assert.equal(nextCalled, true, 'rota diferente não deveria ser afetada pelo limite da outra');
});

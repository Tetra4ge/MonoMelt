const test = require('node:test');
const assert = require('node:assert');
const { parseGithubImport } = require('../utils/github.util');

test('accepts public GitHub URLs and normalises them', () => {
  assert.deepStrictEqual(parseGithubImport('https://github.com/Tetra4ge/MonoMelt.git', 'dev'), {
    owner: 'Tetra4ge', repo: 'MonoMelt', repoUrl: 'https://github.com/Tetra4ge/MonoMelt', branch: 'dev',
  });
  assert.strictEqual(parseGithubImport('https://github.com/a/b/').branch, 'main');
});

test('rejects non-GitHub hosts, deep paths and odd branches', () => {
  for (const url of ['http://evil.com/a/b', 'https://github.com/a/b/tree/main', 'https://github.com/a', '', undefined]) {
    assert.ok(parseGithubImport(url).error, String(url));
  }
  assert.ok(parseGithubImport('https://github.com/a/b', '../x').error);
  assert.ok(parseGithubImport('https://github.com/a/b', 'x y').error);
});

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const AdmZip = require('adm-zip');
const { shouldSkipEntry, normaliseEntryPath, isSymlink } = require('../zip-safety');

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Python's zipfile can write names and Unix modes that adm-zip's own writer refuses to,
// which is exactly what a hostile archive looks like.
function buildHostileZip() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zipsafety-')), 'hostile.zip');
  const script = `
import zipfile, sys
with zipfile.ZipFile(sys.argv[1], 'w') as z:
    z.writestr('ok/main.py', 'print("hi")\\n')
    z.writestr('ok/dir/', '')
    z.writestr('../../evil.py', 'x')
    z.writestr('/abs/rooted.py', 'x')
    z.writestr('C:/windows.py', 'x')
    z.writestr('back\\\\slash\\\\..\\\\evil.py', 'x')
    link = zipfile.ZipInfo('link-to-main')
    link.external_attr = (0o120777 << 16)
    z.writestr(link, 'ok/main.py')
`;
  execFileSync('python3', ['-c', script, file]);
  return file;
}

const hasPython = (() => { try { execFileSync('python3', ['--version']); return true; } catch { return false; } })();

test('the adm-zip calls the worker relies on still behave', () => {
  const zip = new AdmZip();
  zip.addFile('src/app.py', Buffer.from('print(1)\n'));
  zip.addFile('src/util/', Buffer.alloc(0));
  const entries = new AdmZip(zip.toBuffer()).getEntries();

  const file = entries.find((e) => e.entryName === 'src/app.py');
  assert.ok(file, 'file entry is listed');
  assert.strictEqual(file.isDirectory, false);
  assert.strictEqual(file.header.size, 9);
  assert.strictEqual(typeof file.header.attr, 'number');
  assert.strictEqual(file.getData().toString(), 'print(1)\n');
  assert.strictEqual(entries.find((e) => e.entryName === 'src/util/').isDirectory, true);
});

test('only genuine source files pass; traversal, absolute, drive, backslash and link entries are skipped', { skip: !hasPython && 'python3 not available' }, () => {
  const entries = new AdmZip(buildHostileZip()).getEntries();
  const verdict = Object.fromEntries(entries.map((e) => [e.entryName, shouldSkipEntry(e, normaliseEntryPath(e.entryName))]));

  assert.strictEqual(verdict['ok/main.py'], false, 'a normal file is kept');
  assert.strictEqual(verdict['ok/dir/'], true, 'directories are skipped');
  assert.strictEqual(verdict['../../evil.py'], true, '.. traversal is skipped');
  assert.strictEqual(verdict['/abs/rooted.py'], false, 'a leading slash is stripped, leaving a safe relative path');
  assert.strictEqual(normaliseEntryPath('/abs/rooted.py'), 'abs/rooted.py');
  assert.strictEqual(verdict['C:/windows.py'], true, 'Windows drive paths are skipped');
  assert.strictEqual(verdict['back\\slash\\..\\evil.py'], true, 'backslash traversal is skipped');
  assert.strictEqual(verdict['link-to-main'], true, 'symlinks are skipped');
});

test('symlink detection reads the Unix mode bits, not the whole attribute word', { skip: !hasPython && 'python3 not available' }, () => {
  const entries = new AdmZip(buildHostileZip()).getEntries();
  assert.strictEqual(isSymlink(entries.find((e) => e.entryName === 'link-to-main')), true);
  assert.strictEqual(isSymlink(entries.find((e) => e.entryName === 'ok/main.py')), false);
  // The old check compared the whole attribute to 0xA000 and never matched a real symlink.
  assert.notStrictEqual(entries.find((e) => e.entryName === 'link-to-main').header.attr, 0xA000);
});

test('an entry that claims to be 4 GB is reported as such and cannot exhaust memory', () => {
  const zip = new AdmZip();
  zip.addFile('big.py', Buffer.from('x'.repeat(100)));
  const buf = Buffer.from(zip.toBuffer());
  const central = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central > 0, 'found the central directory entry');
  buf.writeUInt32LE(0xffffffff, central + 24); // uncompressed size field

  const before = process.memoryUsage().rss;
  const [entry] = new AdmZip(buf).getEntries();
  // The worker rejects on this value before ever calling getData().
  assert.ok(entry.header.size > MAX_FILE_BYTES, `declared size ${entry.header.size} trips the per-file limit`);
  try { entry.getData(); } catch { /* throwing is a fine outcome */ }
  const grew = process.memoryUsage().rss - before;
  assert.ok(grew < 300 * 1024 * 1024, `memory grew by ${Math.round(grew / 1048576)}MB`);
});

import assert from 'node:assert/strict';
import {cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'photography-build-'));
const build = () => spawnSync(process.execPath, ['scripts/build.mjs'], {
  cwd: fixture, encoding: 'utf8'
});
try {
  for (const directory of ['scripts', 'public', 'worker', 'db', 'drizzle']) {
    await cp(join(root, directory), join(fixture, directory), {recursive: true});
  }
  await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');

  let result = build();
  assert.equal(result.status, 0, result.stderr);
  assert.ok((await stat(join(fixture, 'dist/server/index.js'))).size > 0);
  await stat(join(fixture, 'dist/client/index.html'));
  await assert.rejects(stat(join(fixture, 'dist/.openai')), {code: 'ENOENT'});

  const metadata = '{"project_id":"build-test","d1":"DB","r2":"BUCKET"}\n';
  await mkdir(join(fixture, '.openai'));
  await writeFile(join(fixture, '.openai/hosting.json'), metadata);
  result = build();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(fixture, 'dist/.openai/hosting.json'), 'utf8'), metadata);
  await stat(join(fixture, 'dist/.openai/drizzle'));

  // A malformed filesystem path must still fail, rather than being ignored.
  await rm(join(fixture, '.openai/hosting.json'));
  await mkdir(join(fixture, '.openai/hosting.json'));
  result = build();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EISDIR/);
  console.log('PASS: builds without metadata, preserves present metadata, and reports other filesystem errors.');
} finally {
  await rm(fixture, {recursive: true, force: true});
}

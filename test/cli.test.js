import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { check, sync } from '../src/index.js';

test('Integration: check and sync flow in isolated directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envdrift-test-'));

  try {
    // Write sample source code
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    fs.writeFileSync(
      path.join(srcDir, 'index.ts'),
      `
      const port = process.env.APP_PORT || 3000;
      const secret = process.env.AUTH_SECRET;
      `
    );

    // Initial check without .env.example
    const res1 = check(tmpDir);
    assert.equal(res1.valid, true); // No .env.example yet, so missing in example doesn't crash unless example exists

    // Create partial .env.example with only APP_PORT
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'APP_PORT=3000\n');

    // Second check: AUTH_SECRET is missing from .env.example -> should fail!
    const res2 = check(tmpDir);
    assert.equal(res2.valid, false);
    assert.equal(res2.summary.errorCount, 1);
    assert.equal(res2.issues[0].key, 'AUTH_SECRET');

    // Run sync to fix
    const syncRes = sync(tmpDir);
    assert.equal(syncRes.addedKeys.length, 1);
    assert.equal(syncRes.addedKeys[0], 'AUTH_SECRET');

    // Re-check after sync -> should pass!
    const res3 = check(tmpDir);
    assert.equal(res3.valid, true);
    assert.equal(res3.summary.errorCount, 0);

    const updatedExample = fs.readFileSync(path.join(tmpDir, '.env.example'), 'utf8');
    assert.ok(updatedExample.includes('AUTH_SECRET=your-auth-secret-here'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

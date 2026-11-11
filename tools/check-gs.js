'use strict';

/**
 * tools/check-gs.js
 *
 * ตรวจ syntax ของไฟล์ Apps Script (.gs) ทุกไฟล์ด้วย `node --check`
 * ใช้ใน CI ก่อน deploy เพื่อกัน syntax error ขึ้น production
 *
 * หมายเหตุ: Node ไม่รู้จักนามสกุล .gs จึงคัดลอกเป็น .js ใน temp ก่อนตรวจ
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAS_DIR = path.join(ROOT, 'gas');

function walk(dir) {
  const out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === 'node_modules' || entry.name === '.git') return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push.apply(out, walk(full));
    } else if (/\.(gs|js)$/.test(entry.name)) {
      out.push(full);
    }
  });
  return out;
}

function main() {
  if (!fs.existsSync(GAS_DIR)) {
    console.error('ไม่พบโฟลเดอร์ gas/');
    process.exit(1);
  }

  const files = walk(GAS_DIR).sort();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-check-'));
  let failed = 0;

  files.forEach(function (file) {
    const relative = path.relative(ROOT, file);
    const tmp = path.join(tmpDir, relative.replace(/[\\/]/g, '__') + '.js');
    fs.writeFileSync(tmp, fs.readFileSync(file, 'utf8'), 'utf8');

    const result = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    if (result.status === 0) {
      console.log('OK   ' + relative);
    } else {
      failed++;
      console.error('FAIL ' + relative);
      console.error((result.stderr || result.stdout || '').trim());
    }
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('');
  console.log('ตรวจแล้ว ' + files.length + ' ไฟล์, ผิดพลาด ' + failed + ' ไฟล์');
  if (failed > 0) process.exit(1);
}

main();

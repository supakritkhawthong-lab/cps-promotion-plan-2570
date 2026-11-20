'use strict';

/**
 * Contract tests for the reduced 3-page app.
 * - index.html must load exactly the modules needed by dashboard/registry/strength
 * - removed plan/AI modules must not come back
 * - RPC allowlist must contain only read-only dashboard endpoints
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT, readRepo } = require('./helpers/sandbox');

const indexHtml = readRepo('web', 'index.html');

function localAssetPaths(html, tag, attr) {
  const re = new RegExp('<' + tag + '[^>]*' + attr + '="([^"]+)"', 'g');
  const found = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    const src = match[1];
    if (/^(https?:)?\/\//.test(src) || src.indexOf('data:') === 0) continue;
    found.push(src);
  }
  return found;
}

function stripQuery(src) {
  return src.split('?')[0];
}

test('ไฟล์ script/css ที่ index.html อ้างถึงมีอยู่จริง', function () {
  const scripts = localAssetPaths(indexHtml, 'script', 'src');
  const styles = localAssetPaths(indexHtml, 'link', 'href');

  assert.ok(scripts.length >= 6, 'ต้องมี script ภายในอย่างน้อย 6 ไฟล์');
  scripts.concat(styles).forEach(function (src) {
    const file = path.join(ROOT, 'web', stripQuery(src));
    assert.ok(fs.existsSync(file), 'ไม่พบไฟล์: web/' + src);
  });
});

test('ทุกโมดูลใน web/js ถูกโหลดจาก index.html', function () {
  const loaded = localAssetPaths(indexHtml, 'script', 'src').map(function (src) {
    return path.basename(stripQuery(src));
  });
  const files = fs.readdirSync(path.join(ROOT, 'web', 'js')).filter(function (name) {
    return name.endsWith('.js');
  });

  assert.strictEqual(files.length, 5, 'web/js ต้องเหลือ 5 ไฟล์ตามขอบเขต 3 หน้า');
  files.forEach(function (name) {
    assert.ok(loaded.indexOf(name) !== -1, 'ยังไม่ได้โหลด web/js/' + name + ' ใน index.html');
  });
});

test('โมดูลแอปพลิเคชันมี cache-bust (?v=)', function () {
  const NO_CACHE_BUST = ['js/google-script-shim.js'];
  const scripts = localAssetPaths(indexHtml, 'script', 'src').filter(function (src) {
    return src.indexOf('js/') === 0;
  });
  scripts.forEach(function (src) {
    if (NO_CACHE_BUST.indexOf(stripQuery(src)) !== -1) return;
    assert.ok(/\?v=\d{8}[a-z]?$/.test(src), 'ต้องมีเลขรุ่นท้ายไฟล์: ' + src);
  });
});

test('หน้าเว็บมี 3 แท็บ: dashboard / registry / strength', function () {
  ['dashboard', 'registry', 'strength'].forEach(function (name) {
    assert.ok(indexHtml.indexOf('id="tab-' + name + '"') !== -1, 'ต้องมี tab-' + name);
    assert.ok(indexHtml.indexOf('data-tab="' + name + '"') !== -1, 'ต้องมีปุ่มเลือก tab-' + name);
  });
  assert.strictEqual(indexHtml.indexOf('tab-base-form'), -1, 'ต้องลบฟอร์มหลักออกแล้ว');
  assert.strictEqual(indexHtml.indexOf('tab-full-plan'), -1, 'ต้องลบแผนฉบับเต็มออกแล้ว');
});

test('ไฟล์และโค้ดของระบบแผน/AI ถูกลบจริง', function () {
  const REMOVED_JS = [
    'cpd-preload.js', 'cpd-4m-engine.js', 'cpd-business-analysis.js',
    'cpd-pdf-pipeline.js', 'cpd-upload.js'
  ];
  REMOVED_JS.forEach(function (name) {
    assert.strictEqual(fs.existsSync(path.join(ROOT, 'web', 'js', name)), false,
      'ต้องลบ web/js/' + name);
  });
  assert.strictEqual(fs.existsSync(path.join(ROOT, 'gas', 'AiJob.gs')), false, 'ต้องลบ gas/AiJob.gs');
  assert.strictEqual(indexHtml.indexOf('pdf-lib'), -1, 'ต้องลบ pdf-lib ออก');
  assert.strictEqual(indexHtml.indexOf('pdfjsLib'), -1, 'ต้องลบ PDF.js ออก');
  assert.strictEqual(indexHtml.indexOf('jszip'), -1, 'ต้องลบ JSZip ออก');

  const ui = readRepo('web', 'js', 'cpd-ui.js');
  ['analyze4M', 'applyUploadedAnalysisNotes', 'saveCompletePlan', 'saveDraftToSheet']
    .forEach(function (name) {
      assert.strictEqual(ui.indexOf(name), -1, 'ต้องลบ ' + name + ' ออกจาก cpd-ui.js');
    });
});

test('config.js ชี้ไปยัง Apps Script /exec และมี token', function () {
  const config = readRepo('web', 'config.js');
  const match = config.match(/API_URL:\s*'([^']+)'/);
  assert.ok(match, 'ต้องมี API_URL');
  assert.ok(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(match[1]),
    'API_URL ต้องเป็น URL /exec ของ Apps Script');
  assert.ok(config.indexOf('PASTE_DEPLOYMENT_ID') === -1, 'ห้ามเหลือค่า placeholder');

  const tokenMatch = config.match(/API_TOKEN:\s*'([^']*)'/);
  assert.ok(tokenMatch, 'ต้องมี API_TOKEN');
});

test('RPC allowlist มีเฉพาะฟังก์ชันอ่านข้อมูล Dashboard', function () {
  const api = readRepo('gas', 'Api.gs');
  const gasDir = path.join(ROOT, 'gas');
  const gasSource = fs.readdirSync(gasDir).filter(function (name) { return name.endsWith('.gs'); })
    .map(function (name) { return readRepo('gas', name); })
    .join('\n');
  const allowlistBlock = api.slice(api.indexOf('var RPC_ALLOWLIST'), api.indexOf('];', api.indexOf('var RPC_ALLOWLIST')));
  const names = [];
  const re = /'([A-Za-z0-9_]+)'/g;
  let match;
  while ((match = re.exec(allowlistBlock)) !== null) names.push(match[1]);

  assert.deepStrictEqual(names.sort(), ['getDashboardSummaryData', 'getMasterCoopList']);
  ['analyzeUploadedFilesWithAI', 'startAiAnalysisJob', 'stepAiAnalysisJob',
    'generatePlanDocument', 'saveDraftToSheet', 'saveCompleteCoopRecord'
  ].forEach(function (name) {
    assert.strictEqual(names.indexOf(name), -1, 'ต้องลบ ' + name + ' ออกจาก allowlist');
  });
  names.forEach(function (name) {
    assert.ok(new RegExp('function\\s+' + name + '\\s*\\(').test(gasSource),
      'Api.gs อนุญาต ' + name + ' แต่ไม่พบฟังก์ชันนี้ใน gas/*.gs');
  });
});

test('gas/appsscript.json เปิด web app ให้ anonymous และรันในนามผู้ deploy', function () {
  const manifest = JSON.parse(readRepo('gas', 'appsscript.json'));
  assert.strictEqual(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.ok(Array.isArray(manifest.oauthScopes) && manifest.oauthScopes.length >= 4);
});

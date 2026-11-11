'use strict';

/**
 * เทสต์สัญญาระหว่างไฟล์ (contract tests)
 * - script/css ที่ index.html อ้างถึงต้องมีจริง และมี cache-bust
 * - โมดูล js ทุกไฟล์ต้องถูกโหลดจาก index.html (กันลืมใส่ <script>)
 * - ชื่อฟังก์ชันที่ frontend เรียกต้องอยู่ใน allowlist ของ Api.gs และมีอยู่จริงใน Code.gs
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

test('ไฟล์ script/css ที่อ้างถึงมีอยู่จริง', function () {
  const scripts = localAssetPaths(indexHtml, 'script', 'src');
  const styles = localAssetPaths(indexHtml, 'link', 'href');

  assert.ok(scripts.length >= 8, 'ต้องมี script ภายในอย่างน้อย 8 ไฟล์');
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

  files.forEach(function (name) {
    assert.ok(loaded.indexOf(name) !== -1, 'ยังไม่ได้โหลด web/js/' + name + ' ใน index.html');
  });
});

test('โมดูลแอปพลิเคชันมี cache-bust (?v=)', function () {
  // shim ต้องคงชื่อไฟล์เดิมให้ตรงกับที่ inline script เรียกใช้ จึงยกเว้นเฉพาะไฟล์นี้
  const NO_CACHE_BUST = ['js/google-script-shim.js'];
  const scripts = localAssetPaths(indexHtml, 'script', 'src').filter(function (src) {
    return src.indexOf('js/') === 0;
  });
  scripts.forEach(function (src) {
    if (NO_CACHE_BUST.indexOf(stripQuery(src)) !== -1) return;
    assert.ok(/\?v=\d{8}[a-z]?$/.test(src), 'ต้องมีเลขรุ่นท้ายไฟล์: ' + src);
  });
});

test('index.html แสดงคำเตือนเมื่อ AI ประมวลผลได้บางส่วน', function () {
  assert.ok(indexHtml.indexOf('_aiWarnings') !== -1, 'ต้องอ่าน _aiWarnings จากผล AI');
  assert.ok(indexHtml.indexOf('ประมวลผลสำเร็จบางส่วน') !== -1, 'ต้องมีข้อความแจ้งผู้ใช้');
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

test('ฟังก์ชันที่ frontend เรียกถูกอนุญาตใน Api.gs และมีอยู่จริงใน gas/*.gs', function () {
  const api = readRepo('gas', 'Api.gs');
  const gasDir = path.join(ROOT, 'gas');
  const gasFiles = fs.readdirSync(gasDir).filter(function (name) { return name.endsWith('.gs'); });
  const gasSource = gasFiles
    .map(function (name) { return readRepo('gas', name); })
    .join('\n');
  const allowlistBlock = api.slice(api.indexOf('var RPC_ALLOWLIST'), api.indexOf('];', api.indexOf('var RPC_ALLOWLIST')));
  const names = [];
  const re = /'([A-Za-z0-9_]+)'/g;
  let match;
  while ((match = re.exec(allowlistBlock)) !== null) names.push(match[1]);

  assert.ok(names.indexOf('analyzeUploadedFilesWithAI') !== -1, 'ต้องอนุญาต analyzeUploadedFilesWithAI');
  assert.ok(names.length >= 7, 'allowlist ต้องมีอย่างน้อย 7 ฟังก์ชัน');

  names.forEach(function (name) {
    assert.ok(new RegExp('function\\s+' + name + '\\s*\\(').test(gasSource),
      'Api.gs อนุญาต ' + name + ' แต่ไม่พบฟังก์ชันนี้ใน gas/*.gs');
  });
});

test('AI staged flow เปิดใช้ responseSchema และมี Script Properties ที่อ่านได้', function () {
  const code = readRepo('gas', 'Code.gs');
  assert.ok(code.indexOf('responseSchema') !== -1, 'ต้องใช้ responseSchema');
  assert.ok(code.indexOf("getProp_('GEMINI_MAX_OUTPUT_TOKENS'") !== -1, 'ต้องอ่าน GEMINI_MAX_OUTPUT_TOKENS');
  assert.ok(code.indexOf("getProp_('AI_DEADLINE_MS'") !== -1, 'ต้องอ่าน AI_DEADLINE_MS');
  assert.ok(code.indexOf("'facts'") !== -1 && code.indexOf("'narrative'") !== -1 && code.indexOf("'summary'") !== -1,
    'ต้องมีครบ 3 ระยะ');
});

test('gas/appsscript.json เปิด web app ให้ anonymous และรันในนามผู้ deploy', function () {
  const manifest = JSON.parse(readRepo('gas', 'appsscript.json'));
  assert.strictEqual(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.ok(Array.isArray(manifest.oauthScopes) && manifest.oauthScopes.length >= 4);
});

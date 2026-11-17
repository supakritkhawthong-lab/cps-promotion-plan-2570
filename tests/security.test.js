'use strict';

/**
 * Security tests for the HTTP API layer.
 * - fetch errors must never leak the Gemini API key (the URL carries ?key=)
 * - doPost must redact secrets from message/stack before responding
 */

const test = require('node:test');
const assert = require('node:assert');
const { readRepo, sliceBetween } = require('./helpers/sandbox');

function loadRedactSecrets() {
  const api = readRepo('gas', 'Api.gs');
  const src = sliceBetween(api, 'function redactSecrets_(', '\nfunction apiError_');
  const factory = new Function(src + '\nreturn redactSecrets_;');
  return factory();
}

test('redactSecrets_ ลบ API key ออกจากข้อความ error', function () {
  const redactSecrets_ = loadRedactSecrets();

  // Placeholder values only - never paste a real key into a fixture.
  const raw = new Error(
    'หมดเวลา: https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=FAKE-KEY-FOR-TEST'
  );

  const message = redactSecrets_(raw.message);
  assert.ok(message.indexOf('FAKE-KEY-FOR-TEST') === -1, 'ต้องไม่เหลือค่า key ในข้อความ');
  assert.ok(message.indexOf('key=[REDACTED]') !== -1, 'ต้องแทนค่า key ด้วย [REDACTED]');
  assert.ok(message.indexOf('gemini-3.8-flash') !== -1, 'ต้องเก็บชื่อโมเดลไว้เพื่อวินิจฉัย');

  assert.strictEqual(redactSecrets_('AIzaFAKEFAKEFAKEFAKE'), '[REDACTED]', 'ต้องลบ legacy key');
  assert.strictEqual(redactSecrets_('AQ.FAKEKEYVALUE'), '[REDACTED]', 'ต้องลบ key แบบ AQ.');
  assert.strictEqual(redactSecrets_('ข้อความปกติ'), 'ข้อความปกติ', 'ข้อความปกติต้องไม่ถูกแก้');
  assert.strictEqual(redactSecrets_(''), '', 'ค่าว่างต้องคืนค่าว่าง');
});

test('doPost กรองข้อมูลลับก่อนส่ง error กลับ client', function () {
  const api = readRepo('gas', 'Api.gs');
  assert.ok(api.indexOf('message: redactSecrets_(') !== -1, 'message ต้องผ่าน redactSecrets_');
  assert.ok(api.indexOf('stack: isDebug_() ? redactSecrets_(') !== -1, 'stack ต้องผ่าน redactSecrets_');
});

test('callGeminiJson_ ครอบ UrlFetchApp.fetch ด้วย try/catch เพื่อไม่ให้ URL ที่มี key หลุด', function () {
  const code = readRepo('gas', 'Code.gs');
  const block = sliceBetween(code, 'for (let attempt = 1; attempt <= 2; attempt++) {', 'if (code === 503 || code === 429) {');
  assert.ok(/try \{\s*res = UrlFetchApp\.fetch\(url, options\);/.test(block), 'ต้องมี try/catch ครอบ fetch');
  assert.ok(block.indexOf('ตัดการเชื่อมต่อ') !== -1, 'ต้องบันทึกข้อความที่ไม่มี URL/key');
});

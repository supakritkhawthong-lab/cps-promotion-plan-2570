'use strict';

/**
 * เทสต์ตัวอ่าน/ซ่อม JSON ของ AI (gas/Code.gs)
 * ทุกเคสมาจาก error จริงที่เคยเกิดบน production — เพิ่มเคสใหม่ทุกครั้งที่เจอปัญหา
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadGasParserHelpers } = require('./helpers/sandbox');

const { parseAiJson_, repairMissingCommas_ } = loadGasParserHelpers();

test('JSON ปกติ', function () {
  const out = parseAiJson_('{"a":1,"b":"ข้อความ"}');
  assert.strictEqual(out.a, 1);
  assert.strictEqual(out.b, 'ข้อความ');
});

test('อัญประกาศซ้อนในข้อความไทย', function () {
  const out = parseAiJson_(
    '{"orgAnalysis4M":"สหกรณ์มี "จุดแข็ง" ด้านการเงิน และ "ข้อควรระวัง" ด้านหนี้สิน","summaryAnalysis":"สรุป"}'
  );
  assert.ok(out.orgAnalysis4M.includes('"จุดแข็ง"'));
  assert.strictEqual(out.summaryAnalysis, 'สรุป');
});

test('อัญประกาศซ้อนตามด้วย comma และคำไทย', function () {
  const out = parseAiJson_('{"a":"พบ "ทุนสำรอง" , จำนวน 5 ล้านบาท","b":"ok"}');
  assert.ok(out.a.includes('"ทุนสำรอง"'));
  assert.strictEqual(out.b, 'ok');
});

test('ขึ้นบรรทัดใหม่จริงในสตริง', function () {
  const out = parseAiJson_('{"a":"บรรทัด 1\nบรรทัด 2","b":2}');
  assert.ok(out.a.includes('บรรทัด 1'));
  assert.ok(out.a.includes('บรรทัด 2'));
  assert.strictEqual(out.b, 2);
});

test('code fence และข้อความนำหน้า', function () {
  const out = parseAiJson_('นี่คือผลลัพธ์\n```json\n{"a":"x","b":[1,2]}\n```');
  assert.strictEqual(out.a, 'x');
  assert.strictEqual(out.b.length, 2);
});

test('JSON ถูกตัดกลางคัน', function () {
  const out = parseAiJson_('{"a":"ข้อความที่ถูกตัด","b":[1,2');
  assert.strictEqual(out.a, 'ข้อความที่ถูกตัด');
  assert.ok(Array.isArray(out.b));
});

test('ค่าในสตริงมีเครื่องหมายโคลอนและอัญประกาศ', function () {
  const out = parseAiJson_('{"a":"อัตราส่วน "หนี้สิน:สินทรัพย์" เท่ากับ 0.5","b":"ok"}');
  assert.ok(out.a.includes('"หนี้สิน:สินทรัพย์"'));
  assert.strictEqual(out.b, 'ok');
});

test('สตริงว่าง', function () {
  const out = parseAiJson_('{"a":"","b":"x"}');
  assert.strictEqual(out.a, '');
  assert.strictEqual(out.b, 'x');
});

test('อัญประกาศที่ escape ไว้แล้ว', function () {
  const out = parseAiJson_('{"a":"เขากล่าวว่า \\"ดีมาก\\"","b":1}');
  assert.ok(out.a.includes('"ดีมาก"'));
  assert.strictEqual(out.b, 1);
});

test('array ของ object ที่มีอัญประกาศซ้อน', function () {
  const out = parseAiJson_(
    '{"segments":[{"name":"เงินให้กู้","note":"อัตรา "ดอกเบี้ย" 6%"},{"name":"รับฝาก","note":"ok"}]}'
  );
  assert.strictEqual(out.segments.length, 2);
  assert.strictEqual(out.segments[0].name, 'เงินให้กู้');
  assert.ok(out.segments[0].note.includes('"ดอกเบี้ย"'));
});

test('สตริงไม่ถูกปิด (รูปแบบ error จริง)', function () {
  const out = parseAiJson_('{"a":"ข้อความยาว "คำในเครื่องหมาย" ต่อเนื่อง จนจบ');
  assert.strictEqual(typeof out.a, 'string');
});

test('ข้อความที่ไม่ใช่ JSON ต้องได้ error ภาษาไทยที่อ่านรู้เรื่อง', function () {
  assert.throws(
    function () { parseAiJson_('ขออภัย ไม่สามารถวิเคราะห์ได้'); },
    function (err) { return /AI ส่ง JSON.*ไม่สมบูรณ์/.test(err.message); }
  );
});

test('คีย์ขาดเครื่องหมายโคลอน', function () {
  const out = parseAiJson_('{"a" "value", "b": 1}');
  assert.strictEqual(out.a, 'value');
  assert.strictEqual(out.b, 1);
});

test('คีย์ขาดโคลอนก่อน object', function () {
  const out = parseAiJson_('{"a" {"x":1}, "b": 2}');
  assert.strictEqual(out.a.x, 1);
  assert.strictEqual(out.b, 2);
});

test('คีย์ขาดโคลอนก่อน array', function () {
  const out = parseAiJson_('{"a" [1,2], "b": 2}');
  assert.ok(Array.isArray(out.a));
  assert.strictEqual(out.a.length, 2);
  assert.strictEqual(out.b, 2);
});

test('array ขาด comma ระหว่างสตริง', function () {
  const out = parseAiJson_('{"a":["x" "y"]}');
  assert.strictEqual(out.a.length, 2);
  assert.strictEqual(out.a[1], 'y');
});

test('array ขาด comma ระหว่าง object', function () {
  const out = parseAiJson_('{"a":[{"x":1} {"y":2}]}');
  assert.strictEqual(out.a.length, 2);
  assert.strictEqual(out.a[1].y, 2);
});

test('array ขาด comma ระหว่างตัวเลข', function () {
  const out = parseAiJson_('{"a":[1 2 3]}');
  assert.strictEqual(out.a.length, 3);
  assert.strictEqual(out.a[2], 3);
});

test('array ซ้อนกันและขาด comma', function () {
  const out = parseAiJson_('{"a":[1 [2] 3]}');
  assert.strictEqual(out.a.length, 3);
  assert.strictEqual(out.a[1][0], 2);
});

test('object ขาด comma ระหว่างสมาชิก', function () {
  const out = parseAiJson_('{"a":1 "b":2}');
  assert.strictEqual(out.a, 1);
  assert.strictEqual(out.b, 2);
});

test('JSON ที่ถูกต้องต้องไม่ถูกแก้โดยตัวเติม comma', function () {
  const sample = '{"a":[{"x":1},{"y":"ข้อความ, มี colon: และ [วงเล็บ]"}]}';
  assert.strictEqual(repairMissingCommas_(sample), sample);
});

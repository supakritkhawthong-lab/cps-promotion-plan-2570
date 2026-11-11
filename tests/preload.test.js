'use strict';

/**
 * เทสต์ข้อมูล preload ที่ผ่านการตรวจสอบแล้ว
 * เป้าหมาย: กันการเขียนทับด้วยข้อมูลปลอม และกันคำว่า undefined/NaN หลุดขึ้นเอกสาร
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadWebScripts } = require('./helpers/sandbox');

const web = loadWebScripts(['web/js/cpd-preload.js']);
const PRELOAD = web.CPD_PRELOAD;

const CHICKEN = 'สหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี จำกัด';
const TOYOTA = 'สหกรณ์ออมทรัพย์สยามโตโยต้าอุตสาหกรรม จำกัด';

function fourMOf(name) {
  const entry = PRELOAD.get(name);
  assert.ok(entry, 'ต้องมี preload ของ ' + name);
  assert.ok(entry.fourM && typeof entry.fourM === 'object', 'ต้องมี fourM ของ ' + name);
  return entry.fourM;
}

function textOf(value) {
  return Array.isArray(value) ? value.join('\n') : String(value || '');
}

test('มี preload ของสหกรณ์ที่ผ่านการตรวจสอบครบ 2 แห่ง', function () {
  const list = PRELOAD.list();
  assert.ok(list.indexOf(CHICKEN) !== -1, 'ต้องมี ' + CHICKEN);
  assert.ok(list.indexOf(TOYOTA) !== -1, 'ต้องมี ' + TOYOTA);
});

test('บทวิเคราะห์หัวข้อ 1 ของ preload มีครบ 4M และหัวข้อย่อย', function () {
  [CHICKEN, TOYOTA].forEach(function (name) {
    const org = textOf(fourMOf(name).orgAnalysis4M);
    assert.ok(org.length > 500, name + ': orgAnalysis4M ต้องมีเนื้อหา');
    ['Man', 'Material', 'Money', 'Management'].forEach(function (label) {
      assert.ok(org.indexOf('(' + label + ')') !== -1, name + ': ต้องมีหัวข้อ ' + label);
    });
    assert.ok(org.indexOf('ด้านการบริหารจัดการองค์กร') !== -1, name + ': ต้องมีชื่อหัวข้อ 1');
  });
});

test('บทวิเคราะห์หัวข้อ 2 ของ preload มีเนื้อหาจริง', function () {
  [CHICKEN, TOYOTA].forEach(function (name) {
    const biz = textOf(fourMOf(name).businessAnalysis);
    assert.ok(biz.length > 200, name + ': businessAnalysis ต้องมีเนื้อหา');
  });
});

test('สหกรณ์ไก่ไข่ต้องไม่มีข้อความสวัสดิการ/สรุปที่แต่งขึ้นเอง', function () {
  const fourM = fourMOf(CHICKEN);
  assert.strictEqual(textOf(fourM.welfareAnalysis).trim(), '', 'ยังไม่มีข้อมูลจริง = ต้องเว้นว่าง');
  assert.strictEqual(textOf(fourM.summaryAnalysis).trim(), '', 'ยังไม่มีข้อมูลจริง = ต้องเว้นว่าง');
});

test('สหกรณ์โตโยต้ามีบทสรุปหัวข้อ 4 จากข้อมูลจริง', function () {
  const summary = textOf(fourMOf(TOYOTA).summaryAnalysis);
  assert.ok(summary.length > 200, 'summaryAnalysis ต้องมีเนื้อหา');
  assert.ok(summary.indexOf('จุดที่ควรส่งเสริม') !== -1, 'ต้องมีส่วนจุดที่ควรส่งเสริม');
});

test('ข้อความ preload ต้องไม่มี undefined/NaN/null หลุด', function () {
  [CHICKEN, TOYOTA].forEach(function (name) {
    const fourM = fourMOf(name);
    Object.keys(fourM).forEach(function (key) {
      const text = textOf(fourM[key]);
      assert.ok(text.indexOf('undefined') === -1, name + '.' + key + ' มี undefined');
      assert.ok(text.indexOf('NaN') === -1, name + '.' + key + ' มี NaN');
      assert.ok(text.indexOf('[object Object]') === -1, name + '.' + key + ' มี [object Object]');
    });
  });
});

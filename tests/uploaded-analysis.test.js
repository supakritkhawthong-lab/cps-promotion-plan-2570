'use strict';

/**
 * เทสต์การเติมบทวิเคราะห์จากไฟล์ที่อัปโหลด (web/js/cpd-ui.js → applyUploadedAnalysisNotes)
 * เน้นสิ่งที่เจอบน production: AI พิมพ์ชื่อหัวข้อซ้ำกับป้าย textarea ทำให้เอกสารพิมพ์ออกมาซ้ำ
 * และการไม่เขียนทับบทวิเคราะห์ที่ผ่านการตรวจสอบแล้ว (preload)
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadWebScripts } = require('./helpers/sandbox');

const TOYOTA = 'สหกรณ์ออมทรัพย์สยามโตโยต้าอุตสาหกรรม จำกัด';

function setup(coopName) {
  const web = loadWebScripts([
    'web/js/cpd-state.js',
    'web/js/cpd-preload.js',
    'web/js/cpd-ui.js'
  ]);
  web.CPD_STATE.replaceState(web.CPD_STATE.defaultState());
  web.CPD_AppState.coopProfile.coopName = coopName || 'สหกรณ์ทดสอบ จำกัด';
  return web;
}

const SUMMARY_WITH_HEADING =
  '4. สรุปผลการวิเคราะห์ ' +
  '1) ด้านการบริหารจัดการองค์กร (หลัก 4M): - ปัญหาที่ 1: ทุนสำรองต่ำ ' +
  'แนวทางดำเนินการ: จัดสรรกำไรเข้าเป็นทุนสำรอง (แก้ไขปัญหาที่ 1)';

test('ตัดชื่อหัวข้อ 4 ที่ AI พิมพ์ซ้ำกับป้าย textarea', function () {
  const web = setup();
  const applied = web.CPD_UI.applyUploadedAnalysisNotes({ summaryAnalysis: SUMMARY_WITH_HEADING });

  assert.strictEqual(applied, true);
  const stored = web.CPD_AppState.analysis.uploadedSummaryAnalysis;
  const shown = web.CPD_AppState.analysis.summaryAnalysis;
  assert.ok(stored.indexOf('4. สรุปผลการวิเคราะห์') === -1, 'ต้องไม่เหลือชื่อหัวข้อซ้ำ');
  assert.ok(stored.indexOf('1) ด้านการบริหารจัดการองค์กร') === 0, 'ต้องเริ่มด้วยเนื้อหาหัวข้อ 1');
  assert.strictEqual(shown, stored, 'ข้อความที่แสดงต้องตรงกับที่เก็บ');
});

test('ตัดชื่อหัวข้อ 1/2/3 ที่ขึ้นต้นข้อความ (รูปแบบมีเลขหรือไม่มีก็ได้)', function () {
  const web = setup();
  const longTail = ' - รายละเอียดการวิเคราะห์ที่ยาวพอสมควรเพื่อไม่ให้ถูกมองว่าเป็นชื่อหัวข้อล้วน';

  web.CPD_UI.applyUploadedAnalysisNotes({
    orgAnalysis4M: '1. ด้านการบริหารจัดการองค์กร (หลัก 4M)' + longTail,
    businessAnalysis: 'ด้านการบริหารจัดการธุรกิจ' + longTail,
    welfareAnalysis: '3) ด้านการจัดสวัสดิการและสาธารณประโยชน์' + longTail
  });

  const a = web.CPD_AppState.analysis;
  assert.ok(a.orgAnalysis4M.indexOf('- รายละเอียดการวิเคราะห์') === 0, 'หัวข้อ 1 ต้องถูกตัดชื่อออก');
  assert.ok(a.businessAnalysis.indexOf('- รายละเอียดการวิเคราะห์') === 0, 'หัวข้อ 2 ต้องถูกตัดชื่อออก');
  assert.ok(a.welfareAnalysis.indexOf('- รายละเอียดการวิเคราะห์') === 0, 'หัวข้อ 3 ต้องถูกตัดชื่อออก');
});

test('ไม่แตะข้อความที่ไม่มีชื่อหัวข้อซ้ำ', function () {
  const web = setup();
  const original = 'ผลการวิเคราะห์ข้อมูลของสหกรณ์: พบว่าทุนสำรองต่ำกว่ากณฑ์และควรเร่งรัดการจัดเก็บหนี้';
  web.CPD_UI.applyUploadedAnalysisNotes({ summaryAnalysis: original });

  assert.strictEqual(web.CPD_AppState.analysis.summaryAnalysis, original);
});

test('ถ้าข้อความทั้งก้อนเป็นชื่อหัวข้อเพียงอย่างเดียว ต้องไม่ถูกตัดจนว่าง', function () {
  const web = setup();
  const onlyHeading = '4. สรุปผลการวิเคราะห์';
  web.CPD_UI.applyUploadedAnalysisNotes({ summaryAnalysis: onlyHeading });

  assert.strictEqual(web.CPD_AppState.analysis.uploadedSummaryAnalysis, onlyHeading);
});

test('สหกรณ์ที่มีบทวิเคราะห์ผ่านการตรวจสอบแล้ว (preload) ต้องไม่ถูกเขียนทับ', function () {
  const web = setup(TOYOTA);
  const before = web.CPD_AppState.analysis.summaryAnalysis;

  web.CPD_UI.applyUploadedAnalysisNotes({
    summaryAnalysis: SUMMARY_WITH_HEADING,
    orgAnalysis4M: '1. ด้านการบริหารจัดการองค์กร (หลัก 4M) ข้อความใหม่ที่ไม่ควรถูกใช้'
  });

  const a = web.CPD_AppState.analysis;
  assert.strictEqual(a.summaryAnalysis, before, 'ห้ามเขียนทับ summaryAnalysis');
  assert.strictEqual(a.uploadedSummaryAnalysis, '', 'ห้ามบันทึกทับ uploadedSummaryAnalysis');
  assert.strictEqual(a.uploadedOrgAnalysis4M, '', 'ห้ามบันทึกทับ uploadedOrgAnalysis4M');
});

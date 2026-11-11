'use strict';

/**
 * เทสต์ตรรกะปีงบประมาณ/กำหนดเวลาใน web/js/cpd-state.js
 * เน้นสิ่งที่เคยพลาดบน production: ปีพิมพ์ผิด, วันที่รับรองงบไม่ตรงเดือนประชุมใหญ่
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadWebScripts } = require('./helpers/sandbox');

const web = loadWebScripts(['web/js/cpd-state.js']);
const S = web.CPD_STATE;
const AppState = web.CPD_AppState;

function reset() {
  S.replaceState(S.defaultState());
}

test('ค่าเริ่มต้นผูกกับปีงบประมาณ 2570', function () {
  reset();
  assert.strictEqual(AppState.meta.fiscalYear, '2570');
  assert.strictEqual(S.getFiscalYear(), '2570');
  assert.strictEqual(AppState.coopProfile.fiscalEndDate, '31 มีนาคม');
});

test('ฟิลด์ uploaded* มีอยู่ใน State เริ่มต้น (สัญญากับฝั่ง AI)', function () {
  reset();
  [
    'uploadedSectionsCoop',
    'uploadedOrgAnalysis4M',
    'uploadedBusinessAnalysis',
    'uploadedWelfareAnalysis',
    'uploadedSummaryAnalysis'
  ].forEach(function (key) {
    assert.ok(Object.prototype.hasOwnProperty.call(AppState.analysis, key), 'ต้องมี analysis.' + key);
    assert.strictEqual(typeof AppState.analysis[key], 'string', 'analysis.' + key + ' ต้องเป็นสตริง');
  });
});

test('กำหนดเวลาเริ่มต้น: ปิดบัญชี 30 วัน และประชุมใหญ่ 150 วัน', function () {
  reset();
  const d = S.computeDeadlines();
  assert.strictEqual(d.endDate, '31/03/2570');
  assert.strictEqual(d.close30, '30/04/2570');
  assert.strictEqual(d.agm150, '28/08/2570');
});

test('ปีบัญชีที่ปิดเดือน ก.ย.–ธ.ค. ใช้ปีก่อนหน้าปีงบประมาณ', function () {
  reset();
  AppState.coopProfile.fiscalEndDate = '30 กันยายน';
  const d = S.computeDeadlines();
  assert.strictEqual(d.endDate, '30/09/2569');
  assert.strictEqual(d.close30, '30/10/2569');
});

test('วันที่รับรองงบอยู่ในเดือนเดียวกับประชุมใหญ่ และไม่เกินวันประชุม', function () {
  reset();
  const agm = '28/08/2570';
  const certify = S.deriveCertifyDate(agm);
  assert.strictEqual(certify, 'สิงหาคม 2570');
  assert.ok(/^[ก-๙]+ \d{4}$/.test(certify), 'ต้องแสดงเฉพาะเดือน + ปี พ.ศ.');
});

test('ถ้าวันรับรองงบ (ลบ 7 วัน) ตกเดือนก่อน ต้องเลื่อนมาเป็นวันที่ 1 ของเดือนประชุมใหญ่', function () {
  reset();
  const certify = S.deriveCertifyDate('03/09/2570');
  assert.strictEqual(certify, 'กันยายน 2570');
});

test('วันประชุมใหญ่ที่กรอกเองต้องไม่ถูกเขียนทับ และเดือนรับรองงบตามเดือนนั้น', function () {
  reset();
  AppState.closingReport.agmDate = '28 กุมภาพันธ์ 2570';
  const d = S.deriveAgmDates();
  assert.strictEqual(d.agmDate, '28/02/2570');
  assert.strictEqual(d.agmMonth, 2);
  assert.strictEqual(d.agmYear, 2570);
  assert.strictEqual(d.certifyDate, 'กุมภาพันธ์ 2570');
});

test('applyAutoDeadlines เติมกำหนดเวลาลง State โดยไม่ทับวันประชุมใหญ่ที่กรอกเอง', function () {
  reset();
  AppState.closingReport.agmDate = '28 กุมภาพันธ์ 2570';
  const d = S.applyAutoDeadlines();
  assert.strictEqual(AppState.scheduleAndActivities.targetCloseAccountDate30Days, d.close30);
  assert.strictEqual(AppState.scheduleAndActivities.targetAgmDate150Days, d.agmDate);
  assert.strictEqual(AppState.closingReport.auditorCertifyDate, d.certifyDate);
  assert.strictEqual(AppState.closingReport.agmDate, '28 กุมภาพันธ์ 2570', 'ห้ามเขียนทับค่าที่ผู้ใช้กรอก');
});

test('เดือน/ปี ของกิจกรรม 2.2 (รับรองงบ) ตรงกับเดือนประชุมใหญ่', function () {
  reset();
  AppState.closingReport.agmDate = '15/11/2569';
  const d = S.deriveAgmDates();
  const monthName = S.monthByKey('m' + d.agmMonth).name;
  assert.strictEqual(d.certifyDate, monthName + ' ' + d.agmYear);
});

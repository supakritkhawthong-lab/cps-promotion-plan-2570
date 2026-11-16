'use strict';

/**
 * เทสต์ Phase 0: Safe Upload Apply (web/js/cpd-upload.js)
 * - แยก "ไม่พบ" ออกจาก "ศูนย์"
 * - ไม่เขียนทับค่าที่มีอยู่โดยไม่แจ้ง (field-level diff + review)
 * - snapshot / rollback
 * - metadata ต่อรอบ (runId / ปีบัญชี / ไฟล์)
 * - validation สมการบัญชี
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadWebScripts } = require('./helpers/sandbox');

function setup() {
  const web = loadWebScripts([
    'web/js/cpd-state.js',
    'web/js/cpd-upload.js'
  ]);
  web.CPD_STATE.replaceState(web.CPD_STATE.defaultState());
  web.CPD_AppState.meta.fiscalYear = '2570';
  web.CPD_AppState.coopProfile.coopName = 'สหกรณ์ทดสอบ จำกัด';
  return web;
}

function makeDoc(values) {
  const els = {};
  webFill(els, values || {});
  return {
    getElementById: function (id) { return els[id] || null; },
    _els: els
  };
}

function webFill(els, values) {
  Object.keys(values).forEach(function (id) {
    els[id] = { value: String(values[id]) };
  });
}

function ensureEls(doc, ids) {
  ids.forEach(function (id) {
    if (!doc._els[id]) doc._els[id] = { value: '' };
  });
  return doc;
}

function allIds(web) {
  const ids = web.CPD_UPLOAD.FIELD_DEFS.map(function (d) { return d.id; });
  return ids.filter(function (id) { return id && id !== 'auditor_name'; })
    .concat(['gov_auditor_name', 'priv_auditor_name', 'fiscal_year', 'accumfund_latest']);
}

// ---------------------------------------------------------------------------
// ตัวเลข
// ---------------------------------------------------------------------------

test('parseNumber: วงเล็บคือค่าลบ และแยกค่าว่างออกจากศูนย์', function () {
  const web = setup();
  const p = web.CPD_UPLOAD.parseNumber;
  assert.strictEqual(p('(1,234.50)'), -1234.5);
  assert.strictEqual(p('1,234.50'), 1234.5);
  assert.strictEqual(p('๑,๒๓๔.๕๐'), 1234.5);
  assert.strictEqual(p('1.2 ล้านบาท'), 1200000);
  assert.strictEqual(p('0'), 0);
  assert.strictEqual(p(''), null);
  assert.strictEqual(p('-'), null);
  assert.strictEqual(p('ไม่พบ'), null);
  assert.strictEqual(p(null), null);
});

test('S.num(): วงเล็บต้องกลายเป็นค่าลบ (ไม่ใช่ค่าบวก)', function () {
  const web = setup();
  assert.strictEqual(web.CPD_STATE.num('(1,234.50)'), -1234.5);
  assert.strictEqual(web.CPD_STATE.num('-500'), -500);
  assert.strictEqual(web.CPD_STATE.num('๐'), 0);
});

// ---------------------------------------------------------------------------
// plan: merge policy
// ---------------------------------------------------------------------------

test('plan: เติมเฉพาะช่องว่าง และไม่แตะค่าที่มีอยู่', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({ asset_latest: '10,000,000.00' }), allIds(web));
  const plan = web.CPD_UPLOAD.plan({
    assetLatest: '10,500,000.00',
    debtLatest: '4,000,000.00'
  }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });

  const updateIds = plan.updates.map(function (r) { return r.id; });
  assert.ok(updateIds.indexOf('debt_latest') !== -1, 'ช่องว่างต้องถูกเติม');
  assert.ok(updateIds.indexOf('asset_latest') === -1, 'ค่าที่มีอยู่ต้องไม่ถูกทับอัตโนมัติ');
  assert.strictEqual(plan.fields.assetLatest.status, 'conflict');
  assert.strictEqual(plan.fields.assetLatest.before, '10,000,000.00');
  assert.strictEqual(plan.fields.assetLatest.after, '10,500,000.00');
});

test('plan: AI ไม่พบข้อมูล (ค่าว่าง/ขีด) ต้องไม่ล้างช่องเดิม', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({ reserve_latest: '500,000.00' }), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ reserveLatest: '' }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });
  assert.strictEqual(plan.fields.reserveLatest.status, 'missing');
  assert.ok(plan.updates.map(function (r) { return r.id; }).indexOf('reserve_latest') === -1);
});

test('plan: ค่าเดิมตรงกันถือว่า same และไม่ต้องเติมซ้ำ', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({ share_latest: '1,000,000.00' }), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ shareLatest: '1000000' }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });
  assert.strictEqual(plan.fields.shareLatest.status, 'same');
  assert.ok(!plan.updates.some(function (r) { return r.id === 'share_latest'; }));
});

test('plan: ค่าเดิมเป็นผลจากรอบอัปโหลดก่อน → ทับได้อย่างปลอดภัย (update)', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({ asset_latest: '10,000,000.00' }), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ assetLatest: '10,500,000.00' }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570',
    previousFields: {
      assetLatest: { key: 'assetLatest', id: 'asset_latest', status: 'fill', after: '10,000,000.00', value: 10000000 }
    }
  });
  assert.strictEqual(plan.fields.assetLatest.status, 'update');
  assert.ok(plan.updates.some(function (r) { return r.id === 'asset_latest'; }));
});

test('plan: ข้อความจากรอบอัปโหลดก่อนก็ทับได้ (update) ไม่ต้องรอตรวจ', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({ district: 'เมืองนครราชสีมา' }), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ district: 'เมืองขอนแก่น' }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570',
    previousFields: {
      district: { key: 'district', id: 'district', status: 'fill', after: 'เมืองนครราชสีมา', display: 'เมืองนครราชสีมา' }
    }
  });
  assert.strictEqual(plan.fields.district.status, 'update');
  assert.ok(plan.updates.some(function (r) { return r.id === 'district'; }));
});

// ---------------------------------------------------------------------------
// plan: missing vs zero
// ---------------------------------------------------------------------------

test('plan: AI ตอบ 0 จากไฟล์สแกน → ต้องรอผู้ใช้ยืนยัน (zeroReview)', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ cashLatest: 0 }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570',
    files: [{ name: 'scan.pdf', mode: 'scan', lowTextPdf: true }]
  });
  assert.strictEqual(plan.fields.cashLatest.status, 'zeroReview');
  assert.ok(!plan.updates.some(function (r) { return r.id === 'cash_latest'; }));
  assert.ok(plan.review.some(function (r) { return r.id === 'cash_latest'; }));
});

test('plan: AI ตอบ 0 จากไฟล์ดิจิทัล → เติมได้แต่ติดธง zero', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ staffCountLatest: 0 }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570',
    files: [{ name: 'report.pdf', mode: 'text', totalPages: 3, pagesRead: 3, lowTextPdf: false }]
  });
  assert.strictEqual(plan.fields.staffCountLatest.status, 'zero');
  assert.ok(plan.updates.some(function (r) { return r.id === 'staff_count_latest'; }));
});

test('plan: AI ตอบ 0 แต่ช่องมีค่าเดิม → ห้ามทับ (zeroConflict)', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({ cash_latest: '250,000.00' }), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ cashLatest: 0 }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });
  assert.strictEqual(plan.fields.cashLatest.status, 'zeroConflict');
  assert.strictEqual(plan.fields.cashLatest.before, '250,000.00');
});

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

test('validation: สมการบัญชีไม่ดุล → ระงับการเติมอัตโนมัติและย้ายไป review', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const plan = web.CPD_UPLOAD.plan({
    assetLatest: '10,000,000.00',
    debtLatest: '4,000,000.00',
    shareLatest: '1,000,000.00',
    reserveLatest: '500,000.00',
    profitLatest: '1,000,000.00'
  }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });

  assert.ok(plan.warnings.some(function (w) { return w.indexOf('สมการบัญชีไม่ดุล') !== -1; }));
  assert.strictEqual(plan.fields.assetLatest.status, 'conflict');
  assert.ok(plan.review.some(function (r) { return r.id === 'asset_latest'; }));
  assert.ok(!plan.updates.some(function (r) { return r.id === 'asset_latest'; }));
});

test('validation: สมการบัญชีดุลผ่าน ไม่ถูกระงับ', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const plan = web.CPD_UPLOAD.plan({
    assetLatest: '10,000,000.00',
    debtLatest: '4,000,000.00',
    shareLatest: '1,000,000.00',
    reserveLatest: '500,000.00',
    profitLatest: '4,500,000.00'
  }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });

  assert.ok(!plan.warnings.some(function (w) { return w.indexOf('สมการบัญชีไม่ดุล') !== -1; }));
  assert.strictEqual(plan.fields.assetLatest.status, 'fill');
});

test('validation: จำนวนสมาชิกไม่สอดคล้องต้องเตือน', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const plan = web.CPD_UPLOAD.plan({ memLatest: '1,200/900/200' }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });
  assert.ok(plan.warnings.some(function (w) { return w.indexOf('จำนวนสมาชิก') !== -1; }));
});

// ---------------------------------------------------------------------------
// metadata / snapshot / rollback
// ---------------------------------------------------------------------------

test('commit: เก็บ uploadMeta + snapshot และ rollback คืนค่าเดิมได้', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({ debt_latest: '3,000,000.00' }), allIds(web));
  const before = web.CPD_UPLOAD.captureValues(doc);

  const plan = web.CPD_UPLOAD.plan({
    assetLatest: '10,000,000.00',
    debtLatest: '4,000,000.00',
    cashLatest: '250,000.00'
  }, {
    formValues: before,
    fiscalYear: '2570',
    files: [{ name: 'fs.pdf', category: 'งบการเงิน', mode: 'text', totalPages: 12, pagesRead: 5, chars: 40000, truncated: true }]
  });

  const applied = web.CPD_UPLOAD.applyPlan(plan, { document: doc, state: web.CPD_AppState });
  const meta = web.CPD_UPLOAD.commit(plan, {
    before: before,
    applied: applied,
    env: { state: web.CPD_AppState, document: doc }
  });

  assert.ok(meta && meta.runId);
  assert.strictEqual(web.CPD_AppState.analysis.uploadMeta.runId, meta.runId);
  assert.strictEqual(web.CPD_AppState.analysis.uploadMeta.fiscalYear, '2570');
  assert.strictEqual(web.CPD_AppState.analysis.uploadMeta.files[0].name, 'fs.pdf');
  assert.ok(web.CPD_AppState.analysis.uploadHistory.length === 1);
  assert.strictEqual(doc.getElementById('debt_latest').value, '3,000,000.00');
  assert.strictEqual(doc.getElementById('asset_latest').value, '10,000,000.00');
  assert.strictEqual(doc.getElementById('cash_latest').value, '250,000.00');

  const restored = web.CPD_UPLOAD.rollback({ document: doc, state: web.CPD_AppState });
  assert.strictEqual(restored, 2);
  assert.strictEqual(doc.getElementById('debt_latest').value, '3,000,000.00');
  assert.strictEqual(doc.getElementById('asset_latest').value, '');
  assert.strictEqual(doc.getElementById('cash_latest').value, '');
  assert.strictEqual(web.CPD_AppState.analysis.uploadMeta, null);
});

test('plan: เตือนเมื่อเอกสารถูกตัดข้อความ และเมื่อเป็นไฟล์สแกน', function () {
  const web = setup();
  const plan = web.CPD_UPLOAD.plan({}, {
    formValues: {},
    fiscalYear: '2570',
    files: [
      { name: 'long.pdf', mode: 'text', totalPages: 48, pagesRead: 25, truncated: true },
      { name: 'scan.pdf', mode: 'scan', lowTextPdf: true }
    ]
  });
  const text = plan.warnings.join(' | ');
  assert.ok(text.indexOf('ถูกตัดข้อความ') !== -1);
  assert.ok(text.indexOf('ไฟล์สแกน') !== -1);
});

test('plan: ปีบัญชีในเอกสารใหม่กว่าปีแผนต้องเตือน', function () {
  const web = setup();
  const plan = web.CPD_UPLOAD.plan({ yrLatest: 'ธ.ค. 72', yrPrev: 'ธ.ค. 71' }, {
    formValues: {},
    fiscalYear: '2570'
  });
  assert.ok(plan.warnings.some(function (w) { return w.indexOf('ปีบัญชีในเอกสาร') !== -1; }));
});

test('plan: ชื่อผู้สอบบัญชีเลือกช่องตามชื่อ และประเภทผู้สอบบัญชีถูก normalize', function () {
  const web = setup();
  const plan = web.CPD_UPLOAD.plan({
    auditorName: 'นางสาวพรทิพย์ ใจดี',
    auditorType: 'ภาคเอกชน'
  }, { formValues: {}, fiscalYear: '2570' });

  assert.strictEqual(plan.fields.auditorName.id, 'gov_auditor_name');
  assert.strictEqual(plan.fields.auditorName.after, 'พรทิพย์');
  assert.strictEqual(plan.fields.auditorType.after, 'ภาคเอกชน');
});

test('plan: fields ที่มี id ไม่ซ้ำกัน (กันการเขียนทับผิดช่อง)', function () {
  const web = setup();
  const seen = {};
  web.CPD_UPLOAD.FIELD_DEFS.forEach(function (def) {
    if (!def.id || def.id === 'auditor_name') return;
    assert.ok(!seen[def.id], 'id ซ้ำ: ' + def.id);
    seen[def.id] = true;
  });
});

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
    'web/js/cpd-pdf-pipeline.js',
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

test('commit: documents ถูกเก็บเป็น Markdown + fields แต่ไม่เก็บ base64', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const plan = web.CPD_UPLOAD.plan({
    assetLatest: '10,000,000.00',
    debtLatest: '4,000,000.00'
  }, { formValues: {}, fiscalYear: '2570', files: [] });

  web.CPD_UPLOAD.commit(plan, {
    before: {},
    applied: [],
    documents: [{
      name: 'finance.pdf',
      category: 'งบการเงิน',
      markdown: '## หน้า 1\nงบฐานะการเงิน รวมสินทรัพย์',
      fields: { assetLatest: { value: 10000000, display: '10,000,000.00' } },
      pages: [{ page: 1, base64: 'SECRET' }]
    }],
    env: { state: web.CPD_AppState, document: doc }
  });

  const cached = web.CPD_PDF_PIPELINE.readCachedDocs(web.CPD_AppState);
  assert.strictEqual(cached.length, 1);
  assert.strictEqual(cached[0].markdown.indexOf('## หน้า 1') !== -1, true);
  assert.strictEqual(cached[0].fields.assetLatest.display, '10,000,000.00');
  assert.strictEqual(JSON.stringify(web.CPD_AppState).indexOf('SECRET'), -1,
    'ต้องไม่มี base64 หลุดลง State');
});

test('normalizeFiles: เก็บ pipeline + jpegPages metadata แต่ไม่เก็บ base64 JPEG', function () {
  const web = setup();
  const files = web.CPD_UPLOAD.normalizeFiles([{
    name: 'scan.pdf',
    category: 'งบการเงิน',
    mode: 'scan',
    lowTextPdf: true,
    pipeline: 'jpeg',
    jpegPages: [
      { page: 1, base64: 'SECRET', width: 1200, height: 800 },
      { page: 2, base64: 'SECRET2', width: 1200, height: 800 }
    ]
  }]);

  assert.strictEqual(files[0].pipeline, 'jpeg');
  assert.strictEqual(files[0].jpegPages.length, 2);
  assert.strictEqual(files[0].jpegPages[0].page, 1);
  assert.strictEqual(files[0].jpegPages[0].width, 1200);
  assert.strictEqual(JSON.stringify(files).indexOf('SECRET'), -1,
    'metadata ต้องไม่มี base64');
});

test('selectPages: outputFormat markdown ใช้หัวข้อ ## หน้า N และตัดที่ขอบหน้า', function () {
  const web = setup();
  const pages = [
    { page: 1, text: 'ข้อมูลพื้นฐานสหกรณ์ ทดสอบระบบ' },
    { page: 2, text: 'งบฐานะการเงิน รวมสินทรัพย์ 1,234.50 หนี้สิน 2,345.60' }
  ];
  const sel = web.CPD_UPLOAD.selectPages(pages, {
    maxChars: 100000,
    declaredTotalPages: 2,
    outputFormat: 'markdown'
  });

  assert.strictEqual(sel.outputFormat, 'markdown');
  assert.ok(sel.text.indexOf('## หน้า 1\n\n') === 0, 'ต้องขึ้นหัวข้อ Markdown');
  assert.ok(sel.text.indexOf('## หน้า 2\n\n') !== -1);
  assert.strictEqual(sel.text.indexOf('[หน้า '), -1, 'ต้องไม่ใช้รูปแบบเดิม');

  // trimFileToChars ต้องยังตัดข้อความ markdown ได้ (ไม่ตัดกลางหน้า)
  const file = { extractedText: sel.text };
  const parts = web.CPD_UPLOAD.pagePartsFromText(file.extractedText);
  assert.ok(parts && parts.length === 2, 'ต้องแยกหน้าจาก ## หน้า N ได้');
  assert.strictEqual(web.CPD_UPLOAD.pageNumbersFromText(file.extractedText).join(','), '1,2');
  const changed = web.CPD_UPLOAD.trimFileToChars(file, 40);
  assert.strictEqual(changed, true, 'ต้องตัดข้อความ markdown ได้');
  assert.ok(file.extractedText.indexOf('## หน้า ') !== -1, 'หลังตัดยังต้องเป็น markdown');
});

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

// ---------------------------------------------------------------------------
// Phase 1A: page scoring / selection / per-file + total budget
// ---------------------------------------------------------------------------

function makePages(count) {
  const pages = [];
  for (let p = 1; p <= count; p++) {
    let text = 'ข้อความทั่วไป ' + p + ' ' + 'รายละเอียด '.repeat(3);
    if (p <= 3) text = 'ข้อมูลพื้นฐาน ' + p + ' ' + 'คำอธิบาย '.repeat(3);
    if (p === 8) text = 'งบฐานะการเงิน รวมสินทรัพย์ 1,234.50 หนี้สิน 2,345.60 กำไร 3,456.70 ทุนเรือนหุ้น 4,567.80';
    pages.push({ page: p, text: text });
  }
  return pages;
}

function makeFile(name, pages) {
  const text = pages.map(function (t, i) { return '[หน้า ' + (i + 1) + '] ' + t; }).join('\n');
  return {
    name: name,
    mode: 'text',
    extractedText: text,
    chars: text.length,
    pagesRead: pages.length,
    coverage: {
      totalPages: pages.length,
      pagesRead: pages.length,
      pagesIncluded: pages.length,
      pagesSkipped: [],
      skippedCount: 0,
      pagesSkippedHighScore: [],
      charsTotal: text.length,
      charsSent: text.length,
      complete: true
    }
  };
}

test('scorePageText: หน้างบการเงินได้คะแนนสูงกว่าหน้าปก และตรวจพบตัวเลข/ตาราง', function () {
  const web = setup();
  const score = web.CPD_UPLOAD.scorePageText;
  const cover = score('รายงานประจำปี 2569 สหกรณ์ทดสอบ จำกัด', 1);
  const fin = score('งบฐานะการเงิน ณ วันที่ 31 มีนาคม 2569 รวมสินทรัพย์ 12,345,678.90 รวมหนี้สิน 5,000,000.00 ทุนเรือนหุ้น 3,000,000.00 ทุนสำรอง 1,500,000.00', 20);
  const table = score('1,234.00 2,345.00 3,456.00 4,567.00 5,678.00 6,789.00', 30);

  assert.ok(fin.score > cover.score, 'หน้างบควรได้คะแนนมากกว่าหน้าปก');
  assert.ok(fin.numbers >= 4);
  assert.ok(fin.reasons.length > 0);
  assert.ok(table.score >= 4, 'ตารางตัวเลขควรได้คะแนนนำ');
  assert.strictEqual(web.CPD_UPLOAD.countNumberTokens(''), 0);
  assert.strictEqual(web.CPD_UPLOAD.countNumberTokens('(1,234.50) 2,000'), 2);
});

test('countMonetaryTokens: นับเฉพาะตัวเลขการเงิน ไม่นับเลขหน้า/ปี/จำนวนคน', function () {
  const web = setup();
  const count = web.CPD_UPLOAD.countMonetaryTokens;

  assert.strictEqual(count(''), 0);
  assert.strictEqual(count('[หน้า 1] รายงานประจำปี 2569 คณะกรรมการ 9 คน สมาชิก 150 คน'), 0);
  assert.strictEqual(count('ทุนเรือนหุ้น 15,000,000.00 บาท กำไรสุทธิ 500,000.00 บาท'), 2);
  assert.strictEqual(count('สินทรัพย์รวม 25723883.12 บาท หนี้สิน 5000000.00 บาท'), 2);
});

test('selectPages: เก็บหน้า 1-3 เสมอ เรียงตามหน้า และเคารพ budget', function () {
  const web = setup();
  const sel = web.CPD_UPLOAD.selectPages(makePages(10), {
    maxChars: 300,
    alwaysPages: 3,
    declaredTotalPages: 10
  });

  assert.strictEqual(sel.pagesSelected.slice(0, 3).join(','), '1,2,3');
  assert.ok(sel.pagesSelected.indexOf(8) !== -1, 'หน้าคะแนนสูงควรถูกเลือก');
  assert.ok(sel.charsSelected <= 300);
  assert.strictEqual(sel.pagesSelectedCount, sel.pagesSelected.length);
  assert.strictEqual(sel.complete, false);
  assert.ok(sel.skippedCount > 0);
  assert.ok(sel.pagesSkipped.length > 0);
  assert.ok(sel.text.indexOf('[หน้า 1] ') === 0);
});

test('selectPages: หน้าที่คะแนนสูงแต่เกิน budget ต้องถูกบันทึกไว้เตือนผู้ใช้', function () {
  const web = setup();
  const sel = web.CPD_UPLOAD.selectPages(makePages(10), {
    maxChars: 200,
    alwaysPages: 3,
    declaredTotalPages: 10
  });

  assert.ok(sel.pagesSelected.indexOf(8) === -1);
  assert.ok(sel.pagesSkippedHighScore.indexOf(8) !== -1);
  assert.strictEqual(sel.complete, false);
});

test('selectPages: ข้อความพอดี budget → complete = true และไม่มีการข้าม', function () {
  const web = setup();
  const pages = [
    { page: 1, text: 'ข้อมูลพื้นฐานสหกรณ์ ทดสอบระบบ' },
    { page: 2, text: 'รายชื่อคณะกรรมการดำเนินการประจำปี' },
    { page: 3, text: 'ประวัติโดยย่อของสหกรณ์ทดสอบ' }
  ];
  const sel = web.CPD_UPLOAD.selectPages(pages, {
    maxChars: 100000,
    declaredTotalPages: 3
  });

  assert.strictEqual(sel.pagesSelected.join(','), '1,2,3');
  assert.strictEqual(sel.skippedCount, 0);
  assert.strictEqual(sel.complete, true);
});

test('selectPages: alwaysPages/minPageChars = 0 เคารพการเลือกหน้ากลับของผู้ใช้', function () {
  const web = setup();
  const pages = [
    { page: 1, text: 'สั้น' },
    { page: 2, text: 'งบฐานะการเงิน รวมสินทรัพย์ 1,234.50 หนี้สิน 2,345.60' }
  ];
  const sel = web.CPD_UPLOAD.selectPages(pages, {
    maxChars: 60,
    alwaysPages: 0,
    minPageChars: 0,
    declaredTotalPages: 2,
    outputFormat: 'markdown'
  });

  assert.strictEqual(sel.pagesSelected.join(','), '2', 'ไม่บังคับหน้า 1 ที่ผู้ใช้ไม่ได้เลือก');
  assert.strictEqual(sel.text.indexOf('## หน้า 1'), -1);
});

test('applyTotalBudget: ตัดไฟล์ใหญ่สุดก่อน ทีละหน้า ไม่ตัดกลางหน้า และอัปเดต coverage', function () {
  const web = setup();
  const big = makeFile('big.pdf', Array.from({ length: 10 }, function () { return 'x'.repeat(2000); }));
  const small = makeFile('small.pdf', ['y'.repeat(2000)]);
  const smallChars = small.extractedText.length;

  web.CPD_UPLOAD.applyTotalBudget([big, small], {
    maxTotalChars: 12000,
    minPerFile: 3000
  });

  assert.ok(big.extractedText.length < 22011, 'ไฟล์ใหญ่ต้องถูกตัด');
  assert.strictEqual(small.extractedText.length, smallChars, 'ไฟล์เล็กกว่า minPerFile ต้องไม่ถูกตัด');
  assert.strictEqual(big.truncated, true);
  assert.strictEqual(big.coverage.complete, false);
  assert.ok(big.coverage.skippedCount >= 1);
  assert.strictEqual(big.coverage.pagesIncluded, big.extractedText.split('\n').length);

  const lines = big.extractedText.split('\n');
  lines.forEach(function (line, i) {
    assert.ok(/^\[หน้า \d+\] x+$/.test(line), 'บรรทัดที่ ' + (i + 1) + ' ต้องเป็นหน้าทั้งหน้า');
  });
  assert.ok(big.extractedText.length + small.extractedText.length <= 12000);
});

test('applyTotalBudget: ตัดหน้าคะแนนต่ำก่อน และเก็บหน้าสำคัญท้ายไฟล์ไว้', function () {
  const web = setup();
  const filler = 'z'.repeat(1900);
  const pages = [];
  for (let i = 1; i <= 10; i++) {
    pages.push(i === 10
      ? 'งบฐานะการเงิน รวมสินทรัพย์ 123,456.00 ทุนเรือนหุ้น 50,000.00 ENDOF10'
      : filler);
  }
  const fin = makeFile('fin.pdf', pages);
  const extra = makeFile('extra.pdf', ['y'.repeat(6000)]);

  web.CPD_UPLOAD.applyTotalBudget([fin, extra], {
    maxTotalChars: 13000,
    minPerFile: 6000
  });

  assert.ok(fin.extractedText.indexOf('ENDOF10') !== -1, 'หน้าคะแนนสูงท้ายไฟล์ต้องยังอยู่');
  const keptPages = web.CPD_UPLOAD.pageNumbersFromText(fin.extractedText);
  assert.strictEqual(keptPages.join(','), '1,2,3,10');
  assert.ok(fin.coverage.skippedCount >= 6);
  assert.ok(fin.coverage.pagesSkippedHighScore.indexOf(10) === -1);
});

test('normalizeFiles: เก็บ coverage (อ่าน/ส่ง/ข้าม) ไว้ใน uploadMeta', function () {
  const web = setup();
  const files = web.CPD_UPLOAD.normalizeFiles([{
    name: 'annual.pdf',
    mode: 'text',
    coverage: {
      totalPages: 62,
      pagesRead: 62,
      pagesIncluded: 41,
      pagesSkipped: Array.from({ length: 120 }, function (_, i) { return i + 1; }),
      skippedCount: 21,
      pagesSkippedHighScore: [8, 12],
      charsTotal: 100000,
      charsSent: 54000,
      complete: false
    }
  }]);

  assert.strictEqual(files[0].coverage.totalPages, 62);
  assert.strictEqual(files[0].coverage.pagesRead, 62);
  assert.strictEqual(files[0].coverage.pagesIncluded, 41);
  assert.strictEqual(files[0].coverage.skippedCount, 21);
  assert.strictEqual(files[0].coverage.pagesSkippedHighScore.join(','), '8,12');
  assert.strictEqual(files[0].coverage.pagesSkipped.length, 100, 'ต้องจำกัดขนาด metadata');
});

test('plan: เตือน coverage — อ่าน/ส่ง/ข้าม และหน้าที่มีแนวโน้มสำคัญ', function () {
  const web = setup();
  const plan = web.CPD_UPLOAD.plan({}, {
    formValues: {},
    fiscalYear: '2570',
    files: [{
      name: 'annual.pdf',
      mode: 'text',
      coverage: {
        totalPages: 62,
        pagesRead: 62,
        pagesIncluded: 41,
        pagesSkipped: [7, 8],
        skippedCount: 21,
        pagesSkippedHighScore: [8, 12],
        charsTotal: 100000,
        charsSent: 54000,
        complete: false
      }
    }]
  });
  const text = plan.warnings.join(' | ');
  assert.ok(text.indexOf('อ่าน 62/62 หน้า') !== -1);
  assert.ok(text.indexOf('ส่งเข้า AI 41 หน้า') !== -1);
  assert.ok(text.indexOf('ข้าม 21 หน้า') !== -1);
  assert.ok(text.indexOf('หน้า 8, 12') !== -1);
});

// ---------------------------------------------------------------------------
// Phase 1B: evidence windows + targeted repair
// ---------------------------------------------------------------------------

function evidencePages() {
  return [
    {
      page: 40,
      text: 'รายละเอียดทั่วไป '.repeat(20) +
        ' งบฐานะการเงิน ณ วันที่ 31 มีนาคม 2569 รวมสินทรัพย์ 12,345,678.90 รวมหนี้สิน 5,000,000.00'
    },
    {
      page: 41,
      text: 'ผู้สอบบัญชีเห็นว่าการควบคุมภายในมีข้อบกพร่อง ควรแก้ไขโดยเร็ว และมีข้อสังเกตเรื่องสินค้าคงเหลือ'
    }
  ];
}

test('extractEvidence: ดึงข้อความรอบคำสำคัญจากหน้าที่ถูกข้าม พร้อมจำกัดขนาด', function () {
  const web = setup();
  const ev = web.CPD_UPLOAD.extractEvidence(evidencePages(), {
    maxChars: 1200,
    maxPerPage: 2
  });

  assert.ok(ev.text.indexOf('[หลักฐานจากหน้า 40]') !== -1, 'ต้องมีหลักฐานจากหน้า 40');
  assert.ok(ev.text.indexOf('[หลักฐานจากหน้า 41]') !== -1, 'ต้องมีหลักฐานจากหน้า 41');
  assert.ok(ev.text.indexOf('รวมสินทรัพย์') !== -1, 'ต้องเก็บตัวเลขสำคัญ');
  assert.ok(ev.text.indexOf('(งบฐานะการเงิน)') !== -1, 'ต้องระบุคำสำคัญที่พบ');
  assert.strictEqual(ev.pagesCovered.join(','), '40,41');
  assert.ok(ev.chars <= 1200);
  assert.strictEqual(ev.capped, false);
  assert.strictEqual(ev.windows.length, 2, 'หน้าละ 1 ช่วง (คำสำคัญที่อยู่ใกล้กันถูกรวมเป็นช่วงเดียว)');
});

test('extractEvidence: เพดานเล็กเกินไปต้องไม่เกิน budget และติดธง capped', function () {
  const web = setup();
  const ev = web.CPD_UPLOAD.extractEvidence(evidencePages(), { maxChars: 80 });
  assert.ok(ev.chars <= 80);
  assert.strictEqual(ev.capped, true);
});

test('extractEvidence: หน้าที่ข้อความสั้นเกินไปและคำซ้ำในหน้าเดียวกันถูกจำกัด', function () {
  const web = setup();
  const pages = [
    { page: 1, text: 'สั้น' },
    { page: 2, text: 'สินทรัพย์รวม 1,000.00 ' + 'ก'.repeat(400) + ' สินทรัพย์รวม 2,000.00 ' + 'ข'.repeat(400) }
  ];
  const ev = web.CPD_UPLOAD.extractEvidence(pages, { maxChars: 5000, maxPerPage: 1 });
  assert.strictEqual(ev.pagesCovered.join(','), '2', 'หน้าที่สั้นเกินไปต้องถูกข้าม');
  assert.strictEqual(ev.windows.length, 1, 'ต้องจำกัด 1 ช่วงต่อหน้า');
});

test('sliceEvidenceText: ตัดที่ขอบรายการหลักฐานเท่านั้น', function () {
  const web = setup();
  const text = [
    '[หลักฐานจากหน้า 1] ' + 'ก'.repeat(300),
    '[หลักฐานจากหน้า 2] ' + 'ข'.repeat(300),
    '[หลักฐานจากหน้า 3] ' + 'ค'.repeat(300)
  ].join('\n');
  const sliced = web.CPD_UPLOAD.sliceEvidenceText(text, text.length - 50);

  assert.ok(sliced.length <= text.length - 50);
  assert.ok(sliced.indexOf('[หลักฐานจากหน้า 3]') === -1, 'ต้องตัดทั้งรายการ ไม่ตัดกลางข้อความ');
  sliced.split('\n').forEach(function (line) {
    assert.ok(/^\[หลักฐานจากหน้า \d+\]/.test(line), 'ทุกรายการต้องขึ้นต้นด้วยหัวข้อหลักฐาน');
  });
});

test('trimFileToChars: หน้าที่ถูกตัดต้องถูกเก็บเป็น evidence และอัปเดต coverage', function () {
  const web = setup();
  const pages = [];
  for (let i = 1; i <= 10; i++) {
    if (i === 10) {
      pages.push('งบฐานะการเงิน รวมสินทรัพย์ 123,456.00 ทุนเรือนหุ้น 50,000.00 ENDOF10');
    } else if (i === 5) {
      pages.push('เงินให้กู้ 9,999.00 และลูกหนี้ 8,888.00 ' + 'z'.repeat(1800));
    } else {
      pages.push('z'.repeat(1900));
    }
  }
  const file = makeFile('fin.pdf', pages);
  const extra = makeFile('extra.pdf', ['y'.repeat(6000)]);

  web.CPD_UPLOAD.applyTotalBudget([file, extra], {
    maxTotalChars: 13000,
    minPerFile: 6000
  });

  assert.ok(file.evidenceText, 'ต้องมีหลักฐานจากหน้าที่ถูกตัด');
  assert.ok(file.evidenceText.indexOf('[หลักฐานจากหน้า 5]') !== -1, 'ต้องเก็บหลักฐานของหน้า 5');
  assert.ok(file.coverage.evidenceChars > 0);
  assert.ok(file.coverage.evidencePages.indexOf(5) !== -1);
  assert.ok(file.coverage.evidenceWindows >= 1);
  assert.ok(file.evidence.chars > 0);
});

test('attachFileEvidence: รวมหลักฐานเดิมและตัดที่เพดานต่อไฟล์', function () {
  const web = setup();
  const file = {
    name: 'a.pdf',
    evidenceText: '[หลักฐานจากหน้า 1] ' + 'ก'.repeat(80),
    coverage: {}
  };
  const added = web.CPD_UPLOAD.attachFileEvidence(file, [
    { page: 9, text: 'ทุนสำรอง 5,000.00 และกำไรสุทธิ 7,000.00' }
  ], { maxChars: 120 });

  assert.strictEqual(added, true);
  assert.ok(file.evidenceText.length <= 120);
  assert.strictEqual(file.coverage.evidenceCapped, true);
  assert.ok(file.coverage.evidencePages.indexOf(1) !== -1);
});

test('capEvidenceBudget: จำกัดหลักฐานรวมทุกไฟล์ และตัดที่ขอบรายการ', function () {
  const web = setup();
  function makeEvidenceFile(name) {
    const text = Array.from({ length: 8 }, function (_, i) {
      return '[หลักฐานจากหน้า ' + (i + 1) + '] ' + 'ก'.repeat(400);
    }).join('\n');
    return { name: name, evidenceText: text, coverage: {} };
  }
  const files = [makeEvidenceFile('a.pdf'), makeEvidenceFile('b.pdf')];
  const total = web.CPD_UPLOAD.capEvidenceBudget(files, 2500);

  assert.ok(total <= 2500, 'หลักฐานรวมต้องไม่เกินเพดาน');
  assert.ok(total > 0, 'ต้องเหลือหลักฐานไว้ใช้');
  files.forEach(function (f) {
    if (!f.evidenceText) return;
    f.evidenceText.split('\n').forEach(function (line) {
      assert.ok(/^\[หลักฐานจากหน้า \d+\]/.test(line), 'ต้องตัดที่ขอบรายการ');
    });
  });
});

test('normalizeFiles: เก็บ evidence metadata แบบจำกัดขนาด', function () {
  const web = setup();
  const pages = Array.from({ length: 40 }, function (_, i) { return i + 1; });
  const files = web.CPD_UPLOAD.normalizeFiles([{
    name: 'annual.pdf',
    mode: 'text',
    evidenceText: '[หลักฐานจากหน้า 40] สินทรัพย์รวม 1,000.00',
    evidence: { pages: pages, chars: 999, windows: 12 },
    coverage: {
      totalPages: 62,
      pagesRead: 62,
      pagesIncluded: 41,
      pagesSkipped: [],
      skippedCount: 21,
      evidenceChars: 999,
      evidencePages: pages,
      evidenceWindows: 12,
      evidenceCapped: true,
      complete: false
    }
  }]);

  assert.strictEqual(files[0].evidence.pages.length, 30, 'ต้องจำกัดหน้า evidence ใน metadata');
  assert.strictEqual(files[0].evidence.chars, 999);
  assert.strictEqual(files[0].coverage.evidencePages.length, 30);
  assert.strictEqual(files[0].coverage.evidenceChars, 999);
  assert.strictEqual(files[0].coverage.evidenceWindows, 12);
  assert.strictEqual(files[0].coverage.evidenceCapped, true);
});

// ---------------------------------------------------------------------------
// Phase 1C: chunked facts — provenance และ conflict
// ---------------------------------------------------------------------------

test('plan: เก็บที่มา (source) ของค่าที่ AI สกัดจากหลายช่วงลง uploadMeta', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const plan = web.CPD_UPLOAD.plan({
    assetLatest: '1,000.00',
    _aiFieldSources: {
      assetLatest: { file: 'fin.pdf', pages: '1–10', chunk: 2 },
      debtLatest: { file: '', pages: '' }
    }
  }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });

  const source = plan.fields.assetLatest.source;
  assert.deepStrictEqual(
    { file: source.file, pages: source.pages, chunk: source.chunk },
    { file: 'fin.pdf', pages: '1–10', chunk: '2' }
  );
  assert.strictEqual(plan.fields.debtLatest.source, undefined, 'ที่มาว่างเปล่าต้องไม่ถูกเก็บ');

  const meta = web.CPD_UPLOAD.commit(plan, {
    before: web.CPD_UPLOAD.captureValues(doc),
    applied: plan.updates,
    env: { state: web.CPD_AppState, document: doc }
  });
  const committed = meta.fields.assetLatest.source;
  assert.deepStrictEqual(
    { file: committed.file, pages: committed.pages, chunk: committed.chunk },
    { file: 'fin.pdf', pages: '1–10', chunk: '2' }
  );
  assert.strictEqual(meta.conflicts, undefined, 'ไม่มีค่าขัดกันต้องไม่เพิ่มฟิลด์ conflicts');
});

test('plan: ค่าขัดกันต้องเตือน เก็บ conflicts และจำกัดขนาด', function () {
  const web = setup();
  const doc = ensureEls(makeDoc({}), allIds(web));
  const conflicts = {
    assetLatest: [
      { value: '1,000.00', file: 'fin.pdf', pages: '1–10' },
      { value: '2,000.00', file: 'other.pdf', pages: '3' }
    ],
    debtLatest: [{ value: 'only-one', file: 'fin.pdf', pages: '1' }]
  };
  for (let i = 0; i < 25; i++) {
    conflicts['field' + i] = [
      { value: 'a' + i, file: 'f.pdf', pages: '1' },
      { value: 'b' + i, file: 'g.pdf', pages: '2' }
    ];
  }

  const plan = web.CPD_UPLOAD.plan({
    assetLatest: '1,000.00',
    _aiConflicts: conflicts
  }, {
    formValues: web.CPD_UPLOAD.captureValues(doc),
    fiscalYear: '2570'
  });

  assert.ok(plan.warnings.join(' | ').indexOf('พบค่าขัดกัน') !== -1);
  assert.ok(plan.conflicts.assetLatest, 'ต้องเก็บค่าที่ขัดกัน');
  assert.strictEqual(plan.conflicts.assetLatest.length, 2);
  assert.strictEqual(plan.conflicts.debtLatest, undefined, 'รายการเดียวไม่ถือว่าขัดกัน');
  assert.ok(Object.keys(plan.conflicts).length <= 20, 'ต้องจำกัดจำนวนฟิลด์ที่ขัดกัน');

  const meta = web.CPD_UPLOAD.commit(plan, {
    before: web.CPD_UPLOAD.captureValues(doc),
    applied: plan.updates,
    env: { state: web.CPD_AppState, document: doc }
  });
  assert.ok(meta.conflicts && meta.conflicts.assetLatest);
  assert.strictEqual(meta.conflicts.assetLatest[1].file, 'other.pdf');
});

test('renderReview แสดงป้ายสีส้มและข้อความให้ตรวจสอบก่อนบันทึก', function () {
  const web = setup();
  const container = {
    innerHTML: '',
    classList: { add: function () {}, remove: function () {} },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; }
  };

  web.CPD_UPLOAD.renderReview({
    warnings: ['ยอดรวมไม่ตรงกับงบดุล'],
    review: [{
      id: 'asset_latest', label: 'สินทรัพย์รวม',
      before: '1,000.00', after: '2,000.00', status: 'conflict'
    }]
  }, container);

  assert.ok(container.innerHTML.indexOf('cpd-confidence-badge') !== -1);
  assert.ok(container.innerHTML.indexOf('พบจุดที่ควรตรวจสอบเพิ่มเติมก่อนบันทึก') !== -1);
  assert.ok(container.innerHTML.indexOf('ยอดรวมไม่ตรงกับงบดุล') !== -1);
  assert.ok(container.innerHTML.indexOf('สินทรัพย์รวม') !== -1);
  assert.ok(container.innerHTML.indexOf('เว้นช่อง') !== -1, 'ต้องบอกว่าระบบไม่เดาตัวเลข');
});

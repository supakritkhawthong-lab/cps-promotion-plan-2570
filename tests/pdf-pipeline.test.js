'use strict';

/**
 * เทสต์ client-side PDF pipeline:
 *   - Markdown formatter
 *   - กรองหน้า (range + ตัดรายงานประชุมปีเก่าท้ายเล่ม)
 *   - scale/quality ของ JPEG
 *   - cache (Markdown + fields, ไม่เก็บ base64)
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadWebScripts } = require('./helpers/sandbox');

const web = loadWebScripts(['web/js/cpd-pdf-pipeline.js']);
const P = web.CPD_PDF_PIPELINE;

function makeState() {
  return CPD_DEFAULT_STATE();
}

// state จำลองที่ใช้เฉพาะในเทสต์นี้ (ไม่ต้องโหลด cpd-state.js)
function CPD_DEFAULT_STATE() {
  return { analysis: { extractedDocs: [] } };
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

test('formatPagesAsMarkdown: แปลงหน้าเป็นหัวข้อ ## หน้า N และทำความสะอาด whitespace', function () {
  const md = P.formatPagesAsMarkdown([
    { page: 2, text: '  งบฐานะการเงิน   ปี 2569\n\n\nรวมสินทรัพย์\t1,000  ' },
    { page: 5, text: 'รายงานผู้สอบบัญชี' }
  ]);
  assert.ok(md.indexOf('## หน้า 2') !== -1);
  assert.ok(md.indexOf('## หน้า 5') !== -1);
  assert.ok(md.indexOf('งบฐานะการเงิน ปี 2569') !== -1);
  assert.ok(md.indexOf('รวมสินทรัพย์ 1,000') !== -1);
  assert.ok(!/\n{3,}/.test(md), 'ต้องไม่มีบรรทัดว่างเกิน 1 บรรทัด');
});

test('formatPagesAsMarkdown: หน้าว่างถูกข้าม และคืน "" ถ้าไม่มีข้อความ', function () {
  assert.strictEqual(P.formatPagesAsMarkdown([{ page: 1, text: '   ' }]), '');
  assert.strictEqual(P.formatPagesAsMarkdown([]), '');
});

test('cleanText: ลบ control character แต่เก็บ newline', function () {
  const cleaned = P.cleanText('ก\r\nข\x00ค\tง');
  assert.strictEqual(cleaned, 'ก\nข ค ง');
});

// ---------------------------------------------------------------------------
// Page range
// ---------------------------------------------------------------------------

test('parsePageRange: รองรับช่วง, เลขเดี่ยว, dash แบบยาว, ตัดออก-of-range และเรียงลำดับ', function () {
  assert.strictEqual(P.parsePageRange('1-3,5,10–12', 12).join(','), '1,2,3,5,10,11,12');
  assert.strictEqual(P.parsePageRange('20-25', 10), null, 'ช่วงที่อยู่นอกจำนวนหน้าทั้งหมด → ไม่เลือกหน้าใด');
  assert.strictEqual(P.parsePageRange('', 10), null);
  assert.strictEqual(P.parsePageRange('abc', 10), null);
});

// ---------------------------------------------------------------------------
// Auto-trim
// ---------------------------------------------------------------------------

test('looksLikeOldMeetingReport: ตรงเฉพาะรายงานประชุมที่มีแต่ปีเก่ากว่าปีงบประมาณ', function () {
  assert.strictEqual(P.looksLikeOldMeetingReport('รายงานการประชุมคณะกรรมการ ปี 2567', 2570), true);
  assert.strictEqual(P.looksLikeOldMeetingReport('รายงานประชุมใหญ่ วันที่ 1 มีนาคม 2568', 2570), true);
  assert.strictEqual(P.looksLikeOldMeetingReport('รายงานการประชุม ปี 2570', 2570), false);
  assert.strictEqual(P.looksLikeOldMeetingReport('งบฐานะการเงิน ปี 2567', 2570), false);
});

test('filterRelevantPages: ตัดรายงานประชุมปีเก่าที่ท้ายเล่มออก และกันหน้ากลางเล่มไว้', function () {
  const pages = [
    { page: 1, text: 'หน้าปก' },
    { page: 2, text: 'งบฐานะการเงิน รวมสินทรัพย์' },
    { page: 3, text: 'งบกำไรขาดทุน ปี 2567' },
    { page: 4, text: 'วาระการประชุม ปี 2568' },
    { page: 5, text: 'รายงานประชุมใหญ่ ปี 2567' }
  ];
  const r = P.filterRelevantPages(pages, { autoTrim: true, planYearBE: 2570 });
  assert.strictEqual(r.included.join(','), '1,2,3', 'หน้า 3 ไม่ใช่รายงานประชุม → ต้องไม่ถูกตัด');
  assert.strictEqual(r.trimmedPages.join(','), '4,5');
  assert.ok(r.trimmed.every(x => x.reason === 'oldMeeting'));
  assert.ok(r.trimmed.every(x => x.text && x.text.length), 'ต้องเก็บข้อความหน้าที่ตัดไว้ให้พรีวิวกดเลือกกลับ');
});

test('filterRelevantPages: autoTrim:false ปิดการตัด; range จำกัดกลุ่มก่อนแล้วค่อย autoTrim', function () {
  const pages = [
    { page: 1, text: 'งบฐานะการเงิน' },
    { page: 2, text: 'รายงานการประชุม ปี 2567' }
  ];
  const keepAll = P.filterRelevantPages(pages, { autoTrim: false, planYearBE: 2570 });
  assert.strictEqual(keepAll.included.join(','), '1,2');

  const ranged = P.filterRelevantPages(pages, {
    range: '1-2', autoTrim: true, planYearBE: 2570
  });
  assert.strictEqual(ranged.rangeApplied, true);
  assert.strictEqual(ranged.included.join(','), '1', ' range จำกัดกลุ่มแล้ว autoTrim ตัดหน้ารายงานประชุมท้ายออก');

  const picked = P.filterRelevantPages(pages, {
    range: '2', autoTrim: false, planYearBE: 2570
  });
  assert.strictEqual(picked.included.join(','), '2', 'ปิด autoTrim then เลือกหน้า 2 ได้ตรงๆ');
});

test('filterRelevantPages: ตีความ relevance โดยไม่บังคับตัดหน้า', function () {
  const r = P.filterRelevantPages([{ page: 1, text: 'งบดุล' }, { page: 2, text: 'หน้าปก' }], {});
  assert.strictEqual(r.pages[0].relevant, true);
  assert.strictEqual(r.pages[1].relevant, false);
  assert.strictEqual(r.included.length, 2);
});

// ---------------------------------------------------------------------------
// JPEG scale / render
// ---------------------------------------------------------------------------

test('computeJpegScale:  Limit width ที่ 1200px และไม่ขยายเกิน scaleCap', function () {
  assert.strictEqual(P.computeJpegScale({ width: 2400 }, {}), 0.5);
  assert.strictEqual(P.computeJpegScale({ width: 600 }, {}), 2, '600px → 2x = 1200px');
  assert.strictEqual(P.computeJpegScale({ width: 300 }, {}), 2, 'ห้ามขยายเกิน 2x แม้จะยังไม่ถึง 1200px');
  assert.strictEqual(P.computeJpegScale({ width: 0 }, {}), 2);
  assert.strictEqual(P.computeJpegScale({ width: 2400 }, { maxWidth: 1000, scaleCap: 1.5 }), 0.4166666666666667);
});

test('computeJpegScale: ค่า maxWidth ที่ผู้ใช้ส่งมาแทนค่าเริ่มต้นได้', function () {
  assert.strictEqual(P.computeJpegScale({ width: 2000 }, { maxWidth: 1000 }), 0.5);
});

test('renderPageToJpeg: ส่ง JPEG base64 พร้อม mimeType image/jpeg', async function () {
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({}),
    toDataURL: function (type, quality) {
      assert.strictEqual(type, 'image/jpeg');
      assert.strictEqual(quality, 0.75);
      return 'data:image/jpeg;base64,SGVsbG8=';
    }
  };
  const fakeDoc = { createElement: () => fakeCanvas };
  const page = {
    getViewport: ({ scale }) => ({ width: 1200 * scale, height: 800 * scale }),
    render: () => ({ promise: Promise.resolve() })
  };
  const out = await P.renderPageToJpeg(page, { document: fakeDoc });
  assert.strictEqual(out.base64, 'SGVsbG8=');
  assert.strictEqual(out.mimeType, 'image/jpeg');
  assert.strictEqual(out.width, 1200);
  assert.strictEqual(out.height, 800);
  assert.strictEqual(out.scale, 1);
});

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

test('cacheDocs: เก็บ Markdown + fields แต่ไม่เก็บ base64', function () {
  const state = makeState();
  const docs = [{
    name: 'report.pdf',
    markdown: '# หน้า 1\nงบฐานะการเงิน',
    fields: { assetLatest: { value: 1000, display: '1,000.00', id: 'asset_latest' } },
    pages: [{ page: 1, base64: 'SECRET' }]
  }];
  P.cacheDocs(state, docs);
  const cached = P.readCachedDocs(state);
  assert.strictEqual(cached.length, 1);
  assert.strictEqual(cached[0].markdown.indexOf('งบฐานะการเงิน') !== -1, true);
  assert.strictEqual(cached[0].fields.assetLatest.value, 1000);
  assert.strictEqual(JSON.stringify(cached).indexOf('SECRET'), -1, 'ต้องไม่มี base64 หลุดลง cache');
});

test('cacheDocs: จำกัดจำนวนเอกสารและ budget รวม แล้วเก็บของใหม่สุดก่อน', function () {
  const state = makeState();
  const docs = [1, 2, 3, 4].map(n => ({
    name: 'doc' + n + '.pdf',
    markdown: 'X'.repeat(1000),
    fields: { k: n }
  }));
  P.cacheDocs(state, docs);
  const cached = P.readCachedDocs(state);
  assert.strictEqual(cached.length, P.MAX_CACHED_DOCS);
  assert.ok(cached.some(d => d.name === 'doc4.pdf'));
  assert.ok(!cached.some(d => d.name === 'doc1.pdf'));
});

test('cacheDocs: ไม่เก็บเอกสารที่ไม่มี markdown', function () {
  const state = makeState();
  P.cacheDocs(state, [{ name: 'scan.pdf', markdown: '', fields: {} }]);
  assert.strictEqual(P.readCachedDocs(state).length, 0);
});

test('mergeCachedFields / getDocumentField / getDocumentSimResult: อ่านจาก cache โดยไม่ยิง API', function () {
  const state = makeState();
  P.cacheDocs(state, [{
    name: 'finance.pdf',
    markdown: '## หน้า 1\nงบฐานะการเงิน',
    fields: {
      assetLatest: { value: 1000, display: '1,000.00' },
      debtLatest: { value: 400, display: '400.00' }
    }
  }]);

  assert.strictEqual(P.getDocumentField(state, 'assetLatest'), '1,000.00');
  assert.strictEqual(P.getDocumentField(state, 'notThere'), '');
  assert.strictEqual(Object.keys(P.mergeCachedFields(state)).sort().join(','), 'assetLatest,debtLatest');

  const sim = P.getDocumentSimResult(state);
  assert.strictEqual(sim.source, 'document');
  assert.strictEqual(sim.hasData, true);
  assert.ok(sim.gapSummaryLines.some(l => l.indexOf('สินทรัพย์รวม (จากเอกสาร)') !== -1));
  assert.strictEqual(sim.easyWins.length, 0, 'ไม่มีข้อมูลคะแนนจากเอกสาร → คง easyWins ให้ master');
});

test('getDocumentSimResult: ไม่มี cache → hasData false', function () {
  const sim = P.getDocumentSimResult(makeState());
  assert.strictEqual(sim.hasData, false);
  assert.strictEqual(sim.gapSummaryLines.length, 0);
});

test('getDocumentCrossCheck: อ่านค่าจาก cache โดยไม่ยิง API และคำนวณผลต่างสมการบัญชี', function () {
  const state = makeState();
  P.cacheDocs(state, [{
    name: 'finance.pdf',
    markdown: '## หน้า 1\nงบฐานะการเงิน',
    fields: {
      assetLatest: { value: 1000, display: '1,000.00' },
      debtLatest: { value: 400, display: '400.00' },
      shareLatest: { value: 500, display: '500.00' },
      profitLatest: { value: 100, display: '100.00' },
      lossLatest: { value: '(50)', display: '(50.00)' }
    }
  }]);

  const check = P.getDocumentCrossCheck(state);
  assert.strictEqual(check.source, 'cache');
  assert.strictEqual(check.hasData, true);
  assert.strictEqual(check.values.asset_latest.number, 1000);
  assert.strictEqual(check.values.loss_latest.number, -50);
  assert.strictEqual(check.asset, 1000);
  // 400 + 500 + 100 - 50 = 950
  assert.strictEqual(check.liabilitiesAndEquity, 950);
  assert.strictEqual(check.difference, 50);
  assert.ok(check.lines.some(l => l.indexOf('สินทรัพย์: 1,000.00') !== -1));
});

test('getDocumentCrossCheck: ไม่มี cache → hasData false (ไม่ยิง API)', function () {
  const check = P.getDocumentCrossCheck(makeState());
  assert.strictEqual(check.source, 'cache');
  assert.strictEqual(check.hasData, false);
  assert.strictEqual(check.difference, null);
});

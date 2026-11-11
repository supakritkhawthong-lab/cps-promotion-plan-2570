'use strict';

/**
 * เทสต์การแบ่งคำขอ AI เป็น 3 ระยะ (facts → narrative → summary)
 * - responseSchema ต้องครอบคลุมทุกฟิลด์ที่ prompt เดิมขอ
 * - ถ้าระยะ 2/3 ล้ม ต้องยังคืนผลระยะ 1 พร้อม _aiWarnings
 * - ถ้าโมเดลไม่รองรับ responseSchema (HTTP 400) ต้องลองใหม่แบบไม่ใส่ schema
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  loadGasStaged,
  extractPromptFactKeys
} = require('./helpers/sandbox');

const NARRATIVE_FIELDS = ['orgAnalysis4M', 'businessAnalysis', 'welfareAnalysis', 'summaryAnalysis'];

function basePayload() {
  return {
    coopName: 'สหกรณ์ทดสอบ จำกัด',
    coopCategoryName: 'สหกรณ์การเกษตร',
    dbFiscalYear: '2570',
    weaknesses: ['ทุนสำรองต่ำ'],
    score68: { level: 'ดี', total: 80 },
    score69: { level: 'ดีมาก', total: 88 },
    plannedVisits: 4,
    files: [
      {
        name: 'งบการเงิน.pdf',
        category: 'งบการเงิน/รายงานสอบบัญชี',
        extractedText: 'สินทรัพย์รวม 1,000,000 บาท'
      },
      { name: 'scan.pdf', category: 'ไฟล์อื่นๆ', base64: 'AAAA', mimeType: 'application/pdf' }
    ]
  };
}

test('responseSchema ของระยะ facts ครอบคลุมทุกฟิลด์จาก prompt เดิม', function () {
  const gas = loadGasStaged({});
  const schema = gas.buildFactResponseSchema_();
  const promptKeys = extractPromptFactKeys();
  const expected = promptKeys.filter(function (key) { return NARRATIVE_FIELDS.indexOf(key) === -1; });
  const actual = Object.keys(schema.properties);

  assert.strictEqual(promptKeys.length, 110, 'prompt เดิมต้องมี 110 ฟิลด์');
  assert.strictEqual(expected.length, 106, 'ฟิลด์ที่เป็นตัวเลข/ข้อเท็จจริงต้องมี 106 ฟิลด์');
  assert.deepStrictEqual(actual.filter(function (key) { return expected.indexOf(key) === -1; }), [], 'ต้องไม่มีฟิลด์เกิน');
  assert.deepStrictEqual(expected.filter(function (key) { return actual.indexOf(key) === -1; }), [], 'ต้องไม่มีฟิลด์ตกหล่น');
  assert.strictEqual(new Set(actual).size, actual.length, 'ต้องไม่มีฟิลด์ซ้ำ');
});

test('responseSchema ใช้ชนิดข้อมูลถูกต้อง', function () {
  const gas = loadGasStaged({});
  const schema = gas.buildFactResponseSchema_();
  const numberFields = ['assetNumeric', 'recommendedVisits'];
  const booleanFields = ['auditorInternalControlWeakness'];
  const arrayFields = ['auditorWeaknessCategories', 'businessSegments'];
  const objectFields = ['changes'];

  Object.keys(schema.properties).forEach(function (key) {
    const expected = numberFields.indexOf(key) !== -1 ? 'NUMBER'
      : booleanFields.indexOf(key) !== -1 ? 'BOOLEAN'
        : arrayFields.indexOf(key) !== -1 ? 'ARRAY'
          : objectFields.indexOf(key) !== -1 ? 'OBJECT'
            : 'STRING';
    assert.strictEqual(schema.properties[key].type, expected, 'ชนิดข้อมูลของ ' + key);
  });

  const changeKeys = gas.AI_CHANGE_KEYS_;
  assert.deepStrictEqual(Object.keys(schema.properties.changes.properties).sort(), changeKeys.slice().sort());
  assert.strictEqual(changeKeys.length, 24, 'changes ต้องมี 24 คีย์');
});

test('ระยะ facts → narrative → summary ทำงานครบและคืนผลรวม', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') {
        return {
          assetLatest: '1,000,000.00',
          cashLatest: '1,000,000.00',
          changes: { cash: 'เพิ่มขึ้น 100,000.00' },
          fiscalDateFull: '31 มี.ค. 68',
          auditorObservations: 'ไม่พบข้อสังเกต',
          businessSegments: [{ name: 'เงินให้กู้', revenue: 10, cost: 5, profit: 5, note: 'ok' }]
        };
      }
      if (call.stage === 'narrative') {
        return { orgAnalysis4M: 'ORG', businessAnalysis: 'BIZ', welfareAnalysis: 'WEL' };
      }
      if (call.stage === 'summary') {
        return { summaryAnalysis: 'SUM' };
      }
      throw new Error('ไม่คาดคิดระยะ: ' + call.stage);
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(basePayload());

  assert.strictEqual(gas.calls.length, 3);
  assert.deepStrictEqual(gas.calls.map(function (call) { return call.stage; }), ['facts', 'narrative', 'summary']);
  assert.strictEqual(result.assetLatest, '1,000,000.00');
  assert.strictEqual(result.businessSegments.length, 1);
  assert.strictEqual(result.fiscalDateFull, '31 มีนาคม', 'ต้องแปลงวันที่เป็นชื่อเดือนเต็ม');
  assert.strictEqual(result.cashPrev, '900,000.00', 'ต้องคำนวณยอดปีก่อนจากข้อความ changes');
  assert.strictEqual(result.orgAnalysis4M, 'ORG');
  assert.strictEqual(result.businessAnalysis, 'BIZ');
  assert.strictEqual(result.welfareAnalysis, 'WEL');
  assert.strictEqual(result.summaryAnalysis, 'SUM');
  assert.strictEqual(result._aiWarnings, undefined, 'เมื่อทุกระยะสำเร็จต้องไม่มีคำเตือน');
});

test('ระยะ narrative ตัด inlineData ออก แต่ระยะ facts ยังส่งไฟล์แนบ', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '1.00' };
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });
  gas.analyzeUploadedFilesWithAI(basePayload());

  const facts = gas.calls.filter(function (call) { return call.stage === 'facts'; })[0];
  const narrative = gas.calls.filter(function (call) { return call.stage === 'narrative'; })[0];
  const factsParts = facts.body.contents[0].parts;
  const narrativeParts = narrative.body.contents[0].parts;

  assert.ok(factsParts.some(function (part) { return !!part.inlineData; }), 'ระยะ facts ต้องยังเห็นไฟล์สแกน');
  assert.ok(!narrativeParts.some(function (part) { return !!part.inlineData; }), 'ระยะ narrative ต้องไม่ส่งไฟล์แนบ');
  assert.ok(narrative.promptText.indexOf('ข้อมูลที่สกัดได้จากรอบแรก') !== -1, 'ระยะ narrative ต้องได้รับตัวเลขจากระยะแรก');
});

test('ระยะ summary ได้รับบทวิเคราะห์ 1-3 และไม่ส่งไฟล์ต้นฉบับ', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '1.00' };
      if (call.stage === 'narrative') {
        return { orgAnalysis4M: 'ORG-TEXT', businessAnalysis: 'BIZ-TEXT', welfareAnalysis: 'WEL-TEXT' };
      }
      return { summaryAnalysis: 'SUM' };
    }
  });
  gas.analyzeUploadedFilesWithAI(basePayload());

  const summary = gas.calls.filter(function (call) { return call.stage === 'summary'; })[0];
  assert.ok(summary.promptText.indexOf('ORG-TEXT') !== -1);
  assert.ok(summary.promptText.indexOf('BIZ-TEXT') !== -1);
  assert.ok(summary.promptText.indexOf('WEL-TEXT') !== -1);
  assert.ok(!summary.body.contents[0].parts.some(function (part) { return !!part.inlineData; }));
});

test('ระยะ narrative ล้มเหลว → ยังได้ตัวเลขและสรุป พร้อม _aiWarnings', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '2,000,000.00' };
      if (call.stage === 'narrative') return { status: 500, body: 'boom' };
      if (call.stage === 'summary') return { summaryAnalysis: 'SUM-ONLY' };
      throw new Error('ไม่คาดคิดระยะ: ' + call.stage);
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(basePayload());
  assert.strictEqual(result.assetLatest, '2,000,000.00');
  assert.strictEqual(result.orgAnalysis4M, undefined);
  assert.strictEqual(result.summaryAnalysis, 'SUM-ONLY');
  assert.ok(Array.isArray(result._aiWarnings) && result._aiWarnings.length === 1);
  assert.ok(result._aiWarnings[0].indexOf('หัวข้อ 1-3') !== -1);
});

test('โมเดลไม่รองรับ responseSchema (400) → ลองใหม่แบบไม่ใส่ schema', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts' && call.hasSchema) return { status: 400, body: 'schema not supported' };
      if (call.stage === 'facts') return { assetLatest: '3,000,000.00' };
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(basePayload());
  assert.strictEqual(result.assetLatest, '3,000,000.00');
  assert.ok(gas.calls.some(function (call) { return call.stage === 'facts' && !call.hasSchema; }),
    'ต้องมีคำขอแบบ plain หลัง schema ถูกปฏิเสธ');
});

test('ระยะ facts ล้มเหลว → ทั้งงานล้มเหลวพร้อมข้อความภาษาไทย', function () {
  const gas = loadGasStaged({
    responder: function () { return { status: 500, body: 'boom' }; }
  });

  assert.throws(
    function () { gas.analyzeUploadedFilesWithAI(basePayload()); },
    function (err) { return err.message.indexOf('AI ประมวลผลไม่สำเร็จ') !== -1; }
  );
});

test('capTextParts_ จำกัดขนาดข้อความรวมและกระจายเพดานให้ทุกไฟล์', function () {
  const gas = loadGasStaged({});
  const big = new Array(60001).join('ก');
  const parts = [
    { text: 'prompt' },
    { text: big },
    { text: big },
    { text: big },
    { inlineData: { mimeType: 'application/pdf', data: 'AAAA' } }
  ];
  const capped = gas.capTextParts_(parts, 90000);
  const textParts = capped.filter(function (part) { return typeof part.text === 'string'; });
  const total = textParts.reduce(function (sum, part) { return sum + part.text.length; }, 0);

  assert.strictEqual(textParts.length, 4, 'ต้องคง prompt + ข้อความจาก 3 ไฟล์');
  assert.ok(!capped.some(function (part) { return !!part.inlineData; }), 'ต้องตัด inlineData ออก');
  assert.ok(total <= 90000 + 3 * 40, 'ขนาดรวมต้องไม่เกินเพดาน (บวกข้อความแจ้งการตัด)');
  textParts.slice(1).forEach(function (part) {
    assert.ok(part.text.indexOf('ตัดข้อความเพื่อจำกัดขนาด') !== -1, 'ไฟล์ที่ถูกตัดต้องมีข้อความแจ้ง');
  });
});

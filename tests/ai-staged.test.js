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

test('responseSchema บังคับฟิลด์วิกฤตและอธิบายฟิลด์ที่สับสนบ่อย', function () {
  const gas = loadGasStaged({});
  const schema = gas.buildFactResponseSchema_();
  const required = schema.required || [];

  gas.AI_CRITICAL_FACT_KEYS_.forEach(function (key) {
    assert.ok(required.indexOf(key) !== -1, 'ต้องบังคับให้ส่งฟิลด์ ' + key);
  });
  assert.ok(String(schema.properties.assetLatest.description || '').indexOf('Total Assets') !== -1,
    'assetLatest ต้องมีคำอธิบายกันสับสนกับ wcLatest');
  assert.ok(String(schema.properties.wcLatest.description || '').indexOf('สินทรัพย์') === -1,
    'wcLatest ต้องไม่อธิบายว่าเป็นยอดสินทรัพย์');

  const subset = gas.buildFactSubsetSchema_(['assetLatest', 'debtLatest', 'unknownField']);
  assert.deepStrictEqual(subset.required, ['assetLatest', 'debtLatest'],
    'schema ของรอบอ่านซ้ำต้องบังคับเฉพาะฟิลด์ที่ขอ');
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

test('ปิด thinking ของทุกโมเดลเป็นค่าเริ่มต้น และย้อนกลับได้ด้วย AI_THINKING_BUDGET=-1', function () {
  const gas = loadGasStaged({});
  const g4 = gas.buildGeminiRequestBody_([{ text: 'x' }], null, 'gemini-4-hydrogen');
  assert.deepStrictEqual(g4.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.strictEqual(g4.generationConfig.maxOutputTokens, 8192, 'ห้ามเปลี่ยนเพดาน token เดิม');

  const g3 = gas.buildGeminiRequestBody_([{ text: 'x' }], null, 'gemini-3.8-flash');
  assert.deepStrictEqual(g3.generationConfig.thinkingConfig, { thinkingBudget: 0 },
    'รุ่น 3.x ก็ต้องปิด thinking เพราะเป็นเวลาที่ไม่โผล่ในคำตอบ');

  const off = loadGasStaged({ props: { AI_THINKING_BUDGET: '-1' } });
  const g3off = off.buildGeminiRequestBody_([{ text: 'x' }], null, 'gemini-3.8-flash');
  assert.strictEqual(g3off.generationConfig.thinkingConfig, undefined, 'ตั้ง -1 ต้องไม่ส่ง thinkingConfig');
});

test('เพดาน token ขาออกต่อระยะไม่เกิน GEMINI_MAX_OUTPUT_TOKENS', function () {
  const gas = loadGasStaged({});
  const capped = gas.buildGeminiRequestBody_([{ text: 'x' }], null, 'gemini-3.8-flash', 4096);
  assert.strictEqual(capped.generationConfig.maxOutputTokens, 4096);

  const tooHigh = gas.buildGeminiRequestBody_([{ text: 'x' }], null, 'gemini-3.8-flash', 99999);
  assert.strictEqual(tooHigh.generationConfig.maxOutputTokens, 8192, 'ห้ามเกินเพดานกลาง');
});

test('ถ้าโมเดลไม่รับ thinkingConfig ต้องลองใหม่โดยไม่ส่งค่านี้ (ไม่ให้ระยะล้ม)', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      const cfg = call.body.generationConfig || {};
      if (cfg.thinkingConfig) {
        return { status: 400, body: '{"error":{"message":"thinking_config is not supported for this model"}}' };
      }
      return { assetLatest: '1.00' };
    }
  });

  const res = gas.callGeminiJson_([{ text: 'x' }], null, 'facts', Date.now() + 200000, Date.now());
  assert.strictEqual(res.assetLatest, '1.00');
  const sentThinking = gas.calls.map(function (call) {
    return !!call.body.generationConfig.thinkingConfig;
  });
  assert.deepStrictEqual(sentThinking, [true, false], 'ครั้งแรกส่ง thinking ครั้งที่สองต้องไม่ส่ง');
});

test('ต้องไม่นำ part ที่เป็น thinking (thought=true) มารวมเป็นคำตอบ', function () {
  const gas = loadGasStaged({
    responder: function () {
      return {
        __raw: {
          candidates: [{
            content: {
              parts: [
                { text: '{"assetLatest":"WRONG"}', thought: true },
                { text: '{"assetLatest":"1.00"}' }
              ]
            },
            finishReason: 'STOP'
          }],
          usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 12, thoughtsTokenCount: 640 }
        }
      };
    }
  });

  const res = gas.callGeminiJson_([{ text: 'x' }], null, 'facts', Date.now() + 200000, Date.now());
  assert.strictEqual(res.assetLatest, '1.00', 'ต้องได้คำตอบจริง ไม่ใช่ข้อความจากการคิด');
});

test('คำตอบถูกตัดเพราะ token เต็ม ต้องลองใหม่ด้วยเพดานเต็มและไม่ส่ง thinking', function () {
  let first = true;
  const gas = loadGasStaged({
    props: { AI_MAX_TOKENS_FACTS: '4096' },
    responder: function () {
      if (first) {
        first = false;
        return {
          __raw: {
            candidates: [{
              content: { parts: [{ text: '{"assetLatest":"1.' }] },
              finishReason: 'MAX_TOKENS'
            }],
            usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 4096 }
          }
        };
      }
      return { assetLatest: '1.00' };
    }
  });

  const res = gas.callGeminiJson_([{ text: 'x' }], null, 'facts', Date.now() + 200000, Date.now());
  assert.strictEqual(res.assetLatest, '1.00');
  assert.strictEqual(gas.calls.length, 2, 'ต้องลองซ้ำหนึ่งครั้ง');
  assert.strictEqual(gas.calls[1].body.generationConfig.maxOutputTokens, 8192,
    'รอบลองใหม่ต้องใช้เพดานกลางเต็ม');
  assert.strictEqual(gas.calls[1].body.generationConfig.thinkingConfig, undefined,
    'รอบลองใหม่ต้องไม่ส่ง thinkingConfig');
});

test('ถ้าเวลาไม่พอ ต้องไม่เริ่มเรียกโมเดลเลย', function () {
  const gas = loadGasStaged({});
  assert.throws(function () {
    gas.callGeminiJson_([{ text: 'x' }], null, 'facts', Date.now() - 1, Date.now());
  }, /หมดเวลา/);
  assert.strictEqual(gas.calls.length, 0, 'ต้องไม่ยิง request เมื่อเลย deadline');
});

test('maxRequests จำกัดคำขอต่อชุดสแกน ไม่ให้ 429 กินเวลาทั้งระยะ', function () {
  const gas = loadGasStaged({
    props: { GEMINI_MODELS: 'gemini-a,gemini-b' },
    responder: function () { return { status: 429, body: 'queue full' }; }
  });

  assert.throws(function () {
    gas.callGeminiJson_([{ text: 'x' }], null, 'facts', Date.now() + 200000, Date.now(),
      { maxRequests: 2 });
  }, /AI ประมวลผลไม่สำเร็จ/);
  assert.strictEqual(gas.calls.length, 2, 'ต้องยิง request ไม่เกินเพดานที่ส่งมา');
});

test('เวลาใกล้หมดต้องหยุดไล่โมเดล ไม่ยิงซ้ำจนชนเพดาน 6 นาที', function () {
  const gas = loadGasStaged({
    responder: function () { return { status: 500 }; }
  });
  assert.throws(function () {
    gas.callGeminiJson_([{ text: 'x' }], null, 'narrative', Date.now() + 10000, Date.now());
  }, /หยุดไล่โมเดลเพราะเวลาใกล้หมด/);
  assert.strictEqual(gas.calls.length, 0, 'ต้องไม่เริ่ม request ที่ไม่มีเวลาให้จบ');
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

test('ถ้าเวลาที่เหลือไม่พอ ต้องข้ามบทวิเคราะห์และคืนผลระยะ facts พร้อมคำเตือน', function () {
  const gas = loadGasStaged({
    // Hard limit is already exceeded, so no further stage may start.
    props: { AI_HARD_LIMIT_MS: '1' },
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '1,000,000.00' };
      throw new Error('ต้องไม่เรียกระยะ: ' + call.stage);
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(basePayload());

  assert.deepStrictEqual(gas.calls.map(function (call) { return call.stage; }), ['facts'],
    'ต้องเรียกเฉพาะระยะ facts');
  assert.strictEqual(result.assetLatest, '1,000,000.00', 'ต้องยังคืนผลระยะ facts');
  assert.strictEqual(result.orgAnalysis4M, undefined, 'ต้องไม่มีบทวิเคราะห์');
  assert.strictEqual(result.summaryAnalysis, undefined, 'ต้องไม่มีบทสรุป');
  const warnings = String((result._aiWarnings || []).join(' '));
  assert.ok(warnings.indexOf('ข้ามบทวิเคราะห์หัวข้อ 1-3') !== -1, 'ต้องเตือนว่าข้ามหัวข้อ 1-3');
  assert.ok(warnings.indexOf('ข้ามบทวิเคราะห์หัวข้อ 4') !== -1, 'ต้องเตือนว่าข้ามหัวข้อ 4');
});

test('_aiTrace เก็บ finishReason และ outputChars ของแต่ละระยะ', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '1.00' };
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });

  const trace = gas.analyzeUploadedFilesWithAI(basePayload())._aiTrace;

  assert.strictEqual(trace.length, 3, 'ต้องมี trace ครบ 3 ระยะ');
  trace.forEach(function (entry) {
    assert.strictEqual(entry.finishReason, 'STOP', 'ต้องบันทึก finishReason');
    assert.ok(entry.outputChars > 0, 'ต้องบันทึกจำนวนตัวอักษรที่ได้');
  });
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

// ---------------------------------------------------------------------------
// Phase 1B: evidence windows + targeted repair
// ---------------------------------------------------------------------------

function payloadWithEvidence() {
  const payload = basePayload();
  payload.files[0].evidenceText =
    '[หลักฐานจากหน้า 45] (ทุนสำรอง) ทุนสำรอง 1,234.56 EVIDENCE_MARKER';
  return payload;
}

test('ระยะ facts ได้รับ evidenceText แต่ narrative ต้องไม่ได้รับ', function () {
  const gas = loadGasStaged({
    props: { AI_TARGETED_REPAIR: '0' },
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '1.00' };
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });

  gas.analyzeUploadedFilesWithAI(payloadWithEvidence());

  const facts = gas.calls.filter(function (call) { return call.stage === 'facts'; })[0];
  const narrative = gas.calls.filter(function (call) { return call.stage === 'narrative'; })[0];

  assert.ok(facts.promptText.indexOf('EVIDENCE_MARKER') !== -1, 'ระยะ facts ต้องเห็นหลักฐานเสริม');
  assert.ok(facts.promptText.indexOf('หลักฐานเสริมจากหน้าที่ไม่ได้ส่งทั้งหน้า') !== -1);
  assert.ok(narrative.promptText.indexOf('EVIDENCE_MARKER') === -1, 'ระยะ narrative ไม่ต้องส่งหลักฐานซ้ำ');
});

test('capEvidenceParts_: จำกัดหลักฐานต่อไฟล์และรวมทุกไฟล์', function () {
  const gas = loadGasStaged({
    props: {
      AI_TARGETED_REPAIR: '0',
      AI_EVIDENCE_PER_FILE_CHARS: '300',
      AI_EVIDENCE_MAX_CHARS: '500'
    },
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '1.00' };
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });

  const payload = payloadWithEvidence();
  payload.files[0].evidenceText = 'START' + new Array(2001).join('ก') + 'END';
  gas.analyzeUploadedFilesWithAI(payload);

  const facts = gas.calls.filter(function (call) { return call.stage === 'facts'; })[0];
  assert.ok(facts.promptText.indexOf('START') !== -1);
  assert.ok(facts.promptText.indexOf('END') === -1, 'หลักฐานท้ายไฟล์ต้องถูกตัด');
  assert.ok(facts.promptText.indexOf('ตัดหลักฐานเพื่อจำกัดขนาด') !== -1);
});

test('repair: อ่านซ้ำเฉพาะฟิลด์วิกฤตที่ขาด และไม่ทับค่าที่มีอยู่', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') {
        return { assetLatest: '1,000.00', fiscalDateFull: '31 มี.ค. 68' };
      }
      if (call.stage === 'repair') {
        return {
          assetLatest: '9,999.00',
          debtLatest: '400.00',
          shareLatest: '500.00',
          reserveLatest: '100.00',
          yrLatest: 'ธ.ค. 68'
        };
      }
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(payloadWithEvidence());

  assert.deepStrictEqual(
    gas.calls.map(function (call) { return call.stage; }),
    ['facts', 'repair', 'narrative', 'summary'],
    'ต้องมีรอบ repair หลัง facts'
  );
  const repair = gas.calls.filter(function (call) { return call.stage === 'repair'; })[0];
  assert.ok(repair.promptText.indexOf('EVIDENCE_MARKER') !== -1, 'repair ต้องใช้หลักฐานเสริม');
  assert.ok(repair.promptText.indexOf('debtLatest = ยอดรวมหนี้สินปีล่าสุด') !== -1);
  assert.ok(repair.promptText.indexOf('ซ่อมข้อมูลที่ยังขาด') !== -1);
  assert.ok(repair.hasSchema, 'repair ต้องมี responseSchema เฉพาะฟิลด์');
  assert.strictEqual(repair.body.generationConfig.responseSchema.properties.changes, undefined);

  assert.strictEqual(result.assetLatest, '1,000.00', 'ห้ามทับค่าที่มีอยู่แล้ว');
  assert.strictEqual(result.debtLatest, '400.00');
  assert.strictEqual(result.shareLatest, '500.00');
  assert.strictEqual(result.reserveLatest, '100.00');
  assert.strictEqual(result.yrLatest, 'ธ.ค. 68');
  assert.strictEqual(result.fiscalDateFull, '31 มีนาคม');
  assert.strictEqual(result._aiWarnings, undefined);
  assert.strictEqual(result._aiFieldSources.debtLatest.file, 'หลักฐานเสริม (อ่านซ้ำ)',
    'ฟิลด์ที่ได้จากการอ่านซ้ำต้องมีที่มา');
});

test('repair: ถ้าอ่านซ้ำล้มเหลว งานยังสำเร็จพร้อม _aiWarnings', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '2,000.00' };
      if (call.stage === 'repair') return { status: 500, body: 'repair boom' };
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(payloadWithEvidence());

  assert.strictEqual(result.assetLatest, '2,000.00');
  assert.strictEqual(result.summaryAnalysis, 'S');
  assert.ok(Array.isArray(result._aiWarnings) && result._aiWarnings.length === 1);
  assert.ok(result._aiWarnings[0].indexOf('อ่านซ้ำเฉพาะฟิลด์ที่ขาด') !== -1);
});

test('repair: ไม่มี evidenceText → ไม่เรียกซ้ำ', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      if (call.stage === 'facts') return { assetLatest: '3,000.00' };
      if (call.stage === 'narrative') return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      return { summaryAnalysis: 'S' };
    }
  });

  gas.analyzeUploadedFilesWithAI(basePayload());
  assert.ok(!gas.calls.some(function (call) { return call.stage === 'repair'; }));
});

test('mergeRepairFacts_: เติมเฉพาะฟิลด์ที่ขาด และไม่รับ "-"', function () {
  const gas = loadGasStaged({});
  const facts = { assetLatest: '1,000.00', debtLatest: '-' };
  const merged = gas.mergeRepairFacts_(facts, {
    assetLatest: '9,999.00',
    debtLatest: '400.00',
    shareLatest: '-'
  }, ['assetLatest', 'debtLatest', 'shareLatest']);

  assert.strictEqual(facts.assetLatest, '1,000.00', 'ค่าที่มีอยู่ต้องไม่ถูกทับ');
  assert.strictEqual(facts.debtLatest, '400.00');
  assert.strictEqual(facts.shareLatest, undefined, 'ค่า "-" ต้องไม่ถูกเติม');
  assert.ok(merged.debtLatest);
  assert.strictEqual(merged.assetLatest, undefined);
});

test('findMissingCriticalFacts_: แยกค่าว่าง/ขีด/ศูนย์ และตรวจฟิลด์วิกฤต', function () {
  const gas = loadGasStaged({});
  const missing = gas.findMissingCriticalFacts_({
    assetLatest: '0.00',
    assetPrev: '-',
    debtLatest: '',
    shareLatest: 'ไม่พบข้อมูล',
    reserveLatest: '500.00'
  });
  assert.ok(missing.indexOf('assetPrev') !== -1);
  assert.ok(missing.indexOf('debtLatest') !== -1);
  assert.ok(missing.indexOf('shareLatest') !== -1);
  assert.ok(missing.indexOf('assetLatest') === -1, 'ศูนย์จริงต้องไม่ถือว่าขาด');
  assert.ok(missing.indexOf('reserveLatest') === -1);
  assert.strictEqual(gas.AI_CRITICAL_FACT_KEYS_.length, 19);
});

// ---------------------------------------------------------------------------
// Phase 1C: chunked facts + merge + provenance
// ---------------------------------------------------------------------------

function pageBlock(fileName, pageCount, charsPerPage) {
  const filler = 'ข้อมูล '.repeat(Math.ceil((charsPerPage || 1200) / 7));
  return Array.from({ length: pageCount }, function (_, i) {
    return '[หน้า ' + (i + 1) + '] ' + fileName + ' หน้า ' + (i + 1) + ' ' + filler;
  }).join('\n');
}

function chunkPayload() {
  return {
    coopName: 'สหกรณ์ทดสอบ จำกัด',
    coopCategoryName: 'สหกรณ์การเกษตร',
    dbFiscalYear: '2570',
    weaknesses: [],
    score68: { level: 'ดี', total: 80 },
    score69: { level: 'ดีมาก', total: 88 },
    plannedVisits: 4,
    files: [
      {
        name: 'fin.pdf',
        category: 'งบการเงิน/รายงานสอบบัญชี',
        extractedText: pageBlock('fin.pdf', 10, 1200)
      },
      {
        name: 'other.pdf',
        category: 'ไฟล์อื่นๆ',
        extractedText: pageBlock('other.pdf', 10, 1200)
      }
    ]
  };
}

test('splitFileToPageUnits_: แยกหน่วยหน้าจาก marker [หน้า N]', function () {
  const gas = loadGasStaged({});
  const units = gas.splitFileToPageUnits_('[หน้า 1] หนึ่ง\n[หน้า 3] สาม');
  assert.strictEqual(units.length, 2);
  assert.strictEqual(units[0].page, 1);
  assert.strictEqual(units[0].text, 'หนึ่ง');
  assert.strictEqual(units[1].page, 3);
  assert.strictEqual(units[1].text, 'สาม');
  assert.deepStrictEqual(gas.splitFileToPageUnits_('ไม่มี marker'), [{ page: 0, text: 'ไม่มี marker' }]);
  assert.deepStrictEqual(gas.splitFileToPageUnits_(''), []);
});

test('buildFactChunks_: แบ่งตามช่วงหน้า ครอบทุกหน้า และไม่ผสมไฟล์ในรอบเดียว', function () {
  const gas = loadGasStaged({});
  const files = [
    { name: 'annual.pdf', category: 'งบการเงิน/รายงานสอบบัญชี', extractedText: pageBlock('annual.pdf', 12, 1000) },
    { name: 'profile.pdf', category: 'ข้อมูลพื้นฐาน', extractedText: pageBlock('profile.pdf', 4, 1000) }
  ];

  const chunks = gas.buildFactChunks_(files, {
    thresholdChars: 1000,
    targetChars: 4000,
    maxChunks: 20
  });

  assert.ok(chunks.length > 1, 'ต้องแบ่งหลายช่วง');
  chunks.forEach(function (chunk) {
    assert.ok(chunk.file === 'annual.pdf' || chunk.file === 'profile.pdf');
    assert.ok(chunk.chars <= 4000 + 1100, 'ช่วงต้องไม่เกินเพดาน (บวกหน้าเดียวยาวสุด)');
    const pages = Array.from(chunk.pageText.matchAll(/\[หน้า (\d+)\]/g)).map(function (m) {
      return Number(m[1]);
    });
    assert.strictEqual(pages[0], chunk.pagesFrom);
    assert.strictEqual(pages[pages.length - 1], chunk.pagesTo);
    assert.ok(!chunk.pageText.includes('annual.pdf') || !chunk.pageText.includes('profile.pdf'),
      'ห้ามผสมสองไฟล์ในรอบเดียว');
  });

  const covered = chunks.reduce(function (acc, chunk) {
    chunk.pageText.match(/\[หน้า (\d+)\]/g).forEach(function (marker) {
      acc.push(chunk.file + ':' + marker);
    });
    return acc;
  }, []).sort();
  const expected = [];
  for (let p = 1; p <= 12; p++) expected.push('annual.pdf:[หน้า ' + p + ']');
  for (let p = 1; p <= 4; p++) expected.push('profile.pdf:[หน้า ' + p + ']');
  assert.deepStrictEqual(covered.sort(), expected.sort(), 'ต้องครอบทุกหน้า');

  assert.deepStrictEqual(
    gas.buildFactChunks_([{ name: 'small.pdf', extractedText: '[หน้า 1] สั้น' }], {}),
    [],
    'ข้อความรวมไม่ถึงเพดานต้องไม่แบ่งช่วง'
  );
});

test('mergeFactResults_: ไฟล์ที่น่าเชื่อถือกว่าชนะ และบันทึกที่มา/ค่าขัดกัน', function () {
  const gas = loadGasStaged({});
  const merged = gas.mergeFactResults_([
    {
      facts: { assetLatest: '1,000.00', debtLatest: '500.00' },
      source: { file: 'fin.pdf', pagesFrom: 1, pagesTo: 10, index: 1 },
      rank: 5,
      index: 1
    },
    {
      facts: { assetLatest: '2,000.00', debtLatest: '500', cashLatest: '77.00' },
      source: { file: 'other.pdf', pagesFrom: 1, pagesTo: 5, index: 2 },
      rank: 1,
      index: 2
    }
  ]);

  assert.strictEqual(merged.facts.assetLatest, '1,000.00', 'งบการเงินต้องชนะไฟล์อื่น');
  assert.strictEqual(merged.facts.debtLatest, '500.00', 'ค่าเดียวกัน (500 กับ 500.00) ไม่ถือว่าขัดกัน');
  assert.strictEqual(merged.facts.cashLatest, '77.00');
  assert.strictEqual(merged.sources.assetLatest.file, 'fin.pdf');
  assert.strictEqual(merged.sources.assetLatest.pages, '1–10');
  assert.strictEqual(merged.conflicts.debtLatest, undefined);
  assert.strictEqual(merged.conflicts.assetLatest.length, 2);
  assert.strictEqual(merged.conflicts.assetLatest[1].file, 'other.pdf');
});

test('analyze: เอกสารใหญ่ถูกแบ่งช่วง อ่านครบ และรวมผลพร้อม provenance', function () {
  const gas = loadGasStaged({
    props: {
      AI_CHUNK_THRESHOLD_CHARS: '5000',
      AI_CHUNK_TARGET_CHARS: '6000',
      AI_TARGETED_REPAIR: '0'
    },
    responder: function (call) {
      if (call.stage === 'facts') {
        if (call.promptText.indexOf('fin.pdf') !== -1) {
          return { assetLatest: '1,000.00', debtLatest: '500.00' };
        }
        return { assetLatest: '2,000.00', debtLatest: '500.00', cashLatest: '77.00' };
      }
      if (call.stage === 'narrative') {
        return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      }
      return { summaryAnalysis: 'S' };
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(chunkPayload());
  const factsCalls = gas.calls.filter(function (call) { return call.stage === 'facts'; });

  assert.ok(factsCalls.length >= 2, 'ต้องเรียก facts มากกว่าหนึ่งช่วง');
  factsCalls.forEach(function (call) {
    const hasFin = call.promptText.indexOf('fin.pdf') !== -1;
    const hasOther = call.promptText.indexOf('other.pdf') !== -1;
    assert.ok(!(hasFin && hasOther), 'แต่ละช่วงต้องมีไฟล์เดียว');
  });

  assert.strictEqual(result.assetLatest, '1,000.00', 'ค่าจากงบการเงินต้องชนะ');
  assert.strictEqual(result.debtLatest, '500.00');
  assert.strictEqual(result.cashLatest, '77.00');
  assert.ok(result._aiChunks >= 2);
  assert.strictEqual(result._aiFieldSources.assetLatest.file, 'fin.pdf');
  assert.strictEqual(result._aiConflicts.assetLatest.length, 2);
  assert.strictEqual(result._aiWarnings, undefined);
});

test('analyze: ช่วงที่ล้มเหลวไม่ทำให้งานล้มทั้งก้อน และเตือนผู้ใช้', function () {
  const gas = loadGasStaged({
    props: {
      AI_CHUNK_THRESHOLD_CHARS: '5000',
      AI_CHUNK_TARGET_CHARS: '6000',
      AI_TARGETED_REPAIR: '0'
    },
    responder: function (call) {
      if (call.stage === 'facts') {
        if (call.promptText.indexOf('fin.pdf') !== -1) {
          return { status: 500, body: 'chunk boom' };
        }
        return { assetLatest: '2,000.00' };
      }
      if (call.stage === 'narrative') {
        return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      }
      return { summaryAnalysis: 'S' };
    }
  });

  const result = gas.analyzeUploadedFilesWithAI(chunkPayload());

  assert.strictEqual(result.assetLatest, '2,000.00', 'ต้องใช้ผลจากช่วงที่สำเร็จ');
  assert.strictEqual(result.summaryAnalysis, 'S');
  assert.ok(Array.isArray(result._aiWarnings) && result._aiWarnings.length >= 1);
  assert.ok(result._aiWarnings.some(function (w) { return w.indexOf('อ่านช่วงหน้า') !== -1; }));
  assert.strictEqual(result._aiFieldSources.assetLatest.file, 'other.pdf');
});

test('schema ของไฟล์สแกนมี scanDigest สำหรับส่งต่อระยะบทวิเคราะห์', function () {
  const gas = loadGasStaged({});
  const schema = gas.buildScanFactSchema_();

  assert.ok(schema.properties.scanDigest, 'ต้องมีฟิลด์ scanDigest');
  assert.ok(String(schema.properties.scanDigest.description || '').length > 0, 'ต้องมีคำอธิบาย');
  assert.ok((schema.required || []).indexOf('assetLatest') !== -1, 'ยังต้องบังคับฟิลด์วิกฤต');
});

test('PDF สแกนที่แบ่งหลายชุดต้องถูกส่งให้ AI ครบทุกชุดและรวมผล', function () {
  const gas = loadGasStaged({
    responder: function (call, index) {
      if (index === 1) return { assetLatest: '1.00', scanDigest: 'สรุปชุดที่ 1' };
      return { debtLatest: '2.00', scanDigest: 'สรุปชุดที่ 2' };
    }
  });

  const payload = basePayload();
  payload.files = [{
    name: 'สแกน.pdf',
    category: 'งบการเงิน/รายงานสอบบัญชี',
    mimeType: 'application/pdf',
    mode: 'scan',
    scanChunks: [
      { base64: 'AAAA', pagesFrom: 1, pagesTo: 12 },
      { base64: 'BBBB', pagesFrom: 13, pagesTo: 24 }
    ]
  }];

  const run = gas.analyzeUploadedFilesWithAI(payload, { stage: 'facts' });

  function inlinePartsOf(call) {
    return call.body.contents[0].parts.filter(function (part) { return !!part.inlineData; });
  }
  const scanCalls = gas.calls.filter(function (call) { return inlinePartsOf(call).length > 0; });
  assert.strictEqual(scanCalls.length, 2, 'ต้องส่งทั้งสองชุดให้โมเดลอ่าน');
  assert.strictEqual(inlinePartsOf(scanCalls[0])[0].inlineData.data, 'AAAA');
  assert.strictEqual(inlinePartsOf(scanCalls[1])[0].inlineData.data, 'BBBB');
  assert.strictEqual(run.facts.assetLatest, '1.00');
  assert.strictEqual(run.facts.debtLatest, '2.00');
  assert.strictEqual(run.facts.scanDigest, undefined, 'ต้องไม่ให้ scanDigest ปนเข้าไปใน facts');
  assert.ok(run.scanDigest.indexOf('สรุปชุดที่ 1') !== -1);
  assert.ok(run.scanDigest.indexOf('สรุปชุดที่ 2') !== -1);
});

test('scanReadRanges รายงานเฉพาะชุดที่ AI อ่านสำเร็จ ไม่นับชุดที่ล้มเหลว', function () {
  let scanIndex = 0;
  const gas = loadGasStaged({
    props: { GEMINI_MODELS: 'gemini-a,gemini-b' },
    responder: function (call) {
      const hasImage = call.body.contents[0].parts.some(function (part) { return !!part.inlineData; });
      if (!hasImage) return { orgAnalysis4M: 'O', businessAnalysis: 'B', welfareAnalysis: 'W' };
      scanIndex += 1;
      if (scanIndex === 1) return { assetLatest: '1.00', scanDigest: 'สรุปชุดแรก' };
      return { status: 500, body: 'chunk boom' };
    }
  });

  const payload = basePayload();
  payload.files = [{
    name: 'สแกน.pdf',
    category: 'งบการเงิน/รายงานสอบบัญชี',
    mimeType: 'application/pdf',
    mode: 'scan',
    scanChunks: [
      { base64: 'AAAA', pagesFrom: 1, pagesTo: 12 },
      { base64: 'BBBB', pagesFrom: 13, pagesTo: 24 }
    ]
  }];

  const run = gas.analyzeUploadedFilesWithAI(payload, { stage: 'facts' });

  assert.strictEqual(run.scanReadRanges.length, 1, 'ต้องนับเฉพาะชุดที่อ่านสำเร็จ');
  assert.deepStrictEqual(run.scanReadRanges[0], { file: 'สแกน.pdf', from: 1, to: 12 });
  assert.ok(run._aiWarnings.some(function (w) { return w.indexOf('13–24') !== -1; }),
    'ต้องเตือนว่าชุด 13–24 อ่านไม่สำเร็จ');
});

test('ถ้ามีทั้งข้อความและไฟล์สแกน ต้องใช้ข้อความก่อนแล้วให้ไฟล์สแกนเติมเฉพาะช่องที่ขาด', function () {
  const gas = loadGasStaged({
    responder: function (call) {
      const hasImage = call.body.contents[0].parts.some(function (part) { return !!part.inlineData; });
      if (hasImage) return { assetLatest: 'จากภาพ', debtLatest: '2.00' };
      return { assetLatest: 'จากข้อความ' };
    }
  });

  const payload = basePayload();
  payload.files = [
    { name: 'งบ.pdf', category: 'งบการเงิน', extractedText: 'สินทรัพย์รวม 1.00' },
    {
      name: 'สแกน.pdf',
      category: 'ไฟล์อื่นๆ',
      mimeType: 'application/pdf',
      scanChunks: [{ base64: 'AAAA', pagesFrom: 1, pagesTo: 4 }]
    }
  ];

  const run = gas.analyzeUploadedFilesWithAI(payload, { stage: 'facts' });
  assert.strictEqual(run.facts.assetLatest, 'จากข้อความ', 'ค่าจากข้อความต้องชนะ');
  assert.strictEqual(run.facts.debtLatest, '2.00', 'ช่องที่ข้อความไม่มีต้องเติมจากภาพ');
});


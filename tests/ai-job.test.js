'use strict';

/**
 * Tests for the resumable analysis job (gas/AiJob.gs).
 * - state survives between steps and is chunked under the 100KB cache limit
 * - each step runs exactly one stage, so no execution has to do everything
 * - a failing stage keeps the other stages and reports a warning
 */

const test = require('node:test');
const assert = require('node:assert');
const { readRepo } = require('./helpers/sandbox');

function makeCache() {
  const store = new Map();
  return {
    store: store,
    get: function (key) { return store.has(key) ? store.get(key) : null; },
    getAll: function (keys) {
      const out = {};
      keys.forEach(function (key) { if (store.has(key)) out[key] = store.get(key); });
      return out;
    },
    put: function (key, value) {
      if (String(value).length > 100000) throw new Error('Argument too large: ' + key);
      store.set(key, String(value));
    },
    putAll: function (values) {
      Object.keys(values).forEach(function (key) {
        if (String(values[key]).length > 100000) throw new Error('Argument too large: ' + key);
        store.set(key, String(values[key]));
      });
    },
    removeAll: function (keys) { keys.forEach(function (key) { store.delete(key); }); }
  };
}

/**
 * Load AiJob.gs with Apps Script stubs.
 * options.analyze(payload, opts) simulates analyzeUploadedFilesWithAI.
 * options.locked = false simulates a step that cannot get the lock.
 */
function loadAiJob(options) {
  const opts = options || {};
  const cache = opts.cache || makeCache();
  const calls = [];

  const provided = {
    CacheService: { getScriptCache: function () { return cache; } },
    LockService: {
      getScriptLock: function () {
        return {
          tryLock: function () { return opts.locked === false ? false : true; },
          releaseLock: function () {}
        };
      }
    },
    Utilities: { getUuid: function () { return 'uuid-0001-abcd'; } },
    apiError_: function (code, message) {
      const err = new Error(message);
      err.code = code;
      return err;
    },
    logAiStage_: function () {},
    analyzeUploadedFilesWithAI: function (payload, runOptions) {
      calls.push({ payload: payload, options: runOptions });
      if (opts.analyze) return opts.analyze(payload, runOptions, calls.length);
      return {};
    }
  };

  const names = Object.keys(provided);
  const body = readRepo('gas', 'AiJob.gs') +
    '\nreturn { startAiAnalysisJob: startAiAnalysisJob, stepAiAnalysisJob: stepAiAnalysisJob,' +
    ' saveAiJob_: saveAiJob_, loadAiJob_: loadAiJob_, dropAiJob_: dropAiJob_, aiJobInput_: aiJobInput_ };';
  const factory = new Function(names.join(','), body);
  const api = factory.apply(null, names.map(function (name) { return provided[name]; }));
  api.cache = cache;
  api.calls = calls;
  return api;
}

function samplePayload() {
  return {
    coopName: 'สหกรณ์ทดสอบ จำกัด',
    coopCategoryName: 'สหกรณ์การเกษตร',
    dbFiscalYear: '2569',
    weaknesses: ['ทุนสำรองต่ำ'],
    score68: { level: 'ดี', total: 80 },
    score69: { level: 'ดีมาก', total: 88 },
    plannedVisits: 4,
    files: [
      {
        name: 'scan.pdf',
        category: 'งบการเงิน',
        base64: 'AAAA'.repeat(500),
        mimeType: 'application/pdf'
      },
      {
        name: 'report.pdf',
        category: 'ผลปิดบัญชี',
        extractedText: 'สินทรัพย์รวม 1,000,000 บาท',
        evidenceText: 'หน้า 3: สินทรัพย์รวม 1,000,000 บาท'
      }
    ]
  };
}

test('เก็บสถานะงานแบบแบ่งก้อนไม่เกิน 100KB และอ่านกลับได้ครบ', function () {
  const api = loadAiJob({});
  // ~80k Thai characters -> about 240KB in UTF-8 before chunking.
  const bigText = 'ก'.repeat(80000);
  const state = {
    jobId: 'job1',
    status: 'running',
    stage: 'narrative',
    input: { files: [{ name: 'a.pdf', extractedText: bigText }] },
    prior: { facts: { assetLatest: '1.00' } },
    result: { assetLatest: '1.00' },
    warnings: [],
    models: [],
    trace: []
  };

  api.saveAiJob_('job1', state);

  const chunkKeys = Array.from(api.cache.store.keys()).filter(function (key) {
    return key.indexOf('_c') !== -1;
  });
  assert.ok(chunkKeys.length >= 3, 'ต้องแบ่งเป็นหลายก้อน');
  chunkKeys.forEach(function (key) {
    assert.ok(api.cache.store.get(key).length <= 100000, 'ก้อน ' + key + ' ต้องไม่เกินเพดาน cache');
  });

  const loaded = api.loadAiJob_('job1');
  assert.strictEqual(loaded.input.files[0].extractedText.length, bigText.length, 'ต้องอ่านข้อความกลับได้ครบ');
  assert.strictEqual(loaded.prior.facts.assetLatest, '1.00');
});

test('start รันระยะ facts แล้ว step เดิน narrative → summary จนจบ', function () {
  const api = loadAiJob({
    analyze: function (payload, runOptions) {
      if (runOptions.stage === 'facts') {
        return {
          facts: { assetLatest: '1,000,000.00', fiscalDateFull: '31 มี.ค. 68' },
          fieldSources: { assetLatest: { file: 'report.pdf', pages: '3', chunk: '' } },
          fieldConflicts: {},
          chunkCount: 1,
          _aiWarnings: [],
          _aiModels: ['gemini-3.8-flash'],
          _aiTrace: [{ stage: 'facts', model: 'gemini-3.8-flash', schema: true, finishReason: 'STOP', outputChars: 120, ms: 20000 }]
        };
      }
      if (runOptions.stage === 'narrative') {
        return {
          sections: { orgAnalysis4M: 'ORG', businessAnalysis: 'BIZ', welfareAnalysis: 'WEL' },
          _aiWarnings: [],
          _aiModels: ['gemini-3.8-flash'],
          _aiTrace: [{ stage: 'narrative', model: 'gemini-3.8-flash', schema: true, finishReason: 'STOP', outputChars: 5000, ms: 30000 }]
        };
      }
      return {
        assetLatest: '1,000,000.00',
        orgAnalysis4M: 'ORG',
        businessAnalysis: 'BIZ',
        welfareAnalysis: 'WEL',
        summaryAnalysis: 'SUM',
        _aiWarnings: [],
        _aiModels: ['gemini-3.8-flash'],
        _aiTrace: [{ stage: 'summary', model: 'gemini-3.8-flash', schema: true, finishReason: 'STOP', outputChars: 4000, ms: 40000 }]
      };
    }
  });

  const started = api.startAiAnalysisJob(samplePayload());
  assert.strictEqual(started.status, 'running');
  assert.strictEqual(started.stage, 'narrative', 'facts เสร็จแล้วจึงเริ่มที่ narrative');
  assert.ok(started.jobId, 'ต้องคืน jobId');
  assert.strictEqual(api.calls.length, 1, 'start ต้องเรียก AI แค่ระยะ facts');

  const afterNarrative = api.stepAiAnalysisJob(started.jobId);
  assert.strictEqual(afterNarrative.status, 'running');
  assert.strictEqual(afterNarrative.stage, 'summary');
  assert.strictEqual(api.calls[1].options.stage, 'narrative');
  assert.strictEqual(api.calls[1].options.prior.facts.assetLatest, '1,000,000.00', 'ต้องส่ง facts เดิมต่อ');

  const done = api.stepAiAnalysisJob(started.jobId);
  assert.strictEqual(done.status, 'done');
  assert.strictEqual(done.result.summaryAnalysis, 'SUM');
  assert.strictEqual(done.result.orgAnalysis4M, 'ORG');
  assert.deepStrictEqual(done.result._aiModels, ['gemini-3.8-flash']);
  assert.strictEqual(done.result._aiTrace.length, 3, 'ต้องรวม trace ของทุกระยะ');

  const idle = api.stepAiAnalysisJob(started.jobId);
  assert.strictEqual(idle.status, 'done', 'เรียกซ้ำหลังจบต้องคืนผลเดิม');
  assert.strictEqual(api.calls.length, 3, 'ต้องเรียก AI ทั้งหมด 3 ครั้งเท่านั้น');
});

test('ระยะ narrative ล้ม ต้องยังเดินต่อระยะ summary และรายงานคำเตือน', function () {
  const api = loadAiJob({
    analyze: function (payload, runOptions) {
      if (runOptions.stage === 'facts') {
        return { facts: { assetLatest: '1.00' }, _aiWarnings: [], _aiModels: [], _aiTrace: [] };
      }
      if (runOptions.stage === 'narrative') {
        throw new Error('โมเดลไม่ตอบ');
      }
      return { assetLatest: '1.00', summaryAnalysis: 'SUM', _aiWarnings: [], _aiModels: [], _aiTrace: [] };
    }
  });

  const started = api.startAiAnalysisJob(samplePayload());
  const afterFail = api.stepAiAnalysisJob(started.jobId);
  assert.strictEqual(afterFail.stage, 'summary', 'ต้องไปต่อที่ระยะ summary');
  assert.ok(String(afterFail.warnings.join(' ')).indexOf('บทวิเคราะห์หัวข้อ 1-3 ไม่สำเร็จ') !== -1);

  const done = api.stepAiAnalysisJob(started.jobId);
  assert.strictEqual(done.status, 'done');
  assert.strictEqual(done.result.summaryAnalysis, 'SUM', 'หัวข้อ 4 ต้องยังได้');
  assert.ok(String(done.result._aiWarnings.join(' ')).indexOf('บทวิเคราะห์หัวข้อ 1-3 ไม่สำเร็จ') !== -1);
});

test('jobId ที่ไม่รู้จักต้องได้ error JOB_NOT_FOUND', function () {
  const api = loadAiJob({});
  assert.throws(function () { api.stepAiAnalysisJob('missing'); }, function (err) {
    return err.code === 'JOB_NOT_FOUND';
  });
});

test('ถ้าอีกคำขอกำลังทำงานอยู่ step ต้องคืน status busy ไม่รันซ้ำ', function () {
  const api = loadAiJob({ locked: false });
  const res = api.stepAiAnalysisJob('job1');
  assert.strictEqual(res.status, 'busy');
});

test('aiJobInput_ ตัดไฟล์ base64 ออกแต่เก็บข้อความที่สกัดได้', function () {
  const api = loadAiJob({});
  const input = api.aiJobInput_(samplePayload());
  assert.strictEqual(input.files[0].base64, undefined, 'ต้องไม่เก็บ base64 ไว้ใน cache');
  assert.strictEqual(input.files[1].extractedText, 'สินทรัพย์รวม 1,000,000 บาท');
  assert.strictEqual(input.files[1].evidenceText, 'หน้า 3: สินทรัพย์รวม 1,000,000 บาท');
  assert.strictEqual(input.coopName, 'สหกรณ์ทดสอบ จำกัด');
});

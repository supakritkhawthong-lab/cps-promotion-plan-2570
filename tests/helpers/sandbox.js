'use strict';

/**
 * tests/helpers/sandbox.js
 *
 * ตัวช่วยโหลดโค้ดจริงของโปรเจกต์เข้า Node โดยไม่ต้องติดตั้ง dependency
 * - gas/Code.gs : ใช้ new Function() เพื่อให้ได้ฟังก์ชันภายในออกมาทดสอบ
 * - web/js/*.js : ใช้ vm + window ปลอม (IIFE ของหน้าเว็บทำงานได้ตามปกติ)
 *
 * ข้อดี: เทสต์อ้างอิงไฟล์จริง ไม่มีสำเนาโค้ดให้เพี้ยนตามกัน
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function repoPath() {
  return path.join(ROOT, ...Array.prototype.slice.call(arguments));
}

function readRepo() {
  return fs.readFileSync(repoPath.apply(null, arguments), 'utf8');
}

function sliceBetween(source, beginMarker, endMarker) {
  const begin = source.indexOf(beginMarker);
  const end = source.indexOf(endMarker, begin + beginMarker.length);
  if (begin < 0 || end < 0) {
    throw new Error('ไม่พบ marker: ' + beginMarker + ' / ' + endMarker);
  }
  return source.slice(begin, end);
}

// ---------------------------------------------------------------------------
// GAS (gas/Code.gs)
// ---------------------------------------------------------------------------

/** ประเมินโค้ด GAS แล้วคืนเฉพาะชื่อฟังก์ชันที่ระบุ */
function evaluateGasBlock(source, exportNames, provided) {
  const keys = Object.keys(provided || {});
  const values = keys.map(function (key) { return provided[key]; });
  const body = source + '\nreturn { ' + exportNames.join(', ') + ' };';
  const factory = new Function(keys.join(', '), body);
  return factory.apply(null, values);
}

/** ตัวช่วยพื้นฐานที่ config.gs/Utilities มีให้ใน Apps Script */
function gasGlobals(overrides) {
  const globals = {
    getGeminiKey_: function () { return 'test-key'; },
    Utilities: {
      sleep: function () {},
      formatDate: function () { return '01/01/2026'; },
      base64Encode: function () { return ''; }
    }
  };
  if (overrides) {
    Object.keys(overrides).forEach(function (key) { globals[key] = overrides[key]; });
  }
  return globals;
}

function readGasSource() {
  return readRepo('gas', 'Code.gs');
}

/** โหลดเฉพาะกลุ่มฟังก์ชันซ่อม/อ่าน JSON (ไม่ต้องใช้ Apps Script runtime) */
function loadGasParserHelpers() {
  const source = readGasSource();
  const block = sliceBetween(
    source,
    '// ---- AI JSON parser helpers (begin) ----',
    '// ---- AI JSON parser helpers (end) ----'
  );
  return evaluateGasBlock(
    block,
    ['parseAiJson_', 'repairAiJsonText_', 'closeTruncatedJson_', 'repairMissingCommas_'],
    {}
  );
}

/**
 * จำลอง UrlFetchApp.fetch ของ Gemini
 * ตรวจระยะ (facts/narrative/summary) จากส่วนท้ายของ prompt + responseSchema
 */
function detectAiStage_(text, schema) {
  if (text.indexOf('ไม่มีฟิลด์บทวิเคราะห์') !== -1) return 'facts';
  if (text.indexOf('เพียง 1 ฟิลด์: summaryAnalysis') !== -1) return 'summary';
  if (text.indexOf('เพียง 3 ฟิลด์: orgAnalysis4M') !== -1) return 'narrative';
  if (schema && schema.properties && schema.properties.changes) return 'facts';
  if (schema && schema.properties && schema.properties.summaryAnalysis) return 'summary';
  if (schema && schema.properties && schema.properties.orgAnalysis4M) return 'narrative';
  return 'plain';
}

function geminiOk_(text) {
  return {
    getResponseCode: function () { return 200; },
    getContentText: function () {
      return JSON.stringify({
        candidates: [{ content: { parts: [{ text: text }] }, finishReason: 'STOP' }]
      });
    }
  };
}

function geminiError_(status, body) {
  return {
    getResponseCode: function () { return status; },
    getContentText: function () { return body || ''; }
  };
}

/**
 * โหลด analyzeUploadedFilesWithAI() พร้อม stub ของ Apps Script
 * options:
 *   props      - ค่า Script Properties
 *   responder  - (call, index) => object (คำตอบ JSON) หรือ { status, body } เพื่อจำลอง error
 */
function loadGasStaged(options) {
  const opts = options || {};
  const state = {
    calls: [],
    responder: opts.responder || function () { return {}; }
  };

  const props = opts.props || {};
  const getProp_ = function (key, fallback) {
    if (Object.prototype.hasOwnProperty.call(props, key)) return props[key];
    return fallback === undefined ? '' : fallback;
  };

  const UrlFetchApp = {
    fetch: function (url, requestOptions) {
      const payload = requestOptions && requestOptions.payload;
      if (!payload) {
        // ListModels (ใช้เมื่อลองครบทุกโมเดลแล้ว)
        return geminiOk_(JSON.stringify({ models: [] }));
      }
      let body;
      try {
        body = JSON.parse(payload);
      } catch (e) {
        return geminiError_(400, 'bad payload');
      }
      const parts = (body.contents && body.contents[0] && body.contents[0].parts) || [];
      const text = parts
        .filter(function (part) { return typeof part.text === 'string'; })
        .map(function (part) { return part.text; })
        .join('\n');
      const schema = body.generationConfig && body.generationConfig.responseSchema;
      const call = {
        url: url,
        stage: detectAiStage_(text, schema),
        hasSchema: !!schema,
        body: body,
        promptText: text
      };
      state.calls.push(call);
      const result = state.responder(call, state.calls.length);
      if (result && typeof result.status === 'number') {
        return geminiError_(result.status, result.body);
      }
      return geminiOk_(JSON.stringify(result));
    }
  };

  const exported = evaluateGasBlock(
    readGasSource(),
    [
      'analyzeUploadedFilesWithAI',
      'callGeminiJson_',
      'buildFactResponseSchema_',
      'buildGeminiRequestBody_',
      'capTextParts_',
      'AI_NARRATIVE_SCHEMA_',
      'AI_SUMMARY_SCHEMA_',
      'AI_FACT_STRING_FIELDS_',
      'AI_FACT_NUMBER_FIELDS_',
      'AI_FACT_BOOLEAN_FIELDS_',
      'AI_CHANGE_KEYS_'
    ],
    gasGlobals({ getProp_: getProp_, UrlFetchApp: UrlFetchApp })
  );

  exported.calls = state.calls;
  exported.setResponder = function (fn) { state.responder = fn; };
  return exported;
}

/** รายชื่อฟิลด์ทั้งหมดที่ prompt เดิมขอ (ใช้ตรวจว่า responseSchema ไม่ตกหล่น) */
function extractPromptFactKeys() {
  const source = readGasSource();
  const block = sliceBetween(source, 'ตอบกลับมาเป็น JSON ตามโครงสร้างนี้เท่านั้น', '\n}`;');
  const keys = [];
  block.split(/\r?\n/).forEach(function (line) {
    const match = line.match(/^\s{2}"([A-Za-z0-9_]+)"\s*:/);
    if (match) keys.push(match[1]);
  });
  return keys;
}

// ---------------------------------------------------------------------------
// Web (web/js/*.js)
// ---------------------------------------------------------------------------

function makeLocalStorage() {
  const data = {};
  return {
    get length() { return Object.keys(data).length; },
    key: function (index) { return Object.keys(data)[index] || null; },
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) { data[key] = String(value); },
    removeItem: function (key) { delete data[key]; },
    clear: function () {
      Object.keys(data).forEach(function (key) { delete data[key]; });
    }
  };
}

function createWebSandbox() {
  const noop = function () {};
  const sandbox = {
    console: console,
    setTimeout: function () { return 0; },
    clearTimeout: noop,
    setInterval: function () { return 0; },
    clearInterval: noop,
    localStorage: makeLocalStorage(),
    sessionStorage: makeLocalStorage(),
    navigator: { userAgent: 'node-test' },
    location: { href: 'http://localhost/', search: '', hash: '' },
    alert: noop,
    confirm: function () { return true; },
    prompt: function () { return ''; },
    fetch: function () { return Promise.reject(new Error('fetch ไม่พร้อมใช้ใน unit test')); },
    document: {
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {}, classList: { add: noop, remove: noop }, addEventListener: noop }; },
      addEventListener: noop,
      body: { appendChild: noop, classList: { add: noop, remove: noop } },
      documentElement: { style: {} }
    }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.top = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

/** โหลดไฟล์เว็บตามลำดับ (path สัมพัทธ์จากรากโปรเจกต์) */
function loadWebScripts(files, sandbox) {
  const target = sandbox || createWebSandbox();
  files.forEach(function (relativePath) {
    const source = readRepo(relativePath);
    vm.runInContext(source, target, { filename: relativePath });
  });
  return target;
}

module.exports = {
  ROOT: ROOT,
  repoPath: repoPath,
  readRepo: readRepo,
  sliceBetween: sliceBetween,
  readGasSource: readGasSource,
  loadGasParserHelpers: loadGasParserHelpers,
  loadGasStaged: loadGasStaged,
  extractPromptFactKeys: extractPromptFactKeys,
  createWebSandbox: createWebSandbox,
  loadWebScripts: loadWebScripts
};

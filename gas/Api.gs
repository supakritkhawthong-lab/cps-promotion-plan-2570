/**
 * Api.gs — ชั้น HTTP API สำหรับเรียกจากเว็บที่ host บน GitHub Pages
 *
 * frontend เดิมที่เรียก google.script.run จะถูกแปลงเป็น fetch โดย
 * web/js/google-script-shim.js แล้วมาลงที่ doPost() นี้
 *
 * รูปแบบ request:
 *   POST <webapp-url>/exec
 *   Content-Type: text/plain;charset=utf-8   (เลี่ยง CORS preflight)
 *   { "action": "rpc", "fn": "getMasterCoopList", "args": [], "token": "..." }
 *
 * รูปแบบ response:
 *   { "ok": true,  "result": ... }
 *   { "ok": false, "error": { "code": "...", "message": "..." } }
 */

/** ฟังก์ชันที่อนุญาตให้เรียกจากภายนอก — เพิ่มชื่อที่นี่เมื่อทำ endpoint ใหม่ */
var RPC_ALLOWLIST = [
  'getMasterCoopList',
  'saveDraftToSheet',
  'analyzeUploadedFilesWithAI',
  'generatePlanDocument',
  'saveCompleteCoopRecord',
  'getCompleteCoopRecord',
  'getDashboardSummaryData'
];

/** จำกัดขนาด body (~34 MB ไบนารีหลัง base64) กัน memory quota */
var MAX_BODY_CHARS = 45 * 1024 * 1024;

function doPost(e) {
  var started = Date.now();
  var raw = (e && e.postData && e.postData.contents) || '{}';

  if (raw.length > MAX_BODY_CHARS) {
    return apiJson_({
      ok: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'ไฟล์ที่ส่งมีขนาดใหญ่เกินกำหนด' }
    });
  }

  var body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    return apiJson_({
      ok: false,
      error: { code: 'BAD_JSON', message: 'รูปแบบ JSON ไม่ถูกต้อง' }
    });
  }

  try {
    assertApiToken_(body.token);

    if (body.action === 'ping') {
      return apiJson_({
        ok: true,
        result: { pong: true, at: new Date().toISOString(), ms: Date.now() - started }
      });
    }

    if (body.action !== 'rpc') {
      throw apiError_('BAD_ACTION', 'action ต้องเป็น "rpc" หรือ "ping"');
    }
    if (RPC_ALLOWLIST.indexOf(body.fn) === -1) {
      throw apiError_('FORBIDDEN', 'ไม่อนุญาตให้เรียกฟังก์ชัน: ' + body.fn);
    }
    if (body.fn === 'analyzeUploadedFilesWithAI' && !getGeminiKey_()) {
      throw apiError_('CONFIG', 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Script Properties');
    }

    var fn = resolveRpc_(body.fn);
    if (typeof fn !== 'function') {
      throw apiError_('NOT_FOUND', 'ไม่พบฟังก์ชัน: ' + body.fn);
    }

    var args = Array.isArray(body.args) ? body.args : [];
    var result = fn.apply(null, args);

    return apiJson_({
      ok: true,
      result: result,
      ms: Date.now() - started
    });
  } catch (err) {
    return apiJson_({
      ok: false,
      error: {
        code: err.code || 'INTERNAL',
        message: err.message || String(err),
        stack: isDebug_() ? String(err.stack || '') : undefined
      }
    });
  }
}

function apiError_(code, message) {
  var err = new Error(message);
  err.code = code;
  return err;
}

/** V8 มี globalThis อยู่แล้ว แต่เผื่อ runtime เก่า */
function getGlobal_() {
  return (typeof globalThis !== 'undefined') ? globalThis : this;
}

/**
 * หาฟังก์ชันที่จะเรียกแบบเจาะจง
 * ไม่พึ่ง globalThis[ชื่อ] อย่างเดียว เพราะ Apps Script บาง entorno
 * ไม่ผูกฟังก์ชันระดับบนสุดไว้กับ global object
 */
function resolveRpc_(name) {
  var g = getGlobal_();
  if (g && typeof g[name] === 'function') return g[name];

  var handlers = {
    getMasterCoopList: getMasterCoopList,
    saveDraftToSheet: saveDraftToSheet,
    analyzeUploadedFilesWithAI: analyzeUploadedFilesWithAI,
    generatePlanDocument: generatePlanDocument,
    saveCompleteCoopRecord: saveCompleteCoopRecord,
    getCompleteCoopRecord: getCompleteCoopRecord,
    getDashboardSummaryData: getDashboardSummaryData
  };
  return handlers[name];
}

function apiJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ถ้าไม่ได้ตั้ง API_TOKEN ใน Script Properties = เปิดให้ทุกคนเรียกได้
 * (ใช้เฉพาะช่วงพัฒนาเท่านั้น)
 */
function assertApiToken_(token) {
  var expected = getProp_('API_TOKEN');
  if (!expected) return;
  if (String(token || '') !== expected) {
    throw apiError_('UNAUTHORIZED', 'API token ไม่ถูกต้อง');
  }
}

function isDebug_() {
  return getProp_('DEBUG') === '1';
}

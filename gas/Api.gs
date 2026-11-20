/**
 * Api.gs — HTTP API layer for the GitHub Pages frontend.
 *
 * The web/js/google-script-shim.js translates google.script.run into fetch()
 * calls that arrive here:
 *   POST <webapp-url>/exec
 *   Content-Type: text/plain;charset=utf-8
 *   { "action": "rpc", "fn": "getMasterCoopList", "args": [], "token": "..." }
 *
 * Only read-only dashboard endpoints remain. Plan/AI upload endpoints were
 * removed when the app was reduced to dashboard, registry and strength pages.
 */

/** Functions the browser is allowed to call. */
var RPC_ALLOWLIST = [
  'getMasterCoopList',
  'getDashboardSummaryData'
];

/** Request body guard (dashboard filters are small). */
var MAX_BODY_CHARS = 64 * 1024;

function doPost(e) {
  var started = Date.now();
  var raw = (e && e.postData && e.postData.contents) || '{}';

  if (raw.length > MAX_BODY_CHARS) {
    return apiJson_({
      ok: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'ขนาดคำขอเกินกำหนด' }
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
        message: redactSecrets_(err.message || String(err)),
        stack: isDebug_() ? redactSecrets_(err.stack || '') : undefined
      }
    });
  }
}

/**
 * Strip credentials from text before it leaves the server.
 * UrlFetchApp exceptions embed the request URL, which carries "?key=...".
 */
function redactSecrets_(text) {
  var s = (text === null || text === undefined) ? '' : String(text);
  if (!s) return s;
  return s
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/\bAQ\.[A-Za-z0-9_.\-]+/g, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_\-]{10,}/g, '[REDACTED]');
}

function apiError_(code, message) {
  var err = new Error(message);
  err.code = code;
  return err;
}

/** V8 has globalThis, but keep a fallback for older runtimes. */
function getGlobal_() {
  return (typeof globalThis !== 'undefined') ? globalThis : this;
}

/** Resolve RPC functions explicitly: some GAS runtimes do not bind top-level functions to globalThis. */
function resolveRpc_(name) {
  var g = getGlobal_();
  if (g && typeof g[name] === 'function') return g[name];

  var handlers = {
    getMasterCoopList: getMasterCoopList,
    getDashboardSummaryData: getDashboardSummaryData
  };
  return handlers[name];
}

function apiJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** An empty API_TOKEN means open access (development only). */
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

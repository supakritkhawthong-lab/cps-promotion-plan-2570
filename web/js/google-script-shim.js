/**
 * google-script-shim.js
 *
 * ทำให้โค้ด frontend เดิมที่เรียก google.script.run(...) ทำงานบน GitHub Pages ได้
 * โดยไม่ต้องแก้โค้ด UI เลย — เราแปลง call เป็น HTTP POST ไปยัง Apps Script Web App
 *
 * รองรับ:
 *   google.script.run
 *     .withSuccessHandler(fn)
 *     .withFailureHandler(fn)
 *     .withUserObject(obj)
 *     .ชื่อฟังก์ชัน(args...)
 *
 * ข้อจำกัด:
 *   - ค่าที่ส่งได้ต้องเป็น JSON (string/number/boolean/array/object/null)
 *   - ฝั่ง server ต้องอนุญาตชื่อฟังก์ชันใน RPC_ALLOWLIST (gas/Api.gs)
 */
(function (global) {
  'use strict';

  var cfg = global.APP_CONFIG || {};

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i] || {};
      for (var key in src) {
        if (Object.prototype.hasOwnProperty.call(src, key)) target[key] = src[key];
      }
    }
    return target;
  }

  function invoke(fnName, args, state) {
    if (!cfg.API_URL || cfg.API_URL.indexOf('PASTE_DEPLOYMENT_ID') !== -1) {
      var configError = new Error(
        'ยังไม่ได้ตั้งค่า APP_CONFIG.API_URL ใน web/config.js (ต้องเป็น URL /exec ของ Apps Script)'
      );
      if (typeof state.failure === 'function') state.failure(configError);
      else console.error('[gs-shim]', configError);
      return Promise.resolve(null);
    }

    var payload = {
      action: 'rpc',
      fn: fnName,
      args: args,
      token: cfg.API_TOKEN || ''
    };

    return fetch(cfg.API_URL, {
      method: 'POST',
      // text/plain = "simple request" จึงไม่เกิด CORS preflight (Apps Script ไม่รับ OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store'
    })
      .then(function (res) {
        // อ่านเป็น text ก่อน เพื่อให้ดึงข้อความ error จาก API ได้แม้ HTTP status ไม่ใช่ 2xx
        return res.text().then(function (text) {
          var json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (e) {
            json = null;
          }
          if (!res.ok) {
            var httpErr = new Error(
              (json && json.error && json.error.message) ||
                'HTTP ' + res.status + ' ' + res.statusText
            );
            httpErr.code = (json && json.error && json.error.code) || 'HTTP_' + res.status;
            throw httpErr;
          }
          return json;
        });
      })
      .then(function (json) {
        if (!json || json.ok !== true) {
          var apiErr = new Error(
            (json && json.error && json.error.message) || 'API ตอบกลับผิดรูปแบบ'
          );
          apiErr.code = json && json.error && json.error.code;
          throw apiErr;
        }
        if (typeof state.success === 'function') state.success(json.result);
        return json.result;
      })
      .catch(function (err) {
        // โค้ดเดิมของ Apps Script ไม่ได้ใช้ Promise จึงไม่ throw ต่อ
        // เพื่อหลีกเลี่ยง unhandled rejection ใน console
        if (typeof state.failure === 'function') state.failure(err);
        else console.error('[gs-shim] ' + fnName + ' failed:', err);
        return null;
      });
  }

  function makeRunner(state) {
    var base = {
      withSuccessHandler: function (fn) {
        return makeRunner(assign({}, state, { success: fn }));
      },
      withFailureHandler: function (fn) {
        return makeRunner(assign({}, state, { failure: fn }));
      },
      withUserObject: function (obj) {
        return makeRunner(assign({}, state, { userObject: obj }));
      }
    };

    return new Proxy(base, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== 'string') return undefined;
        if (prop === 'then') return undefined; // กัน Promise assimilation

        return function () {
          var args = Array.prototype.slice.call(arguments);
          return invoke(prop, args, state);
        };
      }
    });
  }

  global.google = global.google || {};
  global.google.script = global.google.script || {};
  global.google.script.run = makeRunner({});
})(window);

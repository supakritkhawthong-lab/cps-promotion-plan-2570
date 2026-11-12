'use strict';

/**
 * เทสต์หัวข้อ 4. สรุปผลการวิเคราะห์ (web/js/cpd-ui.js → analyze4M)
 * เป้าหมาย: บทสรุปต้องอ่านง่าย เริ่มด้วยบทสรุปผู้บริหาร และมีแผนดำเนินการ
 * ที่อ้างอิงหมายเลขปัญหา แยกตามระยะเวลา โดยไม่หลุด undefined/NaN
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadWebScripts, readGasSource } = require('./helpers/sandbox');

function setup(options) {
  const opts = options || {};
  const web = loadWebScripts([
    'web/js/cpd-state.js',
    'web/js/cpd-preload.js',
    'web/js/cpd-ui.js'
  ]);
  web.CPD_STATE.replaceState(web.CPD_STATE.defaultState());
  const state = web.CPD_AppState;
  state.coopProfile.coopName = opts.coopName || 'สหกรณ์ทดสอบ จำกัด';

  if (opts.financials) {
    Object.keys(opts.financials).forEach(function (key) {
      state.financials[key] = opts.financials[key];
    });
  }
  if (opts.strength) {
    Object.keys(opts.strength).forEach(function (key) {
      state.strength[key] = opts.strength[key];
    });
  }
  return web;
}

function summaryOf(web) {
  return String(web.CPD_UI.analyze4M().summaryAnalysis || '');
}

test('บทสรุปเริ่มด้วยบทสรุปผู้บริหารและมีแผนดำเนินการครบ 3 ระยะ', function () {
  const web = setup({
    financials: {
      summary2Years: {
        assetsLatest: 10000000,
        assetsPrev: 9000000,
        liabilitiesLatest: 9500000,
        liabilitiesPrev: 8000000,
        netProfitLatest: -500000,
        netProfitPrev: 200000
      },
      ratios: {
        deRatio: 2.5,
        currentRatio: 0.8,
        shortTermDebtPaidOnTimeRatio: 60
      }
    },
    strength: {
      classByYear: { '2567': 'พอใช้', '2568': 'ดี', '2569': 'ดี', '2570': 'ดีมาก' },
      totalByYear: { '2567': 60, '2568': 75, '2569': 80, '2570': 85 }
    }
  });

  const text = summaryOf(web);

  assert.ok(text.indexOf('บทสรุปผู้บริหาร') === 0, 'ต้องเริ่มด้วยบทสรุปผู้บริหาร');
  assert.ok(text.indexOf('ปัญหาที่ 1') !== -1, 'ต้องมีปัญหาที่ 1');
  assert.ok(text.indexOf('(แก้ไขปัญหาที่ 1)') !== -1, 'ต้องมีแนวทางที่อ้างอิงปัญหาที่ 1');
  assert.ok(text.indexOf('แผนดำเนินการเพื่อส่งเสริมสหกรณ์') !== -1, 'ต้องมีแผนดำเนินการ');
  assert.ok(text.indexOf('เร่งด่วน (ภายใน 3 เดือน)') !== -1, 'ต้องมีระยะเร่งด่วน');
  assert.ok(text.indexOf('ระยะกลาง (3–12 เดือน)') !== -1, 'ต้องมีระยะกลาง');
  assert.ok(text.indexOf('ระยะยาว (มากกว่า 1 ปี)') !== -1, 'ต้องมีระยะยาว');
  assert.ok(text.indexOf('ผลการจัดชั้นความเข้มแข็งและเป้าหมายปี') !== -1, 'ต้องมีผลจัดชั้นและเป้าหมาย');
  assert.ok(text.indexOf('2570') !== -1, 'ต้องอ้างอิงปีเป้าหมาย 2570');
  assert.ok(text.indexOf('undefined') === -1, 'ต้องไม่มี undefined');
  assert.ok(text.indexOf('NaN') === -1, 'ต้องไม่มี NaN');
  assert.ok(text.indexOf('[object Object]') === -1, 'ต้องไม่มี [object Object]');
});

test('ความเสี่ยงเร่งด่วนมาจากปัญหาที่กระทบฐานะการเงิน', function () {
  const web = setup({
    financials: {
      summary2Years: {
        assetsLatest: 10000000,
        liabilitiesLatest: 9500000,
        netProfitLatest: -500000,
        netProfitPrev: 0
      },
      ratios: { deRatio: 2.5, currentRatio: 0.8, shortTermDebtPaidOnTimeRatio: 60 }
    }
  });

  const text = summaryOf(web);
  assert.ok(/ความเสี่ยงสำคัญที่ต้องแก้ไข คือ .*ขาดทุน/.test(text), 'ต้องกล่าวถึงความเสี่ยงผลขาดทุน');
  assert.ok(/เร่งด่วน \(ภายใน 3 เดือน\):[\s\S]*ด้านที่ 1 ปัญหาที่/.test(text),
    'แผนเร่งด่วนต้องอ้างอิงด้านและหมายเลขปัญหา');
});

test('prompt ข้อ 22 กำหนดบทสรุปผู้บริหารและแผนดำเนินการ 3 ระยะ', function () {
  const source = readGasSource();

  assert.ok(source.indexOf('"summaryAnalysis" ให้เขียนบทวิเคราะห์หัวข้อ 4') !== -1);
  assert.ok(source.indexOf('บทสรุปผู้บริหาร') !== -1, 'ต้องมีบทสรุปผู้บริหาร');
  assert.ok(source.indexOf('แผนดำเนินการเพื่อส่งเสริมสหกรณ์') !== -1, 'ต้องมีแผนดำเนินการ');
  assert.ok(source.indexOf('เร่งด่วน (ภายใน 3 เดือน)') !== -1, 'ต้องมีระยะเร่งด่วน');
  assert.ok(source.indexOf('ระยะกลาง (3-12 เดือน)') !== -1, 'ต้องมีระยะกลาง');
  assert.ok(source.indexOf('ระยะยาว (มากกว่า 1 ปี)') !== -1, 'ต้องมีระยะยาว');
});

test('กรณียังไม่มีข้อมูล ต้องไม่หลุด undefined/NaN และยังมีบทสรุปผู้บริหาร', function () {
  const web = setup();
  const text = summaryOf(web);

  assert.ok(text.indexOf('บทสรุปผู้บริหาร') === 0);
  assert.ok(text.indexOf('undefined') === -1, 'ต้องไม่มี undefined');
  assert.ok(text.indexOf('NaN') === -1, 'ต้องไม่มี NaN');
  assert.ok(text.indexOf('[object Object]') === -1, 'ต้องไม่มี [object Object]');
});

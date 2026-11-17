'use strict';

/**
 * เทสต์ข้อมูลคะแนนความเข้มแข็งกลุ่มเกษตรกร ปี 2569
 * - gas/GroupStrength69.gs : ชุดข้อมูลสำรอง + ตัวช่วยสร้าง score69/score68
 * - web/js/cpd-ui.js      : เติมค่าตัวชี้วัดจริงจาก subScores (ไม่กระจายตามน้ำหนัก)
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadGasGroupStrength, loadWebScripts } = require('./helpers/sandbox');

const gas = loadGasGroupStrength();

function round2(v) {
  return Math.round(Number(v) * 100) / 100;
}

function sumKeys(sub, keys) {
  return round2(keys.reduce(function (sum, key) {
    return sum + Number(sub[key] || 0);
  }, 0));
}

function setupWeb() {
  const web = loadWebScripts([
    'web/js/cpd-state.js',
    'web/js/cpd-ui.js'
  ]);
  web.CPD_STATE.replaceState(web.CPD_STATE.defaultState());
  return web;
}

test('ชุดข้อมูลคะแนนกลุ่มเกษตรกรครบ 22 ราย และผลรวมมิติตรงกับไฟล์', function () {
  assert.equal(gas.GROUP_STRENGTH_69_DATA.length, 22);

  gas.GROUP_STRENGTH_69_DATA.forEach(function (rec) {
    assert.ok(rec.name, 'ต้องมีชื่อกลุ่ม');
    assert.match(rec.code13, /^\d{13}$/, rec.name + ' ต้องมีรหัส 13 หลัก');

    const sub = rec.subScores;
    assert.equal(sumKeys(sub, ['s1_1', 's1_2', 's1_3']), round2(rec.d1), rec.name + ' มิติ 1');
    assert.equal(
      sumKeys(sub, ['s2_1', 's2_2', 's2_3', 's2_4', 's2_5', 's2_6']),
      round2(rec.d2),
      rec.name + ' มิติ 2'
    );
    assert.equal(
      sumKeys(sub, ['s3_1', 's3_2', 's3_3', 's3_4', 's3_5']),
      round2(rec.d3),
      rec.name + ' มิติ 3 (รวมคอลัมน์พิเศษ s3_5)'
    );
    assert.equal(
      sumKeys(sub, ['s4_1', 's4_2', 's4_3', 's4_4']),
      round2(rec.d4),
      rec.name + ' มิติ 4'
    );
    assert.equal(
      round2(rec.d1 + rec.d2 + rec.d3 + rec.d4),
      round2(rec.total),
      rec.name + ' คะแนนรวม'
    );
    assert.match(rec.level, /^ชั้น [123]$/);
  });
});

test('ค้นหาชื่อกลุ่มด้วยชื่อตรง ชื่อมีช่องว่างซ้ำ และชื่อ alias (เลี้ยง/ลี้ยง)', function () {
  const exact = gas.getGroupStrength69Record_('กลุ่มเกษตรกรทำนาทุ่งขวาง');
  assert.ok(exact);
  assert.equal(exact.code13, '2001000125249');
  assert.equal(gas.getGroupStrength69Record_('  กลุ่มเกษตรกรทำนาทุ่งขวาง  '), exact);

  const alias = gas.getGroupStrength69Record_('กลุ่มเกษตรกรผู้ลี้ยงสัตว์น้ำบางปลาสร้อย');
  assert.ok(alias, 'ต้องจับคู่ชื่อที่ระบบสะกดต่างจากไฟล์ได้');
  assert.equal(alias.name, 'กลุ่มเกษตรกรผู้เลี้ยงสัตว์น้ำบางปลาสร้อย');

  assert.equal(gas.getGroupStrength69Record_('กลุ่มเกษตรกรไม่มีอยู่จริง'), null);
});

test('hasStrengthScore69_ แยกผลที่เป็นเพียงชื่อชั้นออกจากคะแนนจริง', function () {
  assert.equal(gas.hasStrengthScore69_({}), false);
  assert.equal(gas.hasStrengthScore69_({ level: 'ชั้น 2' }), false);
  assert.equal(gas.hasStrengthScore69_({ total: 80.34 }), true);
  assert.equal(gas.hasStrengthScore69_({ d3: 6.67 }), true);
});

test('buildGroupScore69_ สร้าง score69 โครงเดียวกับชีตและมี simResult', function () {
  const rec = gas.getGroupStrength69Record_('กลุ่มเกษตรกรทำประมงบางพระ');
  const score = gas.buildGroupScore69_(rec);

  assert.equal(score.coopType, 'กลุ่มเกษตรกร');
  assert.equal(score.code13, '2001000225385');
  assert.equal(score.total, 61.33);
  assert.equal(score.level, 'ชั้น 3');
  assert.equal(score.fy, '30 กันยายน');
  assert.equal(score.source, 'bundled-group-strength-69');
  assert.equal(score.simResult.coopCategoryName, 'กลุ่มเกษตรกร');
  assert.equal(score.simResult.currentTotal, 61.33);
});

test('buildGroupScore68Meta_ ให้เฉพาะระดับชั้นปี 2568 ไม่แต่งตัวเลขขึ้นเอง', function () {
  const rec = gas.getGroupStrength69Record_('กลุ่มเกษตรกรทำไร่บางละมุง');
  const meta = gas.buildGroupScore68Meta_(rec);

  assert.equal(meta.level, 'ชั้น 3');
  assert.equal(meta.fy, '31 มีนาคม');
  assert.equal(meta.total, undefined);
  assert.equal(meta.d1, undefined);
});

test('indicatorsFromScore69 แมป subScores เป็นตัวชี้วัด 18 ตัว', function () {
  const web = setupWeb();
  const ind = web.CPD_UI.indicatorsFromScore69({
    subScores: { s1_1: 15, s1_2: 12, s1_3: 2, s3_5: 6.67 }
  });

  assert.equal(ind['1.1'], 15);
  assert.equal(ind['1.2'], 12);
  assert.equal(ind['1.3'], 2);
  assert.equal(ind['3.5'], 6.67);
  assert.equal(web.CPD_UI.indicatorsFromScore69({}), null);
  assert.equal(web.CPD_UI.indicatorsFromScore69({ subScores: { s1_1: 0 } }), null);
});

test('applyStrength69Fallback เติมตัวชี้วัดจริงและยอดรวมมิติตรงกับ master', function () {
  const web = setupWeb();
  const rec = gas.getGroupStrength69Record_('กลุ่มเกษตรกรทำนาทุ่งขวาง');
  const payload = web.CPD_UI.strength69Payload(gas.buildGroupScore69_(rec));

  assert.equal(web.CPD_UI.applyStrength69Fallback(payload), true);

  const st = web.CPD_AppState.strength;
  assert.equal(st.totalByYear['2569'], 80.34);
  assert.equal(st.dim1ByYear['2569'], 29);
  assert.equal(st.dim2ByYear['2569'], 18.67);
  assert.equal(st.dim3ByYear['2569'], 6.67);
  assert.equal(st.dim4ByYear['2569'], 26);
  assert.equal(st.indicators['1.1']['2569'], 15);
  assert.equal(st.indicators['1.1']._autoDistributed, undefined);
  assert.equal(st.indicators['3.5']['2569'], 6.67);

  // เติมซ้ำไม่ควรทับข้อมูลที่มีอยู่แล้ว
  assert.equal(web.CPD_UI.applyStrength69Fallback(payload), false);
});

test('ถ้ายอดรวม/มิติถูก sync จากหน้า 1 แล้ว ยังเติมตัวชี้วัดจริงได้', function () {
  const web = setupWeb();
  const rec = gas.getGroupStrength69Record_('กลุ่มเกษตรกรทำนาทุ่งขวาง');
  const payload = web.CPD_UI.strength69Payload(gas.buildGroupScore69_(rec));

  // จำลองสถานะหลัง sync จากฟอร์มหน้า 1: มีแต่ยอดรวม/มิติ ยังไม่มีตัวชี้วัด
  const st = web.CPD_AppState.strength;
  st.classByYear['2569'] = payload.level;
  st.totalByYear['2569'] = payload.total;
  st.dim1ByYear['2569'] = payload.d1;
  st.dim2ByYear['2569'] = payload.d2;
  st.dim3ByYear['2569'] = payload.d3;
  st.dim4ByYear['2569'] = payload.d4;

  assert.equal(web.CPD_UI.applyStrength69Fallback(payload), true);
  assert.equal(st.indicators['1.1']['2569'], 15);
  assert.equal(st.indicators['2.3']['2569'], 2.67);
  assert.equal(st.dim2ByYear['2569'], 18.67);
});

test('ผลปี 2569 ที่ไม่มี subScores ยังเติมยอดรวม/มิติได้เหมือนเดิม', function () {
  const web = setupWeb();
  const applied = web.CPD_UI.applyStrength69Fallback({
    level: 'ชั้น 2', total: 70, d1: 20, d2: 15, d3: 10, d4: 25, indicators: null
  });

  assert.equal(applied, true);
  const st = web.CPD_AppState.strength;
  assert.equal(st.classByYear['2569'], 'ชั้น 2');
  assert.equal(st.totalByYear['2569'], 70);
  assert.equal(st.dim1ByYear['2569'], 20);
  assert.equal(st.dim4ByYear['2569'], 25);
});

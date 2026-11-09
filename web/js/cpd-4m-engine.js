/**
 * cpd-4m-engine.js — Rule-based 4M Analysis Engine
 * 
 * วิเคราะห์จุดแข็ง/จุดอ่อน/แผนกิจกรรม จากข้อมูล 4M และข้อสังเกตผู้สอบบัญชี
 * แยกจาก analyze4M() เดิม เพื่อไม่ให้กระทบ logic เก่า
 * 
 * Usage:
 *   window.CPD_4M_ENGINE.analyze(state) -> { strengths, improvements, actions, warnings }
 */
(function (global) {
  'use strict';

  /**
   * วิเคราะห์ข้อมูล 4M และข้อสังเกตผู้สอบบัญชี
   * @param {Object} state - CPD_AppState
   * @returns {Object} { strengths, improvements, actions, warnings }
   */
  function analyze(state) {
    var s = state || {};
    var p = s.coopProfile || {};
    var f = s.financials || {};
    var st = s.strength || {};
    var fourM = p.fourMDetails || {};
    var m1 = fourM.m1 || {};
    var m2 = fourM.m2 || {};
    var m4 = fourM.m4 || {};
    var auditorObs = fourM.auditorObservations || {};
    var mem = p.members || {};
    var sum = f.summary2Years || {};
    var bs = f.balanceSheet || {};
    var op = f.operatingResults || {};
    var N = op.latest || {};
    var ratios = f.ratios || {};

    var strengths = [];
    var improvements = [];
    var actions = [];
    var warnings = [];

    // ========================================================================
    // M1: บุคลากรและสมาชิก
    // ========================================================================
    
    // ความถี่การรายงานของผู้ตรวจสอบกิจการ
    if (m1.inspectorFrequency === 'monthly') {
      strengths.push({
        category: 'M1',
        text: 'คณะผู้ตรวจสอบกิจการปฏิบัติหน้าที่เข้มแข็ง มีการรายงานผลต่อที่ประชุมคณะกรรมการทุกเดือน'
      });
    }

    // การมีส่วนร่วมของสมาชิก
    var membersTotal = S.num(mem.regularMale) + S.num(mem.regularFemale) +
      S.num(mem.associateMale) + S.num(mem.associateFemale);
    if (!membersTotal) membersTotal = S.num(mem.regularTotal) + S.num(mem.associateTotal);
    
    var membersBorrow = S.num(m1.membersBorrow);
    var membersDeposit = S.num(m1.membersDeposit);
    
    if (membersTotal > 0) {
      var borrowRate = (membersBorrow / membersTotal) * 100;
      var depositRate = (membersDeposit / membersTotal) * 100;
      
      if (depositRate < 50 || borrowRate < 60) {
        improvements.push({
          category: 'M1',
          text: 'การมีส่วนร่วมของสมาชิกยังกระจุกตัว (กู้เงิน ' + S.fmt(borrowRate, 1) + '%, ฝากเงิน ' + S.fmt(depositRate, 1) + '%)'
        });
        actions.push({
          category: 'M1',
          code: '2.X1',
          goal: 'แนะนำส่งเสริมการเพิ่มการมีส่วนร่วมของสมาชิก และการเพิ่มประเภทสินเชื่อ/เงินฝากเพื่อจูงใจสมาชิก',
          target: '1',
          unit: 'ครั้ง'
        });
      }
    }

    // ========================================================================
    // M2: สำนักงานและอุปกรณ์
    // ========================================================================
    
    // ความเหมาะสมของสถานที่
    if (m2.facilityCondition === 'good') {
      strengths.push({
        category: 'M2',
        text: 'สถานที่ปฏิบัติงานมีความเหมาะสมและเอื้อต่อการให้บริการสมาชิก'
      });
    } else if (m2.facilityCondition === 'poor') {
      improvements.push({
        category: 'M2',
        text: 'สถานที่ปฏิบัติงานควรได้รับการปรับปรุงเพื่อให้บริการสมาชิกได้อย่างมีประสิทธิภาพ'
      });
    }

    // โปรแกรมบัญชี
    if (m2.accountingSoftware === 'private_software') {
      strengths.push({
        category: 'M2',
        text: 'สหกรณ์ใช้โปรแกรมบัญชีเอกชนที่มีประสิทธิภาพสูงในการบริหารจัดการข้อมูล'
      });
    } else if (m2.accountingSoftware === 'cpd_software') {
      strengths.push({
        category: 'M2',
        text: 'สหกรณ์ใช้โปรแกรมระบบคอมพิวเตอร์ที่พัฒนาโดยกรมตรวจบัญชีสหกรณ์'
      });
    } else if (m2.accountingSoftware === 'manual') {
      improvements.push({
        category: 'M2',
        text: 'สหกรณ์ยังใช้ระบบบันทึกบัญชีด้วยมือ ควรส่งเสริมให้ใช้โปรแกรมคอมพิวเตอร์'
      });
      actions.push({
        category: 'M2',
        code: '2.X2',
        goal: 'ส่งเสริมให้สหกรณ์นำโปรแกรมระบบคอมพิวเตอร์มาใช้ในการบริหารจัดการข้อมูล',
        target: '1',
        unit: 'ครั้ง'
      });
    }

    // ========================================================================
    // M3: การเงิน CAMELS
    // ========================================================================
    
    var assets = S.num(sum.assetsLatest) || S.num(bs.totalAssets);
    var liabilities = S.num(sum.liabilitiesLatest) || S.num(bs.totalLiabilities);
    var profit = S.num(sum.netProfitLatest) || S.num(bs.netProfitYear);
    var coopCapital = assets - liabilities;
    var reserve = S.num(sum.reserveFundLatest);
    
    var deRatio = S.num(ratios.deRatio) || (coopCapital > 0 ? liabilities / coopCapital : 0);
    var currentRatio = S.num(ratios.currentRatio) || 
      (S.num(bs.currentLiabilities) ? S.num(bs.currentAssets) / S.num(bs.currentLiabilities) : 0);
    var roe = S.num(ratios.roe);
    var roa = S.num(ratios.roa);
    var reserveRatio = S.num(ratios.reserveToAssetRatio) || (assets > 0 ? reserve / assets : 0);
    
    // อัตราหมุนของสินทรัพย์ = รายได้รวม / สินทรัพย์รวม
    var income = S.num(N.totalIncome);
    var assetTurnover = assets > 0 ? income / assets : 0;
    
    // อัตราเติบโตของสินทรัพย์
    var assetsPrev = S.num(sum.assetsPrev);
    var assetGrowth = assetsPrev > 0 ? ((assets - assetsPrev) / assetsPrev) * 100 : 0;
    
    // อัตราเติบโตของกำไร
    var profitPrev = S.num(sum.netProfitPrev);
    var profitGrowth = profitPrev > 0 ? ((profit - profitPrev) / profitPrev) * 100 : 0;
    
    // เงินออมเฉลี่ยต่อคน
    var avgSaving = S.num(N.avgSaving);
    var avgDebt = S.num(N.avgDebt);
    
    // อัตราการชำระหนี้ได้ตามกำหนด
    var shortTermPaidRatio = S.num(ratios.shortTermDebtPaidOnTimeRatio);

    // D/E < 1 และ ทุนหมุนเวียน > 2
    if (deRatio < 1 && currentRatio > 2) {
      strengths.push({
        category: 'M3',
        text: 'โครงสร้างการเงินมีความมั่นคง (D/E = ' + S.fmt(deRatio, 2) + ' เท่า) และมีสภาพคล่องสูง (ทุนหมุนเวียน = ' + S.fmt(currentRatio, 2) + ' เท่า)'
      });
    }

    // ทุนสำรองต่อสินทรัพย์ < 0.10
    if (reserveRatio < 0.10 && reserveRatio > 0) {
      improvements.push({
        category: 'M3',
        text: 'อัตราส่วนทุนสำรองต่อสินทรัพย์ต่ำ (' + S.fmt(reserveRatio, 2) + ' เท่า) ควรเพิ่มทุนสำรอง'
      });
      actions.push({
        category: 'M3',
        code: '3.X1',
        goal: 'แนะนำส่งเสริมให้สหกรณ์เพิ่มทุนสำรอง เพื่อเพิ่มอัตราส่วนทุนสำรองต่อสินทรัพย์',
        target: '1',
        unit: 'ครั้ง'
      });
    }

    // อัตราหมุนของสินทรัพย์ < 0.10
    if (assetTurnover < 0.10 && assetTurnover > 0) {
      improvements.push({
        category: 'M3',
        text: 'อัตราหมุนของสินทรัพย์ต่ำ (' + S.fmt(assetTurnover, 2) + ' รอบ) แสดงว่ามีสินทรัพย์ที่ไม่สร้างรายได้'
      });
      actions.push({
        category: 'M3',
        code: '3.X2',
        goal: 'แนะนำการบริหารสินทรัพย์ที่มีอยู่และสภาพคล่องส่วนเกินให้เกิดผลตอบแทนสูงสุด',
        target: '1',
        unit: 'ครั้ง'
      });
    }

    // ROE ต่ำ
    if (roe > 0 && roe < 3) {
      improvements.push({
        category: 'M3',
        text: 'อัตราผลตอบแทนต่อทุน (ROE) ต่ำ (' + S.fmt(roe, 2) + '%) ควรปรับปรุงประสิทธิภาพการดำเนินงาน'
      });
    }

    // ========================================================================
    // M4: การจัดการ และการควบคุมภายใน
    // ========================================================================
    
    // ปิดบัญชี <= 30 วัน และ ประชุมใหญ่ <= 150 วัน
    var closeAccountDays = S.num(m4.closeAccountDays);
    var agmDays = S.num(m4.agmDays);
    
    if (closeAccountDays > 0 && closeAccountDays <= 30 && agmDays > 0 && agmDays <= 150) {
      strengths.push({
        category: 'M4',
        text: 'สหกรณ์มีมาตรฐานบัญชีที่ดี สามารถปิดบัญชีภายใน ' + closeAccountDays + ' วัน และจัดประชุมใหญ่ภายใน ' + agmDays + ' วัน'
      });
    }

    // ไม่มีแผนกลยุทธ์
    if (m4.hasStrategicPlan === false) {
      improvements.push({
        category: 'M4',
        text: 'สหกรณ์ยังไม่มีแผนกลยุทธ์ระยะยาว'
      });
      actions.push({
        category: 'M4',
        code: '2.X3',
        goal: 'แนะนำส่งเสริมให้สหกรณ์มีการจัดทำแผนกลยุทธ์ และ/หรือร่วมจัดทำแผนกลยุทธ์กับสหกรณ์',
        target: '1',
        unit: 'ครั้ง'
      });
    }

    // ระดับการควบคุมภายใน
    if (m4.internalControlLevel === 'ดีมาก') {
      strengths.push({
        category: 'M4',
        text: 'ระบบการควบคุมภายในอยู่ในระดับดีมาก'
      });
    } else if (m4.internalControlLevel === 'ควรปรับปรุง') {
      improvements.push({
        category: 'M4',
        text: 'ระบบการควบคุมภายในควรได้รับการปรับปรุง'
      });
      actions.push({
        category: 'M4',
        code: '2.X4',
        goal: 'ส่งเสริมการปรับปรุงระบบการควบคุมภายในและการบริหารจัดการความเสี่ยง',
        target: '1',
        unit: 'ครั้ง'
      });
    }

    // ========================================================================
    // ข้อสังเกตผู้สอบบัญชี (Auditor Observations)
    // ========================================================================
    
    if (auditorObs.hasInternalControlWeakness === false) {
      strengths.push({
        category: 'AUD',
        text: 'ไม่พบข้อสังเกตเกี่ยวกับจุดอ่อนของการควบคุมภายในจากรายงานผลการตรวจสอบบัญชีปีล่าสุด'
      });
    } else if (auditorObs.hasInternalControlWeakness === true) {
      // พบจุดอ่อน
      var details = auditorObs.details || '';
      var categories = auditorObs.weaknessCategories || [];
      var correctionStatus = auditorObs.correctionStatus || '';
      
      improvements.push({
        category: 'AUD',
        text: 'พบข้อสังเกตเกี่ยวกับจุดอ่อนของการควบคุมภายใน: ' + (details || categories.join(', '))
      });
      
      // สร้างแผนกิจกรรม
      if (details) {
        actions.push({
          category: 'AUD',
          code: '3.X3',
          goal: 'แนะนำส่งเสริมและติดตามให้สหกรณ์แก้ไขข้อสังเกตของผู้สอบบัญชีเกี่ยวกับจุดอ่อนของการควบคุมภายใน ประเด็น: ' + details.substring(0, 100) + (details.length > 100 ? '...' : ''),
          target: '1',
          unit: 'ครั้ง'
        });
      }
      
      // Warning: ถ้าควบคุมภายในดีมาก แต่มีข้อสังเกตที่ยังไม่ได้แก้ไข
      if (m4.internalControlLevel === 'ดีมาก' && correctionStatus === 'ยังไม่ได้ดำเนินการ') {
        warnings.push({
          category: 'AUD',
          text: '⚠️ ข้อมูลไม่สอดคล้อง: ระดับการควบคุมภายในระบุ "ดีมาก" แต่มีข้อสังเกตผู้สอบบัญชีที่ยังไม่ได้ดำเนินการ กรุณาทบทวนข้อมูล'
        });
      }
    }

    // ========================================================================
    // ไทม์ไลน์ตามวันสิ้นปีบัญชี
    // ========================================================================
    
    var fiscalEndDate = p.fiscalEndDate || '';
    if (fiscalEndDate) {
      var timeline = calculateFiscalTimeline(fiscalEndDate);
      if (timeline.closeAccountDate && timeline.agmDate) {
        strengths.push({
          category: 'TL',
          text: 'กรอบเวลา: ปิดบัญชีภายใน ' + timeline.closeAccountDate + ' (30 วัน), ประชุมใหญ่ภายใน ' + timeline.agmDate + ' (150 วัน)'
        });
      }
    }

    return {
      strengths: strengths,
      improvements: improvements,
      actions: actions,
      warnings: warnings
    };
  }

  /**
   * คำนวณกรอบเวลาจากวันสิ้นปีบัญชี
   * @param {string} fiscalEndDate - เช่น "31 ธันวาคม", "30 กันยายน"
   * @returns {Object} { closeAccountDate, agmDate }
   */
  function calculateFiscalTimeline(fiscalEndDate) {
    var thaiMonths = {
      'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3,
      'พฤษภาคม': 4, 'มิถุนายน': 5, 'กรกฎาคม': 6, 'สิงหาคม': 7,
      'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11
    };
    
    var match = fiscalEndDate.match(/(\d{1,2})\s+(.+)/);
    if (!match) return {};
    
    var day = parseInt(match[1]);
    var monthName = match[2].trim();
    var month = thaiMonths[monthName];
    
    if (month === undefined) return {};
    
    var planYear = 2570; // ปีงบประมาณปัจจุบัน
    var endDate = new Date(planYear - 543, month, day);
    
    // ปิดบัญชีภายใน 30 วัน
    var closeDate = new Date(endDate.getTime() + 30 * 86400000);
    
    // ประชุมใหญ่ภายใน 150 วัน
    var agmDate = new Date(endDate.getTime() + 150 * 86400000);
    
    return {
      closeAccountDate: formatDateThai(closeDate),
      agmDate: formatDateThai(agmDate)
    };
  }

  function formatDateThai(date) {
    var thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return date.getDate() + ' ' + thaiMonths[date.getMonth()] + ' ' + (date.getFullYear() + 543);
  }

  /**
   * สร้างข้อความสรุปผลการวิเคราะห์
   * @param {Object} result - ผลจาก analyze()
   * @returns {string}
   */
  function formatAnalysisReport(result) {
    var lines = [];
    
    if (result.strengths.length > 0) {
      lines.push('【จุดแข็ง】');
      result.strengths.forEach(function (s) {
        lines.push('  ✓ ' + s.text);
      });
      lines.push('');
    }
    
    if (result.improvements.length > 0) {
      lines.push('【จุดที่ควรส่งเสริม/พัฒนา】');
      result.improvements.forEach(function (s) {
        lines.push('  ▸ ' + s.text);
      });
      lines.push('');
    }
    
    if (result.warnings.length > 0) {
      lines.push('【คำเตือน】');
      result.warnings.forEach(function (s) {
        lines.push('  ' + s.text);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  // =========================================================================
  // Public API
  // =========================================================================

  var S = global.CPD_STATE || {};

  global.CPD_4M_ENGINE = {
    analyze: analyze,
    formatAnalysisReport: formatAnalysisReport,
    calculateFiscalTimeline: calculateFiscalTimeline,
    version: '20260214a'
  };

})(window);

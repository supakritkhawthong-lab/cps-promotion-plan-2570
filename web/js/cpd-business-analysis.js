/**
 * cpd-business-analysis.js — Dynamic Business Analysis Generator
 * 
 * สร้างข้อความวิเคราะห์ธุรกิจแบบละเอียดสำหรับ 6 ธุรกิจหลัก
 * อ้างอิง 7 ประเด็นมาตรฐานของแต่ละธุรกิจ
 * 
 * Usage:
 *   window.CPD_BIZ_ENGINE.generateDepositAnalysis(state) -> text
 *   window.CPD_BIZ_ENGINE.generateAllAnalyses(state) -> { deposit: text, loan: text, ... }
 */
(function (global) {
  'use strict';

  var S = global.CPD_STATE || {};

  // Helper: format number with Thai locale
  function fmt(n, decimals) {
    if (n === undefined || n === null || n === '') return '0';
    var num = Number(n);
    if (!isFinite(num)) return '0';
    var d = decimals !== undefined ? decimals : 2;
    return num.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtInt(n) {
    if (n === undefined || n === null || n === '') return '0';
    var num = Number(n);
    if (!isFinite(num)) return '0';
    return num.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  }

  // =========================================================================
  // 2.1 ธุรกิจรับฝากเงิน
  // =========================================================================
  function generateDepositAnalysis(state) {
    var bd = (state && state.businessDetails && state.businessDetails.deposit) || {};
    var membersTotal = (state && state.coopProfile && state.coopProfile.members) ?
      (Number(state.coopProfile.members.regularTotal) || 0) : 0;
    
    var participatingMembers = Number(bd.participatingMembers) || 0;
    var participationPct = membersTotal > 0 ? (participatingMembers / membersTotal * 100) : 0;
    var depositMonthlyAvg = Number(bd.depositDuringYear) > 0 ? Number(bd.depositDuringYear) / 12 : 0;

    var lines = [];
    lines.push('2.1 ธุรกิจรับฝากเงิน');
    lines.push('');

    // 1. แผนธุรกิจ
    lines.push('1) ' + (bd.hasPlan ? 'สหกรณ์มีแผนธุรกิจรับฝากเงิน' : 'ยังไม่มีการกำหนดแผนเฉพาะธุรกิจรับฝากเงิน'));

    // 2. ประเภทเงินฝาก + อัตราดอกเบี้ย
    lines.push('2) สหกรณ์มีเงินรับฝาก ' + (bd.depositTypesDesc || 'ออมทรัพย์, ฝากประจำ') +
      ' (เช่น เงินรับฝากพิเศษ อัตราดอกเบี้ยร้อยละ ' + fmt(bd.specialDepositRate) +
      ' และเงินฝากประจำสูงสุด อัตราดอกเบี้ยร้อยละ ' + fmt(bd.fixedDepositRate) + ')');

    // 3. ผลการดำเนินงาน
    lines.push('3) สหกรณ์รับฝากเงินระหว่างปี ' + fmt(bd.depositDuringYear) + ' บาท เฉลี่ยเดือนละ ' + fmt(depositMonthlyAvg) +
      ' บาท วันสิ้นปีมีเงินรับฝากคงเหลือ ' + fmtInt(bd.depositEndAccounts) + ' บัญชี เป็นเงิน ' + fmt(bd.depositEndBalance) +
      ' บาท มีดอกเบี้ยจ่ายคิดเป็นร้อยละ ' + fmt(bd.depositInterestCostPct) +
      ' ของรายได้ดอกเบี้ยและผลตอบแทนจากการลงทุน ไม่มีผลการดำเนินธุรกิจเฉพาะแยกส่วน เพราะการรับฝากเงินเป็นทุนหมุนเวียนในการดำเนินธุรกิจของสหกรณ์');

    // 4. ความเป็นไปตามระเบียบ
    lines.push('4) ' + (bd.isCompliant !== false ? 'การดำเนินธุรกิจเป็นไปตามระเบียบ' : (bd.nonCompliantNote || 'การดำเนินธุรกิจไม่เป็นไปตามระเบียบ')));

    // 5. การมีส่วนร่วมของสมาชิก
    lines.push('5) การมีส่วนร่วมระหว่างปีจำนวน ' + fmtInt(participatingMembers) + ' ราย (คิดเป็นร้อยละ ' + fmt(participationPct, 1) +
      ' ของสมาชิกทั้งหมด) มูลค่ารวม ' + fmt(bd.depositDuringYear) + ' บาท');

    // 6. เจ้าหน้าที่
    lines.push('6) ' + (bd.staffCompetencyNote || 'เจ้าหน้าที่ปฏิบัติงานมีความรู้ความสามารถเพียงพอ'));

    // 7. โอกาส/ปัญหา
    lines.push('7) ' + (bd.opportunityOrIssueNote || 'ควรส่งเสริมการออมและจูงใจให้สมาชิกเข้ามาใช้บริการฝากเงินกับสหกรณ์เพิ่มขึ้น'));

    return lines.join('\n');
  }

  // =========================================================================
  // 2.2 ธุรกิจให้สินเชื่อ
  // =========================================================================
  function generateLoanAnalysis(state) {
    var bd = (state && state.businessDetails && state.businessDetails.loan) || {};
    var membersTotal = (state && state.coopProfile && state.coopProfile.members) ?
      (Number(state.coopProfile.members.regularTotal) || 0) : 0;
    
    var participatingMembers = Number(bd.participatingMembers) || 0;
    var participationPct = membersTotal > 0 ? (participatingMembers / membersTotal * 100) : 0;
    var loanMonthlyAvg = Number(bd.loanDisbursedYear) > 0 ? Number(bd.loanDisbursedYear) / 12 : 0;

    var lines = [];
    lines.push('2.2 ธุรกิจให้สินเชื่อ / เงินกู้');
    lines.push('');

    // 1. แผนธุรกิจ
    lines.push('1) ' + (bd.hasPlan ? 'สหกรณ์มีแผนธุรกิจสินเชื่อ' : 'ยังไม่มีการกำหนดแผนเฉพาะธุรกิจสินเชื่อ'));

    // 2. ประเภทสินเชื่อ
    lines.push('2) สหกรณ์มีเงินกู้ ' + (bd.loanTypesCount || 3) + ' ประเภท คือ เงินกู้สามัญ อัตราดอกเบี้ยร้อยละ ' +
      fmt(bd.ordinaryLoanRate) + ', เงินกู้พิเศษ อัตราดอกเบี้ยร้อยละ ' + fmt(bd.specialLoanRate) +
      ' และเงินกู้ฉุกเฉิน อัตราดอกเบี้ยร้อยละ ' + fmt(bd.emergencyLoanRate));

    // 3. ผลการดำเนินงาน
    lines.push('3) ในระหว่างปีสหกรณ์จ่ายเงินกู้ให้กับสมาชิกจำนวน ' + fmt(bd.loanDisbursedYear) + ' บาท เฉลี่ยเดือนละ ' +
      fmt(loanMonthlyAvg) + ' บาท วันสิ้นปีมีลูกหนี้เงินให้กู้คงเหลือ ' + fmtInt(bd.loanEndBorrowers) + ' ราย เป็นเงิน ' +
      fmt(bd.loanEndBalance) + ' บาท โดยสหกรณ์มีรายได้ดอกเบี้ยและผลตอบแทนจากการลงทุน จำนวน ' +
      fmt(bd.interestIncomeTotal) + ' บาท คิดเป็นร้อยละ ' + fmt(bd.interestIncomePct) +
      ' ของรายได้รวม (อัตราการชำระหนี้ได้ตามกำหนดร้อยละ ' + fmt(bd.repaymentRate, 1) + ')');

    // 4. ความเป็นไปตามระเบียบ
    lines.push('4) ' + (bd.isCompliant !== false ? 'การดำเนินธุรกิจเป็นไปตามระเบียบ' : (bd.nonCompliantNote || 'การดำเนินธุรกิจไม่เป็นไปตามระเบียบ')));

    // 5. การมีส่วนร่วม
    lines.push('5) จำนวน ' + fmtInt(participatingMembers) + ' ราย (คิดเป็นร้อยละ ' + fmt(participationPct, 1) +
      ' ของสมาชิกทั้งหมด) เป็นเงิน ' + fmt(bd.loanDisbursedYear) + ' บาท');

    // 6. เจ้าหน้าที่
    lines.push('6) ' + (bd.staffCompetencyNote || 'เจ้าหน้าที่ปฏิบัติงานมีความรู้ความสามารถเพียงพอ'));

    // 7. โอกาส/ปัญหา
    lines.push('7) ' + (bd.opportunityOrIssueNote || 'ควรเพิ่มประเภทสินเชื่อเพื่อดึงดูดให้สมาชิกมากู้เงิน เนื่องจากสมาชิกที่กู้เงินเป็นกลุ่มรายได้น้อย เงินฝากน้อย แต่สมาชิกที่ถือหุ้นเยอะและมีเงินฝากเยอะไม่ค่อยกู้เงิน'));

    return lines.join('\n');
  }

  // =========================================================================
  // 2.3 ธุรกิจจัดหาสินค้ามาจำหน่าย
  // =========================================================================
  function generateTradingAnalysis(state) {
    var bd = (state && state.businessDetails && state.businessDetails.trading) || {};
    var membersTotal = (state && state.coopProfile && state.coopProfile.members) ?
      (Number(state.coopProfile.members.regularTotal) || 0) : 0;
    
    var participatingMembers = Number(bd.participatingMembers) || 0;
    var participationPct = membersTotal > 0 ? (participatingMembers / membersTotal * 100) : 0;
    var salesMonthlyAvg = Number(bd.salesVolumeYear) > 0 ? Number(bd.salesVolumeYear) / 12 : 0;
    var netResult = Number(bd.netBusinessResult) || 0;

    var lines = [];
    lines.push('2.3 ธุรกิจจัดหาสินค้ามาจำหน่าย');
    lines.push('');

    // 1. แผนธุรกิจ
    lines.push('1) ' + (bd.hasPlan ? 'สหกรณ์มีแผนธุรกิจจัดหาสินค้ามาจำหน่ายประจำปี' : 'ยังไม่มีแผนเฉพาะธุรกิจจัดหาสินค้ามาจำหน่ายที่ชัดเจน'));

    // 2. ประเภทสินค้า + ราคา
    lines.push('2) สหกรณ์จัดหาสินค้าประเภท ' + (bd.productTypes || 'ปุ๋ย, เมล็ดพันธุ์, อาหารสัตว์') +
      ' มาจำหน่ายให้แก่สมาชิกและบุคคลภายนอก โดยเป็นการจำหน่ายแบบ ' + (bd.salesTerms || 'ขายเงินสดและขายเชื่อให้สมาชิกในราคายุติธรรม/ต่ำกว่าท้องตลาด'));

    // 3. ผลการดำเนินงาน
    var profitPhrase = netResult >= 0
      ? 'มีกำไรสุทธิ ' + fmt(netResult) + ' บาท เนื่องจากบริหารต้นทุนได้ดีและมีการสั่งซื้อรวมกันเป็นล็อตใหญ่'
      : 'ขาดทุนสุทธิ ' + fmt(Math.abs(netResult)) + ' บาท เนื่องจากต้นทุนสินค้าสูงขึ้นและมีค่าใช้จ่ายในการบริหารจัดการ';
    lines.push('3) ในระหว่างปีสหกรณ์มีมูลค่าจำหน่ายสินค้ารวม ' + fmt(bd.salesVolumeYear) + ' บาท เฉลี่ยเดือนละ ' +
      fmt(salesMonthlyAvg) + ' บาท มีต้นทุนขาย ' + fmt(bd.costOfGoodsSold) + ' บาท ได้กำไรขั้นต้น ' + fmt(bd.grossProfit) +
      ' บาท (คิดเป็นอัตรากำไรขั้นต้นร้อยละ ' + fmt(bd.grossMarginPct, 1) + ') ผลการดำเนินธุรกิจเฉพาะส่วน ' + profitPhrase +
      ' วันสิ้นปีมีลูกหนี้การค้าคงเหลือ ' + fmt(bd.tradeReceivables) + ' บาท และสินค้าคงเหลือ ' + fmt(bd.inventoryEnd) + ' บาท');

    // 4. ความเป็นไปตามระเบียบ
    lines.push('4) ' + (bd.isCompliant !== false ? 'การดำเนินธุรกิจการจัดซื้อและการขายเป็นไปตามระเบียบของสหกรณ์' : (bd.nonCompliantNote || 'การดำเนินธุรกิจไม่เป็นไปตามระเบียบ')));

    // 5. การมีส่วนร่วม
    lines.push('5) สมาชิกมีส่วนร่วมอุดหนุนสินค้าจำนวน ' + fmtInt(participatingMembers) + ' ราย (คิดเป็นร้อยละ ' +
      fmt(participationPct, 1) + ' ของสมาชิกทั้งหมด) มูลค่ารวม ' + fmt(bd.memberSalesAmount) + ' บาท');

    // 6. เจ้าหน้าที่
    lines.push('6) ' + (bd.staffCompetencyNote || 'เจ้าหน้าที่จัดซื้อและขายสินค้ามีความรู้ความสามารถในการบริหารสต็อกและให้บริการสมาชิก'));

    // 7. โอกาส/ปัญหา
    lines.push('7) ' + (bd.opportunityOrIssueNote || 'ควรสำรวจความต้องการปัจจัยการผลิตของสมาชิกล่วงหน้าเพื่อรวมซื้อในราคาต้นทุนที่ต่ำลง และบริหารสินค้าคงคลังไม่ให้เสื่อมสภาพหรือค้างสต็อก'));

    return lines.join('\n');
  }

  // =========================================================================
  // 2.4 ธุรกิจรวบรวมผลิตผล
  // =========================================================================
  function generateCollectionAnalysis(state) {
    var bd = (state && state.businessDetails && state.businessDetails.collection) || {};
    var membersTotal = (state && state.coopProfile && state.coopProfile.members) ?
      (Number(state.coopProfile.members.regularTotal) || 0) : 0;
    
    var participatingMembers = Number(bd.participatingMembers) || 0;
    var participationPct = membersTotal > 0 ? (participatingMembers / membersTotal * 100) : 0;
    var netResult = Number(bd.netBusinessResult) || 0;

    var lines = [];
    lines.push('2.4 ธุรกิจรวบรวมผลิตผล');
    lines.push('');

    // 1. แผนธุรกิจ
    lines.push('1) ' + (bd.hasPlan ? 'สหกรณ์มีแผนการรวบรวมผลิตผลตามฤดูกาลผลิตของสมาชิก' : 'ยังไม่มีแผนการรวบรวมผลิตผลที่ชัดเจน'));

    // 2. ประเภทผลิตผล + รูปแบบ
    lines.push('2) สหกรณ์รวบรวมผลิตผลทางการเกษตร ได้แก่ ' + (bd.cropTypes || 'ข้าวเปลือก, มันสำปะหลัง') +
      ' ในรูปแบบ ' + (bd.collectionMethod || 'ซื้อขาดจากสมาชิกตามราคาตลาดนำและบวกเพิ่มตามคุณภาพ/ความชื้น'));

    // 3. ผลการดำเนินงาน
    var profitPhrase = netResult >= 0
      ? 'มีกำไรสุทธิ ' + fmt(netResult) + ' บาท เนื่องจากสามารถบริหารจัดการคุณภาพผลผลิตและมีตลาดรับซื้อที่แน่นอน'
      : 'ขาดทุนสุทธิ ' + fmt(Math.abs(netResult)) + ' บาท เนื่องจากความผันผวนของราคาตลาดและการสูญเสียน้ำหนัก/ความชื้นระหว่างรวบรวม';
    lines.push('3) ในระหว่างปีสหกรณ์รวบรวมผลิตผลได้ปริมาณรวม ' + fmt(bd.collectionQuantity, 0) + ' ตัน/กก. คิดเป็นมูลค่ารับซื้อ ' +
      fmt(bd.collectionValueYear) + ' บาท จำหน่ายได้มูลค่ารวม ' + fmt(bd.collectionSalesValue) + ' บาท ได้กำไรขั้นต้น ' +
      fmt(bd.grossProfit) + ' บาท (ร้อยละ ' + fmt(bd.grossMarginPct, 1) + ') ผลการดำเนินธุรกิจ ' + profitPhrase);

    // 4. ความเป็นไปตามระเบียบ
    lines.push('4) ' + (bd.isCompliant !== false ? 'การรับซื้อ ชั่งน้ำหนัก ตรวจวัดคุณภาพ และชำระเงินเป็นไปตามระเบียบ' : (bd.nonCompliantNote || 'การดำเนินธุรกิจไม่เป็นไปตามระเบียบ')));

    // 5. การมีส่วนร่วม
    lines.push('5) สมาชิกนำผลผลิตมาจำหน่ายให้สหกรณ์จำนวน ' + fmtInt(participatingMembers) + ' ราย (คิดเป็นร้อยละ ' +
      fmt(participationPct, 1) + ' ของสมาชิกทั้งหมด) มูลค่ารวม ' + fmt(bd.collectionValueYear) + ' บาท');

    // 6. เจ้าหน้าที่
    lines.push('6) ' + (bd.staffCompetencyNote || 'เจ้าหน้าที่มีทักษะในการตรวจสอบคุณภาพผลผลิต การคัดเกรด และการเก็บรักษาในฉาง/ไซโล'));

    // 7. โอกาส/ปัญหา
    lines.push('7) ' + (bd.opportunityOrIssueNote || 'มีโอกาสขยายปริมาณการรวบรวมหากเสริมสภาพคล่องเงินทุนหมุนเวียนช่วงฤดูเก็บเกี่ยว พัฒนาอุปกรณ์รวบรวม/ลานตาก และทำสัญญาซื้อขายล่วงหน้ากับคู่ค้า'));

    return lines.join('\n');
  }

  // =========================================================================
  // 2.5 ธุรกิจแปรรูปผลผลิต
  // =========================================================================
  function generateProcessingAnalysis(state) {
    var bd = (state && state.businessDetails && state.businessDetails.processing) || {};
    var membersTotal = (state && state.coopProfile && state.coopProfile.members) ?
      (Number(state.coopProfile.members.regularTotal) || 0) : 0;
    
    var participatingMembers = Number(bd.participatingMembers) || 0;
    var participationPct = membersTotal > 0 ? (participatingMembers / membersTotal * 100) : 0;
    var netResult = Number(bd.netBusinessResult) || 0;

    var lines = [];
    lines.push('2.5 ธุรกิจแปรรูปผลผลิตการเกษตรและผลิตสินค้า');
    lines.push('');

    // 1. แผนธุรกิจ
    lines.push('1) ' + (bd.hasPlan ? 'สหกรณ์มีแผนการแปรรูปและการตลาดรองรับชัดเจน' : 'ยังไม่มีแผนธุรกิจแปรรูปที่ชัดเจน'));

    // 2. ประเภทสินค้า + มาตรฐาน
    lines.push('2) สหกรณ์ดำเนินการแปรรูป ' + (bd.processedProducts || 'ข้าวสาร, ยางแผ่นรมควัน') +
      ' ได้รับมาตรฐาน ' + (bd.qualityStandards || 'อย., GMP, GAP, OTOP') +
      ' จำหน่ายผ่านช่องทาง ' + (bd.marketingChannels || 'ร้านสหกรณ์, ขายตรง'));

    // 3. ผลการดำเนินงาน
    var profitPhrase = netResult >= 0
      ? 'มีกำไรสุทธิ ' + fmt(netResult) + ' บาท ช่วยสร้างมูลค่าเพิ่มให้ผลผลิตของสมาชิก'
      : 'ขาดทุนสุทธิ ' + fmt(Math.abs(netResult)) + ' บาท เนื่องจากใช้กำลังการผลิตยังไม่เต็มประสิทธิภาพทำให้ต้นทุนคงที่และค่าเสื่อมราคาต่อหน่วยสูง';
    lines.push('3) ในระหว่างปีใช้กำลังการผลิตคิดเป็นร้อยละ ' + fmt(bd.capacityUtilizationPct, 1) +
      ' ของกำลังการผลิตสูงสุด จำหน่ายสินค้าแปรรูปได้มูลค่ารวม ' + fmt(bd.processingSalesYear) + ' บาท มีต้นทุนการผลิตและแปรรูป ' +
      fmt(bd.productionCost) + ' บาท ได้กำไรขั้นต้น ' + fmt(bd.grossProfit) + ' บาท (ร้อยละ ' +
      fmt(bd.grossMarginPct, 1) + ') ผลการดำเนินธุรกิจ ' + profitPhrase);

    // 4. ความเป็นไปตามระเบียบ
    lines.push('4) ' + (bd.isCompliant !== false ? 'การดำเนินธุรกิจเป็นไปตามระเบียบและมาตรฐานสุขอนามัย' : (bd.nonCompliantNote || 'การดำเนินธุรกิจไม่เป็นไปตามระเบียบ')));

    // 5. การมีส่วนร่วม
    lines.push('5) สมาชิกมีส่วนร่วมส่งวัตถุดิบและอุดหนุนสินค้าแปรรูปจำนวน ' + fmtInt(participatingMembers) +
      ' ราย (ร้อยละ ' + fmt(participationPct, 1) + ' ของสมาชิกทั้งหมด) มูลค่ารวม ' + fmt(bd.memberParticipationValue) + ' บาท');

    // 6. เจ้าหน้าที่
    lines.push('6) ' + (bd.staffCompetencyNote || 'เจ้าหน้าที่ฝ่ายผลิตมีความชำนาญในการเดินเครื่องจักร แต่ควรพัฒนาทักษะด้านการตลาดออนไลน์และการออกแบบบรรจุภัณฑ์เพิ่มเติม'));

    // 7. โอกาส/ปัญหา
    lines.push('7) ' + (bd.opportunityOrIssueNote || 'ควรเพิ่มอัตราการใช้กำลังการผลิตให้คุ้มค่า ลดต้นทุนพลังงาน และขยายช่องทางการตลาดสู่โมเดิร์นเทรดหรือตลาดออนไลน์'));

    return lines.join('\n');
  }

  // =========================================================================
  // 2.6 ธุรกิจให้บริการ
  // =========================================================================
  function generateServiceAnalysis(state) {
    var bd = (state && state.businessDetails && state.businessDetails.service) || {};
    var membersTotal = (state && state.coopProfile && state.coopProfile.members) ?
      (Number(state.coopProfile.members.regularTotal) || 0) : 0;
    
    var participatingMembers = Number(bd.participatingMembers) || 0;
    var participationPct = membersTotal > 0 ? (participatingMembers / membersTotal * 100) : 0;
    var serviceMonthlyAvg = Number(bd.serviceIncomeYear) > 0 ? Number(bd.serviceIncomeYear) / 12 : 0;
    var netResult = Number(bd.netBusinessResult) || 0;

    var lines = [];
    lines.push('2.6 ธุรกิจให้บริการและส่งเสริมการเกษตร / บริการอื่นๆ');
    lines.push('');

    // 1. แผนธุรกิจ
    lines.push('1) ' + (bd.hasPlan ? 'สหกรณ์มีแผนการให้บริการแก่สมาชิก' : 'ยังไม่มีแผนธุรกิจบริการที่ชัดเจน'));

    // 2. ประเภทบริการ + อัตราค่าบริการ
    lines.push('2) สหกรณ์ให้บริการ ' + (bd.serviceTypes || 'รถไถ, รถเกี่ยว, ลานตาก') +
      ' โดยคิดอัตราค่าบริการ ' + (bd.serviceFeeRateDesc || 'ตามอัตราที่คณะกรรมการกำหนด') +
      ' ซึ่งช่วยลดต้นทุนและอำนวยความสะดวกให้แก่สมาชิก');

    // 3. ผลการดำเนินงาน
    var profitPhrase = netResult >= 0
      ? 'มีกำไรสุทธิจากการให้บริการ ' + fmt(netResult) + ' บาท'
      : 'มีรายจ่ายสูงกว่ารายได้ ' + fmt(Math.abs(netResult)) + ' บาท เนื่องจากค่าเสื่อมราคาเครื่องจักรและค่าซ่อมบำรุง แต่ถือเป็นการจัดบริการเพื่อลดต้นทุนการผลิตให้สมาชิก';
    lines.push('3) ในระหว่างปีสหกรณ์มีรายได้จากการให้บริการรวม ' + fmt(bd.serviceIncomeYear) + ' บาท เฉลี่ยเดือนละ ' +
      fmt(serviceMonthlyAvg) + ' บาท มีต้นทุนบริการและค่าซ่อมบำรุง/ค่าเสื่อมราคา ' + fmt(bd.serviceCost) +
      ' บาท ผลการดำเนินธุรกิจ ' + profitPhrase);

    // 4. ความเป็นไปตามระเบียบ
    lines.push('4) ' + (bd.isCompliant !== false ? 'การดำเนินธุรกิจให้บริการเป็นไปตามระเบียบ' : (bd.nonCompliantNote || 'การดำเนินธุรกิจไม่เป็นไปตามระเบียบ')));

    // 5. การมีส่วนร่วม
    lines.push('5) สมาชิกมาใช้บริการจำนวน ' + fmtInt(participatingMembers) + ' ราย (คิดเป็นร้อยละ ' +
      fmt(participationPct, 1) + ' ของสมาชิกทั้งหมด) มูลค่ารวม ' + fmt(bd.serviceIncomeYear) + ' บาท');

    // 6. เจ้าหน้าที่
    lines.push('6) ' + (bd.staffCompetencyNote || 'เจ้าหน้าที่ผู้ให้บริการและควบคุมเครื่องจักรมีความรู้ความชำนาญในการปฏิบัติงาน'));

    // 7. โอกาส/ปัญหา
    lines.push('7) ' + (bd.opportunityOrIssueNote || 'ควรวางแผนซ่อมบำรุงเครื่องจักรอุปกรณ์ตามระยะเวลา และจัดคิวการให้บริการในช่วงฤดูกาลผลิตให้เพียงพอต่อความต้องการของสมาชิก'));

    return lines.join('\n');
  }

  /**
   * isBusinessActive() - ตรวจสอบว่าธุรกิจมีข้อมูลจริงหรือไม่ (Auto-Detection)
   */
  function isBusinessActive(bizKey, state) {
    var bd = state && state.businessDetails || {};
    var biz = bd[bizKey];
    if (!biz) return false;
    
    // เช็กจากมูลค่าเงิน (สำคัญที่สุด)
    var valueFields = {
      deposit: ['depositDuringYear', 'depositEndBalance'],
      loan: ['loanDisbursedYear', 'loanEndBalance', 'interestIncomeTotal'],
      trading: ['salesVolumeYear', 'memberSalesAmount'],
      collection: ['collectionValueYear', 'collectionSalesValue'],
      processing: ['processingSalesYear', 'productionCost'],
      service: ['serviceIncomeYear', 'serviceCost']
    };
    
    var fields = valueFields[bizKey] || [];
    for (var i = 0; i < fields.length; i++) {
      if (biz[fields[i]] && Number(biz[fields[i]]) > 0) return true;
    }
    
    // เช็กจากจำนวนสมาชิกที่เข้าร่วม
    if (biz.participatingMembers && Number(biz.participatingMembers) > 0) return true;
    
    return false;
  }

  // =========================================================================
  // Generate All Analyses
  // =========================================================================
  function generateAllAnalyses(state) {
    var result = {};
    var bizKeys = ['deposit', 'loan', 'trading', 'collection', 'processing', 'service'];

    bizKeys.forEach(function (key) {
      if (isBusinessActive(key, state)) {
        var fn = {
          deposit: generateDepositAnalysis,
          loan: generateLoanAnalysis,
          trading: generateTradingAnalysis,
          collection: generateCollectionAnalysis,
          processing: generateProcessingAnalysis,
          service: generateServiceAnalysis
        }[key];
        if (fn) result[key] = fn(state);
      }
    });

    return result;
  }

  // =========================================================================
  // Generate Business Summary for Section 4
  // =========================================================================
  function generateBusinessSummary(state) {
    var bd = (state && state.businessDetails) || {};
    var issues = [];
    var bizKeys = ['deposit', 'loan', 'trading', 'collection', 'processing', 'service'];

    // Check each active business (auto-detect)
    bizKeys.forEach(function (bizKey) {
      if (!isBusinessActive(bizKey, state)) return;

      var biz = bd[bizKey] || {};
      var bizNames = {
        deposit: 'รับฝากเงิน',
        loan: 'ให้สินเชื่อ',
        trading: 'จัดหาสินค้ามาจำหน่าย',
        collection: 'รวบรวมผลิตผล',
        processing: 'แปรรูปผลผลิต',
        service: 'ให้บริการ'
      };
      var bizName = bizNames[bizKey] || bizKey;

      // 1. ไม่มีแผน
      if (!biz.hasPlan) {
        issues.push('แนะนำส่งเสริมการจัดทำแผนธุรกิจ' + bizName + ' ประจำปีให้สอดคล้องกับความต้องการของสมาชิก');
      }

      // 2. ขาดทุนหรืออัตรากำไรต่ำ
      var netResult = Number(biz.netBusinessResult) || 0;
      var grossMargin = Number(biz.grossMarginPct) || 0;
      if (netResult < 0 || (grossMargin > 0 && grossMargin < 10)) {
        issues.push('แนะนำการวิเคราะห์ต้นทุน จุดคุ้มทุน และการบริหารจัดการธุรกิจ' + bizName + ' เพื่อลดการขาดทุนและเพิ่มประสิทธิภาพ');
      }

      // 3. การมีส่วนร่วมต่ำ
      var membersTotal = (state && state.coopProfile && state.coopProfile.members) ?
        (Number(state.coopProfile.members.regularTotal) || 0) : 0;
      var participatingMembers = Number(biz.participatingMembers) || 0;
      var participationPct = membersTotal > 0 ? (participatingMembers / membersTotal * 100) : 0;
      if (participationPct < 50) {
        issues.push('แนะนำส่งเสริมการเพิ่มการมีส่วนร่วมของสมาชิกในธุรกิจ' + bizName + ' และการปรับปรุงรูปแบบบริการ/ประเภทสินเชื่อ/เงินฝาก/สินค้าให้จูงใจสมาชิก');
      }

      // 4. มีปัญหาอุปสรรค
      if (biz.opportunityOrIssueNote && biz.opportunityOrIssueNote.length > 0) {
        issues.push('ปัญหา/อุปสรรคในธุรกิจ' + bizName + ': ' + biz.opportunityOrIssueNote);
      }
    });

    return issues;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  global.CPD_BIZ_ENGINE = {
    isBusinessActive: isBusinessActive,
    generateDepositAnalysis: generateDepositAnalysis,
    generateLoanAnalysis: generateLoanAnalysis,
    generateTradingAnalysis: generateTradingAnalysis,
    generateCollectionAnalysis: generateCollectionAnalysis,
    generateProcessingAnalysis: generateProcessingAnalysis,
    generateServiceAnalysis: generateServiceAnalysis,
    generateAllAnalyses: generateAllAnalyses,
    generateBusinessSummary: generateBusinessSummary,
    version: '20260214f'
  };

})(window);

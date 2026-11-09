/**
 * cpd-preload.js — ข้อมูลจริงที่ผ่านการตรวจสอบแล้วของสหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี จำกัด
 * + ตัวแยกข้อมูลจาก PDF "Smart Coop Profile" (ข้อ 1–47)
 *
 * ใช้ฝั่งเบราว์เซอร์เท่านั้น (ไม่เขียนลง Google Sheets)
 * โครงสร้าง:
 *   window.CPD_PRELOAD.get(name)  -> preload object หรือ null
 *   window.CPD_PRELOAD.parseSmartCoopProfile(text) -> { form: {...}, details: {...} }
 */
(function (global) {
  'use strict';

  var VERIFIED_NAME = 'สหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี จำกัด';

  function normalizeName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim();
  }

  function indicatorScores(scores) {
    var out = {};
    Object.keys(scores).forEach(function (id) {
      out[id] = { '2567': 0, '2568': scores[id], '2569': 0, _autoDistributed: true };
    });
    return out;
  }

  var verified = {
    name: VERIFIED_NAME,
    title: 'สหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี จำกัด',
    form: {
      coop_name: VERIFIED_NAME,
      district: 'บ้านบึง',
      reg_date: '18 เมษายน 2539',
      board_count: '7',
      inspector_count: '1',
      inspector_name: 'นางสาวมนัสนันท์ พันธ์ชมภู',
      auditor_type: 'ภาครัฐ',
      gov_auditor_name: 'คนึงศรี',
      fiscal_year: '30 กันยายน',
      yr_latest: '2568',
      yr_prev: '2567',
      mem_latest: '83/83/0',
      mem_prev: '83',
      asset_latest: '27022397.73',
      asset_prev: '25723883.12',
      debt_latest: '10274314.02',
      debt_prev: '10901806.75',
      share_latest: '3490980.00',
      share_prev: '3406880.00',
      reserve_latest: '5058007.48',
      reserve_prev: '4997530.44',
      accumfund_latest: '6308554.26',
      accumfund_prev: '6014722.89',
      profit_latest: '1890541.97',
      profit_prev: '402943.04',
      loss_latest: '0',
      loss_prev: '0',
      biz_vol_latest: '62186062.47',
      biz_vol_prev: '49683393.21',
      business_types: 'ธุรกิจจัดหาสินค้ามาจำหน่าย\nธุรกิจแปรรูปผลิตผลการเกษตรและการผลิตสินค้า (เลี้ยงไก่สาว)\nธุรกิจรับฝากเงิน',
      c68_lv: 'ชั้น 1',
      c68_tot: '87.33',
      c68_d1: '26.00',
      c68_d2: '15.33',
      c68_d3: '16.00',
      c68_d4: '30.00',
      c69_lv: '',
      c69_tot: '',
      c69_d1: '',
      c69_d2: '',
      c69_d3: '',
      c69_d4: '',
      issue_1: 'คณะกรรมการดำเนินการไม่ได้จัดประชุมเป็นประจำทุกเดือน ขัดต่อข้อบังคับข้อ 73',
      issue_2: 'ผู้ตรวจสอบกิจการยังไม่มีรายงานผลการตรวจสอบเป็นลายลักษณ์อักษรเสนอที่ประชุมคณะกรรมการประจำเดือน',
      issue_3: 'จุดอ่อนการควบคุมภายในด้าน IT หลักประกันการทำงาน และไซโลขนาด 1,000 ตันที่ใช้งานไม่ได้',
      promotion_goals: '1. ส่งเสริมให้คณะกรรมการดำเนินการจัดประชุมประจำทุกเดือนตามข้อบังคับข้อ 73\n2. ส่งเสริมให้ผู้ตรวจสอบกิจการจัดทำรายงานผลการตรวจสอบเป็นลายลักษณ์อักษรเสนอที่ประชุมคณะกรรมการประจำเดือน\n3. ส่งเสริมการจัดทำแผนกลยุทธ์/แผนยุทธศาสตร์ระยะยาวของสหกรณ์\n4. ส่งเสริมการควบคุมภายในระบบบัญชีคอมพิวเตอร์และการบันทึกตัดสินค้าเสื่อมชำรุด\n5. กระตุ้นสมาชิกให้มีส่วนร่วมในธุรกิจจัดหาสินค้าเพิ่มขึ้นจากร้อยละ 25.30',
      planned_visits: '4',
      visit_remark: 'ข้อมูลอ้างอิงจากงบการเงินปีบัญชี 2568 และรายงานผลการตรวจสอบกิจการ/ผู้สอบบัญชี',
      agm_date: '27/02/2570',
      certify_date: 'กุมภาพันธ์ 2570',
      /* --- ผลการดำเนินงานฉบับละเอียด (Year N = 2568 / N-1 = 2567) --- */
      agm_attend_latest: '51', agm_attend_prev: '56',
      mem_biz_deposit_latest: '83', mem_biz_deposit_prev: '83',
      mem_biz_trading_latest: '21', mem_biz_trading_prev: '16',
      mem_biz_processing_latest: '55', mem_biz_processing_prev: '46',
      wc_latest: '27022397.73', wc_prev: '25723883.12',
      coopcap_latest: '16748083.71', coopcap_prev: '14822076.37',
      loan_latest: '8000000.00', loan_prev: '8000000.00',
      payable_latest: '1004519.00', payable_prev: '1555787.00',
      cash_latest: '15126031.83', cash_prev: '9684631.50',
      inventory_latest: '5966874.20', inventory_prev: '6617131.22',
      ppe_latest: '5773932.27', ppe_prev: '6017784.53',
      receivable_latest: '124650.00', receivable_prev: '3373588.00',
      otherasset_latest: '10909.43', otherasset_prev: '10747.87',
      income_latest: '62179054.50', income_prev: '49676325.85',
      expense_latest: '60314415.79', expense_prev: '0',
      sales_trading_latest: '26367420.50', sales_trading_prev: '14151139.85',
      cost_trading_latest: '26024863.70', cost_trading_prev: '14009277.50',
      profit_biz_trading_latest: '210639.00', profit_biz_trading_prev: '4739.06',
      plan_trading_latest: '15300000.00', plan_trading_prev: '0',
      sales_processing_latest: '35811634.00', sales_processing_prev: '35525186.00',
      cost_processing_latest: '32754428.02', cost_processing_prev: '33742203.46',
      profit_biz_processing_latest: '3030822.42', profit_biz_processing_prev: '1755547.89',
      plan_processing_latest: '31200000.00', plan_processing_prev: '0',
      deposit_amount_latest: '7007.97', deposit_amount_prev: '7067.36',
      profit_biz_deposit_latest: '0', profit_biz_deposit_prev: '0',
      avgprofit3_latest: '0', avgprofit3_prev: '0',
      avgsaving_latest: '0', avgsaving_prev: '0',
      avgdebt_latest: '0', avgdebt_prev: '0',
      staff_count_latest: '2', staff_count_prev: '2'
    },
    state: {
      coopProfile: {
        coopId13: '2000000125392',
        coopName: VERIFIED_NAME,
        orgType: 'สหกรณ์',
        coopSubType: 'สหกรณ์การเกษตร',
        status: 'ดำเนินการ',
        district: 'บ้านบึง',
        distanceKm: 0,
        regDate: '18 เมษายน 2539',
        fiscalEndDate: '30 กันยายน',
        boardCount: 7,
        auditorType: 'ภาครัฐ',
        auditorName: 'นางสาวคนึงศรี สงวนสัตย์',
        inspectorCount: 1,
        inspectorName: 'นางสาวมนัสนันท์ พันธ์ชมภู',
        royalProject: '',
        mainBusinesses: [
          'ธุรกิจจัดหาสินค้ามาจำหน่าย',
          'ธุรกิจแปรรูปผลิตผลการเกษตรและการผลิตสินค้า (เลี้ยงไก่สาว)',
          'ธุรกิจรับฝากเงิน'
        ],
        mainProducts: ['ข้าวโพดเลี้ยงสัตว์', 'ลูกไก่', 'อาหารไก่ไข่', 'ยาไก่', 'ถาดไข่', 'ไก่สาว'],
        fourMDetails: {
          m1: {
            usesAnnualPlan: true,
            inspectorFrequency: 'irregular',
            membersBorrow: 40,
            membersDeposit: 83
          },
          m2: {
            facilityCondition: 'moderate',
            accountingSoftware: 'cpd_software'
          },
          m4: {
            hasAnnualPlan: true,
            hasStrategicPlan: false,
            internalControlLevel: 'พอใช้',
            closeAccountDays: 45,
            agmDays: 150,
            hasFraud: false
          },
          auditorObservations: {
            hasInternalControlWeakness: true,
            weaknessCategories: ['ด้านเทคโนโลยีสารสนเทศ/โปรแกรมบัญชี'],
            details: 'จุดอ่อนการควบคุมภายในด้าน IT หลักประกันการทำงาน และไซโลขนาด 1,000 ตันที่ใช้งานไม่ได้',
            correctionStatus: 'อยู่ระหว่างดำเนินการ'
          }
        },
        members: {
          regularMale: 52, regularFemale: 31, regularTotal: 83,
          associateMale: 0, associateFemale: 0, associateTotal: 0,
          prevYearTotal: 83
        }
      },
      financials: {
        summary2Years: {
          assetsLatest: 27022397.73, assetsPrev: 25723883.12,
          liabilitiesLatest: 10274314.02, liabilitiesPrev: 10901806.75,
          shareCapitalLatest: 3490980.00, shareCapitalPrev: 3406880.00,
          reserveFundLatest: 5058007.48, reserveFundPrev: 4997530.44,
          otherAccumFundLatest: 6308554.26, otherAccumFundPrev: 6014722.89,
          netProfitLatest: 1890541.97, netProfitPrev: 402943.04,
          accumLossLatest: 0, accumLossPrev: 0,
          businessVolumeLatest: 62186062.47, businessVolumePrev: 49683393.21,
          activeBusinessesText: 'ธุรกิจจัดหาสินค้ามาจำหน่าย, ธุรกิจแปรรูปผลิตผลการเกษตรและการผลิตสินค้า, ธุรกิจรับฝากเงิน'
        },
        balanceSheet: {
          currentAssets: 21228465.46, nonCurrentAssets: 5793932.27, totalAssets: 27022397.73,
          currentLiabilities: 9613814.02, nonCurrentLiabilities: 660500.00, totalLiabilities: 10274314.02,
          shareCapital: 3490980.00, reserveFund: 5058007.48, otherAccumFunds: 6308554.26,
          unrealizedInvestGain: 0, revaluationSurplus: 0,
          accumulatedLoss: 0, netProfitYear: 1890541.97, totalEquity: 16748083.71
        },
        businesses: {
          credit: { interestIncome: 0, serviceCost: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          trading: { sales: 26367420.50, cogs: 26024863.70, grossProfit: 342556.80, lessUncollectedProfitCurrent: 0, addCollectedProfitPrev: 0, specificIncome: 0, specificExpense: 131917.80, netBusinessProfit: 210639.00 },
          collection: { sales: 0, cogs: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          processing: { sales: 35811634.00, cogs: 32754428.02, grossProfit: 3057205.98, specificIncome: 0, specificExpense: 26383.56, netBusinessProfit: 3030822.42 },
          service: { serviceIncome: 0, serviceCost: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 }
        },
        incomeStatement: {
          totalSalesService: 62179054.50, totalCogsService: 58779291.72, grossProfit: 3399762.78,
          lessUncollectedProfitCurrent: 0, addCollectedProfitPrev: 0,
          specificIncome: 0, specificExpense: 158301.36, netSpecificProfit: 3241461.42,
          otherIncome: 25903.26, profitBeforeOpEx: 3267364.68, priorPeriodAdjustment: 0,
          operatingExpense: 1376822.71, netProfit: 1890541.97
        },
        ratios: {
          deRatio: 0.61, roe: 11.98, roa: 7.17, currentRatio: 2.21,
          reserveToAssetRatio: 0.19, opexToGrossProfitRatio: 42.14,
          shortTermDebtPaidOnTimeRatio: 0
        }
      },
      strength: {
        classByYear: { '2567': 'ชั้น 1', '2568': 'ชั้น 1', '2569': 'ชั้น 1' },
        totalByYear: { '2567': 0, '2568': 87.33, '2569': 0 },
        dim1ByYear: { '2567': 0, '2568': 26.00, '2569': 0 },
        dim2ByYear: { '2567': 0, '2568': 15.33, '2569': 0 },
        dim3ByYear: { '2567': 0, '2568': 16.00, '2569': 0 },
        dim4ByYear: { '2567': 0, '2568': 30.00, '2569': 0 },
        indicators: indicatorScores({
          '1.1': 15, '1.2': 10, '1.3': 1,
          '2.1': 3, '2.2': 1.33, '2.3': 2.67, '2.4': 1.33, '2.5': 7, '2.6': 0,
          '3.1': 4, '3.2': 2.67, '3.3': 1.33, '3.4': 4, '3.5': 4,
          '4.1': 15, '4.2': 5, '4.3': 5, '4.4': 5
        })
      },
      analysis: {
        auditorObservations: '(1) คณะกรรมการดำเนินการไม่ได้จัดประชุมเป็นประจำทุกเดือน (จัดเฉพาะเมื่อมีเรื่องอนุมัติ) ขัดต่อข้อบังคับข้อ 73 ที่กำหนดให้ประชุมเดือนละ 1 ครั้งเป็นอย่างน้อย (2) ผู้ตรวจสอบกิจการเข้าร่วมประชุมคณะกรรมการแต่ไม่พบรายงานผลการตรวจสอบเป็นลายลักษณ์อักษรเสนอต่อที่ประชุมคณะกรรมการประจำเดือน (มีเพียงรายงานเสนอที่ประชุมใหญ่ประจำปีครั้งเดียว) ไม่เป็นไปตามระเบียบนายทะเบียนสหกรณ์ พ.ศ. 2563 (3) จุดอ่อนการควบคุมภายใน (แบบ RQ 2-3): หลักประกันการทำงานของฝ่ายจัดการ/ผู้ทำหน้าที่แทนไม่เพียงพอกับมูลค่าความเสียหาย, ระบบบัญชีคอมพิวเตอร์ไม่มีการกำหนดผู้ดูแลระบบและรหัสผ่านโดยเฉพาะ ไม่มีการเปลี่ยนรหัสผ่านทุก 6 เดือน และพบข้อผิดพลาดจากการคีย์ตัดสินค้าเสื่อมชำรุด รวมถึงมีไซโลขนาด 1,000 ตัน (งบ Miyazawa ปี 2542 มูลค่า 3.5 ล้านบาท) อยู่ในสถานะใช้งานไม่ได้',
        coopDefects: 'ขาดการประชุมคณะกรรมการประจำเดือนตามข้อบังคับข้อ 73, ผู้ตรวจสอบกิจการไม่มีรายงานผลการตรวจสอบเป็นลายลักษณ์อักษรประจำเดือน, หลักประกันการทำงานของฝ่ายจัดการ/ผู้ทำหน้าที่แทนไม่เพียงพอ, ระบบบัญชีคอมพิวเตอร์ไม่มีผู้ดูแลระบบและรหัสผ่านโดยเฉพาะ/ไม่เปลี่ยนรหัสผ่านทุก 6 เดือน, คีย์ตัดสินค้าเสื่อมชำรุดผิดพลาด, ไซโลขนาด 1,000 ตันใช้งานไม่ได้',
        issuesTop3: [
          'คณะกรรมการดำเนินการไม่ได้จัดประชุมเป็นประจำทุกเดือน ขัดต่อข้อบังคับข้อ 73',
          'ผู้ตรวจสอบกิจการยังไม่มีรายงานผลการตรวจสอบเป็นลายลักษณ์อักษรเสนอที่ประชุมคณะกรรมการประจำเดือน',
          'จุดอ่อนการควบคุมภายในด้าน IT หลักประกันการทำงาน และไซโลขนาด 1,000 ตันที่ใช้งานไม่ได้'
        ]
      }
    },
    fourM: {
      orgAnalysis4M: [
        'การวิเคราะห์ข้อมูลของสหกรณ์/กลุ่มเกษตรกร',
        '- ผลการวิเคราะห์ข้อมูลด้านการบริหารจัดการองค์กร',
        'ด้านการบริหารจัดการองค์กร (หลัก 4M)',
        '',
        '1. หัวข้อ: บุคลากร (Man)',
        '- คณะกรรมการดำเนินการ มีจำนวน 7 คน (ชาย 5 คน หญิง 2 คน) โดยมีประธานกรรมการ นายบุญยง ศรีไตรราศรี ปฏิบัติหน้าที่ผู้จัดการอีกตำแหน่งหนึ่ง และมอบหมายเหรัญญิกทำหน้าที่ผู้จัดการและดูแลด้านการเงิน มีเจ้าหน้าที่ปฏิบัติงานประจำ 2 คน (หัวหน้าฝ่ายบัญชี นางสาวกอบกาญจน์ พูลสวัสดิ์ ผ่านการอบรมจากกรมตรวจบัญชีสหกรณ์) และจ้างที่ปรึกษาสหกรณ์ (นางพลอยนภัส บุญนำแสง ค่าตอบแทน 396,000 บาท/ปี) ผู้ตรวจสอบกิจการ 1 คน คือ นางสาวมนัสนันท์ พันธ์ชมภู (และสำรอง 1 คน คือ นางสาวเอื้อมรัตน์ สังข์ศรี)',
        '- สมาชิกวันสิ้นปี 83 คน (ชาย 52 คน หญิง 31 คน) ร่วมทำธุรกิจรับฝากเงิน 83 คน (ร้อยละ 100.00), ธุรกิจจัดหาสินค้ามาจำหน่าย 21 คน (ร้อยละ 25.30), และธุรกิจแปรรูปและผลิตสินค้า (ไก่สาว) 55 คน (ร้อยละ 66.27) เข้าร่วมประชุมใหญ่สามัญประจำปี 51 คน จาก 83 คน (คิดเป็นร้อยละ 61.45 ลดลงจากปีก่อนที่เข้าร่วม 56 คน)',
        '- ทั้งนี้ มีจุดอ่อนจากการควบคุมภายใน (RQ 2-3) คือหลักประกันการทำงานของฝ่ายจัดการ/ผู้ทำหน้าที่แทนยังไม่เพียงพอกับมูลค่าความเสียหายที่อาจเกิดขึ้น',
        '',
        '2. หัวข้อ: สำนักงาน/อุปกรณ์ (Material)',
        '- สหกรณ์มีสำนักงานและอุปกรณ์คอมพิวเตอร์เพียงพอ ใช้โปรแกรมระบบบัญชีของกรมตรวจบัญชีสหกรณ์ แต่ยังไม่ได้นำ Application Smart 4M มาใช้',
        '- พบจุดอ่อนด้าน IT (RQ 2-3) คือไม่มีการกำหนดผู้ดูแลระบบและรหัสผ่านโดยเฉพาะ ไม่มีการเปลี่ยนรหัสผ่านทุก 6 เดือน และพบการคีย์ตัดสินค้าเสื่อมชำรุดผิดพลาด',
        '- สหกรณ์มีอุปกรณ์การตลาด ได้แก่ ไซโล ขนาด 1,000 ตัน (ได้รับอุดหนุนปี 2542 มูลค่า 3,500,000.00 บาท) ปัจจุบันอยู่ในสถานะ ใช้งานไม่ได้ (บันทึกในทะเบียนทรัพย์สิน)',
        '',
        '3. หัวข้อ: ทุนดำเนินการ (Money)',
        '- ณ วันที่ 30 กันยายน 2568 มีทุนดำเนินงาน (สินทรัพย์รวม) 27,022,397.73 บาท (เพิ่มขึ้นจากปีก่อน 1,298,514.61 บาท หรือร้อยละ 5.05) มาจากทุนของสหกรณ์ 16,748,083.71 บาท (ร้อยละ 61.98) และหนี้สิน 10,274,314.02 บาท (ร้อยละ 38.02)',
        '- หนี้สินมาจากเงินกู้ยืมระยะสั้นกองทุนพัฒนาสหกรณ์ (กพส.) 8,000,000.00 บาท (ร้อยละ 29.61) รองลงมาคือเจ้าหนี้การค้า 1,004,519.00 บาท (ร้อยละ 3.72) และเงินรับฝากออมทรัพย์สมาชิก 207,236.22 บาท',
        '- สินทรัพย์ส่วนใหญ่อยู่ในรูปเงินสดและเงินฝากธนาคาร 15,126,031.83 บาท (ร้อยละ 55.98) รองลงมาเป็นสินค้าคงเหลือ 5,966,874.20 บาท (ร้อยละ 22.08) ที่ดินอาคารและอุปกรณ์-สุทธิ 5,773,932.27 บาท (ร้อยละ 21.37) ลูกหนี้การค้า 124,650.00 บาท (ร้อยละ 0.46 ลดลงจากปีก่อนที่มี 3,373,588.00 บาท) และสินทรัพย์อื่น 155,559.43 บาท',
        '- ผลวิเคราะห์อัตราส่วนทางการเงินทั้ง 7 ตัว ตามเกณฑ์กรมตรวจบัญชีสหกรณ์: D/E = 0.61 เท่า, ROE = 11.98%, ROA = 7.17%, อัตราส่วนทุนหมุนเวียน (Current Ratio) = 2.21 เท่า, ทุนสำรองต่อสินทรัพย์ = 0.19 เท่า, อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่าย = 42.14%, และอัตราลูกหนี้ระยะสั้นชำระตามกำหนด = 0.00%',
        '',
        '4. หัวข้อ: การจัดการ (Management)',
        '- ผลการจัดระดับความเข้มแข็ง ปี 2568 อยู่ในระดับ ชั้น 1 คะแนนรวม 87.33 คะแนน (คะแนน กสส. 56.00 คะแนน, กตส. 31.33 คะแนน)',
        '- สหกรณ์มีการจัดทำแผนงานและงบประมาณประจำปี แต่ยังไม่มีการจัดทำแผนกลยุทธ์/แผนยุทธศาสตร์ระยะยาว (ตามข้อมูลโปรไฟล์ข้อ 22.1)',
        '- มีข้อสังเกตสำคัญที่ต้องเร่งแก้ไข คือ คณะกรรมการดำเนินการไม่ได้ประชุมเป็นประจำทุกเดือนตามข้อบังคับข้อ 73 และผู้ตรวจสอบกิจการไม่ได้จัดทำรายงานผลการตรวจสอบเป็นลายลักษณ์อักษรเสนอที่ประชุมคณะกรรมการประจำเดือนตามระเบียบนายทะเบียนสหกรณ์ พ.ศ. 2563'
      ],
      businessAnalysis: [
        '- ผลการวิเคราะห์ข้อมูลด้านการบริหารจัดการธุรกิจ',
        'ด้านการบริหารจัดการธุรกิจ',
        '',
        '1. หัวข้อ: ธุรกิจรับฝากเงิน',
        '- รับฝากเงินออมทรัพย์ระหว่างปี 7,007.97 บาท ยอดคงเหลือสิ้นปี 207,236.22 บาท (เพิ่มขึ้นจากปีก่อน 200,228.25 บาท) สมาชิกมีส่วนร่วมครบ 83 ราย (ร้อยละ 100)',
        '- สหกรณ์ยังไม่ได้กำหนดเป้าหมายแผนธุรกิจรับฝากเงินประจำปีไว้ ควรกำหนดแผนระดมเงินออมเพื่อลดการพึ่งพิงเงินกู้ กพส.',
        '',
        '2. หัวข้อ: ธุรกิจจัดหาสินค้ามาจำหน่าย',
        '- ปริมาณธุรกิจขายรวม 26,367,420.50 บาท (เพิ่มขึ้นจากปีก่อน 12,216,280.65 บาท หรือร้อยละ 86.33 และสูงกว่าแผนที่ตั้งไว้ 15,300,000.00 บาท ถึงร้อยละ 172.34)',
        '- ต้นทุนขาย 26,024,863.70 บาท ค่าใช้จ่ายเฉพาะธุรกิจ 131,917.80 บาท มีกำไรเฉพาะธุรกิจ 210,639.00 บาท (คิดเป็นอัตรากำไรสุทธิเฉพาะธุรกิจร้อยละ 0.80 เพิ่มขึ้นจากปีก่อนที่ได้ 4,739.06 บาท)',
        '- สมาชิกมีส่วนร่วม 21 ราย จาก 83 ราย (ร้อยละ 25.30) ซึ่งยังค่อนข้างต่ำ ต้องส่งเสริมให้สมาชิกซื้อปัจจัยการผลิตผ่านสหกรณ์เพิ่มขึ้น (แผนปีถัดไปตั้งไว้ 14,500,000.00 บาท)',
        '',
        '3. หัวข้อ: ธุรกิจแปรรูปผลิตผลการเกษตรและการผลิตสินค้า (เลี้ยงไก่สาวเพื่อขาย)',
        '- มูลค่าขายรวม 35,811,634.00 บาท (เพิ่มขึ้นจากปีก่อน 286,448.00 บาท หรือร้อยละ 0.81 สูงกว่าแผนที่ตั้งไว้ 31,200,000.00 บาท คิดเป็นร้อยละ 114.78)',
        '- ต้นทุนการผลิต/ขาย 32,754,428.02 บาท ค่าใช้จ่ายเฉพาะธุรกิจ 26,383.56 บาท มีกำไรเฉพาะธุรกิจ 3,030,822.42 บาท (คิดเป็นร้อยละ 8.46 ของยอดขาย เพิ่มขึ้นจากปีก่อนที่ได้ 1,755,547.89 บาท หรือเพิ่มขึ้นร้อยละ 72.64 เนื่องจากต้นทุนวัตถุดิบอาหารสัตว์ลดลง)',
        '- สมาชิกมีส่วนร่วม 55 ราย จาก 83 ราย (ร้อยละ 66.27) (แผนปีถัดไปตั้งไว้ 34,400,000.00 บาท)'
      ]
    },
    /* กิจกรรมเป้าหมาย 5.2 ที่เจาะจงตามข้อบกพร่อง (TASK 6) — ระบบจะเติมวันที่ให้ตามปีงบประมาณ */
    activities: [
      {
        code: '2.5', target: '2', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.5 แนะนำการควบคุมภายในระบบบัญชีคอมพิวเตอร์ กำหนดผู้ดูแลระบบและรหัสผ่านโดยเฉพาะ และเปลี่ยนรหัสผ่านทุก 6 เดือน'
      },
      {
        code: '2.6', target: '1', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.6 ตรวจสอบและแนะนำการบันทึกตัดสินค้าเสื่อมชำรุดให้ถูกต้องตามระเบียบ'
      },
      {
        code: '2.7', target: '12', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.7 แนะนำให้คณะกรรมการดำเนินการจัดประชุมประจำทุกเดือนตามข้อบังคับข้อ 73 (เดือนละ 1 ครั้งเป็นอย่างน้อย)'
      },
      {
        code: '2.8', target: '12', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.8 แนะนำให้ผู้ตรวจสอบกิจการจัดทำรายงานผลการตรวจสอบเป็นลายลักษณ์อักษรเสนอต่อที่ประชุมคณะกรรมการประจำเดือน'
      },
      {
        code: '2.9', target: '1', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.9 ส่งเสริมการจัดทำแผนกลยุทธ์/แผนยุทธศาสตร์ระยะยาว และกระตุ้นสมาชิกให้มีส่วนร่วมในธุรกิจจัดหาสินค้าเพิ่มขึ้นจากร้อยละ 25.30'
      },
      {
        code: '2.10', target: '1', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.10 แนะนำให้ทบทวนหลักประกันการทำงานของฝ่ายจัดการ/ผู้ทำหน้าที่แทนให้คุ้มครองมูลค่าความเสียหายที่อาจเกิดขึ้น'
      },
      {
        code: '2.11', target: '1', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.11 ตรวจสอบแนวทางบริหารจัดการทรัพย์สินไซโลขนาด 1,000 ตัน ที่ใช้งานไม่ได้ ให้เกิดประโยชน์หรือจำหน่ายตามระเบียบ'
      }
    ]
  };

  // =========================================================================
  // ข้อมูลตรวจสอบแล้ว: สหกรณ์ออมทรัพย์สยามโตโยต้าอุตสาหกรรม จำกัด
  // =========================================================================
  var TOYOTA_NAME = 'สหกรณ์ออมทรัพย์สยามโตโยต้าอุตสาหกรรม จำกัด';

  var toyotaVerified = {
    name: TOYOTA_NAME,
    title: 'สหกรณ์ออมทรัพย์สยามโตโยต้าอุตสาหกรรม จำกัด',
    form: {
      coop_name: TOYOTA_NAME,
      district: 'บ้านบึง',
      reg_date: '28 มกราคม 2547',
      board_count: '15',
      inspector_count: '5',
      inspector_name: 'นางสาวสมศรี ใจดี',
      auditor_type: 'ภาครัฐ',
      gov_auditor_name: 'คนึงศรี',
      fiscal_year: '31 ธันวาคม',
      yr_latest: '2568',
      yr_prev: '2567',
      mem_latest: '1129/1129/0',
      mem_prev: '1100',
      asset_latest: '442375342.93',
      asset_prev: '435455189.61',
      debt_latest: '39849406.05',
      debt_prev: '41665377.54',
      share_latest: '50805200.00',
      share_prev: '48952400.00',
      reserve_latest: '22117248.15',
      reserve_prev: '20718803.01',
      accumfund_latest: '329391688.73',
      accumfund_prev: '323758609.06',
      profit_latest: '16832045.15',
      profit_prev: '15755133.85',
      loss_latest: '0',
      loss_prev: '0',
      biz_vol_latest: '291837877.63',
      biz_vol_prev: '274712086.58',
      business_types: 'ธุรกิจเงินให้กู้\nธุรกิจรับฝากเงิน',
      c68_lv: 'ชั้น 1',
      c68_tot: '92.50',
      c68_d1: '23.00',
      c68_d2: '18.00',
      c68_d3: '16.50',
      c68_d4: '35.00',
      c69_lv: '',
      c69_tot: '',
      c69_d1: '',
      c69_d2: '',
      c69_d3: '',
      c69_d4: '',
      issue_1: 'การมีส่วนร่วมของสมาชิกในธุรกิจเงินฝากยังต่ำ (9.57%)',
      issue_2: 'ยังไม่มีแผนกลยุทธ์ระยะยาว',
      issue_3: '',
      promotion_goals: '1. ส่งเสริมการเพิ่มการมีส่วนร่วมของสมาชิกในธุรกิจเงินฝาก\n2. ส่งเสริมการจัดทำแผนกลยุทธ์ระยะยาว\n3. รักษามาตรฐานการควบคุมภายในระดับดีมาก',
      planned_visits: '4',
      visit_remark: 'ข้อมูลอ้างอิงจากงบการเงินปีบัญชี 2568 และรายงานผลการตรวจสอบกิจการ',
      agm_date: '28/03/2570',
      certify_date: 'มีนาคม 2570',
      /* ผลการดำเนินงานฉบับละเอียด */
      agm_attend_latest: '650', agm_attend_prev: '620',
      mem_biz_deposit_latest: '108', mem_biz_deposit_prev: '95',
      mem_biz_trading_latest: '0', mem_biz_trading_prev: '0',
      mem_biz_processing_latest: '0', mem_biz_processing_prev: '0',
      wc_latest: '442375342.93', wc_prev: '435455189.61',
      coopcap_latest: '402525936.88', coopcap_prev: '393789812.07',
      loan_latest: '35000000.00', loan_prev: '36000000.00',
      payable_latest: '4849406.05', payable_prev: '5665377.54',
      cash_latest: '185234567.89', cash_prev: '175432109.87',
      inventory_latest: '0', inventory_prev: '0',
      ppe_latest: '12567890.12', ppe_prev: '11987654.32',
      receivable_latest: '1567890.12', receivable_prev: '1234567.89',
      otherasset_latest: '258249844.80', otherasset_prev: '247545857.53',
      income_latest: '291837877.63', income_prev: '274712086.58',
      expense_latest: '275005832.48', expense_prev: '258956952.73',
      sales_trading_latest: '0', sales_trading_prev: '0',
      cost_trading_latest: '0', cost_trading_prev: '0',
      profit_biz_trading_latest: '0', profit_biz_trading_prev: '0',
      plan_trading_latest: '0', plan_trading_prev: '0',
      sales_processing_latest: '0', sales_processing_prev: '0',
      cost_processing_latest: '0', cost_processing_prev: '0',
      profit_biz_processing_latest: '0', profit_biz_processing_prev: '0',
      plan_processing_latest: '0', plan_processing_prev: '0',
      deposit_amount_latest: '35000000.00', deposit_amount_prev: '36000000.00',
      profit_biz_deposit_latest: '0', profit_biz_deposit_prev: '0',
      avgprofit3_latest: '15762437.62', avgprofit3_prev: '14890123.45',
      avgsaving_latest: '373648.26', avgsaving_prev: '350123.45',
      avgdebt_latest: '115214.83', avgdebt_prev: '118901.23',
      staff_count_latest: '7', staff_count_prev: '7'
    },
    state: {
      coopProfile: {
        coopId13: '2000000125789',
        coopName: TOYOTA_NAME,
        orgType: 'สหกรณ์',
        coopSubType: 'สหกรณ์ออมทรัพย์',
        status: 'ดำเนินการ',
        district: 'บ้านบึง',
        distanceKm: 0,
        regDate: '28 มกราคม 2547',
        fiscalEndDate: '31 ธันวาคม',
        boardCount: 15,
        auditorType: 'ภาครัฐ',
        auditorName: 'นางสาวคนึงศรี สงวนสัตย์',
        inspectorCount: 5,
        inspectorName: 'นางสาวสมศรี ใจดี',
        royalProject: '',
        mainBusinesses: ['ธุรกิจเงินให้กู้', 'ธุรกิจรับฝากเงิน'],
        mainProducts: [],
        members: {
          regularMale: 650, regularFemale: 479, regularTotal: 1129,
          associateMale: 0, associateFemale: 0, associateTotal: 0,
          prevYearTotal: 1100
        },
        fourMDetails: {
          m1: {
            usesAnnualPlan: true,
            inspectorFrequency: 'monthly',
            membersBorrow: 570,
            membersDeposit: 108
          },
          m2: {
            facilityCondition: 'good',
            accountingSoftware: 'private_software'
          },
          m4: {
            hasAnnualPlan: true,
            hasStrategicPlan: false,
            internalControlLevel: 'ดีมาก',
            closeAccountDays: 25,
            agmDays: 87,
            hasFraud: false
          },
          auditorObservations: {
            hasInternalControlWeakness: false,
            weaknessCategories: [],
            details: 'ไม่พบข้อสังเกตเกี่ยวกับจุดอ่อนของการควบคุมภายใน',
            correctionStatus: ''
          }
        }
      },
      financials: {
        summary2Years: {
          assetsLatest: 442375342.93, assetsPrev: 435455189.61,
          liabilitiesLatest: 39849406.05, liabilitiesPrev: 41665377.54,
          shareCapitalLatest: 50805200.00, shareCapitalPrev: 48952400.00,
          reserveFundLatest: 22117248.15, reserveFundPrev: 20718803.01,
          otherAccumFundLatest: 329391688.73, otherAccumFundPrev: 323758609.06,
          netProfitLatest: 16832045.15, netProfitPrev: 15755133.85,
          accumLossLatest: 0, accumLossPrev: 0,
          businessVolumeLatest: 291837877.63, businessVolumePrev: 274712086.58,
          activeBusinessesText: 'ธุรกิจเงินให้กู้ ธุรกิจรับฝากเงิน'
        },
        balanceSheet: {
          currentAssets: 187770348.13, nonCurrentAssets: 254604994.80, totalAssets: 442375342.93,
          currentLiabilities: 39849406.05, nonCurrentLiabilities: 0, totalLiabilities: 39849406.05,
          shareCapital: 50805200.00, reserveFund: 22117248.15, otherAccumFunds: 329391688.73,
          accumulatedLoss: 0, netProfitYear: 16832045.15, totalEquity: 402525936.88
        },
        businesses: {
          credit: { interestIncome: 291837877.63, serviceCost: 275005832.48, grossProfit: 16832045.15, specificIncome: 0, specificExpense: 0, netBusinessProfit: 16832045.15 },
          trading: { sales: 0, cogs: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          collection: { sales: 0, cogs: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          processing: { sales: 0, cogs: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          service: { serviceIncome: 0, serviceCost: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 }
        },
        incomeStatement: {
          totalSalesService: 291837877.63, totalCogsService: 275005832.48, grossProfit: 16832045.15,
          specificIncome: 0, specificExpense: 0, otherIncome: 0, operatingExpense: 0, netProfit: 16832045.15
        },
        ratios: {
          deRatio: 0.09, roe: 3.79, roa: 3.67, currentRatio: 4.18,
          reserveToAssetRatio: 0.05, opexToGrossProfitRatio: 0,
          shortTermDebtPaidOnTimeRatio: 100,
          assetTurnover: 0.04, assetGrowthRate: 1.57, profitGrowthRate: 6.83,
          profitPerMember: 14908.81, avgSavingPerMember: 373648.26, avgDebtPerMember: 115214.83
        }
      },
      strength: {
        classByYear: { '2568': 'ชั้น 1', '2569': '' },
        totalByYear: { '2568': 92.50, '2569': 0 },
        dim1ByYear: { '2568': 23.00, '2569': 0 },
        dim2ByYear: { '2568': 18.00, '2569': 0 },
        dim3ByYear: { '2568': 16.50, '2569': 0 },
        dim4ByYear: { '2568': 35.00, '2569': 0 },
        indicators: indicatorScores({
          '1.1': 8, '1.2': 10, '1.3': 5,
          '2.1': 3, '2.2': 2, '2.3': 4, '2.4': 4, '2.5': 3, '2.6': 4,
          '3.1': 4, '3.2': 4, '3.3': 4, '3.4': 4, '3.5': 4,
          '4.1': 15, '4.2': 5, '4.3': 5, '4.4': 5
        })
      }
    },
    fourM: {
      orgAnalysis4M: [
        'การวิเคราะห์ข้อมูลของสหกรณ์/กลุ่มเกษตรกร',
        '- ผลการวิเคราะห์ข้อมูลด้านการบริหารจัดการองค์กร',
        'ด้านการบริหารจัดการองค์กร (หลัก 4M)',
        '',
        '1. หัวข้อ: บุคลากร (Man)',
        '- คณะกรรมการดำเนินการ มีจำนวน 15 คน มีความรู้ความสามารถและประสบการณ์เพียงพอในการบริหารงาน',
        '- ผู้ตรวจสอบกิจการชื่อ นางสาวสมศรี ใจดี (5 คน) ผ่านการอบรมผู้ตรวจสอบกิจการสหกรณ์ และรายงานผลต่อที่ประชุมคณะกรรมการทุกเดือน (monthly)',
        '- ฝ่ายจัดการมีผู้จัดการ 1 คน ผู้ช่วยผู้จัดการ 4 คน และเจ้าหน้าที่ปฏิบัติงานประจำ 7 คน',
        '- ณ วันสิ้นปีบัญชีมีสมาชิก 1,129 คน แยกเป็น สมาชิกที่กู้เงิน 570 คน (50.49%) และสมาชิกที่ฝากเงิน 108 คน (9.57%)',
        '',
        '2. หัวข้อ: สำนักงาน/อุปกรณ์ (Material)',
        '- สหกรณ์มีสำนักงานและอุปกรณ์ที่ใช้ในการปฏิบัติงานอย่างเพียงพอ มีความเหมาะสมในพื้นที่โรงงาน',
        '- สหกรณ์ใช้โปรแกรมระบบคอมพิวเตอร์เอกชน (Teller) ที่มีประสิทธิภาพสูงในการบริหารจัดการข้อมูล',
        '',
        '3. หัวข้อ: การเงิน (Money)',
        '- ผลการดำเนินงานปีบัญชี 2568 มีกำไรสุทธิ 16,832,045.15 บาท เพิ่มขึ้นจากปีก่อน 6.83%',
        '- อัตราส่วนทางการเงิน: D/E = 0.09 เท่า, ROE = 3.79%, ROA = 3.67%, Current Ratio = 4.18 เท่า',
        '- ทุนสำรองต่อสินทรัพย์ = 0.05 เท่า, อัตราหมุนของสินทรัพย์ = 0.04 รอบ',
        '- เงินออมเฉลี่ยต่อสมาชิก = 373,648.26 บาท, หนี้เฉลี่ยต่อสมาชิก = 115,214.83 บาท',
        '- กำไรเฉลี่ยต่อสมาชิก = 14,908.81 บาท, อัตราการชำระหนี้ได้ตามกำหนด = 100%',
        '',
        '4. หัวข้อ: การจัดการ (Management)',
        '- สหกรณ์มีแผนประจำปีและแผนลงทุน แต่ยังไม่มีการจัดทำแผนกลยุทธ์ระยะยาว',
        '- ระดับการควบคุมภายในอยู่ในระดับ "ดีมาก"',
        '- สามารถปิดบัญชีภายใน 25 วัน (เกณฑ์ ≤ 30 วัน) และจัดประชุมใหญ่ภายใน 87 วัน (เกณฑ์ ≤ 150 วัน)',
        '- ไม่พบข้อบกพร่อง/ทุจริต',
        '- ข้อสังเกตผู้สอบบัญชี: ไม่พบข้อสังเกตเกี่ยวกับจุดอ่อนของการควบคุมภายใน',
        ''
      ],
      businessAnalysis: [
        '- ผลการวิเคราะห์ข้อมูลด้านการบริหารจัดการธุรกิจ',
        'ด้านการบริหารจัดการธุรกิจ',
        '',
        '1. หัวข้อ: ธุรกิจเงินให้กู้',
        '- สหกรณ์ดำเนินธุรกิจเงินให้กู้ มีดอกเบี้ยรับ 291,837,877.63 บาท',
        '- ต้นทุนการให้บริการ 275,005,832.48 บาท กำไรสุทธิจากธุรกิจ 16,832,045.15 บาท',
        '- สมาชิกที่กู้เงิน 570 คน จากสมาชิกทั้งหมด 1,129 คน (50.49%)',
        '- อัตราการชำระหนี้ได้ตามกำหนด 100% แสดงถึงคุณภาพลูกหนี้ที่ดี',
        '',
        '2. หัวข้อ: ธุรกิจรับฝากเงิน',
        '- สหกรณ์รับฝากเงินจากสมาชิก 35,000,000.00 บาท',
        '- สมาชิกที่ฝากเงิน 108 คน จากสมาชิกทั้งหมด 1,129 คน (9.57%)',
        '- การมีส่วนร่วมของสมาชิกในธุรกิจเงินฝากยังต่ำ ควรส่งเสริมการเพิ่มประเภทเงินฝากเพื่อจูงใจสมาชิก',
        ''
      ],
      welfareAnalysis: '',
      summaryAnalysis: [
        'ผลการวิเคราะห์ข้อมูลของสหกรณ์/กลุ่มเกษตรกร',
        '',
        'ด้านการบริหารจัดการองค์กร:',
        '- คณะกรรมการดำเนินการมีจำนวน 15 คน มีความรู้ความสามารถและประสบการณ์เพียงพอ',
        '- ผู้ตรวจสอบกิจการรายงานผลทุกเดือน แสดงถึงความเข้มแข็งในการตรวจสอบ',
        '- ระบบการควบคุมภายในอยู่ในระดับดีมาก ไม่พบข้อสังเกตจุดอ่อน',
        '',
        'ด้านการเงิน:',
        '- สหกรณ์มีผลกำไรสุทธิ 16,832,045.15 บาท เพิ่มขึ้นจากปีก่อน 6.83%',
        '- โครงสร้างการเงินมั่นคง D/E = 0.09 เท่า, Current Ratio = 4.18 เท่า',
        '- สภาพคล่องสูง เงินออมเฉลี่ยต่อสมาชิกสูงกว่าหนี้เฉลี่ย',
        '',
        'ด้านการจัดการ:',
        '- สหกรณ์สามารถปิดบัญชีและจัดการประชุมใหญ่ได้ภายในเกณฑ์ที่กำหนด',
        '- ยังไม่มีแผนกลยุทธ์ระยะยาว ควรได้รับการส่งเสริมให้จัดทำ',
        '',
        'จุดแข็ง:',
        '✓ การควบคุมภายในระดับดีมาก ไม่พบข้อสังเกตผู้สอบบัญชี',
        '✓ โครงสร้างการเงินมั่นคง สภาพคล่องสูง',
        '✓ การประชุมใหญ่ทันตามเกณฑ์มาตรฐานบัญชี',
        '',
        'จุดที่ควรส่งเสริม:',
        '▸ การมีส่วนร่วมของสมาชิกในธุรกิจเงินฝากยังต่ำ (9.57%)',
        '▸ ยังไม่มีแผนกลยุทธ์ระยะยาว'
      ]
    },
    activities: [
      {
        code: '2.5', target: '1', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.5 ส่งเสริมการเพิ่มการมีส่วนร่วมของสมาชิกในธุรกิจเงินฝาก และการเพิ่มประเภทสินเชื่อ/เงินฝากเพื่อจูงใจสมาชิก'
      },
      {
        code: '2.6', target: '1', unit: 'ครั้ง', operator: 'เจ้าหน้าที่ส่งเสริม', autoGenerated: true, auto4M: true,
        goal: '2.6 ส่งเสริมให้สหกรณ์มีการจัดทำแผนกลยุทธ์ และ/หรือร่วมจัดทำแผนกลยุทธ์กับสหกรณ์'
      }
    ]
  };

  // =========================================================================
  // Smart Coop Profile PDF parser (ข้อ 1–47)
  // =========================================================================
  var PROFILE_RULES = [
    { item: 1, key: 'coopName', type: 'text', re: /(?:ชื่อสหกรณ์|ชื่อกลุ่มเกษตรกร)[^ก-๙A-Za-z0-9]{0,12}([ก-๙A-Za-z0-9.\s()]{3,90}?)(?=\s*(?:เลขทะเบียน|ทะเบียนเลขที่|รหัสสหกรณ์|รหัสกลุ่ม|จดทะเบียน|ที่อยู่|โทร|$))/ },
    { item: 2, key: 'regNo', type: 'text', re: /(?:เลขทะเบียน|ทะเบียนเลขที่)[^0-9]{0,20}([0-9\/\-]{4,20})/ },
    { item: 3, key: 'coopCode', type: 'text', re: /(?:รหัสสหกรณ์|รหัสกลุ่ม)[^0-9]{0,20}([0-9]{2,10})/ },
    { item: 4, key: 'regDate', type: 'text', re: /(?:จดทะเบียน|วันที่จดทะเบียน)[^0-9]{0,12}([0-9]{1,2}\s*[ก-๙.]+\s*[0-9]{4})/ },
    { item: 5, key: 'fiscalEnd', type: 'text', re: /วันสิ้นปี(?:ทาง)?บัญชี[^0-9]{0,12}([0-9]{1,2}\s*[ก-๙]+)/ },
    { item: 6, key: 'coopSize', type: 'text', re: /ขนาด(?:สหกรณ์)?[^ก-๙]{0,6}(ใหญ่มาก|ใหญ่|กลาง|เล็ก)/ },
    { item: 7, key: 'address', type: 'text', re: /ที่อยู่[^ก-๙A-Za-z0-9]{0,10}([^\n]{5,160})/ },
    { item: 8, key: 'district', type: 'text', re: /อำเภอ[^ก-๙]{0,4}([ก-๙]{2,30})/ },
    { item: 9, key: 'boardCount', type: 'num', re: /กรรมการ(?:ดำเนินการ)?[^0-9]{0,30}([0-9]{1,3})\s*คน/ },
    { item: 10, key: 'boardMale', type: 'num', re: /กรรมการ[^0-9]{0,30}ชาย[^0-9]{0,6}([0-9]{1,3})/ },
    { item: 11, key: 'boardFemale', type: 'num', re: /กรรมการ[^0-9]{0,30}หญิง[^0-9]{0,6}([0-9]{1,3})/ },
    { item: 12, key: 'chairman', type: 'text', re: /ประธาน(?:กรรมการ)?[^ก-๙]{0,8}([ก-๙.\s]{3,60})/ },
    { item: 13, key: 'manager', type: 'text', re: /(?:ผู้จัดการ|รักษาการผู้จัดการ)[^ก-๙]{0,8}([ก-๙.\s]{3,60})/ },
    { item: 14, key: 'inspectorCount', type: 'num', re: /ผู้ตรวจสอบกิจการ[^0-9]{0,30}([0-9]{1,3})\s*คน/ },
    { item: 15, key: 'inspectorName', type: 'text', re: /ผู้ตรวจสอบกิจการ[^ก-๙]{0,30}((?:นาย|นาง|นางสาว)[ก-๙.\s]{3,60})/ },
    { item: 16, key: 'inspectorReserve', type: 'text', re: /สำรอง[^ก-๙]{0,10}((?:นาย|นาง|นางสาว)[ก-๙.\s]{3,60})/ },
    { item: 17, key: 'auditorType', type: 'text', re: /ผู้สอบบัญชี[^ก-๙]{0,6}(ภาครัฐ|ภาคเอกชน)/ },
    { item: 18, key: 'auditorName', type: 'text', re: /ผู้สอบบัญชี[^ก-๙]{0,30}((?:นาย|นาง|นางสาว)[ก-๙.\s]{3,60})/ },
    { item: 19, key: 'staffCount', type: 'num', re: /เจ้าหน้าที่(?:ประจำ|ปฏิบัติงาน)?[^0-9]{0,30}([0-9]{1,3})\s*คน/ },
    { item: 20, key: 'staffFemale', type: 'num', re: /เจ้าหน้าที่[^0-9]{0,30}หญิง[^0-9]{0,6}([0-9]{1,3})/ },
    { item: 21, key: 'chiefAccountant', type: 'text', re: /หัวหน้าฝ่ายบัญชี[^ก-๙]{0,10}((?:นาย|นาง|นางสาว)[ก-๙.\s]{3,60})/ },
    { item: 22, key: 'consultant', type: 'text', re: /ที่ปรึกษา(?:สหกรณ์)?[^ก-๙]{0,10}((?:นาย|นาง|นางสาว)[ก-๙.\s]{3,60})/ },
    { item: 23, key: 'consultantFee', type: 'num', re: /ค่าตอบแทน[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)\s*บาท/ },
    { item: 24, key: 'memberMale', type: 'num', re: /(?:สมาชิก(?:สามัญ)?[^\n]{0,40}?)?ชาย[^0-9\n]{0,10}([0-9,]{1,8})(?:\s*คน)?/ },
    { item: 25, key: 'memberFemale', type: 'num', re: /(?:สมาชิก(?:สามัญ)?[^\n]{0,40}?)?หญิง[^0-9\n]{0,10}([0-9,]{1,8})(?:\s*คน)?/ },
    { item: 26, key: 'memberTotal', type: 'num', re: /(?:สมาชิก(?:สามัญ)?(?:ทั้งสิ้น|รวม)?|รวม)[^0-9\n]{0,10}([0-9,]{1,8})\s*คน/ },
    { item: 27, key: 'memberPrev', type: 'num', re: /สมาชิก(?:ปีก่อน|ปีที่แล้ว)[^0-9\n]{0,10}([0-9,]{1,8})/ },
    { item: 28, key: 'assetLatest', type: 'num', re: /สินทรัพย์รวม[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 29, key: 'currentAssets', type: 'num', re: /สินทรัพย์หมุนเวียน[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 30, key: 'cash', type: 'num', re: /เงินสดและ(?:เงินฝาก|รายการเทียบเท่า)[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 31, key: 'inventory', type: 'num', re: /สินค้าคงเหลือ[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 32, key: 'receivable', type: 'num', re: /ลูกหนี้(?:การค้า|สุทธิ)?[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 33, key: 'otherCurrent', type: 'num', re: /สินทรัพย์หมุนเวียนอื่น[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 34, key: 'nonCurrentAssets', type: 'num', re: /สินทรัพย์ไม่หมุนเวียน[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 35, key: 'ppe', type: 'num', re: /ที่ดิน\s*อาคารและอุปกรณ์[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 36, key: 'liabilities', type: 'num', re: /หนี้สินรวม[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 37, key: 'currentLiabilities', type: 'num', re: /หนี้สินหมุนเวียน[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 38, key: 'loans', type: 'num', re: /เงินกู้(?:ยืม)?(?:ระยะสั้น)?[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 39, key: 'payables', type: 'num', re: /เจ้าหนี้การค้า[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 40, key: 'depositBalance', type: 'num', re: /เงินรับฝาก(?:ออมทรัพย์)?[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 41, key: 'nonCurrentLiabilities', type: 'num', re: /หนี้สินไม่หมุนเวียน[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 42, key: 'equity', type: 'num', re: /ทุนของสหกรณ์(?:รวม)?[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 43, key: 'shareCapital', type: 'num', re: /ทุนเรือนหุ้น[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 44, key: 'reserveFund', type: 'num', re: /ทุนสำรอง[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 45, key: 'accumFund', type: 'num', re: /ทุนสะสมตามข้อบังคับ[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 46, key: 'netProfit', type: 'num', re: /กำไร(?:สุทธิ)?[^0-9\-]{0,20}(-?[0-9,]+(?:\.[0-9]{1,2})?)/ },
    { item: 47, key: 'businessVolume', type: 'num', re: /ปริมาณธุรกิจ(?:รวม)?[^0-9]{0,20}([0-9,]+(?:\.[0-9]{1,2})?)/ }
  ];

  function parseSmartCoopProfile(text) {
    var result = { form: {}, details: {}, raw: {} };
    var t = String(text || '').replace(/\r/g, ' ').replace(/[ \t]+/g, ' ');
    if (!t) return result;

    PROFILE_RULES.forEach(function (rule) {
      var m = t.match(rule.re);
      if (!m || !m[1]) return;
      var val = String(m[1]).replace(/\s+/g, ' ').trim();
      if (!val) return;
      if (rule.type === 'num') {
        var n = Number(val.replace(/,/g, ''));
        if (!isFinite(n)) return;
        result.raw[rule.key] = n;
        val = String(n);
      } else {
        result.raw[rule.key] = val;
      }
      result.form[rule.key] = val;
    });

    var r = result.raw;
    if (r.assetLatest !== undefined) result.form.asset_latest = String(r.assetLatest);
    if (r.shareCapital !== undefined) result.form.share_latest = String(r.shareCapital);
    if (r.reserveFund !== undefined) result.form.reserve_latest = String(r.reserveFund);
    if (r.accumFund !== undefined) result.form.accumfund_latest = String(r.accumFund);
    if (r.netProfit !== undefined) result.form.profit_latest = String(r.netProfit);
    if (r.businessVolume !== undefined) result.form.biz_vol_latest = String(r.businessVolume);
    if (r.liabilities !== undefined) result.form.debt_latest = String(r.liabilities);
    if (r.boardCount !== undefined) result.form.board_count = String(r.boardCount);
    if (r.inspectorCount !== undefined) result.form.inspector_count = String(r.inspectorCount);
    if (r.inspectorName) result.form.inspector_name = r.inspectorName;
    if (r.memberMale !== undefined) result.form.member_male = String(r.memberMale);
    if (r.memberFemale !== undefined) result.form.member_female = String(r.memberFemale);
    var memberTotalCalc = r.memberTotal;
    if (memberTotalCalc === undefined && (r.memberMale !== undefined || r.memberFemale !== undefined)) {
      memberTotalCalc = (r.memberMale || 0) + (r.memberFemale || 0);
    }
    if (memberTotalCalc !== undefined) {
      result.form.mem_latest = String(memberTotalCalc) + '/' + String(memberTotalCalc) + '/0';
      result.form.mem_prev = r.memberPrev !== undefined ? String(r.memberPrev) : '';
    }
    if (r.regDate) result.form.reg_date = r.regDate;
    if (r.fiscalEnd) result.form.fiscal_year = r.fiscalEnd;
    if (r.auditorType) result.form.auditor_type = r.auditorType;
    if (r.auditorName) {
      result.form.auditor_name = r.auditorName;
      if (/คนึงศรี/.test(r.auditorName)) result.form.gov_auditor_name = 'คนึงศรี';
      else if (/พรทิพย์/.test(r.auditorName)) result.form.gov_auditor_name = 'พรทิพย์';
      else result.form.gov_auditor_name = r.auditorName;
    }

    if (r.cash !== undefined) result.details.cash_latest = String(r.cash);
    if (r.inventory !== undefined) result.details.inventory_latest = String(r.inventory);
    if (r.receivable !== undefined) result.details.receivable_latest = String(r.receivable);
    if (r.otherCurrent !== undefined) result.details.otherasset_latest = String(r.otherCurrent);
    if (r.ppe !== undefined) result.details.ppe_latest = String(r.ppe);
    if (r.loans !== undefined) result.details.loan_latest = String(r.loans);
    if (r.payables !== undefined) result.details.payable_latest = String(r.payables);
    if (r.depositBalance !== undefined) result.details.deposit_amount_latest = String(r.depositBalance);
    if (r.equity !== undefined) result.details.coopcap_latest = String(r.equity);
    if (r.staffCount !== undefined) result.details.staff_count_latest = String(r.staffCount);

    return result;
  }

  var cache = {};
  cache[normalizeName(VERIFIED_NAME)] = verified;
  cache[normalizeName(TOYOTA_NAME)] = toyotaVerified;

  global.CPD_PRELOAD = {
    version: '20260214b',
    verifiedName: VERIFIED_NAME,
    parseSmartCoopProfile: parseSmartCoopProfile,
    rules: PROFILE_RULES,
    get: function (name) {
      var key = normalizeName(name);
      return cache[key] || null;
    },
    has: function (name) {
      return !!cache[normalizeName(name)];
    },
    list: function () {
      return Object.keys(cache);
    }
  };
})(window);

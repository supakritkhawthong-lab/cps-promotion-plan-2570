/**
 * cpd-state.js — Global state + auto-sync engine
 *
 * Zero Regression Rule: ไฟล์นี้ไม่แก้ id หรือฟังก์ชันเดิมในหน้า Tab 1
 * ทำหน้าที่อ่านค่าจากฟอร์มเดิม -> CPD_AppState -> เติมแท็บ 2/3/4/5
 */
(function (global) {
  'use strict';

  var MONTHS = [
    { key: 'm10', name: 'ตุลาคม', num: 10 },
    { key: 'm11', name: 'พฤศจิกายน', num: 11 },
    { key: 'm12', name: 'ธันวาคม', num: 12 },
    { key: 'm1', name: 'มกราคม', num: 1 },
    { key: 'm2', name: 'กุมภาพันธ์', num: 2 },
    { key: 'm3', name: 'มีนาคม', num: 3 },
    { key: 'm4', name: 'เมษายน', num: 4 },
    { key: 'm5', name: 'พฤษภาคม', num: 5 },
    { key: 'm6', name: 'มิถุนายน', num: 6 },
    { key: 'm7', name: 'กรกฎาคม', num: 7 },
    { key: 'm8', name: 'สิงหาคม', num: 8 },
    { key: 'm9', name: 'กันยายน', num: 9 }
  ];

  var THAI_MONTHS = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  var MONTHLY_BIZ = [
    { key: 'deposit', label: 'เงินรับฝาก' },
    { key: 'credit', label: 'เงินให้กู้' },
    { key: 'trading', label: 'จัดหาสินค้ามาจำหน่าย' },
    { key: 'collection', label: 'รวบรวมผลผลิต' },
    { key: 'processing', label: 'แปรรูปผลผลิต' },
    { key: 'service', label: 'บริการ' }
  ];

  var STRENGTH_INDICATORS = [
    { id: '1.1', dim: 1, name: 'อัตราส่วนของสมาชิกที่มีส่วนร่วมในการดำเนินธุรกิจกับสหกรณ์', weight: 15 },
    { id: '1.2', dim: 1, name: 'ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง จัดสรรกำไรสุทธิและจ่ายทุนสวัสดิการสมาชิกและทุนสาธารณประโยชน์', weight: 10 },
    { id: '1.3', dim: 1, name: 'จำนวนประเภทธุรกิจที่สหกรณ์ดำเนินงาน', weight: 5 },
    { id: '2.1', dim: 2, name: 'อัตราส่วนหนี้สินต่อทุน', weight: 3 },
    { id: '2.2', dim: 2, name: 'อัตราส่วนทุนสำรองต่อสินทรัพย์', weight: 2 },
    { id: '2.3', dim: 2, name: 'อัตราผลตอบแทนต่อสินทรัพย์', weight: 4 },
    { id: '2.4', dim: 2, name: 'อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่ายดำเนินงาน', weight: 4 },
    { id: '2.5', dim: 2, name: 'อัตราส่วนทุนหมุนเวียน', weight: 3 },
    { id: '2.6', dim: 2, name: 'อัตราลูกหนี้ระยะสั้นที่ชำระหนี้ได้ตามกำหนด', weight: 4 },
    { id: '3.1', dim: 3, name: 'ระดับการใช้เทคโนโลยีการบัญชีในการบริหารจัดการข้อมูล', weight: 4 },
    { id: '3.2', dim: 3, name: 'ผลการประเมินสภาพแวดล้อมการควบคุม', weight: 4 },
    { id: '3.3', dim: 3, name: 'ผลการประเมินความเสี่ยงและกิจกรรมควบคุม', weight: 4 },
    { id: '3.4', dim: 3, name: 'ผลการประเมินระบบข้อมูลสารสนเทศและการสื่อสาร', weight: 4 },
    { id: '3.5', dim: 3, name: 'ผลการประเมินระบบการติดตามและประเมินผล', weight: 4 },
    { id: '4.1', dim: 4, name: 'ผลการดำเนินงานของสหกรณ์ต้องไม่มีการฝ่าฝืนระเบียบ คำสั่งนายทะเบียน ข้อกฎหมาย', weight: 15 },
    { id: '4.2', dim: 4, name: 'ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง สหกรณ์มีผลการดำเนินงานไม่ขาดทุน', weight: 5 },
    { id: '4.3', dim: 4, name: 'จัดทำงบการเงินแล้วเสร็จและส่งให้ผู้สอบบัญชีตรวจสอบและนำเสนอที่ประชุมใหญ่อนุมัติภายใน 150 วัน', weight: 5 },
    { id: '4.4', dim: 4, name: 'สหกรณ์จัดจ้างเจ้าหน้าที่ปฏิบัติงานประจำรับผิดชอบดำเนินงานและธุรกิจของสหกรณ์', weight: 5 }
  ];

  var YEARS = ['2567', '2568', '2569'];

  // ช่องผลการดำเนินงานฉบับละเอียด (Year N / Year N-1)
  // [ชื่อใน state, คำนำหน้า id ในฟอร์มหน้า 1]
  var DETAIL_FIELDS = [
    ['agmAttendees', 'agm_attend'],
    ['membersDeposit', 'mem_biz_deposit'],
    ['membersTrading', 'mem_biz_trading'],
    ['membersProcessing', 'mem_biz_processing'],
    ['workingCapital', 'wc'],
    ['coopCapital', 'coopcap'],
    ['loans', 'loan'],
    ['payables', 'payable'],
    ['cash', 'cash'],
    ['inventory', 'inventory'],
    ['ppe', 'ppe'],
    ['receivables', 'receivable'],
    ['otherAssets', 'otherasset'],
    ['totalIncome', 'income'],
    ['totalExpense', 'expense'],
    ['salesTrading', 'sales_trading'],
    ['costTrading', 'cost_trading'],
    ['profitTrading', 'profit_biz_trading'],
    ['planTrading', 'plan_trading'],
    ['salesProcessing', 'sales_processing'],
    ['costProcessing', 'cost_processing'],
    ['profitProcessing', 'profit_biz_processing'],
    ['planProcessing', 'plan_processing'],
    ['depositAmount', 'deposit_amount'],
    ['profitDeposit', 'profit_biz_deposit'],
    ['avgProfit3', 'avgprofit3'],
    ['avgSaving', 'avgsaving'],
    ['avgDebt', 'avgdebt'],
    ['staffCount', 'staff_count'],
    ['accumFund', 'accumfund']
  ];

  function emptyOperatingYear() {
    var obj = {};
    DETAIL_FIELDS.forEach(function (p) { obj[p[0]] = 0; });
    return obj;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultState() {
    var indicators = {};
    STRENGTH_INDICATORS.forEach(function (ind) {
      indicators[ind.id] = { '2567': 0, '2568': 0, '2569': 0 };
    });
    indicators['3.overall'] = { '2567': 0, '2568': 0, '2569': 0 };

    var monthlyVolume = {};
    MONTHLY_BIZ.forEach(function (b) {
      monthlyVolume[b.key] = {};
      MONTHS.forEach(function (m) { monthlyVolume[b.key][m.key] = 0; });
    });

    return {
      meta: {
        planId: 'PLAN-2570-',
        fiscalYear: '2570',
        officeName: 'สำนักงานสหกรณ์จังหวัดชลบุรี',
        approvalStatus: 'ร่าง',
        plannerName: '',
        approverName: '',
        updatedAt: '',
        approvedAt: ''
      },
      coopProfile: {
        coopId13: '',
        coopName: '',
        orgType: 'สหกรณ์',
        coopSubType: 'สหกรณ์การเกษตร',
        status: 'ดำเนินการ',
        district: '',
        distanceKm: 0,
        promotionZone: '',
        primaryOfficer: '',
        coOfficer: '',
        regDate: '',
        fiscalEndDate: '31 มีนาคม',
        boardCount: 0,
        auditorType: 'ภาครัฐ',
        auditorName: '',
        inspectorCount: 0,
        inspectorName: '',
        royalProject: '',
        mainBusinesses: [],
        mainProducts: [],
        members: {
          regularMale: 0, regularFemale: 0, regularTotal: 0,
          associateMale: 0, associateFemale: 0, associateTotal: 0,
          prevYearTotal: 0
        },
        // === 4M Extended Fields (Optional, Default = empty/0/false) ===
        fourMDetails: {
          m1: {
            usesAnnualPlan: false,
            inspectorFrequency: '', // monthly|quarterly|irregular
            membersBorrow: 0,
            membersDeposit: 0
          },
          m2: {
            facilityCondition: '', // good|moderate|poor
            accountingSoftware: '' // manual|cpd_software|private_software
          },
          m4: {
            hasAnnualPlan: false,
            hasStrategicPlan: false,
            internalControlLevel: '', // ดีมาก|ดี|พอใช้|ควรปรับปรุง
            closeAccountDays: 0,
            agmDays: 0,
            hasFraud: false
          },
          auditorObservations: {
            hasInternalControlWeakness: false,
            weaknessCategories: [],
            details: '',
            correctionStatus: '' // แก้ไขแล้ว|อยู่ระหว่างดำเนินการ|ยังไม่ได้ดำเนินการ
          }
        }
      },
      businessDetails: {
        // รายละเอียดแต่ละธุรกิจ (7 ประเด็นมาตรฐาน)
        // ระบบจะตรวจพบธุรกิจที่ดำเนินการอัตโนมัติจากข้อมูลที่กรอก (Auto-Detection)
        deposit: {
          hasPlan: false,
          depositTypesDesc: 'ออมทรัพย์, ฝากประจำ',
          specialDepositRate: 0,
          fixedDepositRate: 0,
          depositDuringYear: 0,
          depositEndAccounts: 0,
          depositEndBalance: 0,
          depositInterestCostPct: 0,
          isCompliant: true,
          nonCompliantNote: '',
          participatingMembers: 0,
          staffCompetencyNote: '',
          opportunityOrIssueNote: ''
        },
        loan: {
          hasPlan: false,
          loanTypesCount: 3,
          ordinaryLoanRate: 0,
          specialLoanRate: 0,
          emergencyLoanRate: 0,
          loanDisbursedYear: 0,
          loanEndBorrowers: 0,
          loanEndBalance: 0,
          interestIncomeTotal: 0,
          interestIncomePct: 0,
          repaymentRate: 100,
          isCompliant: true,
          nonCompliantNote: '',
          participatingMembers: 0,
          staffCompetencyNote: '',
          opportunityOrIssueNote: ''
        },
        trading: {
          hasPlan: false,
          productTypes: 'ปุ๋ย, เมล็ดพันธุ์, อาหารสัตว์',
          salesTerms: 'เงินสดและเงินเชื่อ',
          salesVolumeYear: 0,
          costOfGoodsSold: 0,
          grossProfit: 0,
          grossMarginPct: 0,
          netBusinessResult: 0,
          tradeReceivables: 0,
          inventoryEnd: 0,
          isCompliant: true,
          nonCompliantNote: '',
          participatingMembers: 0,
          memberSalesAmount: 0,
          staffCompetencyNote: '',
          opportunityOrIssueNote: ''
        },
        collection: {
          hasPlan: false,
          cropTypes: 'ข้าวเปลือก, มันสำปะหลัง',
          collectionMethod: 'ซื้อขาดตามราคาตลาด',
          collectionQuantity: 0,
          collectionValueYear: 0,
          collectionSalesValue: 0,
          grossProfit: 0,
          grossMarginPct: 0,
          netBusinessResult: 0,
          isCompliant: true,
          nonCompliantNote: '',
          participatingMembers: 0,
          staffCompetencyNote: '',
          opportunityOrIssueNote: ''
        },
        processing: {
          hasPlan: false,
          processedProducts: 'ข้าวสาร, ยางแผ่นรมควัน',
          qualityStandards: 'GAP, OTOP',
          marketingChannels: 'ร้านสหกรณ์, ขายตรง',
          capacityUtilizationPct: 0,
          processingSalesYear: 0,
          productionCost: 0,
          grossProfit: 0,
          grossMarginPct: 0,
          netBusinessResult: 0,
          isCompliant: true,
          nonCompliantNote: '',
          participatingMembers: 0,
          memberParticipationValue: 0,
          staffCompetencyNote: '',
          opportunityOrIssueNote: ''
        },
        service: {
          hasPlan: false,
          serviceTypes: 'รถไถ, รถเกี่ยว, ลานตาก',
          serviceFeeRateDesc: 'ตามอัตราที่คณะกรรมการกำหนด',
          serviceIncomeYear: 0,
          serviceCost: 0,
          netBusinessResult: 0,
          isCompliant: true,
          nonCompliantNote: '',
          participatingMembers: 0,
          staffCompetencyNote: '',
          opportunityOrIssueNote: ''
        }
      },
      financials: {
        summary2Years: {
          assetsLatest: 0, assetsPrev: 0,
          liabilitiesLatest: 0, liabilitiesPrev: 0,
          shareCapitalLatest: 0, shareCapitalPrev: 0,
          reserveFundLatest: 0, reserveFundPrev: 0,
          otherAccumFundLatest: 0, otherAccumFundPrev: 0,
          netProfitLatest: 0, netProfitPrev: 0,
          accumLossLatest: 0, accumLossPrev: 0,
          businessVolumeLatest: 0, businessVolumePrev: 0,
          activeBusinessesText: ''
        },
        operatingResults: {
          latest: emptyOperatingYear(),
          prev: emptyOperatingYear()
        },
        balanceSheet: {
          currentAssets: 0, nonCurrentAssets: 0, totalAssets: 0,
          currentLiabilities: 0, nonCurrentLiabilities: 0, totalLiabilities: 0,
          shareCapital: 0, reserveFund: 0, otherAccumFunds: 0,
          unrealizedInvestGain: 0, revaluationSurplus: 0,
          accumulatedLoss: 0, netProfitYear: 0, totalEquity: 0
        },
        businesses: {
          credit: { interestIncome: 0, serviceCost: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          trading: { sales: 0, cogs: 0, grossProfit: 0, lessUncollectedProfitCurrent: 0, addCollectedProfitPrev: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          collection: { sales: 0, cogs: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          processing: { sales: 0, cogs: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 },
          service: { serviceIncome: 0, serviceCost: 0, grossProfit: 0, specificIncome: 0, specificExpense: 0, netBusinessProfit: 0 }
        },
        incomeStatement: {
          totalSalesService: 0, totalCogsService: 0, grossProfit: 0,
          lessUncollectedProfitCurrent: 0, addCollectedProfitPrev: 0,
          specificIncome: 0, specificExpense: 0, netSpecificProfit: 0,
          otherIncome: 0, profitBeforeOpEx: 0, priorPeriodAdjustment: 0, operatingExpense: 0, netProfit: 0
        },
        ratios: {
          deRatio: 0, roe: 0, roa: 0, currentRatio: 0,
          reserveToAssetRatio: 0, opexToGrossProfitRatio: 0,
          shortTermDebtPaidOnTimeRatio: 0
        }
      },
      strength: {
        years: YEARS.slice(),
        classByYear: { '2567': '', '2568': '', '2569': '' },
        totalByYear: { '2567': 0, '2568': 0, '2569': 0 },
        dim1ByYear: { '2567': 0, '2568': 0, '2569': 0 },
        dim2ByYear: { '2567': 0, '2568': 0, '2569': 0 },
        dim3ByYear: { '2567': 0, '2568': 0, '2569': 0 },
        dim4ByYear: { '2567': 0, '2568': 0, '2569': 0 },
        indicators: indicators
      },
      analysis: {
        issuesTop3: ['', '', ''],
        promotionGoals1to5: ['', '', '', '', ''],
        planFooterNote: '',
        targetProjects: '',
        auditorObservations: '',
        coopDefects: '',
        businessObservations: '',
        welfareObservations: '',
        publicBenefitObservations: '',
        welfareFundAmount: '',
        publicBenefitFundAmount: '',
        orgAnalysis4M: '',
        businessAnalysis: '',
        welfareAnalysis: '',
        summaryAnalysis: ''
      },
      scheduleAndActivities: {
        visitFrequencyPerYear: 4,
        targetCloseAccountDate30Days: '',
        targetAgmDate150Days: '',
        monthlyPlan12Months: MONTHS.map(function (m) {
          return {
            month: m.name, coopAction: '', cpdAction: '',
            statusColor: 'white', actualResult: 0
          };
        }),
        monthlyBusinessVolume: monthlyVolume,
        activities: []
      },
      closingReport: {
        canCloseAccount: '',
        closeAccountTimeframe: '',
        auditorReceiveDate: '',
        auditorCertifyDate: '',
        canHoldAgm: '',
        agmDate: '',
        agmHasFinancialStatement: '',
        agmTimeframe: '',
        failureReason: '',
        outcome2_1_recovery: '',
        outcome2_2_strengthTable: [],
        outcome2_3_excellence: '',
        outcome2_4_inspection: '',
        outcome2_5_others: '',
        obstacles: '',
        recommendations: '',
        supervisorComment: '',
        supervisorName: '',
        supervisorApprovedDate: ''
      }
    };
  }

  var AppState = defaultState();
  var isLoading = false;

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  function num(value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    var s = String(value === undefined || value === null ? '' : value)
      .replace(/,/g, '')
      .replace(/[()]/g, '')
      .trim();
    if (!s || s === '-') return 0;
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function fmt(value, dec) {
    var d = dec === undefined ? 2 : dec;
    return num(value).toLocaleString('th-TH', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  }

  function fmtInt(value) {
    return num(value).toLocaleString('th-TH', { maximumFractionDigits: 0 });
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function parsePath(path) {
    return String(path || '')
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(function (p) { return p !== ''; });
  }

  function getPath(obj, path) {
    var parts = parsePath(path);
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    var parts = parsePath(path);
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (cur[key] === undefined || cur[key] === null || typeof cur[key] !== 'object') {
        cur[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function mergeDeep(target, source) {
    if (!source || typeof source !== 'object') return target;
    Object.keys(source).forEach(function (key) {
      var sv = source[key];
      if (Array.isArray(sv)) {
        target[key] = deepClone(sv);
      } else if (sv && typeof sv === 'object') {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {};
        }
        mergeDeep(target[key], sv);
      } else {
        target[key] = sv;
      }
    });
    return target;
  }

  function replaceState(next) {
    var base = defaultState();
    mergeDeep(base, next || {});
    Object.keys(AppState).forEach(function (k) { delete AppState[k]; });
    Object.keys(base).forEach(function (k) { AppState[k] = base[k]; });
    global.CPD_AppState = AppState;
  }

  function monthByName(name) {
    for (var i = 0; i < MONTHS.length; i++) {
      if (MONTHS[i].name === name) return MONTHS[i];
    }
    return null;
  }

  function monthByKey(key) {
    for (var i = 0; i < MONTHS.length; i++) {
      if (MONTHS[i].key === key) return MONTHS[i];
    }
    return null;
  }

  function getFiscalYear() {
    return String(AppState.meta.fiscalYear || '2570');
  }

  // -------------------------------------------------------------------------
  // Deadline calculation (fiscal year end + 30 / 150 days)
  // -------------------------------------------------------------------------

  function parseFiscalEnd(text) {
    var s = String(text || '').trim();
    var dayMatch = s.match(/(\d{1,2})/);
    var day = dayMatch ? Number(dayMatch[1]) : 30;
    var month = 9;
    for (var i = 1; i <= 12; i++) {
      if (s.indexOf(THAI_MONTHS[i]) !== -1) { month = i; break; }
    }
    return { day: day, month: month };
  }

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatDateThai(d) {
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function parseDateParts(text) {
    var s = String(text || '').trim();
    var m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
    }
    // รองรับรูปแบบ "27 กุมภาพันธ์ 2570"
    var dayMatch = s.match(/(\d{1,2})/);
    var yearMatch = s.match(/(\d{4})/);
    var month = 0;
    for (var i = 1; i <= 12; i++) {
      if (s.indexOf(THAI_MONTHS[i]) !== -1) { month = i; break; }
    }
    if (dayMatch && month && yearMatch) {
      return { day: Number(dayMatch[1]), month: month, year: Number(yearMatch[1]) };
    }
    return null;
  }

  function dateFromParts(parts) {
    if (!parts) return null;
    var d = new Date(parts.year, parts.month - 1, parts.day);
    return isNaN(d.getTime()) ? null : d;
  }

  function computeDeadlines() {
    var fiscalYear = Number(getFiscalYear()) || 2570;
    var fe = parseFiscalEnd(AppState.coopProfile.fiscalEndDate);
    // ปีบัญชีที่ปิดภายในปีงบประมาณ: เดือน ก.ย.–ธ.ค. ใช้ปีก่อนหน้า, ม.ค.–ส.ค. ใช้ปีเดียวกัน
    var endYear = fe.month >= 9 ? fiscalYear - 1 : fiscalYear;
    var endDate = new Date(endYear, fe.month - 1, fe.day);
    var close30 = addDays(endDate, 30);
    var agm150 = addDays(endDate, 150);
    return {
      endDate: formatDateThai(endDate),
      close30: formatDateThai(close30),
      agm150: formatDateThai(agm150)
    };
  }

  /** วันที่รับรองงบต้องอยู่เดือนเดียวกับประชุมใหญ่ และไม่เกินวันประชุมใหญ่ */
  function deriveCertifyDate(agmDate) {
    var parts = parseDateParts(agmDate);
    var agm = dateFromParts(parts);
    if (!agm) return '';
    var cert = addDays(agm, -7);
    if (cert.getMonth() !== agm.getMonth() || cert.getFullYear() !== agm.getFullYear()) {
      cert = new Date(agm.getFullYear(), agm.getMonth(), 1);
    }
    // แสดงเฉพาะเดือน + ปี ตาม Template (เช่น "กุมภาพันธ์ 2569")
    return THAI_MONTHS[cert.getMonth() + 1] + ' ' + cert.getFullYear();
  }

  function deriveAgmDates() {
    var base = computeDeadlines();
    var manual = AppState.closingReport && AppState.closingReport.agmDate;
    var agmDate = base.agm150;
    var parts = parseDateParts(manual);
    if (parts) {
      var d = dateFromParts(parts);
      if (d) agmDate = formatDateThai(d);
    }
    var agmParts = parseDateParts(agmDate);
    return {
      endDate: base.endDate,
      close30: base.close30,
      agm150: base.agm150,
      agmDate: agmDate,
      certifyDate: deriveCertifyDate(agmDate),
      agmMonth: agmParts ? agmParts.month : 0,
      agmYear: agmParts ? agmParts.year : 0
    };
  }

  function applyAutoDeadlines() {
    var d = deriveAgmDates();
    AppState.scheduleAndActivities.targetCloseAccountDate30Days = d.close30;
    AppState.scheduleAndActivities.targetAgmDate150Days = d.agmDate;
    if (AppState.closingReport) {
      AppState.closingReport.auditorCertifyDate = d.certifyDate;
      if (!String(AppState.closingReport.agmDate || '').trim()) {
        AppState.closingReport.agmDate = d.agmDate;
      }
    }
    return d;
  }

  // -------------------------------------------------------------------------
  // Build state from existing Tab 1 (preserve all original ids)
  // -------------------------------------------------------------------------

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function numVal(id) {
    return num(val(id));
  }

  function numOrEmpty(value) {
    return num(value) === 0 ? '' : value;
  }

  function selectedCoop() {
    if (typeof global.masterCoops === 'undefined' || !Array.isArray(global.masterCoops)) return null;
    var sel = document.getElementById('coopSelect');
    if (!sel || sel.value === '') return null;
    return global.masterCoops[Number(sel.value)] || null;
  }

  function parseMembers(text) {
    var parts = String(text || '').split('/').map(function (s) { return num(s); });
    return {
      total: parts[0] || 0,
      regular: parts[1] || 0,
      associate: parts[2] || 0
    };
  }

  function parseGoals(text) {
    var lines = String(text || '').split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    var out = ['', '', '', '', ''];
    for (var i = 0; i < 5; i++) out[i] = lines[i] || '';
    return out;
  }

  function splitList(text) {
    return String(text || '')
      .split(/[\r\n,;/]+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function readOperatingYear(suffix) {
    var obj = {};
    DETAIL_FIELDS.forEach(function (p) {
      obj[p[0]] = numVal(p[1] + '_' + suffix);
    });
    return obj;
  }

  function buildStateFromBaseForm() {
    var c = selectedCoop();
    var coopType = (c && c.coopType) || (val('coopTypeBadge').indexOf('กลุ่มเกษตรกร') !== -1 ? 'กลุ่มเกษตรกร' : 'สหกรณ์การเกษตร');
    var isGroup = coopType.indexOf('กลุ่มเกษตรกร') !== -1;
    var memLatest = parseMembers(val('mem_latest'));
    var memPrev = parseMembers(val('mem_prev'));
    var auditorType = val('auditor_type') || 'ภาครัฐ';
    var auditorName = auditorType === 'ภาครัฐ' ? val('gov_auditor_name') : val('priv_auditor_name');
    var fy = getFiscalYear();

    var state = {
      meta: {
        fiscalYear: fy,
        approvalStatus: AppState.meta.approvalStatus || 'ร่าง',
        plannerName: val('main_officer'),
        updatedAt: '',
        planId: 'PLAN-' + fy + '-' + ((c && c.code13) || '')
      },
      coopProfile: {
        coopId13: (c && c.code13) || AppState.coopProfile.coopId13 || '',
        coopName: val('coop_name') || (c && c.name) || '',
        orgType: isGroup ? 'กลุ่มเกษตรกร' : 'สหกรณ์',
        coopSubType: coopType,
        status: 'ดำเนินการ',
        district: val('district'),
        distanceKm: numVal('distance'),
        promotionZone: val('group_zone'),
        primaryOfficer: val('main_officer'),
        coOfficer: val('co_officers'),
        regDate: val('reg_date'),
        fiscalEndDate: val('fiscal_year') || '31 มีนาคม',
        boardCount: numVal('board_count'),
        auditorType: auditorType,
        auditorName: auditorName,
        inspectorCount: numVal('inspector_count'),
        inspectorName: val('inspector_name'),
        mainBusinesses: splitList(val('business_types')),
        members: {
          regularTotal: memLatest.regular || memLatest.total,
          associateTotal: memLatest.associate,
          prevYearTotal: memPrev.total
        }
      },
      financials: {
        summary2Years: {
          assetsLatest: numVal('asset_latest'),
          assetsPrev: numVal('asset_prev'),
          liabilitiesLatest: numVal('debt_latest'),
          liabilitiesPrev: numVal('debt_prev'),
          shareCapitalLatest: numVal('share_latest'),
          shareCapitalPrev: numVal('share_prev'),
          reserveFundLatest: numVal('reserve_latest'),
          reserveFundPrev: numVal('reserve_prev'),
          otherAccumFundLatest: numVal('accumfund_latest'),
          otherAccumFundPrev: numVal('accumfund_prev'),
          netProfitLatest: numVal('profit_latest'),
          netProfitPrev: numVal('profit_prev'),
          accumLossLatest: Math.abs(numVal('loss_latest')),
          accumLossPrev: Math.abs(numVal('loss_prev')),
          businessVolumeLatest: numVal('biz_vol_latest'),
          businessVolumePrev: numVal('biz_vol_prev'),
          activeBusinessesText: val('business_types')
        },
        operatingResults: {
          latest: readOperatingYear('latest'),
          prev: readOperatingYear('prev')
        }
      },
      strength: {
        classByYear: {
          '2568': val('c68_lv'),
          '2569': val('c69_lv')
        },
        totalByYear: {
          '2568': numVal('c68_tot'),
          '2569': numVal('c69_tot')
        },
        dim1ByYear: { '2568': numVal('c68_d1'), '2569': numVal('c69_d1') },
        dim2ByYear: { '2568': numVal('c68_d2'), '2569': numVal('c69_d2') },
        dim3ByYear: { '2568': numVal('c68_d3'), '2569': numVal('c69_d3') },
        dim4ByYear: { '2568': numVal('c68_d4'), '2569': numVal('c69_d4') }
      },
      analysis: {
        issuesTop3: [val('issue_1'), val('issue_2'), val('issue_3')],
        promotionGoals1to5: parseGoals(val('promotion_goals')),
        planFooterNote: val('visit_remark'),
        targetProjects: val('target_projects')
      },
      closingReport: {
        agmDate: val('agm_date'),
        auditorCertifyDate: val('certify_date')
      },
      scheduleAndActivities: {
        visitFrequencyPerYear: numVal('planned_visits') || 4,
        monthlyPlan12Months: []
      }
    };

    // สถานะ 4 สี/ผลจริง เดิมต้องคงไว้เมื่อซิงค์ซ้ำ
    var oldByMonth = {};
    (AppState.scheduleAndActivities.monthlyPlan12Months || []).forEach(function (m) {
      oldByMonth[m.month] = m;
    });

    MONTHS.forEach(function (m) {
      var old = oldByMonth[m.name] || {};
      state.scheduleAndActivities.monthlyPlan12Months.push({
        month: m.name,
        coopAction: val('coop_' + m.key),
        cpdAction: val('cpd_' + m.key),
        statusColor: old.statusColor || 'white',
        actualResult: old.actualResult || 0
      });
    });

    return state;
  }

  function mergeBaseIntoTabs(base) {
    var prevSummary = AppState._lastSummary || {};

    // meta + coop profile (owned by Tab 1)
    mergeDeep(AppState.meta, base.meta);
    AppState.meta.planId = AppState.meta.planId || base.meta.planId;
    mergeDeep(AppState.coopProfile, base.coopProfile);
    // คงจำนวนสมาชิกแยกชาย/หญิงที่กรอกในแท็บ 2 ไว้ (ฟอร์มหลักมีเฉพาะยอดรวม)
    var prevMembers = AppState.coopProfile.members || {};
    var baseMembers = base.coopProfile.members || {};
    AppState.coopProfile.members = {
      regularMale: num(prevMembers.regularMale),
      regularFemale: num(prevMembers.regularFemale),
      regularTotal: num(baseMembers.regularTotal),
      associateMale: num(prevMembers.associateMale),
      associateFemale: num(prevMembers.associateFemale),
      associateTotal: num(baseMembers.associateTotal),
      prevYearTotal: num(baseMembers.prevYearTotal)
    };

    // financial summary + detailed operating results (Year N / N-1)
    mergeDeep(AppState.financials.summary2Years, base.financials.summary2Years);
    mergeDeep(AppState.financials.operatingResults, base.financials.operatingResults);

    // balance sheet: เติมจาก Tab 1 เฉพาะช่องที่ว่าง หรือยังตรงกับยอดเดิมของ Tab 1
    var bs = AppState.financials.balanceSheet;
    var sum = AppState.financials.summary2Years;
    function syncBs(sumKey, bsKeys) {
      var prev = num(prevSummary[sumKey]);
      var curr = num(sum[sumKey]);
      var firstKey = bsKeys[0];
      var bsVal = num(bs[firstKey]);
      var untouched = !bsVal || (prev && bsVal === prev && curr !== prev);
      if (untouched) {
        bs[firstKey] = curr;
        for (var i = 1; i < bsKeys.length; i++) bs[bsKeys[i]] = 0;
      }
    }
    syncBs('assetsLatest', ['currentAssets', 'nonCurrentAssets']);
    syncBs('liabilitiesLatest', ['currentLiabilities', 'nonCurrentLiabilities']);
    syncBs('shareCapitalLatest', ['shareCapital']);
    syncBs('reserveFundLatest', ['reserveFund']);
    syncBs('otherAccumFundLatest', ['otherAccumFunds']);
    syncBs('netProfitLatest', ['netProfitYear']);
    syncBs('accumLossLatest', ['accumulatedLoss']);

    // strength: Tab 1 เป็นเจ้าของเมื่อยังไม่มีการกรอกตัวชี้วัดใน Tab 2
    var st = AppState.strength;
    YEARS.forEach(function (y) {
      if (y === '2567') return;
      // เช็กว่ามีตัวชี้วัดที่ผู้ใช้แก้เอง (ไม่ใช่ autoDistributed) หรือไม่
      var hasUserIndicators = STRENGTH_INDICATORS.some(function (ind) {
        var indData = st.indicators[ind.id] || {};
        var isAuto = indData._autoDistributed;
        return num(indData[y]) > 0 && !isAuto;
      });
      if (!hasUserIndicators) {
        st.classByYear[y] = base.strength.classByYear[y] || st.classByYear[y] || '';
        st.totalByYear[y] = base.strength.totalByYear[y] || st.totalByYear[y] || 0;
        st.dim1ByYear[y] = base.strength.dim1ByYear[y] || st.dim1ByYear[y] || 0;
        st.dim2ByYear[y] = base.strength.dim2ByYear[y] || st.dim2ByYear[y] || 0;
        st.dim3ByYear[y] = base.strength.dim3ByYear[y] || st.dim3ByYear[y] || 0;
        st.dim4ByYear[y] = base.strength.dim4ByYear[y] || st.dim4ByYear[y] || 0;
      }
    });

    // analysis (owned by Tab 1)
    mergeDeep(AppState.analysis, base.analysis);

    // AGM date (owned by Tab 1 / Page 2 input)
    if (base.closingReport && String(base.closingReport.agmDate || '').trim()) {
      AppState.closingReport.agmDate = base.closingReport.agmDate;
    }

    // monthly plan text (owned by Tab 1) — keep status/actual
    (base.scheduleAndActivities.monthlyPlan12Months || []).forEach(function (bm) {
      var target = AppState.scheduleAndActivities.monthlyPlan12Months.filter(function (m) {
        return m.month === bm.month;
      })[0];
      if (target) {
        target.coopAction = bm.coopAction;
        target.cpdAction = bm.cpdAction;
      }
    });
    AppState.scheduleAndActivities.visitFrequencyPerYear = base.scheduleAndActivities.visitFrequencyPerYear;

    AppState._lastSummary = deepClone(sum);
    applyAutoDeadlines();
    recalcFinancials();
    recalcStrength();
    return AppState;
  }

  function syncFromBaseFormToAllTabs() {
    if (isLoading) return AppState;
    var base = buildStateFromBaseForm();
    mergeBaseIntoTabs(base);
    if (global.CPD_UI && typeof global.CPD_UI.onStateSynced === 'function') {
      global.CPD_UI.onStateSynced('base');
    }
    scheduleLocalDraftSave(900);
    return AppState;
  }

  // -------------------------------------------------------------------------
  // Draft persistence (localStorage) — กันข้อมูลหายเมื่อสลับหน้า/โหลดใหม่
  // -------------------------------------------------------------------------

  var LOCAL_DRAFT_PREFIX = 'cpd_draft_v2_';
  var localSaveTimer = null;

  function localDraftKey() {
    var s = AppState;
    var coopKey = s.coopProfile.coopId13 || s.coopProfile.coopName || 'default';
    return LOCAL_DRAFT_PREFIX + (s.meta.fiscalYear || '2570') + '_' + String(coopKey).replace(/\s+/g, '_');
  }

  function collectBaseFormObject() {
    var form = {};
    try {
      if (typeof global.collectFormObject === 'function') form = global.collectFormObject();
    } catch (e) { form = {}; }
    return form;
  }

  function saveLocalDraft(form) {
    try {
      if (typeof localStorage === 'undefined') return '';
      var payload = {
        savedAt: new Date().toLocaleString('th-TH'),
        state: deepClone(AppState),
        form: form || collectBaseFormObject(),
        coopName: AppState.coopProfile.coopName || '',
        fiscalYear: AppState.meta.fiscalYear || '2570'
      };
      var key = localDraftKey();
      localStorage.setItem(key, JSON.stringify(payload));
      localStorage.setItem('cpd_last_draft_key', key);
      return payload.savedAt;
    } catch (e) {
      return '';
    }
  }

  function scheduleLocalDraftSave(delay) {
    if (isLoading) return;
    if (localSaveTimer) clearTimeout(localSaveTimer);
    localSaveTimer = setTimeout(function () {
      localSaveTimer = null;
      saveLocalDraft();
    }, delay || 900);
  }

  function readLocalDraft(key) {
    try {
      if (typeof localStorage === 'undefined') return null;
      var raw = localStorage.getItem(key || localStorage.getItem('cpd_last_draft_key'));
      if (!raw) return null;
      var payload = JSON.parse(raw);
      return payload && payload.state ? payload : null;
    } catch (e) {
      return null;
    }
  }

  function restoreLocalDraft() {
    var payload = readLocalDraft();
    if (!payload) return null;
    replaceState(payload.state);
    AppState.meta.fiscalYear = AppState.meta.fiscalYear || '2570';
    applyAutoDeadlines();
    recalcFinancials();
    recalcStrength();
    applyStateToBaseForm();
    if (payload.form && typeof global.loadFormFromSavedData === 'function') {
      global.loadFormFromSavedData(payload.form);
    }
    // กันไม่ให้ maybeLoadSavedRecord ดึง record เก่ามาทับร่างล่าสุดในทันที
    var s = AppState;
    var draftKey = (s.coopProfile.coopId13 || '') + '|' + s.coopProfile.coopName + '|' + (s.meta.fiscalYear || '2570');
    global.__cpdLoadedKey = draftKey;
    // จำสหกรณ์ที่กำลังใช้งาน เพื่อไม่ให้ onSelectCoop ล้างร่างที่เพิ่งกู้คืนตอนเลือกสหกรณ์เดิมซ้ำ
    if (s.coopProfile.coopName) global.__cpdActiveCoopKey = draftKey;
    return payload;
  }

  function clearLocalDraft() {
    try {
      if (typeof localStorage === 'undefined') return;
      var key = localDraftKey();
      localStorage.removeItem(key);
      if (localStorage.getItem('cpd_last_draft_key') === key) {
        localStorage.removeItem('cpd_last_draft_key');
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // Auto-calc financials
  // -------------------------------------------------------------------------

  function recalcFinancials() {
    var fin = AppState.financials;
    var bs = fin.balanceSheet;
    var is = fin.incomeStatement;
    var ratios = fin.ratios;

    bs.totalAssets = num(bs.currentAssets) + num(bs.nonCurrentAssets);
    bs.totalLiabilities = num(bs.currentLiabilities) + num(bs.nonCurrentLiabilities);
    bs.totalEquity = num(bs.shareCapital) + num(bs.reserveFund) + num(bs.otherAccumFunds) +
      num(bs.unrealizedInvestGain) + num(bs.revaluationSurplus) -
      Math.abs(num(bs.accumulatedLoss)) + num(bs.netProfitYear);

    var b = fin.businesses;
    ['credit', 'trading', 'collection', 'processing', 'service'].forEach(function (key) {
      var x = b[key] || {};
      var income = key === 'credit' ? num(x.interestIncome)
        : key === 'service' ? num(x.serviceIncome) : num(x.sales);
      var cost = key === 'credit' ? num(x.serviceCost)
        : key === 'service' ? num(x.serviceCost) : num(x.cogs);
      x.grossProfit = (key === 'credit' ? num(x.interestIncome) - num(x.serviceCost)
        : num(income) - num(cost));
      x.netBusinessProfit = num(x.grossProfit) +
        num(x.specificIncome) - num(x.specificExpense);
      if (key === 'trading') {
        x.netBusinessProfit = num(x.grossProfit) -
          num(x.lessUncollectedProfitCurrent) + num(x.addCollectedProfitPrev) +
          num(x.specificIncome) - num(x.specificExpense);
      }
    });

    var totalSales = num(b.trading.sales) + num(b.collection.sales) + num(b.processing.sales) +
      num(b.service.serviceIncome);
    var totalCogs = num(b.trading.cogs) + num(b.collection.cogs) + num(b.processing.cogs) +
      num(b.service.serviceCost);

    is.totalSalesService = totalSales;
    is.totalCogsService = totalCogs;
    is.grossProfit = totalSales - totalCogs;
    is.lessUncollectedProfitCurrent = num(b.trading.lessUncollectedProfitCurrent);
    is.addCollectedProfitPrev = num(b.trading.addCollectedProfitPrev);
    is.specificIncome = num(b.credit.specificIncome) + num(b.trading.specificIncome) +
      num(b.collection.specificIncome) + num(b.processing.specificIncome) + num(b.service.specificIncome);
    is.specificExpense = num(b.credit.specificExpense) + num(b.trading.specificExpense) +
      num(b.collection.specificExpense) + num(b.processing.specificExpense) + num(b.service.specificExpense);
    is.netSpecificProfit = num(is.grossProfit) - num(is.lessUncollectedProfitCurrent) +
      num(is.addCollectedProfitPrev) + num(is.specificIncome) - num(is.specificExpense);
    // profitBeforeOpEx = กำไรเฉพาะธุรกิจ + รายได้อื่น
    is.profitBeforeOpEx = num(is.netSpecificProfit) + num(is.otherIncome);
    is.netProfit = num(is.profitBeforeOpEx) +
      num(is.priorPeriodAdjustment) - num(is.operatingExpense);

    // 7 อัตราส่วนทางการเงินตามเกณฑ์ CAD (กรมตรวจบัญชีสหกรณ์)
    // (1) DE Ratio = หนี้สินรวม / ทุนรวม
    ratios.deRatio = num(bs.totalEquity) ? round4(num(bs.totalLiabilities) / num(bs.totalEquity)) : 0;
    
    // คำนวณค่าเฉลี่ย 2 ปีสำหรับ ROE และ ROA
    var prevEquity = num(fin.summary2Years.assetsPrev) - num(fin.summary2Years.liabilitiesPrev);
    var currEquity = num(bs.totalEquity);
    var avgEquity = prevEquity > 0 ? (currEquity + prevEquity) / 2 : currEquity;
    
    var prevAssets = num(fin.summary2Years.assetsPrev);
    var currAssets = num(bs.totalAssets);
    var avgAssets = prevAssets > 0 ? (currAssets + prevAssets) / 2 : currAssets;
    
    // (2) ROE (%) = (กำไรสุทธิ / ทุนเฉลี่ย) * 100
    ratios.roe = avgEquity > 0 ? round4((num(bs.netProfitYear) / avgEquity) * 100) : 0;
    
    // (3) ROA (%) = (กำไรสุทธิ / สินทรัพย์เฉลี่ย) * 100
    ratios.roa = avgAssets > 0 ? round4((num(bs.netProfitYear) / avgAssets) * 100) : 0;
    
    // (4) อัตราส่วนทุนหมุนเวียน = สินทรัพย์หมุนเวียน / หนี้สินหมุนเวียน
    ratios.currentRatio = num(bs.currentLiabilities) ? round4(num(bs.currentAssets) / num(bs.currentLiabilities)) : 0;
    
    // (5) ทุนสำรองต่อสินทรัพย์ = ทุนสำรอง / สินทรัพย์รวม
    ratios.reserveToAssetRatio = num(bs.totalAssets) ? round4(num(bs.reserveFund) / num(bs.totalAssets)) : 0;
    
    // (6) อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่าย (%)
    var profitBeforeOpEx = num(is.profitBeforeOpEx);
    ratios.opexToGrossProfitRatio = profitBeforeOpEx > 0
      ? round4((num(is.operatingExpense) / profitBeforeOpEx) * 100) : 0;
    
    // (7) อัตราลูกหนี้ระยะสั้นชำระตามกำหนด (%) - แสดงเป็น 0.00 เสมอถ้าไม่มีข้อมูล
    ratios.shortTermDebtPaidOnTimeRatio = ratios.shortTermDebtPaidOnTimeRatio || 0;

    // อัปเดตยอดสรุปให้ตรงกับงบที่กรอกใน Tab 2
    var sum = fin.summary2Years;
    if (num(bs.totalAssets)) sum.assetsLatest = num(bs.totalAssets);
    if (num(bs.totalLiabilities)) sum.liabilitiesLatest = num(bs.totalLiabilities);
    if (num(bs.shareCapital)) sum.shareCapitalLatest = num(bs.shareCapital);
    if (num(bs.reserveFund)) sum.reserveFundLatest = num(bs.reserveFund);
    if (num(bs.otherAccumFunds)) sum.otherAccumFundLatest = num(bs.otherAccumFunds);
    if (num(bs.netProfitYear)) sum.netProfitLatest = num(bs.netProfitYear);
    if (num(bs.accumulatedLoss)) sum.accumLossLatest = Math.abs(num(bs.accumulatedLoss));

    return fin;
  }

  function round4(n) {
    return Math.round((Number(n) || 0) * 10000) / 10000;
  }

  // round2 - ปัดเศษทศนิยม 2 ตำแหน่ง (ใช้ Number(sum.toFixed(2)))
  function round2(n) {
    return Number((Number(n) || 0).toFixed(2));
  }

  // -------------------------------------------------------------------------
  // 4M Ratios (CAMELS extended)
  // -------------------------------------------------------------------------

  function recalc4MRatios() {
    var s = AppState;
    var f = s.financials || {};
    var sum = f.summary2Years || {};
    var bs = f.balanceSheet || {};
    var op = f.operatingResults || {};
    var N = op.latest || {};
    var N1 = op.prev || {};
    if (!f.ratios) f.ratios = {};

    var assets = num(sum.assetsLatest) || num(bs.totalAssets);
    var assetsPrev = num(sum.assetsPrev);
    var liabilities = num(sum.liabilitiesLatest) || num(bs.totalLiabilities);
    var profit = num(sum.netProfitLatest) || num(bs.netProfitYear);
    var profitPrev = num(sum.netProfitPrev);
    var equity = assets > 0 ? assets - liabilities : 0;
    var reserve = num(sum.reserveFundLatest);
    var income = num(N.totalIncome);

    // D/E
    if (equity > 0 && !f.ratios.deRatio) {
      f.ratios.deRatio = round4(liabilities / equity);
    }

    // คำนวณ 2-year average equity และ assets สำหรับ ROE และ ROA
    var prevEquity = num(sum.assetsPrev) - num(sum.liabilitiesPrev);
    var avgEquity = prevEquity > 0 ? (equity + prevEquity) / 2 : equity;
    var avgAssets = assetsPrev > 0 ? (assets + assetsPrev) / 2 : assets;

    // ROE (%) - ใช้ 2-year average equity (คำนวณเฉพาะเมื่อยังไม่มีค่า)
    if (avgEquity > 0 && profit !== 0 && !f.ratios.roe) {
      f.ratios.roe = round4((profit / avgEquity) * 100);
    }

    // ROA (%) - ใช้ 2-year average assets (คำนวณเฉพาะเมื่อยังไม่มีค่า)
    if (avgAssets > 0 && profit !== 0 && !f.ratios.roa) {
      f.ratios.roa = round4((profit / avgAssets) * 100);
    }

    // Current Ratio
    if (bs.currentAssets && bs.currentLiabilities && !f.ratios.currentRatio) {
      f.ratios.currentRatio = round4(num(bs.currentAssets) / num(bs.currentLiabilities));
    }

    // Reserve to Asset Ratio
    if (assets > 0 && !f.ratios.reserveToAssetRatio) {
      f.ratios.reserveToAssetRatio = round4(reserve / assets);
    }

    // หมายเหตุ: opexToGrossProfitRatio เป็นความรับผิดชอบของ recalcFinancials() เท่านั้น
    // (อัตราค่าใช้จ่ายดำเนินงาน / กำไรก่อนหักค่าใช้จ่าย) — ห้ามคำนวณซ้ำด้วยสูตรเดิม

    // === 4M Extended Ratios (เติมเฉพาะถ้ายังไม่มีค่า) ===

    // Asset Turnover = รายได้ / สินทรัพย์
    if (assets > 0 && income > 0 && !f.ratios.assetTurnover) {
      f.ratios.assetTurnover = income / assets;
    }

    // Asset Growth Rate (%)
    if (assetsPrev > 0 && !f.ratios.assetGrowthRate) {
      f.ratios.assetGrowthRate = ((assets - assetsPrev) / assetsPrev) * 100;
    }

    // Profit Growth Rate (%)
    if (profitPrev > 0 && !f.ratios.profitGrowthRate) {
      f.ratios.profitGrowthRate = ((profit - profitPrev) / profitPrev) * 100;
    }

    // Net Profit per Member (เงินออมเฉลี่ย/กำไรเฉลี่ย)
    var membersTotal = num(s.coopProfile.members.regularTotal) + num(s.coopProfile.members.associateTotal);
    if (membersTotal > 0 && profit > 0 && !f.ratios.profitPerMember) {
      f.ratios.profitPerMember = profit / membersTotal;
    }

    // Avg Saving per Member
    if (membersTotal > 0 && num(N.avgSaving) > 0 && !f.ratios.avgSavingPerMember) {
      f.ratios.avgSavingPerMember = num(N.avgSaving);
    }

    // Avg Debt per Member
    if (membersTotal > 0 && num(N.avgDebt) > 0 && !f.ratios.avgDebtPerMember) {
      f.ratios.avgDebtPerMember = num(N.avgDebt);
    }

    return f.ratios;
  }

  // -------------------------------------------------------------------------
  // Strength 18 indicators
  // -------------------------------------------------------------------------

  function recalcStrength() {
    var st = AppState.strength;
    YEARS.forEach(function (y) {
      var dims = { 1: 0, 2: 0, 3: 0, 4: 0 };
      var dimHasUserIndicator = { 1: false, 2: false, 3: false, 4: false };
      
      // คำนวณคะแนนจากตัวชี้วัดที่ผู้ใช้แก้เอง (ไม่ใช่ autoDistributed)
      STRENGTH_INDICATORS.forEach(function (ind) {
        var v = num((st.indicators[ind.id] || {})[y]);
        var isAuto = (st.indicators[ind.id] || {})._autoDistributed;
        if (v > 0 && !isAuto) {
          dimHasUserIndicator[ind.dim] = true;
          dims[ind.dim] += v;
        }
      });
      
      // สำหรับมิติที่ไม่มีตัวชี้วัดที่ผู้ใช้แก้ -> ใช้ค่า autoDistributed หรือ dim total จากหน้า 1
      for (var d = 1; d <= 4; d++) {
        if (!dimHasUserIndicator[d]) {
          // มิติ上没有ผู้ใช้แก้ -> คำนวณจาก autoDistributed indicators
          var autoDistributedSum = 0;
          STRENGTH_INDICATORS.forEach(function (ind) {
            if (ind.dim === d) {
              var v = num((st.indicators[ind.id] || {})[y]);
              var isAuto = (st.indicators[ind.id] || {})._autoDistributed;
              if (v > 0 && isAuto) {
                autoDistributedSum += v;
              }
            }
          });
          
          if (autoDistributedSum > 0) {
            // มี autoDistributed indicators -> ใช้ค่ารวม
            dims[d] = autoDistributedSum;
          } else {
            // ไม่มี autoDistributed -> ใช้ dim total จากหน้า 1 (หรือค่าเดิม)
            dims[d] = num(st['dim' + d + 'ByYear'][y]);
          }
        }
      }
      
      // ถ้ายังไม่มีตัวชี้วัดที่ผู้ใช้แก้และไม่มีการกระจาย -> กระจาย dim1-4 จากหน้า 1
      var anyUserIndicator = Object.keys(dimHasUserIndicator).some(function(k) { return dimHasUserIndicator[k]; });
      
      // เช็กว่าปีนี้มีตัวชี้วัดที่ถูกกระจายค่าแล้วหรือไม่ (ต้องมีค่าจริงในปีนี้ด้วย)
      // เดิมใช้ flag ร่วมทุกปี ทำให้ปี 2569 (ที่ preload มีแต่ปี 2568) ไม่ถูกกระจายค่าและผลหาย
      var hasAutoDistributedIndicator = STRENGTH_INDICATORS.some(function(ind) {
        var indData = st.indicators[ind.id] || {};
        return indData._autoDistributed === true && num(indData[y]) > 0;
      });
      
      if (!anyUserIndicator && !hasAutoDistributedIndicator) {
        for (var d2 = 1; d2 <= 4; d2++) {
          var dimTotal = num(st['dim' + d2 + 'ByYear'][y]);
          if (dimTotal <= 0) continue;
          
          var indicatorsInDim = STRENGTH_INDICATORS.filter(function (ind) { return ind.dim === d2; });
          var totalWeight = indicatorsInDim.reduce(function (sum, ind) { return sum + ind.weight; }, 0);
          if (totalWeight === 0) continue;
          
          indicatorsInDim.forEach(function (ind) {
            if (!st.indicators[ind.id]) st.indicators[ind.id] = {};
            var distributed = round4(dimTotal * ind.weight / totalWeight);
            st.indicators[ind.id][y] = distributed;
            st.indicators[ind.id]._autoDistributed = true;
          });
        }
      }
      
      // ตั้งค่า dim totals หลังคำนวณเสร็จ
      st.dim1ByYear[y] = round4(dims[1]);
      st.dim2ByYear[y] = round4(dims[2]);
      st.dim3ByYear[y] = round4(dims[3]);
      st.dim4ByYear[y] = round4(dims[4]);
      st.totalByYear[y] = round4(dims[1] + dims[2] + dims[3] + dims[4]);
    });
    return st;
  }

  // -------------------------------------------------------------------------
  // Apply state -> Tab 1 (for dashboard "load to edit" / saved record)
  // -------------------------------------------------------------------------

  function setVal(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value === undefined || value === null ? '' : value;
  }

  function applyStateToBaseForm() {
    isLoading = true;
    try {
      var s = AppState;
      var c = s.coopProfile;
      var sum = s.financials.summary2Years;
      var st = s.strength;
      var an = s.analysis;
      var sch = s.scheduleAndActivities;

      setVal('coop_name', c.coopName);
      setVal('district', c.district);
      setVal('distance', c.distanceKm || '');
      setVal('group_zone', c.promotionZone);
      setVal('main_officer', c.primaryOfficer);
      setVal('co_officers', c.coOfficer);
      setVal('reg_date', c.regDate);
      setVal('board_count', c.boardCount || '');
      setVal('inspector_count', c.inspectorCount || '');
      setVal('inspector_name', c.inspectorName);
      setVal('target_projects', an.targetProjects);
      setVal('fiscal_year', c.fiscalEndDate || '31 มีนาคม');

      setVal('mem_latest', [c.members.regularTotal + c.members.associateTotal, c.members.regularTotal, c.members.associateTotal].join('/'));
      setVal('mem_prev', c.members.prevYearTotal ? String(c.members.prevYearTotal) : '');
      setVal('asset_latest', sum.assetsLatest || '');
      setVal('asset_prev', sum.assetsPrev || '');
      setVal('debt_latest', sum.liabilitiesLatest || '');
      setVal('debt_prev', sum.liabilitiesPrev || '');
      setVal('share_latest', sum.shareCapitalLatest || '');
      setVal('share_prev', sum.shareCapitalPrev || '');
      setVal('reserve_latest', sum.reserveFundLatest || '');
      setVal('reserve_prev', sum.reserveFundPrev || '');
      setVal('accumfund_latest', sum.otherAccumFundLatest || '');
      setVal('accumfund_prev', sum.otherAccumFundPrev || '');
      setVal('profit_latest', sum.netProfitLatest || '');
      setVal('profit_prev', sum.netProfitPrev || '');
      setVal('loss_latest', sum.accumLossLatest || '');
      setVal('loss_prev', sum.accumLossPrev || '');
      setVal('biz_vol_latest', sum.businessVolumeLatest || '');
      setVal('biz_vol_prev', sum.businessVolumePrev || '');
      setVal('business_types', sum.activeBusinessesText || (c.mainBusinesses || []).join('\n'));

      var op = s.financials.operatingResults || {};
      DETAIL_FIELDS.forEach(function (p) {
        ['latest', 'prev'].forEach(function (suffix) {
          var yearObj = op[suffix] || {};
          var v = yearObj[p[0]];
          setVal(p[1] + '_' + suffix, numOrEmpty(v));
        });
      });

      var agm = deriveAgmDates();
      setVal('agm_date', s.closingReport.agmDate || agm.agmDate);
      setVal('certify_date', agm.certifyDate);

      setVal('c68_lv', st.classByYear['2568']);
      setVal('c68_tot', st.totalByYear['2568'] || '');
      setVal('c68_d1', st.dim1ByYear['2568'] || '');
      setVal('c68_d2', st.dim2ByYear['2568'] || '');
      setVal('c68_d3', st.dim3ByYear['2568'] || '');
      setVal('c68_d4', st.dim4ByYear['2568'] || '');
      setVal('c69_lv', st.classByYear['2569']);
      setVal('c69_tot', st.totalByYear['2569'] || '');
      setVal('c69_d1', st.dim1ByYear['2569'] || '');
      setVal('c69_d2', st.dim2ByYear['2569'] || '');
      setVal('c69_d3', st.dim3ByYear['2569'] || '');
      setVal('c69_d4', st.dim4ByYear['2569'] || '');
      setVal('issue_1', an.issuesTop3[0]);
      setVal('issue_2', an.issuesTop3[1]);
      setVal('issue_3', an.issuesTop3[2]);
      setVal('promotion_goals', (an.promotionGoals1to5 || []).join('\n'));
      setVal('visit_remark', an.planFooterNote);
      setVal('planned_visits', sch.visitFrequencyPerYear || 4);

      (sch.monthlyPlan12Months || []).forEach(function (m) {
        var mk = monthByName(m.month);
        if (!mk) return;
        setVal('coop_' + mk.key, m.coopAction);
        setVal('cpd_' + mk.key, m.cpdAction);
      });

      // auditor
      var at = document.getElementById('auditor_type');
      if (at) at.value = c.auditorType || 'ภาครัฐ';
      if (c.auditorType === 'ภาคเอกชน') {
        setVal('priv_auditor_name', c.auditorName);
        if (typeof global.onAuditorTypeChange === 'function') global.onAuditorTypeChange();
        if (document.getElementById('priv_auditor_name')) document.getElementById('priv_auditor_name').value = c.auditorName || '';
      } else {
        setVal('gov_auditor_name', c.auditorName || 'คนึงศรี');
        if (typeof global.onAuditorTypeChange === 'function') global.onAuditorTypeChange();
        if (document.getElementById('gov_auditor_name')) document.getElementById('gov_auditor_name').value = c.auditorName || 'คนึงศรี';
      }

      // เลือกสหกรณ์ใน dropdown ให้ตรงชื่อ
      if (typeof global.masterCoops !== 'undefined' && Array.isArray(global.masterCoops)) {
        var idx = -1;
        for (var i = 0; i < global.masterCoops.length; i++) {
          var mc = global.masterCoops[i];
          if ((c.coopId13 && mc.code13 === c.coopId13) ||
            (c.coopName && mc.name === c.coopName)) { idx = i; break; }
        }
        var sel = document.getElementById('coopSelect');
        if (idx >= 0 && sel) {
          sel.value = String(idx);
          global.currentCoopIndex = idx;
        }
      }

      if (typeof global.validateAccountingEquation === 'function') global.validateAccountingEquation();
      if (typeof global.generate12MonthSchedule === 'function') {
        // ไม่เรียกเพื่อไม่ให้ทับข้อความแผนที่โหลดมา
      }
    } finally {
      isLoading = false;
    }
  }

  function loadStateFromRecord(state) {
    replaceState(state || {});
    AppState.meta.fiscalYear = AppState.meta.fiscalYear || '2570';
    applyAutoDeadlines();
    recalcFinancials();
    recalcStrength();
    applyStateToBaseForm();
    if (global.CPD_UI && typeof global.CPD_UI.renderAll === 'function') {
      global.CPD_UI.renderAll();
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  global.CPD_STATE = {
    MONTHS: MONTHS,
    MONTHLY_BIZ: MONTHLY_BIZ,
    STRENGTH_INDICATORS: STRENGTH_INDICATORS,
    YEARS: YEARS,
    DETAIL_FIELDS: DETAIL_FIELDS,
    defaultState: defaultState,
    num: num,
    fmt: fmt,
    fmtInt: fmtInt,
    escapeHtml: escapeHtml,
    getPath: getPath,
    setPath: setPath,
    mergeDeep: mergeDeep,
    replaceState: replaceState,
    deepClone: deepClone,
    computeDeadlines: computeDeadlines,
    parseDateParts: parseDateParts,
    deriveCertifyDate: deriveCertifyDate,
    deriveAgmDates: deriveAgmDates,
    applyAutoDeadlines: applyAutoDeadlines,
    buildStateFromBaseForm: buildStateFromBaseForm,
    mergeBaseIntoTabs: mergeBaseIntoTabs,
    syncFromBaseFormToAllTabs: syncFromBaseFormToAllTabs,
    recalcFinancials: recalcFinancials,
    recalcStrength: recalcStrength,
    recalc4MRatios: recalc4MRatios,
    applyStateToBaseForm: applyStateToBaseForm,
    loadStateFromRecord: loadStateFromRecord,
    localDraftKey: localDraftKey,
    saveLocalDraft: saveLocalDraft,
    scheduleLocalDraftSave: scheduleLocalDraftSave,
    readLocalDraft: readLocalDraft,
    restoreLocalDraft: restoreLocalDraft,
    clearLocalDraft: clearLocalDraft,
    monthByName: monthByName,
    monthByKey: monthByKey,
    getFiscalYear: getFiscalYear,
    isLoading: function () { return isLoading; },
    setLoading: function (v) { isLoading = !!v; }
  };

  global.CPD_AppState = AppState;
  global.syncFromBaseFormToAllTabs = syncFromBaseFormToAllTabs;
})(window);

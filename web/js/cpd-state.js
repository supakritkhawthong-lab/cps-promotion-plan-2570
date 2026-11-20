/**
 * cpd-state.js - global state and calculation helpers for the 3-page app.
 * Keeps the state shape used by the dashboard fallback and strength table;
 * base-form sync, local draft, upload/AI state and load-to-edit were removed.
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
        publicBenefitFundAmount: ''
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
    var raw = String(value === undefined || value === null ? '' : value).trim();
    if (!raw || raw === '-' || raw === '–' || raw === '—') return 0;

    // วงเล็บในงบการเงินหมายถึงค่าลบ: (1,234.50) → -1234.50
    var negative = /^\(.*\)$/.test(raw);
    var s = raw
      .replace(/[๐-๙]/g, function (ch) { return String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)); })
      .replace(/,/g, '')
      .replace(/[()]/g, '')
      .replace(/บาท/g, '')
      .replace(/\s+/g, '')
      .trim();
    if (!s || s === '-') return 0;

    if (/-$/.test(s)) {
      negative = true;
      s = s.replace(/-$/, '');
    }
    if (/^-/.test(s)) {
      negative = true;
      s = s.replace(/^-/, '');
    }

    var n = Number(s);
    if (!isFinite(n)) return 0;
    return negative ? -Math.abs(n) : n;
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

  function round4(n) {
    return Math.round((Number(n) || 0) * 10000) / 10000;
  }
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
    recalcStrength: recalcStrength,
    monthByName: monthByName,
    monthByKey: monthByKey,
    getFiscalYear: getFiscalYear,
    isLoading: function () { return isLoading; },
    setLoading: function (v) { isLoading = !!v; }
  };

  global.CPD_AppState = AppState;
})(window);

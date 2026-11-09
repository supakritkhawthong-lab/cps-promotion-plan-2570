/**
 * cpd-state.js โ€” Global state + auto-sync engine
 *
 * Zero Regression Rule: เนเธเธฅเนเธเธตเนเนเธกเนเนเธเน id เธซเธฃเธทเธญเธเธฑเธเธเนเธเธฑเธเน€เธ”เธดเธกเนเธเธซเธเนเธฒ Tab 1
 * เธ—เธณเธซเธเนเธฒเธ—เธตเนเธญเนเธฒเธเธเนเธฒเธเธฒเธเธเธญเธฃเนเธกเน€เธ”เธดเธก -> CPD_AppState -> เน€เธ•เธดเธกเนเธ—เนเธ 2/3/4/5
 */
(function (global) {
  'use strict';

  var MONTHS = [
    { key: 'm10', name: 'เธ•เธธเธฅเธฒเธเธก', num: 10 },
    { key: 'm11', name: 'เธเธคเธจเธเธดเธเธฒเธขเธ', num: 11 },
    { key: 'm12', name: 'เธเธฑเธเธงเธฒเธเธก', num: 12 },
    { key: 'm1', name: 'เธกเธเธฃเธฒเธเธก', num: 1 },
    { key: 'm2', name: 'เธเธธเธกเธ เธฒเธเธฑเธเธเน', num: 2 },
    { key: 'm3', name: 'เธกเธตเธเธฒเธเธก', num: 3 },
    { key: 'm4', name: 'เน€เธกเธฉเธฒเธขเธ', num: 4 },
    { key: 'm5', name: 'เธเธคเธฉเธ เธฒเธเธก', num: 5 },
    { key: 'm6', name: 'เธกเธดเธ–เธธเธเธฒเธขเธ', num: 6 },
    { key: 'm7', name: 'เธเธฃเธเธเธฒเธเธก', num: 7 },
    { key: 'm8', name: 'เธชเธดเธเธซเธฒเธเธก', num: 8 },
    { key: 'm9', name: 'เธเธฑเธเธขเธฒเธขเธ', num: 9 }
  ];

  var THAI_MONTHS = [
    '', 'เธกเธเธฃเธฒเธเธก', 'เธเธธเธกเธ เธฒเธเธฑเธเธเน', 'เธกเธตเธเธฒเธเธก', 'เน€เธกเธฉเธฒเธขเธ', 'เธเธคเธฉเธ เธฒเธเธก', 'เธกเธดเธ–เธธเธเธฒเธขเธ',
    'เธเธฃเธเธเธฒเธเธก', 'เธชเธดเธเธซเธฒเธเธก', 'เธเธฑเธเธขเธฒเธขเธ', 'เธ•เธธเธฅเธฒเธเธก', 'เธเธคเธจเธเธดเธเธฒเธขเธ', 'เธเธฑเธเธงเธฒเธเธก'
  ];

  var MONTHLY_BIZ = [
    { key: 'deposit', label: 'เน€เธเธดเธเธฃเธฑเธเธเธฒเธ' },
    { key: 'credit', label: 'เน€เธเธดเธเนเธซเนเธเธนเน' },
    { key: 'trading', label: 'เธเธฑเธ”เธซเธฒเธชเธดเธเธเนเธฒเธกเธฒเธเธณเธซเธเนเธฒเธข' },
    { key: 'collection', label: 'เธฃเธงเธเธฃเธงเธกเธเธฅเธเธฅเธดเธ•' },
    { key: 'processing', label: 'เนเธเธฃเธฃเธนเธเธเธฅเธเธฅเธดเธ•' },
    { key: 'service', label: 'เธเธฃเธดเธเธฒเธฃ' }
  ];

  var STRENGTH_INDICATORS = [
    { id: '1.1', dim: 1, name: 'เธญเธฑเธ•เธฃเธฒเธชเนเธงเธเธเธญเธเธชเธกเธฒเธเธดเธเธ—เธตเนเธกเธตเธชเนเธงเธเธฃเนเธงเธกเนเธเธเธฒเธฃเธ”เธณเน€เธเธดเธเธเธธเธฃเธเธดเธเธเธฑเธเธชเธซเธเธฃเธ“เน', weight: 15 },
    { id: '1.2', dim: 1, name: 'เธเธฅเธเธฒเธฃเธ”เธณเน€เธเธดเธเธเธฒเธเนเธเธฃเธญเธเธชเธญเธเธเธตเธเธฑเธเธเธตเธขเนเธญเธเธซเธฅเธฑเธ เธเธฑเธ”เธชเธฃเธฃเธเธณเนเธฃเธชเธธเธ—เธเธดเนเธฅเธฐเธเนเธฒเธขเธ—เธธเธเธชเธงเธฑเธชเธ”เธดเธเธฒเธฃเธชเธกเธฒเธเธดเธเนเธฅเธฐเธ—เธธเธเธชเธฒเธเธฒเธฃเธ“เธเธฃเธฐเนเธขเธเธเน', weight: 10 },
    { id: '1.3', dim: 1, name: 'เธเธณเธเธงเธเธเธฃเธฐเน€เธ เธ—เธเธธเธฃเธเธดเธเธ—เธตเนเธชเธซเธเธฃเธ“เนเธ”เธณเน€เธเธดเธเธเธฒเธ', weight: 5 },
    { id: '2.1', dim: 2, name: 'เธญเธฑเธ•เธฃเธฒเธชเนเธงเธเธซเธเธตเนเธชเธดเธเธ•เนเธญเธ—เธธเธ', weight: 3 },
    { id: '2.2', dim: 2, name: 'เธญเธฑเธ•เธฃเธฒเธชเนเธงเธเธ—เธธเธเธชเธณเธฃเธญเธเธ•เนเธญเธชเธดเธเธ—เธฃเธฑเธเธขเน', weight: 2 },
    { id: '2.3', dim: 2, name: 'เธญเธฑเธ•เธฃเธฒเธเธฅเธ•เธญเธเนเธ—เธเธ•เนเธญเธชเธดเธเธ—เธฃเธฑเธเธขเน', weight: 4 },
    { id: '2.4', dim: 2, name: 'เธญเธฑเธ•เธฃเธฒเธเนเธฒเนเธเนเธเนเธฒเธขเธ”เธณเน€เธเธดเธเธเธฒเธเธ•เนเธญเธเธณเนเธฃเธเนเธญเธเธซเธฑเธเธเนเธฒเนเธเนเธเนเธฒเธขเธ”เธณเน€เธเธดเธเธเธฒเธ', weight: 4 },
    { id: '2.5', dim: 2, name: 'เธญเธฑเธ•เธฃเธฒเธชเนเธงเธเธ—เธธเธเธซเธกเธธเธเน€เธงเธตเธขเธ', weight: 3 },
    { id: '2.6', dim: 2, name: 'เธญเธฑเธ•เธฃเธฒเธฅเธนเธเธซเธเธตเนเธฃเธฐเธขเธฐเธชเธฑเนเธเธ—เธตเนเธเธณเธฃเธฐเธซเธเธตเนเนเธ”เนเธ•เธฒเธกเธเธณเธซเธเธ”', weight: 4 },
    { id: '3.1', dim: 3, name: 'เธฃเธฐเธ”เธฑเธเธเธฒเธฃเนเธเนเน€เธ—เธเนเธเนเธฅเธขเธตเธเธฒเธฃเธเธฑเธเธเธตเนเธเธเธฒเธฃเธเธฃเธดเธซเธฒเธฃเธเธฑเธ”เธเธฒเธฃเธเนเธญเธกเธนเธฅ', weight: 4 },
    { id: '3.2', dim: 3, name: 'เธเธฅเธเธฒเธฃเธเธฃเธฐเน€เธกเธดเธเธชเธ เธฒเธเนเธงเธ”เธฅเนเธญเธกเธเธฒเธฃเธเธงเธเธเธธเธก', weight: 4 },
    { id: '3.3', dim: 3, name: 'เธเธฅเธเธฒเธฃเธเธฃเธฐเน€เธกเธดเธเธเธงเธฒเธกเน€เธชเธตเนเธขเธเนเธฅเธฐเธเธดเธเธเธฃเธฃเธกเธเธงเธเธเธธเธก', weight: 4 },
    { id: '3.4', dim: 3, name: 'เธเธฅเธเธฒเธฃเธเธฃเธฐเน€เธกเธดเธเธฃเธฐเธเธเธเนเธญเธกเธนเธฅเธชเธฒเธฃเธชเธเน€เธ—เธจเนเธฅเธฐเธเธฒเธฃเธชเธทเนเธญเธชเธฒเธฃ', weight: 4 },
    { id: '3.5', dim: 3, name: 'เธเธฅเธเธฒเธฃเธเธฃเธฐเน€เธกเธดเธเธฃเธฐเธเธเธเธฒเธฃเธ•เธดเธ”เธ•เธฒเธกเนเธฅเธฐเธเธฃเธฐเน€เธกเธดเธเธเธฅ', weight: 4 },
    { id: '4.1', dim: 4, name: 'เธเธฅเธเธฒเธฃเธ”เธณเน€เธเธดเธเธเธฒเธเธเธญเธเธชเธซเธเธฃเธ“เนเธ•เนเธญเธเนเธกเนเธกเธตเธเธฒเธฃเธเนเธฒเธเธทเธเธฃเธฐเน€เธเธตเธขเธ เธเธณเธชเธฑเนเธเธเธฒเธขเธ—เธฐเน€เธเธตเธขเธ เธเนเธญเธเธเธซเธกเธฒเธข', weight: 15 },
    { id: '4.2', dim: 4, name: 'เธเธฅเธเธฒเธฃเธ”เธณเน€เธเธดเธเธเธฒเธเนเธเธฃเธญเธเธชเธญเธเธเธตเธเธฑเธเธเธตเธขเนเธญเธเธซเธฅเธฑเธ เธชเธซเธเธฃเธ“เนเธกเธตเธเธฅเธเธฒเธฃเธ”เธณเน€เธเธดเธเธเธฒเธเนเธกเนเธเธฒเธ”เธ—เธธเธ', weight: 5 },
    { id: '4.3', dim: 4, name: 'เธเธฑเธ”เธ—เธณเธเธเธเธฒเธฃเน€เธเธดเธเนเธฅเนเธงเน€เธชเธฃเนเธเนเธฅเธฐเธชเนเธเนเธซเนเธเธนเนเธชเธญเธเธเธฑเธเธเธตเธ•เธฃเธงเธเธชเธญเธเนเธฅเธฐเธเธณเน€เธชเธเธญเธ—เธตเนเธเธฃเธฐเธเธธเธกเนเธซเธเนเธญเธเธธเธกเธฑเธ•เธดเธ เธฒเธขเนเธ 150 เธงเธฑเธ', weight: 5 },
    { id: '4.4', dim: 4, name: 'เธชเธซเธเธฃเธ“เนเธเธฑเธ”เธเนเธฒเธเน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเธเธเธดเธเธฑเธ•เธดเธเธฒเธเธเธฃเธฐเธเธณเธฃเธฑเธเธเธดเธ”เธเธญเธเธ”เธณเน€เธเธดเธเธเธฒเธเนเธฅเธฐเธเธธเธฃเธเธดเธเธเธญเธเธชเธซเธเธฃเธ“เน', weight: 5 }
  ];

  var YEARS = ['2567', '2568', '2569'];

  // เธเนเธญเธเธเธฅเธเธฒเธฃเธ”เธณเน€เธเธดเธเธเธฒเธเธเธเธฑเธเธฅเธฐเน€เธญเธตเธขเธ” (Year N / Year N-1)
  // [เธเธทเนเธญเนเธ state, เธเธณเธเธณเธซเธเนเธฒ id เนเธเธเธญเธฃเนเธกเธซเธเนเธฒ 1]
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
        officeName: 'เธชเธณเธเธฑเธเธเธฒเธเธชเธซเธเธฃเธ“เนเธเธฑเธเธซเธงเธฑเธ”เธเธฅเธเธธเธฃเธต',
        approvalStatus: 'เธฃเนเธฒเธ',
        plannerName: '',
        approverName: '',
        updatedAt: '',
        approvedAt: ''
      },
      coopProfile: {
        coopId13: '',
        coopName: '',
        orgType: 'เธชเธซเธเธฃเธ“เน',
        coopSubType: 'เธชเธซเธเธฃเธ“เนเธเธฒเธฃเน€เธเธฉเธ•เธฃ',
        status: 'เธ”เธณเน€เธเธดเธเธเธฒเธฃ',
        district: '',
        distanceKm: 0,
        promotionZone: '',
        primaryOfficer: '',
        coOfficer: '',
        regDate: '',
        fiscalEndDate: '31 เธกเธตเธเธฒเธเธก',
        boardCount: 0,
        auditorType: 'เธ เธฒเธเธฃเธฑเธ',
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
            internalControlLevel: '', // เธ”เธตเธกเธฒเธ|เธ”เธต|เธเธญเนเธเน|เธเธงเธฃเธเธฃเธฑเธเธเธฃเธธเธ
            closeAccountDays: 0,
            agmDays: 0,
            hasFraud: false
          },
          auditorObservations: {
            hasInternalControlWeakness: false,
            weaknessCategories: [],
            details: '',
            correctionStatus: '' // เนเธเนเนเธเนเธฅเนเธง|เธญเธขเธนเนเธฃเธฐเธซเธงเนเธฒเธเธ”เธณเน€เธเธดเธเธเธฒเธฃ|เธขเธฑเธเนเธกเนเนเธ”เนเธ”เธณเน€เธเธดเธเธเธฒเธฃ
          }
        }
      },
      businessDetails: {
        // เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เนเธ•เนเธฅเธฐเธเธธเธฃเธเธดเธ (7 เธเธฃเธฐเธเธฃเธฐเน€เธ”เนเธเธกเธฒเธ•เธฃเธเธฒเธ)
        // เธฃเธฐเธเธเธเธฐเธ•เธฃเธงเธเธเธเธเธธเธฃเธเธดเธเธ—เธตเนเธ”เธณเน€เธเธดเธเธเธฒเธฃเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธเธฒเธเธเนเธญเธกเธนเธฅเธ—เธตเนเธเธฃเธญเธ (Auto-Detection)
        deposit: {
          hasPlan: false,
          depositTypesDesc: 'เธญเธญเธกเธ—เธฃเธฑเธเธขเน, เธเธฒเธเธเธฃเธฐเธเธณ',
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
          enabled: true,
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
          enabled: false,
          hasPlan: false,
          productTypes: 'เธเธธเนเธข, เน€เธกเธฅเนเธ”เธเธฑเธเธเธธเน, เธญเธฒเธซเธฒเธฃเธชเธฑเธ•เธงเน',
          salesTerms: 'เน€เธเธดเธเธชเธ”เนเธฅเธฐเน€เธเธดเธเน€เธเธทเนเธญ',
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
          enabled: false,
          hasPlan: false,
          cropTypes: 'เธเนเธฒเธงเน€เธเธฅเธทเธญเธ, เธกเธฑเธเธชเธณเธเธฐเธซเธฅเธฑเธ',
          collectionMethod: 'เธเธทเนเธญเธเธฒเธ”เธ•เธฒเธกเธฃเธฒเธเธฒเธ•เธฅเธฒเธ”',
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
          enabled: false,
          hasPlan: false,
          processedProducts: 'เธเนเธฒเธงเธชเธฒเธฃ, เธขเธฒเธเนเธเนเธเธฃเธกเธเธงเธฑเธ',
          qualityStandards: 'GAP, OTOP',
          marketingChannels: 'เธฃเนเธฒเธเธชเธซเธเธฃเธ“เน, เธเธฒเธขเธ•เธฃเธ',
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
          enabled: false,
          hasPlan: false,
          serviceTypes: 'เธฃเธ–เนเธ–, เธฃเธ–เน€เธเธตเนเธขเธง, เธฅเธฒเธเธ•เธฒเธ',
          serviceFeeRateDesc: 'เธ•เธฒเธกเธญเธฑเธ•เธฃเธฒเธ—เธตเนเธเธ“เธฐเธเธฃเธฃเธกเธเธฒเธฃเธเธณเธซเธเธ”',
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
    // เธฃเธญเธเธฃเธฑเธเธฃเธนเธเนเธเธ "27 เธเธธเธกเธ เธฒเธเธฑเธเธเน 2570"
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
    // เธเธตเธเธฑเธเธเธตเธ—เธตเนเธเธดเธ”เธ เธฒเธขเนเธเธเธตเธเธเธเธฃเธฐเธกเธฒเธ“: เน€เธ”เธทเธญเธ เธ.เธข.โ€“เธ.เธ. เนเธเนเธเธตเธเนเธญเธเธซเธเนเธฒ, เธก.เธ.โ€“เธช.เธ. เนเธเนเธเธตเน€เธ”เธตเธขเธงเธเธฑเธ
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

  /** เธงเธฑเธเธ—เธตเนเธฃเธฑเธเธฃเธญเธเธเธเธ•เนเธญเธเธญเธขเธนเนเน€เธ”เธทเธญเธเน€เธ”เธตเธขเธงเธเธฑเธเธเธฃเธฐเธเธธเธกเนเธซเธเน เนเธฅเธฐเนเธกเนเน€เธเธดเธเธงเธฑเธเธเธฃเธฐเธเธธเธกเนเธซเธเน */
  function deriveCertifyDate(agmDate) {
    var parts = parseDateParts(agmDate);
    var agm = dateFromParts(parts);
    if (!agm) return '';
    var cert = addDays(agm, -7);
    if (cert.getMonth() !== agm.getMonth() || cert.getFullYear() !== agm.getFullYear()) {
      cert = new Date(agm.getFullYear(), agm.getMonth(), 1);
    }
    // เนเธชเธ”เธเน€เธเธเธฒเธฐเน€เธ”เธทเธญเธ + เธเธต เธ•เธฒเธก Template (เน€เธเนเธ "เธเธธเธกเธ เธฒเธเธฑเธเธเน 2569")
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
    var coopType = (c && c.coopType) || (val('coopTypeBadge').indexOf('เธเธฅเธธเนเธกเน€เธเธฉเธ•เธฃเธเธฃ') !== -1 ? 'เธเธฅเธธเนเธกเน€เธเธฉเธ•เธฃเธเธฃ' : 'เธชเธซเธเธฃเธ“เนเธเธฒเธฃเน€เธเธฉเธ•เธฃ');
    var isGroup = coopType.indexOf('เธเธฅเธธเนเธกเน€เธเธฉเธ•เธฃเธเธฃ') !== -1;
    var memLatest = parseMembers(val('mem_latest'));
    var memPrev = parseMembers(val('mem_prev'));
    var auditorType = val('auditor_type') || 'เธ เธฒเธเธฃเธฑเธ';
    var auditorName = auditorType === 'เธ เธฒเธเธฃเธฑเธ' ? val('gov_auditor_name') : val('priv_auditor_name');
    var fy = getFiscalYear();

    var state = {
      meta: {
        fiscalYear: fy,
        approvalStatus: AppState.meta.approvalStatus || 'เธฃเนเธฒเธ',
        plannerName: val('main_officer'),
        updatedAt: '',
        planId: 'PLAN-' + fy + '-' + ((c && c.code13) || '')
      },
      coopProfile: {
        coopId13: (c && c.code13) || AppState.coopProfile.coopId13 || '',
        coopName: val('coop_name') || (c && c.name) || '',
        orgType: isGroup ? 'เธเธฅเธธเนเธกเน€เธเธฉเธ•เธฃเธเธฃ' : 'เธชเธซเธเธฃเธ“เน',
        coopSubType: coopType,
        status: 'เธ”เธณเน€เธเธดเธเธเธฒเธฃ',
        district: val('district'),
        distanceKm: numVal('distance'),
        promotionZone: val('group_zone'),
        primaryOfficer: val('main_officer'),
        coOfficer: val('co_officers'),
        regDate: val('reg_date'),
        fiscalEndDate: val('fiscal_year') || '31 เธกเธตเธเธฒเธเธก',
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

    // เธชเธ–เธฒเธเธฐ 4 เธชเธต/เธเธฅเธเธฃเธดเธ เน€เธ”เธดเธกเธ•เนเธญเธเธเธเนเธงเนเน€เธกเธทเนเธญเธเธดเธเธเนเธเนเธณ
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
    // เธเธเธเธณเธเธงเธเธชเธกเธฒเธเธดเธเนเธขเธเธเธฒเธข/เธซเธเธดเธเธ—เธตเนเธเธฃเธญเธเนเธเนเธ—เนเธ 2 เนเธงเน (เธเธญเธฃเนเธกเธซเธฅเธฑเธเธกเธตเน€เธเธเธฒเธฐเธขเธญเธ”เธฃเธงเธก)
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

    // balance sheet: เน€เธ•เธดเธกเธเธฒเธ Tab 1 เน€เธเธเธฒเธฐเธเนเธญเธเธ—เธตเนเธงเนเธฒเธ เธซเธฃเธทเธญเธขเธฑเธเธ•เธฃเธเธเธฑเธเธขเธญเธ”เน€เธ”เธดเธกเธเธญเธ Tab 1
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

    // strength: Tab 1 เน€เธเนเธเน€เธเนเธฒเธเธญเธเน€เธกเธทเนเธญเธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเธเธฃเธญเธเธ•เธฑเธงเธเธตเนเธงเธฑเธ”เนเธ Tab 2
    var st = AppState.strength;
    YEARS.forEach(function (y) {
      if (y === '2567') return;
      // เน€เธเนเธเธงเนเธฒเธกเธตเธ•เธฑเธงเธเธตเนเธงเธฑเธ”เธ—เธตเนเธเธนเนเนเธเนเนเธเนเน€เธญเธ (เนเธกเนเนเธเน autoDistributed) เธซเธฃเธทเธญเนเธกเน
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

    // monthly plan text (owned by Tab 1) โ€” keep status/actual
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
    recalc4MRatios();
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
  // Draft persistence (localStorage) โ€” เธเธฑเธเธเนเธญเธกเธนเธฅเธซเธฒเธขเน€เธกเธทเนเธญเธชเธฅเธฑเธเธซเธเนเธฒ/เนเธซเธฅเธ”เนเธซเธกเน
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
    recalc4MRatios();
    applyStateToBaseForm();
    if (payload.form && typeof global.loadFormFromSavedData === 'function') {
      global.loadFormFromSavedData(payload.form);
    }
    // เธเธฑเธเนเธกเนเนเธซเน maybeLoadSavedRecord เธ”เธถเธ record เน€เธเนเธฒเธกเธฒเธ—เธฑเธเธฃเนเธฒเธเธฅเนเธฒเธชเธธเธ”เนเธเธ—เธฑเธเธ—เธต
    var s = AppState;
    global.__cpdLoadedKey = (s.coopProfile.coopId13 || '') + '|' + s.coopProfile.coopName + '|' + (s.meta.fiscalYear || '2570');
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
    // profitBeforeOpEx = เธเธณเนเธฃเน€เธเธเธฒเธฐเธเธธเธฃเธเธดเธ + เธฃเธฒเธขเนเธ”เนเธญเธทเนเธ
    is.profitBeforeOpEx = num(is.netSpecificProfit) + num(is.otherIncome);
    is.netProfit = num(is.profitBeforeOpEx) +
      num(is.priorPeriodAdjustment) - num(is.operatingExpense);

    // 7 เธญเธฑเธ•เธฃเธฒเธชเนเธงเธเธ—เธฒเธเธเธฒเธฃเน€เธเธดเธเธ•เธฒเธกเน€เธเธ“เธ‘เน CAD (เธเธฃเธกเธ•เธฃเธงเธเธเธฑเธเธเธตเธชเธซเธเธฃเธ“เน)
    // (1) DE Ratio = เธซเธเธตเนเธชเธดเธเธฃเธงเธก / เธ—เธธเธเธฃเธงเธก
    ratios.deRatio = num(bs.totalEquity) ? round4(num(bs.totalLiabilities) / num(bs.totalEquity)) : 0;
    
    // เธเธณเธเธงเธ“เธเนเธฒเน€เธเธฅเธตเนเธข 2 เธเธตเธชเธณเธซเธฃเธฑเธ ROE เนเธฅเธฐ ROA
    var prevEquity = num(fin.summary2Years.assetsPrev) - num(fin.summary2Years.liabilitiesPrev);
    var currEquity = num(bs.totalEquity);
    var avgEquity = prevEquity > 0 ? (currEquity + prevEquity) / 2 : currEquity;
    
    var prevAssets = num(fin.summary2Years.assetsPrev);
    var currAssets = num(bs.totalAssets);
    var avgAssets = prevAssets > 0 ? (currAssets + prevAssets) / 2 : currAssets;
    
    // (2) ROE (%) = (เธเธณเนเธฃเธชเธธเธ—เธเธด / เธ—เธธเธเน€เธเธฅเธตเนเธข) * 100
    ratios.roe = avgEquity > 0 ? round4((num(bs.netProfitYear) / avgEquity) * 100) : 0;
    
    // (3) ROA (%) = (เธเธณเนเธฃเธชเธธเธ—เธเธด / เธชเธดเธเธ—เธฃเธฑเธเธขเนเน€เธเธฅเธตเนเธข) * 100
    ratios.roa = avgAssets > 0 ? round4((num(bs.netProfitYear) / avgAssets) * 100) : 0;
    
    // (4) เธญเธฑเธ•เธฃเธฒเธชเนเธงเธเธ—เธธเธเธซเธกเธธเธเน€เธงเธตเธขเธ = เธชเธดเธเธ—เธฃเธฑเธเธขเนเธซเธกเธธเธเน€เธงเธตเธขเธ / เธซเธเธตเนเธชเธดเธเธซเธกเธธเธเน€เธงเธตเธขเธ
    ratios.currentRatio = num(bs.currentLiabilities) ? round4(num(bs.currentAssets) / num(bs.currentLiabilities)) : 0;
    
    // (5) เธ—เธธเธเธชเธณเธฃเธญเธเธ•เนเธญเธชเธดเธเธ—เธฃเธฑเธเธขเน = เธ—เธธเธเธชเธณเธฃเธญเธ / เธชเธดเธเธ—เธฃเธฑเธเธขเนเธฃเธงเธก
    ratios.reserveToAssetRatio = num(bs.totalAssets) ? round4(num(bs.reserveFund) / num(bs.totalAssets)) : 0;
    
    // (6) เธญเธฑเธ•เธฃเธฒเธเนเธฒเนเธเนเธเนเธฒเธขเธ”เธณเน€เธเธดเธเธเธฒเธเธ•เนเธญเธเธณเนเธฃเธเนเธญเธเธซเธฑเธเธเนเธฒเนเธเนเธเนเธฒเธข (%)
    var profitBeforeOpEx = num(is.profitBeforeOpEx);
    ratios.opexToGrossProfitRatio = profitBeforeOpEx > 0
      ? round4((num(is.operatingExpense) / profitBeforeOpEx) * 100) : 0;
    
    // (7) เธญเธฑเธ•เธฃเธฒเธฅเธนเธเธซเธเธตเนเธฃเธฐเธขเธฐเธชเธฑเนเธเธเธณเธฃเธฐเธ•เธฒเธกเธเธณเธซเธเธ” (%) - เนเธชเธ”เธเน€เธเนเธ 0.00 เน€เธชเธกเธญเธ–เนเธฒเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ
    ratios.shortTermDebtPaidOnTimeRatio = ratios.shortTermDebtPaidOnTimeRatio || 0;

    // เธญเธฑเธเน€เธ”เธ•เธขเธญเธ”เธชเธฃเธธเธเนเธซเนเธ•เธฃเธเธเธฑเธเธเธเธ—เธตเนเธเธฃเธญเธเนเธ Tab 2
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

  // round2 - เธฃเธฑเธเธฉเธฒเธ—เธจเธเธดเธขเธก 2 เธ•เธณเนเธซเธเนเธเนเธ”เธขเนเธกเนเธเธฑเธ”เน€เธจเธฉเธฅเธ (เนเธเน Number(sum.toFixed(2)))
  function round2(n) {
    return Number((Number(n) || 0).toFixed(2));
  }

  // -------------------------------------------------------------------------
  // Strength 18 indicators
  // -------------------------------------------------------------------------

  function recalcStrength() {
    var st = AppState.strength;
    YEARS.forEach(function (y) {
      var dims = { 1: 0, 2: 0, 3: 0, 4: 0 };
      var dimHasUserIndicator = { 1: false, 2: false, 3: false, 4: false };
      
      // เธเธณเธเธงเธ“เธเธฐเนเธเธเธเธฒเธเธ•เธฑเธงเธเธตเนเธงเธฑเธ”เธ—เธตเนเธเธนเนเนเธเนเนเธเนเน€เธญเธ (เนเธกเนเนเธเน autoDistributed)
      STRENGTH_INDICATORS.forEach(function (ind) {
        var v = num((st.indicators[ind.id] || {})[y]);
        var isAuto = (st.indicators[ind.id] || {})._autoDistributed;
        if (v > 0 && !isAuto) {
          dimHasUserIndicator[ind.dim] = true;
          dims[ind.dim] += v;
        }
      });
      
      // เธชเธณเธซเธฃเธฑเธเธกเธดเธ•เธดเธ—เธตเนเนเธกเนเธกเธตเธ•เธฑเธงเธเธตเนเธงเธฑเธ”เธ—เธตเนเธเธนเนเนเธเนเนเธเน -> เนเธเนเธเนเธฒ autoDistributed เธซเธฃเธทเธญ dim total เธเธฒเธเธซเธเนเธฒ 1
      for (var d = 1; d <= 4; d++) {
        if (!dimHasUserIndicator[d]) {
          // เธกเธดเธ•เธดไธๆฒกๆเธเธนเนเนเธเนเนเธเน -> เธเธณเธเธงเธ“เธเธฒเธ autoDistributed indicators
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
            // เธกเธต autoDistributed indicators -> เนเธเนเธเนเธฒเธฃเธงเธก
            dims[d] = autoDistributedSum;
          } else {
            // เนเธกเนเธกเธต autoDistributed -> เนเธเน dim total เธเธฒเธเธซเธเนเธฒ 1 (เธซเธฃเธทเธญเธเนเธฒเน€เธ”เธดเธก)
            dims[d] = num(st['dim' + d + 'ByYear'][y]);
          }
        }
      }
      
      // เธ–เนเธฒเธขเธฑเธเนเธกเนเธกเธตเธ•เธฑเธงเธเธตเนเธงเธฑเธ”เธ—เธตเนเธเธนเนเนเธเนเนเธเนเนเธฅเธฐเนเธกเนเธกเธตเธเธฒเธฃเธเธฃเธฐเธเธฒเธข -> เธเธฃเธฐเธเธฒเธข dim1-4 เธเธฒเธเธซเธเนเธฒ 1
      var anyUserIndicator = Object.keys(dimHasUserIndicator).some(function(k) { return dimHasUserIndicator[k]; });
      
      // เน€เธเนเธเธงเนเธฒเธกเธตเธ•เธฑเธงเธเธตเนเธงเธฑเธ”เธ—เธตเนเธ–เธนเธเธเธฃเธฐเธเธฒเธขเธเนเธฒเนเธฅเนเธงเธซเธฃเธทเธญเนเธกเน
      var hasAutoDistributedIndicator = STRENGTH_INDICATORS.some(function(ind) {
        return (st.indicators[ind.id] || {})._autoDistributed === true;
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
            var distributed = round2(dimTotal * ind.weight / totalWeight);
            st.indicators[ind.id][y] = distributed;
            st.indicators[ind.id]._autoDistributed = true;
          });
        }
      }
      
      // เธ•เธฑเนเธเธเนเธฒ dim totals เธซเธฅเธฑเธเธเธณเธเธงเธ“เน€เธชเธฃเนเธ (เนเธเน round2 เน€เธเธทเนเธญเธฃเธฑเธเธฉเธฒเธ—เธจเธเธดเธขเธก 2 เธ•เธณเนเธซเธเนเธ)
      st.dim1ByYear[y] = round2(dims[1]);
      st.dim2ByYear[y] = round2(dims[2]);
      st.dim3ByYear[y] = round2(dims[3]);
      st.dim4ByYear[y] = round2(dims[4]);
      st.totalByYear[y] = round2(dims[1] + dims[2] + dims[3] + dims[4]);
    });
    return st;
  }

  /**
   * recalc4MRatios() โ€” เธเธณเธเธงเธ“เธญเธฑเธ•เธฃเธฒเธชเนเธงเธ CAMELS เน€เธเธดเนเธกเน€เธ•เธดเธกเธเธฒเธเธเนเธญเธกเธนเธฅเธเธฒเธฃเน€เธเธดเธเธ—เธตเนเธกเธตเธญเธขเธนเน
   * เนเธกเนเธเธฃเธฐเธ—เธ logic เน€เธ”เธดเธก เนเธเนเน€เธ•เธดเธกเธเนเธฒเนเธ financials.ratios
   */
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
    var expense = num(N.totalExpense);

    // D/E
    if (equity > 0 && !f.ratios.deRatio) {
      f.ratios.deRatio = liabilities / equity;
    }

    // ROE (%)
    if (equity > 0 && profit !== 0) {
      f.ratios.roe = (profit / equity) * 100;
    }

    // ROA (%)
    if (assets > 0 && profit !== 0) {
      f.ratios.roa = (profit / assets) * 100;
    }

    // Current Ratio
    if (bs.currentAssets && bs.currentLiabilities && !f.ratios.currentRatio) {
      f.ratios.currentRatio = num(bs.currentAssets) / num(bs.currentLiabilities);
    }

    // Reserve to Asset Ratio
    if (assets > 0 && !f.ratios.reserveToAssetRatio) {
      f.ratios.reserveToAssetRatio = reserve / assets;
    }

    // OPEX to Gross Profit Ratio
    var grossProfit = income - expense;
    if (grossProfit > 0 && expense > 0 && !f.ratios.opexToGrossProfitRatio) {
      f.ratios.opexToGrossProfitRatio = (expense / grossProfit) * 100;
    }

    // === 4M Extended Ratios (เน€เธ•เธดเธกเน€เธเธเธฒเธฐเธ–เนเธฒเธขเธฑเธเนเธกเนเธกเธตเธเนเธฒ) ===

    // Asset Turnover = เธฃเธฒเธขเนเธ”เน / เธชเธดเธเธ—เธฃเธฑเธเธขเน
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

    // Net Profit per Member (เน€เธเธดเธเธญเธญเธกเน€เธเธฅเธตเนเธข/เธเธณเนเธฃเน€เธเธฅเธตเนเธข)
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
      setVal('fiscal_year', c.fiscalEndDate || '31 เธกเธตเธเธฒเธเธก');

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
      if (at) at.value = c.auditorType || 'เธ เธฒเธเธฃเธฑเธ';
      if (c.auditorType === 'เธ เธฒเธเน€เธญเธเธเธ') {
        setVal('priv_auditor_name', c.auditorName);
        if (typeof global.onAuditorTypeChange === 'function') global.onAuditorTypeChange();
        if (document.getElementById('priv_auditor_name')) document.getElementById('priv_auditor_name').value = c.auditorName || '';
      } else {
        setVal('gov_auditor_name', c.auditorName || 'เธเธเธถเธเธจเธฃเธต');
        if (typeof global.onAuditorTypeChange === 'function') global.onAuditorTypeChange();
        if (document.getElementById('gov_auditor_name')) document.getElementById('gov_auditor_name').value = c.auditorName || 'เธเธเธถเธเธจเธฃเธต';
      }

      // เน€เธฅเธทเธญเธเธชเธซเธเธฃเธ“เนเนเธ dropdown เนเธซเนเธ•เธฃเธเธเธทเนเธญ
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
        // เนเธกเนเน€เธฃเธตเธขเธเน€เธเธทเนเธญเนเธกเนเนเธซเนเธ—เธฑเธเธเนเธญเธเธงเธฒเธกเนเธเธเธ—เธตเนเนเธซเธฅเธ”เธกเธฒ
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
    recalc4MRatios();
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

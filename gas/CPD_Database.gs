/**
 * CPD_Database.gs — ชั้นฐานข้อมูลกลางของระบบแผนส่งเสริม 5 แท็บ
 *
 * ชีตที่จัดการ (สร้าง/ตั้งหัวตารางอัตโนมัติ):
 *   1) CPD_Plans_2570        — ข้อมูลแผนฉบับเต็ม + full_state_json
 *   2) CPD_Monthly_Tracking  — สถานะรายเดือน + monthly_json
 *   3) CPD_Closing_Success   — ผลปิดบัญชี/ประชุมใหญ่ + closing_json
 *
 * ฟังก์ชันที่เปิดให้ frontend เรียกผ่าน RPC:
 *   - saveCompleteCoopRecord(payload)
 *   - getDashboardSummaryData(filters)
 *   - getCompleteCoopRecord(payload)
 */

var CPD_DB = {
  PLANS: 'CPD_Plans_2570',
  MONTHLY: 'CPD_Monthly_Tracking',
  CLOSING: 'CPD_Closing_Success'
};

var CPD_DB_HEADERS = {
  plans: [
    'updated_at', 'fiscal_year', 'coop_id', 'coop_name', 'org_type', 'coop_sub_type',
    'district', 'promotion_zone', 'distance_km', 'primary_officer', 'co_officer',
    'fiscal_end_date', 'target_close_30d', 'target_agm_150d', 'members_total',
    'assets_latest', 'liabilities_latest', 'equity_latest', 'net_profit_latest',
    'business_vol_latest', 'strength_class_prev', 'strength_score_prev',
    'strength_class_latest', 'strength_score_latest', 'dim1_score', 'dim2_score',
    'dim3_score', 'dim4_score', 'approval_status', 'approver_name', 'full_state_json'
  ],
  monthly: [
    'updated_at', 'fiscal_year', 'coop_id', 'coop_name', 'promotion_zone',
    'progress_percent', 'm_oct_status', 'm_nov_status', 'm_dec_status', 'm_jan_status',
    'm_feb_status', 'm_mar_status', 'm_apr_status', 'm_may_status', 'm_jun_status',
    'm_jul_status', 'm_aug_status', 'm_sep_status', 'monthly_json'
  ],
  closing: [
    'updated_at', 'fiscal_year', 'coop_id', 'coop_name', 'promotion_zone',
    'can_close_account', 'close_timeframe', 'auditor_receive_date',
    'auditor_certify_date', 'can_hold_agm', 'agm_date', 'agm_timeframe',
    'supervisor_status', 'closing_json'
  ]
};

var CPD_MONTH_KEYS = [
  ['ตุลาคม', 'm_oct_status'],
  ['พฤศจิกายน', 'm_nov_status'],
  ['ธันวาคม', 'm_dec_status'],
  ['มกราคม', 'm_jan_status'],
  ['กุมภาพันธ์', 'm_feb_status'],
  ['มีนาคม', 'm_mar_status'],
  ['เมษายน', 'm_apr_status'],
  ['พฤษภาคม', 'm_may_status'],
  ['มิถุนายน', 'm_jun_status'],
  ['กรกฎาคม', 'm_jul_status'],
  ['สิงหาคม', 'm_aug_status'],
  ['กันยายน', 'm_sep_status']
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cpdCleanName_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cpdNum_(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  var s = String(value === undefined || value === null ? '' : value)
    .replace(/,/g, '')
    .replace(/[()]/g, '')
    .trim();
  if (!s || s === '-') return 0;
  var n = Number(s);
  return isFinite(n) ? n : 0;
}

function cpdRound2_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** ชื่อเดือนไทยสำหรับแปลงวันที่ที่ Google Sheets คืนกลับมาเป็น Date */
var CPD_THAI_MONTHS_ = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function cpdIsDate_(value) {
  return Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime());
}

/**
 * Google Sheets แปลงข้อความวันที่ (เช่น "30/09/2570") เป็น Date ให้อัตโนมัติ
 * เมื่ออ่านกลับมาจึงต้องแปลงเป็นข้อความให้หน้าจอแสดงผลได้เหมือนเดิม
 */
function cpdDateText_(value) {
  if (!cpdIsDate_(value)) return value;
  function pad2_(n) { return ('0' + n).slice(-2); }
  var text = pad2_(value.getDate()) + '/' + pad2_(value.getMonth() + 1) + '/' + value.getFullYear();
  if (value.getHours() || value.getMinutes() || value.getSeconds()) {
    text += ' ' + pad2_(value.getHours()) + ':' + pad2_(value.getMinutes());
  }
  return text;
}

/** คืนค่า "วัน เดือนไทย" เช่น 31 สิงหาคม (รับได้ทั้ง Date และ 31/08/2026) */
function cpdThaiMonthDate_(value) {
  if (cpdIsDate_(value)) return value.getDate() + ' ' + CPD_THAI_MONTHS_[value.getMonth()];
  var text = cpdCleanName_(value);
  var m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    var monthIndex = Number(m[2]) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return Number(m[1]) + ' ' + CPD_THAI_MONTHS_[monthIndex];
    }
  }
  return text;
}

/** สร้างชีตพร้อมหัวตารางถ้ายังไม่มี และเติมหัวตารางที่ขาดให้อัตโนมัติ */
function ensureCpdSheet_(name, headers) {
  var ss = getSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1b5e20')
      .setFontColor('#ffffff');
    return sh;
  }

  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return cpdCleanName_(h);
  });

  // ถ้าชีตใหม่ยังไม่มีหัวตาราง
  if (existing.join('') === '') {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }

  // เติมคอลัมน์ที่ขาดต่อท้าย โดยไม่แตะข้อมูลเดิม
  var missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length > 0) {
    sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}

function cpdReadTable_(name) {
  var ss = getSS_();
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return [];
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
    return cpdCleanName_(h);
  });
  return values
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        if (h) obj[h] = cpdDateText_(row[i]);
      });
      return obj;
    });
}

function cpdRowKey_(fiscalYear, coopId, coopName) {
  return [
    cpdCleanName_(fiscalYear || '2570'),
    cpdCleanName_(coopId),
    cpdCleanName_(coopName).toLowerCase()
  ].join('|');
}

/**
 * Upsert ตาม unique key (fiscal_year + coop_id หรือ coop_name)
 * @return {number} row number (1-based)
 */
function cpdUpsert_(sheetName, headers, rowObject, fiscalYear, coopId, coopName) {
  var sh = ensureCpdSheet_(sheetName, headers);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return cpdCleanName_(h);
  });

  var idxYear = headerRow.indexOf('fiscal_year');
  var idxId = headerRow.indexOf('coop_id');
  var idxName = headerRow.indexOf('coop_name');

  var targetRow = 0;
  if (lastRow > 1) {
    var data = sh.getRange(2, 1, lastRow - 1, headerRow.length).getValues();
    for (var r = 0; r < data.length; r++) {
      var sameYear = cpdCleanName_(data[r][idxYear]) === cpdCleanName_(fiscalYear);
      var sameId = coopId && idxId !== -1
        ? cpdCleanName_(data[r][idxId]) === cpdCleanName_(coopId)
        : false;
      var sameName = idxName !== -1
        ? cpdCleanName_(data[r][idxName]).toLowerCase() === cpdCleanName_(coopName).toLowerCase()
        : false;
      if (sameYear && (sameId || (!coopId && sameName) || (coopId && !cpdCleanName_(data[r][idxId]) && sameName))) {
        targetRow = r + 2;
        break;
      }
    }
  }

  var values = headerRow.map(function (h) {
    var v = rowObject[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') {
      // กัน formula injection
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    }
    return v;
  });

  if (targetRow > 0) {
    sh.getRange(targetRow, 1, 1, values.length).setValues([values]);
    return targetRow;
  }
  sh.appendRow(values);
  return sh.getLastRow();
}

function cpdFiscalYear_(state) {
  var meta = (state && state.meta) || {};
  return cpdCleanName_(meta.fiscalYear || '2570') || '2570';
}

function cpdPlanId_(state, coopId, coopName) {
  var meta = (state && state.meta) || {};
  var key = coopId || coopName || cpdCleanName_(meta.planId || '');
  if (!key) return 'PLAN-' + cpdFiscalYear_(state) + '-UNKNOWN';
  return 'PLAN-' + cpdFiscalYear_(state) + '-' + String(key).replace(/[^0-9A-Za-zก-๙]/g, '');
}

function cpdDerived_(state) {
  var fin = (state && state.financials) || {};
  var bs = fin.balanceSheet || {};
  var sum = fin.summary2Years || {};
  var st = (state && state.strength) || {};
  var coop = (state && state.coopProfile) || {};
  var sched = (state && state.scheduleAndActivities) || {};
  var close = (state && state.closingReport) || {};
  var members = coop.members || {};

  var totalAssets = cpdNum_(bs.totalAssets);
  if (!totalAssets) {
    totalAssets = cpdNum_(bs.currentAssets) + cpdNum_(bs.nonCurrentAssets);
  }
  var totalLiabilities = cpdNum_(bs.totalLiabilities);
  if (!totalLiabilities) {
    totalLiabilities = cpdNum_(bs.currentLiabilities) + cpdNum_(bs.nonCurrentLiabilities);
  }
  var totalEquity = cpdNum_(bs.totalEquity);
  if (!totalEquity) {
    totalEquity = cpdNum_(bs.shareCapital) + cpdNum_(bs.reserveFund) + cpdNum_(bs.otherAccumFunds) +
      cpdNum_(bs.unrealizedInvestGain) + cpdNum_(bs.revaluationSurplus) -
      Math.abs(cpdNum_(bs.accumulatedLoss)) + cpdNum_(bs.netProfitYear);
  }

  return {
    totalAssets: totalAssets,
    totalLiabilities: totalLiabilities,
    totalEquity: totalEquity,
    netProfit: cpdNum_(bs.netProfitYear) || cpdNum_(sum.netProfitLatest),
    assetsLatest: cpdNum_(sum.assetsLatest) || totalAssets,
    liabilitiesLatest: cpdNum_(sum.liabilitiesLatest) || totalLiabilities,
    shareCapitalLatest: cpdNum_(sum.shareCapitalLatest) || cpdNum_(bs.shareCapital),
    reserveFundLatest: cpdNum_(sum.reserveFundLatest) || cpdNum_(bs.reserveFund),
    netProfitLatest: cpdNum_(sum.netProfitLatest) || cpdNum_(bs.netProfitYear),
    accumLossLatest: cpdNum_(sum.accumLossLatest) || cpdNum_(bs.accumulatedLoss),
    businessVolLatest: cpdNum_(sum.businessVolumeLatest),
    membersTotal: cpdNum_(members.regularTotal) + cpdNum_(members.associateTotal) ||
      cpdNum_(members.regularTotal) || cpdNum_(members.prevYearTotal),
    classPrev: cpdCleanName_((st.classByYear || {})['2568']),
    scorePrev: cpdNum_((st.totalByYear || {})['2568']),
    classLatest: cpdCleanName_((st.classByYear || {})['2569']),
    scoreLatest: cpdNum_((st.totalByYear || {})['2569']),
    dim1: cpdNum_((st.dim1ByYear || {})['2569']),
    dim2: cpdNum_((st.dim2ByYear || {})['2569']),
    dim3: cpdNum_((st.dim3ByYear || {})['2569']),
    dim4: cpdNum_((st.dim4ByYear || {})['2569']),
    fiscalEndDate: cpdCleanName_(coop.fiscalEndDate || '30 กันยายน'),
    targetClose30d: cpdCleanName_(sched.targetCloseAccountDate30Days),
    targetAgm150d: cpdCleanName_(sched.targetAgmDate150Days),
    closeAccount: cpdCleanName_(close.canCloseAccount || ''),
    closeTimeframe: cpdCleanName_(close.closeAccountTimeframe || ''),
    canHoldAgm: cpdCleanName_(close.canHoldAgm || ''),
    agmTimeframe: cpdCleanName_(close.agmTimeframe || '')
  };
}

// ---------------------------------------------------------------------------
// 1) บันทึกข้อมูลครบทุกแท็บ
// ---------------------------------------------------------------------------

/**
 * @param {Object} payload
 *   payload.state = CPD_AppState ทั้งก้อน
 *   payload.form  = ข้อมูลฟอร์มเดิม (ไม่บังคับ) — ใช้ fallback ชื่อ/ปีบัญชี
 * @return {{savedAt:string, planId:string, coopId:string, coopName:string}}
 */
function saveCompleteCoopRecord(payload) {
  return withScriptLock_(function () {
    var state = (payload && payload.state) ? payload.state : (payload || {});
    var form = (payload && payload.form) || {};
    var meta = state.meta || {};
    var coop = state.coopProfile || {};
    var sched = state.scheduleAndActivities || {};
    var close = state.closingReport || {};
    var now = new Date();
    var fiscalYear = cpdFiscalYear_(state);
    var coopId = cpdCleanName_(coop.coopId13 || '');
    var coopName = cpdCleanName_(coop.coopName || form.coop_name || '');
    if (!coopName) throw new Error('ไม่พบชื่อสหกรณ์/กลุ่มเกษตรกร กรุณาเลือกสหกรณ์ก่อนบันทึก');

    var zone = cpdCleanName_(coop.promotionZone || form.group_zone || '');
    var d = cpdDerived_(state);
    var planId = cpdPlanId_(state, coopId, coopName);
    meta.planId = planId;
    meta.fiscalYear = fiscalYear;
    meta.updatedAt = Utilities.formatDate(now, 'GMT+7', "yyyy-MM-dd'T'HH:mm:ss");
    state.meta = meta;

    var fullStateJson = JSON.stringify(state);

    // ---- 1. CPD_Plans_2570 ----
    var planRow = {
      updated_at: Utilities.formatDate(now, 'GMT+7', 'dd/MM/yyyy HH:mm'),
      fiscal_year: fiscalYear,
      coop_id: coopId,
      coop_name: coopName,
      org_type: cpdCleanName_(coop.orgType || ''),
      coop_sub_type: cpdCleanName_(coop.coopSubType || ''),
      district: cpdCleanName_(coop.district || form.district || ''),
      promotion_zone: zone,
      distance_km: cpdNum_(coop.distanceKm || form.distance),
      primary_officer: cpdCleanName_(coop.primaryOfficer || form.main_officer || ''),
      co_officer: cpdCleanName_(coop.coOfficer || form.co_officers || ''),
      fiscal_end_date: d.fiscalEndDate,
      target_close_30d: d.targetClose30d,
      target_agm_150d: d.targetAgm150d,
      members_total: d.membersTotal,
      assets_latest: d.assetsLatest,
      liabilities_latest: d.liabilitiesLatest,
      equity_latest: d.totalEquity,
      net_profit_latest: d.netProfitLatest,
      business_vol_latest: d.businessVolLatest,
      strength_class_prev: d.classPrev,
      strength_score_prev: d.scorePrev,
      strength_class_latest: d.classLatest,
      strength_score_latest: d.scoreLatest,
      dim1_score: d.dim1,
      dim2_score: d.dim2,
      dim3_score: d.dim3,
      dim4_score: d.dim4,
      approval_status: cpdCleanName_(meta.approvalStatus || 'ร่าง'),
      approver_name: cpdCleanName_(meta.approverName || ''),
      full_state_json: fullStateJson
    };
    cpdUpsert_(CPD_DB.PLANS, CPD_DB_HEADERS.plans, planRow, fiscalYear, coopId, coopName);

    // ---- 2. CPD_Monthly_Tracking ----
    var monthly = sched.monthlyPlan12Months || [];
    var statusByMonth = {};
    var reported = 0;
    monthly.forEach(function (m) {
      var color = cpdCleanName_(m.statusColor || 'white') || 'white';
      statusByMonth[cpdCleanName_(m.month)] = color;
      if (color !== 'white') reported++;
    });

    var monthlyRow = {
      updated_at: planRow.updated_at,
      fiscal_year: fiscalYear,
      coop_id: coopId,
      coop_name: coopName,
      promotion_zone: zone,
      progress_percent: Math.round((reported / 12) * 100),
      monthly_json: JSON.stringify(sched)
    };
    CPD_MONTH_KEYS.forEach(function (pair) {
      monthlyRow[pair[1]] = statusByMonth[pair[0]] || 'white';
    });
    cpdUpsert_(CPD_DB.MONTHLY, CPD_DB_HEADERS.monthly, monthlyRow, fiscalYear, coopId, coopName);

    // ---- 3. CPD_Closing_Success ----
    var closingRow = {
      updated_at: planRow.updated_at,
      fiscal_year: fiscalYear,
      coop_id: coopId,
      coop_name: coopName,
      promotion_zone: zone,
      can_close_account: cpdCleanName_(close.canCloseAccount || ''),
      close_timeframe: cpdCleanName_(close.closeAccountTimeframe || ''),
      auditor_receive_date: cpdCleanName_(close.auditorReceiveDate || ''),
      auditor_certify_date: cpdCleanName_(close.auditorCertifyDate || ''),
      can_hold_agm: cpdCleanName_(close.canHoldAgm || ''),
      agm_date: cpdCleanName_(close.agmDate || ''),
      agm_timeframe: cpdCleanName_(close.agmTimeframe || ''),
      supervisor_status: cpdCleanName_(close.supervisorComment || ''),
      closing_json: JSON.stringify(close)
    };
    cpdUpsert_(CPD_DB.CLOSING, CPD_DB_HEADERS.closing, closingRow, fiscalYear, coopId, coopName);

    return {
      savedAt: planRow.updated_at,
      planId: planId,
      coopId: coopId,
      coopName: coopName,
      fiscalYear: fiscalYear
    };
  });
}

// ---------------------------------------------------------------------------
// 2) โหลดข้อมูลกลับมาแก้ไข
// ---------------------------------------------------------------------------

function getCompleteCoopRecord(payload) {
  var p = payload || {};
  var fiscalYear = cpdCleanName_(p.fiscalYear || '2570');
  var coopId = cpdCleanName_(p.coopId || '');
  var coopName = cpdCleanName_(p.coopName || '');

  var plans = cpdReadTable_(CPD_DB.PLANS);
  for (var i = 0; i < plans.length; i++) {
    var row = plans[i];
    if (cpdCleanName_(row.fiscal_year) !== fiscalYear) continue;
    var idMatch = coopId && cpdCleanName_(row.coop_id) === coopId;
    var nameMatch = coopName &&
      cpdCleanName_(row.coop_name).toLowerCase() === coopName.toLowerCase();
    if (idMatch || nameMatch) {
      var state = null;
      try {
        state = JSON.parse(row.full_state_json || '{}');
      } catch (e) {
        state = null;
      }
      return {
        found: true,
        savedAt: cpdCleanName_(row.updated_at),
        state: state,
        summary: {
          coopName: cpdCleanName_(row.coop_name),
          approvalStatus: cpdCleanName_(row.approval_status),
          assetsLatest: cpdNum_(row.assets_latest),
          businessVolLatest: cpdNum_(row.business_vol_latest)
        }
      };
    }
  }
  return { found: false };
}

// ---------------------------------------------------------------------------
// 3) Dashboard ระดับจังหวัด
// ---------------------------------------------------------------------------

function cpdNormalizeClass_(value) {
  var s = cpdCleanName_(value);
  var m = s.match(/(\d)/);
  return m ? 'ชั้น ' + m[1] : '';
}

function cpdClassBucket_(value) {
  var s = cpdNormalizeClass_(value);
  if (s === 'ชั้น 1') return 'class1';
  if (s === 'ชั้น 2') return 'class2';
  if (s === 'ชั้น 3') return 'class3';
  return '';
}

function cpdPct_(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function cpdFilterMatch_(value, filter) {
  if (!filter) return true;
  return cpdCleanName_(value).toLowerCase() === cpdCleanName_(filter).toLowerCase();
}

/**
 * กรองประเภทสหกรณ์/กลุ่มเกษตรกร โดยตรวจทั้ง orgType, coopSubType และชื่อสหกรณ์
 * รองรับกรณี master มี coopType เป็น "สหกรณ์" (แบบกว้าง) แต่ชื่อระบุประเภทจริง
 */
function cpdFilterCoopType_(row, filter) {
  if (!filter) return true;
  var f = cpdCleanName_(filter).toLowerCase();
  var org = cpdCleanName_(row.orgType || '').toLowerCase();
  var sub = cpdCleanName_(row.coopSubType || '').toLowerCase();
  var name = cpdCleanName_(row.coopName || '').toLowerCase();

  if (org === f || sub === f) return true;
  if (name.indexOf(f) !== -1) return true;

  // ตัวเลือก "สหกรณ์" (แบบกว้าง) ต้องได้ทุกประเภทสหกรณ์ แต่ไม่รวมกลุ่มเกษตรกร
  if (f === 'สหกรณ์') {
    return org.indexOf('สหกรณ์') !== -1 ||
      sub.indexOf('สหกรณ์') !== -1 ||
      name.indexOf('สหกรณ์') !== -1;
  }

  return false;
}

/**
 * @param {Object} filters { fiscalYear, promotionZone, district, coopType, primaryOfficer }
 * @return {Object} kpis, zones, rows, classDistribution, dimAverages, filterOptions
 */
function getDashboardSummaryData(filters) {
  var f = filters || {};
  var fiscalYear = cpdCleanName_(f.fiscalYear || '2570');
  var master = getMasterCoopList();
  var plans = cpdReadTable_(CPD_DB.PLANS);
  var monthly = cpdReadTable_(CPD_DB.MONTHLY);
  var closing = cpdReadTable_(CPD_DB.CLOSING);

  var plansByKey = {};
  var plansByName = {};
  plans.forEach(function (row) {
    plansByKey[cpdRowKey_(row.fiscal_year, row.coop_id, row.coop_name)] = row;
    var nameKey = cpdCleanName_(row.fiscal_year || fiscalYear) + '|' + cpdCleanName_(row.coop_name).toLowerCase();
    plansByName[nameKey] = row;
  });
  var monthlyByKey = {};
  var monthlyByName = {};
  monthly.forEach(function (row) {
    monthlyByKey[cpdRowKey_(row.fiscal_year, row.coop_id, row.coop_name)] = row;
    monthlyByName[cpdCleanName_(row.fiscal_year || fiscalYear) + '|' + cpdCleanName_(row.coop_name).toLowerCase()] = row;
  });
  var closingByKey = {};
  var closingByName = {};
  closing.forEach(function (row) {
    closingByKey[cpdRowKey_(row.fiscal_year, row.coop_id, row.coop_name)] = row;
    closingByName[cpdCleanName_(row.fiscal_year || fiscalYear) + '|' + cpdCleanName_(row.coop_name).toLowerCase()] = row;
  });

  function findRow_(mapById, mapByName, coopId, coopName) {
    var byId = mapById[cpdRowKey_(fiscalYear, coopId, coopName)];
    if (byId) return byId;
    return mapByName[cpdCleanName_(fiscalYear) + '|' + cpdCleanName_(coopName).toLowerCase()] || null;
  }

  // ตัวเลือกตัวกรองจากทะเบียนกลาง (ก่อนกรอง)
  var optionSets = {
    promotionZone: {},
    district: {},
    coopType: {},
    primaryOfficer: {}
  };
  master.forEach(function (c) {
    if (c.zone) optionSets.promotionZone[c.zone] = true;
    if (c.district) optionSets.district[c.district] = true;
    if (c.coopType) optionSets.coopType[c.coopType] = true;
    if (c.mainOfficer) optionSets.primaryOfficer[c.mainOfficer] = true;
  });

  var rows = master.map(function (c) {
    var plan = findRow_(plansByKey, plansByName, c.code13, c.name);
    // ถ้า fiscal year ที่กรองไม่ตรงกับแถวแผน ให้ถือว่ายังไม่มีแผนในปีนั้น
    if (plan && cpdCleanName_(plan.fiscal_year) !== fiscalYear) plan = null;

    var mRow = plan ? findRow_(monthlyByKey, monthlyByName, c.code13, c.name) : null;
    var cRow = plan ? findRow_(closingByKey, closingByName, c.code13, c.name) : null;

    var zone = cpdCleanName_((plan && plan.promotion_zone) || c.zone);
    var district = cpdCleanName_((plan && plan.district) || c.district);
    var coopType = cpdCleanName_((plan && plan.coop_sub_type) || c.coopType);
    var officer = cpdCleanName_((plan && plan.primary_officer) || c.mainOfficer);

    var class68 = cpdNormalizeClass_(
      (plan && plan.strength_class_prev) || (c.score68 && c.score68.level)
    );
    var class69 = cpdNormalizeClass_(
      (plan && plan.strength_class_latest) || (c.score69 && c.score69.level)
    );

    return {
      fiscalYear: fiscalYear,
      coopId: cpdCleanName_(c.code13 || (plan && plan.coop_id) || ''),
      coopName: c.coopName || c.name,
      orgType: cpdCleanName_((plan && plan.org_type) || c.coopType || ''),
      coopSubType: coopType,
      district: district,
      promotionZone: zone,
      primaryOfficer: officer,
      coOfficer: cpdCleanName_((plan && plan.co_officer) || c.coOfficers || ''),
      fiscalEndDate: cpdThaiMonthDate_((plan && plan.fiscal_end_date) || c.fiscalYear || ''),
      targetClose30d: cpdCleanName_(plan && plan.target_close_30d || ''),
      targetAgm150d: cpdCleanName_(plan && plan.target_agm_150d || ''),
      membersTotal: cpdNum_(plan && plan.members_total),
      assetsLatest: cpdNum_((plan && plan.assets_latest) || 0),
      liabilitiesLatest: cpdNum_(plan && plan.liabilities_latest),
      equityLatest: cpdNum_(plan && plan.equity_latest),
      netProfitLatest: cpdNum_(plan && plan.net_profit_latest),
      businessVolLatest: cpdNum_((plan && plan.business_vol_latest) || 0),
      class68: class68,
      class69: class69,
      strengthScorePrev: cpdNum_((plan && plan.strength_score_prev) || (c.score68 && c.score68.total)),
      strengthScoreLatest: cpdNum_((plan && plan.strength_score_latest) || (c.score69 && c.score69.total)),
      dim1: cpdNum_((plan && plan.dim1_score) || (c.score69 && c.score69.d1)),
      dim2: cpdNum_((plan && plan.dim2_score) || (c.score69 && c.score69.d2)),
      dim3: cpdNum_((plan && plan.dim3_score) || (c.score69 && c.score69.d3)),
      dim4: cpdNum_((plan && plan.dim4_score) || (c.score69 && c.score69.d4)),
      approvalStatus: cpdCleanName_((plan && plan.approval_status) || ''),
      approverName: cpdCleanName_(plan && plan.approver_name || ''),
      updatedAt: cpdCleanName_(plan && plan.updated_at || ''),
      hasPlan: !!plan,
      monthlyProgress: cpdNum_(mRow && mRow.progress_percent),
      canCloseAccount: cpdCleanName_(cRow && cRow.can_close_account || ''),
      closeTimeframe: cpdCleanName_(cRow && cRow.close_timeframe || ''),
      auditorReceiveDate: cpdCleanName_(cRow && cRow.auditor_receive_date || ''),
      auditorCertifyDate: cpdCleanName_(cRow && cRow.auditor_certify_date || ''),
      canHoldAgm: cpdCleanName_(cRow && cRow.can_hold_agm || ''),
      agmDate: cpdCleanName_(cRow && cRow.agm_date || ''),
      agmTimeframe: cpdCleanName_(cRow && cRow.agm_timeframe || '')
    };
  });

  // ---- กรอง ----
  var filtered = rows.filter(function (r) {
    return cpdFilterMatch_(r.promotionZone, f.promotionZone) &&
      cpdFilterMatch_(r.district, f.district) &&
      cpdFilterCoopType_(r, f.coopType) &&
      cpdFilterMatch_(r.primaryOfficer, f.primaryOfficer);
  });

  // ---- KPI ----
  var totalCoops = filtered.length;
  var planned = filtered.filter(function (r) { return r.hasPlan; }).length;
  var approved = filtered.filter(function (r) {
    return r.approvalStatus === 'อนุมัติแล้ว';
  }).length;
  var closed30 = filtered.filter(function (r) {
    return r.canCloseAccount === 'ได้' && r.closeTimeframe.indexOf('30') !== -1;
  }).length;
  var agm150 = filtered.filter(function (r) {
    return r.canHoldAgm === 'ได้' && r.agmTimeframe.indexOf('150') !== -1;
  }).length;
  var reported = filtered.filter(function (r) { return r.monthlyProgress > 0; }).length;

  var totalBusinessVolume = filtered.reduce(function (sum, r) {
    return sum + r.businessVolLatest;
  }, 0);
  var totalAssets = filtered.reduce(function (sum, r) {
    return sum + r.assetsLatest;
  }, 0);

  // ---- รายเขตส่งเสริม ----
  var zoneMap = {};
  filtered.forEach(function (r) {
    var z = r.promotionZone || 'ไม่ระบุ';
    if (!zoneMap[z]) {
      zoneMap[z] = {
        zone: z, total: 0, planned: 0, approved: 0,
        monthlyReported: 0, closed30: 0, agm150: 0,
        businessVolume: 0
      };
    }
    var bucket = zoneMap[z];
    bucket.total++;
    if (r.hasPlan) bucket.planned++;
    if (r.approvalStatus === 'อนุมัติแล้ว') bucket.approved++;
    if (r.monthlyProgress > 0) bucket.monthlyReported++;
    if (r.canCloseAccount === 'ได้' && r.closeTimeframe.indexOf('30') !== -1) bucket.closed30++;
    if (r.canHoldAgm === 'ได้' && r.agmTimeframe.indexOf('150') !== -1) bucket.agm150++;
    bucket.businessVolume += r.businessVolLatest;
  });
  var zones = Object.keys(zoneMap)
    .sort(function (a, b) { return a.localeCompare(b, 'th'); })
    .map(function (z) {
      var o = zoneMap[z];
      o.planPct = cpdPct_(o.planned, o.total);
      o.approvedPct = cpdPct_(o.approved, o.total);
      o.monthlyPct = cpdPct_(o.monthlyReported, o.total);
      o.closedPct = cpdPct_(o.closed30, o.total);
      o.agmPct = cpdPct_(o.agm150, o.total);
      return o;
    });

  // ---- ชั้นความเข้มแข็ง + ค่าเฉลี่ย 4 มิติ ----
  var classDistribution = {
    y2568: { class1: 0, class2: 0, class3: 0 },
    y2569: { class1: 0, class2: 0, class3: 0 }
  };
  filtered.forEach(function (r) {
    var b68 = cpdClassBucket_(r.class68);
    var b69 = cpdClassBucket_(r.class69);
    if (b68) classDistribution.y2568[b68]++;
    if (b69) classDistribution.y2569[b69]++;
  });

  var dimKeys = [['dim1', 'มิติที่ 1'], ['dim2', 'มิติที่ 2'], ['dim3', 'มิติที่ 3'], ['dim4', 'มิติที่ 4']];
  var dimAverages = dimKeys.map(function (pair) {
    var values = filtered
      .map(function (r) { return cpdNum_(r[pair[0]]); })
      .filter(function (v) { return v > 0; });
    var avg = values.length
      ? Math.round((values.reduce(function (s, v) { return s + v; }, 0) / values.length) * 100) / 100
      : 0;
    return { key: pair[0], label: pair[1], average: avg, count: values.length };
  });

  return {
    generatedAt: Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm'),
    filters: {
      fiscalYear: fiscalYear,
      promotionZone: f.promotionZone || '',
      district: f.district || '',
      coopType: f.coopType || '',
      primaryOfficer: f.primaryOfficer || ''
    },
    filterOptions: {
      fiscalYears: ['2570'],
      promotionZones: Object.keys(optionSets.promotionZone).sort(),
      districts: Object.keys(optionSets.district).sort(),
      coopTypes: Object.keys(optionSets.coopType).sort(),
      primaryOfficers: Object.keys(optionSets.primaryOfficer).sort()
    },
    kpis: {
      totalCoops: totalCoops,
      planned: planned,
      plannedPct: cpdPct_(planned, totalCoops),
      approved: approved,
      approvedPct: cpdPct_(approved, totalCoops),
      closed30: closed30,
      closed30Pct: cpdPct_(closed30, totalCoops),
      agm150: agm150,
      agm150Pct: cpdPct_(agm150, totalCoops),
      monthlyReported: reported,
      monthlyReportedPct: cpdPct_(reported, totalCoops),
      totalBusinessVolume: totalBusinessVolume,
      totalAssets: totalAssets
    },
    zones: zones,
    classDistribution: classDistribution,
    dimAverages: dimAverages,
    rows: filtered
  };
}

// ---------------------------------------------------------------------------
// 4) ฟังก์ชันช่วยเหลือสำหรับผู้ดูแลระบบ
// ---------------------------------------------------------------------------

/** สร้างชีตทั้ง 3 ทันที (เรียกจาก editor หรือ setupCheck) */
function ensureCpdDatabase() {
  ensureCpdSheet_(CPD_DB.PLANS, CPD_DB_HEADERS.plans);
  ensureCpdSheet_(CPD_DB.MONTHLY, CPD_DB_HEADERS.monthly);
  ensureCpdSheet_(CPD_DB.CLOSING, CPD_DB_HEADERS.closing);
  return {
    ok: true,
    sheets: [CPD_DB.PLANS, CPD_DB.MONTHLY, CPD_DB.CLOSING]
  };
}

/** ลบข้อมูลทดสอบของสหกรณ์หนึ่งรายออกจากทั้ง 3 ชีต (ใช้จาก editor เท่านั้น) */
function deleteCpdRecord(fiscalYear, coopId, coopName) {
  var sheets = [
    [CPD_DB.PLANS, CPD_DB_HEADERS.plans],
    [CPD_DB.MONTHLY, CPD_DB_HEADERS.monthly],
    [CPD_DB.CLOSING, CPD_DB_HEADERS.closing]
  ];
  var deleted = 0;
  sheets.forEach(function (pair) {
    var sh = ensureCpdSheet_(pair[0], pair[1]);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(cpdCleanName_);
    var iYear = headers.indexOf('fiscal_year');
    var iId = headers.indexOf('coop_id');
    var iName = headers.indexOf('coop_name');
    var data = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var r = data.length - 1; r >= 0; r--) {
      var sameYear = cpdCleanName_(data[r][iYear]) === cpdCleanName_(fiscalYear);
      var sameId = coopId && cpdCleanName_(data[r][iId]) === cpdCleanName_(coopId);
      var sameName = coopName &&
        cpdCleanName_(data[r][iName]).toLowerCase() === cpdCleanName_(coopName).toLowerCase();
      if (sameYear && (sameId || sameName)) {
        sh.deleteRow(r + 2);
        deleted++;
      }
    }
  });
  return { deleted: deleted };
}

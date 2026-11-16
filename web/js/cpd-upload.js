/* ============================================================================
 * cpd-upload.js — Phase 0: Safe Upload Apply
 *
 * เป้าหมาย
 *   1) ไม่เขียนทับค่าที่มีอยู่โดยไม่แจ้ง (field-level diff + review)
 *   2) แยก "ไม่พบ" (missing) ออกจาก "ศูนย์จริง" (zero)
 *   3) เก็บ snapshot + ย้อนกลับผลอัปโหลดครั้งล่าสุดได้
 *   4) เก็บ metadata ต่อรอบ (runId / ปีบัญชี / ไฟล์ / สถานะรายฟิลด์)
 *   5) ตรวจความสอดคล้องก่อนเติมลงฟอร์ม (สมการบัญชี / กำไร / ปีบัญชี)
 *
 * ไฟล์นี้ไม่แตะ id ของหน้า 1 และไม่เปลี่ยนโครงสร้าง State เดิม
 * เพิ่มเฉพาะ optional field `analysis.uploadMeta` + `analysis.uploadHistory`
 * ========================================================================== */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var HISTORY_LIMIT = 5;

  // ---------------------------------------------------------------------------
  // ตัวเลข / ข้อความ
  // ---------------------------------------------------------------------------

  var THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

  function toAsciiDigits(text) {
    return String(text == null ? '' : text).replace(/[๐-๙]/g, function (ch) {
      return String(THAI_DIGITS.indexOf(ch));
    });
  }

  /**
   * parseNumber(raw) → number | null
   *   null  = "ไม่พบข้อมูล" (ต่างจาก 0)
   *   (1,234.50) → -1234.5
   *   "๑,๒๓๔.๕๐" → 1234.5
   *   "1.2 ล้านบาท" → 1200000
   */
  function parseNumber(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : null;
    if (raw === undefined || raw === null) return null;
    var s = toAsciiDigits(raw).replace(/\u00a0/g, ' ').trim();
    if (!s) return null;

    var negative = false;
    if (/^\(.*\)$/.test(s)) {
      negative = true;
      s = s.slice(1, -1).trim();
    }

    var million = /ล้าน/.test(s);
    s = s
      .replace(/บาท|baht|thb/gi, '')
      .replace(/ล้าน/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '');

    if (!s || s === '-' || s === '–' || s === '—' || s === '.') return null;

    if (/-$/.test(s)) {
      negative = true;
      s = s.replace(/-$/, '');
    }
    if (/^-/.test(s)) {
      negative = true;
      s = s.replace(/^-/, '');
    }
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(s)) return null;

    var n = Number(s);
    if (!isFinite(n)) return null;
    if (million) n = n * 1000000;
    return negative ? -Math.abs(n) : n;
  }

  function formatMoney(n) {
    var negative = n < 0;
    var fixed = Math.abs(n).toFixed(2);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? '-' : '') + parts.join('.');
  }

  function formatCount(n) {
    var rounded = Math.round(n * 100) / 100;
    var negative = rounded < 0;
    var parts = String(Math.abs(rounded)).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? '-' : '') + parts.join('.');
  }

  function normText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  var MISSING_MARKERS = /^(-|–|—|n\/a|na|none|null|ไม่พบ|ไม่พบข้อมูล|ไม่มี|ไม่มีข้อมูล|ไม่ระบุ)$/i;

  function isMissingText(value) {
    var t = normText(value);
    return !t || MISSING_MARKERS.test(t);
  }

  // ---------------------------------------------------------------------------
  // ตัวแปลงเฉพาะทาง
  // ---------------------------------------------------------------------------

  var FISCAL_MONTHS = [
    ['มกราคม', 'ม.ค.', '31 มกราคม'],
    ['กุมภาพันธ์', 'ก.พ.', '28 กุมภาพันธ์'],
    ['มีนาคม', 'มี.ค.', '31 มีนาคม'],
    ['เมษายน', 'เม.ย.', '30 เมษายน'],
    ['พฤษภาคม', 'พ.ค.', '31 พฤษภาคม'],
    ['มิถุนายน', 'มิ.ย.', '30 มิถุนายน'],
    ['กรกฎาคม', 'ก.ค.', '31 กรกฎาคม'],
    ['สิงหาคม', 'ส.ค.', '31 สิงหาคม'],
    ['กันยายน', 'ก.ย.', '30 กันยายน'],
    ['ตุลาคม', 'ต.ค.', '31 ตุลาคม'],
    ['พฤศจิกายน', 'พ.ย.', '30 พฤศจิกายน'],
    ['ธันวาคม', 'ธ.ค.', '31 ธันวาคม']
  ];

  function resolveFiscalText(text) {
    var s = normText(text);
    if (!s) return null;
    for (var i = 0; i < FISCAL_MONTHS.length; i++) {
      var row = FISCAL_MONTHS[i];
      if (s.indexOf(row[0]) !== -1 || s.indexOf(row[1]) !== -1) return row[2];
    }
    return null;
  }

  function resolveAuditorType(text) {
    var s = normText(text);
    if (!s) return null;
    if (s.indexOf('เอกชน') !== -1) return 'ภาคเอกชน';
    if (s.indexOf('รัฐ') !== -1 || s.indexOf('ราชการ') !== -1) return 'ภาครัฐ';
    return null;
  }

  function resolveAuditorName(text) {
    var s = normText(text);
    if (!s) return null;
    if (s.indexOf('พรทิพย์') !== -1) return { id: 'gov_auditor_name', value: 'พรทิพย์', key: 'auditorName' };
    if (s.indexOf('คนึงศรี') !== -1) return { id: 'gov_auditor_name', value: 'คนึงศรี', key: 'auditorName' };
    return { id: 'priv_auditor_name', value: s, key: 'auditorName' };
  }

  function extractThaiYear(text) {
    var s = normText(text);
    var m = s.match(/(\d{2,4})/);
    if (!m) return null;
    var y = Number(m[1]);
    if (!isFinite(y)) return null;
    if (y < 100) y += 2500;
    return y;
  }

  function parseMemberTriplet(text) {
    var parts = normText(text).split('/');
    if (parts.length < 3) return null;
    var nums = parts.slice(0, 3).map(parseNumber);
    if (nums.some(function (n) { return n === null; })) return null;
    return { total: nums[0], regular: nums[1], associate: nums[2] };
  }

  // ---------------------------------------------------------------------------
  // Field definitions — mapping จากผล AI → id ในฟอร์มหน้า 1
  // ---------------------------------------------------------------------------

  var MAIN_FIELDS = [
    { key: 'district', id: 'district', label: 'อำเภอ', kind: 'text', group: 'ข้อมูลพื้นฐาน' },
    { key: 'regDate', id: 'reg_date', label: 'วันที่จดทะเบียน', kind: 'text', group: 'ข้อมูลพื้นฐาน' },
    { key: 'boardCount', id: 'board_count', label: 'จำนวนกรรมการ', kind: 'count', group: 'ข้อมูลพื้นฐาน' },
    { key: 'inspectorCount', id: 'inspector_count', label: 'จำนวนผู้ตรวจสอบกิจการ', kind: 'count', group: 'ข้อมูลพื้นฐาน' },
    { key: 'inspectorName', id: 'inspector_name', label: 'ชื่อผู้ตรวจสอบกิจการ', kind: 'text', group: 'ข้อมูลพื้นฐาน' },
    { key: 'auditorType', id: 'auditor_type', label: 'ประเภทผู้สอบบัญชี', kind: 'auditorType', group: 'ข้อมูลพื้นฐาน' },
    { key: 'auditorName', id: 'auditor_name', label: 'ชื่อผู้สอบบัญชี', kind: 'auditorName', group: 'ข้อมูลพื้นฐาน' },
    { key: 'fiscalDateFull', id: 'fiscal_year', label: 'วันสิ้นปีบัญชี', kind: 'fiscal', group: 'ข้อมูลพื้นฐาน' },
    { key: 'yrLatest', id: 'yr_latest', label: 'ปีบัญชีล่าสุด', kind: 'text', group: 'งบการเงิน' },
    { key: 'yrPrev', id: 'yr_prev', label: 'ปีบัญชีก่อนหน้า', kind: 'text', group: 'งบการเงิน' },
    { key: 'memLatest', id: 'mem_latest', label: 'จำนวนสมาชิกปีล่าสุด', kind: 'member', group: 'งบการเงิน' },
    { key: 'memPrev', id: 'mem_prev', label: 'จำนวนสมาชิกปีก่อน', kind: 'member', group: 'งบการเงิน' },
    { key: 'assetLatest', id: 'asset_latest', label: 'สินทรัพย์รวม', kind: 'money', group: 'งบการเงิน' },
    { key: 'assetPrev', id: 'asset_prev', label: 'สินทรัพย์รวมปีก่อน', kind: 'money', group: 'งบการเงิน' },
    { key: 'debtLatest', id: 'debt_latest', label: 'หนี้สินรวม', kind: 'money', group: 'งบการเงิน' },
    { key: 'debtPrev', id: 'debt_prev', label: 'หนี้สินรวมปีก่อน', kind: 'money', group: 'งบการเงิน' },
    { key: 'shareLatest', id: 'share_latest', label: 'ทุนเรือนหุ้น', kind: 'money', group: 'งบการเงิน' },
    { key: 'sharePrev', id: 'share_prev', label: 'ทุนเรือนหุ้นปีก่อน', kind: 'money', group: 'งบการเงิน' },
    { key: 'reserveLatest', id: 'reserve_latest', label: 'ทุนสำรอง', kind: 'money', group: 'งบการเงิน' },
    { key: 'reservePrev', id: 'reserve_prev', label: 'ทุนสำรองปีก่อน', kind: 'money', group: 'งบการเงิน' },
    { key: 'profitLatest', id: 'profit_latest', label: 'กำไรสุทธิ', kind: 'money', group: 'งบการเงิน' },
    { key: 'profitPrev', id: 'profit_prev', label: 'กำไรสุทธิปีก่อน', kind: 'money', group: 'งบการเงิน' },
    { key: 'lossLatest', id: 'loss_latest', label: 'ขาดทุนสะสม', kind: 'money', group: 'งบการเงิน' },
    { key: 'lossPrev', id: 'loss_prev', label: 'ขาดทุนสะสมปีก่อน', kind: 'money', group: 'งบการเงิน' },
    { key: 'bizVolLatest', id: 'biz_vol_latest', label: 'ปริมาณธุรกิจ', kind: 'money', group: 'งบการเงิน' },
    { key: 'bizVolPrev', id: 'biz_vol_prev', label: 'ปริมาณธุรกิจปีก่อน', kind: 'money', group: 'งบการเงิน' },
    { key: 'businessTypes', id: 'business_types', label: 'ประเภทกิจการ', kind: 'text', group: 'ธุรกิจ' },
    { key: 'targetProjects', id: 'target_projects', label: 'โครงการเป้าหมาย', kind: 'text', group: 'แผนงาน' },
    { key: 'issue1', id: 'issue_1', label: 'ปัญหา/ข้อสังเกต 1', kind: 'text', group: 'ข้อสังเกต' },
    { key: 'issue2', id: 'issue_2', label: 'ปัญหา/ข้อสังเกต 2', kind: 'text', group: 'ข้อสังเกต' },
    { key: 'issue3', id: 'issue_3', label: 'ปัญหา/ข้อสังเกต 3', kind: 'text', group: 'ข้อสังเกต' },
    { key: 'promotionGoals', id: 'promotion_goals', label: 'เป้าหมายส่งเสริม', kind: 'text', group: 'แผนงาน' },
    { key: 'visitRemark', id: 'visit_remark', label: 'หมายเหตุการเข้าส่งเสริม', kind: 'text', group: 'แผนงาน' }
  ];

  var DETAIL_FIELDS = [
    { key: 'agmAttendees', prefix: 'agm_attend', label: 'ผู้เข้าประชุมใหญ่', kind: 'count' },
    { key: 'membersDeposit', prefix: 'mem_biz_deposit', label: 'สมาชิกผู้ใช้บริการรับฝากเงิน', kind: 'count' },
    { key: 'membersTrading', prefix: 'mem_biz_trading', label: 'สมาชิกผู้ใช้บริการจัดหาสินค้า', kind: 'count' },
    { key: 'membersProcessing', prefix: 'mem_biz_processing', label: 'สมาชิกผู้ใช้บริการแปรรูป', kind: 'count' },
    { key: 'wc', prefix: 'wc', label: 'ทุนดำเนินงาน', kind: 'money' },
    { key: 'coopCap', prefix: 'coopcap', label: 'ทุนของสหกรณ์', kind: 'money' },
    { key: 'loan', prefix: 'loan', label: 'เงินกู้ยืม', kind: 'money' },
    { key: 'payable', prefix: 'payable', label: 'เจ้าหนี้การค้า', kind: 'money' },
    { key: 'cash', prefix: 'cash', label: 'เงินสดและเงินฝาก', kind: 'money' },
    { key: 'inventory', prefix: 'inventory', label: 'สินค้าคงเหลือ', kind: 'money' },
    { key: 'ppe', prefix: 'ppe', label: 'ที่ดิน อาคาร อุปกรณ์', kind: 'money' },
    { key: 'receivable', prefix: 'receivable', label: 'ลูกหนี้การค้า', kind: 'money' },
    { key: 'otherAsset', prefix: 'otherasset', label: 'สินทรัพย์อื่น', kind: 'money' },
    { key: 'income', prefix: 'income', label: 'รายได้รวม', kind: 'money' },
    { key: 'expense', prefix: 'expense', label: 'ค่าใช้จ่ายรวม', kind: 'money' },
    { key: 'salesTrading', prefix: 'sales_trading', label: 'รายได้ธุรกิจจัดหาสินค้า', kind: 'money' },
    { key: 'costTrading', prefix: 'cost_trading', label: 'ต้นทุนธุรกิจจัดหาสินค้า', kind: 'money' },
    { key: 'profitTrading', prefix: 'profit_biz_trading', label: 'กำไรธุรกิจจัดหาสินค้า', kind: 'money' },
    { key: 'planTrading', prefix: 'plan_trading', label: 'แผนธุรกิจจัดหาสินค้า', kind: 'money' },
    { key: 'salesProcessing', prefix: 'sales_processing', label: 'รายได้ธุรกิจแปรรูป', kind: 'money' },
    { key: 'costProcessing', prefix: 'cost_processing', label: 'ต้นทุนธุรกิจแปรรูป', kind: 'money' },
    { key: 'profitProcessing', prefix: 'profit_biz_processing', label: 'กำไรธุรกิจแปรรูป', kind: 'money' },
    { key: 'planProcessing', prefix: 'plan_processing', label: 'แผนธุรกิจแปรรูป', kind: 'money' },
    { key: 'depositAmount', prefix: 'deposit_amount', label: 'เงินรับฝาก', kind: 'money' },
    { key: 'profitDeposit', prefix: 'profit_biz_deposit', label: 'กำไรธุรกิจรับฝากเงิน', kind: 'money' },
    { key: 'avgProfit3', prefix: 'avgprofit3', label: 'กำไรเฉลี่ย 3 ปี', kind: 'money' },
    { key: 'avgSaving', prefix: 'avgsaving', label: 'เงินออมเฉลี่ย', kind: 'money' },
    { key: 'avgDebt', prefix: 'avgdebt', label: 'หนี้สินเฉลี่ย', kind: 'money' },
    { key: 'staffCount', prefix: 'staff_count', label: 'จำนวนพนักงาน', kind: 'count' }
  ];

  /** รวม main + detail (latest/prev) เป็นรายการเดียว */
  function buildFieldDefs() {
    var defs = MAIN_FIELDS.slice();
    DETAIL_FIELDS.forEach(function (d) {
      defs.push({
        key: d.key + 'Latest', id: d.prefix + '_latest',
        label: d.label + ' (ปีล่าสุด)', kind: d.kind, group: 'ผลการดำเนินงาน'
      });
      defs.push({
        key: d.key + 'Prev', id: d.prefix + '_prev',
        label: d.label + ' (ปีก่อน)', kind: d.kind, group: 'ผลการดำเนินงาน'
      });
    });
    return defs;
  }

  var FIELD_DEFS = buildFieldDefs();

  var ACCOUNTING_IDS = [
    'asset_latest', 'debt_latest', 'share_latest',
    'reserve_latest', 'accumfund_latest', 'profit_latest', 'loss_latest'
  ];

  // ---------------------------------------------------------------------------
  // อ่านค่าจากฟอร์ม / สร้างรายการไฟล์
  // ---------------------------------------------------------------------------

  function captureValues(doc) {
    var d = doc || global.document;
    var out = {};
    if (!d || typeof d.getElementById !== 'function') return out;
    FIELD_DEFS.forEach(function (def) {
      var id = def.id === 'auditor_name'
        ? null
        : (def.kind === 'auditorName' ? null : def.id);
      if (!id) return;
      var el = d.getElementById(id);
      if (el) out[id] = String(el.value == null ? '' : el.value);
    });
    ['gov_auditor_name', 'priv_auditor_name', 'fiscal_year', 'accumfund_latest'].forEach(function (id) {
      var el = d.getElementById(id);
      if (el) out[id] = String(el.value == null ? '' : el.value);
    });
    return out;
  }

  function normalizeFiles(files) {
    return (files || []).map(function (f) {
      if (!f || typeof f !== 'object') return null;
      return {
        name: String(f.name || ''),
        category: String(f.category || ''),
        mode: String(f.mode || (f.base64 ? 'binary' : (f.extractedText ? 'text' : 'unknown'))),
        lowTextPdf: !!f.lowTextPdf,
        totalPages: typeof f.totalPages === 'number' ? f.totalPages : null,
        pagesRead: typeof f.pagesRead === 'number' ? f.pagesRead : null,
        chars: typeof f.chars === 'number' ? f.chars : (f.extractedText ? String(f.extractedText).length : null),
        truncated: !!f.truncated
      };
    }).filter(Boolean);
  }

  function hasScanFile(files) {
    return (files || []).some(function (f) {
      return f && (f.lowTextPdf || f.mode === 'scan' || f.mode === 'image');
    });
  }

  // ---------------------------------------------------------------------------
  // อ่านค่าที่ AI ส่งมา → { missing, value, display, isZero, targetId }
  // ---------------------------------------------------------------------------

  function readIncoming(res, def) {
    var raw = res ? res[def.key] : undefined;
    var out = {
      key: def.key,
      id: def.id,
      label: def.label,
      group: def.group,
      kind: def.kind,
      raw: raw,
      value: null,
      display: '',
      isZero: false,
      missing: false
    };

    if (def.kind === 'auditorName') {
      var resolved = resolveAuditorName(raw);
      if (!resolved) { out.missing = true; return out; }
      out.id = resolved.id;
      out.value = resolved.value;
      out.display = resolved.value;
      return out;
    }

    if (raw === undefined || raw === null) { out.missing = true; return out; }

    if (def.kind === 'auditorType') {
      var type = resolveAuditorType(raw);
      if (!type) { out.missing = true; return out; }
      out.value = type;
      out.display = type;
      return out;
    }

    if (def.kind === 'fiscal') {
      var fiscal = resolveFiscalText(raw);
      if (!fiscal) { out.missing = true; return out; }
      out.value = fiscal;
      out.display = fiscal;
      return out;
    }

    if (def.kind === 'money' || def.kind === 'count') {
      var n = parseNumber(raw);
      if (n === null) { out.missing = true; return out; }
      out.value = n;
      out.display = def.kind === 'money' ? formatMoney(n) : formatCount(n);
      out.isZero = n === 0;
      return out;
    }

    // text / member
    if (isMissingText(raw)) { out.missing = true; return out; }
    out.value = normText(raw);
    out.display = out.value;
    return out;
  }

  // ---------------------------------------------------------------------------
  // Merge policy
  // ---------------------------------------------------------------------------

  function sameValue(current, incoming, kind) {
    var display = incoming.display !== undefined ? incoming.display : incoming.after;
    if (kind === 'money' || kind === 'count') {
      var a = parseNumber(current);
      var b = typeof incoming.value === 'number' ? incoming.value : parseNumber(display);
      return a !== null && b !== null && Math.abs(a - b) < 0.005;
    }
    return normText(current) === normText(display);
  }

  /**
   * decide(current, incoming, ctx) → status
   *   missing   = AI ไม่พบ (ไม่แตะ)
   *   locked    = ผู้ใช้/preload ล็อกไว้ (ไม่แตะ)
   *   same      = ค่าเดิมตรงกันแล้ว
   *   fill      = ช่องว่าง → เติมได้
   *   update    = ค่าเดิมเป็นผลจากรอบอัปโหลดก่อน → ทับได้อย่างปลอดภัย
   *   zero      = AI ตอบ 0 และไม่มีไฟล์สแกน → เติมได้ แต่ติดธง
   *   zeroReview= AI ตอบ 0 และมีไฟล์สแกน → ให้ผู้ใช้ยืนยัน
   *   conflict  = ค่าเดิมมีอยู่และต่างจากค่าใหม่ → ให้ผู้ใช้ยืนยัน
   */
  function decide(current, incoming, ctx) {
    if (incoming.missing) return 'missing';
    if (ctx.locked[incoming.id]) return 'locked';

    var cur = String(current == null ? '' : current).trim();
    if (!cur) {
      if (incoming.isZero && ctx.hasScan) return 'zeroReview';
      return incoming.isZero ? 'zero' : 'fill';
    }

    if (sameValue(cur, incoming, incoming.kind)) return 'same';

    var prev = ctx.previousFields[incoming.key];
    if (prev && sameValue(cur, prev, incoming.kind)) return 'update';

    if (incoming.isZero) return 'zeroConflict';
    return 'conflict';
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validateProjected(values, providedKeys) {
    var warnings = [];
    var failedIds = {};
    var provided = providedKeys || {};

    // 1) สมการบัญชี: สินทรัพย์ = หนี้สิน + ทุน
    var asset = parseNumber(values.asset_latest);
    var debt = parseNumber(values.debt_latest);
    var share = parseNumber(values.share_latest);
    var reserve = parseNumber(values.reserve_latest);
    var accum = parseNumber(values.accumfund_latest);
    var profit = parseNumber(values.profit_latest);
    var loss = parseNumber(values.loss_latest);

    var hasEquity = share !== null || reserve !== null || accum !== null || profit !== null || loss !== null;
    if (asset !== null && asset !== 0 && debt !== null && hasEquity) {
      var total = debt + (share || 0) + (reserve || 0) + (accum || 0) + (profit || 0) - Math.abs(loss || 0);
      var diff = asset - total;
      var pct = Math.abs(diff) / Math.abs(asset) * 100;
      if (Math.abs(diff) >= 0.05 && pct > 0.5) {
        warnings.push(
          'สมการบัญชีไม่ดุล: สินทรัพย์ ' + formatMoney(asset) +
          ' ต่างจาก หนี้สิน+ทุน ' + formatMoney(total) +
          ' (' + formatMoney(diff) + ' บาท / ' + pct.toFixed(2) + '%)'
        );
        ACCOUNTING_IDS.forEach(function (id) { failedIds[id] = true; });
      }
    }

    // 2) รายได้ - ค่าใช้จ่าย = กำไรสุทธิ
    var income = parseNumber(values.income_latest);
    var expense = parseNumber(values.expense_latest);
    if (income !== null && expense !== null && profit !== null) {
      var profitDiff = income - expense - profit;
      var tolerance = Math.max(1, Math.abs(income) * 0.01);
      if (Math.abs(profitDiff) > tolerance) {
        warnings.push(
          'รายได้ - ค่าใช้จ่าย ไม่เท่ากับกำไรสุทธิ: ' +
          formatMoney(income) + ' - ' + formatMoney(expense) + ' = ' +
          formatMoney(income - expense) + ' แต่กำไรสุทธิ ' + formatMoney(profit) +
          ' (ต่าง ' + formatMoney(profitDiff) + ' บาท)'
        );
      }
    }

    // 3) กำไรและขาดทุนสะสมไม่ควรมีพร้อมกัน
    if (profit !== null && profit > 0 && loss !== null && loss > 0) {
      warnings.push('พบทั้งกำไรสุทธิและขาดทุนสะสมพร้อมกัน กรุณาตรวจสอบ');
    }

    // 4) จำนวนสมาชิก: รวม = สามัญ + สมทบ
    ['mem_latest', 'mem_prev'].forEach(function (id) {
      var m = parseMemberTriplet(values[id]);
      if (!m) return;
      if (m.total !== m.regular + m.associate) {
        warnings.push(
          'จำนวนสมาชิก (' + id.replace('_', ' ') + ') ไม่สอดคล้อง: รวม ' +
          formatCount(m.total) + ' ≠ สามัญ ' + formatCount(m.regular) +
          ' + สมทบ ' + formatCount(m.associate)
        );
      }
    });

    // 5) ปีบัญชีของเอกสาร
    var fiscalYear = provided.fiscalYear ? Number(provided.fiscalYear) : null;
    var yrLatest = extractThaiYear(values.yr_latest);
    var yrPrev = extractThaiYear(values.yr_prev);
    if (fiscalYear && yrLatest && yrLatest > fiscalYear) {
      warnings.push('ปีบัญชีในเอกสาร (' + yrLatest + ') ใหม่กว่าปีแผน (' + fiscalYear + ')');
    }
    if (yrLatest && yrPrev && yrPrev >= yrLatest) {
      warnings.push('ปีบัญชีก่อนหน้า (' + yrPrev + ') ไม่น้อยกว่าปีล่าสุด (' + yrLatest + ')');
    }
    var fyNote = normText(provided.fyCheckNote);
    if (fyNote && /ไม่ตรง|ไม่ตรงกัน/.test(fyNote)) {
      warnings.push('AI ตรวจปีบัญชีแล้วพบว่าไม่ตรงกับปีแผน: ' + fyNote);
    }

    return { warnings: warnings, failedIds: failedIds };
  }

  // ---------------------------------------------------------------------------
  // plan()
  // ---------------------------------------------------------------------------

  function makeRunId() {
    return 'up-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function plan(res, options) {
    var opts = options || {};
    var formValues = opts.formValues || {};
    var files = normalizeFiles(opts.files || []);
    var scan = hasScanFile(files);
    var runId = opts.runId || makeRunId();
    var createdAt = opts.createdAt || new Date().toISOString();
    var fiscalYear = String(opts.fiscalYear || '');

    var locked = {};
    (opts.lockedIds || []).forEach(function (id) { locked[id] = true; });

    var previousFields = opts.previousFields || {};

    var ctx = { locked: locked, previousFields: previousFields, hasScan: scan };
    var updates = [];
    var review = [];
    var same = [];
    var missing = [];
    var lockedOut = [];
    var fields = {};

    FIELD_DEFS.forEach(function (def) {
      // ฟิลด์พิเศษ: auditor name ใช้ id ที่ resolve แล้ว
      var baseId = def.id === 'auditor_name' ? null : def.id;
      var incoming = readIncoming(res, def);
      var current = '';
      if (incoming.kind === 'auditorName') {
        current = formValues[incoming.id] || '';
      } else {
        current = formValues[baseId] || '';
      }

      var status = decide(current, incoming, ctx);
      var record = {
        key: def.key,
        id: incoming.id,
        label: def.label,
        group: def.group,
        kind: def.kind,
        status: status,
        before: String(current == null ? '' : current),
        after: incoming.display,
        display: incoming.display,
        value: incoming.value,
        isZero: incoming.isZero
      };

      if (status === 'missing') {
        missing.push(record);
      } else if (status === 'locked') {
        lockedOut.push(record);
      } else if (status === 'same') {
        same.push(record);
      } else if (status === 'fill' || status === 'zero' || status === 'update') {
        updates.push(record);
      } else {
        record.reason = status === 'zeroReview'
          ? 'AI ตอบ 0 จากไฟล์สแกน/รูปภาพ ควรตรวจสอบก่อนใช้'
          : (status === 'zeroConflict'
            ? 'AI ตอบ 0 แต่ช่องนี้มีค่าอยู่แล้ว'
            : 'ค่าเดิมต่างจากค่าใหม่');
        if (status === 'zeroReview' && scan) {
          record.reason = 'AI ตอบ 0 จากไฟล์สแกน/รูปภาพ ควรตรวจสอบก่อนใช้';
        }
        review.push(record);
      }

      fields[def.key] = record;
    });

    // --- ตรวจความสอดคล้องของชุดข้อมูลที่จะเติม ---
    var projected = {};
    Object.keys(formValues).forEach(function (k) { projected[k] = formValues[k]; });
    updates.forEach(function (r) {
      if (r.id) projected[r.id] = r.after;
    });
    var provided = { fiscalYear: fiscalYear, fyCheckNote: res && res.fyCheckNote };
    var validation = validateProjected(projected, provided);

    // ถ้าสมการบัญชีไม่ผ่าน ให้ย้ายฟิลด์ที่เพิ่งเติมเข้ามาเป็น "ต้องตรวจ" แทนการเติมอัตโนมัติ
    if (Object.keys(validation.failedIds).length) {
      var demoted = [];
      updates = updates.filter(function (r) {
        if (validation.failedIds[r.id]) {
          r.status = 'conflict';
          r.reason = 'ชุดข้อมูลไม่ผ่านการตรวจสมการบัญชี';
          review.push(r);
          demoted.push(r);
          return false;
        }
        return true;
      });
      demoted.forEach(function (r) { delete projected[r.id]; });
      if (demoted.length) {
        validation.warnings.push(
          'ระงับการเติมอัตโนมัติ ' + demoted.length + ' ฟิลด์ที่เกี่ยวข้อง จนกว่าจะยืนยัน'
        );
      }
    }

    // --- คำเตือนเรื่องไฟล์ ---
    var warnings = validation.warnings.slice();
    var aiWarnings = Array.isArray(res && res._aiWarnings) ? res._aiWarnings.filter(Boolean) : [];
    aiWarnings.forEach(function (w) { warnings.push('AI: ' + w); });
    files.forEach(function (f) {
      if (f.truncated) {
        warnings.push('ไฟล์ ' + f.name + ' ถูกตัดข้อความที่ 35,000 ตัวอักษร (อ่าน ' +
          (f.pagesRead || '?') + ' จาก ' + (f.totalPages || '?') + ' หน้า)');
      } else if (f.totalPages && f.pagesRead && f.pagesRead < f.totalPages) {
        warnings.push('ไฟล์ ' + f.name + ' อ่าน ' + f.pagesRead + ' จาก ' + f.totalPages + ' หน้า');
      }
      if (f.lowTextPdf || f.mode === 'scan' || f.mode === 'image') {
        warnings.push('ไฟล์ ' + f.name + ' เป็นไฟล์สแกน/รูปภาพ — ตัวเลขที่ได้ควรตรวจสอบ');
      }
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      runId: runId,
      createdAt: createdAt,
      fiscalYear: fiscalYear,
      files: files,
      hasScanFile: scan,
      updates: updates,
      review: review,
      same: same,
      missing: missing,
      locked: lockedOut,
      fields: fields,
      warnings: warnings,
      validation: validation
    };
  }

  // ---------------------------------------------------------------------------
  // apply / commit / rollback
  // ---------------------------------------------------------------------------

  function resolveDoc(env) {
    return (env && env.document) || global.document;
  }

  function setFieldValue(doc, record) {
    if (!doc || !record || !record.id) return false;
    if (record.kind === 'fiscal') {
      if (typeof global.setFiscalDropdownByText === 'function') {
        global.setFiscalDropdownByText(record.after);
        return true;
      }
    }
    var el = typeof doc.getElementById === 'function' ? doc.getElementById(record.id) : null;
    if (!el) return false;
    el.value = record.after;
    return true;
  }

  /**
   * applyPlan(plan, env, selectedIds)
   *   - เติม updates ทั้งหมด
   *   - เติม review เฉพาะ id ที่อยู่ใน selectedIds
   *   คืนรายการที่เติมจริง
   */
  function applyPlan(plan, env, selectedIds) {
    var doc = resolveDoc(env);
    var selected = {};
    (selectedIds || []).forEach(function (id) { selected[id] = true; });

    var applied = [];
    (plan.updates || []).forEach(function (r) {
      if (setFieldValue(doc, r)) applied.push(r);
    });
    (plan.review || []).forEach(function (r) {
      if (!selected[r.id]) return;
      if (setFieldValue(doc, r)) {
        r.appliedManually = true;
        applied.push(r);
      }
    });

    if (typeof global.onAuditorTypeChange === 'function') {
      try { global.onAuditorTypeChange(); } catch (e) { /* ignore */ }
    }
    return applied;
  }

  function getState(env) {
    return (env && env.state) || global.CPD_AppState || null;
  }

  function scheduleSave(env) {
    var S = (env && env.stateModule) || global.CPD_STATE;
    if (S && typeof S.scheduleLocalDraftSave === 'function') {
      try { S.scheduleLocalDraftSave(300); } catch (e) { /* ignore */ }
    }
  }

  /**
   * commit(plan, options)
   *   options.before      = ค่าฟอร์มก่อนเริ่ม (จาก captureValues)
   *   options.applied     = รายการที่ applyPlan คืนมา
   *   options.extraIds    = id เพิ่มเติมที่ถูกเติมนอก plan (เช่น profile regex)
   *   options.env         = { state, document, stateModule }
   */
  function commit(plan, options) {
    var opts = options || {};
    var s = getState(opts.env);
    if (!s || !s.analysis) return null;

    var before = opts.before || {};
    var applied = opts.applied || [];
    var extraIds = opts.extraIds || [];

    var snapshotValues = {};
    applied.forEach(function (r) {
      if (r.id) snapshotValues[r.id] = before[r.id] == null ? '' : before[r.id];
    });
    extraIds.forEach(function (id) {
      if (snapshotValues[id] === undefined) snapshotValues[id] = before[id] == null ? '' : before[id];
    });

    var prevMeta = s.analysis.uploadMeta || null;
    var meta = {
      schemaVersion: SCHEMA_VERSION,
      runId: plan.runId,
      createdAt: plan.createdAt,
      fiscalYear: plan.fiscalYear,
      coopName: (s.coopProfile && s.coopProfile.coopName) || '',
      files: plan.files,
      counts: {
        updated: applied.length,
        review: plan.review.length,
        missing: plan.missing.length,
        same: plan.same.length
      },
      fields: plan.fields,
      warnings: plan.warnings,
      appliedIds: applied.map(function (r) { return r.id; }),
      previous: prevMeta ? {
        runId: prevMeta.runId,
        createdAt: prevMeta.createdAt,
        fiscalYear: prevMeta.fiscalYear
      } : null
    };

    var history = Array.isArray(s.analysis.uploadHistory) ? s.analysis.uploadHistory.slice() : [];
    var lastIdx = history.length - 1;
    if (lastIdx >= 0 && history[lastIdx].runId === plan.runId) {
      // ผู้ใช้กดใช้ค่าที่เลือกเพิ่มเติมในรอบเดียวกัน → รวม snapshot เข้ารายการเดิม
      var merged = history[lastIdx].snapshot || {};
      Object.keys(snapshotValues).forEach(function (id) {
        if (merged[id] === undefined) merged[id] = snapshotValues[id];
      });
      history[lastIdx].snapshot = merged;
    } else {
      history.push({
        runId: plan.runId,
        createdAt: plan.createdAt,
        fiscalYear: plan.fiscalYear,
        snapshot: snapshotValues,
        previousMeta: prevMeta
      });
      while (history.length > HISTORY_LIMIT) history.shift();
    }

    s.analysis.uploadMeta = meta;
    s.analysis.uploadHistory = history;
    scheduleSave(opts.env);
    return meta;
  }

  /**
   * rollback(env) → number of restored fields
   */
  function rollback(env) {
    var s = getState(env);
    var doc = resolveDoc(env);
    if (!s || !s.analysis) return 0;
    var history = Array.isArray(s.analysis.uploadHistory) ? s.analysis.uploadHistory.slice() : [];
    if (!history.length) return 0;

    var last = history.pop();
    var values = last.snapshot || {};
    var restored = 0;
    Object.keys(values).forEach(function (id) {
      var el = doc && typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
      if (!el) return;
      el.value = values[id];
      restored++;
    });
    s.analysis.uploadHistory = history;
    s.analysis.uploadMeta = last.previousMeta || null;
    if (typeof global.onAuditorTypeChange === 'function') {
      try { global.onAuditorTypeChange(); } catch (e) { /* ignore */ }
    }
    if (typeof global.validateAccountingEquation === 'function') {
      try { global.validateAccountingEquation(); } catch (e) { /* ignore */ }
    }
    scheduleSave(env);
    return restored;
  }

  // ---------------------------------------------------------------------------
  // Review UI
  // ---------------------------------------------------------------------------

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusLabel(status) {
    var map = {
      conflict: 'ค่าเดิมต่างจากค่าใหม่',
      zeroConflict: 'AI ตอบ 0 แต่ช่องมีค่าเดิม',
      zeroReview: 'AI ตอบ 0 จากไฟล์สแกน',
      fill: 'เติมช่องว่าง',
      zero: 'ค่า 0 (ตรวจสอบ)',
      update: 'ทับผลรอบก่อน'
    };
    return map[status] || status;
  }

  function renderReview(plan, container, options) {
    if (!container) return;
    var opts = options || {};
    var items = plan.review || [];
    var warnings = plan.warnings || [];
    if (!items.length && !warnings.length) {
      container.innerHTML = '';
      container.classList.add('d-none');
      return;
    }

    var html = '';
    if (warnings.length) {
      html += '<div class="alert alert-warning py-2 mb-2"><div class="fw-bold mb-1">⚠️ ข้อควรตรวจสอบ</div><ul class="mb-0 ps-3">';
      warnings.forEach(function (w) { html += '<li>' + escapeHtml(w) + '</li>'; });
      html += '</ul></div>';
    }

    if (items.length) {
      html += '<div class="card border-warning mb-2"><div class="card-body py-2">';
      html += '<div class="fw-bold mb-2">🔍 พบ ' + items.length +
        ' ฟิลด์ที่ยังไม่ถูกเติม เพื่อไม่ให้ทับข้อมูลเดิม กรุณาเลือก</div>';
      html += '<div class="table-responsive" style="max-height:320px;overflow:auto">';
      html += '<table class="table table-sm table-bordered align-middle mb-2"><thead class="table-light"><tr>' +
        '<th style="width:36px" class="text-center"><input type="checkbox" id="uploadCheckAll"></th>' +
        '<th>ฟิลด์</th><th>ค่าเดิม</th><th>ค่าใหม่</th><th>เหตุผล</th></tr></thead><tbody>';
      items.forEach(function (r) {
        html += '<tr>' +
          '<td class="text-center"><input type="checkbox" class="upload-review-check" data-upload-id="' +
          escapeHtml(r.id) + '"></td>' +
          '<td>' + escapeHtml(r.label) + '</td>' +
          '<td class="text-muted">' + escapeHtml(r.before || '—') + '</td>' +
          '<td class="fw-bold">' + escapeHtml(r.after || '—') + '</td>' +
          '<td class="small">' + escapeHtml(r.reason || statusLabel(r.status)) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="d-flex gap-2 flex-wrap">' +
        '<button type="button" class="btn btn-sm btn-warning fw-bold" id="uploadApplySelected">ใช้ค่าที่เลือก</button>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary" id="uploadApplyAll">ใช้ค่าทั้งหมด</button>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary" id="uploadDismissReview">ข้ามรอบนี้</button>' +
        '</div></div></div>';
    }

    container.innerHTML = html;
    container.classList.remove('d-none');

    function selectedIds() {
      var out = [];
      var boxes = container.querySelectorAll('.upload-review-check');
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) out.push(boxes[i].getAttribute('data-upload-id'));
      }
      return out;
    }

    var checkAll = container.querySelector('#uploadCheckAll');
    if (checkAll) {
      checkAll.addEventListener('change', function () {
        var boxes = container.querySelectorAll('.upload-review-check');
        for (var i = 0; i < boxes.length; i++) boxes[i].checked = checkAll.checked;
      });
    }

    function finish(ids) {
      if (typeof opts.onApply === 'function') opts.onApply(ids);
      container.innerHTML = '';
      container.classList.add('d-none');
    }

    var btnSelected = container.querySelector('#uploadApplySelected');
    if (btnSelected) btnSelected.addEventListener('click', function () { finish(selectedIds()); });

    var btnAll = container.querySelector('#uploadApplyAll');
    if (btnAll) btnAll.addEventListener('click', function () {
      finish(items.map(function (r) { return r.id; }));
    });

    var btnDismiss = container.querySelector('#uploadDismissReview');
    if (btnDismiss) btnDismiss.addEventListener('click', function () { finish([]); });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  global.CPD_UPLOAD = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    FIELD_DEFS: FIELD_DEFS,
    MAIN_FIELDS: MAIN_FIELDS,
    DETAIL_FIELDS: DETAIL_FIELDS,
    parseNumber: parseNumber,
    formatMoney: formatMoney,
    formatCount: formatCount,
    resolveFiscalText: resolveFiscalText,
    resolveAuditorType: resolveAuditorType,
    resolveAuditorName: resolveAuditorName,
    extractThaiYear: extractThaiYear,
    parseMemberTriplet: parseMemberTriplet,
    validateProjected: validateProjected,
    captureValues: captureValues,
    normalizeFiles: normalizeFiles,
    plan: plan,
    applyPlan: applyPlan,
    commit: commit,
    rollback: rollback,
    renderReview: renderReview,
    escapeHtml: escapeHtml
  };
})(window);

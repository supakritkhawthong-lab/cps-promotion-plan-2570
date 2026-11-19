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

  function resolveAuditorName(text, auditorType) {
    var s = normText(text);
    if (!s) return null;
    var isGov = normText(auditorType).indexOf('รัฐ') !== -1;
    var isPratip = s.indexOf('พรทิพย์') !== -1;
    var isKanueksri = s.indexOf('คนึงศรี') !== -1;
    // The name must land in the select that is actually visible for the type.
    if (isGov || isPratip || isKanueksri) {
      var value = isPratip ? 'พรทิพย์' : (isKanueksri ? 'คนึงศรี' : s);
      return { id: 'gov_auditor_name', value: value, key: 'auditorName' };
    }
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
      var cov = f.coverage;
      var coverage = null;
      if (cov && typeof cov === 'object') {
        var pagesIncluded = Number(cov.pagesIncluded);
        if (!isFinite(pagesIncluded)) {
          pagesIncluded = Number(cov.pagesSelectedCount);
        }
        if (!isFinite(pagesIncluded)) {
          pagesIncluded = typeof f.pagesRead === 'number' ? f.pagesRead : 0;
        }
        var skippedList = Array.isArray(cov.pagesSkipped) ? cov.pagesSkipped.slice(0, 100) : [];
        var pagesRead = Number(cov.pagesRead);
        if (!isFinite(pagesRead)) {
          pagesRead = typeof f.pagesRead === 'number' ? f.pagesRead : pagesIncluded;
        }
        coverage = {
          totalPages: Number(cov.totalPages) || (typeof f.totalPages === 'number' ? f.totalPages : null),
          pagesRead: pagesRead,
          pagesIncluded: pagesIncluded,
          pagesSkipped: skippedList,
          skippedCount: Number(cov.skippedCount) || skippedList.length,
          pagesSkippedHighScore: Array.isArray(cov.pagesSkippedHighScore)
            ? cov.pagesSkippedHighScore.slice(0, 30) : [],
          charsTotal: Number(cov.charsTotal) || null,
          charsSent: Number(cov.charsSent) || null,
          evidenceChars: Number(cov.evidenceChars) || null,
          evidencePages: Array.isArray(cov.evidencePages) ? cov.evidencePages.slice(0, 30) : [],
          evidenceWindows: Number(cov.evidenceWindows) || null,
          evidenceCapped: !!cov.evidenceCapped,
          complete: !!cov.complete
        };
      }
      var evidenceMeta = null;
      if (f.evidence && typeof f.evidence === 'object') {
        evidenceMeta = {
          pages: Array.isArray(f.evidence.pages) ? f.evidence.pages.slice(0, 30) : [],
          chars: Number(f.evidence.chars) || null,
          windows: Number(f.evidence.windows) || null
        };
      } else if (f.evidenceText) {
        evidenceMeta = {
          pages: evidencePageNumbers(f.evidenceText).slice(0, 30),
          chars: String(f.evidenceText).length,
          windows: countEvidenceWindows(f.evidenceText)
        };
      }
      return {
        name: String(f.name || ''),
        category: String(f.category || ''),
        mode: String(f.mode || (f.base64 ? 'binary' : (f.extractedText ? 'text' : 'unknown'))),
        lowTextPdf: !!f.lowTextPdf,
        totalPages: typeof f.totalPages === 'number' ? f.totalPages : null,
        pagesRead: typeof f.pagesRead === 'number' ? f.pagesRead : null,
        chars: typeof f.chars === 'number' ? f.chars : (f.extractedText ? String(f.extractedText).length : null),
        truncated: !!f.truncated,
        // เก็บเฉพาะ metadata ของ JPEG (ห้ามเก็บ base64 ลง uploadMeta)
        pipeline: String(f.pipeline || (f.mode === 'scan' ? 'jpeg' : 'text')),
        jpegPages: Array.isArray(f.jpegPages)
          ? f.jpegPages.map(function (p) {
              return {
                page: Number(p.page) || 0,
                width: Number(p.width) || 0,
                height: Number(p.height) || 0
              };
            }).slice(0, 200)
          : [],
        evidence: evidenceMeta,
        coverage: coverage
      };
    }).filter(Boolean);
  }

  function hasScanFile(files) {
    return (files || []).some(function (f) {
      return f && (f.lowTextPdf || f.mode === 'scan' || f.mode === 'image');
    });
  }

  // ---------------------------------------------------------------------------
  // Page manifest / selection (Phase 1A)
  //
  // เป้าหมาย: อ่านทุกหน้า แล้วเลือกหน้าที่มีโอกาสสูงสุดให้อยู่ใน budget
  // แทนการตัดข้อความกลางหน้าแบบเดิม เพื่อไม่ให้หน้าท้าย ๆ หายเงียบ
  // ---------------------------------------------------------------------------

  var STRONG_PAGE_KEYWORDS = [
    'งบฐานะการเงิน', 'งบดุล', 'งบกำไรขาดทุน', 'งบกำไรขาดทุนเบ็ดเสร็จ',
    'งบกระแสเงินสด', 'งบแสดงการเปลี่ยนแปลงส่วนของเจ้าของ',
    'รวมสินทรัพย์', 'รวมหนี้สิน', 'ทุนเรือนหุ้น', 'ทุนสำรอง'
  ];

  var WEAK_PAGE_KEYWORDS = [
    'สินทรัพย์', 'หนี้สิน', 'รายได้', 'ค่าใช้จ่าย', 'กำไร', 'ขาดทุน',
    'เงินให้กู้', 'เงินรับฝาก', 'เงินฝาก', 'สมาชิก', 'ผู้สอบบัญชี',
    'ผู้ตรวจสอบกิจการ', 'ข้อสังเกต', 'ปริมาณธุรกิจ', 'จดทะเบียน', 'คณะกรรมการ'
  ];

  function countNumberTokens(text) {
    var m = String(text || '').match(/(?:\d[\d,]*\.?\d*|\([\d,]+\.?\d*\))/g);
    return m ? m.length : 0;
  }

  /**
   * นับโทเค็นตัวเลขที่มีลักษณะเป็นเงิน (มีลูกน้ำคั่นหลักพัน หรือทศนิยม 2 ตำแหน่ง)
   * ใช้ตรวจว่าข้อความที่ PDF.js อ่านได้มีตัวเลขการเงินจริงหรือไม่
   * เลขหน้า / ปี พ.ศ. / จำนวนคน จะไม่ถูกนับ
   */
  function countMonetaryTokens(text) {
    var m = String(text || '')
      .match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2})(?!\d)/g);
    return m ? m.length : 0;
  }

  /**
   * ให้คะแนนหน้าตามโอกาสที่จะมีตัวเลข/ข้อมูลสำคัญ
   *   - หัวข้อการเงิน (+3 ต่อคำ, สูงสุด 9)
   *   - คำสำคัญทั่วไป (+1 ต่อคำ, สูงสุด 5)
   *   - ความหนาแน่นของตัวเลข (+สูงสุด 6)
   *   - ลักษณะตารางตัวเลข (+3)
   *   - หน้าแรก ๆ ของไฟล์ (+2)
   */
  function scorePageText(text, pageNo) {
    var t = String(text || '');
    var score = 0;
    var reasons = [];
    var strongHits = STRONG_PAGE_KEYWORDS.filter(function (k) { return t.indexOf(k) !== -1; });
    if (strongHits.length) {
      score += Math.min(9, strongHits.length * 3);
      reasons.push('หัวข้อการเงิน: ' + strongHits.slice(0, 3).join(', '));
    }
    var weakHits = WEAK_PAGE_KEYWORDS.filter(function (k) { return t.indexOf(k) !== -1; });
    if (weakHits.length) {
      score += Math.min(5, weakHits.length);
      reasons.push('คำสำคัญ: ' + weakHits.slice(0, 4).join(', '));
    }
    var numbers = countNumberTokens(t);
    if (numbers >= 6) {
      score += Math.min(6, Math.floor(numbers / 6));
      reasons.push('ตัวเลข ' + numbers + ' รายการ');
    }
    if (/(?:\d[\d,]*\.?\d*\s+){4,}\d/.test(t)) {
      score += 3;
      reasons.push('ลักษณะตารางตัวเลข');
    }
    var p = Number(pageNo) || 0;
    if (p >= 1 && p <= 3) {
      score += 2;
      reasons.push('หน้าข้อมูลพื้นฐาน');
    }
    return { page: p, score: score, reasons: reasons, numbers: numbers };
  }

  /**
   * selectPages(pageTexts, options)
   *   pageTexts = [{ page, text }]  (อ่านมาทุกหน้าแล้ว)
   * คืนข้อความที่เลือก (คงลำดับหน้า) + coverage สำหรับแจ้งผู้ใช้
   */
  function selectPages(pageTexts, options) {
    var opts = options || {};
    var maxChars = Number(opts.maxChars) > 0 ? Number(opts.maxChars) : 55000;
    // ค่า 0 ที่ส่งมาชัดเจน = ไม่บังคับหน้าแรก / ไม่ข้ามหน้าสั้น
    // (ใช้ตอนผู้ใช้กดเลือกหน้าที่ถูกตัดกลับในพรีวิว)
    var alwaysPages = opts.alwaysPages === 0 ? 0
      : (Number(opts.alwaysPages) > 0 ? Number(opts.alwaysPages) : 3);
    var minPageChars = opts.minPageChars === 0 ? 0
      : (Number(opts.minPageChars) > 0 ? Number(opts.minPageChars) : 20);
    var highScore = Number(opts.highScore) > 0 ? Number(opts.highScore) : 5;
    var declaredTotal = Number(opts.declaredTotalPages) > 0
      ? Number(opts.declaredTotalPages)
      : (pageTexts || []).length;
    // PDF pipeline ส่ง Markdown สะอาด (## หน้า N) แทนข้อความล้วน ([หน้า N])
    var markdown = opts.outputFormat === 'markdown';

    var scored = [];
    (pageTexts || []).forEach(function (p) {
      if (!p) return;
      var text = String(p.text || '').trim();
      if (text.length < minPageChars) return;
      var s = scorePageText(text, p.page);
      scored.push({ page: s.page, text: text, chars: text.length, score: s.score, reasons: s.reasons });
    });
    scored.sort(function (a, b) { return a.page - b.page; });

    var selected = {};
    var usedChars = 0;
    function include(item, force) {
      if (selected[item.page]) return true;
      var cost = item.chars + (markdown ? 16 : 12); // "## หน้า 999\n\n" หรือ "[หน้า 999] "
      if (!force && usedChars + cost > maxChars && Object.keys(selected).length > 0) return false;
      selected[item.page] = true;
      usedChars += cost;
      return true;
    }

    // 1) หน้าแรก ๆ (ข้อมูลพื้นฐาน/ใบโปรไฟล์) ต้องมีเสมอ
    scored.forEach(function (item) {
      if (item.page <= alwaysPages) include(item, true);
    });

    // 2) เติมหน้าคะแนนสูงจนเต็ม budget
    var rest = scored.filter(function (item) { return !selected[item.page]; })
      .sort(function (a, b) { return b.score - a.score || a.page - b.page; });
    rest.forEach(function (item) { include(item, false); });

    var kept = scored.filter(function (item) { return selected[item.page]; });
    var skipped = scored.filter(function (item) { return !selected[item.page]; });
    var pagesUnread = Math.max(0, declaredTotal - scored.length);

    return {
      text: kept.map(function (item) {
        return markdown
          ? '## หน้า ' + item.page + '\n\n' + item.text
          : '[หน้า ' + item.page + '] ' + item.text;
      }).join(markdown ? '\n\n' : '\n'),
      outputFormat: markdown ? 'markdown' : 'plain',
      pagesSelected: kept.map(function (item) { return item.page; }),
      pagesSelectedCount: kept.length,
      pagesSkipped: skipped.map(function (item) { return item.page; }).slice(0, 200),
      skippedCount: skipped.length + pagesUnread,
      pagesSkippedHighScore: skipped.filter(function (item) { return item.score >= highScore; })
        .map(function (item) { return item.page; }).slice(0, 50),
      charsTotal: scored.reduce(function (sum, item) { return sum + item.chars; }, 0),
      charsSelected: usedChars,
      totalPages: declaredTotal,
      pagesWithText: scored.length,
      pagesUnread: pagesUnread,
      complete: skipped.length === 0 && pagesUnread === 0
    };
  }

  // รองรับทั้งรูปแบบเดิม [หน้า N] และ Markdown ## หน้า N
  function pagePartsFromText(text) {
    var t = String(text || '');
    if (!/(?:\[หน้า \d+\]|## หน้า \d+)/.test(t)) return null;
    return t.split(/(?=\[หน้า \d+\]|## หน้า \d+)/)
      .map(function (s) { return s.replace(/\n+$/, ''); })
      .filter(function (s) { return s.trim(); });
  }

  function pageNumbersFromText(text) {
    var out = [];
    var re = /(?:\[หน้า|## หน้า)\s*(\d+)/g;
    var m;
    while ((m = re.exec(String(text || '')))) out.push(Number(m[1]));
    return out;
  }

  // ---------------------------------------------------------------------------
  // Evidence windows (Phase 1B)
  //
  // หน้าที่ถูกข้ามเพราะ budget ไม่ได้หายไปเฉย ๆ: เราตัดข้อความสั้น ๆ
  // รอบคำสำคัญ/ตัวเลขจากหน้านั้นแนบไปกับ payload เพื่อให้ระยะ facts
  // ใช้ยืนยันตัวเลขที่อาจหลุดจากการอ่านทั้งหน้า
  // ---------------------------------------------------------------------------

  var EVIDENCE_TERMS = [
    'งบฐานะการเงิน', 'งบดุล', 'งบกำไรขาดทุน', 'งบกระแสเงินสด',
    'สินทรัพย์รวม', 'รวมสินทรัพย์', 'หนี้สินรวม', 'รวมหนี้สิน',
    'ทุนเรือนหุ้น', 'ทุนสำรอง', 'ทุนของสหกรณ์', 'ทุนดำเนินงาน',
    'กำไรสุทธิ', 'ขาดทุนสะสม', 'รายได้รวม', 'ค่าใช้จ่ายรวม',
    'ต้นทุนและค่าใช้จ่าย', 'เงินให้กู้', 'เงินรับฝาก', 'ลูกหนี้',
    'เจ้าหนี้', 'เงินกู้ยืม', 'สินค้าคงเหลือ', 'ที่ดิน อาคาร',
    'ปริมาณธุรกิจ', 'จำนวนสมาชิก', 'ผู้สอบบัญชี', 'ผู้ตรวจสอบกิจการ',
    'ข้อสังเกต', 'ข้อบกพร่อง', 'สวัสดิการ', 'สาธารณประโยชน์', 'จดทะเบียน',
    'total assets', 'total liabilities', 'net profit', 'share capital', 'reserve'
  ];

  var EVIDENCE_MAX_PER_FILE = 6000;
  var EVIDENCE_MAX_TOTAL = 18000;

  /** ตัดข้อความหลักฐานที่ขอบรายการ "[หลักฐานจากหน้า N]" เท่านั้น */
  function sliceEvidenceText(text, maxChars) {
    var t = String(text || '').trim();
    var max = Math.max(0, Number(maxChars) || 0);
    if (t.length <= max) return t;
    if (max <= 0) return '';
    var cut = t.lastIndexOf('\n[หลักฐานจากหน้า', max);
    if (cut <= 0) cut = t.lastIndexOf('\n', max);
    if (cut < Math.floor(max * 0.5)) cut = max;
    return t.slice(0, cut).trim();
  }

  function evidencePageNumbers(text) {
    var out = [];
    var re = /\[หลักฐานจากหน้า (\d+)\]/g;
    var m;
    while ((m = re.exec(String(text || '')))) {
      var page = Number(m[1]);
      if (out.indexOf(page) === -1) out.push(page);
    }
    return out;
  }

  function countEvidenceWindows(text) {
    var m = String(text || '').match(/\[หลักฐานจากหน้า \d+\]/g);
    return m ? m.length : 0;
  }

  /**
   * extractEvidence(pages, options) → { text, windows, pagesCovered, chars, capped }
   *   pages = [{ page, text }] ของเฉพาะหน้าที่ไม่ได้ส่งทั้งหน้า
   *   - ตัดข้อความรอบคำสำคัญ (ก่อน/หลังคำ) แล้ว snap ที่ขอบคำ
   *   - จำกัดจำนวน window ต่อหน้าและจำนวนตัวอักษรรวม
   */
  function extractEvidence(pages, options) {
    var opts = options || {};
    var maxChars = Number(opts.maxChars) > 0 ? Number(opts.maxChars) : EVIDENCE_MAX_PER_FILE;
    var maxPerPage = Number(opts.maxPerPage) > 0 ? Number(opts.maxPerPage) : 2;
    var maxWindows = Number(opts.maxWindows) > 0 ? Number(opts.maxWindows) : 40;
    var before = Number(opts.before) >= 0 ? Number(opts.before) : 60;
    var after = Number(opts.after) > 0 ? Number(opts.after) : 220;
    var minPageChars = Number(opts.minPageChars) > 0 ? Number(opts.minPageChars) : 20;

    var lines = [];
    var windows = [];
    var pagesCovered = [];
    var used = 0;
    var dropped = 0;

    var sorted = (pages || []).slice().sort(function (a, b) {
      return (Number(a && a.page) || 0) - (Number(b && b.page) || 0);
    });

    sorted.forEach(function (p) {
      if (!p) return;
      var page = Number(p.page) || 0;
      var text = normText(p.text);
      if (text.length < minPageChars) return;

      var hits = [];
      EVIDENCE_TERMS.forEach(function (term) {
        var idx = text.indexOf(term);
        var guard = 0;
        while (idx !== -1 && guard++ < 3) {
          hits.push({ index: idx, term: term });
          idx = text.indexOf(term, idx + term.length);
        }
      });
      hits.sort(function (a, b) {
        return a.index - b.index || b.term.length - a.term.length;
      });

      var accepted = 0;
      var lastEnd = -1;
      for (var i = 0; i < hits.length && accepted < maxPerPage; i++) {
        var hit = hits[i];
        if (hit.index <= lastEnd) continue;
        var start = Math.max(0, hit.index - before);
        var end = Math.min(text.length, hit.index + hit.term.length + after);
        var spaceBefore = text.lastIndexOf(' ', hit.index);
        if (spaceBefore >= start && hit.index - spaceBefore <= 30) start = spaceBefore + 1;
        var spaceAfter = text.indexOf(' ', end);
        if (spaceAfter !== -1 && spaceAfter - end <= 30) end = spaceAfter;
        var snippet = text.slice(start, end).trim();
        if (!snippet) continue;

        var line = '[หลักฐานจากหน้า ' + page + '] (' + hit.term + ') ' + snippet;
        if (windows.length >= maxWindows || used + line.length + 1 > maxChars) {
          dropped++;
          continue;
        }
        lines.push(line);
        windows.push({ page: page, term: hit.term, chars: line.length });
        used += line.length + 1;
        accepted++;
        lastEnd = end;
        if (pagesCovered.indexOf(page) === -1) pagesCovered.push(page);
      }
    });

    var text = lines.join('\n');
    return {
      text: text,
      windows: windows,
      pagesCovered: pagesCovered.sort(function (a, b) { return a - b; }),
      chars: text.length,
      capped: dropped > 0
    };
  }

  /** อัปเดต metadata/coverage ให้ตรงกับ evidenceText ปัจจุบัน */
  function syncEvidenceMeta(file) {
    if (!file) return;
    var text = String(file.evidenceText || '').trim();
    if (text) {
      file.evidenceText = text;
      file.evidence = {
        pages: evidencePageNumbers(text).slice(0, 30),
        chars: text.length,
        windows: countEvidenceWindows(text)
      };
    } else {
      if (file.evidenceText !== undefined) delete file.evidenceText;
      file.evidence = null;
    }
    if (file.coverage) {
      file.coverage.evidenceChars = text ? text.length : 0;
      file.coverage.evidencePages = evidencePageNumbers(text).slice(0, 30);
      file.coverage.evidenceWindows = countEvidenceWindows(text);
    }
  }

  /**
   * attachFileEvidence(file, pages, options)
   * ต่อหลักฐานจากหน้าใหม่เข้ากับ evidenceText เดิม (ถ้ามี) แล้วจำกัดขนาดต่อไฟล์
   */
  function attachFileEvidence(file, pages, options) {
    if (!file) return false;
    var opts = options || {};
    var maxChars = Number(opts.maxChars) > 0 ? Number(opts.maxChars) : EVIDENCE_MAX_PER_FILE;
    var extracted = extractEvidence(pages, opts);
    if (!extracted.text) return false;

    var existing = String(file.evidenceText || '').trim();
    var combined = existing ? existing + '\n' + extracted.text : extracted.text;
    var capped = combined.length > maxChars;
    var wasCapped = !!(file.coverage && file.coverage.evidenceCapped);
    file.evidenceText = sliceEvidenceText(combined, maxChars);
    syncEvidenceMeta(file);
    if (file.coverage) {
      // ธงนี้ต้องติดค้างไว้ ไม่ถูกล้างเมื่อต่อหลักฐานรอบใหม่
      file.coverage.evidenceCapped = wasCapped || !!extracted.capped || capped;
    }
    return true;
  }

  /** จำกัดหลักฐานรวมทุกไฟล์ โดยตัดหลักฐานของไฟล์ที่ยาวที่สุดก่อน */
  function capEvidenceBudget(files, maxTotalChars) {
    var max = Number(maxTotalChars) > 0 ? Number(maxTotalChars) : EVIDENCE_MAX_TOTAL;
    var list = (files || []).filter(function (f) {
      return f && String(f.evidenceText || '').trim();
    });

    function totalChars() {
      return list.reduce(function (sum, f) {
        return sum + String(f.evidenceText || '').length;
      }, 0);
    }

    var total = totalChars();
    var guard = 0;
    while (total > max && guard++ < 100) {
      list.sort(function (a, b) {
        return String(b.evidenceText || '').length - String(a.evidenceText || '').length;
      });
      var f = list[0];
      var current = String(f.evidenceText || '').length;
      var next = sliceEvidenceText(f.evidenceText, Math.max(0, current - (total - max)));
      if (next.length >= current) {
        next = sliceEvidenceText(f.evidenceText, Math.max(0, Math.floor(current / 2)));
      }
      if (next.length >= current) break;
      f.evidenceText = next;
      if (f.coverage) f.coverage.evidenceCapped = true;
      syncEvidenceMeta(f);
      if (!next) list.shift();
      total = totalChars();
    }
    return total;
  }

  /**
   * trimFileToChars(file, targetChars)
   * ตัดข้อความของไฟล์ที่ระดับ "หน้า" (ไม่ตัดกลางหน้า) และอัปเดต coverage
   * เลือกตัด "หน้าที่คะแนนต่ำสุด" ก่อน เพื่อไม่ให้หน้าสำคัญท้ายไฟล์หายก่อน
   * หน้าที่ถูกตัดจะถูกเก็บเป็น evidence window เพื่อไม่ให้ตัวเลขสำคัญหายเงียบ
   */
  function trimFileToChars(file, targetChars) {
    if (!file || !file.extractedText) return false;
    var current = String(file.extractedText);
    var target = Math.max(0, Number(targetChars) || 0);
    if (current.length <= target) return false;

    var parts = pagePartsFromText(current);
    var nextText;
    var removedParts = {};
    var removedItems = [];
    if (parts) {
      var items = parts.map(function (part) {
        var m = part.match(/^(?:\[หน้า (\d+)\]|## หน้า (\d+))/);
        var page = m ? Number(m[1] || m[2]) : 0;
        return { page: page, text: part, chars: part.length, score: scorePageText(part, page).score };
      });
      var used = items.reduce(function (sum, it) { return sum + it.chars + 1; }, 0) - 1;
      while (used > target && items.length > 1) {
        // เก็บหน้า 1-3 (ข้อมูลพื้นฐาน) ไว้ก่อน แล้วตัดหน้าที่คะแนนต่ำสุด/หน้าท้ายสุด
        var pool = items.filter(function (it) { return it.page > 3; });
        if (!pool.length) pool = items.slice();
        pool.sort(function (a, b) { return a.score - b.score || b.page - a.page; });
        var victim = pool[0];
        used -= (victim.chars + 1);
        if (victim.page) {
          removedParts[victim.page] = victim.text;
          removedItems.push({
            page: victim.page,
            text: victim.text.replace(/^(?:\[หน้า \d+\]|## หน้า \d+)\s*/, '')
          });
        }
        items = items.filter(function (it) { return it !== victim; });
      }
      items.sort(function (a, b) { return a.page - b.page; });
      nextText = items.map(function (it) { return it.text; }).join('\n');
    } else {
      var cut = current.lastIndexOf('\n', target);
      if (cut < Math.floor(target * 0.6)) cut = target;
      nextText = current.slice(0, cut).trim();
    }
    if (nextText.length >= current.length) return false;

    var beforeNumbers = pageNumbersFromText(current);
    var afterNumbers = pageNumbersFromText(nextText);
    var removed = beforeNumbers.filter(function (p) { return afterNumbers.indexOf(p) === -1; });

    file.extractedText = nextText;
    file.chars = nextText.length;
    file.truncated = true;
    file.pagesRead = parts ? afterNumbers.length : file.pagesRead;
    if (file.coverage) {
      var cov = file.coverage;
      cov.charsSent = nextText.length;
      if (parts) cov.pagesIncluded = afterNumbers.length;
      if (Array.isArray(cov.pagesSelected)) {
        cov.pagesSelected = cov.pagesSelected.filter(function (p) { return afterNumbers.indexOf(p) !== -1; });
      }
      var skipped = Array.isArray(cov.pagesSkipped) ? cov.pagesSkipped.slice() : [];
      removed.forEach(function (p) {
        if (skipped.indexOf(p) === -1 && skipped.length < 200) skipped.push(p);
      });
      skipped.sort(function (a, b) { return a - b; });
      cov.pagesSkipped = skipped;
      if (parts && Number(cov.totalPages) > 0) {
        cov.skippedCount = Math.max(0, Number(cov.totalPages) - afterNumbers.length);
      } else {
        cov.skippedCount = (Number(cov.skippedCount) || 0) + removed.length;
      }
      cov.complete = false;
      // เตือนเฉพาะหน้าที่ "มีคะแนนสูง" จริง ไม่ใช่ทุกหน้าที่ถูกตัดเพราะ budget
      var high = Array.isArray(cov.pagesSkippedHighScore) ? cov.pagesSkippedHighScore.slice() : [];
      removed.forEach(function (p) {
        var partText = removedParts[p];
        var important = partText ? scorePageText(partText, p).score >= 5 : false;
        if (important && high.indexOf(p) === -1 && high.length < 50) high.push(p);
      });
      high.sort(function (a, b) { return a - b; });
      cov.pagesSkippedHighScore = high;
    }
    // Phase 1B: เก็บหลักฐานจากหน้าที่เพิ่งถูกตัดออก ไม่ให้ตัวเลขหายเงียบ
    if (removedItems.length) {
      attachFileEvidence(file, removedItems, { maxChars: EVIDENCE_MAX_PER_FILE });
    }
    return true;
  }

  /**
   * applyTotalBudget(files, options)
   * จำกัดตัวอักษรรวมทุกไฟล์ (เช่น 180,000) โดยตัดไฟล์ที่ใหญ่ที่สุดก่อน
   * ภายในไฟล์จะตัดหน้าที่คะแนนต่ำสุดและไม่ตัดกลางหน้า
   */
  function applyTotalBudget(files, options) {
    var opts = options || {};
    var maxTotal = Number(opts.maxTotalChars) > 0 ? Number(opts.maxTotalChars) : 180000;
    var minPerFile = Number(opts.minPerFile) > 0 ? Number(opts.minPerFile) : 12000;
    var list = files || [];

    function totalChars() {
      return list.reduce(function (sum, f) {
        return sum + (f && f.extractedText ? String(f.extractedText).length : 0);
      }, 0);
    }

    var total = totalChars();
    var guard = 0;
    while (total > maxTotal && guard++ < 100) {
      var candidates = list.filter(function (f) {
        return f && f.extractedText && String(f.extractedText).length > minPerFile;
      });
      if (!candidates.length) break;
      candidates.sort(function (a, b) {
        return String(b.extractedText).length - String(a.extractedText).length;
      });
      var f = candidates[0];
      var current = String(f.extractedText).length;
      var overflow = total - maxTotal;
      var target = Math.max(minPerFile, current - Math.max(1000, overflow));
      var changed = trimFileToChars(f, target);
      if (!changed) {
        var parts = pagePartsFromText(f.extractedText);
        if (parts && parts.length > 1) {
          changed = trimFileToChars(f, current - parts[parts.length - 1].length - 2);
        } else {
          changed = trimFileToChars(f, Math.max(minPerFile, current - 1000));
        }
      }
      if (!changed) break;
      total = totalChars();
    }
    // Phase 1B: หลักฐานเสริมมีเพดานแยกจากข้อความหลัก (ไม่กิน budget 180k)
    capEvidenceBudget(list, Number(opts.maxEvidenceChars) > 0
      ? Number(opts.maxEvidenceChars)
      : EVIDENCE_MAX_TOTAL);
    return list;
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
      var resolved = resolveAuditorName(raw, res && res.auditorType);
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
    if (fiscalYear && yrLatest && yrLatest < fiscalYear - 1) {
      warnings.push('ปีบัญชีในเอกสาร (' + yrLatest + ') เก่ากว่าที่คาดหวังสำหรับปีแผน (' + fiscalYear + ') อาจเป็นรายงานปีก่อนที่แนบมา');
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

  /**
   * sanitizeFieldSource_(src)
   * จำกัดขนาดข้อมูลที่มาของค่า (ไฟล์/ช่วงหน้า/ช่วงที่) ก่อนเก็บลง uploadMeta
   * Phase 1C: GAS ส่ง `_aiFieldSources` กลับมาเฉพาะฟิลด์ที่สกัดจากหลายช่วง
   */
  function sanitizeFieldSource_(src) {
    if (!src || typeof src !== 'object') return null;
    var file = String(src.file || '').slice(0, 120);
    var pages = String(src.pages || '').slice(0, 24);
    var chunk = src.chunk;
    if (!file && !pages) return null;
    return {
      file: file,
      pages: pages,
      chunk: (typeof chunk === 'number' || typeof chunk === 'string')
        ? String(chunk).slice(0, 12) : ''
    };
  }

  /** จำกัดรายการค่าที่ขัดกันก่อนเก็บลง uploadMeta (สูงสุด 20 ฟิลด์ × 3 ค่า) */
  function sanitizeConflicts_(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).slice(0, 20).forEach(function (key) {
      var list = raw[key];
      if (!Array.isArray(list)) return;
      var values = list.slice(0, 3).map(function (item) {
        return {
          value: String((item && item.value) || '').slice(0, 80),
          file: String((item && item.file) || '').slice(0, 120),
          pages: String((item && item.pages) || '').slice(0, 24)
        };
      }).filter(function (item) { return item.value; });
      if (values.length > 1) out[key] = values;
    });
    return out;
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
    var fieldSources = (res && res._aiFieldSources && typeof res._aiFieldSources === 'object')
      ? res._aiFieldSources : {};
    var conflicts = sanitizeConflicts_(res && res._aiConflicts);

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
      var source = sanitizeFieldSource_(fieldSources[def.key]);
      if (source) record.source = source;

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
    if (Object.keys(conflicts).length) {
      warnings.push('พบค่าขัดกัน ' + Object.keys(conflicts).length +
        ' ฟิลด์จากหลายช่วงเอกสาร — ระบบเลือกค่าที่น่าเชื่อถือที่สุดและเก็บที่มาไว้ใน metadata');
    }
    var aiWarnings = Array.isArray(res && res._aiWarnings) ? res._aiWarnings.filter(Boolean) : [];
    aiWarnings.forEach(function (w) { warnings.push('AI: ' + w); });
    files.forEach(function (f) {
      var cov = f.coverage;
      var totalPages = (cov && cov.totalPages) || f.totalPages;
      var included = cov ? cov.pagesIncluded : f.pagesRead;
      var readCount = cov ? (cov.pagesRead || included) : f.pagesRead;
      if (cov) {
        if (!cov.complete && totalPages) {
          var msg = 'ไฟล์ ' + f.name + ': อ่าน ' + (readCount || '?') + '/' + totalPages + ' หน้า';
          if (included && readCount && included !== readCount) {
            msg += ' • ส่งเข้า AI ' + included + ' หน้า';
          }
          if (cov.skippedCount > 0) msg += ' • ข้าม ' + cov.skippedCount + ' หน้า';
          warnings.push(msg);
          if (cov.pagesSkippedHighScore && cov.pagesSkippedHighScore.length) {
            warnings.push('ไฟล์ ' + f.name + ': หน้าที่มีแนวโน้มสำคัญแต่ยังไม่ได้อ่าน — หน้า ' +
              cov.pagesSkippedHighScore.slice(0, 12).join(', ') +
              (cov.pagesSkippedHighScore.length > 12 ? ' …' : '') +
              ' (ลองแยกเฉพาะหน้าเหล่านี้เป็นไฟล์ใหม่แล้วอัปโหลดซ้ำ)');
          }
        } else if (included && totalPages && included < totalPages) {
          warnings.push('ไฟล์ ' + f.name + ' อ่าน ' + included + ' จาก ' + totalPages + ' หน้า');
        }
      } else if (f.truncated) {
        warnings.push('ไฟล์ ' + f.name + ' ถูกตัดข้อความ (อ่าน ' +
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
      conflicts: conflicts,
      validation: validation
    };
  }

  // ---------------------------------------------------------------------------
  // apply / commit / rollback
  // ---------------------------------------------------------------------------

  function resolveDoc(env) {
    return (env && env.document) || global.document;
  }

  function setFieldValue(doc, record, warnings) {
    if (!doc || !record || !record.id) return false;
    if (record.kind === 'fiscal') {
      if (typeof global.setFiscalDropdownByText === 'function') {
        global.setFiscalDropdownByText(record.after);
        return true;
      }
    }
    var el = typeof doc.getElementById === 'function' ? doc.getElementById(record.id) : null;
    if (!el) {
      var msg = 'ไม่พบช่องฟอร์ม "' + (record.label || record.id) + '" จึงไม่ได้เติมค่า (' + record.id + ')';
      if (warnings && Array.isArray(warnings) && warnings.indexOf(msg) === -1) warnings.push(msg);
      return false;
    }
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
    var warnings = plan.warnings || (plan.warnings = []);
    (plan.updates || []).forEach(function (r) {
      if (setFieldValue(doc, r, warnings)) applied.push(r);
    });
    (plan.review || []).forEach(function (r) {
      if (!selected[r.id]) return;
      if (setFieldValue(doc, r, warnings)) {
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
    // Phase 1C: เก็บเฉพาะเมื่อมีค่าขัดกันจริง (ประหยัดพื้นที่ State)
    if (plan.conflicts && Object.keys(plan.conflicts).length) {
      meta.conflicts = plan.conflicts;
    }

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

    // PDF pipeline: เก็บ Markdown + ฟิลด์ที่ AI สกัด (ไม่เก็บ base64)
    if (opts.documents && global.CPD_PDF_PIPELINE &&
        typeof global.CPD_PDF_PIPELINE.cacheDocs === 'function') {
      try {
        global.CPD_PDF_PIPELINE.cacheDocs(s, opts.documents);
      } catch (e) {
        console.warn('[docCache]', e);
      }
    }

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

  function sourceLine(record) {
    if (!record || !record.source) return '';
    var bits = [];
    if (record.source.file) bits.push(record.source.file);
    if (record.source.pages) bits.push('หน้า ' + record.source.pages);
    if (record.source.chunk && record.source.chunk !== '1') bits.push('ช่วง ' + record.source.chunk);
    if (!bits.length) return '';
    return '<div class="small text-muted">ที่มา: ' + escapeHtml(bits.join(' • ')) + '</div>';
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
    if (warnings.length || items.length) {
      html += '<div class="alert alert-warning py-2 mb-2">' +
        '<span class="cpd-confidence-badge">⚠️ พบจุดที่ควรตรวจสอบเพิ่มเติมก่อนบันทึก</span>';
      if (warnings.length) {
        html += '<ul class="mb-0 ps-3 mt-2">';
        warnings.forEach(function (w) { html += '<li>' + escapeHtml(w) + '</li>'; });
        html += '</ul>';
      }
      html += '</div>';
    }

    if (items.length) {
      html += '<div class="card border-warning mb-2"><div class="card-body py-2">';
      html += '<div class="fw-bold mb-2">ระบบเว้นช่องที่หาไม่เจอหรือมีค่าขัดกันไว้ให้คุณตรวจเอง — เลือก ' + items.length +
        ' ฟิลด์ที่ต้องการใช้ (ค่าเดิมจะไม่ถูกทับโดยอัตโนมัติ)</div>';
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
          '<td class="fw-bold">' + escapeHtml(r.after || '—') + sourceLine(r) + '</td>' +
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
    countNumberTokens: countNumberTokens,
    countMonetaryTokens: countMonetaryTokens,
    scorePageText: scorePageText,
    selectPages: selectPages,
    pagePartsFromText: pagePartsFromText,
    pageNumbersFromText: pageNumbersFromText,
    EVIDENCE_TERMS: EVIDENCE_TERMS,
    EVIDENCE_MAX_PER_FILE: EVIDENCE_MAX_PER_FILE,
    EVIDENCE_MAX_TOTAL: EVIDENCE_MAX_TOTAL,
    extractEvidence: extractEvidence,
    sliceEvidenceText: sliceEvidenceText,
    evidencePageNumbers: evidencePageNumbers,
    attachFileEvidence: attachFileEvidence,
    syncEvidenceMeta: syncEvidenceMeta,
    capEvidenceBudget: capEvidenceBudget,
    trimFileToChars: trimFileToChars,
    applyTotalBudget: applyTotalBudget,
    plan: plan,
    applyPlan: applyPlan,
    commit: commit,
    rollback: rollback,
    renderReview: renderReview,
    escapeHtml: escapeHtml
  };
})(window);

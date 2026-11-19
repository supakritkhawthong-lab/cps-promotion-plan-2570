/* ============================================================================
 * cpd-pdf-pipeline.js — Client-side PDF processing pipeline
 *
 * เป้าหมาย
 *   1) แปลงข้อความจาก PDF.js เป็น Markdown สะอาด เพื่อส่งแทนข้อความล้วน/ไฟล์ PDF
 *   2) กรองหน้า: รับช่วงหน้าที่ผู้ใช้ระบุ + ตัดรายงานประชุมปีเก่าท้ายเล่มอัตโนมัติ
 *   3) เรนเดอร์หน้าสแกนเป็น JPEG (กว้างสูงสุด 1200px, quality 0.75)
 *   4) เก็บ Markdown + ฟิลด์ที่ AI สกัดลง State/LocalStorage (ไม่เก็บ base64)
 *
 * ไฟล์นี้เป็น pure module — ไม่แตะ DOM ตอนโหลด (ยกเว้นตอน render จริง)
 * และไม่พึ่ง pdf-lib/PDF.js ตอนโหลด จึงเทสต์ด้วย vm ได้
 * ========================================================================== */
(function (global) {
  'use strict';

  var MAX_DOC_CHARS = 120000;
  var MAX_TOTAL_CACHE_CHARS = 250000;
  var MAX_CACHED_DOCS = 3;
  var JPEG_MAX_WIDTH = 1200;
  var JPEG_QUALITY = 0.75;
  var SCALE_CAP = 2;

  var MEETING_REPORT_TERMS = [
    'รายงานการประชุม', 'รายงานประชุม', 'วาระการประชุม', 'รายงานการประชุมใหญ่'
  ];

  var RELEVANT_TERMS = [
    'งบฐานะการเงิน', 'งบดุล', 'งบกำไรขาดทุน', 'งบกระแสเงินสด',
    'งบแสดงการเปลี่ยนแปลงส่วนของเจ้าของ', 'รายงานผู้สอบบัญชี',
    'รายงานของผู้สอบบัญชี', 'ผู้สอบบัญชี', 'ผู้ตรวจสอบกิจการ',
    'ร.2', 'ร2', 'RQ2', 'rq2', 'แบบ ร.2', 'วาระ', 'ข้อสังเกต',
    'รวมสินทรัพย์', 'รวมหนี้สิน', 'ทุนเรือนหุ้น'
  ];

  // ---------------------------------------------------------------------------
  // Text → Markdown
  // ---------------------------------------------------------------------------

  function cleanText(value) {
    var s = String(value == null ? '' : value);
    s = s.replace(/\r\n?/g, '\n');
    // ลบ control character ที่ไม่ใช่ newline/tab ออก (กันข้อความเพี้ยนใน Markdown)
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
    s = s.split('\n').map(function (line) {
      return line.replace(/[ \t]+/g, ' ').trim();
    }).join('\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  }

  function formatPagesAsMarkdown(pages) {
    if (!Array.isArray(pages) || !pages.length) return '';
    var blocks = [];
    pages.forEach(function (p) {
      if (!p) return;
      var text = cleanText(p.text);
      if (!text) return;
      blocks.push('## หน้า ' + (p.page == null ? '?' : p.page) + '\n\n' + text);
    });
    return blocks.join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // Page filtering
  // ---------------------------------------------------------------------------

  /** แปลง "1-12,15,20-25" → [1..12,15,20..25] (รองรับ dash แบบยาวและลูกน้ำ) */
  function parsePageRange(value, totalPages) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return null;
    var max = Math.max(1, Number(totalPages) || 1);
    var out = [];
    String(raw).split(/[,;،]/).forEach(function (part) {
      var token = String(part).trim().replace(/[–—]/g, '-');
      if (!token) return;
      var m = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        var a = Number(m[1]);
        var b = Number(m[2]);
        if (a > b) { var tmp = a; a = b; b = tmp; }
        for (var p = Math.max(1, a); p <= Math.min(max, b); p++) out.push(p);
        return;
      }
      if (/^\d+$/.test(token)) {
        var n = Number(token);
        if (n >= 1 && n <= max) out.push(n);
      }
    });
    if (!out.length) return null;
    return out.filter(function (p, i) { return out.indexOf(p) === i; })
      .sort(function (a, b) { return a - b; });
  }

  function extractYears(text) {
    var s = String(text || '');
    var years = [];
    var re = /(25\d{2}|20\d{2})/g;
    var m;
    while ((m = re.exec(s)) !== null) years.push(Number(m[1]));
    return years;
  }

  /** หน้ารายงานประชุมที่ระบุแต่ปีเก่ากว่าปีงบประมาณเป้าหมาย */
  function looksLikeOldMeetingReport(text, planYearBE) {
    var s = String(text || '');
    var hasMeeting = MEETING_REPORT_TERMS.some(function (term) {
      return s.indexOf(term) !== -1;
    });
    if (!hasMeeting) return false;
    var planYear = Number(planYearBE) || 2570;
    var years = extractYears(s);
    if (!years.length) return false;
    return years.every(function (y) { return y < planYear; });
  }

  function isRelevantPage(text) {
    var s = String(text || '');
    return RELEVANT_TERMS.some(function (term) { return s.indexOf(term) !== -1; });
  }

  /**
   * filterRelevantPages(pages, opts)
   *   pages: [{ page, text }, ...]
   *   opts:  { range, autoTrim, planYearBE, declaredTotalPages }
   *   return { pages, included, trimmed, trimmedPages, rangeApplied, totalPages }
   *
   * ลำดับ: range จำกัด "กลุ่มหน้าที่พิจารณา" ก่อน แล้วค่อย autoTrim จากท้ายกลุ่มนั้น
   * (หน้าที่ถูกตัดยังอยู่ใน trimmed พร้อม text เพื่อให้พรีวิวกดเลือกกลับได้)
   *
   * หมายเหตุ: การเลือกตาม "ความเกี่ยวข้อง" ยังคงใช้ scorePageText()/selectPages()
   * เดิมใน cpd-upload.js (มีอยู่แล้วและคุม budget) — ฟังก์ชันนี้เพิ่มเฉพาะ
   * ช่วงหน้าที่ผู้ใช้ระบุ + การตัดรายงานประชุมปีเก่าท้ายเล่ม
   */
  function filterRelevantPages(pages, opts) {
    var o = opts || {};
    var list = Array.isArray(pages) ? pages.slice() : [];
    list.sort(function (a, b) { return (a.page || 0) - (b.page || 0); });

    var total = Number(o.declaredTotalPages) ||
      (list.length ? Number(list[list.length - 1].page) : 0) || list.length;
    var range = parsePageRange(o.range, total);
    var trimmed = [];
    var kept = list.slice();

    // 1) ช่วงหน้าที่ผู้ใช้ระบุ จำกัดกลุ่มหน้าก่อน
    if (range) {
      var wanted = {};
      range.forEach(function (p) { wanted[p] = true; });
      kept = kept.filter(function (p) {
        if (wanted[p.page]) return true;
        trimmed.push({ page: p.page, reason: 'range', text: p.text });
        return false;
      });
    }

    // 2) ตัดรายงานประชุมปีเก่าจาก "ท้ายเล่ม" เท่านั้น (เจอหน้าที่ไม่ตรงเงื่อนไขก็หยุด)
    if (o.autoTrim !== false) {
      for (var i = kept.length - 1; i >= 0; i--) {
        if (!looksLikeOldMeetingReport(kept[i].text, o.planYearBE)) break;
        var removed = kept.splice(i, 1)[0];
        trimmed.push({ page: removed.page, reason: 'oldMeeting', text: removed.text });
      }
    }

    // 3) annotate ความเกี่ยวข้อง (ใช้กับพรีวิว ไม่ได้บังคับตัด) โดยไม่แก้ object ต้นฉบับ
    kept = kept.map(function (p) {
      return { page: p.page, text: p.text, relevant: isRelevantPage(p.text) };
    });

    trimmed.sort(function (a, b) { return (a.page || 0) - (b.page || 0); });
    return {
      pages: kept,
      included: kept.map(function (p) { return p.page; }),
      trimmed: trimmed,
      trimmedPages: trimmed.map(function (p) { return p.page; }),
      rangeApplied: !!range,
      totalPages: total
    };
  }

  // ---------------------------------------------------------------------------
  // JPEG rendering (PDF.js)
  // ---------------------------------------------------------------------------

  /** scale = min(cap, maxWidth / viewport.width) — ไม่ขยายเกิน scaleCap */
  function computeJpegScale(viewport, opts) {
    var o = opts || {};
    var width = Number(o.width || (viewport && viewport.width) || 0);
    var maxWidth = Number(o.maxWidth) > 0 ? Number(o.maxWidth) : JPEG_MAX_WIDTH;
    var cap = Number(o.scaleCap) > 0 ? Number(o.scaleCap) : SCALE_CAP;
    if (!width) return cap;
    var scale = maxWidth / width;
    if (!isFinite(scale) || scale <= 0) scale = cap;
    return Math.min(cap, scale);
  }

  async function renderPageToJpeg(page, opts) {
    var o = opts || {};
    if (!page || typeof page.getViewport !== 'function') {
      throw new Error('page ไม่ถูกต้องสำหรับการเรนเดอร์');
    }
    var baseViewport = page.getViewport({ scale: 1 });
    var scale = computeJpegScale(baseViewport, o);
    var viewport = page.getViewport({ scale: scale });

    var doc = o.document || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.createElement !== 'function') {
      throw new Error('document ไม่พร้อมใช้สำหรับการเรนเดอร์');
    }
    var canvas = doc.createElement('canvas');
    var width = Math.max(1, Math.ceil(viewport.width));
    var height = Math.max(1, Math.ceil(viewport.height));
    canvas.width = width;
    canvas.height = height;
    var ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) throw new Error('canvas 2d ไม่พร้อมใช้');

    if (typeof page.render === 'function') {
      var task = page.render({ canvasContext: ctx, viewport: viewport });
      if (task && typeof task.promise === 'function') await task.promise;
    }

    var quality = Number(o.quality) > 0 ? Number(o.quality) : JPEG_QUALITY;
    var dataUrl = String(canvas.toDataURL('image/jpeg', quality) || '');
    var base64 = dataUrl.split(',')[1] || '';
    return {
      base64: base64,
      mimeType: 'image/jpeg',
      width: width,
      height: height,
      scale: scale,
      approxBytes: Math.floor(base64.length * 3 / 4)
    };
  }

  // ---------------------------------------------------------------------------
  // Cache (Markdown + AI fields เท่านั้น — ห้ามเก็บ base64)
  // ---------------------------------------------------------------------------

  function sanitizeDoc(doc) {
    if (!doc || typeof doc !== 'object') return null;
    var markdown = String(doc.markdown || '').slice(0, MAX_DOC_CHARS);
    if (!markdown.trim()) return null;

    var fields = {};
    var raw = doc.fields || {};
    Object.keys(raw).slice(0, 200).forEach(function (key) {
      var v = raw[key];
      if (v == null) return;
      if (typeof v === 'object') {
        var value = v.value;
        if (typeof value === 'string') value = value.slice(0, 200);
        else if (typeof value !== 'number' && typeof value !== 'boolean') value = '';
        fields[key] = {
          value: value,
          display: String(v.display == null ? '' : v.display).slice(0, 200),
          id: String(v.id || '').slice(0, 80)
        };
      } else {
        fields[key] = {
          value: (typeof v === 'number' || typeof v === 'boolean')
            ? v : String(v).slice(0, 200)
        };
      }
    });

    return {
      name: String(doc.name || '').slice(0, 200),
      category: String(doc.category || '').slice(0, 100),
      markdown: markdown,
      fields: fields,
      // เก็บเฉพาะเลขหน้า — กัน base64/object อื่นหลุดลง localStorage
      pages: Array.isArray(doc.pages)
        ? doc.pages.map(function (p) {
            return typeof p === 'object' && p ? Number(p.page) : Number(p);
          }).filter(function (n) { return isFinite(n); }).slice(0, 200)
        : [],
      createdAt: String(doc.createdAt || '').slice(0, 40)
    };
  }

  /** เก็บล่าสุดก่อน;budget รวม ~250k ตัวอักษร, สูงสุด 3 เอกสาร */
  function cacheDocs(state, docs) {
    if (!state || !state.analysis) return [];
    var sanitized = [];
    (Array.isArray(docs) ? docs : []).forEach(function (d) {
      var s = sanitizeDoc(d);
      if (s) sanitized.push(s);
    });

    var budget = MAX_TOTAL_CACHE_CHARS;
    var kept = [];
    for (var i = sanitized.length - 1; i >= 0 && kept.length < MAX_CACHED_DOCS; i--) {
      var d = sanitized[i];
      if (d.markdown.length > budget) {
        d.markdown = d.markdown.slice(0, Math.max(0, budget));
      }
      if (!d.markdown) continue;
      kept.unshift(d);
      budget -= d.markdown.length;
      if (budget <= 0) break;
    }
    state.analysis.extractedDocs = kept;
    return kept;
  }

  function readCachedDocs(state) {
    if (!state || !state.analysis || !Array.isArray(state.analysis.extractedDocs)) return [];
    return state.analysis.extractedDocs;
  }

  function mergeCachedFields(state) {
    var merged = {};
    readCachedDocs(state).forEach(function (d) {
      Object.keys(d.fields || {}).forEach(function (k) {
        var v = d.fields[k];
        if (v && String(v.value || '') !== '') merged[k] = v;
      });
    });
    return merged;
  }

  function getDocumentField(state, key) {
    if (!key) return '';
    var v = mergeCachedFields(state)[key];
    return v ? String(v.display || v.value || '') : '';
  }

  var DOC_SIM_FIELDS = [
    { key: 'assetLatest', label: 'สินทรัพย์รวม (จากเอกสาร)' },
    { key: 'debtLatest', label: 'หนี้สินรวม (จากเอกสาร)' },
    { key: 'shareLatest', label: 'ทุนเรือนหุ้น (จากเอกสาร)' },
    { key: 'profitLatest', label: 'กำไรสุทธิ (จากเอกสาร)' }
  ];

  /** ฟิลด์สำหรับ Cross-Check สมการบัญชี (อ่านจาก cache เท่านั้น — ไม่ยิง API) */
  var CROSS_CHECK_FIELDS = [
    { key: 'assetLatest', id: 'asset_latest', label: 'สินทรัพย์' },
    { key: 'debtLatest', id: 'debt_latest', label: 'หนี้สิน' },
    { key: 'shareLatest', id: 'share_latest', label: 'ทุนเรือนหุ้น' },
    { key: 'reserveLatest', id: 'reserve_latest', label: 'ทุนสำรอง' },
    { key: 'accumfundLatest', id: 'accumfund_latest', label: 'ทุนสะสมอื่น' },
    { key: 'profitLatest', id: 'profit_latest', label: 'กำไรสุทธิ' },
    { key: 'lossLatest', id: 'loss_latest', label: 'ขาดทุนสะสม' }
  ];

  function toCacheNumber(value) {
    var s = String(value == null ? '' : value).trim();
    var negative = /^\(.*\)$/.test(s);
    var n = Number(s.replace(/[(),]/g, '').replace(/บาท/g, '').trim());
    if (!isFinite(n)) return null;
    return negative ? -Math.abs(n) : n;
  }

  /**
   * getDocumentCrossCheck(state)
   *   คืนค่าที่ใช้ตรวจสมการบัญชีจาก cache ที่ AI สกัดไว้แล้ว
   *   ไม่มีการอ่านไฟล์/ยิง API ซ้ำ — เรียกได้หลายครั้งหลังอัปโหลด
   */
  function getDocumentCrossCheck(state) {
    var fields = mergeCachedFields(state);
    var values = {};
    var labels = [];
    CROSS_CHECK_FIELDS.forEach(function (f) {
      var v = fields[f.key];
      if (!v) return;
      var display = String(v.display || v.value || '').trim();
      var n = toCacheNumber(v.value);
      if (n === null) n = toCacheNumber(display);
      if (n === null && !display) return;
      values[f.id] = { key: f.key, label: f.label, display: display, number: n };
      if (display) labels.push(f.label + ': ' + display);
    });
    var asset = values.asset_latest ? values.asset_latest.number : null;
    var equity = ['debt_latest', 'share_latest', 'reserve_latest', 'accumfund_latest', 'profit_latest', 'loss_latest']
      .reduce(function (sum, id) {
        var v = values[id];
        if (!v || v.number === null) return sum;
        return sum + (id === 'loss_latest' ? -Math.abs(v.number) : v.number);
      }, 0);
    var hasBalance = asset !== null && Object.keys(values).length >= 4;
    return {
      source: 'cache',
      hasData: Object.keys(values).length > 0,
      values: values,
      lines: labels,
      asset: asset,
      liabilitiesAndEquity: equity,
      difference: hasBalance ? asset - equity : null
    };
  }

  /** ผลจำลองจากเอกสาร — ใช้ก่อน c.simResult เสมอ แต่ไม่ลบ easyWins ของ master */
  function getDocumentSimResult(state) {
    var fields = mergeCachedFields(state);
    var lines = [];
    var highlights = {};
    DOC_SIM_FIELDS.forEach(function (f) {
      var v = fields[f.key];
      if (!v) return;
      var display = String(v.display || v.value || '').trim();
      if (!display) return;
      lines.push(f.label + ': ' + display);
      highlights[f.key] = display;
    });
    var docs = readCachedDocs(state);
    if (docs.length) {
      lines.push('แหล่งข้อมูล: เอกสารที่อัปโหลด (' + (docs[docs.length - 1].name || 'ไม่ระบุชื่อ') + ')');
    }
    return {
      source: 'document',
      hasData: lines.length > 0,
      gapSummaryLines: lines,
      easyWins: [],
      financialHighlights: highlights
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  global.CPD_PDF_PIPELINE = {
    MAX_DOC_CHARS: MAX_DOC_CHARS,
    MAX_TOTAL_CACHE_CHARS: MAX_TOTAL_CACHE_CHARS,
    MAX_CACHED_DOCS: MAX_CACHED_DOCS,
    JPEG_MAX_WIDTH: JPEG_MAX_WIDTH,
    JPEG_QUALITY: JPEG_QUALITY,
    cleanText: cleanText,
    formatPagesAsMarkdown: formatPagesAsMarkdown,
    parsePageRange: parsePageRange,
    looksLikeOldMeetingReport: looksLikeOldMeetingReport,
    isRelevantPage: isRelevantPage,
    filterRelevantPages: filterRelevantPages,
    computeJpegScale: computeJpegScale,
    renderPageToJpeg: renderPageToJpeg,
    sanitizeDoc: sanitizeDoc,
    cacheDocs: cacheDocs,
    readCachedDocs: readCachedDocs,
    mergeCachedFields: mergeCachedFields,
    getDocumentField: getDocumentField,
    getDocumentSimResult: getDocumentSimResult,
    getDocumentCrossCheck: getDocumentCrossCheck
  };
})(typeof window !== 'undefined' ? window : globalThis);

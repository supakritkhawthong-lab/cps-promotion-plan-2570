/**
 * cpd-ui.js - UI for 3 pages:
 *   1) Chonburi province dashboard
 *   2) Document/report registry (CPD_REPORT_REGISTRY + MIS)
 *   3) Cooperative and farmer-group strength (4 dimensions, 18 indicators)
 * Works with cpd-state.js (window.CPD_STATE / window.CPD_AppState)
 */
(function (global) {
  'use strict';

  var S = global.CPD_STATE;
  var UI = {};
  var dashboardData = null;
  var dashboardError = '';
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function A() { return global.CPD_AppState; }
  function h(v) { return S.escapeHtml(v); }
  function money(v, dec) { return S.fmt(v, dec === undefined ? 2 : dec); }
  function int(v) { return S.fmtInt(v); }

  function out(key, cls) {
    return '<span data-out="' + key + '"' + (cls ? ' class="' + cls + '"' : '') + '>0.00</span>';
  }

  function options(list, selected, placeholder) {
    var html = placeholder ? '<option value="">' + h(placeholder) + '</option>' : '';
    list.forEach(function (v) {
      var label = typeof v === 'object' ? v.label : v;
      var value = typeof v === 'object' ? v.value : v;
      html += '<option value="' + h(value) + '"' +
        (String(value) === String(selected || '') ? ' selected' : '') + '>' + h(label) + '</option>';
    });
    return html;
  }

  // =========================================================================
  // INIT + TAB SWITCHING
  // =========================================================================

  var VALID_TABS = ['dashboard', 'registry', 'strength'];

  function switchTab(name, silent) {
    if (VALID_TABS.indexOf(name) === -1) name = 'dashboard';
    document.querySelectorAll('.cpd-tab-pane').forEach(function (pane) {
      pane.classList.toggle('active', pane.id === 'tab-' + name);
    });
    document.querySelectorAll('[data-action="switch-tab"]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    fillBoundFields();
    updateOutputs();
    if (name === 'dashboard') loadDashboard();
    if (name === 'registry') {
      renderReportRegistry();
      renderMisReports();
    }
    if (name === 'strength') renderStrengthRows();
    if (!silent) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }
  }

  UI.init = function () {
    buildDashboardPage();
    buildRegistryPage();
    buildStrengthPage();
    bindGlobalEvents();
    switchTab('dashboard', true);
    renderStrengthRows();
    updateOutputs();
    UI.renderAll();
  };

  UI.renderAll = function () {
    fillBoundFields();
    renderStrengthRows();
    updateOutputs();
  };

  UI.onStateSynced = function () {
    fillBoundFields();
    updateOutputs();
  };

  // =========================================================================
  // PAGE BUILDERS
  // =========================================================================

  function buildDashboardPage() {
    var root = $('tab-dashboard');
    if (!root) return;
    root.innerHTML = '' +
      '<div class="cpd-page-head"><div>' +
      '  <h4 class="mb-1">📊 Dashboard สรุปภาพรวมระดับจังหวัดชลบุรี</h4>' +
      '  <div class="text-muted small" id="cpd5Status">พร้อมแสดงข้อมูลเมื่อเปิดแท็บ</div>' +
      '</div><div class="no-print d-flex gap-2 flex-wrap">' +
      '  <button type="button" class="btn btn-sm btn-outline-success" data-action="refresh-dashboard">🔄 รีเฟรช</button>' +
      '  <button type="button" class="btn btn-sm btn-outline-primary" data-action="export-csv">⬇️ ส่งออก CSV</button>' +
      '  <button type="button" class="btn btn-sm btn-outline-primary" data-action="export-xls">⬇️ ส่งออก Excel</button>' +
      '</div></div>' +

      '<div class="card shadow-sm mb-3 no-print"><div class="card-header py-2">ตัวกรองข้อมูล</div>' +
      '  <div class="card-body py-3"><div class="row g-2">' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ปีงบประมาณ</label><select class="form-select form-select-sm" id="cpd5FilterYear"><option value="2570">2570</option></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">อำเภอ</label><select class="form-select form-select-sm" id="cpd5FilterDistrict"></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ประเภทสหกรณ์/กลุ่มเกษตรกร</label><select class="form-select form-select-sm" id="cpd5FilterType"></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ผู้ดูแลหลัก</label><select class="form-select form-select-sm" id="cpd5FilterOfficer"></select></div>' +
      '  </div></div>' +
      '</div>' +

      '<div id="cpd5Kpis" class="row g-3 mb-3"></div>' +

      '<div class="card shadow-sm mb-3 border-danger"><div class="card-header py-2 text-danger fw-bold">🚨 โซนสัญญาณเตือนภัยล่วงหน้า (Early Warning Signals — ก่อนปิดปีบัญชี)</div>' +
      '  <div class="card-body py-3" id="cpd5EarlyWarning"></div>' +
      '</div>' +

      '<div class="row g-3 mb-3">' +
      '  <div class="col-12"><div class="card shadow-sm h-100"><div class="card-header py-2">สัดส่วนชั้นความเข้มแข็ง ปี 68 vs 69</div>' +
      '    <div class="card-body py-3" id="cpd5ClassChart"></div></div></div>' +
      '</div>' +

      '<div class="row g-3 mb-3">' +
      '  <div class="col-lg-6"><div class="card shadow-sm h-100"><div class="card-header py-2">คะแนนเฉลี่ย 4 มิติของทั้งจังหวัด</div>' +
      '    <div class="card-body py-3" id="cpd5DimChart"></div></div></div>' +
      '  <div class="col-lg-6"><div class="card shadow-sm h-100"><div class="card-header py-2">สรุปภาพรวม</div>' +
      '    <div class="card-body py-3" id="cpd5Summary"></div></div></div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '  <span>ทะเบียนคุมแผนและแจ้งเตือนกำหนดการปิดบัญชี 30 วัน / ประชุมใหญ่ 150 วัน</span>' +
      '  <div class="d-flex align-items-center gap-2">' +
      '    <label class="form-check-label small fw-bold"><input type="checkbox" id="cpd5FilterUpcoming" class="form-check-input me-1"> เฉพาะที่กำลังจะถึงกำหนด (≤30 วัน)</label>' +
      '    <span class="badge bg-light text-dark" id="cpd5RowCount">0 รายการ</span>' +
      '  </div></div>' +
      '  <div class="card-body py-2 table-responsive">' +
      '    <table class="table table-bordered table-hover table-sm align-middle mb-0" style="font-size:0.78rem;">' +
      '      <thead class="table-light text-center"><tr>' +
      '        <th>#</th><th style="min-width:180px">สหกรณ์/กลุ่มเกษตรกร</th><th>อำเภอ</th><th>เขตส่งเสริม</th><th>ผู้ดูแลหลัก</th>' +
      '        <th>วันสิ้นปีบัญชี</th><th>กำหนดปิดบัญชี 30 วัน</th><th>กำหนดประชุมใหญ่ 150 วัน</th>' +
      '        <th>ชั้น 69</th><th>สถานะแผน</th><th>ผลรายเดือน</th>' +
      '      </tr></thead><tbody id="cpd5Rows"></tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>';
  }

  function buildRegistryPage() {
    var root = $('tab-registry');
    if (!root) return;
    root.innerHTML = '' +
      '<div class="cpd-page-head"><div>' +
      '  <h4 class="mb-1">📁 ทะเบียนคุมเอกสาร/รายงาน</h4>' +
      '  <div class="text-muted small">เอกสารที่สหกรณ์/กลุ่มเกษตรกรและเจ้าหน้าที่ต้องจัดส่ง (Cooperative &amp; Officer Document Tracking)</div>' +
      '</div></div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '  <span>📁 ทะเบียนคุมเอกสาร/รายงาน (Cooperative &amp; Officer Document Tracking)</span>' +
      '  <span class="badge bg-light text-dark" id="cpd5ReportCount">0 รายการ</span></div>' +
      '  <div class="card-body py-3 no-print"><div class="row g-2">' +
      '    <div class="col-md-4"><label class="form-label small fw-bold mb-1">ประเภทสถาบัน/ผู้มีหน้าที่จัดส่ง</label><select class="form-select form-select-sm" id="cpd5ReportTarget"></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ความถี่/รอบการส่ง</label><select class="form-select form-select-sm" id="cpd5ReportFrequency"></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">กลุ่มงาน</label><select class="form-select form-select-sm" id="cpd5ReportSection"></select></div>' +
      '    <div class="col-md-2 d-flex align-items-end"><button type="button" class="btn btn-sm btn-outline-secondary w-100" data-action="reset-report-filters">ล้างตัวกรอง</button></div>' +
      '  </div></div>' +
      '  <div class="card-body py-2 table-responsive">' +
      '    <table class="table table-bordered table-hover table-sm align-middle mb-0" style="font-size:0.78rem;">' +
      '      <thead class="table-light text-center"><tr>' +
      '        <th>#</th><th style="min-width:220px">ชื่อรายงาน (แบบสั้น)</th><th style="min-width:180px">ผู้มีหน้าที่จัดส่ง</th><th>ข้อมูล ณ วันที่</th><th style="min-width:180px">กำหนดส่ง</th><th>ความถี่</th><th>กลุ่มงาน</th><th>ลิงก์</th>' +
      '      </tr></thead><tbody id="cpd5ReportRows"></tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3 border-primary"><div class="card-header py-2 d-flex justify-content-between align-items-center bg-primary bg-opacity-10">' +
      '  <span class="fw-bold text-primary">📊 ติดตามรายงานระบบ MIS กรมส่งเสริมสหกรณ์ (ปีงบประมาณ 2570)</span>' +
      '  <span class="badge bg-primary" id="cpd5MisCount">0 สหกรณ์</span></div>' +
      '  <div class="card-body py-3 no-print"><div class="row g-2">' +
      '    <div class="col-md-6"><label class="form-label small fw-bold mb-1">🔍 ค้นหาชื่อสหกรณ์</label><input type="text" class="form-control form-control-sm" id="cpd5MisSearch" placeholder="พิมพ์ชื่อสหกรณ์..."></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">เดือน</label><select class="form-select form-select-sm" id="cpd5MisMonth"><option value="">ทุกเดือน</option></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ประเภทสหกรณ์</label><select class="form-select form-select-sm" id="cpd5MisType"><option value="">ทุกประเภท</option></select></div>' +
      '  </div></div>' +
      '  <div class="card-body py-2 table-responsive">' +
      '    <table class="table table-bordered table-hover table-sm align-middle mb-0" style="font-size:0.75rem;">' +
      '      <thead class="table-light text-center"><tr>' +
      '        <th rowspan="2" style="min-width:200px;vertical-align:middle">ชื่อสหกรณ์</th>' +
      '        <th rowspan="2" style="min-width:120px;vertical-align:middle">ประเภท</th>' +
      '        <th colspan="12" class="text-center">เดือน (จำนวนรายงานที่ต้องส่ง)</th>' +
      '      </tr><tr>' +
      '        <th>ม.ค.</th><th>ก.พ.</th><th>มี.ค.</th><th>เม.ย.</th><th>พ.ค.</th><th>มิ.ย.</th>' +
      '        <th>ก.ค.</th><th>ส.ค.</th><th>ก.ย.</th><th>ต.ค.</th><th>พ.ย.</th><th>ธ.ค.</th>' +
      '      </tr></thead><tbody id="cpd5MisRows"></tbody>' +
      '    </table>' +
      '  </div>' +
      '  <div class="card-footer bg-light small">' +
      '    <div class="fw-bold mb-1">📋 รายงานในระบบ MIS (34 รายการ):</div>' +
      '    <div class="text-muted" style="font-size:0.72rem;" id="cpd5MisReportList"></div>' +
      '  </div>' +
      '</div>';
  }

  function buildStrengthPage() {
    var root = $('tab-strength');
    if (!root) return;
    root.innerHTML = '' +
      '<div class="cpd-page-head"><div>' +
      '  <h4 class="mb-1">💪 ความเข้มแข็งของสหกรณ์และกลุ่มเกษตรกร</h4>' +
      '  <div class="text-muted small" id="cpd3StrengthLine">ผลการประเมิน 4 มิติ 18 ตัวชี้วัด (ย้อนหลัง 3 ปี)</div>' +
      '</div></div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">ผลประเมินความเข้มแข็ง 4 มิติ 18 ตัวชี้วัด (ย้อนหลัง 3 ปี)</div>' +
      '  <div class="card-body py-2 table-responsive">' +
      '    <table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.82rem;">' +
      '      <thead class="table-light text-center"><tr><th style="width:52%">มิติ / ตัวชี้วัด</th><th>น้ำหนัก</th><th style="width:11%">ปี 2567</th><th style="width:11%">ปี 2568</th><th style="width:11%">ปี 2569</th></tr></thead>' +
      '      <tbody id="cpd2StrengthBody"></tbody>' +
      '      <tfoot class="table-success">' +
      '        <tr><th colspan="2" class="text-end">รวมคะแนน</th>' +
      '          <th class="text-center">' + out('st.total.2567') + '</th>' +
      '          <th class="text-center">' + out('st.total.2568') + '</th>' +
      '          <th class="text-center">' + out('st.total.2569') + '</th></tr>' +
      '        <tr><th colspan="2" class="text-end">ชั้นความเข้มแข็ง</th>' +
      '          <th class="text-center">' + out('st.class.2567') + '</th>' +
      '          <th class="text-center">' + out('st.class.2568') + '</th>' +
      '          <th class="text-center">' + out('st.class.2569') + '</th></tr>' +
      '      </tfoot>' +
      '    </table>' +
      '    <div class="form-text mt-2">💡 คะแนนจากผลประเมินจริง (ผลปี 2569 จากข้อมูลหลักของสำนักงานสหกรณ์จังหวัดชลบุรี) แก้ไขได้ในช่องตัวชี้วัด</div>' +
      '  </div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">ข้อมูลสหกรณ์/กลุ่มเกษตรกรที่แสดง</div>' +
      '  <div class="card-body py-2"><div id="cpd3CoopLine" class="fw-bold">ยังไม่ได้เลือกสหกรณ์</div>' +
      '  <div class="small text-muted mt-1">ข้อมูลความเข้มแข็งแสดงตามรายการใน Dashboard (ผลปี 2568/2569)</div></div>' +
      '</div>';
  }

  // =========================================================================
  // STRENGTH helpers
  // =========================================================================

  function indicatorsFromScore69(score69) {
    var sub = score69 && score69.subScores;
    if (!sub) return null;
    var out = {};
    var any = false;
    S.STRENGTH_INDICATORS.forEach(function (ind) {
      var key = 's' + ind.id.replace('.', '_');
      if (!Object.prototype.hasOwnProperty.call(sub, key)) return;
      var v = S.num(sub[key]);
      out[ind.id] = v;
      if (v > 0) any = true;
    });
    return any ? out : null;
  }

  function strength69Payload(score69) {
    if (!score69) return null;
    return {
      level: score69.level,
      total: score69.total,
      d1: score69.d1,
      d2: score69.d2,
      d3: score69.d3,
      d4: score69.d4,
      indicators: indicatorsFromScore69(score69)
    };
  }

  function applyStrength69Indicators(indicators) {
    if (!indicators) return false;
    var st = A().strength;
    Object.keys(indicators).forEach(function (id) {
      if (!st.indicators[id]) st.indicators[id] = {};
      st.indicators[id]['2569'] = S.num(indicators[id]);
      delete st.indicators[id]._autoDistributed;
    });
    return true;
  }

  function applyStrength69Fallback(src) {
    if (!src) return false;
    var st = A().strength;
    var has69 = S.num(st.totalByYear['2569']) > 0 ||
      S.num(st.dim1ByYear['2569']) > 0 || S.num(st.dim2ByYear['2569']) > 0 ||
      S.num(st.dim3ByYear['2569']) > 0 || S.num(st.dim4ByYear['2569']) > 0;
    var hasUser69 = S.STRENGTH_INDICATORS.some(function (ind) {
      var d = st.indicators[ind.id] || {};
      return S.num(d['2569']) > 0 && !d._autoDistributed;
    });
    var canFillIndicators = !!src.indicators && !S.STRENGTH_INDICATORS.some(function (ind) {
      if (!Object.prototype.hasOwnProperty.call(src.indicators, ind.id)) return false;
      var d = st.indicators[ind.id] || {};
      return S.num(d['2569']) > 0 && !d._autoDistributed;
    });
    if (has69 || hasUser69) {
      if (!canFillIndicators) return false;
      if (!st.classByYear['2569'] && src.level) st.classByYear['2569'] = src.level;
      applyStrength69Indicators(src.indicators);
      if (typeof S.recalcStrength === 'function') S.recalcStrength();
      return true;
    }
    var level = src.level || '';
    var total = S.num(src.total);
    var d1 = S.num(src.d1), d2 = S.num(src.d2), d3 = S.num(src.d3), d4 = S.num(src.d4);
    if (!total && !(d1 || d2 || d3 || d4)) return false;
    st.classByYear['2569'] = level;
    st.totalByYear['2569'] = total;
    st.dim1ByYear['2569'] = d1;
    st.dim2ByYear['2569'] = d2;
    st.dim3ByYear['2569'] = d3;
    st.dim4ByYear['2569'] = d4;
    applyStrength69Indicators(src.indicators);
    if (typeof S.recalcStrength === 'function') S.recalcStrength();
    return true;
  }

  function renderStrengthRows() {
    var body = $('cpd2StrengthBody');
    if (!body) return;
    var dims = [
      { n: 1, title: 'มิติที่ 1 ความสามารถในการให้บริการสมาชิก', max: 30 },
      { n: 2, title: 'มิติที่ 2 ประสิทธิภาพในการดำเนินธุรกิจ', max: 20 },
      { n: 3, title: 'มิติที่ 3 ประสิทธิภาพในการจัดการองค์กร', max: 20 },
      { n: 4, title: 'มิติที่ 4 ประสิทธิภาพของการบริหารงาน', max: 30 }
    ];
    var html = '';
    dims.forEach(function (d) {
      html += '<tr class="table-secondary"><td colspan="2" class="fw-bold">' + h(d.title) + ' (' + d.max + ' คะแนน)</td>' +
        S.YEARS.map(function (y) { return '<td class="text-center fw-bold" data-out="st.dim' + d.n + '.' + y + '">0</td>'; }).join('') +
        '</tr>';
      S.STRENGTH_INDICATORS.filter(function (ind) { return ind.dim === d.n; }).forEach(function (ind) {
        html += '<tr><td><span class="badge bg-success me-1">' + h(ind.id) + '</span>' + h(ind.name) + '</td>' +
          '<td class="text-center">' + ind.weight + '</td>' +
          S.YEARS.map(function (y) {
            return '<td><input type="text" class="form-control form-control-sm text-center" data-indicator="' + ind.id + '" data-year="' + y + '" data-num="1"></td>';
          }).join('') +
          '</tr>';
      });
    });
    body.innerHTML = html;
    fillBoundFields();
    updateOutputs();
    renderStrengthCoopLine();
  }

  function renderStrengthCoopLine() {
    var line = $('cpd3CoopLine');
    if (!line) return;
    var c = A().coopProfile || {};
    line.textContent = (c.coopName || 'ยังไม่ได้เลือกสหกรณ์') +
      ' | ' + (c.district || '-') + ' | ' + (c.promotionZone || '-') +
      ' | ผู้ดูแลหลัก: ' + (c.primaryOfficer || '-');
  }

  function fillBoundFields() {
    var state = A();
    document.querySelectorAll('[data-indicator]').forEach(function (el) {
      var ind = state.strength.indicators[el.dataset.indicator] || {};
      var v = ind[el.dataset.year];
      el.value = S.num(v) === 0 ? '' : v;
    });
  }

  function updateOutputs() {
    var st = A().strength;
    var map = {};
    S.YEARS.forEach(function (y) {
      map['st.dim1.' + y] = S.fmt(st.dim1ByYear[y], 2);
      map['st.dim2.' + y] = S.fmt(st.dim2ByYear[y], 2);
      map['st.dim3.' + y] = S.fmt(st.dim3ByYear[y], 2);
      map['st.dim4.' + y] = S.fmt(st.dim4ByYear[y], 2);
      map['st.total.' + y] = S.fmt(st.totalByYear[y], 2);
      map['st.class.' + y] = st.classByYear[y] || '-';
    });
    document.querySelectorAll('[data-out]').forEach(function (el) {
      var key = el.getAttribute('data-out');
      if (map[key] !== undefined) el.textContent = map[key];
    });
    renderStrengthCoopLine();
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  function readDashboardFilters() {
    return {
      fiscalYear: ($('cpd5FilterYear') && $('cpd5FilterYear').value) || '2570',
      district: ($('cpd5FilterDistrict') && $('cpd5FilterDistrict').value) || '',
      coopType: ($('cpd5FilterType') && $('cpd5FilterType').value) || '',
      primaryOfficer: ($('cpd5FilterOfficer') && $('cpd5FilterOfficer').value) || ''
    };
  }

  function loadDashboard(force) {
    if (!force && dashboardData) {
      renderDashboard();
      return;
    }
    var status = $('cpd5Status');
    if (status) status.textContent = 'กำลังโหลดข้อมูลจาก Google Sheets...';
    var filters = readDashboardFilters();
    try {
      global.google.script.run.withSuccessHandler(function (res) {
        dashboardData = res || null;
        dashboardError = '';
        populateDashboardFilters(res && res.filterOptions);
        renderDashboard();
      }).withFailureHandler(function (err) {
        dashboardError = err && err.message ? err.message : String(err);
        dashboardData = fallbackDashboard(filters);
        populateDashboardFilters(dashboardData.filterOptions);
        renderDashboard();
      }).getDashboardSummaryData(filters);
    } catch (e) {
      dashboardError = e && e.message ? e.message : String(e);
      dashboardData = fallbackDashboard(filters);
      populateDashboardFilters(dashboardData.filterOptions);
      renderDashboard();
    }
  }

  function fallbackDashboard(filters) {
    var master = (global.masterCoops || []).slice();
    var current = A();
    var currentName = current.coopProfile.coopName;
    var currentPlanned = !!currentName && (!!current.meta.updatedAt ||
      (current.scheduleAndActivities.monthlyPlan12Months || []).some(function (m) {
        return m.statusColor && m.statusColor !== 'white';
      }));
    var optionSets = { district: {}, coopType: {}, primaryOfficer: {} };
    master.forEach(function (c) {
      if (c.district) optionSets.district[c.district] = true;
      if (c.coopType) optionSets.coopType[c.coopType] = true;
      if (c.mainOfficer) optionSets.primaryOfficer[c.mainOfficer] = true;
    });
    var rows = master.map(function (c) {
      var isCurrent = currentName && c.name === currentName;
      var hasPlan = isCurrent && currentPlanned;
      var cls68 = ((c.score68 && c.score68.level) || '').replace(/ชั้น\s*/, 'ชั้น ');
      var cls69 = ((c.score69 && c.score69.level) || '').replace(/ชั้น\s*/, 'ชั้น ');
      var sum = current.financials.summary2Years;
      var st = current.strength;
      return {
        fiscalYear: '2570', coopId: c.code13 || '', coopName: c.name,
        district: c.district || '', promotionZone: c.zone || '', coopSubType: c.coopType || '',
        primaryOfficer: c.mainOfficer || '',
        fiscalEndDate: hasPlan ? current.coopProfile.fiscalEndDate : formatThaiDate(c.fiscalYear),
        targetClose30d: hasPlan ? current.scheduleAndActivities.targetCloseAccountDate30Days : formatThaiDate(c.fiscalYear),
        targetAgm150d: hasPlan ? current.scheduleAndActivities.targetAgm150Days : '',
        assetsLatest: hasPlan ? S.num(sum.assetsLatest) : 0,
        businessVolLatest: hasPlan ? S.num(sum.businessVolumeLatest) : 0,
        class68: cls68, class69: cls69,
        strengthScorePrev: S.num(c.score68 && c.score68.total),
        strengthScoreLatest: S.num(c.score69 && c.score69.total),
        dim1: S.num(c.score69 && c.score69.d1), dim2: S.num(c.score69 && c.score69.d2),
        dim3: S.num(c.score69 && c.score69.d3), dim4: S.num(c.score69 && c.score69.d4),
        approvalStatus: hasPlan ? (current.meta.approvalStatus || 'ร่าง') : '',
        monthlyProgress: hasPlan ? (current.scheduleAndActivities.monthlyPlan12Months || []).filter(function (m) {
          return m.statusColor && m.statusColor !== 'white';
        }).length / 12 * 100 : 0,
        canCloseAccount: hasPlan ? current.closingReport.canCloseAccount : '',
        closeTimeframe: hasPlan ? current.closingReport.closeAccountTimeframe : '',
        canHoldAgm: hasPlan ? current.closingReport.canHoldAgm : '',
        agmTimeframe: hasPlan ? current.closingReport.agmTimeframe : '',
        hasPlan: hasPlan
      };
    });
    var filtered = rows.filter(function (r) {
      return matchFilter(r.district, filters.district) &&
        matchCoopType(r.coopSubType, r.coopName, filters.coopType) &&
        matchFilter(r.primaryOfficer, filters.primaryOfficer);
    });
    var agg = aggregateClientRows(filtered);
    return {
      generatedAt: 'แสดงผลจากข้อมูลในเบราว์เซอร์ (ยังเชื่อมต่อฐานข้อมูลไม่ได้)',
      filters: filters,
      filterOptions: {
        fiscalYears: ['2570'],
        districts: Object.keys(optionSets.district).sort(),
        coopTypes: Object.keys(optionSets.coopType).sort(),
        primaryOfficers: Object.keys(optionSets.primaryOfficer).sort()
      },
      kpis: agg.kpis, zones: agg.zones,
      classDistribution: agg.classDistribution, dimAverages: agg.dimAverages,
      rows: filtered
    };
  }

  function matchFilter(value, filter) {
    if (!filter) return true;
    var cleanValue = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var cleanFilter = String(filter || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return cleanValue === cleanFilter;
  }

  function matchCoopType(coopSubType, coopName, filter) {
    if (!filter) return true;
    var cleanType = String(coopSubType || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var cleanName = String(coopName || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var cleanFilter = String(filter || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (cleanType === cleanFilter || cleanType.indexOf(cleanFilter) !== -1) return true;
    if (cleanName.indexOf(cleanFilter) !== -1) return true;
    return false;
  }

  function daysUntil(target, today) {
    if (!target) return null;
    var d;
    if (target instanceof Date) {
      d = target;
    } else {
      var s = String(target).trim();
      var m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (!m) return null;
      d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  }

  function formatThaiDate(value) {
    if (!value) return '';
    if (typeof value === 'string' && value.indexOf('/') !== -1 && value.length <= 10) return value;
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    var day = ('0' + d.getDate()).slice(-2);
    var month = ('0' + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear() + 543;
    return day + '/' + month + '/' + year;
  }

  function classBucket(value) {
    var m = String(value || '').match(/(\d)/);
    return m ? 'class' + m[1] : '';
  }

  function aggregateClientRows(rows) {
    var total = rows.length;
    var planned = 0, approved = 0, closed30 = 0, agm150 = 0, reported = 0;
    var totalBusinessVolume = 0, totalAssets = 0;
    var classDistribution = { y2568: { class1: 0, class2: 0, class3: 0 }, y2569: { class1: 0, class2: 0, class3: 0 } };
    rows.forEach(function (r) {
      if (r.hasPlan) planned++;
      if (r.approvalStatus === 'อนุมัติแล้ว') approved++;
      if (r.canCloseAccount === 'ได้' && String(r.closeTimeframe).indexOf('30') !== -1) closed30++;
      if (r.canHoldAgm === 'ได้' && String(r.agmTimeframe).indexOf('150') !== -1) agm150++;
      if (S.num(r.monthlyProgress) > 0) reported++;
      totalBusinessVolume += S.num(r.businessVolLatest);
      totalAssets += S.num(r.assetsLatest);
      var b68 = classBucket(r.class68), b69 = classBucket(r.class69);
      if (b68) classDistribution.y2568[b68]++;
      if (b69) classDistribution.y2569[b69]++;
    });
    function pct(part, all) { return all ? Math.round((part / all) * 1000) / 10 : 0; }
    var dimAverages = [
      { key: 'dim1', label: 'มิติที่ 1', average: avg(rows, 'dim1') },
      { key: 'dim2', label: 'มิติที่ 2', average: avg(rows, 'dim2') },
      { key: 'dim3', label: 'มิติที่ 3', average: avg(rows, 'dim3') },
      { key: 'dim4', label: 'มิติที่ 4', average: avg(rows, 'dim4') }
    ];
    return {
      kpis: {
        totalCoops: total, planned: planned, plannedPct: pct(planned, total),
        approved: approved, approvedPct: pct(approved, total),
        closed30: closed30, closed30Pct: pct(closed30, total),
        agm150: agm150, agm150Pct: pct(agm150, total),
        monthlyReported: reported, monthlyReportedPct: pct(reported, total),
        totalBusinessVolume: totalBusinessVolume, totalAssets: totalAssets
      },
      zones: [], classDistribution: classDistribution, dimAverages: dimAverages
    };
  }

  function avg(rows, key) {
    var vals = rows.map(function (r) { return S.num(r[key]); }).filter(function (v) { return v > 0; });
    if (!vals.length) return 0;
    return Math.round((vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) * 100) / 100;
  }

  function populateDashboardFilters(opts) {
    if (!opts) return;
    function setOptions(id, list) {
      var el = $(id);
      if (!el) return;
      var cur = el.value;
      el.innerHTML = options(list || [], cur, 'ทั้งหมด');
      if (cur) el.value = cur;
    }
    setOptions('cpd5FilterDistrict', opts.districts);
    setOptions('cpd5FilterType', opts.coopTypes);
    setOptions('cpd5FilterOfficer', opts.primaryOfficers);
  }

  function badgeForPlan(status) {
    if (status === 'อนุมัติแล้ว') return '<span class="badge bg-success">อนุมัติแล้ว</span>';
    if (status === 'รออนุมัติ') return '<span class="badge bg-warning text-dark">รออนุมัติ</span>';
    if (status === 'ร่าง') return '<span class="badge bg-secondary">ร่าง</span>';
    return '<span class="badge bg-light text-dark">ยังไม่มีแผน</span>';
  }

  function classBadge(cls) {
    if (!cls) return '<span class="text-muted">-</span>';
    var n = (String(cls).match(/\d/) || [])[0] || '';
    var color = n === '1' ? 'bg-success' : (n === '2' ? 'bg-warning text-dark' : 'bg-danger');
    return '<span class="badge ' + color + '">' + h(cls) + '</span>';
  }

  function renderDashboard() {
    var data = dashboardData;
    var status = $('cpd5Status');
    if (!data) {
      if (status) status.textContent = 'ยังไม่มีข้อมูล';
      return;
    }
    if (status) {
      status.innerHTML = 'ข้อมูล ณ ' + h(data.generatedAt || '-') +
        (dashboardError ? ' <span class="badge bg-warning text-dark">ใช้ข้อมูลสำรอง: ' + h(dashboardError) + '</span>' : ' <span class="badge bg-success">เชื่อมต่อฐานข้อมูลแล้ว</span>');
    }
    var k = data.kpis || {};
    var kpis = [
      { label: 'สหกรณ์เป้าหมายทั้งหมด', value: int(k.totalCoops) + ' แห่ง', sub: 'จังหวัดชลบุรี', cls: 'primary' },
      { label: 'จัดทำแผนแล้ว', value: int(k.planned) + ' แห่ง', sub: (k.plannedPct || 0) + '%', cls: 'success' },
      { label: 'อนุมัติแผนแล้ว', value: int(k.approved) + ' แห่ง', sub: (k.approvedPct || 0) + '%', cls: 'info' },
      { label: 'ปิดบัญชีภายใน 30 วันสำเร็จ', value: int(k.closed30) + ' แห่ง', sub: (k.closed30Pct || 0) + '%', cls: 'warning' },
      { label: 'ประชุมใหญ่ภายใน 150 วันสำเร็จ', value: int(k.agm150) + ' แห่ง', sub: (k.agm150Pct || 0) + '%', cls: 'secondary' },
      { label: 'ปริมาณธุรกิจรวม / สินทรัพย์รวม', value: money(k.totalBusinessVolume, 0), sub: 'สินทรัพย์ ' + money(k.totalAssets, 0) + ' บาท', cls: 'dark' }
    ];
    var kpiBox = $('cpd5Kpis');
    if (kpiBox) {
      kpiBox.innerHTML = kpis.map(function (card) {
        return '<div class="col-md-4 col-xl-2"><div class="cpd-kpi border-' + card.cls + '">' +
          '<div class="cpd-kpi-label">' + h(card.label) + '</div>' +
          '<div class="cpd-kpi-value text-' + card.cls + '">' + h(card.value) + '</div>' +
          '<div class="cpd-kpi-sub">' + h(card.sub) + '</div></div></div>';
      }).join('');
    }
    renderEarlyWarning(data);
    var cls = data.classDistribution || { y2568: {}, y2569: {} };
    var maxClass = Math.max(1, cls.y2568.class1 || 0, cls.y2568.class2 || 0, cls.y2568.class3 || 0,
      cls.y2569.class1 || 0, cls.y2569.class2 || 0, cls.y2569.class3 || 0);
    var classBox = $('cpd5ClassChart');
    if (classBox) {
      classBox.innerHTML = [1, 2, 3].map(function (n) {
        var a = S.num((cls.y2568 || {})['class' + n]);
        var b = S.num((cls.y2569 || {})['class' + n]);
        return '<div class="cpd-chart-row"><div class="cpd-chart-label">ชั้น ' + n + '</div><div class="cpd-chart-bars">' +
          '<div class="cpd-chart-bar-line"><div class="cpd-chart-bar bg-secondary" style="width:' + (a / maxClass * 100) + '%"></div><span>ปี 68: ' + int(a) + '</span></div>' +
          '<div class="cpd-chart-bar-line"><div class="cpd-chart-bar bg-success" style="width:' + (b / maxClass * 100) + '%"></div><span>ปี 69: ' + int(b) + '</span></div>' +
          '</div></div>';
      }).join('') + '<div class="small text-muted mt-2">■ ปี 68 <span class="text-success">■ ปี 69</span></div>';
    }
    var dimMax = [30, 20, 20, 30];
    var dimBox = $('cpd5DimChart');
    if (dimBox) {
      dimBox.innerHTML = (data.dimAverages || []).map(function (d, i) {
        var pct = d.average ? Math.min(100, (d.average / dimMax[i]) * 100) : 0;
        return '<div class="cpd-progress-row"><div class="cpd-progress-label">' + h(d.label) + '</div>' +
          '<div class="progress cpd-progress"><div class="progress-bar bg-primary" style="width:' + pct + '%"></div></div>' +
          '<div class="cpd-progress-value">' + S.fmt(d.average, 2) + ' / ' + dimMax[i] + '</div></div>';
      }).join('');
    }
    var summaryBox = $('cpd5Summary');
    if (summaryBox) {
      summaryBox.innerHTML = '' +
        '<div class="row g-2">' +
        '<div class="col-6"><div class="score-box"><div class="small text-muted">รายงานรายเดือนแล้ว</div><div class="fs-5 fw-bold">' + int(k.monthlyReported) + ' แห่ง</div><div class="small">' + (k.monthlyReportedPct || 0) + '%</div></div></div>' +
        '<div class="col-6"><div class="score-box"><div class="small text-muted">แผนที่อนุมัติแล้ว</div><div class="fs-5 fw-bold">' + int(k.approved) + ' แห่ง</div><div class="small">' + (k.approvedPct || 0) + '%</div></div></div>' +
        '<div class="col-12"><div class="score-box"><div class="small text-muted">อำเภอที่แสดง</div><div class="fw-bold">' + h(Array.from(new Set((data.rows || []).map(function (r) { return r.district; }).filter(Boolean))).join(', ') || '-') + '</div></div></div>' +
        '</div>';
    }
    var tbody = $('cpd5Rows');
    var rows = data.rows || [];
    var upcomingOnly = $('cpd5FilterUpcoming') && $('cpd5FilterUpcoming').checked;
    if (upcomingOnly) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      rows = rows.filter(function (r) {
        var completed30 = r.canCloseAccount === 'ได้' && String(r.closeTimeframe || '').indexOf('30') !== -1;
        var completed150 = r.canHoldAgm === 'ได้' && String(r.agmTimeframe || '').indexOf('150') !== -1;
        if (completed30 && completed150) return false;
        var daysClose = daysUntil(r.targetClose30d, today);
        var daysAgm = daysUntil(r.targetAgm150d, today);
        return (daysClose !== null && daysClose <= 30 && daysClose >= -7) ||
          (daysAgm !== null && daysAgm <= 30 && daysAgm >= -7);
      });
    }
    if (tbody) {
      tbody.innerHTML = rows.length ? rows.map(function (r, i) {
        return '<tr>' +
          '<td class="text-center">' + (i + 1) + '</td>' +
          '<td class="fw-bold">' + h(r.coopName) + '<div class="text-muted" style="font-size:0.72rem">' + h(r.coopId || '') + '</div></td>' +
          '<td>' + h(r.district || '-') + '</td>' +
          '<td>' + h(r.promotionZone || '-') + '</td>' +
          '<td>' + h(r.primaryOfficer || '-') + '</td>' +
          '<td class="text-center">' + h(r.fiscalEndDate || '-') + '</td>' +
          '<td class="text-center">' + h(r.targetClose30d || '-') + '</td>' +
          '<td class="text-center">' + h(r.targetAgm150d || '-') + '</td>' +
          '<td class="text-center">' + classBadge(r.class69) + '</td>' +
          '<td class="text-center">' + badgeForPlan(r.approvalStatus) + '</td>' +
          '<td class="text-center">' + (S.num(r.monthlyProgress) ? Math.round(S.num(r.monthlyProgress)) + '%' : '-') + '</td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="11" class="text-center text-muted py-3">ไม่พบข้อมูลตามตัวกรอง</td></tr>';
    }
    if ($('cpd5RowCount')) $('cpd5RowCount').textContent = rows.length + ' รายการ';
  }

  // =========================================================================
  // EARLY WARNING
  // =========================================================================

  function parseThaiDateValue(value) {
    if (!value) return null;
    var str = String(value).trim();
    var m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      var year = S.num(m[3]);
      if (year > 2400) year -= 543;
      var d = new Date(year, S.num(m[2]) - 1, S.num(m[1]));
      return isNaN(d.getTime()) ? null : d;
    }
    var parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function daysUntilThaiDate(value) {
    var d = parseThaiDateValue(value);
    if (!d) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  function computeEarlyWarnings(rows) {
    var buckets = { critical: [], warning: [], normal: [] };
    (rows || []).forEach(function (r) {
      var days = daysUntilThaiDate(r.targetAgm150d);
      var pct = S.num(r.monthlyProgress);
      var classNum = String(r.class69 || '').replace(/[^0-9]/g, '').slice(-1);
      var lowClass = classNum === '3' || classNum === '4';
      var reasons = [];
      var level = 'normal';
      if (days !== null && days <= 30 && pct < 25) {
        level = 'critical';
        reasons.push('เหลือ ' + days + ' วันถึงกำหนดประชุมใหญ่ แต่รายงานรายเดือน ' + Math.round(pct) + '%');
      } else if (!r.hasPlan && days !== null && days <= 60) {
        level = 'critical';
        reasons.push('ยังไม่มีแผน และเหลือ ' + days + ' วันถึงกำหนดประชุมใหญ่');
      } else if (days !== null && days <= 60 && pct < 50) {
        level = 'warning';
        reasons.push('เหลือ ' + days + ' วัน แต่รายงานรายเดือน ' + Math.round(pct) + '%');
      } else if (lowClass) {
        level = 'warning';
        reasons.push('ชั้นความเข้มแข็งปี 69 อยู่ในชั้น ' + classNum);
      }
      buckets[level].push({ row: r, days: days, pct: pct, reasons: reasons });
    });
    return buckets;
  }

  function renderEarlyWarning(data) {
    var box = $('cpd5EarlyWarning');
    if (!box) return;
    var b = computeEarlyWarnings((data && data.rows) || []);
    var cards = [
      { key: 'critical', title: '🚨 วิกฤต', cls: 'danger', desc: 'เหลือ ≤30 วัน และรายงานรายเดือน <25% หรือยังไม่มีแผน' },
      { key: 'warning', title: '⚠️ เฝ้าระวัง', cls: 'warning', desc: 'เหลือ ≤60 วัน และรายงาน <50% หรือชั้นความเข้มแข็ง 3–4' },
      { key: 'normal', title: '✅ ปกติ', cls: 'success', desc: 'พร้อมดำเนินการตามแผน' }
    ];
    var html = '<div class="row g-3 mb-3">' + cards.map(function (c) {
      return '<div class="col-md-4"><div class="card border-' + c.cls + ' h-100"><div class="card-body text-center py-3">' +
        '<div class="text-' + c.cls + ' fw-bold">' + c.title + '</div>' +
        '<div class="display-6 fw-bold text-' + c.cls + '">' + b[c.key].length + '</div>' +
        '<div class="small text-muted">' + c.desc + '</div>' +
        '</div></div></div>';
    }).join('') + '</div>';
    var risky = b.critical.concat(b.warning).slice(0, 12);
    if (risky.length) {
      html += '<div class="table-responsive"><table class="table table-sm table-bordered align-middle mb-0" style="font-size:0.78rem;">' +
        '<thead class="table-light text-center"><tr>' +
        '<th>#</th><th style="min-width:200px">สหกรณ์/กลุ่มเกษตรกร</th><th>อำเภอ</th><th>ชั้น 69</th>' +
        '<th>เหลือ (วัน)</th><th>รายงานรายเดือน</th><th style="min-width:260px">สัญญาณ</th>' +
        '</tr></thead><tbody>' +
        risky.map(function (x, i) {
          var r = x.row;
          var rowCls = b.critical.indexOf(x) !== -1 ? 'table-danger' : 'table-warning';
          return '<tr class="' + rowCls + '">' +
            '<td class="text-center">' + (i + 1) + '</td>' +
            '<td class="fw-bold">' + h(r.coopName || '-') + '</td>' +
            '<td>' + h(r.district || '-') + '</td>' +
            '<td class="text-center">' + h(r.class69 || '-') + '</td>' +
            '<td class="text-center">' + (x.days === null ? '-' : x.days) + '</td>' +
            '<td class="text-center">' + Math.round(x.pct) + '%</td>' +
            '<td>' + h(x.reasons.join(' • ')) + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>' +
        (b.critical.length + b.warning.length > 12
          ? '<div class="small text-muted mt-2">แสดง 12 รายการแรกจากทั้งหมด ' + (b.critical.length + b.warning.length) + ' รายการ</div>'
          : '');
    } else {
      html += '<div class="text-muted">ไม่พบสหกรณ์ที่เข้าเกณฑ์สัญญาณเตือนภัย</div>';
    }
    box.innerHTML = html;
  }

  // =========================================================================
  // REGISTRY + MIS
  // =========================================================================

  function fillReportFilter(id, values) {
    var sel = $(id);
    if (!sel) return;
    if (sel.options.length > 0) return;
    sel.innerHTML = '<option value="">— ทั้งหมด —</option>' + values.sort().map(function (v) {
      return '<option value="' + h(v) + '">' + h(v) + '</option>';
    }).join('');
    sel.addEventListener('change', renderReportRows);
  }

  function renderReportRegistry() {
    var registry = global.CPD_REPORT_REGISTRY || [];
    var tbody = $('cpd5ReportRows');
    if (!tbody) return;
    if (!registry.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">ไม่พบข้อมูลทะเบียนเอกสาร</td></tr>';
      return;
    }
    var targets = {}, freqs = {}, sections = {};
    registry.forEach(function (r) {
      if (r.targetType) targets[r.targetType] = true;
      if (r.frequency) freqs[r.frequency] = true;
      if (r.section) sections[r.section] = true;
    });
    fillReportFilter('cpd5ReportTarget', Object.keys(targets));
    fillReportFilter('cpd5ReportFrequency', Object.keys(freqs));
    fillReportFilter('cpd5ReportSection', Object.keys(sections));
    renderReportRows();
  }

  function renderReportRows() {
    var registry = global.CPD_REPORT_REGISTRY || [];
    var target = ($('cpd5ReportTarget') && $('cpd5ReportTarget').value) || '';
    var freq = ($('cpd5ReportFrequency') && $('cpd5ReportFrequency').value) || '';
    var section = ($('cpd5ReportSection') && $('cpd5ReportSection').value) || '';
    var filtered = registry.filter(function (r) {
      return (!target || r.targetType === target) &&
        (!freq || r.frequency === freq) &&
        (!section || r.section === section);
    });
    var tbody = $('cpd5ReportRows');
    if (tbody) {
      tbody.innerHTML = filtered.length ? filtered.map(function (r, i) {
        var link = r.url
          ? (r.url.indexOf('mailto:') === 0
            ? '<a href="' + h(r.url) + '">อีเมล</a>'
            : '<a href="' + h(r.url) + '" target="_blank" rel="noopener">เปิดลิงก์</a>')
          : '-';
        return '<tr>' +
          '<td class="text-center">' + (i + 1) + '</td>' +
          '<td><span title="' + h(r.fullName || '') + '">' + h(r.shortName || '') + '</span></td>' +
          '<td>' + h(r.targetType || '') + '</td>' +
          '<td class="text-center">' + h(r.asOf || '') + '</td>' +
          '<td>' + h(r.dueText || '') + '</td>' +
          '<td class="text-center">' + h(r.frequency || '') + '</td>' +
          '<td class="text-center">' + h(r.section || '') + '</td>' +
          '<td class="text-center">' + link + '</td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="8" class="text-center text-muted py-3">ไม่พบรายการตามตัวกรอง</td></tr>';
    }
    var count = $('cpd5ReportCount');
    if (count) count.textContent = filtered.length + ' รายการ';
  }

  var MIS_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  function renderMisReports() {
    var mis = global.CPD_MIS_REPORTS;
    if (!mis || !mis.coops) {
      var box = $('cpd5MisRows');
      if (box) box.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-3">กำลังโหลดข้อมูล MIS...</td></tr>';
      return;
    }
    if (!renderMisReports._wired) {
      renderMisReports._wired = true;
      ['cpd5MisSearch', 'cpd5MisMonth', 'cpd5MisType'].forEach(function (id) {
        var el = $(id);
        if (el) {
          var evt = id === 'cpd5MisSearch' ? 'input' : 'change';
          el.addEventListener(evt, renderMisReports);
        }
      });
    }
    var R = mis.reports || [];
    var C = mis.coops || {};
    var monthSel = $('cpd5MisMonth');
    if (monthSel && monthSel.options.length <= 1) {
      MIS_MONTHS.forEach(function (m) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthSel.appendChild(opt);
      });
    }
    var typeSel = $('cpd5MisType');
    if (typeSel && typeSel.options.length <= 1) {
      var types = {};
      Object.keys(C).forEach(function (name) { types[C[name].t || 'ไม่ระบุ'] = 1; });
      Object.keys(types).sort().forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSel.appendChild(opt);
      });
    }
    var search = ($('cpd5MisSearch') && $('cpd5MisSearch').value || '').toLowerCase().trim();
    var monthFilter = ($('cpd5MisMonth') && $('cpd5MisMonth').value) || '';
    var typeFilter = ($('cpd5MisType') && $('cpd5MisType').value) || '';
    var coopNames = Object.keys(C).sort();
    var filtered = coopNames.filter(function (name) {
      if (search && name.toLowerCase().indexOf(search) === -1) return false;
      var d = C[name];
      if (typeFilter && (d.t || 'ไม่ระบุ') !== typeFilter) return false;
      if (monthFilter && (!d.m || !d.m[monthFilter])) return false;
      return true;
    });
    var tbody = $('cpd5MisRows');
    if (tbody) {
      tbody.innerHTML = filtered.length > 0 ? filtered.map(function (name) {
        var d = C[name];
        var monthCells = MIS_MONTHS.map(function (m) {
          var reports = (d.m && d.m[m]) || [];
          var count = reports.length;
          if (count === 0) return '<td class="text-center text-muted">-</td>';
          var color = count >= 10 ? 'bg-danger' : (count >= 5 ? 'bg-warning text-dark' : 'bg-info text-dark');
          return '<td class="text-center"><span class="badge ' + color + ' rounded-pill" title="' +
            h(reports.map(function (ri) { return R[ri] || ''; }).join('\n')) + '">' + count + '</span></td>';
        }).join('');
        var typeLabel = d.t || 'ไม่ระบุ';
        return '<tr><td>' + h(name) + '</td><td class="text-center">' + h(typeLabel) + '</td>' + monthCells + '</tr>';
      }).join('') : '<tr><td colspan="14" class="text-center text-muted py-3">ไม่พบข้อมูลตามตัวกรอง</td></tr>';
    }
    var count = $('cpd5MisCount');
    if (count) count.textContent = filtered.length + ' สหกรณ์';
    var reportList = $('cpd5MisReportList');
    if (reportList) {
      reportList.innerHTML = R.map(function (r, i) {
        return '<span class="badge bg-light text-dark me-1 mb-1" style="font-size:0.68rem;">' + (i + 1) + '. ' + h(r) + '</span>';
      }).join('');
    }
  }

  // =========================================================================
  // EXPORT
  // =========================================================================

  function exportDashboardRows(format) {
    if (!dashboardData || !dashboardData.rows || !dashboardData.rows.length) {
      showToast('ยังไม่มีข้อมูลสำหรับส่งออก', 'danger');
      return;
    }
    var headers = ['ลำดับ', 'สหกรณ์/กลุ่มเกษตรกร', 'รหัส 13 หลัก', 'อำเภอ', 'เขตส่งเสริม', 'ประเภท', 'ผู้ดูแลหลัก',
      'วันสิ้นปีบัญชี', 'กำหนดปิดบัญชี 30 วัน', 'กำหนดประชุมใหญ่ 150 วัน', 'ชั้นปี 68', 'ชั้นปี 69',
      'สถานะแผน', 'ผลรายเดือน (%)', 'สินทรัพย์ล่าสุด', 'ปริมาณธุรกิจล่าสุด'];
    var lines = dashboardData.rows.map(function (r, i) {
      return [i + 1, r.coopName, r.coopId, r.district, r.promotionZone, r.coopSubType, r.primaryOfficer,
        r.fiscalEndDate, r.targetClose30d, r.targetAgm150d, r.class68, r.class69,
        r.approvalStatus || 'ยังไม่มีแผน', Math.round(S.num(r.monthlyProgress)),
        S.num(r.assetsLatest), S.num(r.businessVolLatest)];
    });
    var stamp = new Date();
    var stampText = stamp.getFullYear() + ('0' + (stamp.getMonth() + 1)).slice(-2) + ('0' + stamp.getDate()).slice(-2);
    if (format === 'csv') {
      var csv = [headers].concat(lines).map(function (row) {
        return row.map(function (cell) {
          var s = String(cell === undefined || cell === null ? '' : cell);
          return '"' + s.replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\r\n');
      downloadBlob('\uFEFF' + csv, 'text/csv;charset=utf-8', 'cpd_dashboard_2570_' + stampText + '.csv');
    } else {
      var table = '<html><head><meta charset="utf-8"></head><body><table border="1">' +
        '<tr>' + headers.map(function (x) { return '<th>' + h(x) + '</th>'; }).join('') + '</tr>' +
        lines.map(function (row) {
          return '<tr>' + row.map(function (cell) { return '<td>' + h(cell) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</table></body></html>';
      downloadBlob('\uFEFF' + table, 'application/vnd.ms-excel;charset=utf-8', 'cpd_dashboard_2570_' + stampText + '.xls');
    }
    showToast('ส่งออกข้อมูล ' + lines.length + ' รายการแล้ว', 'success');
  }

  function downloadBlob(content, mimeType, fileName) {
    var blob = new Blob([content], { type: mimeType });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  function bindGlobalEvents() {
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('input', onFieldEvent);
    document.addEventListener('change', onFieldEvent);
  }

  function onFieldEvent(e) {
    var el = e.target;
    if (!el || !el.matches) return;
    if (el.id === 'cpd5FilterYear' || el.id === 'cpd5FilterDistrict' ||
      el.id === 'cpd5FilterType' || el.id === 'cpd5FilterOfficer') {
      loadDashboard(true);
      return;
    }
    if (el.id === 'cpd5FilterUpcoming') {
      renderDashboard();
      return;
    }
    if (el.matches('[data-indicator]')) {
      var ind = el.getAttribute('data-indicator');
      var year = el.getAttribute('data-year');
      var st = A().strength;
      if (!st.indicators[ind]) st.indicators[ind] = { '2567': 0, '2568': 0, '2569': 0 };
      st.indicators[ind][year] = S.num(el.value);
      if (st.indicators[ind]._autoDistributed) delete st.indicators[ind]._autoDistributed;
      S.recalcStrength();
      updateOutputs();
      return;
    }
  }

  function onDocumentClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'switch-tab') {
      switchTab(btn.getAttribute('data-tab'));
    } else if (action === 'refresh-dashboard') {
      loadDashboard(true);
    } else if (action === 'export-csv') {
      exportDashboardRows('csv');
    } else if (action === 'export-xls') {
      exportDashboardRows('xls');
    } else if (action === 'reset-report-filters') {
      ['cpd5ReportTarget', 'cpd5ReportFrequency', 'cpd5ReportSection'].forEach(function (id) {
        var el = $(id);
        if (el) el.value = '';
      });
      renderReportRows();
    }
  }

  function showToast(message, type) {
    var el = $('cpdToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cpdToast';
      el.className = 'cpd-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'cpd-toast show ' + (type || 'info');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.className = 'cpd-toast ' + (type || 'info');
    }, 4000);
  }

  // =========================================================================
  // PUBLIC + BOOT
  // =========================================================================

  UI.switchTab = switchTab;
  UI.loadDashboard = loadDashboard;
  UI.fallbackDashboard = fallbackDashboard;
  UI.showToast = showToast;
  UI.renderDashboard = renderDashboard;
  UI.renderReportRegistry = renderReportRegistry;
  UI.renderReportRows = renderReportRows;
  UI.renderMisReports = renderMisReports;
  UI.indicatorsFromScore69 = indicatorsFromScore69;
  UI.strength69Payload = strength69Payload;
  UI.applyStrength69Indicators = applyStrength69Indicators;
  UI.applyStrength69Fallback = applyStrength69Fallback;
  global.CPD_UI = UI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UI.init);
  } else {
    setTimeout(UI.init, 0);
  }
})(window);

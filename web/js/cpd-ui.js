/**
 * cpd-ui.js — UI ของ 3 หน้า (ฟอร์มพื้นฐาน / แผนฉบับเต็ม+4M / Dashboard+ติดตามเอกสาร)
 * ใช้ร่วมกับ cpd-state.js (window.CPD_STATE / window.CPD_AppState)
 */
(function (global) {
  'use strict';

  var S = global.CPD_STATE;
  var UI = {};
  var dashboardData = null;
  var dashboardError = '';
  var baseSyncTimer = null;
  var dashboardTimer = null;
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function A() { return global.CPD_AppState; }
  function h(v) { return S.escapeHtml(v); }
  function money(v, dec) { return S.fmt(v, dec === undefined ? 2 : dec); }
  function int(v) { return S.fmtInt(v); }

  function field(path, label, opts) {
    opts = opts || {};
    var attrs = 'data-cpd="' + path + '"';
    if (opts.num) attrs += ' data-num="1"';
    if (opts.readonly) attrs += ' readonly';
    var cls = 'form-control form-control-sm' + (opts.readonly ? ' bg-light' : '');
    if (opts.center) cls += ' text-center';
    return '<div class="col-md-' + (opts.col || 4) + '">' +
      '<label class="form-label small fw-bold mb-1">' + label + '</label>' +
      '<input type="' + (opts.type || 'text') + '" class="' + cls + '" ' + attrs +
      (opts.placeholder ? ' placeholder="' + h(opts.placeholder) + '"' : '') + '>' +
      '</div>';
  }

  function textarea(path, label, rows, col) {
    return '<div class="col-md-' + (col || 12) + '">' +
      '<label class="form-label small fw-bold mb-1">' + label + '</label>' +
      '<textarea class="form-control form-control-sm" rows="' + (rows || 3) + '" data-cpd="' + path + '"></textarea>' +
      '</div>';
  }

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

  UI.init = function () {
    buildTab2();
    // Task 1: แท็บ 3 (ติดตามรายเดือน) และแท็บ 4 (รายงานปิดบัญชี) ถูกยุบรวมแล้ว
    buildTab5();
    bindGlobalEvents();
    wireLegacyFunctions();
    switchTab('base-form', true);
    S.syncFromBaseFormToAllTabs();
    UI.renderAll();
    setTimeout(function () {
      S.syncFromBaseFormToAllTabs();
      UI.renderAll();
    }, 300);
  };

  function switchTab(name, silent) {
    var validTabs = ['base-form', 'full-plan', 'dashboard'];
    if (validTabs.indexOf(name) === -1) name = 'base-form';
    if (name === 'full-plan' && !silent) {
      var current4M = A().analysis && A().analysis.orgAnalysis4M;
      if (!current4M || !String(current4M).trim()) populate4MFromBaseForm(true);
    }
    document.querySelectorAll('.cpd-tab-pane').forEach(function (pane) {
      pane.classList.toggle('active', pane.id === 'tab-' + name);
    });
    document.querySelectorAll('[data-action="switch-tab"]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    if (!silent) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }
    if (name === 'dashboard') {
      loadDashboard();
    }
  }

  function wireLegacyFunctions() {
    // ห่อฟังก์ชันเดิมเพื่อซิงค์ข้อมูลหลังเลือกสหกรณ์/โหลดร่าง โดยไม่แตะโค้ดเดิม
    if (typeof global.onSelectCoop === 'function' && !global.__cpdWrappedSelect) {
      var origSelect = global.onSelectCoop;
      global.onSelectCoop = function () {
        var r = origSelect.apply(this, arguments);
        scheduleBaseSync(120);
        setTimeout(function () { maybeLoadSavedRecord(); }, 400);
        return r;
      };
      global.__cpdWrappedSelect = true;
    }

    if (typeof global.loadFormFromSavedData === 'function' && !global.__cpdWrappedLoadDraft) {
      var origLoadDraft = global.loadFormFromSavedData;
      global.loadFormFromSavedData = function () {
        var r = origLoadDraft.apply(this, arguments);
        scheduleBaseSync(120);
        return r;
      };
      global.__cpdWrappedLoadDraft = true;
    }

    if (typeof global.populateCoopDropdown === 'function' && !global.__cpdWrappedPopulate) {
      var origPopulate = global.populateCoopDropdown;
      global.populateCoopDropdown = function (list) {
        var r = origPopulate.apply(this, arguments);
        if (dashboardData === null) { /* รอผู้ใช้เปิดแท็บ Dashboard */ }
        if ($('tab-dashboard') && $('tab-dashboard').classList.contains('active')) {
          loadDashboard();
        }
        return r;
      };
      global.__cpdWrappedPopulate = true;
    }

    global.CPD_scheduleSync = function () { scheduleBaseSync(80); };
  }

  function scheduleBaseSync(delay) {
    if (S.isLoading()) return;
    if (baseSyncTimer) clearTimeout(baseSyncTimer);
    baseSyncTimer = setTimeout(function () {
      baseSyncTimer = null;
      S.syncFromBaseFormToAllTabs();
    }, delay || 250);
  }

  UI.onStateSynced = function () {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#tab-base-form')) {
      fillBoundFields();
      updateOutputs();
    } else {
      fillBoundFields();
      updateOutputs();
    }
  };

  UI.renderAll = function () {
    fillBoundFields();
    renderStrengthRows();
    renderStatusTable();
    renderMonthlyVolume();
    renderActivities();
    updateOutputs();
  };

  // =========================================================================
  // TAB 2 — FULL PLAN
  // =========================================================================

  function buildTab2() {
    var root = $('tab-full-plan');
    if (!root) return;
    root.innerHTML = '' +
      '<div class="cpd-page-head">' +
      '  <div>' +
      '    <h4 class="mb-1">📘 แผนส่งเสริมสหกรณ์/กลุ่มเกษตรกร ฉบับเต็ม</h4>' +
      '    <div class="text-muted small" id="cpd2CoopLine">ยังไม่ได้เลือกสหกรณ์</div>' +
      '  </div>' +
      '  <div class="no-print d-flex gap-2 flex-wrap">' +
      '    <button type="button" class="btn btn-sm btn-outline-success" data-action="print-section" data-section="tab-full-plan">🖨️ พิมพ์แผนฉบับเต็ม</button>' +
      '    <button type="button" class="btn btn-sm btn-success" data-action="save-plan">💾 บันทึกแผน (ทุกแท็บ)</button>' +
      '  </div>' +
      '</div>' +
      '<div class="cpd-subpills no-print" id="cpd2Pills">' +
      '  <button type="button" class="cpd-pill active" data-action="cpd2-section" data-section="profile">1. ข้อมูลพื้นฐาน &amp; สมาชิก</button>' +
      '  <button type="button" class="cpd-pill" data-action="cpd2-section" data-section="finance">2. งบการเงิน &amp; อัตราส่วน</button>' +
      '  <button type="button" class="cpd-pill" data-action="cpd2-section" data-section="strength">3. ความเข้มแข็ง 18 ตัวชี้วัด</button>' +
      '  <button type="button" class="cpd-pill" data-action="cpd2-section" data-section="analysis">4. วิเคราะห์ข้อมูลสหกรณ์</button>' +
      '  <button type="button" class="cpd-pill" data-action="cpd2-section" data-section="schedule">5. แผน 30/150 วัน &amp; อนุมัติ</button>' +
      '</div>' +
      buildTab2Profile() +
      buildTab2Finance() +
      buildTab2Strength() +
      buildTab2Analysis() +
      buildTab2Schedule();
  }

  function buildTab2Profile() {
    return '' +
      '<div class="cpd-subsection active" data-cpd2-pane="profile">' +
      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">1. ข้อมูลพื้นฐานของสหกรณ์และกลุ่มเกษตรกร</div>' +
      '    <div class="card-body py-3"><div class="row g-2">' +
      field('coopProfile.coopId13', 'รหัสสหกรณ์/กลุ่มเกษตรกร 13 หลัก', { col: 4 }) +
      field('coopProfile.coopName', 'ชื่อสหกรณ์/กลุ่มเกษตรกร', { col: 8 }) +
      field('coopProfile.orgType', 'ประเภท (สหกรณ์/กลุ่มเกษตรกร)', { col: 4 }) +
      field('coopProfile.coopSubType', 'ประเภทย่อย', { col: 4 }) +
      field('coopProfile.status', 'สถานะ', { col: 4 }) +
      field('coopProfile.district', 'อำเภอ', { col: 3 }) +
      field('coopProfile.distanceKm', 'ระยะทางไป-กลับ (กม.)', { col: 3, num: 1, center: 1 }) +
      field('coopProfile.promotionZone', 'เขตส่งเสริม (กสส.)', { col: 3 }) +
      field('coopProfile.primaryOfficer', 'ผู้ดูแลหลัก / ผู้จัดทำแผน', { col: 3 }) +
      field('coopProfile.coOfficer', 'ผู้ดูแลร่วม', { col: 6 }) +
      field('coopProfile.regDate', 'วันจดทะเบียน', { col: 3 }) +
      field('coopProfile.fiscalEndDate', 'วันสิ้นปีบัญชี', { col: 3 }) +
      field('coopProfile.boardCount', 'จำนวนกรรมการ (คน)', { col: 3, num: 1, center: 1 }) +
      field('coopProfile.auditorType', 'ผู้สอบบัญชี', { col: 3 }) +
      field('coopProfile.auditorName', 'ชื่อผู้สอบบัญชี', { col: 4 }) +
      field('coopProfile.inspectorCount', 'จำนวนผู้ตรวจสอบกิจการ (คน)', { col: 4, num: 1, center: 1 }) +
      field('coopProfile.inspectorName', 'ชื่อผู้ตรวจสอบกิจการ', { col: 4 }) +
      field('coopProfile.royalProject', 'สหกรณ์ในโครงการหลวง/โครงการพระราชดำริ', { col: 12 }) +
      field('coopProfile.mainBusinesses', 'ธุรกิจหลัก (เรียงตามมูลค่ามากไปน้อย)', { col: 6 }) +
      field('coopProfile.mainProducts', 'ผลผลิตหลัก (เรียงตามมูลค่ามากไปน้อย)', { col: 6 }) +
      '    </div></div>' +
      '  </div>' +
      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">สมาชิกสามัญ / สมาชิกสมทบ</div>' +
      '    <div class="card-body py-3 table-responsive">' +
      '      <table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.88rem;">' +
      '        <thead class="table-light text-center"><tr><th>ประเภทสมาชิก</th><th>ชาย</th><th>หญิง</th><th>รวม</th></tr></thead>' +
      '        <tbody>' +
      '          <tr><td class="fw-bold">สมาชิกสามัญ</td>' +
      '            <td>' + field('coopProfile.members.regularMale', '', { num: 1, center: 1 }) + '</td>' +
      '            <td>' + field('coopProfile.members.regularFemale', '', { num: 1, center: 1 }) + '</td>' +
      '            <td class="text-center fw-bold">' + out('members.regularTotal') + '</td></tr>' +
      '          <tr><td class="fw-bold">สมาชิกสมทบ</td>' +
      '            <td>' + field('coopProfile.members.associateMale', '', { num: 1, center: 1 }) + '</td>' +
      '            <td>' + field('coopProfile.members.associateFemale', '', { num: 1, center: 1 }) + '</td>' +
      '            <td class="text-center fw-bold">' + out('members.associateTotal') + '</td></tr>' +
      '          <tr class="table-success"><td class="fw-bold">รวมทั้งสิ้น</td><td colspan="2"></td>' +
      '            <td class="text-center fw-bold fs-6">' + out('members.total') + '</td></tr>' +
      '          <tr><td>จำนวนสมาชิกปีก่อน (รวม)</td><td colspan="3">' + field('coopProfile.members.prevYearTotal', '', { num: 1, center: 1 }) + '</td></tr>' +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function buildTab2Finance() {
    var biz = [
      { key: 'credit', title: 'ธุรกิจเงินให้กู้', cols: [['interestIncome', 'รายได้ดอกเบี้ย'], ['serviceCost', 'ต้นทุนบริการ'], ['specificIncome', 'รายได้เฉพาะธุรกิจ'], ['specificExpense', 'ค่าใช้จ่ายเฉพาะธุรกิจ']] },
      { key: 'trading', title: 'ธุรกิจจัดหาสินค้ามาจำหน่าย', cols: [['sales', 'ยอดขาย'], ['cogs', 'ต้นทุนขาย'], ['lessUncollectedProfitCurrent', 'หักกำไรที่ยังไม่เกิดขึ้น'], ['addCollectedProfitPrev', 'บวกกำไรที่เรียกเก็บได้'], ['specificIncome', 'รายได้เฉพาะธุรกิจ'], ['specificExpense', 'ค่าใช้จ่ายเฉพาะธุรกิจ']] },
      { key: 'collection', title: 'ธุรกิจรวบรวมผลผลิต', cols: [['sales', 'ยอดขาย'], ['cogs', 'ต้นทุนขาย'], ['specificIncome', 'รายได้เฉพาะธุรกิจ'], ['specificExpense', 'ค่าใช้จ่ายเฉพาะธุรกิจ']] },
      { key: 'processing', title: 'ธุรกิจแปรรูปผลผลิต', cols: [['sales', 'ยอดขาย'], ['cogs', 'ต้นทุนขาย'], ['specificIncome', 'รายได้เฉพาะธุรกิจ'], ['specificExpense', 'ค่าใช้จ่ายเฉพาะธุรกิจ']] },
      { key: 'service', title: 'ธุรกิจบริการ', cols: [['serviceIncome', 'รายได้ค่าบริการ'], ['serviceCost', 'ต้นทุนบริการ'], ['specificIncome', 'รายได้เฉพาะธุรกิจ'], ['specificExpense', 'ค่าใช้จ่ายเฉพาะธุรกิจ']] }
    ];

    var bizHtml = biz.map(function (b) {
      return '<div class="card border mb-2"><div class="card-header py-1 bg-light fw-bold">' + h(b.title) + '</div>' +
        '<div class="card-body py-2"><div class="row g-2">' +
        b.cols.map(function (c) {
          return field('financials.businesses.' + b.key + '.' + c[0], c[1], { num: 1, col: 4 });
        }).join('') +
        '<div class="col-md-4"><label class="form-label small fw-bold mb-1">กำไรขั้นต้น</label><div class="form-control form-control-sm bg-light text-end">' + out('biz.' + b.key + '.grossProfit') + '</div></div>' +
        '<div class="col-md-4"><label class="form-label small fw-bold mb-1">กำไรสุทธิเฉพาะธุรกิจ</label><div class="form-control form-control-sm bg-light text-end fw-bold text-success">' + out('biz.' + b.key + '.netBusinessProfit') + '</div></div>' +
        '</div></div></div>';
    }).join('');

    return '' +
      '<div class="cpd-subsection" data-cpd2-pane="finance">' +
      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">สรุปผลการดำเนินงาน 2 ปีบัญชี (ซิงค์จากฟอร์มหลัก)</div>' +
      '    <div class="card-body py-3"><div class="row g-2">' +
      field('financials.summary2Years.assetsLatest', 'สินทรัพย์ ล่าสุด', { num: 1, col: 3 }) +
      field('financials.summary2Years.assetsPrev', 'สินทรัพย์ ปีก่อน', { num: 1, col: 3 }) +
      field('financials.summary2Years.liabilitiesLatest', 'หนี้สิน ล่าสุด', { num: 1, col: 3 }) +
      field('financials.summary2Years.liabilitiesPrev', 'หนี้สิน ปีก่อน', { num: 1, col: 3 }) +
      field('financials.summary2Years.shareCapitalLatest', 'ทุนเรือนหุ้น ล่าสุด', { num: 1, col: 3 }) +
      field('financials.summary2Years.shareCapitalPrev', 'ทุนเรือนหุ้น ปีก่อน', { num: 1, col: 3 }) +
      field('financials.summary2Years.reserveFundLatest', 'ทุนสำรอง ล่าสุด', { num: 1, col: 3 }) +
      field('financials.summary2Years.reserveFundPrev', 'ทุนสำรอง ปีก่อน', { num: 1, col: 3 }) +
      field('financials.summary2Years.netProfitLatest', 'กำไร(ขาดทุน) ล่าสุด', { num: 1, col: 3 }) +
      field('financials.summary2Years.netProfitPrev', 'กำไร(ขาดทุน) ปีก่อน', { num: 1, col: 3 }) +
      field('financials.summary2Years.accumLossLatest', 'ขาดทุนสะสม ล่าสุด', { num: 1, col: 3 }) +
      field('financials.summary2Years.accumLossPrev', 'ขาดทุนสะสม ปีก่อน', { num: 1, col: 3 }) +
      field('financials.summary2Years.businessVolumeLatest', 'ปริมาณธุรกิจ ล่าสุด', { num: 1, col: 6 }) +
      field('financials.summary2Years.businessVolumePrev', 'ปริมาณธุรกิจ ปีก่อน', { num: 1, col: 6 }) +
      '    </div></div>' +
      '  </div>' +

      '  <div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '    <span>งบฐานะการเงิน (Balance Sheet)</span>' +
      '    <button type="button" class="btn btn-sm btn-light py-0 fw-bold no-print" data-action="sync-to-base">🔄 ซิงค์ยอดกลับไปฟอร์มหลัก</button></div>' +
      '    <div class="card-body py-3"><div class="row g-3">' +
      '      <div class="col-lg-6"><h6 class="fw-bold text-success">สินทรัพย์</h6><div class="row g-2">' +
      field('financials.balanceSheet.currentAssets', 'สินทรัพย์หมุนเวียน', { num: 1, col: 6 }) +
      field('financials.balanceSheet.nonCurrentAssets', 'สินทรัพย์ไม่หมุนเวียน', { num: 1, col: 6 }) +
      '        <div class="col-12"><div class="d-flex justify-content-between border-top pt-2"><strong>รวมสินทรัพย์</strong><strong class="text-success">' + out('bs.totalAssets') + '</strong></div></div>' +
      '      </div></div>' +
      '      <div class="col-lg-6"><h6 class="fw-bold text-danger">หนี้สินและทุนของสหกรณ์</h6><div class="row g-2">' +
      field('financials.balanceSheet.currentLiabilities', 'หนี้สินหมุนเวียน', { num: 1, col: 6 }) +
      field('financials.balanceSheet.nonCurrentLiabilities', 'หนี้สินไม่หมุนเวียน', { num: 1, col: 6 }) +
      field('financials.balanceSheet.shareCapital', 'ทุนเรือนหุ้น', { num: 1, col: 6 }) +
      field('financials.balanceSheet.reserveFund', 'ทุนสำรอง', { num: 1, col: 6 }) +
      field('financials.balanceSheet.otherAccumFunds', 'ทุนสะสมอื่น', { num: 1, col: 6 }) +
      field('financials.balanceSheet.unrealizedInvestGain', 'กำไรที่ยังไม่เกิดขึ้น', { num: 1, col: 6 }) +
      field('financials.balanceSheet.revaluationSurplus', 'ส่วนเกินทุนจากการตีราคา', { num: 1, col: 6 }) +
      field('financials.balanceSheet.accumulatedLoss', 'ขาดทุนสะสม', { num: 1, col: 6 }) +
      field('financials.balanceSheet.netProfitYear', 'กำไร(ขาดทุน)สุทธิประจำปี', { num: 1, col: 6 }) +
      '        <div class="col-12"><div class="d-flex justify-content-between border-top pt-2"><strong>รวมหนี้สิน</strong><strong>' + out('bs.totalLiabilities') + '</strong></div>' +
      '          <div class="d-flex justify-content-between"><strong>รวมทุนของสหกรณ์</strong><strong class="text-primary">' + out('bs.totalEquity') + '</strong></div></div>' +
      '      </div></div>' +
      '    </div></div>' +
      '  </div>' +

      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">งบกำไรขาดทุน</div>' +
      '    <div class="card-body py-3"><div class="row g-2">' +
      '      <div class="col-md-6"><div class="d-flex justify-content-between py-1 border-bottom"><span>รายได้จากการขาย/บริการ</span><strong>' + out('is.totalSalesService') + '</strong></div></div>' +
      '      <div class="col-md-6"><div class="d-flex justify-content-between py-1 border-bottom"><span>ต้นทุนขาย/บริการ</span><strong>' + out('is.totalCogsService') + '</strong></div></div>' +
      '      <div class="col-md-6"><div class="d-flex justify-content-between py-1 border-bottom"><span>กำไรขั้นต้น</span><strong class="text-success">' + out('is.grossProfit') + '</strong></div></div>' +
      '      <div class="col-md-6"><div class="d-flex justify-content-between py-1 border-bottom"><span>กำไรสุทธิเฉพาะธุรกิจ</span><strong>' + out('is.netSpecificProfit') + '</strong></div></div>' +
      field('financials.incomeStatement.otherIncome', 'รายได้อื่น', { num: 1, col: 4 }) +
      field('financials.incomeStatement.priorPeriodAdjustment', 'ปรับปรุงงวดก่อน', { num: 1, col: 4 }) +
      field('financials.incomeStatement.operatingExpense', 'ค่าใช้จ่ายดำเนินงาน', { num: 1, col: 4 }) +
      '      <div class="col-12"><div class="d-flex justify-content-between border-top pt-2 fs-5"><strong>กำไร(ขาดทุน)สุทธิ</strong><strong class="text-success">' + out('is.netProfit') + '</strong></div></div>' +
      '    </div></div>' +
      '  </div>' +

      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">ธุรกิจ 5 ด้าน</div><div class="card-body py-2">' + bizHtml + '</div></div>' +

      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">อัตราส่วนทางการเงิน 7 ตัว (คำนวณอัตโนมัติ)</div>' +
      '    <div class="card-body py-3"><div class="row g-2">' +
      ratioCard('DE Ratio (เท่า)', 'ratio.deRatio') +
      ratioCard('ROE (%)', 'ratio.roe') +
      ratioCard('ROA (%)', 'ratio.roa') +
      ratioCard('อัตราส่วนทุนหมุนเวียน (เท่า)', 'ratio.currentRatio') +
      ratioCard('ทุนสำรองต่อสินทรัพย์ (เท่า)', 'ratio.reserveToAssetRatio') +
      ratioCard('ค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่าย (%)', 'ratio.opexToGrossProfitRatio') +
      '      <div class="col-md-4"><div class="score-box h-100"><div class="small fw-bold mb-1">ลูกหนี้ระยะสั้นชำระตามกำหนด (%)</div>' +
      '        <input type="text" class="form-control form-control-sm text-end fw-bold" data-cpd="financials.ratios.shortTermDebtPaidOnTimeRatio" data-num="1"></div></div>' +
      '    </div></div>' +
      '  </div>' +
      '</div>';
  }

  function ratioCard(label, key) {
    return '<div class="col-md-4"><div class="score-box h-100"><div class="small fw-bold mb-1">' + h(label) + '</div>' +
      '<div class="fs-5 fw-bold text-primary text-end">' + out(key) + '</div></div></div>';
  }

  function buildTab2Strength() {
    return '' +
      '<div class="cpd-subsection" data-cpd2-pane="strength">' +
      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">ผลประเมินความเข้มแข็ง 4 มิติ 18 ตัวชี้วัด (ย้อนหลัง 3 ปี)</div>' +
      '    <div class="card-body py-2 table-responsive">' +
      '      <table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.82rem;">' +
      '        <thead class="table-light text-center"><tr><th style="width:52%">มิติ / ตัวชี้วัด</th><th>น้ำหนัก</th><th style="width:11%">ปี 2567</th><th style="width:11%">ปี 2568</th><th style="width:11%">ปี 2569</th></tr></thead>' +
      '        <tbody id="cpd2StrengthBody"></tbody>' +
      '        <tfoot class="table-success">' +
      '          <tr><th colspan="2" class="text-end">รวมคะแนน</th>' +
      '            <th class="text-center">' + out('st.total.2567') + '</th>' +
      '            <th class="text-center">' + out('st.total.2568') + '</th>' +
      '            <th class="text-center">' + out('st.total.2569') + '</th></tr>' +
      '          <tr><th colspan="2" class="text-end">ชั้นความเข้มแข็ง</th>' +
      '            <th class="text-center">' + out('st.class.2567') + '</th>' +
      '            <th class="text-center">' + out('st.class.2568') + '</th>' +
      '            <th class="text-center">' + out('st.class.2569') + '</th></tr>' +
      '        </tfoot>' +
      '      </table>' +
      '      <div class="form-text mt-2">💡 กรอกคะแนนรายตัวชี้วัด ระบบจะรวมคะแนนรายมิติและรวมทั้งสิ้นให้อัตโนมัติ (หากเว้นว่าง ระบบจะใช้ยอดจากฟอร์มหลัก)</div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function buildTab2Analysis() {
    return '' +
      '<div class="cpd-subsection" data-cpd2-pane="analysis">' +
      '  <div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '    <span>การวิเคราะห์ข้อมูลสหกรณ์/กลุ่มเกษตรกร (4M)</span>' +
      '    <span class="no-print d-flex gap-1 flex-wrap">' +
      '      <button type="button" class="btn btn-sm btn-success py-0 fw-bold" data-action="analyze-4m">✨ ดึงข้อมูลจากฟอร์มพื้นฐานวิเคราะห์ 4M อัตโนมัติ</button>' +
      '      <button type="button" class="btn btn-sm btn-light py-0 fw-bold" data-action="insert-4m">➕ แทรกโครงสร้างหัวข้อ 4M ตั้งต้น</button>' +
      '    </span></div>' +
      '    <div class="card-body py-3"><div class="row g-3">' +
      textarea('analysis.orgAnalysis4M', '1. ด้านการบริหารจัดการองค์กร (หลัก 4M)', 7) +
      textarea('analysis.businessAnalysis', '2. ด้านการบริหารจัดการธุรกิจ', 6) +
      textarea('analysis.welfareAnalysis', '3. ด้านการจัดสวัสดิการและสาธารณประโยชน์', 4) +
      textarea('analysis.summaryAnalysis', '4. สรุปผลการวิเคราะห์', 4) +
      textarea('analysis.auditorObservations', 'ข้อสังเกตของผู้สอบบัญชี (ปีบัญชีล่าสุด)', 3, 6) +
      textarea('analysis.coopDefects', 'ข้อบกพร่องของสหกรณ์ (ปีบัญชีล่าสุด)', 3, 6) +
      '    </div></div>' +
      '  </div>' +
      '</div>';
  }

  function buildTab2Schedule() {
    return '' +
      '<div class="cpd-subsection" data-cpd2-pane="schedule">' +
      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">แผนการปิดบัญชี (ภายใน 30 วัน) และแผนการประชุมใหญ่ประจำปี (ภายใน 150 วัน)</div>' +
      '    <div class="card-body py-3"><div class="row g-3">' +
      '      <div class="col-md-6"><div class="score-box"><div class="small fw-bold mb-1">แผนการปิดบัญชี (ภายใน 30 วัน)</div>' +
      '        <div class="fs-5 fw-bold text-success" data-out="deadline.close30">-</div>' +
      '        <div class="form-text">คำนวณจากวันสิ้นปีบัญชี + 30 วัน อัตโนมัติ</div></div></div>' +
      '      <div class="col-md-6"><div class="score-box"><div class="small fw-bold mb-1">แผนการประชุมใหญ่ประจำปี (ภายใน 150 วัน)</div>' +
      '        <div class="fs-5 fw-bold text-primary" data-out="deadline.agm150">-</div>' +
      '        <div class="form-text">คำนวณจากวันสิ้นปีบัญชี + 150 วัน อัตโนมัติ</div></div></div>' +
      '    </div></div>' +
      '  </div>' +

      '  <div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '    <span>เป้าหมายงาน/กิจกรรมที่จะดำเนินการ (5 หมวดหลัก)</span>' +
      '    <button type="button" class="btn btn-sm btn-light py-0 fw-bold no-print" data-action="add-activity">➕ เพิ่มกิจกรรม</button></div>' +
      '    <div class="card-body py-2 table-responsive">' +
      '      <table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.82rem;">' +
      '        <thead class="table-light text-center"><tr><th style="width:34%">เป้าหมายงาน/กิจกรรม</th><th>ค่าเป้าหมาย</th><th>หน่วยนับ</th><th>เริ่ม</th><th>สิ้นสุด</th><th>ผู้ดำเนินการ</th><th class="no-print"></th></tr></thead>' +
      '        <tbody id="cpd2ActivityBody"></tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +

      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">สถานะการอนุมัติแผน</div>' +
      '    <div class="card-body py-3"><div class="row g-2">' +
      '      <div class="col-md-3"><label class="form-label small fw-bold mb-1">สถานะ</label>' +
      '        <select class="form-select form-select-sm" data-cpd="meta.approvalStatus">' +
      '          <option value="ร่าง">ร่าง</option><option value="รออนุมัติ">รออนุมัติ</option><option value="อนุมัติแล้ว">อนุมัติแล้ว</option>' +
      '        </select></div>' +
      field('meta.plannerName', 'ผู้จัดทำแผน', { col: 3 }) +
      field('meta.approverName', 'ผู้อนุมัติ', { col: 3 }) +
      field('meta.approvedAt', 'วันเวลาที่อนุมัติ', { col: 3 }) +
      '    </div></div>' +
      '  </div>' +
      '</div>';
  }

  // =========================================================================
  // TAB 3 — MONTHLY TRACKING
  // =========================================================================

  function buildTab3() {
    var root = $('tab-monthly-track');
    if (!root) return;
    root.innerHTML = '' +
      '<div class="cpd-page-head"><div>' +
      '  <h4 class="mb-1">📅 ติดตามและรายงานผลการแนะนำส่งเสริมรายเดือน</h4>' +
      '  <div class="text-muted small" id="cpd3CoopLine">ปีงบประมาณ 2570 (ต.ค. 69 – ก.ย. 70)</div>' +
      '</div><div class="no-print d-flex gap-2">' +
      '  <button type="button" class="btn btn-sm btn-outline-success" data-action="print-section" data-section="tab-monthly-track">🖨️ พิมพ์</button>' +
      '  <button type="button" class="btn btn-sm btn-success" data-action="save-plan">💾 บันทึกผลรายเดือน</button>' +
      '</div></div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">ส่วนที่ 1: สถานะการเข้าส่งเสริม 12 เดือน</div>' +
      '  <div class="card-body py-3">' +
      '    <div class="cpd-legend mb-2">' +
      '      <span><i class="cpd-dot dot-white"></i> ยังไม่รายงานผล</span>' +
      '      <span><i class="cpd-dot dot-black"></i> ไม่เข้าส่งเสริม</span>' +
      '      <span><i class="cpd-dot dot-yellow"></i> รออนุมัติ</span>' +
      '      <span><i class="cpd-dot dot-green"></i> อนุมัติแล้ว</span>' +
      '      <span class="ms-auto fw-bold">ความคืบหน้า: ' + out('status.progress') + '</span>' +
      '    </div>' +
      '    <div class="table-responsive"><table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.85rem;">' +
      '      <thead class="table-light text-center"><tr><th style="width:14%">เดือน</th><th>สถานะการรายงาน</th><th style="width:16%">ผลจริง (ปริมาณธุรกิจ)</th></tr></thead>' +
      '      <tbody id="cpd3StatusBody"></tbody>' +
      '    </table></div>' +
      '  </div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">ส่วนที่ 2: ปริมาณธุรกิจรายเดือน 12 เดือน (6 ประเภทธุรกิจ)</div>' +
      '  <div class="card-body py-2 table-responsive">' +
      '    <table class="table table-bordered table-sm text-center align-middle mb-0" style="font-size:0.78rem;">' +
      '      <thead class="table-light"><tr><th style="min-width:150px">ประเภทธุรกิจ</th>' +
      S.MONTHS.map(function (m) { return '<th>' + h(m.name.substring(0, 3)) + '.</th>'; }).join('') +
      '      <th class="table-success">รวม</th></tr></thead>' +
      '      <tbody id="cpd3VolumeBody"></tbody>' +
      '      <tfoot class="table-success"><tr><th class="text-end">รวมทั้งเดือน</th>' +
      S.MONTHS.map(function (m) { return '<th>' + out('vol.col.' + m.key) + '</th>'; }).join('') +
      '      <th>' + out('vol.grand') + '</th></tr></tfoot>' +
      '    </table>' +
      '  </div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '  <span>ส่วนที่ 3: บันทึกการลงพื้นที่ปฏิบัติงาน</span>' +
      '  <button type="button" class="btn btn-sm btn-light py-0 fw-bold no-print" data-action="add-visit">➕ เพิ่มรายการ</button></div>' +
      '  <div class="card-body py-2 table-responsive">' +
      '    <table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.82rem;">' +
      '      <thead class="table-light text-center"><tr><th>เป้าหมายการปฏิบัติงาน</th><th>ประเด็นที่เข้าไปปฏิบัติงาน</th><th>วิธีปฏิบัติงาน</th><th>ผลการปฏิบัติงาน</th><th style="width:110px">วันที่ปฏิบัติงาน</th><th class="no-print"></th></tr></thead>' +
      '      <tbody id="cpd3ActivityBody"></tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>';
  }

  // =========================================================================
  // TAB 4 — CLOSING REPORT
  // =========================================================================

  function buildTab4() {
    var root = $('tab-closing-report');
    if (!root) return;
    root.innerHTML = '' +
      '<div class="cpd-page-head"><div>' +
      '  <h4 class="mb-1">📄 รายงานผลการปิดบัญชีและผลสำเร็จด้านการแนะนำส่งเสริมสหกรณ์</h4>' +
      '  <div class="text-muted small" id="cpd4CoopLine">ยังไม่ได้เลือกสหกรณ์</div>' +
      '</div><div class="no-print d-flex gap-2">' +
      '  <button type="button" class="btn btn-sm btn-outline-success" data-action="print-section" data-section="tab-closing-report">🖨️ พิมพ์รายงาน</button>' +
      '  <button type="button" class="btn btn-sm btn-success" data-action="save-plan">💾 บันทึกผลปิดบัญชี</button>' +
      '</div></div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">ข้อมูลทั่วไปของสหกรณ์/กลุ่มเกษตรกร</div>' +
      '  <div class="card-body py-3"><div class="row g-2 cpd-info-grid">' +
      infoCell('สหกรณ์/กลุ่มเกษตรกร', 'info.coopName') +
      infoCell('ชื่อหน่วยงานที่รายงานผล', 'info.officeName') +
      infoCell('สถานะ', 'info.status') +
      infoCell('วันที่จดทะเบียน', 'info.regDate') +
      infoCell('วันสิ้นปีบัญชี', 'info.fiscalEndDate') +
      infoCell('ปีงบประมาณ', 'info.fiscalYear') +
      infoCell('ผู้รายงานผล', 'info.reporter') +
      '  </div></div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">1. ผลสำเร็จด้านการปิดบัญชีและการประชุมใหญ่</div>' +
      '  <div class="card-body py-3"><div class="row g-2">' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ปิดบัญชีได้หรือไม่</label>' +
      '      <select class="form-select form-select-sm" data-cpd="closingReport.canCloseAccount"><option value="">— เลือก —</option><option>ได้</option><option>ไม่ได้</option></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ระยะเวลาการปิดบัญชี</label>' +
      '      <select class="form-select form-select-sm" data-cpd="closingReport.closeAccountTimeframe"><option value="">— เลือก —</option><option>ปิดบัญชีได้ภายใน 30 วัน</option><option>ปิดบัญชีได้เกิน 30 วัน</option></select></div>' +
      field('closingReport.auditorReceiveDate', 'วันที่ผู้สอบบัญชีรับตรวจ', { col: 3, placeholder: 'วว/ดด/ปปปป' }) +
      field('closingReport.auditorCertifyDate', 'วันที่ผู้สอบบัญชีรับรองงบการเงิน', { col: 3, placeholder: 'วว/ดด/ปปปป' }) +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ประชุมใหญ่ได้หรือไม่</label>' +
      '      <select class="form-select form-select-sm" data-cpd="closingReport.canHoldAgm"><option value="">— เลือก —</option><option>ได้</option><option>ไม่ได้</option></select></div>' +
      field('closingReport.agmDate', 'วันที่ประชุมใหญ่สามัญประจำปี', { col: 3, placeholder: 'วว/ดด/ปปปป' }) +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ข้อมูลประกอบการประชุมใหญ่</label>' +
      '      <select class="form-select form-select-sm" data-cpd="closingReport.agmHasFinancialStatement"><option value="">— เลือก —</option><option>มีงบการเงิน</option><option>ไม่มีงบการเงิน</option></select></div>' +
      '    <div class="col-md-3"><label class="form-label small fw-bold mb-1">ระยะเวลาการประชุมใหญ่</label>' +
      '      <select class="form-select form-select-sm" data-cpd="closingReport.agmTimeframe"><option value="">— เลือก —</option><option>ประชุมใหญ่ได้ภายใน 150 วัน</option><option>ประชุมใหญ่ได้เกิน 150 วัน</option></select></div>' +
      field('closingReport.failureReason', 'เหตุผล (กรณีไม่ได้)', { col: 12 }) +
      '  </div></div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">2. ผลสำเร็จด้านการแนะนำส่งเสริม</div>' +
      '  <div class="card-body py-3">' +
      textarea('closingReport.outcome2_1_recovery', '2.1 การฟื้นฟูกิจการ/แก้ไขปัญหาการดำเนินกิจการ', 4) +
      '    <h6 class="fw-bold text-success mt-3">2.2 การส่งเสริมเพิ่มศักยภาพการดำเนินกิจการให้มีมาตรฐานและความเข้มแข็ง</h6>' +
      '    <div class="table-responsive"><table class="table table-bordered table-sm align-middle mb-2" style="font-size:0.82rem;">' +
      '      <thead class="table-light text-center"><tr><th style="width:32%">มิติ / ตัวชี้วัด</th><th>ปี 2568</th><th>ปี 2569</th><th>เปลี่ยนแปลง</th><th>แนวโน้ม</th></tr></thead>' +
      '      <tbody id="cpd4StrengthBody"></tbody>' +
      '    </table></div>' +
      textarea('closingReport.outcome2_3_excellence', '2.3 การพัฒนาต่อยอด/ยกระดับเป็นสหกรณ์/กลุ่มเกษตรกรดีเด่น', 3) +
      textarea('closingReport.outcome2_4_inspection', '2.4 การตรวจการสหกรณ์ตามที่กฎหมายกำหนด', 3) +
      textarea('closingReport.outcome2_5_others', '2.5 เพิ่มเติมประเด็นอื่นๆ', 3) +
      '  </div>' +
      '</div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">3. ความยุ่งยาก/ปัญหาอุปสรรคในการปฏิบัติงาน</div>' +
      '  <div class="card-body py-3">' + textarea('closingReport.obstacles', '', 4) + '</div></div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">4. ข้อเสนอแนะ/แนวทางแก้ไข</div>' +
      '  <div class="card-body py-3">' + textarea('closingReport.recommendations', '', 4) + '</div></div>' +

      '<div class="card shadow-sm mb-3"><div class="card-header py-2">ความเห็นและข้อเสนอแนะของผู้บังคับบัญชา</div>' +
      '  <div class="card-body py-3"><div class="row g-2">' +
      textarea('closingReport.supervisorComment', 'ความเห็นและข้อเสนอแนะ', 3, 12) +
      field('closingReport.supervisorName', 'ผู้เห็นชอบ', { col: 6 }) +
      field('closingReport.supervisorApprovedDate', 'วันที่เห็นชอบ', { col: 6, placeholder: 'วว/ดด/ปปปป' }) +
      '  </div></div>' +
      '</div>';
  }

  function infoCell(label, key) {
    return '<div class="col-md-6 cpd-info-cell"><div class="cpd-info-label">' + h(label) + '</div>' +
      '<div class="cpd-info-value" data-out="' + key + '">-</div></div>';
  }

  // =========================================================================
  // TAB 5 — DASHBOARD
  // =========================================================================

  function buildTab5() {
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
      '    <div class="col-md-2"><label class="form-label small fw-bold mb-1">ปีงบประมาณ</label><select class="form-select form-select-sm" id="cpd5FilterYear"><option value="2570">2570</option></select></div>' +
      '    <div class="col-md-2"><label class="form-label small fw-bold mb-1">อำเภอ</label><select class="form-select form-select-sm" id="cpd5FilterDistrict"></select></div>' +
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

      '<div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '  <span>ทะเบียนคุมแผนและแจ้งเตือนกำหนดการปิดบัญชี 30 วัน / ประชุมใหญ่ 150 วัน</span>' +
      '  <span class="badge bg-light text-dark" id="cpd5RowCount">0 รายการ</span></div>' +
      '  <div class="card-body py-2 table-responsive">' +
      '    <table class="table table-bordered table-hover table-sm align-middle mb-0" style="font-size:0.78rem;">' +
      '      <thead class="table-light text-center"><tr>' +
      '        <th>#</th><th style="min-width:180px">สหกรณ์/กลุ่มเกษตรกร</th><th>อำเภอ</th><th>กสส.</th><th>ผู้ดูแลหลัก</th>' +
      '        <th>วันสิ้นปีบัญชี</th><th>กำหนดปิดบัญชี 30 วัน</th><th>กำหนดประชุมใหญ่ 150 วัน</th>' +
      '        <th>ชั้น 69</th><th>สถานะแผน</th><th>ผลรายเดือน</th><th class="no-print"></th>' +
      '      </tr></thead><tbody id="cpd5Rows"></tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>';
  }

  // =========================================================================
  // FILL / UPDATE
  // =========================================================================

  function fillBoundFields() {
    var state = A();
    document.querySelectorAll('[data-cpd]').forEach(function (el) {
      var v = S.getPath(state, el.dataset.cpd);
      if (v === undefined || v === null) v = '';
      if (Array.isArray(v)) v = v.join('\n');
      if (el.tagName === 'SELECT') {
        if (String(el.value) !== String(v)) el.value = v;
        if (el.selectedIndex === -1 && el.options.length) el.selectedIndex = 0;
      } else if (el.dataset.num) {
        el.value = (S.num(v) === 0) ? '' : v;
      } else {
        el.value = v;
      }
    });

    document.querySelectorAll('[data-indicator]').forEach(function (el) {
      var ind = state.strength.indicators[el.dataset.indicator] || {};
      var v = ind[el.dataset.year];
      el.value = S.num(v) === 0 ? '' : v;
    });

    document.querySelectorAll('[data-monthvol]').forEach(function (el) {
      var v = S.getPath(state, 'scheduleAndActivities.monthlyBusinessVolume.' + el.dataset.monthvol + '.' + el.dataset.month);
      el.value = S.num(v) === 0 ? '' : v;
    });
  }

  function memberTotals() {
    var m = A().coopProfile.members || {};
    var reg = (S.num(m.regularMale) || S.num(m.regularFemale))
      ? S.num(m.regularMale) + S.num(m.regularFemale) : S.num(m.regularTotal);
    var assoc = (S.num(m.associateMale) || S.num(m.associateFemale))
      ? S.num(m.associateMale) + S.num(m.associateFemale) : S.num(m.associateTotal);
    return { regular: reg, associate: assoc, total: reg + assoc };
  }

  function volumeTotals() {
    var vol = A().scheduleAndActivities.monthlyBusinessVolume || {};
    var rows = {};
    var cols = {};
    var grand = 0;
    S.MONTHS.forEach(function (m) { cols[m.key] = 0; });
    S.MONTHLY_BIZ.forEach(function (b) {
      var rowTotal = 0;
      S.MONTHS.forEach(function (m) {
        var v = S.num((vol[b.key] || {})[m.key]);
        rowTotal += v;
        cols[m.key] += v;
      });
      rows[b.key] = rowTotal;
      grand += rowTotal;
    });
    return { rows: rows, cols: cols, grand: grand };
  }

  function updateOutputs() {
    var state = A();
    var bs = state.financials.balanceSheet;
    var inc = state.financials.incomeStatement;
    var ratios = state.financials.ratios;
    var b = state.financials.businesses;
    var st = state.strength;
    var dl = S.computeDeadlines();
    var vol = volumeTotals();
    var mem = memberTotals();

    var map = {
      'members.regularTotal': int(mem.regular),
      'members.associateTotal': int(mem.associate),
      'members.total': int(mem.total),
      'bs.totalAssets': money(bs.totalAssets),
      'bs.totalLiabilities': money(bs.totalLiabilities),
      'bs.totalEquity': money(bs.totalEquity),
      'is.totalSalesService': money(inc.totalSalesService),
      'is.totalCogsService': money(inc.totalCogsService),
      'is.grossProfit': money(inc.grossProfit),
      'is.netSpecificProfit': money(inc.netSpecificProfit),
      'is.netProfit': money(inc.netProfit),
      'ratio.deRatio': money(ratios.deRatio, 2),
      'ratio.roe': money(ratios.roe, 2),
      'ratio.roa': money(ratios.roa, 2),
      'ratio.currentRatio': money(ratios.currentRatio, 2),
      'ratio.reserveToAssetRatio': money(ratios.reserveToAssetRatio, 2),
      'ratio.opexToGrossProfitRatio': money(ratios.opexToGrossProfitRatio, 2),
      'deadline.close30': dl.close30,
      'deadline.agm150': dl.agm150
    };

    ['credit', 'trading', 'collection', 'processing', 'service'].forEach(function (key) {
      map['biz.' + key + '.grossProfit'] = money((b[key] || {}).grossProfit);
      map['biz.' + key + '.netBusinessProfit'] = money((b[key] || {}).netBusinessProfit);
    });

    S.YEARS.forEach(function (y) {
      map['st.dim1.' + y] = int(st.dim1ByYear[y]);
      map['st.dim2.' + y] = int(st.dim2ByYear[y]);
      map['st.dim3.' + y] = int(st.dim3ByYear[y]);
      map['st.dim4.' + y] = int(st.dim4ByYear[y]);
      map['st.total.' + y] = int(st.totalByYear[y]);
      map['st.class.' + y] = st.classByYear[y] || '-';
    });

    var reported = 0;
    S.MONTHS.forEach(function (m) {
      var mv = (state.scheduleAndActivities.monthlyPlan12Months || []).filter(function (x) {
        return x.month === m.name;
      })[0];
      if (mv && mv.statusColor && mv.statusColor !== 'white') reported++;
      map['vol.col.' + m.key] = int(vol.cols[m.key]);
    });
    map['status.progress'] = reported + '/12 เดือน (' + Math.round((reported / 12) * 100) + '%)';
    map['vol.grand'] = int(vol.grand);
    S.MONTHLY_BIZ.forEach(function (biz) {
      map['vol.row.' + biz.key] = int(vol.rows[biz.key]);
    });

    var c = state.coopProfile;
    var officeName = state.meta.officeName || 'สำนักงานสหกรณ์จังหวัดชลบุรี';
    map['info.coopName'] = c.coopName || '-';
    map['info.officeName'] = officeName;
    map['info.status'] = c.status || 'ดำเนินการ';
    map['info.regDate'] = c.regDate || '-';
    map['info.fiscalEndDate'] = c.fiscalEndDate || '-';
    map['info.fiscalYear'] = state.meta.fiscalYear || '2570';
    map['info.reporter'] = c.primaryOfficer || '-';

    document.querySelectorAll('[data-out]').forEach(function (el) {
      var key = el.getAttribute('data-out');
      if (map[key] !== undefined) el.textContent = map[key];
    });

    var line = (c.coopName || 'ยังไม่ได้เลือกสหกรณ์') +
      ' | ' + (c.district || '-') +
      ' | ' + (c.promotionZone || '-') +
      ' | ผู้ดูแลหลัก: ' + (c.primaryOfficer || '-');
    if ($('cpd2CoopLine')) $('cpd2CoopLine').textContent = line;
    if ($('cpd3CoopLine')) $('cpd3CoopLine').textContent = line + ' | ปีงบประมาณ ' + (state.meta.fiscalYear || '2570');
    if ($('cpd4CoopLine')) $('cpd4CoopLine').textContent = line;
  }

  // =========================================================================
  // DYNAMIC TABLES
  // =========================================================================

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
  }

  function renderStatusTable() {
    var body = $('cpd3StatusBody');
    if (!body) return;
    var monthly = A().scheduleAndActivities.monthlyPlan12Months || [];
    var defs = [
      { color: 'white', label: 'ยังไม่รายงานผล' },
      { color: 'black', label: 'ไม่เข้าส่งเสริม' },
      { color: 'yellow', label: 'รออนุมัติ' },
      { color: 'green', label: 'อนุมัติแล้ว' }
    ];
    body.innerHTML = S.MONTHS.map(function (m, idx) {
      var item = monthly.filter(function (x) { return x.month === m.name; })[0] || {};
      var cur = item.statusColor || 'white';
      return '<tr>' +
        '<td class="fw-bold text-center ' + (idx % 2 ? 'bg-light' : '') + '">' + h(m.name) + '</td>' +
        '<td><div class="d-flex flex-wrap gap-1">' +
        defs.map(function (d) {
          return '<button type="button" class="cpd-status-btn status-' + d.color + (cur === d.color ? ' active' : '') +
            '" data-action="set-status" data-index="' + idx + '" data-color="' + d.color + '">' + d.label + '</button>';
        }).join('') +
        '</div></td>' +
        '<td><input type="text" class="form-control form-control-sm text-end" data-cpd="scheduleAndActivities.monthlyPlan12Months[' + idx + '].actualResult" data-num="1"></td>' +
        '</tr>';
    }).join('');
    fillBoundFields();
  }

  function renderMonthlyVolume() {
    var body = $('cpd3VolumeBody');
    if (!body) return;
    var vol = A().scheduleAndActivities.monthlyBusinessVolume || {};
    body.innerHTML = S.MONTHLY_BIZ.map(function (b) {
      return '<tr><td class="text-start fw-bold">' + h(b.label) + '</td>' +
        S.MONTHS.map(function (m) {
          var v = S.num((vol[b.key] || {})[m.key]);
          return '<td><input type="text" class="form-control form-control-sm text-end cpd-vol-input" data-monthvol="' + b.key + '" data-month="' + m.key + '" data-num="1" value="' + (v ? h(v) : '') + '"></td>';
        }).join('') +
        '<td class="fw-bold table-success" data-out="vol.row.' + b.key + '">0</td></tr>';
    }).join('');
    updateOutputs();
  }

  function planActivityDefaults() {
    return [
      { goal: '1. สหกรณ์/กลุ่มเกษตรกรได้รับการแนะนำช่วยเหลือในการฟื้นฟูกิจการ/แก้ไขปัญหาการดำเนินกิจการ', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      { goal: '2. สหกรณ์/กลุ่มเกษตรกรได้รับการส่งเสริมเพิ่มศักยภาพการดำเนินกิจการให้มีความเข้มแข็ง', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      { goal: '3. สหกรณ์/กลุ่มเกษตรกรได้รับการพัฒนาต่อยอด/ยกระดับเป็นสหกรณ์/กลุ่มเกษตรกรที่มีสมรรถนะสูง (ดีเด่น/เลิศรัฐ)', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      { goal: '4. สหกรณ์/กลุ่มเกษตรกรได้รับการตรวจการสหกรณ์ตามที่กฎหมายกำหนด (ระหว่างดำเนินกิจการ)', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      { goal: '5. เพิ่มเติมประเด็นอื่นๆ', target: '', unit: '', startDate: '', endDate: '', operator: '' }
    ];
  }

  function renderActivities() {
    var sch = A().scheduleAndActivities;
    if (!Array.isArray(sch.activities) || sch.activities.length === 0) {
      sch.activities = planActivityDefaults();
    }
    if (!Array.isArray(sch.visitLog)) sch.visitLog = [];

    var body = $('cpd2ActivityBody');
    if (body) {
      body.innerHTML = sch.activities.map(function (a, i) {
        return '<tr>' +
          '<td><textarea class="form-control form-control-sm" rows="2" data-plan-activity="' + i + '" data-pfield="goal">' + h(a.goal || '') + '</textarea></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="target" value="' + h(a.target || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="unit" value="' + h(a.unit || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="startDate" value="' + h(a.startDate || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="endDate" value="' + h(a.endDate || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm" data-plan-activity="' + i + '" data-pfield="operator" value="' + h(a.operator || '') + '"></td>' +
          '<td class="no-print text-center"><button type="button" class="btn btn-sm btn-outline-danger py-0" data-action="del-plan-activity" data-index="' + i + '">✕</button></td>' +
          '</tr>';
      }).join('');
    }

    var visits = $('cpd3ActivityBody');
    if (visits) {
      visits.innerHTML = sch.visitLog.length ? sch.visitLog.map(function (v, i) {
        return '<tr>' +
          '<td><textarea class="form-control form-control-sm" rows="2" data-visit="' + i + '" data-vfield="goal">' + h(v.goal || '') + '</textarea></td>' +
          '<td><textarea class="form-control form-control-sm" rows="2" data-visit="' + i + '" data-vfield="issue">' + h(v.issue || '') + '</textarea></td>' +
          '<td><textarea class="form-control form-control-sm" rows="2" data-visit="' + i + '" data-vfield="method">' + h(v.method || '') + '</textarea></td>' +
          '<td><textarea class="form-control form-control-sm" rows="2" data-visit="' + i + '" data-vfield="result">' + h(v.result || '') + '</textarea></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-visit="' + i + '" data-vfield="date" value="' + h(v.date || '') + '"></td>' +
          '<td class="no-print text-center"><button type="button" class="btn btn-sm btn-outline-danger py-0" data-action="del-visit" data-index="' + i + '">✕</button></td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="6" class="text-center text-muted py-3">ยังไม่มีรายการ — กด "+ เพิ่มรายการ" เพื่อบันทึกการลงพื้นที่</td></tr>';
    }
  }

  function renderTab4StrengthTable() {
    var body = $('cpd4StrengthBody');
    if (!body) return;
    var st = A().strength;
    var dims = [
      { n: 1, title: 'มิติที่ 1: ความสามารถในการให้บริการสมาชิก' },
      { n: 2, title: 'มิติที่ 2: ประสิทธิภาพในการดำเนินธุรกิจ' },
      { n: 3, title: 'มิติที่ 3: ประสิทธิภาพในการจัดการองค์กร' },
      { n: 4, title: 'มิติที่ 4: ประสิทธิภาพของการบริหารงาน' }
    ];
    function trend(a, b) {
      var diff = S.num(b) - S.num(a);
      if (diff > 0) return '<span class="text-success fw-bold">▲ ดีขึ้น (+' + S.fmt(diff, 2) + ')</span>';
      if (diff < 0) return '<span class="text-danger fw-bold">▼ ลดลง (' + S.fmt(diff, 2) + ')</span>';
      return '<span class="text-muted">■ คงที่</span>';
    }
    var html = '';
    dims.forEach(function (d) {
      var a = S.num((st['dim' + d.n + 'ByYear'] || {})['2568']);
      var b = S.num((st['dim' + d.n + 'ByYear'] || {})['2569']);
      html += '<tr class="table-secondary"><td class="fw-bold">' + h(d.title) + '</td>' +
        '<td class="text-center fw-bold">' + S.fmt(a, 2) + '</td>' +
        '<td class="text-center fw-bold">' + S.fmt(b, 2) + '</td>' +
        '<td class="text-center">' + S.fmt(b - a, 2) + '</td>' +
        '<td>' + trend(a, b) + '</td></tr>';
      S.STRENGTH_INDICATORS.filter(function (ind) { return ind.dim === d.n; }).forEach(function (ind) {
        var v68 = S.num((st.indicators[ind.id] || {})['2568']);
        var v69 = S.num((st.indicators[ind.id] || {})['2569']);
        html += '<tr><td><span class="badge bg-success me-1">' + h(ind.id) + '</span>' + h(ind.name) + '</td>' +
          '<td class="text-center">' + (v68 ? S.fmt(v68, 2) : '-') + '</td>' +
          '<td class="text-center">' + (v69 ? S.fmt(v69, 2) : '-') + '</td>' +
          '<td class="text-center">' + ((v68 || v69) ? S.fmt(v69 - v68, 2) : '-') + '</td>' +
          '<td>' + ((v68 || v69) ? trend(v68, v69) : '<span class="text-muted">-</span>') + '</td></tr>';
      });
    });
    body.innerHTML = html;
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

    // ตัวกรอง Dashboard — โหลดข้อมูลใหม่ทันทีเมื่อเปลี่ยนค่า
    if (el.id === 'cpd5FilterYear' ||
      el.id === 'cpd5FilterDistrict' || el.id === 'cpd5FilterType' ||
      el.id === 'cpd5FilterOfficer') {
      loadDashboard(true);
      return;
    }

    var changed = false;

    if (el.matches('[data-cpd]')) {
      var path = el.getAttribute('data-cpd');
      var value = el.dataset.num ? S.num(el.value) : el.value;
      S.setPath(A(), path, value);
      changed = true;
      if (path.indexOf('financials.balanceSheet.') === 0 ||
        path.indexOf('financials.businesses.') === 0 ||
        path.indexOf('financials.incomeStatement.') === 0) {
        S.recalcFinancials();
        refreshSummaryInputs();
      }
      if (path === 'meta.approvalStatus' && value === 'อนุมัติแล้ว' && !A().meta.approvedAt) {
        A().meta.approvedAt = todayThai();
      }
    } else if (el.matches('[data-indicator]')) {
      var ind = el.getAttribute('data-indicator');
      var year = el.getAttribute('data-year');
      var st = A().strength;
      if (!st.indicators[ind]) st.indicators[ind] = { '2567': 0, '2568': 0, '2569': 0 };
      st.indicators[ind][year] = S.num(el.value);
      S.recalcStrength();
      changed = true;
    } else if (el.matches('[data-monthvol]')) {
      var key = el.getAttribute('data-monthvol');
      var month = el.getAttribute('data-month');
      S.setPath(A(), 'scheduleAndActivities.monthlyBusinessVolume.' + key + '.' + month, S.num(el.value));
      changed = true;
    } else if (el.matches('[data-plan-activity]')) {
      var pi = S.num(el.getAttribute('data-plan-activity'));
      var pf = el.getAttribute('data-pfield');
      if (A().scheduleAndActivities.activities[pi]) {
        A().scheduleAndActivities.activities[pi][pf] = el.value;
      }
      changed = true;
    } else if (el.matches('[data-visit]')) {
      var vi = S.num(el.getAttribute('data-visit'));
      var vf = el.getAttribute('data-vfield');
      if (A().scheduleAndActivities.visitLog[vi]) {
        A().scheduleAndActivities.visitLog[vi][vf] = el.value;
      }
      changed = true;
    }

    if (changed) updateOutputs();
    if (el.closest && el.closest('#tab-base-form') && !el.matches('input[type="file"]')) {
      scheduleBaseSync(220);
    }
  }

  function refreshSummaryInputs() {
    var sum = A().financials.summary2Years;
    document.querySelectorAll('[data-cpd^="financials.summary2Years."]').forEach(function (el) {
      var key = el.getAttribute('data-cpd').split('.').pop();
      var v = sum[key];
      el.value = (S.num(v) === 0) ? '' : v;
    });
  }

  function onDocumentClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');

    if (action === 'switch-tab') {
      switchTab(btn.getAttribute('data-tab'));
    } else if (action === 'cpd2-section') {
      activateTab2Section(btn.getAttribute('data-section'));
    } else if (action === 'set-status') {
      var idx = S.num(btn.getAttribute('data-index'));
      var color = btn.getAttribute('data-color');
      var item = A().scheduleAndActivities.monthlyPlan12Months[idx];
      if (item) { item.statusColor = color; renderStatusTable(); updateOutputs(); }
    } else if (action === 'add-activity') {
      A().scheduleAndActivities.activities.push({ goal: '', target: '', unit: '', startDate: '', endDate: '', operator: '' });
      renderActivities();
    } else if (action === 'del-plan-activity') {
      A().scheduleAndActivities.activities.splice(S.num(btn.getAttribute('data-index')), 1);
      renderActivities();
    } else if (action === 'add-visit') {
      A().scheduleAndActivities.visitLog.push({ goal: '', issue: '', method: '', result: '', date: '' });
      renderActivities();
    } else if (action === 'del-visit') {
      A().scheduleAndActivities.visitLog.splice(S.num(btn.getAttribute('data-index')), 1);
      renderActivities();
    } else if (action === 'insert-4m') {
      insert4MStructure();
    } else if (action === 'analyze-4m') {
      populate4MFromBaseForm();
    } else if (action === 'sync-to-base') {
      syncTotalsToBaseForm();
    } else if (action === 'save-plan') {
      saveCompletePlan();
    } else if (action === 'print-section') {
      printSection(btn.getAttribute('data-section'));
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
    } else if (action === 'load-coop') {
      UI.loadCoopForEdit(S.num(btn.getAttribute('data-index')));
    }
  }

  function activateTab2Section(name) {
    document.querySelectorAll('[data-cpd2-pane]').forEach(function (pane) {
      pane.classList.toggle('active', pane.getAttribute('data-cpd2-pane') === name);
    });
    document.querySelectorAll('[data-action="cpd2-section"]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-section') === name);
    });
  }

  // =========================================================================
  // ACTIONS
  // =========================================================================

  function insert4MStructure() {
    var template = '1. บุคลากร (Man)\n' +
      '- คณะกรรมการดำเนินการ จำนวน ... คน มีความรู้ความสามารถและประสบการณ์...\n' +
      '- ผู้ตรวจสอบกิจการ ...\n' +
      '- ฝ่ายจัดการ/เจ้าหน้าที่ประจำ ...\n' +
      '- สมาชิกและสมาชิกที่ร่วมทำธุรกิจ ...\n\n' +
      '2. สำนักงาน/อุปกรณ์ (Material)\n' +
      '- สถานที่ตั้งสำนักงาน ...\n' +
      '- ครุภัณฑ์/อุปกรณ์/ยานพาหนะ ...\n' +
      '- ระบบเทคโนโลยีสารสนเทศ ...\n\n' +
      '3. การเงิน (Money)\n' +
      '- โครงสร้างเงินทุน สินทรัพย์ หนี้สิน ทุนของสหกรณ์ ...\n' +
      '- ผลการดำเนินงานและสภาพคล่อง ...\n' +
      '- แหล่งเงินทุน/ภาระหนี้สิน ...\n\n' +
      '4. การจัดการ (Management)\n' +
      '- ข้อบังคับ ระเบียบ และการควบคุมภายใน ...\n' +
      '- การวางแผน/แผนกลยุทธ์ ...\n' +
      '- การจัดสวัสดิการและการมีส่วนร่วมของสมาชิก ...';
    var box = document.querySelector('[data-cpd="analysis.orgAnalysis4M"]');
    if (!box) return;
    if (!box.value.trim()) {
      box.value = template;
      A().analysis.orgAnalysis4M = template;
    } else {
      box.value += '\n\n' + template;
      A().analysis.orgAnalysis4M = box.value;
    }
    showToast('แทรกโครงสร้าง 4M แล้ว', 'success');
  }

  function syncTotalsToBaseForm() {
    var bs = A().financials.balanceSheet;
    var sum = A().financials.summary2Years;
    setInputValue('asset_latest', bs.totalAssets || sum.assetsLatest);
    setInputValue('debt_latest', bs.totalLiabilities || sum.liabilitiesLatest);
    setInputValue('share_latest', bs.shareCapital || sum.shareCapitalLatest);
    setInputValue('reserve_latest', bs.reserveFund || sum.reserveFundLatest);
    setInputValue('profit_latest', bs.netProfitYear || sum.netProfitLatest);
    setInputValue('loss_latest', bs.accumulatedLoss || sum.accumLossLatest);
    if (typeof global.validateAccountingEquation === 'function') global.validateAccountingEquation();
    S.syncFromBaseFormToAllTabs();
    showToast('ซิงค์ยอดการเงินกลับไปยังฟอร์มหลักแล้ว', 'success');
  }

  function setInputValue(id, value) {
    var el = $(id);
    if (el) el.value = S.num(value) === 0 ? '' : value;
  }

  function todayThai() {
    var d = new Date();
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
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

  function saveCompletePlan() {
    S.syncFromBaseFormToAllTabs();
    var state = A();
    var form = {};
    try {
      if (typeof global.collectFormObject === 'function') form = global.collectFormObject();
    } catch (e) { form = {}; }
    if (!state.coopProfile.coopName) {
      showToast('กรุณาเลือกสหกรณ์ก่อนบันทึก', 'danger');
      return;
    }
    showToast('กำลังบันทึกข้อมูลทุกแท็บ...', 'info');
    global.google.script.run.withSuccessHandler(function (res) {
      state.meta.planId = res.planId || state.meta.planId;
      state.meta.updatedAt = res.savedAt;
      // ข้อมูล Dashboard ต้องโหลดใหม่เมื่อเปิดแท็บครั้งถัดไป ไม่ใช้ค่าค้างก่อนบันทึก
      dashboardData = null;
      showToast('บันทึกสำเร็จเมื่อ ' + res.savedAt, 'success');
      if (form && form.coop_name) {
        global.google.script.run
          .withSuccessHandler(function () {})
          .withFailureHandler(function () {})
          .saveDraftToSheet(form);
      }
      if ($('tab-dashboard') && $('tab-dashboard').classList.contains('active')) {
        loadDashboard(true);
      }
    }).withFailureHandler(function (err) {
      showToast('บันทึกไม่สำเร็จ: ' + err.message, 'danger');
    }).saveCompleteCoopRecord({ state: state, form: form });
  }

  function printSection(sectionId) {
    var name = String(sectionId || '').replace('tab-', '');
    switchTab(name || 'full-plan', true);
    setTimeout(function () {
      try { window.print(); } catch (e) { showToast('เบราว์เซอร์ไม่รองรับการพิมพ์', 'danger'); }
    }, 250);
  }

  // =========================================================================
  // SAVED RECORD AUTO-LOAD
  // =========================================================================

  function selectedCoopInfo() {
    var sel = $('coopSelect');
    if (!sel || sel.value === '' || !global.masterCoops) return null;
    return global.masterCoops[Number(sel.value)] || null;
  }

  function maybeLoadSavedRecord() {
    var c = selectedCoopInfo();
    if (!c) return;
    // โหลด CPD record แม้มีร่างเดิม: ร่างเดิมเติม Tab 1 ก่อน แล้ว full_state_json
    // ที่ใหม่กว่าจะเติมข้อมูล Tab 2-4 ทับอย่างเป็นระเบียบ
    var key = (c.code13 || '') + '|' + c.name + '|2570';
    if (global.__cpdLoadingRecord || global.__cpdLoadedKey === key) return;

    var previousName = A().coopProfile.coopName;
    global.__cpdLoadingRecord = true;
    global.google.script.run.withSuccessHandler(function (res) {
      global.__cpdLoadingRecord = false;
      var current = selectedCoopInfo();
      if (!current || current.name !== c.name) return;
      if (res && res.found && res.state) {
        global.__cpdLoadedKey = key;
        S.loadStateFromRecord(res.state);
        showToast('โหลดข้อมูลที่บันทึกไว้เมื่อ ' + (res.savedAt || '-') + ' แล้ว', 'success');
      } else if (previousName && previousName !== c.name) {
        // เปลี่ยนสหกรณ์ -> เคลียร์ข้อมูลเฉพาะแท็บ 2-4 ไม่ให้ปนกับรายเดิม
        S.replaceState(S.defaultState());
        S.syncFromBaseFormToAllTabs();
        UI.renderAll();
      }
    }).withFailureHandler(function () {
      global.__cpdLoadingRecord = false;
    }).getCompleteCoopRecord({
      fiscalYear: '2570',
      coopId: c.code13 || '',
      coopName: c.name || ''
    });
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
  }

  function fallbackDashboard(filters) {
    var master = (global.masterCoops || []).slice();
    var current = A();
    var currentName = current.coopProfile.coopName;
    var currentPlanned = !!currentName && (!!current.meta.updatedAt ||
      (current.scheduleAndActivities.monthlyPlan12Months || []).some(function (m) {
        return m.statusColor && m.statusColor !== 'white';
      }));

    var optionSets = { promotionZone: {}, district: {}, coopType: {}, primaryOfficer: {} };
    master.forEach(function (c) {
      if (c.zone) optionSets.promotionZone[c.zone] = true;
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
        fiscalYear: '2570',
        coopId: c.code13 || '',
        coopName: c.name,
        district: c.district || '',
        promotionZone: c.zone || '',
        coopSubType: c.coopType || '',
        primaryOfficer: c.mainOfficer || '',
        fiscalEndDate: hasPlan ? current.coopProfile.fiscalEndDate : formatThaiDate(c.fiscalYear),
        targetClose30d: hasPlan ? current.scheduleAndActivities.targetCloseAccountDate30Days : '',
        targetAgm150d: hasPlan ? current.scheduleAndActivities.targetAgm150Days : '',
        assetsLatest: hasPlan ? S.num(sum.assetsLatest) : 0,
        businessVolLatest: hasPlan ? S.num(sum.businessVolumeLatest) : 0,
        class68: cls68,
        class69: cls69,
        strengthScorePrev: S.num(c.score68 && c.score68.total),
        strengthScoreLatest: S.num(c.score69 && c.score69.total),
        dim1: hasPlan ? S.num(st.dim1ByYear['2569']) : S.num(c.score69 && c.score69.d1),
        dim2: hasPlan ? S.num(st.dim2ByYear['2569']) : S.num(c.score69 && c.score69.d2),
        dim3: hasPlan ? S.num(st.dim3ByYear['2569']) : S.num(c.score69 && c.score69.d3),
        dim4: hasPlan ? S.num(st.dim4ByYear['2569']) : S.num(c.score69 && c.score69.d4),
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

    if (rows.length === 0 && currentName) {
      rows.push({
        fiscalYear: '2570', coopId: current.coopProfile.coopId13, coopName: currentName,
        district: current.coopProfile.district, promotionZone: current.coopProfile.promotionZone,
        coopSubType: current.coopProfile.coopSubType, primaryOfficer: current.coopProfile.primaryOfficer,
        fiscalEndDate: current.coopProfile.fiscalEndDate,
        targetClose30d: current.scheduleAndActivities.targetCloseAccountDate30Days,
        targetAgm150d: current.scheduleAndActivities.targetAgm150Days,
        assetsLatest: S.num(current.financials.summary2Years.assetsLatest),
        businessVolLatest: S.num(current.financials.summary2Years.businessVolumeLatest),
        class68: current.strength.classByYear['2568'], class69: current.strength.classByYear['2569'],
        dim1: S.num(current.strength.dim1ByYear['2569']), dim2: S.num(current.strength.dim2ByYear['2569']),
        dim3: S.num(current.strength.dim3ByYear['2569']), dim4: S.num(current.strength.dim4ByYear['2569']),
        approvalStatus: current.meta.approvalStatus, monthlyProgress: 0,
        canCloseAccount: current.closingReport.canCloseAccount,
        closeTimeframe: current.closingReport.closeAccountTimeframe,
        canHoldAgm: current.closingReport.canHoldAgm,
        agmTimeframe: current.closingReport.agmTimeframe,
        hasPlan: true
      });
    }

    var filtered = rows.filter(function (r) {
      return matchFilter(r.district, filters.district) &&
        matchFilter(r.coopSubType, filters.coopType) &&
        matchFilter(r.primaryOfficer, filters.primaryOfficer);
    });
    var agg = aggregateClientRows(filtered);
    return {
      generatedAt: 'แสดงผลจากข้อมูลในเบราว์เซอร์ (ยังเชื่อมต่อฐานข้อมูลไม่ได้)',
      filters: filters,
      filterOptions: {
        fiscalYears: ['2570'],
        promotionZones: Object.keys(optionSets.promotionZone).sort(),
        districts: Object.keys(optionSets.district).sort(),
        coopTypes: Object.keys(optionSets.coopType).sort(),
        primaryOfficers: Object.keys(optionSets.primaryOfficer).sort()
      },
      kpis: agg.kpis,
      zones: agg.zones,
      classDistribution: agg.classDistribution,
      dimAverages: agg.dimAverages,
      rows: filtered
    };
  }

  function matchFilter(value, filter) {
    if (!filter) return true;
    return String(value || '').trim().toLowerCase() === String(filter).trim().toLowerCase();
  }

  /** แปลงวันที่ที่อาจมาเป็น Date หรือข้อความ Date.toString() ให้เป็น วว/ดด/ปปปป (พ.ศ.) */
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
    var zoneMap = {};

    rows.forEach(function (r) {
      if (r.hasPlan) planned++;
      if (r.approvalStatus === 'อนุมัติแล้ว') approved++;
      if (r.canCloseAccount === 'ได้' && String(r.closeTimeframe).indexOf('30') !== -1) closed30++;
      if (r.canHoldAgm === 'ได้' && String(r.agmTimeframe).indexOf('150') !== -1) agm150++;
      if (S.num(r.monthlyProgress) > 0) reported++;
      totalBusinessVolume += S.num(r.businessVolLatest);
      totalAssets += S.num(r.assetsLatest);

      var b68 = classBucket(r.class68);
      var b69 = classBucket(r.class69);
      if (b68) classDistribution.y2568[b68]++;
      if (b69) classDistribution.y2569[b69]++;

      var z = r.promotionZone || 'ไม่ระบุ';
      if (!zoneMap[z]) zoneMap[z] = { zone: z, total: 0, planned: 0, approved: 0, monthlyReported: 0, closed30: 0, agm150: 0, businessVolume: 0 };
      var zb = zoneMap[z];
      zb.total++;
      if (r.hasPlan) zb.planned++;
      if (r.approvalStatus === 'อนุมัติแล้ว') zb.approved++;
      if (S.num(r.monthlyProgress) > 0) zb.monthlyReported++;
      if (r.canCloseAccount === 'ได้' && String(r.closeTimeframe).indexOf('30') !== -1) zb.closed30++;
      if (r.canHoldAgm === 'ได้' && String(r.agmTimeframe).indexOf('150') !== -1) zb.agm150++;
      zb.businessVolume += S.num(r.businessVolLatest);
    });

    function pct(part, all) { return all ? Math.round((part / all) * 1000) / 10 : 0; }

    var zones = Object.keys(zoneMap).sort(function (a, b) { return a.localeCompare(b, 'th'); }).map(function (z) {
      var o = zoneMap[z];
      o.planPct = pct(o.planned, o.total);
      o.approvedPct = pct(o.approved, o.total);
      o.monthlyPct = pct(o.monthlyReported, o.total);
      o.closedPct = pct(o.closed30, o.total);
      o.agmPct = pct(o.agm150, o.total);
      return o;
    });

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
      zones: zones,
      classDistribution: classDistribution,
      dimAverages: dimAverages
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

  function progressColor(pct) {
    if (pct >= 100) return 'bg-success';
    if (pct >= 50) return 'bg-warning';
    return 'bg-danger';
  }

  function progressRow(label, pct, detail) {
    return '<div class="cpd-progress-row">' +
      '<div class="cpd-progress-label">' + h(label) + '</div>' +
      '<div class="progress cpd-progress"><div class="progress-bar ' + progressColor(pct) + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
      '<div class="cpd-progress-value">' + pct + '% <span class="text-muted small">(' + h(detail) + ')</span></div>' +
      '</div>';
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

    // Task 3: แทนที่ความก้าวหน้ารายเขตส่งเสริมด้วยสัญญาณเตือนภัยล่วงหน้า
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
    if (tbody) {
      tbody.innerHTML = rows.length ? rows.map(function (r, i) {
        return '<tr>' +
          '<td class="text-center">' + (i + 1) + '</td>' +
          '<td class="fw-bold">' + h(r.coopName) + '<div class="text-muted" style="font-size:0.72rem">' + h(r.coopId || '') + '</div></td>' +
          '<td>' + h(r.district || '-') + '</td>' +
          '<td class="text-center">' + h(r.promotionZone || '-') + '</td>' +
          '<td>' + h(r.primaryOfficer || '-') + '</td>' +
          '<td class="text-center">' + h(r.fiscalEndDate || '-') + '</td>' +
          '<td class="text-center">' + h(r.targetClose30d || '-') + '</td>' +
          '<td class="text-center">' + h(r.targetAgm150d || '-') + '</td>' +
          '<td class="text-center">' + classBadge(r.class69) + '</td>' +
          '<td class="text-center">' + badgeForPlan(r.approvalStatus) + '</td>' +
          '<td class="text-center">' + (S.num(r.monthlyProgress) ? Math.round(S.num(r.monthlyProgress)) + '%' : '-') + '</td>' +
          '<td class="text-center no-print"><button type="button" class="btn btn-sm btn-outline-success py-0" data-action="load-coop" data-index="' + i + '">โหลดข้อมูลเพื่อแก้ไข</button></td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="12" class="text-center text-muted py-3">ไม่พบข้อมูลตามตัวกรอง</td></tr>';
    }
    if ($('cpd5RowCount')) $('cpd5RowCount').textContent = rows.length + ' รายการ';

    // Task 4: ทะเบียนเอกสาร/รายงาน
    renderReportRegistry();
  }

  UI.loadCoopForEdit = function (index) {
    if (!dashboardData || !dashboardData.rows || !dashboardData.rows[index]) return;
    var row = dashboardData.rows[index];
    showToast('กำลังโหลดข้อมูล ' + row.coopName + '...', 'info');
    global.google.script.run.withSuccessHandler(function (res) {
      if (res && res.found && res.state) {
        S.loadStateFromRecord(res.state);
      } else {
        S.replaceState(S.defaultState());
        var st = A();
        st.meta.fiscalYear = row.fiscalYear || '2570';
        st.coopProfile.coopId13 = row.coopId || '';
        st.coopProfile.coopName = row.coopName || '';
        st.coopProfile.coopSubType = row.coopSubType || '';
        st.coopProfile.orgType = String(row.orgType || '').indexOf('กลุ่มเกษตรกร') !== -1 ? 'กลุ่มเกษตรกร' : 'สหกรณ์';
        st.coopProfile.district = row.district || '';
        st.coopProfile.promotionZone = row.promotionZone || '';
        st.coopProfile.primaryOfficer = row.primaryOfficer || '';
        st.coopProfile.fiscalEndDate = row.fiscalEndDate || '31 มีนาคม';
        st.strength.classByYear['2568'] = row.class68 || '';
        st.strength.classByYear['2569'] = row.class69 || '';
        st.strength.dim1ByYear['2569'] = S.num(row.dim1);
        st.strength.dim2ByYear['2569'] = S.num(row.dim2);
        st.strength.dim3ByYear['2569'] = S.num(row.dim3);
        st.strength.dim4ByYear['2569'] = S.num(row.dim4);
        S.applyAutoDeadlines();
        S.applyStateToBaseForm();
        UI.renderAll();
      }
      switchTab('base-form', true);
      showToast('โหลด ' + row.coopName + ' เข้าสู่แท็บ 1-4 แล้ว', 'success');
      if ($('tab-base-form')) window.scrollTo(0, 0);
    }).withFailureHandler(function (err) {
      showToast('โหลดข้อมูลไม่สำเร็จ: ' + err.message, 'danger');
    }).getCompleteCoopRecord({
      fiscalYear: row.fiscalYear || '2570',
      coopId: row.coopId || '',
      coopName: row.coopName || ''
    });
  };

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
  // TASK 2 — วิเคราะห์ 4M จากฟอร์มพื้นฐาน
  // =========================================================================

  /**
   * analyze4M(basicFormData) — แปลงข้อมูลจากฟอร์มพื้นฐานเป็นข้อความ 4 มิติ
   * ใช้เฉพาะค่าที่มีอยู่จริง ไม่สร้างตัวเลขจำลอง
   */
  function analyze4M(basicFormData) {
    var s = A();
    var p = s.coopProfile || {};
    var f = s.financials || {};
    var sum = f.summary2Years || {};
    var bs = f.balanceSheet || {};
    var st = s.strength || {};
    var mem = p.members || {};
    var membersTotal = S.num(mem.regularMale) + S.num(mem.regularFemale) +
      S.num(mem.associateMale) + S.num(mem.associateFemale);
    if (!membersTotal) membersTotal = S.num(mem.regularTotal) + S.num(mem.associateTotal);
    if (!membersTotal) membersTotal = S.num(mem.prevYearTotal);
    var assets = S.num(bs.totalAssets) || S.num(sum.assetsLatest);
    var liabilities = S.num(bs.totalLiabilities) || S.num(sum.liabilitiesLatest);
    var equity = S.num(bs.totalEquity) || (assets ? assets - liabilities : 0);
    var businessVol = S.num(sum.businessVolumeLatest);
    var biz = Array.isArray(p.mainBusinesses)
      ? p.mainBusinesses.filter(Boolean).join(', ')
      : (p.mainBusinesses || sum.activeBusinessesText || '');
    var products = Array.isArray(p.mainProducts)
      ? p.mainProducts.filter(Boolean).join(', ')
      : (p.mainProducts || '');
    var strength69 = (st.classByYear && st.classByYear['2569']) || '';
    var total69 = S.num(st.totalByYear && st.totalByYear['2569']);
    var d1 = S.num(st.dim1ByYear && st.dim1ByYear['2569']);
    var d2 = S.num(st.dim2ByYear && st.dim2ByYear['2569']);
    var d3 = S.num(st.dim3ByYear && st.dim3ByYear['2569']);
    var d4 = S.num(st.dim4ByYear && st.dim4ByYear['2569']);

    function line(label, value) {
      var ok = value !== '' && value !== undefined && value !== null &&
        !(typeof value === 'number' && value === 0);
      return '- ' + label + ': ' + (ok ? value : 'ยังไม่ระบุ');
    }
    function baht(v) { return v ? S.fmt(v, 2) + ' บาท' : ''; }

    var man = [
      '1. บุคลากร (Man)',
      line('ชื่อสหกรณ์', p.coopName),
      line('จำนวนสมาชิกสามัญ (ชาย/หญิง)',
        (S.num(mem.regularMale) || S.num(mem.regularFemale))
          ? S.num(mem.regularMale) + ' / ' + S.num(mem.regularFemale) : ''),
      line('ยอดรวมสมาชิกสามัญ', S.num(mem.regularTotal) || ''),
      line('สมาชิกสมทบ (ชาย/หญิง)',
        (S.num(mem.associateMale) || S.num(mem.associateFemale))
          ? S.num(mem.associateMale) + ' / ' + S.num(mem.associateFemale) : ''),
      line('ยอดรวมสมาชิกทั้งหมด', membersTotal || ''),
      line('จำนวนกรรมการดำเนินการ (คน)', S.num(p.boardCount) || ''),
      line('ชื่อผู้ตรวจสอบกิจการ', p.inspectorName),
      line('จำนวนผู้ตรวจสอบกิจการ (คน)', S.num(p.inspectorCount) || ''),
      line('ผู้ดูแลหลัก', p.primaryOfficer),
      line('ผู้ดูแลร่วม', p.coOfficer)
    ].join('\n');

    var money = [
      '2. การเงิน (Money)',
      line('สินทรัพย์รวมล่าสุด', baht(assets)),
      line('หนี้สินรวมล่าสุด', baht(liabilities)),
      line('ทุนของสหกรณ์ล่าสุด', baht(equity)),
      line('เงินรับฝาก/หนี้สินหมุนเวียน', baht(S.num(bs.currentLiabilities))),
      line('เงินให้กู้ยืม/สินทรัพย์หมุนเวียน', baht(S.num(bs.currentAssets))),
      line('กำไรสุทธิปีล่าสุด', baht(S.num(sum.netProfitLatest))),
      '- หมายเหตุ: NPL และสภาพคล่องให้ตรวจสอบจากแบบรายงาน MIS ที่เกี่ยวข้อง'
    ].join('\n');

    var material = [
      '3. ทรัพย์สินและผลผลิต (Material)',
      line('ธุรกิจหลัก (เรียงตามมูลค่า)', biz),
      line('ผลผลิต/สินค้าหลัก', products),
      line('ปริมาณธุรกิจล่าสุด', baht(businessVol)),
      line('สินทรัพย์ไม่หมุนเวียน', baht(S.num(bs.nonCurrentAssets))),
      line('สินทรัพย์หมุนเวียน', baht(S.num(bs.currentAssets))),
      '- หมายเหตุ: สต็อก/ผลิตภัณฑ์เฉพาะสหกรณ์ให้ตรวจสอบจากรายงานปริมาณธุรกิจรายเดือน'
    ].join('\n');

    var management = [
      '4. การบริหารจัดการ (Management)',
      line('ชั้นความเข้มแข็งปีล่าสุด (2569)', strength69),
      line('คะแนนรวมปีล่าสุด', total69 ? S.fmt(total69, 2) : ''),
      line('คะแนนมิติที่ 1 (บริการสมาชิก)', d1 ? S.fmt(d1, 2) : ''),
      line('คะแนนมิติที่ 2 (ประสิทธิภาพธุรกิจ)', d2 ? S.fmt(d2, 2) : ''),
      line('คะแนนมิติที่ 3 (จัดการองค์กร)', d3 ? S.fmt(d3, 2) : ''),
      line('คะแนนมิติที่ 4 (บริหารงาน)', d4 ? S.fmt(d4, 2) : ''),
      line('วันสิ้นปีบัญชี', p.fiscalEndDate),
      '- หมายเหตุ: สถานะงบทดลองรายเดือนและการเตรียมปิดบัญชีให้ตรวจสอบจากรายงานใน MIS'
    ].join('\n');

    return [man, money, material, management].join('\n\n');
  }

  /**
   * populate4MFromBaseForm(silent) — ซิงค์ฟอร์มพื้นฐานแล้วสร้างข้อความ 4M
   * silent = true ใช้ตอนสลับหน้า (ไม่ต้องแสดง toast)
   */
  function populate4MFromBaseForm(silent) {
    S.syncFromBaseFormToAllTabs();
    if (typeof S.recalcFinancials === 'function') S.recalcFinancials();
    if (typeof S.recalcStrength === 'function') S.recalcStrength();
    var text = analyze4M(A());
    var box = document.querySelector('[data-cpd="analysis.orgAnalysis4M"]');
    if (box) box.value = text;
    A().analysis.orgAnalysis4M = text;
    if (!silent) showToast('ดึงข้อมูลจากฟอร์มพื้นฐานวิเคราะห์ 4M อัตโนมัติแล้ว', 'success');
    return text;
  }

  // =========================================================================
  // TASK 3 — Early Warning Signals
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
  // TASK 4 — Cooperative & Officer Document Tracking
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

  // =========================================================================
  // PUBLIC + BOOT
  // =========================================================================

  UI.switchTab = switchTab;
  UI.loadDashboard = loadDashboard;
  UI.saveCompletePlan = saveCompletePlan;
  UI.showToast = showToast;
  UI.renderDashboard = renderDashboard;
  UI.analyze4M = analyze4M;
  UI.populate4MFromBaseForm = populate4MFromBaseForm;
  UI.renderReportRegistry = renderReportRegistry;
  UI.renderReportRows = renderReportRows;
  global.CPD_UI = UI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UI.init);
  } else {
    setTimeout(UI.init, 0);
  }
})(window);

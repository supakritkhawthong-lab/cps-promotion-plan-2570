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
    // กู้คืนร่างล่าสุดจาก localStorage ก่อนวาด UI (กันข้อมูลหายเมื่อโหลดหน้าใหม่)
    var restored = null;
    try { restored = S.restoreLocalDraft(); } catch (e) { console.warn('Restore draft:', e); }
    buildTab2();
    buildTab5();
    bindGlobalEvents();
    wireLegacyFunctions();
    switchTab('base-form', true);
    if (restored) {
      fillBoundFields();
      updateOutputs();
      showToast('กู้คืนร่างล่าสุดเมื่อ ' + (restored.savedAt || '-') + ' แล้ว', 'success');
    }
    S.syncFromBaseFormToAllTabs();
    UI.renderAll();
    setTimeout(function () {
      selectStateCoopInDropdown();
      applyMasterStrength69IfMissing();
      S.syncFromBaseFormToAllTabs();
      UI.renderAll();
    }, 300);
  };

  function selectStateCoopInDropdown() {
    var state = A();
    var name = state.coopProfile && state.coopProfile.coopName;
    if (!name || !global.masterCoops || !global.masterCoops.length) return;
    var sel = $('coopSelect');
    if (!sel || sel.value !== '') return;
    var id = state.coopProfile.coopId13 || '';
    var idx = -1;
    for (var i = 0; i < global.masterCoops.length; i++) {
      var mc = global.masterCoops[i];
      if ((id && mc.code13 === id) || mc.name === name) { idx = i; break; }
    }
    if (idx >= 0) {
      sel.value = String(idx);
      global.currentCoopIndex = idx;
      // จำสหกรณ์ที่กู้คืนจากร่าง เพื่อไม่ให้การเลือกซ้ำไปล้างข้อมูลที่เพิ่งกู้คืน
      global.__cpdActiveCoopKey = (state.coopProfile.coopId13 || '') + '|' + name + '|' + (state.meta.fiscalYear || '2570');
    }
  }

  function switchTab(name, silent) {
    var validTabs = ['base-form', 'full-plan', 'dashboard'];
    if (validTabs.indexOf(name) === -1) name = 'base-form';
    if (name === 'full-plan' && !silent) {
      var analysis = (A().analysis || {});
      var keys = ['orgAnalysis4M', 'businessAnalysis', 'welfareAnalysis', 'summaryAnalysis'];
      var hasEmpty = keys.some(function (k) { return !String(analysis[k] || '').trim(); });
      if (hasEmpty) populate4MFromBaseForm(true);
    }
    document.querySelectorAll('.cpd-tab-pane').forEach(function (pane) {
      pane.classList.toggle('active', pane.id === 'tab-' + name);
    });
    document.querySelectorAll('[data-action="switch-tab"]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    // อัปเดตค่าใน input fields หลังเปลี่ยน tab
    fillBoundFields();
    updateOutputs();
    if (!silent) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }
    if (name === 'dashboard') {
      loadDashboard();
      renderMisReports();
    }
  }

  // -------------------------------------------------------------------------
  // Preload (ข้อมูลจริงที่ผ่านการตรวจสอบ) — ใช้กับสหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี จำกัด
  // -------------------------------------------------------------------------

  function preloadFor(name) {
    return (global.CPD_PRELOAD && typeof global.CPD_PRELOAD.get === 'function')
      ? global.CPD_PRELOAD.get(name) : null;
  }

  function currentPreload() {
    return preloadFor(A().coopProfile.coopName);
  }

  // -------------------------------------------------------------------------
  // Uploaded analysis notes (รายงานผู้สอบบัญชี / งบการเงิน / เอกสารที่อัปโหลด)
  // -------------------------------------------------------------------------

  function aiText(value) {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) {
      return value.map(function (v) { return aiText(v); }).filter(Boolean).join('\n');
    }
    return String(value).trim();
  }

  function classifyBusinessName(name) {
    var t = String(name || '');
    if (/ฝาก/.test(t)) return 'deposit';
    if (/กู้|สินเชื่อ|เงินให้กู้/.test(t)) return 'credit';
    if (/แปรรูป|ผลิตสินค้า|ผลิตภัณฑ์/.test(t)) return 'processing';
    if (/รวบรวม|ผลผลิต/.test(t)) return 'collection';
    if (/จัดหา|สินค้า|วัสดุ|ปัจจัยการผลิต/.test(t)) return 'trading';
    if (/บริการ/.test(t)) return 'service';
    return '';
  }

  function inferAuditorCategories(text) {
    var t = String(text || '');
    if (!t) return [];
    var rules = [
      ['ด้านการประชุมคณะกรรมการ', /ประชุม|คณะกรรมการ/],
      ['ด้านผู้ตรวจสอบกิจการ', /ผู้ตรวจสอบกิจการ/],
      ['ด้านเทคโนโลยีสารสนเทศ/โปรแกรมบัญชี', /โปรแกรม|คอมพิวเตอร์|สารสนเทศ|รหัสผ่าน|IT/i],
      ['ด้านหลักประกัน/การเงิน', /หลักประกัน|เงินสด|เงินฝาก|สภาพคล่อง|หนี้สิน/],
      ['ด้านสินทรัพย์/สินค้าคงเหลือ', /สินค้า|ไซโล|ทรัพย์สิน|เสื่อม|คงเหลือ/],
      ['ด้านบัญชี/งบการเงิน', /บัญชี|งบการเงิน|ลูกหนี้|เจ้าหนี้|ค่าใช้จ่าย/],
      ['ด้านกฎหมาย/ข้อบังคับ/ระเบียบ', /ข้อบังคับ|ระเบียบ|กฎหมาย|มาตรา|นายทะเบียน/]
    ];
    return rules.filter(function (r) { return r[1].test(t); }).map(function (r) { return r[0]; });
  }

  function inferHasWeakness(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (/^ไม่พบ(ข้อสังเกต|จุดอ่อน|ข้อบกพร่อง)/.test(t)) return false;
    return /จุดอ่อน|ข้อบกพร่อง|ข้อสังเกต|ไม่ได้|ไม่เป็นไปตาม|ไม่เพียงพอ|ผิดพลาด|ขัดต่อ|ควรปรับปรุง|ทักท้วง/.test(t);
  }

  function inferCorrectionStatus(text) {
    var t = String(text || '');
    if (/ยังไม่ได้(ดำเนินการ|แก้ไข)/.test(t)) return 'ยังไม่ได้ดำเนินการ';
    if (/อยู่ระหว่าง|กำลังดำเนินการ|ระหว่างดำเนินการ/.test(t)) return 'อยู่ระหว่างดำเนินการ';
    if (/แก้ไขแล้ว|ปรับปรุงแล้ว|ดำเนินการแล้ว/.test(t)) return 'แก้ไขแล้ว';
    return '';
  }

  /**
   * applyBusinessSegmentsFromAI(s, segments)
   * แปลงข้อมูลธุรกิจที่ AI สกัดได้ (businessSegments) ลง financials.businesses
   * เพื่อให้ข้อ 2 ด้านการบริหารจัดการธุรกิจนำตัวเลขจากเอกสารที่อัปโหลดไปใช้จริง
   */
  function applyBusinessSegmentsFromAI(s, segments) {
    if (!segments || !segments.length) return false;
    var fin = s.financials || (s.financials = {});
    var b = fin.businesses || (fin.businesses = {});
    var applied = false;

    function ensure(key) {
      if (!b[key]) b[key] = {};
      return b[key];
    }
    function setProfitWithSpecific(target, sales, cost, profit) {
      var gross = S.num(sales) - S.num(cost);
      var diff = S.num(profit) - gross;
      target.grossProfit = gross;
      target.netBusinessProfit = S.num(profit);
      target.specificIncome = diff > 0 ? diff : 0;
      target.specificExpense = diff < 0 ? -diff : 0;
    }

    segments.forEach(function (seg) {
      if (!seg || typeof seg !== 'object') return;
      var key = classifyBusinessName(seg.name || seg.business || seg.type);
      if (!key) return;
      var sales = S.num(seg.sales !== undefined ? seg.sales : (seg.revenue !== undefined ? seg.revenue : seg.amount));
      var cost = S.num(seg.cost !== undefined ? seg.cost : seg.expense);
      var profit = S.num(seg.profit !== undefined ? seg.profit : seg.netProfit);
      var target = ensure(key);

      if (key === 'deposit') {
        target.depositAmount = sales || target.depositAmount || 0;
        target.netBusinessProfit = profit;
      } else if (key === 'credit') {
        target.interestIncome = sales || target.interestIncome || 0;
        target.serviceCost = cost;
        setProfitWithSpecific(target, target.interestIncome, cost, profit);
      } else if (key === 'service') {
        target.serviceIncome = sales || target.serviceIncome || 0;
        target.serviceCost = cost;
        setProfitWithSpecific(target, target.serviceIncome, cost, profit);
      } else {
        target.sales = sales || target.sales || 0;
        target.cogs = cost;
        setProfitWithSpecific(target, target.sales, cost, profit);
      }
      applied = true;
    });
    return applied;
  }

  /**
   * applyUploadedAnalysisNotes(res)
   * เติมข้อสังเกตผู้สอบบัญชี/ข้อมูลธุรกิจ/สวัสดิการที่ AI สกัดจากไฟล์ที่อัปโหลดลง State
   * โดยไม่เขียนทับข้อความที่ผ่านการตรวจสอบแล้ว (preload) ของสหกรณ์นั้น
   */
  function applyUploadedAnalysisNotes(res) {
    if (!res || typeof res !== 'object') return false;
    var s = A();
    if (!s || !s.analysis) return false;

    var pre = currentPreload();
    var preAnalysis = (pre && pre.state && pre.state.analysis) || {};
    var preFourM = (pre && pre.fourM) || {};
    var preBusinessText = Array.isArray(preFourM.businessAnalysis)
      ? preFourM.businessAnalysis.join('\n')
      : String(preFourM.businessAnalysis || '');
    var preOrgText = Array.isArray(preFourM.orgAnalysis4M)
      ? preFourM.orgAnalysis4M.join('\n')
      : String(preFourM.orgAnalysis4M || '');
    var preWelfareText = Array.isArray(preFourM.welfareAnalysis)
      ? preFourM.welfareAnalysis.join('\n')
      : String(preFourM.welfareAnalysis || '');
    preBusinessText = String(preBusinessText || '').trim();
    preOrgText = String(preOrgText || '').trim();
    preWelfareText = String(preWelfareText || '').trim();
    var preAuditorText = String(preAnalysis.auditorObservations || '').trim();
    var preDefectsText = String(preAnalysis.coopDefects || '').trim();
    var applied = false;

    function setText(key, value, verified) {
      var text = aiText(value);
      if (!text) return false;
      var cur = String(s.analysis[key] || '').trim();
      // เก็บข้อความที่ผ่านการตรวจสอบแล้ว (preload) หรือข้อความเดิมที่ตรงกันไว้
      if (verified && cur && cur === verified) return false;
      if (cur === text) return false;
      s.analysis[key] = text;
      var box = document.querySelector('[data-cpd="analysis.' + key + '"]');
      if (box) box.value = text;
      applied = true;
      return true;
    }

    // 1) ข้อสังเกตผู้สอบบัญชี / ข้อบกพร่อง (ถ้า AI ไม่ส่งมา ใช้ issue1-3 เป็นข้อมูลสำรอง)
    var auditorText = aiText(res.auditorObservations);
    var issueTexts = [res.issue1, res.issue2, res.issue3].map(aiText).filter(Boolean);
    if (!auditorText && issueTexts.length) {
      auditorText = issueTexts.map(function (t, i) { return '(' + (i + 1) + ') ' + t; }).join('\n');
    }
    setText('auditorObservations', auditorText, preAuditorText);

    var defectsText = aiText(res.auditorDefects);
    if (!defectsText && issueTexts.length) defectsText = issueTexts.join(', ');
    setText('coopDefects', defectsText, preDefectsText);

    // 2) ข้อวิเคราะห์ 4 ด้านที่ AI สกัดแยกตามหัวข้อจากไฟล์ที่อัปโหลด
    function setUploadedSection(displayKey, uploadedKey, value, verified) {
      var text = aiText(value);
      if (!text) return false;
      // ห้ามเขียนทับข้อความที่ผ่านการตรวจสอบแล้ว (preload) ของสหกรณ์นั้น
      if (verified && String(verified).trim()) return false;
      s.analysis[uploadedKey] = text;
      s.analysis.uploadedSectionsCoop = s.coopProfile.coopName || '';
      s.analysis[displayKey] = text;
      var box = document.querySelector('[data-cpd="analysis.' + displayKey + '"]');
      if (box) box.value = text;
      applied = true;
      return true;
    }
    setUploadedSection('orgAnalysis4M', 'uploadedOrgAnalysis4M', res.orgAnalysis4M, preOrgText);
    setUploadedSection('businessAnalysis', 'uploadedBusinessAnalysis', res.businessAnalysis, preBusinessText);
    setUploadedSection('welfareAnalysis', 'uploadedWelfareAnalysis', res.welfareAnalysis, preWelfareText);
    // สรุปผลการวิเคราะห์: ใช้ข้อความจากไฟล์ เว้นแต่เป็นสหกรณ์ที่มีข้อความตรวจสอบแล้ว
    setUploadedSection('summaryAnalysis', 'uploadedSummaryAnalysis', res.summaryAnalysis,
      preOrgText || preBusinessText || preWelfareText);

    // 3) ข้อมูล/ข้อสังเกตด้านธุรกิจจากเอกสารที่อัปโหลด
    var segments = Array.isArray(res.businessSegments) ? res.businessSegments : [];
    var bizNote = aiText(res.businessObservations);
    if (!bizNote && segments.length) {
      bizNote = segments.map(function (seg) {
        var note = aiText(seg && seg.note);
        if (!note) return '';
        return '- ' + aiText(seg.name || seg.business || 'ธุรกิจ') + ': ' + note;
      }).filter(Boolean).join('\n');
    }
    // สหกรณ์ที่มีข้อความธุรกิจผ่านการตรวจสอบแล้ว (preload) ไม่ต้องเติมทับ
    if (!preBusinessText) {
      if (bizNote) setText('businessObservations', bizNote, '');
      applyBusinessSegmentsFromAI(s, segments);
    }

    // 3) ข้อมูลสวัสดิการ/สาธารณประโยชน์จากเอกสารที่อัปโหลด
    setText('welfareObservations', res.welfareObservations, '');
    setText('publicBenefitObservations', res.publicBenefitObservations, '');
    if (res.welfareFundAmount !== undefined && res.welfareFundAmount !== '') {
      s.analysis.welfareFundAmount = S.num(res.welfareFundAmount);
      applied = true;
    }
    if (res.publicBenefitFundAmount !== undefined && res.publicBenefitFundAmount !== '') {
      s.analysis.publicBenefitFundAmount = S.num(res.publicBenefitFundAmount);
      applied = true;
    }

    // 4) โครงสร้าง fourMDetails.auditorObservations สำหรับ 4M Engine
    var preFourMDetails = pre && pre.state && pre.state.coopProfile && pre.state.coopProfile.fourMDetails;
    var preAuditorObj = preFourMDetails && preFourMDetails.auditorObservations;
    if (!preAuditorObj) {
      var obsText = String(s.analysis.auditorObservations || '').trim();
      var categories = Array.isArray(res.auditorWeaknessCategories)
        ? res.auditorWeaknessCategories.map(aiText).filter(Boolean)
        : [];
      if (!categories.length && obsText) categories = inferAuditorCategories(obsText);
      var hasWeakness = typeof res.auditorInternalControlWeakness === 'boolean'
        ? res.auditorInternalControlWeakness
        : inferHasWeakness(obsText);
      var status = aiText(res.auditorCorrectionStatus);
      if (!/^(แก้ไขแล้ว|อยู่ระหว่างดำเนินการ|ยังไม่ได้ดำเนินการ)$/.test(status)) status = inferCorrectionStatus(obsText);
      if (obsText || categories.length || hasWeakness) {
        s.coopProfile.fourMDetails = s.coopProfile.fourMDetails || {};
        s.coopProfile.fourMDetails.auditorObservations = {
          hasInternalControlWeakness: !!hasWeakness,
          weaknessCategories: categories,
          details: obsText,
          correctionStatus: status
        };
        applied = true;
      }
    }

    if (applied && typeof S.scheduleLocalDraftSave === 'function') S.scheduleLocalDraftSave(300);
    return applied;
  }

  function fillPreloadForm(pre) {
    if (!pre || !pre.form) return;
    Object.keys(pre.form).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = pre.form[id];
    });
    if (typeof global.onAuditorTypeChange === 'function') global.onAuditorTypeChange();
    if (typeof global.validateAccountingEquation === 'function') global.validateAccountingEquation();
  }

  /**
   * mergePreloadState(pre, force)
   * force = true  -> ใช้ตอนเลือกสหกรณ์ (เขียนทับด้วยข้อมูลตรวจสอบแล้ว)
   * force = false -> ใช้หลัง sync (เติมเฉพาะช่องที่ยังว่าง เพื่อไม่ทับข้อมูลที่ผู้ใช้แก้)
   */
  function mergePreloadState(pre, force) {
    if (!pre || !pre.state) return;
    var src = pre.state;
    var s = A();

    if (src.coopProfile) {
      var cp = S.deepClone(src.coopProfile);
      if (!force && cp.members) {
        cp.members.regularMale = S.num(s.coopProfile.members.regularMale) || cp.members.regularMale;
        cp.members.regularFemale = S.num(s.coopProfile.members.regularFemale) || cp.members.regularFemale;
        cp.members.associateMale = S.num(s.coopProfile.members.associateMale) || cp.members.associateMale;
        cp.members.associateFemale = S.num(s.coopProfile.members.associateFemale) || cp.members.associateFemale;
      }
      if (!force) {
        if ((s.coopProfile.mainBusinesses || []).length) delete cp.mainBusinesses;
        if ((s.coopProfile.mainProducts || []).length) delete cp.mainProducts;
      }
      S.mergeDeep(s.coopProfile, cp);
    }

    var fin = src.financials || {};
    if (fin.summary2Years && force) S.mergeDeep(s.financials.summary2Years, fin.summary2Years);

    var hasBsDetail = S.num(s.financials.balanceSheet.totalAssets) > 0 &&
      S.num(s.financials.balanceSheet.currentAssets) > 0;
    if (fin.balanceSheet && (force || !hasBsDetail)) {
      S.mergeDeep(s.financials.balanceSheet, fin.balanceSheet);
    }

    var hasBiz = S.num(s.financials.businesses.trading.sales) > 0 ||
      S.num(s.financials.businesses.processing.sales) > 0 ||
      S.num(s.financials.businesses.collection.sales) > 0 ||
      S.num(s.financials.businesses.service.serviceIncome) > 0 ||
      S.num(s.financials.businesses.credit.interestIncome) > 0;
    if (fin.businesses && (force || !hasBiz)) {
      S.mergeDeep(s.financials.businesses, fin.businesses);
      if (fin.incomeStatement) S.mergeDeep(s.financials.incomeStatement, fin.incomeStatement);
      if (fin.ratios) S.mergeDeep(s.financials.ratios, fin.ratios);
    }

    if (src.strength) {
      var st = src.strength;
      if (force) {
        ['classByYear', 'totalByYear', 'dim1ByYear', 'dim2ByYear', 'dim3ByYear', 'dim4ByYear'].forEach(function (k) {
          if (st[k]) S.mergeDeep(s.strength[k], st[k]);
        });
      }
      if (st.indicators) {
        Object.keys(st.indicators).forEach(function (id) {
          var cur = s.strength.indicators[id] || {};
          var userEdited = S.num(cur['2568']) > 0 && !cur._autoDistributed;
          if (force || !userEdited) {
            s.strength.indicators[id] = S.deepClone(st.indicators[id]);
          }
        });
      }
    }

    // Merge businessDetails
    if (src.businessDetails) {
      if (force) {
        S.mergeDeep(s.businessDetails, src.businessDetails);
      } else {
        // Merge only if empty (check if any business has data)
        var hasBizDetail = false;
        ['deposit', 'loan', 'trading', 'collection', 'processing', 'service'].forEach(function(key) {
          if (s.businessDetails[key] && s.businessDetails[key].participatingMembers > 0) {
            hasBizDetail = true;
          }
        });
        if (!hasBizDetail) {
          S.mergeDeep(s.businessDetails, src.businessDetails);
        }
      }
    }

    if (src.analysis) {
      Object.keys(src.analysis).forEach(function (k) {
        var val = src.analysis[k];
        var empty = Array.isArray(val)
          ? !val.some(function (x) { return String(x || '').trim(); })
          : !String(s.analysis[k] || '').trim();
        if (force || empty) s.analysis[k] = S.deepClone(val);
      });
    }
  }

  /**
   * restoreVerifiedFinancials(pre)
   * recalcFinancials() คำนวณอัตราส่วนและทุนรวมใหม่จากช่องกรอกทุกครั้ง ซึ่งอาจไม่ตรงกับ
   * ตัวเลขที่ผ่านการตรวจสอบแล้ว (เช่น totalEquity/ROE/ROA/current ratio ของ Toyota)
   * ฟังก์ชันนี้คืนค่าที่ตรวจสอบแล้วทับหลัง recalc เพื่อให้การ์ดและข้อความวิเคราะห์ตรงกัน
   */
  function restoreVerifiedFinancials(pre) {
    if (!pre || !pre.state || !pre.state.financials) return;
    var src = pre.state.financials;
    var fin = A().financials;
    if (src.balanceSheet && src.balanceSheet.totalEquity !== undefined) {
      fin.balanceSheet.totalEquity = S.num(src.balanceSheet.totalEquity);
    }
    if (src.ratios) S.mergeDeep(fin.ratios, src.ratios);
  }

  /**
   * applyStrength69Fallback(src)
   * ข้อมูล preload บางแห่งมีผลประเมินเฉพาะปี 2568 ทำให้การ merge ทับผลปี 2569 จาก master จนหาย
   * ฟังก์ชันนี้เติมผลปี 2569 จาก master (ระดับ/คะแนนรวม/4 มิติ) เมื่อยังไม่มีข้อมูลปี 2569
   * src = { level, total, d1, d2, d3, d4 }
   */
  function applyStrength69Fallback(src) {
    if (!src) return false;
    var st = A().strength;
    // มีข้อมูลปี 2569 จริงเมื่อมีคะแนนรวมหรือมิติใดมิติหนึ่งมากกว่า 0
    // (บาง preload มีเพียงระดับชั้นปี 2569 แต่คะแนนเป็น 0 จึงต้องเติมจาก master)
    var has69 = S.num(st.totalByYear['2569']) > 0 ||
      S.num(st.dim1ByYear['2569']) > 0 || S.num(st.dim2ByYear['2569']) > 0 ||
      S.num(st.dim3ByYear['2569']) > 0 || S.num(st.dim4ByYear['2569']) > 0;
    var hasUser69 = S.STRENGTH_INDICATORS.some(function (ind) {
      var d = st.indicators[ind.id] || {};
      return S.num(d['2569']) > 0 && !d._autoDistributed;
    });
    if (has69 || hasUser69) return false;

    var level = src.level || '';
    var total = S.num(src.total);
    var d1 = S.num(src.d1), d2 = S.num(src.d2), d3 = S.num(src.d3), d4 = S.num(src.d4);
    // ต้องมีคะแนนหรือมิติจริง ไม่ใช่มีแต่ชื่อชั้น (ไม่เช่นนั้นจะล้างผลเดิมเป็น 0)
    if (!total && !(d1 || d2 || d3 || d4)) return false;

    st.classByYear['2569'] = level;
    st.totalByYear['2569'] = total;
    st.dim1ByYear['2569'] = d1;
    st.dim2ByYear['2569'] = d2;
    st.dim3ByYear['2569'] = d3;
    st.dim4ByYear['2569'] = d4;

    var map = {
      c69_lv: level,
      c69_tot: total || '',
      c69_d1: d1,
      c69_d2: d2,
      c69_d3: d3,
      c69_d4: d4
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = map[id];
    });

    if (typeof S.recalcStrength === 'function') S.recalcStrength();
    return true;
  }

  /**
   * applyMasterStrength69IfMissing()
   * เติมผลเข้มแข็งปี 2569 จาก master ให้สหกรณ์ที่เลือกอยู่ เมื่อข้อมูลใน State/ฟอร์มยังว่าง
   * (ใช้กับกรณีร่างเดิม/preload ที่มีแต่ผลปี 2568)
   */
  function applyMasterStrength69IfMissing() {
    var c = selectedCoopInfo();
    if (!c) {
      var name = A().coopProfile && A().coopProfile.coopName;
      if (name && global.masterCoops) {
        c = global.masterCoops.filter(function (m) { return m.name === name; })[0] || null;
      }
    }
    if (!c || !c.score69) return false;
    var applied = applyStrength69Fallback({
      level: c.score69.level, total: c.score69.total,
      d1: c.score69.d1, d2: c.score69.d2, d3: c.score69.d3, d4: c.score69.d4
    });
    if (applied) {
      S.applyStateToBaseForm();
      UI.renderAll();
    }
    return applied;
  }

  /** เติมข้อมูล preload ลงฟอร์มหน้า 1 + State แล้ววาดใหม่ทั้งหมด */
  function applyPreloadCoop(pre) {
    if (!pre) return false;
    fillPreloadForm(pre);
    var c = selectedCoopInfo();
    var key = c ? ((c.code13 || '') + '|' + c.name + '|2570') : 'preload';
    global.__cpdLoadedKey = key;
    global.__cpdPreloadKey = key;
    global.__cpdActiveCoopKey = key;
    global.__cpdPreloadApplied = pre;
    S.syncFromBaseFormToAllTabs();
    mergePreloadState(pre, true);
    if (c && c.score69) {
      applyStrength69Fallback({
        level: c.score69.level,
        total: c.score69.total,
        d1: c.score69.d1,
        d2: c.score69.d2,
        d3: c.score69.d3,
        d4: c.score69.d4
      });
    }
    S.recalcFinancials();
    S.recalcStrength();
    if (typeof S.recalc4MRatios === 'function') S.recalc4MRatios();
    // คืนอัตราส่วน/ทุนรวมที่ตรวจสอบแล้วหลัง recalc เพื่อให้ตรงกับข้อความวิเคราะห์
    restoreVerifiedFinancials(pre);
    UI.renderAll();
    return true;
  }

  /** หลัง sync จากหน้า 1 ให้เติมข้อมูล preload เฉพาะส่วนที่หน้า 1 ไม่มี (เช่น สมาชิกชาย/หญิง) */
  function refreshPreloadProfile() {
    var pre = currentPreload();
    if (!pre) return;
    mergePreloadState(pre, false);
  }

  function wireLegacyFunctions() {
    // ห่อฟังก์ชันเดิมเพื่อซิงค์ข้อมูลหลังเลือกสหกรณ์/โหลดร่าง โดยไม่แตะโค้ดเดิม
    if (typeof global.onSelectCoop === 'function' && !global.__cpdWrappedSelect) {
      var origSelect = global.onSelectCoop;
      global.onSelectCoop = function () {
        var c0 = selectedCoopInfo();
        var key = c0 ? ((c0.code13 || '') + '|' + c0.name + '|2570') : '';
        // สังเกตการเปลี่ยนสหกรณ์ก่อนเรียกฟังก์ชันเดิม (dropdown เปลี่ยนค่าแล้วตอน event ทำงาน)
        var changed = !!key && key !== (global.__cpdActiveCoopKey || '');

        var r = origSelect.apply(this, arguments);

        var c = selectedCoopInfo();
        key = c ? ((c.code13 || '') + '|' + c.name + '|2570') : '';
        var pre = c ? preloadFor(c.name) : null;

        // เปลี่ยนสหกรณ์ -> ล้างข้อมูลของสหกรณ์เดิมก่อน เพื่อไม่ให้ข้อมูลหน้า 1 / แท็บ 2-4 รั่วข้ามสหกรณ์
        if (changed) {
          // ล้างค่าที่ถูกเติมจาก preload ของสหกรณ์เดิม (ถ้ามี)
          if (global.__cpdPreloadApplied) {
            var oldPre = global.__cpdPreloadApplied;
            Object.keys(oldPre.form || {}).forEach(function (id) {
              var el = document.getElementById(id);
              if (el) el.value = '';
            });
          }
          global.__cpdPreloadApplied = null;
          global.__cpdPreloadKey = '';
          global.__cpdLoadedKey = '';
          S.loadStateFromRecord(S.defaultState());
          // เติมข้อมูลระบุตัวตน/คะแนน/แผน 12 เดือน/ร่างที่บันทึกไว้ของสหกรณ์ใหม่กลับเข้าไป
          r = origSelect.apply(this, arguments);
          c = selectedCoopInfo();
          key = c ? ((c.code13 || '') + '|' + c.name + '|2570') : '';
          pre = c ? preloadFor(c.name) : null;
          if (c && typeof global.setFiscalDropdownByText === 'function') {
            global.setFiscalDropdownByText(c.fiscalYear || '31 มีนาคม');
          }
        }

        if (pre) {
          applyPreloadCoop(pre);
        } else {
          global.__cpdPreloadKey = '';
        }
        global.__cpdActiveCoopKey = key;
        scheduleBaseSync(120);

        // Zero-Click Auto Pipeline: หลังจาก sync แล้ว ให้รัน 4M และ 5.2 อัตโนมัติ
        setTimeout(function () {
          if (!pre) maybeLoadSavedRecord();
          applyMasterStrength69IfMissing();
          autoPipeline4M(); // Zero-Click Pipeline
        }, 400);

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
        selectStateCoopInDropdown();
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
      '    <button type="button" class="btn btn-sm btn-primary" data-action="save-draft">💾 บันทึกร่าง (Save Draft)</button>' +
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
      field('financials.incomeStatement.totalSalesService', 'รายได้จากการขาย/บริการ', { num: 1, col: 6 }) +
      field('financials.incomeStatement.totalCogsService', 'ต้นทุนขาย/บริการ', { num: 1, col: 6 }) +
      '      <div class="col-md-6"><div class="d-flex justify-content-between py-1 border-bottom"><span>กำไรขั้นต้น</span><strong class="text-success">' + out('is.grossProfit') + '</strong></div></div>' +
      field('financials.incomeStatement.specificExpense', 'ค่าใช้จ่ายเฉพาะธุรกิจ', { num: 1, col: 6 }) +
      '      <div class="col-md-6"><div class="d-flex justify-content-between py-1 border-bottom"><span>กำไรเฉพาะธุรกิจ</span><strong class="text-success">' + out('is.netSpecificProfit') + '</strong></div></div>' +
      field('financials.incomeStatement.otherIncome', 'รายได้อื่น', { num: 1, col: 4 }) +
      '      <div class="col-md-4"><div class="d-flex justify-content-between py-1 border-bottom"><span>กำไรก่อนหักค่าใช้จ่ายดำเนินงาน</span><strong class="text-info fw-bold">' + out('is.profitBeforeOpEx') + '</strong></div></div>' +
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
      '        <input type="text" class="form-control form-control-sm text-end fw-bold" data-cpd="financials.ratios.shortTermDebtPaidOnTimeRatio" data-num="1" placeholder="0.00"></div></div>' +
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
      '      <button type="button" class="btn btn-sm btn-warning py-0 fw-bold" data-action="add-weakness-activities">🎯 ส่งแนวทางแก้ไขจุดอ่อนไปยังตารางเป้าหมาย (5.2)</button>' +
      '      <button type="button" class="btn btn-sm btn-light py-0 fw-bold" data-action="insert-4m">➕ แทรกโครงสร้างหัวข้อ 4M ตั้งต้น</button>' +
      '    </span></div>' +
      '    <div class="card-body py-3"><div class="row g-3">' +
      textarea('analysis.orgAnalysis4M', '1. ด้านการบริหารจัดการองค์กร (หลัก 4M)', 7) +
      textarea('analysis.businessAnalysis', '2. ด้านการบริหารจัดการธุรกิจ', 10) +
      textarea('analysis.welfareAnalysis', '3. ด้านการจัดสวัสดิการและสาธารณประโยชน์', 4) +
      textarea('analysis.summaryAnalysis', '4. สรุปผลการวิเคราะห์', 4) +
      textarea('analysis.auditorObservations', 'ข้อสังเกตของผู้สอบบัญชี (ปีบัญชีล่าสุด)', 3, 6) +
      textarea('analysis.coopDefects', 'ข้อบกพร่องของสหกรณ์ (ปีบัญชีล่าสุด)', 3, 6) +
      '    </div></div>' +
      '  </div>' +
      '</div>';
  }

  /**
   * isBusinessActive() - ตรวจสอบว่าธุรกิจมีข้อมูลจริงหรือไม่ (Auto-Detection)
   */

  /**
   * generateBusinessAnalysis() - สร้างข้อความวิเคราะห์ธุรกิจจากข้อมูลที่ดึงมาจากไฟล์
   */
  function generateBusinessAnalysis() {
    var engine = global.CPD_BIZ_ENGINE;
    if (!engine || typeof engine.generateAllAnalyses !== 'function') {
      return;
    }
    
    var state = A();
    var analyses = engine.generateAllAnalyses(state);
    
    // รวมข้อความวิเคราะห์ทุกธุรกิจ
    var lines = [];
    lines.push('ด้านการบริหารจัดการธุรกิจ');
    lines.push('');
    
    var bizOrder = ['deposit', 'loan', 'trading', 'collection', 'processing', 'service'];
    bizOrder.forEach(function (key) {
      if (analyses[key]) {
        lines.push(analyses[key]);
        lines.push('');
      }
    });
    
    var businessAnalysis = lines.join('\n');
    
    // อัปเดต state
    if (!state.analysis) state.analysis = {};
    state.analysis.businessAnalysis = businessAnalysis;
    
    // อัปเดต textarea
    var textarea = document.querySelector('[data-cpd="analysis.businessAnalysis"]');
    if (textarea) {
      textarea.value = businessAnalysis;
    }
    
    // สร้างสรุปปัญหาจากธุรกิจ
    var summaryIssues = engine.generateBusinessSummary(state);
    if (summaryIssues.length > 0 && !state.analysis.uploadedSummaryAnalysis) {
      // เพิ่มเข้าไปใน summaryAnalysis
      var currentSummary = state.analysis.summaryAnalysis || '';
      var newSummary = currentSummary + '\n\nสรุปจากธุรกิจ:\n' + summaryIssues.map(function (issue) {
        return '- ' + issue;
      }).join('\n');
      state.analysis.summaryAnalysis = newSummary;
      var summaryTextarea = document.querySelector('[data-cpd="analysis.summaryAnalysis"]');
      if (summaryTextarea) {
        summaryTextarea.value = newSummary;
      }
    }
    
    if (Object.keys(analyses).length > 0) {
      showToast('สร้างข้อความวิเคราะห์ธุรกิจ ' + Object.keys(analyses).length + ' ธุรกิจสำเร็จ', 'success');
    }
  }


  function buildTab2Schedule() {
    return '' +
      '<div class="cpd-subsection" data-cpd2-pane="schedule">' +
      '  <div class="card shadow-sm mb-3"><div class="card-header py-2">5.1 แผนการปิดบัญชี (ภายใน 30 วัน) และแผนการประชุมใหญ่ประจำปี (ภายใน 150 วัน)</div>' +
      '    <div class="card-body py-3">' +
      '      <div class="row g-2 mb-3">' +
      '        <div class="col-md-4"><label class="form-label small fw-bold mb-1">วันสิ้นปีบัญชี (จากหน้า 1)</label>' +
      '          <div class="form-control form-control-sm bg-light fw-bold" data-out="info.fiscalEndDate">-</div></div>' +
      '        <div class="col-md-4"><label class="form-label small fw-bold mb-1 text-primary">วันประชุมใหญ่สามัญประจำปี</label>' +
      '          <input type="text" class="form-control form-control-sm fw-bold" id="cpd2AgmDate" data-cpd="closingReport.agmDate" placeholder="วว/ดด/ปปปป"></div>' +
      '        <div class="col-md-4"><label class="form-label small fw-bold mb-1 text-success">วันที่รับรองงบการเงิน (อัตโนมัติ)</label>' +
      '          <div class="form-control form-control-sm bg-light fw-bold text-success" data-out="deadline.certify">-</div></div>' +
      '      </div>' +
      '      <div class="table-responsive">' +
      '        <table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.85rem;">' +
      '          <thead class="table-light text-center"><tr><th style="width:55%">รายการ</th><th>วันที่กำหนด</th></tr></thead>' +
      '          <tbody>' +
      '            <tr><td>แผนการปิดบัญชี (ภายใน 30 วัน)</td><td class="text-center fw-bold text-success" data-out="deadline.close30">-</td></tr>' +
      '            <tr><td>แผนการประชุมใหญ่ประจำปี (ภายใน 150 วัน)</td><td class="text-center fw-bold text-primary" data-out="deadline.agm150">-</td></tr>' +
      '            <tr><td>วันที่รับรองงบการเงิน (ต้องอยู่เดือนเดียวกับประชุมใหญ่ และไม่เกินวันประชุมใหญ่)</td><td class="text-center fw-bold text-success" data-out="deadline.certify">-</td></tr>' +
      '          </tbody>' +
      '        </table>' +
      '      </div>' +
      '      <div class="form-text mt-2">ระบบปรับปีบัญชี/ปีงบประมาณ พ.ศ. ในตารางกิจกรรมด้านล่างให้อัตโนมัติ เมื่อเปลี่ยนวันประชุมใหญ่หรือปีบัญชี</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="card shadow-sm mb-3"><div class="card-header py-2 d-flex justify-content-between align-items-center">' +
      '    <span>5.2 ตารางเป้าหมายงาน/กิจกรรมที่จะดำเนินการ (5 หัวข้อหลัก — กด ➕ เพิ่มกิจกรรมย่อยได้แต่ละข้อ)</span>' +
      '    <button type="button" class="btn btn-sm btn-light py-0 fw-bold no-print" data-action="add-activity">➕ เพิ่มหัวข้อหลัก</button></div>' +
      '    <div class="card-body py-2 table-responsive">' +
      '      <table class="table table-bordered table-sm align-middle mb-0" style="font-size:0.82rem;">' +
      '        <thead class="table-light text-center"><tr><th style="width:38%">เป้าหมายงาน/กิจกรรม</th><th>ค่าเป้าหมาย</th><th>หน่วยนับ</th><th>วันเริ่มต้น</th><th>วันสิ้นสุด</th><th>ผู้ดำเนินการ</th><th class="no-print"></th></tr></thead>' +
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
      '  <button type="button" class="btn btn-sm btn-primary" data-action="save-draft">💾 บันทึกร่าง</button>' +
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

      // MIS Report Tracking Section
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
    var dl = S.deriveAgmDates();
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
      'is.profitBeforeOpEx': money(inc.profitBeforeOpEx),
      'is.netProfit': money(inc.netProfit),
      'ratio.deRatio': money(ratios.deRatio, 2),
      'ratio.roe': money(ratios.roe, 2),
      'ratio.roa': money(ratios.roa, 2),
      'ratio.currentRatio': money(ratios.currentRatio, 2),
      'ratio.reserveToAssetRatio': money(ratios.reserveToAssetRatio, 2),
      'ratio.opexToGrossProfitRatio': money(ratios.opexToGrossProfitRatio, 2),
      'deadline.close30': dl.close30,
      'deadline.agm150': dl.agmDate,
      'deadline.certify': dl.certifyDate
    };

    ['credit', 'trading', 'collection', 'processing', 'service'].forEach(function (key) {
      map['biz.' + key + '.grossProfit'] = money((b[key] || {}).grossProfit);
      map['biz.' + key + '.netBusinessProfit'] = money((b[key] || {}).netBusinessProfit);
    });

    S.YEARS.forEach(function (y) {
      map['st.dim1.' + y] = S.fmt(st.dim1ByYear[y], 2);
      map['st.dim2.' + y] = S.fmt(st.dim2ByYear[y], 2);
      map['st.dim3.' + y] = S.fmt(st.dim3ByYear[y], 2);
      map['st.dim4.' + y] = S.fmt(st.dim4ByYear[y], 2);
      map['st.total.' + y] = S.fmt(st.totalByYear[y], 2);
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

  /**
   * detectCoopProfile() - แยกประเภทสหกรณ์เป็น 4 profiles ตามเกณฑ์
   * A: สหกรณ์ออมทรัพย์ / เครดิตยูเนี่ยน
   * B: สหกรณ์การเกษตร / ประมง / นิคม / ปศุสัตว์ / พืชเศรษฐกิจ
   * C: สหกรณ์ร้านค้า / บริการ / เคหสถาน
   * D: กลุ่มเกษตรกร
   */
  function detectCoopProfile() {
    var s = A();
    var coopType = (s.coopProfile.coopSubType || '') + ' ' + (s.coopProfile.coopName || '');
    var coopTypeLower = coopType.toLowerCase();
    
    if (/ออมทรัพย์|เครดิตยูเนี่ยน/.test(coopTypeLower)) {
      return 'A'; // สหกรณ์ออมทรัพย์ / เครดิตยูเนี่ยน
    } else if (/การเกษตร|ประมง|นิคม|ไก่ไข่|โคนม|สวนยาง|อ้อย|ปาล์ม|มันสำปะหลัง/.test(coopTypeLower)) {
      return 'B'; // สหกรณ์การเกษตร / ประมง / นิคม
    } else if (/ร้านค้า|บริการ|เคหสถาน/.test(coopTypeLower)) {
      return 'C'; // สหกรณ์ร้านค้า / บริการ / เคหสถาน
    } else if (/กลุ่มเกษตรกร/.test(coopTypeLower)) {
      return 'D'; // กลุ่มเกษตรกร
    }
    return 'B'; // Default เป็น Profile B (การเกษตร)
  }

  /**
   * getProfileBenchmarks(profile) - ดึงเกณฑ์ benchmark ตาม profile
   */
  function getProfileBenchmarks(profile) {
    var benchmarks = {
      'A': {
        name: 'สหกรณ์ออมทรัพย์ / เครดิตยูเนี่ยน',
        deRatioThreshold: 2.0,
        collectionRateThreshold: 90,
        focusBusiness: ['credit', 'deposit'],
        autoActivity: 'ติดตามการควบคุมคุณภาพสินเชื่อ การบริหารสภาพคล่อง และการปฏิบัติตามเกณฑ์กำกับดูแลสหกรณ์ออมทรัพย์'
      },
      'B': {
        name: 'สหกรณ์การเกษตร / ประมง / นิคม',
        deRatioThreshold: 1.5,
        currentRatioOptimal: { min: 1.2, max: 2.5 },
        collectionRateThreshold: 80,
        opexRatioThreshold: 65,
        focusBusiness: ['trading', 'collection', 'processing'],
        autoActivity: 'ส่งเสริมการวางแผนธุรกิจจัดหาปัจจัยการผลิต/รวบรวม/แปรรูปผลผลิต การบริหารสินค้าคงเหลือ และการเร่งรัดหนี้ค้างชำระก่อนสิ้นปีบัญชี'
      },
      'C': {
        name: 'สหกรณ์ร้านค้า / บริการ / เคหสถาน',
        deRatioThreshold: 1.5,
        currentRatioOptimal: { min: 1.0, max: 2.5 },
        opexRatioThreshold: 70,
        focusBusiness: ['trading', 'service'],
        autoActivity: 'แนะนำการควบคุมภายในด้านการรับ-จ่ายเงิน การบริหารต้นทุนบริการ/สินค้าคงคลัง และการติดตามลูกหนี้ค้างชำระ'
      },
      'D': {
        name: 'กลุ่มเกษตรกร',
        deRatioThreshold: 1.0,
        focusBusiness: [],
        autoActivity: 'แนะนำการจัดทำบัญชีรายเดือนให้เป็นปัจจุบัน การเตรียมปิดบัญชีภายใน 30 วัน และการส่งเสริมสมาชิกทำธุรกิจร่วมกับกลุ่มเกษตรกร'
      }
    };
    return benchmarks[profile] || benchmarks['B'];
  }

  /**
   * autoPipeline4M() - Zero-Click Auto Pipeline
   * Step A: Sync Tab 1 → Tab 2
   * Step B: Auto-generate 4M (silent mode)
   * Step C: Auto-generate 5.2 activities (clear old auto-generated first)
   */
  function autoPipeline4M() {
    try {
      // Step A: Sync Tab 1 → Tab 2 (แล้วเติมข้อมูล preload เฉพาะส่วนที่หน้า 1 ไม่มี)
      S.syncFromBaseFormToAllTabs();
      refreshPreloadProfile();
      
      // Step B: Auto-generate 4M (silent mode - no toast, but force refresh for new coop/AI data)
      populate4MFromBaseForm(true, true);
      
      // Step C: Clear old auto-generated activities and generate new ones
      clearAutoGeneratedActivities();
      addWeaknessActivitiesFrom4M();
      
      console.log('[AutoPipeline] Completed: Sync → 4M → 5.2');
    } catch (e) {
      console.error('[AutoPipeline] Error:', e);
    }
  }

  /**
   * clearAutoGeneratedActivities() - ลบกิจกรรมที่สร้างอัตโนมัติ (data-auto-4m)
   */
  function clearAutoGeneratedActivities() {
    var s = A();
    var activities = s.scheduleAndActivities.activities || [];
    
    // กรองเฉพาะกิจกรรมที่ไม่ใช่ auto-generated
    var filtered = activities.filter(function(a) {
      return !a.autoGenerated;
    });
    
    s.scheduleAndActivities.activities = filtered;
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

  function planYearInfo() {
    var planYear = S.num(A().meta.fiscalYear) || 2570;
    var acctYear = planYear - 1;
    return {
      planYear: planYear,
      acctYear: acctYear,
      latestStrengthYear: planYear - 2,
      targetStrengthYear: planYear - 1,
      assessmentYear: planYear,
      startYear: planYear - 1,
      endYear: planYear
    };
  }

  function thDate(day, month, year) {
    return ('0' + day).slice(-2) + '/' + ('0' + month).slice(-2) + '/' + year;
  }

  function planActivityDefaults() {
    var y = planYearInfo();
    var agm = S.deriveAgmDates();
    var agmParts = S.parseDateParts(agm.agmDate) || { day: 27, month: 2, year: y.planYear };
    var agmMonth = ('0' + agmParts.month).slice(-2);
    var agmYear = agmParts.year;
    // วันที่รับรองงบ: แสดงเฉพาะเดือน+ปี ตาม Template (เช่น "กุมภาพันธ์ 2569")
    var certifyMonthYear = agm.certifyDate; // มาจาก deriveCertifyDate() ที่เป็น month+year แล้ว
    var close30 = agm.close30; // วันปิดบัญชี 30 วัน
    return [
      { code: '1', isHeader: true, auto: true, goal: '1. สหกรณ์/กลุ่มเกษตรกรได้รับการแนะนำช่วยเหลือในการฟื้นฟูกิจการ/แก้ไขปัญหาการดำเนินกิจการ', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      { code: '2', isHeader: true, auto: true, goal: '2. สหกรณ์/กลุ่มเกษตรกรได้รับการส่งเสริมเพิ่มศักยภาพการดำเนินกิจการให้มีความเข้มแข็ง', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      {
        code: '2.1', auto: true, target: '1', unit: 'ครั้ง', startDate: thDate(1, 10, y.startYear), endDate: thDate(31, 1, y.endYear), operator: 'เจ้าหน้าที่ส่งเสริม',
        goal: '2.1 ร่วมประชุมคณะกรรมการฯ เพื่อแนะนำส่งเสริมให้สหกรณ์สามารถรักษาระดับชั้น 1 ในปี ' + y.targetStrengthYear +
          ' โดยชี้แจงผลเข้มแข็งปี ' + y.latestStrengthYear + ' พร้อมประมาณการคะแนนเข้มแข็ง ปี ' + y.targetStrengthYear +
          ' และแนะนำส่งเสริมเกี่ยวกับ การปรับปรุงการควบคุมภายใน การจัดและจ่ายสวัสดิการ การจัดทำบันทึกบัญชีให้เป็นปัจจุบัน รวมทั้งการจัดทำงบการเงินและปิดบัญชีประจำปีได้และส่งงบการเงินให้ผู้สอบได้ภายใน 30 วัน นับแต่วันสิ้นปีทางบัญชี และจัดประชุมใหญ่ ภายใน 150 วัน แบบมีงบการเงิน'
      },
      {
        code: '2.2', auto: true, target: '1', unit: 'ครั้ง', startDate: certifyMonthYear, endDate: certifyMonthYear, operator: 'เจ้าหน้าที่ส่งเสริม',
        goal: '2.2 ร่วมประชุมคณะกรรมการฯ เพื่อรับรองงบการเงินของสหกรณ์ ปีบัญชี ' + y.acctYear +
          ' (ช่วงเวลารับรองงบอยู่ในเดือนเดียวกับเดือนประชุมใหญ่ และไม่เกินวันประชุมใหญ่)'
      },
      {
        code: '2.3', auto: true, target: '1', unit: 'ครั้ง', startDate: thDate(1, Number(agmMonth), agmYear), endDate: agm.agmDate, operator: 'เจ้าหน้าที่ส่งเสริม',
        goal: '2.3 เข้าร่วมประชุมใหญ่สามัญ ประจำปี ' + y.acctYear
      },
      {
        code: '2.4', auto: true, target: '2', unit: 'ครั้ง', startDate: thDate(1, 10, y.startYear), endDate: thDate(30, 9, y.endYear), operator: 'เจ้าหน้าที่ส่งเสริม',
        goal: '2.4 ร่วมประชุมคณะกรรมการฯ เพื่อแนะนำส่งเสริมให้สหกรณ์มีการจัดทำแผนกลยุทธ์ และ/หรือร่วมจัดทำแผนกลยุทธ์กับสหกรณ์ หรือ ตรวจเยี่ยมสหกรณ์เพื่อติดตามความก้าวหน้าในการดำเนินการของสหกรณ์ให้เป็นไปตามระเบียบ ข้อบังคับ และกฎหมายที่เกี่ยวข้อง และแนะนำผลจากการตรวจสอบกิจการและฐานะการเงิน'
      },
      { code: '3', isHeader: true, auto: true, goal: '3. สหกรณ์/กลุ่มเกษตรกรได้รับการพัฒนาต่อยอด/ยกระดับเป็นสหกรณ์/กลุ่มเกษตรกรที่มีสมรรถนะสูง (ดีเด่น/เลิศรัฐ)', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      { code: '4', isHeader: true, auto: true, goal: '4. สหกรณ์/กลุ่มเกษตรกรได้รับการตรวจการสหกรณ์ตามที่กฎหมายกำหนด (ระหว่างดำเนินกิจการ)', target: '', unit: '', startDate: '', endDate: '', operator: '' },
      { code: '5', isHeader: true, auto: true, goal: '5. เพิ่มเติมประเด็นอื่นๆ', target: '', unit: '', startDate: '', endDate: '', operator: '' }
    ];
  }

  /**
   * syncActivitiesFromMonthlyPlan() — ดึงกิจกรรมจากแผน 12 เดือน (หน้า 1) มาใส่ตาราง 5.2
   * เฉพาะ cpdAction ที่มีคำว่า "ประชุม" หรือ "เข้าร่วม" จะถูกดึงมาใส่ในหัวข้อ 2
   */
  function syncActivitiesFromMonthlyPlan() {
    var sch = A().scheduleAndActivities;
    if (!Array.isArray(sch.monthlyPlan12Months) || sch.monthlyPlan12Months.length === 0) return;
    
    // ดึง cpdAction ที่มีคำว่า "ประชุม" หรือ "เข้าร่วม" จาก monthlyPlan12Months
    // จองเลขรหัส 2.x ล่วงหน้า เพื่อไม่ให้ซ้ำกันระหว่างหลายเดือน
    var usedCodes = (sch.activities || [])
      .filter(function (a) { return a.code && a.code.indexOf('2.') === 0 && !a.syncedFromPlan; })
      .map(function (a) { return parseInt(a.code.split('.')[1], 10) || 0; });
    var nextNum = 5;

    var meetingActivities = sch.monthlyPlan12Months
      .filter(function (m) {
        return m.cpdAction && /ประชุม|เข้าร่วม/.test(m.cpdAction);
      })
      .filter(function (m) {
        // กรองไม่ให้นัดหมายซ้ำกับ 2.1-2.4
        var text = m.cpdAction;
        if (/คณะกรรมการฯ เพื่อแนะนำส่งเสริม/.test(text) && /รักษาระดับชั้น/.test(text)) return false; // ซ้ำกับ 2.1
        if (/รับรองงบการเงิน/.test(text)) return false; // ซ้ำกับ 2.2
        if (/ประชุมใหญ่สามัญ/.test(text)) return false; // ซ้ำกับ 2.3
        if (/แผนกลยุทธ์/.test(text)) return false; // ซ้ำกับ 2.4
        return true;
      })
      .map(function (m) {
        // หาเลขลำดับถัดไป (ไม่ซ้ำกับรหัสที่มีอยู่ และไม่ซ้ำกับเดือนก่อนหน้า)
        while (usedCodes.indexOf(nextNum) !== -1) nextNum++;
        var assigned = nextNum;
        usedCodes.push(assigned);
        nextNum++;
        
        return {
          code: '2.' + assigned,
          auto: true,
          goal: m.cpdAction,
          target: '1',
          unit: 'ครั้ง',
          startDate: A().scheduleAndActivities.targetCloseAccountDate30Days || '', // ใช้วันปิดบัญชี 30 วัน
          endDate: m.month || '',
          operator: 'เจ้าหน้าที่ส่งเสริม',
          syncedFromPlan: true
        };
      });

    // ลบกิจกรรมที่ sync มาแล้ว (syncedFromPlan) แต่ไม่ลบแถวที่ผู้ใช้แก้เอง (auto=false)
    if (Array.isArray(sch.activities)) {
      sch.activities = sch.activities.filter(function (a) {
        return !a.syncedFromPlan || a.auto === false;
      });
    }

    // เพิ่มกิจกรรมที่ sync มาหลัง 2.4
    if (meetingActivities.length > 0 && Array.isArray(sch.activities)) {
      var insertIdx = -1;
      for (var i = 0; i < sch.activities.length; i++) {
        if (sch.activities[i].code === '3') {
          insertIdx = i;
          break;
        }
      }
      if (insertIdx >= 0) {
        sch.activities.splice.apply(sch.activities, [insertIdx, 0].concat(meetingActivities));
      } else {
        sch.activities = sch.activities.concat(meetingActivities);
      }
    }
  }

  function syncPlanActivityDates() {
    var sch = A().scheduleAndActivities;
    if (!Array.isArray(sch.activities) || !sch.activities.length) return;
    var defs = planActivityDefaults();
    var byCode = {};
    defs.forEach(function (d) { byCode[d.code] = d; });
    sch.activities.forEach(function (a) {
      if (!a.code || !byCode[a.code]) return;
      var d = byCode[a.code];
      // 2.2: วันที่รับรองงบ — แสดงเดือน+ปี เท่านั้น
      if (a.code === '2.2') {
        a.startDate = d.startDate;
        a.endDate = d.endDate;
      }
      // 2.3: ช่วงวันประชุมใหญ่ — อัปเดตเต็มวันที่
      if (a.code === '2.3') {
        a.startDate = d.startDate;
        a.endDate = d.endDate;
      }
      if (a.auto) {
        a.goal = d.goal;
        if (a.code === '2.1' || a.code === '2.4') {
          a.startDate = d.startDate;
          a.endDate = d.endDate;
        }
      }
    });
  }

  function renderActivities() {
    var sch = A().scheduleAndActivities;
    // โครงสร้างใหม่ 5 หัวข้อ + ข้อย่อย 2.1–2.4
    if (!Array.isArray(sch.activities) || sch.activities.length === 0 ||
      !sch.activities.some(function (a) { return a && a.code; })) {
      sch.activities = planActivityDefaults();
    }
    // ซิงค์กิจกรรมจากแผน 12 เดือน (หน้า 1) มาใส่ตาราง 5.2
    syncActivitiesFromMonthlyPlan();
    syncPlanActivityDates();
    if (!Array.isArray(sch.visitLog)) sch.visitLog = [];

    var body = $('cpd2ActivityBody');
    if (body) {
      body.innerHTML = sch.activities.map(function (a, i) {
        var del = '<td class="no-print text-center"><button type="button" class="btn btn-sm btn-outline-danger py-0" data-action="del-plan-activity" data-index="' + i + '" title="ลบ">✕</button></td>';
        if (a.isHeader) {
          // ปุ่ม ➕ เพิ่มกิจกรรมย่อย สำหรับหัวข้อหลักทุกข้อ (1–5)
          var addBtn = '<td class="no-print text-center"><button type="button" class="btn btn-sm btn-outline-success py-0" data-action="add-sub-activity" data-header-index="' + i + '" title="เพิ่มกิจกรรมย่อย">➕</button></td>';
          return '<tr class="table-secondary">' +
            '<td colspan="6"><textarea class="form-control form-control-sm fw-bold bg-transparent border-0" rows="1" data-plan-activity="' + i + '" data-pfield="goal">' + h(a.goal || '') + '</textarea></td>' +
            addBtn + del + '</tr>';
        }
        return '<tr' + (a.autoGenerated ? ' data-auto-4m="true"' : '') + '>' +
          '<td><textarea class="form-control form-control-sm" rows="3" data-plan-activity="' + i + '" data-pfield="goal">' + h(a.goal || '') + '</textarea></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="target" value="' + h(a.target || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="unit" value="' + h(a.unit || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="startDate" value="' + h(a.startDate || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm text-center" data-plan-activity="' + i + '" data-pfield="endDate" value="' + h(a.endDate || '') + '"></td>' +
          '<td><input type="text" class="form-control form-control-sm" data-plan-activity="' + i + '" data-pfield="operator" value="' + h(a.operator || '') + '"></td>' +
          del + '</tr>';
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
    if (el.id === 'cpd5FilterUpcoming') {
      renderDashboard();
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
        A().meta.approvalStatus = 'อนุมัติแล้ว';
        A().meta.approvedAt = todayThai();
      }
    } else if (el.matches('[data-indicator]')) {
      var ind = el.getAttribute('data-indicator');
      var year = el.getAttribute('data-year');
      var st = A().strength;
      if (!st.indicators[ind]) st.indicators[ind] = { '2567': 0, '2568': 0, '2569': 0 };
      st.indicators[ind][year] = S.num(el.value);
      // ลบ flag autoDistributed เพราะผู้ใช้แก้เองแล้ว
      if (st.indicators[ind]._autoDistributed) {
        delete st.indicators[ind]._autoDistributed;
      }
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
        // ติด flag ว่าผู้ใช้แก้เองแล้ว (เพื่อไม่ให้ syncActivitiesFromMonthlyPlan ลบทิ้ง)
        A().scheduleAndActivities.activities[pi].auto = false;
        // ผู้ใช้แก้แถวที่ระบบสร้างเอง -> ไม่ต้องลบทิ้งในรอบ auto pipeline ถัดไป
        delete A().scheduleAndActivities.activities[pi].autoGenerated;
        delete A().scheduleAndActivities.activities[pi].auto4M;
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

    // เปลี่ยนวันประชุมใหญ่ -> อัปเดตวันที่รับรองงบ + ตารางกิจกรรม + แผน 12 เดือน
    if (el.matches('[data-cpd="closingReport.agmDate"]')) {
      var agmValue = el.value;
      if (typeof global.setAgmDateFromState === 'function') {
        global.setAgmDateFromState(agmValue);
      }
      S.applyAutoDeadlines();
      syncPlanActivityDates();
      renderActivities();
      updateOutputs();
    }

    if (changed) S.scheduleLocalDraftSave(700);

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
    } else if (action === 'add-sub-activity') {
      // เพิ่มกิจกรรมย่อยต่อท้ายหัวข้อหลักที่กดปุ่ม ➕
      var headerIdx = S.num(btn.getAttribute('data-header-index'));
      var acts = A().scheduleAndActivities.activities;
      var header = acts[headerIdx];
      if (!header) return;
      // หาตำแหน่งที่จะแทรก: ต่อจากกิจกรรมย่อยทั้งหมดของหัวข้อนี้
      var headerCode = String(header.code || '').replace(/\.0$/, '').replace(/\.+$/, '');
      var insertAt = headerIdx + 1;
      while (insertAt < acts.length) {
        var next = acts[insertAt];
        if (!next) break;
        // ถ้าเป็นหัวข้อถัดไป หรือไม่มี code ที่ขึ้นต้นด้วย headerCode. ให้หยุด
        if (next.isHeader) break;
        var nextCode = String(next.code || '');
        if (nextCode && !nextCode.match(new RegExp('^' + headerCode.replace(/\./g, '\\.') + '\\.'))) break;
        insertAt++;
      }
      // หาข้อย่อยลำดับถัดไป (เช่น 1.1, 1.2 หรือ 3.1)
      var existingSubs = acts.filter(function (a) {
        return !a.isHeader && String(a.code || '').match(new RegExp('^' + headerCode.replace(/\./g, '\\.') + '\\.\\d+$'));
      });
      var nextNum = existingSubs.length + 1;
      var newCode = headerCode + '.' + nextNum;
      var y = planYearInfo();
      acts.splice(insertAt, 0, {
        code: newCode,
        goal: newCode + ' ',
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม'
      });
      renderActivities();
      S.scheduleLocalDraftSave(500);
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
    } else if (action === 'add-weakness-activities') {
      addWeaknessActivitiesFrom4M();
    } else if (action === 'sync-to-base') {
      syncTotalsToBaseForm();
    } else if (action === 'save-plan') {
      saveCompletePlan();
    } else if (action === 'save-draft') {
      UI.saveDraft({ button: btn });
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
      UI.loadCoopForEdit(btn);
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

  function saveDraft(options) {
    options = options || {};
    S.syncFromBaseFormToAllTabs();
    var state = A();
    var form = options.form;
    if (!form) {
      try {
        form = typeof global.collectFormObject === 'function' ? global.collectFormObject() : {};
      } catch (e) { form = {}; }
    }
    if (!state.coopProfile.coopName && !(form && form.coop_name)) {
      showToast('กรุณาเลือกสหกรณ์ก่อนบันทึกร่าง', 'danger');
      return;
    }

    var btn = options.button;
    var originalText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึกร่าง...'; }

    // 1) บันทึกทุกช่องลง State + localStorage ทันที
    var savedAt = S.saveLocalDraft(form);
    var resultBox = options.resultBox;
    if (resultBox) {
      resultBox.innerHTML = '<div class="alert alert-info mb-0">💾 บันทึกร่างลงเครื่องแล้วเมื่อ ' + h(savedAt || '-') + ' กำลังบันทึกลงฐานข้อมูล...</div>';
    }
    if (!options.silent) showToast('บันทึกร่างลงเครื่องแล้วเมื่อ ' + (savedAt || '-'), 'success');

    function finish(ok, message) {
      if (btn) { btn.disabled = false; btn.textContent = originalText || '💾 บันทึกร่าง'; }
      if (resultBox) {
        resultBox.innerHTML = '<div class="alert alert-' + (ok ? 'info' : 'warning') + ' mb-0">💾 ' + h(message) + '</div>';
      }
      if (!options.silent) showToast(message, ok ? 'success' : 'warning');
    }

    // 2) บันทึกลงฐานข้อมูล (best effort — ถ้าออฟไลน์ยังใช้ร่างในเครื่องได้)
    if (!global.google || !global.google.script || !global.google.script.run) {
      finish(true, 'บันทึกร่างลงเครื่องแล้วเมื่อ ' + (savedAt || '-'));
      return;
    }

    global.google.script.run.withSuccessHandler(function (res) {
      if (global.currentCoopIndex >= 0 && global.masterCoops && global.masterCoops[global.currentCoopIndex]) {
        global.masterCoops[global.currentCoopIndex].savedDraft = {
          savedAt: (res && res.savedAt) || savedAt,
          formData: form
        };
        if (typeof global.filterCoopDropdown === 'function') global.filterCoopDropdown();
      }
      finish(true, 'บันทึกร่างของ ' + (form.coop_name || state.coopProfile.coopName || '') +
        ' เรียบร้อยแล้วเมื่อ ' + ((res && res.savedAt) || savedAt || '-'));
    }).withFailureHandler(function (err) {
      finish(true, 'บันทึกร่างลงเครื่องแล้วเมื่อ ' + (savedAt || '-') +
        ' (ฐานข้อมูล: ' + (err && err.message ? err.message : 'ไม่พร้อมใช้งาน') + ')');
    }).saveDraftToSheet(form);
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
        global.__cpdActiveCoopKey = key;
        S.loadStateFromRecord(res.state);
        // บันทึกเดิมอาจไม่มีผลประเมินปี 2569 -> เติมจาก master ไม่ให้ผลปี 69 หาย
        var fallback69 = c.score69 ? applyStrength69Fallback({
          level: c.score69.level, total: c.score69.total,
          d1: c.score69.d1, d2: c.score69.d2, d3: c.score69.d3, d4: c.score69.d4
        }) : false;
        if (fallback69) {
          S.applyStateToBaseForm();
          UI.renderAll();
        }
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
        matchCoopType(r.coopSubType, r.coopName, filters.coopType) &&
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
    // Normalize ช่องว่างและ trim ก่อนเปรียบเทียบ (ตรงกับ cpdFilterMatch_ ใน backend)
    var cleanValue = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var cleanFilter = String(filter || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return cleanValue === cleanFilter;
  }

  function matchCoopType(coopSubType, coopName, filter) {
    if (!filter) return true;
    // Normalize
    var cleanType = String(coopSubType || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var cleanName = String(coopName || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var cleanFilter = String(filter || '').replace(/\s+/g, ' ').trim().toLowerCase();
    
    // Match โดยตรงหรือ contains
    if (cleanType === cleanFilter || cleanType.indexOf(cleanFilter) !== -1) return true;
    if (cleanName.indexOf(cleanFilter) !== -1) return true;
    
    return false;
  }

  /** คำนวณจำนวนวันจาก today ถึง targetDate (วว/ดด/ปปปป หรือ Date) คืนค่า null ถ้า parse ไม่ได้ */
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

    // ตัวกรอง "เฉพาะที่กำลังจะถึงกำหนด": แสดงเฉพาะสหกรณ์ที่ deadline ≤ 30 วันจากวันนี้
    var upcomingOnly = $('cpd5FilterUpcoming') && $('cpd5FilterUpcoming').checked;
    if (upcomingOnly) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      rows = rows.filter(function (r) {
        // ถ้าเสร็จแล้ว (canCloseAccount/canHoldAgm เป็น "ได้" และมี timeframe ที่ตรง) -> ซ่อน
        var completed30 = r.canCloseAccount === 'ได้' && String(r.closeTimeframe || '').indexOf('30') !== -1;
        var completed150 = r.canHoldAgm === 'ได้' && String(r.agmTimeframe || '').indexOf('150') !== -1;
        if (completed30 && completed150) return false;
        // คำนวณวันเหลือจนถึง deadline
        var daysClose = daysUntil(r.targetClose30d, today);
        var daysAgm = daysUntil(r.targetAgm150d, today);
        // แสดงถ้ามี deadline ใด ≤ 30 วัน (ยังไม่ถึง หรือเลยมาไม่เกิน 7 วัน)
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
          '<td class="text-center">' + h(r.promotionZone || '-') + '</td>' +
          '<td>' + h(r.primaryOfficer || '-') + '</td>' +
          '<td class="text-center">' + h(r.fiscalEndDate || '-') + '</td>' +
          '<td class="text-center">' + h(r.targetClose30d || '-') + '</td>' +
          '<td class="text-center">' + h(r.targetAgm150d || '-') + '</td>' +
          '<td class="text-center">' + classBadge(r.class69) + '</td>' +
          '<td class="text-center">' + badgeForPlan(r.approvalStatus) + '</td>' +
          '<td class="text-center">' + (S.num(r.monthlyProgress) ? Math.round(S.num(r.monthlyProgress)) + '%' : '-') + '</td>' +
          '<td class="text-center no-print"><button type="button" class="btn btn-sm btn-outline-success py-0" data-action="load-coop" data-index="' + i + '"' +
          ' data-coop-id="' + h(r.coopId || '') + '" data-coop-name="' + h(r.coopName || '') + '" data-fiscal-year="' + h(r.fiscalYear || '2570') + '">โหลดข้อมูลเพื่อแก้ไข</button></td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="12" class="text-center text-muted py-3">ไม่พบข้อมูลตามตัวกรอง</td></tr>';
    }
    if ($('cpd5RowCount')) $('cpd5RowCount').textContent = rows.length + ' รายการ';

    // Task 4: ทะเบียนเอกสาร/รายงาน
    renderReportRegistry();

    // MIS Report Tracking
    renderMisReports();
  }

  UI.loadCoopForEdit = function (target) {
    var allRows = (dashboardData && dashboardData.rows) || [];
    var row = null;
    if (target && target.getAttribute) {
      // ใช้ตัวตนของแถว (id/name/fiscalYear) แทน index เพราะตารางอาจถูกกรองแล้ว
      var coopId = target.getAttribute('data-coop-id') || '';
      var coopName = target.getAttribute('data-coop-name') || '';
      var fiscalYear = target.getAttribute('data-fiscal-year') || '2570';
      row = allRows.filter(function (r) {
        var idOk = coopId && String(r.coopId || '') === coopId;
        var nameOk = coopName && String(r.coopName || '') === coopName &&
          String(r.fiscalYear || '2570') === fiscalYear;
        return idOk || nameOk;
      })[0] || null;
      if (!row) {
        var idx = S.num(target.getAttribute('data-index'));
        row = allRows[idx] || null;
      }
    } else if (typeof target === 'number') {
      row = allRows[target] || null;
    }
    if (!row) {
      showToast('ไม่พบข้อมูลสหกรณ์ที่เลือก', 'danger');
      return;
    }
    showToast('กำลังโหลดข้อมูล ' + row.coopName + '...', 'info');
    // ใช้ผลปี 2569 จาก master ถ้ามี (dashboard row อาจมาจากบันทึกเดิมที่ยังไม่มีผลปี 69)
    var mc = null;
    if (global.masterCoops && global.masterCoops.length) {
      mc = global.masterCoops.filter(function (m) {
        return (row.coopId && m.code13 === row.coopId) ||
          (row.coopName && m.name === row.coopName);
      })[0] || null;
    }
    var src69 = (mc && mc.score69) ? mc.score69 : {
      level: row.class69, total: row.strengthScoreLatest,
      d1: row.dim1, d2: row.dim2, d3: row.dim3, d4: row.dim4
    };
    global.google.script.run.withSuccessHandler(function (res) {
      if (res && res.found && res.state) {
        S.loadStateFromRecord(res.state);
        // บันทึกเดิมอาจไม่มีผลประเมินปี 2569 -> เติมจาก master ไม่ให้ผลปี 69 หาย
        if (applyStrength69Fallback(src69)) {
          S.applyStateToBaseForm();
          UI.renderAll();
        }
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
        st.strength.classByYear['2569'] = src69.level || row.class69 || '';
        st.strength.totalByYear['2568'] = S.num(row.strengthScorePrev);
        st.strength.totalByYear['2569'] = S.num(src69.total) || S.num(row.strengthScoreLatest);
        st.strength.dim1ByYear['2569'] = S.num(src69.d1) || S.num(row.dim1);
        st.strength.dim2ByYear['2569'] = S.num(src69.d2) || S.num(row.dim2);
        st.strength.dim3ByYear['2569'] = S.num(src69.d3) || S.num(row.dim3);
        st.strength.dim4ByYear['2569'] = S.num(src69.d4) || S.num(row.dim4);
        // กระจายคะแนนมิติปี 2569 ลงตัวชี้วัด 18 ตัว เพื่อให้ตาราง Tab 2 แสดงครบ
        S.recalcStrength();
        S.applyAutoDeadlines();
        S.applyStateToBaseForm();
        UI.renderAll();
      }
      global.__cpdLoadedKey = (row.coopId || '') + '|' + (row.coopName || '') + '|' + (row.fiscalYear || '2570');
      global.__cpdActiveCoopKey = global.__cpdLoadedKey;
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
  // TASK 2 — วิเคราะห์ 4M จากฟอร์มพื้นฐาน (ข้อความเต็มตาม Template)
  // =========================================================================

  function fmtBahtTxt(v) {
    var n = S.num(v);
    return n ? S.fmt(n, 2) + ' บาท' : '......';
  }

  function fmtCountTxt(v) {
    var n = S.num(v);
    return n ? S.fmtInt(v) + ' คน' : '......';
  }

  function fmtTextOrPlaceholder(v) {
    var s = String(v || '').trim();
    return s ? s : '......';
  }

  /**
   * valOrText(v, unit, fallback) — แสดงค่าตัวเลขหรือข้อความ fallback
   * ถ้า v > 0: แสดงค่าตัวเลข + unit
   * ถ้า v = 0 หรือว่าง: แสดง fallback
   */
  function valOrText(v, unit, fallback) {
    unit = unit || 'บาท';
    fallback = fallback || 'ไม่มีรายการ';
    var n = S.num(v);
    if (n > 0) {
      return S.fmt(n, 2) + ' ' + unit;
    }
    return fallback;
  }

  /**
   * yoyText(curr, prev, unit) — คำนวณ YoY change พร้อม %
   * ถ้าทั้ง curr และ prev > 0: คำนวณ diff และ pct
   * คืนค่า: "(เพิ่มขึ้น/ลดลงจากปีก่อน X บาท หรือร้อยละ Y%)"
   */
  function yoyText(curr, prev, unit) {
    unit = unit || 'บาท';
    var c = S.num(curr);
    var p = S.num(prev);
    if (c <= 0 || p <= 0) return '';
    
    var diff = c - p;
    var pct = ((diff / p) * 100).toFixed(2);
    var phrase = diff >= 0 ? 'เพิ่มขึ้น' : 'ลดลง';
    
    return '(' + phrase + 'จากปีก่อน ' + 
      Math.abs(diff).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + 
      ' ' + unit + ' หรือร้อยละ ' + Math.abs(pct) + ')';
  }

  function diffPhrase(latest, prev) {
    var l = S.num(latest);
    var p = S.num(prev);
    if (!l || !p) return '';
    var d = l - p;
    if (!d) return 'ไม่เปลี่ยนแปลงจากปีก่อน';
    return (d > 0 ? 'เพิ่มขึ้น' : 'ลดลง') + 'จากปีก่อน จำนวน ' + S.fmt(Math.abs(d), 2) + ' บาท';
  }

  function planComparePhrase(actual, plan) {
    var a = S.num(actual);
    var p = S.num(plan);
    if (!p) return 'โดยสหกรณ์ไม่ได้กำหนดแผนงานไว้';
    var d = a - p;
    if (!d) return 'ผลการดำเนินงานเท่ากับแผนงานที่กำหนด';
    return 'ผลการดำเนินงาน' + (d > 0 ? 'สูงกว่า' : 'ต่ำกว่า') +
      'แผนงานที่กำหนด จำนวน ' + S.fmt(Math.abs(d), 2) + ' บาท';
  }

  function profitPhrase(v) {
    var n = S.num(v);
    if (n > 0) return 'มีกำไรเฉพาะธุรกิจ จำนวน ' + S.fmt(n, 2) + ' บาท';
    if (n < 0) return 'มีผลขาดทุนเฉพาะธุรกิจ จำนวน ' + S.fmt(Math.abs(n), 2) + ' บาท';
    return 'มีกำไร/ขาดทุนเฉพาะธุรกิจ จำนวน ...... บาท';
  }

  function pctText(part, total) {
    if (!S.num(total)) return '......';
    return S.fmt((S.num(part) / S.num(total)) * 100, 2);
  }

  function joinPhrase(parts) {
    return parts.filter(function (x) { return x && String(x).trim(); }).join(' ');
  }

  /**
   * analyze4M() — สร้างข้อความวิเคราะห์ 4 ด้าน (องค์กร / ธุรกิจ / สวัสดิการ / สรุป)
   * ใช้ข้อมูลจริงจาก Shared State (ผลการดำเนินงาน 2 ปี, คะแนนเข้มแข็ง, ข้อมูลสมาชิก)
   */
  function analyze4M() {
    var s = A();
    var p = s.coopProfile || {};
    var f = s.financials || {};
    var sum = f.summary2Years || {};
    var bs = f.balanceSheet || {};
    var st = s.strength || {};
    var mem = p.members || {};
    var op = f.operatingResults || {};
    var N = op.latest || {};
    var N1 = op.prev || {};

    // ข้อมูลตรวจสอบแล้ว (ถ้ามี) + เกณฑ์ benchmark ตามประเภทสหกรณ์
    var preload = preloadFor(p.coopName);
    var profile = detectCoopProfile();
    var benchmark = getProfileBenchmarks(profile);

    var y = planYearInfo();
    var acctYear = y.acctYear;
    var planYear = y.planYear;
    var latestStrengthYear = y.latestStrengthYear;
    var targetStrengthYear = y.targetStrengthYear;
    var assessmentYear = y.assessmentYear;

    var coopName = p.coopName || 'สหกรณ์/กลุ่มเกษตรกร';
    var fiscalEndDate = p.fiscalEndDate || 'วันสิ้นปีบัญชี';
    var membersTotal = S.num(mem.regularMale) + S.num(mem.regularFemale) +
      S.num(mem.associateMale) + S.num(mem.associateFemale);
    if (!membersTotal) membersTotal = S.num(mem.regularTotal) + S.num(mem.associateTotal);
    if (!membersTotal) membersTotal = S.num(mem.prevYearTotal);
    if (!membersTotal) membersTotal = S.num(N.membersDeposit) || S.num(N.membersTrading) || 0;

    var assets = S.num(sum.assetsLatest) || S.num(bs.totalAssets);
    var liabilities = S.num(sum.liabilitiesLatest) || S.num(bs.totalLiabilities);
    var profit = S.num(sum.netProfitLatest) || S.num(bs.netProfitYear);
    var profitPrev = S.num(sum.netProfitPrev);
    var workingCapital = S.num(N.workingCapital) || assets;
    var coopCapital = S.num(N.coopCapital) ||
      (assets && liabilities ? assets - liabilities : 0) || S.num(bs.totalEquity);
    var income = S.num(N.totalIncome);
    var expense = S.num(N.totalExpense);
    var avgProfit3 = S.num(N.avgProfit3);
    var avgSaving = S.num(N.avgSaving);
    var avgDebt = S.num(N.avgDebt);
    var staffCount = S.num(N.staffCount);
    var agmAttendees = S.num(N.agmAttendees);
    var membersDeposit = S.num(N.membersDeposit);
    var membersTrading = S.num(N.membersTrading);
    var membersProcessing = S.num(N.membersProcessing);
    var cash = S.num(N.cash);
    var inventory = S.num(N.inventory);
    var ppe = S.num(N.ppe);
    var receivables = S.num(N.receivables);
    var otherAssets = S.num(N.otherAssets);
    var loans = S.num(N.loans);
    var payables = S.num(N.payables);
    var salesTrading = S.num(N.salesTrading);
    var planTrading = S.num(N.planTrading);
    var profitTrading = S.num(N.profitTrading);
    var profitTradingPrev = S.num(N1.profitTrading);
    var salesProcessing = S.num(N.salesProcessing);
    var planProcessing = S.num(N.planProcessing);
    var profitProcessing = S.num(N.profitProcessing);
    var profitProcessingPrev = S.num(N1.profitProcessing);
    var bizDeposit = (f.businesses && f.businesses.deposit) || {};
    var depositAmount = S.num(N.depositAmount) || S.num(bizDeposit.depositAmount);
    var profitDeposit = S.num(N.profitDeposit) || S.num(bizDeposit.netBusinessProfit);

    var bizList = Array.isArray(p.mainBusinesses) ? p.mainBusinesses.filter(Boolean) : [];
    var bizText = bizList.length ? bizList.join(' ') : '';
    var productsText = Array.isArray(p.mainProducts) ? p.mainProducts.filter(Boolean).join(' ') : '';

    var classLatest = (st.classByYear && (st.classByYear[String(latestStrengthYear)] || st.classByYear['2569'])) || '';
    var classTarget = (st.classByYear && (st.classByYear[String(targetStrengthYear)] || st.classByYear['2569'])) || classLatest;
    var totalLatest = S.num(st.totalByYear && (st.totalByYear[String(latestStrengthYear)] || st.totalByYear['2569']));
    var quorumOk = membersTotal ? (agmAttendees * 2 >= membersTotal) : false;

    // -------------------------------------------------------------------
    // 1) ด้านการบริหารจัดการองค์กร (4M)
    // -------------------------------------------------------------------
    var org = [];
    org.push('การวิเคราะห์ข้อมูลของสหกรณ์/กลุ่มเกษตรกร');
    org.push('- ผลการวิเคราะห์ข้อมูลด้านการบริหารจัดการองค์กร');
    org.push('ด้านการบริหารจัดการองค์กร (หลัก 4M)');
    org.push('');
    org.push('1. หัวข้อ: บุคลากร');
    org.push('- คณะกรรมการดำเนินการ มีจำนวน ' + fmtTextOrPlaceholder(p.boardCount ? S.fmtInt(p.boardCount) + ' คน' : '') + ' มีความรู้ความสามารถและประสบการณ์เพียงพอในการบริหารงาน');
    org.push('- ผู้ตรวจสอบกิจการ ' + fmtTextOrPlaceholder(p.inspectorName ? 'ชื่อ ' + p.inspectorName : '') + ' ผ่านการอบรมผู้ตรวจสอบกิจการสหกรณ์ และเข้าร่วมประชุมคณะกรรมการดำเนินการเป็นประจำ');
    org.push('- ฝ่ายจัดการมีเจ้าหน้าที่ปฏิบัติงานประจำ ' + fmtTextOrPlaceholder(staffCount ? 'จำนวน ' + S.fmtInt(staffCount) + ' คน' : '') + ' มีความรู้ความสามารถตามสมควรในตำแหน่งที่ได้รับมอบหมาย และสหกรณ์ได้มอบหมายผู้รับผิดชอบการเก็บรักษาเงินสดและการรับจ่ายเงินอย่างชัดเจน');
    org.push('- ณ วันสิ้นปีบัญชีมีสมาชิก ' + fmtTextOrPlaceholder(membersTotal ? S.fmtInt(membersTotal) + ' คน' : '') + ' มีสมาชิกร่วมทำธุรกิจกับสหกรณ์ แยกเป็น ธุรกิจรับฝากเงิน จำนวน ' +
      fmtCountTxt(membersDeposit) +
      ' ธุรกิจจัดหาสินค้ามาจำหน่าย จำนวน ' +
      fmtCountTxt(membersTrading) +
      ' และธุรกิจแปรรูปและผลิตสินค้า จำนวน ' +
      fmtCountTxt(membersProcessing) +
      ' สำหรับการเข้าร่วมประชุมใหญ่สามัญประจำปีของสมาชิกนั้น สมาชิกมาเข้าประชุม จำนวน ' +
      fmtCountTxt(agmAttendees) +
      ' จากสมาชิกทั้งหมด ' +
      fmtTextOrPlaceholder(membersTotal ? S.fmtInt(membersTotal) + ' คน' : '') +
      (quorumOk ? ' ครบองค์ประชุม' : ''));
    org.push('- สมาชิกส่วนใหญ่มีความรู้ความเข้าใจเกี่ยวกับอุดมการณ์ หลักการและวิธีการสหกรณ์พอสมควร สมาชิกทราบถึงสิทธิและหน้าที่ของสมาชิกตามข้อบังคับกำหนด');
    org.push('');
    org.push('2. หัวข้อ: สำนักงาน/อุปกรณ์');
    org.push('- สหกรณ์มีสำนักงานและอุปกรณ์ที่ใช้ในการปฏิบัติงานอย่างเพียงพอ');
    if (productsText) {
      org.push('- สินค้า/ผลผลิตหลักของสหกรณ์ ได้แก่ ' + productsText);
    }
    org.push('- สหกรณ์มีอุปกรณ์คอมพิวเตอร์ เครื่องพิมพ์ และตู้เก็บเอกสารเพียงพอในการปฏิบัติงาน');
    org.push('- สำหรับเทคโนโลยีที่ใช้ในการบริหารจัดการองค์กร สหกรณ์ใช้โปรแกรมระบบคอมพิวเตอร์ที่พัฒนาโดยกรมตรวจบัญชีสหกรณ์');
    org.push('- สหกรณ์ยังไม่มีการนำ Application Smart 4M มาใช้ในการบริหารจัดการในสหกรณ์');
    org.push('');
    org.push('3. หัวข้อ: การเงิน');
    
    // 3.1 กำไรเฉลี่ย 3 ปีย้อนหลัง
    if (avgProfit3 > 0) {
      org.push('- ในรอบ 3 ปีบัญชีย้อนหลัง สหกรณ์ดำเนินงานมีกำไรทุกปี เฉลี่ยปีละ ' + valOrText(avgProfit3));
    } else if (avgProfit3 < 0) {
      org.push('- ในรอบ 3 ปีบัญชีย้อนหลัง สหกรณ์มีผลขาดทุนเฉลี่ยปีละ ' + valOrText(Math.abs(avgProfit3)) + ' ต้องเร่งฟื้นฟูฐานะการเงิน');
    } else {
      org.push('- ในรอบ 3 ปีบัญชีย้อนหลัง สหกรณ์ยังไม่มีข้อมูลกำไรเฉลี่ย');
    }
    
    // 3.2 รายได้และค่าใช้จ่ายปีล่าสุด
    org.push('- สำหรับปีสิ้นสุดวันที่ ' + fiscalEndDate + ' สหกรณ์มีรายได้รวมทั้งสิ้น ' + 
      valOrText(income, 'บาท', 'ไม่ระบุ') +
      (income > 0 && S.num(N1.totalIncome) > 0 ? ' ' + yoyText(income, N1.totalIncome) : '') +
      ' มีต้นทุนและค่าใช้จ่ายทั้งสิ้น ' + valOrText(expense, 'บาท', 'ไม่ระบุ') +
      (expense > 0 && S.num(N1.totalExpense) > 0 ? ' ' + yoyText(expense, N1.totalExpense) : ''));
    
    // 3.3 ผลกำไรสุทธิ
    if (profit > 0) {
      org.push('- ผลการดำเนินงานมีกำไรสุทธิ ' + valOrText(profit) + 
        (profitPrev > 0 ? ' ' + yoyText(profit, profitPrev) : ''));
    } else if (profit < 0) {
      org.push('- ผลการดำเนินงานมีผลขาดทุนสุทธิ ' + valOrText(Math.abs(profit)) + 
        ' ต้องทบทวนกลยุทธ์การดำเนินงานและควบคุมต้นทุน' +
        (profitPrev > 0 ? ' ' + yoyText(profit, profitPrev) : ''));
    } else {
      org.push('- ผลการดำเนินงานไม่มีกำไรหรือขาดทุนสุทธิ');
    }
    
    // 3.4 ทุนดำเนินงานและโครงสร้างเงินทุน
    org.push('- ณ วันที่ ' + fiscalEndDate + ' สหกรณ์มีทุนดำเนินงานทั้งสิ้น ' + valOrText(workingCapital, 'บาท', 'ไม่ระบุ') +
      (workingCapital > 0 && S.num(N1.workingCapital) > 0 ? ' ' + yoyText(workingCapital, N1.workingCapital) : ''));
    org.push('  ทุนดำเนินงานดังกล่าวมาจากทุนของสหกรณ์ จำนวน ' + valOrText(coopCapital, 'บาท', 'ไม่ระบุ') +
      (coopCapital > 0 && S.num(N1.coopCapital) > 0 ? ' ' + yoyText(coopCapital, N1.coopCapital) : ''));
    org.push('  เป็นหนี้สิน จำนวน ' + valOrText(liabilities, 'บาท', 'ไม่ระบุ') +
      (liabilities > 0 && S.num(N1.loans) > 0 ? ' ' + yoyText(liabilities, N1.loans) : ''));
    
    // 3.5 โครงสร้างหนี้สิน
    if (loans > 0 || payables > 0) {
      var debtStructure = '  โครงสร้างหนี้สิน:';
      if (loans > 0) debtStructure += ' เงินกู้ยืม ' + valOrText(loans) + 
        (liabilities > 0 ? ' (' + S.fmt(loans / liabilities * 100, 1) + '%)' : '');
      if (payables > 0) debtStructure += ' เจ้าหนี้การค้า ' + valOrText(payables) +
        (liabilities > 0 ? ' (' + S.fmt(payables / liabilities * 100, 1) + '%)' : '');
      org.push(debtStructure);
    }
    
    // 3.6 องค์ประกอบสินทรัพย์
    org.push('- องค์ประกอบสินทรัพย์รวม ' + valOrText(assets, 'บาท', 'ไม่ระบุ') + ':');
    var assetItems = [];
    if (cash > 0) assetItems.push('เงินสดและเงินฝากธนาคาร ' + valOrText(cash) + ' (' + S.fmt(cash / assets * 100, 1) + '%)');
    if (receivables > 0) assetItems.push('ลูกหนี้การค้า ' + valOrText(receivables) + ' (' + S.fmt(receivables / assets * 100, 1) + '%)');
    if (inventory > 0) assetItems.push('สินค้าคงเหลือ ' + valOrText(inventory) + ' (' + S.fmt(inventory / assets * 100, 1) + '%)');
    if (ppe > 0) assetItems.push('ที่ดินอาคารและอุปกรณ์-สุทธิ ' + valOrText(ppe) + ' (' + S.fmt(ppe / assets * 100, 1) + '%)');
    if (otherAssets > 0) assetItems.push('สินทรัพย์อื่น ' + valOrText(otherAssets) + ' (' + S.fmt(otherAssets / assets * 100, 1) + '%)');
    if (assetItems.length > 0) {
      org.push('  ' + assetItems.join(', '));
    }
    
    // 3.7 อัตราส่วนทางการเงินทั้ง 7 ตัว ตามเกณฑ์กรมตรวจบัญชีสหกรณ์
    var ratios = f.ratios || {};
    var deRatio = S.num(ratios.deRatio) ||
      (coopCapital > 0 ? liabilities / coopCapital : 0);
    var currentRatio = S.num(ratios.currentRatio) ||
      (S.num(bs.currentLiabilities) ? S.num(bs.currentAssets) / S.num(bs.currentLiabilities) : 0);
    var roe = S.num(ratios.roe);
    var roa = S.num(ratios.roa);
    var reserveRatio = S.num(ratios.reserveToAssetRatio);
    var opexRatio = S.num(ratios.opexToGrossProfitRatio);
    var shortTermPaidRatio = S.num(ratios.shortTermDebtPaidOnTimeRatio);

    // เกณฑ์เปรียบเทียบตามประเภทสหกรณ์ (profile-aware benchmark)
    var deLimit = S.num(benchmark.deRatioThreshold) || 1.0;
    var crOpt = benchmark.currentRatioOptimal || { min: 1.0, max: 2.5 };
    var crMin = S.num(crOpt.min);
    var crMax = S.num(crOpt.max);

    org.push('- การวิเคราะห์อัตราส่วนทางการเงิน: ' +
      'D/E = ' + S.fmt(deRatio, 2) + ' เท่า (เกณฑ์ไม่เกิน ' + S.fmt(deLimit, 2) + ' เท่า ' +
      (deRatio <= deLimit ? 'อยู่ในเกณฑ์' : 'เกินเกณฑ์') + '), ' +
      'ROE = ' + S.fmt(roe, 2) + '%, ' +
      'ROA = ' + S.fmt(roa, 2) + '%, ' +
      'อัตราส่วนทุนหมุนเวียน (Current Ratio) = ' + S.fmt(currentRatio, 2) + ' เท่า (เกณฑ์เหมาะสม ' +
      S.fmt(crMin, 2) + '–' + S.fmt(crMax, 2) + ' เท่า ' +
      (currentRatio >= crMin && currentRatio <= crMax ? 'อยู่ในเกณฑ์' :
        (currentRatio < crMin ? 'ต่ำกว่าเกณฑ์' : 'สูงกว่าเกณฑ์')) + '), ' +
      'ทุนสำรองต่อสินทรัพย์ = ' + S.fmt(reserveRatio, 2) + ' เท่า, ' +
      'อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่ายดำเนินงาน = ' + S.fmt(opexRatio, 2) + '%, ' +
      'และอัตราลูกหนี้ระยะสั้นชำระตามกำหนด = ' + S.fmt(shortTermPaidRatio, 2) + '%');

    // Profitability Warning
    if (profit < 0) {
      org.push('  สหกรณ์มีผลขาดทุนสุทธิ ' + valOrText(Math.abs(profit)) + 
        ' ต้องทบทวนกลยุทธ์การดำเนินงานและควบคุมต้นทุน');
    }
    if (bs.accumulatedLoss && S.num(bs.accumulatedLoss) > 0) {
      org.push('  สหกรณ์มีขาดทุนสะสม ' + valOrText(bs.accumulatedLoss) + 
        ' ควรเร่งฟื้นฟูฐานะการเงินและทบทวนแผนธุรกิจ');
    }
    
    // 3.8 ธุรกิจหลัก
    if (salesTrading > 0) {
      org.push('- ธุรกิจจัดหาสินค้ามาจำหน่าย ระหว่างปี สหกรณ์จัดหาสินค้ามาจำหน่าย ' + valOrText(salesTrading) +
        (planTrading > 0 ? ' ' + planComparePhrase(salesTrading, planTrading) : ' โดยไม่ได้กำหนดแผนงานไว้') +
        ' ' + profitPhrase(profitTrading) +
        (profitTradingPrev > 0 ? ' ' + yoyText(profitTrading, profitTradingPrev) : ''));
    }
    
    if (salesProcessing > 0) {
      org.push('- ธุรกิจแปรรูปและผลิตสินค้า ระหว่างปี สหกรณ์ดำเนินธุรกิจ ' + valOrText(salesProcessing) +
        (planProcessing > 0 ? ' ' + planComparePhrase(salesProcessing, planProcessing) : ' โดยไม่ได้กำหนดแผนงานไว้') +
        ' ' + profitPhrase(profitProcessing) +
        (profitProcessingPrev > 0 ? ' ' + yoyText(profitProcessing, profitProcessingPrev) : ''));
    }
    
    if (depositAmount > 0) {
      org.push('- การรับฝากเงิน ระหว่างปี สหกรณ์รับฝากเงินจากสมาชิก ' + valOrText(depositAmount) +
        (profitDeposit ? ' ' + profitPhrase(profitDeposit) : ' สหกรณ์รับฝากเงินเพื่อเป็นทุนหมุนเวียนในการดำเนินงาน'));
    }
    
    // 3.9 เงินออม vs หนี้สินเฉลี่ยต่อสมาชิก
    if (avgSaving > 0 && avgDebt > 0) {
      org.push('- เมื่อเปรียบเทียบเงินออมเฉลี่ยต่อสมาชิก ' + valOrText(avgSaving) + ' ต่อคน' +
        ' กับหนี้สินเฉลี่ยต่อสมาชิก ' + valOrText(avgDebt) + ' ต่อคน' +
        ' พบว่า ' +
        (avgSaving >= avgDebt
          ? 'สมาชิกมีเงินออมเฉลี่ยสูงกว่าหนี้สิน แสดงให้เห็นถึงสมาชิกมีศักยภาพทางการเงินที่ดี'
          : 'สมาชิกมีหนี้สินเฉลี่ยสูงกว่าเงินออม จึงควรติดตามและบริหารจัดการภาระหนี้สินของสมาชิกอย่างต่อเนื่อง'));
    }
    
    // 3.10 ข้อสรุปทั่วไป
    org.push('- สินทรัพย์หมุนเวียนส่วนใหญ่ของสหกรณ์ คือ เงินสดและเงินฝากธนาคาร สินค้าคงเหลือ และลูกหนี้การค้า ดังนั้น สภาพคล่องทางการเงินของสหกรณ์จึงขึ้นอยู่กับการบริหารจัดการด้านสินค้าให้มีการขายในระยะเวลาที่เหมาะสมและบริหารจัดการลูกหนี้การค้าให้ชำระหนี้เป็นไปตามเงื่อนไข');
    org.push('- สหกรณ์ต้องติดตามข้อมูลข่าวสารจากภายนอกเพื่อเป็นข้อมูลในการตัดสินใจดำเนินธุรกิจ และลดความเสี่ยงที่อาจส่งผลกระทบต่อการดำเนินงานของสหกรณ์ โดยภาวการณ์แข่งขันในตลาดเป็นปัจจัยภายนอกที่สหกรณ์ไม่สามารถควบคุมได้ รวมทั้งนโยบายของรัฐทั้งด้านราคาผลผลิต ราคาอาหาร และยาส่งผลกระทบต่อต้นทุนการดำเนินงานของสหกรณ์');
    org.push('');
    org.push('4. หัวข้อ: การจัดการ');
    org.push('- ผลการจัดระดับชั้นความเข้มแข็ง ประจำปี ' + String(latestStrengthYear) +
      ' สหกรณ์อยู่ในระดับชั้น ' + fmtTextOrPlaceholder(classLatest) +
      (totalLatest ? ' โดยมีคะแนนรวม ' + S.fmt(totalLatest, 2) + ' คะแนน' : '') +
      ' และมีเป้าหมายรักษาระดับชั้น ' + fmtTextOrPlaceholder(classTarget) +
      ' ในปี ' + String(targetStrengthYear));
    var analysisInfo = s.analysis || {};
    var uploadedForThisCoop = String(analysisInfo.uploadedSectionsCoop || '') === String(coopName || '');
    var uploadedOrg = uploadedForThisCoop ? String(analysisInfo.uploadedOrgAnalysis4M || '').trim() : '';
    var uploadedBiz = uploadedForThisCoop ? String(analysisInfo.uploadedBusinessAnalysis || '').trim() : '';
    var uploadedWelfare = uploadedForThisCoop ? String(analysisInfo.uploadedWelfareAnalysis || '').trim() : '';
    var uploadedSummary = uploadedForThisCoop ? String(analysisInfo.uploadedSummaryAnalysis || '').trim() : '';
    var preOrgVerified = !!(preload && preload.fourM && preload.fourM.orgAnalysis4M && preload.fourM.orgAnalysis4M.length);
    var preWelfareVerified = !!(preload && preload.fourM && preload.fourM.welfareAnalysis && preload.fourM.welfareAnalysis.length);
    var auditorObs4M = String(analysisInfo.auditorObservations || '').trim();
    var coopDefects4M = String(analysisInfo.coopDefects || '').trim();
    org.push('- สหกรณ์มีการจัดทำแผนงานและงบประมาณประจำปี แต่ยังไม่มีการจัดทำแผนกลยุทธ์/แผนยุทธศาสตร์ระยะยาว (ตามข้อมูลโปรไฟล์ข้อ 22.1) จึงควรส่งเสริมให้จัดทำแผนกลยุทธ์ระยะ 3–5 ปี ให้สอดคล้องกับแผนพัฒนาสหกรณ์');
    if (auditorObs4M || coopDefects4M) {
      org.push('- มีข้อสังเกตของผู้สอบบัญชี/ข้อบกพร่องที่ต้องเร่งแก้ไข: ' + (auditorObs4M || coopDefects4M));
    }
    org.push('- สหกรณ์ถือใช้ข้อบังคับและระเบียบที่เกี่ยวข้องครบถ้วน และควรพิจารณาทบทวนแก้ไขเพิ่มเติมระเบียบให้สอดคล้องกับข้อบังคับปัจจุบันและการดำเนินธุรกิจของสหกรณ์');
    org.push('- สหกรณ์ถือใช้ระเบียบว่าด้วยการรับจ่ายและเก็บรักษาเงิน ระเบียบว่าด้วยการควบคุมภายใน และระเบียบว่าด้วยเจ้าหน้าที่และข้อบังคับเกี่ยวกับการทำงานอย่างครบถ้วน');
    org.push('- สหกรณ์ใช้โปรแกรมระบบคอมพิวเตอร์ที่พัฒนาโดยกรมตรวจบัญชีสหกรณ์ในการประมวลผลข้อมูลทุนเรือนหุ้น สินค้า และจัดทำบัญชีแยกประเภท');
    org.push('- สหกรณ์สามารถจัดประชุมใหญ่ได้ภายในระยะเวลา 150 วัน โดยมีการนำเสนองบการเงินที่ผ่านการแสดงความเห็นจากผู้สอบบัญชีแล้วต่อที่ประชุมใหญ่เพื่อพิจารณาอนุมัติ' +
      (agmAttendees ? ' โดยมีสมาชิกเข้าร่วมประชุม ' + S.fmtInt(agmAttendees) + ' คน' : '') +
      (quorumOk ? ' ครบองค์ประชุม' : ''));

    // -------------------------------------------------------------------
    // 2) ด้านการบริหารจัดการธุรกิจ (วิเคราะห์ 5 ธุรกิจแยกตามประเภท)
    // -------------------------------------------------------------------
    var business = [];
    business.push('- ผลการวิเคราะห์ข้อมูลด้านการบริหารจัดการธุรกิจ');
    business.push('ด้านการบริหารจัดการธุรกิจ');
    business.push('');
    
    // ดึงข้อมูลธุรกิจ 5 ประเภทจาก state
    var biz = f.businesses || {};
    var creditBiz = biz.credit || {};
    var tradingBiz = biz.trading || {};
    var collectionBiz = biz.collection || {};
    var processingBiz = biz.processing || {};
    var serviceBiz = biz.service || {};

    // Fallback: เติมข้อมูลธุรกิจที่ยังว่างจากผลการดำเนินงานหน้า 1 (ไม่ทับข้อมูลที่ AI/preload ให้มา)
    if (S.num(tradingBiz.sales) === 0 && S.num(N.salesTrading) > 0) {
      tradingBiz = {
        sales: S.num(N.salesTrading), cogs: S.num(N.costTrading),
        grossProfit: S.num(N.salesTrading) - S.num(N.costTrading),
        specificIncome: 0, specificExpense: 0, netBusinessProfit: S.num(N.profitTrading)
      };
    }
    if (S.num(processingBiz.sales) === 0 && S.num(N.salesProcessing) > 0) {
      processingBiz = {
        sales: S.num(N.salesProcessing), cogs: S.num(N.costProcessing),
        grossProfit: S.num(N.salesProcessing) - S.num(N.costProcessing),
        specificIncome: 0, specificExpense: 0, netBusinessProfit: S.num(N.profitProcessing)
      };
    }
    if (!depositAmount && S.num(N.depositAmount) > 0) {
      depositAmount = S.num(N.depositAmount);
      profitDeposit = S.num(N.profitDeposit);
    }

    // อัตราส่วนทางการเงิน 7 ตัว ใช้ค่าที่คำนวณไว้ด้านบนแล้ว (ratios/deRatio/currentRatio/...)

    // 1. ธุรกิจเงินให้กู้ (Credit)
    if (S.num(creditBiz.interestIncome) > 0 || S.num(creditBiz.netBusinessProfit) !== 0) {
      business.push('1. หัวข้อ: ธุรกิจเงินให้กู้');
      business.push('- สหกรณ์ดำเนินธุรกิจเงินให้กู้ มีรายได้ดอกเบี้ย ' + valOrText(creditBiz.interestIncome, 'บาท', 'ไม่ระบุ') +
        ' ต้นทุนการให้บริการ ' + valOrText(creditBiz.serviceCost, 'บาท', 'ไม่ระบุ'));
      business.push('- ผลกำไรจากธุรกิจเงินให้กู้ ' + valOrText(creditBiz.grossProfit, 'บาท', 'ไม่ระบุ') +
        ' รายได้เฉพาะกิจการ ' + valOrText(creditBiz.specificIncome, 'บาท', 'ไม่ระบุ') +
        ' ค่าใช้จ่ายเฉพาะกิจการ ' + valOrText(creditBiz.specificExpense, 'บาท', 'ไม่ระบุ'));
      business.push('- ผลกำไรสุทธิจากธุรกิจ ' + valOrText(creditBiz.netBusinessProfit, 'บาท', 'ไม่ระบุ'));
      if (S.num(creditBiz.netBusinessProfit) < 0) {
        business.push('  ** พบจุดอ่อนจากการที่ธุรกิจมีผลขาดทุน ' + valOrText(Math.abs(creditBiz.netBusinessProfit)) + 
          ' ต้องทบทวนการกำหนดราคา ต้นทุนจม และการควบคุมจุดรั่วไหล **');
      }
      business.push('');
    }
    
    // 2. ธุรกิจจัดหาสินค้ามาจำหน่าย (Trading)
    if (S.num(tradingBiz.sales) > 0 || S.num(tradingBiz.netBusinessProfit) !== 0) {
      business.push('2. หัวข้อ: ธุรกิจจัดหาสินค้ามาจำหน่าย');
      business.push('- สหกรณ์ดำเนินธุรกิจจัดหาสินค้ามาจำหน่าย มียอดขาย ' + valOrText(tradingBiz.sales, 'บาท', 'ไม่ระบุ') +
        (S.num(N1.salesTrading) > 0 ? ' ' + yoyText(tradingBiz.sales, N1.salesTrading) : '') +
        ' ต้นทุนขาย ' + valOrText(tradingBiz.cogs, 'บาท', 'ไม่ระบุ'));
      
      var tradingMargin = S.num(tradingBiz.sales) > 0 ? (S.num(tradingBiz.grossProfit) / S.num(tradingBiz.sales) * 100) : 0;
      business.push('- กำไรขั้นต้น ' + valOrText(tradingBiz.grossProfit, 'บาท', 'ไม่ระบุ') +
        ' อัตรากำไรขั้นต้น ' + S.fmt(tradingMargin, 1) + '%');
      business.push('- รายได้เฉพาะกิจการ ' + valOrText(tradingBiz.specificIncome, 'บาท', 'ไม่ระบุ') +
        ' ค่าใช้จ่ายเฉพาะกิจการ ' + valOrText(tradingBiz.specificExpense, 'บาท', 'ไม่ระบุ'));
      business.push('- ผลกำไรสุทธิจากธุรกิจ ' + valOrText(tradingBiz.netBusinessProfit, 'บาท', 'ไม่ระบุ') +
        (S.num(N1.profitTrading) > 0 ? ' ' + yoyText(tradingBiz.netBusinessProfit, N1.profitTrading) : ''));
      if (S.num(tradingBiz.netBusinessProfit) < 0) {
        business.push('  ** พบจุดอ่อนจากการที่ธุรกิจมีผลขาดทุน ' + valOrText(Math.abs(tradingBiz.netBusinessProfit)) + 
          ' ต้องทบทวนการกำหนดราคา ต้นทุนจม และการควบคุมจุดรั่วไหล **');
      }
      
      // การมีส่วนร่วมของสมาชิก
      if (membersTrading > 0) {
        business.push('- การมีส่วนร่วมของสมาชิกในธุรกิจนี้ มีจำนวน ' + fmtCountTxt(membersTrading) +
          ' จากจำนวนสมาชิกทั้งหมด ' +
          fmtTextOrPlaceholder(membersTotal ? S.fmtInt(membersTotal) + ' คน' : '') +
          ' ระหว่างปีมีการจำหน่ายสินค้าเป็นเงิน ' + valOrText(tradingBiz.sales, 'บาท', 'ไม่ระบุ'));
      }
      business.push('');
    }
    
    // 3. ธุรกิจรวบรวมผลผลิต (Collection)
    if (S.num(collectionBiz.sales) > 0 || S.num(collectionBiz.netBusinessProfit) !== 0) {
      business.push('3. หัวข้อ: ธุรกิจรวบรวมผลผลิต');
      business.push('- สหกรณ์ดำเนินธุรกิจรวบรวมผลผลิต มียอดขาย ' + valOrText(collectionBiz.sales, 'บาท', 'ไม่ระบุ') +
        ' ต้นทุนขาย ' + valOrText(collectionBiz.cogs, 'บาท', 'ไม่ระบุ'));
      
      var collectionMargin = S.num(collectionBiz.sales) > 0 ? (S.num(collectionBiz.grossProfit) / S.num(collectionBiz.sales) * 100) : 0;
      business.push('- กำไรขั้นต้น ' + valOrText(collectionBiz.grossProfit, 'บาท', 'ไม่ระบุ') +
        ' อัตรากำไรขั้นต้น ' + S.fmt(collectionMargin, 1) + '%');
      business.push('- รายได้เฉพาะกิจการ ' + valOrText(collectionBiz.specificIncome, 'บาท', 'ไม่ระบุ') +
        ' ค่าใช้จ่ายเฉพาะกิจการ ' + valOrText(collectionBiz.specificExpense, 'บาท', 'ไม่ระบุ'));
      business.push('- ผลกำไรสุทธิจากธุรกิจ ' + valOrText(collectionBiz.netBusinessProfit, 'บาท', 'ไม่ระบุ'));
      if (S.num(collectionBiz.netBusinessProfit) < 0) {
        business.push('  ** พบจุดอ่อนจากการที่ธุรกิจมีผลขาดทุน ' + valOrText(Math.abs(collectionBiz.netBusinessProfit)) + 
          ' ต้องทบทวนการกำหนดราคา ต้นทุนจม และการควบคุมจุดรั่วไหล **');
      }
      business.push('');
    }
    
    // 4. ธุรกิจแปรรูปผลผลิต (Processing)
    if (S.num(processingBiz.sales) > 0 || S.num(processingBiz.netBusinessProfit) !== 0) {
      business.push('4. หัวข้อ: ธุรกิจแปรรูปและผลิตสินค้า');
      business.push('- สหกรณ์ดำเนินธุรกิจแปรรูปและผลิตสินค้า มียอดขาย ' + valOrText(processingBiz.sales, 'บาท', 'ไม่ระบุ') +
        (S.num(N1.salesProcessing) > 0 ? ' ' + yoyText(processingBiz.sales, N1.salesProcessing) : '') +
        ' ต้นทุนขาย ' + valOrText(processingBiz.cogs, 'บาท', 'ไม่ระบุ'));
      
      var processingMargin = S.num(processingBiz.sales) > 0 ? (S.num(processingBiz.grossProfit) / S.num(processingBiz.sales) * 100) : 0;
      business.push('- กำไรขั้นต้น ' + valOrText(processingBiz.grossProfit, 'บาท', 'ไม่ระบุ') +
        ' อัตรากำไรขั้นต้น ' + S.fmt(processingMargin, 1) + '%');
      business.push('- รายได้เฉพาะกิจการ ' + valOrText(processingBiz.specificIncome, 'บาท', 'ไม่ระบุ') +
        ' ค่าใช้จ่ายเฉพาะกิจการ ' + valOrText(processingBiz.specificExpense, 'บาท', 'ไม่ระบุ'));
      business.push('- ผลกำไรสุทธิจากธุรกิจ ' + valOrText(processingBiz.netBusinessProfit, 'บาท', 'ไม่ระบุ') +
        (S.num(N1.profitProcessing) > 0 ? ' ' + yoyText(processingBiz.netBusinessProfit, N1.profitProcessing) : ''));
      if (S.num(processingBiz.netBusinessProfit) < 0) {
        business.push('  ** พบจุดอ่อนจากการที่ธุรกิจมีผลขาดทุน ' + valOrText(Math.abs(processingBiz.netBusinessProfit)) + 
          ' ต้องทบทวนการกำหนดราคา ต้นทุนจม และการควบคุมจุดรั่วไหล **');
      }
      
      // การมีส่วนร่วมของสมาชิก
      if (membersProcessing > 0) {
        business.push('- การมีส่วนร่วมของสมาชิกในธุรกิจนี้ มีจำนวน ' + fmtCountTxt(membersProcessing) +
          ' จากจำนวนสมาชิกทั้งหมด ' +
          fmtTextOrPlaceholder(membersTotal ? S.fmtInt(membersTotal) + ' คน' : '') +
          ' ระหว่างปีมีมูลค่าการขาย ' + valOrText(processingBiz.sales, 'บาท', 'ไม่ระบุ'));
      }
      business.push('');
    }
    
    // 5. ธุรกิจบริการ (Service)
    if (S.num(serviceBiz.serviceIncome) > 0 || S.num(serviceBiz.netBusinessProfit) !== 0) {
      business.push('5. หัวข้อ: ธุรกิจบริการ');
      business.push('- สหกรณ์ดำเนินธุรกิจบริการ มีรายได้จากการบริการ ' + valOrText(serviceBiz.serviceIncome, 'บาท', 'ไม่ระบุ') +
        ' ต้นทุนการให้บริการ ' + valOrText(serviceBiz.serviceCost, 'บาท', 'ไม่ระบุ'));
      
      var serviceMargin = S.num(serviceBiz.serviceIncome) > 0 ? (S.num(serviceBiz.grossProfit) / S.num(serviceBiz.serviceIncome) * 100) : 0;
      business.push('- กำไรขั้นต้น ' + valOrText(serviceBiz.grossProfit, 'บาท', 'ไม่ระบุ') +
        ' อัตรากำไรขั้นต้น ' + S.fmt(serviceMargin, 1) + '%');
      business.push('- รายได้เฉพาะกิจการ ' + valOrText(serviceBiz.specificIncome, 'บาท', 'ไม่ระบุ') +
        ' ค่าใช้จ่ายเฉพาะกิจการ ' + valOrText(serviceBiz.specificExpense, 'บาท', 'ไม่ระบุ'));
      business.push('- ผลกำไรสุทธิจากธุรกิจ ' + valOrText(serviceBiz.netBusinessProfit, 'บาท', 'ไม่ระบุ'));
      if (S.num(serviceBiz.netBusinessProfit) < 0) {
        business.push('  ** พบจุดอ่อนจากการที่ธุรกิจมีผลขาดทุน ' + valOrText(Math.abs(serviceBiz.netBusinessProfit)) + 
          ' ต้องทบทวนการกำหนดราคา ต้นทุนจม และการควบคุมจุดรั่วไหล **');
      }
      business.push('');
    }
    
    // 6. ธุรกิจรับฝากเงิน (Deposit)
    if (depositAmount > 0 || profitDeposit !== 0) {
      business.push('6. หัวข้อ: ธุรกิจรับฝากเงิน');
      business.push('- สหกรณ์ดำเนินธุรกิจรับฝากเงินจากสมาชิก มีเงินรับฝาก ' + valOrText(depositAmount, 'บาท', 'ไม่ระบุ') +
        ' เพื่อเป็นทุนหมุนเวียนในการดำเนินงาน');
      if (profitDeposit !== 0) {
        business.push('- ผลกำไร/ขาดทุนจากธุรกิจรับฝากเงิน ' + valOrText(profitDeposit, 'บาท', 'ไม่ระบุ'));
        if (S.num(profitDeposit) < 0) {
          business.push('  ** ธุรกิจรับฝากเงินมีผลขาดทุน ต้องทบทวนนโยบายการรับฝากเงินและอัตราดอกเบี้ย **');
        }
      }
      
      // การมีส่วนร่วมของสมาชิก
      if (membersDeposit > 0) {
        business.push('- การมีส่วนร่วมของสมาชิก สหกรณ์รับฝากเงินออมทรัพย์จำนวน ' + fmtCountTxt(membersDeposit) +
          ' จากสมาชิกทั้งหมด ' +
          fmtTextOrPlaceholder(membersTotal ? S.fmtInt(membersTotal) + ' คน' : '') +
          ' คิดเป็นร้อยละ ' + pctText(membersDeposit, membersTotal) +
          ' ของจำนวนสมาชิกทั้งหมด');
      }
      business.push('');
    }
    
    // ถ้าไม่มีข้อมูลธุรกิจเลย
    if (business.length <= 3) {
      business.push('- สหกรณ์ยังไม่มีข้อมูลผลการดำเนินงานแยกตามธุรกิจในระบบ ควรกรอกผลการดำเนินงาน ณ สิ้นปีบัญชีล่าสุดในหน้า 1 เพื่อให้ระบบวิเคราะห์ธุรกิจได้ครบถ้วน');
      business.push('');
    }

    // ถ้ามีข้อมูลที่ผ่านการตรวจสอบแล้ว (preload) ให้ใช้ข้อความองค์กร/ธุรกิจฉบับตรวจสอบแทน
    var hasVerifiedBusinessText = !!(preload && preload.fourM &&
      preload.fourM.businessAnalysis && preload.fourM.businessAnalysis.length);
    if (preload && preload.fourM) {
      if (preload.fourM.orgAnalysis4M && preload.fourM.orgAnalysis4M.length) {
        org = preload.fourM.orgAnalysis4M.slice();
      }
      if (hasVerifiedBusinessText) {
        business = preload.fourM.businessAnalysis.slice();
      }
    }

    // เติมข้อสังเกต/ข้อมูลธุรกิจจากเอกสารที่อัปโหลด (ยกเว้นสหกรณ์ที่มีข้อความตรวจสอบแล้ว)
    var bizObs4M = String(analysisInfo.businessObservations || '').trim();
    if (!bizObs4M) bizObs4M = auditorObs4M;
    if (bizObs4M && !hasVerifiedBusinessText && !uploadedBiz) {
      if (business.length && business[business.length - 1] !== '') business.push('');
      business.push('ข้อสังเกต/ข้อมูลเพิ่มเติมจากเอกสารที่อัปโหลด:');
      business.push(bizObs4M);
      business.push('');
    }

    // -------------------------------------------------------------------
    // 3) ด้านการจัดสวัสดิการและสาธารณประโยชน์ (อ้างอิงข้อมูลที่อัปโหลดเท่านั้น)
    // -------------------------------------------------------------------
    var welfare = [];
    welfare.push('- ผลการวิเคราะห์ข้อมูลด้านการจัดสวัสดิการและสาธารณประโยชน์');
    welfare.push('ด้านการบริหารจัดการสวัสดิการและสาธารณประโยชน์');

    var welfareObs = String(analysisInfo.welfareObservations || '').trim();
    var publicBenefitObs = String(analysisInfo.publicBenefitObservations || '').trim();
    var welfareFund = S.num(analysisInfo.welfareFundAmount);
    var publicBenefitFund = S.num(analysisInfo.publicBenefitFundAmount);
    var hasWelfareData = !!(welfareObs || publicBenefitObs || welfareFund > 0 || publicBenefitFund > 0);

    if (hasWelfareData) {
      if (welfareFund > 0) {
        welfare.push('- สหกรณ์จัดสรรทุนสวัสดิการสมาชิก จำนวน ' + valOrText(welfareFund) + ' ตามข้อมูลจากเอกสารที่อัปโหลด');
      }
      if (welfareObs) {
        welfare.push('- การจัดสวัสดิการแก่สมาชิกและครอบครัว:');
        welfare.push(welfareObs);
      }
      if (publicBenefitFund > 0) {
        welfare.push('- สหกรณ์จัดสรรทุนสาธารณประโยชน์ จำนวน ' + valOrText(publicBenefitFund) + ' ตามข้อมูลจากเอกสารที่อัปโหลด');
      }
      if (publicBenefitObs) {
        welfare.push('- การดำเนินงานด้านสาธารณประโยชน์:');
        welfare.push(publicBenefitObs);
      }
    } else {
      welfare.push('- ไม่พบข้อมูลการจัดสวัสดิการและสาธารณประโยชน์ของสหกรณ์ในเอกสารที่อัปโหลด');
      welfare.push('- ระบบไม่สามารถระบุกิจกรรมสวัสดิการ/สาธารณประโยชน์ที่สหกรณ์ดำเนินการได้ จนกว่าจะได้รับข้อมูลจากรายงานผู้สอบบัญชี งบการเงิน หรือแบบรายงานผลการดำเนินงานของสหกรณ์');
      welfare.push('- ข้อเสนอแนะ: ควรตรวจสอบข้อมูลการจัดสวัสดิการและสาธารณประโยชน์จากรายงานประจำปี/รายงานผู้สอบบัญชีของสหกรณ์โดยตรง แล้วบันทึกในช่อง "ข้อสังเกต/ข้อมูลสวัสดิการ" ก่อนจัดทำแผน');
    }
    welfare.push('');

    // ใช้ข้อความสวัสดิการที่ผ่านการตรวจสอบแล้ว (ถ้ามี)
    if (preload && preload.fourM && preload.fourM.welfareAnalysis && preload.fourM.welfareAnalysis.length) {
      welfare = preload.fourM.welfareAnalysis.slice();
    }

    // -------------------------------------------------------------------
    // 4) สรุปผลการวิเคราะห์ (Rule-based Summary)
    // -------------------------------------------------------------------
    var summary = [];
    summary.push('สรุปผลการวิเคราะห์');
    
    // 4.1 ด้านการจัดการองค์กร
    summary.push('ด้านการจัดการองค์กร:');
    summary.push('- คณะกรรมการดำเนินการมีจำนวน ' + fmtTextOrPlaceholder(p.boardCount ? S.fmtInt(p.boardCount) + ' คน' : 'ไม่ระบุ') + 
      ' มีความรู้ความสามารถและประสบการณ์เพียงพอในการบริหารงาน');
    if (coopDefects4M || auditorObs4M) {
      summary.push('- ผู้ตรวจสอบกิจการชื่อ ' + fmtTextOrPlaceholder(p.inspectorName) + ' แต่ยังมีข้อสังเกต/ข้อบกพร่องที่ต้องแก้ไข ตามรายงานของผู้สอบบัญชีและการตรวจสอบกิจการ');
    } else {
      summary.push('- ผู้ตรวจสอบกิจการชื่อ ' + fmtTextOrPlaceholder(p.inspectorName) + ' เข้าร่วมประชุมคณะกรรมการดำเนินการเป็นประจำ');
    }
    if (staffCount > 0) {
      summary.push('- มีเจ้าหน้าที่ปฏิบัติงาน ' + S.fmtInt(staffCount) + ' คน');
    }
    summary.push('- สหกรณ์มีการจัดทำแผนงานและงบประมาณประจำปี แต่ยังไม่มีการจัดทำแผนกลยุทธ์/แผนยุทธศาสตร์ระยะยาว จึงควรส่งเสริมให้จัดทำแผนกลยุทธ์ระยะ 3–5 ปี');
    if (auditorObs4M || coopDefects4M) {
      summary.push('- ข้อสังเกตสำคัญที่ต้องเร่งแก้ไข: ' + (auditorObs4M || coopDefects4M));
    }
    summary.push('');
    
    // 4.2 ด้านการเงิน (Rule-based)
    summary.push('ด้านการเงิน:');
    if (profit > 0) {
      summary.push('- สหกรณ์มีผลกำไรสุทธิ ' + valOrText(profit) + 
        (profitPrev > 0 ? ' ' + yoyText(profit, profitPrev) : '') +
        ' แสดงถึงผลการดำเนินงานที่ดี');
    } else if (profit < 0) {
      summary.push('- สหกรณ์มีผลขาดทุนสุทธิ ' + valOrText(Math.abs(profit)) + 
        ' ต้องเร่งทบทวนกลยุทธ์การดำเนินงานและควบคุมต้นทุน');
    } else {
      summary.push('- สหกรณ์ยังไม่มีผลกำไรหรือขาดทุนสุทธิ');
    }
    
    // Current Ratio assessment
    if (currentRatio > 0) {
      if (currentRatio < 1.0) {
        summary.push('- สภาพคล่องทางการเงินอยู่ในเกณฑ์ตึงตัว (อัตราส่วนทุนหมุนเวียน ' + S.fmt(currentRatio, 2) + ') ต้องเร่งบริหารกระแสเงินสด');
      } else if (currentRatio <= 2.5) {
        summary.push('- มีสภาพคล่องทางการเงินอยู่ในเกณฑ์เหมาะสม (อัตราส่วนทุนหมุนเวียน ' + S.fmt(currentRatio, 2) + ')');
      } else {
        summary.push('- มีสภาพคล่องส่วนเกิน (อัตราส่วนทุนหมุนเวียน ' + S.fmt(currentRatio, 2) + ') ควรวางแผนบริหารเงินทุนหมุนเวียนเพื่อสร้างผลตอบแทนเพิ่ม');
      }
    }
    
    // D/E Ratio assessment
    if (deRatio > 0) {
      if (deRatio > 1.5) {
        summary.push('- พึ่งพิงทุนภายนอกค่อนข้างสูง (D/E Ratio ' + S.fmt(deRatio, 2) + ') ควรควบคุมภาระหนี้สิน');
      } else {
        summary.push('- โครงสร้างเงินทุนมีความมั่นคง (D/E Ratio ' + S.fmt(deRatio, 2) + ')');
      }
    }
    
    // ขาดทุนสะสม
    if (bs.accumulatedLoss && S.num(bs.accumulatedLoss) > 0) {
      summary.push('- สหกรณ์มีขาดทุนสะสม ' + valOrText(bs.accumulatedLoss) + ' ควรเร่งฟื้นฟูฐานะการเงิน');
    }
    summary.push('');
    
    // 4.3 ด้านเทคโนโลยี
    summary.push('ด้านเทคโนโลยี:');
    summary.push('- สหกรณ์ใช้โปรแกรมระบบคอมพิวเตอร์ที่พัฒนาโดยกรมตรวจบัญชีสหกรณ์');
    summary.push('- ยังไม่มีการนำ Application Smart 4M มาใช้ในการบริหารจัดการ ควรพิจารณาส่งเสริมการนำ Smart 4M มาใช้เพื่อเพิ่มประสิทธิภาพการทำงาน');
    summary.push('');
    
    // 4.4 การจัดชั้นความเข้มแข็ง
    summary.push('ผลการจัดชั้นความเข้มแข็ง:');
    summary.push('- ผลการดำเนินงานในปีบัญชี ' + String(acctYear) +
      ' ส่งผลให้สหกรณ์มีผลการจัดระดับชั้นความเข้มแข็ง ประจำปี ' + String(latestStrengthYear) +
      ' ในระดับชั้น ' + fmtTextOrPlaceholder(classLatest) +
      (totalLatest > 0 ? ' คะแนนรวม ' + S.fmt(totalLatest, 2) + ' คะแนน' : ''));
    summary.push('- เป้าหมายในการส่งเสริมสหกรณ์แห่งนี้ในปีงบประมาณ พ.ศ. ' + String(planYear) +
      ' คือ สหกรณ์สามารถรักษาระดับชั้น ' + fmtTextOrPlaceholder(classTarget) +
      ' ปี ' + String(targetStrengthYear));
    if (profit > 0 && !(bs.accumulatedLoss && S.num(bs.accumulatedLoss) > 0)) {
      summary.push('- สหกรณ์มีผลการดำเนินงานในระดับที่มีกำไร และไม่มีข้อมูลการทุจริต');
    }
    if (auditorObs4M || coopDefects4M) {
      summary.push('- ยังพบข้อบกพร่อง/ข้อสังเกตที่ต้องติดตามแก้ไขตามรายงานผลการตรวจสอบ');
    } else {
      summary.push('- ควรปฏิบัติงานให้เป็นไปตามกฎหมาย ข้อบังคับ และระเบียบที่เกี่ยวข้องอย่างต่อเนื่อง');
    }
    summary.push('');
    
    // 4.5 จุดอ่อนที่ต้องแก้ไข (Actionable Items)
    var weaknesses = [];
    if (currentRatio < 1.0) weaknesses.push('สภาพคล่องทางการเงินตึงตัว');
    if (currentRatio > 2.5) weaknesses.push('สภาพคล่องส่วนเกินควรบริหารเงินทุนหมุนเวียน');
    if (deRatio > 1.5) weaknesses.push('พึ่งพิงทุนภายนอกสูง');
    if (profit < 0) weaknesses.push('ผลขาดทุนสุทธิ');
    if (bs.accumulatedLoss && S.num(bs.accumulatedLoss) > 0) weaknesses.push('ขาดทุนสะสม');
    
    // ตรวจสอบธุรกิจขาดทุน
    var lossBiz = [];
    if (S.num(creditBiz.netBusinessProfit) < 0) lossBiz.push('เงินให้กู้');
    if (S.num(tradingBiz.netBusinessProfit) < 0) lossBiz.push('จัดหาสินค้า');
    if (S.num(collectionBiz.netBusinessProfit) < 0) lossBiz.push('รวบรวมผลผลิต');
    if (S.num(processingBiz.netBusinessProfit) < 0) lossBiz.push('แปรรูป');
    if (S.num(serviceBiz.netBusinessProfit) < 0) lossBiz.push('บริการ');
    if (S.num(profitDeposit) < 0) lossBiz.push('รับฝากเงิน');
    
    if (weaknesses.length > 0 || lossBiz.length > 0) {
      summary.push('จุดอ่อนที่ต้องเร่งแก้ไข:');
      if (weaknesses.length > 0) {
        summary.push('- ' + weaknesses.join(', '));
      }
      if (lossBiz.length > 0) {
        summary.push('- ธุรกิจที่มีผลขาดทุน: ' + lossBiz.join(', ') + ' ต้องทบทวนการกำหนดราคาและควบคุมต้นทุน');
      }
    }

    var result = {
      orgAnalysis4M: org.join('\n'),
      businessAnalysis: business.join('\n'),
      welfareAnalysis: welfare.join('\n'),
      summaryAnalysis: summary.join('\n')
    };

    // ข้อวิเคราะห์ที่ AI สกัดแยกตามหัวข้อจากไฟล์ที่อัปโหลด เป็นแหล่งข้อมูลหลัก
    // โดยไม่เขียนทับข้อความที่ผ่านการตรวจสอบแล้ว (preload)
    if (uploadedOrg && !preOrgVerified) result.orgAnalysis4M = uploadedOrg;
    if (uploadedBiz && !hasVerifiedBusinessText) result.businessAnalysis = uploadedBiz;
    if (uploadedWelfare && !preWelfareVerified) result.welfareAnalysis = uploadedWelfare;
    if (uploadedSummary && !preOrgVerified && !hasVerifiedBusinessText && !preWelfareVerified) {
      result.summaryAnalysis = uploadedSummary;
    }

    return result;
  }

  /**
   * populate4MFromBaseForm(silent) — ซิงค์ฟอร์มพื้นฐานแล้วสร้างข้อความ 4M ครบทั้ง 4 ด้าน
   * silent = true ใช้ตอนสลับหน้า (เติมเฉพาะช่องว่าง), ไม่ส่งค่า = เขียนทับทั้งหมด
   */
  function populate4MFromBaseForm(silent, force) {
    S.syncFromBaseFormToAllTabs();
    refreshPreloadProfile();
    if (typeof S.recalcFinancials === 'function') S.recalcFinancials();
    if (typeof S.recalcStrength === 'function') S.recalcStrength();
    if (typeof S.recalc4MRatios === 'function') S.recalc4MRatios();
    // คืนอัตราส่วน/ทุนรวมที่ตรวจสอบแล้วก่อนสร้างข้อความ เพื่อให้ตัวเลขในข้อความตรงกับการ์ด
    restoreVerifiedFinancials(currentPreload());
    var result = analyze4M();
    var overwrite = force || !silent;
    Object.keys(result).forEach(function (key) {
      var box = document.querySelector('[data-cpd="analysis.' + key + '"]');
      var existing = box ? String(box.value || '').trim() : '';
      if (overwrite || !existing) {
        if (box) box.value = result[key];
        A().analysis[key] = result[key];
      }
    });
    
    // สร้างข้อความวิเคราะห์ธุรกิจอัตโนมัติจากข้อมูลที่ดึงมาจากไฟล์
    // แต่ไม่เขียนทับถ้ามี preload data อยู่แล้ว (เช่น สหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี)
    var currentBizAnalysis = A().analysis.businessAnalysis || '';
    if (!A().analysis.uploadedBusinessAnalysis &&
      (!currentBizAnalysis || currentBizAnalysis === 'ด้านการบริหารจัดการธุรกิจ' || currentBizAnalysis.length < 100)) {
      generateBusinessAnalysis();
    }
    
    // อัปเดตการ์ดอัตราส่วน/ตัวเลขให้ตรงกับค่าที่คืนกลับมาหลัง recalc
    updateOutputs();
    if (!silent && !force) showToast('ดึงข้อมูลจากฟอร์มพื้นฐานวิเคราะห์ 4M อัตโนมัติแล้ว', 'success');
    return result;
  }

  /**
   * addWeaknessActivitiesFrom4M() - ส่งแนวทางแก้ไขจุดอ่อนจาก 4M ไปยังตารางเป้าหมาย (5.2)
   * วิเคราะห์ข้อมูลทางการเงินและเพิ่มกิจกรรมแก้ไขจุดอ่อนอัตโนมัติ
   */
  function addWeaknessActivitiesFrom4M() {
    var s = A();

    // ลบกิจกรรมที่ระบบสร้างอัตโนมัติรอบก่อนก่อนเสมอ (กันรายการซ้ำ)
    clearAutoGeneratedActivities();

    var f = s.financials || {};
    var bs = f.balanceSheet || {};
    var activities = s.scheduleAndActivities.activities || [];
    
    // ตรวจจับประเภทสหกรณ์และดึง benchmark
    var profile = detectCoopProfile();
    var benchmark = getProfileBenchmarks(profile);
    
    // วิเคราะห์จุดอ่อนจากข้อมูลทางการเงิน
    var weaknesses = [];
    
    // คำนวณอัตราส่วนทางการเงิน
    var currentRatio = bs.currentAssets && bs.currentLiabilities ? 
      (S.num(bs.currentAssets) / S.num(bs.currentLiabilities)) : 0;
    var liabilities = S.num(f.summary2Years.liabilitiesLatest) || S.num(bs.totalLiabilities);
    var assets = S.num(f.summary2Years.assetsLatest) || S.num(bs.totalAssets);
    var equity = assets - liabilities;
    var deRatio = equity > 0 ? (liabilities / equity) : 0;
    var receivables = S.num(f.operatingResults.latest.receivables);
    var income = S.num(f.operatingResults.latest.totalIncome);
    var expense = S.num(f.operatingResults.latest.totalExpense);
    var profit = S.num(f.summary2Years.netProfitLatest) || S.num(bs.netProfitYear);
    var bizVolume = S.num(f.summary2Years.businessVolumeLatest);
    var reserve = S.num(f.summary2Years.reserveFundLatest);
    
    // คำนวณอัตราส่วนเพิ่มเติม
    var roa = assets > 0 ? ((profit / assets) * 100) : 0;
    var roe = equity > 0 ? ((profit / equity) * 100) : 0;
    var reserveRatio = assets > 0 ? (reserve / assets) : 0;
    var profitMargin = bizVolume > 0 ? ((profit / bizVolume) * 100) : 0;
    
    // ใช้ profile-specific thresholds
    var currentRatioMin = benchmark.currentRatioOptimal ? benchmark.currentRatioOptimal.min : 1.0;
    var currentRatioMax = benchmark.currentRatioOptimal ? benchmark.currentRatioOptimal.max : 2.5;
    var deRatioThreshold = benchmark.deRatioThreshold || 1.5;
    var collectionRateThreshold = benchmark.collectionRateThreshold || 85;
    var opexRatioThreshold = benchmark.opexRatioThreshold || 70;
    
    // 1. Current Ratio ต่ำกว่าเกณฑ์
    if (currentRatio > 0 && currentRatio < currentRatioMin) {
      weaknesses.push({
        code: '3.1',
        goal: 'ทบทวนแผนบริหารสภาพคล่องและกระแสเงินสด เนื่องจากอัตราส่วนทุนหมุนเวียนต่ำกว่าเกณฑ์ ' + S.fmt(currentRatioMin, 1) + ' (' + S.fmt(currentRatio, 2) + ') มีความเสี่ยงในการชำระหนี้ระยะสั้น',
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // 2. Current Ratio สูงกว่าเกณฑ์
    if (currentRatio > currentRatioMax) {
      weaknesses.push({
        code: '3.2',
        goal: 'วางแผนบริหารเงินทุนหมุนเวียนส่วนเกิน (อัตราส่วนทุนหมุนเวียน ' + S.fmt(currentRatio, 2) + ') เพื่อสร้างผลตอบแทนเพิ่ม',
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // 3. D/E Ratio สูงกว่าเกณฑ์ตาม profile
    if (deRatio > deRatioThreshold) {
      weaknesses.push({
        code: '3.3',
        goal: 'ควบคุมภาระหนี้สินและต้นทุนทางการเงิน เนื่องจากอัตราส่วนหนี้สินต่อทุนสูงกว่าเกณฑ์ ' + S.fmt(deRatioThreshold, 1) + ' (' + S.fmt(deRatio, 2) + ')',
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // 4. อัตราส่วนลูกหนี้สูง
    if (receivables > 0 && assets > 0) {
      var receivablesRatio = (receivables / assets) * 100;
      var collectionRate = 100 - receivablesRatio;
      if (collectionRate < collectionRateThreshold) {
        weaknesses.push({
          code: '3.4',
          goal: 'เร่งรัดติดตามลูกหนี้และ restructuring หนี้ค้างชำระ เนื่องจากอัตราลูกหนี้ชำระตามกำหนดต่ำกว่าเกณฑ์ ' + collectionRateThreshold + '% (' + S.fmt(collectionRate, 1) + '%)',
          target: '1',
          unit: 'ครั้ง',
          startDate: '',
          endDate: '',
          operator: 'เจ้าหน้าที่ส่งเสริม',
          autoGenerated: true
        });
      }
    }
    
    // 5. Operating Expense Ratio สูงกว่าเกณฑ์ (ใช้ profitBeforeOpEx แทน income)
    var opEx = S.num(f.incomeStatement.operatingExpense);
    var profitBeforeOpEx = S.num(f.incomeStatement.profitBeforeOpEx);
    if (profitBeforeOpEx > 0 && opEx > 0) {
      var opexRatio = (opEx / profitBeforeOpEx) * 100;
      if (opexRatio > opexRatioThreshold) {
        weaknesses.push({
          code: '3.5',
          goal: 'ควบคุมค่าใช้จ่ายดำเนินงานเนื่องจากสูงกว่าเกณฑ์ร้อยละ ' + opexRatioThreshold + ' (' + S.fmt(opexRatio, 1) + '% ของกำไรก่อนหักค่าใช้จ่ายดำเนินงาน)',
          target: '1',
          unit: 'ครั้ง',
          startDate: '',
          endDate: '',
          operator: 'เจ้าหน้าที่ส่งเสริม',
          autoGenerated: true
        });
      }
    }
    
    // 6. Net loss
    if (profit < 0) {
      weaknesses.push({
        code: '3.6',
        goal: 'ทบทวนกลยุทธ์การดำเนินงานและควบคุมต้นทุน เนื่องจากสหกรณ์มีผลขาดทุนสุทธิ ' + S.fmt(Math.abs(profit), 2) + ' บาท',
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // 7. Accumulated loss
    if (bs.accumulatedLoss && S.num(bs.accumulatedLoss) > 0) {
      weaknesses.push({
        code: '3.7',
        goal: 'เร่งฟื้นฟูฐานะการเงินและทบทวนแผนธุรกิจ เนื่องจากมีขาดทุนสะสม ' + S.fmt(bs.accumulatedLoss, 2) + ' บาท',
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // 8. Business losses (ตาม focus business ของ profile)
    var biz = f.businesses || {};
    var lossBiz = [];
    var focusBusiness = benchmark.focusBusiness || [];
    
    focusBusiness.forEach(function(bizKey) {
      if (biz[bizKey] && S.num(biz[bizKey].netBusinessProfit) < 0) {
        var bizNames = {
          'credit': 'เงินให้กู้',
          'trading': 'จัดหาสินค้า',
          'collection': 'รวบรวมผลผลิต',
          'processing': 'แปรรูป',
          'service': 'บริการ',
          'deposit': 'รับฝากเงิน'
        };
        lossBiz.push(bizNames[bizKey] || bizKey);
      }
    });
    
    if (lossBiz.length > 0) {
      weaknesses.push({
        code: '3.8',
        goal: 'วิเคราะห์จุด盈亏และทบทวนการกำหนดราคา ต้นทุนจม และการควบคุมจุดรั่วไหลในธุรกิจ: ' + lossBiz.join(', '),
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // 9. Auditor observations/defects
    var auditorObs = s.analysis.auditorObservations || '';
    var coopDefects = s.analysis.coopDefects || '';
    if (auditorObs.trim().length > 0 || coopDefects.trim().length > 0) {
      weaknesses.push({
        code: '3.9',
        goal: 'ติดตามการแก้ไขข้อสังเกตของผู้สอบบัญชีและข้อบกพร่องของสหกรณ์ ตามมาตรา 22 และแนวทางการตรวจการสหกรณ์',
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // 10. Smart 4M adoption
    weaknesses.push({
      code: '3.10',
      goal: 'ส่งเสริมการนำ Application Smart 4M มาใช้ในการบริหารจัดการสหกรณ์เพื่อเพิ่มประสิทธิภาพการทำงาน',
      target: '1',
      unit: 'ครั้ง',
      startDate: '',
      endDate: '',
      operator: 'เจ้าหน้าที่ส่งเสริม',
      autoGenerated: true
    });
    
    // 11. Profile-specific auto-activity
    if (benchmark.autoActivity) {
      weaknesses.push({
        code: '3.11',
        goal: benchmark.autoActivity,
        target: '1',
        unit: 'ครั้ง',
        startDate: '',
        endDate: '',
        operator: 'เจ้าหน้าที่ส่งเสริม',
        autoGenerated: true
      });
    }
    
    // ตรวจสอบกิจกรรมซ้ำกับรายการที่มีอยู่ (รวมรายการที่ผู้ใช้แก้ไขเอง)
    var existingGoals = activities.map(function (a) { return (a.goal || '').toLowerCase(); });
    function isDuplicate(w) {
      var key = String(w.goal || '').substring(0, 30).toLowerCase();
      return !key || existingGoals.some(function (g) { return g.indexOf(key) !== -1; });
    }

    // เติมวันที่เริ่ม/สิ้นสุดตามปีงบประมาณให้กิจกรรมที่ยังไม่มีวันที่
    var y = planYearInfo();
    var defaultStart = thDate(1, 10, y.startYear);
    var defaultEnd = thDate(30, 9, y.endYear);
    function withDates(w) {
      if (!w.startDate) w.startDate = defaultStart;
      if (!w.endDate) w.endDate = defaultEnd;
      return w;
    }

    // กลุ่มที่ 1: กิจกรรมเป้าหมาย 2.x ที่เจาะจงข้อบกพร่องจริง (เฉพาะสหกรณ์ที่มีข้อมูลตรวจสอบแล้ว)
    var targeted = [];
    var preload = currentPreload();
    if (preload && preload.activities && preload.activities.length) {
      preload.activities.forEach(function (tpl) {
        var t = S.deepClone(tpl);
        if (isDuplicate(t)) return;
        targeted.push(withDates(t));
      });
    }

    // กลุ่มที่ 2: กิจกรรมแก้ไขจุดอ่อนทางการเงิน 3.x
    var financial = weaknesses.filter(function (w) { return !isDuplicate(w); }).map(withDates);

    if (targeted.length === 0 && financial.length === 0) {
      showToast('ไม่พบจุดอ่อนใหม่ที่ต้องเพิ่มกิจกรรม', 'info');
      return;
    }

    // แทรกกลุ่ม 2.x ก่อนหัวข้อ 3 และกลุ่ม 3.x ก่อนหัวข้อ 4
    function insertBeforeHeader(list, headerCode, rows) {
      if (!rows.length) return;
      var idx = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].isHeader && String(list[i].code) === headerCode) { idx = i; break; }
      }
      if (idx === -1) {
        var lastHeader = -1;
        for (var j = 0; j < list.length; j++) {
          if (list[j] && list[j].isHeader) lastHeader = j;
        }
        idx = lastHeader >= 0 ? lastHeader + 1 : list.length;
      }
      list.splice.apply(list, [idx, 0].concat(rows));
    }

    insertBeforeHeader(activities, '3', targeted);
    insertBeforeHeader(activities, '4', financial);

    // อัปเดต state
    s.scheduleAndActivities.activities = activities;

    // Re-render activities table
    renderActivities();

    // Schedule draft save
    S.scheduleLocalDraftSave(500);

    showToast('เพิ่มกิจกรรมเป้าหมาย ' + targeted.length + ' รายการ และกิจกรรมแก้ไขจุดอ่อนทางการเงิน ' + financial.length +
      ' รายการ (Profile: ' + benchmark.name + ')', 'success');
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
  // MIS Report Tracking (ติดตามรายงานระบบ MIS กรมส่งเสริมสหกรณ์)
  // =========================================================================

  var MIS_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  function renderMisReports() {
    var mis = global.CPD_MIS_REPORTS;
    if (!mis || !mis.coops) {
      var box = $('cpd5MisRows');
      if (box) box.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-3">กำลังโหลดข้อมูล MIS...</td></tr>';
      return;
    }

    // Wire event listeners (once)
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

    // Populate month filter
    var monthSel = $('cpd5MisMonth');
    if (monthSel && monthSel.options.length <= 1) {
      MIS_MONTHS.forEach(function (m) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthSel.appendChild(opt);
      });
    }

    // Populate type filter
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

    // Read filters
    var search = ($('cpd5MisSearch') && $('cpd5MisSearch').value || '').toLowerCase().trim();
    var monthFilter = ($('cpd5MisMonth') && $('cpd5MisMonth').value) || '';
    var typeFilter = ($('cpd5MisType') && $('cpd5MisType').value) || '';

    // Build rows
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
        return '<tr>' +
          '<td>' + h(name) + '</td>' +
          '<td class="text-center">' + h(typeLabel) + '</td>' +
          monthCells +
          '</tr>';
      }).join('') : '<tr><td colspan="14" class="text-center text-muted py-3">ไม่พบข้อมูลตามตัวกรอง</td></tr>';
    }

    // Update count badge
    var count = $('cpd5MisCount');
    if (count) count.textContent = filtered.length + ' สหกรณ์';

    // Show report list in footer
    var reportList = $('cpd5MisReportList');
    if (reportList) {
      reportList.innerHTML = R.map(function (r, i) {
        return '<span class="badge bg-light text-dark me-1 mb-1" style="font-size:0.68rem;">' + (i + 1) + '. ' + h(r) + '</span>';
      }).join('');
    }
  }

  // =========================================================================
  // 4M Structured Form + 4M Engine
  // =========================================================================

  // =========================================================================
  // PUBLIC + BOOT
  // =========================================================================

  UI.switchTab = switchTab;
  UI.loadDashboard = loadDashboard;
  UI.fallbackDashboard = fallbackDashboard;
  UI.saveCompletePlan = saveCompletePlan;
  UI.saveDraft = saveDraft;
  UI.showToast = showToast;
  UI.renderDashboard = renderDashboard;
  UI.analyze4M = analyze4M;
  UI.populate4MFromBaseForm = populate4MFromBaseForm;
  UI.addWeaknessActivitiesFrom4M = addWeaknessActivitiesFrom4M;
  UI.detectCoopProfile = detectCoopProfile;
  UI.getProfileBenchmarks = getProfileBenchmarks;
  UI.autoPipeline4M = autoPipeline4M;
  UI.applyUploadedAnalysisNotes = applyUploadedAnalysisNotes;
  UI.clearAutoGeneratedActivities = clearAutoGeneratedActivities;
  UI.renderReportRegistry = renderReportRegistry;
  UI.renderReportRows = renderReportRows;
  UI.renderMisReports = renderMisReports;
  global.CPD_UI = UI;
  global.CPD_autoPipeline = autoPipeline4M;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UI.init);
  } else {
    setTimeout(UI.init, 0);
  }
})(window);

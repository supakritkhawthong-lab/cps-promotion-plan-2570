// ============================================================================
// Code.gs - read-only master data for the Chonburi tracking dashboard
// Keeps getMasterCoopList() and the strength-class rule engine only.
// Plan generation, AI analysis and file upload functions were removed.
// ============================================================================



function doGet() {
  // หน้าเว็บหลักย้ายไป GitHub Pages แล้ว — คง doGet ไว้ไม่ให้ /exec ขึ้น error
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>ระบบติดตามการส่งเสริมสหกรณ์ จังหวัดชลบุรี 2570</title></head>' +
    '<body style="font-family:sans-serif;padding:24px;line-height:1.6">' +
    '<h2>API พร้อมใช้งาน</h2>' +
    '<p>หน้าเว็บหลักอยู่บน GitHub Pages กรุณาเข้าใช้งานจาก URL ของ Pages</p>' +
    '<p>ตรวจสอบสถานะ: <code>POST {"action":"ping"}</code></p>' +
    '</body></html>'
  ).setTitle('ระบบติดตามการส่งเสริมสหกรณ์/กลุ่มเกษตรกร จังหวัดชลบุรี 2570');
}

// แปลงชื่อเดือนให้เป็นรูปแบบวันสิ้นปีทางบัญชีแบบเต็ม
function normalizeFiscalDate(str) {
  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  // ค่าจาก Sheets อาจเป็น Date object — แปลงเป็น "วัน เดือนไทย" ก่อน
  if (Object.prototype.toString.call(str) === '[object Date]' && !isNaN(str.getTime())) {
    return str.getDate() + ' ' + TH_MONTHS[str.getMonth()] + ' ' + str.getFullYear();
  }
  const s = String(str || '').trim();
  // Keep an explicit 4-digit year when the document supplied one; otherwise
  // keep the existing month-only shape (older sheets use 2-digit years).
  const yearMatch = s.match(/(25\d{2}|20\d{2})/);
  const yearSuffix = yearMatch ? ' ' + yearMatch[1] : '';
  const map = [
    { keys: ['มกราคม', 'ม.ค.'], full: '31 มกราคม' },
    { keys: ['กุมภาพันธ์', 'ก.พ.'], full: '28 กุมภาพันธ์' },
    { keys: ['มีนาคม', 'มี.ค.'], full: '31 มีนาคม' },
    { keys: ['เมษายน', 'เม.ย.'], full: '30 เมษายน' },
    { keys: ['พฤษภาคม', 'พ.ค.'], full: '31 พฤษภาคม' },
    { keys: ['มิถุนายน', 'มิ.ย.'], full: '30 มิถุนายน' },
    { keys: ['กรกฎาคม', 'ก.ค.'], full: '31 กรกฎาคม' },
    { keys: ['สิงหาคม', 'ส.ค.'], full: '31 สิงหาคม' },
    { keys: ['กันยายน', 'ก.ย.'], full: '30 กันยายน' },
    { keys: ['ตุลาคม', 'ต.ค.'], full: '31 ตุลาคม' },
    { keys: ['พฤศจิกายน', 'พ.ย.'], full: '30 พฤศจิกายน' },
    { keys: ['ธันวาคม', 'ธ.ค.'], full: '31 ธันวาคม' }
  ];
  for (let i = 0; i < map.length; i++) {
    for (let k = 0; k < map[i].keys.length; k++) {
      if (s.includes(map[i].keys[k])) return map[i].full + yearSuffix;
    }
  }
  return s || '31 มีนาคม';
}

// ----------------------------------------------------------------------------
// Rule-Based Engine & Strength Score Simulator (สแกน 18 ตัวชี้วัด + Gap Analysis)
// ----------------------------------------------------------------------------
function evaluateCoopStrengthAndGap(coopType, subScores, level69, total69) {
  const typeStr = String(coopType || '');
  const isAgri = typeStr.includes('เกษตร') || typeStr.includes('ประมง') || typeStr.includes('นิคม');
  const isGroup = typeStr.includes('กลุ่มเกษตรกร');
  const s = subScores || {};
  const num = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? 0 : Number(v);
  const tot = num(total69);
  const lv = String(level69 || 'ชั้น 3').trim();

  const max1_2 = isGroup ? 12 : (isAgri ? 10 : 15);
  const max4_1 = isGroup ? 10 : 15;

  // รายการตัวชี้วัดและคะแนนเต็มตามประเภทสหกรณ์
  const indicators = [
    { id: '1.1', name: 'อัตราส่วนสมาชิกที่มีส่วนร่วมทำธุรกิจกับสหกรณ์', score: num(s.s1_1), max: 15, ease: 'ปานกลาง (กระตุ้นสมาชิกทำธุรกิจเพิ่ม)' },
    { id: '1.2', name: isGroup ? 'การจัดสรรกำไรสุทธิและจ่ายปันผล/เฉลี่ยคืน' : 'การจัดสรรและเบิกจ่ายทุนสวัสดิการสมาชิกและทุนสาธารณประโยชน์ครบ 2 ทุน', score: num(s.s1_2), max: max1_2, ease: 'ง่ายที่สุด (จัดสรรและเบิกจ่ายจริงตามระเบียบ ได้คะแนนเต็มทันที)' }
  ];
  if (isAgri && !isGroup) {
    indicators.push({ id: '1.3', name: 'จำนวนประเภทธุรกิจที่สหกรณ์ดำเนินการ (6 ประเภทธุรกิจหลัก)', score: num(s.s1_3), max: 5, ease: 'ปานกลาง (ขยายบริการธุรกิจให้ครบ 6 ด้าน)' });
  }
  indicators.push(
    { id: '2.1', name: 'อัตราส่วนหนี้สินต่อทุน (D/E Ratio)', score: num(s.s2_1), max: 3, ease: 'ปานกลาง (เพิ่มทุนเรือนหุ้น/ทุนสำรอง และลดหนี้ภายนอก)' },
    { id: '2.2', name: 'อัตราส่วนทุนสำรองต่อสินทรัพย์', score: num(s.s2_2), max: 2, ease: 'ปานกลาง (จัดสรรกำไรเป็นทุนสำรองเพิ่ม)' },
    { id: '2.3', name: 'อัตราผลตอบแทนต่อสินทรัพย์ (ROA)', score: num(s.s2_3), max: 4, ease: 'ปานกลาง (บริหารสินทรัพย์ให้เกิดรายได้)' },
    { id: '2.4', name: 'อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่าย', score: num(s.s2_4), max: 4, ease: 'ง่าย (ควบคุมและลดค่าใช้จ่ายดำเนินงานที่ไม่จำเป็น)' },
    { id: '2.5', name: 'อัตราส่วนทุนหมุนเวียน (Current Ratio)', score: num(s.s2_5), max: 3, ease: 'ปานกลาง (ดำรงสินทรัพย์สภาพคล่อง)' },
    { id: '2.6', name: 'อัตราลูกหนี้ระยะสั้นที่ชำระหนี้ได้ตามกำหนด', score: num(s.s2_6), max: 4, ease: 'สำคัญ (เร่งรัดติดตามหนี้ค้างชำระก่อนสิ้นปีบัญชี)' },
    { id: '3.1', name: 'การใช้เทคโนโลยีสารสนเทศโปรแกรมระบบบัญชี กตส.', score: num(s.s3_1), max: 4, ease: 'ง่ายที่สุด (ใช้งานโปรแกรมบัญชี กตส. ให้ครบระบบ)' },
    { id: '3.2', name: 'การควบคุมภายใน: สภาพแวดล้อมการควบคุม', score: num(s.s3_2), max: 4, ease: 'ง่าย (จัดทำโครงสร้าง คู่มือ และระเบียบปฏิบัติงานให้ครบ)' },
    { id: '3.3', name: 'การควบคุมภายใน: การประเมินความเสี่ยงและกิจกรรมควบคุม', score: num(s.s3_3), max: 4, ease: 'ง่าย (ประเมินความเสี่ยงและวางมาตรการควบคุม)' },
    { id: '3.4', name: 'การควบคุมภายใน: ระบบสารสนเทศและการสื่อสารข้อมูล', score: num(s.s3_4), max: 4, ease: 'ง่าย (รายงานข้อมูลการเงินและเผยแพร่แก่สมาชิก)' },
    { id: '3.5', name: 'การควบคุมภายใน: ระบบการติดตามและประเมินผล', score: num(s.s3_5), max: 4, ease: 'ง่าย (ติดตามผลการควบคุมภายในและผู้ตรวจสอบกิจการเข้าตรวจ)' },
    { id: '4.1', name: '[เงื่อนไขสำคัญ] ผลการดำเนินงานไม่มีข้อบกพร่อง/ทุจริต หรือแก้ไขเสร็จสมบูรณ์', score: num(s.s4_1), max: max4_1, ease: 'เงื่อนไขบังคับ (ต้องเร่งแก้ไขข้อบกพร่องให้เสร็จสิ้นเพื่อปลดล็อกระดับชั้น)' },
    { id: '4.2', name: '[เงื่อนไขสำคัญ] ผลการดำเนินงานไม่ขาดทุนในรอบ 2 ปีบัญชี', score: num(s.s4_2), max: 5, ease: 'เงื่อนไขบังคับ (ต้องบริหารให้มีกำไรสุทธิประจำปี)' },
    { id: '4.3', name: 'ส่งงบการเงินภายใน 30 วัน และประชุมใหญ่อนุมัติงบภายใน 150 วัน', score: num(s.s4_3), max: 5, ease: 'ง่ายที่สุด (วางแผนปิดบัญชี 3 ระยะ ส่งงบภายใน 30 วันได้ 5 คะแนนเต็มทันที)' },
    { id: '4.4', name: 'การจัดจ้างเจ้าหน้าที่ปฏิบัติงานประจำ', score: num(s.s4_4), max: 5, ease: 'ง่าย (จัดทำสัญญาจ้างเจ้าหน้าที่ปฏิบัติงานประจำ)' }
  );

  const weaknesses = [];
  const easyWins = [];

  indicators.forEach(ind => {
    const gap = +(ind.max - ind.score).toFixed(2);
    if (gap > 0) {
      weaknesses.push(`${ind.name} (ได้ ${ind.score}/${ind.max} คะแนน ขาดอีก ${gap} คะแนน)`);
      easyWins.push({
        id: ind.id,
        name: ind.name,
        score: ind.score,
        max: ind.max,
        gap: gap,
        ease: ind.ease
      });
    }
  });

  // เรียงลำดับตัวชี้วัดที่เก็บคะแนนเพิ่มได้ง่ายและคุ้มค่าที่สุดขึ้นก่อน
  easyWins.sort((a, b) => {
    const pA = a.id.startsWith('4.') ? 100 : (a.ease.includes('ง่ายที่สุด') ? 90 : (a.ease.includes('ง่าย') ? 80 : 50));
    const pB = b.id.startsWith('4.') ? 100 : (b.ease.includes('ง่ายที่สุด') ? 90 : (b.ease.includes('ง่าย') ? 80 : 50));
    if (pB !== pA) return pB - pA;
    return b.gap - a.gap;
  });

  // วิเคราะห์เงื่อนไขการผ่านชั้น 1 และชั้น 2 (Gap Analysis)
  const s4_1 = num(s.s4_1);
  const s4_2 = num(s.s4_2);

  // เกณฑ์จัดชั้นของ "กลุ่มเกษตรกร" ไม่เหมือนสหกรณ์ (ผลปี 2569 มีกลุ่มที่ได้ 80-84.67
  // คะแนนแต่ยังอยู่ชั้น 2) จึงยึดผลการจัดชั้นจริงที่ระบบส่งมา (level69) เป็นหลัก
  // ห้ามประกาศว่าอยู่ชั้น 1 จากคะแนนเอง เพราะจะขัดกับผลจัดชั้นของ กสส.
  const lvCompact = String(lv).replace(/\s+/g, '');
  const hasOfficialLevel = /^ชั้น[123]$/.test(lvCompact);
  const officialClass1 = lvCompact === 'ชั้น1';
  const officialClass2 = lvCompact === 'ชั้น2';

  const passTier1 = isGroup
    ? (hasOfficialLevel && officialClass1)
    : (tot >= 80 && s4_1 >= max4_1 && s4_2 >= 5);
  const passTier2 = isGroup
    ? (hasOfficialLevel && (officialClass1 || officialClass2))
    : (tot >= 55 && s4_1 >= 10 && s4_2 >= 3);

  const gapToTier2Score = Math.max(0, +(55 - tot).toFixed(2));
  const gapToTier1Score = Math.max(0, +(80 - tot).toFixed(2));

  const gapSummaryLines = [];
  if (isGroup) {
    // กลุ่มเกษตรกร: รายงานตามผลการจัดชั้นจริง + เป้าหมายชั้นถัดไป (ไม่ใช้เกณฑ์ 55/80 ของสหกรณ์)
    if (officialClass1) {
      gapSummaryLines.push(`🏆 ปัจจุบันกลุ่มเกษตรกรอยู่ในระดับ "ชั้น 1" (${tot} คะแนน) เป้าหมายปี 2570 คือการรักษามาตรฐานระดับชั้น 1 อย่างต่อเนื่อง`);
    } else if (hasOfficialLevel) {
      const nextClass = officialClass2 ? 'ชั้น 1' : 'ชั้น 2';
      const noteThreshold = tot >= 80
        ? ' (คะแนนถึง 80 แล้ว แต่เกณฑ์ของกลุ่มเกษตรกรยังไม่เลื่อนชั้น)'
        : '';
      gapSummaryLines.push(`📊 ผลการจัดชั้นปี 2569 ของกลุ่มเกษตรกรอยู่ "${lv}" (${tot} คะแนน) — เกณฑ์การจัดชั้นของกลุ่มเกษตรกรต่างจากสหกรณ์${noteThreshold} เป้าหมายปี 2570 คือยกระดับขึ้น "${nextClass}" ตามเกณฑ์ของกลุ่มเกษตรกร`);
    } else {
      gapSummaryLines.push(`⚠️ ยังไม่มีผลการจัดชั้นปี 2569 ของกลุ่มเกษตรกร (${tot} คะแนน) จึงยังสรุปชั้นไม่ได้`);
    }
    if (s4_1 < max4_1) {
      gapSummaryLines.push(`❌ ตัวชี้วัดที่ 4.1 (ข้อบกพร่อง/ทุจริต): ปัจจุบันได้ ${s4_1}/${max4_1} คะแนน ต้องแก้ไขให้เสร็จสมบูรณ์เพื่อเลื่อนชั้น`);
    }
  } else if (!passTier2) {
    if (tot >= 55) {
      gapSummaryLines.push(`⚠️ คะแนนรวมปัจจุบัน (${tot} คะแนน) ผ่านเกณฑ์ขั้นต่ำ 55 คะแนนของชั้น 2 แล้ว แต่ที่ตกไปอยู่ "${lv}" เพราะติดเงื่อนไขสำคัญในมิติที่ 4!`);
    } else {
      gapSummaryLines.push(`⚠️ ปัจจุบันอยู่ "${lv}" (${tot} คะแนน) ยังขาดคะแนนรวมอีก ${gapToTier2Score} คะแนน จึงจะถึงเกณฑ์ชั้น 2 (55 คะแนน) และขาดอีก ${gapToTier1Score} คะแนน เพื่อถึงเกณฑ์ชั้น 1 (80 คะแนน)`);
    }
    if (s4_1 < 10) {
      gapSummaryLines.push(`❌ ติดเงื่อนไขสำคัญตัวชี้วัดที่ 4.1 (ข้อบกพร่อง/ทุจริต): ปัจจุบันได้ ${s4_1}/${max4_1} คะแนน (เกณฑ์ชั้น 2 ต้องได้ >= 10 คะแนน คือแก้ไขเสร็จและอยู่ระหว่างติดตาม / เกณฑ์ชั้น 1 ต้องได้ ${max4_1} คะแนนเต็ม)`);
    }
    if (s4_2 < 3) {
      gapSummaryLines.push(`❌ ติดเงื่อนไขสำคัญตัวชี้วัดที่ 4.2 (ผลประกอบการ): ปัจจุบันได้ ${s4_2}/5 คะแนน (เกณฑ์ชั้น 2 ต้องไม่ขาดทุนในปีที่ประเมิน >= 3 คะแนน / เกณฑ์ชั้น 1 ต้องไม่ขาดทุนทั้ง 2 ปี = 5 คะแนนเต็ม)`);
    }
  } else if (!passTier1) {
    if (tot >= 80) {
      gapSummaryLines.push(`⚠️ คะแนนรวมปัจจุบัน (${tot} คะแนน) ถึงเกณฑ์ 80 คะแนนของชั้น 1 แล้ว แต่ยังไม่สามารถขึ้นชั้น 1 ได้เพราะติดเงื่อนไขสำคัญในมิติที่ 4!`);
    } else {
      gapSummaryLines.push(`✅ ปัจจุบันผ่านเกณฑ์ "${lv}" (${tot} คะแนน) แล้ว หากต้องการยกระดับขึ้นสู่ "ชั้น 1" ต้องทำคะแนนเพิ่มอีก ${gapToTier1Score} คะแนน (ให้ถึง 80 คะแนน)`);
    }
    if (s4_1 < max4_1) {
      gapSummaryLines.push(`❌ ติดเงื่อนไขสำคัญของชั้น 1 (ตัวชี้วัด 4.1): ปัจจุบันได้ ${s4_1}/${max4_1} คะแนน ต้องเร่งรัดแก้ไขข้อบกพร่องให้แล้วเสร็จสมบูรณ์จนได้ ${max4_1} คะแนนเต็ม (+${max4_1 - s4_1} คะแนน)`);
    }
    if (s4_2 < 5) {
      gapSummaryLines.push(`❌ ติดเงื่อนไขสำคัญของชั้น 1 (ตัวชี้วัด 4.2): ปัจจุบันได้ ${s4_2}/5 คะแนน ต้องบริหารให้มีกำไรสุทธิต่อเนื่องครบ 2 ปีบัญชีจนได้ 5 คะแนนเต็ม`);
    }
  } else {
    gapSummaryLines.push(`🏆 ปัจจุบันสหกรณ์อยู่ในระดับ "ชั้น 1" (${tot} คะแนน) และผ่านเงื่อนไขสำคัญครบทุกข้อ เป้าหมายปี 2570 คือการรักษามาตรฐานระดับชั้น 1 อย่างต่อเนื่อง`);
  }

  return {
    isAgri: isAgri,
    coopCategoryName: isGroup ? "กลุ่มเกษตรกร" : (isAgri ? "สหกรณ์ภาคการเกษตร (ประเมินรวมตัวชี้วัด 1.3)" : "สหกรณ์นอกภาคการเกษตร (ไม่ประเมิน 1.3 น้ำหนักอยู่ที่ 1.2 เต็ม 15 คะแนน)"),
    currentTotal: tot,
    currentLevel: lv,
    gapToTier2Score: gapToTier2Score,
    gapToTier1Score: gapToTier1Score,
    passTier2: passTier2,
    passTier1: passTier1,
    gapSummaryLines: gapSummaryLines,
    weaknesses: weaknesses,
    easyWins: easyWins.slice(0, 6)
  };
}

// ----------------------------------------------------------------------------
// 1. ดึงฐานข้อมูลสหกรณ์ + ประวัติที่เคยบันทึกไว้ (Save Draft / Load History)
// ----------------------------------------------------------------------------
function getMasterCoopList() {
  const ss = getSS_();
  const sheetAssign = ss.getSheetByName('คำสั่งมอบหมาย');
  const sheet68 = ss.getSheetByName('ผลปี68');
  const sheet69 = ss.getSheetByName('ผลปี69');
  const sheetLog = ss.getSheetByName('บันทึกข้อมูล');

  const cleanName = (str) => String(str || '').replace(/\s+/g, ' ').trim();

  const savedDraftsMap = {};
  if (sheetLog && sheetLog.getLastRow() > 1) {
    const logData = sheetLog.getDataRange().getValues();
    for (let r = 1; r < logData.length; r++) {
      const cName = cleanName(logData[r][1]);
      const jsonStr = logData[r][7];
      if (cName && jsonStr) {
        try {
          savedDraftsMap[cName] = {
            savedAt: Utilities.formatDate(new Date(logData[r][0]), "GMT+7", "dd/MM/yyyy HH:mm"),
            formData: JSON.parse(jsonStr)
          };
        } catch (e) {}
      }
    }
  }

  const map68 = {};
  if (sheet68) {
    sheet68.getDataRange().getValues().forEach(row => {
      const name = cleanName(row[2]);
      if (name && (name.includes('สหกรณ์') || name.includes('กลุ่มเกษตรกร'))) {
        map68[name] = {
          code13: cleanName(row[3]),
          coopType: cleanName(row[4]),
          d1: row[8], d2: row[15], d3: row[22], d4: row[27],
          total: row[30], level: String(row[31] || '').replace('ชั้น', 'ชั้น '),
          fy: normalizeFiscalDate(row[37])
        };
      }
    });
  }

  const map69 = {};
  if (sheet69) {
    sheet69.getDataRange().getValues().forEach(row => {
      const name = cleanName(row[2]);
      if (name && (name.includes('สหกรณ์') || name.includes('กลุ่มเกษตรกร'))) {
        const coopType = cleanName(row[4]);
        const subScores = {
          s1_1: row[5], s1_2: row[6], s1_3: row[7],
          s2_1: row[9], s2_2: row[10], s2_3: row[11], s2_4: row[12], s2_5: row[13], s2_6: row[14],
          s3_1: row[16], s3_2: row[17], s3_3: row[18], s3_4: row[19], s3_5: row[20],
          s4_1: row[23], s4_2: row[24], s4_3: row[25], s4_4: row[26]
        };
        const lv = String(row[31] || '').replace('ชั้น', 'ชั้น ');
        const tot = row[30];
        const simResult = evaluateCoopStrengthAndGap(coopType, subScores, lv, tot);

        map69[name] = {
          code13: cleanName(row[3]),
          coopType: coopType,
          d1: row[8], d2: row[15], d3: row[22], d4: row[27],
          total: tot, level: lv,
          fy: normalizeFiscalDate(row[37]),
          closeStatus: cleanName(row[34]),
          agmStatus: cleanName(row[35]),
          cadNote: cleanName(row[32]),
          subScores: subScores,
          simResult: simResult
        };
      }
    });
  }

  const coopList = [];
  let currentZone = "";
  let defaultDistrict = "";

  if (sheetAssign) {
    // A cooperative name must appear only once in the dropdown. The first row
    // is the sheet header and must never be treated as a cooperative.
    const seenCoopNames = {};
    sheetAssign.getDataRange().getValues().forEach(function (row, rowIndex) {
      if (rowIndex === 0) return;
      const col1 = cleanName(row[1]);
      if (col1.includes('กลุ่มส่งเสริมสหกรณ์')) {
        const matchZone = col1.match(/กลุ่มส่งเสริมสหกรณ์\s*(\d+)/);
        if (matchZone) currentZone = "กสส." + matchZone[1];
        const matchDist = col1.match(/\(อำเภอ(.*?)\)/);
        if (matchDist) {
          const dists = matchDist[1].trim().split(/\s+/);
          defaultDistrict = dists.length === 1 ? dists[0] : "";
        }
      } else if (col1 && (col1.includes('สหกรณ์') || col1.includes('กลุ่มเกษตรกร')) && col1 !== 'สหกรณ์/กลุ่มเกษตรกร') {
        if (seenCoopNames[col1]) return;
        seenCoopNames[col1] = true;
        const mainOfficer = cleanName(row[2]);
        const coArr = [row[3], row[4], row[5], row[6], row[7]].map(x => cleanName(x).split(' ')[0]).filter(x => x && x !== 'nan' && x !== 'ชื่อ');

        let s68 = map68[col1] || {};
        let s69 = map69[col1] || {};

        // กลุ่มเกษตรกรที่ยังไม่มีคะแนนปี 2569 ในชีต: เติมจากชุดข้อมูลสำรองที่มากับระบบ
        // (ข้อมูลจากชีตจริงต้องชนะเสมอ — ตรวจด้วย hasStrengthScore69_)
        if (col1.includes('กลุ่มเกษตรกร') && !hasStrengthScore69_(s69)) {
          const bundledRec = getGroupStrength69Record_(col1);
          const bundled69 = buildGroupScore69_(bundledRec);
          if (bundled69) {
            s69 = bundled69;
            if (!s68.level) {
              const bundled68 = buildGroupScore68Meta_(bundledRec);
              if (bundled68.level) {
                // เก็บยอดเดิม (ถ้ามี) ไว้ทั้งหมด เติมเฉพาะระดับชั้น/ปีบัญชีที่ยังว่าง
                s68 = Object.assign({}, s68, { level: bundled68.level });
                if (!s68.fy) s68.fy = bundled68.fy;
              }
            }
          }
        }

        // A cooperative whose name says กลุ่มเกษตรกร must always use the group
        // criteria, even if the score sheet carries a generic "สหกรณ์" type.
        const isGroupRow = col1.includes('กลุ่มเกษตรกร');
        const coopType = isGroupRow ? 'กลุ่มเกษตรกร'
          : (s69.coopType || s68.coopType || 'สหกรณ์');
        const sim = s69.simResult || evaluateCoopStrengthAndGap(coopType, {}, 'ชั้น 3', 0);

        coopList.push({
          name: col1,
          code13: s69.code13 || s68.code13 || "",
          coopType: coopType,
          isAgri: sim.isAgri,
          coopCategoryName: sim.coopCategoryName,
          weaknesses: sim.weaknesses,
          simResult: sim,
          zone: currentZone,
          district: defaultDistrict,
          mainOfficer: mainOfficer,
          coOfficers: coArr.join('/'),
          fiscalYear: s69.fy || s68.fy || "31 มีนาคม",
          score68: s68,
          score69: s69,
          savedDraft: savedDraftsMap[col1] || null
        });
      }
    });
  }
  return coopList;
}

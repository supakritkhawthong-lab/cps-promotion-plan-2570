// ============================================================================
// ไฟล์: Code.gs
// ระบบจัดทำแผนส่งเสริมสหกรณ์/กลุ่มเกษตรกร รายแห่ง ปีงบประมาณ พ.ศ. 2570
// สำนักงานสหกรณ์จังหวัดชลบุรี (Full Enterprise Version)
// ============================================================================



function doGet() {
  // หน้าเว็บหลักย้ายไป GitHub Pages แล้ว — คง doGet ไว้ไม่ให้ /exec ขึ้น error
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>ระบบจัดทำแผนส่งเสริมสหกรณ์ 2570</title></head>' +
    '<body style="font-family:sans-serif;padding:24px;line-height:1.6">' +
    '<h2>API พร้อมใช้งาน</h2>' +
    '<p>หน้าเว็บหลักย้ายไป GitHub Pages แล้ว กรุณาเข้าใช้งานจาก URL ของ Pages</p>' +
    '<p>ตรวจสอบสถานะ: <code>POST {"action":"ping"}</code></p>' +
    '</body></html>'
  ).setTitle('ระบบจัดทำแผนส่งเสริมสหกรณ์/กลุ่มเกษตรกร รายแห่ง ปีงบประมาณ พ.ศ. 2570');
}

// แปลงชื่อเดือนให้เป็นรูปแบบวันสิ้นปีทางบัญชีแบบเต็ม
function normalizeFiscalDate(str) {
  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  // ค่าจาก Sheets อาจเป็น Date object — แปลงเป็น "วัน เดือนไทย" ก่อน
  if (Object.prototype.toString.call(str) === '[object Date]' && !isNaN(str.getTime())) {
    return str.getDate() + ' ' + TH_MONTHS[str.getMonth()];
  }
  const s = String(str || '').trim();
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
      if (s.includes(map[i].keys[k])) return map[i].full;
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
  const passTier1 = (tot >= 80 && s4_1 >= max4_1 && s4_2 >= 5);
  const passTier2 = (tot >= 55 && s4_1 >= 10 && s4_2 >= 3);

  const gapToTier2Score = Math.max(0, +(55 - tot).toFixed(2));
  const gapToTier1Score = Math.max(0, +(80 - tot).toFixed(2));

  const gapSummaryLines = [];
  if (!passTier2) {
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
    sheetAssign.getDataRange().getValues().forEach(row => {
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
        const mainOfficer = cleanName(row[2]);
        const coArr = [row[3], row[4], row[5], row[6], row[7]].map(x => cleanName(x).split(' ')[0]).filter(x => x && x !== 'nan' && x !== 'ชื่อ');

        const s68 = map68[col1] || {};
        const s69 = map69[col1] || {};
        const coopType = s69.coopType || s68.coopType || (col1.includes('กลุ่มเกษตรกร') ? 'กลุ่มเกษตรกร' : 'สหกรณ์');
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

// บันทึกข้อมูลร่างลงชีต 'บันทึกข้อมูล'
function saveDraftToSheet(form) {
  return withScriptLock_(function () {
    const ss = getSS_();
    let logSheet = ss.getSheetByName('บันทึกข้อมูล');
    if (!logSheet) logSheet = ss.insertSheet('บันทึกข้อมูล');
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(['วันเวลาที่บันทึก', 'ชื่อสหกรณ์', 'อำเภอ', 'ปีบัญชี', 'ผู้สอบบัญชี', 'จำนวนครั้งที่เข้า', 'หมายเหตุจำนวนครั้ง', 'JSON_DATA']);
    }

    const cleanName = (str) => String(str || '').replace(/\s+/g, ' ').trim();
    const targetName = cleanName(form.coop_name);
    const auditorDisplay = form.auditor_name ? `${form.auditor_type} (${form.auditor_name})` : (form.auditor_type || "");
    const jsonStr = JSON.stringify(form);
    const now = new Date();

    const data = logSheet.getDataRange().getValues();
    let foundRow = -1;
    for (let r = 1; r < data.length; r++) {
      if (cleanName(data[r][1]) === targetName) {
        foundRow = r + 1;
        break;
      }
    }

    const rowValues = [now, form.coop_name, form.district, form.fiscal_year, auditorDisplay, form.planned_visits, form.visit_remark, jsonStr];
    if (foundRow > 0) {
      logSheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      logSheet.appendRow(rowValues);
    }

    return { savedAt: Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy HH:mm") };
  });
}

// ----------------------------------------------------------------------------
// 2. วิเคราะห์เอกสารด้วย AI (Fast Mode: รองรับทั้ง Text ที่สกัดมาจากเบราว์เซอร์และไฟล์แนบ)
// ----------------------------------------------------------------------------
function getFallbackModelsList(excludeList) {
  const fallback = [];
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${getGeminiKey_()}`;
    const res = UrlFetchApp.fetch(listUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      (data.models || []).forEach(m => {
        const name = (m.name || "").replace("models/", "");
        const methods = m.supportedGenerationMethods || [];
        const isTextModel = /^gemini-[0-9]/.test(name) &&
          !/tts|image|embedding|vision|robotics|computer-use|lyria|gemma|nano-banana|omni|transcribe/.test(name);
        if (isTextModel && methods.includes("generateContent") && !excludeList.includes(name)) {
          fallback.push(name);
        }
      });
      // ให้ flash มาก่อน แล้วเรียงเวอร์ชันใหม่ → เก่า
      fallback.sort((a, b) => {
        const aFlash = a.includes("flash") ? 1 : 0;
        const bFlash = b.includes("flash") ? 1 : 0;
        if (aFlash !== bFlash) return bFlash - aFlash;
        return b.localeCompare(a);
      });
    }
  } catch (e) {}
  return fallback;
}

function analyzeUploadedFilesWithAI(payload) {
  // เรียกโมเดลความเร็วสูงทันทีโดยไม่ต้องเสียเวลาเรียก ListModels ก่อน
  // ดูลำดับรุ่นได้จาก Script Property GEMINI_MODELS (คั่นด้วยจุลภาค)
  // ค่าเริ่มต้น: gemini-3.5-flash → gemini-3.8-flash → gemini-2.5-flash
  // (gemini-2.0-flash เลิกให้บริการแล้ว จึงต้องไม่อยู่ในลิสต์)
  let modelsToTry = String(getProp_('GEMINI_MODELS') || 'gemini-3.5-flash,gemini-3.8-flash,gemini-2.5-flash')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const ruleWeaknessesText = (payload.weaknesses && payload.weaknesses.length > 0)
    ? payload.weaknesses.map((w, i) => `${i + 1}) ${w}`).join("\n")
    : "คะแนนตัวชี้วัดหลักอยู่ในเกณฑ์ดี ให้มุ่งเน้นการรักษามาตรฐานและการควบคุมภายใน";

    const promptText = `
คุณคือนักวิชาการสหกรณ์ชำนาญการพิเศษ กรมส่งเสริมสหกรณ์
จงอ่านข้อมูลจากเอกสารงบการเงินและรายงานของ "${payload.coopName}" (${payload.coopCategoryName || 'สหกรณ์'}) ปีบัญชี ${payload.dbFiscalYear || '-'} แล้วสกัดตัวเลขพร้อมสรุปแผนด้วยภาษาราชการที่กระชับ สมบูรณ์ และเป็นทางการ

ข้อมูลจากการสแกนตัวชี้วัดด้วยระบบ Rule-Based Engine:
- ผลความเข้มแข็ง ปี 68: ${payload.score68?.level || '-'} (${payload.score68?.total || '-'} คะแนน) | ปี 69: ${payload.score69?.level || '-'} (${payload.score69?.total || '-'} คะแนน)
- จุดอ่อนที่ต้องนำไปกำหนดเป็นเป้าหมายการส่งเสริม (ห้ามระบุเลขข้อตัวชี้วัด หรือคำว่ามิติที่... ในคำตอบ):
${ruleWeaknessesText}

ข้อกำหนดสำคัญในการดึงตัวเลขจากงบฐานะการเงิน (งบดุล) และงบกำไรขาดทุน:
1. "shareLatest" และ "sharePrev" (ช่องหุ้น): ให้ดึงตัวเลขจากรายการ ทุนเรือนหุ้น (ทุนเรือนหุ้นที่ชำระเต็มมูลค่าแล้ว) เท่านั้น! ห้ามนำยอด รวมทุนของสหกรณ์ มาใส่โดยเด็ดขาด
2. "reserveLatest" และ "reservePrev" (ช่องทุนสำรอง): ให้ดึงเฉพาะรายการ ทุนสำรอง เท่านั้น (ไม่รวมทุนสะสมตามข้อบังคับอื่น)
3. "debtLatest" และ "debtPrev" (ช่องหนี้สิน): ให้ดึงจากยอด รวมหนี้สิน (Total Liabilities) ห้ามใช้ยอดรวมหนี้สินและทุนของสหกรณ์
4. "assetLatest" และ "assetPrev" (ช่องสินทรัพย์): ให้ดึงจากยอด รวมสินทรัพย์ (Total Assets)
5. ต้องสกัดตัวเลขทั้งปีบัญชีล่าสุด (Year N) และย้อนหลัง 1 ปี (Year N-1) ให้ครบทุกช่องตามโครงสร้าง JSON ด้านล่าง
6. หากเอกสารระบุเฉพาะยอดปีล่าสุดพร้อมข้อความผลต่าง เช่น เพิ่มขึ้น 1,104,363.77 หรือ ลดลง 58,491.24 ให้ใส่ข้อความผลต่างนั้นในออบเจกต์ "changes" ตามชื่อตัวชี้วัด (wc, coopCap, loan, payable, cash, inventory, ppe, receivable, otherAsset, income, expense, salesTrading, costTrading, profitTrading, salesProcessing, costProcessing, profitProcessing, depositAmount, profitDeposit, assets, debt, share, reserve, profit) ระบบจะคำนวณย้อนหลังให้อัตโนมัติ
7. ตัวเลขทุกช่องให้ใส่เป็นข้อความที่มีลูกน้ำคั่นหลักพันและทศนิยม 2 ตำแหน่ง (เช่น 25,723,883.12) หากไม่พบให้ใส่ -
8. "membersDepositLatest/TradingLatest/ProcessingLatest" = จำนวนสมาชิกที่ร่วมทำธุรกิจแต่ละประเภท, "agmAttendeesLatest" = จำนวนสมาชิกที่เข้าประชุมใหญ่สามัญประจำปี, "staffCountLatest" = จำนวนเจ้าหน้าที่ประจำ
9. "auditorObservations" ให้สรุปข้อสังเกตของผู้สอบบัญชี (ปีบัญชีล่าสุด) จากรายงานผลการตรวจสอบ/รายงานการสอบบัญชี/หนังสือทักท้วง/บันทึกข้อสังเกตในไฟล์หมวด ผลปิดบัญชี/ข้อสังเกต โดยรวบรวมข้อสังเกตสำคัญทั้งหมดและวิเคราะห์แต่ละข้อเป็น (1) ประเด็นที่พบและข้อเท็จจริง/หลักฐานจากเอกสาร (2) ผลกระทบหรือความเสี่ยงต่อสหกรณ์ (3) สถานะการแก้ไขตามที่เอกสารระบุ (ถ้ามี) (4) ข้อเสนอแนะในการแก้ไข โดยคงสาระเดิมของผู้สอบบัญชีไว้ ห้ามแต่งเติมข้อสังเกต ตัวเลข หรือสถานะที่ไม่มีในเอกสาร หากไม่พบข้อสังเกตให้ใส่ ""
10. "auditorDefects" ให้สรุปข้อบกพร่องของสหกรณ์ที่ตรวจพบ (ถ้ามี) เป็นข้อความสั้น ๆ คั่นด้วยจุลภาค หากไม่พบให้ใส่ ""
11. "auditorInternalControlWeakness" = true เมื่อรายงานผู้สอบบัญชีระบุจุดอ่อน/ข้อบกพร่องของการควบคุมภายใน หรือมีข้อสังเกตที่ต้องแก้ไข; false เมื่อระบุว่าไม่พบจุดอ่อน; หากไม่มีข้อมูลให้ false
12. "auditorWeaknessCategories" = อาร์เรย์หมวดหมู่ของข้อสังเกต เช่น ด้านการประชุมคณะกรรมการ, ด้านผู้ตรวจสอบกิจการ, ด้านเทคโนโลยีสารสนเทศ/โปรแกรมบัญชี, ด้านหลักประกัน/การเงิน, ด้านสินทรัพย์/สินค้าคงเหลือ, ด้านบัญชี/งบการเงิน, ด้านกฎหมาย/ข้อบังคับ/ระเบียบ (ใส่เฉพาะหมวดที่พบ)
13. "auditorCorrectionStatus" = สถานะการแก้ไขข้อสังเกตตามที่เอกสารระบุ เป็น แก้ไขแล้ว หรือ อยู่ระหว่างดำเนินการ หรือ ยังไม่ได้ดำเนินการ หากไม่ระบุให้ใส่ ""
14. "businessObservations" ให้สรุปข้อมูลและข้อสังเกตด้านการบริหารจัดการธุรกิจจากเอกสาร (ผลการดำเนินงานแยกธุรกิจ ต้นทุน กำไร และการมีส่วนร่วมของสมาชิก) เป็นข้อความภาษาราชการกระชับ เรียงเป็นข้อ ๆ (1) (2) (3) โดยอ้างอิงเฉพาะข้อมูลที่ปรากฏในเอกสาร ห้ามแต่งเติม หากไม่พบให้ใส่ ""
15. "businessSegments" ให้สกัดผลการดำเนินงานแยกธุรกิจที่เอกสารระบุเป็นอาร์เรย์ รูปแบบ [{"name":"ชื่อธุรกิจ","revenue":ตัวเลข,"cost":ตัวเลข,"profit":ตัวเลข,"note":"ข้อสังเกต/สาระสำคัญ"}] โดยตัวเลขให้ใส่แบบไม่มีลูกน้ำคั่นหลักพัน หากไม่พบให้ใส่ []
16. "welfareObservations" ให้สรุปการจัดสวัสดิการให้แก่สมาชิกและครอบครัวที่เอกสารระบุ (ประเภทสวัสดิการ เงื่อนไข และผู้ได้รับ) เป็นข้อความภาษาราชการกระชับ ห้ามแต่งเติมกิจกรรมที่ไม่มีในเอกสาร หากไม่พบให้ใส่ ""
17. "publicBenefitObservations" ให้สรุปการดำเนินงานด้านสาธารณประโยชน์ที่เอกสารระบุ เป็นข้อความภาษาราชการกระชับ ห้ามแต่งเติม หากไม่พบให้ใส่ ""
18. "welfareFundAmount" และ "publicBenefitFundAmount" ให้ใส่จำนวนเงินทุนสวัสดิการและทุนสาธารณประโยชน์ที่จัดสรรในปีบัญชีล่าสุด เป็นตัวเลขไม่มีลูกน้ำคั่นหลักพัน หากไม่พบให้ใส่ ""
หลักการเขียนบทวิเคราะห์สำหรับข้อ 19-22 (ต้องถือปฏิบัติทุกข้อ):
- ทุกข้อความต้องอ้างอิงข้อมูลที่ปรากฏในเอกสารที่อัปโหลดเท่านั้น ห้ามสร้างตัวเลข กิจกรรม หรือข้อเท็จจริงใหม่
- ใช้โครงสร้าง ข้อเท็จจริงที่พบ → การวิเคราะห์ (สาเหตุ/ผลกระทบ/ความเสี่ยง) ในข้อ 19-21 โดยห้ามสรุปจุดแข็ง จุดอ่อน ความเสี่ยง และข้อเสนอแนะเป็นหัวข้อย่อยหรือสรุปรวบยอดในข้อ 19-21 ให้ยกไปสรุปในข้อ 22
- ระบุตัวเลข ปีบัญชี และหลักฐานประกอบให้ชัดเจน เปรียบเทียบกับปีก่อนหรือเกณฑ์ที่เอกสารระบุเมื่อมีข้อมูล
- วิเคราะห์เชิงสาเหตุและผลกระทบ ไม่ใช่เพียงสรุปตัวเลข
- ข้อเสนอแนะในข้อ 22 ต้องนำไปปฏิบัติได้ ระบุแนวทางและหน่วยงานผู้รับผิดชอบเมื่อเอกสารสนับสนุน
- หากข้อมูลไม่พอ ให้ระบุว่า ข้อมูลไม่เพียงพอต่อการวิเคราะห์ และระบุข้อมูลที่ต้องจัดเก็บเพิ่ม
- ใช้ข้อความล้วน ไม่ใช้ตาราง Markdown หรือสัญลักษณ์ตกแต่ง และให้แต่ละหัวข้อมีความยาวประมาณ 8-15 ข้อ
- ห้ามใช้อัญประกาศคู่ (") ภายในค่าข้อความทุกช่อง ให้ใช้อัญประกาศเดี่ยว (') หรือไม่ใส่เครื่องหมายคำพูดเลย และห้ามขึ้นบรรทัดใหม่ภายในค่า ให้เขียนเป็นข้อความต่อเนื่องด้วยเครื่องหมายวรรคตอน
19. "orgAnalysis4M" ให้เขียนบทวิเคราะห์หัวข้อ 1. ด้านการบริหารจัดการองค์กร (หลัก 4M) จากข้อมูลในเอกสาร โดยแบ่งเป็น 4 ด้านให้ครบ (1) ด้านบุคลากร (Man) โครงสร้างคณะกรรมการดำเนินการ/ฝ่ายจัดการ จำนวนและองค์ประกอบ อัตรากำลัง ความรู้ความสามารถ การประชุมคณะกรรมการและคณะอนุกรรมการ ความถี่เทียบข้อบังคับและการมีส่วนร่วม ผู้ตรวจสอบกิจการ จำนวนครั้ง/รายงาน/ข้อทักท้วง (2) ด้านการเงิน (Money) ให้วิเคราะห์ฐานะการเงินและผลการดำเนินงานตามกรอบ CAMELS อย่างชัดเจน ประกอบด้วย C-Capital adequacy ความเพียงพอของทุน (ทุนเรือนหุ้น ทุนสำรอง ทุนของสหกรณ์ต่อสินทรัพย์รวม ต่อหนี้สิน และอัตราการเติบโตของทุน) A-Asset quality คุณภาพสินทรัพย์ (สัดส่วนลูกหนี้เงินให้กู้ต่อสินทรัพย์รวม หนี้ค้างชำระ/หนี้ไม่ก่อให้เกิดรายได้ หลักประกัน และสินทรัพย์ไม่ก่อให้เกิดรายได้) M-Management การบริหารจัดการทางการเงิน (โครงสร้างหนี้สิน ต้นทุนทางการเงิน การพึ่งพาเงินกู้ยืม แหล่งเงินทุน และวินัยทางการเงิน) E-Earnings ความสามารถในการทำกำไร (รายได้รวม ค่าใช้จ่ายรวม กำไรสุทธิ อัตรากำไรสุทธิ ROA ROE รายได้ดอกเบี้ยและเงินปันผลต่อรายได้รวม เทียบปีก่อน) L-Liquidity สภาพคล่อง (เงินสดและเงินฝากต่อสินทรัพย์รวม เงินสดต่อหนี้สินหมุนเวียน อัตราส่วนสภาพคล่อง และความสามารถชำระคืนเงินฝาก/เงินกู้ยืมเมื่อครบกำหนด) S-Sensitivity to market risk ความอ่อนไหวต่อความเสี่ยงตลาด (ความเสี่ยงอัตราดอกเบี้ย เงินให้กู้และเงินรับฝากที่มีอัตราดอกเบี้ยลอยตัว สัดส่วนรายได้ดอกเบี้ยต่อรายได้รวม และผลกระทบหากอัตราดอกเบี้ยเปลี่ยนแปลง) โดยระบุตัวเลขและอัตราส่วนที่คำนวณได้จริงจากเอกสาร ทั้งนี้ ต้องไม่สรุปจุดแข็ง จุดอ่อน ความเสี่ยง และข้อเสนอแนะรวบยอดในหัวข้อนี้ (3) ด้านวัสดุอุปกรณ์และเทคโนโลยี (Material) ระบบบัญชี/เทคโนโลยีสารสนเทศ ผู้ดูแลระบบ สิทธิ์การใช้งาน รหัสผ่าน การสำรองข้อมูล ทรัพย์สินอาคารสถานที่ และความเพียงพอของเครื่องมือ (4) ด้านการบริหารจัดการ (Management) การควบคุมภายใน 5 องค์ประกอบ ได้แก่ สภาพแวดล้อมการควบคุม การประเมินความเสี่ยง กิจกรรมควบคุม สารสนเทศและการสื่อสาร และการติดตามประเมินผล แผนงาน/งบประมาณ/แผนกลยุทธ์ และการกำกับดูแลกิจการ หากมิติ CAMELS ใดไม่มีข้อมูล ให้ระบุว่า ไม่พบข้อมูล และระบุข้อมูลที่ต้องจัดเก็บเพิ่ม
20. "businessAnalysis" ให้เขียนบทวิเคราะห์หัวข้อ 2. ด้านการบริหารจัดการธุรกิจ จากผลการดำเนินงานแยกธุรกิจในเอกสาร (เงินให้กู้ รับฝากเงิน จัดหาสินค้า รวบรวมผลผลิต แปรรูป และบริการ) โดยแต่ละธุรกิจให้ระบุรายได้ ต้นทุน กำไร อัตรากำไร ส่วนแบ่งต่อรายได้รวม จำนวนสมาชิกผู้ใช้บริการ/อัตราการมีส่วนร่วม และแนวโน้มเทียบปีก่อนเท่าที่เอกสารมี แล้ววิเคราะห์ประสิทธิภาพการทำกำไร ต้นทุน และความเสี่ยง เช่น สินค้าคงค้าง หนี้ค้างชำระ หรือต้นทุนสูง โดยไม่ต้องสรุปจุดแข็ง จุดอ่อน โอกาส และข้อเสนอแนะรวบยอดในหัวข้อนี้ (ให้ยกไปสรุปในข้อ 22) หากไม่มีข้อมูลธุรกิจใดให้ระบุว่า ไม่พบข้อมูล
21. "welfareAnalysis" ให้เขียนบทวิเคราะห์หัวข้อ 3. ด้านการจัดสวัสดิการและสาธารณประโยชน์ จากข้อมูลในเอกสารเท่านั้น โดยระบุประเภทสวัสดิการ ผู้ได้รับ เงื่อนไข และวงเงิน วิเคราะห์ความเพียงพอและความต่อเนื่องของการจัดสวัสดิการ เปรียบเทียบกับกำไรสุทธิหรือรายได้เมื่อเอกสารมีข้อมูล วิเคราะห์การมีส่วนร่วมของสมาชิกและกิจกรรมสาธารณประโยชน์ โดยไม่ต้องสรุปจุดแข็ง จุดอ่อน ความเสี่ยง และข้อเสนอแนะรวบยอดในหัวข้อนี้ (ให้ยกไปสรุปในข้อ 22) ห้ามสร้างกิจกรรมที่ไม่มีในเอกสาร หากไม่พบให้ระบุว่า ไม่พบข้อมูลการจัดสวัสดิการและสาธารณประโยชน์ในเอกสารที่อัปโหลด และระบุข้อมูลที่ต้องตรวจสอบเพิ่ม
22. "summaryAnalysis" ให้เขียนบทวิเคราะห์หัวข้อ 4. สรุปผลการวิเคราะห์ โดยรวบรวมข้อสรุปจากหัวข้อ 1-3 และฐานะการเงินในเอกสาร จัดกลุ่มตาม 3 ด้าน ได้แก่ ด้านการบริหารจัดการองค์กร (อ้างอิงหลัก 4M และผล CAMELS) ด้านการบริหารจัดการธุรกิจ และด้านการจัดสวัสดิการและสาธารณประโยชน์ โดยในแต่ละด้านให้ระบุ (1) จุดแข็ง (2) จุดอ่อนและความเสี่ยง (3) ข้อเสนอแนะที่นำไปปฏิบัติได้ เรียงตามลำดับความสำคัญ สูง/กลาง/ต่ำ จากนั้นปิดท้ายด้วย (4) ภาพรวมผลการดำเนินงานและตัวเลขสำคัญ และ (5) ความเชื่อมโยงกับแผนส่งเสริมสหกรณ์ในปีงบประมาณถัดไป ห้ามแต่งเติมข้อมูลที่ไม่มีในเอกสาร

ตอบกลับมาเป็น JSON ตามโครงสร้างนี้เท่านั้น (ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON):
{
  "district": "ชื่ออำเภอ",
  "regDate": "วันจดทะเบียน",
  "boardCount": "จำนวนกรรมการ",
  "auditorType": "ภาครัฐ หรือ ภาคเอกชน",
  "auditorName": "คนึงศรี หรือ พรทิพย์ หรือชื่อผู้สอบบัญชี",
  "fiscalDateFull": "เช่น 31 มีนาคม หรือ 30 กันยายน หรือ 31 ธันวาคม",
  "fyCheckNote": "ตรงกัน",
  "inspectorCount": "จำนวนผู้ตรวจสอบกิจการ",
  "inspectorName": "ชื่อผู้ตรวจสอบกิจการ",
  "yrLatest": "เช่น ธ.ค. 68",
  "yrPrev": "เช่น ธ.ค. 67",
  "memLatest": "รวม/สามัญ/สมทบ",
  "memPrev": "รวม/สามัญ/สมทบ",
  "assetLatest": "ยอดรวมสินทรัพย์ (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "assetPrev": "ยอดรวมสินทรัพย์ปีก่อน (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "debtLatest": "ยอดรวมหนี้สิน (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "debtPrev": "ยอดรวมหนี้สินปีก่อน (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "shareLatest": "เฉพาะยอดทุนเรือนหุ้นเท่านั้น ห้ามใช้ยอดรวมทุนของสหกรณ์ (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "sharePrev": "เฉพาะยอดทุนเรือนหุ้นปีก่อนเท่านั้น ห้ามใช้ยอดรวมทุนของสหกรณ์ (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "reserveLatest": "เฉพาะยอดทุนสำรอง (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "reservePrev": "เฉพาะยอดทุนสำรองปีก่อน (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "profitLatest": "กำไรสุทธิ หรือ (ขาดทุนสุทธิ) ประจำปี (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "profitPrev": "กำไรสุทธิ หรือ (ขาดทุนสุทธิ) ปีก่อน (ตัวเลขมีลูกน้ำ ทศนิยม 2 ตำแหน่ง)",
  "lossLatest": "ขาดทุนสะสม (ถ้าไม่มีให้ใส่ -)",
  "lossPrev": "ขาดทุนสะสมปีก่อน (ถ้าไม่มีให้ใส่ -)",
  "bizVolLatest": "ปริมาณธุรกิจรวมล่าสุด",
  "bizVolPrev": "ปริมาณธุรกิจรวมย้อนหลัง",
  "wcLatest": "ทุนดำเนินงานรวมล่าสุด",
  "wcPrev": "ทุนดำเนินงานรวมย้อนหลัง 1 ปี",
  "coopCapLatest": "ทุนของสหกรณ์ล่าสุด (รวมทุนของสหกรณ์)",
  "coopCapPrev": "ทุนของสหกรณ์ย้อนหลัง 1 ปี",
  "loanLatest": "เงินกู้ยืมล่าสุด",
  "loanPrev": "เงินกู้ยืมย้อนหลัง 1 ปี",
  "payableLatest": "เจ้าหนี้การค้าล่าสุด",
  "payablePrev": "เจ้าหนี้การค้าย้อนหลัง 1 ปี",
  "cashLatest": "เงินสดและเงินฝากธนาคารล่าสุด",
  "cashPrev": "เงินสดและเงินฝากธนาคารย้อนหลัง 1 ปี",
  "inventoryLatest": "สินค้าคงเหลือล่าสุด",
  "inventoryPrev": "สินค้าคงเหลือย้อนหลัง 1 ปี",
  "ppeLatest": "ที่ดิน อาคาร และอุปกรณ์ - สุทธิ ล่าสุด",
  "ppePrev": "ที่ดิน อาคาร และอุปกรณ์ - สุทธิ ย้อนหลัง 1 ปี",
  "receivableLatest": "ลูกหนี้การค้าล่าสุด",
  "receivablePrev": "ลูกหนี้การค้าย้อนหลัง 1 ปี",
  "otherAssetLatest": "สินทรัพย์อื่นๆ ล่าสุด",
  "otherAssetPrev": "สินทรัพย์อื่นๆ ย้อนหลัง 1 ปี",
  "incomeLatest": "รายได้รวมล่าสุด",
  "incomePrev": "รายได้รวมย้อนหลัง 1 ปี",
  "expenseLatest": "ต้นทุนและค่าใช้จ่ายรวมล่าสุด",
  "expensePrev": "ต้นทุนและค่าใช้จ่ายรวมย้อนหลัง 1 ปี",
  "salesTradingLatest": "รายได้ธุรกิจจัดหาสินค้ามาจำหน่ายล่าสุด",
  "salesTradingPrev": "รายได้ธุรกิจจัดหาสินค้ามาจำหน่ายย้อนหลัง 1 ปี",
  "costTradingLatest": "ต้นทุนธุรกิจจัดหาสินค้ามาจำหน่ายล่าสุด",
  "costTradingPrev": "ต้นทุนธุรกิจจัดหาสินค้ามาจำหน่ายย้อนหลัง 1 ปี",
  "profitTradingLatest": "กำไร/ขาดทุนเฉพาะธุรกิจจัดหาสินค้ามาจำหน่ายล่าสุด",
  "profitTradingPrev": "กำไร/ขาดทุนเฉพาะธุรกิจจัดหาสินค้ามาจำหน่ายย้อนหลัง 1 ปี",
  "planTradingLatest": "แผนงานประมาณการธุรกิจจัดหาสินค้ามาจำหน่ายล่าสุด",
  "planTradingPrev": "แผนงานประมาณการธุรกิจจัดหาสินค้ามาจำหน่ายย้อนหลัง 1 ปี",
  "salesProcessingLatest": "รายได้ธุรกิจแปรรูปและผลิตสินค้าล่าสุด",
  "salesProcessingPrev": "รายได้ธุรกิจแปรรูปและผลิตสินค้าย้อนหลัง 1 ปี",
  "costProcessingLatest": "ต้นทุนธุรกิจแปรรูปและผลิตสินค้าล่าสุด",
  "costProcessingPrev": "ต้นทุนธุรกิจแปรรูปและผลิตสินค้าย้อนหลัง 1 ปี",
  "profitProcessingLatest": "กำไร/ขาดทุนเฉพาะธุรกิจแปรรูปและผลิตสินค้าล่าสุด",
  "profitProcessingPrev": "กำไร/ขาดทุนเฉพาะธุรกิจแปรรูปและผลิตสินค้าย้อนหลัง 1 ปี",
  "planProcessingLatest": "แผนงานประมาณการธุรกิจแปรรูปและผลิตสินค้าล่าสุด",
  "planProcessingPrev": "แผนงานประมาณการธุรกิจแปรรูปและผลิตสินค้าย้อนหลัง 1 ปี",
  "depositAmountLatest": "เงินรับฝากจากสมาชิกในรอบปีล่าสุด",
  "depositAmountPrev": "เงินรับฝากจากสมาชิกในรอบปีย้อนหลัง 1 ปี",
  "profitDepositLatest": "กำไร/ขาดทุนเฉพาะธุรกิจรับฝากเงินล่าสุด",
  "profitDepositPrev": "กำไร/ขาดทุนเฉพาะธุรกิจรับฝากเงินย้อนหลัง 1 ปี",
  "membersDepositLatest": "จำนวนสมาชิกที่ร่วมทำธุรกิจรับฝากเงินล่าสุด",
  "membersDepositPrev": "จำนวนสมาชิกที่ร่วมทำธุรกิจรับฝากเงินย้อนหลัง 1 ปี",
  "membersTradingLatest": "จำนวนสมาชิกที่ร่วมทำธุรกิจจัดหาสินค้ามาจำหน่ายล่าสุด",
  "membersTradingPrev": "จำนวนสมาชิกที่ร่วมทำธุรกิจจัดหาสินค้ามาจำหน่ายย้อนหลัง 1 ปี",
  "membersProcessingLatest": "จำนวนสมาชิกที่ร่วมทำธุรกิจแปรรูปและผลิตสินค้าล่าสุด",
  "membersProcessingPrev": "จำนวนสมาชิกที่ร่วมทำธุรกิจแปรรูปและผลิตสินค้าย้อนหลัง 1 ปี",
  "agmAttendeesLatest": "จำนวนสมาชิกที่เข้าประชุมใหญ่สามัญประจำปีล่าสุด",
  "agmAttendeesPrev": "จำนวนสมาชิกที่เข้าประชุมใหญ่สามัญประจำปีย้อนหลัง 1 ปี",
  "avgProfit3Latest": "กำไรเฉลี่ย 3 ปีย้อนหลัง",
  "avgProfit3Prev": "กำไรเฉลี่ย 3 ปีย้อนหลัง (ปีก่อน)",
  "avgSavingLatest": "เงินออมเฉลี่ยต่อสมาชิก",
  "avgSavingPrev": "เงินออมเฉลี่ยต่อสมาชิก (ปีก่อน)",
  "avgDebtLatest": "หนี้สินเฉลี่ยต่อสมาชิก",
  "avgDebtPrev": "หนี้สินเฉลี่ยต่อสมาชิก (ปีก่อน)",
  "staffCountLatest": "จำนวนเจ้าหน้าที่ปฏิบัติงานประจำ",
  "staffCountPrev": "จำนวนเจ้าหน้าที่ปฏิบัติงานประจำ (ปีก่อน)",
  "changes": {
    "wc": "เพิ่มขึ้น 1,104,363.77 หรือ ลดลง 58,491.24 (ถ้ามี)",
    "coopCap": "ข้อความผลต่างจากปีก่อน",
    "loan": "ข้อความผลต่างจากปีก่อน",
    "payable": "ข้อความผลต่างจากปีก่อน",
    "cash": "ข้อความผลต่างจากปีก่อน",
    "inventory": "ข้อความผลต่างจากปีก่อน",
    "ppe": "ข้อความผลต่างจากปีก่อน",
    "receivable": "ข้อความผลต่างจากปีก่อน",
    "otherAsset": "ข้อความผลต่างจากปีก่อน",
    "income": "ข้อความผลต่างจากปีก่อน",
    "expense": "ข้อความผลต่างจากปีก่อน",
    "salesTrading": "ข้อความผลต่างจากปีก่อน",
    "costTrading": "ข้อความผลต่างจากปีก่อน",
    "profitTrading": "ข้อความผลต่างจากปีก่อน",
    "salesProcessing": "ข้อความผลต่างจากปีก่อน",
    "costProcessing": "ข้อความผลต่างจากปีก่อน",
    "profitProcessing": "ข้อความผลต่างจากปีก่อน",
    "depositAmount": "ข้อความผลต่างจากปีก่อน",
    "profitDeposit": "ข้อความผลต่างจากปีก่อน",
    "assets": "ข้อความผลต่างจากปีก่อน",
    "debt": "ข้อความผลต่างจากปีก่อน",
    "share": "ข้อความผลต่างจากปีก่อน",
    "reserve": "ข้อความผลต่างจากปีก่อน",
    "profit": "ข้อความผลต่างจากปีก่อน"
  },
  "assetNumeric": 0,
  "businessTypes": "รายชื่อธุรกิจที่ทำ",
  "targetProjects": "กลุ่มเป้าหมายในโครงการ/แผนงาน/กิจกรรม",
  "issue1": "ปัญหา/ข้อสังเกต/ข้อบกพร่อง ข้อ 1 (ภาษาราชการกระชับสมบูรณ์ ไม่อ้างเลขตัวชี้วัด)",
  "issue2": "ปัญหา/ข้อสังเกต/ข้อบกพร่อง ข้อ 2",
  "issue3": "ปัญหา/ข้อสังเกต/ข้อบกพร่อง ข้อ 3",
  "promotionGoals": "1. ...\\n2. ...\\n3. ...\\n4. ...\\n5. ...",
  "recommendedVisits": 4,
  "visitRemark": "หมายเหตุความเหมาะสมของจำนวนครั้งการเข้าส่งเสริม (เจ้าหน้าที่ตั้งไว้ ${payload.plannedVisits} ครั้ง/ปี)",
  "auditorObservations": "ข้อสังเกตของผู้สอบบัญชี (ปีบัญชีล่าสุด) ภาษาราชการกระชับ ครบทุกข้อ (1) (2) (3) หรือเว้นว่างหากไม่พบ",
  "auditorDefects": "ข้อบกพร่องของสหกรณ์ (ปีบัญชีล่าสุด) คั่นด้วยจุลภาค หรือเว้นว่างหากไม่พบ",
  "auditorInternalControlWeakness": false,
  "auditorWeaknessCategories": [],
  "auditorCorrectionStatus": "แก้ไขแล้ว | อยู่ระหว่างดำเนินการ | ยังไม่ได้ดำเนินการ | ",
  "businessObservations": "สรุปข้อมูล/ข้อสังเกตด้านการบริหารจัดการธุรกิจ เรียงเป็น (1) (2) (3) หรือเว้นว่างหากไม่พบ",
  "businessSegments": [
    { "name": "ชื่อธุรกิจ", "revenue": 0, "cost": 0, "profit": 0, "note": "ข้อสังเกต/สาระสำคัญ" }
  ],
  "welfareObservations": "สรุปการจัดสวัสดิการสมาชิกและครอบครัวตามเอกสาร หรือเว้นว่างหากไม่พบ",
  "publicBenefitObservations": "สรุปการดำเนินงานด้านสาธารณประโยชน์ตามเอกสาร หรือเว้นว่างหากไม่พบ",
  "welfareFundAmount": "จำนวนเงินทุนสวัสดิการที่จัดสรร (ตัวเลขไม่มีลูกน้ำ) หรือเว้นว่างหากไม่พบ",
  "publicBenefitFundAmount": "จำนวนเงินทุนสาธารณประโยชน์ที่จัดสรร (ตัวเลขไม่มีลูกน้ำ) หรือเว้นว่างหากไม่พบ",
  "orgAnalysis4M": "บทวิเคราะห์หัวข้อ 1. ด้านการบริหารจัดการองค์กร (หลัก 4M) ครบ Man/Money/Material/Management โดยด้าน Money วิเคราะห์ตามกรอบ CAMELS (C-A-M-E-L-S) เป็นข้อ ๆ ไม่มีสรุปจุดแข็ง/จุดอ่อน/ข้อเสนอแนะรวบยอด",
  "businessAnalysis": "บทวิเคราะห์หัวข้อ 2. ด้านการบริหารจัดการธุรกิจ จากผลการดำเนินงานแยกธุรกิจในเอกสาร เป็นข้อ ๆ ไม่มีสรุปจุดแข็ง/จุดอ่อน/ข้อเสนอแนะรวบยอด",
  "welfareAnalysis": "บทวิเคราะห์หัวข้อ 3. ด้านการจัดสวัสดิการและสาธารณประโยชน์ จากเอกสารเท่านั้น หรือระบุไม่พบข้อมูล ไม่มีสรุปจุดแข็ง/จุดอ่อน/ข้อเสนอแนะรวบยอด",
  "summaryAnalysis": "บทวิเคราะห์หัวข้อ 4. สรุปผลการวิเคราะห์ แยก 3 ด้าน (องค์กร/ธุรกิจ/สวัสดิการ) โดยแต่ละด้านมีจุดแข็ง จุดอ่อนและความเสี่ยง ข้อเสนอแนะเร่งด่วน พร้อมภาพรวมและข้อเชื่อมโยงแผนปีถัดไป"
}`;

  const parts = [{ text: promptText }];
  if (payload.files && payload.files.length > 0) {
    payload.files.forEach(f => {
      if (f.extractedText) {
        // กรณีสกัดข้อความจาก PDF ได้สำเร็จ ส่งเป็น Text ล้วน (เร็วกว่าส่งไฟล์หลายเท่า)
        parts.push({
          text: `\n--- ข้อมูลจากไฟล์ [${f.category || 'เอกสาร'}]: ${f.name} ---\n${f.extractedText}\n`
        });
      } else if (f.base64) {
        // กรณีเป็นไฟล์สแกนหรือรูปภาพ ส่งเป็น inlineData ที่ตัดย่อขนาดแล้ว
        parts.push({
          inlineData: {
            mimeType: f.mimeType,
            data: f.base64
          }
        });
      }
    });
  }

  let resText = null;
  let errorLogs = [];
  let triedFallback = false;

  for (let m = 0; m < modelsToTry.length; m++) {
    const modelName = modelsToTry[m];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${getGeminiKey_()}`;

    const requestBody = {
      contents: [{ parts: parts }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      const bodyText = res.getContentText();

      if (code === 200) {
        const jsonRes = JSON.parse(bodyText);
        if (jsonRes.candidates && jsonRes.candidates[0].content.parts[0].text) {
          resText = jsonRes.candidates[0].content.parts[0].text;
          break;
        }
      } else if (code === 503 || code === 429) {
        errorLogs.push(`${modelName}(คิวเต็ม ${code})`);
        Utilities.sleep(1200);
      } else {
        errorLogs.push(`${modelName}(${code})`);
        break;
      }
    }
    if (resText) break;

    // หากลองครบทุกโมเดลในลิสต์แรกแล้วยังไม่ผ่าน จึงค่อยดึงรายชื่อโมเดลสำรองจาก ListModels
    if (!triedFallback && m === modelsToTry.length - 1) {
      triedFallback = true;
      const extraModels = getFallbackModelsList(modelsToTry);
      modelsToTry = modelsToTry.concat(extraModels);
    }
  }

  if (!resText) {
    if (errorLogs.length === 0) {
      throw new Error("AI ประมวลผลไม่สำเร็จ: โมเดลไม่ได้ส่งคำตอบกลับมา (อาจถูกบล็อกด้วย safety filter)");
    }
    throw new Error("AI ประมวลผลไม่สำเร็จ: " + errorLogs.join(", "));
  }

  const parsed = parseAiJson_(resText);
  if (parsed.fiscalDateFull) {
    parsed.fiscalDateFull = normalizeFiscalDate(parsed.fiscalDateFull);
  }
  applyPrevYearFallbacks_(parsed);
  return parsed;
}

// ---- AI JSON parser helpers (begin) ----
/**
 * แปลงข้อความ JSON จาก AI ให้เป็น object โดยพยายามซ่อมข้อผิดพลาดที่พบบ่อย
 * เช่น อัญประกาศคู่ที่ไม่ได้ escape ภายในข้อความไทย, ขึ้นบรรทัดใหม่ในสตริง,
 * code fence และ JSON ที่ถูกตัดกลางคัน
 */
function parseAiJson_(raw) {
  let text = String(raw === undefined || raw === null ? '' : raw)
    .replace(/^\uFEFF/, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!text) throw new Error('AI ไม่ได้ส่ง JSON กลับมา');

  let lastError = null;
  // 1) ลองแปลงตามปกติก่อน
  try { return JSON.parse(text); } catch (e) { lastError = e; }

  // 2) ซ่อมอัญประกาศ/อักขระควบคุมภายในสตริง
  const repaired = repairAiJsonText_(text);
  try { return JSON.parse(repaired); } catch (e) { lastError = e; }

  // 3) ตัดข้อความที่อยู่ก่อนปีกกาแรกออก แล้วลองใหม่
  const start = repaired.indexOf('{');
  let candidate = start > 0 ? repaired.slice(start) : repaired;
  if (start > 0) {
    try { return JSON.parse(candidate); } catch (e) { lastError = e; }
  }

  // 4) ปิดสตริง/วงเล็บที่ขาดหายกรณีคำตอบถูกตัดกลางคัน
  const closed = closeTruncatedJson_(candidate);
  try { return JSON.parse(closed); } catch (e) { lastError = e; }

  // 5) แจ้งข้อผิดพลาดพร้อมตำแหน่ง เพื่อให้ตรวจสอบได้ง่าย
  const err = new Error('AI ส่ง JSON ที่ไม่สมบูรณ์: ' +
    (lastError && lastError.message ? lastError.message : 'ไม่ทราบสาเหตุ') +
    ' กรุณาลองประมวลผลใหม่อีกครั้ง');
  err.aiJsonPreview = candidate.slice(0, 500);
  throw err;
}

/**
 * ซ่อมข้อความ JSON:
 * - escape อัญประกาศคู่ที่อยู่ภายในค่าสตริง โดยพิจารณาจากบริบทว่าเป็นตำแหน่งปิดสตริงจริงหรือไม่
 * - เปลี่ยนอักขระขึ้นบรรทัดใหม่/แท็บภายในสตริงเป็น \n \t
 */
function repairAiJsonText_(text) {
  let out = '';
  let inString = false;
  let isKey = false;
  let escaped = false;
  let lastSignificant = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (!inString) {
      out += ch;
      if (ch === '"') {
        inString = true;
        escaped = false;
        isKey = (lastSignificant === '{' || lastSignificant === ',');
      } else if (!/\s/.test(ch)) {
        lastSignificant = ch;
      }
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      if (isLikelyStringEnd_(text, i, isKey)) {
        out += ch;
        inString = false;
        lastSignificant = '"';
      } else {
        // อัญประกาศที่อยู่กลางข้อความ -> escape ไว้เป็นเนื้อหา
        out += '\\"';
      }
      continue;
    }
    if (ch === '\n') { out += '\\n'; continue; }
    if (ch === '\r') { out += '\\r'; continue; }
    if (ch === '\t') { out += '\\t'; continue; }
    if (ch.charCodeAt(0) < 0x20) { out += ' '; continue; }
    out += ch;
  }
  if (inString) out += '"';
  return out;
}

/**
 * ตรวจว่าอัญประกาศที่ตำแหน่ง index เป็นตัวปิดสตริงจริงหรือเป็นอัญประกาศที่หลุดเข้ามาในข้อความ
 * ใช้บริบทของอักขระถัดไป (,\s* คีย์ใหม่ | } | ] | :) ประกอบกับว่าเป็นคีย์หรือค่า
 */
function isLikelyStringEnd_(text, index, isKey) {
  let j = index + 1;
  while (j < text.length && /\s/.test(text.charAt(j))) j++;
  if (j >= text.length) return true;
  const next = text.charAt(j);
  if (next === '}' || next === ']') return true;
  if (next === ':') return !!isKey;
  if (next === ',') {
    let k = j + 1;
    while (k < text.length && /\s/.test(text.charAt(k))) k++;
    if (k >= text.length) return true;
    const after = text.charAt(k);
    return after === '"' || after === '{' || after === '[' ||
      after === '}' || after === ']' || after === '-' ||
      /[0-9]/.test(after) || /[tfn]/.test(after);
  }
  return false;
}

/**
 * ปิดสตริงและวงเล็บปีกกา/วงเล็บเหลี่ยมที่ยังไม่ปิด เมื่อ JSON ถูกตัดกลางคัน
 */
function closeTruncatedJson_(text) {
  let inString = false;
  let escaped = false;
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') stack.pop();
  }
  let out = text;
  if (inString) out += '"';
  out = out.replace(/[\s,]+$/, '');
  if (/:\s*$/.test(out)) out += 'null';
  for (let k = stack.length - 1; k >= 0; k--) {
    out += (stack[k] === '{' ? '}' : ']');
  }
  return out;
}
// ---- AI JSON parser helpers (end) ----


/**
 * Fallback Year N-1: หาก AI อ่านได้เฉพาะยอดปีล่าสุด + ข้อความ "เพิ่มขึ้น/ลดลง"
 * ให้คำนวณยอดปีก่อนหน้าเติมอัตโนมัติ
 */
function applyPrevYearFallbacks_(data) {
  if (!data || typeof data !== 'object') return data;
  const changes = data.changes || {};
  const map = {
    wc: ['wcLatest', 'wcPrev'],
    coopCap: ['coopCapLatest', 'coopCapPrev'],
    loan: ['loanLatest', 'loanPrev'],
    payable: ['payableLatest', 'payablePrev'],
    cash: ['cashLatest', 'cashPrev'],
    inventory: ['inventoryLatest', 'inventoryPrev'],
    ppe: ['ppeLatest', 'ppePrev'],
    receivable: ['receivableLatest', 'receivablePrev'],
    otherAsset: ['otherAssetLatest', 'otherAssetPrev'],
    income: ['incomeLatest', 'incomePrev'],
    expense: ['expenseLatest', 'expensePrev'],
    salesTrading: ['salesTradingLatest', 'salesTradingPrev'],
    costTrading: ['costTradingLatest', 'costTradingPrev'],
    profitTrading: ['profitTradingLatest', 'profitTradingPrev'],
    salesProcessing: ['salesProcessingLatest', 'salesProcessingPrev'],
    costProcessing: ['costProcessingLatest', 'costProcessingPrev'],
    profitProcessing: ['profitProcessingLatest', 'profitProcessingPrev'],
    depositAmount: ['depositAmountLatest', 'depositAmountPrev'],
    profitDeposit: ['profitDepositLatest', 'profitDepositPrev'],
    assets: ['assetLatest', 'assetPrev'],
    debt: ['debtLatest', 'debtPrev'],
    share: ['shareLatest', 'sharePrev'],
    reserve: ['reserveLatest', 'reservePrev'],
    profit: ['profitLatest', 'profitPrev']
  };

  function toNumber_(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null;
    const s = String(value === undefined || value === null ? '' : value)
      .replace(/,/g, '')
      .replace(/[()]/g, '')
      .replace(/บาท|泰铢/g, '')
      .trim();
    if (!s || s === '-') return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  function formatNumber_(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  Object.keys(map).forEach(function (key) {
    const pair = map[key];
    const latestKey = pair[0];
    const prevKey = pair[1];
    const latest = toNumber_(data[latestKey]);
    const prev = toNumber_(data[prevKey]);
    if (latest === null || prev !== null) return;
    const changeText = String(changes[key] || data[key + 'Change'] || '').trim();
    if (!changeText) return;
    const delta = toNumber_(changeText.replace(/เพิ่มขึ้น|ลดลง|จากปีก่อน|จากปีที่แล้ว/g, ''));
    if (delta === null) return;
    const isDecrease = /ลดลง|ลด|ติดลบ|\-/.test(changeText) && !/เพิ่มขึ้น/.test(changeText);
    const computed = isDecrease ? latest + Math.abs(delta) : latest - delta;
    data[prevKey] = formatNumber_(computed);
  });
  return data;
}

// ----------------------------------------------------------------------------
// 3. สร้างเอกสาร Word (.docx) แนวนอน (Landscape)
//    - หน้าที่ 1: แผนส่งเสริมรายแห่ง ครบทั้ง 5 ส่วนใน 1 หน้า (แบ่งคอลัมน์ซ้าย-ขวา ตามฟอร์มต้นฉบับ)
//    - หน้าที่ 2: รายงานจำลองคะแนนความเข้มแข็ง (Strength Score Simulator & Gap Analysis)
// ----------------------------------------------------------------------------
function generatePlanDocument(form) {
  saveDraftToSheet(form);

  const cleanCoopName = String(form.coop_name || 'รายแห่ง').replace(/[\\/:*?"<>|]/g, '');
  const docTitle = `แผนส่งเสริมสหกรณ์_2570_${cleanCoopName}`;
  const doc = DocumentApp.create(docTitle);
  const docId = doc.getId();
  const body = doc.getBody();

  // บังคับหน้ากระดาษ A4 แนวนอน (Landscape) และตั้งขอบกระดาษให้กระชับพอดี 1 หน้า
  body.setPageWidth(841.89);
  body.setPageHeight(595.276);
  body.setMarginTop(12);
  body.setMarginBottom(10);
  body.setMarginLeft(16);
  body.setMarginRight(16);
  const totalWidth = 808; // ความกว้างใช้งานจริงบน A4 แนวนอน

  // หัวเรื่องเอกสาร
  const titlePara = body.getParagraphs()[0];
  titlePara.setText("ข้อมูลสหกรณ์/กลุ่มเกษตรกรในจังหวัดชลบุรี และแผนส่งเสริมรายแห่ง ประจำปีงบประมาณ พ.ศ. 2570 (1 ตุลาคม 2569 – 30 กันยายน 2570)");
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titlePara.setFontFamily("TH SarabunPSK").setFontSize(12.5).setBold(true).setSpacingAfter(2).setSpacingBefore(0);

  // ฟังก์ชันจัดสไตล์ตารางย่อยให้ฟอนต์และระยะบรรทัดกระชับพอดี 1 หน้า
  function styleCompactTable(table, fontSize, headerBg) {
    table.setBorderWidth(0.5);
    table.setBorderColor("#000000");
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        cell.setPaddingTop(0.5).setPaddingBottom(0.5).setPaddingLeft(2.5).setPaddingRight(2.5);
        if (r === 0 && headerBg) {
          cell.setBackgroundColor(headerBg);
        }
        for (let p = 0; p < cell.getNumChildren(); p++) {
          const child = cell.getChild(p);
          if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
            const para = child.asParagraph();
            para.setFontFamily("TH SarabunPSK")
                .setFontSize(fontSize || 9.5)
                .setLineSpacing(0.85)
                .setSpacingAfter(0)
                .setSpacingBefore(0);
            if (r === 0 && headerBg) para.setBold(true);
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // แถบข้อมูลหลักด้านบนสุด (เรียงซ้ายไปขวาตามไฟล์ PDF ต้นฉบับ)
  // --------------------------------------------------------------------------
  const tTopBar = body.appendTable([
    [
      "ชื่อ", form.coop_name || "-",
      "อำเภอ", form.district || "-",
      "ระยะทางไป-กลับ", form.distance ? form.distance + " กม." : "-",
      "เขตส่งเสริม", form.group_zone || "-",
      "ผู้ดูแลหลัก", form.main_officer || "-",
      "ผู้ดูแลร่วม", form.co_officers || "-"
    ]
  ]);
  styleCompactTable(tTopBar, 9.5, null);
  tTopBar.setColumnWidth(0, 24);
  tTopBar.setColumnWidth(1, 175);
  tTopBar.setColumnWidth(2, 28);
  tTopBar.setColumnWidth(3, 60);
  tTopBar.setColumnWidth(4, 58);
  tTopBar.setColumnWidth(5, 42);
  tTopBar.setColumnWidth(6, 48);
  tTopBar.setColumnWidth(7, 45);
  tTopBar.setColumnWidth(8, 45);
  tTopBar.setColumnWidth(9, 115);
  tTopBar.setColumnWidth(10, 43);
  tTopBar.setColumnWidth(11, 125);
  [0, 2, 4, 6, 8, 10].forEach(idx => {
    tTopBar.getRow(0).getCell(idx).setBackgroundColor("#f1f8e9");
    tTopBar.getRow(0).getCell(idx).getChild(0).asParagraph().setBold(true);
  });

  // --------------------------------------------------------------------------
  // โครงสร้างหลัก 2 คอลัมน์ (ซ้าย = ข้อมูลข้อ 1-4 และเป้าหมาย / ขวา = แผน 12 เดือน + โครงการ)
  // --------------------------------------------------------------------------
  const masterGrid = body.appendTable([["", ""]]);
  masterGrid.setBorderWidth(0);
  const leftWidth = 335;  // ความกว้างฝั่งซ้าย (~41.5%)
  const rightWidth = 473; // ความกว้างฝั่งขวา (~58.5%)
  masterGrid.setColumnWidth(0, leftWidth);
  masterGrid.setColumnWidth(1, rightWidth);

  const leftCell = masterGrid.getRow(0).getCell(0);
  const rightCell = masterGrid.getRow(0).getCell(1);
  leftCell.setPaddingTop(2).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(4);
  rightCell.setPaddingTop(2).setPaddingBottom(0).setPaddingLeft(4).setPaddingRight(0);

  function addCellTitle(cell, text, isFirst) {
    const p = isFirst ? cell.getChild(0).asParagraph() : cell.appendParagraph(text);
    if (isFirst) p.setText(text);
    p.setFontFamily("TH SarabunPSK").setFontSize(10.5).setBold(true).setSpacingBefore(1.5).setSpacingAfter(0.5).setLineSpacing(0.85);
    return p;
  }

  // ==================== ฝั่งซ้าย (LEFT COLUMN) ====================
  // 1. ข้อมูลทั่วไป
  addCellTitle(leftCell, "1. ข้อมูลทั่วไป", true);
  const auditorFull = (form.auditor_type || "") + (form.auditor_name ? " (" + form.auditor_name + ")" : "");
  const inspectorFull = (form.inspector_count || "") + (form.inspector_name ? " (" + form.inspector_name + ")" : "");
  const tGen = leftCell.appendTable([
    ["วันจดทะเบียน", form.reg_date || "-", "กรรมการ", form.board_count || "-", "ผู้สอบบัญชี", auditorFull || "-"],
    ["ปีบัญชี", form.fiscal_year || "-", "ผู้ตรวจสอบ", inspectorFull || "-", "แผนเข้าส่งเสริม", (form.planned_visits || "4") + " ครั้ง/ปี"]
  ]);
  styleCompactTable(tGen, 9.5, null);
  tGen.setColumnWidth(0, 50);
  tGen.setColumnWidth(1, 62);
  tGen.setColumnWidth(2, 42);
  tGen.setColumnWidth(3, 55);
  tGen.setColumnWidth(4, 48);
  tGen.setColumnWidth(5, 74);

  // 2. ผลการดำเนินงาน ณ สิ้นปีบัญชีล่าสุด และย้อนหลัง 1 ปี
  addCellTitle(leftCell, "2. ผลการดำเนินงาน ณ สิ้นปีบัญชีล่าสุด และย้อนหลัง 1 ปี", false);
  const bizList = String(form.business_types || "-").split(/\r?\n/);
  const tPerf = leftCell.appendTable([
    ["รายการ", form.yr_latest || "ล่าสุด", form.yr_prev || "ย้อนหลัง", "ธุรกิจที่ทำ"],
    ["สมาชิก(รวม/สามัญ/สมทบ)", form.mem_latest || "-", form.mem_prev || "-", form.business_types || "-"],
    ["สินทรัพย์", form.asset_latest || "-", form.asset_prev || "-", ""],
    ["หนี้สิน", form.debt_latest || "-", form.debt_prev || "-", ""],
    ["หุ้น", form.share_latest || "-", form.share_prev || "-", ""],
    ["ทุนสำรอง", form.reserve_latest || "-", form.reserve_prev || "-", ""],
    ["กำไร (ขาดทุน)", form.profit_latest || "-", form.profit_prev || "-", ""],
    ["ขาดทุนสะสม", form.loss_latest || "-", form.loss_prev || "-", ""],
    ["ปริมาณธุรกิจ", form.biz_vol_latest || "-", form.biz_vol_prev || "-", ""]
  ]);
  styleCompactTable(tPerf, 9, "#e8f5e9");
  tPerf.setColumnWidth(0, 82);
  tPerf.setColumnWidth(1, 76);
  tPerf.setColumnWidth(2, 76);
  tPerf.setColumnWidth(3, 97);

  // 3. ผลเข้มแข็ง ปี 68/69
  addCellTitle(leftCell, "3. ผลเข้มแข็ง ปี 68/69", false);
  const tStr = leftCell.appendTable([
    ["ปี", "ชั้น", "รวม", "มิติ 1", "มิติ 2", "มิติ 3", "มิติ 4"],
    ["ปี 68", form.c68_lv || "-", form.c68_tot || "-", form.c68_d1 || "-", form.c68_d2 || "-", form.c68_d3 || "-", form.c68_d4 || "-"],
    ["ปี 69", form.c69_lv || "-", form.c69_tot || "-", form.c69_d1 || "-", form.c69_d2 || "-", form.c69_d3 || "-", form.c69_d4 || "-"]
  ]);
  styleCompactTable(tStr, 9, "#e8f5e9");
  tStr.setColumnWidth(0, 41);
  tStr.setColumnWidth(1, 48);
  tStr.setColumnWidth(2, 48);
  tStr.setColumnWidth(3, 48);
  tStr.setColumnWidth(4, 48);
  tStr.setColumnWidth(5, 48);
  tStr.setColumnWidth(6, 50);

  // 4. ปัญหา/ข้อสังเกต/ข้อบกพร่อง
  addCellTitle(leftCell, "4. ปัญหา/ข้อสังเกต/ข้อบกพร่อง", false);
  const tIssues = leftCell.appendTable([
    ["1. " + (form.issue_1 || "-")],
    ["2. " + (form.issue_2 || "-")],
    ["3. " + (form.issue_3 || "-")]
  ]);
  styleCompactTable(tIssues, 9, null);
  tIssues.setColumnWidth(0, leftWidth - 4);

  // เป้าหมายการส่งเสริม
  addCellTitle(leftCell, "เป้าหมายการส่งเสริม", false);
  const goalsWithRemark = (form.promotion_goals || "-") +
    (form.visit_remark ? "\n(หมายเหตุ: " + form.visit_remark + ")" : "");
  const tGoals = leftCell.appendTable([
    [goalsWithRemark]
  ]);
  styleCompactTable(tGoals, 9, null);
  tGoals.setColumnWidth(0, leftWidth - 4);

  // ==================== ฝั่งขวา (RIGHT COLUMN) ====================
  // แผนแนะนำส่งเสริม 12 เดือน
  addCellTitle(rightCell, "แผนแนะนำส่งเสริม (ต.ค. 69 – ก.ย. 70 | แผนเข้าส่งเสริมรวม " + (form.planned_visits || "4") + " ครั้ง/ปี)", true);
  const schedRows = [
    ["เดือน", "สิ่งที่สหกรณ์/กลุ่ม ต้องดำเนินการ", "สิ่งที่ จสส. ต้องดำเนินการ"],
    ["ตุลาคม", form.coop_m10 || "", form.cpd_m10 || ""],
    ["พฤศจิกายน", form.coop_m11 || "", form.cpd_m11 || ""],
    ["ธันวาคม", form.coop_m12 || "", form.cpd_m12 || ""],
    ["มกราคม", form.coop_m1 || "", form.cpd_m1 || ""],
    ["กุมภาพันธ์", form.coop_m2 || "", form.cpd_m2 || ""],
    ["มีนาคม", form.coop_m3 || "", form.cpd_m3 || ""],
    ["เมษายน", form.coop_m4 || "", form.cpd_m4 || ""],
    ["พฤษภาคม", form.coop_m5 || "", form.cpd_m5 || ""],
    ["มิถุนายน", form.coop_m6 || "", form.cpd_m6 || ""],
    ["กรกฎาคม", form.coop_m7 || "", form.cpd_m7 || ""],
    ["สิงหาคม", form.coop_m8 || "", form.cpd_m8 || ""],
    ["กันยายน", form.coop_m9 || "", form.cpd_m9 || ""]
  ];
  const tSched = rightCell.appendTable(schedRows);
  styleCompactTable(tSched, 8.8, "#e8f5e9");
  tSched.setColumnWidth(0, 45);
  tSched.setColumnWidth(1, 212);
  tSched.setColumnWidth(2, 212);

  // เป็นกลุ่มเป้าหมายในโครงการ/แผนงาน/กิจกรรม (ใต้ตาราง 12 เดือนฝั่งขวา)
  const tTarget = rightCell.appendTable([
    ["เป็นกลุ่มเป้าหมายในโครงการ/แผนงาน/กิจกรรม: " + (form.target_projects || "-")]
  ]);
  styleCompactTable(tTarget, 9, null);
  tTarget.setColumnWidth(0, rightWidth - 4);
  tTarget.getRow(0).getCell(0).setBackgroundColor("#fffde7");

  // --------------------------------------------------------------------------
  // หน้าที่ 2: รายงานจำลองคะแนนความเข้มแข็งล่วงหน้า (Strength Score Simulator & Gap Analysis)
  // --------------------------------------------------------------------------
  body.appendPageBreak();

  const pPage2Title = body.appendParagraph("หน้าที่ 2: รายงานการจำลองคะแนนความเข้มแข็งล่วงหน้าและวิเคราะห์ช่องว่าง (Strength Score Simulator & Gap Analysis)");
  pPage2Title.setFontFamily("TH SarabunPSK").setFontSize(14).setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(4);

  const coopObj = findCoopForDoc(form.coop_name);
  const sim = coopObj ? coopObj.simResult : evaluateCoopStrengthAndGap("สหกรณ์", {}, form.c69_lv, form.c69_tot);

  const tGapSummary = body.appendTable([
    ["สหกรณ์/กลุ่มเกษตรกร", (form.coop_name || "-") + " (" + (sim.coopCategoryName || "") + ")"],
    ["ผลความเข้มแข็ง ปี 2569 ปัจจุบัน", `ระดับ ${form.c69_lv || '-'} | คะแนนรวม ${form.c69_tot || '-'} คะแนน (มิติ1=${form.c69_d1 || '-'}, มิติ2=${form.c69_d2 || '-'}, มิติ3=${form.c69_d3 || '-'}, มิติ4=${form.c69_d4 || '-'})`],
    ["เกณฑ์มาตรฐานการจัดชั้น", "• ชั้น 1: คะแนนรวม >= 80 คะแนน และผ่านเงื่อนไขสำคัญ (ตัวชี้วัด 4.1 = 15 คะแนนเต็ม และ ตัวชี้วัด 4.2 = 5 คะแนนเต็ม)\n• ชั้น 2: คะแนนรวม >= 55 คะแนน และผ่านเงื่อนไขสำคัญ (ตัวชี้วัด 4.1 >= 10 คะแนน และ ตัวชี้วัด 4.2 >= 3 คะแนน)"],
    ["ผลการวิเคราะห์ช่องว่าง (Gap Analysis)", (sim.gapSummaryLines || []).join("\n")]
  ]);
  styleCompactTable(tGapSummary, 11, null);
  tGapSummary.setColumnWidth(0, 160);
  tGapSummary.setColumnWidth(1, totalWidth - 160);

  const pWinHeader = body.appendParagraph("ตารางชี้เป้าตัวชี้วัดที่ควรเร่งเก็บคะแนนเพิ่ม (เรียงตามความสำคัญและความง่ายในการทำคะแนน)");
  pWinHeader.setFontFamily("TH SarabunPSK").setFontSize(12).setBold(true).setSpacingBefore(6).setSpacingAfter(2);

  const winRows = [
    ["ตัวชี้วัด", "ชื่อตัวชี้วัดที่คะแนนยังไม่เต็ม", "คะแนนที่ได้ / เต็ม", "คะแนนที่เพิ่มได้", "แนวทางปฏิบัติเพื่อเก็บคะแนน"]
  ];
  if (sim.easyWins && sim.easyWins.length > 0) {
    sim.easyWins.forEach(w => {
      winRows.push([w.id, w.name, `${w.score} / ${w.max}`, `+${w.gap}`, w.ease]);
    });
  } else {
    winRows.push(["-", "ได้คะแนนเต็มทุกตัวชี้วัดหลัก", "-", "-", "รักษามาตรฐานระดับชั้น 1"]);
  }
  const tWins = body.appendTable(winRows);
  styleCompactTable(tWins, 10.5, "#e3f2fd");
  tWins.setColumnWidth(0, 55);
  tWins.setColumnWidth(1, 290);
  tWins.setColumnWidth(2, 95);
  tWins.setColumnWidth(3, 85);
  tWins.setColumnWidth(4, totalWidth - 525);

  doc.saveAndClose();

  const exportUrl = `https://docs.google.com/feeds/download/documents/export/Export?id=${docId}&exportFormat=docx`;
  const response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  const docxBytes = response.getContent();
  const base64Docx = Utilities.base64Encode(docxBytes);
  DriveApp.getFileById(docId).setTrashed(true);

  return {
    fileName: `${docTitle}.docx`,
    fileData: base64Docx,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
}

function findCoopForDoc(name) {
  const list = getMasterCoopList();
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) return list[i];
  }
  return null;
}

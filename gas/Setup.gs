/**
 * Setup.gs — ตัวช่วยตั้งค่าและตรวจสอบระบบ (ใช้ครั้งเดียว/ใช้ตรวจสอบ)
 *
 * วิธีตั้งค่า Script Properties โดยไม่ฝังความลับในโค้ด:
 *   clasp run setPropsFromArgs -p '[["API_TOKEN","..."]]'
 * (ต้อง deploy เป็น API executable ก่อน — ถ้าใช้ไม่ได้ ให้ตั้งในหน้า editor แทน)
 *
 * ไฟล์นี้ไม่ถูกเรียกจากเว็บ (doPost เรียกได้เฉพาะฟังก์ชันใน RPC_ALLOWLIST)
 * และไม่มีข้อมูลลับใด ๆ เก็บอยู่ในไฟล์
 */

function setPropsFromArgs(pairs) {
  var props = PropertiesService.getScriptProperties();
  (pairs || []).forEach(function (pair) {
    if (!pair || pair.length < 2) return;
    props.setProperty(String(pair[0]), String(pair[1]));
  });
  return props.getKeys().sort();
}

/**
 * ใช้กด Run ในหน้า editor เพื่อ
 *   1) ยืนยันว่าอนุมัติสิทธิ์ (scopes) ครบ
 *   2) ดูว่าตั้ง Script Properties ครบหรือยัง (ค่า secret ไม่แสดง)
 *   3) แสดงค่า config ที่ไม่ใช่ secret เพื่อตรวจว่าพิมพ์ถูกต้อง
 *   4) ทดสอบเปิด Spreadsheet ที่ผูกกับสคริปต์
 * ผลลัพธ์ดูได้ที่ Execution log
 */
function setupCheck() {
  var props = PropertiesService.getScriptProperties();
  var keys = [
    'SPREADSHEET_ID',
    'API_TOKEN',
    'DEBUG'
  ];
  var status = {};
  keys.forEach(function (k) {
    status[k] = props.getProperty(k) ? 'SET' : 'MISSING';
  });

  var sheetStatus;
  try {
    sheetStatus = 'OK: ' + getSS_().getName();
  } catch (err) {
    sheetStatus = 'ERROR: ' + (err && err.message ? err.message : String(err));
  }

  var out = {
    props: status,
    spreadsheet: sheetStatus
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/**
 * config.gs — ค่าตั้งต้นทั้งหมดอ่านจาก Script Properties
 * ตั้งค่าที่ Apps Script → Project Settings → Script Properties
 *
 * ห้าม hardcode id / key ลงในโค้ดที่ push ขึ้น GitHub
 */

function getProp_(key, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (v === null || v === '') ? (fallback === undefined ? '' : fallback) : v;
}

var CONFIG = {
  SPREADSHEET_ID: getProp_('SPREADSHEET_ID'),
  SHEETS: {
    ASSIGN: 'คำสั่งมอบหมาย',
    YEAR68: 'ผลปี68',
    YEAR69: 'ผลปี69',
    DRAFT: 'บันทึกข้อมูล',
    USERS: 'users'
  }
};

/**
 * ใช้ openById ก่อนเสมอ เพื่อให้ทำงานได้ทั้ง bound และ standalone
 * ถ้าไม่ได้ตั้ง SPREADSHEET_ID จะ fallback ไปใช้ bound spreadsheet
 */
function getSS_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('ไม่พบ Spreadsheet: กรุณาตั้งค่า SPREADSHEET_ID ใน Script Properties');
  }
  return ss;
}

function getSheet_(name) {
  var sh = getSS_().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต "' + name + '"');
  return sh;
}

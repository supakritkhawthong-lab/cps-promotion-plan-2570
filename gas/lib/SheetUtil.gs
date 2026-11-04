/**
 * SheetUtil.gs — helper สำหรับอ่าน/เขียน Sheets แบบอิงชื่อคอลัมน์
 * ใช้แทนการอ้าง index ตรง ๆ (row[8], row[15], ...) ใน Code.gs เดิม
 */

/** ครอบงานที่เขียนข้อมูล เพื่อกันผู้ใช้บันทึกพร้อมกันแล้วแถวซ้ำ */
function withScriptLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังถูกใช้งานโดยผู้ใช้อื่น กรุณาลองใหม่อีกครั้ง');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * อ่านทั้งชีตเป็น { headers, rows }
 * อ่านครั้งเดียวด้วย getValues() — เร็วกว่าการ getRange ต่อแถวมาก
 */
function getTable_(sheetName) {
  var sh = getSheet_(sheetName);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { headers: [], rows: [] };

  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values.shift().map(function (h) { return String(h).trim(); });
  return { headers: headers, rows: values };
}

/** แปลง rows → array ของ object ตามชื่อ header */
function toObjects_(table) {
  return table.rows
    .filter(function (r) { return r.join('') !== ''; })
    .map(function (r) {
      var obj = {};
      table.headers.forEach(function (h, i) {
        if (h) obj[h] = r[i];
      });
      return obj;
    });
}

function headerIndex_(table, name) {
  var i = table.headers.indexOf(name);
  if (i === -1) throw new Error('ไม่พบคอลัมน์ "' + name + '" ในชีต');
  return i;
}

/**
 * กัน formula injection: ข้อความที่ขึ้นต้นด้วย = + - @
 * จะถูก Sheets ตีความเป็นสูตร
 */
function safeCell_(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

/** เขียนทับทั้งแถวด้วย object (ต้องมี header ตรงกัน) */
function updateRowByObject_(sheetName, rowNumber, obj) {
  var sh = getSheet_(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var values = headers.map(function (h) {
    var key = String(h).trim();
    return key && obj[key] !== undefined ? safeCell_(obj[key]) : '';
  });
  sh.getRange(rowNumber, 1, 1, values.length).setValues([values]);
}

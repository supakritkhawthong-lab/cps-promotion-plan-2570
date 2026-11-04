/**
 * DriveUtil.gs — helper จัดการโฟลเดอร์/ไฟล์บน Google Drive
 * ต้องตั้ง DRIVE_ROOT_FOLDER_ID ใน Script Properties
 */

function getDriveRoot_() {
  var id = CONFIG.DRIVE_ROOT_FOLDER_ID || getProp_('DRIVE_ROOT_FOLDER_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า DRIVE_ROOT_FOLDER_ID ใน Script Properties');
  return DriveApp.getFolderById(id);
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/**
 * สร้างโฟลเดอร์ซ้อนตาม path เช่น "uploads/2026/11"
 * แล้วคืน folder ปลายทาง
 */
function ensureFolderPath_(root, path) {
  var folder = root;
  String(path || '')
    .split('/')
    .filter(function (s) { return s.trim() !== ''; })
    .forEach(function (part) {
      folder = getOrCreateFolder_(folder, part.trim());
    });
  return folder;
}

/**
 * บันทึก Blob ลง Drive
 * @return {{id:string, name:string, url:string}}
 */
function saveFileToDrive_(blob, path) {
  var folder = ensureFolderPath_(getDriveRoot_(), path);
  var file = folder.createFile(blob);
  return { id: file.getId(), name: file.getName(), url: file.getUrl() };
}

/** ย้ายไฟล์ลงถังขยะแบบไม่ throw ถ้าไฟล์ถูกลบไปแล้ว */
function trashFile_(fileId) {
  try {
    if (fileId) DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    // ไม่เป็นไร — ไฟล์อาจถูกลบไปแล้ว
  }
}

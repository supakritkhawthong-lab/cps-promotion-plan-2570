/**
 * config.js — ค่าที่ frontend ใช้ตอน runtime
 *
 * API_URL: URL ของ Apps Script Web App ที่ลงท้ายด้วย /exec
 *          (ได้จาก clasp deploy หรือ Deploy → Manage deployments)
 *
 * API_TOKEN: ต้องตรงกับ Script Properties ชื่อ API_TOKEN
 *            ถ้าไม่ได้ตั้งฝั่ง server ให้เว้นเป็น ''
 *
 * หมายเหตุ: ไฟล์นี้ถูกเสิร์ฟแบบ public — ห้ามใส่ความลับจริง
 */
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwRmIN0s6DxePBfQYkWCpn0zD-7uw5KuhAqa-wHbzipyTw5BapF9bDVVSsGIBY5GLw/exec',
  // ค่าเดียวกับ Script Properties: API_TOKEN (ไม่ใช่ความลับจริง — ไฟล์นี้ public)
  API_TOKEN: '3a36c0a2ac0a3ddbec1be480878c60ba02c410cfbd8f41c5'
};

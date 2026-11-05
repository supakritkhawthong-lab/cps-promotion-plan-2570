# แผนย้ายโค้ดเดิมและพัฒนาต่อ

## ระยะที่ 0 — สำรองข้อมูลก่อนแตะโค้ด

1. Apps Script → **File → Make a copy** เก็บไว้ 1 ชุด
2. คัดลอก Google Sheet ต้นฉบับ (File → Make a copy)
3. จำ `SCRIPT_ID` และ `DEPLOYMENT_ID` เดิมไว้

## ระยะที่ 1 — ให้เว็บทำงานบน GitHub Pages (ไม่เขียน UI ใหม่)

### สถานะการทำ (อัปเดตล่าสุด)

| ข้อ | รายการ | สถานะ |
| --- | --- | --- |
| 1.1 | ดึงโค้ดเดิมด้วย `clasp clone` | ✅ ทำแล้ว (`_pull/` — โปรเจกต์เดิมมี `รหัส`, `Code`, `GeminiService.gs`, `Index`) |
| 1.2 | วางไฟล์เข้า repo (`gas/Code.gs`, `web/index.html`) | ✅ ทำแล้ว |
| 1.3 | เปลี่ยน `getActiveSpreadsheet()` → `getSS_()` | ✅ ทำแล้ว (2 จุด) |
| 1.4 | ครอบ `saveDraftToSheet()` ด้วย `withScriptLock_()` | ✅ ทำแล้ว |
| 1.5 | ตั้ง Script Properties | ✅ ทำแล้ว (ฝั่งเซิร์ฟเวอร์ ไม่มีค่าใน repo) |
| 1.6 | `clasp push` + `clasp deploy` | ✅ ทำแล้ว — deployment `pages-v1` (`AKfycbwRmIN0s6DxePBfQYkWCpn0zD-7uw5KuhAqa-wHbzipyTw5BapF9bDVVSsGIBY5GLw`) |
| 1.7 | ใส่ `API_URL` / `API_TOKEN` จริงใน `web/config.js` | ✅ ทำแล้ว |
| 1.8 | เปิด GitHub Pages | ✅ <https://supakritkhawthong-lab.github.io/cps-promotion-plan-2570/> |
| 1.9 | ทดสอบ ping + RPC + หน้าเว็บ | ✅ ทดสอบกับ deployment จริงผ่านทุกฟังก์ชัน (ดูผลด้านล่าง) |

หมายเหตุการปรับจากแผนเดิม (ทำไปแล้วในโค้ด):

- โปรเจกต์เดิมมีไฟล์ชื่อ `รหัส` ที่เก็บโค้ดแอปซ้ำกับ `Code.gs` ทั้งชุด
  และมี `Code.js` ที่เป็นสคริปต์ auto-update (ฝัง API key เก่าที่ใช้ไม่ได้แล้ว)
  → `clasp push` เขียนทับ `Code` ด้วย `gas/Code.gs` และเขียนทับ `รหัส` ด้วยไฟล์ว่าง
  (`gas/รหัส.gs` เป็น placeholder — **ห้ามใส่โค้ดในไฟล์นี้**) ส่วน `Index` / `GeminiService.gs`
  ถูกนำออกจากโปรเจกต์แล้วเพราะไม่มีโค้ดอ้างถึง
- `gas/Setup.gs` มี `setupCheck()` สำหรับกด Run ใน editor เพื่อตรวจสิทธิ์/Properties โดยไม่เปิดเผยค่า

- `gas/Code.gs` ไม่มี `doGet` แบบเดิมแล้ว — เปลี่ยนเป็นหน้า HTML สถานะ API ขนาดเล็ก
  เพราะ `Index.html` ย้ายไป `web/` และเสิร์ฟจาก GitHub Pages
- `web/index.html` โหลด `config.js` และ `js/google-script-shim.js` ก่อนสคริปต์ก้อนใหญ่แล้ว
- `gas/Api.gs` ใช้ `resolveRpc_()` หาฟังก์ชันแบบเจาะจง ไม่พึ่ง `globalThis[ชื่อ]` อย่างเดียว

### 1.1 ดึงโค้ดเดิม

```bash
npm i -g @google/clasp
clasp login

mkdir _pull && cd _pull
clasp clone <SCRIPT_ID>
```

จะได้ `Code.gs`, `Index.html`, `appsscript.json`, `.clasp.json`

### 1.2 วางไฟล์เข้า repo

```bash
# จาก root ของ repo
copy _pull\Code.gs        gas\Code.gs
copy _pull\Index.html     web\index.html
```

สร้าง `gas/.clasp.json` โดยเอา `scriptId` จาก `_pull/.clasp.json`:

```json
{ "scriptId": "<SCRIPT_ID>", "rootDir": "." }
```

> ถ้าโปรเจกต์เดิมมีไฟล์อื่น (เช่น `Key.gs` ที่เก็บ `GEMINI_API_KEY`) ให้คัดลอกมาด้วย
> แต่ **ลบค่าคีย์ออก** แล้วย้ายไป Script Properties

### 1.3 แก้ `gas/Code.gs` 2 จุด

ค้นหา `SpreadsheetApp.getActiveSpreadsheet()` แล้วเปลี่ยนเป็น `getSS_()`:

```diff
 function getMasterCoopList() {
-  const ss = SpreadsheetApp.getActiveSpreadsheet();
+  const ss = getSS_();
```

```diff
 function saveDraftToSheet(form) {
-  const ss = SpreadsheetApp.getActiveSpreadsheet();
+  const ss = getSS_();
```

ถ้าในโปรเจกต์เดิมมี `var GEMINI_API_KEY = '...'` ให้ลบทิ้ง
เพราะ `gas/config.gs` อ่านจาก Script Properties แล้ว

### 1.4 เพิ่ม lock กันบันทึกชนกัน (แนะนำ)

ครอบเฉพาะส่วนเขียนใน `saveDraftToSheet`:

```js
function saveDraftToSheet(form) {
  return withScriptLock_(function () {
    // ... โค้ดเดิมทั้งหมดของฟังก์ชัน ...
  });
}
```

### 1.5 ตั้งค่า Script Properties

Apps Script → Project Settings → Script Properties

```
SPREADSHEET_ID        = <id ของชีต>            (เว้นว่างได้ถ้าสคริปต์ผูกกับชีตนั้น)
GEMINI_API_KEY        = <คีย์>
DRIVE_ROOT_FOLDER_ID  = <id โฟลเดอร์ Drive>   (ถ้าใช้)
API_TOKEN             = <สตริงสุ่มยาว ๆ>       (แนะนำ)
DEBUG                 = 1                      (เฉพาะตอนแก้บั๊ก)
GEMINI_MODELS         = gemini-3.5-flash,gemini-3.8-flash,gemini-2.5-flash   (ไม่บังคับ)
```

> ค่าที่ตั้งจริงในโปรเจกต์นี้: `GEMINI_API_KEY`, `DRIVE_ROOT_FOLDER_ID`, `API_TOKEN`, `DEBUG`
> ส่วน `SPREADSHEET_ID` เว้นว่างโดยตั้งใจ — `getSS_()` จะใช้ bound spreadsheet
> (ทดสอบแล้วว่า `getActiveSpreadsheet()` คืนชีตที่ผูกไว้ได้ใน web app context)

> ห้ามใส่ `gemini-2.0-flash` / `gemini-2.0-flash-lite` — เลิกให้บริการแล้ว (ทดสอบแล้วได้ 404)
> `gemini-3.8-flash` บางช่วงคิวเต็ม (503) โค้ดจะ retry แล้วไล่ไปรุ่นถัดไปให้อัตโนมัติ

> ตั้งค่าจากภายนอกได้ด้วย `clasp run setPropsFromArgs -p '[...]'`
> แต่ต้อง deploy เป็น API executable และผูก GCP project ก่อน — ถ้าไม่สะดวก ให้กรอกในหน้า editor
> และใช้ `setupCheck()` (ใน `gas/Setup.gs`) ตรวจว่าครบหรือยัง

### 1.6 Push และ Deploy

```bash
cd gas
clasp push -f                 # -f เพื่อเขียนทับ appsscript.json (scopes/webapp)
clasp deploy -d "pages-v1"    # ครั้งแรก: ได้ deployment ใหม่
# ครั้งถัดไป: อัปเดตตัวเดิม URL จะไม่เปลี่ยน
clasp deploy -i <DEPLOYMENT_ID> -d "pages-v1"
```

จากนั้น Apps Script → **Deploy → Manage deployments** ตรวจสอบ:

- Execute as: **Me**
- Who has access: **Anyone** (anonymous)

คัดลอก URL ที่ลงท้าย `/exec`

> สำคัญ: ห้ามเลือก "Anyone with Google account" เพราะ `fetch` จาก Pages
> จะโดน redirect ไปหน้า login และ CORS จะพัง

### 1.7 ตั้งค่า frontend

แก้ `web/config.js`:

```js
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/XXXX/exec',
  API_TOKEN: '<ค่าเดียวกับ Script Properties>'
};
```

เพิ่ม 2 บรรทัดใน `web/index.html` **ก่อน** `<script>` ก้อนใหญ่ท้ายไฟล์:

```html
<script src="config.js"></script>
<script src="js/google-script-shim.js"></script>
<script>
  // ... โค้ดเดิม ...
</script>
```

### 1.8 เปิด GitHub Pages

Settings → Pages → Source = **GitHub Actions** → push ขึ้น `main`

### 1.9 ทดสอบ

```bash
# health check
curl -L -X POST "<API_URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  --data '{"action":"ping"}'

# เรียกฟังก์ชันจริง
curl -L -X POST "<API_URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  --data '{"action":"rpc","fn":"getMasterCoopList","args":[],"token":"<API_TOKEN>"}'
```

เปิดเว็บ Pages → ตรวจ console → เลือกสหกรณ์ → อัปโหลดไฟล์ → สร้าง Word

#### ทดสอบหน้าเว็บในเครื่อง (ไม่ต้องรอ deploy)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve-web.ps1
# เปิด http://127.0.0.1:8787/index.html
```

ถ้าต้องการทดสอบ UI ครบ flow โดยยังไม่มี Apps Script จริง ให้ชี้ `API_URL`
ไปที่ mock endpoint ที่ตอบ JSON ตาม `docs/api.md` (เช่น `{"ok":true,"result":[...]}`)

**ผลตรวจล่าสุด (ด้วย mock endpoint):** ผ่านทุกจุด —

- หน้าเว็บโหลดได้ ไม่มี syntax error, shim ถูกติดตั้งก่อน `window.onload`
- `getMasterCoopList()` → dropdown 2 รายการ, เลือกแล้วฟอร์ม/Simulator/ตาราง 12 เดือนถูกเติมครบ
- `saveDraftToSheet()` → ขึ้นข้อความบันทึกร่างสำเร็จ
- `generatePlanDocument()` → สร้าง Blob และสั่งดาวน์โหลดไฟล์สำเร็จ
- `analyzeUploadedFilesWithAI()` (แนบรูป) → เติมตัวเลข/ข้อสังเกต/เป้าหมาย + ตรวจสมการบัญชี
- error path → failure handler ได้ `message` + `code` จาก API (ไม่ใช่แค่ `HTTP 400`)

#### ผลทดสอบกับ Apps Script deployment จริง (04/11/2026)
ทดสอบจากเบราว์เซอร์จริง (`http://127.0.0.1:8791/index.html`) ผ่าน shim → `/exec`:

| ทดสอบ | ผล |
|---|---|
| `doGet` (`/exec` แบบ GET) | ✅ 200 หน้า HTML สถานะ API |
| `ping` (ไม่มี/ผิด token) | ✅ `UNAUTHORIZED` |
| `ping` (token ถูก) | ✅ `pong` |
| ฟังก์ชันนอก allowlist (`doGet`) | ✅ `FORBIDDEN` |
| `getMasterCoopList` | ✅ 124 สหกรณ์ / 687 KB |
| `saveDraftToSheet` | ✅ เขียนแถวลงชีต `บันทึกข้อมูล` |
| `generatePlanDocument` | ✅ `.docx` จริง (magic `PK`), ~15 KB, สร้าง 문서 → export → ลบไฟล์ชั่วคราว |
| `analyzeUploadedFilesWithAI` (รูป PNG) | ✅ 36 ฟิลด์, อ่านเลขทะเบียน/สินทรัพย์/หนี้สิน/ชื่อผู้สอบบัญชีถูก, ~55 วินาที |

ทดสอบซ้ำบน **GitHub Pages จริง** (`https://supakritkhawthong-lab.github.io/cps-promotion-plan-2570/`):
โหลดหน้าได้, shim ทำงาน, `getMasterCoopList` คืน 124 สหกรณ์, เลือกสหกรณ์แล้วฟอร์ม + ตาราง 12 เดือนถูกเติมครบ
(ยืนยันว่า CORS ระหว่าง `*.github.io` กับ Apps Script ผ่าน)

> หมายเหตุ: การเรียกครั้งแรกหลัง deploy อาจได้โค้ดเวอร์ชันก่อนหน้า 1–2 นาที (deployment cache)

> ปัญหาที่เจอและแก้แล้ว: `generatePlanDocument` ล้มด้วย
> `สิทธิ์ถูกปฏิเสธขณะเปิดใช้ API: drive สำหรับโปรเจ็กต์ GCP 298604340784`
> เพราะโปรเจกต์ GCP ที่ผูกกับสคริปต์ยังไม่เปิด **Google Drive API**
> → เปิดที่ <https://console.cloud.google.com/apis/library/drive.googleapis.com?project=298604340784>
> (หรือ Project Settings → เปลี่ยนไปใช้โปรเจกต์ default ของ Apps Script)


---

## ระยะที่ 2A — SPA 5 แท็บ (05/11/2026)

### สถานะการทำ

| รายการ | สถานะ |
|---|---|
| เมนู 5 แท็บ โดยคง element `id` ของฟอร์มเดิม | ✅ ตรวจ 76 `id` เดิม ไม่มีรายการที่หาย |
| `CPD_AppState` + sync จากฟอร์ม/AI ไปทุกแท็บ | ✅ |
| แผนฉบับเต็ม, การเงิน, 4 มิติ 18 ตัวชี้วัด, 4M, 30/150 วัน | ✅ |
| ติดตาม 12 เดือน, 4 สี, ธุรกิจ 6 ประเภท, visit log | ✅ |
| รายงานปิดบัญชี 2.1–2.5 และ Dashboard 123 แห่ง | ✅ |
| `saveCompleteCoopRecord`, `getCompleteCoopRecord`, `getDashboardSummaryData` | ✅ |
| ชีต `CPD_Plans_2570`, `CPD_Monthly_Tracking`, `CPD_Closing_Success` | ✅ สร้างอัตโนมัติ |
| Backend deployment เดิม `@37` | ✅ push/deploy แล้ว |
| ถอด admin/test endpoints ออกจาก RPC allowlist | ✅ เหลือเฉพาะ 7 public functions |
| ล้างข้อมูลทดสอบ CPD และร่างเดิมที่สร้างระหว่าง E2E | ✅ Dashboard กลับเป็น planned 0 |
| Frontend 5 แท็บขึ้น GitHub Pages | 🟡 รอ commit/push |

### ผลทดสอบ

- `node --check` ผ่านสำหรับ JavaScript และ Apps Script ทุกไฟล์
- Backend E2E ผ่าน: ping, สร้างชีต, save, load, dashboard, server-side filters และลบข้อมูลทดสอบ
- UI ผ่าน: เลือกสหกรณ์, sync, auto-calc การเงิน/คะแนน, deadline 30/150 วัน,
  สถานะและปริมาณธุรกิจรายเดือน, เพิ่ม/ลบ visit log และบันทึกจากแท็บ 2, 3, 4
- โหลด CPD record อัตโนมัติได้แม้สหกรณ์มีร่างเดิม และปุ่ม "โหลดข้อมูลเพื่อแก้ไข"
  โหลดกลับ Tab 1–4 ครบ (full-state round-trip)
- Dashboard เชื่อม backend จริง: 123 แถว, 4 เขต, 6 KPI, filter เขต/อำเภอถูกต้อง,
  วันที่ไทยและ deadline แสดงถูกต้อง
- CSV = header + 123 แถว, Excel (.xls) และ Word (.docx) ดาวน์โหลดสำเร็จ
- Print ถูกเรียกจากแท็บรายงาน และไม่พบ console error ใน flow ที่ทดสอบ

### หมายเหตุก่อน production

- ต้อง push `web/` แล้วทดสอบ 5 แท็บซ้ำบน URL GitHub Pages จริง
- ปิด `DEBUG` เมื่อไม่ต้องการ stack trace และตั้ง CI secrets ถ้าจะ deploy GAS ผ่าน Actions
- ข้อมูลต้นทาง 86 จาก 123 แห่งไม่มีอำเภอ จึงควรแก้ทะเบียนต้นทางก่อนใช้ตัวกรองอำเภอเต็มรูปแบบ
- `API_TOKEN` ใน frontend เป็นเพียง speed bump ไม่ใช่ระบบยืนยันตัวตน

---

## ระยะที่ 2 — ความถูกต้องและประสิทธิภาพ

ทำทีละข้อ commit ทีละเรื่อง

### 2.1 เลิกใช้ index คอลัมน์ตรง ๆ

ปัจจุบัน `getMasterCoopList()` อ้าง `row[8]`, `row[15]`, `row[22]`, `row[27]`, `row[30]`, `row[31]`, `row[37]`
ซึ่งพังทันทีถ้ามีคนแทรกคอลัมน์

ใช้ helper ที่มีให้:

```js
var table = getTable_('ผลปี68');
var i = {
  name: headerIndex_(table, 'ชื่อสหกรณ์'),
  d1:   headerIndex_(table, 'มิติ 1'),
  // ...
};
```

หรือกำหนด `SCHEMA` กลางใน `config.gs` แล้วอ้างชื่อเดียวทั้งระบบ

### 2.2 ลดการอ่าน Sheet ซ้ำ

- `generatePlanDocument()` เรียก `saveDraftToSheet()` แล้ว `findCoopForDoc()`
  ซึ่งเรียก `getMasterCoopList()` ใหม่ทั้งชุด
- ทางแก้: ส่ง `simResult` มาจาก client (มีอยู่แล้วใน `masterCoops[currentCoopIndex].simResult`)
  แล้วใช้ค่านั้นในหน้า 2 ของ Word

### 2.3 Cache รายชื่อสหกรณ์

```js
function getMasterCoopList() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('masterCoops');
  if (hit) return JSON.parse(hit);

  var data = buildMasterCoopList_(); // ย้าย logic เดิมมาที่นี่
  cache.put('masterCoops', JSON.stringify(data), 300); // 5 นาที
  return data;
}
```

ล้าง cache ใน `saveDraftToSheet()` ด้วย `CacheService.getScriptCache().remove('masterCoops')`

### 2.4 ตรวจผลลัพธ์ AI

- ใช้ `responseSchema` ของ Gemini เพื่อบังคับโครงสร้าง JSON
- ตรวจว่าตัวเลขที่ได้เป็นตัวเลขจริงก่อนใส่ฟอร์ม
- ใส่ `safetySettings` ตามนโยบายหน่วยงาน

### 2.5 เก็บไฟล์ลง Drive

ตอนนี้ไฟล์ที่อัปโหลดถูกประมวลผลแล้วทิ้ง ไม่ได้เก็บ
และไฟล์ `.docx` ถูกลบหลัง export

แนวทาง:

```js
// เก็บ .docx
var folder = ensureFolderPath_(getDriveRoot_(), 'exports/' + (form.fiscal_year || ''));
var saved = folder.createFile(DriveApp.getFileById(docId).getBlob().setName(docTitle + '.docx'));

// คืนทั้ง base64 และลิงก์
return {
  fileName: docTitle + '.docx',
  fileData: base64Docx,
  fileId: saved.getId(),
  fileUrl: saved.getUrl(),
  mimeType: '...'
};
```

สำหรับไฟล์แนบ: บันทึกเฉพาะเมื่อผู้ใช้กด "เก็บไฟล์ต้นฉบับ"
เพื่อไม่ให้อัปโหลดซ้ำสองรอบ (payload มี `base64` อยู่แล้วในกรณีไฟล์สแกน)

### 2.6 จำกัดขนาดและชนิดไฟล์

- ฝั่ง browser: ตรวจ `file.size` ก่อนอ่าน (แนะนำ ≤ 10 MB/ไฟล์, รวม ≤ 20 MB)
- ฝั่ง server: ตรวจ `mimeType` ใน whitelist (`application/pdf`, `image/jpeg`, `image/png`)
- ตั้งชื่อไฟล์ใหม่ด้วย `Utilities.getUuid()` ไม่ใช้ชื่อจากผู้ใช้ตรง ๆ

---

## ระยะที่ 3 — Auth และ Data model

### 3.1 Google Sign-In (ถ้าต้องการความปลอดภัยจริง)

1. Google Cloud Console → สร้าง OAuth Client ID ชนิด **Web application**
2. Authorized JavaScript origins: `https://<user>.github.io`
3. frontend โหลด `https://accounts.google.com/gsi/client` แล้วขอ ID token
4. ส่ง `idToken` มาใน body ของ `doPost`
5. ตรวจฝั่ง server:

```js
var info = JSON.parse(UrlFetchApp.fetch(
  'https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken
).getContentText());

if (info.aud !== CLIENT_ID) throw apiError_('UNAUTHORIZED', 'aud ไม่ตรง');
if (info.email_verified !== 'true') throw apiError_('UNAUTHORIZED', 'ยังไม่ยืนยันอีเมล');
// ตรวจ domain หรือ allowlist ในชีต users
```

### 3.2 แยกตารางข้อมูล

ดูข้อเสนอใน `docs/data-model.md` — เปลี่ยนจาก JSON ก้อนเดียวใน `บันทึกข้อมูล`
เป็น `plans` + `plan_files` + `audit_log`

### 3.3 Version ของแผน

เพิ่ม `version` และ `status` (`draft` / `submitted` / `approved`)
เพื่อเก็บประวัติการแก้ไข ไม่ทับแถวเดิม

---

## Troubleshooting

| อาการ | สาเหตุที่พบบ่อย | แก้ |
|---|---|---|
| `Failed to fetch` | `API_URL` ผิด / ยังเป็น placeholder | ใส่ URL `/exec` จริง |
| ได้ HTML กลับมาแทน JSON | deployment เป็น "Anyone with Google account" | เปลี่ยนเป็น Anyone (anonymous) |
| CORS error | ตั้ง header เป็น `application/json` | ใช้ `text/plain;charset=utf-8` |
| `ไม่อนุญาตให้เรียกฟังก์ชัน` | ลืมเพิ่มชื่อใน `RPC_ALLOWLIST` | เพิ่มใน `gas/Api.gs` |
| `Script function not found: doPost` | ยังไม่ `clasp push` | push แล้ว deploy ใหม่ |
| `You do not have permission to call SpreadsheetApp` | executeAs ไม่ใช่ Me | ตั้ง Execute as: Me |
| `สิทธิ์ถูกปฏิเสธขณะเปิดใช้ API: drive` | GCP project ที่ผูกกับสคริปต์ยังไม่เปิด Drive API | เปิด Drive API ในโปรเจกต์นั้น หรือเปลี่ยนไปใช้โปรเจกต์ default |
| เรียกแล้วได้โค้ดเก่า | deployment cache หลัง deploy | รอ 1–2 นาที แล้วลองใหม่ |
| AI ช้า / timeout | ไฟล์ใหญ่หรือโมเดลช้า | ลดจำนวนหน้า, จำกัดขนาดไฟล์ |
| ภาษาไทยเพี้ยน | ไฟล์ไม่ได้ UTF-8 | บันทึกเป็น UTF-8 |
| `clasp push` ทับโค้ดใน editor | แก้สองที่พร้อมกัน | ใช้ GitHub เป็นหลัก แล้ว `clasp pull` ก่อนแก้ |
| `clasp push` ฟ้องเรื่อง container | ใช้ `appsscript.json` ของ repo กับสคริปต์ที่ผูกกับ Sheet | ใช้ `appsscript.json` ที่ clone มา แล้วเติม `webapp` + `oauthScopes` จากไฟล์ใน repo |
| Pages ไม่ deploy | workflow ตั้ง `branches: [main]` | เปลี่ยนเป็นชื่อ branch จริง หรือ rename เป็น `main` |

## หมายเหตุการ deploy

- `clasp deploy` ครั้งแรกจะได้ deployment ใหม่ → URL เปลี่ยน
  หลังจากนั้นให้ใช้ `clasp deploy -i <DEPLOYMENT_ID>` เพื่ออัปเดตตัวเดิม URL จะคงที่
- ถ้าแก้ `appsscript.json` (scopes/webapp) ต้อง deploy ใหม่และอาจต้อง authorize ใหม่
- ก่อน `clasp push` ครั้งแรก ให้ค้นหาคีย์ที่ hardcode:
  ```bash
  grep -rn "GEMINI_API_KEY" gas/
  grep -rn "AIza" gas/
  ```
  แล้วลบออกทั้งหมด เหลือแค่อ่านจาก Script Properties

## Checklist ก่อนขึ้น production

- [ ] ลบ `GEMINI_API_KEY` ออกจากโค้ดทุกไฟล์
- [ ] ตั้ง `API_TOKEN` และ `SPREADSHEET_ID`
- [ ] ตรวจ `RPC_ALLOWLIST` ว่ามีเท่าที่จำเป็น
- [ ] ตั้ง `DEBUG` เป็นค่าว่าง
- [ ] ทดสอบ create/read/update จาก Pages จริง
- [ ] ทดสอบสร้าง Word 3 เคส (สหกรณ์เกษตร, กลุ่มเกษตรกร, นอกภาคเกษตร)
- [ ] สำรอง Sheet และตั้ง trigger backup รายวัน
- [ ] ตั้ง `GAS_DEPLOYMENT_ID` ใน GitHub Variables
- [ ] ตั้ง `CLASPRC_JSON` ใน GitHub Secrets

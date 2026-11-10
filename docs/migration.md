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


---

## ระยะที่ 3 — ปรับ SPA จาก 5 แท็บเหลือ 3 หน้า (เสร็จแล้ว)

### โครงสร้างหน้าปัจจุบัน

| หน้า | เนื้อหา |
| --- | --- |
| 1. ฟอร์มพื้นฐาน | ฟอร์มเดิมทั้งหมด + AI extraction (ไม่เปลี่ยน id/ฟีเจอร์) |
| 2. แผนฉบับเต็ม & วิเคราะห์ 4M | ข้อมูลองค์กร/การเงิน/ความเข้มแข็ง/วิเคราะห์ 4M/แผนปิดบัญชี-ประชุมใหญ่ |
| 3. Dashboard จังหวัด & ติดตามเอกสาร | KPI จังหวัด, Early Warning Signals, ชั้นความเข้มแข็ง, ทะเบียนเอกสาร/รายงาน 43 รายการ |

### สิ่งที่เปลี่ยน

- `web/index.html` — nav เหลือ 3 ปุ่ม (`base-form`, `full-plan`, `dashboard`) และลบ pane ของแท็บ 3/4 ออก
- `web/js/cpd-ui.js`
  - ไม่เรียก `buildTab3()` / `buildTab4()` แล้ว (โค้ดเดิมยังเก็บไว้แต่ไม่ถูก render)
  - เพิ่มปุ่ม **✨ ดึงข้อมูลจากฟอร์มพื้นฐานวิเคราะห์ 4M อัตโนมัติ** (`data-action="analyze-4m"`)
  - สลับจากหน้า 1 → หน้า 2 แล้วช่อง 4M ว่าง จะเติมให้อัตโนมัติ (ไม่ทับข้อความที่ผู้ใช้แก้ไว้)
  - ลบตัวกรองเขตส่งเสริม (`cpd5FilterZone`) และกราฟความก้าวหน้ารายเขต (`cpd5Zones`)
  - เพิ่มโซน **Early Warning Signals** (`cpd5EarlyWarning`) แบ่ง วิกฤต / เฝ้าระวัง / ปกติ พร้อมตาราง 12 รายการแรก
  - เพิ่มทะเบียนเอกสาร/รายงาน (`cpd5ReportTarget`, `cpd5ReportFrequency`, `cpd5ReportSection`, `cpd5ReportRows`)
- `web/js/cpd-report-registry.js` — ทะเบียนเอกสาร/รายงาน 43 รายการ (กบส. 21, กพส. 14 + ฝบท./กพส. 1, กตส. 3, กจส. 4) พร้อมลิงก์ต้นทาง
- `web/js/cpd-state.js` — ยังคงเก็บ `scheduleAndActivities` และ `closingReport` ใน state และซิงค์ตอนบันทึก (ไม่แสดง UI แล้ว)

### เกณฑ์ Early Warning Signals

- **วิกฤต**: เหลือ ≤ 30 วันถึงกำหนดประชุมใหญ่ และรายงานรายเดือน < 25% หรือยังไม่มีแผนและเหลือ ≤ 60 วัน
- **เฝ้าระวัง**: เหลือ ≤ 60 วัน และรายงานรายเดือน < 50% หรือชั้นความเข้มแข็งปี 69 เป็นชั้น 3–4
- **ปกติ**: ไม่เข้าเกณฑ์ข้างต้น

### ทดสอบล่าสุด (local, 2026-11-06)

- โหลดหน้าได้โดยไม่มี console error; `CPD_UI`, `CPD_STATE`, `CPD_REPORT_REGISTRY` พร้อมใช้งาน
- สลับหน้า 1 → 2 แล้วได้ข้อความ 4M อัตโนมัติ และปุ่ม analyze ทำงาน (มี toast)
- Dashboard เชื่อมต่อฐานข้อมูลจริง: 123 รายการ, ทะเบียนเอกสาร 43 รายการ
- ตัวกรองทะเบียนเอกสาร: กบส. = 21, กจส. = 4, รายเดือน = 17, ล้างตัวกรองกลับมา 43
- ไม่พบ `cpd5FilterZone` / `cpd5Zones` ใน DOM

---

## ระยะที่ 4 — TASK 4–6: Preload, Profile-aware 4M, Zero-Click Pipeline (เสร็จแล้ว)

### สิ่งที่เปลี่ยน (commit `32cc5a2`)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `web/js/cpd-preload.js` | ไฟล์ใหม่: ข้อมูลตรวจสอบแล้วของสหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี, 47-rule Smart Coop Profile parser, กิจกรรมเป้าหมาย 2.5–2.11 |
| `web/js/cpd-ui.js` | +330/-88 — preload helpers, wrapped `onSelectCoop`, `autoPipeline4M`, `analyze4M` profile-aware, 7 CAD ratios, `addWeaknessActivitiesFrom4M` แทรกกิจกรรมตามตำแหน่ง |
| `web/index.html` | +68/-6 — certify เดือน+ปี, `profileExtract` จาก PDF, `lowTextPdf` ปกป้องค่า 0, toast PDF สแกน, Zero-Click pipeline หลัง AI |

### TASK 4 — Preload ข้อมูลตรวจสอบแล้ว

- เลือกสหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี → เติมฟอร์ม/state/fourM อัตโนมัติจาก `CPD_PRELOAD`
- PDF ดิจิทัล → `parseSmartCoopProfile()` (47 กฎ regex) ผสานเฉพาะช่องว่าง
- PDF สแกนภาพ (< 50 ตัวอักษร) → `lowTextPdf = true` ลบค่า `Latest/Prev = 0` ที่ AI ส่งมา, แสดง toast แจ้งเตือน
- สลับจากสหกรณ์ preload → สหกรณ์อื่น → ล้างข้อมูล preload แล้วสร้าง 4M ใหม่จากข้อมูลจริง

### TASK 5 — วิเคราะห์ 4M แบบ Profile-aware

- `detectCoopProfile()` → A (ออมทรัพย์) → B (เกษตร/ประมง/ไก่ไข่/…) → C (ร้านค้า/บริการ) → D (กลุ่มเกษตรกร) → default B
- `getProfileBenchmarks()` → เกณฑ์ D/E, CR, collection rate ตามประเภทสหกรณ์
- ข้อความ 4M ของสหกรณ์ตรวจสอบแล้ว: ใช้ฉบับจริงจาก `preload.fourM` (ไม่มี `......`)
- ข้อความสหกรณ์ทั่วไป: ใช้โครงสร้างประโยคเดิม, `......` สำหรับค่าที่ไม่มี
- อัตราส่วนทางการเงิน 7 ตัวในบรรทัดเดียว: D/E, ROE, ROA, CR, ทุนสำรอง/สินทรัพย์, OPEX, ลูกหนี้ชำระตามกำหนด
- ข้อสังเกตผู้สอบบัญชี/ข้อบกพร่อง → เพิ่มใน org/summary analysis
- แก้ false claim: ไม่บอกว่า "ได้อนุมัติแผนกลยุทธ์" (ตามข้อมูลโปรไฟล์ข้อ 22.1 ยังไม่มี)

### TASK 6 — Zero-Click Auto Pipeline

- `autoPipeline4M()`: sync → ratios → 4M → 5.2 อัตโนมัติหลังเลือกสหกรณ์และหลัง AI
- `clearAutoGeneratedActivities()` → ลบ `data-auto-4m="true"` ก่อนสร้างใหม่
- กิจกรรม 2 กลุ่ม:
  - **เป้าหมาย 2.5–2.11** (เจาะจงข้อบกพร่องจริงของสหกรณ์ตรวจสอบแล้ว) → แทรกก่อนหัวข้อ 3
  - **แก้ไขจุดอ่อนทางการเงิน 3.x** (จาก weakness analysis) → แทรกก่อนหัวข้อ 4
- รหัสกิจกรรมไม่ซ้ำ: จองเลข 2.x ล่วงหน้า, ไม่รวม synced rows ใน usedCodes

### ผลทดสอบ Production (2026-11-09)

| รายการ | ผล |
| --- | --- |
| เลือกสหกรณ์ตรวจสอบแล้ว | ✅ 22 กิจกรรม, 11 auto, 7 targeted (2.5–2.11) |
| รหัสไม่ซ้ำ | ✅ `dupCodes: []` |
| certify_date | ✅ `กุมภาพันธ์ 2570` (เดือน+ปี) |
| agm_date | ✅ `27/02/2570` |
| สินทรัพย์/ทุน | ✅ 27,022,397.73 / 16,748,083.71 |
| ความเข้มแข็ง 2568 | ✅ 87.33 |
| 4M prose | ✅ มี `155,559.43`, `D/E = 0.61`, 7 ratios, ไม่มี `......` |
| ธุรกิจ | ✅ 3 หัวข้อ (รับฝาก, ทุนให้กู้, จัดหาปัจจัย) |
| false claim | ✅ ไม่มี "แผนกลยุทธ์" |
| gov_auditor_name | ✅ `คนึงศรี` |
| สลับ → สหกรณ์ทั่วไป | ✅ assets=1000, มี `......`, profile B |
| สลับกลับ → ตรวจสอบแล้ว | ✅ preload กลับมา, 22 กิจกรรม, ไม่มี dup |
| Console errors | ✅ ไม่มี |

### หมายเหตุ

- Frontend-only — ไม่ต้อง deploy GAS ใหม่
- Cache-bust: `?v=20260214b` บน script tags
- Backend deployment ID: `AKfycbwRmIN0s6DxePBfQYkWCpn0zD-7uw5KuhAqa-wHbzipyTw5BapF9bDVVSsGIBY5GLw` (last deployed `@38`)
- หากต้องการเพิ่มสหกรณ์ตรวจสอบแล้วอีก → เพิ่ม entry ใน `CPD_PRELOAD.data` array ของ `cpd-preload.js`

---

## ระยะที่ 5 — 4M Analysis Engine + Structured Form (เสร็จแล้ว)

### สิ่งที่เปลี่ยน (commit `afd61b9`)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `web/js/cpd-4m-engine.js` | **ไฟล์ใหม่** — Rule-based Analysis Engine วิเคราะห์ M1-M4 + ข้อสังเกตผู้สอบบัญชี |
| `web/js/cpd-state.js` | +90 บรรทัด — `fourMDetails` ใน defaultState(), `recalc4MRatios()`, CAMELS ratios เพิ่มเติม |
| `web/js/cpd-ui.js` | +200 บรรทัด — UI 4M Structured Form, ปุ่มวิเคราะห์, sync fields, run engine |
| `web/js/cpd-preload.js` | +300 บรรทัด — ข้อมูล สอ.โตโยต้า + fourMDetails ในสหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี |
| `web/index.html` | เพิ่ม script tag `cpd-4m-engine.js` |

### 4M Analysis Engine

| กฎ | เงื่อนไข | ผลลัพธ์ |
| --- | --- | --- |
| M1: ผู้ตรวจฯ เข้มแข็ง | `inspectorFrequency = monthly` | จุดแข็ง |
| M1: ส่วนร่วมต่ำ | `ฝากเงิน < 50%` หรือ `กู้เงิน < 60%` | จุดควรพัฒนา + กิจกรรม |
| M2: สถานที่ดี | `facilityCondition = good` | จุดแข็ง |
| M2: โปรแกรมเอกชน | `accountingSoftware = private_software` | จุดแข็ง |
| M3: มั่นคง | `D/E < 1` + `Current Ratio > 2` | จุดแข็ง |
| M3: ทุนสำรองต่ำ | `reserve/asset < 0.10` | จุดควรพัฒนา + กิจกรรม |
| M3: หมุนต่ำ | `assetTurnover < 0.10` | จุดควรพัฒนา + กิจกรรม |
| M4: ทันเวลา | `ปิดบัญชี ≤ 30 วัน` + `ประชุมใหญ่ ≤ 150 วัน` | จุดแข็ง |
| M4: ไม่มีแผนกลยุทธ์ | `hasStrategicPlan = false` | จุดควรพัฒนา + กิจกรรม |
| M4: ควบคุมดีมาก | `internalControlLevel = ดีมาก` | จุดแข็ง |
| AUD: ไม่มีจุดอ่อน | `hasInternalControlWeakness = false` | จุดแข็ง |
| AUD: มีจุดอ่อน + ยังไม่แก้ | `hasInternalControlWeakness = true` + `correctionStatus = ยังไม่ได้ดำเนินการ` | จุดควรพัฒนา + กิจกรรม + **คำเตือน** |

### ผลทดสอบ Production

| สหกรณ์ | จุดแข็ง | จุดควรพัฒนา | กิจกรรม | คำเตือน |
|---------|---------|-------------|---------|---------|
| สอ.โตโยต้า | 8 | 3 | 3 | 0 |
| สอ.ผู้เลี้ยงไก่ไข่ชลบุรี | 3 | 3 | 3 | 0 |

---

## ระยะที่ 5B — 6-Business Analysis + Auto-Detection (เสร็จแล้ว)

### การเปลี่ยนแปลง (commit `2ab691f`)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `web/js/cpd-ui.js` | -292 บรรทัด — ลบ checkbox, form fields, ปุ่ม generate; เปลี่ยนเป็น textarea read-only |
| `web/js/cpd-state.js` | ลบ `activeList` และ `enabled` fields (คง businessDetails ไว้) |
| `web/js/cpd-preload.js` | ลบ `activeList` และ `enabled` จาก preset data |
| `web/js/cpd-business-analysis.js` | Auto-detect ธุรกิจจากข้อมูลจริง (มูลค่า, จำนวนสมาชิก) |
| `web/index.html` | bump cache version |

### ฟีเจอร์ใหม่

| ฟีเจอร์ | รายละเอียด |
| --- | --- |
| **Read-Only Textarea** | ส่วน "2. ด้านการบริหารจัดการธุรกิจ" เป็นช่องแสดงข้อความวิเคราะห์แบบ read-only |
| **Auto-Generate** | ระบบสร้างข้อความวิเคราะห์อัตโนมัติเมื่อกดปุ่ม "✨ ดึงข้อมูลจากฟอร์มพื้นฐานวิเคราะห์ 4M อัตโนมัติ" |
| **Auto-Detection** | ตรวจจับธุรกิจที่ดำเนินการจากข้อมูลจริง (มูลค่าเงิน, จำนวนสมาชิก) |
| **6 ธุรกิจ** | รับฝากเงิน, ให้สินเชื่อ, จัดหาสินค้า, รวบรวมผลิตผล, แปรรูป, ให้บริการ |

### ผลทดสอบ Production (v20260214g)

| สหกรณ์ | ธุรกิจที่ตรวจพบ | ความยาวข้อความ |
|---------|----------------|----------------|
| สอ.โตโยต้า | deposit, loan (2 ธุรกิจ) | 1,806 ตัวอักษร |
| สหกรณ์ทั่วไป | deposit, loan (2 ธุรกิจ) | 1,806 ตัวอักษร |

### ตัวอย่างข้อความวิเคราะห์

```
ด้านการบริหารจัดการธุรกิจ

2.1 ธุรกิจรับฝากเงิน

1) ยังไม่มีการกำหนดแผนเฉพาะธุรกิจรับฝากเงิน
2) สหกรณ์มีเงินรับฝาก ออมทรัพย์, ฝากประจำ 3 เดือน, ฝากประจำ 6 เดือน
3) สหกรณ์รับฝากเงินระหว่างปี 35,000,000.00 บาท เฉลี่ยเดือนละ 2,916,666.67 บาท
...

2.2 ธุรกิจให้สินเชื่อ / เงินกู้
...
```

### สรุปการเปลี่ยนแปลง UI

| ก่อน | หลัง |
|------|------|
| Checkbox เลือก 6 ธุรกิจ | ❌ ลบออก |
| ฟอร์มกรอกข้อมูลแต่ละธุรกิจ | ❌ ลบออก |
| ปุ่ม "✨ สร้างข้อความวิเคราะห์ธุรกิจ" | ❌ ลบออก |
| Badge แสดงจำนวนธุรกิจ | ❌ ลบออก |
| Textarea แสดงผลวิเคราะห์ | ✅ แสดงแบบ read-only |
| Auto-generate | ✅ ทำงานเมื่อคลิก "วิเคราะห์ 4M อัตโนมัติ" |

---

## ระยะที่ 5C — แก้ไข 3 จุดสุดท้าย + Dashboard Filter (เสร็จแล้ว)

### บั๊กที่แก้ไข (commit `5bc8470`)

| บั๊ก | สาเหตุ | การแก้ไข |
| --- | --- | --- |
| ภาษาไทยเสียหาย | เขียนไฟล์ด้วย PowerShell ที่ไม่ใช่ UTF-8 | คืนไฟล์ `cpd-state.js` จาก commit `9368a84` แล้วเติม `fourMDetails` / `businessDetails` / `recalc4MRatios()` กลับ |
| ตัวกรองประเภทสหกรณ์ไม่ทำงาน | backend กรองด้วย `coopSubType` แต่ dropdown ใช้ `orgType` | เปลี่ยนตัวกรอง Dashboard เป็น `orgType` |
| ROE/ROA คลาดเคลื่อน | ใช้ส่วนของผู้ถือหุ้น/สินทรัพย์ปีเดียว | ใช้ค่าเฉลี่ย 2 ปี |

### เก็บตกตาม prompt (5) — commit `d141a0c`, `d389793`

| FIX | รายละเอียด |
| --- | --- |
| FIX 1 | ช่องที่ 2 `analysis.businessAnalysis` ใช้ข้อความวิเคราะห์ธุรกิจฉบับเต็มของสหกรณ์ผู้เลี้ยงไก่ไข่ชลบุรี (3 ธุรกิจ, 1,628 ตัวอักษร) และไม่เขียนทับข้อมูล preload ที่มีอยู่ |
| FIX 2 | Operating Expense Ratio เปลี่ยนไปใช้ `opEx / profitBeforeOpEx` (ไม่รวมต้นทุนขาย) ทำให้ไม่มีคำเตือนเท็จ `97.0% ของรายได้` ในตาราง 5.2 |
| FIX 3 | Dashboard กรองประเภทสหกรณ์จากทั้ง `orgType`, `coopSubType` และชื่อสหกรณ์ รองรับตัวเลือก "สหกรณ์" แบบกว้าง (ไม่รวมกลุ่มเกษตรกร) |

### ผลทดสอบ Production (GAS deployment @40, cache `v20260215a`)

| ตัวกรอง | KPI | Early Warning |
| --- | --- | --- |
| ทั้งหมด | 123 แห่ง | 12 รายการ |
| สหกรณ์ออมทรัพย์ | 49 แห่ง | 3 รายการ |
| สหกรณ์การเกษตร | 16 แห่ง | 7 รายการ |
| สหกรณ์ (รวมทุกประเภท) | 101 แห่ง | 12 รายการ |
| กลุ่มเกษตรกร | 22 แห่ง | 0 รายการ |

---

## ระยะที่ 5D — ตรวจสอบการเชื่อมโยงข้อมูลและแก้บั๊ก (เสร็จแล้ว)

### บั๊กที่แก้ไข (frontend เท่านั้น — ไม่ต้อง deploy GAS ใหม่)

| บั๊ก | สาเหตุ | การแก้ไข |
| --- | --- | --- |
| โหลดสหกรณ์ผิดแห่งจาก Dashboard | ปุ่มใช้ `data-index` ของตารางที่ถูกกรองแล้ว แต่ `loadCoopForEdit(index)` อ่านแถวจากข้อมูลดิบ | เพิ่ม `data-coop-id` / `data-coop-name` / `data-fiscal-year` และค้นแถวด้วยตัวตนก่อน ถ้าไม่พบจึงใช้ index เป็น fallback |
| ข้อมูลสหกรณ์เดิมรั่วข้ามสหกรณ์ | เลือกสหกรณ์ใหม่ที่ไม่มี preload/ร่างเดิม แล้วฟิลด์การเงินและแท็บ 2–4 ยังเป็นของเดิม | จำ `__cpdActiveCoopKey` และล้าง State + ฟอร์มหน้า 1 เมื่อคีย์เปลี่ยน แล้วเรียก `onSelectCoop` เดิมซ้ำเพื่อเติมข้อมูลระบุตัวตน/คะแนน/แผน 12 เดือน/ร่างของสหกรณ์ใหม่ |
| สูตรอัตราส่วนซ้ำสองที่ | `recalc4MRatios()` เขียน ROE/ROA ทับค่าไม่ปัดเศษ และเติม `opexToGrossProfitRatio` ด้วยสูตรเก่าเมื่อค่าเป็น 0 | ให้ `recalcFinancials()` เป็นเจ้าของอัตราส่วน CAD แต่เพียงผู้เดียว, `recalc4MRatios()` เติมเฉพาะเมื่อยังไม่มีค่าและปัดเศษ 4 ตำแหน่ง, ลบสูตร OPEX เก่า |
| ตัวเลข Toyota ไม่ตรงข้อความตรวจสอบ | `recalcFinancials()` คำนวณ `totalEquity` และอัตราส่วนใหม่ทับค่าที่ตรวจสอบแล้ว | เพิ่ม `restoreVerifiedFinancials(pre)` คืน `totalEquity` + ratios หลัง recalc ใน `applyPreloadCoop()` และ `populate4MFromBaseForm()` |
| `c69_tot` ว่างเมื่อโหลดจาก Dashboard | fallback ของ `loadCoopForEdit` ไม่ได้เติม `strength.totalByYear['2569']` | เติม `totalByYear['2568']` และ `['2569']` จาก `strengthScorePrev/Latest` |

### ผลทดสอบ (local + production)

- Toyota: `D/E 0.09, ROE 3.79%, ROA 3.67%, Current Ratio 4.18`, `totalEquity 402,525,936.88` ตรงกับข้อความตรวจสอบ
- ไก่ไข่ชลบุรี: ข้อความธุรกิจ 1,628 ตัวอักษร, 3 ธุรกิจ, ยอดรวม `62,186,062.47`, ไม่มีคำเตือน `97.0% ของรายได้`
- สลับสหกรณ์: ฟิลด์การเงิน/แท็บ 2–4 ถูกล้างเป็นของสหกรณ์ใหม่ ไม่มีข้อมูลเดิมค้าง
- Dashboard: ปุ่มโหลดแก้ไขเลือกสหกรณ์ตรงกับแถวที่เห็นแม้ตารางถูกกรอง
- Console errors: 0

cache-bust: `cpd-state.js` / `cpd-ui.js` = `v20261110a`

### แก้เพิ่ม: ผลเข้มแข็งปี 2569 หาย (frontend เท่านั้น)

| อาการ | สาเหตุ | การแก้ไข |
| --- | --- | --- |
| สหกรณ์ที่มี preload (ไก่ไข่ชลบุรี / Toyota) แสดง `c69_*` ว่างและคะแนนรวมปี 2569 เป็น 0 | preload มีผลประเมินเฉพาะปี 2568 และมีระดับชั้นปี 2569 แต่คะแนนเป็น 0 เมื่อ merge ทับ State จึงทำให้ปี 2569 หาย | เพิ่ม `applyStrength69Fallback(src)` เติมระดับ/คะแนนรวม/4 มิติปี 2569 จาก `score69` ของ master เมื่อปี 2569 ยังไม่มีคะแนนจริง และไม่ทับค่าที่ผู้ใช้แก้เอง |
| ตาราง Tab 2 คอลัมน์ปี 2569 เป็น 0 แม้คะแนนรวมถูกต้อง | `recalcStrength()` ใช้ flag `_autoDistributed` ร่วมทุกปี ทำให้ปี 2569 ไม่ถูกกระจายคะแนนลง 18 ตัวชี้วัด | เปลี่ยนเงื่อนไขเป็นรายปี: ต้องมี `_autoDistributed === true` และมีค่าจริงในปีนั้น จึงข้ามการกระจาย |
| โหลดจาก Dashboard แล้วตัวชี้วัดปี 2569 เป็น 0 | สาขา `else` ของ `loadCoopForEdit` เติมเฉพาะมิติ/คะแนนรวม ไม่ได้กระจายลงตัวชี้วัด | เรียก `S.recalcStrength()` หลังเติมมิติ และใช้ `score69` จาก master เป็นแหล่งหลัก |
| ร่างเดิม/preload ที่มีแต่ปี 2568 ยังแสดงปี 2569 ว่างหลังโหลดหน้า | `restoreLocalDraft()` คืน State เดิมที่ไม่มีคะแนนปี 2569 | เพิ่ม `applyMasterStrength69IfMissing()` เรียกหลังเลือก/กู้คืนสหกรณ์ เพื่อเติมจาก master เฉพาะเมื่อยังไม่มีข้อมูลจริง |

ผลทดสอบ (local):
- ไก่ไข่ชลบุรี: `c69_lv = ชั้น 1`, `c69_tot = 91.33`, มิติ `26 / 19.33 / 16 / 30`, ผลรวม 18 ตัวชี้วัด = 91.33
- Toyota: `c69_tot = 89`, มิติ `21 / 18 / 20 / 30`, ค่า verified `D/E 0.09, ROE 3.79, ROA 3.67, CR 4.18`, equity `402,525,936.88` ยังคงอยู่
- สลับ preload → ไม่มี preload → preload อีกครั้ง: ผลปี 2569 ยังถูกต้องและไม่นำข้อมูลการเงินของรายเดิมมาใช้
- โหลดจาก Dashboard (ทั้งกรณีพบและไม่พบบันทึกเดิม) และกู้คืนร่างเดิม: ผลปี 2569 แสดงครบ
- Console errors: 0

cache-bust: `cpd-state.js` / `cpd-ui.js` = `v20261110f`

### ระยะที่ 5E: ข้อสังเกตผู้สอบบัญชี / วิเคราะห์ธุรกิจ / สวัสดิการ จากไฟล์ที่อัปโหลด

| อาการ | สาเหตุ | การแก้ไข |
| --- | --- | --- |
| ข้อสังเกตผู้สอบบัญชีและข้อบกพร่องไม่แสดงหลังอัปโหลด | `analyzeUploadedFilesWithAI()` ไม่คืนฟิลด์ข้อสังเกต และ frontend map เฉพาะ `issue1..3` | GAS ส่ง `auditorObservations` / `auditorDefects` / หมวดจุดอ่อน / สถานะแก้ไข และ frontend เรียก `CPD_UI.applyUploadedAnalysisNotes(res)` ก่อน Pipeline |
| ข้อ 2 ด้านการบริหารจัดการธุรกิจไม่สะท้อนข้อมูลจากไฟล์ | ข้อความธุรกิจสร้างจาก `financials.businesses` ที่ยังว่าง และไม่นำข้อสังเกตธุรกิจมาแสดง | AI ส่ง `businessSegments` + `businessObservations`; frontend เติม `financials.businesses` และต่อท้ายข้อความข้อ 2 (ยกเว้นสหกรณ์ที่มีข้อความตรวจสอบแล้ว) |
| ข้อ 3 สวัสดิการ/สาธารณประโยชน์แสดงกิจกรรมที่ไม่มีข้อมูลจริง | ข้อความถูก hardcode ไว้ใน `analyze4M()` | เปลี่ยนเป็นข้อความจาก `analysis.welfareObservations` / `publicBenefitObservations` / `welfareFundAmount` / `publicBenefitFundAmount`; ถ้าไม่มีข้อมูลจะแจ้งว่าไม่พบและแนะนำให้ตรวจสอบรายงานผู้สอบบัญชี |
| State เก่าไม่มีฟิลด์ใหม่ | `defaultState()` ไม่มีฟิลด์วิเคราะห์จากไฟล์ | เพิ่มฟิลด์ optional ใน `analysis` พร้อมค่าเริ่มต้นว่าง (ไม่กระทบ State/LocalStorage/JSON เดิม) |

ผลทดสอบ (local):
- สหกรณ์ที่ไม่มี preload + mocked AI response: ข้อ 1 แสดงข้อสังเกตผู้สอบบัญชี, ข้อ 2 แสดงข้อสังเกตธุรกิจ/ตัวเลขจาก `businessSegments`, ข้อ 3 แสดงเฉพาะข้อมูลที่ส่งมา
- สหกรณ์ที่ไม่มีข้อมูลสวัสดิการ: ข้อ 3 ขึ้นข้อความ "ไม่พบข้อมูล..." และข้อเสนอแนะ ไม่สร้างกิจกรรมสมมติ
- ไก่ไข่ชลบุรี / Toyota: ข้อความ `orgAnalysis4M` และ `businessAnalysis` ที่ตรวจสอบแล้วยังคงเดิม
- Console errors: 0

cache-bust: `cpd-state.js` / `cpd-ui.js` = `v20261110g`

### ระยะที่ 5E (ต่อ): ให้ AI สกัดข้อวิเคราะห์แยกตาม 5 หัวข้อจากไฟล์ที่อัปโหลด

| หัวข้อ | ฟิลด์ที่ AI ส่งกลับ | ปลายทาง |
| --- | --- | --- |
| 1. ด้านการบริหารจัดการองค์กร (หลัก 4M) | `orgAnalysis4M` | `analysis.orgAnalysis4M` |
| 2. ด้านการบริหารจัดการธุรกิจ | `businessAnalysis` | `analysis.businessAnalysis` |
| 3. ด้านการจัดสวัสดิการและสาธารณประโยชน์ | `welfareAnalysis` | `analysis.welfareAnalysis` |
| 4. สรุปผลการวิเคราะห์ | `summaryAnalysis` | `analysis.summaryAnalysis` |
| ข้อสังเกตของผู้สอบบัญชี (ปีบัญชีล่าสุด) | `auditorObservations` | `analysis.auditorObservations` |

- GAS prompt/schema กำหนดให้เขียนเนื้อหาแต่ละหัวข้อจากเอกสารที่อัปโหลดเท่านั้น ห้ามแต่งเติม และให้ระบุ "ไม่พบข้อมูล" เมื่อไม่มีข้อมูล
- Frontend เก็บข้อความที่สกัดได้ใน `analysis.uploaded*` ผูกกับชื่อสหกรณ์ (`uploadedSectionsCoop`) แล้วให้ `analyze4M()` ใช้ข้อความนี้เป็นแหล่งหลัก โดยยังสร้างข้อความ rule-based เป็น fallback เมื่อ AI ไม่ส่งหัวข้อนั้นมา
- สหกรณ์ที่มีข้อความ preload ผ่านการตรวจสอบแล้ว (ไก่ไข่ชลบุรี/Toyota) ยังคงใช้ข้อความเดิม ไม่ถูกเขียนทับ
- cache-bust: `cpd-state.js` / `cpd-ui.js` = `v20261110h`

### ระยะที่ 5E (ปรับปรุงคุณภาพบทวิเคราะห์)

- GAS prompt กำหนดกรอบวิเคราะห์เดียวกันทั้ง 5 หัวข้อ: **ข้อเท็จจริงที่พบ → สาเหตุ/ผลกระทบ/ความเสี่ยง → ข้อเสนอแนะ**
- หัวข้อ 1 องค์กร: วิเคราะห์โครงสร้างคณะกรรมการ การประชุม ผู้ตรวจสอบกิจการ การควบคุมภายใน 5 องค์ประกอบ IT/บัญชี บุคลากร แผนงาน และสรุปจุดแข็ง/จุดอ่อน/ความเสี่ยง
- หัวข้อ 2 ธุรกิจ: วิเคราะห์รายธุรกิจทั้งรายได้ ต้นทุน กำไร อัตรากำไร ส่วนแบ่งรายได้ การมีส่วนร่วมของสมาชิก แนวโน้มปีก่อน และความเสี่ยง
- หัวข้อ 3 สวัสดิการ: วิเคราะห์ประเภทสวัสดิการ ผู้รับ วงเงิน ความเพียงพอ/ต่อเนื่อง การมีส่วนร่วม และกิจกรรมสาธารณประโยชน์
- หัวข้อ 4 สรุป: สรุปภาพรวม ตัวเลขสำคัญ จุดแข็ง จุดอ่อน/ความเสี่ยง และข้อเสนอแนะเร่งด่วนเรียงลำดับ สูง/กลาง/ต่ำ
- ข้อสังเกตผู้สอบบัญชี: วิเคราะห์แต่ละข้อเป็นประเด็นที่พบ → ผลกระทบ/ความเสี่ยง → สถานะการแก้ไข → ข้อเสนอแนะ
- กำหนด `maxOutputTokens: 8192` เพื่อรองรับบทวิเคราะห์ที่ยาวขึ้น
- GAS deployed `@43`; ไม่มีการเปลี่ยนแปลง frontend จึงยังใช้ `v20261110h`

### ระยะที่ 5E (ปรับโครงสร้างสรุปและเพิ่ม CAMELS)

- ปรับข้อ 19-21 ของ GAS prompt: หัวข้อ 1-3 **ไม่สรุปจุดแข็ง จุดอ่อน ความเสี่ยง และข้อเสนอแนะรวบยอด** ในหัวข้อนั้น ให้ยกไปสรุปในข้อ 22
- ปรับข้อ 22: สรุปผลการวิเคราะห์แยกเป็น 3 ด้าน (องค์กร / ธุรกิจ / สวัสดิการ) โดยแต่ละด้านมี (1) จุดแข็ง (2) จุดอ่อนและความเสี่ยง (3) ข้อเสนอแนะเร่งด่วน เรียงลำดับ สูง/กลาง/ต่ำ แล้วปิดท้ายด้วยภาพรวมผลการดำเนินงานและความเชื่อมโยงกับแผนปีถัดไป
- เพิ่มกรอบ CAMELS ในหัวข้อ 1 ด้านการเงิน (Money): C ความเพียงพอของทุน, A คุณภาพสินทรัพย์, M การบริหารจัดการทางการเงิน, E ความสามารถในการทำกำไร, L สภาพคล่อง, S ความอ่อนไหวต่อความเสี่ยงตลาด พร้อมระบุ "ไม่พบข้อมูล" เมื่อข้อมูลไม่พอ
- Frontend `analyze4M()`: เพิ่มบล็อกวิเคราะห์ CAMELS ในหัวข้อการเงินของข้อ 1, ลบข้อความสรุปจุดอ่อน/ข้อเสนอแนะออกจากข้อ 1-3, และสร้างข้อ 4 ใหม่เป็น 3 ด้านตามโครงสร้างเดียวกัน
- สหกรณ์ที่มีข้อความ preload ตรวจสอบแล้ว: ใช้ข้อความเดิมทุกบรรทัด และ **แทรกบล็อก CAMELS** ในหัวข้อการเงิน (Money) โดยไม่แก้ไขข้อความเดิม
- cache-bust: `cpd-ui.js` = `v20261110i`


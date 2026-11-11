# ระบบจัดทำแผนส่งเสริมสหกรณ์ 2570 — 5 แท็บ + GitHub Pages + Apps Script

เว็บ SPA บน **GitHub Pages** เรียก API ของ **Apps Script Web App** ซึ่งอ่าน/เขียน **Google Sheets**
และเก็บไฟล์บน **Google Drive** โดยคงฟอร์มเดิมเป็นแท็บที่ 1 และเพิ่มแผนฉบับเต็ม ติดตามรายเดือน
รายงานปิดบัญชี และ Dashboard จังหวัด โดยใช้ `window.CPD_AppState` เป็นข้อมูลกลางชุดเดียว

```
ผู้ใช้ → GitHub Pages (web/) → fetch POST text/plain → Apps Script /exec (gas/)
                                                        ├─ Google Sheets (ข้อมูล, ร่างแผน)
                                                        └─ Google Drive (ไฟล์แนบ, ไฟล์ Word)
```

## โครงสร้าง repo

```
.
├─ web/                         # frontend (GitHub Pages)
│  ├─ index.html                # ฟอร์มเดิม Tab 1 + shell เมนู 5 แท็บ
│  ├─ config.js                 # API_URL / API_TOKEN
│  ├─ css/cpd.css               # สไตล์ SPA, Dashboard และ Print
│  └─ js/
│     ├─ google-script-shim.js  # แปลง google.script.run เป็น fetch
│     ├─ cpd-state.js           # state กลาง, sync, คำนวณการเงิน/คะแนน/วันครบกำหนด
│     └─ cpd-ui.js              # Tab 2–5, บันทึก/โหลด, Dashboard, ส่งออก
├─ gas/                         # Apps Script (clasp root)
│  ├─ Code.gs                   # โค้ดธุรกิจเดิม: master list, AI, ร่าง, Word
│  ├─ CPD_Database.gs           # บันทึก/โหลด state และ Dashboard ทั้ง 5 แท็บ
│  ├─ Api.gs                    # doPost + RPC router + allowlist
│  ├─ config.gs                 # อ่านค่าจาก Script Properties
│  ├─ Setup.gs                  # ตัวช่วยตั้งค่า/ตรวจสอบ (ไม่ถูกเรียกจากเว็บ)
│  ├─ รหัส.gs                    # placeholder ทับไฟล์เดิมที่ชื่อ "รหัส" (ห้ามใส่โค้ด)
│  ├─ lib/SheetUtil.gs          # helper อ่าน/เขียน Sheets แบบอิงชื่อคอลัมน์
│  ├─ lib/DriveUtil.gs          # helper สร้างโฟลเดอร์/เก็บไฟล์ Drive
│  ├─ appsscript.json
│  └─ .clasp.json               # สร้างจาก .clasp.json.example
├─ tools/
│  └─ serve-web.ps1             # static server ในเครื่อง (Windows, ไม่ต้องใช้ Node)
├─ .github/workflows/
│  ├─ pages.yml                 # deploy web/ → GitHub Pages
│  └─ gas-deploy.yml            # clasp push/deploy → Apps Script
└─ docs/
   ├─ architecture.md
   ├─ migration.md
   ├─ api.md
   └─ data-model.md
```

## หน้าจอ 5 แท็บ

1. **ฟอร์มพื้นฐาน** — โค้ดและ element `id` เดิม, ค้นหาสหกรณ์, แนบไฟล์, AI, ร่างและ Word
2. **แผนฉบับเต็ม** — Profile, งบการเงิน/อัตราส่วน, 4 มิติ 18 ตัวชี้วัด, 4M, แผน 30/150 วัน
3. **ติดตามรายเดือน** — สถานะ 12 เดือน 4 สี, ปริมาณธุรกิจ 6 ประเภท และบันทึกลงพื้นที่
4. **รายงานปิดบัญชี** — ผลปิดบัญชี/ประชุมใหญ่, ผลสำเร็จ 2.1–2.5, อุปสรรคและข้อเสนอแนะ
5. **Dashboard จังหวัด** — ตัวกรอง, 6 KPI, กราฟเขต/ชั้นความเข้มแข็ง, ทะเบียน 123 แห่ง และ CSV/Excel

การบันทึกจากแท็บ 2–4 เขียน `CPD_AppState` ทั้งก้อนลง `full_state_json` และสรุปข้อมูลลงชีต
`CPD_Plans_2570`, `CPD_Monthly_Tracking`, `CPD_Closing_Success` โดยอัตโนมัติ

## สถานะปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| Apps Script API (`/exec`) | ✅ deployment เดิม `@37` — legacy + CPD 5 แท็บ ผ่าน E2E |
| ชีต CPD 3 ชีต | ✅ สร้างและทดสอบ save/load/dashboard/filter แล้ว ล้างข้อมูลทดสอบแล้ว |
| Frontend 5 แท็บ | ✅ ทดสอบ local ผ่าน — 🟡 รอ commit/push เพื่อเผยแพร่ |
| Script Properties | ✅ `GEMINI_API_KEY`, `DRIVE_ROOT_FOLDER_ID`, `API_TOKEN`, `DEBUG` (ฝั่งเซิร์ฟเวอร์เท่านั้น) |
| `web/config.js` | ✅ ใส่ `API_URL` + `API_TOKEN` จริงแล้ว |
| GitHub repo | ✅ <https://github.com/supakritkhawthong-lab/cps-promotion-plan-2570> (public) |
| GitHub Pages | ✅ <https://supakritkhawthong-lab.github.io/cps-promotion-plan-2570/> (รอ UI 5 แท็บรอบใหม่) |
| GitHub Actions (gas-deploy) | 🟡 มี workflow แล้ว — ยังต้องใส่ `CLASPRC_JSON` + `GAS_DEPLOYMENT_ID` ถ้าจะให้ deploy GAS อัตโนมัติ |

> ผลทดสอบ Phase 1 อยู่ใน `docs/migration.md` หัวข้อ 1.9 และผล SPA 5 แท็บอยู่ในหัวข้อ 2A

## เริ่มใช้งาน (สรุป)

> ติดตั้งครั้งแรกให้ทำตามขั้นตอนด้านล่าง สำหรับการพัฒนาต่อให้แก้ `web/` หรือ `gas/`
> แล้วทดสอบ local ก่อน `clasp push` และ deploy GitHub Pages ตามลำดับ

1. **ดึงโค้ดเดิมจาก Apps Script** (ถ้ายังไม่ได้ดึง — ข้ามได้ถ้าใช้ไฟล์ใน repo นี้)
   ```bash
   npm i -g @google/clasp
   clasp login
   mkdir _pull && cd _pull && clasp clone <SCRIPT_ID>
   ```
2. คัดลอกไฟล์ที่ได้ (ถ้าเพิ่ง clone):
   - `Code.gs` → `gas/Code.gs`
   - `Index.html` → `web/index.html`
   - เอา `scriptId` จาก `.clasp.json` ไปใส่ `gas/.clasp.json` (ดูตัวอย่าง `.clasp.json.example`)
3. **แก้ `gas/Code.gs` 2 จุด** ให้ใช้ `getSS_()` แทน `SpreadsheetApp.getActiveSpreadsheet()`
   (รายละเอียดใน `docs/migration.md`)
4. **ตั้งค่า Script Properties** (Apps Script → Project Settings → Script Properties)

   | Key | จำเป็น | ตัวอย่าง | หมายเหตุ |
   |---|---|---|---|
   | `SPREADSHEET_ID` | แนะนำ | `1AbC...` | ถ้าเว้นว่างจะใช้ bound spreadsheet |
   | `GEMINI_API_KEY` | ใช่ | `AIza...` หรือ `AQ...` | ย้ายออกจากโค้ด |
   | `GEMINI_MODELS` | ไม่ | `gemini-3.5-flash,gemini-3.8-flash` | ลำดับรุ่นที่ลองก่อน–หลัง (ค่าเริ่มต้นในโค้ดใช้ได้) |
   | `GEMINI_MAX_OUTPUT_TOKENS` | ไม่ | `8192` | เพดาน token ของคำตอบ AI ต่อรอบ (ค่าเริ่มต้น 8192) |
   | `AI_DEADLINE_MS` | ไม่ | `300000` | เวลารวมสูงสุดของการเรียก AI ต่อคำขอ (มิลลิวินาที) ก่อนคืนผลบางส่วน |
   | `DRIVE_ROOT_FOLDER_ID` | ถ้าใช้ Drive | `1XyZ...` | โฟลเดอร์แม่ของไฟล์ทั้งหมด (บัญชีที่ deploy ต้องมีสิทธิ์ Editor) |
   | `API_TOKEN` | แนะนำ | สุ่มยาว ๆ | ถ้าไม่ตั้ง = เปิดให้ใครก็เรียกได้ |
   | `DEBUG` | ไม่ | `1` | ให้ส่ง stack trace กลับมา |

5. **Deploy Apps Script**
   ```bash
   cd gas
   clasp push -f
   clasp deploy -d "pages-v1"
   # ครั้งถัดไปอัปเดต deployment เดิมเพื่อให้ URL คงที่
   clasp deploy -i <DEPLOYMENT_ID> -d "pages-v1"
   ```
   ตั้ง Web App เป็น **Execute as: Me** / **Who has access: Anyone**
   แล้วคัดลอก URL `/exec` ไปใส่ `web/config.js` (โปรเจกต์นี้ตั้งไว้แล้ว)

6. **ตรวจ `web/index.html`** — repo นี้โหลด `config.js` + shim ก่อนโค้ดเดิม
   และโหลด `js/cpd-state.js` + `js/cpd-ui.js` หลังโค้ดเดิมแล้ว (ห้ามสลับลำดับ)
   ```html
   <script src="config.js"></script>
   <script src="js/google-script-shim.js"></script>
   <!-- โค้ดเดิม ... -->
   <script src="js/cpd-state.js"></script>
   <script src="js/cpd-ui.js"></script>
   ```

7. **เปิด GitHub Pages**: Settings → Pages → Source = **GitHub Actions**
   แล้ว push ขึ้น `main`

8. **ตั้ง CI สำหรับ Apps Script** (ถ้าต้องการ deploy อัตโนมัติ)
   - Secret `CLASPRC_JSON` = เนื้อหาไฟล์ `~/.clasprc.json`
   - Variable `GAS_DEPLOYMENT_ID` = id จาก `clasp deployments`
   - ใช้ tag `gas-v1.0.0` เพื่อ trigger deploy

## ทดสอบหน้าเว็บบนเครื่องก่อน deploy

เปิด `web/index.html` ด้วย `file://` ไม่ได้ (หน้าเว็บโหลด `config.js` และเรียก API) ให้เสิร์ฟผ่าน HTTP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve-web.ps1
# เปิด http://127.0.0.1:8787/index.html
```

ทางเลือกอื่น: `python -m http.server 8787 --directory web` หรือ VS Code Live Server

ถ้ายังไม่ deploy Apps Script หน้าเว็บจะขึ้น console error
`ยังไม่ได้ตั้งค่า APP_CONFIG.API_URL` เป็นอาการปกติ — ต้อง deploy ก่อนตามข้อ 5

## ความปลอดภัย (อ่านก่อนใช้งานจริง)

- GitHub Pages เป็น public — **ห้ามใส่ secret จริงใน `web/`** ค่า `API_TOKEN` ใน `config.js` มองเห็นได้ทั้งหมด
  ใช้เพื่อกันสแกนเนอร์เท่านั้น ไม่ใช่การยืนยันตัวตน
- ถ้าต้องการยืนยันตัวตนจริง ให้ใช้ **Google Sign-In (ID token)** แล้วตรวจสอบฝั่ง `doPost`
  (ดูหัวข้อ "ระยะที่ 3" ใน `docs/migration.md`)
- อย่าตั้ง Web App เป็น "Anyone with Google account" แล้วเรียกด้วย `fetch` ข้ามโดเมน
  เพราะจะโดน redirect ไปหน้า login และ CORS จะพัง — ใช้ `Anyone` (anonymous) + auth layer ของเราเอง
- จำกัดฟังก์ชันที่เรียกได้ด้วย `RPC_ALLOWLIST` ใน `gas/Api.gs` เท่านั้น

## เอกสาร

- `docs/architecture.md` — ภาพรวมและหน้าที่ของแต่ละส่วน
- `docs/migration.md` — ขั้นตอนย้ายโค้ดเดิมและแผนพัฒนาเป็นระยะ
- `docs/api.md` — สัญญา API / วิธีเพิ่ม endpoint
- `docs/data-model.md` — โครงสร้างชีตปัจจุบัน + ข้อเสนอ schema v2 + โฟลเดอร์ Drive

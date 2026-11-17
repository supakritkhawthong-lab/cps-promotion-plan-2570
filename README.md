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
│  ├─ AiJob.gs                  # แบ่งงานวิเคราะห์เป็นระยะ (facts → 1-3 → 4) เก็บสถานะใน CacheService
│  ├─ config.gs                 # อ่านค่าจาก Script Properties
│  ├─ Setup.gs                  # ตัวช่วยตั้งค่า/ตรวจสอบ (ไม่ถูกเรียกจากเว็บ)
│  ├─ รหัส.gs                    # placeholder ทับไฟล์เดิมที่ชื่อ "รหัส" (ห้ามใส่โค้ด)
│  ├─ lib/SheetUtil.gs          # helper อ่าน/เขียน Sheets แบบอิงชื่อคอลัมน์
│  ├─ lib/DriveUtil.gs          # helper สร้างโฟลเดอร์/เก็บไฟล์ Drive
│  ├─ appsscript.json
│  └─ .clasp.json               # สร้างจาก .clasp.json.example
├─ tools/
│  ├─ serve-web.ps1             # static server ในเครื่อง (Windows, ไม่ต้องใช้ Node)
│  └─ check-gs.js               # ตรวจ syntax gas/**/*.gs ด้วย node --check
├─ tests/                       # ชุดทดสอบที่โหลดไฟล์จริงของโปรเจกต์ (node:test)
│  ├─ helpers/sandbox.js        # ตัวโหลด GAS (new Function) และ web/js (vm)
│  ├─ ai-json.test.js           # ตัวอ่าน/ซ่อม JSON ของ AI
│  ├─ ai-staged.test.js         # การแบ่งคำขอ AI 3 ระยะ + responseSchema
│  ├─ state.test.js             # ปีงบประมาณ/กำหนดเวลา/วันรับรองงบ
│  ├─ preload.test.js           # ข้อมูล preload ตรวจสอบแล้วต้องไม่ถูกทับ
│  ├─ uploaded-analysis.test.js # ตัดชื่อหัวข้อซ้ำ/ไม่ทับข้อความ preload
│  ├─ summary.test.js           # บทสรุปผู้บริหาร + แผนดำเนินการ 3 ระยะ
│  └─ contract.test.js          # สัญญาระหว่าง index.html / Api.gs / gas
├─ .github/workflows/
│  ├─ pages.yml                 # deploy web/ → GitHub Pages
│  ├─ gas-deploy.yml            # clasp push/deploy → Apps Script
│  └─ ci.yml                    # ตรวจ syntax + รันชุดทดสอบบน push/PR
└─ docs/
   ├─ architecture.md
   ├─ migration.md
   ├─ upload-data-flow.md
   ├─ upload-quality-upgrade.md
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
| ชุดทดสอบ + CI | ✅ `node:test` 62 เคส ผ่านทั้งหมด, `check-gs` ผ่าน 8/8 ไฟล์, workflow `ci.yml` รันบน push/PR |

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
   | `GEMINI_MODELS` | ไม่ | `gemini-3.8-flash,gemini-3.5-flash,gemini-2.5-flash,gemini-4-hydrogen` | ลำดับรุ่นที่ลองก่อน–หลัง (ค่าเริ่มต้นในโค้ดใช้ได้) |
   | `GEMINI_MAX_OUTPUT_TOKENS` | ไม่ | `8192` | เพดานกลางของ token คำตอบ AI ต่อรอบ (ค่าเริ่มต้น 8192) |
   | `AI_THINKING_BUDGET` | ไม่ | `0` | งบ thinking ของโมเดล (0 = ปิด, ค่าเริ่มต้น; `-1` = ไม่ส่งค่า ให้โมเดลใช้ค่าเอง) ปิดแล้วลดเวลาต่อการเรียกได้มาก |
   | `AI_MAX_TOKENS_FACTS` | ไม่ | `8192` | เพดาน token ของระยะสกัดตัวเลข (ไม่เกิน `GEMINI_MAX_OUTPUT_TOKENS`) |
   | `AI_MAX_TOKENS_NARRATIVE` | ไม่ | `8192` | เพดาน token ของระยะบทวิเคราะห์หัวข้อ 1-3 |
   | `AI_MAX_TOKENS_SUMMARY` | ไม่ | `4096` | เพดาน token ของระยะบทวิเคราะห์หัวข้อ 4 |
   | `AI_MAX_TOKENS_REPAIR` | ไม่ | `3072` | เพดาน token ของรอบอ่านซ้ำเฉพาะฟิลด์ที่ขาด |
   | `AI_MIN_CALL_MS` | ไม่ | `15000` | ถ้าเวลาที่เหลือน้อยกว่านี้ ระบบจะไม่เริ่มเรียกโมเดลใหม่ (กันการเรียกที่ไม่มีเวลาให้จบ) |
   | `AI_DEADLINE_MS` | ไม่ | `300000` | เวลารวมสูงสุดของการเรียก AI ต่อคำขอ (มิลลิวินาที) ก่อนคืนผลบางส่วน |
   | `AI_HARD_LIMIT_MS` | ไม่ | `330000` | เพดานกันชน 6 นาทีของ Apps Script — ถ้าเวลาที่เหลือไม่พอ ระบบจะข้ามบทวิเคราะห์และคืนผลระยะ facts พร้อมคำเตือน |
   | `AI_ESTIMATE_NARRATIVE_FACTOR` | ไม่ | `1.8` | ตัวคูณประมาณเวลาบทวิเคราะห์หัวข้อ 1-3 จากเวลาจริงของระยะ facts |
   | `AI_ESTIMATE_SUMMARY_FACTOR` | ไม่ | `0.8` | ตัวคูณประมาณเวลาบทวิเคราะห์หัวข้อ 4 จากเวลาจริงของหัวข้อ 1-3 |
   | `DRIVE_ROOT_FOLDER_ID` | ถ้าใช้ Drive | `1XyZ...` | โฟลเดอร์แม่ของไฟล์ทั้งหมด (บัญชีที่ deploy ต้องมีสิทธิ์ Editor) |
   | `API_TOKEN` | แนะนำ | สุ่มยาว ๆ | ถ้าไม่ตั้ง = เปิดให้ใครก็เรียกได้ |
   | `DEBUG` | ไม่ | `1` | ให้ส่ง stack trace กลับมา |

   **การประมวลผล AI แบบหลายระยะ (job)** — หน้าเว็บเรียก `startAiAnalysisJob(payload)` แล้ววน `stepAiAnalysisJob(jobId)`
   ทีละระยะ (facts → หัวข้อ 1-3 → หัวข้อ 4) แต่ละระยะได้เพดาน 6 นาทีของตัวเอง จึงไม่ทำให้หัวข้อ 4 หาย
   สถานะงานเก็บใน `CacheService` (แบ่งก้อนละ 25,000 ตัวอักษร, อายุ 6 ชั่วโมง) และไม่เก็บไฟล์ base64 ไว้หลังระยะแรก
   ก่อนเริ่มแต่ละระยะ ระบบบันทึก "จำนวนครั้งที่ลอง" ลงสถานะก่อน (write-ahead) ถ้า execution ถูกฆ่าที่เพดาน 6 นาที
   ครั้งถัดไปจะเห็นว่าลองแล้ว และเมื่อครบ 2 ครั้งจะข้ามระยะนั้นพร้อมคำเตือนเพื่อไปทำหัวข้ออื่นต่อ
   (snapshot ที่คืนให้หน้าเว็บมี `attempts` และ `trace` ของแต่ละระยะ จึงตรวจได้โดยไม่ต้องเปิด Executions)
   ถ้าระยะไหนจบด้วย `finishReason=MAX_TOKENS` ระบบจะลองซ้ำหนึ่งครั้งโดยไม่ส่ง `thinkingConfig` และใช้เพดาน token เต็ม
   (`GEMINI_MAX_OUTPUT_TOKENS`) หากยังถูกตัดจะคืนผลบางส่วนพร้อมคำเตือนใน `_aiWarnings` และ `trace` จะมี `tokens`
   (`promptTokens`/`outputTokens`/`thoughtTokens`) ไว้ตรวจว่าคำตอบถูกตัดเพราะ thinking หรือไม่
   `responseSchema` ของระยะ facts ระบุ `required` เป็นฟิลด์วิกฤต 18 ฟิลด์ และมี `description` ของฟิลด์ที่ชื่อคล้ายกัน
   (เช่น `assetLatest` กับ `wcLatest`) เพราะถ้าไม่บังคับ โมเดลจะตอบเพียงไม่กี่ฟิลด์และอาจใส่ยอดสินทรัพย์ลงช่องอื่น
   ฟิลด์วิกฤตที่ไม่พบข้อมูลจะได้ค่า `"-"` ไม่ใช่หายไปทั้ง key
   ฟังก์ชันเดิม `analyzeUploadedFilesWithAI(payload)` ยังใช้ได้สำหรับเรียกครั้งเดียวแบบเดิม

   **PDF สแกน (ไม่มี text layer)** — PDF.js อ่านข้อความไม่ได้ ระบบจึงส่งหน้าเป็นภาพให้ AI อ่านแทน
   หน้าเว็บแบ่งไฟล์เป็นชุด ๆ ละ `SCAN_CHUNK_PAGES` (12) หน้า และคุม base64 รวมทุกชุดไม่เกิน
   `SCAN_MAX_BASE64_CHARS` (18 MB) ชุดที่ยังใหญ่เกินจะถูกแบ่งครึ่งจนกว่าจะพอดี
   ส่งมาในฟิลด์ `scanChunks` (`base64`, `pagesFrom`, `pagesTo`) แทน `base64` ก้อนเดียว
   ฝั่ง GAS อ่านทีละชุดด้วย `runScanChunks_` (ระยะ facts ได้เวลา 240 วินาทีเมื่อมีไฟล์สแกน)
   โดยใช้ `buildScanFactSchema_` ซึ่งเพิ่ม `scanDigest` = สรุปเนื้อหาที่อ่านจากภาพ
   แล้วรวมผลทุกชุดด้วย `mergeFactResults_` (ค่าจากไฟล์ที่มีข้อความชนะเสมอ ภาพใช้เติมเฉพาะช่องที่ยังว่าง)
   `scanDigest` ถูกส่งต่อเข้า `state.input.files` ของ job เพื่อให้ระยะ 2-3 เขียนบทวิเคราะห์จากเนื้อหาภาพได้
   การ์ด "ความครบถ้วนของการอ่านไฟล์" จะขึ้นป้าย `reader 2026-11-17d` พร้อม
   🖼 "AI อ่านจากภาพ N/N หน้า" เมื่อเข้าเส้นทางนี้ และขึ้น ⚠ เมื่ออ่านไม่สำเร็จหรือไฟล์ใหญ่เกินขนาดที่ส่งได้
   (coverage ใช้ `scanPdf: true` และ `stopReason: 'scan'` หรือ `'scanLimit'`)

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

## ทดสอบอัตโนมัติ (ไม่ต้องติดตั้ง dependency)

```bash
npm run check:gs   # ตรวจ syntax gas/**/*.gs ทุกไฟล์
npm test           # รันชุดทดสอบทั้งหมด (node --test tests/)
npm run verify     # ทำทั้งสองอย่างตามลำดับ — ใช้ก่อน commit
```

ชุดทดสอบโหลด **ไฟล์จริง** ของโปรเจกต์ (`gas/Code.gs` ผ่าน `new Function`, `web/js/*.js` ผ่าน `vm`)
จึงไม่มีสำเนาโค้ดให้เพี้ยนตามกัน และไม่ต้องใช้ของปลอมแทนระบบจริง

> Windows: ถ้า redirect ผลลัพธ์ลงไฟล์ด้วย PowerShell (`node --test tests/ > out.txt`)
> ไฟล์จะถูกเขียนเป็น UTF-16LE — อ่านด้วย `-Encoding Unicode` หรือปล่อยให้พิมพ์บนหน้าจอโดยตรง

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
- `docs/upload-data-flow.md` — แผนผังเส้นทางข้อมูลหลังอัปโหลด + ฟิลด์จาก AI ไปยังหน้าจอ/State
- `docs/upload-quality-upgrade.md` — แผนอัพเกรดคุณภาพข้อมูลอัปโหลด (extraction → contract → validation → safe apply)
- `docs/api.md` — สัญญา API / วิธีเพิ่ม endpoint
- `docs/data-model.md` — โครงสร้างชีตปัจจุบัน + ข้อเสนอ schema v2 + โฟลเดอร์ Drive

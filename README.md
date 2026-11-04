# ระบบจัดทำแผนส่งเสริมสหกรณ์ 2570 — GitHub Pages + Apps Script + Sheets + Drive

เว็บ static บน **GitHub Pages** เรียก API ของ **Apps Script Web App** ซึ่งอ่าน/เขียน **Google Sheets**
และเก็บไฟล์บน **Google Drive** โดยใช้โค้ด Apps Script เดิมเป็นแกนหลัก

```
ผู้ใช้ → GitHub Pages (web/) → fetch POST text/plain → Apps Script /exec (gas/)
                                                        ├─ Google Sheets (ข้อมูล, ร่างแผน)
                                                        └─ Google Drive (ไฟล์แนบ, ไฟล์ Word)
```

## โครงสร้าง repo

```
.
├─ web/                         # frontend (GitHub Pages)
│  ├─ index.html                # UI เดิม (ย้ายมาจาก Index.html ของ Apps Script)
│  ├─ config.js                 # API_URL / API_TOKEN
│  └─ js/google-script-shim.js  # ทำให้ google.script.run เดิมทำงานบน Pages ได้
├─ gas/                         # Apps Script (clasp root)
│  ├─ Code.gs                   # โค้ดธุรกิจเดิม (แก้ 2 จุดตาม docs/migration.md แล้ว)
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

## สถานะปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| Apps Script API (`/exec`) | ✅ deploy แล้ว (deployment `pages-v1`) และทดสอบกับชีต/Drive/Gemini จริงผ่าน |
| Script Properties | ✅ `GEMINI_API_KEY`, `DRIVE_ROOT_FOLDER_ID`, `API_TOKEN`, `DEBUG` (ฝั่งเซิร์ฟเวอร์เท่านั้น) |
| `web/config.js` | ✅ ใส่ `API_URL` + `API_TOKEN` จริงแล้ว |
| GitHub Pages | ⛔ ยังไม่ได้ push ขึ้น GitHub (repo นี้ยังไม่เป็น git repo) |
| GitHub Actions (gas-deploy) | ⛔ รอ `CLASPRC_JSON` + `GAS_DEPLOYMENT_ID` เมื่อ push repo แล้ว |

> ผลทดสอบจริงโดยละเอียดอยู่ใน `docs/migration.md` หัวข้อ 1.9

## เริ่มใช้งาน (สรุป)

> สถานะ: `gas/Code.gs` และ `web/index.html` ถูกวางเข้า repo แล้ว และแก้ตามข้อ 3 เรียบร้อย
> เหลือขั้นที่ต้องใช้บัญชี GitHub จริง (ข้อ 7, 8) — ดูตารางสถานะใน `docs/migration.md`

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

6. **ตรวจ `web/index.html`** — repo นี้แทรก 2 บรรทัดนี้ไว้ก่อน `<script>` ก้อนใหญ่ท้ายไฟล์แล้ว
   ```html
   <script src="config.js"></script>
   <script src="js/google-script-shim.js"></script>
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

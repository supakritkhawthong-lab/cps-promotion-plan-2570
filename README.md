# ระบบติดตามการส่งเสริมสหกรณ์ จังหวัดชลบุรี 2570 — 3 แท็บ + GitHub Pages + Apps Script

เว็บ SPA บน **GitHub Pages** เรียก API ของ **Apps Script Web App** เพื่ออ่านข้อมูลจาก **Google Sheets**
และแสดงผลใน 3 หน้า: **Dashboard จังหวัด**, **ทะเบียนคุมเอกสาร/รายงาน**, **ความเข้มแข็งสหกรณ์/กลุ่มเกษตรกร**

แอปเป็น **read-only** — ไม่มีฟอร์มกรอกแผน, ไม่มีอัปโหลดไฟล์, ไม่มี AI และไม่เขียน Google Drive
`window.CPD_AppState` คงไว้เฉพาะส่วนที่ Dashboard ใช้เป็นข้อมูลสำรอง (fallback) และคำนวณคะแนนความเข้มแข็ง

```
ผู้ใช้ → GitHub Pages (web/) → fetch POST text/plain → Apps Script /exec (gas/)
                                                         └─ Google Sheets (master/KPI/score)
```

## โครงสร้าง repo

```
.
├─ web/                         # frontend (GitHub Pages)
│  ├─ index.html                # shell 3 แท็บ: dashboard / registry / strength
│  ├─ config.js                 # API_URL / API_TOKEN
│  ├─ css/cpd.css               # สไตล์ SPA, ตาราง, การ์ด, Print
│  └─ js/
│     ├─ google-script-shim.js  # แปลง google.script.run เป็น fetch
│     ├─ cpd-state.js           # state shape, วันครบกำหนด, recalcStrength
│     ├─ cpd-ui.js              # 3 หน้า + early-warning + export
│     ├─ cpd-report-registry.js # ข้อมูลทะเบียนเอกสาร/รายงาน 43 รายการ
│     └─ cpd-mis-reports.js     # ข้อมูลรายงาน MIS
├─ gas/                         # Apps Script (clasp root)
│  ├─ Code.gs                   # getMasterCoopList + กฎจัดชั้นความเข้มแข็ง
│  ├─ GroupStrength69.gs        # คะแนนสำรองกลุ่มเกษตรกร ปี 2569
│  ├─ CPD_Database.gs           # getDashboardSummaryData + clearPlanAiData_()
│  ├─ Api.gs                    # doPost + RPC router + allowlist
│  ├─ config.gs                 # อ่านค่าจาก Script Properties
│  ├─ Setup.gs                  # ตัวช่วยตั้งค่า/ตรวจสอบ (ไม่ถูกเรียกจากเว็บ)
│  ├─ รหัส.gs                    # placeholder ทับไฟล์เดิม (ห้ามใส่โค้ด)
│  ├─ appsscript.json
│  └─ .clasp.json               # สร้างจาก .clasp.json.example
├─ tools/
│  ├─ serve-web.ps1             # static server ในเครื่อง (Windows)
│  └─ check-gs.js               # ตรวจ syntax gas/**/*.gs ด้วย node --check
├─ tests/                       # ชุดทดสอบ node:test ที่โหลดไฟล์จริง
│  ├─ helpers/sandbox.js
│  ├─ state.test.js             # ปีงบประมาณ/กำหนดเวลา/วันรับรองงบ
│  ├─ group-strength.test.js    # คะแนนและการจัดชั้น
│  ├─ contract.test.js          # สัญญา index.html / Api.gs / gas
│  └─ security.test.js          # redaction + allowlist
├─ .github/workflows/
│  ├─ pages.yml                 # deploy web/ → GitHub Pages
│  ├─ gas-deploy.yml            # clasp push/deploy → Apps Script
│  └─ ci.yml                    # ตรวจ syntax + รันชุดทดสอบบน push/PR
└─ docs/
   ├─ architecture.md           # สถาปัตยกรรมปัจจุบัน
   ├─ api.md                    # สัญญา API
   ├─ data-model.md             # โครงสร้างชีตที่ยังใช้
   └─ (historical) migration.md, upload-data-flow.md, upload-quality-upgrade.md
```

## 3 แท็บ

| แท็บ | เนื้อหา | แหล่งข้อมูล |
|---|---|---|
| `dashboard` | ตัวกรอง, 6 KPI, กราฟเขต/ชั้นความเข้มแข็ง, ทะเบียนสหกรณ์, CSV/Excel | `getDashboardSummaryData()` + `getMasterCoopList()` |
| `registry` | ทะเบียนคุมเอกสาร/รายงาน 43 รายการ + รายงาน MIS | `web/js/cpd-report-registry.js`, `web/js/cpd-mis-reports.js` |
| `strength` | ความเข้มแข็ง 4 มิติ 18 ตัวชี้วัด แยกปี 2567–2569 | `getMasterCoopList()` + `gas/GroupStrength69.gs` |

Dashboard ถ้า RPC ล้มเหลวจะใช้ `masterCoops` + state ในเครื่องเป็นข้อมูลสำรองพร้อม badge แจ้งเตือน

## สถานะปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| Frontend 3 แท็บ | ✅ โค้ดใน repo ผ่าน `node --check` และ contract test |
| Apps Script `/exec` | ✅ ใช้ deployment เดิมได้ (allowlist เหลือ 2 ฟังก์ชันอ่านข้อมูล) |
| ชุดทดสอบ | ✅ `npm run verify` — 32 เคสผ่าน, `check-gs` ผ่านทุกไฟล์ |
| Script Properties | ใช้เฉพาะ `SPREADSHEET_ID`, `API_TOKEN`, `DEBUG` |
| GitHub repo | <https://github.com/supakritkhawthong-lab/cps-promotion-plan-2570> |
| GitHub Pages | <https://supakritkhawthong-lab.github.io/cps-promotion-plan-2570/> |
| การล้างข้อมูลแผน/AI ใน Sheets | 🟡 มี `clearPlanAiData_()` ใน `gas/CPD_Database.gs` — ต้องรันจาก Apps Script editor เอง (รันครั้งเดียว) |

> เอกสาร `docs/migration.md`, `docs/upload-data-flow.md`, `docs/upload-quality-upgrade.md`
> เป็น **historical archive** ของระบบ 5 แท็บ/AI ที่ถูกลบแล้ว — ไม่ใช้เป็นคู่มือระบบปัจจุบัน

## เริ่มใช้งาน (สรุป)

1. ตั้งค่า Script Properties (Apps Script → Project Settings) เฉพาะ:

   | Key | จำเป็น | หมายเหตุ |
   |---|---|---|
   | `SPREADSHEET_ID` | แนะนำ | ถ้าเว้นว่างใช้ bound spreadsheet |
   | `API_TOKEN` | แนะนำ | สุ่มยาว ๆ ต้องตรงกับ `web/config.js`; ถ้าไม่ตั้ง = เปิดให้ใครก็เรียกได้ |
   | `DEBUG` | ไม่ | `1` = ส่ง stack trace กลับมา |

2. Deploy Apps Script เป็น Web App: **Execute as: Me**, **Who has access: Anyone**
   แล้วคัดลอก URL `/exec` ไปใส่ `API_URL` ใน `web/config.js`

3. วาง `scriptId` ใน `gas/.clasp.json` (ดูตัวอย่าง `.clasp.json.example`) ถ้าจะ `clasp push`

4. เปิด GitHub Pages: Settings → Pages → Source = **GitHub Actions** แล้ว push ขึ้น `main`

5. (ถ้าต้องการ) ล้างเฉพาะข้อมูลแผน/AI ใน Sheets:
   เปิด Apps Script editor เลือก `clearPlanAiData_` แล้วกด Run — ฟังก์ชันล้างเฉพาะ
   `full_state_json`, `monthly_json`, `closing_json` และคอลัมน์ H (`JSON_DATA`) ของชีต `บันทึกข้อมูล`
   **ไม่ลบ** master/KPI/คะแนนความเข้มแข็ง และไม่ลบชีตใด ๆ

## ทดสอบอัตโนมัติ (ไม่ต้องติดตั้ง dependency)

```bash
npm run check:gs   # ตรวจ syntax gas/**/*.gs ทุกไฟล์
npm test           # node --test tests/
npm run verify     # ทำทั้งสองอย่างตามลำดับ — ใช้ก่อน commit
```

ชุดทดสอบโหลด **ไฟล์จริง** ของโปรเจกต์ (`gas/*.gs` ผ่าน `new Function`, `web/js/*.js` ผ่าน `vm`)

## ทดสอบหน้าเว็บบนเครื่องก่อน deploy

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve-web.ps1
# เปิด http://127.0.0.1:8787/index.html
```

หรือ `python -m http.server 8787 --directory web`
(ใช้ HTTP เพราะหน้าเว็บโหลด `config.js` และเรียก API — เปิดด้วย `file://` ไม่ได้)

## ความปลอดภัย

- GitHub Pages เป็น public — **ห้ามใส่ secret จริงใน `web/`** ค่า `API_TOKEN` ใน `config.js` มองเห็นได้ทั้งหมด
  ใช้เพื่อกันสแกนเนอร์เท่านั้น ไม่ใช่การยืนยันตัวตน
- ถ้าต้องการยืนยันตัวตนจริง ให้ใช้ **Google Sign-In (ID token)** แล้วตรวจใน `doPost`
- ใช้ `Anyone` (anonymous) + API_TOKEN — อย่าใช้ "Anyone with Google account"
  เพราะ `fetch` ข้ามโดเมนจะโดน redirect ไปหน้า login และ CORS พัง
- จำกัดฟังก์ชันที่เรียกได้ด้วย `RPC_ALLOWLIST` ใน `gas/Api.gs` — ปัจจุบันมีแค่
  `getMasterCoopList` และ `getDashboardSummaryData`
- `redactSecrets_()` ตัด key ออกจาก error ก่อนส่งกลับ client always

## เอกสาร

- `docs/architecture.md` — ภาพรวมและหน้าที่ของแต่ละส่วน
- `docs/api.md` — สัญญา API / วิธีเพิ่ม endpoint
- `docs/data-model.md` — โครงสร้างชีตที่ยังใช้ + หมายเหตุฟิลด์ JSON ที่เลิกใช้
- `docs/migration.md` *(historical)* — บันทึกการย้ายโค้ดเดิม (ระบบ 5 แท็บ/AI ที่ถูกลบแล้ว)
- `docs/upload-data-flow.md` *(historical)* — เส้นทางข้อมูลหลังอัปโหลด (ระบบที่ถูกลบแล้ว)
- `docs/upload-quality-upgrade.md` *(historical)* — แผนอัปเกรดคุณภาพอัปโหลด (ระบบที่ถูกลบแล้ว)

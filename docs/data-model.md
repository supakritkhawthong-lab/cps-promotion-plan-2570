# Data Model (3-tab tracking app)

## 1. ชีตที่โค้ดปัจจุบันอ่าน

แอปอ่านข้อมูลอย่างเดียว — ไม่เขียน Sheets (ยกเว้น `clearPlanAiData_()` ที่รันจาก editor ครั้งเดียว)

### `คำสั่งมอบหมาย`

| index | คอลัมน์ | ความหมาย |
|---|---|---|
| 1 | B | ชื่อกลุ่มส่งเสริม (`กลุ่มส่งเสริมสหกรณ์ N (อำเภอ...)`) หรือชื่อสหกรณ์ |
| 2 | C | ผู้ดูแลหลัก |
| 3–7 | D–H | ผู้ดูแลร่วม (สูงสุด 5 คน) |

โค้ดแยกโซนด้วย regex `กลุ่มส่งเสริมสหกรณ์\s*(\d+)` และ `\(อำเภอ(.*?)\)`

### `ผลปี68`

| index | คอลัมน์ | field |
|---|---|---|
| 2 | C | ชื่อ |
| 3 | D | code13 |
| 4 | E | ประเภทสหกรณ์ |
| 8 | I | d1 |
| 15 | P | d2 |
| 22 | W | d3 |
| 27 | AB | d4 |
| 30 | AE | total |
| 31 | AF | level |
| 37 | AL | วันสิ้นปีบัญชี |

### `ผลปี69`

| index | คอลัมน์ | field |
|---|---|---|
| 2 | C | ชื่อ |
| 3 | D | code13 |
| 4 | E | ประเภท |
| 5–7 | F–H | s1_1, s1_2, s1_3 |
| 9–14 | J–O | s2_1 … s2_6 |
| 16–20 | Q–U | s3_1 … s3_5 |
| 23–26 | X–AA | s4_1 … s4_4 |
| 30 | AE | total |
| 31 | AF | level |
| 32 | AG | cadNote |
| 34 | AI | closeStatus |
| 35 | AJ | agmStatus |
| 37 | AL | วันสิ้นปีบัญชี |

#### คะแนนกลุ่มเกษตรกร ปี 2569 (ข้อมูลสำรองในโค้ด)

กลุ่มเกษตรกรทั้ง 22 รายของชลบุรีมีคะแนนความเข้มแข็งปี 2569 ฝังมาพร้อมระบบใน
`gas/GroupStrength69.gs` (`GROUP_STRENGTH_69_DATA`) เพื่อให้เลือกกลุ่มแล้วเห็นผลได้ทันที
แม้ชีต `ผลปี69` ยังว่าง

- `getMasterCoopList()` ใช้ข้อมูลสำรอง **เฉพาะเมื่อชีตไม่มีคะแนนที่ใช้งานได้**
  (ข้อมูลจากชีตจริงชนะเสมอ)
- โครง `score69` ที่สร้างเหมือนชีต: `code13`, `coopType`, `d1`–`d4`, `total`, `level`,
  `fy`, `closeStatus`, `agmStatus`, `cadNote`, `subScores`, `simResult`
  และเพิ่ม `source: 'bundled-group-strength-69'`
- ไฟล์ต้นทาง (`เข้มแข็งกลุ่มเกษตรกร ผลปี 2569.xls`, ชีต `final_score_kk_agri_y69`)
  มีคอลัมน์พิเศษ **"แบบภาพรวมสำหรับที่ไม่เข้าหลักเกณฑ์"** ก่อนคอลัมน์รวมคะแนนมิติที่ 3
  จึงแมปค่านี้เป็น `s3_5` เพื่อให้ผลรวมมิติที่ 3 ตรงกับไฟล์
- ฝั่งเว็บ (`web/js/cpd-ui.js`) เติมค่าตัวชี้วัดปี 2569 จาก `score69.subScores`
  ผ่าน `indicatorsFromScore69()` / `applyStrength69Fallback()` โดยไม่กระจายตามน้ำหนัก
- **ระดับชั้นของกลุ่มเกษตรกรยึดตามผลจัดชั้นจริงจาก กสส.** — บทวิเคราะห์ช่องว่าง
  (`simResult.gapSummaryLines`) ไม่ตัดสินชั้นจากคะแนนเอง
- ไฟล์มีเฉพาะ **ระดับชั้นปี 2568** (`prevLevel`) จึงเติมเป็น metadata ของ `score68`
  (`level`, `fy`) โดยไม่สร้างคะแนนรวม/มิติขึ้นเอง
- ชื่อที่ระบบสะกดต่างจากไฟล์ 1 ราย (`ผู้ลี้ยง` → `ผู้เลี้ยง`) จัดการด้วย
  `GROUP_STRENGTH_69_NAME_ALIASES`

### `บันทึกข้อมูล` (legacy draft)

| index | คอลัมน์ | ความหมาย |
|---|---|---|
| 0 | A | timestamp |
| 1 | B | ชื่อสหกรณ์ |
| 2 | C | อำเภอ |
| 3 | D | ปีบัญชี |
| 4 | E | ผู้สอบบัญชี (แสดงผล) |
| 5 | F | จำนวนครั้งที่เข้า |
| 6 | G | หมายเหตุ |
| 7 | H | `JSON_DATA` ของฟอร์มเก่า — **เลิกใช้แล้ว** |

โค้ดยังอ่านชื่อสหกรณ์จาก column B เพื่อจับคู่ master list แต่ **ไม่ใช้ column H อีกต่อไป**
`clearPlanAiData_()` จะล้าง column H ทั้งคอลัมน์ (เฉพาะแถวข้อมูล) เมื่อรันจาก editor

---

## 2. ชีต CPD 3 ชีต (อ่านเพื่อ Dashboard)

Backend เคยสร้างหัวตารางอัตโนมัติและ upsert หนึ่งแถวต่อสหกรณ์/ปีงบประมาณ
ตอนนี้เหลือเฉพาะการอ่านสรุป — ฟังก์ชันเขียนถูกลบไปแล้ว

### `CPD_Plans_2570`

เก็บข้อมูลสรุป เช่น `updated_at`, `fiscal_year`, `coop_id`, `coop_name`,
ประเภท/อำเภอ/เขต/ผู้ดูแล, วันสิ้นปีบัญชี, กำหนด 30/150 วัน, จำนวนสมาชิก,
สินทรัพย์/หนี้สิน/ทุน/กำไร/ปริมาณธุรกิจ, ชั้นและคะแนน 4 มิติ, สถานะอนุมัติ

คอลัมน์ `full_state_json` — เคยเก็บ snapshot ของ `CPD_AppState` สำหรับโหลดกลับมาแก้ไข
**เลิกใช้แล้ว** และจะถูกล้างโดย `clearPlanAiData_()`

### `CPD_Monthly_Tracking`

เก็บ `progress_percent`, สถานะ `m_oct_status` ถึง `m_sep_status`
สถานะมี 4 ค่า: `white` (ยังไม่รายงาน), `black` (ไม่ได้ลงพื้นที่), `yellow` (รอดำเนินการ),
`green` (อนุมัติ/สำเร็จ) โดยเปอร์เซ็นต์นับเดือนที่ไม่ใช่ `white`

คอลัมน์ `monthly_json` **เลิกใช้แล้ว** — จะถูกล้างโดย `clearPlanAiData_()`

### `CPD_Closing_Success`

เก็บผลปิดบัญชีและประชุมใหญ่, วันที่ผู้สอบบัญชี, ระยะเวลา 30/150 วัน,
ความเห็นผู้บังคับบัญชา

คอลัมน์ `closing_json` **เลิกใช้แล้ว** — จะถูกล้างโดย `clearPlanAiData_()`

### การ join ข้อมูล

Dashboard join master list กับ CPD 3 ชีตด้วย `fiscalYear + coopId` (fallback ชื่อ)
Google Sheets อาจแปลงข้อความวันที่เป็น `Date` เมื่อเขียน จึง normalize กลับเป็นข้อความ
`วว/ดด/ปปปป` หรือ `วัน เดือนไทย` ตอนอ่านก่อนส่งให้ frontend

---

## 3. `CPD_AppState` (ฝั่ง frontend — เหลือเฉพาะที่ใช้จริง)

```text
meta                     ปีงบประมาณ (2570), planId, สถานะ
coopProfile              รหัส/ชื่อ/ประเภท/เขต/ผู้ดูแล, วันสิ้นปี
financials               summary2Years, balanceSheet, businesses, incomeStatement, ratios
                         (ใช้โดย fallbackDashboard เมื่อ RPC ล้มเหลว)
strength                 ชั้น/คะแนนรวม/4 มิติ และ 18 ตัวชี้วัดแยกปี 2567–2569
                         (ใช้โดยหน้า strength)
analysis                 ประเด็น/เป้าหมาย — คงโครงสร้างว่างไว้สำหรับความเข้มข้นของ state
scheduleAndActivities    แผน 12 เดือน, monthlyBusinessVolume (fallback)
closingReport            ผล 30/150 วัน, 2.1–2.5 (fallback)
```

ฟิลด์ที่ถูกลบออกจาก state แล้ว (ห้ามเพิ่มกลับโดยไม่ได้รับอนุมัติ):
`analysis.uploaded*`, `analysis.orgAnalysis4M`, `analysis.businessAnalysis`,
`analysis.welfareAnalysis`, `analysis.summaryAnalysis`, `analysis.uploadMeta`,
`analysis.uploadHistory`, `analysis.extractedDocs`

---

## 4. การล้างข้อมูลแผน/AI (ครั้งเดียว, editor-only)

`clearPlanAiData_()` ใน `gas/CPD_Database.gs`:

| ชีต | คอลัมน์ที่ล้าง | หมายเหตุ |
|---|---|---|
| `CPD_Plans_2570` | `full_state_json` | หาหัวตารางตามชื่อ ไม่รันถ้าไม่มีคอลัมน์ |
| `CPD_Monthly_Tracking` | `monthly_json` | เช่นเดียวกัน |
| `CPD_Closing_Success` | `closing_json` | เช่นเดียวกัน |
| `บันทึกข้อมูล` | column H (`JSON_DATA`) | ล้างทั้งคอลัมน์ข้อมูล |

- **ไม่ลบชีต** `คำสั่งมอบหมาย`, `ผลปี68`, `ผลปี69`, `บันทึกข้อมูล`,
  `CPD_Plans_2570`, `CPD_Monthly_Tracking`, `CPD_Closing_Success`, `users`
- **ไม่ลบ** master/KPI/chั้น/คะแนนความเข้มแข็ง — 3 แท็บยังอ่านข้อมูลเหล่านี้อยู่
- ฟังก์ชันมี `try...catch` ครอบและ log ผลผ่าน `Logger.log()` — คืน
  `{ cleared: {...}, errors: [...] }`
- ต้องรันจาก Apps Script editor เท่านั้น — **ไม่มี RPC** เรียกจากเว็บไม่ได้
- ยังไม่ได้รันบน production — รออนุมัติ

---

## 5. เอกสาร historical (ระบบ 5 แท็บ/AI ที่ถูกลบแล้ว)

ไฟล์ต่อไปนี้เก็บไว้เป็นบันทึกอดีต **ไม่ใช่คู่มือระบบปัจจุบัน**:

- `docs/migration.md` — ขั้นตอนย้ายโค้ดเดิม + แผนพัฒนา 5 แท็บ
- `docs/upload-data-flow.md` — เส้นทางข้อมูลหลังอัปโหลด/AI
- `docs/upload-quality-upgrade.md` — แผนอัปเกรดคุณภาพอัปโหลด

ห้ามอ้างอิง API/ฟังก์ชันในเอกสารเหล่านี้ว่าเปิดอยู่ — ดู `docs/api.md` แทน

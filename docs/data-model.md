# Data Model

## 1. ชีตที่โค้ดปัจจุบันใช้

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

- `getMasterCoopList()` จะใช้ข้อมูลสำรอง **เฉพาะเมื่อชีตไม่มีคะแนนที่ใช้งานได้**
  (`hasStrengthScore69_` เป็น false) — ถ้าชีตมีคะแนนจริง ข้อมูลจากชีตชนะเสมอ
- โครง `score69` ที่สร้างเหมือนชีต: `code13`, `coopType`, `d1`–`d4`, `total`, `level`,
  `fy`, `closeStatus`, `agmStatus`, `cadNote`, `subScores`, `simResult`
  และเพิ่ม `source: 'bundled-group-strength-69'`
- ไฟล์ต้นทาง (`เข้มแข็งกลุ่มเกษตรกร ผลปี 2569.xls`, ชีต `final_score_kk_agri_y69`)
  มีคอลัมน์พิเศษ **“แบบภาพรวมสำหรับที่ไม่เข้าหลักเกณฑ์”** ก่อนคอลัมน์รวมคะแนนมิติที่ 3
  จึงแมปค่านี้เป็น `s3_5` เพื่อให้ผลรวมมิติที่ 3 ตรงกับไฟล์
- ฝั่งเว็บ (`web/js/cpd-ui.js`) เติมค่าตัวชี้วัดปี 2569 จาก `score69.subScores`
  ผ่าน `indicatorsFromScore69()` / `applyStrength69Fallback()` โดยไม่กระจายตามน้ำหนัก
- ไฟล์มีเฉพาะ **ระดับชั้นปี 2568** (`prevLevel`) จึงเติมเป็น metadata ของ `score68`
  (`level`, `fy`) โดยไม่สร้างคะแนนรวม/มิติขึ้นเอง
- ชื่อที่ระบบสะกดต่างจากไฟล์ 1 ราย (`ผู้ลี้ยง` → `ผู้เลี้ยง`) จัดการด้วย
  `GROUP_STRENGTH_69_NAME_ALIASES`

### `บันทึกข้อมูล` (draft)

| index | คอลัมน์ | ความหมาย |
|---|---|---|
| 0 | A | timestamp |
| 1 | B | ชื่อสหกรณ์ |
| 2 | C | อำเภอ |
| 3 | D | ปีบัญชี |
| 4 | E | ผู้สอบบัญชี (แสดงผล) |
| 5 | F | จำนวนครั้งที่เข้า |
| 6 | G | หมายเหตุ |
| 7 | H | `JSON_DATA` ของฟอร์มทั้งก้อน |

**ข้อจำกัด:** 1 สหกรณ์ = 1 แถว (เขียนทับ) → ไม่มีประวัติย้อนหลัง
และ cell จำกัด 50,000 ตัวอักษร

---

## 1A. ชีตที่ใช้จริงสำหรับ SPA 5 แท็บ

Backend สร้างหัวตารางอัตโนมัติเมื่อบันทึกครั้งแรก และ upsert หนึ่งแถวต่อสหกรณ์/ปีงบประมาณ

### `CPD_Plans_2570`

เก็บข้อมูลสรุปของแผน เช่น `updated_at`, `fiscal_year`, `coop_id`, `coop_name`,
ประเภท/อำเภอ/เขต/ผู้ดูแล, วันสิ้นปีบัญชี, กำหนด 30/150 วัน, จำนวนสมาชิก,
สินทรัพย์/หนี้สิน/ทุน/กำไร/ปริมาณธุรกิจ, ชั้นและคะแนน 4 มิติ, สถานะอนุมัติ
และ **`full_state_json`** ซึ่งเป็น snapshot ของ `CPD_AppState` ทั้งก้อนสำหรับโหลดกลับมาแก้ไข

### `CPD_Monthly_Tracking`

เก็บ `progress_percent`, สถานะ `m_oct_status` ถึง `m_sep_status` และ `monthly_json`
สถานะมี 4 ค่า: `white` (ยังไม่รายงาน), `black` (ไม่ได้ลงพื้นที่), `yellow` (รอดำเนินการ),
`green` (อนุมัติ/สำเร็จ) โดยเปอร์เซ็นต์นับเดือนที่ไม่ใช่ `white`

### `CPD_Closing_Success`

เก็บผลปิดบัญชีและประชุมใหญ่, วันที่ผู้สอบบัญชี, ระยะเวลา 30/150 วัน,
ความเห็นผู้บังคับบัญชา และ `closing_json`

### `CPD_AppState` ใน `full_state_json`

```text
meta                     ปีงบประมาณ, planId, สถานะ/ผู้จัดทำ/ผู้อนุมัติ, เวลาปรับปรุง
coopProfile              รหัส/ชื่อ/ประเภท/เขต/ผู้ดูแล, วันสิ้นปี, สมาชิก, ธุรกิจหลัก
financials               summary2Years, balanceSheet, businesses, incomeStatement, ratios
strength                 ชั้น/คะแนนรวม/4 มิติ และ 18 ตัวชี้วัดแยกปี 2567–2569
analysis                 ประเด็น, เป้าหมาย 1–5, 4M, ธุรกิจ, สวัสดิการ
scheduleAndActivities    แผน 12 เดือน, monthlyBusinessVolume, visitLog, activities
closingReport            ผล 30/150 วัน, 2.1–2.5, อุปสรรค, ข้อเสนอแนะ, ผู้บังคับบัญชา
```

Google Sheets อาจแปลงข้อความวันที่เป็น `Date` เมื่อเขียน จึง normalize กลับเป็นข้อความ
`วว/ดด/ปปปป` หรือ `วัน เดือนไทย` ตอนอ่านก่อนส่งให้ frontend

---

## 2. ข้อเสนอ Schema v2 (ยังเป็นแผนอนาคต)

แยกข้อมูลออกเป็นตาราง เพื่อรองรับประวัติ、ไฟล์แนบ และการอนุมัติ

### `plans`

| column | type | หมายเหตุ |
|---|---|---|
| `plan_id` | string | UUID |
| `coop_name` | string | |
| `fiscal_year` | number | 2570 |
| `status` | enum | `draft` / `submitted` / `approved` |
| `version` | number | เริ่มที่ 1 |
| `district` | string | |
| `zone` | string | กสส.N |
| `main_officer` | string | |
| `co_officers` | string | คั่นด้วย `/` |
| `auditor_type` | string | ภาครัฐ / ภาคเอกชน |
| `auditor_name` | string | |
| `planned_visits` | number | |
| `form_json` | string | snapshot ของฟอร์ม |
| `doc_file_id` | string | Drive file id ของ .docx |
| `created_at` | datetime | |
| `created_by` | string | email |
| `updated_at` | datetime | |
| `updated_by` | string | email |

### `plan_files`

| column | type |
|---|---|
| `file_id` | string (Drive) |
| `plan_id` | string |
| `category` | string (`basic` / `finance` / `audit` / `other`) |
| `name` | string |
| `mime_type` | string |
| `size_bytes` | number |
| `uploaded_at` | datetime |
| `uploaded_by` | string |

### `plan_scores`

เก็บผลประเมินรายปี แยกจาก plan เพื่อเทียบย้อนหลัง

| column | type |
|---|---|
| `plan_id` | string |
| `year` | number |
| `level` | string |
| `total` | number |
| `d1`–`d4` | number |
| `sub_scores_json` | string |

### `users`

| column | type |
|---|---|
| `email` | string |
| `name` | string |
| `role` | `admin` / `officer` / `viewer` |
| `active` | boolean |

### `audit_log`

| column | type |
|---|---|
| `timestamp` | datetime |
| `email` | string |
| `action` | string |
| `plan_id` | string |
| `detail` | string |

> ถ้ายังไม่พร้อมย้ายทั้งหมด ให้เริ่มจาก `plans` ก่อน แล้วค่อย ๆ ย้าย `plan_files`
> โดยคงชีต `บันทึกข้อมูล` ไว้เป็น read-only archive

---

## 3. โครงสร้าง Google Drive

```
DRIVE_ROOT_FOLDER_ID/
├─ uploads/
│  └─ 2570/
│     └─ <coop_name_slug>/
│        ├─ basic/
│        ├─ finance/
│        ├─ audit/
│        └─ other/
├─ exports/
│  └─ 2570/
│     └─ <coop_name_slug>/
│        └─ แผนส่งเสริมสหกรณ์_2570_<coop>.docx
└─ temp/
   └─ (ไฟล์ที่สร้างชั่วคราว ลบทิ้งทุกวัน)
```

หลักปฏิบัติ:

- เก็บเฉพาะ `file_id` ใน Sheets ไม่เก็บ URL เต็ม
- ตั้งชื่อไฟล์ด้วย `<uuid>_<original_name>` เพื่อกันชื่อซ้ำ
- ไฟล์ที่ต้องแสดงบนเว็บให้ใช้
  `https://drive.google.com/thumbnail?id=<FILE_ID>&sz=w1000`
- ตั้ง permission เป็น `ANYONE_WITH_LINK` เฉพาะไฟล์ที่ต้องการเผยแพร่
- ใช้ `drive.file` scope แทน `drive` เมื่อแอปเข้าถึงเฉพาะไฟล์ที่ตัวเองสร้าง

---

## 4. แนวทางย้ายข้อมูล

1. สร้างชีตใหม่ตาม schema v2
2. เขียนสคริปต์ one-off อ่าน `บันทึกข้อมูล` → แปลง JSON → แทรกใน `plans`
3. เก็บ `บันทึกข้อมูล` ไว้เป็น archive (เปลี่ยนชื่อเป็น `บันทึกข้อมูล_archive`)
4. แก้ `getMasterCoopList()` ให้อ่าน draft จาก `plans` (เอา version ล่าสุด)
5. แก้ `saveDraftToSheet()` ให้ insert แถวใหม่ + เพิ่ม version

## 5. Backup

- ตั้ง trigger รายวัน: copy spreadsheet ไปยังโฟลเดอร์ `backups/`
- เก็บ 30 วันล่าสุด
- Drive มี version history อยู่แล้ว แต่ Sheets restore ทั้งไฟล์ง่ายกว่า

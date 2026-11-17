# แผนอัพเกรดคุณภาพข้อมูลอัปโหลด

เป้าหมาย: เมื่ออัปโหลดเอกสารแล้ว ข้อมูลต้อง **ครบ (recall)** **ถูกต้อง (precision)** **ตรวจย้อนกลับได้ (traceability)** **ไม่ทับข้อมูลที่ดีกว่า (non-destructive)** และ **นำไปใช้ต่อได้จริง (review + export)**

เอกสารนี้ต่อจาก `docs/upload-data-flow.md` ซึ่งอธิบายเส้นทางข้อมูลปัจจุบัน

---

## 1. หลักการออกแบบ 4 ชั้น

```text
ชั้น 1  Extraction   → อ่านไฟล์ให้ครบและรักษาโครงสร้างตาราง
ชั้น 2  Contract     → บังคับรูปแบบข้อมูล + แยก "ไม่พบ" ออกจาก "ศูนย์"
ชั้น 3  Validation   → ตรวจความสอดคล้องก่อนเขียนลง State
ชั้น 4  Safe Apply   → diff + review + snapshot + rollback
```

ถ้าชั้นใดชั้นหนึ่งพลาด ต้องไม่ทำให้ข้อมูลเดิมเสียหาย และต้องบอกผู้ใช้ได้ว่าพลาดตรงไหน

---

## 2. จุดที่ทำให้ข้อมูลตกหล่น/เพี้ยนในปัจจุบัน

| # | จุดเสี่ยง | ผลกระทบ | ตำแหน่งในโค้ด |
| --- | --- | --- | --- |
| 1 | ~~PDF ถูกอ่านสูงสุด 25 หน้า และตัดที่ ~35,000 ตัวอักษร~~ → **แก้แล้วใน Phase 1A** (อ่านทุกหน้า, ตัดที่ขอบหน้า, coverage) | ข้อมูลหน้าหลังหรือตารางยาวหายเงียบ ๆ | `smartProcessFile()` ใน `web/index.html` |
| 2 | ข้อความ PDF จาก PDF.js ถูกยุบเป็นบรรทัดเดียว | หัวข้อกับตัวเลขสลับคู่กันได้ง่าย | `smartProcessFile()` |
| 3 | ระยะ `facts` ขอ ~106 ฟิลด์ในครั้งเดียว | ฟิลด์จับคู่ผิด/ตอบไม่ครบ/ถูกตัด | `AI_FACT_STRING_FIELDS_`, `buildFactResponseSchema_()` |
| 4 | AI ใช้ `0` หรือค่าว่างแทน "ไม่พบ" ปนกัน | แยกไม่ได้ว่าศูนย์จริงหรืออ่านไม่เจอ | `AI_FACT_STRING_FIELDS_` |
| 5 | `S.num()` ตัดวงเล็บออกแต่ไม่กลับเครื่องหมาย | `(1,234)` กลายเป็น `+1,234` ทั้งที่เป็นค่าลบ | `web/js/cpd-state.js` |
| 6 | `lowTextPdf` เป็นธงระดับงาน แล้วลบ `*Latest/*Prev` ที่เป็น 0 ทั้งหมด | ถ้างานมีไฟล์สแกน 1 ไฟล์ ตัวเลขศูนย์จริงจากไฟล์ดิจิทัลจะหาย | `runAIAnalysis()` |
| 7 | ไม่มีหลักฐานรายฟิลด์ (ไฟล์/หน้า/ข้อความอ้างอิง) | ตรวจย้อนกลับไม่ได้ว่าตัวเลขมาจากไหน | ผลลัพธ์ AI |
| 8 | เขียนทับฟอร์มทันที ไม่มี diff/undo | ผู้ใช้ไม่รู้ว่าค่าไหนเปลี่ยน และย้อนกลับยาก | `runAIAnalysis()` |
| 9 | ถ้ารอบใหม่บางหัวข้อล้ม ข้อความหัวข้อเดิมยังอยู่ | ผู้ใช้อาจเข้าใจว่าเป็นผลจากไฟล์ใหม่ | `applyUploadedAnalysisNotes()` |
| 10 | `uploadedSectionsCoop` ผูกเฉพาะชื่อสหกรณ์ | ข้อมูลปีเก่าหรือรอบเก่าค้างเมื่อเปลี่ยนปีบัญชี | `analysis.uploadedSectionsCoop` |
| 11 | ตรวจสอบเพียงสมการบัญชี | ตัวเลขที่ผิดแต่สมการยังดุลผ่านได้ | `validateAccountingEquation()` |
| 12 | ไม่มีปีบัญชีของเอกสาร (`fyCheckNote` ไม่ถูกใช้) | เอกสารปี 2568 อาจถูกเติมลงแผนปี 2570 | `runAIAnalysis()` |

---

## 3. ชั้น 1 — Extraction: อ่านให้ครบและรักษาโครงสร้าง

### 3.1 อ่านแบบมี manifest ต่อไฟล์

ให้ `smartProcessFile()` คืนข้อมูลเพิ่ม (✅ ลงแล้วใน Phase 1A):

```js
{
  name: 'งบการเงิน 2568.pdf',
  category: 'งบการเงิน/รายงานสอบบัญชี',
  extractedText: '[หน้า 1] ...\n[หน้า 3] ...',
  totalPages: 48,
  pagesRead: 41,           // จำนวนหน้าที่ส่งเข้า AI
  chars: 52310,
  mode: 'text' | 'scan' | 'docx' | 'xlsx',
  coverage: {
    totalPages: 48, pagesRead: 48, pagesIncluded: 41,
    pagesSkipped: [7, 8, 22], skippedCount: 7,
    pagesSkippedHighScore: [8], charsTotal: 120000, charsSent: 52310,
    complete: false
  }
}
```

ประโยชน์:
- รู้ว่าอ่านไปกี่หน้าจากทั้งหมด และหน้าใดถูกข้าม
- ตรวจย้อนหลังได้ว่าข้อมูลมาจากไฟล์ใด
- `sha256` สำหรับตรวจไฟล์ซ้ำยังเป็นงานของ Phase 1D

### 3.2 ไม่ตัดข้อความแบบเงียบ ๆ

- ✅ Phase 1A: ทุกไฟล์ถูกตัดที่ **ขอบหน้า** ตาม budget 55,000 ตัวอักษร/ไฟล์ และ 180,000 ตัวอักษรรวม พร้อมแสดง coverage ให้ผู้ใช้เห็น
- ✅ Phase 1B: หน้าที่ถูกข้าม/ถูกตัดจะถูกเก็บเป็น **evidence window** (ข้อความสั้นรอบคำสำคัญ/ตัวเลข) แนบไปกับระยะ `facts` เพื่อไม่ให้ตัวเลขสำคัญหายเงียบ
- ยังเหลือ Phase 1C: แบ่งข้อความเป็นช่วงหน้า (8–10 หน้าต่อช่วง) แล้วสกัด facts ต่อช่วง
- รวมผลด้วยกติกา: ค่าที่มีหลักฐานชัดกว่า/ไฟล์ที่มีลำดับความน่าเชื่อถือสูงกว่าชนะ
- ✅ แสดง "อ่าน 48/48 หน้า • ส่งเข้า AI 41 หน้า • ข้าม 7 หน้า" และเตือนถ้ายังมีหน้าสำคัญที่ไม่ได้อ่าน

### 3.3 รักษาโครงสร้างตาราง

- ใช้พิกัด `transform` จาก PDF.js จัดกลุ่มข้อความตามแถว/คอลัมน์ แล้วส่งเป็นข้อความแบบตาราง (TSV)
- สำหรับหน้าทีมีคำว่า `งบฐานะการเงิน`, `งบกำไรขาดทุน`, `สินทรัพย์`, `หนี้สิน` ให้ส่งทั้งข้อความและภาพหน้า đóให้ AI ตรวจสองทาง
- ไฟล์สแกนใช้ภาพหน้าเป็นหลัก และเก็บ `ocrConfidence` ถ้ามี

### 3.4 ลำดับความน่าเชื่อถือของแหล่งข้อมูล

เมื่อหลายไฟล์ให้ค่าต่างกัน ให้ใช้ลำดับ:

1. งบการเงินที่สอบบัญชีแล้ว
2. รายงานสอบบัญชี/ผลปิดบัญชี
3. รายงานประจำปี/รายงานผลดำเนินงาน
4. ใบโปรไฟล์/เอกสารสรุป
5. ข้อความบรรยายทั่วไป

ถ้าค่าขัดกันเกินเกณฑ์ ให้ทำสถานะ `conflict` และรอผู้ใช้ยืนยัน

---

## 4. ชั้น 2 — Contract: บังคับรูปแบบและความหมาย

### 4.1 แยก "ไม่พบ" ออกจาก "ศูนย์"

เพิ่ม metadata ต่อฟิลด์ โดยไม่เปลี่ยนรูปข้อมูลเดิม:

```js
analysis.uploadMeta = {
  schemaVersion: 1,
  runId: 'up-20261116-001',
  coopName: 'สหกรณ์...',
  fiscalYear: '2570',
  createdAt: '2026-11-16T10:00:00+07:00',
  model: 'gemini-...',
  promptVersion: '2026-11-16',
  files: [
    { name: 'งบการเงิน.pdf', category: 'งบการเงิน', sha256: '...', pages: 48, chars: 35210, mode: 'text' }
  ],
  fields: {
    assetLatest: {
      value: 123456789.0,
      raw: '123,456,789.00',
      source: { file: 'งบการเงิน.pdf', page: 12 },
      quote: 'สินทรัพย์รวม 123,456,789.00',
      confidence: 0.95,
      status: 'verified' // verified | review | conflict | missing
    }
  },
  warnings: []
};
```

- ค่าที่ AI ไม่พบ → `status: 'missing'` และ **ไม่เขียนทับค่าเดิม**
- ค่าที่เป็นศูนย์จริง → `value: 0` + มี `quote`/`source` ยืนยัน
- ค่าที่ขัดกัน → `status: 'conflict'`

### 4.2 Normalize ตัวเลขที่ฝั่งเซิร์ฟเวอร์

เพิ่ม `normalizeNumber_()` ใน `gas/Code.gs` หรือใช้ร่วมกับ `S.num()`:

- `(1,234.50)` → `-1234.50`
- `1,234.50 บาท` → `1234.50`
- `๑,๒๓๔.๕๐` → `1234.50`
- `1.2 ล้านบาท` → `1200000`
- `-` / `–` / ว่าง → `null` (ไม่ใช่ 0)
- ตรวจช่วงค่าที่เป็นไปได้ เช่น จำนวนสมาชิกต้องไม่ติดลบ

### 4.3 บังคับ schema เวอร์ชัน

- เพิ่ม `schemaVersion` ในผลลัพธ์ AI
- ฝั่งเว็บตรวจเวอร์ชันก่อนใช้ ถ้าไม่ตรงให้ใช้ fallback หรือแจ้งเตือน
- เก็บ `promptVersion` และ `model` ไว้ใน `uploadMeta` เพื่อตรวจย้อนกลับ

---

## 5. ชั้น 3 — Validation: ตรวจก่อนเขียนลง State

### 5.1 กติกาหลัก

| กติกา | เกณฑ์ | ถ้าไม่ผ่าน |
| --- | --- | --- |
| สมการบัญชี | สินทรัพย์ = หนี้สิน + ทุน ±0.5% | `review` |
| กำไรสุทธิ | รายได้ - ค่าใช้จ่าย = กำไร ±1 บาท | `review` |
| สินทรัพย์ | หมุนเวียน + ไม่หมุนเวียน = รวม | `review` |
| หนี้สิน | หมุนเวียน + ไม่หมุนเวียน = รวม | `review` |
| ทุน | ทุนเรือนหุ้น + ทุนสำรอง + ทุนสะสม + กำไร - ขาดทุนสะสม = ทุนรวม | `review` |
| ธุรกิจแยก | ผลรวมรายได้/ต้นทุนของธุรกิจ ≤ ยอดรวม | `review` |
| สมาชิก | ชาย + หญิง + สมทบ = รวม | `review` |
| ปีบัญชี | ปีในเอกสารตรงกับ `dbFiscalYear` | `review`/ไม่เติม |
| YoY | เปลี่ยนแปลงเกิน 50% หรือกลับเครื่องหมาย | `review` |
| อัตราส่วน | 0–100% ตามประเภท | `review` |
| ข้อ 4 | ทุก `ปัญหาที่ n` ต้องมี `(แก้ไขปัญหาที่ n)` | ซ่อม/fallback |

### 5.2 ตรวจความสอดคล้องของเนื้อหา

- ตัวเลขในบทวิเคราะห์ข้อ 1–4 ต้องปรากฏใน facts หรือข้อความต้นฉบับ (ยอมรับการปัดเศษ)
- ข้อ 4 ต้องอ้างปัญหาจากข้อ 1–3 ได้จริง
- ห้ามมี `undefined`, `NaN`, `[object Object]`, ชื่อหัวข้อซ้ำ
- ถ้าตรวจไม่ผ่าน ให้ติดสถานะ `review` ไม่ใช่ลบเนื้อหาทิ้ง

---

## 6. ชั้น 4 — Safe Apply: ไม่ทับข้อมูลที่ดีกว่า

### 6.1 นโยบาย merge ต่อฟิลด์

```js
function decideMerge(currentValue, incoming, currentLocked) {
  if (currentLocked) return 'keep';                  // ผู้ใช้/preload ล็อกไว้
  if (incoming.status === 'missing') return 'keep';  // AI ไม่พบ
  if (incoming.value == null || incoming.value === '') return 'keep';
  if (currentValue == null || currentValue === '') return 'fill';
  if (equal(currentValue, incoming.value)) return 'noop';
  return 'review';                                   // ค่าเดิมมีอยู่และต่าง → ถามก่อน
}
```

หลักคือ **ห้ามเขียนทับค่าที่มีอยู่โดยไม่แจ้ง** ยกเว้นผู้ใช้กดยืนยัน

### 6.2 Snapshot + rollback

ก่อน apply ทุกครั้ง:

```js
analysis.uploadMeta.previous = {
  runId: previousRunId,
  snapshot: { /* ค่าฟอร์ม/State ที่จะถูกเปลี่ยน */ }
};
```

ให้มีปุ่ม "ย้อนกลับผลอัปโหลดครั้งล่าสุด" และเก็บประวัติ 3–5 รอบ

### 6.3 จัดการรอบที่ล้มบางส่วน

- ถ้ารอบใหม่ไม่มี `welfareAnalysis` → อย่าปล่อยข้อความเก่าค้างแบบเงียบ ๆ
- ให้ติดสถานะ "ยังใช้ผลวิเคราะห์เดิม" หรือ "รอบใหม่ไม่มีข้อมูลด้านนี้"
- `uploadedSections*` ต้องผูก `runId` + `fiscalYear` ไม่ใช่แค่ชื่อสหกรณ์

### 6.4 หน้าจอ review ก่อนใช้

แสดงตาราง:

| ฟิลด์ | ค่าเดิม | ค่าใหม่ | แหล่งที่มา | สถานะ | การกระทำ |
| --- | --- | --- | --- | --- | --- |
| สินทรัพย์รวม | 10,000,000 | 10,500,000 | งบการเงิน หน้า 12 | ต้องตรวจ | ใช้ค่าใหม่ / คงเดิม |
| ทุนสำรอง | 500,000 | 500,000 | หน้า 12 | ตรงกัน | — |
| จำนวนสมาชิก | 1,200 | — | ไม่พบ | ไม่พบข้อมูล | คงเดิม |

ปุ่ม:
- **ใช้ค่าที่ปลอดภัย** (เฉพาะ `verified` + ช่องว่าง)
- **ดู diff ทั้งหมด**
- **ย้อนกลับ**
- **ล็อกฟิลด์นี้**

### 6.5 Quality gate ก่อน export

- แสดง "ความครบถ้วนของข้อมูลสำคัญ" เช่น 18/20 ฟิลด์
- ถ้าข้อมูลสำคัญยัง `review`/`missing` ให้ขึ้นเตือนในเอกสารหรือ блокก่อนพิมพ์
- ไม่บล็อกการพิมพ์ แต่ต้องบอกผู้ใช้ชัดเจน

---

## 7. แผนดำเนินการเป็นระยะ

| ระยะ | สิ่งที่ทำ | ผลลัพธ์ | ไฟล์หลัก |
| --- | --- | --- | --- |
| **Phase 0** ✅ *(ดำเนินการแล้ว)* | safe merge + diff + snapshot, null/0 semantics, per-file scan flag, year/run metadata, เตือนหัวข้อที่รอบใหม่ไม่มี | ข้อมูลเดิมไม่หาย, รู้ว่าอะไรเปลี่ยน | `web/js/cpd-upload.js`, `web/index.html`, `web/js/cpd-ui.js`, `web/js/cpd-state.js` |
| **Phase 1A** ✅ *(ดำเนินการแล้ว)* | อ่านทุกหน้า (150 หน้า / 45 วินาที), page scoring, budget ต่อไฟล์ 55k + รวม 180k, coverage UI, ไม่ตัดกลางหน้า | PDF ดิจิทัลอ่านครบขึ้นและรู้ว่าขาดหน้าใด | `web/index.html`, `web/js/cpd-upload.js`, `tests/` |
| **Phase 1B** ✅ *(ดำเนินการแล้ว)* | evidence windows + อ่านซ้ำเฉพาะฟิลด์ที่ขาด | เก็บเลขที่หลุดจากการตัดข้อความได้แม่นขึ้น | `web/index.html`, `gas/Code.gs` |
| **Phase 1C** ✅ *(ดำเนินการแล้ว)* | chunked facts ต่อช่วงหน้า + merge + provenance | ไฟล์ 100 หน้าอ่านครบโดยไม่เกินเวลา GAS | `web/index.html`, `gas/Code.gs`, `web/js/cpd-upload.js` |
| **Phase 2** | layout-aware table extraction, ส่งภาพหน้าสำคัญ, OCR confidence, double-pass ฟิลด์วิกฤต, conflict priority | ข้อมูลตารางแม่นขึ้น, ลด hallucination | `web/index.html`, `gas/Code.gs` |
| **Phase 3** | audit log ต่อรอบ, เก็บ hash/ไฟล์ต้นฉบับ (ถ้าอนุญาต), quality dashboard, prompt/schema versioning | ตรวจสอบย้อนหลังและวัดคุณภาพได้ | `gas/CPD_Database.gs`, docs |

### 7.1 Phase 0 — สิ่งที่ลงโค้ดแล้ว

**โมดูลใหม่ `web/js/cpd-upload.js`** (`window.CPD_UPLOAD`)

| ฟังก์ชัน | หน้าที่ |
| --- | --- |
| `FIELD_DEFS` | mapping 91 ฟิลด์ (main + detail latest/prev) → element id |
| `parseNumber()` | แยก `null` (ไม่พบ) ออกจาก `0`, รองรับวงเล็บ = ค่าลบ, เลขไทย, "ล้านบาท", `-` ต่อท้าย |
| `plan(res, options)` | สร้างแผน diff รายฟิลด์ + validation + warnings โดยไม่แตะ DOM |
| `applyPlan(plan, env, selectedIds)` | เติมเฉพาะฟิลด์ที่ปลอดภัย (และฟิลด์ที่ผู้ใช้เลือกจากหน้ารอตรวจ) |
| `commit(plan, options)` | เก็บ `analysis.uploadMeta` + snapshot ลง `analysis.uploadHistory` (5 รอบ, idempotent ต่อ `runId`) |
| `rollback(env)` | คืนค่าฟอร์มจาก snapshot ล่าสุด + คืน `uploadMeta` ของรอบก่อน |
| `renderReview(plan, container)` | ตาราง diff ค่าเดิม → ค่าใหม่ + checkbox + ปุ่ม "ใช้ค่าที่เลือก / ทั้งหมด / ข้าม" |
| `validateProjected()` | สมการบัญชี, รายได้−ค่าใช้จ่าย=กำไร, จำนวนสมาชิก, ปีบัญชี |

**การเปลี่ยนแปลงในไฟล์เดิม**

- `web/index.html`
  - `runAIAnalysis()` เลิกเติมฟอร์มตรง ๆ เปลี่ยนเป็น `plan → applyPlan → commit → renderReview`
  - ลบ global zero-deletion (`hasLowTextPdf` ลบ `*Latest`/`*Prev`) ออก
  - `smartProcessFile()` คืน metadata รายไฟล์ (`mode`, `totalPages`, `pagesRead`, `chars`, `truncated`, `lowTextPdf`)
  - เพิ่ม `#uploadReview`, `#uploadRollbackBox`, `#uploadMetaHint`, `refreshUploadMetaHint()`, `rollbackLastUpload()`
- `web/js/cpd-state.js`
  - `num()` แปลงวงเล็บเป็นค่าลบ และรองรับเลขไทย/`-` ต่อท้าย
  - เพิ่ม optional `analysis.uploadMeta`, `analysis.uploadHistory`, `uploadedSectionsFiscalYear`, `uploadedSectionsRunId`, `uploadedSectionsStatus`
- `web/js/cpd-ui.js`
  - `applyUploadedAnalysisNotes()` บันทึก `runId`/ปีบัญชี/หัวข้อที่ใช้ และเตือนหัวข้อที่รอบใหม่ไม่มี (สถานะ `partial`)
  - `analyze4M` แสดงบทวิเคราะห์ที่อัปโหลดเฉพาะเมื่อชื่อสหกรณ์ **และ** ปีบัญชีตรงกัน

**เทสต์:** `tests/upload-plan.test.js` (26 เทสต์) + `tests/uploaded-analysis.test.js` 2 เทสต์ → `npm run verify` ผ่าน 90/90

### 7.2 Phase 1A — สิ่งที่ลงโค้ดแล้ว

**`web/js/cpd-upload.js` — ฟังก์ชันใหม่ (pure/testable)**

| ฟังก์ชัน | หน้าที่ |
| --- | --- |
| `scorePageText(text, pageNo)` | ให้คะแนนหน้า: หัวข้อการเงิน +3/คำ (สูงสุด 9), คำสำคัญ +1/คำ (สูงสุด 5), ตัวเลขหนาแน่นสูงสุด +6, ตารางตัวเลข +3, หน้า 1–3 +2 |
| `selectPages(pages, opts)` | เลือกหน้า 1–3 เสมอ + หน้าคะแนนสูงจนเต็ม `maxChars` (ค่าเริ่มต้น 55,000) แล้วคืนข้อความเรียงตามหน้า พร้อม `pagesSelected`, `pagesSkipped`, `skippedCount`, `pagesSkippedHighScore`, `complete` |
| `trimFileToChars(file, target)` | ตัดข้อความที่ **ขอบหน้า** เท่านั้น โดยตัดหน้าที่คะแนนต่ำสุดก่อน (เก็บหน้า 1–3 และหน้าสำคัญท้ายไฟล์) แล้วอัปเดต `coverage` |
| `applyTotalBudget(files, opts)` | จำกัดตัวอักษรรวม (180,000) โดยตัดไฟล์ที่ใหญ่ที่สุดก่อน และไม่ตัดต่ำกว่า `minPerFile` (12,000) |
| `pagePartsFromText()` / `pageNumbersFromText()` | แยก/อ่านเลขหน้าจากข้อความที่ทำเครื่องหมาย `[หน้า N]` |
| `normalizeFiles()` | เก็บ `coverage` (อ่าน/ส่ง/ข้าม/หน้าที่มีคะแนนสูง) ลง `uploadMeta` แบบจำกัดขนาด |

**`web/index.html`**

- `smartProcessFile()` อ่าน PDF ทุกหน้า (สูงสุด 150 หน้า / 45 วินาที) แล้วเรียก `selectPages()` — ไม่มี `scanLimit = 25` และไม่มี `substring(0, 35000)` อีก
- เพิ่ม `trimTextAtLineBoundary()` สำหรับ DOC/DOCX/XLSX (ตัดที่ขอบบรรทัด ไม่ตัดกลางบรรทัด)
- `runAIAnalysis()` เรียก `applyTotalBudget()` ก่อนส่ง payload และแสดงการ์ด `#uploadCoverage` ผ่าน `renderUploadCoverage()`
- `plan()` สร้างคำเตือนจาก `coverage`: อ่านกี่หน้า / ส่งเข้า AI กี่หน้า / ข้ามกี่หน้า / หน้าที่มีแนวโน้มสำคัญแต่ยังไม่ได้ส่ง
- bump cache เป็น `cpd-upload.js?v=20261116c`

### 7.3 Phase 1B — สิ่งที่ลงโค้ดแล้ว

**หลักคิด:** หน้าที่ถูกข้ามเพราะ budget ไม่ควรหายไปทั้งหน้า ให้เก็บเฉพาะ "ช่วงข้อความสั้น ๆ" รอบคำสำคัญ/ตัวเลขแนบไปกับระยะ `facts` และถ้าฟิลด์วิกฤตยังขาด ให้อ่านซ้ำเฉพาะฟิลด์นั้นจากหลักฐานที่มี

**`web/js/cpd-upload.js` — ฟังก์ชันใหม่ (pure/testable)**

| ฟังก์ชัน | หน้าที่ |
| --- | --- |
| `extractEvidence(pages, opts)` | ตัดข้อความ ±รอบคำสำคัญ (สินทรัพย์/หนี้สิน/ทุน/กำไร/สมาชิก/ผู้สอบบัญชี/ข้อสังเกต ฯลฯ) จากหน้าที่ถูกข้าม แล้ว snap ที่ขอบคำ จำกัด `maxPerPage` (2) และ `maxChars` (6,000/ไฟล์) |
| `attachFileEvidence(file, pages, opts)` | รวมหลักฐานใหม่กับของเดิม และตัดที่ขอบรายการ `[หลักฐานจากหน้า N]` |
| `capEvidenceBudget(files, maxTotal)` | จำกัดหลักฐานรวมทุกไฟล์ (18,000 ตัวอักษร) โดยตัดของไฟล์ที่ยาวที่สุดก่อน |
| `sliceEvidenceText()` / `evidencePageNumbers()` | ตัด/อ่านเลขหน้าหลักฐานโดยไม่ตัดกลางรายการ |
| `syncEvidenceMeta(file)` | อัปเดต `file.evidence` + `coverage.evidenceChars/evidencePages/evidenceWindows/evidenceCapped` |
| `trimFileToChars()` | เพิ่มพฤติกรรม: หน้าที่ถูกตัดจะถูกแปลงเป็น evidence อัตโนมัติ |

**`web/index.html`**

- `smartProcessFile()` สร้าง `evidenceText` จาก `pages` ที่ไม่อยู่ใน `selection.pagesSelected` (ก่อน `applyTotalBudget()`)
- `runAIAnalysis()` ส่ง `evidenceText` ไปกับ `payload.files` (เฉพาะไฟล์ข้อความ)
- `renderUploadCoverage()` แสดง "🔎 หลักฐานเสริมจากหน้า … • n ช่วง • n ตัวอักษร" และเตือนเมื่อถูกตัดตามเพดาน
- bump cache เป็น `cpd-upload.js?v=20261117a`

**`gas/Code.gs`**

| ส่วน | การเปลี่ยนแปลง |
| --- | --- |
| `capEvidenceParts_()` | จำกัดหลักฐานต่อไฟล์ 6,000 และรวม 24,000 ตัวอักษร (ปรับได้ด้วย `AI_EVIDENCE_PER_FILE_CHARS` / `AI_EVIDENCE_MAX_CHARS`) |
| ระยะ `facts` | ส่ง `evidenceText` ต่อท้ายข้อความหลัก พร้อม `AI_EVIDENCE_SUFFIX_` (เฉพาะระยะ facts) |
| `findMissingCriticalFacts_()` | ตรวจ 19 ฟิลด์วิกฤต โดยถือ `-`, ว่าง, `ไม่พบ` ว่าขาด แต่ `0` คือค่าจริง |
| `repairMissingFacts_()` | ระยะ `repair` อ่านซ้ำเฉพาะฟิลด์ที่ขาด โดยใช้ข้อความหลัก (สูงสุด 90k) + evidence + schema เฉพาะฟิลด์ |
| เงื่อนไขเรียก `repair` | มี evidence, ขาด ≥ 3 ฟิลด์วิกฤต, และเหลือเวลา ≥ 120 วินาที (จำกัดรอบละ 45 วินาที) — ปิดได้ด้วย `AI_TARGETED_REPAIR=0` |
| การ merge | เติมเฉพาะฟิลด์ที่ยังขาด ห้ามทับค่าที่มีอยู่ และไม่รับ `-` |

**เทสต์:** เพิ่ม 8 เทสต์ใน `tests/upload-plan.test.js` (evidence extraction/cap/trim/metadata) และ 7 เทสต์ใน `tests/ai-staged.test.js` (evidence inclusion, caps, repair merge, repair failure, gating) → `npm run verify` ผ่าน **105/105** ณ รอบ 1B (หลัง Phase 1C รวมเป็น 112/112)

**ต้อง deploy GAS ใหม่** (`analyzeUploadedFilesWithAI`) ก่อนใช้ Phase 1B บน production

**ยังไม่ทำในรอบนี้:** 1C (chunked facts + merge/provenance), 1D (scan batches + hash cache)

### 7.4 Phase 1C — สิ่งที่ลงโค้ดแล้ว

**หลักคิด:** เมื่อข้อความรวมทุกไฟล์ใหญ่เกินกว่าที่ GAS จะอ่านจบในเวลาที่มี ให้แบ่งเป็น "ช่วงหน้า" ที่ไม่ผสมไฟล์ แล้วสกัด facts ทีละช่วง จากนั้นรวมผลด้วยกติกาที่ตรวจย้อนกลับได้

**`gas/Code.gs` — ฟังก์ชันใหม่ (pure/testable)**

| ฟังก์ชัน | หน้าที่ |
| --- | --- |
| `buildFactChunks_(files, options)` | คืน `[]` เมื่อข้อความรวม ≤ `AI_CHUNK_THRESHOLD_CHARS` (90,000) หรือคืนรายการช่วงหน้าเมื่อเกิน โดยเริ่มที่ `AI_CHUNK_TARGET_CHARS` (45,000) แล้วเพิ่มเป้า 1.5 เท่า (สูงสุด 6 รอบ) จนจำนวนช่วง ≤ `max(6, จำนวนไฟล์)` |
| `splitFileToPageUnits_(text)` | แยกข้อความไฟล์เป็นหน่วยหน้าจาก marker `[หน้า N]` (ถ้าไม่มี marker = 1 หน่วย) |
| `buildChunksAtTarget_()` | รวมหน่วยหน้าต่อไฟล์จนใกล้เป้าหมาย โดยไม่ผสมไฟล์และไม่ตัดกลางหน้า |
| `runFactChunks_()` | เรียก `facts` ทีละช่วง แบ่งเวลาให้แต่ละช่วง แนบภาพเฉพาะช่วงแรก และแนบ evidence ของไฟล์ให้ช่วงแรกของไฟล์นั้น |
| `mergeFactResults_()` | รวม facts ด้วยกติกา **ความน่าเชื่อถือของหมวดไฟล์ > จำนวนช่วงที่ตรงกัน > ช่วงที่พบก่อน** แล้วคืน `{ facts, sources, conflicts }` |
| `factCategoryRank_()` | งบการเงิน 5, สอบบัญชี/ปิดบัญชี 4, ข้อมูลพื้นฐาน/ประจำปี/โปรไฟล์ 3, ไม่ทราบ 2, ไฟล์อื่น 1 |
| `normalizeFactValueKey_()` | normalize ตัวเลขก่อนเทียบ (`500` = `500.00`) จึงไม่ถือว่าขัดกัน |
| `compactFactSource_()` | แปลงช่วงเป็น `{ file, pages, chunk }` สำหรับ provenance |

**`gas/Code.gs` — `analyzeUploadedFilesWithAI()`**

- ถ้ามี > 1 ช่วง → อ่าน facts ต่อช่วงแล้ว merge; ช่วงที่ล้มเหลวไม่ทำให้ทั้งงานล้ม (เตือน `อ่านช่วงหน้า … ไม่สำเร็จ`) แต่ถ้าทุกช่วงล้มจึง throw
- ผลลัพธ์เพิ่ม metadata: `_aiFieldSources[field] = { file, pages, chunk }`, `_aiConflicts[field] = [{ value, file, pages }]` (สูงสุด 20 ฟิลด์ × 3 ค่า), `_aiChunks` (จำนวนช่วง)
- ฟิลด์ที่ได้จากการอ่านซ้ำ (repair) มีที่มา `file: 'หลักฐานเสริม (อ่านซ้ำ)'`, `chunk: 'repair'`
- ปรับได้ด้วย Script Properties: `AI_CHUNK_THRESHOLD_CHARS`, `AI_CHUNK_TARGET_CHARS`, `AI_CHUNK_MAX`

**`web/js/cpd-upload.js`**

- `plan()` อ่าน `_aiFieldSources`/`_aiConflicts` โดยตรง แนบ `source` ให้ record ของฟิลด์ และเพิ่มคำเตือนเมื่อพบค่าขัดกัน
- `sanitizeFieldSource_()` / `sanitizeConflicts_()` จำกัดขนาดก่อนเก็บลง State
- `commit()` เก็บ `uploadMeta.conflicts` เฉพาะเมื่อมีค่าขัดกันจริง
- หน้ารอตรวจแสดงบรรทัด "ที่มา: ไฟล์ • หน้า … • ช่วง n"

**`web/index.html`** — bump cache เป็น `cpd-upload.js?v=20261117b`

**เทสต์:** เพิ่ม 5 เทสต์ใน `tests/ai-staged.test.js` (split units / chunk coverage / merge precedence / chunked analyze / chunk failure) และ 2 เทสต์ใน `tests/upload-plan.test.js` (provenance / conflicts) → `npm run verify` ผ่าน **112/112**

**ต้อง deploy GAS ใหม่** (`analyzeUploadedFilesWithAI`) ก่อน chunking ทำงานบน production

**ยังไม่ทำในรอบนี้:** 1D (scan/vision batches + hash cache), Phase 2–3

---

## 8. สิ่งที่ควรทำก่อน (ถ้ามีเวลาจำกัด)

1. ✅ **ห้ามเขียนทับค่าที่มีอยู่** โดยไม่แสดง diff — ทำใน Phase 0
2. ✅ **แยก missing กับ 0** และเลิกใช้ `lowTextPdf` ลบศูนย์ทั้งงาน — ทำใน Phase 0
3. ✅ **ผูก uploadedSections กับปีบัญชี + runId** — ทำใน Phase 0
4. ✅ **เพิ่ม validation สมการบัญชี + รายได้ - ค่าใช้จ่าย = กำไร** — ทำใน Phase 0
5. ✅ **เพิ่มปีบัญชีของเอกสาร** และเตือนถ้าไม่ตรง — ทำใน Phase 0
6. **เพิ่มเทสต์ golden fixtures** จาก PDF จริง 3–5 ชุด — รอ Phase 1
7. **แสดงหลักฐานรายฟิลด์** อย่างน้อยไฟล์ + หน้า — รอ Phase 1

---

## 9. เทสต์ที่ควรเพิ่ม

- PDF ดิจิทัลปกติ / PDF สแกน / PDF หลายไฟล์
- เอกสารปีก่อนปนกับปีปัจจุบัน
- ตัวเลขในวงเล็บ, มีคำว่า "บาท", "ล้านบาท", เลขไทย
- ไฟล์เดียวกันอัปโหลดซ้ำ (hash เดิม)
- AI ตอบบางฟิลด์ / ตอบ `0` / ตอบค่าว่าง
- ไฟล์สองไฟล์ให้ค่าขัดกัน
- ตรวจว่า preload/ค่าที่ผู้ใช้ล็อกไม่ถูกเขียนทับ
- ตรวจว่า `summaryAnalysis` อ้างปัญหาที่มีอยู่จริง
- ตรวจว่า output ไม่มี `undefined`/`NaN`/`[object Object]`

---

## 10. ข้อสรุป

การอัพเกรดที่คุ้มที่สุดไม่ใช่การเปลี่ยนโมเดล AI แต่คือ **การเพิ่มชั้นป้องกันข้อมูล**:
อ่านให้ครบ → แยกความหมายให้ชัด → ตรวจความสอดคล้อง → ถามก่อนทับ → เก็บหลักฐานย้อนกลับ

ถ้าทำได้เพียงอย่างเดียว ให้เริ่มจาก **safe apply + diff + snapshot** เพราะป้องกันข้อมูลเสียหายได้ทันทีโดยไม่ต้องรื้อโครงสร้างเดิม

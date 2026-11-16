# เส้นทางข้อมูลหลังอัปโหลดไฟล์ (Upload Data Flow)

เอกสารนี้อธิบายว่าไฟล์ที่ผู้ใช้อัปโหลดถูกอ่านด้วยวิธีใด ถูกส่งไปให้ AI สกัดเป็นฟิลด์อะไร
และข้อมูลแต่ละฟิลด์ถูกนำไปใช้ในหน้าจอ/State/เอกสารส่วนใด

> หลักสำคัญ: **หมวดไฟล์ (ข้อมูลพื้นฐาน / งบการเงิน / ผลปิดบัญชี / ไฟล์อื่น ๆ) เป็นเพียงป้ายบอกบริบท**
> เนื้อหาทุกไฟล์ที่สกัดได้จะถูกส่งให้ AI ทั้งหมด AI จึงอาจดึงตัวเลขงบการเงินจากไฟล์ที่อยู่ในช่อง "ไฟล์อื่น ๆ" ได้
> ตาราง "แหล่งข้อมูลหลัก" ด้านล่างจึงหมายถึงแหล่งที่ปกติควรพบข้อมูลนั้น ไม่ใช่การบังคับ

---

## 1. ภาพรวมเส้นทางข้อมูล

```mermaid
flowchart TD
    A["ผู้ใช้อัปโหลดไฟล์ 4 ช่อง<br/>fileBasic / fileFinance / fileAudit / fileOther"] --> B["smartProcessFile()<br/>web/index.html"]
    B --> C{"ชนิดไฟล์"}
    C -->|"PDF มีข้อความ"| D["PDF.js: หน้า 1-5 + หน้าที่มีคำสำคัญ<br/>สูงสุด 25 หน้า / ~35,000 ตัวอักษร"]
    C -->|"PDF สแกน / รูปภาพ"| E["base64<br/>ตัดหน้าแรกตาม maxFallbackPages"]
    C -->|"DOC / DOCX / XLSX"| F["สกัดข้อความ<br/>ถ้าไม่ได้ส่งไฟล์ดิบ"]
    D --> G["profileExtract<br/>parseSmartCoopProfile()"]
    D --> H["payload.files"]
    E --> H
    F --> H
    H --> I["GAS: analyzeUploadedFilesWithAI()"]
    I --> J["ระยะ 1: facts<br/>ตัวเลข/ข้อเท็จจริง ~106 ฟิลด์"]
    J --> K["ระยะ 2: narrative<br/>บทวิเคราะห์ข้อ 1-3"]
    J --> L["ระยะ 3: summary<br/>บทวิเคราะห์ข้อ 4"]
    K --> L
    J --> M["result"]
    K --> M
    L --> M
    M --> N["CPD_UPLOAD.plan()<br/>field-level diff + validation"]
    G --> N
    N --> N2["CPD_UPLOAD.applyPlan()<br/>เติมเฉพาะ fill / zero / update"]
    N2 --> N3["หน้ารอตรวจ #uploadReview<br/>conflict / zeroReview / zeroConflict"]
    N2 --> N4["CPD_UPLOAD.commit()<br/>snapshot + uploadMeta"]
    N2 --> O["State: syncFromBaseFormToAllTabs()"]
    N3 --> O
    N4 --> O
    O --> P["คำนวณ financials / ratios / strength"]
    M --> Q["applyUploadedAnalysisNotes()"]
    Q --> R["หน้า 2: ข้อ 1-4"]
    O --> S["แผนกิจกรรม 5.2<br/>addWeaknessActivitiesFrom4M()"]
    O --> T["Dashboard + Early Warning"]
    O --> U["บันทึกร่าง / Word / PDF"]
```

### ตัวอย่างการตามรอยหนึ่งฟิลด์

`assetLatest` (ยอดสินทรัพย์รวม):

1. อ่านจากงบฐานะการเงินใน PDF → `extractedText`
2. GAS ระยะ 1 คืน `res.assetLatest`
3. `CPD_UPLOAD.plan()` ตัดสินสถานะของ `#asset_latest` (ว่าง → `fill`, มีค่าเดิม → `conflict`/`same`/`update`)
4. `CPD_UPLOAD.applyPlan()` เติมเฉพาะสถานะที่ปลอดภัย แล้ว `commit()` เก็บ snapshot
5. `syncFromBaseFormToAllTabs()` → `AppState.financials.summary2Years.assetsLatest`
6. `recalcFinancials()` คำนวณ `balanceSheet.totalAssets` และอัตราส่วน
7. Dashboard / Early Warning / ข้อ 1 (4M) / เอกสาร Word ใช้ค่าที่คำนวณแล้ว

---

## 2. วิธีอ่านไฟล์แต่ละชนิด

| ช่องอัปโหลด | `category` ที่ส่งไป GAS | วิธีอ่าน | เงื่อนไข/ข้อจำกัด |
| --- | --- | --- | --- |
| `fileBasic` | ข้อมูลพื้นฐาน | PDF.js / DOCX / XLSX / base64 | PDF สแกนจะถูกส่งเป็นภาพ |
| `fileFinance` | งบการเงิน/รายงานสอบบัญชี | PDF.js / DOCX / XLSX / base64 | PDF สแกนตัดไม่เกิน 6 หน้าแรก |
| `fileAudit` | ผลปิดบัญชี/ข้อสังเกต | PDF.js / DOCX / XLSX / base64 | PDF สแกนตัดไม่เกิน 5 หน้าแรก |
| `fileOther` | ไฟล์อื่น ๆ | PDF.js / DOCX / XLSX / base64 | PDF สแกนตัดไม่เกิน 5 หน้าแรก |

### PDF ที่มีข้อความ

- สแกนสูงสุด 25 หน้าแรก
- ใช้ข้อความจากหน้า 1-5 และหน้าที่พบคำสำคัญ เช่น `งบฐานะการเงิน`, `งบดุล`, `สินทรัพย์`, `หนี้สิน`, `ทุนเรือนหุ้น`, `ทุนสำรอง`, `งบกำไรขาดทุน`, `กำไรสุทธิ`, `ผู้สอบบัญชี`, `ผู้ตรวจสอบกิจการ`, `ข้อสังเกต`, `ข้อบกพร่อง`, `สมาชิก`, `คณะกรรมการ`, `จดทะเบียน`, `ปริมาณธุรกิจ`
- ตัดข้อความที่ ~35,000 ตัวอักษร
- ถ้าข้อความรวมมากกว่า 250 ตัวอักษร → ใช้ `extractedText` (ไม่ส่งไฟล์ PDF ทั้งก้อน)
- พร้อมกันนั้นเรียก `parseSmartCoopProfile()` เพื่อดึงข้อมูลใบโปรไฟล์ด้วย regex

### PDF สแกน / รูปภาพ

- ถ้าสกัดข้อความได้น้อย → ใช้ `pdf-lib` ตัดเฉพาะหน้าแรก ๆ แล้วส่งเป็น `base64`
- ติดธง `lowTextPdf: true` **เฉพาะไฟล์นั้น** (ธงรายไฟล์ ไม่ใช่ธงระดับงาน)
- ระยะ 2–3 ของ AI จะไม่ได้รับภาพซ้ำ ใช้ตัวเลขที่สกัดได้ในระยะ 1 แทน

### Metadata รายไฟล์ (Phase 0)

ทุกไฟล์ที่ผ่าน `smartProcessFile()` จะถูกแปลงด้วย `CPD_UPLOAD.normalizeFiles()` เป็น:

| ฟิลด์ | ความหมาย |
| --- | --- |
| `mode` | `text` / `doc` / `docx` / `xlsx` / `scan` / `image` / `binary` |
| `totalPages` / `pagesRead` | จำนวนหน้าทั้งไฟล์ / จำนวนหน้าที่อ่านจริง (ใช้เตือนเมื่ออ่านไม่ครบ) |
| `chars` | จำนวนตัวอักษรที่สกัดได้ |
| `truncated` | ข้อความถูกตัดที่ 35,000–40,000 ตัวอักษร |
| `lowTextPdf` | ไฟล์นี้เป็นสแกน/ภาพ (ใช้ตัดสิน `zero` vs `zeroReview`) |

Metadata นี้ถูกเก็บใน `analysis.uploadMeta.files` เพื่อให้ตรวจย้อนหลังได้ว่ารอบนั้นอ่านไฟล์ครบหรือไม่

---

## 3. AI 3 ระยะ

| ระยะ | อินพุต | เอาต์พุต | ถ้าล้มเหลว |
| --- | --- | --- | --- |
| 1. `facts` | ข้อความทุกไฟล์ + ภาพ/PDF สแกน | ตัวเลข/ข้อเท็จจริง ~106 ฟิลด์ | งานล้มทั้งก้อน |
| 2. `narrative` | ข้อความไฟล์ (ไม่รวมภาพ) + facts | `orgAnalysis4M`, `businessAnalysis`, `welfareAnalysis` | ยังได้ facts กลับ พร้อม `_aiWarnings` |
| 3. `summary` | facts + บทวิเคราะห์ข้อ 1-3 | `summaryAnalysis` | ยังได้ facts + ข้อ 1-3 กลับ พร้อม `_aiWarnings` |

---

## 4. ฟิลด์จาก AI → ปลายทาง

### 4.1 ข้อมูลองค์กรและพื้นฐาน → หน้า 1

| ฟิลด์จาก AI | ปลายทางในฟอร์ม | แหล่งข้อมูลหลัก |
| --- | --- | --- |
| `district` | `#district` | ใบโปรไฟล์/ข้อมูลทะเบียนสหกรณ์ |
| `regDate` | `#reg_date` | หนังสือรับรอง/ทะเบียนสหกรณ์ |
| `boardCount` | `#board_count` | รายงานประจำปี/ทะเบียนคณะกรรมการ |
| `auditorType` | `#auditor_type` + `onAuditorTypeChange()` | รายงานสอบบัญชี |
| `auditorName` | `#gov_auditor_name` หรือ `#priv_auditor_name` | รายงานสอบบัญชี |
| `fiscalDateFull` | `#fiscal_year` ผ่าน `setFiscalDropdownByText()` | งบการเงิน/รายงานสอบบัญชี |
| `inspectorCount` | `#inspector_count` | รายงานผู้ตรวจสอบกิจการ |
| `inspectorName` | `#inspector_name` | รายงานผู้ตรวจสอบกิจการ |
| `yrLatest`, `yrPrev` | `#yr_latest`, `#yr_prev` | งบการเงิน |
| `memLatest`, `memPrev` | `#mem_latest`, `#mem_prev` | รายงานสมาชิก/รายงานประจำปี |
| `fyCheckNote` | ไม่ผูกกับช่องกรอก | ใช้เป็นหมายเหตุการตรวจปีบัญชี |
| `assetNumeric` | ตัวแปร `currentAssetNumeric` | ใช้ตรวจสมการบัญชี |
| `recommendedVisits` | ไม่เขียนทับ `planned_visits` | เป็นเพียงข้อเสนอของ AI |

### 4.2 สรุปงบการเงิน 2 ปี → หน้า 1

| ฟิลด์จาก AI | ปลายทางในฟอร์ม | แหล่งข้อมูลหลัก |
| --- | --- | --- |
| `assetLatest`, `assetPrev` | `#asset_latest`, `#asset_prev` | งบฐานะการเงิน |
| `debtLatest`, `debtPrev` | `#debt_latest`, `#debt_prev` | งบฐานะการเงิน |
| `shareLatest`, `sharePrev` | `#share_latest`, `#share_prev` | งบฐานะการเงิน (เฉพาะทุนเรือนหุ้น) |
| `reserveLatest`, `reservePrev` | `#reserve_latest`, `#reserve_prev` | งบฐานะการเงิน (เฉพาะทุนสำรอง) |
| `profitLatest`, `profitPrev` | `#profit_latest`, `#profit_prev` | งบกำไรขาดทุน |
| `lossLatest`, `lossPrev` | `#loss_latest`, `#loss_prev` | งบกำไรขาดทุน/งบสะสม |
| `bizVolLatest`, `bizVolPrev` | `#biz_vol_latest`, `#biz_vol_prev` | รายงานปริมาณธุรกิจ |
| `businessTypes` | `#business_types` → `coopProfile.mainBusinesses` | รายงานประจำปี/ใบโปรไฟล์ |

### 4.3 ผลการดำเนินงานรายละเอียด → หน้า 1 (แท็บรายละเอียด)

ทุกฟิลด์มี Suffix `Latest` / `Prev` และเติมลงช่อง `_latest` / `_prev` ตาม `detailMap`

| กลุ่มฟิลด์จาก AI | ปลายทางในฟอร์ม | แหล่งข้อมูลหลัก |
| --- | --- | --- |
| `wc` | `#wc_latest`, `#wc_prev` | งบฐานะการเงิน/รายงานทุนดำเนินงาน |
| `coopCap` | `#coopcap_latest`, `#coopcap_prev` | งบฐานะการเงิน (ทุนของสหกรณ์) |
| `loan` | `#loan_latest`, `#loan_prev` | งบฐานะการเงิน (เงินกู้ยืม) |
| `payable` | `#payable_latest`, `#payable_prev` | งบฐานะการเงิน (เจ้าหนี้การค้า) |
| `cash` | `#cash_latest`, `#cash_prev` | งบฐานะการเงิน (เงินสด/เงินฝาก) |
| `inventory` | `#inventory_latest`, `#inventory_prev` | งบฐานะการเงิน (สินค้าคงเหลือ) |
| `ppe` | `#ppe_latest`, `#ppe_prev` | งบฐานะการเงิน (ที่ดิน อาคาร อุปกรณ์) |
| `receivable` | `#receivable_latest`, `#receivable_prev` | งบฐานะการเงิน (ลูกหนี้การค้า) |
| `otherAsset` | `#otherasset_latest`, `#otherasset_prev` | งบฐานะการเงิน (สินทรัพย์อื่น) |
| `income` | `#income_latest`, `#income_prev` | งบกำไรขาดทุน (รายได้รวม) |
| `expense` | `#expense_latest`, `#expense_prev` | งบกำไรขาดทุน (ต้นทุนและค่าใช้จ่ายรวม) |
| `salesTrading` | `#sales_trading_latest`, `#sales_trading_prev` | งบแยกธุรกิจจัดหาสินค้า |
| `costTrading` | `#cost_trading_latest`, `#cost_trading_prev` | งบแยกธุรกิจจัดหาสินค้า |
| `profitTrading` | `#profit_biz_trading_latest`, `#profit_biz_trading_prev` | งบแยกธุรกิจจัดหาสินค้า |
| `planTrading` | `#plan_trading_latest`, `#plan_trading_prev` | แผนงาน/ประมาณการธุรกิจจัดหาสินค้า |
| `salesProcessing` | `#sales_processing_latest`, `#sales_processing_prev` | งบแยกธุรกิจแปรรูป |
| `costProcessing` | `#cost_processing_latest`, `#cost_processing_prev` | งบแยกธุรกิจแปรรูป |
| `profitProcessing` | `#profit_biz_processing_latest`, `#profit_biz_processing_prev` | งบแยกธุรกิจแปรรูป |
| `planProcessing` | `#plan_processing_latest`, `#plan_processing_prev` | แผนงาน/ประมาณการธุรกิจแปรรูป |
| `depositAmount` | `#deposit_amount_latest`, `#deposit_amount_prev` | งบธุรกิจรับฝากเงิน |
| `profitDeposit` | `#profit_biz_deposit_latest`, `#profit_biz_deposit_prev` | งบธุรกิจรับฝากเงิน |
| `membersDeposit` | `#mem_biz_deposit_latest`, `#mem_biz_deposit_prev` | รายงานสมาชิกผู้ใช้บริการ |
| `membersTrading` | `#mem_biz_trading_latest`, `#mem_biz_trading_prev` | รายงานสมาชิกผู้ใช้บริการ |
| `membersProcessing` | `#mem_biz_processing_latest`, `#mem_biz_processing_prev` | รายงานสมาชิกผู้ใช้บริการ |
| `agmAttendees` | `#agm_attend_latest`, `#agm_attend_prev` | รายงานการประชุมใหญ่ |
| `avgProfit3` | `#avgprofit3_latest`, `#avgprofit3_prev` | รายงานผลดำเนินงานย้อนหลัง |
| `avgSaving` | `#avgsaving_latest`, `#avgsaving_prev` | รายงานสมาชิก/เงินออม |
| `avgDebt` | `#avgdebt_latest`, `#avgdebt_prev` | รายงานสมาชิก/หนี้สิน |
| `staffCount` | `#staff_count_latest`, `#staff_count_prev` | ใบโปรไฟล์/รายงานบุคลากร |

> ฟิลด์ `*Prev` บางค่าอาจถูกคำนวณฝั่งเบราว์เซอร์จาก `changes` ด้วย `applyClientDeltaFallback()`
> เมื่อ AI ส่งเฉพาะยอดปีล่าสุดและข้อความ "เพิ่มขึ้น/ลดลง"

### 4.4 ข้อสังเกต ปัญหา และสวัสดิการ → State (`analysis`)

| ฟิลด์จาก AI | ปลายทาง | แหล่งข้อมูลหลัก |
| --- | --- | --- |
| `issue1`, `issue2`, `issue3` | `#issue_1`–`#issue_3` → `analysis.issuesTop3` | รายงานสอบบัญชี/ข้อสังเกต |
| `promotionGoals` | `#promotion_goals` → `analysis.promotionGoals1to5` | แผนงานส่งเสริม |
| `targetProjects` | `#target_projects` → `analysis.targetProjects` | แผนงาน/โครงการ |
| `visitRemark` | `#visit_remark` → `analysis.planFooterNote` | หมายเหตุการเข้าส่งเสริม |
| `auditorObservations` | `analysis.auditorObservations` + `fourMDetails.auditorObservations.details` | รายงานสอบบัญชี |
| `auditorDefects` | `analysis.coopDefects` | รายงานสอบบัญชี/ข้อบกพร่อง |
| `auditorInternalControlWeakness` | `fourMDetails.auditorObservations.hasInternalControlWeakness` | รายงานสอบบัญชี/ควบคุมภายใน |
| `auditorWeaknessCategories` | `fourMDetails.auditorObservations.weaknessCategories` | รายงานสอบบัญชี |
| `auditorCorrectionStatus` | `fourMDetails.auditorObservations.correctionStatus` | รายงานสอบบัญชี |
| `businessObservations` | `analysis.businessObservations` | รายงานผลธุรกิจ/รายงานประจำปี |
| `businessSegments[]` | `financials.businesses` (`sales`, `cogs`, `grossProfit`, `netBusinessProfit`, …) | งบแยกธุรกิจ |
| `welfareObservations` | `analysis.welfareObservations` | ระเบียบสวัสดิการ/รายงานประจำปี |
| `publicBenefitObservations` | `analysis.publicBenefitObservations` | รายงานสาธารณประโยชน์ |
| `welfareFundAmount` | `analysis.welfareFundAmount` | ระเบียบ/รายงานการจัดสรรทุนสวัสดิการ |
| `publicBenefitFundAmount` | `analysis.publicBenefitFundAmount` | ระเบียบ/รายงานการจัดสรรทุนสาธารณประโยชน์ |

### 4.5 บทวิเคราะห์ 4 หัวข้อ → หน้า 2

| ฟิลด์จาก AI | State | แสดงที่ | ใช้อะไรสร้าง |
| --- | --- | --- | --- |
| `orgAnalysis4M` | `analysis.orgAnalysis4M` + `analysis.uploadedOrgAnalysis4M` | ข้อ 1 ด้านการบริหารจัดการองค์กร (4M + CAMELS) | ทุกไฟล์ + facts |
| `businessAnalysis` | `analysis.businessAnalysis` + `analysis.uploadedBusinessAnalysis` | ข้อ 2 ด้านการบริหารจัดการธุรกิจ | ทุกไฟล์ + facts + `businessSegments` |
| `welfareAnalysis` | `analysis.welfareAnalysis` + `analysis.uploadedWelfareAnalysis` | ข้อ 3 ด้านสวัสดิการและสาธารณประโยชน์ | ทุกไฟล์ + facts |
| `summaryAnalysis` | `analysis.summaryAnalysis` + `analysis.uploadedSummaryAnalysis` | ข้อ 4 สรุปผลการวิเคราะห์ | facts + บทวิเคราะห์ข้อ 1–3 |

`uploaded*` จะผูกกับ `analysis.uploadedSectionsCoop` เพื่อกันไม่ให้บทวิเคราะห์ของสหกรณ์หนึ่งไปแสดงกับอีกสหกรณ์หนึ่ง

### 4.6 ฟิลด์จากใบโปรไฟล์ Smart Coop (regex)

ใช้เฉพาะ PDF ที่มีข้อความพอ (`> 250` ตัวอักษร) และเติมเฉพาะช่องที่ยังว่าง

| กลุ่ม | ฟิลด์ |
| --- | --- |
| ฟอร์มพื้นฐาน | `asset_latest`, `share_latest`, `reserve_latest`, `accumfund_latest`, `profit_latest`, `biz_vol_latest`, `debt_latest`, `board_count`, `inspector_count`, `inspector_name`, `mem_latest`, `mem_prev`, `reg_date`, `fiscal_year`, `auditor_type`, `auditor_name`, `gov_auditor_name` |
| รายละเอียด | `cash_latest`, `inventory_latest`, `receivable_latest`, `otherasset_latest`, `ppe_latest`, `loan_latest`, `payable_latest`, `deposit_amount_latest`, `coopcap_latest`, `staff_count_latest` |

> ข้อมูลจาก regex จะถูกเติม **หลัง** ข้อมูลจาก AI และเฉพาะช่องว่างเท่านั้น

---

## 5. ข้อมูลที่ไม่ได้มาจาก AI โดยตรง

ข้อมูลเหล่านี้คำนวณ/สร้างจาก State หลังเติมฟอร์ม:

| ข้อมูล | ที่มา | ใช้ที่ |
| --- | --- | --- |
| `balanceSheet` | รวมจาก `summary2Years` และรายละเอียด | 4M, Dashboard, Early Warning |
| `ratios` (D/E, ROE, ROA, Current Ratio, Reserve/Asset, …) | `recalcFinancials()` | 4M + CAMELS, Dashboard |
| `strength.classByYear` / `totalByYear` | ฟอร์มคะแนน 2568/2569 หรือตัวชี้วัด | ข้อ 4, Dashboard |
| กิจกรรมแก้จุดอ่อน | `addWeaknessActivitiesFrom4M()` | แผนกิจกรรม 5.2 |
| ตาราง 12 เดือน | `generate12MonthSchedule()` | แผนกิจกรรม |
| ข้อ 1–4 กรณีไม่มีไฟล์ | `analyze4M()` แบบ rule-based | หน้า 2 |

---

## 6. ตัวป้องกันข้อมูลเสียหาย

### 6.1 นโยบาย merge รายฟิลด์ (Phase 0)

การเติมค่าจาก AI ไม่ได้เขียนทับตรง ๆ อีกต่อไป แต่สร้าง "แผน" (`CPD_UPLOAD.plan`) แล้วตัดสินทีละฟิลด์:

| สถานะ | เงื่อนไข | การกระทำ |
| --- | --- | --- |
| `missing` | AI ไม่พบ/ตอบว่าง/ขีด | ไม่แตะช่องเดิม |
| `locked` | ฟิลด์ที่ preload หรือผู้ใช้ล็อกไว้ | ไม่แตะ |
| `same` | ค่าเดิมตรงกับค่าใหม่ | ไม่ทำอะไร |
| `fill` | ช่องว่าง + มีค่าใหม่ | เติมอัตโนมัติ |
| `update` | ค่าเดิมเป็นผลจากรอบอัปโหลดก่อนหน้า | ทับได้อย่างปลอดภัย |
| `zero` | AI ตอบ `0` และไม่มีไฟล์สแกน | เติม + ติดธงให้ตรวจ |
| `zeroReview` | AI ตอบ `0` และมีไฟล์สแกน/ภาพ | **ไม่เติม** รอผู้ใช้ยืนยัน |
| `zeroConflict` | AI ตอบ `0` แต่ช่องมีค่าเดิม | **ไม่ทับ** รอผู้ใช้ยืนยัน |
| `conflict` | ค่าเดิมมีอยู่และต่างจากค่าใหม่ | **ไม่ทับ** รอผู้ใช้ยืนยัน |

หลักการ: **ไม่มีการเขียนทับค่าที่ไม่ว่างโดยไม่ผ่านการยืนยัน** และ `missing` ไม่ถูกลบออกจากช่องเดิม (แก้ปัญหาเดิมที่ AI ตอบ 0 แล้วลบเลขจริงทิ้ง)

### 6.2 Validation ก่อนเติม

`CPD_UPLOAD.validateProjected()` ตรวจชุดข้อมูลที่จะเติม:

- สมการบัญชี: สินทรัพย์ = หนี้สิน + ทุน (คลาดเคลื่อน > 0.5%)
- รายได้ − ค่าใช้จ่าย = กำไรสุทธิ (คลาดเคลื่อน > 1%)
- จำนวนสมาชิก: รวม = สามัญ + สมทบ
- ปีบัญชี: `yrLatest` / `yrPrev` เทียบกับปีแผน + `fyCheckNote` ที่บอกว่า "ไม่ตรง"
- ถ้าสมการบัญชีไม่ผ่าน → ระงับการเติมอัตโนมัติเฉพาะฟิลด์ที่เกี่ยวข้อง แล้วย้ายไปหน้ารอตรวจ

### 6.3 Snapshot / Rollback

| กลไก | ทำอะไร |
| --- | --- |
| `analysis.uploadMeta` | metadata รอบล่าสุด: `runId`, ปีบัญชี, ไฟล์, counts, สถานะรายฟิลด์, warnings |
| `analysis.uploadHistory` | snapshot ค่าก่อนเติม (เก็บ 5 รอบล่าสุด, idempotent ต่อ `runId`) |
| ปุ่ม "↩ ย้อนกลับผลอัปโหลดครั้งล่าสุด" | คืนค่าฟอร์มก่อนรอบนั้นและคืน `uploadMeta` ของรอบก่อน |
| หน้ารอตรวจ (`#uploadReview`) | ตาราง diff ค่าเดิม → ค่าใหม่ เลือกเองได้ทีละฟิลด์ |

### 6.4 ตัวป้องกันอื่น ๆ

| กลไก | ทำอะไร |
| --- | --- |
| Preload guard | ไม่เขียนทับบทวิเคราะห์/ตัวเลขที่ผ่านการตรวจสอบแล้วของสหกรณ์ preload |
| `applyClientDeltaFallback()` | คำนวณยอดปีก่อนจากข้อความเพิ่มขึ้น/ลดลง |
| `stripSectionHeadingText_()` | ตัดชื่อหัวข้อที่ AI พิมพ์ซ้ำกับป้าย textarea |
| `_aiWarnings` | แจ้งเมื่อระยะ 2–3 ล้ม แต่ยังใช้ผลระยะ 1 ได้ |
| `uploadedSectionsCoop` + `uploadedSectionsFiscalYear` | กันบทวิเคราะห์ข้ามสหกรณ์/ข้ามปีบัญชี |
| `uploadedSectionsRunId` / `uploadedSectionsStatus` | รู้ว่าบทวิเคราะห์มาจากรอบใด และเป็น `uploaded` หรือ `partial` |
| เตือนหัวข้อที่รอบใหม่ไม่มี | คงข้อความเดิมไว้และแจ้งว่าข้อ 1–4 ข้อใดไม่มีในรอบนี้ |

---

## 7. ไฟล์ต้นฉบับถูกเก็บไว้หรือไม่

ในเส้นทาง `analyzeUploadedFilesWithAI()` **ไม่มีการบันทึกไฟล์ต้นฉบับลง Google Drive**
สิ่งที่ถูกเก็บคือข้อความ/ตัวเลขที่สกัดได้ใน State และร่างที่บันทึกผ่าน `saveDraft`
(ยกเว้นฟังก์ชันอื่นของระบบที่แยกไปสร้าง/เก็บเอกสาร Word)

---

## 8. ถ้าจะเพิ่มฟิลด์ใหม่ ต้องแก้ที่ไหน

1. `gas/Code.gs` — เพิ่มใน `AI_FACT_STRING_FIELDS_` / `NUMBER` / `BOOLEAN`
2. `gas/Code.gs` — เพิ่มคำอธิบายใน prompt (ข้อ 19–22 หรือโครงสร้าง JSON)
3. `web/js/cpd-upload.js` — เพิ่มใน `MAIN_FIELDS` / `DETAIL_FIELDS` (`FIELD_DEFS`) พร้อม `id` ปลายทาง
4. `web/js/cpd-state.js` — map ค่าจากฟอร์มเข้า State
5. `web/js/cpd-ui.js` — ถ้าต้องใช้ในบทวิเคราะห์/Dashboard
6. `tests/` — เพิ่มเทสต์สัญญาฟิลด์ (`tests/upload-plan.test.js`)
7. เอกสารนี้ — อัปเดตตารางปลายทาง

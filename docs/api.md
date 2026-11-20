# API Contract (3-tab tracking app)

## Transport

| หัวข้อ | ค่า |
|---|---|
| Endpoint | `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec` |
| Method | `POST` |
| Content-Type | `text/plain;charset=utf-8` (จำเป็น เพื่อเลี่ยง CORS preflight) |
| Body | JSON UTF-8 |
| Response | JSON (`ContentService` + `MimeType.JSON`) |

Apps Script ไม่รองรับ `OPTIONS` ดังนั้นห้ามใช้ `application/json`
เพราะ browser จะส่ง preflight และล้มเหลว

## Request

```json
{
  "action": "rpc",
  "fn": "getDashboardSummaryData",
  "args": [{ "fiscalYear": "2570" }],
  "token": "optional-shared-token"
}
```

- `action`: `"rpc"` หรือ `"ping"`
- `fn`: ต้องอยู่ใน `RPC_ALLOWLIST`
- `args`: array ของ argument ตามลำดับของฟังก์ชัน
- `token`: ต้องตรงกับ Script Property `API_TOKEN` (ถ้าตั้งไว้)

> หน้าเว็บเรียกผ่าน `web/js/google-script-shim.js` ดังนั้นโค้ด frontend ใช้
> `google.script.run.getMasterCoopList()` / `.getDashboardSummaryData()` ได้ตามเดิม
> shim จะแปลงเป็น fetch ให้เอง

## Response

สำเร็จ:

```json
{ "ok": true, "result": { }, "ms": 1234 }
```

ผิดพลาด:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "ไม่อนุญาตให้เรียกฟังก์ชัน: xxx"
  }
}
```

`error.stack` จะมีเฉพาะเมื่อตั้ง `DEBUG=1`
ข้อความ error ผ่าน `redactSecrets_()` ก่อนส่งกลับเสมอ

## Error codes

| code | ความหมาย |
|---|---|
| `BAD_JSON` | body ไม่ใช่ JSON |
| `BAD_ACTION` | `action` ไม่ใช่ rpc/ping |
| `UNAUTHORIZED` | token ไม่ถูกต้อง |
| `FORBIDDEN` | ฟังก์ชันไม่อยู่ใน allowlist |
| `NOT_FOUND` | ไม่พบฟังก์ชัน |
| `PAYLOAD_TOO_LARGE` | body ใหญ่เกิน 64 KB |
| `INTERNAL` | ข้อผิดพลาดจากโค้ด |

## ฟังก์ชันที่เปิดอยู่ (RPC_ALLOWLIST)

เฉพาะ 2 ฟังก์ชันอ่านข้อมูล — ไม่มี endpoint เขียน/อัปโหลด/AI/สร้าง Doc อีกต่อไป

| fn | args | คืนค่า |
|---|---|---|
| `getMasterCoopList` | — | array ของสหกรณ์ + คะแนนความเข้มแข็ง (ชีตจริงชนะข้อมูลสำรอง) |
| `getDashboardSummaryData` | `{ fiscalYear, promotionZone?, district?, coopType?, primaryOfficer? }` | KPI, zones, classDistribution, dimAverages, filterOptions และ rows |

`ping` เป็น action พิเศษ (ไม่ใช่ RPC) ใช้ตรวจว่าสคริปต์พร้อม — คืน `{ pong: true, at, ms }`

### หมายเหตุ

- Dashboard รองรับตัวกรอง 5 ช่อง; ค่าว่างหมายถึงไม่กรองช่องนั้น
- ถ้า RPC ล้มเหลว frontend ใช้ `masterCoops` + `CPD_AppState` เป็นข้อมูลสำรอง
  (`fallbackDashboard()` ใน `web/js/cpd-ui.js`) และแสดง badge แจ้งเตือน
- `clearPlanAiData_()` ใน `gas/CPD_Database.gs` เป็น **editor-only** —
  เรียกจาก Apps Script editor เพื่อล้างเฉพาะคอลัมน์ JSON ของแผน/AI ครั้งเดียว
  **ไม่อยู่ใน `RPC_ALLOWLIST`** จึงเรียกจากเว็บไม่ได้
- ฟังก์ชันเดิมที่ถูกลบ (ห้ามเพิ่มกลับโดยไม่ได้รับอนุมัติ):
  `saveDraftToSheet`, `analyzeUploadedFilesWithAI`, `startAiAnalysisJob`,
  `stepAiAnalysisJob`, `generatePlanDocument`, `saveCompleteCoopRecord`, `getCompleteCoopRecord`

## ตัวอย่าง curl

```bash
API_URL="https://script.google.com/macros/s/XXXX/exec"

# ping
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain;charset=utf-8" \
  --data '{"action":"ping"}'

# เรียกฟังก์ชัน
curl -L -X POST "$API_URL" \
  -H "Content-Type: text/plain;charset=utf-8" \
  --data '{
    "action": "rpc",
    "fn": "getMasterCoopList",
    "args": [],
    "token": "YOUR_TOKEN"
  }'
```

> `-L` จำเป็น เพราะ Apps Script ตอบ 302 ไปยัง `script.googleusercontent.com`

## วิธีเพิ่ม endpoint ใหม่ (ต้องได้รับอนุมัติก่อน)

1. เขียนฟังก์ชัน global ใน `gas/` ที่ **อ่านอย่างเดียว** และมี `try...catch`
2. เพิ่มชื่อใน `RPC_ALLOWLIST` ที่ `gas/Api.gs` และใน `resolveRpc_()`
3. เพิ่มชื่อฟังก์ชันใน `tests/contract.test.js` (allowlist ต้องตรงกับของจริง)
4. ฝั่ง frontend เรียกผ่าน shim:
   ```js
   google.script.run
     .withSuccessHandler(function (rows) { /* ... */ })
     .withFailureHandler(function (err) { console.error(err); })
     .getMyNewReadFunction({ year: 2570 });
   ```
5. อัปเดตตารางด้านบน + `docs/architecture.md`

## ข้อควรระวัง

- ฟังก์ชันที่เปิดต้อง **idempotent** (read-only ดีที่สุด) — ห้ามเขียนข้อมูลโดยไม่มี lock
- อย่าเปิดฟังก์ชันที่รับชื่อฟังก์ชันอื่นมาทำงานต่อ (เช่น `eval`, `this[arg]`)
  เพราะจะกลายเป็น remote code execution
- อย่าคืนข้อมูลทั้ง Sheet โดยไม่กรอง — ข้อมูลส่วนบุคคลอาจหลุด
- งานที่ใช้เวลานาน (> 60 วิ) ควรแยกเป็น job + polling หรือใช้ trigger
  (แต่ระบบปัจจุบันไม่มี job — ทุก RPC ควรจบใน 30 วินาที)

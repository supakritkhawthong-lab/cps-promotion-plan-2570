# API Contract

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
  "fn": "getMasterCoopList",
  "args": [],
  "token": "optional-shared-token"
}
```

- `action`: `"rpc"` หรือ `"ping"`
- `fn`: ต้องอยู่ใน `RPC_ALLOWLIST`
- `args`: array ของ argument ตามลำดับของฟังก์ชัน
- `token`: ต้องตรงกับ Script Property `API_TOKEN` (ถ้าตั้งไว้)

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

## Error codes

| code | ความหมาย |
|---|---|
| `BAD_JSON` | body ไม่ใช่ JSON |
| `BAD_ACTION` | `action` ไม่ใช่ rpc/ping |
| `UNAUTHORIZED` | token ไม่ถูกต้อง |
| `FORBIDDEN` | ฟังก์ชันไม่อยู่ใน allowlist |
| `NOT_FOUND` | ไม่พบฟังก์ชัน |
| `PAYLOAD_TOO_LARGE` | body ใหญ่เกินกำหนด |
| `INTERNAL` | ข้อผิดพลาดจากโค้ด |

## ฟังก์ชันที่เปิดอยู่

| fn | args | คืนค่า |
|---|---|---|
| `getMasterCoopList` | — | array ของสหกรณ์ + คะแนน + draft |
| `saveDraftToSheet` | `form` | `{ savedAt }` |
| `analyzeUploadedFilesWithAI` | `payload` | object ผลสกัดจาก AI |
| `generatePlanDocument` | `form` | `{ fileName, fileData, mimeType }` |

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

## วิธีเพิ่ม endpoint ใหม่

1. เขียนฟังก์ชัน global ใน `gas/` (เช่น `getPlanHistory`)
2. เพิ่มชื่อใน `RPC_ALLOWLIST` ที่ `gas/Api.gs`
3. ฝั่ง frontend เรียกผ่าน shim:
   ```js
   google.script.run
     .withSuccessHandler(function (rows) { /* ... */ })
     .withFailureHandler(function (err) { console.error(err); })
     .getPlanHistory({ year: 2570 });
   ```
4. เขียน doc ในตารางด้านบน

## ข้อควรระวัง

- ฟังก์ชันที่เปิดต้อง **idempotent หรือมี lock** ถ้าเขียนข้อมูล
- อย่าเปิดฟังก์ชันที่รับชื่อฟังก์ชันอื่นมาทำงานต่อ (เช่น `eval`, `this[arg]`)
  เพราะจะกลายเป็น remote code execution
- อย่าคืนข้อมูลทั้ง Sheet โดยไม่กรอง — ข้อมูลส่วนบุคคลอาจหลุด
- งานที่ใช้เวลานาน (> 60 วิ) ควรแยกเป็น job + polling หรือใช้ trigger

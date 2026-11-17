/**
 * gas/GroupStrength69.gs
 * ชุดข้อมูลคะแนนความเข้มแข็งของกลุ่มเกษตรกร ปี 2569 (ชลบุรี)
 * แหล่งข้อมูล: เข้มแข็งกลุ่มเกษตรกร ผลปี 2569.xls (ชีต final_score_kk_agri_y69)
 *
 * ใช้เป็นข้อมูลสำรอง (fallback) เฉพาะเมื่อชีต 'ผลปี69' ใน Google Sheets
 * ยังไม่มีคะแนนที่ใช้งานได้ของกลุ่มเกษตรกรรายนั้น — ข้อมูลจากชีตจริงต้องชนะเสมอ
 *
 * หมายเหตุคอลัมน์: ไฟล์ต้นทางมีคอลัมน์พิเศษ "แบบภาพรวมสำหรับที่ไม่เข้าหลักเกณฑ์"
 * อยู่ก่อนคอลัมน์รวมคะแนนมิติที่ 3 จึงแมปค่านี้เป็น s3_5 เพื่อให้ผลรวมมิติที่ 3 ตรงกับไฟล์
 */

const GROUP_STRENGTH_69_DATA = [
  {
    name: 'กลุ่มเกษตรกรทำนาทุ่งขวาง', code13: '2001000125249', groupType: 'ทำนา',
    d1: 29, d2: 18.67, d3: 6.67, d4: 26, total: 80.34, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 2.67, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำนามาบโป่ง', code13: '2001000225226', groupType: 'ทำนา',
    d1: 29, d2: 20, d3: 6.67, d4: 26, total: 81.67, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 7, s2_6: 0,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำนาวัดหลวง', code13: '2001000125223', groupType: 'ทำนา',
    d1: 29, d2: 18.67, d3: 6.67, d4: 26, total: 80.34, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 2.67, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำนาวัดโบสถ์', code13: '2001000225167', groupType: 'ทำนา',
    d1: 28, d2: 14.66, d3: 6.67, d4: 26, total: 75.33, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 2, s2_3: 1.33, s2_4: 1.33, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำนาหนองซ้ำซาก', code13: '2001000325186', groupType: 'ทำนา',
    d1: 29, d2: 20, d3: 6.67, d4: 26, total: 81.67, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำนาโคกเพลาะ', code13: '2001000325199', groupType: 'ทำนา',
    d1: 29, d2: 20, d3: 6.67, d4: 26, total: 81.67, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำสวนศรีราชา', code13: '2001000125207', groupType: 'ทำสวน',
    d1: 25, d2: 20, d3: 6.67, d4: 26, total: 77.67, level: 'ชั้น 2',
    fiscalYear: '31 กรกฎาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 กรกฎาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 12, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำไร่บางละมุง', code13: '2001000225196', groupType: 'ทำไร่',
    d1: 19, d2: 18.67, d3: 6.67, d4: 26, total: 70.34, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 3', prevFiscalYear: '31 มีนาคม', prevCompare: 'ยกระดับ',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 0.67, s2_3: 4, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำไร่บึง', code13: '2001000125164', groupType: 'ทำไร่',
    d1: 19, d2: 16, d3: 6.67, d4: 29, total: 70.67, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 2, s2_3: 1.33, s2_4: 2.67, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 10, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำไร่บ้านบึง', code13: '2001000425189', groupType: 'ทำไร่',
    d1: 29, d2: 16, d3: 6.67, d4: 26, total: 77.67, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 1.33, s2_4: 2.67, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำไร่หนองขยาด', code13: '2001000225255', groupType: 'ทำไร่',
    d1: 29, d2: 20, d3: 6.67, d4: 26, total: 81.67, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำไร่หนองหงษ์', code13: '2001000525182', groupType: 'ทำไร่',
    d1: 29, d2: 18.67, d3: 6.67, d4: 26, total: 80.34, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 2.67, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำไร่เกษตรสุวรรณ', code13: '2001000125412', groupType: 'ทำไร่',
    d1: 29, d2: 16, d3: 6.67, d4: 26, total: 77.67, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 2.67, s2_4: 1.33, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำไร่เขาไม้แก้ว', code13: '2001000125454', groupType: 'ทำไร่',
    d1: 19, d2: 18.67, d3: 6.67, d4: 26, total: 70.34, level: 'ชั้น 2',
    fiscalYear: '31 มีนาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '31 มีนาคม', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 2, s2_3: 2.67, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำประมงทุ่งสุขลา', code13: '2001000125281', groupType: 'ประมง',
    d1: 28, d2: 18, d3: 6.67, d4: 26, total: 78.67, level: 'ชั้น 2',
    fiscalYear: '30 กันยายน', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '30 กันยายน', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 1.33, s2_3: 4, s2_4: 2.67, s2_5: 7, s2_6: 0,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำประมงบางพระ', code13: '2001000225385', groupType: 'ประมง',
    d1: 14, d2: 14.66, d3: 6.67, d4: 26, total: 61.33, level: 'ชั้น 3',
    fiscalYear: '30 กันยายน', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 3', prevFiscalYear: '30 กันยายน', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 6, s1_2: 8, s1_3: 0, s2_1: 3, s2_2: 2, s2_3: 1.33, s2_4: 1.33, s2_5: 7, s2_6: 0,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำประมงบางเสร่', code13: '2001000325173', groupType: 'ประมง',
    d1: 20, d2: 18.67, d3: 13.33, d4: 30, total: 82, level: 'ชั้น 2',
    fiscalYear: '30 กันยายน', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 13.33, prevLevel: 'ชั้น 2', prevFiscalYear: '30 กันยายน', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 2.67, s2_5: 7, s2_6: 0,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 13.33, s4_1: 10, s4_2: 10, s4_3: 7, s4_4: 3
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำประมงมะขามหย่ง', code13: '2001000125382', groupType: 'ประมง',
    d1: 19, d2: 14.66, d3: 6.67, d4: 29, total: 69.33, level: 'ชั้น 2',
    fiscalYear: '30 กันยายน', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 3', prevFiscalYear: '30 กันยายน', prevCompare: 'ยกระดับ',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 2, s2_3: 1.33, s2_4: 1.33, s2_5: 7, s2_6: 0,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 10, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรทำประมงอ่างศิลา', code13: '2001000125177', groupType: 'ประมง',
    d1: 20, d2: 20, d3: 6.67, d4: 27, total: 73.67, level: 'ชั้น 2',
    fiscalYear: '30 กันยายน', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 3', prevFiscalYear: '30 กันยายน', prevCompare: 'ยกระดับ',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 3
    }
  },
  {
    name: 'กลุ่มเกษตรกรผู้เลี้ยงสัตว์น้ำบางปลาสร้อย', code13: '2001000225183', groupType: 'ประมง',
    d1: 20, d2: 20, d3: 6.67, d4: 26, total: 72.67, level: 'ชั้น 2',
    fiscalYear: '31 ธันวาคม', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 3', prevFiscalYear: '31 ธันวาคม', prevCompare: 'ยกระดับ',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 7, s2_6: 0,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 7, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรเพาะเลี้ยงสัตว์น้ำชายฝั่งอ่างศิลา', code13: '2001000325447', groupType: 'ประมง',
    d1: 19, d2: 19.33, d3: 6.67, d4: 19, total: 64, level: 'ชั้น 3',
    fiscalYear: '30 กันยายน', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญไม่ได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '30 กันยายน', prevCompare: 'รักษาระดับไม่ได้',
    subScores: {
      s1_1: 6, s1_2: 12, s1_3: 1, s2_1: 3, s2_2: 1.33, s2_3: 4, s2_4: 4, s2_5: 7, s2_6: 0,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 7, s4_3: 0, s4_4: 2
    }
  },
  {
    name: 'กลุ่มเกษตรกรผู้เลี้ยงสัตว์น้ำบ้านหัวไผ่', code13: '2001000125210', groupType: 'เลี้ยงสัตว์',
    d1: 29, d2: 20, d3: 6.67, d4: 29, total: 84.67, level: 'ชั้น 2',
    fiscalYear: '30 กันยายน', closeStatus: 'ปิดบัญชีได้', agmStatus: 'ประชุมใหญ่สามัญได้', cadNote: '-',
    specialDim3: 6.67, prevLevel: 'ชั้น 2', prevFiscalYear: '30 กันยายน', prevCompare: 'รักษาระดับได้',
    subScores: {
      s1_1: 15, s1_2: 12, s1_3: 2, s2_1: 3, s2_2: 2, s2_3: 4, s2_4: 4, s2_5: 3, s2_6: 4,
      s3_1: 0, s3_2: 0, s3_3: 0, s3_4: 0, s3_5: 6.67, s4_1: 10, s4_2: 10, s4_3: 7, s4_4: 2
    }
  }
];

// ชื่อในระบบและในไฟล์ต่างกันหนึ่งราย (เลี้ยง/ลี้ยง) — แมปชื่อระบบไปยังชื่อไฟล์
const GROUP_STRENGTH_69_NAME_ALIASES = {
  'กลุ่มเกษตรกรผู้ลี้ยงสัตว์น้ำบางปลาสร้อย': 'กลุ่มเกษตรกรผู้เลี้ยงสัตว์น้ำบางปลาสร้อย'
};

const GROUP_STRENGTH_69_SOURCE = 'bundled-group-strength-69';

/** ตัดช่องว่างซ้ำและหัวท้ายของชื่อกลุ่ม/สหกรณ์ */
function normalizeGroupStrengthName_(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

/** แปลงค่าเป็นตัวเลขแบบปลอดภัย (ค่าว่าง/ไม่ใช่ตัวเลข → 0) */
function groupStrength69Num_(value) {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/** ค้นหาชุดข้อมูลคะแนนของกลุ่มเกษตรกรจากชื่อ (รองรับ alias) */
function getGroupStrength69Record_(name) {
  const target = normalizeGroupStrengthName_(name);
  if (!target) return null;

  const alias = GROUP_STRENGTH_69_NAME_ALIASES[target] || target;
  for (let i = 0; i < GROUP_STRENGTH_69_DATA.length; i++) {
    const rec = GROUP_STRENGTH_69_DATA[i];
    const recName = normalizeGroupStrengthName_(rec.name);
    if (recName === target || recName === alias) return rec;
  }
  return null;
}

/** true เมื่อผลปี 2569 มีคะแนนที่ใช้งานได้ (ไม่ใช่แค่ชื่อชั้นหรือค่าว่าง) */
function hasStrengthScore69_(score) {
  const s = score || {};
  return !!(groupStrength69Num_(s.total) ||
    groupStrength69Num_(s.d1) || groupStrength69Num_(s.d2) ||
    groupStrength69Num_(s.d3) || groupStrength69Num_(s.d4));
}

/** สร้าง score69 ให้มีโครงเดียวกับที่อ่านจากชีต 'ผลปี69' */
function buildGroupScore69_(record) {
  if (!record) return null;

  const subScores = record.subScores || {};
  const total = groupStrength69Num_(record.total);
  const level = String(record.level || '').replace(/ชั้น\s*/, 'ชั้น ').trim() || 'ชั้น 3';

  return {
    code13: String(record.code13 || ''),
    coopType: 'กลุ่มเกษตรกร',
    groupType: String(record.groupType || ''),
    d1: groupStrength69Num_(record.d1),
    d2: groupStrength69Num_(record.d2),
    d3: groupStrength69Num_(record.d3),
    d4: groupStrength69Num_(record.d4),
    total: total,
    level: level,
    fy: record.fiscalYear || '31 มีนาคม',
    closeStatus: String(record.closeStatus || ''),
    agmStatus: String(record.agmStatus || ''),
    cadNote: String(record.cadNote || ''),
    subScores: subScores,
    specialDim3: groupStrength69Num_(record.specialDim3),
    source: GROUP_STRENGTH_69_SOURCE,
    simResult: evaluateCoopStrengthAndGap('กลุ่มเกษตรกร', subScores, level, total)
  };
}

/**
 * ข้อมูลปี 2568 ที่มีในไฟล์มีเพียงระดับชั้น (ไม่มีคะแนนรวม/มิติ)
 * จึงคืนเฉพาะ metadata ที่ไม่แต่งตัวเลขขึ้นเอง
 */
function buildGroupScore68Meta_(record) {
  if (!record || !record.prevLevel) return {};
  return {
    code13: String(record.code13 || ''),
    coopType: 'กลุ่มเกษตรกร',
    level: String(record.prevLevel || '').replace(/ชั้น\s*/, 'ชั้น ').trim(),
    fy: record.prevFiscalYear || ''
  };
}

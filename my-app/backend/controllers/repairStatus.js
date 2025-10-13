
module.exports = {
  NEW: "new",               // แจ้งซ่อมใหม่ (ยังไม่ได้มอบหมาย)
  ASSIGNED: "assigned",     // มอบหมายให้ช่างแล้ว
  IN_PROGRESS: "in_progress", // ช่างเริ่มทำงานแล้ว
  DONE: "done",             // งานเสร็จสิ้น
  REJECTED: "rejected",     // แอดมินปฏิเสธงาน
  CANCELLED: "cancelled",   // ยกเลิกโดยผู้เช่า/แอดมิน
};

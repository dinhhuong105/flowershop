// Cấu hình giao hàng và đặt hàng (mục 1 + 4 đặc tả Ngày 5).
//
// Các giá trị dưới đây là MẶC ĐỊNH TẠM do Claude đặt — Henry cần xác nhận
// hoặc sửa trước khi mở bán thật: giờ làm việc, khung giờ giao, thời gian
// chuẩn bị tối thiểu, "giao trong ngày", số ngày đặt trước tối đa, khu
// vực giao và phí (4 khu vực mẫu trong DB chưa phải dữ liệu thật).
// Đổi các giá trị này không cần sửa mã xử lý.

export const deliveryConfig = {
  timezone: "Asia/Ho_Chi_Minh",
  openTime: "07:30",
  closeTime: "21:00",
  minLeadMinutes: 120, // thời gian chuẩn bị tối thiểu
  sameDayDeliverBy: "18:00",
  maxAdvanceDays: 30,
  slots: [
    { id: "08-10", label: "08:00 – 10:00", start: "08:00" },
    { id: "10-12", label: "10:00 – 12:00", start: "10:00" },
    { id: "13-15", label: "13:00 – 15:00", start: "13:00" },
    { id: "15-17", label: "15:00 – 17:00", start: "15:00" },
    { id: "17-19", label: "17:00 – 19:00", start: "17:00" },
  ],
  methods: [
    {
      id: "EXPRESS_2H",
      label: "Giao nhanh trong 2 giờ",
      description: "Giao trong vòng 2 giờ kể từ lúc đặt",
      surcharge: 0,
      enabled: true,
    },
    {
      id: "SAME_DAY",
      label: "Giao trong ngày",
      description: "Giao trong ngày, trước 18:00",
      surcharge: 0,
      enabled: true,
    },
    {
      id: "SCHEDULED",
      label: "Hẹn ngày giờ giao",
      description: "Chọn ngày và khung giờ giao mong muốn",
      surcharge: 0,
      enabled: true,
    },
  ],
  orderRateLimit: { perPhone: 5, windowMinutes: 60 },
} as const;

export type DeliveryMethodId = (typeof deliveryConfig.methods)[number]["id"];

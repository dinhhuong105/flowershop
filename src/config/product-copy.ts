// Nội dung chữ cho trang chi tiết sản phẩm (mục 5.2 đặc tả Ngày 4).
// NHÁP — do Muse tự viết theo những gì shop thực sự làm được (không nhắc
// đăng nhập Zalo, tích điểm hay tính năng chưa có). CHỜ HENRY DUYỆT trước
// khi coi là nội dung chính thức; xem báo cáo Ngày 4.

export const productAdvice = {
  // Đoạn dẫn nhập của khối "Tư vấn chọn {tên}".
  intro: (name: string, shop: string) =>
    `${name} là lựa chọn của ${shop} cho những dịp cần một món quà chỉn chu. ` +
    `Bên dưới là vài gợi ý để bạn chọn đúng mẫu, đúng thời điểm trao tặng.`,

  // Một câu riêng cho từng danh mục, dùng trong đoạn dẫn nhập.
  byCategory: {
    "hoa-tuoi":
      "Hoa tươi được cắm trong ngày, nên bạn cứ chọn theo màu hoa và lời nhắn muốn gửi.",
    "gio-trai-cay":
      "Giỏ trái cây vừa làm quà thăm hỏi vừa làm quà chúc mừng, chọn theo người nhận là đủ.",
    "hop-trai-cay":
      "Hộp trái cây nhỏ gọn, tiện mang theo và chia sẻ cùng mọi người.",
    "lan-ho-diep":
      "Lan hồ điệp chơi được lâu, nên chọn chậu theo không gian đặt và dịp tặng.",
  } as Record<string, string>,

  // Tiểu mục 1: "Chọn theo người nhận".
  recipient: (name: string) =>
    `Để ${name} mang dấu ấn riêng, bạn có thể chuẩn bị lời nhắn đi kèm và ` +
    `cho shop biết tông màu người nhận thích. Nếu muốn điều chỉnh hoa hoặc ` +
    `cách gói, hãy xác nhận phương án cùng giá trước khi đặt.`,

  // Tiểu mục 2: "Chọn thời điểm trao tặng".
  timing: (name: string) =>
    `Khi gửi ${name} đến nhà hoặc nơi làm việc, ghi rõ người nhận, số điện thoại, ` +
    `địa chỉ và thời gian có thể nhận. Nếu trao tại buổi lễ, cho shop biết ` +
    `giờ bắt đầu để kiểm tra lịch làm hoa cho kịp.`,

  // Khối "Đặt {tên} tại {tên shop}": các bước đúng với quy trình hiện có.
  orderSteps: (name: string, shop: string) => [
    `Chọn đúng mẫu ${name}, kiểm tra giá và số lượng trên trang.`,
    `Nhập thông tin người nhận, ngày giờ giao và lời nhắn trên thiệp.`,
    `Thanh toán khi nhận hàng (COD) hoặc chuyển khoản, không cần đăng nhập hay tạo tài khoản.`,
    `${shop} xác nhận đơn rồi mới làm hoa và giao đúng hẹn.`,
  ],
};

// 4 câu hỏi chung cho khối "Giải đáp trước khi đặt hàng". Chỉ viết những
// điều đúng với tính năng đã có; không nêu số liệu chính sách chưa có.
export const productFaq: Array<{ q: string; a: string }> = [
  {
    q: "Tôi có thể ghi lời nhắn lên thiệp không?",
    a: "Có. Khi đặt hàng, bạn ghi lời nhắn vào ô \"Lời nhắn trên thiệp\"; shop sẽ viết thiệp kèm theo món quà.",
  },
  {
    q: "Tôi chọn ngày giờ giao như thế nào?",
    a: "Ở bước thanh toán, bạn chọn ngày giao và khung giờ giao mong muốn. Shop giao hoa trong ngày theo khung giờ bạn chọn.",
  },
  {
    q: "Tôi muốn điều chỉnh mẫu hoa thì làm sao?",
    a: "Bạn ghi rõ yêu cầu điều chỉnh (màu hoa, cách gói, thêm bớt) vào ô ghi chú khi đặt hàng, hoặc liên hệ shop để xác nhận phương án cùng giá trước khi chốt.",
  },
  {
    q: "Ảnh trên trang có giống hoa thật không?",
    a: "Ảnh là ảnh minh họa của mẫu hoa. Hoa tươi theo mùa nên màu sắc và cách cắm có thể khác đôi chút, nhưng shop luôn giữ đúng tông màu và dáng mẫu bạn đã chọn.",
  },
];

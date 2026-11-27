import { PrismaClient } from "@prisma/client";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { isProductionDatabaseUrl, shouldSeed } from "@/lib/seed-guard";
import { seedDefaultSettings } from "@/lib/settings";
import { seedDefaultPages } from "@/lib/admin/pages";

const prisma = new PrismaClient();

// Ảnh dùng chung cho toàn bộ sản phẩm mẫu (ảnh minh họa tự vẽ, không dùng ảnh thật của shop khác).
const PLACEHOLDER_IMAGE = "/images/placeholder.svg";

// Danh mục mẫu theo đúng bảng 4.1 của đặc tả Ngày 1.
const categories = [
  { slug: "hoa-tuoi", name: "Hoa tươi", sortOrder: 1 },
  { slug: "gio-trai-cay", name: "Giỏ trái cây", sortOrder: 2 },
  { slug: "hop-trai-cay", name: "Hộp trái cây", sortOrder: 3 },
  { slug: "lan-ho-diep", name: "Lan hồ điệp", sortOrder: 4 },
];

// Sản phẩm mẫu theo đúng bảng 4.2 của đặc tả Ngày 1.
// Mô tả: 1–2 câu tiếng Việt tự viết cho từng sản phẩm (mục 3.17).
const products: Array<{
  slug: string;
  name: string;
  categorySlug: string;
  description: string;
  price: number;
  salePrice: number | null;
  tags: string[];
  isFastDelivery: boolean;
  sortOrder: number;
}> = [
  { slug: "bo-hong-do-tinh-yeu", name: "Bó Hồng Đỏ Tình Yêu", categorySlug: "hoa-tuoi", description: "Bó hồng đỏ tươi thắm, biểu tượng cho tình yêu nồng nàn. Thích hợp tặng người thương vào dịp sinh nhật hay kỷ niệm.", price: 890000, salePrice: 801000, tags: ["tinh-yeu", "sinh-nhat"], isFastDelivery: true, sortOrder: 1 },
  { slug: "bo-hong-phan-diu-dang", name: "Bó Hồng Phấn Dịu Dàng", categorySlug: "hoa-tuoi", description: "Sắc hồng phấn nhẹ nhàng, dịu dàng như lời tỏ tình đầu. Bó hoa mang vẻ đẹp tinh tế, nữ tính.", price: 750000, salePrice: null, tags: ["tinh-yeu", "sinh-nhat"], isFastDelivery: true, sortOrder: 2 },
  { slug: "bo-huong-duong-rang-ro", name: "Bó Hướng Dương Rạng Rỡ", categorySlug: "hoa-tuoi", description: "Hoa hướng dương vàng rực, mang năng lượng tươi sáng và niềm vui. Món quà chúc mừng đầy sức sống.", price: 650000, salePrice: 585000, tags: ["chuc-mung", "sinh-nhat"], isFastDelivery: true, sortOrder: 3 },
  { slug: "bo-cam-tu-cau-xanh-mat", name: "Bó Cẩm Tú Cầu Xanh Mát", categorySlug: "hoa-tuoi", description: "Cẩm tú cầu xanh mát xếp thành bó tròn đầy, sang trọng. Thích hợp làm quà chúc mừng khai trương hay tân gia.", price: 980000, salePrice: null, tags: ["chuc-mung"], isFastDelivery: false, sortOrder: 4 },
  { slug: "gio-hoa-hong-cam-ruc-ro", name: "Giỏ Hoa Hồng Cam Rực Rỡ", categorySlug: "hoa-tuoi", description: "Giỏ hoa hồng cam rực rỡ, nổi bật và tràn đầy sức sống. Quà tặng sinh nhật ấn tượng, khó quên.", price: 1650000, salePrice: 1485000, tags: ["sinh-nhat", "chuc-mung"], isFastDelivery: true, sortOrder: 5 },
  { slug: "gio-hoa-mix-pastel", name: "Giỏ Hoa Mix Pastel", categorySlug: "hoa-tuoi", description: "Giỏ hoa phối màu pastel nhẹ nhàng, hài hòa và tinh tế. Phù hợp tặng sinh nhật cho người thân yêu.", price: 1450000, salePrice: null, tags: ["sinh-nhat"], isFastDelivery: true, sortOrder: 6 },
  { slug: "lang-hoa-khai-truong-hong-phat", name: "Lẵng Hoa Khai Trương Hồng Phát", categorySlug: "hoa-tuoi", description: "Lẵng hoa khai trương rực rỡ, gửi lời chúc hồng phát, làm ăn phát đạt. Thiết kế sang trọng, nổi bật tại buổi lễ.", price: 1750000, salePrice: 1575000, tags: ["khai-truong"], isFastDelivery: true, sortOrder: 7 },
  { slug: "ke-hoa-khai-truong-vang-ruc", name: "Kệ Hoa Khai Trương Vàng Rực", categorySlug: "hoa-tuoi", description: "Kệ hoa khai trương sắc vàng rực rỡ, tượng trưng cho tài lộc và thành công. Điểm nhấn ấn tượng cho ngày khai trương.", price: 2450000, salePrice: 2205000, tags: ["khai-truong"], isFastDelivery: false, sortOrder: 8 },
  { slug: "ke-hoa-khai-truong-xanh-duong", name: "Kệ Hoa Khai Trương Xanh Dương", categorySlug: "hoa-tuoi", description: "Kệ hoa tông xanh dương trang nhã, mang thông điệp bình an và thịnh vượng. Quà khai trương lịch sự, đẳng cấp.", price: 2850000, salePrice: null, tags: ["khai-truong"], isFastDelivery: false, sortOrder: 9 },
  { slug: "ke-hoa-chuc-mung-sac-hong", name: "Kệ Hoa Chúc Mừng Sắc Hồng", categorySlug: "hoa-tuoi", description: "Kệ hoa sắc hồng tươi tắn, gửi lời chúc mừng chân thành. Thích hợp cho lễ khai trương và các dịp chúc mừng.", price: 2250000, salePrice: 2025000, tags: ["chuc-mung", "khai-truong"], isFastDelivery: false, sortOrder: 10 },
  { slug: "vong-hoa-chia-buon-trang-nha", name: "Vòng Hoa Chia Buồn Trang Nhã", categorySlug: "hoa-tuoi", description: "Vòng hoa chia buồn trang nhã, thể hiện sự tiếc thương và chia sẻ. Hoa trắng thanh khiết, trang trọng.", price: 1850000, salePrice: null, tags: ["chia-buon"], isFastDelivery: false, sortOrder: 11 },
  { slug: "ke-hoa-chia-buon-hoa-trang", name: "Kệ Hoa Chia Buồn Hoa Trắng", categorySlug: "hoa-tuoi", description: "Kệ hoa trắng trang nghiêm, bày tỏ lòng thành kính và tiễn biệt. Thiết kế giản dị mà trang trọng.", price: 2350000, salePrice: 2115000, tags: ["chia-buon"], isFastDelivery: false, sortOrder: 12 },
  { slug: "gio-trai-cay-tuoi-lanh", name: "Giỏ Trái Cây Tươi Lành", categorySlug: "gio-trai-cay", description: "Giỏ trái cây tươi ngon, chọn lọc kỹ càng mỗi ngày. Quà thăm bệnh hay chúc mừng vừa thiết thực vừa tinh tế.", price: 790000, salePrice: null, tags: ["tham-benh", "chuc-mung"], isFastDelivery: true, sortOrder: 1 },
  { slug: "gio-trai-cay-nhap-khau-cao-cap", name: "Giỏ Trái Cây Nhập Khẩu Cao Cấp", categorySlug: "gio-trai-cay", description: "Giỏ trái cây nhập khẩu cao cấp, trái to đều và tươi ngon. Món quà sang trọng dành tặng đối tác và người thân.", price: 1890000, salePrice: 1701000, tags: ["qua-tang", "tham-benh"], isFastDelivery: false, sortOrder: 2 },
  { slug: "gio-trai-cay-phu-quy", name: "Giỏ Trái Cây Phú Quý", categorySlug: "gio-trai-cay", description: "Giỏ trái cây phú quý, đủ đầy và bắt mắt. Quà tặng chúc mừng mang ý nghĩa may mắn, sung túc.", price: 1290000, salePrice: null, tags: ["qua-tang", "chuc-mung"], isFastDelivery: true, sortOrder: 3 },
  { slug: "hop-trai-cay-mix-tuoi-ngon", name: "Hộp Trái Cây Mix Tươi Ngon", categorySlug: "hop-trai-cay", description: "Hộp trái cây mix nhiều loại, tươi ngon và tiện lợi. Quà tặng nhỏ gọn, phù hợp mọi dịp.", price: 590000, salePrice: 531000, tags: ["qua-tang"], isFastDelivery: true, sortOrder: 1 },
  { slug: "hop-trai-cay-nhap-khau-sang-trong", name: "Hộp Trái Cây Nhập Khẩu Sang Trọng", categorySlug: "hop-trai-cay", description: "Hộp trái cây nhập khẩu sang trọng, đóng gói tinh tế. Món quà đẳng cấp cho những dịp đặc biệt.", price: 1190000, salePrice: null, tags: ["qua-tang"], isFastDelivery: false, sortOrder: 2 },
  { slug: "chau-lan-ho-diep-trang-3-canh", name: "Chậu Lan Hồ Điệp Trắng 3 Cành", categorySlug: "lan-ho-diep", description: "Chậu lan hồ điệp trắng 3 cành, thanh khiết và sang trọng. Quà khai trương hay chúc mừng được ưa chuộng nhất.", price: 1950000, salePrice: 1755000, tags: ["chuc-mung", "khai-truong", "qua-tang"], isFastDelivery: false, sortOrder: 1 },
  { slug: "chau-lan-ho-diep-vang-5-canh", name: "Chậu Lan Hồ Điệp Vàng 5 Cành", categorySlug: "lan-ho-diep", description: "Chậu lan hồ điệp vàng 5 cành, rực rỡ và bề thế. Món quà khai trương mang ý nghĩa tài lộc, thịnh vượng.", price: 3250000, salePrice: null, tags: ["khai-truong", "chuc-mung"], isFastDelivery: false, sortOrder: 2 },
  { slug: "chau-lan-ho-diep-tim-hong", name: "Chậu Lan Hồ Điệp Tím Hồng", categorySlug: "lan-ho-diep", description: "Chậu lan hồ điệp tím hồng dịu dàng, lãng mạn. Quà sinh nhật tinh tế dành cho người yêu hoa lan.", price: 2650000, salePrice: 2385000, tags: ["sinh-nhat", "qua-tang"], isFastDelivery: false, sortOrder: 3 },
];

// Khu vực giao mẫu theo đúng bảng 4.3 của đặc tả Ngày 1.
const shippingZones = [
  { name: "Khu vực trung tâm", fee: 25000, sortOrder: 1 },
  { name: "Khu vực lân cận", fee: 35000, sortOrder: 2 },
  { name: "Khu vực xa", fee: 50000, sortOrder: 3 },
  { name: "Ngoại thành", fee: 70000, sortOrder: 4 },
];

// Tiền tố SKU theo danh mục (Ngày 4): hoa-tuoi → HT, gio-trai-cay → GT,
// hop-trai-cay → HP, lan-ho-diep → LH. SKU = tiền tố + số thứ tự trong
// danh mục (theo sortOrder) 3 chữ số, ví dụ HT-001, GT-003, LH-002.
const SKU_PREFIX: Record<string, string> = {
  "hoa-tuoi": "HT",
  "gio-trai-cay": "GT",
  "hop-trai-cay": "HP",
  "lan-ho-diep": "LH",
};

function skuFor(product: { categorySlug: string; sortOrder: number }): string {
  const prefix = SKU_PREFIX[product.categorySlug];
  if (!prefix) throw new Error(`Không có tiền tố SKU cho ${product.categorySlug}`);
  return `${prefix}-${String(product.sortOrder).padStart(3, "0")}`;
}

async function main() {
  // A3 (Ngày 11): --force trên production bị từ chối trừ khi có thêm
  // --i-know-this-is-production. Production nhận diện qua host của
  // DATABASE_URL (không phải localhost). Chạy tay trên máy này với
  // DB local không ảnh hưởng.
  const force = process.argv.includes("--force");
  if (
    force &&
    isProductionDatabaseUrl(process.env.DATABASE_URL) &&
    !process.argv.includes("--i-know-this-is-production")
  ) {
    throw new Error(
      "--force trên production bị từ chối: chạy lại với --i-know-this-is-production (chỉ khi chắc chắn muốn ghi đè dữ liệu production).",
    );
  }

  // Seed cài đặt mặc định (Ngày 11 B2): CHỈ khi bảng site_settings
  // trống — không ghi đè dữ liệu Henry đã nhập. Chạy độc lập với
  // chặn seed demo bên dưới (DB production đã có danh mục/sản phẩm
  // nhưng bảng cài đặt vẫn trống thì vẫn seed cài đặt).
  const seededSettings = await seedDefaultSettings();
  if (seededSettings > 0) {
    console.log(`Seed cài đặt mặc định: ${seededSettings} khóa.`);
  }

  // Seed trang tĩnh mẫu (Ngày 13 B4): CHỈ khi bảng pages trống —
  // 3 trang nháp (chưa xuất bản). Chạy độc lập với chặn seed demo
  // bên dưới, như seed cài đặt.
  const seededPages = await seedDefaultPages();
  if (seededPages > 0) {
    console.log(`Seed trang tĩnh mẫu: ${seededPages} trang (nháp).`);
  }

  // CHẶN SEED HỒI SINH DỮ LIỆU DEMO (mục 1 verdict Ngày 10): lệnh
  // build trên Vercel chạy `prisma db seed` MỖI lần deploy, mà upsert
  // vẫn TẠO LẠI dòng đã bị xóa (kể cả với update: {}). Nên chỉ seed
  // khi CẢ 3 bảng đều trống; DB đã có dữ liệu thì thoát ngay, không
  // tạo lại gì cả. Chạy tay với --force để bỏ qua chặn (vd dựng lại
  // DB sau khi xóa nhầm).
  const before = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    shippingZones: await prisma.shippingZone.count(),
  };
  if (!shouldSeed(before, force)) {
    console.log(
      `DB đã có dữ liệu (${before.categories} danh mục, ${before.products} sản phẩm, ${before.shippingZones} khu vực giao) — bỏ qua seed, không tạo lại gì cả. Muốn seed lại, chạy với --force.`,
    );
    return;
  }

  // Kiểm tra từng slug danh mục không nằm trong danh sách cấm (mục 3.17).
  for (const category of categories) {
    if (isReservedSlug(category.slug)) {
      throw new Error(`Slug danh mục nằm trong danh sách cấm: ${category.slug}`);
    }
  }

  // Tạo danh mục (chạy lại không tạo trùng nhờ upsert theo slug).
  // CHỈ TẠO MỚI (sửa 12 mục verdict Ngày 9, mục 1): update: {} nên
  // chạy lại seed là no-op — không ghi đè tên/thứ tự Henry đã sửa
  // trong trang quản trị. Lần khởi tạo đầu vẫn cần chạy seed để có
  // dữ liệu gốc; muốn đổi dữ liệu gốc sau đó thì sửa trực tiếp trong
  // admin hoặc bằng migration, không sửa ở đây rồi chạy lại seed.
  const categoryIds: Record<string, number> = {};
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: { ...category, source: "seed" },
    });
    categoryIds[category.slug] = record.id;
  }

  // Tạo sản phẩm (chạy lại không tạo trùng nhờ upsert theo khóa ghép categoryId + slug).
  // CHỈ TẠO MỚI (mục 1 verdict Ngày 9): update: {} — chạy lại seed
  // không ghi đè tên/mô tả/giá/giá khuyến mãi/ảnh/tag/isFastDelivery/
  // thứ tự/SKU/inStock Henry đã sửa trong admin. (Trước đây update
  // đầy đủ, nên mỗi lần Vercel build chạy `prisma db seed` lại ghi
  // đè hết các sửa đổi đó.)
  for (const product of products) {
    const categoryId = categoryIds[product.categorySlug];
    const sku = skuFor(product);
    await prisma.product.upsert({
      where: { categoryId_slug: { categoryId, slug: product.slug } },
      update: {},
      create: {
        categoryId,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: product.price,
        salePrice: product.salePrice,
        images: [PLACEHOLDER_IMAGE],
        tags: product.tags,
        isFastDelivery: product.isFastDelivery,
        sortOrder: product.sortOrder,
        sku,
        inStock: true,
        source: "seed",
      },
    });
  }

  // Tạo khu vực giao (chạy lại không tạo trùng nhờ upsert theo tên khu vực).
  // CHỈ TẠO MỚI (mục 1 verdict Ngày 9): update: {} — không ghi đè
  // phí giao Henry đã sửa trong admin.
  for (const zone of shippingZones) {
    await prisma.shippingZone.upsert({
      where: { name: zone.name },
      update: {},
      create: zone,
    });
  }

  const counts = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    shippingZones: await prisma.shippingZone.count(),
  };
  console.log(
    `Seed xong: ${counts.categories} danh mục, ${counts.products} sản phẩm, ${counts.shippingZones} khu vực giao.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed lỗi:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Cấu hình PostCSS cho Tailwind CSS 4 (bắt buộc để Next.js biên dịch được
// dòng `@import "tailwindcss"` trong src/app/globals.css).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;

// Đăng xuất quản trị (Server Action).
//
// Ngoại lệ có chủ đích với D7-5: action này KHÔNG gọi requireAdmin()
// vì nó phá phiên chứ không cần phiên — xóa dòng phiên (nếu có) và
// cookie rồi chuyển về /login. Đăng nhập nằm ở route handler
// POST /api/admin/login (cũng là ngoại lệ: nó tạo phiên).

"use server";

import { redirect } from "next/navigation";
import { destroyAdminSession } from "@/lib/admin/auth";

export async function logoutAction(): Promise<never> {
  await destroyAdminSession();
  redirect("/login");
}

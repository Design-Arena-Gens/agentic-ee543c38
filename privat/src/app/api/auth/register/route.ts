import { NextRequest, NextResponse } from "next/server";

import { createSessionCookie, hashPassword, signAuthToken } from "@/lib/auth";
import { generateUserCode } from "@/lib/ids";
import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const MAX_CODE_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const { name, password } = await req.json();

    if (!name || typeof name !== "string") {
      throw new ApiError(400, "Nama wajib diisi.");
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      throw new ApiError(400, "Password minimal 6 karakter.");
    }

    let userCode = "";
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const candidate = generateUserCode();
      const exists = await prisma.user.findUnique({ where: { userCode: candidate } });
      if (!exists) {
        userCode = candidate;
        break;
      }
    }

    if (!userCode) {
      throw new ApiError(500, "Gagal membuat ID unik. Coba lagi.");
    }

    const passwordHash = await hashPassword(password);
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });

    const user = await prisma.user.create({
      data: {
        name,
        userCode,
        passwordHash,
        status: "Saya siap ngobrol di PrivaT!",
        role: adminExists ? "USER" : "ADMIN",
      },
      select: {
        id: true,
        name: true,
        userCode: true,
        status: true,
        privacy: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    const token = signAuthToken({ userId: user.id, userCode: user.userCode });

    const response = NextResponse.json({ user }, { status: 201 });
    response.headers.append("Set-Cookie", createSessionCookie(token));

    return response;
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat melakukan registrasi.");
  }
}

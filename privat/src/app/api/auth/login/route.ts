import { NextRequest, NextResponse } from "next/server";

import {
  createSessionCookie,
  signAuthToken,
  verifyPassword,
} from "@/lib/auth";
import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userCode, password } = await req.json();

    if (!userCode || typeof userCode !== "string") {
      throw new ApiError(400, "ID pengguna wajib diisi.");
    }
    if (!password || typeof password !== "string") {
      throw new ApiError(400, "Password wajib diisi.");
    }

    const user = await prisma.user.findUnique({ where: { userCode } });

    if (!user) {
      throw new ApiError(401, "ID atau password salah.");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new ApiError(401, "ID atau password salah.");
    }

    const token = signAuthToken({ userId: user.id, userCode: user.userCode });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          userCode: user.userCode,
          status: user.status,
          privacy: user.privacy,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
      },
      { status: 200 },
    );
    response.headers.append("Set-Cookie", createSessionCookie(token));
    return response;
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat melakukan login.");
  }
}

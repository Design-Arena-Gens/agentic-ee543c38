import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      throw new ApiError(400, "Kode sesi wajib diisi.");
    }

    const session = await prisma.callSession.findUnique({
      where: { sessionCode: code },
      include: {
        initiator: {
          select: { id: true, name: true, userCode: true, avatarUrl: true },
        },
        recipient: {
          select: { id: true, name: true, userCode: true, avatarUrl: true },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, "Sesi tidak ditemukan.");
    }

    if (![session.initiatorId, session.recipientId].includes(user.id)) {
      throw new ApiError(403, "Anda tidak memiliki akses ke sesi ini.");
    }

    return NextResponse.json({ session });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat sesi panggilan.");
  }
}

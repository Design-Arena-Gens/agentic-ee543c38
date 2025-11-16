import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { generateSessionCode } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const allowedTypes = new Set(["VOICE", "VIDEO"]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { targetCode, callType } = await req.json();

    if (!targetCode || typeof targetCode !== "string") {
      throw new ApiError(400, "ID tujuan wajib diisi.");
    }

    const type = (callType ?? "VOICE") as string;
    if (!allowedTypes.has(type)) {
      throw new ApiError(400, "Tipe panggilan tidak valid.");
    }

    const target = await prisma.user.findUnique({ where: { userCode: targetCode } });
    if (!target) {
      throw new ApiError(404, "Pengguna tidak ditemukan.");
    }

    if (target.id === user.id) {
      throw new ApiError(400, "Tidak dapat memanggil diri sendiri.");
    }

    const friendship = await prisma.friend.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: user.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: user.id },
        ],
      },
    });

    if (!friendship) {
      throw new ApiError(403, "Kalian belum berteman.");
    }

    const sessionCode = generateSessionCode();

    const call = await prisma.callSession.create({
      data: {
        sessionCode,
        type: type as "VOICE" | "VIDEO",
        initiatorId: user.id,
        recipientId: target.id,
        status: "INITIATED",
      },
    });

    await prisma.notification.create({
      data: {
        userId: target.id,
        message: `${user.name} memulai panggilan ${type === "VOICE" ? "suara" : "video"}.`,
      },
    });

    return NextResponse.json({
      session: {
        sessionCode: call.sessionCode,
        status: call.status,
        type: call.type,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memulai panggilan.");
  }
}

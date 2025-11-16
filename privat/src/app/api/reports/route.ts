import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { reason, targetUserCode, targetGroupCode } = await req.json();

    if (!reason || typeof reason !== "string" || reason.length < 10) {
      throw new ApiError(400, "Alasan laporan minimal 10 karakter.");
    }

    if (!targetUserCode && !targetGroupCode) {
      throw new ApiError(400, "Pilih target laporan.");
    }

    let targetUserId: string | null = null;
    let targetGroupId: string | null = null;

    if (targetUserCode) {
      const targetUser = await prisma.user.findUnique({
        where: { userCode: targetUserCode },
      });
      if (!targetUser) {
        throw new ApiError(404, "Pengguna yang dilaporkan tidak ditemukan.");
      }
      targetUserId = targetUser.id;
    }

    if (targetGroupCode) {
      const group = await prisma.group.findUnique({
        where: { groupCode: targetGroupCode },
      });
      if (!group) {
        throw new ApiError(404, "Grup yang dilaporkan tidak ditemukan.");
      }
      targetGroupId = group.id;
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        targetUserId,
        targetGroupId,
        reason,
      },
    });

    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          message: `Laporan baru telah dibuat oleh ${user.name}.`,
        })),
      });
    }

    return NextResponse.json({ report });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat mengirim laporan.");
  }
}

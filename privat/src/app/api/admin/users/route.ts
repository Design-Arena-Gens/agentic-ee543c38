import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userCode: true,
        name: true,
        status: true,
        privacy: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat data pengguna.");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const { userId } = await req.json();

    if (!userId || typeof userId !== "string") {
      throw new ApiError(400, "ID pengguna wajib diisi.");
    }
    if (userId === admin.id) {
      throw new ApiError(400, "Tidak dapat menghapus akun sendiri.");
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new ApiError(404, "Pengguna tidak ditemukan.");
    }

    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.friend.deleteMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: userId },
          { recipientUserId: userId },
        ],
      },
    });
    await prisma.groupMember.deleteMany({ where: { userId } });
    await prisma.group.deleteMany({
      where: {
        ownerId: userId,
      },
    });
    await prisma.callSession.deleteMany({
      where: {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
      },
    });
    await prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: userId },
          { reviewerId: userId },
          { targetUserId: userId },
        ],
      },
    });

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat menghapus pengguna.");
  }
}

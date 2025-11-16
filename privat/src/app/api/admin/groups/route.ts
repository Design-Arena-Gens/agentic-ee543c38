import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return NextResponse.json({
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        groupCode: group.groupCode,
        ownerId: group.ownerId,
        memberCount: group._count.members,
        createdAt: group.createdAt,
      })),
    });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat grup.");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { groupId } = await req.json();

    if (!groupId || typeof groupId !== "string") {
      throw new ApiError(400, "ID grup wajib diisi.");
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new ApiError(404, "Grup tidak ditemukan.");
    }

    await prisma.notification.create({
      data: {
        userId: group.ownerId,
        message: `Grup ${group.name} dihapus oleh admin.`,
      },
    });

    await prisma.message.deleteMany({ where: { recipientGroupId: groupId } });
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.callSession.deleteMany({ where: { groupId } });
    await prisma.report.deleteMany({ where: { targetGroupId: groupId } });
    await prisma.group.delete({ where: { id: groupId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat menghapus grup.");
  }
}

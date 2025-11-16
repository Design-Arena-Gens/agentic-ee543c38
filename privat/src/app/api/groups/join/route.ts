import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { emitToGroup } from "@/lib/realtime";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { groupCode } = await req.json();

    if (!groupCode || typeof groupCode !== "string") {
      throw new ApiError(400, "ID grup wajib diisi.");
    }

    const group = await prisma.group.findUnique({
      where: { groupCode },
      include: { members: true },
    });

    if (!group) {
      throw new ApiError(404, "Grup tidak ditemukan.");
    }

    const alreadyMember = await prisma.groupMember.findFirst({
      where: {
        userId: user.id,
        groupId: group.id,
      },
    });

    if (alreadyMember) {
      throw new ApiError(400, "Anda sudah bergabung dengan grup ini.");
    }

    await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: group.id,
        role: "MEMBER",
      },
    });

    await prisma.notification.create({
      data: {
        userId: group.ownerId,
        message: `${user.name} bergabung ke grup ${group.name}.`,
      },
    });

    emitToGroup(group.groupCode, "groups:member-joined", {
      groupCode: group.groupCode,
      member: {
        id: user.id,
        name: user.name,
        userCode: user.userCode,
      },
    });

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        groupCode: group.groupCode,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat bergabung ke grup.");
  }
}

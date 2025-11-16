import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { generateGroupCode } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const MAX_GROUP_CODE_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const groups = await prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: true,
      },
    });

    return NextResponse.json({
      groups: groups.map((member) => ({
        id: member.group.id,
        groupCode: member.group.groupCode,
        name: member.group.name,
        role: member.role,
      })),
    });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat grup.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { name } = await req.json();

    if (!name || typeof name !== "string") {
      throw new ApiError(400, "Nama grup wajib diisi.");
    }

    let groupCode = "";
    for (let attempt = 0; attempt < MAX_GROUP_CODE_ATTEMPTS; attempt += 1) {
      const candidate = generateGroupCode();
      const exists = await prisma.group.findUnique({ where: { groupCode: candidate } });
      if (!exists) {
        groupCode = candidate;
        break;
      }
    }

    if (!groupCode) {
      throw new ApiError(500, "Gagal membuat ID grup. Coba lagi.");
    }

    const group = await prisma.group.create({
      data: {
        name,
        groupCode,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
      include: {
        members: true,
      },
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          message: `Grup ${group.name} berhasil dibuat.`,
        },
      ],
    });

    return NextResponse.json({
      group: {
        id: group.id,
        groupCode: group.groupCode,
        name: group.name,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat membuat grup.");
  }
}

import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { emitToUser } from "@/lib/realtime";
import { requireUser } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const friends = await prisma.friend.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
      },
      include: {
        requester: true,
        addressee: true,
      },
    });

    const mapped = friends.map((friend) => {
      const other =
        friend.requesterId === user.id ? friend.addressee : friend.requester;
      return {
        id: other.id,
        userCode: other.userCode,
        name: other.name,
        status: other.status,
        avatarUrl: other.avatarUrl,
        privacy: other.privacy,
      };
    });

    return NextResponse.json({ friends: mapped });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat daftar teman.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { friendCode } = await req.json();

    if (!friendCode || typeof friendCode !== "string") {
      throw new ApiError(400, "ID teman wajib diisi.");
    }

    const target = await prisma.user.findUnique({ where: { userCode: friendCode } });

    if (!target) {
      throw new ApiError(404, "Pengguna tidak ditemukan.");
    }

    if (target.id === user.id) {
      throw new ApiError(400, "Tidak dapat menambahkan diri sendiri sebagai teman.");
    }

    const existing = await prisma.friend.findFirst({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: user.id },
        ],
      },
    });

    if (existing) {
      if (existing.status === "ACCEPTED") {
        throw new ApiError(400, "Kalian sudah berteman.");
      }

      await prisma.friend.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED" },
      });
    } else {
      await prisma.friend.create({
        data: {
          requesterId: user.id,
          addresseeId: target.id,
          status: "ACCEPTED",
        },
      });
    }

    await prisma.notification.create({
      data: {
        userId: target.id,
        message: `${user.name} menambahkan Anda sebagai teman.`,
      },
    });

    emitToUser(target.userCode, "friends:updated", {});
    emitToUser(user.userCode, "friends:updated", {});

    return NextResponse.json({
      success: true,
      friend: {
        id: target.id,
        userCode: target.userCode,
        name: target.name,
        status: target.status,
        avatarUrl: target.avatarUrl,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat menambahkan teman.");
  }
}

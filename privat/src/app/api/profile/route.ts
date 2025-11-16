import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

const allowedPrivacy = new Set(["PUBLIC", "PRIVATE", "FRIENDS_ONLY"]);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({
      profile: {
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        status: user.status,
        privacy: user.privacy,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat profil.");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { name, status, privacy, avatarUrl } = await req.json();

    if (name && typeof name !== "string") {
      throw new ApiError(400, "Format nama tidak valid.");
    }
    if (status && typeof status !== "string") {
      throw new ApiError(400, "Format status tidak valid.");
    }
    if (privacy && !allowedPrivacy.has(privacy)) {
      throw new ApiError(400, "Pilihan privasi tidak valid.");
    }
    if (avatarUrl && typeof avatarUrl !== "string") {
      throw new ApiError(400, "Format avatar tidak valid.");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name ?? user.name,
        status: status ?? user.status,
        privacy: (privacy ?? user.privacy) as typeof user.privacy,
        avatarUrl: avatarUrl ?? user.avatarUrl,
      },
      select: {
        id: true,
        userCode: true,
        name: true,
        status: true,
        privacy: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ profile: updated });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memperbarui profil.");
  }
}

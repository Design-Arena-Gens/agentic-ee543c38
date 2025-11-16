import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createErrorResponse } from "@/lib/http";
import { requireUser } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ notifications });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat notifikasi.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        id: { in: ids },
      },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memperbarui notifikasi.");
  }
}

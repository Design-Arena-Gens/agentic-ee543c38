import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { sessionCode, answer } = await req.json();

    if (!sessionCode || typeof sessionCode !== "string") {
      throw new ApiError(400, "Kode sesi wajib diisi.");
    }
    if (!answer || typeof answer !== "string") {
      throw new ApiError(400, "Data answer wajib diisi.");
    }

    const session = await prisma.callSession.findUnique({
      where: { sessionCode },
    });

    if (!session) {
      throw new ApiError(404, "Sesi tidak ditemukan.");
    }

    if (session.recipientId !== user.id) {
      throw new ApiError(403, "Hanya penerima yang dapat mengirim answer.");
    }

    const updated = await prisma.callSession.update({
      where: { id: session.id },
      data: {
        answer,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat mengirim answer.");
  }
}

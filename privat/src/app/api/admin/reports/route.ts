import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: { id: true, name: true, userCode: true },
        },
        targetUser: {
          select: { id: true, name: true, userCode: true },
        },
        targetGroup: {
          select: { id: true, name: true, groupCode: true },
        },
        reviewer: {
          select: { id: true, name: true, userCode: true },
        },
      },
    });

    return NextResponse.json({ reports });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat laporan.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const { reportId, status } = await req.json();

    if (!reportId || typeof reportId !== "string") {
      throw new ApiError(400, "ID laporan wajib diisi.");
    }

    if (!["PENDING", "RESOLVED", "REJECTED"].includes(status)) {
      throw new ApiError(400, "Status laporan tidak valid.");
    }

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        reviewerId: admin.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: report.reporterId,
        message: `Laporan Anda telah diperbarui menjadi ${status}.`,
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memperbarui laporan.");
  }
}

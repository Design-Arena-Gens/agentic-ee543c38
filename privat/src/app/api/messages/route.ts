import { NextRequest, NextResponse } from "next/server";

import { ApiError, createErrorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { emitToGroup, emitToUser } from "@/lib/realtime";
import { requireUser } from "@/lib/user";

const allowedTypes = new Set(["TEXT", "IMAGE", "FILE"]);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const userCode = searchParams.get("userCode");
    const groupCode = searchParams.get("groupCode");

    if (!userCode && !groupCode) {
      throw new ApiError(400, "Parameter tujuan diperlukan.");
    }

    if (userCode) {
      const target = await prisma.user.findUnique({ where: { userCode } });
      if (!target) {
        throw new ApiError(404, "Pengguna tidak ditemukan.");
      }

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: user.id, recipientUserId: target.id },
            { senderId: target.id, recipientUserId: user.id },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              userCode: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ messages });
    }

    if (groupCode) {
      const group = await prisma.group.findUnique({ where: { groupCode } });
      if (!group) {
        throw new ApiError(404, "Grup tidak ditemukan.");
      }

      const membership = await prisma.groupMember.findFirst({
        where: { userId: user.id, groupId: group.id },
      });

      if (!membership) {
        throw new ApiError(403, "Anda bukan anggota grup.");
      }

      const messages = await prisma.message.findMany({
        where: {
          recipientGroupId: group.id,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              userCode: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ messages });
    }

    throw new ApiError(400, "Permintaan tidak valid.");
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat memuat pesan.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { targetCode, kind, content, messageType, fileName, fileData } =
      await req.json();

    if (!targetCode || typeof targetCode !== "string") {
      throw new ApiError(400, "ID tujuan wajib diisi.");
    }

    const type = (messageType ?? "TEXT") as string;
    if (!allowedTypes.has(type)) {
      throw new ApiError(400, "Tipe pesan tidak valid.");
    }

    if (type === "TEXT" && (!content || typeof content !== "string")) {
      throw new ApiError(400, "Pesan teks wajib diisi.");
    }

    if (type !== "TEXT" && (!fileData || typeof fileData !== "string")) {
      throw new ApiError(400, "Lampiran wajib diunggah.");
    }

    if (kind === "USER") {
      const target = await prisma.user.findUnique({ where: { userCode: targetCode } });
      if (!target) {
        throw new ApiError(404, "Pengguna tidak ditemukan.");
      }

      if (target.id === user.id) {
        throw new ApiError(400, "Tidak dapat mengirim pesan ke diri sendiri.");
      }

      const friendship = await prisma.friend.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: user.id, addresseeId: target.id },
            { requesterId: target.id, addresseeId: user.id },
          ],
        },
      });

      if (!friendship) {
        throw new ApiError(403, "Kalian belum berteman.");
      }

      const message = await prisma.message.create({
        data: {
          senderId: user.id,
          recipientUserId: target.id,
          content: type === "TEXT" ? content : null,
          fileName: fileName ?? null,
          fileData: type === "TEXT" ? null : fileData,
          messageType: type as "TEXT" | "IMAGE" | "FILE",
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              userCode: true,
              avatarUrl: true,
            },
          },
        },
      });

      await prisma.notification.create({
        data: {
          userId: target.id,
          message: `${user.name} mengirim pesan baru.`,
        },
      });

      emitToUser(target.userCode, "message:new", { message });
      emitToUser(user.userCode, "message:new", { message });

      return NextResponse.json({ message });
    }

    if (kind === "GROUP") {
      const group = await prisma.group.findUnique({ where: { groupCode: targetCode } });
      if (!group) {
        throw new ApiError(404, "Grup tidak ditemukan.");
      }

      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: group.id,
          userId: user.id,
        },
      });

      if (!membership) {
        throw new ApiError(403, "Anda bukan anggota grup.");
      }

      const message = await prisma.message.create({
        data: {
          senderId: user.id,
          recipientGroupId: group.id,
          content: type === "TEXT" ? content : null,
          fileName: fileName ?? null,
          fileData: type === "TEXT" ? null : fileData,
          messageType: type as "TEXT" | "IMAGE" | "FILE",
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              userCode: true,
              avatarUrl: true,
            },
          },
        },
      });

      await prisma.notification.create({
        data: {
          userId: group.ownerId,
          message: `${user.name} mengirim pesan baru di ${group.name}.`,
        },
      });

      emitToGroup(group.groupCode, "message:new", { message });

      return NextResponse.json({ message });
    }

    throw new ApiError(400, "Jenis percakapan tidak dikenal.");
  } catch (error) {
    return createErrorResponse(error, "Tidak dapat mengirim pesan.");
  }
}

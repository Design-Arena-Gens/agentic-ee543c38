import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { createErrorResponse } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await requireUser(req);

    const [friends, groups, notifications] = await Promise.all([
      prisma.friend.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: sessionUser.id }, { addresseeId: sessionUser.id }],
        },
        include: {
          requester: true,
          addressee: true,
        },
      }),
      prisma.groupMember.findMany({
        where: { userId: sessionUser.id },
        include: {
          group: true,
        },
      }),
      prisma.notification.findMany({
        where: { userId: sessionUser.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    const mappedFriends = friends.map((friend) => {
      const otherUser =
        friend.requesterId === sessionUser.id
          ? friend.addressee
          : friend.requester;
      return {
        id: otherUser.id,
        userCode: otherUser.userCode,
        name: otherUser.name,
        status: otherUser.status,
        avatarUrl: otherUser.avatarUrl,
        privacy: otherUser.privacy,
      };
    });

    const mappedGroups = groups.map((member) => ({
      id: member.group.id,
      groupCode: member.group.groupCode,
      name: member.group.name,
      role: member.role,
    }));

    return NextResponse.json({
      user: {
        id: sessionUser.id,
        userCode: sessionUser.userCode,
        name: sessionUser.name,
        status: sessionUser.status,
        privacy: sessionUser.privacy,
        avatarUrl: sessionUser.avatarUrl,
        role: sessionUser.role,
        friends: mappedFriends,
        groups: mappedGroups,
        notifications,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Gagal memuat data pengguna.");
  }
}

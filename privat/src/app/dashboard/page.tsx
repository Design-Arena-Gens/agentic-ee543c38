import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    redirect("/auth/login");
  }

  const [friends, groups, notifications] = await Promise.all([
    prisma.friend.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: sessionUser.id },
          { addresseeId: sessionUser.id },
        ],
      },
      include: {
        requester: true,
        addressee: true,
      },
    }),
    prisma.groupMember.findMany({
      where: { userId: sessionUser.id },
      include: { group: true },
    }),
    prisma.notification.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const friendSummaries = friends.map((friend) => {
    const other =
      friend.requesterId === sessionUser.id
        ? friend.addressee
        : friend.requester;
    return {
      id: other.id,
      userCode: other.userCode,
      name: other.name,
      status: other.status,
      avatarUrl: other.avatarUrl,
      privacy: other.privacy,
    };
  });

  const groupSummaries = groups.map((membership) => ({
    id: membership.group.id,
    groupCode: membership.group.groupCode,
    name: membership.group.name,
    role: membership.role,
  }));

  const notificationSummaries = notifications.map((notification) => ({
    id: notification.id,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  }));

  const initialUser = {
    id: sessionUser.id,
    userCode: sessionUser.userCode,
    name: sessionUser.name,
    status: sessionUser.status,
    privacy: sessionUser.privacy,
    avatarUrl: sessionUser.avatarUrl,
    role: sessionUser.role,
  };

  const friendData = friendSummaries.map((friend) => ({
    ...friend,
  }));

  const groupData = groupSummaries.map((group) => ({
    ...group,
  }));

  return (
    <DashboardClient
      initialUser={initialUser}
      initialFriends={friendData}
      initialGroups={groupData}
      initialNotifications={notificationSummaries}
    />
  );
}

 "use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SimplePeer from "simple-peer";
import { io, type Socket } from "socket.io-client";

type Privacy = "PUBLIC" | "PRIVATE" | "FRIENDS_ONLY";
type MessageType = "TEXT" | "IMAGE" | "FILE";

interface UserSummary {
  id: string;
  userCode: string;
  name: string;
  status: string;
  privacy: Privacy;
  avatarUrl?: string | null;
  role: "USER" | "ADMIN";
}

interface FriendSummary {
  id: string;
  userCode: string;
  name: string;
  status: string;
  avatarUrl?: string | null;
  privacy: Privacy;
}

interface GroupSummary {
  id: string;
  groupCode: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

interface NotificationItem {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface MessageItem {
  id: string;
  senderId: string;
  recipientUserId: string | null;
  recipientGroupId: string | null;
  content: string | null;
  fileName: string | null;
  fileData: string | null;
  messageType: MessageType;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    userCode: string;
    avatarUrl?: string | null;
  };
}

interface ReportItem {
  id: string;
  reason: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  createdAt: string;
  reporter: { name: string; userCode: string };
  targetUser?: { name: string; userCode: string } | null;
  targetGroup?: { name: string; groupCode: string } | null;
}

type ConversationKind = "USER" | "GROUP";

interface Conversation {
  type: ConversationKind;
  code: string;
  title: string;
  subtitle?: string;
}

interface Attachment {
  dataUrl: string;
  name: string;
  type: MessageType;
}

interface IncomingCall {
  sessionCode: string;
  fromCode: string;
  callType: "VOICE" | "VIDEO";
  signal: SimplePeer.SignalData;
}

interface DashboardClientProps {
  initialUser: UserSummary;
  initialFriends: FriendSummary[];
  initialGroups: GroupSummary[];
  initialNotifications: NotificationItem[];
}

const privacyLabels: Record<Privacy, string> = {
  PUBLIC: "Publik",
  PRIVATE: "Privat",
  FRIENDS_ONLY: "Hanya Teman",
};

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function DashboardClient({
  initialUser,
  initialFriends,
  initialGroups,
  initialNotifications,
}: DashboardClientProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [friends, setFriends] = useState(initialFriends);
  const [groups, setGroups] = useState(initialGroups);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [adminUsers, setAdminUsers] = useState<UserSummary[]>([]);
  const [adminGroups, setAdminGroups] = useState<
    (GroupSummary & { ownerId: string; memberCount: number; createdAt: string })[]
  >([]);
  const [adminReports, setAdminReports] = useState<ReportItem[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callInfo, setCallInfo] = useState<{
    sessionCode: string;
    targetCode: string;
    type: "VOICE" | "VIDEO";
    status: "INITIATED" | "ACTIVE";
  } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const conversations = useMemo<Conversation[]>(() => {
    const friendConvs = friends.map<Conversation>((friend) => ({
      type: "USER",
      code: friend.userCode,
      title: friend.name,
      subtitle: friend.status,
    }));
    const groupConvs = groups.map<Conversation>((group) => ({
      type: "GROUP",
      code: group.groupCode,
      title: group.name,
      subtitle: `Role: ${group.role}`,
    }));
    return [...friendConvs, ...groupConvs];
  }, [friends, groups]);

  useEffect(() => {
    setFeedback(null);
    setError(null);
  }, [selectedConversation]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    const initSocket = async () => {
      await fetch("/api/socket");
      const newSocket = io({
        path: "/api/socket",
        query: { userCode: user.userCode },
      });
      setSocket(newSocket);
    };

    initSocket();

    return () => {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
    };
  }, [user.userCode]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (payload: { message: MessageItem }) => {
      const { message } = payload;
      setMessages((prev) => {
        if (!selectedConversation) return prev;
        if (
          selectedConversation?.type === "USER" &&
          message.recipientUserId &&
          message.sender.userCode === selectedConversation.code
        ) {
          return [...prev, message];
        }
        if (
          selectedConversation?.type === "USER" &&
          message.senderId === user.id &&
          message.recipientUserId &&
          friends.some((f) => f.id === message.recipientUserId)
        ) {
          return [...prev, message];
        }
        if (
          selectedConversation?.type === "GROUP" &&
          message.recipientGroupId &&
          groups.find((g) => g.groupCode === selectedConversation.code)?.id ===
            message.recipientGroupId
        ) {
          return [...prev, message];
        }
        return prev;
      });
    };

    const handleFriendsUpdate = () => {
      reloadFriends();
    };

    const handleGroupJoin = () => {
      reloadGroups();
    };

    const handleCallSignal = (payload: {
      sessionCode: string;
      data: SimplePeer.SignalData;
      fromCode?: string;
      callType?: "VOICE" | "VIDEO";
    }) => {
      const { sessionCode, data, fromCode, callType } = payload;

      if (
        callInfo &&
        callInfo.sessionCode === sessionCode &&
        peerRef.current
      ) {
        peerRef.current.signal(data);
        setCallInfo((prev) =>
          prev ? { ...prev, status: "ACTIVE" } : prev,
        );
        return;
      }

      if (!peerRef.current && fromCode && callType) {
        setIncomingCall({
          sessionCode,
          fromCode,
          callType,
          signal: data,
        });
      }
    };

    socket.on("message:new", handleMessage);
    socket.on("friends:updated", handleFriendsUpdate);
    socket.on("groups:member-joined", handleGroupJoin);
    socket.on("call:signal", handleCallSignal);

    groups.forEach((group) => {
      socket.emit("joinGroup", group.groupCode);
    });

    return () => {
      socket.off("message:new", handleMessage);
      socket.off("friends:updated", handleFriendsUpdate);
      socket.off("groups:member-joined", handleGroupJoin);
      socket.off("call:signal", handleCallSignal);
    };
  }, [socket, selectedConversation, groups, friends, user.id, callInfo]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [selectedConversation, conversations]);

  useEffect(() => {
    if (!selectedConversation) return;
    const loadMessages = async () => {
      try {
        setIsMessagesLoading(true);
        const params = new URLSearchParams();
        if (selectedConversation.type === "USER") {
          params.set("userCode", selectedConversation.code);
        } else {
          params.set("groupCode", selectedConversation.code);
        }
        const response = await fetch(`/api/messages?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Gagal memuat pesan.");
        }
        const data = await response.json();
        setMessages(data.messages ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Gagal memuat pesan.",
        );
      } finally {
        setIsMessagesLoading(false);
      }
    };

    loadMessages();
  }, [selectedConversation]);

  const reloadFriends = async () => {
    try {
      const response = await fetch("/api/friends", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setFriends(data.friends ?? []);
    } catch {
      // ignore
    }
  };

  const reloadGroups = async () => {
    try {
      const response = await fetch("/api/groups", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setGroups(data.groups ?? []);
    } catch {
      // ignore
    }
  };

  const reloadNotifications = async () => {
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // ignore
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversation) {
      setError("Pilih percakapan terlebih dahulu.");
      return;
    }
    if (!attachment && messageInput.trim().length === 0) {
      return;
    }

    setIsSending(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCode: selectedConversation.code,
          kind: selectedConversation.type,
          content: attachment ? undefined : messageInput,
          messageType: attachment?.type ?? "TEXT",
          fileName: attachment?.name,
          fileData: attachment?.dataUrl,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal mengirim pesan.");
      }
      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
      setMessageInput("");
      setAttachment(null);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Gagal mengirim pesan.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth/login");
    router.refresh();
  };

  const handleAddFriend = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const friendCode = String(formData.get("friendCode") ?? "").trim();
    if (!friendCode) return;
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendCode }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal menambahkan teman.");
      }
      await reloadFriends();
      setFeedback("Teman berhasil ditambahkan.");
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan teman.");
    }
  };

  const handleCreateGroup = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("groupName") ?? "").trim();
    if (!name) return;
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal membuat grup.");
      }
      await reloadGroups();
      setFeedback("Grup berhasil dibuat.");
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat grup.");
    }
  };

  const handleJoinGroup = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const groupCode = String(formData.get("groupCode") ?? "").trim();
    if (!groupCode) return;
    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupCode }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal bergabung ke grup.");
      }
      await reloadGroups();
      setFeedback("Berhasil bergabung ke grup.");
      event.currentTarget.reset();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Tidak dapat bergabung ke grup.",
      );
    }
  };

  const handleAttachmentChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const type = file.type.startsWith("image/") ? "IMAGE" : "FILE";
    setAttachment({ dataUrl, name: file.name, type });
  };

  const handleProfileUpdate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? user.name);
    const status = String(formData.get("status") ?? user.status);
    const privacy = String(formData.get("privacy") ?? user.privacy) as Privacy;
    const avatar = formData.get("avatar") as File | null;

    let avatarUrl = user.avatarUrl ?? undefined;

    if (avatar && avatar.size > 0) {
      avatarUrl = await fileToDataUrl(avatar);
    }

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          status,
          privacy,
          avatarUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal memperbarui profil.");
      }

      const data = await response.json();
      setUser((prev) => ({ ...prev, ...data.profile }));
      setFeedback("Profil berhasil diperbarui.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui profil.",
      );
    }
  };

  const loadAdminUsers = async () => {
    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      setAdminUsers(data.users ?? []);
    } catch {
      // ignore
    }
  };

  const loadAdminGroups = async () => {
    try {
      const response = await fetch("/api/admin/groups", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      setAdminGroups(data.groups ?? []);
    } catch {
      // ignore
    }
  };

  const loadAdminReports = async () => {
    try {
      const response = await fetch("/api/admin/reports", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      setAdminReports(data.reports ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user.role === "ADMIN") {
      loadAdminUsers();
      loadAdminGroups();
      loadAdminReports();
    }
  }, [user.role]);

  const handleAdminDeleteUser = async (userId: string) => {
    const confirmed = window.confirm("Hapus pengguna ini?");
    if (!confirmed) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    loadAdminUsers();
    reloadFriends();
  };

  const handleAdminDeleteGroup = async (groupId: string) => {
    const confirmed = window.confirm("Hapus grup ini?");
    if (!confirmed) return;
    await fetch("/api/admin/groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    loadAdminGroups();
    reloadGroups();
  };

  const handleAdminUpdateReport = async (
    reportId: string,
    status: "RESOLVED" | "REJECTED",
  ) => {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, status }),
    });
    loadAdminReports();
  };

  const handleCallCleanup = async (sessionCode?: string) => {
    peerRef.current?.destroy();
    peerRef.current = null;
    localStream?.getTracks().forEach((track) => track.stop());
    remoteStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setCallInfo(null);
    if (sessionCode) {
      await fetch("/api/calls/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode }),
      });
    }
  };

  const startCall = async (type: "VOICE" | "VIDEO") => {
    if (!selectedConversation || selectedConversation.type !== "USER") {
      setError("Pilih teman untuk memulai panggilan.");
      return;
    }
    if (!socket) {
      setError("Koneksi realtime belum siap.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("Perangkat tidak mendukung panggilan WebRTC.");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "VIDEO",
      });
      setLocalStream(mediaStream);

      const response = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCode: selectedConversation.code,
          callType: type,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal memulai panggilan.");
      }

      const data = await response.json();
      const sessionCode = data.session.sessionCode as string;

      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: mediaStream,
      });

      peerRef.current = peer;
      setCallInfo({
        sessionCode,
        targetCode: selectedConversation.code,
        type,
        status: "INITIATED",
      });

      peer.on("signal", (signalData) => {
        socket.emit("call:signal", {
          sessionCode,
          targetCode: selectedConversation.code,
          data: signalData,
          callType: type,
          fromCode: user.userCode,
        });

        fetch("/api/calls/offer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionCode,
            offer: JSON.stringify(signalData),
          }),
        }).catch(() => undefined);
      });

      peer.on("stream", (stream) => {
        setRemoteStream(stream);
        setCallInfo((prev) =>
          prev ? { ...prev, status: "ACTIVE" } : prev,
        );
      });

      peer.on("close", () => handleCallCleanup(sessionCode));
      peer.on("error", () => handleCallCleanup(sessionCode));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Tidak dapat memulai panggilan.",
      );
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !socket) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("Perangkat tidak mendukung panggilan WebRTC.");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === "VIDEO",
      });
      setLocalStream(mediaStream);

      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
      });

      peerRef.current = peer;
      setCallInfo({
        sessionCode: incomingCall.sessionCode,
        targetCode: incomingCall.fromCode,
        type: incomingCall.callType,
        status: "INITIATED",
      });

      peer.on("signal", (signalData) => {
        socket.emit("call:signal", {
          sessionCode: incomingCall.sessionCode,
          targetCode: incomingCall.fromCode,
          data: signalData,
          callType: incomingCall.callType,
          fromCode: user.userCode,
        });
        fetch("/api/calls/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionCode: incomingCall.sessionCode,
            answer: JSON.stringify(signalData),
          }),
        }).catch(() => undefined);
      });

      peer.on("stream", (stream) => {
        setRemoteStream(stream);
        setCallInfo((prev) =>
          prev ? { ...prev, status: "ACTIVE" } : prev,
        );
      });

      peer.on("close", () => handleCallCleanup(incomingCall.sessionCode));
      peer.on("error", () => handleCallCleanup(incomingCall.sessionCode));

      peer.signal(incomingCall.signal);
      setIncomingCall(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Tidak dapat menerima panggilan.",
      );
    }
  };

  const declineIncomingCall = async () => {
    if (!incomingCall) return;
    await handleCallCleanup(incomingCall.sessionCode);
    setIncomingCall(null);
  };

  const endCurrentCall = async () => {
    if (!callInfo) return;
    await handleCallCleanup(callInfo.sessionCode);
  };

  const submitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") ?? "");
    const targetUserCode = String(formData.get("reportUser") ?? "");
    const targetGroupCode = String(formData.get("reportGroup") ?? "");
    if (!reason || reason.length < 10) {
      setError("Alasan laporan minimal 10 karakter.");
      return;
    }
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          targetUserCode: targetUserCode || undefined,
          targetGroupCode: targetGroupCode || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gagal mengirim laporan.");
      }
      setFeedback("Laporan terkirim. Terima kasih.");
      event.currentTarget.reset();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Tidak dapat mengirim laporan.",
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-indigo-200/80">
              PrivaT Dashboard
            </div>
            <h1 className="text-2xl font-semibold">
              Halo, {user.name} ({user.userCode})
            </h1>
            <p className="text-sm text-white/60">{user.status}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-wide text-white/70">
              Privasi: {privacyLabels[user.privacy]}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="flex w-full flex-col gap-6 lg:w-[280px]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Profil
            </h2>
            <form
              key={`${user.name}-${user.status}-${user.privacy}-${user.avatarUrl ?? "na"}`}
              className="mt-4 space-y-4 text-sm"
              onSubmit={handleProfileUpdate}
            >
              <div className="space-y-2">
                <label className="text-xs text-white/60">Nama</label>
                <input
                  name="name"
                  defaultValue={user.name}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/60">Status</label>
                <textarea
                  name="status"
                  defaultValue={user.status}
                  rows={2}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/60">Privasi</label>
                <select
                  name="privacy"
                  defaultValue={user.privacy}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
                >
                  <option value="PUBLIC">Publik</option>
                  <option value="FRIENDS_ONLY">Hanya Teman</option>
                  <option value="PRIVATE">Privat</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/60">Foto Profil</label>
                <input
                  type="file"
                  name="avatar"
                  accept="image/*"
                  className="w-full rounded-2xl border border-dashed border-white/20 bg-black/40 px-3 py-2 text-xs text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white file:hover:bg-indigo-600"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600"
              >
                Simpan Perubahan
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
                Percakapan
              </h2>
              <span className="text-xs text-white/40">
                {conversations.length} kanal
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {conversations.map((conversation) => (
                <button
                  key={`${conversation.type}-${conversation.code}`}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selectedConversation?.code === conversation.code
                      ? "border-indigo-400 bg-indigo-500/20 text-white"
                      : "border-white/10 bg-black/30 text-white/70 hover:border-indigo-400/50 hover:text-white"
                  }`}
                >
                  <div className="text-sm font-semibold">
                    {conversation.title}
                  </div>
                  <div className="text-xs text-white/50">
                    {conversation.type === "USER" ? "Teman" : "Grup"} ·{" "}
                    {conversation.code}
                  </div>
                  {conversation.subtitle ? (
                    <div className="mt-1 text-xs text-white/40">
                      {conversation.subtitle}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Tindakan Cepat
            </h2>
            <div className="mt-4 space-y-4 text-sm">
              <form className="space-y-2" onSubmit={handleAddFriend}>
                <label className="text-xs text-white/60">Tambah Teman</label>
                <div className="flex gap-2">
                  <input
                    name="friendCode"
                    placeholder="ID teman"
                    className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 hover:bg-white/20"
                  >
                    Tambah
                  </button>
                </div>
              </form>
              <form className="space-y-2" onSubmit={handleCreateGroup}>
                <label className="text-xs text-white/60">Buat Grup</label>
                <div className="flex gap-2">
                  <input
                    name="groupName"
                    placeholder="Nama grup"
                    className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 hover:bg-white/20"
                  >
                    Buat
                  </button>
                </div>
              </form>
              <form className="space-y-2" onSubmit={handleJoinGroup}>
                <label className="text-xs text-white/60">Masuk Grup</label>
                <div className="flex gap-2">
                  <input
                    name="groupCode"
                    placeholder="ID grup"
                    className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 hover:bg-white/20"
                  >
                    Masuk
                  </button>
                </div>
              </form>
            </div>
          </section>
        </aside>

        <section className="flex w-full flex-1 flex-col gap-4">
          <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 shadow-lg shadow-black/30 backdrop-blur">
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Percakapan Aktif
                </div>
                <h2 className="text-xl font-semibold">
                  {selectedConversation?.title ?? "Pilih percakapan"}
                </h2>
                <p className="text-xs text-white/40">
                  {selectedConversation
                    ? `${selectedConversation.type === "USER" ? "Teman" : "Grup"} · ${selectedConversation.code}`
                    : "Tidak ada percakapan dipilih"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startCall("VOICE")}
                  className="rounded-full bg-green-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-green-200 hover:bg-green-500/30"
                >
                  Voice Call
                </button>
                <button
                  onClick={() => startCall("VIDEO")}
                  className="rounded-full bg-purple-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-purple-200 hover:bg-purple-500/30"
                >
                  Video Call
                </button>
              </div>
            </header>

            <div className="flex h-[480px] flex-col gap-4 overflow-y-auto px-6 py-6">
              {isMessagesLoading ? (
                <div className="text-center text-sm text-white/40">
                  Memuat pesan...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-white/40">
                  Mulai percakapan dengan mengetik pesan pertama.
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderId === user.id;
                  const bubbleClass = isMine
                    ? "bg-indigo-500/60 text-white ml-auto"
                    : "bg-black/40 text-white/80 mr-auto";
                  return (
                    <div
                      key={message.id}
                      className={`max-w-[70%] rounded-3xl px-4 py-3 text-sm shadow-lg shadow-black/30 ${bubbleClass}`}
                    >
                      <div className="text-xs text-white/60">
                        {isMine ? "Anda" : message.sender.name} ·{" "}
                        {formatTime(message.createdAt)}
                      </div>
                      {message.messageType === "TEXT" && message.content ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      ) : null}
                      {message.messageType === "IMAGE" && message.fileData ? (
                        <img
                          src={message.fileData}
                          alt={message.fileName ?? "Lampiran gambar"}
                          className="mt-3 rounded-2xl border border-white/10"
                        />
                      ) : null}
                      {message.messageType === "FILE" && message.fileData ? (
                        <a
                          href={message.fileData}
                          download={message.fileName ?? "lampiran"}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
                        >
                          Unduh {message.fileName ?? "dokumen"}
                        </a>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <footer className="border-t border-white/10 px-6 py-4">
              <div className="space-y-3">
                {attachment ? (
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs text-white/80">
                    <span>
                      Lampiran: {attachment.name} ·{" "}
                      {attachment.type === "IMAGE" ? "Gambar" : "Dokumen"}
                    </span>
                    <button
                      onClick={() => setAttachment(null)}
                      className="text-red-300 hover:text-red-200"
                    >
                      Hapus
                    </button>
                  </div>
                ) : null}
                <textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  rows={3}
                  placeholder="Tulis pesan..."
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:border-indigo-400 focus:outline-none"
                />
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
                    <span className="rounded-full border border-white/20 px-3 py-2 text-xs text-white/60">
                      Lampirkan
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleAttachmentChange}
                    />
                  </label>
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending}
                    className="rounded-full bg-indigo-500 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-500/30"
                  >
                    {isSending ? "Mengirim..." : "Kirim"}
                  </button>
                </div>
              </div>
            </footer>
          </div>

          {incomingCall ? (
            <div className="rounded-3xl border border-amber-400/40 bg-amber-500/20 p-4 text-sm text-amber-50">
              <div className="font-semibold">
                Panggilan {incomingCall.callType.toLowerCase()} masuk dari{" "}
                {incomingCall.fromCode}
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={acceptIncomingCall}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-emerald-600"
                >
                  Terima
                </button>
                <button
                  onClick={declineIncomingCall}
                  className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-red-600"
                >
                  Tolak
                </button>
              </div>
            </div>
          ) : null}

          {callInfo ? (
            <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30">
              <div className="text-sm">
                Panggilan {callInfo.type.toLowerCase()} dengan{" "}
                {callInfo.targetCode} · {callInfo.status}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                  <div className="text-xs text-white/50">Anda</div>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="mt-2 h-40 w-full rounded-xl bg-black object-cover"
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                  <div className="text-xs text-white/50">Teman</div>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="mt-2 h-40 w-full rounded-xl bg-black object-cover"
                  />
                </div>
              </div>
              <button
                onClick={endCurrentCall}
                className="self-start rounded-full bg-red-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-red-600"
              >
                Akhiri Panggilan
              </button>
            </div>
          ) : null}
        </section>

        <aside className="flex w-full flex-col gap-6 lg:w-[320px]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
                Notifikasi
              </h2>
              <button
                onClick={reloadNotifications}
                className="text-xs text-white/50 hover:text-white/70"
              >
                Muat ulang
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-white/70">
              {notifications.length === 0 ? (
                <p className="text-white/40">Belum ada notifikasi.</p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div>{notif.message}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-wide text-white/40">
                      {formatTime(notif.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Laporan
            </h2>
            <form className="mt-4 space-y-3 text-sm" onSubmit={submitReport}>
              <textarea
                name="reason"
                placeholder="Jelaskan laporan Anda"
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
              />
              <select
                name="reportUser"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Laporkan Pengguna (opsional)</option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.userCode}>
                    {friend.name} · {friend.userCode}
                  </option>
                ))}
              </select>
              <select
                name="reportGroup"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Laporkan Grup (opsional)</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.groupCode}>
                    {group.name} · {group.groupCode}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-600"
              >
                Kirim Laporan
              </button>
            </form>
          </section>

          {user.role === "ADMIN" ? (
            <section className="rounded-3xl border border-indigo-400/50 bg-indigo-500/20 p-6 shadow-lg shadow-black/30 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                Panel Admin
              </h2>
              <div className="mt-4 space-y-4 text-xs text-white/80">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold uppercase tracking-wide">
                      Pengguna ({adminUsers.length})
                    </h3>
                    <button
                      onClick={loadAdminUsers}
                      className="text-[10px] text-white/60 hover:text-white/80"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-2">
                    {adminUsers.slice(0, 5).map((adminUser) => (
                      <div
                        key={adminUser.id}
                        className="flex items-center justify-between rounded-2xl border border-white/20 bg-black/30 px-3 py-2"
                      >
                        <div>
                          <div className="text-xs font-semibold">
                            {adminUser.name}
                          </div>
                          <div className="text-[10px] text-white/50">
                            {adminUser.userCode} · {adminUser.role}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAdminDeleteUser(adminUser.id)}
                          className="text-[10px] text-red-300 hover:text-red-200"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold uppercase tracking-wide">
                      Grup ({adminGroups.length})
                    </h3>
                    <button
                      onClick={loadAdminGroups}
                      className="text-[10px] text-white/60 hover:text-white/80"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-2">
                    {adminGroups.slice(0, 5).map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between rounded-2xl border border-white/20 bg-black/30 px-3 py-2"
                      >
                        <div>
                          <div className="text-xs font-semibold">
                            {group.name}
                          </div>
                          <div className="text-[10px] text-white/50">
                            {group.groupCode} · {group.memberCount} anggota
                          </div>
                        </div>
                        <button
                          onClick={() => handleAdminDeleteGroup(group.id)}
                          className="text-[10px] text-red-300 hover:text-red-200"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold uppercase tracking-wide">
                      Laporan ({adminReports.length})
                    </h3>
                    <button
                      onClick={loadAdminReports}
                      className="text-[10px] text-white/60 hover:text-white/80"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-2">
                    {adminReports.slice(0, 5).map((report) => (
                      <div
                        key={report.id}
                        className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2"
                      >
                        <div className="text-xs font-semibold">
                          {report.reporter.name} · {report.reporter.userCode}
                        </div>
                        <div className="mt-1 text-[10px] text-white/50">
                          {report.reason}
                        </div>
                        <div className="mt-1 text-[10px] text-white/50">
                          Target:{" "}
                          {report.targetUser
                            ? `${report.targetUser.name} (${report.targetUser.userCode})`
                            : report.targetGroup
                              ? `${report.targetGroup.name} (${report.targetGroup.groupCode})`
                              : "-"}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() =>
                              handleAdminUpdateReport(report.id, "RESOLVED")
                            }
                            className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/30"
                          >
                            Selesai
                          </button>
                          <button
                            onClick={() =>
                              handleAdminUpdateReport(report.id, "REJECTED")
                            }
                            className="rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-200 hover:bg-red-500/30"
                          >
                            Tolak
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </aside>
      </main>

      <footer className="border-t border-white/10 bg-white/5 px-6 py-4 text-center text-[10px] uppercase tracking-[0.3em] text-white/40">
        PrivaT © {new Date().getFullYear()} — Aman. Private. Terkontrol.
      </footer>

      {feedback ? (
        <div className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-6 py-3 text-center text-sm text-emerald-100 shadow-xl shadow-emerald-500/30">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 rounded-full border border-red-400/30 bg-red-500/20 px-6 py-3 text-center text-sm text-red-100 shadow-xl shadow-red-500/30">
          {error}
        </div>
      ) : null}
    </div>
  );
}

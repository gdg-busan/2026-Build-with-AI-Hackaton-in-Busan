"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,

} from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateScores, getTop10, calculateFinalScores, detectFinalTies } from "@/lib/scoring";
import { TEAM_EMOJIS, EVENT_ID } from "@/lib/constants";
import type { Team, User, EventConfig, EventStatus, UserRole, ChatMessage, ChatRoom, Announcement } from "@/lib/types";
import { MISSIONS } from "@/lib/missions";
import { toast } from "sonner";
import BatchSetupWizard from "@/components/BatchSetupWizard";
import { useVotingTimer } from "@/hooks/useVotingTimer";

type TabType = "setup" | "event" | "teams" | "users" | "monitor" | "chat" | "missions" | "announce";

const STATUS_COLORS: Record<EventStatus, string> = {
  waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  voting_p1: "bg-green-500/20 text-[#00FF88] border-[#00FF88]/30",
  closed_p1: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  revealed_p1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  voting_p2: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  closed_p2: "bg-red-500/20 text-red-400 border-red-500/30",
  revealed_final: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const STATUS_LABELS: Record<EventStatus, string> = {
  waiting: "대기중",
  voting_p1: "1차 투표중",
  closed_p1: "1차 마감",
  revealed_p1: "TOP 10 공개",
  voting_p2: "2차 투표중",
  closed_p2: "2차 마감",
  revealed_final: "최종 발표",
};


export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("setup");
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Event config edit state
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    judgeWeight: 0.8,
    participantWeight: 0.2,
    maxVotesPerUser: 3,
  });

  // Team form state
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", description: "", emoji: "🚀" });
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Code generation state
  const [codeCount, setCodeCount] = useState(5);
  const [codeRole, setCodeRole] = useState<UserRole>("participant");
  const [generatingCodes, setGeneratingCodes] = useState(false);

  // Chat monitor state
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatMessages, setChatMessages] = useState<(ChatMessage & { roomId: string; roomName: string })[]>([]);
  const [selectedChatRoom, setSelectedChatRoom] = useState<string>("global");

  // Mission progress state
  type MissionUserProgress = {
    uniqueCode: string;
    name: string;
    role: string;
    teamId: string | null;
    missions: Array<{
      missionId: string;
      current: number;
      completed: boolean;
      completedAt: string | null;
    }>;
    completedCount: number;
  };
  const [missionUsers, setMissionUsers] = useState<MissionUserProgress[]>([]);
  const [missionLoading, setMissionLoading] = useState(false);

  // Announcement state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementForm, setAnnouncementForm] = useState({
    text: "",
    type: "info" as "info" | "warning" | "success",
    expiresMinutes: 60,
  });

  // Phase 1 finalization state
  type TiedTeam = { id: string; name: string; emoji: string; participantVoteCount: number };
  const [phase1Result, setPhase1Result] = useState<{
    selectedTeamIds: string[];
    tiedTeams: TiedTeam[] | null;
  } | null>(null);
  const [phase1ManualSelection, setPhase1ManualSelection] = useState<string[]>([]);
  const [finalizingPhase1, setFinalizingPhase1] = useState(false);

  // Final tie resolution state
  const [finalTieRanking, setFinalTieRanking] = useState<string[]>([]);
  const [resolvingFinalTies, setResolvingFinalTies] = useState(false);

  // Loading states
  const [submitting, setSubmitting] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(10);
  const [targetTime, setTargetTime] = useState("");
  const timer = useVotingTimer(eventConfig);
  const autoCloseTriggeredRef = useRef(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const eventDocRef = doc(getFirebaseDb(), "events", EVENT_ID);

    // Subscribe to event config
    const eventUnsub = onSnapshot(eventDocRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setEventConfig({
          id: snap.id,
          status: d.status,
          judgeWeight: d.judgeWeight,
          participantWeight: d.participantWeight,
          maxVotesPerUser: d.maxVotesPerUser,
          votingDeadline: d.votingDeadline?.toDate?.() || null,
          title: d.title || "",
          createdAt: d.createdAt?.toDate?.() || new Date(),
          autoCloseEnabled: d.autoCloseEnabled ?? false,
          timerDurationSec: d.timerDurationSec ?? null,
          phase1SelectedTeamIds: d.phase1SelectedTeamIds ?? undefined,
          phase1FinalizedAt: d.phase1FinalizedAt?.toDate?.() ?? undefined,
          finalRankingOverrides: d.finalRankingOverrides ?? undefined,
        });
        setConfigForm({
          judgeWeight: d.judgeWeight,
          participantWeight: d.participantWeight,
          maxVotesPerUser: d.maxVotesPerUser,
        });
      }
    });

    // Subscribe to teams (subcollection under event)
    const teamsUnsub = onSnapshot(collection(eventDocRef, "teams"), (snap) => {
      setTeams(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team))
      );
    });

    // Subscribe to users (subcollection under event)
    const usersUnsub = onSnapshot(collection(eventDocRef, "users"), (snap) => {
      setUsers(
        snap.docs.map((d) => ({ uniqueCode: d.id, ...d.data() } as User))
      );
    });

    // Subscribe to chat rooms
    const chatRoomsUnsub = onSnapshot(
      collection(eventDocRef, "chatRooms"),
      (snap) => {
        setChatRooms(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type: data.type,
              teamId: data.teamId ?? null,
              name: data.name,
              lastMessageAt: data.lastMessageAt?.toDate?.() ?? null,
              lastMessagePreview: data.lastMessagePreview ?? null,
              lastMessageSender: data.lastMessageSender ?? null,
              messageCount: data.messageCount ?? 0,
            } as ChatRoom;
          })
        );
      }
    );

    // Subscribe to announcements
    const announcementsUnsub = onSnapshot(
      collection(eventDocRef, "announcements"),
      (snap) => {
        setAnnouncements(
          snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                text: data.text,
                type: data.type,
                active: data.active,
                createdAt: data.createdAt?.toDate?.() ?? new Date(),
                expiresAt: data.expiresAt?.toDate?.() ?? null,
              } as Announcement;
            })
            .filter((a) => a.active)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        );
      }
    );

    return () => {
      eventUnsub();
      teamsUnsub();
      usersUnsub();
      chatRoomsUnsub();
      announcementsUnsub();
    };
  }, [user]);

  // Subscribe to messages for selected chat room
  useEffect(() => {
    if (!user || user.role !== "admin" || !selectedChatRoom) return;
    const db = getFirebaseDb();
    const messagesRef = collection(
      db,
      "events",
      EVENT_ID,
      "chatRooms",
      selectedChatRoom,
      "messages"
    );
    const messagesQuery = query(messagesRef, orderBy("createdAt", "desc"), limit(50));
    const roomName =
      chatRooms.find((r) => r.id === selectedChatRoom)?.name ?? selectedChatRoom;
    const unsub = onSnapshot(messagesQuery, (snap) => {
      setChatMessages(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            roomId: selectedChatRoom,
            roomName,
            text: data.text,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            senderTeamId: data.senderTeamId ?? null,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            deleted: data.deleted ?? false,
            deletedBy: data.deletedBy,
            type: data.type ?? "text",
          } as ChatMessage & { roomId: string; roomName: string };
        })
      );
    });
    return () => unsub();
  }, [user, selectedChatRoom, chatRooms]);

  const getIdToken = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) throw new Error("Not authenticated");
    return await currentUser.getIdToken();
  }, []);

  const callAdminApi = useCallback(
    async (action: string, data: Record<string, unknown>) => {
      const token = await getIdToken();
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }
      return res.json();
    },
    [getIdToken]
  );

  // Auto-advance: when timer expires and autoCloseEnabled, advance to next status
  const nextStatusMap: Partial<Record<EventStatus, { status: EventStatus; message: string }>> = {
    waiting: { status: "voting_p1", message: "타이머 만료로 1차 투표가 시작되었습니다." },
    voting_p1: { status: "closed_p1", message: "타이머 만료로 1차 투표가 자동 마감되었습니다." },
    voting_p2: { status: "closed_p2", message: "타이머 만료로 2차 투표가 자동 마감되었습니다." },
  };

  useEffect(() => {
    if (
      timer.isExpired &&
      eventConfig?.autoCloseEnabled &&
      eventConfig?.status &&
      nextStatusMap[eventConfig.status] &&
      !autoCloseTriggeredRef.current
    ) {
      const next = nextStatusMap[eventConfig.status]!;
      const currentStatus = eventConfig.status;
      autoCloseTriggeredRef.current = true;
      callAdminApi("updateEventStatus", { status: next.status })
        .then(async () => {
          toast.success(next.message);
          // waiting → voting 전환 시 타이머 리셋 (연쇄 전환 방지)
          if (currentStatus === "waiting") {
            await callAdminApi("resetTimer", {});
          }
        })
        .catch((e: Error) => toast.error(`자동 전환 실패: ${e.message}`))
        .finally(() => { autoCloseTriggeredRef.current = false; });
    }
  }, [timer.isExpired, eventConfig?.autoCloseEnabled, eventConfig?.status, callAdminApi]);

  const handleStatusChange = async (newStatus: EventStatus) => {
    if (!eventConfig || eventConfig.status === newStatus) return;

    if (!confirm(`상태를 "${STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`)) return;

    setSubmitting(true);
    try {
      await callAdminApi("updateEventStatus", { status: newStatus });
      toast.success(`상태가 "${STATUS_LABELS[newStatus]}"(으)로 변경되었습니다.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveConfig = async () => {
    setSubmitting(true);
    try {
      await callAdminApi("updateEventConfig", configForm);
      setEditingConfig(false);
      toast.success("설정이 저장되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTeam = async () => {
    if (!teamForm.name.trim()) {
      toast.error("팀 이름을 입력하세요.");
      return;
    }
    setSubmitting(true);
    try {
      await callAdminApi("addTeam", teamForm);
      setTeamForm({ name: "", description: "", emoji: "🚀" });
      setShowAddTeam(false);
      toast.success("팀이 추가되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    setSubmitting(true);
    try {
      await callAdminApi("updateTeam", {
        teamId: editingTeam.id,
        name: editingTeam.name,
        description: editingTeam.description,
        emoji: editingTeam.emoji,
        nickname: editingTeam.nickname,
        projectUrl: editingTeam.projectUrl,
        demoUrl: editingTeam.demoUrl,
        githubUrl: editingTeam.githubUrl,
        techStack: editingTeam.techStack,
      });
      setEditingTeam(null);
      toast.success("팀이 수정되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`팀 "${teamName}"을 삭제하시겠습니까?`)) return;
    setSubmitting(true);
    try {
      await callAdminApi("deleteTeam", { teamId });
      toast.success("팀이 삭제되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateCodes = async () => {
    if (codeCount < 1 || codeCount > 100) {
      toast.error("1~100 사이의 숫자를 입력하세요.");
      return;
    }
    setGeneratingCodes(true);
    try {
      const result = await callAdminApi("generateCodes", {
        count: codeCount,
        role: codeRole,
      });
      toast.success(`${result.codes.length}개의 코드가 생성되었습니다.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleAssignTeam = async (userCode: string, teamId: string | null) => {
    try {
      await callAdminApi("assignTeam", { userCode, teamId });
      toast.success("팀이 배정되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleResetVotes = async () => {
    if (!confirm("모든 투표를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    if (!confirm("정말로 초기화하시겠습니까? 최종 확인입니다.")) return;
    setSubmitting(true);
    try {
      await callAdminApi("resetVotes", {});
      toast.success("모든 투표가 초기화되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm("모든 팀, 참가자, 투표, 채팅, 공지사항을 초기화하시겠습니까? 관리자 계정만 유지됩니다.")) return;
    if (!confirm("정말로 전체 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다!")) return;
    setSubmitting(true);
    try {
      await callAdminApi("resetAll", {});
      toast.success("전체 초기화 완료! 팀, 참가자, 투표, 채팅, 공지사항이 모두 삭제되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userCode: string, userName: string) => {
    if (!confirm(`"${userName}" (${userCode})를 삭제하시겠습니까?`)) return;
    try {
      await callAdminApi("deleteUser", { userCode });
      toast.success(`"${userName}"이(가) 삭제되었습니다.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDeleteMessage = async (roomId: string, messageId: string) => {
    try {
      await callAdminApi("deleteMessage", { roomId, messageId });
      toast.success("메시지가 삭제되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleMuteUser = async (userCode: string, duration: number) => {
    try {
      await callAdminApi("muteUser", { userCode, duration });
      toast.success(`${duration}분 채팅 제한이 적용되었습니다.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleUnmuteUser = async (userCode: string) => {
    try {
      await callAdminApi("unmuteUser", { userCode });
      toast.success("채팅 제한이 해제되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleInitChatRooms = async () => {
    setSubmitting(true);
    try {
      const result = await callAdminApi("initChatRooms", {});
      toast.success(`채팅방 ${result.created}개가 생성되었습니다.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFetchMissions = useCallback(async () => {
    setMissionLoading(true);
    try {
      const result = await callAdminApi("getMissionProgress", {});
      setMissionUsers(result.users);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMissionLoading(false);
    }
  }, [callAdminApi]);

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.text.trim()) {
      toast.error("공지 내용을 입력하세요.");
      return;
    }
    setSubmitting(true);
    try {
      const expiresAt = new Date(
        Date.now() + announcementForm.expiresMinutes * 60 * 1000
      ).toISOString();
      await callAdminApi("createAnnouncement", {
        text: announcementForm.text.trim(),
        type: announcementForm.type,
        expiresAt,
      });
      setAnnouncementForm({ text: "", type: "info", expiresMinutes: 60 });
      toast.success("공지가 생성되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    try {
      await callAdminApi("deleteAnnouncement", { announcementId });
      toast.success("공지가 삭제되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleFinalizePhase1 = async () => {
    setFinalizingPhase1(true);
    try {
      const result = await callAdminApi("finalizePhase1", {});
      setPhase1Result({
        selectedTeamIds: result.selectedTeamIds,
        tiedTeams: result.tiedTeams ?? null,
      });
      if (!result.tiedTeams || result.tiedTeams.length === 0) {
        toast.success("TOP 10이 자동 선정되었습니다.");
      } else {
        toast.warning("동점 팀이 있습니다. 수동으로 선정해주세요.");
        setPhase1ManualSelection(result.selectedTeamIds);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFinalizingPhase1(false);
    }
  };

  const handleResolvePhase1Ties = async () => {
    const requiredCount = Math.min(10, teams.length);
    if (phase1ManualSelection.length !== requiredCount) {
      toast.error(`정확히 ${requiredCount}개 팀을 선택해야 합니다.`);
      return;
    }
    setFinalizingPhase1(true);
    try {
      await callAdminApi("resolvePhase1Ties", { selectedTeamIds: phase1ManualSelection });
      setPhase1Result((prev) => prev ? { ...prev, tiedTeams: null, selectedTeamIds: phase1ManualSelection } : null);
      toast.success("동점 처리가 완료되었습니다. TOP 10이 확정되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFinalizingPhase1(false);
    }
  };

  const handleResolveFinalTies = async () => {
    if (finalTieRanking.length !== 3) {
      toast.error("1위, 2위, 3위를 모두 선택해주세요.");
      return;
    }
    setResolvingFinalTies(true);
    try {
      await callAdminApi("resolveFinalTies", { rankedTeamIds: finalTieRanking });
      toast.success("최종 순위가 확정되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResolvingFinalTies(false);
    }
  };

  const handleResetPhase2Votes = async () => {
    if (!confirm("2차 투표를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    setSubmitting(true);
    try {
      await callAdminApi("resetPhase2Votes", {});
      toast.success("2차 투표가 초기화되었습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-fetch missions when switching to missions tab
  useEffect(() => {
    if (activeTab === "missions" && missionUsers.length === 0) {
      handleFetchMissions();
    }
  }, [activeTab, missionUsers.length, handleFetchMissions]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("클립보드에 복사되었습니다.");
  };

  const copyAllCodes = (role?: UserRole) => {
    const filtered = role ? users.filter((u) => u.role === role) : users;
    const text = filtered.map((u) => `${u.uniqueCode}\t${u.name}\t${u.role}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`${filtered.length}개의 코드가 복사되었습니다.`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-[#00FF88] font-mono animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  const votedCount = users.filter((u) => u.hasVoted).length;
  const totalCount = users.filter((u) => u.role !== "admin").length;
  const scores = calculateScores(teams, eventConfig?.judgeWeight, eventConfig?.participantWeight);
  const top10 = getTop10(scores);
  const maxVotes = Math.max(...teams.map((t) => t.judgeVoteCount + t.participantVoteCount), 1);

  const tabs: { key: TabType; label: string }[] = [
    { key: "setup", label: "일괄 설정" },
    { key: "event", label: "이벤트 제어" },
    { key: "teams", label: "팀 관리" },
    { key: "users", label: "사용자 & 코드" },
    { key: "monitor", label: "실시간 모니터" },
    { key: "chat", label: "채팅 모니터" },
    { key: "missions", label: "미션 현황" },
    { key: "announce", label: "공지 관리" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      {/* Header */}
      <header className="border-b border-[#00FF88]/20 bg-[#1A2235]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[#00FF88] font-mono text-lg font-bold">&gt;_ Admin Dashboard</span>
            {eventConfig && (
              <span className={`text-xs px-2 py-0.5 rounded border font-mono ${STATUS_COLORS[eventConfig.status]}`}>
                {STATUS_LABELS[eventConfig.status]}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout();
              router.replace("/");
            }}
          >
            로그아웃
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-1 border-b border-[#1A2235] mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-mono text-sm transition-all ${
                activeTab === tab.key
                  ? "text-[#00FF88] border-b-2 border-[#00FF88]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* BATCH SETUP TAB */}
        {activeTab === "setup" && (
          <BatchSetupWizard
            onComplete={() => setActiveTab("teams")}
            callAdminApi={callAdminApi}
          />
        )}

        {/* EVENT CONTROL TAB */}
        {activeTab === "event" && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <h2 className="text-[#00FF88] font-mono font-semibold mb-4">이벤트 상태</h2>
              {eventConfig ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-mono text-sm">현재 상태:</span>
                    <span className={`text-sm px-3 py-1 rounded-full border font-mono ${STATUS_COLORS[eventConfig.status]}`}>
                      {STATUS_LABELS[eventConfig.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["waiting", "voting_p1", "closed_p1", "revealed_p1", "voting_p2", "closed_p2", "revealed_final"] as EventStatus[]).map((status) => (
                      <Button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={submitting || eventConfig.status === status}
                        variant={eventConfig.status === status ? "default" : "outline"}
                        className={`font-mono text-xs ${
                          eventConfig.status === status
                            ? "bg-[#00FF88] text-[#0A0E1A] hover:bg-[#00FF88]/90"
                            : "border-gray-600 text-gray-400 hover:border-[#00FF88]/50 hover:text-[#00FF88]"
                        }`}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                  <div className="text-gray-500 font-mono text-xs mt-2">
                    상태는 순서대로만 진행 가능합니다 (1단계씩 전진).
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-gray-500 font-mono text-sm">이벤트가 아직 생성되지 않았습니다.</div>
                  <Button
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        await callAdminApi("initEvent", {});
                        toast.success("이벤트가 초기화되었습니다.");
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    className="font-mono"
                  >
                    이벤트 초기화
                  </Button>
                </div>
              )}
            </div>

            {/* TOP 10 선정 Section - shown when status is closed_p1 */}
            {eventConfig && (eventConfig.status === "closed_p1" || eventConfig.phase1SelectedTeamIds) && (
              <div className="bg-[#1A2235] rounded-xl p-6 border border-[#4DAFFF]/20">
                <h2 className="text-[#4DAFFF] font-mono font-semibold mb-4">TOP 10 선정</h2>

                {/* Already finalized */}
                {eventConfig.phase1SelectedTeamIds && eventConfig.phase1SelectedTeamIds.length > 0 && !phase1Result?.tiedTeams && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[#00FF88] font-mono text-sm">TOP {eventConfig.phase1SelectedTeamIds.length} 선정 완료</span>
                      {eventConfig.phase1FinalizedAt && (
                        <span className="text-gray-500 font-mono text-xs">
                          ({eventConfig.phase1FinalizedAt instanceof Date
                            ? eventConfig.phase1FinalizedAt.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                            : ""})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {eventConfig.phase1SelectedTeamIds.map((teamId) => {
                        const team = teams.find((t) => t.id === teamId);
                        return team ? (
                          <span key={teamId} className="px-3 py-1 bg-[#4DAFFF]/10 border border-[#4DAFFF]/30 rounded-lg font-mono text-xs text-[#4DAFFF]">
                            {team.emoji} {team.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    {eventConfig.status === "closed_p1" && (
                      <Button
                        onClick={handleFinalizePhase1}
                        disabled={finalizingPhase1}
                        variant="outline"
                        className="font-mono text-xs border-[#4DAFFF]/30 text-[#4DAFFF] hover:bg-[#4DAFFF]/10 mt-2"
                      >
                        {finalizingPhase1 ? "처리 중..." : "TOP 10 재선정"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Not yet finalized */}
                {eventConfig.status === "closed_p1" && (!eventConfig.phase1SelectedTeamIds || eventConfig.phase1SelectedTeamIds.length === 0) && !phase1Result && (
                  <div className="space-y-3">
                    <p className="text-gray-400 font-mono text-sm">
                      1차 투표(참가자 투표)를 기반으로 TOP 10 팀을 선정합니다.
                    </p>
                    <Button
                      onClick={handleFinalizePhase1}
                      disabled={finalizingPhase1}
                      className="font-mono bg-[#4DAFFF] text-[#0A0E1A] hover:bg-[#4DAFFF]/90"
                    >
                      {finalizingPhase1 ? "선정 중..." : "TOP 10 자동 선정"}
                    </Button>
                  </div>
                )}

                {/* Tie resolution UI */}
                {phase1Result?.tiedTeams && phase1Result.tiedTeams.length > 0 && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <p className="text-yellow-400 font-mono text-sm font-semibold mb-1">동점 발생!</p>
                      <p className="text-yellow-400/70 font-mono text-xs">
                        아래 팀들이 동점입니다. 총 {Math.min(10, teams.length)}개 팀을 수동으로 선택해주세요.
                        (현재 확실히 선정된 팀: {phase1Result.selectedTeamIds.length}개)
                      </p>
                    </div>

                    {/* Already-selected teams (above cutoff) */}
                    {phase1Result.selectedTeamIds.length > 0 && (
                      <div>
                        <p className="text-gray-400 font-mono text-xs mb-2">확정 선정 팀:</p>
                        <div className="flex flex-wrap gap-2">
                          {phase1Result.selectedTeamIds.map((teamId) => {
                            const team = teams.find((t) => t.id === teamId);
                            return team ? (
                              <span key={teamId} className="px-3 py-1 bg-[#00FF88]/10 border border-[#00FF88]/30 rounded-lg font-mono text-xs text-[#00FF88]">
                                {team.emoji} {team.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tied teams checkboxes */}
                    <div>
                      <p className="text-gray-400 font-mono text-xs mb-2">
                        동점 팀 ({phase1Result.tiedTeams.length}개) - 추가 선택:
                      </p>
                      <div className="space-y-2">
                        {phase1Result.tiedTeams.map((t) => {
                          const isAutoSelected = phase1Result.selectedTeamIds.includes(t.id);
                          const isManualSelected = phase1ManualSelection.includes(t.id);
                          return (
                            <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isAutoSelected || isManualSelected}
                                disabled={isAutoSelected}
                                onChange={(e) => {
                                  if (isAutoSelected) return;
                                  setPhase1ManualSelection((prev) =>
                                    e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                                  );
                                }}
                                className="w-4 h-4 accent-[#4DAFFF]"
                              />
                              <span className="font-mono text-sm text-white">
                                {t.emoji} {t.name}
                              </span>
                              <span className="text-gray-500 font-mono text-xs">
                                ({t.participantVoteCount}표)
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-mono text-xs">
                        선택: {phase1ManualSelection.length + phase1Result.selectedTeamIds.filter(id => !phase1ManualSelection.includes(id)).length} / {Math.min(10, teams.length)}
                      </span>
                      <Button
                        onClick={handleResolvePhase1Ties}
                        disabled={finalizingPhase1}
                        className="font-mono bg-[#4DAFFF] text-[#0A0E1A] hover:bg-[#4DAFFF]/90"
                      >
                        {finalizingPhase1 ? "처리 중..." : "동점 처리 확정"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Phase 1 선정 팀 info panel - shown when phase1SelectedTeamIds exists */}
            {eventConfig && eventConfig.phase1SelectedTeamIds && eventConfig.phase1SelectedTeamIds.length > 0 && eventConfig.status !== "closed_p1" && (
              <div className="bg-[#1A2235] rounded-xl p-4 border border-[#4DAFFF]/10">
                <h3 className="text-[#4DAFFF] font-mono text-sm font-semibold mb-3">Phase 1 선정 팀 (2차 투표 대상)</h3>
                <div className="flex flex-wrap gap-2">
                  {eventConfig.phase1SelectedTeamIds.map((teamId) => {
                    const team = teams.find((t) => t.id === teamId);
                    return team ? (
                      <span key={teamId} className="px-2 py-1 bg-[#4DAFFF]/10 border border-[#4DAFFF]/20 rounded font-mono text-xs text-[#4DAFFF]">
                        {team.emoji} {team.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Final Tie Resolution - shown when closed_p2 and ties detected */}
            {eventConfig && (eventConfig.status === "closed_p2" || eventConfig.status === "revealed_final") && eventConfig.phase1SelectedTeamIds && (() => {
              const finalScores = calculateFinalScores(
                teams,
                eventConfig.judgeWeight,
                eventConfig.participantWeight,
                eventConfig.phase1SelectedTeamIds!
              );
              const tiedTeams = detectFinalTies(finalScores);
              const hasOverrides = eventConfig.finalRankingOverrides && eventConfig.finalRankingOverrides.length === 3;

              if (!tiedTeams && !hasOverrides) return null;

              return (
                <div className="bg-[#1A2235] rounded-xl p-6 border border-[#FF6B35]/20">
                  <h2 className="text-[#FF6B35] font-mono font-semibold mb-4">최종 순위 결정</h2>

                  {hasOverrides ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[#00FF88] font-mono text-sm">순위 확정 완료</span>
                      </div>
                      <div className="space-y-2">
                        {eventConfig.finalRankingOverrides!.map((teamId, i) => {
                          const team = teams.find((t) => t.id === teamId);
                          const score = finalScores.find((s) => s.teamId === teamId);
                          const medals = ["🥇", "🥈", "🥉"];
                          return team ? (
                            <div key={teamId} className="flex items-center gap-3 p-2 rounded-lg bg-[#0A0E1A]/50">
                              <span className="text-lg">{medals[i]}</span>
                              <span className="font-mono text-sm text-white">{team.emoji} {team.name}</span>
                              <span className="text-gray-500 font-mono text-xs ml-auto">{score?.finalScore.toFixed(2)}점</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                      {eventConfig.status === "closed_p2" && (
                        <Button
                          onClick={async () => {
                            setFinalTieRanking([]);
                            try {
                              await callAdminApi("resolveFinalTies", { rankedTeamIds: [] });
                              toast.success("순위가 초기화되었습니다.");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                          variant="outline"
                          className="font-mono text-xs border-[#FF6B35]/30 text-[#FF6B35] hover:bg-[#FF6B35]/10 mt-2"
                        >
                          순위 재설정
                        </Button>
                      )}
                    </div>
                  ) : tiedTeams ? (
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <p className="text-yellow-400 font-mono text-sm font-semibold mb-1">동점 발생! ({finalScores.length}팀 후보)</p>
                        <p className="text-yellow-400/70 font-mono text-xs">
                          동점인 팀이 있습니다. 후보 {finalScores.length}팀 중 1위~3위를 직접 지정해주세요.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-gray-400 font-mono text-xs mb-1">TOP 3 팀 (동점 포함):</p>
                        {finalScores.map((score) => {
                          const isTied = tiedTeams.some((t) => t.teamId === score.teamId);
                          return (
                            <div key={score.teamId} className={`flex items-center gap-3 p-2 rounded-lg ${isTied ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-[#0A0E1A]/50"}`}>
                              <span className="text-lg">{score.emoji}</span>
                              <span className="font-mono text-sm text-white">{score.teamName}</span>
                              <span className={`font-mono text-xs ${isTied ? "text-yellow-400" : "text-gray-500"}`}>
                                {score.finalScore.toFixed(2)}점 {isTied && "(동점)"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        <p className="text-gray-400 font-mono text-xs">순위 지정 (1위 → 2위 → 3위 순서로 선택):</p>
                        {[0, 1, 2].map((rank) => {
                          const medals = ["🥇 1위", "🥈 2위", "🥉 3위"];
                          return (
                            <div key={rank} className="flex items-center gap-3">
                              <span className="font-mono text-sm w-12 text-right">{medals[rank]}</span>
                              <select
                                className="flex-1 bg-[#0A0E1A] border border-gray-600 rounded-lg px-3 py-2 font-mono text-sm text-white"
                                value={finalTieRanking[rank] ?? ""}
                                onChange={(e) => {
                                  setFinalTieRanking((prev) => {
                                    const next = [...prev];
                                    next[rank] = e.target.value;
                                    return next.filter(Boolean);
                                  });
                                }}
                              >
                                <option value="">선택하세요</option>
                                {finalScores.map((s) => (
                                  <option
                                    key={s.teamId}
                                    value={s.teamId}
                                    disabled={finalTieRanking.includes(s.teamId) && finalTieRanking[rank] !== s.teamId}
                                  >
                                    {s.emoji} {s.teamName} ({s.finalScore.toFixed(2)}점)
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        onClick={handleResolveFinalTies}
                        disabled={resolvingFinalTies || finalTieRanking.length !== 3}
                        className="font-mono bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90"
                      >
                        {resolvingFinalTies ? "처리 중..." : "최종 순위 확정"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* Timer Control Card */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <h2 className="text-[#00FF88] font-mono font-semibold mb-4">타이머 관리</h2>

              {/* Current timer status */}
              {eventConfig && (
                <div className="mb-4 p-3 rounded-lg bg-[#0A0E1A]/50">
                  {timer.isActive && eventConfig.votingDeadline ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "#00FF8880" }}>
                          남은 시간
                        </span>
                        <span
                          className="font-mono text-2xl font-bold tabular-nums"
                          style={{
                            color: timer.urgency === "critical" ? "#FF6B35" : timer.urgency === "warning" ? "#FF6B35" : "#00FF88",
                            textShadow: timer.urgency !== "normal" ? "0 0 12px #FF6B3580" : "0 0 12px #00FF8880",
                            animation: timer.urgency === "critical" ? "pulse 1s ease-in-out infinite" : undefined,
                          }}
                        >
                          {timer.formattedTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded border font-mono ${
                          eventConfig.autoCloseEnabled
                            ? "bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/30"
                            : "bg-gray-500/10 text-gray-400 border-gray-500/30"
                        }`}>
                          자동 마감: {eventConfig.autoCloseEnabled ? "ON" : "OFF"}
                        </span>
                      </div>
                    </div>
                  ) : timer.isExpired ? (
                    <div className="text-center">
                      <span className="font-mono text-sm" style={{ color: "#FF6B35" }}>
                        타이머 만료됨
                      </span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="font-mono text-sm text-gray-500">
                        타이머가 설정되지 않았습니다
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Preset buttons */}
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 font-mono text-xs block mb-2">프리셋</label>
                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 15, 30].map((min) => (
                      <Button
                        key={min}
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            await callAdminApi("setTimer", { durationSec: min * 60, autoCloseEnabled: eventConfig?.autoCloseEnabled ?? false });
                            toast.success(`${min}분 타이머가 설정되었습니다.`);
                          } catch (e) { toast.error((e as Error).message); }
                          finally { setSubmitting(false); }
                        }}
                        className="font-mono text-xs border-[#4DAFFF]/30 text-[#4DAFFF] hover:bg-[#4DAFFF]/10 hover:border-[#4DAFFF]/50"
                      >
                        {min}분
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom minutes input */}
                <div>
                  <label className="text-gray-400 font-mono text-xs block mb-2">커스텀 시간</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="180"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 1)}
                      className="font-mono bg-[#0A0E1A] border-[#00FF88]/20 w-24"
                    />
                    <span className="self-center text-gray-400 font-mono text-sm">분</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={submitting}
                      onClick={async () => {
                        setSubmitting(true);
                        try {
                          await callAdminApi("setTimer", { durationSec: customMinutes * 60, autoCloseEnabled: eventConfig?.autoCloseEnabled ?? false });
                          toast.success(`${customMinutes}분 타이머가 설정되었습니다.`);
                        } catch (e) { toast.error((e as Error).message); }
                        finally { setSubmitting(false); }
                      }}
                      className="font-mono text-xs"
                    >
                      설정
                    </Button>
                  </div>
                </div>

                {/* Target time picker */}
                <div>
                  <label className="text-gray-400 font-mono text-xs block mb-2">특정 시간에 종료</label>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={targetTime}
                      onChange={(e) => setTargetTime(e.target.value)}
                      className="font-mono bg-[#0A0E1A] border-[#00FF88]/20 w-36"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={submitting || !targetTime}
                      onClick={async () => {
                        const [h, m] = targetTime.split(":").map(Number);
                        const target = new Date();
                        target.setHours(h, m, 0, 0);
                        // 입력한 시간이 이미 지났으면 다음 날로 설정
                        if (target.getTime() <= Date.now()) {
                          target.setDate(target.getDate() + 1);
                        }
                        const diffSec = Math.floor((target.getTime() - Date.now()) / 1000);
                        if (diffSec < 60) {
                          toast.error("최소 1분 이상의 시간을 설정해주세요.");
                          return;
                        }
                        setSubmitting(true);
                        try {
                          await callAdminApi("setTimer", { durationSec: diffSec, autoCloseEnabled: eventConfig?.autoCloseEnabled ?? false });
                          toast.success(`${targetTime} 종료로 타이머가 설정되었습니다.`);
                        } catch (e) { toast.error((e as Error).message); }
                        finally { setSubmitting(false); }
                      }}
                      className="font-mono text-xs"
                    >
                      설정
                    </Button>
                    {targetTime && (
                      <span className="self-center text-gray-500 font-mono text-xs">
                        {(() => {
                          const [h, m] = targetTime.split(":").map(Number);
                          const target = new Date();
                          target.setHours(h, m, 0, 0);
                          if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
                          const diffMin = Math.max(0, Math.floor((target.getTime() - Date.now()) / 60000));
                          const dh = Math.floor(diffMin / 60);
                          const dm = diffMin % 60;
                          return dh > 0 ? `(약 ${dh}시간 ${dm}분 후)` : `(약 ${dm}분 후)`;
                        })()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Extend buttons */}
                <div>
                  <label className="text-gray-400 font-mono text-xs block mb-2">시간 연장</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10].map((min) => (
                      <Button
                        key={min}
                        variant="outline"
                        size="sm"
                        disabled={submitting || !eventConfig?.votingDeadline}
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            await callAdminApi("extendTimer", { additionalSec: min * 60 });
                            toast.success(`${min}분 연장되었습니다.`);
                          } catch (e) { toast.error((e as Error).message); }
                          finally { setSubmitting(false); }
                        }}
                        className="font-mono text-xs border-[#00FF88]/30 text-[#00FF88] hover:bg-[#00FF88]/10 hover:border-[#00FF88]/50"
                      >
                        +{min}분
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Auto-close toggle + Reset */}
                <div className="flex items-center justify-between pt-2 border-t border-[#00FF88]/10">
                  <div className="flex items-center gap-3">
                    <label className="text-gray-400 font-mono text-xs">자동 마감</label>
                    <button
                      onClick={async () => {
                        if (!eventConfig) return;
                        setSubmitting(true);
                        try {
                          const newVal = !eventConfig.autoCloseEnabled;
                          await callAdminApi("toggleAutoClose", {
                            autoCloseEnabled: newVal,
                          });
                          toast.success(newVal ? "자동 마감이 활성화되었습니다." : "자동 마감이 비활성화되었습니다.");
                        } catch (e) { toast.error((e as Error).message); }
                        finally { setSubmitting(false); }
                      }}
                      disabled={submitting}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        eventConfig?.autoCloseEnabled ? "bg-[#00FF88]" : "bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          eventConfig?.autoCloseEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-gray-500 font-mono text-xs">
                      (타이머 종료 시 자동으로 투표 마감)
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submitting || !eventConfig?.votingDeadline}
                    onClick={async () => {
                      if (!confirm("타이머를 초기화하시겠습니까?")) return;
                      setSubmitting(true);
                      try {
                        await callAdminApi("resetTimer", {});
                        toast.success("타이머가 초기화되었습니다.");
                      } catch (e) { toast.error((e as Error).message); }
                      finally { setSubmitting(false); }
                    }}
                    className="font-mono text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    타이머 초기화
                  </Button>
                </div>
              </div>
            </div>

            {/* Config Card */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[#00FF88] font-mono font-semibold">가중치 설정</h2>
                {!editingConfig ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingConfig(true)}>
                    수정
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveConfig} disabled={submitting}>저장</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingConfig(false)}>취소</Button>
                  </div>
                )}
              </div>
              {eventConfig && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">심사위원 가중치</label>
                    {editingConfig ? (
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={configForm.judgeWeight}
                        onChange={(e) =>
                          setConfigForm((p) => ({ ...p, judgeWeight: parseFloat(e.target.value) }))
                        }
                        className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                      />
                    ) : (
                      <div className="text-white font-mono text-lg">{eventConfig.judgeWeight}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">참가자 가중치</label>
                    {editingConfig ? (
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={configForm.participantWeight}
                        onChange={(e) =>
                          setConfigForm((p) => ({ ...p, participantWeight: parseFloat(e.target.value) }))
                        }
                        className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                      />
                    ) : (
                      <div className="text-white font-mono text-lg">{eventConfig.participantWeight}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">최대 투표 수</label>
                    {editingConfig ? (
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={configForm.maxVotesPerUser}
                        onChange={(e) =>
                          setConfigForm((p) => ({ ...p, maxVotesPerUser: parseInt(e.target.value) }))
                        }
                        className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                      />
                    ) : (
                      <div className="text-white font-mono text-lg">{eventConfig.maxVotesPerUser}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="bg-red-950/20 rounded-xl p-6 border border-red-500/20">
              <h2 className="text-red-400 font-mono font-semibold mb-4">위험 구역</h2>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="destructive"
                  onClick={handleResetVotes}
                  disabled={submitting}
                  className="font-mono"
                >
                  모든 투표 초기화
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetPhase2Votes}
                  disabled={submitting}
                  className="font-mono"
                >
                  2차 투표만 초기화
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetAll}
                  disabled={submitting}
                  className="font-mono"
                >
                  전체 초기화 (팀+참가자+투표)
                </Button>
              </div>
              <p className="text-red-400/60 font-mono text-xs mt-3">
                전체 초기화: 모든 팀, 참가자, 심사위원, 투표를 삭제합니다. 관리자 계정만 유지됩니다.
              </p>
            </div>
          </div>
        )}

        {/* TEAMS TAB */}
        {activeTab === "teams" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[#00FF88] font-mono font-semibold">팀 목록 ({teams.length})</h2>
              <Button onClick={() => setShowAddTeam(true)} disabled={showAddTeam}>
                + 팀 추가
              </Button>
            </div>

            {/* Add Team Form */}
            {showAddTeam && (
              <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/30">
                <h3 className="text-[#00FF88] font-mono mb-4">새 팀 추가</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">팀 이름</label>
                    <Input
                      value={teamForm.name}
                      onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="팀 이름"
                      className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">설명</label>
                    <Input
                      value={teamForm.description}
                      onChange={(e) => setTeamForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="팀 설명"
                      className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">이모지</label>
                    <div className="flex flex-wrap gap-2">
                      {TEAM_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setTeamForm((p) => ({ ...p, emoji }))}
                          className={`w-9 h-9 text-lg rounded-lg border transition-all ${
                            teamForm.emoji === emoji
                              ? "border-[#00FF88] bg-[#00FF88]/10"
                              : "border-[#1A2235] hover:border-gray-500"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleAddTeam} disabled={submitting}>추가</Button>
                    <Button variant="outline" onClick={() => setShowAddTeam(false)}>취소</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Teams List */}
            <div className="space-y-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-[#1A2235] rounded-xl p-4 border border-[#00FF88]/10"
                >
                  {editingTeam?.id === team.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="text-gray-400 font-mono text-xs block mb-1">팀 이름</label>
                          <Input
                            value={editingTeam.name}
                            onChange={(e) =>
                              setEditingTeam((p) => p ? { ...p, name: e.target.value } : null)
                            }
                            className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 font-mono text-xs block mb-1">팀 별칭</label>
                          <Input
                            value={editingTeam.nickname ?? ""}
                            onChange={(e) =>
                              setEditingTeam((p) => p ? { ...p, nickname: e.target.value } : null)
                            }
                            placeholder="별칭 (선택)"
                            className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-gray-400 font-mono text-xs block mb-1">설명</label>
                          <Input
                            value={editingTeam.description}
                            onChange={(e) =>
                              setEditingTeam((p) => p ? { ...p, description: e.target.value } : null)
                            }
                            className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 font-mono text-xs block mb-1">프로젝트 URL</label>
                          <Input
                            value={editingTeam.projectUrl ?? ""}
                            onChange={(e) =>
                              setEditingTeam((p) => p ? { ...p, projectUrl: e.target.value } : null)
                            }
                            placeholder="https://"
                            className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 font-mono text-xs block mb-1">데모 URL</label>
                          <Input
                            value={editingTeam.demoUrl ?? ""}
                            onChange={(e) =>
                              setEditingTeam((p) => p ? { ...p, demoUrl: e.target.value } : null)
                            }
                            placeholder="https://"
                            className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 font-mono text-xs block mb-1">GitHub URL</label>
                          <Input
                            value={editingTeam.githubUrl ?? ""}
                            onChange={(e) =>
                              setEditingTeam((p) => p ? { ...p, githubUrl: e.target.value } : null)
                            }
                            placeholder="https://github.com/"
                            className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 font-mono text-xs block mb-1">기술 스택 (쉼표 구분)</label>
                          <Input
                            value={Array.isArray(editingTeam.techStack) ? editingTeam.techStack.join(", ") : (editingTeam.techStack ?? "")}
                            onChange={(e) =>
                              setEditingTeam((p) =>
                                p
                                  ? {
                                      ...p,
                                      techStack: e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    }
                                  : null
                              )
                            }
                            placeholder="React, TypeScript, Firebase"
                            className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TEAM_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setEditingTeam((p) => p ? { ...p, emoji } : null)}
                            className={`w-8 h-8 text-base rounded-lg border transition-all ${
                              editingTeam.emoji === emoji
                                ? "border-[#00FF88] bg-[#00FF88]/10"
                                : "border-[#1A2235] hover:border-gray-500"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateTeam} disabled={submitting}>저장</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTeam(null)}>취소</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{team.emoji}</span>
                        <div>
                          <div className="text-white font-mono font-semibold">{team.name}</div>
                          <div className="text-gray-400 text-sm">{team.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs font-mono text-gray-400">
                          <div>심사: {team.judgeVoteCount}표</div>
                          <div>참가자: {team.participantVoteCount}표</div>
                          <div>멤버: {team.memberUserIds.length}명</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTeam(team)}
                          >
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            disabled={submitting}
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {teams.length === 0 && (
                <div className="text-gray-500 font-mono text-sm text-center py-8">
                  등록된 팀이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* USERS & CODES TAB */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Generate Codes */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <h2 className="text-[#00FF88] font-mono font-semibold mb-4">코드 생성</h2>
              <div className="flex items-end gap-4">
                <div>
                  <label className="text-gray-400 font-mono text-xs block mb-1">개수</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={codeCount}
                    onChange={(e) => setCodeCount(parseInt(e.target.value) || 1)}
                    className="font-mono bg-[#0A0E1A] border-[#00FF88]/20 w-24"
                  />
                </div>
                <div>
                  <label className="text-gray-400 font-mono text-xs block mb-1">역할</label>
                  <select
                    value={codeRole}
                    onChange={(e) => setCodeRole(e.target.value as UserRole)}
                    className="h-10 px-3 rounded-lg bg-[#0A0E1A] border border-[#00FF88]/20 text-white font-mono text-sm"
                  >
                    <option value="participant">참가자</option>
                    <option value="judge">심사위원</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
                <Button onClick={handleGenerateCodes} disabled={generatingCodes}>
                  {generatingCodes ? "생성 중..." : "코드 생성"}
                </Button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-[#1A2235] rounded-xl border border-[#00FF88]/10 overflow-hidden">
              <div className="p-4 flex items-center justify-between border-b border-[#00FF88]/10">
                <h2 className="text-[#00FF88] font-mono font-semibold">
                  사용자 목록 ({users.length})
                </h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyAllCodes()}>
                    전체 복사
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyAllCodes("participant")}>
                    참가자 복사
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyAllCodes("judge")}>
                    심사위원 복사
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-[#00FF88]/10 text-gray-400 text-xs">
                      <th className="text-left p-3">코드</th>
                      <th className="text-left p-3">이름</th>
                      <th className="text-left p-3">역할</th>
                      <th className="text-left p-3">팀</th>
                      <th className="text-left p-3">투표</th>
                      <th className="text-left p-3">채팅</th>
                      <th className="text-left p-3">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      return (
                        <tr
                          key={u.uniqueCode}
                          className="border-b border-[#1A2235] hover:bg-[#0A0E1A]/50 transition-colors"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[#00FF88]">{u.uniqueCode}</span>
                              <button
                                onClick={() => copyToClipboard(u.uniqueCode)}
                                className="text-gray-500 hover:text-white text-xs"
                              >
                                복사
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-gray-300">{u.name}</td>
                          <td className="p-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                u.role === "admin"
                                  ? "bg-purple-500/20 text-purple-400"
                                  : u.role === "judge"
                                  ? "bg-[#FF6B35]/20 text-[#FF6B35]"
                                  : "bg-[#00FF88]/20 text-[#00FF88]"
                              }`}
                            >
                              {u.role === "admin" ? "관리자" : u.role === "judge" ? "심사위원" : "참가자"}
                            </span>
                          </td>
                          <td className="p-3">
                            <select
                              value={u.teamId || ""}
                              onChange={(e) =>
                                handleAssignTeam(u.uniqueCode, e.target.value || null)
                              }
                              className="bg-[#0A0E1A] border border-[#00FF88]/20 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="">미배정</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.emoji} {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-xs ${
                                u.hasVoted ? "text-[#00FF88]" : "text-gray-500"
                              }`}
                            >
                              {u.hasVoted ? "완료" : "미투표"}
                            </span>
                          </td>
                          <td className="p-3">
                            {u.role !== "admin" && (() => {
                              const mutedUntil = (u as User & { chatMutedUntil?: Date }).chatMutedUntil;
                              const isMuted = mutedUntil && new Date(mutedUntil) > new Date();
                              return isMuted ? (
                                <button
                                  onClick={() => handleUnmuteUser(u.uniqueCode)}
                                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                >
                                  뮤트해제
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleMuteUser(u.uniqueCode, 10)}
                                  className="text-xs text-gray-400 hover:text-[#FF6B35] transition-colors"
                                >
                                  10분뮤트
                                </button>
                              );
                            })()}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyToClipboard(u.uniqueCode)}
                                className="text-xs text-gray-400 hover:text-[#00FF88] transition-colors"
                              >
                                복사
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.uniqueCode, u.name)}
                                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="text-gray-500 font-mono text-sm text-center py-8">
                    생성된 사용자가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LIVE MONITOR TAB */}
        {activeTab === "monitor" && (
          <div className="space-y-6">
            {/* Voting Progress */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <h2 className="text-[#00FF88] font-mono font-semibold mb-4">투표 진행률</h2>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-white font-mono text-2xl font-bold">
                  {votedCount} / {totalCount}
                </span>
                <span className="text-gray-400 font-mono text-sm">명 투표 완료</span>
                <span className="text-[#00FF88] font-mono text-lg font-bold">
                  {totalCount > 0 ? Math.round((votedCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-[#0A0E1A] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-[#00FF88] rounded-full transition-all duration-500"
                  style={{
                    width: `${totalCount > 0 ? (votedCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* P1 투표 - participants */}
                <div className="p-3 rounded-lg bg-[#0A0E1A]/50">
                  <div className="text-[#00FF88] font-mono text-xs font-semibold mb-2">P1 투표 (참가자)</div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-mono text-lg font-bold">
                      {users.filter((u) => u.role === "participant" && (u.hasVotedP1 ?? u.hasVoted)).length}
                      {" / "}
                      {users.filter((u) => u.role === "participant").length}
                    </span>
                    <span className="text-[#00FF88] font-mono text-sm">
                      {users.filter((u) => u.role === "participant").length > 0
                        ? Math.round((users.filter((u) => u.role === "participant" && (u.hasVotedP1 ?? u.hasVoted)).length / users.filter((u) => u.role === "participant").length) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1A2235] rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-[#00FF88]/70 rounded-full transition-all duration-500"
                      style={{
                        width: `${users.filter((u) => u.role === "participant").length > 0
                          ? (users.filter((u) => u.role === "participant" && (u.hasVotedP1 ?? u.hasVoted)).length / users.filter((u) => u.role === "participant").length) * 100
                          : 0}%`,
                      }}
                    />
                  </div>
                </div>
                {/* P2 투표 - judges */}
                <div className="p-3 rounded-lg bg-[#0A0E1A]/50">
                  <div className="text-[#FF6B35] font-mono text-xs font-semibold mb-2">P2 투표 (심사위원)</div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-mono text-lg font-bold">
                      {users.filter((u) => u.role === "judge" && (u.hasVotedP2 ?? u.hasVoted)).length}
                      {" / "}
                      {users.filter((u) => u.role === "judge").length}
                    </span>
                    <span className="text-[#FF6B35] font-mono text-sm">
                      {users.filter((u) => u.role === "judge").length > 0
                        ? Math.round((users.filter((u) => u.role === "judge" && (u.hasVotedP2 ?? u.hasVoted)).length / users.filter((u) => u.role === "judge").length) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1A2235] rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-[#FF6B35]/70 rounded-full transition-all duration-500"
                      style={{
                        width: `${users.filter((u) => u.role === "judge").length > 0
                          ? (users.filter((u) => u.role === "judge" && (u.hasVotedP2 ?? u.hasVoted)).length / users.filter((u) => u.role === "judge").length) * 100
                          : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Vote Counts per Team */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <h2 className="text-[#00FF88] font-mono font-semibold mb-4">팀별 득표 현황</h2>
              <div className="space-y-3">
                {teams
                  .slice()
                  .sort(
                    (a, b) =>
                      b.judgeVoteCount + b.participantVoteCount -
                      (a.judgeVoteCount + a.participantVoteCount)
                  )
                  .map((team) => {
                    const total = team.judgeVoteCount + team.participantVoteCount;
                    return (
                      <div key={team.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm text-white">
                            {team.emoji} {team.name}
                          </span>
                          <div className="flex gap-4 text-xs font-mono text-gray-400">
                            <span className="text-[#FF6B35]">심사: {team.judgeVoteCount}</span>
                            <span className="text-[#00FF88]">참가자: {team.participantVoteCount}</span>
                            <span className="text-white font-bold">총: {total}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 h-4">
                          <div
                            className="bg-[#FF6B35]/70 rounded-l transition-all duration-500"
                            style={{
                              width: `${maxVotes > 0 ? (team.judgeVoteCount / maxVotes) * 100 : 0}%`,
                            }}
                          />
                          <div
                            className="bg-[#00FF88]/70 rounded-r transition-all duration-500"
                            style={{
                              width: `${maxVotes > 0 ? (team.participantVoteCount / maxVotes) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {teams.length === 0 && (
                  <div className="text-gray-500 font-mono text-sm text-center py-4">
                    등록된 팀이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Score Preview */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <h2 className="text-[#00FF88] font-mono font-semibold mb-4">
                점수 미리보기 (TOP {Math.min(10, teams.length)})
              </h2>
              <div className="space-y-2">
                {top10.map((score) => (
                  <div
                    key={score.teamId}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#0A0E1A]/50"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-sm font-bold w-6 text-center ${
                          score.rank === 1
                            ? "text-yellow-400"
                            : score.rank === 2
                            ? "text-gray-300"
                            : score.rank === 3
                            ? "text-amber-600"
                            : "text-gray-500"
                        }`}
                      >
                        #{score.rank}
                      </span>
                      <span className="text-lg">{score.emoji}</span>
                      <span className="font-mono text-sm text-white">{score.teamName}</span>
                    </div>
                    <div className="flex gap-6 text-xs font-mono">
                      <span className="text-gray-400">
                        심: {score.judgeNormalized.toFixed(1)}
                      </span>
                      <span className="text-gray-400">
                        참: {score.participantNormalized.toFixed(1)}
                      </span>
                      <span className="text-[#00FF88] font-bold">
                        {score.finalScore.toFixed(2)}점
                      </span>
                    </div>
                  </div>
                ))}
                {top10.length === 0 && (
                  <div className="text-gray-500 font-mono text-sm text-center py-4">
                    투표 데이터가 없습니다.
                  </div>
                )}
              </div>
              {eventConfig && (
                <div className="mt-3 text-xs font-mono text-gray-500">
                  가중치: 심사위원 {(eventConfig.judgeWeight * 100).toFixed(0)}% /{" "}
                  참가자 {(eventConfig.participantWeight * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHAT MONITOR TAB */}
        {activeTab === "chat" && (
          <div className="space-y-6">
            {/* Init Chat Rooms */}
            <div className="bg-[#1A2235] rounded-xl p-4 border border-[#00FF88]/10 flex items-center justify-between">
              <div>
                <h2 className="text-[#00FF88] font-mono font-semibold">채팅방 관리</h2>
                <p className="text-gray-400 font-mono text-xs mt-1">
                  전체 채팅 + 팀별 채팅방 ({chatRooms.length}개 존재)
                </p>
              </div>
              <Button
                onClick={handleInitChatRooms}
                disabled={submitting}
                variant="outline"
                className="font-mono text-xs"
              >
                채팅방 초기화
              </Button>
            </div>

            {/* Room selector */}
            <div className="flex gap-2 flex-wrap">
              {chatRooms
                .slice()
                .sort((a, b) => (a.type === "global" ? -1 : b.type === "global" ? 1 : a.name.localeCompare(b.name)))
                .map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedChatRoom(room.id)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition-all ${
                      selectedChatRoom === room.id
                        ? "bg-[#00FF88]/10 border-[#00FF88] text-[#00FF88]"
                        : "border-[#1A2235] text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {room.name}
                    <span className="ml-1.5 text-gray-500">({room.messageCount})</span>
                  </button>
                ))}
              {chatRooms.length === 0 && (
                <span className="text-gray-500 font-mono text-sm">채팅방이 없습니다. 위에서 초기화하세요.</span>
              )}
            </div>

            {/* Messages list */}
            <div className="bg-[#1A2235] rounded-xl border border-[#00FF88]/10 overflow-hidden">
              <div className="p-4 border-b border-[#00FF88]/10">
                <h2 className="text-[#00FF88] font-mono font-semibold">
                  최근 메시지 {chatMessages.length > 0 && `(${chatMessages.length}개)`}
                </h2>
              </div>
              <div className="divide-y divide-[#1A2235]">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 flex items-start justify-between gap-4 ${
                      msg.deleted ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            msg.senderRole === "admin"
                              ? "bg-purple-500/20 text-purple-400"
                              : msg.senderRole === "judge"
                              ? "bg-[#FF6B35]/20 text-[#FF6B35]"
                              : "bg-[#00FF88]/20 text-[#00FF88]"
                          }`}
                        >
                          {msg.senderRole === "admin" ? "관리자" : msg.senderRole === "judge" ? "심사위원" : "참가자"}
                        </span>
                        <span className="text-white font-mono text-sm font-semibold">
                          {msg.senderName}
                        </span>
                        <span className="text-gray-500 font-mono text-xs">
                          {msg.createdAt instanceof Date
                            ? msg.createdAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                            : ""}
                        </span>
                        {msg.deleted && (
                          <span className="text-red-400 font-mono text-xs">[삭제됨]</span>
                        )}
                      </div>
                      <p className="text-gray-300 font-mono text-sm break-words">
                        {msg.text}
                      </p>
                    </div>
                    {!msg.deleted && (
                      <button
                        onClick={() => handleDeleteMessage(selectedChatRoom, msg.id)}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors shrink-0 font-mono"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="text-gray-500 font-mono text-sm text-center py-10">
                    메시지가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MISSIONS TAB */}
        {activeTab === "missions" && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[#00FF88] font-mono font-semibold">미션 수행 현황</h2>
                <Button
                  onClick={handleFetchMissions}
                  disabled={missionLoading}
                  variant="outline"
                  className="font-mono text-xs"
                >
                  {missionLoading ? "로딩 중..." : "새로고침"}
                </Button>
              </div>

              {/* Mission stats overview */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {MISSIONS.map((mission) => {
                  const completedUsers = missionUsers.filter((u) =>
                    u.missions.some((m) => m.missionId === mission.id && m.completed)
                  ).length;
                  return (
                    <div
                      key={mission.id}
                      className="bg-[#0A0E1A]/50 rounded-lg p-3 text-center"
                    >
                      <div className="text-2xl mb-1">{mission.icon}</div>
                      <div className="text-white font-mono text-xs font-semibold">{mission.title}</div>
                      <div className="text-[#00FF88] font-mono text-lg font-bold mt-1">
                        {completedUsers}
                        <span className="text-gray-500 text-xs font-normal">
                          /{missionUsers.length}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All-complete leaderboard */}
              {(() => {
                const allComplete = missionUsers.filter(
                  (u) => u.completedCount === MISSIONS.length
                );
                if (allComplete.length === 0) return null;
                return (
                  <div className="bg-[#00FF88]/5 rounded-lg p-4 border border-[#00FF88]/20">
                    <h3 className="text-[#00FF88] font-mono text-sm font-semibold mb-2">
                      🏆 전체 미션 완료 ({allComplete.length}명)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allComplete.map((u) => {
                        const userTeam = teams.find((t) => t.id === u.teamId);
                        return (
                          <span
                            key={u.uniqueCode}
                            className="px-2 py-1 bg-[#00FF88]/10 text-[#00FF88] rounded font-mono text-xs border border-[#00FF88]/20"
                          >
                            {u.name}
                            {userTeam && (
                              <span className="text-gray-400 ml-1">
                                ({userTeam.emoji} {userTeam.nickname || userTeam.name})
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* User-level progress table */}
            <div className="bg-[#1A2235] rounded-xl border border-[#00FF88]/10 overflow-hidden">
              <div className="p-4 border-b border-[#00FF88]/10">
                <h2 className="text-[#00FF88] font-mono font-semibold">
                  참가자별 미션 진행 ({missionUsers.length}명)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-[#00FF88]/10 text-gray-400 text-xs">
                      <th className="text-left p-3">이름</th>
                      <th className="text-left p-3">역할</th>
                      <th className="text-left p-3">팀</th>
                      {MISSIONS.map((m) => (
                        <th key={m.id} className="text-center p-3" title={m.description}>
                          {m.icon}
                        </th>
                      ))}
                      <th className="text-center p-3">완료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missionUsers.map((u) => {
                      const userTeam = teams.find((t) => t.id === u.teamId);
                      return (
                        <tr
                          key={u.uniqueCode}
                          className={`border-b border-[#1A2235] hover:bg-[#0A0E1A]/50 transition-colors ${
                            u.completedCount === MISSIONS.length ? "bg-[#00FF88]/5" : ""
                          }`}
                        >
                          <td className="p-3 text-white">{u.name}</td>
                          <td className="p-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                u.role === "judge"
                                  ? "bg-[#FF6B35]/20 text-[#FF6B35]"
                                  : "bg-[#00FF88]/20 text-[#00FF88]"
                              }`}
                            >
                              {u.role === "judge" ? "심사위원" : "참가자"}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400 text-xs">
                            {userTeam
                              ? `${userTeam.emoji} ${userTeam.nickname || userTeam.name}`
                              : "미배정"}
                          </td>
                          {MISSIONS.map((mission) => {
                            const progress = u.missions.find(
                              (m) => m.missionId === mission.id
                            );
                            const current = progress?.current ?? 0;
                            const completed = progress?.completed ?? false;
                            const resolvedTarget = mission.target > 0 ? mission.target : teams.length;
                            return (
                              <td key={mission.id} className="text-center p-3">
                                {completed ? (
                                  <span className="text-[#00FF88]" title="완료">✓</span>
                                ) : current > 0 ? (
                                  <span
                                    className="text-yellow-400 text-xs"
                                    title={`${current}/${resolvedTarget}`}
                                  >
                                    {current}/{resolvedTarget}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center p-3">
                            <span
                              className={`font-bold ${
                                u.completedCount === MISSIONS.length
                                  ? "text-[#00FF88]"
                                  : u.completedCount > 0
                                  ? "text-yellow-400"
                                  : "text-gray-500"
                              }`}
                            >
                              {u.completedCount}/{MISSIONS.length}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {missionLoading && (
                  <div className="text-[#00FF88] font-mono text-sm text-center py-10 animate-pulse">
                    미션 데이터를 불러오는 중...
                  </div>
                )}
                {!missionLoading && missionUsers.length === 0 && (
                  <div className="text-gray-500 font-mono text-sm text-center py-10">
                    미션 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ANNOUNCE TAB */}
        {activeTab === "announce" && (
          <div className="space-y-6">
            {/* Create Announcement Form */}
            <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
              <h2 className="text-[#00FF88] font-mono font-semibold mb-4">새 공지 생성</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 font-mono text-xs block mb-1">공지 내용 (최대 200자)</label>
                  <Input
                    value={announcementForm.text}
                    onChange={(e) =>
                      setAnnouncementForm((p) => ({ ...p, text: e.target.value }))
                    }
                    placeholder="공지 내용을 입력하세요..."
                    maxLength={200}
                    className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                  />
                  <div className="text-gray-600 font-mono text-xs mt-1 text-right">
                    {announcementForm.text.length}/200
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">공지 유형</label>
                    <select
                      value={announcementForm.type}
                      onChange={(e) =>
                        setAnnouncementForm((p) => ({
                          ...p,
                          type: e.target.value as "info" | "warning" | "success",
                        }))
                      }
                      className="h-10 w-full px-3 rounded-lg bg-[#0A0E1A] border border-[#00FF88]/20 text-white font-mono text-sm"
                    >
                      <option value="info">정보 (info)</option>
                      <option value="warning">경고 (warning)</option>
                      <option value="success">성공 (success)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 font-mono text-xs block mb-1">만료 시간 (분)</label>
                    <Input
                      type="number"
                      min="1"
                      max="1440"
                      value={announcementForm.expiresMinutes}
                      onChange={(e) =>
                        setAnnouncementForm((p) => ({
                          ...p,
                          expiresMinutes: parseInt(e.target.value) || 60,
                        }))
                      }
                      className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateAnnouncement}
                  disabled={submitting || !announcementForm.text.trim()}
                  className="font-mono bg-[#00FF88] text-[#0A0E1A] hover:bg-[#00FF88]/90"
                >
                  {submitting ? "생성 중..." : "공지 생성"}
                </Button>
              </div>
            </div>

            {/* Active Announcements List */}
            <div className="bg-[#1A2235] rounded-xl border border-[#00FF88]/10 overflow-hidden">
              <div className="p-4 border-b border-[#00FF88]/10">
                <h2 className="text-[#00FF88] font-mono font-semibold">
                  활성 공지 ({announcements.length}개)
                </h2>
              </div>
              {announcements.length === 0 ? (
                <div className="text-gray-500 font-mono text-sm text-center py-10">
                  활성 공지가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-[#0A0E1A]">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 flex items-start justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded border font-mono ${
                              ann.type === "success"
                                ? "bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/30"
                                : ann.type === "warning"
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                : "bg-[#4DAFFF]/10 text-[#4DAFFF] border-[#4DAFFF]/30"
                            }`}
                          >
                            {ann.type === "success" ? "성공" : ann.type === "warning" ? "경고" : "정보"}
                          </span>
                          <span className="text-gray-500 font-mono text-xs">
                            {ann.createdAt instanceof Date
                              ? ann.createdAt.toLocaleString("ko-KR", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                          {ann.expiresAt && (
                            <span className="text-gray-600 font-mono text-xs">
                              만료:{" "}
                              {ann.expiresAt instanceof Date
                                ? ann.expiresAt.toLocaleString("ko-KR", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-white font-mono text-sm break-words">{ann.text}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors shrink-0 font-mono"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="h-12" />
      </div>
    </div>
  );
}

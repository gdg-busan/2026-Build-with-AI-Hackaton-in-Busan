"use client";

import { AnnouncementTicker } from "@/components/AnnouncementTicker";
import { CountdownTimer } from "@/components/CountdownTimer";
import { MemberProfileDialog } from "@/components/MemberProfileDialog";
import { MissionPanel } from "@/components/MissionPanel";
import { TeamCard } from "@/components/TeamCard";
import { TeamDetailSheet } from "@/components/TeamDetailSheet";
import { TeamEditDialog } from "@/components/TeamEditDialog";
import { VoteConfirmDialog } from "@/components/VoteConfirmDialog";
import { VotingProgress } from "@/components/VotingProgress";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMissions } from "@/hooks/useMissions";
import { useVotingTimer } from "@/hooks/useVotingTimer";
import { useAuth } from "@/lib/auth-context";
import { EVENT_ID } from "@/lib/constants";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import type { EventConfig, MemberProfile, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, LogOut, Pencil, Trophy, UserPen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function VotePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { updateProgress, updateUniqueProgress } = useMissions(
    user?.uniqueCode,
  );

  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [votedCount, setVotedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState<string>("");
  const [myBio, setMyBio] = useState<string | null>(null);
  const [inspectTeam, setInspectTeam] = useState<Team | null>(null);
  const [inspectMembers, setInspectMembers] = useState<MemberProfile[]>([]);
  const prevStatusRef = useRef<string | null>(null);
  const voteTimer = useVotingTimer(eventConfig);

  // Show toast when timer is extended
  useEffect(() => {
    if (voteTimer.wasExtended) {
      toast.info("투표 시간이 연장되었습니다!");
    }
  }, [voteTimer.wasExtended]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  // Real-time event config
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(getFirebaseDb(), "events", EVENT_ID),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          // 결과 공개로 전환되는 순간에만 자동 리디렉트 (최초 1회)
          if (
            (data.status === "revealed_p1" || data.status === "revealed_final") &&
            prevStatusRef.current !== null &&
            prevStatusRef.current !== "revealed_p1" &&
            prevStatusRef.current !== "revealed_final"
          ) {
            router.push("/results");
          }
          prevStatusRef.current = data.status;
          setEventConfig({
            id: snap.id,
            status: data.status,
            judgeWeight: data.judgeWeight ?? 1,
            participantWeight: data.participantWeight ?? 1,
            maxVotesP1: data.maxVotesP1 ?? data.maxVotesPerUser ?? 3,
            maxVotesP2: data.maxVotesP2 ?? data.maxVotesPerUser ?? 3,
            maxVotesPerUser: data.maxVotesPerUser,
            votingDeadline: data.votingDeadline?.toDate() ?? null,
            title: data.title ?? "",
            createdAt: data.createdAt?.toDate() ?? new Date(),
            autoCloseEnabled: data.autoCloseEnabled ?? false,
            timerDurationSec: data.timerDurationSec ?? null,
            phase1SelectedTeamIds: data.phase1SelectedTeamIds ?? undefined,
          });
        }
      },
    );
    return () => unsub();
  }, [user, router]);

  // Real-time teams
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(getFirebaseDb(), "events", EVENT_ID, "teams")),
      (snap) => {
        const t: Team[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          nickname: d.data().nickname ?? null,
          description: d.data().description,
          emoji: d.data().emoji,
          projectUrl: d.data().projectUrl ?? null,
          memberUserIds: d.data().memberUserIds ?? [],
          judgeVoteCount: d.data().judgeVoteCount ?? 0,
          participantVoteCount: d.data().participantVoteCount ?? 0,
          cheerCount: d.data().cheerCount ?? 0,
          demoUrl: d.data().demoUrl ?? null,
          githubUrl: d.data().githubUrl ?? null,
          techStack: d.data().techStack ?? [],
        }));
        setTeams(t);
      },
    );
    return () => unsub();
  }, [user]);

  const eventStatus = eventConfig?.status;

  // Real-time votes count + check if current user voted
  useEffect(() => {
    if (!user || !eventStatus) return;
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "events", EVENT_ID, "votes"),
      (snap) => {
        setVotedCount(
          snap.docs.filter((d) => d.data().role === "participant").length,
        );

        // Determine which phase vote doc to look for
        const currentPhase = eventStatus === "voting_p2" ? "p2" : "p1";
        const myVoteId = `${currentPhase}_${user.uid}`;
        const myVote = snap.docs.find((d) => d.id === myVoteId);
        if (myVote) {
          setVoteSuccess(true);
          setSelectedTeams(myVote.data().selectedTeams ?? []);
        }
      },
    );
    return () => unsub();
  }, [user, eventStatus]);

  // Total eligible voters (participants only)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "events", EVENT_ID, "users"),
      (snap) => {
        setTotalCount(
          snap.docs.filter((d) => d.data().role === "participant").length,
        );

        // Also update voteSuccess based on hasVotedP1/hasVotedP2
        if (eventStatus) {
          const myUserDoc = snap.docs.find((d) => d.id === user.uniqueCode);
          if (myUserDoc) {
            const userData = myUserDoc.data();
            if (eventStatus === "voting_p1" && userData.hasVotedP1) {
              setVoteSuccess(true);
            } else if (eventStatus === "voting_p2" && userData.hasVotedP2) {
              setVoteSuccess(true);
            }
          }
        }
      },
    );
    return () => unsub();
  }, [user, eventStatus]);

  // Fetch current user's bio from Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(getFirebaseDb(), "events", EVENT_ID, "users", user.uniqueCode),
      (snap) => {
        if (snap.exists()) {
          setMyDisplayName(snap.data().name ?? "");
          setMyBio(snap.data().bio ?? null);

          // Update voteSuccess based on user doc hasVotedP1/hasVotedP2
          if (eventStatus) {
            if (eventStatus === "voting_p1" && snap.data().hasVotedP1) {
              setVoteSuccess(true);
            } else if (eventStatus === "voting_p2" && snap.data().hasVotedP2) {
              setVoteSuccess(true);
            }
          }
        }
      },
    );
    return () => unsub();
  }, [user, eventStatus]);

  // Reset voteSuccess when phase changes
  useEffect(() => {
    setVoteSuccess(false);
    setSelectedTeams([]);
  }, [eventConfig?.status]);

  // Fetch member profiles when inspectTeam changes
  useEffect(() => {
    if (!inspectTeam || inspectTeam.memberUserIds.length === 0) {
      setInspectMembers([]);
      return;
    }

    const memberIds = inspectTeam.memberUserIds;
    const usersCol = collection(getFirebaseDb(), "events", EVENT_ID, "users");

    // Firestore 'in' query supports up to 30 items
    const q = query(
      usersCol,
      where(documentId(), "in", memberIds.slice(0, 30)),
    );
    getDocs(q).then((snap) => {
      const members: MemberProfile[] = snap.docs.map((d) => ({
        uniqueCode: d.id,
        name: d.data().name ?? d.id,
        bio: d.data().bio ?? null,
        techTags: d.data().techTags ?? [],
      }));
      setInspectMembers(members);
    });
  }, [inspectTeam]);

  const handleInspect = useCallback(
    (team: Team) => {
      setInspectTeam(team);
      updateUniqueProgress("visit_all_teams", team.id, teams.length);
    },
    [updateUniqueProgress, teams.length],
  );

  const handleToggle = useCallback(
    (teamId: string) => {
      const maxVotes =
        eventConfig?.status === "voting_p2"
          ? (eventConfig?.maxVotesP2 ?? eventConfig?.maxVotesPerUser ?? 3)
          : (eventConfig?.maxVotesP1 ?? eventConfig?.maxVotesPerUser ?? 3);
      setSelectedTeams((prev) => {
        if (prev.includes(teamId)) {
          return prev.filter((id) => id !== teamId);
        }
        if (prev.length >= maxVotes) {
          toast.error(`최대 ${maxVotes}팀까지 선택할 수 있습니다`);
          return prev;
        }
        return [...prev, teamId];
      });
    },
    [eventConfig],
  );

  const handleSubmit = async () => {
    if (selectedTeams.length === 0) return;
    setSubmitting(true);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error("인증 토큰을 가져올 수 없습니다");

      const res = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selectedTeams }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "투표에 실패했습니다");

      setConfirmOpen(false);
      setVoteSuccess(true);
      toast.success("투표가 완료되었습니다!");
      updateProgress("first_vote", 1);

      // Trigger confetti
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00FF88", "#00CC66", "#00FF88", "#ffffff"],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "투표에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTeamObjects = teams.filter((t) => selectedTeams.includes(t.id));
  const maxVotes =
    eventConfig?.status === "voting_p2"
      ? (eventConfig?.maxVotesP2 ?? eventConfig?.maxVotesPerUser ?? 3)
      : (eventConfig?.maxVotesP1 ?? eventConfig?.maxVotesPerUser ?? 3);
  const myTeam = teams.find((t) => t.id === user?.teamId);

  const status = eventConfig?.status;

  // Whether this specific user can actually cast a vote right now
  const canUserVote =
    (status === "voting_p1" && user?.role === "participant") ||
    (status === "voting_p2" && user?.role === "judge");

  // Teams to display in the grid
  const displayTeams =
    status === "voting_p2" && eventConfig?.phase1SelectedTeamIds
      ? teams.filter((t) => eventConfig.phase1SelectedTeamIds!.includes(t.id))
      : teams;

  // Show teams grid in all states
  const showTeams =
    status === "waiting" ||
    status === "voting_p1" ||
    status === "closed_p1" ||
    status === "revealed_p1" ||
    status === "voting_p2" ||
    status === "closed_p2" ||
    status === "revealed_final";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-mono text-primary animate-pulse">$ loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const hasUrgency =
    voteTimer.urgency === "warning" ||
    voteTimer.urgency === "critical" ||
    voteTimer.urgency === "expired";

  const urgencyBg = {
    idle: { backgroundColor: "#0A0E1A" },
    normal: { backgroundColor: "#0A0E1A" },
    warning: { backgroundColor: "#1A1005" },
    critical: { backgroundColor: "#1A0505" },
    expired: { backgroundColor: "#1A0505" },
  };

  // Status banner text for non-interactive states
  const getStatusBanner = () => {
    if (!eventConfig) return null;

    if (status === "waiting") {
      return {
        title: "$ waiting_for_vote_start...",
        desc: "투표가 아직 시작되지 않았습니다. 잠시 기다려 주세요.",
      };
    }
    if (status === "voting_p1" && user.role === "judge") {
      return {
        title: "$ phase1_voting_in_progress...",
        desc: "참가자 투표가 진행 중입니다. 잠시 기다려 주세요.",
      };
    }
    if (status === "voting_p2" && user.role === "participant") {
      return {
        title: "$ phase2_voting_in_progress...",
        desc: "심사위원 투표가 진행 중입니다. 결과를 기다려 주세요.",
      };
    }
    if (status === "closed_p1") {
      return {
        title: "$ voting_closed",
        desc: "1차 투표가 마감되었습니다.",
      };
    }
    if (status === "revealed_p1") {
      return {
        title: "$ top10_revealed!",
        desc: "TOP 10이 공개되었습니다!",
      };
    }
    if (status === "closed_p2") {
      return {
        title: "$ voting_closed",
        desc: "최종 투표가 마감되었습니다.",
      };
    }
    if (status === "revealed_final") {
      return {
        title: "$ results_revealed!",
        desc: "결과가 공개되었습니다. 결과 페이지에서 확인하세요!",
      };
    }
    return null;
  };

  // Show the status banner when not in active-voting state for this user, and not showing vote success
  const showStatusBanner = !canUserVote && !voteSuccess;
  const statusBanner = getStatusBanner();

  return (
    <motion.div
      className={`min-h-screen relative ${hasUrgency ? "" : "bg-background"}`}
      animate={urgencyBg[voteTimer.urgency] || { backgroundColor: "#0A0E1A" }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
      style={hasUrgency ? {} : undefined}
    >
      {/* Urgency vignette overlay */}
      <AnimatePresence>
        {(voteTimer.urgency === "warning" ||
          voteTimer.urgency === "critical") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 pointer-events-none z-30"
            style={{
              background:
                voteTimer.urgency === "critical"
                  ? "radial-gradient(ellipse at center, transparent 30%, #FF000030 100%)"
                  : "radial-gradient(ellipse at center, transparent 40%, #FF6B3520 100%)",
              animation:
                voteTimer.urgency === "critical"
                  ? "pulse 2s ease-in-out infinite"
                  : undefined,
            }}
          />
        )}
      </AnimatePresence>

      {/* Top pulse bar for critical */}
      <AnimatePresence>
        {voteTimer.urgency === "critical" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 h-[2px] z-50"
            style={{
              background:
                "linear-gradient(90deg, transparent, #FF4444, transparent)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-2 gap-x-1 overflow-hidden">
          <div className="flex items-center gap-1.5 md:gap-3 flex-shrink min-w-0">
            <span className="font-mono font-bold text-primary glow-green text-xs sm:text-sm md:text-base flex items-center gap-1 truncate">
              <span className="text-muted-foreground hidden sm:inline">
                ~/gdg-busan/hackathon/
              </span>
              <span className="text-muted-foreground sm:hidden tracking-tighter">
                ~/
              </span>
              vote <span className="typing-cursor shrink-0" />
            </span>
            <span className="font-mono text-foreground text-xs sm:text-sm truncate opacity-80 shrink-0 max-w-[80px] sm:max-w-none">
              {myDisplayName || user.name}
            </span>
            <Badge
              className={cn(
                "font-mono shrink-0 whitespace-nowrap text-[10px] uppercase hidden sm:flex",
                user.role === "judge"
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                  : "bg-blue-500/20 text-blue-400 border-blue-500/30",
              )}
            >
              {user.role}
            </Badge>
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* Profile edit button - hidden when revealed_final */}
            {(user.role === "participant" || user.role === "judge") &&
              eventConfig?.status !== "revealed_final" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setProfileDialogOpen(true)}
                  className="font-mono gap-1.5 md:gap-2 text-primary hover:text-primary/80 px-2 md:px-3 text-xs md:text-sm"
                >
                  <UserPen className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">프로필</span>
                </Button>
              )}
            {/* Team edit button - participants only, hidden when revealed_final */}
            {user.role === "participant" &&
              myTeam &&
              eventConfig?.status !== "revealed_final" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                  className="font-mono gap-1.5 md:gap-2 text-[#4DAFFF] hover:text-[#4DAFFF]/80 px-2 md:px-3 text-xs md:text-sm"
                >
                  <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">팀 정보 수정</span>
                </Button>
              )}
            {/* Results navigation */}
            <Link href="/results">
              <Button
                variant="ghost"
                size="sm"
                className="font-mono gap-1.5 md:gap-2 text-[#FF6B35] hover:text-[#FF6B35]/80 px-2 md:px-3 text-xs md:text-sm"
              >
                <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">결과 보기</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
              className="font-mono gap-1.5 md:gap-2 px-2 md:px-3 text-xs md:text-sm"
            >
              <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">logout</span>
            </Button>
          </div>
        </div>
        <AnnouncementTicker />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Countdown timer */}
        {eventConfig && <CountdownTimer eventConfig={eventConfig} />}

        {/* Status banner for states where this user can't vote */}
        {eventConfig && showStatusBanner && statusBanner && (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
            <p className="font-mono text-2xl text-primary glow-green">
              {statusBanner.title}
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {statusBanner.desc}
            </p>
          </div>
        )}

        {/* Voted success state */}
        {voteSuccess && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-8 text-center space-y-3 card-glow-selected">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="font-mono text-2xl text-primary glow-green">
              $ vote_submitted!
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              투표가 성공적으로 완료되었습니다. 결과를 기다려 주세요.
            </p>
          </div>
        )}

        {/* Voting progress + selection counter - active voting only for eligible users */}
        {canUserVote && !voteSuccess && (
          <>
            <VotingProgress votedCount={votedCount} totalCount={totalCount} />
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-muted-foreground">
                투표할 팀을 선택하세요 (최대 {maxVotes}팀)
              </p>
              <span
                className={`font-mono text-sm font-bold ${
                  selectedTeams.length >= maxVotes
                    ? "text-primary glow-green"
                    : "text-muted-foreground"
                }`}
              >
                {selectedTeams.length}/{maxVotes} 팀 선택됨
              </span>
            </div>
          </>
        )}

        {/* Team grid - visible across all states */}
        {showTeams && displayTeams.length > 0 && (
          <>
            {!canUserVote && (
              <p className="font-mono text-xs text-muted-foreground">
                {"// 팀 목록 (읽기 전용)"}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...displayTeams]
                .sort((a, b) => {
                  const aIsOwn = a.id === user.teamId ? -1 : 0;
                  const bIsOwn = b.id === user.teamId ? -1 : 0;
                  return aIsOwn - bIsOwn;
                })
                .map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    isSelected={selectedTeams.includes(team.id)}
                    isOwnTeam={user.teamId === team.id}
                    onToggle={canUserVote ? handleToggle : () => {}}
                    onInspect={handleInspect}
                    disabled={
                      !canUserVote ||
                      voteSuccess ||
                      (!selectedTeams.includes(team.id) &&
                        selectedTeams.length >= maxVotes)
                    }
                  />
                ))}
            </div>
          </>
        )}

        {/* Submit button - only for eligible voters in active phase */}
        {canUserVote && !voteSuccess && (
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              disabled={selectedTeams.length === 0}
              onClick={() => setConfirmOpen(true)}
              className="font-mono px-10"
            >
              $ submit_vote ({selectedTeams.length}팀)
            </Button>
          </div>
        )}
      </main>

      {/* Confirm dialog */}
      <VoteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        selectedTeams={selectedTeamObjects}
        onConfirm={handleSubmit}
        loading={submitting}
      />

      {/* Team detail sheet */}
      <TeamDetailSheet
        team={inspectTeam}
        open={inspectTeam !== null}
        onOpenChange={(open) => {
          if (!open) setInspectTeam(null);
        }}
        isSelected={
          inspectTeam ? selectedTeams.includes(inspectTeam.id) : false
        }
        isOwnTeam={inspectTeam ? user.teamId === inspectTeam.id : false}
        canVote={canUserVote && !voteSuccess}
        maxReached={selectedTeams.length >= maxVotes}
        onToggleVote={handleToggle}
        members={inspectMembers}
        isTeamMember={inspectTeam ? user.teamId === inspectTeam.id : false}
      />

      {/* Member profile dialog */}
      <MemberProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        currentName={myDisplayName || user.name}
        currentBio={myBio}
      />

      {/* Team edit dialog */}
      {myTeam && (
        <TeamEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          team={myTeam}
        />
      )}

      {/* Chat panel */}
      {eventConfig && <ChatPanel />}

      {/* Mission panel */}
      {eventConfig && <MissionPanel />}
    </motion.div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
  getDocs,
  where,
  documentId,
} from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { EVENT_ID } from "@/lib/constants";
import type { Team, EventConfig, MemberProfile } from "@/lib/types";
import { useMissions } from "@/hooks/useMissions";
import { TeamCard } from "@/components/TeamCard";
import { TeamDetailSheet } from "@/components/TeamDetailSheet";
import { VotingProgress } from "@/components/VotingProgress";
import { VoteConfirmDialog } from "@/components/VoteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, CheckCircle2, Pencil, Trophy, UserPen } from "lucide-react";
import Link from "next/link";
import { TeamEditDialog } from "@/components/TeamEditDialog";
import { MemberProfileDialog } from "@/components/MemberProfileDialog";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MissionPanel } from "@/components/MissionPanel";
import { AnnouncementTicker } from "@/components/AnnouncementTicker";
import { CountdownTimer } from "@/components/CountdownTimer";

export default function VotePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { updateProgress, updateUniqueProgress } = useMissions(user?.uniqueCode);

  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [votedCount, setVotedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
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

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  // Real-time event config
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(getFirebaseDb(), "events", EVENT_ID), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // 결과 공개 시 자동으로 결과 페이지로 이동
        if (data.status === "revealed") {
          router.push("/results");
          return;
        }
        setEventConfig({
          id: snap.id,
          status: data.status,
          judgeWeight: data.judgeWeight ?? 1,
          participantWeight: data.participantWeight ?? 1,
          maxVotesPerUser: data.maxVotesPerUser ?? 3,
          votingDeadline: data.votingDeadline?.toDate() ?? null,
          title: data.title ?? "",
          createdAt: data.createdAt?.toDate() ?? new Date(),
        });
      }
    });
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
      }
    );
    return () => unsub();
  }, [user]);

  // Real-time votes count + check if current user voted
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "events", EVENT_ID, "votes"),
      (snap) => {
        setVotedCount(
          snap.docs.filter((d) => d.data().role === "participant").length
        );
        const myVote = snap.docs.find((d) => d.id === user.uid);
        if (myVote) {
          setHasVoted(true);
          setVoteSuccess(true);
        }
      }
    );
    return () => unsub();
  }, [user]);

  // Total eligible voters (participants only)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "events", EVENT_ID, "users"),
      (snap) => {
        setTotalCount(
          snap.docs.filter((d) => d.data().role === "participant").length
        );
      }
    );
    return () => unsub();
  }, [user]);

  // Fetch current user's bio from Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(getFirebaseDb(), "events", EVENT_ID, "users", user.uniqueCode),
      (snap) => {
        if (snap.exists()) {
          setMyDisplayName(snap.data().name ?? "");
          setMyBio(snap.data().bio ?? null);
        }
      }
    );
    return () => unsub();
  }, [user]);

  // Fetch member profiles when inspectTeam changes
  useEffect(() => {
    if (!inspectTeam || inspectTeam.memberUserIds.length === 0) {
      setInspectMembers([]);
      return;
    }

    const memberIds = inspectTeam.memberUserIds;
    const usersCol = collection(getFirebaseDb(), "events", EVENT_ID, "users");

    // Firestore 'in' query supports up to 30 items
    const q = query(usersCol, where(documentId(), "in", memberIds.slice(0, 30)));
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
    [updateUniqueProgress, teams.length]
  );

  const handleToggle = useCallback(
    (teamId: string) => {
      const maxVotes = eventConfig?.maxVotesPerUser ?? 3;
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
    [eventConfig]
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
  const maxVotes = eventConfig?.maxVotesPerUser ?? 3;
  const myTeam = teams.find((t) => t.id === user?.teamId);
  const isVotingActive = eventConfig?.status === "voting";
  const showTeams =
    eventConfig?.status === "waiting" ||
    eventConfig?.status === "voting" ||
    eventConfig?.status === "closed";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-mono text-primary animate-pulse">$ loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-primary glow-green text-lg">
              $ vote
            </span>
            <span className="font-mono text-foreground">{myDisplayName || user.name}</span>
            <Badge
              className={
                user.role === "judge"
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono"
                  : "bg-blue-500/20 text-blue-400 border-blue-500/30 font-mono"
              }
            >
              {user.role === "judge" ? "Judge" : "Participant"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Profile edit button */}
            {(user.role === "participant" || user.role === "judge") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProfileDialogOpen(true)}
                className="font-mono gap-2 text-primary hover:text-primary/80"
              >
                <UserPen className="w-4 h-4" />
                프로필
              </Button>
            )}
            {/* Team edit button - participants only */}
            {user.role === "participant" && myTeam && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
                className="font-mono gap-2 text-[#4DAFFF] hover:text-[#4DAFFF]/80"
              >
                <Pencil className="w-4 h-4" />
                팀 정보 수정
              </Button>
            )}
            {/* Results navigation */}
            <Link href="/results">
              <Button
                variant="ghost"
                size="sm"
                className="font-mono gap-2 text-[#FF6B35] hover:text-[#FF6B35]/80"
              >
                <Trophy className="w-4 h-4" />
                결과 보기
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
              className="font-mono gap-2"
            >
              <LogOut className="w-4 h-4" />
              logout
            </Button>
          </div>
        </div>
      </header>

      <AnnouncementTicker />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Countdown timer */}
        {eventConfig && <CountdownTimer eventConfig={eventConfig} />}

        {/* Status banner for non-voting states */}
        {eventConfig && !isVotingActive && !voteSuccess && (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
            <p className="font-mono text-2xl text-primary glow-green">
              {eventConfig.status === "waiting"
                ? "$ waiting_for_vote_start..."
                : "$ voting_closed"}
            </p>
            <p className="text-muted-foreground font-mono text-sm">
              {eventConfig.status === "waiting"
                ? "투표가 아직 시작되지 않았습니다. 잠시 기다려 주세요."
                : "투표가 종료되었습니다."}
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

        {/* Voting progress + selection counter - active voting only */}
        {isVotingActive && !voteSuccess && (
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

        {/* Team grid - always visible in waiting/voting/closed */}
        {showTeams && teams.length > 0 && (
          <>
            {!isVotingActive && (
              <p className="font-mono text-xs text-muted-foreground">
                // 팀 목록 (읽기 전용)
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...teams]
                .sort((a, b) => {
                  const aIsOwn = a.id === user.teamId ? -1 : 0;
                  const bIsOwn = b.id === user.teamId ? -1 : 0;
                  return aIsOwn - bIsOwn;
                })
                .map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isSelected={isVotingActive && selectedTeams.includes(team.id)}
                  isOwnTeam={user.teamId === team.id}
                  onToggle={isVotingActive ? handleToggle : () => {}}
                  onInspect={handleInspect}
                  disabled={
                    !isVotingActive ||
                    voteSuccess ||
                    (!selectedTeams.includes(team.id) &&
                      selectedTeams.length >= maxVotes)
                  }
                />
              ))}
            </div>
          </>
        )}

        {/* Submit button - voting state only */}
        {isVotingActive && !voteSuccess && (
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
          isVotingActive && inspectTeam
            ? selectedTeams.includes(inspectTeam.id)
            : false
        }
        isOwnTeam={
          isVotingActive && inspectTeam
            ? user.teamId === inspectTeam.id
            : false
        }
        canVote={isVotingActive && !voteSuccess}
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
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
} from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { EVENT_ID } from "@/lib/constants";
import type { Team, EventConfig } from "@/lib/types";
import { TeamCard } from "@/components/TeamCard";
import { VotingProgress } from "@/components/VotingProgress";
import { VoteConfirmDialog } from "@/components/VoteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, CheckCircle2 } from "lucide-react";

export default function VotePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [votedCount, setVotedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);

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
          description: d.data().description,
          emoji: d.data().emoji,
          memberUserIds: d.data().memberUserIds ?? [],
          judgeVoteCount: d.data().judgeVoteCount ?? 0,
          participantVoteCount: d.data().participantVoteCount ?? 0,
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
        setVotedCount(snap.size);
        const myVote = snap.docs.find((d) => d.id === user.uid);
        if (myVote) {
          setHasVoted(true);
          setVoteSuccess(true);
        }
      }
    );
    return () => unsub();
  }, [user]);

  // Total eligible voters (users collection)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "events", EVENT_ID, "users"),
      (snap) => {
        setTotalCount(snap.size);
      }
    );
    return () => unsub();
  }, [user]);

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
            <span className="font-mono text-foreground">{user.name}</span>
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
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Event not in voting state */}
        {eventConfig && eventConfig.status !== "voting" && !voteSuccess && (
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

        {/* Voting UI */}
        {eventConfig?.status === "voting" && !voteSuccess && (
          <>
            {/* Voting progress */}
            <VotingProgress votedCount={votedCount} totalCount={totalCount} />

            {/* Selection count */}
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

            {/* Team grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isSelected={selectedTeams.includes(team.id)}
                  isOwnTeam={user.teamId === team.id}
                  onToggle={handleToggle}
                  disabled={
                    !selectedTeams.includes(team.id) &&
                    selectedTeams.length >= maxVotes
                  }
                />
              ))}
            </div>

            {/* Submit button */}
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
          </>
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
    </div>
  );
}

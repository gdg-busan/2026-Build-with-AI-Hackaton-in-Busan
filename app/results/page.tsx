"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, getDocs } from "firebase/firestore";
import { motion } from "framer-motion";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { calculateFinalScores, applyFinalRankingOverrides } from "@/lib/scoring";
import { EVENT_ID } from "@/lib/constants";
import { ResultReveal } from "@/components/ResultReveal";
import type { EventConfig, Team, TeamScore } from "@/lib/types";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AnnouncementTicker } from "@/components/AnnouncementTicker";
import { MissionPanel } from "@/components/MissionPanel";

function getRankLabel(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

const STATUS_LABELS: Record<string, string> = {
  waiting: "대기중",
  voting_p1: "1차 투표중",
  closed_p1: "1차 마감",
  revealed_p1: "TOP 10 공개",
  voting_p2: "2차 투표중",
  closed_p2: "2차 마감",
  revealed_final: "최종 발표",
};

function getRankClass(rank: number) {
  if (rank === 1) return "rank-gold";
  if (rank === 2) return "rank-silver";
  if (rank === 3) return "rank-bronze";
  return "text-[#E8F4FD]";
}

export default function ResultsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [p1Teams, setP1Teams] = useState<Team[]>([]);
  const [revealPhase, setRevealPhase] = useState<"p1" | "final">("final");
  const [showReveal, setShowReveal] = useState(false);
  const [revealComplete, setRevealComplete] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  // Listen to event config
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(getFirebaseDb(), "events", EVENT_ID), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEventConfig({
          id: snap.id,
          status: data.status,
          judgeWeight: data.judgeWeight ?? 0.8,
          participantWeight: data.participantWeight ?? 0.2,
          maxVotesPerUser: data.maxVotesPerUser ?? 3,
          votingDeadline: data.votingDeadline?.toDate() ?? null,
          title: data.title ?? "GDG Busan Hackathon",
          createdAt: data.createdAt?.toDate() ?? new Date(),
          autoCloseEnabled: data.autoCloseEnabled ?? false,
          timerDurationSec: data.timerDurationSec ?? null,
          phase1SelectedTeamIds: data.phase1SelectedTeamIds ?? undefined,
          finalRankingOverrides: data.finalRankingOverrides ?? undefined,
        });
      }
      setConfigLoading(false);
    });
    return () => unsub();
  }, [user]);

  // When status becomes "revealed_p1" or "revealed_final", fetch teams and compute scores
  useEffect(() => {
    if (eventConfig?.status !== "revealed_p1" && eventConfig?.status !== "revealed_final") return;
    if (scores.length > 0 || p1Teams.length > 0) return;

    const fetchAndScore = async () => {
      const snap = await getDocs(collection(getFirebaseDb(), "events", EVENT_ID, "teams"));
      const allTeams: Team[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        nickname: d.data().nickname ?? null,
        description: d.data().description ?? "",
        emoji: d.data().emoji ?? "🚀",
        projectUrl: d.data().projectUrl ?? null,
        memberUserIds: d.data().memberUserIds ?? [],
        judgeVoteCount: d.data().judgeVoteCount ?? 0,
        participantVoteCount: d.data().participantVoteCount ?? 0,
      }));

      if (eventConfig.status === "revealed_p1") {
        // Show the top-10 teams selected in phase 1 (shuffled, no scores)
        const selectedIds = eventConfig.phase1SelectedTeamIds ?? [];
        const selected = allTeams
          .filter((t) => selectedIds.includes(t.id))
          .sort(() => Math.random() - 0.5); // shuffle
        setP1Teams(selected);
        setRevealPhase("p1");
      } else {
        // revealed_final: score only selected teams, show top 3
        const selectedIds = eventConfig.phase1SelectedTeamIds ?? [];
        const computed = calculateFinalScores(
          allTeams,
          eventConfig.judgeWeight,
          eventConfig.participantWeight,
          selectedIds.length > 0 ? selectedIds : allTeams.map((t) => t.id)
        );
        // Apply manual ranking overrides if admin resolved ties, otherwise take top 3
        const finalScores = eventConfig.finalRankingOverrides && eventConfig.finalRankingOverrides.length === 3
          ? applyFinalRankingOverrides(computed, eventConfig.finalRankingOverrides)
          : computed.slice(0, 3);
        setScores(finalScores);
        setRevealPhase("final");
      }
      setShowReveal(true);
    };

    fetchAndScore();
  }, [eventConfig, scores.length, p1Teams.length]);

  if (loading || configLoading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <motion.div
          className="text-[#00FF88] font-mono text-2xl glow-green"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          로딩 중...
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  // Not yet revealed
  if (!eventConfig || (eventConfig.status !== "revealed_p1" && eventConfig.status !== "revealed_final")) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] dot-grid flex flex-col items-center justify-center gap-8">
        <motion.div
          className="text-[#4DAFFF] font-mono font-black glow-blue text-center"
          style={{ fontSize: "2.5rem" }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
        >
          아직 결과가 발표되지 않았습니다
        </motion.div>
        <motion.div
          className="flex gap-2"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-3 h-3 rounded-full bg-[#4DAFFF]"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
        <p className="text-[#7B8BA3] font-mono text-lg">
          현재 상태:{" "}
          <span className="text-[#00FF88]">{STATUS_LABELS[eventConfig?.status ?? ""] ?? "..."}</span>
        </p>
        <button
          onClick={() => router.push("/vote")}
          className="mt-4 px-6 py-2 border border-[rgba(0,255,136,0.4)] text-[#00FF88] font-mono rounded-lg hover:border-[#00FF88] hover:bg-[rgba(0,255,136,0.08)] transition-colors"
        >
          투표 페이지로 돌아가기
        </button>
      </div>
    );
  }

  // Show reveal animation
  if (showReveal && !revealComplete) {
    return (
      <ResultReveal
        phase={revealPhase}
        p1Teams={revealPhase === "p1" ? p1Teams : undefined}
        scores={revealPhase === "final" ? scores : undefined}
        onComplete={() => {
          setShowReveal(false);
          setRevealComplete(true);
        }}
      />
    );
  }

  // Static view after reveal animation

  // Phase 1: show selected teams grid (no scores, no rankings)
  if (revealPhase === "p1" && revealComplete) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] dot-grid">
        <div className="sticky top-0 z-40">
          <AnnouncementTicker />
        </div>
        <div className="max-w-3xl mx-auto py-10 px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10 relative"
          >
            <button
              onClick={() => router.push("/vote")}
              className="absolute left-0 top-1/2 -translate-y-1/2 px-4 py-2 border border-[rgba(77,175,255,0.3)] text-[#4DAFFF] font-mono text-sm rounded-lg hover:border-[#4DAFFF] hover:bg-[rgba(77,175,255,0.08)] transition-colors"
            >
              ← 투표 페이지
            </button>
            <h1
              className="font-mono font-black glow-blue text-[#4DAFFF] mb-2"
              style={{ fontSize: "2.5rem" }}
            >
              TOP 10 SELECTED
            </h1>
            <p className="text-[#7B8BA3] font-mono">GDG Busan Build with AI Hackathon</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {p1Teams.map((team, i) => (
              <motion.div
                key={team.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
                className="bg-[#1A2235] rounded-xl p-4 border border-[#4DAFFF]/20 flex flex-col items-center gap-2 text-center card-glow"
              >
                <span className="text-4xl">{team.emoji}</span>
                <span className="text-white font-bold text-sm">{team.name}</span>
                {team.nickname && (
                  <span className="text-[#7B8BA3] text-xs">({team.nickname})</span>
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex justify-center mt-8"
          >
            <button
              onClick={() => router.push("/vote")}
              className="px-8 py-3 border border-[#00FF88] text-[#00FF88] font-mono rounded-xl hover:bg-[#00FF88] hover:text-[#0A0E1A] transition-colors"
            >
              투표 페이지로 돌아가기
            </button>
          </motion.div>
        </div>
        <ChatPanel />
        <MissionPanel />
      </div>
    );
  }

  // Final: show top 3 podium only
  const top3Scores = scores;
  const maxScore = top3Scores[0]?.finalScore || 100;

  return (
    <div className="min-h-screen bg-[#0A0E1A] dot-grid">
      <div className="sticky top-0 z-40">
        <AnnouncementTicker />
      </div>
      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 relative"
        >
          <button
            onClick={() => router.push("/vote")}
            className="absolute left-0 top-1/2 -translate-y-1/2 px-4 py-2 border border-[rgba(77,175,255,0.3)] text-[#4DAFFF] font-mono text-sm rounded-lg hover:border-[#4DAFFF] hover:bg-[rgba(77,175,255,0.08)] transition-colors"
          >
            ← 투표 페이지
          </button>
          <h1
            className="font-mono font-black glow-green text-[#00FF88] mb-2"
            style={{ fontSize: "2.5rem" }}
          >
            FINAL RESULTS
          </h1>
          <p className="text-[#7B8BA3] font-mono">GDG Busan Build with AI Hackathon</p>
        </motion.div>

        {/* TOP 3 Podium */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          {[top3Scores[1], top3Scores[0], top3Scores[2]].map((team, idx) => {
            if (!team) return <div key={idx} />;
            const podiumOrder = [2, 1, 3];
            const actualRank = podiumOrder[idx];
            const heights = ["h-28", "h-36", "h-20"];
            const rankClass = getRankClass(actualRank);
            return (
              <motion.div
                key={team.teamId}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + idx * 0.15 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="text-4xl">{team.emoji}</div>
                <p className={`font-bold text-center text-sm ${rankClass}`}>{team.teamName}{team.teamNickname && <span className="text-[#7B8BA3] text-xs block">({team.teamNickname})</span>}</p>
                <p className={`font-mono text-sm ${rankClass}`}>{team.finalScore.toFixed(1)}</p>
                <div
                  className={`w-full rounded-t-lg flex items-center justify-center ${heights[idx]} bg-[#1A2235] border border-[rgba(77,175,255,0.15)]`}
                >
                  <span className={`font-mono font-black text-3xl ${rankClass}`}>
                    {getRankLabel(actualRank)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Top 3 detailed cards */}
        <div className="flex flex-col gap-3">
          {top3Scores.map((team, i) => {
            const pct = (team.finalScore / maxScore) * 100;
            const rankClass = getRankClass(team.rank);
            return (
              <motion.div
                key={team.teamId}
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.07, type: "spring", stiffness: 200 }}
                className="bg-[#1A2235] rounded-xl px-5 py-4 border border-[rgba(77,175,255,0.15)] card-glow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className={`font-mono font-bold w-10 text-right ${rankClass}`} style={{ fontSize: "1.4rem" }}>
                    {getRankLabel(team.rank)}
                  </span>
                  <span style={{ fontSize: "1.6rem" }}>{team.emoji}</span>
                  <span className={`font-bold flex-1 ${rankClass}`} style={{ fontSize: "1.1rem" }}>
                    {team.teamName}{team.teamNickname && <span className="text-[#7B8BA3] text-sm ml-2">({team.teamNickname})</span>}
                  </span>
                  <span className={`font-mono font-bold ${rankClass}`} style={{ fontSize: "1.2rem" }}>
                    {team.finalScore.toFixed(1)}
                  </span>
                </div>
                <div className="ml-[5.5rem] bg-[#0A0E1A] rounded-full h-2 overflow-hidden mb-2">
                  <motion.div
                    className="h-full rounded-full progress-glow"
                    style={{
                      background:
                        team.rank === 1 ? "#FFD700" : team.rank === 2 ? "#C0C0C0" : team.rank === 3 ? "#CD7F32" : "#00FF88",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.5 + i * 0.07, duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex justify-center mt-8"
        >
          <button
            onClick={() => router.push("/")}
            className="px-8 py-3 border border-[#00FF88] text-[#00FF88] font-mono rounded-xl hover:bg-[#00FF88] hover:text-[#0A0E1A] transition-colors"
          >
            홈으로 돌아가기
          </button>
        </motion.div>
      </div>

      {/* Chat panel */}
      <ChatPanel />

      {/* Mission panel */}
      <MissionPanel />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { calculateScores } from "@/lib/scoring";
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
        });
      }
      setConfigLoading(false);
    });
    return () => unsub();
  }, [user]);

  // When status becomes "revealed", fetch teams and compute scores
  useEffect(() => {
    if (eventConfig?.status !== "revealed") return;
    if (scores.length > 0) return;

    const fetchAndScore = async () => {
      const snap = await getDocs(collection(getFirebaseDb(), "events", EVENT_ID, "teams"));
      const teams: Team[] = snap.docs.map((d) => ({
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

      const computed = calculateScores(
        teams,
        eventConfig.judgeWeight,
        eventConfig.participantWeight
      );
      setScores(computed);
      setShowReveal(true);
    };

    fetchAndScore();
  }, [eventConfig, scores.length]);

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
  if (!eventConfig || eventConfig.status !== "revealed") {
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
          <span className="text-[#00FF88]">{eventConfig?.status ?? "..."}</span>
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
        scores={scores}
        onComplete={() => {
          setShowReveal(false);
          setRevealComplete(true);
        }}
      />
    );
  }

  // Final scoreboard after reveal
  const allScores = scores;
  const maxScore = allScores[0]?.finalScore || 100;

  return (
    <div className="min-h-screen bg-[#0A0E1A] dot-grid">
      <AnnouncementTicker />
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
          {[allScores[1], allScores[0], allScores[2]].map((team, idx) => {
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

        {/* Full leaderboard */}
        <div className="flex flex-col gap-3">
          {allScores.map((team, i) => {
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
                {/* Score bar */}
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
                {/* Vote breakdown */}
                <div className="ml-[5.5rem] flex gap-4 text-sm font-mono text-[#7B8BA3]">
                  <span>
                    심사위원: <span className="text-[#FF6B35]">{team.judgeVoteCount}표</span>
                  </span>
                  <span>
                    참가자: <span className="text-[#4DAFFF]">{team.participantVoteCount}표</span>
                  </span>
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

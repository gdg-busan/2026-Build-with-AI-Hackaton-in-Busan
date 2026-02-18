"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { getFirebaseDb } from "@/lib/firebase";
import { calculateScores, getTop10 } from "@/lib/scoring";
import { EVENT_ID } from "@/lib/constants";
import { ResultReveal } from "@/components/ResultReveal";
import type { EventConfig, Team, TeamScore } from "@/lib/types";

function StatusWaiting() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-12">
      <motion.div
        className="text-[#4DAFFF] font-mono text-2xl tracking-widest glow-blue"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        GDG Busan — Build with AI
      </motion.div>

      <motion.div
        className="text-[#00FF88] font-mono font-black glow-green text-center"
        style={{ fontSize: "8rem", lineHeight: 1 }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
      >
        대기 중...
      </motion.div>

      <div className="flex gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="w-4 h-4 rounded-full bg-[#00FF88]"
            animate={{ scale: [1, 1.8, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
          />
        ))}
      </div>

      <motion.p
        className="text-[#7B8BA3] font-mono text-2xl"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ repeat: Infinity, duration: 3 }}
      >
        이벤트 시작을 기다리고 있습니다
      </motion.p>
    </div>
  );
}

function StatusVoting({ teams, totalVoters }: { teams: Team[]; totalVoters: number }) {
  const totalVotes = teams.reduce((sum, t) => sum + t.participantVoteCount + t.judgeVoteCount, 0);

  return (
    <div className="flex flex-col h-full gap-6 py-8 px-12">
      {/* Header */}
      <div className="text-center">
        <motion.h1
          className="text-[#00FF88] font-mono font-black glow-green"
          style={{ fontSize: "3.5rem" }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          LIVE VOTING
        </motion.h1>
        <p className="text-[#4DAFFF] font-mono text-xl glow-blue mt-1">실시간 투표 진행 중</p>
      </div>

      {/* Stats bar */}
      <div className="flex justify-center gap-12">
        <div className="text-center">
          <p className="text-[#7B8BA3] font-mono text-lg">총 투표 수</p>
          <motion.p
            className="text-[#00FF88] font-mono font-black glow-green"
            style={{ fontSize: "3rem" }}
            key={totalVotes}
            initial={{ scale: 1.3, color: "#FF6B35" }}
            animate={{ scale: 1, color: "#00FF88" }}
            transition={{ duration: 0.4 }}
          >
            {totalVotes}
          </motion.p>
        </div>
        <div className="text-center">
          <p className="text-[#7B8BA3] font-mono text-lg">참여자 수</p>
          <p className="text-[#4DAFFF] font-mono font-black glow-blue" style={{ fontSize: "3rem" }}>
            {totalVoters}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-[#1A2235] rounded-full h-4 overflow-hidden border border-[rgba(77,175,255,0.2)]">
        <motion.div
          className="h-full rounded-full progress-glow"
          style={{ background: "linear-gradient(90deg, #00FF88, #4DAFFF)" }}
          animate={{ width: totalVoters > 0 ? `${Math.min((totalVotes / (totalVoters * 3)) * 100, 100)}%` : "0%" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
        {teams
          .slice()
          .sort((a, b) => (b.judgeVoteCount + b.participantVoteCount) - (a.judgeVoteCount + a.participantVoteCount))
          .map((team) => {
            const totalTeamVotes = team.judgeVoteCount + team.participantVoteCount;
            const maxVotes = Math.max(...teams.map((t) => t.judgeVoteCount + t.participantVoteCount), 1);
            const pct = (totalTeamVotes / maxVotes) * 100;
            return (
              <motion.div
                key={team.id}
                className="bg-[#1A2235] rounded-xl px-6 py-4 border border-[rgba(77,175,255,0.15)] flex flex-col gap-2"
                layout
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "2rem" }}>{team.emoji}</span>
                  <span className="text-[#E8F4FD] font-bold flex-1" style={{ fontSize: "1.4rem" }}>
                    {team.name}
                  </span>
                  <motion.span
                    className="text-[#00FF88] font-mono font-black glow-green"
                    style={{ fontSize: "1.8rem" }}
                    key={totalTeamVotes}
                    initial={{ scale: 1.4, color: "#FF6B35" }}
                    animate={{ scale: 1, color: "#00FF88" }}
                    transition={{ duration: 0.3 }}
                  >
                    {totalTeamVotes}
                  </motion.span>
                </div>
                <div className="bg-[#0A0E1A] rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#00FF88" }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <div className="flex gap-3 text-sm font-mono text-[#7B8BA3]">
                  <span>심사위원: <span className="text-[#FF6B35]">{team.judgeVoteCount}</span></span>
                  <span>참가자: <span className="text-[#4DAFFF]">{team.participantVoteCount}</span></span>
                </div>
              </motion.div>
            );
          })}
      </div>
    </div>
  );
}

function StatusClosed() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10">
      <motion.h1
        className="text-[#FF6B35] font-mono font-black glow-orange text-center"
        style={{ fontSize: "6rem" }}
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        투표 마감
      </motion.h1>
      <p className="text-[#7B8BA3] font-mono text-3xl">집계 중...</p>

      {/* Spinner */}
      <div className="relative w-24 h-24">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#00FF88]"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-3 rounded-full border-4 border-transparent border-t-[#4DAFFF]"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        />
      </div>

      <motion.p
        className="text-[#4DAFFF] font-mono text-xl glow-blue"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        결과 발표까지 잠시만 기다려주세요
      </motion.p>
    </div>
  );
}

export default function DisplayPage() {
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [revealDone, setRevealDone] = useState(false);
  const [totalVoters, setTotalVoters] = useState(0);

  // Listen to event config
  useEffect(() => {
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
    });
    return () => unsub();
  }, []);

  // Listen to teams in real-time
  useEffect(() => {
    if (!eventConfig) return;
    const unsub = onSnapshot(collection(getFirebaseDb(), "events", EVENT_ID, "teams"), (snap) => {
      const fetched: Team[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        description: d.data().description ?? "",
        emoji: d.data().emoji ?? "🚀",
        memberUserIds: d.data().memberUserIds ?? [],
        judgeVoteCount: d.data().judgeVoteCount ?? 0,
        participantVoteCount: d.data().participantVoteCount ?? 0,
      }));
      setTeams(fetched);

      if (eventConfig.status === "revealed") {
        const computed = calculateScores(fetched, eventConfig.judgeWeight, eventConfig.participantWeight);
        setScores(computed);
      }
    });
    return () => unsub();
  }, [eventConfig]);

  // Get total voters count from users collection
  useEffect(() => {
    if (!eventConfig || eventConfig.status !== "voting") return;
    const fetchVoters = async () => {
      const snap = await getDocs(collection(getFirebaseDb(), "events", EVENT_ID, "users"));
      setTotalVoters(snap.size);
    };
    fetchVoters();
  }, [eventConfig]);

  const status = eventConfig?.status;

  return (
    <div className="fixed inset-0 bg-[#0A0E1A] dot-grid scanline overflow-hidden">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-[#1A2235] border-b border-[rgba(77,175,255,0.15)] flex items-center px-8 justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-[#00FF88] font-mono font-bold text-xl glow-green">GDG Busan</span>
          <span className="text-[#7B8BA3] font-mono">|</span>
          <span className="text-[#4DAFFF] font-mono">Build with AI</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            className="w-2 h-2 rounded-full bg-[#00FF88]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
          <span className="text-[#7B8BA3] font-mono text-sm uppercase tracking-widest">
            {status ?? "connecting..."}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="absolute inset-0 top-16">
        <AnimatePresence mode="wait">
          {status === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <StatusWaiting />
            </motion.div>
          )}

          {status === "voting" && (
            <motion.div
              key="voting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <StatusVoting teams={teams} totalVoters={totalVoters} />
            </motion.div>
          )}

          {status === "closed" && (
            <motion.div
              key="closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <StatusClosed />
            </motion.div>
          )}

          {status === "revealed" && !revealDone && scores.length > 0 && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full"
            >
              <ResultReveal
                scores={getTop10(scores)}
                onComplete={() => setRevealDone(true)}
              />
            </motion.div>
          )}

          {status === "revealed" && revealDone && scores.length > 0 && (
            <motion.div
              key="final-display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full overflow-y-auto py-6 px-12"
            >
              <h1
                className="text-[#00FF88] font-mono font-black glow-green text-center mb-6"
                style={{ fontSize: "4rem" }}
              >
                FINAL RESULTS
              </h1>
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                {getTop10(scores).map((team, i) => {
                  const maxScore = scores[0]?.finalScore || 100;
                  const pct = (team.finalScore / maxScore) * 100;
                  const rankClass =
                    team.rank === 1 ? "rank-gold" : team.rank === 2 ? "rank-silver" : team.rank === 3 ? "rank-bronze" : "text-[#E8F4FD]";
                  const rankLabel =
                    team.rank === 1 ? "🥇" : team.rank === 2 ? "🥈" : team.rank === 3 ? "🥉" : `#${team.rank}`;
                  return (
                    <motion.div
                      key={team.teamId}
                      initial={{ x: -60, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.08 }}
                      className="bg-[#1A2235] rounded-2xl px-8 py-5 border border-[rgba(77,175,255,0.15)] card-glow"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <span className={`font-mono font-black w-14 text-right ${rankClass}`} style={{ fontSize: "2rem" }}>
                          {rankLabel}
                        </span>
                        <span style={{ fontSize: "2.5rem" }}>{team.emoji}</span>
                        <span className={`font-bold flex-1 ${rankClass}`} style={{ fontSize: "1.8rem" }}>
                          {team.teamName}
                        </span>
                        <span className={`font-mono font-black ${rankClass}`} style={{ fontSize: "2rem" }}>
                          {team.finalScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="ml-[7rem] bg-[#0A0E1A] rounded-full h-3 overflow-hidden mb-2">
                        <motion.div
                          className="h-full rounded-full progress-glow"
                          style={{
                            background: team.rank === 1 ? "#FFD700" : team.rank === 2 ? "#C0C0C0" : team.rank === 3 ? "#CD7F32" : "#00FF88",
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }}
                        />
                      </div>
                      <div className="ml-[7rem] flex gap-6 font-mono text-lg text-[#7B8BA3]">
                        <span>심사위원: <span className="text-[#FF6B35]">{team.judgeVoteCount}표</span></span>
                        <span>참가자: <span className="text-[#4DAFFF]">{team.participantVoteCount}표</span></span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {!status && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center"
            >
              <motion.p
                className="text-[#00FF88] font-mono text-3xl glow-green"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                연결 중...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import type { Team, TeamScore } from "./types";

export function calculateScores(
  teams: Team[],
  judgeWeight: number = 0.8,
  participantWeight: number = 0.2
): TeamScore[] {
  const maxJudgeVotes = Math.max(...teams.map((t) => t.judgeVoteCount), 1);
  const maxParticipantVotes = Math.max(
    ...teams.map((t) => t.participantVoteCount),
    1
  );

  const scored = teams.map((team) => {
    const judgeNormalized = (team.judgeVoteCount / maxJudgeVotes) * 100;
    const participantNormalized =
      (team.participantVoteCount / maxParticipantVotes) * 100;
    const finalScore =
      judgeNormalized * judgeWeight + participantNormalized * participantWeight;

    return {
      teamId: team.id,
      teamName: team.name,
      teamNickname: team.nickname,
      emoji: team.emoji,
      judgeVoteCount: team.judgeVoteCount,
      participantVoteCount: team.participantVoteCount,
      judgeNormalized,
      participantNormalized,
      finalScore,
      rank: 0,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  scored.forEach((s, i) => {
    s.rank = i + 1;
  });

  return scored;
}

export function getTop10(scores: TeamScore[]): TeamScore[] {
  return scores.slice(0, 10);
}

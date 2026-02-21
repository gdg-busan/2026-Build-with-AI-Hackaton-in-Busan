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

export function getPhase1Results(
  teams: Team[],
  topN: number = 10
): { selectedTeamIds: string[]; tiedTeams: Team[] | null } {
  const sorted = [...teams].sort(
    (a, b) => b.participantVoteCount - a.participantVoteCount
  );

  if (sorted.length <= topN) {
    return {
      selectedTeamIds: sorted.map((t) => t.id),
      tiedTeams: null,
    };
  }

  const cutoffVoteCount = sorted[topN - 1].participantVoteCount;

  // Check if the team just outside the cutoff has the same vote count
  const teamJustOutside = sorted[topN];
  if (teamJustOutside.participantVoteCount === cutoffVoteCount) {
    // There's a tie at the cutoff boundary — collect all tied teams
    const tiedTeams = sorted.filter(
      (t) => t.participantVoteCount === cutoffVoteCount
    );
    // Selected teams are those clearly above the cutoff
    const selectedTeamIds = sorted
      .filter((t) => t.participantVoteCount > cutoffVoteCount)
      .map((t) => t.id);

    return { selectedTeamIds, tiedTeams };
  }

  return {
    selectedTeamIds: sorted.slice(0, topN).map((t) => t.id),
    tiedTeams: null,
  };
}

export function calculateFinalScores(
  teams: Team[],
  judgeWeight: number,
  participantWeight: number,
  phase1SelectedTeamIds: string[]
): TeamScore[] {
  const filteredTeams = teams.filter((t) =>
    phase1SelectedTeamIds.includes(t.id)
  );

  if (filteredTeams.length === 0) return [];

  const maxJudgeVotes = Math.max(
    ...filteredTeams.map((t) => t.judgeVoteCount),
    1
  );
  const maxParticipantVotes = Math.max(
    ...filteredTeams.map((t) => t.participantVoteCount),
    1
  );

  const scored = filteredTeams.map((team) => {
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

  // Include all teams tied at the top-3 boundary
  if (scored.length <= 3) return scored;
  const cutoffScore = Math.round(scored[2].finalScore * 100);
  const result = scored.filter(
    (s, i) => i < 3 || Math.round(s.finalScore * 100) === cutoffScore
  );
  return result;
}

/** Detect ties among the top 3 final scores (including boundary ties) */
export function detectFinalTies(scores: TeamScore[]): TeamScore[] | null {
  if (scores.length <= 1) return null;

  // Collect all unique scores in the candidates
  const scoreGroups = new Map<number, TeamScore[]>();
  for (const s of scores) {
    const rounded = Math.round(s.finalScore * 100);
    if (!scoreGroups.has(rounded)) scoreGroups.set(rounded, []);
    scoreGroups.get(rounded)!.push(s);
  }

  // Check if more than 3 candidates (boundary tie) or any score group has >1 team within top 3
  if (scores.length > 3) {
    // Boundary tie: more candidates than slots
    return scores;
  }

  // Exactly 3 candidates: check for internal ties
  const tiedTeams = Array.from(scoreGroups.values())
    .filter((group) => group.length > 1)
    .flat();

  return tiedTeams.length > 0 ? scores : null;
}

/** Apply manual ranking overrides to final scores */
export function applyFinalRankingOverrides(
  scores: TeamScore[],
  overrides: string[]
): TeamScore[] {
  return overrides.map((teamId, i) => {
    const score = scores.find((s) => s.teamId === teamId);
    if (!score) return null;
    return { ...score, rank: i + 1 };
  }).filter((s): s is TeamScore => s !== null);
}

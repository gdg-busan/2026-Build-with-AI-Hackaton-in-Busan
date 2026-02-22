import type { Team, TeamScore } from "./types";

export function calculateScores(
  teams: Team[],
  judgeWeight: number = 0.8,
  participantWeight: number = 0.2
): TeamScore[] {
  const visibleTeams = teams.filter((t) => !t.isHidden);
  const maxJudgeVotes = Math.max(...visibleTeams.map((t) => t.judgeVoteCount), 1);
  const maxParticipantVotes = Math.max(
    ...visibleTeams.map((t) => t.participantVoteCount),
    1
  );

  const scored = visibleTeams.map((team) => {
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

export type TiedGroup = {
  voteCount: number;
  teams: Team[];
};

export function getPhase1Results(
  teams: Team[],
  topN: number = 10
): {
  selectedTeamIds: string[];
  tiedTeams: Team[] | null;
  tiedGroups: TiedGroup[];
  hasTiedGroups: boolean;
} {
  const visibleTeams = teams.filter((t) => !t.isHidden);
  const sorted = [...visibleTeams].sort(
    (a, b) => b.participantVoteCount - a.participantVoteCount
  );

  if (sorted.length <= topN) {
    // All teams selected — check for tied groups within them
    const tiedGroups = findTiedGroups(sorted);
    return {
      selectedTeamIds: sorted.map((t) => t.id),
      tiedTeams: null,
      tiedGroups,
      hasTiedGroups: tiedGroups.length > 0,
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

    // Also find tied groups within the already-selected teams
    const selectedTeams = sorted.filter((t) => selectedTeamIds.includes(t.id));
    const tiedGroups = findTiedGroups(selectedTeams);

    return { selectedTeamIds, tiedTeams, tiedGroups, hasTiedGroups: tiedGroups.length > 0 };
  }

  // No boundary tie — check for tied groups within selected teams
  const selectedTeams = sorted.slice(0, topN);
  const tiedGroups = findTiedGroups(selectedTeams);

  return {
    selectedTeamIds: selectedTeams.map((t) => t.id),
    tiedTeams: null,
    tiedGroups,
    hasTiedGroups: tiedGroups.length > 0,
  };
}

/** Find groups of teams sharing the same participantVoteCount */
function findTiedGroups(teams: Team[]): TiedGroup[] {
  const groupMap = new Map<number, Team[]>();
  for (const team of teams) {
    const count = team.participantVoteCount;
    if (!groupMap.has(count)) groupMap.set(count, []);
    groupMap.get(count)!.push(team);
  }
  return Array.from(groupMap.entries())
    .filter(([, group]) => group.length > 1)
    .map(([voteCount, groupTeams]) => ({ voteCount, teams: groupTeams }))
    .sort((a, b) => b.voteCount - a.voteCount);
}

export function calculateFinalScores(
  teams: Team[],
  judgeWeight: number,
  participantWeight: number,
  phase1SelectedTeamIds: string[]
): TeamScore[] {
  const filteredTeams = teams.filter((t) =>
    phase1SelectedTeamIds.includes(t.id) && !t.isHidden
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

  return scored;
}

export type FinalTieGroup = {
  roundedScore: number;
  teams: TeamScore[];
};

/** Detect score ties among the ranked list, optionally limited to top N positions */
export function detectFinalTies(scores: TeamScore[], topN?: number): {
  tiedTeams: TeamScore[] | null;
  tieGroups: FinalTieGroup[];
} {
  if (scores.length <= 1) return { tiedTeams: null, tieGroups: [] };

  // Collect all unique scores in the candidates
  const scoreGroups = new Map<number, TeamScore[]>();
  for (const s of scores) {
    const rounded = Math.round(s.finalScore * 100);
    if (!scoreGroups.has(rounded)) scoreGroups.set(rounded, []);
    scoreGroups.get(rounded)!.push(s);
  }

  // Find all groups with more than 1 team (ties)
  let tieGroups: FinalTieGroup[] = Array.from(scoreGroups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([roundedScore, teams]) => ({ roundedScore, teams }))
    .sort((a, b) => b.roundedScore - a.roundedScore);

  // If topN is specified, only keep tie groups where at least one team has rank <= topN
  if (topN !== undefined) {
    tieGroups = tieGroups.filter((g) =>
      g.teams.some((t) => t.rank <= topN)
    );
  }

  if (tieGroups.length === 0) return { tiedTeams: null, tieGroups: [] };

  // Return all teams that are part of any tie group
  const tiedTeams = tieGroups.flatMap((g) => g.teams);
  return { tiedTeams, tieGroups };
}

/** Apply manual ranking overrides to final scores.
 *  Overrides reorder only the tied positions in-place.
 *  Teams not in overrides keep their original ranks untouched.
 */
export function applyFinalRankingOverrides(
  scores: TeamScore[],
  overrides: string[]
): TeamScore[] {
  if (overrides.length === 0) return scores;

  // Find the original ranks of the overridden teams
  const overriddenOriginalRanks = overrides
    .map((id) => scores.find((s) => s.teamId === id))
    .filter((s): s is TeamScore => s !== null)
    .map((s) => s.rank)
    .sort((a, b) => a - b);

  // Assign the sorted original rank slots to the override order
  const result = scores.map((s) => {
    const overrideIndex = overrides.indexOf(s.teamId);
    if (overrideIndex !== -1 && overrideIndex < overriddenOriginalRanks.length) {
      return { ...s, rank: overriddenOriginalRanks[overrideIndex] };
    }
    return { ...s };
  });

  return result.sort((a, b) => a.rank - b.rank);
}

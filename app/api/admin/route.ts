import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { generateUniqueCode, EVENT_ID } from "@/lib/constants";
import type { EventStatus, UserRole } from "@/lib/types";
import { getPhase1Results, calculateFinalScores, detectFinalTies } from "@/lib/scoring";

const VALID_STATUSES: EventStatus[] = [
  "waiting",
  "voting_p1",
  "closed_p1",
  "revealed_p1",
  "voting_p2",
  "closed_p2",
  "revealed_final",
];

const STATUS_ORDER: Record<EventStatus, number> = {
  waiting: 0,
  voting_p1: 1,
  closed_p1: 2,
  revealed_p1: 3,
  voting_p2: 4,
  closed_p2: 5,
  revealed_final: 6,
};

// Statuses that require phase1SelectedTeamIds to be set
const REQUIRES_PHASE1_SELECTION: EventStatus[] = [
  "voting_p2",
  "closed_p2",
  "revealed_final",
];

const eventRef = () => adminDb.collection("events").doc(EVENT_ID);
const teamsCol = () => eventRef().collection("teams");
const usersCol = () => eventRef().collection("users");
const votesCol = () => eventRef().collection("votes");
const chatRoomsCol = () => eventRef().collection("chatRooms");
const announcementsCol = () => eventRef().collection("announcements");

async function verifyAdmin(request: NextRequest) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const decodedToken = await adminAuth.verifyIdToken(authorization.slice(7));
    if (decodedToken.role !== "admin") return null;
    return decodedToken;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, data } = await request.json();

    switch (action) {
      case "initEvent": {
        const eventSnap = await eventRef().get();
        if (!eventSnap.exists) {
          await eventRef().set({
            status: "waiting",
            judgeWeight: 0.8,
            participantWeight: 0.2,
            maxVotesP1: 3,
            maxVotesP2: 3,
            title: "GDG Busan - Build with AI",
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        // Auto-create global chat room
        const globalRoomRef = chatRoomsCol().doc("global");
        const globalRoomSnap = await globalRoomRef.get();
        if (!globalRoomSnap.exists) {
          await globalRoomRef.set({
            type: "global",
            teamId: null,
            name: "전체 채팅",
            lastMessageAt: null,
            lastMessagePreview: null,
            lastMessageSender: null,
            messageCount: 0,
          });
        }
        return NextResponse.json({ success: true });
      }

      case "updateEventStatus": {
        const { status } = data as { status: EventStatus };

        if (!VALID_STATUSES.includes(status)) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
            { status: 400 }
          );
        }

        const eventSnap = await eventRef().get();
        const eventData = eventSnap.data();
        const currentStatus = (eventData?.status ?? "waiting") as EventStatus;

        // Prevent skipping phases: new status order must be at most 1 step ahead
        const currentOrder = STATUS_ORDER[currentStatus];
        const newOrder = STATUS_ORDER[status];
        if (newOrder > currentOrder + 1) {
          return NextResponse.json(
            {
              error: `Cannot skip phases. Current status is "${currentStatus}", cannot jump to "${status}".`,
            },
            { status: 400 }
          );
        }

        // Require phase1SelectedTeamIds for voting_p2 and beyond
        if (REQUIRES_PHASE1_SELECTION.includes(status)) {
          const phase1SelectedTeamIds = eventData?.phase1SelectedTeamIds;
          if (!phase1SelectedTeamIds || phase1SelectedTeamIds.length === 0) {
            return NextResponse.json(
              {
                error: `Cannot transition to "${status}" without phase1SelectedTeamIds being set. Run finalizePhase1 first.`,
              },
              { status: 400 }
            );
          }
        }

        // Block revealed_final if there are unresolved ties in top 3
        if (status === "revealed_final") {
          const phase1SelectedTeamIds = eventData?.phase1SelectedTeamIds ?? [];
          const finalRankingOverrides = eventData?.finalRankingOverrides;
          const teamsSnap = await teamsCol().get();
          const allTeams = teamsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as import("@/lib/types").Team[];
          const finalScores = calculateFinalScores(
            allTeams,
            eventData?.judgeWeight ?? 0.8,
            eventData?.participantWeight ?? 0.2,
            phase1SelectedTeamIds
          );
          const { tiedTeams } = detectFinalTies(finalScores);
          if (tiedTeams && tiedTeams.length > 0 && (!finalRankingOverrides || finalRankingOverrides.length === 0)) {
            return NextResponse.json(
              {
                error: "최종 순위에 동점 팀이 있습니다. resolveFinalTies로 순위를 먼저 결정해주세요.",
                tiedTeams: tiedTeams.map((t) => ({
                  teamId: t.teamId,
                  teamName: t.teamName,
                  emoji: t.emoji,
                  finalScore: t.finalScore,
                })),
              },
              { status: 400 }
            );
          }
        }

        await eventRef().update({ status });
        return NextResponse.json({ success: true });
      }

      case "updateEventConfig": {
        const { judgeWeight, participantWeight, maxVotesP1, maxVotesP2, maxVotesPerUser } = data;
        const updateData: Record<string, number> = {};
        if (judgeWeight !== undefined) updateData.judgeWeight = judgeWeight;
        if (participantWeight !== undefined) updateData.participantWeight = participantWeight;
        if (maxVotesP1 !== undefined) updateData.maxVotesP1 = maxVotesP1;
        if (maxVotesP2 !== undefined) updateData.maxVotesP2 = maxVotesP2;
        // backward compat: accept legacy field but prefer new fields
        if (maxVotesPerUser !== undefined && maxVotesP1 === undefined && maxVotesP2 === undefined) {
          updateData.maxVotesP1 = maxVotesPerUser;
          updateData.maxVotesP2 = maxVotesPerUser;
        }
        await eventRef().update(updateData);
        return NextResponse.json({ success: true });
      }

      case "addTeam": {
        const { name, description, emoji } = data;
        const teamRef = teamsCol().doc();
        await teamRef.set({
          name,
          nickname: null,
          description,
          emoji,
          projectUrl: null,
          memberUserIds: [],
          judgeVoteCount: 0,
          participantVoteCount: 0,
        });
        return NextResponse.json({ success: true, teamId: teamRef.id });
      }

      case "updateTeam": {
        const { teamId, ...updates } = data;
        await teamsCol().doc(teamId).update(updates);
        return NextResponse.json({ success: true });
      }

      case "deleteTeam": {
        const { teamId } = data;
        await teamsCol().doc(teamId).delete();
        const usersSnap = await usersCol().where("teamId", "==", teamId).get();
        if (!usersSnap.empty) {
          const batch = adminDb.batch();
          usersSnap.docs.forEach((doc) => batch.update(doc.ref, { teamId: null }));
          await batch.commit();
        }
        return NextResponse.json({ success: true });
      }

      case "generateCodes": {
        const { count, role, namePrefix } = data as {
          count: number;
          role: UserRole;
          namePrefix?: string;
        };
        const rolePrefix =
          role === "participant" ? "P" : role === "judge" ? "J" : "A";
        const defaultPrefix =
          role === "participant" ? "참가자" : role === "judge" ? "심사위원" : "관리자";

        const existingSnap = await usersCol().where("role", "==", role).get();
        const startIndex = existingSnap.size + 1;

        const batch = adminDb.batch();
        const generatedCodes: string[] = [];

        for (let i = 0; i < count; i++) {
          const code = generateUniqueCode(
            rolePrefix as "P" | "J" | "A",
            startIndex + i
          );
          batch.set(usersCol().doc(code), {
            uniqueCode: code,
            name: `${namePrefix || defaultPrefix} ${startIndex + i}`,
            role,
            teamId: null,
            hasVoted: false,
          });
          generatedCodes.push(code);
        }

        await batch.commit();
        return NextResponse.json({ success: true, codes: generatedCodes });
      }

      case "assignTeam": {
        const { userCode, teamId } = data;
        const batch = adminDb.batch();

        const userDoc = await usersCol().doc(userCode).get();
        if (!userDoc.exists) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const oldTeamId = userDoc.data()?.teamId;

        // Remove from old team
        if (oldTeamId) {
          batch.update(teamsCol().doc(oldTeamId), {
            memberUserIds: FieldValue.arrayRemove(userCode),
          });
        }

        // Update user's teamId
        batch.update(usersCol().doc(userCode), { teamId: teamId || null });

        // Add to new team
        if (teamId) {
          batch.update(teamsCol().doc(teamId), {
            memberUserIds: FieldValue.arrayUnion(userCode),
          });
        }

        await batch.commit();
        return NextResponse.json({ success: true });
      }

      case "finalizePhase1": {
        const teamsSnap = await teamsCol().get();
        const teams = teamsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as import("@/lib/types").Team[];

        const { selectedTeamIds, tiedTeams } = getPhase1Results(teams, 10);

        if (tiedTeams && tiedTeams.length > 0) {
          // There's a tie — return tie info without storing, admin must resolve manually
          return NextResponse.json({
            success: true,
            selectedTeamIds,
            tiedTeams: tiedTeams.map((t) => ({
              id: t.id,
              name: t.name,
              emoji: t.emoji,
              participantVoteCount: t.participantVoteCount,
            })),
          });
        }

        // No tie — store directly
        await eventRef().update({
          phase1SelectedTeamIds: selectedTeamIds,
          phase1FinalizedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, selectedTeamIds, tiedTeams: null });
      }

      case "resolvePhase1Ties": {
        const { selectedTeamIds } = data as { selectedTeamIds: string[] };

        if (!Array.isArray(selectedTeamIds)) {
          return NextResponse.json(
            { error: "selectedTeamIds must be an array" },
            { status: 400 }
          );
        }

        // Count total teams for validation
        const totalTeamsSnap = await teamsCol().get();
        const totalTeamCount = totalTeamsSnap.size;
        const requiredCount = Math.min(10, totalTeamCount);

        if (selectedTeamIds.length !== requiredCount) {
          return NextResponse.json(
            {
              error: `Must select exactly ${requiredCount} team(s). Got ${selectedTeamIds.length}.`,
            },
            { status: 400 }
          );
        }

        await eventRef().update({
          phase1SelectedTeamIds: selectedTeamIds,
          phase1FinalizedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, selectedTeamIds });
      }

      case "resolveFinalTies": {
        const { rankedTeamIds } = data as { rankedTeamIds: string[] };

        if (!Array.isArray(rankedTeamIds)) {
          return NextResponse.json(
            { error: "rankedTeamIds must be an array" },
            { status: 400 }
          );
        }

        // Allow empty array to reset overrides
        if (rankedTeamIds.length === 0) {
          await eventRef().update({ finalRankingOverrides: FieldValue.delete() });
          return NextResponse.json({ success: true, rankedTeamIds: [] });
        }

        if (rankedTeamIds.length < 2) {
          return NextResponse.json(
            { error: "rankedTeamIds must contain at least 2 team IDs or be empty to reset" },
            { status: 400 }
          );
        }

        // Validate all teams exist and are in phase1SelectedTeamIds
        const eventSnap2 = await eventRef().get();
        const phase1Ids = eventSnap2.data()?.phase1SelectedTeamIds ?? [];
        const invalidIds = rankedTeamIds.filter((id) => !phase1Ids.includes(id));
        if (invalidIds.length > 0) {
          return NextResponse.json(
            { error: `팀이 Phase 1 선정 목록에 없습니다: ${invalidIds.join(", ")}` },
            { status: 400 }
          );
        }

        await eventRef().update({
          finalRankingOverrides: rankedTeamIds,
        });

        return NextResponse.json({ success: true, rankedTeamIds });
      }

      case "resetVotes": {
        // Delete all vote documents
        const votesSnap = await votesCol().get();
        if (!votesSnap.empty) {
          const batch = adminDb.batch();
          votesSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Reset team vote counts
        const teamsSnap = await teamsCol().get();
        if (!teamsSnap.empty) {
          const batch = adminDb.batch();
          teamsSnap.docs.forEach((doc) =>
            batch.update(doc.ref, { judgeVoteCount: 0, participantVoteCount: 0 })
          );
          await batch.commit();
        }

        // Reset user hasVoted flags (including phase-specific flags)
        const usersSnap = await usersCol().get();
        if (!usersSnap.empty) {
          const batch = adminDb.batch();
          usersSnap.docs.forEach((doc) =>
            batch.update(doc.ref, { hasVoted: false, hasVotedP1: false, hasVotedP2: false })
          );
          await batch.commit();
        }

        return NextResponse.json({ success: true });
      }

      case "resetPhase2Votes": {
        // Delete only Phase 2 vote documents, preserving Phase 1 data
        const p2VotesSnap = await votesCol().where("phase", "==", "p2").get();
        if (!p2VotesSnap.empty) {
          const batch = adminDb.batch();
          p2VotesSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Reset team judge vote counts (Phase 2 is judge voting)
        // We recalculate judgeVoteCount from remaining p1 judge votes
        const remainingJudgeVotes = await votesCol().where("phase", "==", "p1").where("role", "==", "judge").get();
        const judgeCountMap: Record<string, number> = {};
        remainingJudgeVotes.docs.forEach((doc) => {
          const { selectedTeams } = doc.data() as { selectedTeams: string[] };
          selectedTeams.forEach((teamId) => {
            judgeCountMap[teamId] = (judgeCountMap[teamId] ?? 0) + 1;
          });
        });

        const teamsSnapP2 = await teamsCol().get();
        if (!teamsSnapP2.empty) {
          const batch = adminDb.batch();
          teamsSnapP2.docs.forEach((doc) =>
            batch.update(doc.ref, { judgeVoteCount: judgeCountMap[doc.id] ?? 0 })
          );
          await batch.commit();
        }

        // Reset only hasVotedP2 on users
        const usersSnapP2 = await usersCol().get();
        if (!usersSnapP2.empty) {
          const batch = adminDb.batch();
          usersSnapP2.docs.forEach((doc) =>
            batch.update(doc.ref, { hasVotedP2: false })
          );
          await batch.commit();
        }

        return NextResponse.json({ success: true });
      }

      case "deleteUser": {
        const { userCode } = data as { userCode: string };
        const userDoc = await usersCol().doc(userCode).get();
        if (!userDoc.exists) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const userData = userDoc.data()!;
        const batch = adminDb.batch();

        // Remove from team if assigned
        if (userData.teamId) {
          batch.update(teamsCol().doc(userData.teamId), {
            memberUserIds: FieldValue.arrayRemove(userCode),
          });
        }

        // Delete user document
        batch.delete(usersCol().doc(userCode));

        // Delete vote if exists
        const voteSnap = await votesCol().where("voterId", "==", userCode).get();
        voteSnap.docs.forEach((doc) => batch.delete(doc.ref));

        await batch.commit();
        return NextResponse.json({ success: true });
      }

      case "resetAll": {
        // Helper: delete all docs in a subcollection
        const deleteSubcollection = async (
          parentRef: FirebaseFirestore.DocumentReference,
          subcolName: string
        ) => {
          const snap = await parentRef.collection(subcolName).get();
          if (snap.empty) return;
          const batch = adminDb.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        };

        // Delete all votes
        const allVotes = await votesCol().get();
        if (!allVotes.empty) {
          const batch = adminDb.batch();
          allVotes.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Delete all teams (including cheers, feedbacks subcollections)
        const allTeams = await teamsCol().get();
        if (!allTeams.empty) {
          for (const teamDoc of allTeams.docs) {
            await deleteSubcollection(teamDoc.ref, "cheers");
            await deleteSubcollection(teamDoc.ref, "feedbacks");
          }
          const batch = adminDb.batch();
          allTeams.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Delete all non-admin users (including roomState, missions subcollections)
        const allUsers = await usersCol().get();
        if (!allUsers.empty) {
          const batch = adminDb.batch();
          for (const userDoc of allUsers.docs) {
            if (userDoc.data().role !== "admin") {
              await deleteSubcollection(userDoc.ref, "roomState");
              await deleteSubcollection(userDoc.ref, "missions");
              batch.delete(userDoc.ref);
            }
          }
          await batch.commit();
        }

        // Delete all chat rooms (including messages subcollections)
        const allChatRooms = await chatRoomsCol().get();
        if (!allChatRooms.empty) {
          for (const roomDoc of allChatRooms.docs) {
            await deleteSubcollection(roomDoc.ref, "messages");
          }
          const batch = adminDb.batch();
          allChatRooms.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Delete all announcements
        const allAnnouncements = await announcementsCol().get();
        if (!allAnnouncements.empty) {
          const batch = adminDb.batch();
          allAnnouncements.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Reset event status and clear phase data
        await eventRef().update({
          status: "waiting",
          phase1SelectedTeamIds: FieldValue.delete(),
          phase1FinalizedAt: FieldValue.delete(),
          finalRankingOverrides: FieldValue.delete(),
          timerDurationSec: null,
          autoCloseEnabled: false,
        });

        return NextResponse.json({ success: true });
      }

      case "batchSetup": {
        const {
          teamCount,
          participantsPerTeam,
          judgeCount,
          teamPrefix = "팀",
        } = data as {
          teamCount: number;
          participantsPerTeam: number;
          judgeCount: number;
          teamPrefix?: string;
          codePrefix?: string;
        };

        const { TEAM_EMOJIS } = await import("@/lib/constants");

        const batch = adminDb.batch();

        // 1. Generate teams
        const teamResults: Array<{
          id: string;
          name: string;
          emoji: string;
          members: Array<{ code: string; name: string }>;
        }> = [];

        const teamRefs: Array<{ ref: FirebaseFirestore.DocumentReference; id: string }> = [];
        for (let i = 0; i < teamCount; i++) {
          const ref = teamsCol().doc();
          teamRefs.push({ ref, id: ref.id });
        }

        // 2. Generate participant codes
        const participantTotal = teamCount * participantsPerTeam;
        const participantUsers: Array<{ code: string; name: string; teamIndex: number }> = [];
        for (let i = 0; i < participantTotal; i++) {
          const code = generateUniqueCode("P", i + 1);
          const teamIndex = Math.floor(i / participantsPerTeam);
          participantUsers.push({ code, name: `참가자 ${i + 1}`, teamIndex });
        }

        // 3. Generate judge codes
        const judgeUsers: Array<{ code: string; name: string }> = [];
        for (let i = 0; i < judgeCount; i++) {
          const code = generateUniqueCode("J", i + 1);
          judgeUsers.push({ code, name: `심사위원 ${i + 1}` });
        }

        // 4. Build team results with matched members
        for (let i = 0; i < teamCount; i++) {
          const members = participantUsers
            .filter((u) => u.teamIndex === i)
            .map((u) => ({ code: u.code, name: u.name }));
          teamResults.push({
            id: teamRefs[i].id,
            name: `${teamPrefix} ${i + 1}`,
            emoji: TEAM_EMOJIS[i % TEAM_EMOJIS.length],
            members,
          });
        }

        // 5. Batch set team documents
        for (let i = 0; i < teamCount; i++) {
          const memberCodes = teamResults[i].members.map((m) => m.code);
          batch.set(teamRefs[i].ref, {
            name: teamResults[i].name,
            nickname: null,
            description: "",
            emoji: teamResults[i].emoji,
            projectUrl: null,
            memberUserIds: memberCodes,
            judgeVoteCount: 0,
            participantVoteCount: 0,
          });
        }

        // 6. Batch set participant user documents
        for (const user of participantUsers) {
          const teamDocId = teamRefs[user.teamIndex].id;
          batch.set(usersCol().doc(user.code), {
            uniqueCode: user.code,
            name: user.name,
            role: "participant",
            teamId: teamDocId,
            hasVoted: false,
          });
        }

        // 7. Batch set judge user documents
        for (const judge of judgeUsers) {
          batch.set(usersCol().doc(judge.code), {
            uniqueCode: judge.code,
            name: judge.name,
            role: "judge",
            teamId: null,
            hasVoted: false,
          });
        }

        await batch.commit();

        // 8. Auto-create chat rooms (global + per team)
        const chatBatch = adminDb.batch();
        const globalRoom = chatRoomsCol().doc("global");
        chatBatch.set(globalRoom, {
          type: "global",
          teamId: null,
          name: "전체 채팅",
          lastMessageAt: null,
          lastMessagePreview: null,
          lastMessageSender: null,
          messageCount: 0,
        }, { merge: true });
        for (const tr of teamRefs) {
          chatBatch.set(chatRoomsCol().doc(tr.id), {
            type: "team",
            teamId: tr.id,
            name: `${teamResults.find(t => t.id === tr.id)?.name ?? "팀"} 채팅`,
            lastMessageAt: null,
            lastMessagePreview: null,
            lastMessageSender: null,
            messageCount: 0,
          }, { merge: true });
        }
        await chatBatch.commit();

        return NextResponse.json({
          success: true,
          teams: teamResults,
          judges: judgeUsers,
          summary: {
            teamCount,
            participantCount: participantTotal,
            judgeCount,
          },
        });
      }

      case "initChatRooms": {
        // Create global chat room
        const globalRef = chatRoomsCol().doc("global");
        const globalSnap = await globalRef.get();
        if (!globalSnap.exists) {
          await globalRef.set({
            type: "global",
            teamId: null,
            name: "전체 채팅",
            lastMessageAt: null,
            lastMessagePreview: null,
            lastMessageSender: null,
            messageCount: 0,
          });
        }

        // Create team chat rooms
        const teamsSnap = await teamsCol().get();
        const batch = adminDb.batch();
        let created = 0;
        for (const teamDoc of teamsSnap.docs) {
          const roomRef = chatRoomsCol().doc(teamDoc.id);
          const roomSnap = await roomRef.get();
          if (!roomSnap.exists) {
            batch.set(roomRef, {
              type: "team",
              teamId: teamDoc.id,
              name: `${teamDoc.data().name} 채팅`,
              lastMessageAt: null,
              lastMessagePreview: null,
              lastMessageSender: null,
              messageCount: 0,
            });
            created++;
          }
        }
        if (created > 0) await batch.commit();

        return NextResponse.json({
          success: true,
          created: created + (globalSnap.exists ? 0 : 1),
        });
      }

      case "deleteMessage": {
        const { roomId, messageId } = data;
        const msgRef = chatRoomsCol().doc(roomId).collection("messages").doc(messageId);
        const msgSnap = await msgRef.get();
        if (!msgSnap.exists) {
          return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }
        await msgRef.update({
          deleted: true,
          deletedBy: admin.uid,
        });
        return NextResponse.json({ success: true });
      }

      case "createAnnouncement": {
        const { text, type: annType, expiresAt } = data as {
          text: string;
          type: string;
          expiresAt?: string | null;
        };
        if (!text || text.length < 1 || text.length > 200) {
          return NextResponse.json(
            { error: "text must be 1-200 characters" },
            { status: 400 }
          );
        }
        if (!["info", "warning", "success"].includes(annType)) {
          return NextResponse.json(
            { error: "type must be info, warning, or success" },
            { status: 400 }
          );
        }
        const annRef = announcementsCol().doc();
        await annRef.set({
          text,
          type: annType,
          active: true,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        });
        return NextResponse.json({ success: true, announcementId: annRef.id });
      }

      case "deleteAnnouncement": {
        const { announcementId } = data as { announcementId: string };
        await announcementsCol().doc(announcementId).update({ active: false });
        return NextResponse.json({ success: true });
      }

      case "getMissionProgress": {
        // Fetch all users with their mission progress
        const allUsersSnap = await usersCol().get();
        const results: Array<{
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
        }> = [];

        for (const userDoc of allUsersSnap.docs) {
          const userData = userDoc.data();
          if (userData.role === "admin") continue; // skip admins

          const missionsSnap = await usersCol()
            .doc(userDoc.id)
            .collection("missions")
            .get();

          const missions = missionsSnap.docs.map((d) => {
            const md = d.data();
            return {
              missionId: d.id,
              current: md.current ?? 0,
              completed: md.completed ?? false,
              completedAt: md.completedAt?.toDate()?.toISOString() ?? null,
            };
          });

          results.push({
            uniqueCode: userDoc.id,
            name: userData.name ?? userDoc.id,
            role: userData.role,
            teamId: userData.teamId ?? null,
            missions,
            completedCount: missions.filter((m) => m.completed).length,
          });
        }

        // Sort by completedCount descending
        results.sort((a, b) => b.completedCount - a.completedCount);

        return NextResponse.json({ success: true, users: results });
      }

      case "setTimer": {
        const { durationSec, autoCloseEnabled } = data;
        const votingDeadline = new Date(Date.now() + durationSec * 1000);
        await eventRef().update({
          votingDeadline,
          autoCloseEnabled: autoCloseEnabled ?? false,
          timerDurationSec: durationSec,
        });
        return NextResponse.json({ success: true, votingDeadline: votingDeadline.toISOString() });
      }

      case "extendTimer": {
        const { additionalSec } = data;
        const snap = await eventRef().get();
        const currentDeadline = snap.data()?.votingDeadline?.toDate() as Date | undefined;
        if (!currentDeadline) {
          return NextResponse.json({ error: "No active timer to extend" }, { status: 400 });
        }
        const now = Date.now();
        const newDeadline =
          currentDeadline.getTime() <= now
            ? new Date(now + additionalSec * 1000)
            : new Date(currentDeadline.getTime() + additionalSec * 1000);
        await eventRef().update({ votingDeadline: newDeadline });
        return NextResponse.json({ success: true, votingDeadline: newDeadline.toISOString() });
      }

      case "toggleAutoClose": {
        const { autoCloseEnabled: acEnabled } = data;
        await eventRef().update({ autoCloseEnabled: acEnabled ?? false });
        return NextResponse.json({ success: true });
      }

      case "resetTimer": {
        await eventRef().update({
          votingDeadline: null,
          timerDurationSec: null,
          autoCloseEnabled: false,
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

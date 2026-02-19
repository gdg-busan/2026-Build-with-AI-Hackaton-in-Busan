import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { generateUniqueCode, EVENT_ID } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

const eventRef = () => adminDb.collection("events").doc(EVENT_ID);
const teamsCol = () => eventRef().collection("teams");
const usersCol = () => eventRef().collection("users");
const votesCol = () => eventRef().collection("votes");
const chatRoomsCol = () => eventRef().collection("chatRooms");

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
            maxVotesPerUser: 3,
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
        const { status } = data;
        await eventRef().update({ status });
        return NextResponse.json({ success: true });
      }

      case "updateEventConfig": {
        const { judgeWeight, participantWeight, maxVotesPerUser } = data;
        const updateData: Record<string, number> = {};
        if (judgeWeight !== undefined) updateData.judgeWeight = judgeWeight;
        if (participantWeight !== undefined) updateData.participantWeight = participantWeight;
        if (maxVotesPerUser !== undefined) updateData.maxVotesPerUser = maxVotesPerUser;
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

        // Reset user hasVoted flags
        const usersSnap = await usersCol().get();
        if (!usersSnap.empty) {
          const batch = adminDb.batch();
          usersSnap.docs.forEach((doc) =>
            batch.update(doc.ref, { hasVoted: false })
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
        // Delete all votes
        const allVotes = await votesCol().get();
        if (!allVotes.empty) {
          const batch = adminDb.batch();
          allVotes.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Delete all teams
        const allTeams = await teamsCol().get();
        if (!allTeams.empty) {
          const batch = adminDb.batch();
          allTeams.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Delete all non-admin users
        const allUsers = await usersCol().get();
        if (!allUsers.empty) {
          const batch = adminDb.batch();
          allUsers.docs.forEach((doc) => {
            if (doc.data().role !== "admin") {
              batch.delete(doc.ref);
            }
          });
          await batch.commit();
        }

        // Reset event status to waiting
        await eventRef().update({ status: "waiting" });

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

      case "muteUser": {
        const { userCode, duration } = data as { userCode: string; duration: number };
        const mutedUntil = new Date(Date.now() + duration * 60 * 1000);
        await usersCol().doc(userCode).update({ chatMutedUntil: mutedUntil });
        return NextResponse.json({ success: true, mutedUntil });
      }

      case "unmuteUser": {
        const { userCode } = data as { userCode: string };
        await usersCol().doc(userCode).update({ chatMutedUntil: null });
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

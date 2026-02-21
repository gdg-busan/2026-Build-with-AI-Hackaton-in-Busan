import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID || 'gdg-busan-2026';

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: privateKey,
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  console.error('❌ Firebase environment variables missing.');
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

function generateParticipantCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GDG-P01${random}`;
}

async function seed() {
  const participantCode = generateParticipantCode();

  console.log('🔧 Seeding Participant...\n');

  const eventRef = db.collection('events').doc(EVENT_ID);
  
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
      console.error('❌ Event not found. Run seed-admin.ts first.');
      process.exit(1);
  }

  const userRef = eventRef.collection('users').doc(participantCode);
  
  await userRef.set({
    name: 'Test Participant',
    role: 'participant',
    teamId: null,
    hasVoted: false,
    createdAt: new Date(),
  });
  
  console.log('✅ Participant User Created');
  console.log('\n' + '='.repeat(50));
  console.log('🔑 Participant Login Code:');
  console.log(`\n   👉  ${participantCode}\n`);
  console.log('='.repeat(50));

  const teamsSnap = await eventRef.collection('teams').get();
  if (teamsSnap.empty) {
      console.log('ℹ️ No teams found. Seeding 3 dummy teams for voting test...');
      for (let i = 1; i <= 3; i++) {
          await eventRef.collection('teams').doc(`team-${i}`).set({
              id: `team-${i}`,
              name: `Team ${i}`,
              description: `Description for Team ${i}`,
              emoji: '🚀',
              participantVoteCount: 0,
              judgeVoteCount: 0,
              memberUserIds: []
          });
      }
      console.log('✅ 3 Dummy Teams Created');
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

import { PrismaClient, type UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

const users: Array<{ email: string; fullName: string; role: UserRole }> = [
  { email: 'admin@servicedesk.com', fullName: 'Admin User', role: 'ADMIN' },
  { email: 'lead@servicedesk.com', fullName: 'Team Lead', role: 'TEAM_LEAD' },
  { email: 'agent@servicedesk.com', fullName: 'Support Agent', role: 'AGENT' },
  { email: 'user@servicedesk.com', fullName: 'Regular Requester', role: 'REQUESTER' },
];

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, isActive: true },
      create: { email: u.email, fullName: u.fullName, role: u.role, passwordHash },
    });
    // eslint-disable-next-line no-console
    console.log(`✓ ${u.role.padEnd(10)} ${u.email}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

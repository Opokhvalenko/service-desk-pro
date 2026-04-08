import { PrismaClient, type TicketPriority, type UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const slaPolicies: Array<{
  priority: TicketPriority;
  firstResponseHours: number;
  resolveHours: number;
}> = [
  { priority: 'CRITICAL', firstResponseHours: 1, resolveHours: 4 },
  { priority: 'HIGH', firstResponseHours: 4, resolveHours: 24 },
  { priority: 'MEDIUM', firstResponseHours: 8, resolveHours: 72 },
  { priority: 'LOW', firstResponseHours: 24, resolveHours: 168 },
];

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

  for (const p of slaPolicies) {
    await prisma.slaPolicy.upsert({
      where: { priority: p.priority },
      update: { firstResponseHours: p.firstResponseHours, resolveHours: p.resolveHours },
      create: p,
    });
    // eslint-disable-next-line no-console
    console.log(
      `✓ SLA      ${p.priority.padEnd(8)} response=${p.firstResponseHours}h resolve=${p.resolveHours}h`,
    );
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

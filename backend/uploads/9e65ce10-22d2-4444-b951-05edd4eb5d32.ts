import { PrismaClient, OrgRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash },
    create: {
      email: 'admin@example.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  console.log(`Created user: ${user.email}`);

  // Create assessor user with password 987654
  const assessorHash = await bcrypt.hash('987654', 12);

  const assessor = await prisma.user.upsert({
    where: { email: 'assessor@example.com' },
    update: { passwordHash: assessorHash },
    create: {
      email: 'assessor@example.com',
      passwordHash: assessorHash,
      firstName: 'Assessor',
      lastName: 'User',
    },
  });

  console.log(`Created assessor user: ${assessor.email}`);

  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      members: {
        create: {
          userId: user.id,
          role: OrgRole.OWNER,
        },
      },
    },
  });

  // Add assessor as a member of the organization
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: assessor.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: assessor.id,
      role: OrgRole.MEMBER,
    },
  });

  console.log(`Created organization: ${org.name}`);
  console.log('Assessor added as member of organization');
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

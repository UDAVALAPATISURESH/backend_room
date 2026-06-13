import { PrismaClient } from '@prisma/client';
import {
  SCOPE_DEFINITIONS,
  ADMIN_SCOPES,
  MEMBER_SCOPES,
} from '../src/common/scopes.constants';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function seedScopes() {
  for (const s of SCOPE_DEFINITIONS) {
    await prisma.scope.upsert({
      where: { key: s.key },
      update: { label: s.label, module: s.module },
      create: s,
    });
  }
}

async function createRole(
  name: string,
  slug: string,
  description: string,
  scopeKeys: string[],
  isSystem: boolean,
) {
  const scopes = await prisma.scope.findMany({
    where: { key: { in: scopeKeys } },
  });

  const role = await prisma.roleDefinition.upsert({
    where: { slug },
    update: { name, description },
    create: { name, slug, description, isSystem },
  });

  await prisma.roleScope.deleteMany({ where: { roleId: role.id } });
  await prisma.roleScope.createMany({
    data: scopes.map((s) => ({ roleId: role.id, scopeId: s.id })),
  });

  return role;
}

async function main() {
  await seedScopes();

  await createRole(
    'Admin',
    'admin',
    'Full access to all features',
    ADMIN_SCOPES,
    true,
  );

  await createRole(
    'Member',
    'member',
    'Member dashboard, bills and own payments',
    MEMBER_SCOPES,
    true,
  );

  console.log('Seed done: system roles and scopes only. Create users from the app.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

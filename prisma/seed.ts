import { PrismaClient } from '@prisma/client';

import * as bcrypt from 'bcryptjs';

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



async function removeManagerRole() {

  const manager = await prisma.roleDefinition.findUnique({

    where: { slug: 'manager' },

  });

  if (!manager) return;



  const member = await prisma.roleDefinition.findUnique({

    where: { slug: 'member' },

  });

  if (member) {

    await prisma.user.updateMany({

      where: { roleId: manager.id },

      data: { roleId: member.id },

    });

  }



  await prisma.roleScope.deleteMany({ where: { roleId: manager.id } });

  await prisma.roleDefinition.delete({ where: { id: manager.id } });

}



async function main() {

  await seedScopes();

  await removeManagerRole();



  const adminRole = await createRole(

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



  const adminMobile = process.env.ADMIN_MOBILE || '9000000000';

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const adminName = process.env.ADMIN_NAME || 'Admin';

  const adminEmail = process.env.ADMIN_EMAIL || `${adminMobile}@room.local`;



  const hashed = await bcrypt.hash(adminPassword, 10);



  await prisma.user.upsert({

    where: { mobile: adminMobile },

    update: { name: adminName, roleId: adminRole.id, password: hashed },

    create: {

      name: adminName,

      email: adminEmail,

      mobile: adminMobile,

      password: hashed,

      roleId: adminRole.id,

    },

  });



  console.log('Seed completed: Admin + Member roles, default admin user.');

  console.log('Add members from Admin → Members page.');

}



main()

  .catch(console.error)

  .finally(() => prisma.$disconnect());



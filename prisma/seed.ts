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



async function main() {

  await seedScopes();



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



  const adminMobile = process.env.ADMIN_MOBILE;

  const adminPassword = process.env.ADMIN_PASSWORD;



  if (adminMobile && adminPassword) {

    const hashed = await bcrypt.hash(adminPassword, 10);

    await prisma.user.upsert({

      where: { mobile: adminMobile },

      update: { name: process.env.ADMIN_NAME || 'Admin', roleId: adminRole.id, password: hashed },

      create: {

        name: process.env.ADMIN_NAME || 'Admin',

        email: process.env.ADMIN_EMAIL || `${adminMobile}@room.local`,

        mobile: adminMobile,

        password: hashed,

        roleId: adminRole.id,

      },

    });

    console.log('Admin user seeded for mobile:', adminMobile);

  } else {

    console.log('Skipped admin user — set ADMIN_MOBILE and ADMIN_PASSWORD in .env to create one.');

  }



  console.log('Seed done: Admin + Member roles only. Add members from the app.');

}



main()

  .catch(console.error)

  .finally(() => prisma.$disconnect());



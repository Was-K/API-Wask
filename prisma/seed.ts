import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const password = await argon2.hash('ChangeMe123!');

  await prisma.user.upsert({
    where: { email: 'admin@wask.io' },
    update: {},
    create: {
      firstName: 'WAS-K',
      lastName: 'Admin',
      email: 'admin@wask.io',
      password,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isVerified: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

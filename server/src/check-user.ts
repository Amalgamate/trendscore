import prisma from './config/database';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: 'TEACHER'
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      roles: true,
      status: true,
      institutionType: true
    }
  });
  console.log('All Teachers in DB:', JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

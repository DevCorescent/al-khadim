const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create super admin
  const hashed = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@alkhadim.ae' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@alkhadim.ae',
      password: hashed,
      role: 'SUPER_ADMIN',
      phone: '+971500000000',
      isActive: true,
    },
  });
  console.log('Created admin:', admin.email);

  // Sample clients
  const client1 = await prisma.client.upsert({
    where: { id: 'client1' },
    update: {},
    create: {
      id: 'client1',
      companyName: 'Emirates Group',
      contactPerson: 'Ahmed Al Mansouri',
      email: 'hr@emirates.ae',
      phone: '+97142151111',
      industry: 'Aviation',
      country: 'UAE',
      city: 'Dubai',
      isActive: true,
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: 'client2' },
    update: {},
    create: {
      id: 'client2',
      companyName: 'ADNOC Group',
      contactPerson: 'Sarah Al Hassan',
      email: 'hr@adnoc.ae',
      phone: '+97126080000',
      industry: 'Oil & Gas',
      country: 'UAE',
      city: 'Abu Dhabi',
      isActive: true,
    },
  });

  // Sample jobs
  await prisma.job.createMany({
    data: [
      {
        title: 'Senior Software Engineer',
        clientId: client1.id,
        description: 'Full-stack development role',
        location: 'Dubai',
        country: 'UAE',
        salaryMin: 15000,
        salaryMax: 25000,
        currency: 'AED',
        positionsCount: 3,
        status: 'OPEN',
        experience: '5+ years',
      },
      {
        title: 'HR Manager',
        clientId: client2.id,
        description: 'Manage HR operations',
        location: 'Abu Dhabi',
        country: 'UAE',
        salaryMin: 12000,
        salaryMax: 18000,
        currency: 'AED',
        positionsCount: 1,
        status: 'OPEN',
        experience: '7+ years',
      },
      {
        title: 'Civil Engineer',
        clientId: client1.id,
        description: 'Infrastructure projects',
        location: 'Dubai',
        country: 'UAE',
        salaryMin: 8000,
        salaryMax: 14000,
        currency: 'AED',
        positionsCount: 5,
        status: 'OPEN',
        experience: '3+ years',
      },
    ],
    skipDuplicates: true,
  });

  // Sample candidates
  await prisma.candidate.createMany({
    data: [
      {
        firstName: 'Rajesh',
        lastName: 'Kumar',
        email: 'rajesh.kumar@example.com',
        phone: '+919876543210',
        nationality: 'Indian',
        currentLocation: 'India',
        experience: 6,
        skills: ['React', 'Node.js', 'PostgreSQL'],
        status: 'SHORTLISTED',
        source: 'WEBSITE',
      },
      {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria.santos@example.com',
        phone: '+639171234567',
        nationality: 'Filipino',
        currentLocation: 'UAE',
        experience: 8,
        skills: ['HR Management', 'Recruitment', 'Payroll'],
        status: 'INTERVIEW_SCHEDULED',
        source: 'REFERRAL',
      },
    ],
    skipDuplicates: true,
  });

  await require('../scripts/seedEmailTemplates').seedEmailTemplates();

  console.log('Seeding completed!');
  console.log('\nAdmin Credentials:');
  console.log('Email: admin@alkhadim.ae');
  console.log('Password: Admin@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

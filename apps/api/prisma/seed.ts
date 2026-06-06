import {
  PrismaClient,
  TaskWeight,
  TaskStatus,
  TaskCadence,
  SystemRole,
  HouseholdRole,
  LandlordMode,
  RitualType,
  ExpenseShareStatus,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DUMMY_PASSWORD = 'password123';

const DUMMY_USERS = [
  { email: 'alice@homebuddy.dev', name: 'Alice', systemRole: SystemRole.user },
  { email: 'bob@homebuddy.dev', name: 'Bob', systemRole: SystemRole.user },
  { email: 'admin@homebuddy.dev', name: 'Admin', systemRole: SystemRole.support },
  { email: 'landlord@homebuddy.dev', name: 'Property Manager', systemRole: SystemRole.user },
  // Charlie is invited to Demo House but has not activated — drives the §5.11 participation warning.
  { email: 'charlie@homebuddy.dev', name: 'Charlie', systemRole: SystemRole.user },
];

const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function ensureMember(userId: string, householdId: string, role: HouseholdRole) {
  await prisma.householdMember.upsert({
    where: { userId_householdId: { userId, householdId } },
    update: { role },
    create: { userId, householdId, role },
  });
}

async function linkLandlordToHousehold(
  landlordId: string,
  householdId: string,
  mode: LandlordMode,
  consentGranted: boolean,
) {
  await prisma.landlordProperty.upsert({
    where: { landlordId_householdId: { landlordId, householdId } },
    update: { mode, consentGranted },
    create: { landlordId, householdId, mode, consentGranted },
  });
}

async function seedTasksOnce(householdId: string, tasks: Prisma.TaskCreateManyInput[]) {
  const count = await prisma.task.count({ where: { householdId } });
  if (count === 0 && tasks.length > 0) {
    await prisma.task.createMany({ data: tasks });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(DUMMY_PASSWORD, 10);

  for (const u of DUMMY_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { email: u.email },
        data: {
          passwordHash,
          name: u.name,
          systemRole: u.systemRole,
          refreshTokenHash: null,
        },
      });
      console.log(
        `[seed] reset ${u.email} (id=${updated.id}, systemRole=${updated.systemRole}) — password=${DUMMY_PASSWORD}`,
      );
    } else {
      const created = await prisma.user.create({ data: { ...u, passwordHash } });
      console.log(
        `[seed] created ${u.email} (id=${created.id}, systemRole=${created.systemRole}) — password=${DUMMY_PASSWORD}`,
      );
    }
  }

  // Belt-and-suspenders: raw SQL update for every demo email, in case the
  // Prisma .update() path was somehow not committing for an existing row.
  const rawCount = await prisma.$executeRaw`
    UPDATE "User"
    SET "passwordHash" = ${passwordHash}, "refreshTokenHash" = NULL
    WHERE LOWER(email) IN ('alice@homebuddy.dev','bob@homebuddy.dev','admin@homebuddy.dev','landlord@homebuddy.dev')
  `;
  console.log(`[seed] raw SQL force-reset hit ${rawCount} demo rows`);

  // Diagnostic snapshot of every user row keyed off our demo emails.
  const snapshot = await prisma.$queryRaw<
    Array<{ id: string; email: string; systemRole: string; passwordHashLen: number }>
  >`
    SELECT id, email, "systemRole"::text AS "systemRole", LENGTH("passwordHash") AS "passwordHashLen"
    FROM "User"
    WHERE LOWER(email) LIKE '%@homebuddy.dev'
    ORDER BY email
  `;
  for (const row of snapshot) {
    console.log(
      `[seed] demo-row email="${row.email}" systemRole=${row.systemRole} id=${row.id} passwordHashLen=${row.passwordHashLen}`,
    );
  }

  const alice = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@homebuddy.dev' } });
  const bob = await prisma.user.findUniqueOrThrow({ where: { email: 'bob@homebuddy.dev' } });

  const household = await prisma.household.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { joinCode: 'DEMOHB2' },
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Demo House', joinCode: 'DEMOHB2' },
  });

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@homebuddy.dev' },
  });

  const demoMembers: Array<{ userId: string; role: HouseholdRole }> = [
    { userId: alice.id, role: HouseholdRole.admin },
    { userId: bob.id, role: HouseholdRole.member },
    { userId: admin.id, role: HouseholdRole.admin },
  ];

  for (const m of demoMembers) {
    await prisma.householdMember.upsert({
      where: { userId_householdId: { userId: m.userId, householdId: household.id } },
      update: { role: m.role },
      create: { userId: m.userId, householdId: household.id, role: m.role },
    });
  }

  const charlie = await prisma.user.findUniqueOrThrow({ where: { email: 'charlie@homebuddy.dev' } });
  await prisma.householdMember.upsert({
    where: { userId_householdId: { userId: charlie.id, householdId: household.id } },
    update: { status: 'invited' },
    create: { userId: charlie.id, householdId: household.id, role: 'member', status: 'invited' },
  });

  const existingTaskCount = await prisma.task.count({
    where: { householdId: household.id },
  });

  if (existingTaskCount === 0) {
    await prisma.task.createMany({
      data: [
        {
          householdId: household.id,
          title: 'Clean the kitchen',
          weight: TaskWeight.heavy,
          status: TaskStatus.completed,
          dueAt: daysFromNow(-5),
          assigneeId: alice.id,
          completedById: alice.id,
          completedAt: daysFromNow(-5),
        },
        {
          householdId: household.id,
          title: 'Take out the trash',
          weight: TaskWeight.light,
          status: TaskStatus.completed,
          dueAt: daysFromNow(-3),
          assigneeId: bob.id,
          completedById: bob.id,
          completedAt: daysFromNow(-3),
        },
        {
          householdId: household.id,
          title: 'Clean the kitchen',
          weight: TaskWeight.heavy,
          status: TaskStatus.pending,
          dueAt: daysFromNow(3),
          assigneeId: bob.id,
        },
        {
          householdId: household.id,
          title: 'Vacuum living room',
          weight: TaskWeight.light,
          status: TaskStatus.overdue,
          dueAt: daysFromNow(-2),
          assigneeId: alice.id,
        },
        {
          householdId: household.id,
          title: 'Restock dish soap',
          weight: TaskWeight.light,
          status: TaskStatus.pending,
          dueAt: daysFromNow(1),
          assigneeId: alice.id,
        },
        {
          householdId: household.id,
          title: 'Clean the shared stairwell',
          weight: TaskWeight.heavy,
          cadence: TaskCadence.weekly,
          status: TaskStatus.pending,
          dueAt: daysFromNow(2),
          assigneeId: bob.id,
        },
      ],
    });
    console.log('Seeded demo tasks');
  }

  await prisma.supply.createMany({
    data: [
      { householdId: household.id, name: 'Toilet paper', isLow: false },
      { householdId: household.id, name: 'Dish soap', isLow: true },
      { householdId: household.id, name: 'Trash bags', isLow: false },
    ],
    skipDuplicates: true,
  });
  console.log('Seeded demo supplies');

  const existingMaintenance = await prisma.maintenanceRequest.count({
    where: { householdId: household.id },
  });
  if (existingMaintenance === 0) {
    await prisma.maintenanceRequest.createMany({
      data: [
        { householdId: household.id, reporterId: alice.id, title: 'Boiler slow to heat', category: 'Heating / boiler', status: 'open' },
        // Escalated by a resident, so it crosses the Privacy Line into the landlord portal.
        { householdId: household.id, reporterId: bob.id, title: 'Damp patch in bathroom ceiling', category: 'Mold / damp', status: 'acknowledged', escalated: true },
      ],
    });
    console.log('Seeded demo maintenance requests');
  }

  // Ensure exactly one escalated request so the landlord portal demonstrates the
  // Privacy Line filter (escalated crosses; everything else stays tenant-only).
  await prisma.maintenanceRequest.updateMany({
    where: { householdId: household.id, title: 'Damp patch in bathroom ceiling' },
    data: { escalated: true },
  });

  // Cost sharing (§ cost-sharing spec). Two demo bills show the two-sided
  // settlement handshake mid-flight. Charlie is invited, so the active-only
  // default leaves him out of both splits.
  const existingExpenses = await prisma.expense.count({ where: { householdId: household.id } });
  if (existingExpenses === 0) {
    await prisma.expense.create({
      data: {
        householdId: household.id,
        creatorId: alice.id,
        title: 'Groceries — Colruyt',
        note: 'Weekly shop for the house',
        totalCents: 4250,
        items: {
          create: [
            { label: 'Milk', amountCents: 150, position: 0 },
            { label: 'Bread', amountCents: 200, position: 1 },
            { label: 'Pasta', amountCents: 320, position: 2 },
            { label: 'Vegetables', amountCents: 880, position: 3 },
            { label: 'Coffee', amountCents: 2700, position: 4 },
          ],
        },
        // Split Alice + Bob equally; Bob owes 21.25 and has already paid,
        // waiting on Alice to confirm she received it.
        shares: {
          create: [
            {
              debtorId: bob.id,
              amountCents: 2125,
              status: ExpenseShareStatus.paid,
              paidAt: daysFromNow(-1),
            },
          ],
        },
      },
    });
    await prisma.expense.create({
      data: {
        householdId: household.id,
        creatorId: bob.id,
        title: 'Cleaning supplies',
        totalCents: 1800,
        // Split Alice + Bob equally; Alice owes 9.00 and has not paid yet.
        shares: { create: [{ debtorId: alice.id, amountCents: 900 }] },
      },
    });
    console.log('Seeded demo expenses (cost sharing, two-sided settlement)');
  }

  const landlord = await prisma.user.findUniqueOrThrow({ where: { email: 'landlord@homebuddy.dev' } });
  await linkLandlordToHousehold(landlord.id, household.id, LandlordMode.observer, true);
  console.log('Linked landlord to Demo House (observer, consent on)');

  // Extra houses so the landlord modes can be exercised locally. See CLAUDE.md.
  const sunset = await prisma.household.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: { harmonyScore: 82, joinCode: 'SUNSET3' },
    create: { id: '00000000-0000-0000-0000-000000000002', name: 'Sunset Kot', harmonyScore: 82, joinCode: 'SUNSET3' },
  });
  await ensureMember(alice.id, sunset.id, HouseholdRole.admin);
  await ensureMember(bob.id, sunset.id, HouseholdRole.member);
  await seedTasksOnce(sunset.id, [
    {
      householdId: sunset.id,
      title: 'Water the plants',
      weight: TaskWeight.light,
      status: TaskStatus.pending,
      dueAt: daysFromNow(2),
      assigneeId: bob.id,
    },
  ]);
  await linkLandlordToHousehold(landlord.id, sunset.id, LandlordMode.caretaker, true);
  console.log('Linked landlord to Sunset Kot (caretaker, consent on)');

  const sunsetCaretakerCount = await prisma.task.count({
    where: { householdId: sunset.id, caretakerOwned: true },
  });
  if (sunsetCaretakerCount === 0) {
    await prisma.task.create({
      data: {
        householdId: sunset.id,
        title: 'Mop the shared stairwell',
        titleSlug: 'mop shared stairwell',
        weight: TaskWeight.heavy,
        status: TaskStatus.pending,
        dueAt: daysFromNow(4),
        assigneeId: landlord.id,
        caretakerOwned: true,
      },
    });
    console.log('Seeded Sunset Kot caretaker-owned common-area chore (excluded from rotation)');
  }

  const maple = await prisma.household.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: { harmonyScore: 38, joinCode: 'MAPLE44' },
    create: { id: '00000000-0000-0000-0000-000000000003', name: 'Maple Flat', harmonyScore: 38, joinCode: 'MAPLE44' },
  });
  await ensureMember(alice.id, maple.id, HouseholdRole.admin);
  await seedTasksOnce(maple.id, [
    {
      householdId: maple.id,
      title: 'Empty the recycling',
      weight: TaskWeight.light,
      status: TaskStatus.overdue,
      dueAt: daysFromNow(-4),
      assigneeId: alice.id,
    },
    {
      householdId: maple.id,
      title: 'Scrub the bathroom',
      weight: TaskWeight.heavy,
      status: TaskStatus.overdue,
      dueAt: daysFromNow(-2),
      assigneeId: alice.id,
    },
  ]);
  await linkLandlordToHousehold(landlord.id, maple.id, LandlordMode.observer, false);
  console.log('Linked landlord to Maple Flat (observer, consent OFF — hidden from portal)');

  // Bloom Stage — a house staged for a dramatic on-stage Energy Core arc.
  // It opens Tense (deep red, scarred by a heavy overdue chore). Logged in as
  // alice, complete the overdue chores live to watch the orb heal and the
  // completion sparks fly in, then complete the pre-loaded ritual (both members
  // already joined) to trigger a full household bloom.
  const stage = await prisma.household.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: { harmonyScore: 16, joinCode: 'BLOOM55' },
    create: { id: '00000000-0000-0000-0000-000000000004', name: 'Bloom Stage', harmonyScore: 16, joinCode: 'BLOOM55' },
  });
  await ensureMember(alice.id, stage.id, HouseholdRole.admin);
  await ensureMember(bob.id, stage.id, HouseholdRole.member);
  await seedTasksOnce(stage.id, [
    {
      householdId: stage.id,
      title: 'Scrub the kitchen floor',
      weight: TaskWeight.heavy,
      status: TaskStatus.overdue,
      dueAt: daysFromNow(-3),
      assigneeId: alice.id,
    },
    {
      householdId: stage.id,
      title: 'Take out the recycling',
      weight: TaskWeight.light,
      status: TaskStatus.overdue,
      dueAt: daysFromNow(-1),
      assigneeId: alice.id,
    },
    {
      householdId: stage.id,
      title: 'Wipe down the counters',
      weight: TaskWeight.light,
      status: TaskStatus.pending,
      dueAt: daysFromNow(1),
      assigneeId: alice.id,
    },
  ]);

  const stageRitualCount = await prisma.ritual.count({ where: { householdId: stage.id } });
  if (stageRitualCount === 0) {
    await prisma.ritual.create({
      data: {
        householdId: stage.id,
        type: RitualType.meal,
        title: 'Sunday house dinner',
        proposedAt: daysFromNow(1),
        proposerId: alice.id,
        participants: { create: [{ userId: alice.id }, { userId: bob.id }] },
      },
    });
    console.log('Seeded Bloom Stage ritual (both members joined — completing it blooms)');
  }
  console.log('Seeded Bloom Stage demo house (harmony 16, Tense — stage the orb arc here)');

  console.log('Seeded users:');
  DUMMY_USERS.forEach((u) => console.log(`  ${u.email} / ${DUMMY_PASSWORD}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

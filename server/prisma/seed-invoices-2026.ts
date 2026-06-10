import { PrismaClient, Term, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Bulk Invoice Generation for Term 1 2026...');

    try {
        // 1. Get School
        const school = await prisma.school.findFirst({
            where: { name: 'TRENDSCORE DEMO ACADEMY' }
        });

        if (!school) {
            console.error('❌ School not found!');
            return;
        }

        // 2. Get Admin User for issuedBy
        const admin = await prisma.user.findFirst({
            where: {
                schoolId: school.id,
                role: { in: ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'] }
            }
        });

        if (!admin) {
            console.error('❌ No admin/accountant user found to issue invoices!');
            return;
        }

        console.log(`✅ Using issuer: ${admin.firstName} ${admin.lastName}`);

        // 3. Get all learners
        const learners = await prisma.learner.findMany({
            where: {
                schoolId: school.id,
                archived: false,
                status: 'ACTIVE'
            }
        });

        console.log(`📊 Found ${learners.length} active learners.`);

        // 4. Get all Fee Structures for Term 1 2026
        const structures = await prisma.feeStructure.findMany({
            where: {
                schoolId: school.id,
                term: Term.TERM_1,
                academicYear: 2026,
                active: true
            },
            include: {
                feeItems: true
            }
        });

        const structureMap = new Map();
        structures.forEach(s => structureMap.set(s.grade, s));

        console.log(`📋 Found ${structures.length} fee structures.`);

        let createdCount = 0;
        let skippedCount = 0;

        // 5. Generate Invoices
        for (const learner of learners) {
            const structure = structureMap.get(learner.grade);

            if (!structure) {
                console.warn(`⚠️ No fee structure found for grade ${learner.grade}. Skipping learner ${learner.admissionNumber}`);
                skippedCount++;
                continue;
            }

            // Check if invoice already exists
            const existing = await prisma.feeInvoice.findFirst({
                where: {
                    learnerId: learner.id,
                    term: Term.TERM_1,
                    academicYear: 2026
                }
            });

            if (existing) {
                skippedCount++;
                continue;
            }

            // Calculate total from structure items (with types to avoid compilation error)
            const total = structure.feeItems.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

            const invoiceNumber = `INV-2026-T1-${learner.admissionNumber.replace(/\//g, '-')}`;

            await prisma.feeInvoice.create({
                data: {
                    invoiceNumber: invoiceNumber,
                    learnerId: learner.id,
                    feeStructureId: structure.id,
                    schoolId: school.id,
                    term: Term.TERM_1,
                    academicYear: 2026,
                    dueDate: new Date('2026-01-31'),
                    totalAmount: total,
                    paidAmount: 0,
                    balance: total,
                    status: PaymentStatus.PENDING,
                    issuedBy: admin.id
                }
            });

            createdCount++;
            if (createdCount % 50 === 0) process.stdout.write('.');
        }

        console.log(`\n\n✅ Invoice Generation Complete!`);
        console.log(`📊 Invoices Created: ${createdCount}`);
        console.log(`⏭️  Invoices Skipped: ${skippedCount}`);

    } catch (error) {
        console.error('❌ Error generating invoices:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

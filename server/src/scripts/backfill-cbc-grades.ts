import { PrismaClient } from '@prisma/client';
import { gradingService } from '../services/grading.service';

const prisma = new PrismaClient();

async function backfillCbcGrades() {
  console.log('Starting CBC Grade backfill...');

  try {
    // 1. Fetch all summative results that don't have a cbcGrade
    const results = await prisma.summativeResult.findMany({
      where: {
        OR: [
          { cbcGrade: null },
          { cbcGrade: '' },
          { cbcGrade: 'A' },
          { cbcGrade: 'B' },
          { cbcGrade: 'C' },
          { cbcGrade: 'D' },
          { cbcGrade: 'E' }
        ]
      },
      include: {
        test: {
          select: {
            totalMarks: true
          }
        }
      }
    });

    console.log(`Found ${results.length} records to backfill.`);

    // 2. Fetch the CBC grading system
    const cbcSystem = await gradingService.getGradingSystem('CBC');
    if (!cbcSystem.ranges || cbcSystem.ranges.length === 0) {
      throw new Error('CBC grading system has no ranges defined.');
    }

    let successCount = 0;
    let failCount = 0;

    // 3. Update each record
    for (const result of results) {
      try {
        const percentage = result.percentage;
        if (percentage === null || percentage === undefined) {
          continue;
        }
        const cbcGrade = gradingService.calculateRatingSync(percentage, cbcSystem.ranges);

        await prisma.summativeResult.update({
          where: { id: result.id },
          data: { cbcGrade }
        });

        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Processed ${successCount} records...`);
        }
      } catch (err: any) {
        console.error(`Failed to update result ${result.id}:`, err.message);
        failCount++;
      }
    }

    console.log('Backfill completed successfully!');
    console.log(`Summary: ${successCount} updated, ${failCount} failed.`);

  } catch (error: any) {
    console.error('Backfill failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillCbcGrades();

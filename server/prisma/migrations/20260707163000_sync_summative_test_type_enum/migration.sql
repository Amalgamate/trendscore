-- Keep the live PostgreSQL enum in sync with Prisma and the UI's canonical
-- summative test type list. Some production databases still had the older
-- enum subset, so MOCK/RANDOM/MONTHLY/WEEKLY failed at insert time.

ALTER TYPE "SummativeTestType" ADD VALUE IF NOT EXISTS 'MONTHLY';
ALTER TYPE "SummativeTestType" ADD VALUE IF NOT EXISTS 'WEEKLY';
ALTER TYPE "SummativeTestType" ADD VALUE IF NOT EXISTS 'MOCK';
ALTER TYPE "SummativeTestType" ADD VALUE IF NOT EXISTS 'RANDOM';

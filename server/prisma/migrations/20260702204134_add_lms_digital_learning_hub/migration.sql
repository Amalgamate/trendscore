-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LessonBlockType" AS ENUM ('HEADING', 'PARAGRAPH', 'IMAGE', 'GALLERY', 'VIDEO', 'AUDIO', 'QUIZ', 'FLASHCARDS', 'TIMELINE', 'ACCORDION', 'TABLE', 'DIAGRAM', 'CODE', 'FORMULA', 'PDF', 'ASSIGNMENT', 'DISCUSSION', 'REFLECTION', 'TEACHER_NOTES', 'PRACTICE_QUESTIONS');

-- CreateEnum
CREATE TYPE "AssignmentCategory" AS ENUM ('HOMEWORK', 'PROJECT', 'REVISION', 'HOLIDAY_WORK', 'RESEARCH', 'READING', 'PRACTICAL', 'GROUP_WORK');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LATE', 'MARKED', 'RETURNED', 'RESUBMITTED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('NOTES', 'PAST_PAPER', 'SCHEME', 'WORKSHEET', 'PROJECT', 'EXPERIMENT', 'CBC_ACTIVITY', 'HOLIDAY_PACKAGE', 'VIDEO', 'OTHER');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "MarketplaceListingType" AS ENUM ('FREE', 'PAID', 'BUNDLE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "MarketplaceStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('FIRST_LESSON', 'STREAK_7', 'STREAK_30', 'PERFECT_SCORE', 'FAST_LEARNER', 'TOP_CONTRIBUTOR', 'EARLY_BIRD', 'ASSIGNMENT_ACE', 'RESOURCE_SHARER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "AIContentType" ADD VALUE 'LEARNING_ASSISTANT';
ALTER TYPE "AIContentType" ADD VALUE 'ASSIGNMENT_GENERATOR';
ALTER TYPE "AIContentType" ADD VALUE 'LESSON_PLAN';
ALTER TYPE "AIContentType" ADD VALUE 'RUBRIC_GENERATOR';
ALTER TYPE "AIContentType" ADD VALUE 'PRACTICE_QUESTIONS';
ALTER TYPE "AIContentType" ADD VALUE 'FLASHCARD_SET';
ALTER TYPE "AIContentType" ADD VALUE 'QUESTION_BANK';

-- AlterTable: Add nullable columns to lms_courses (task 1.3)
ALTER TABLE "lms_courses" ADD COLUMN     "classId" TEXT,
ADD COLUMN     "learningAreaId" TEXT,
ADD COLUMN     "lessonCount" INTEGER DEFAULT 0,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "termId" TEXT;

-- AlterTable: Add nullable columns to lms_content (task 1.3)
ALTER TABLE "lms_content" ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "language" TEXT DEFAULT 'English',
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "topic" TEXT;

-- CreateTable: learning_lessons
CREATE TABLE "learning_lessons" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT,
    "learningAreaId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "streamId" TEXT,
    "termId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "estimatedMins" INTEGER,
    "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,
    "allowQuestions" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learning_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lesson_blocks
CREATE TABLE "lesson_blocks" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "LessonBlockType" NOT NULL,
    "order" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lesson_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: learning_assignments
CREATE TABLE "learning_assignments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "learningAreaId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "streamId" TEXT,
    "termId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "category" "AssignmentCategory" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "estimatedMins" INTEGER,
    "totalMarks" INTEGER,
    "passMark" INTEGER,
    "rubric" JSONB,
    "cbcOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowLateSubmit" BOOLEAN NOT NULL DEFAULT true,
    "allowResubmit" BOOLEAN NOT NULL DEFAULT false,
    "maxFileSize" INTEGER NOT NULL DEFAULT 25,
    "allowedFileTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gradebookSync" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learning_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: assignment_files
CREATE TABLE "assignment_files" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable: learning_submissions
CREATE TABLE "learning_submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "marks" DOUBLE PRECISION,
    "feedback" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "markedAt" TIMESTAMP(3),
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learning_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: submission_files
CREATE TABLE "submission_files" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable: learning_resources
CREATE TABLE "learning_resources" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "learningAreaId" TEXT NOT NULL,
    "classId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resourceType" "ResourceType" NOT NULL,
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "topic" TEXT,
    "term" INTEGER,
    "year" INTEGER,
    "difficulty" "DifficultyLevel",
    "language" TEXT NOT NULL DEFAULT 'English',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learning_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: marketplace_listings
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "listingType" "MarketplaceListingType" NOT NULL,
    "revenueSharePct" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "status" "MarketplaceStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvalRequestId" TEXT,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: marketplace_purchases
CREATE TABLE "marketplace_purchases" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "mpesaReceiptNo" TEXT,
    "transactionId" TEXT,
    "sellerEarnings" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER NOT NULL DEFAULT 5,
    "accessExpiresAt" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable: learning_progress
CREATE TABLE "learning_progress" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blocksCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalBlocks" INTEGER NOT NULL DEFAULT 0,
    "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpentMins" INTEGER NOT NULL DEFAULT 0,
    "lastBlockId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable: learning_sessions
CREATE TABLE "learning_sessions" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "deviceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: learner_achievements
CREATE TABLE "learner_achievements" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learner_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: learning_bookmarks
CREATE TABLE "learning_bookmarks" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "resourceId" TEXT,
    "lessonId" TEXT,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learning_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lms_settings
CREATE TABLE "lms_settings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enableLearning" BOOLEAN NOT NULL DEFAULT true,
    "enableMarketplace" BOOLEAN NOT NULL DEFAULT false,
    "enableAI" BOOLEAN NOT NULL DEFAULT false,
    "enableRevisionLibrary" BOOLEAN NOT NULL DEFAULT true,
    "allowLateSubmission" BOOLEAN NOT NULL DEFAULT true,
    "allowResubmission" BOOLEAN NOT NULL DEFAULT false,
    "maxUploadSizeMB" INTEGER NOT NULL DEFAULT 25,
    "allowedFileTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignmentDueTime" TEXT NOT NULL DEFAULT '23:59',
    "enableComments" BOOLEAN NOT NULL DEFAULT true,
    "enableStudentQuestions" BOOLEAN NOT NULL DEFAULT true,
    "enableDownloads" BOOLEAN NOT NULL DEFAULT true,
    "enableGamification" BOOLEAN NOT NULL DEFAULT false,
    "enableXP" BOOLEAN NOT NULL DEFAULT false,
    "enableBadges" BOOLEAN NOT NULL DEFAULT false,
    "enableLeaderboards" BOOLEAN NOT NULL DEFAULT false,
    "enableStreaks" BOOLEAN NOT NULL DEFAULT false,
    "notifyParents" BOOLEAN NOT NULL DEFAULT true,
    "showFeedbackToParents" BOOLEAN NOT NULL DEFAULT true,
    "showProgressToParents" BOOLEAN NOT NULL DEFAULT true,
    "marketplaceRevenuePct" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "allowFreeContent" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lms_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_lessons_schoolId_idx" ON "learning_lessons"("schoolId");
CREATE INDEX "learning_lessons_classId_idx" ON "learning_lessons"("classId");
CREATE INDEX "learning_lessons_learningAreaId_idx" ON "learning_lessons"("learningAreaId");
CREATE INDEX "learning_lessons_status_idx" ON "learning_lessons"("status");
CREATE INDEX "learning_lessons_termId_idx" ON "learning_lessons"("termId");
CREATE INDEX "learning_lessons_schoolId_classId_learningAreaId_idx" ON "learning_lessons"("schoolId", "classId", "learningAreaId");

-- CreateIndex
CREATE INDEX "lesson_blocks_lessonId_idx" ON "lesson_blocks"("lessonId");
CREATE INDEX "lesson_blocks_type_idx" ON "lesson_blocks"("type");

-- CreateIndex
CREATE INDEX "learning_assignments_schoolId_idx" ON "learning_assignments"("schoolId");
CREATE INDEX "learning_assignments_classId_idx" ON "learning_assignments"("classId");
CREATE INDEX "learning_assignments_learningAreaId_idx" ON "learning_assignments"("learningAreaId");
CREATE INDEX "learning_assignments_status_idx" ON "learning_assignments"("status");
CREATE INDEX "learning_assignments_dueDate_idx" ON "learning_assignments"("dueDate");
CREATE INDEX "learning_assignments_termId_idx" ON "learning_assignments"("termId");
CREATE INDEX "learning_assignments_schoolId_classId_status_dueDate_idx" ON "learning_assignments"("schoolId", "classId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "assignment_files_assignmentId_idx" ON "assignment_files"("assignmentId");

-- CreateIndex
CREATE INDEX "learning_submissions_assignmentId_idx" ON "learning_submissions"("assignmentId");
CREATE INDEX "learning_submissions_learnerId_idx" ON "learning_submissions"("learnerId");
CREATE INDEX "learning_submissions_status_idx" ON "learning_submissions"("status");
CREATE INDEX "learning_submissions_markedById_idx" ON "learning_submissions"("markedById");
CREATE UNIQUE INDEX "learning_submissions_assignmentId_learnerId_attemptNumber_key" ON "learning_submissions"("assignmentId", "learnerId", "attemptNumber");

-- CreateIndex
CREATE INDEX "submission_files_submissionId_idx" ON "submission_files"("submissionId");

-- CreateIndex
CREATE INDEX "learning_resources_schoolId_idx" ON "learning_resources"("schoolId");
CREATE INDEX "learning_resources_learningAreaId_idx" ON "learning_resources"("learningAreaId");
CREATE INDEX "learning_resources_classId_idx" ON "learning_resources"("classId");
CREATE INDEX "learning_resources_resourceType_idx" ON "learning_resources"("resourceType");
CREATE INDEX "learning_resources_topic_idx" ON "learning_resources"("topic");
CREATE INDEX "learning_resources_uploadedById_idx" ON "learning_resources"("uploadedById");

-- CreateIndex
CREATE INDEX "marketplace_listings_schoolId_idx" ON "marketplace_listings"("schoolId");
CREATE INDEX "marketplace_listings_sellerId_idx" ON "marketplace_listings"("sellerId");
CREATE INDEX "marketplace_listings_status_idx" ON "marketplace_listings"("status");
CREATE INDEX "marketplace_listings_listingType_idx" ON "marketplace_listings"("listingType");
CREATE INDEX "marketplace_listings_price_idx" ON "marketplace_listings"("price");

-- CreateIndex
CREATE INDEX "marketplace_purchases_listingId_idx" ON "marketplace_purchases"("listingId");
CREATE INDEX "marketplace_purchases_buyerId_idx" ON "marketplace_purchases"("buyerId");
CREATE INDEX "marketplace_purchases_schoolId_idx" ON "marketplace_purchases"("schoolId");
CREATE INDEX "marketplace_purchases_status_idx" ON "marketplace_purchases"("status");

-- CreateIndex
CREATE INDEX "learning_progress_learnerId_idx" ON "learning_progress"("learnerId");
CREATE INDEX "learning_progress_lessonId_idx" ON "learning_progress"("lessonId");
CREATE INDEX "learning_progress_schoolId_idx" ON "learning_progress"("schoolId");
CREATE UNIQUE INDEX "learning_progress_learnerId_lessonId_key" ON "learning_progress"("learnerId", "lessonId");

-- CreateIndex
CREATE INDEX "learning_sessions_learnerId_idx" ON "learning_sessions"("learnerId");
CREATE INDEX "learning_sessions_lessonId_idx" ON "learning_sessions"("lessonId");
CREATE INDEX "learning_sessions_schoolId_idx" ON "learning_sessions"("schoolId");
CREATE INDEX "learning_sessions_startedAt_idx" ON "learning_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "learner_achievements_learnerId_idx" ON "learner_achievements"("learnerId");
CREATE INDEX "learner_achievements_schoolId_idx" ON "learner_achievements"("schoolId");
CREATE INDEX "learner_achievements_type_idx" ON "learner_achievements"("type");

-- CreateIndex
CREATE INDEX "learning_bookmarks_learnerId_idx" ON "learning_bookmarks"("learnerId");
CREATE INDEX "learning_bookmarks_schoolId_idx" ON "learning_bookmarks"("schoolId");
CREATE UNIQUE INDEX "learning_bookmarks_learnerId_resourceId_key" ON "learning_bookmarks"("learnerId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "lms_settings_schoolId_key" ON "lms_settings"("schoolId");

-- AddForeignKey
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "learning_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_blocks" ADD CONSTRAINT "lesson_blocks_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "learning_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "learning_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_files" ADD CONSTRAINT "assignment_files_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "learning_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_submissions" ADD CONSTRAINT "learning_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "learning_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_submissions" ADD CONSTRAINT "learning_submissions_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_submissions" ADD CONSTRAINT "learning_submissions_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "learning_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "learning_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "learning_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "learning_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "learning_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_achievements" ADD CONSTRAINT "learner_achievements_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_bookmarks" ADD CONSTRAINT "learning_bookmarks_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_bookmarks" ADD CONSTRAINT "learning_bookmarks_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "learning_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lms_settings" ADD CONSTRAINT "lms_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

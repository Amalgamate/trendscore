-- AlterTable: add classification column and index to senior_schools
ALTER TABLE "senior_schools" ADD COLUMN "classification" TEXT;
CREATE INDEX "senior_schools_classification_idx" ON "senior_schools"("classification");

ALTER TABLE "schools" ADD COLUMN "accommodationType" TEXT;
ALTER TABLE "schools" ADD COLUMN "provisioningApplicationId" TEXT;
CREATE UNIQUE INDEX "schools_provisioningApplicationId_key" ON "schools"("provisioningApplicationId");

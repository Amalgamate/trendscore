-- App catalog icons include names longer than the original VARCHAR(10) limit
-- (for example, `graduation-cap` and `check-square`). Keep this column aligned
-- with the Prisma schema's unbounded String type.
ALTER TABLE "apps"
  ALTER COLUMN "icon" TYPE TEXT
  USING "icon"::TEXT;

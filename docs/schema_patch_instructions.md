# Prisma Schema Patch Instructions
# Run: npx prisma migrate dev --name add_allowances_deductions
# Then: npx prisma generate

## Changes needed in schema.prisma:

### 1. On the User model, ADD these two relation lines inside the model body
###    (after the existing `staffDocuments StaffDocument[]` line):

  staffAllowances           StaffAllowance[]
  staffDeductions           StaffDeduction[]

### 2. REPLACE the PayrollRecord model with:

model PayrollRecord {
  id               String        @id @default(uuid())
  userId           String
  month            Int
  year             Int
  basicSalary      Decimal       @db.Decimal(10, 2)
  grossSalary      Decimal?      @db.Decimal(10, 2)
  allowances       Json?
  deductions       Json?
  netSalary        Decimal       @db.Decimal(10, 2)
  status           PayrollStatus @default(DRAFT)
  generatedAt      DateTime      @default(now())
  generatedBy      String?
  paidAt           DateTime?
  paymentReference String?
  reference        String?
  notes            String?
  workedDays       Int           @default(0)
  workedMinutes    Int           @default(0)
  user             User          @relation(fields: [userId], references: [id])

  @@unique([userId, month, year])
  @@index([userId])
  @@index([month, year])
  @@map("payroll_records")
}

### 3. ADD these two new models AFTER the PayrollRecord model:

model StaffAllowance {
  id        String   @id @default(uuid())
  userId    String
  type      String   // HOUSE | TRAVEL | MEDICAL | COMMUTER | OTHER
  label     String
  amount    Decimal  @db.Decimal(10, 2)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("staff_allowances")
}

model StaffDeduction {
  id            String   @id @default(uuid())
  userId        String
  type          String   // LOAN | SACCO | ADVANCE | UNIFORM | OTHER
  label         String
  amount        Decimal  @db.Decimal(10, 2)
  isRecurring   Boolean  @default(true)
  totalMonths   Int      @default(0)
  monthsApplied Int      @default(0)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("staff_deductions")
}

const fs = require('fs');
const content = `

// ============================================================================
// TERTIARY MODULE ENUMS & MODELS
// ============================================================================

enum TertiaryLevel {
  CERTIFICATE
  DIPLOMA
  DEGREE
  POSTGRADUATE
}

model TertiaryDepartment {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  headOfDept  String?
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  programs    TertiaryProgram[]
  units       TertiaryUnit[]
}

model TertiaryProgram {
  id           String             @id @default(uuid())
  code         String             @unique
  name         String
  level        TertiaryLevel
  departmentId String
  department   TertiaryDepartment @relation(fields: [departmentId], references: [id])
  durationYears Int               @default(4)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
}

model TertiaryUnit {
  id          String   @id @default(uuid())
  code        String   @unique  // e.g. BIT 101
  name        String
  creditHours Int      @default(3)
  year        Int
  semester    Int
  departmentId String
  department   TertiaryDepartment @relation(fields: [departmentId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  enrollments  UnitEnrollment[]
  results      UnitResult[]
}

model UnitEnrollment {
  id        String   @id @default(uuid())
  studentId String
  unitId    String
  semester  Int
  year      Int
  createdAt DateTime @default(now())
  
  unit      TertiaryUnit @relation(fields: [unitId], references: [id])
}

model UnitResult {
  id          String   @id @default(uuid())
  studentId   String
  unitId      String
  cats        Float  // Continuous Assessment Tests (30%)
  exam        Float  // Final Exam (70%)
  total       Float
  grade       String // A, B+, B, C+, C, D+, D, E
  gradePoints Float  // GPA points
  semester    Int
  year        Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  unit        TertiaryUnit @relation(fields: [unitId], references: [id])
}
`;

fs.appendFileSync('server/prisma/schema.prisma', content, 'utf8');
console.log('Appended successfully');

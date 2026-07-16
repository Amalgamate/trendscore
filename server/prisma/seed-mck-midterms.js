const fs = require('fs');
const path = require('path');
const ExcelJS = require('c:/Amalgamate/Projects/TrendSCORE/node_modules/exceljs');
const { PrismaClient, TestStatus, ModerationStatus, AssessmentStatus, CurriculumType, SummativeTestType } = require('c:/Amalgamate/Projects/TrendSCORE/server/node_modules/@prisma/client');

const prisma = new PrismaClient();
const MCK_DIR = 'c:/Amalgamate/Projects/TrendSCORE/mck';

const ACADEMIC_YEAR = 2026;
const TERM = 'TERM_2';
const TEST_TYPE = 'MID_TERM';

const subjectMap = {
    preprimary: {
        'MATH': 'Mathematical Activities',
        'MATHS': 'Mathematical Activities',
        'LANG': 'Language Activities',
        'LANGU': 'Language Activities',
        'LANGUAGE': 'Language Activities',
        'READ': 'Language Activities',
        'READING': 'Language Activities',
        'READING ': 'Language Activities',
        'ENV': 'Environmental Activities',
        'ENVIRO': 'Environmental Activities',
        'ENVIR': 'Environmental Activities',
        '  I. L.A': 'Environmental Activities',
        'I. L.A': 'Environmental Activities',
        'INTERGRATED': 'Environmental Activities',
        'CREAT': 'Creative Activities',
        'C/ART': 'Creative Activities',
        'C/ARTS': 'Creative Activities',
        'C/A': 'Creative Activities',
        'CREA': 'Creative Activities',
        'REL': 'Religious Activities',
        'CRE': 'Religious Activities',
        'C. R. E': 'Religious Activities',
        ' C. R. E': 'Religious Activities',
        'KISWA': 'Kiswahili',
        'KUSOMA': 'Kiswahili',
        'KUSOMA ': 'Kiswahili'
    },
    primary: {
        'MATH': 'Mathematical Activities',
        'MATHS': 'Mathematical Activities',
        'MATH ': 'Mathematical Activities',
        'ENG': 'English',
        'ENGLISH': 'English',
        'ENGLISH ': 'English',
        'ENG ': 'English',
        'KISW': 'Kiswahili',
        'KISWA': 'Kiswahili',
        'KISW ': 'Kiswahili',
        'ENV': 'Environmental Activities',
        'ENVIR': 'Environmental Activities',
        'ENV ': 'Environmental Activities',
        'SCIE': 'Science and Technology',
        'SCI': 'Science and Technology',
        'S/S': 'Social Studies',
        'AGR': 'Agriculture',
        'C/ART': 'Creative Activities',
        'C/ARTS': 'Creative Activities',
        'C/A': 'Creative Activities',
        'CRE': 'Religious Education',
        'C. R. E': 'Religious Education',
        'C .R. E': 'Religious Education',
        'CRE ': 'Religious Education',
        'NULL_COLUMN_C_G6': 'Mathematics'
    }
};

function normalizeName(str) {
    if (!str) return '';
    return str.toString()
        .replace(/[\s\u00a0]+/g, ' ')
        .trim()
        .toUpperCase();
}

function isHeaderRow(rowValues) {
    if (!rowValues || rowValues.length < 2) return false;
    const joined = rowValues.map(v => normalizeName(v)).join(' ');
    return (joined.includes('NAME') || joined.includes('NAMES')) &&
           (joined.includes('MATH') || joined.includes('ENG') || joined.includes('KISW') || joined.includes('LANG'));
}

function calculateGrade(marks) {
    if (marks >= 80) return 'A';
    if (marks >= 60) return 'B';
    if (marks >= 50) return 'C';
    if (marks >= 40) return 'D';
    return 'E';
}

function calculateStatus(marks) {
    return marks >= 40 ? TestStatus.PASS : TestStatus.FAIL;
}

// Map grade enums
const gradeMapping = {
    'PLAYGROUP': 'PLAYGROUP',
    'PP1': 'PP1',
    'PP2': 'PP2',
    'GRADE_1': 'GRADE_1',
    'GRADE_2': 'GRADE_2',
    'GRADE_3': 'GRADE_3',
    'GRADE_4': 'GRADE_4',
    'GRADE_6': 'GRADE_6'
};

async function parseSheet(filePath, sheetName, expectedGrade) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = sheetName ? workbook.worksheets.find(w => w.name === sheetName) : workbook.worksheets[0];
    if (!sheet || sheet.rowCount === 0) return null;

    const allRows = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
        allRows.push({ rowNumber, values: vals });
    });

    let headerRowIndex = -1;
    let headers = [];
    for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        if (isHeaderRow(row.values)) {
            headerRowIndex = row.rowNumber;
            headers = row.values.map(v => v !== null && typeof v === 'object' ? (v.text || JSON.stringify(v)) : v);
            break;
        }
    }

    if (headerRowIndex === -1 && filePath.includes('PP1 B')) {
        for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            const joined = row.values.map(v => normalizeName(v)).join(' ');
            if (joined.includes('MATH') && (joined.includes('LANG') || joined.includes('READ'))) {
                headerRowIndex = row.rowNumber;
                headers = row.values.map((v, idx) => idx === 1 ? 'NAMES' : (v !== null && typeof v === 'object' ? (v.text || JSON.stringify(v)) : v));
                break;
            }
        }
    }

    if (headerRowIndex === -1) {
        console.warn(`Could not find header row in ${filePath} (Sheet: ${sheet.name})`);
        return null;
    }

    let nameColIndex = headers.findIndex(h => {
        const nh = normalizeName(h);
        return nh === 'NAMES' || nh === 'NAME' || nh === 'NAMES ';
    });

    if (nameColIndex === -1) {
        nameColIndex = 1;
    }

    const students = [];
    for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        if (row.rowNumber <= headerRowIndex) continue;

        const vals = row.values;
        if (!vals || vals.length === 0) continue;

        const nameVal = vals[nameColIndex]?.toString().trim();
        const normalizedName = normalizeName(nameVal);

        if (!normalizedName || ['TOTAL', 'TOTALS', 'POSITION', 'AVERAGE', 'MEAN SCORE', 'MEAN SCORES', 'SUB RANK', 'SUB  RANK', 'SUBRANK'].includes(normalizedName)) {
            continue;
        }

        const scores = {};
        headers.forEach((header, colIdx) => {
            const normalizedHeader = normalizeName(header);
            if (!normalizedHeader) {
                if (filePath.includes('GRADE 6') && colIdx === 2) {
                    const score = parseInt(vals[colIdx]);
                    if (!isNaN(score)) {
                        scores['NULL_COLUMN_C_G6'] = score;
                    }
                }
                return;
            }

            if (!['NAMES', 'NAME', 'NAMES ', 'S/N', 'SN', 'NO', 'NO.', 'TOTAL', 'TOTALS', 'POSITION', 'POS', 'POST', 'MEAN SCORE', 'MEAN SCORES', 'SUB RANK', 'SUBRANK', 'SUB  RANK'].includes(normalizedHeader)) {
                const score = parseInt(vals[colIdx]);
                if (!isNaN(score)) {
                    scores[header] = score;
                }
            }
        });

        students.push({
            name: nameVal,
            scores
        });
    }

    return {
        headers,
        students
    };
}

async function main() {
    console.log('🚀 Starting Midterm Exam Results Seeding...');

    // 1. Fetch Admin user for recording
    const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN', archived: false }
    }) || await prisma.user.findFirst({
        where: { archived: false }
    });

    if (!admin) {
        console.error('❌ No active user found in the database to act as grader!');
        return;
    }
    console.log(`👤 Using user: ${admin.firstName} ${admin.lastName} (${admin.id})`);

    // 2. Fetch all database learners and index by normalized name
    const allDbLearners = await prisma.learner.findMany({ where: { archived: false } });
    const dbLearnersByName = new Map();
    allDbLearners.forEach(l => {
        const fullParts = [l.firstName, l.middleName, l.lastName].filter(Boolean);
        const nameKey = normalizeName(fullParts.join(' '));
        if (!dbLearnersByName.has(nameKey)) {
            dbLearnersByName.set(nameKey, []);
        }
        dbLearnersByName.get(nameKey).push(l);

        const firstLastKey = normalizeName(`${l.firstName} ${l.lastName}`);
        if (firstLastKey !== nameKey) {
            if (!dbLearnersByName.has(firstLastKey)) {
                dbLearnersByName.set(firstLastKey, []);
            }
            dbLearnersByName.get(firstLastKey).push(l);
        }
    });

    // 3. Fetch all LearningAreas
    const learningAreas = await prisma.learningArea.findMany({
        where: { institutionType: 'PRIMARY_CBC' }
    });

    const filesToProcess = [
        { filename: '1B_014939.xlsx', sheet: 'Sheet1', grade: 'GRADE_1', stream: 'B' },
        { filename: 'G4A  Midterm term2 2026.xlsx', sheet: '4A', grade: 'GRADE_4', stream: 'A' },
        { filename: 'GRADE 2B RESULTS.xlsx', sheet: 'Sheet1', grade: 'GRADE_2', stream: 'B' },
        { filename: 'GRADE 3AMID TERM EXAM_024959.xlsx', sheet: 'Sheet1', grade: 'GRADE_3', stream: 'A' },
        { filename: 'GRADE 6 TERM 2MID RESULTS.xlsx', sheet: 'Sheet1', grade: 'GRADE_6', stream: 'A' },
        { filename: 'MID-TERM EXAM.xlsx', sheet: 'Sheet1', grade: 'PLAYGROUP', stream: 'A' },
        { filename: 'P.G (B)MIDTERM 2ND TERM EXAM RESULTS.xlsx', sheet: 'Sheet1', grade: 'PLAYGROUP', stream: 'B' },
        { filename: 'PP1 B  MIDTERM EXAMS (1) (1) (2).xlsx', sheet: 'Sheet1', grade: 'PP1', stream: 'B' },
        { filename: 'PP2 (B) MIDTERM EXAM.xlsx', sheet: 'Sheet2', grade: 'PP2', stream: 'B' }
    ];

    let overallLearnersCreated = 0;
    let overallResultsCreated = 0;
    const initialMissingStudentsList = [];

    for (const fileInfo of filesToProcess) {
        const filePath = path.join(MCK_DIR, fileInfo.filename);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ File not found: ${filePath}, skipping...`);
            continue;
        }

        console.log(`\n📂 Processing ${fileInfo.filename} for Grade: ${fileInfo.grade} Stream: ${fileInfo.stream}`);
        const parsed = await parseSheet(filePath, fileInfo.sheet, fileInfo.grade);
        if (!parsed) continue;

        // Ensure class exists for 2026 Term 2
        let targetClass = await prisma.class.findFirst({
            where: {
                grade: fileInfo.grade,
                stream: fileInfo.stream,
                academicYear: ACADEMIC_YEAR,
                term: TERM
            }
        });

        if (!targetClass) {
            targetClass = await prisma.class.create({
                data: {
                    classCode: `${fileInfo.grade}-${fileInfo.stream}-${ACADEMIC_YEAR}-T2`,
                    name: `${fileInfo.grade.replace('_', ' ')} ${fileInfo.stream}`,
                    grade: fileInfo.grade,
                    stream: fileInfo.stream,
                    academicYear: ACADEMIC_YEAR,
                    term: TERM,
                    capacity: 45,
                    active: true
                }
            });
            console.log(`   ✅ Created class: ${targetClass.name} (Code: ${targetClass.classCode})`);
        }

        // Process students
        let fileStudentCount = 0;
        let fileResultsCount = 0;

        for (const student of parsed.students) {
            const normalizedName = normalizeName(student.name);
            let learner = null;

            // Lookup existing
            const matches = dbLearnersByName.get(normalizedName) || [];
            if (matches.length > 0) {
                learner = matches[0];
            } else {
                // Store in our missing list for final report
                initialMissingStudentsList.push({
                    name: student.name,
                    file: fileInfo.filename,
                    grade: fileInfo.grade,
                    stream: fileInfo.stream
                });

                // Create new learner
                // Calculate DOB based on grade
                let age = 6;
                if (fileInfo.grade === 'PLAYGROUP') age = 3;
                else if (fileInfo.grade === 'PP1') age = 4;
                else if (fileInfo.grade === 'PP2') age = 5;
                else if (fileInfo.grade === 'GRADE_1') age = 6;
                else if (fileInfo.grade === 'GRADE_2') age = 7;
                else if (fileInfo.grade === 'GRADE_3') age = 8;
                else if (fileInfo.grade === 'GRADE_4') age = 9;
                else if (fileInfo.grade === 'GRADE_6') age = 11;

                const dob = new Date();
                dob.setFullYear(dob.getFullYear() - age);

                // Split name
                const nameParts = student.name.trim().split(/\s+/);
                const firstName = nameParts[0] || 'Unknown';
                const lastName = nameParts[nameParts.length - 1] || 'Unknown';
                const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : null;

                const listSize = dbLearnersByName.size + 1;
                const admissionNumber = `MCK-${fileInfo.grade}-${listSize.toString().padStart(4, '0')}`;

                learner = await prisma.learner.create({
                    data: {
                        admissionNumber,
                        firstName,
                        lastName,
                        middleName,
                        dateOfBirth: dob,
                        gender: 'MALE',
                        grade: fileInfo.grade,
                        stream: fileInfo.stream,
                        status: 'ACTIVE',
                        admissionDate: new Date()
                    }
                });

                // Index in local mapping so we don't duplicate if student appears again
                dbLearnersByName.set(normalizedName, [learner]);
                overallLearnersCreated++;
                fileStudentCount++;
            }

            // Enroll student in class if not enrolled
            const enrollment = await prisma.classEnrollment.findFirst({
                where: { classId: targetClass.id, learnerId: learner.id }
            });

            if (!enrollment) {
                await prisma.classEnrollment.create({
                    data: {
                        classId: targetClass.id,
                        learnerId: learner.id,
                        active: true
                    }
                });
            }

            // Seed scores / results
            for (const [subjectCol, score] of Object.entries(student.scores)) {
                // Find database subject/LearningArea
                const isPrePrimary = ['PLAYGROUP', 'PP1', 'PP2'].includes(fileInfo.grade);
                const mappedSubjectName = isPrePrimary
                    ? subjectMap.preprimary[normalizeName(subjectCol)]
                    : subjectMap.primary[normalizeName(subjectCol)];

                let dbSubjectName = mappedSubjectName || subjectCol;
                // Post-process grades >= 4 for MATH and Creative Arts names
                if (!isPrePrimary) {
                    if (dbSubjectName === 'Mathematical Activities') dbSubjectName = 'Mathematics';
                    if (dbSubjectName === 'Creative Activities') dbSubjectName = 'Creative Arts';
                }

                // Look up LearningArea ID
                const learningAreaObj = learningAreas.find(la =>
                    la.gradeLevel === fileInfo.grade &&
                    normalizeName(la.name) === normalizeName(dbSubjectName)
                ) || learningAreas.find(la =>
                    normalizeName(la.name) === normalizeName(dbSubjectName)
                );

                const learningAreaId = learningAreaObj ? learningAreaObj.id : null;

                // Title customization to distinguish between Language & Reading if both exist
                let testTitle = `Term 2 Midterm - ${dbSubjectName}`;
                if (normalizeName(subjectCol) === 'READ' || normalizeName(subjectCol) === 'READING' || normalizeName(subjectCol) === 'READING ') {
                    testTitle = `Term 2 Midterm - Reading`;
                } else if (normalizeName(subjectCol) === 'KUSOMA' || normalizeName(subjectCol) === 'KUSOMA ') {
                    testTitle = `Term 2 Midterm - Kusoma`;
                } else if (normalizeName(subjectCol) === 'LANG' || normalizeName(subjectCol) === 'LANGU' || normalizeName(subjectCol) === 'LANGUAGE') {
                    testTitle = `Term 2 Midterm - Language`;
                }

                // Find or Create SummativeTest
                let test = await prisma.summativeTest.findFirst({
                    where: {
                        grade: fileInfo.grade,
                        learningArea: dbSubjectName,
                        term: TERM,
                        academicYear: ACADEMIC_YEAR,
                        testType: TEST_TYPE,
                        title: testTitle
                    }
                });

                if (!test) {
                    test = await prisma.summativeTest.create({
                        data: {
                            title: testTitle,
                            learningArea: dbSubjectName,
                            term: TERM,
                            academicYear: ACADEMIC_YEAR,
                            grade: fileInfo.grade,
                            testDate: new Date(),
                            totalMarks: 100,
                            passMarks: 40,
                            createdBy: admin.id,
                            published: true,
                            active: true,
                            status: AssessmentStatus.PUBLISHED,
                            curriculum: CurriculumType.CBC_AND_EXAM,
                            testType: SummativeTestType.MID_TERM,
                            learningAreaId: learningAreaId
                        }
                    });
                }

                // Upsert SummativeResult
                await prisma.summativeResult.upsert({
                    where: {
                        testId_learnerId: {
                            testId: test.id,
                            learnerId: learner.id
                        }
                    },
                    update: {
                        marksObtained: score,
                        percentage: score,
                        grade: calculateGrade(score),
                        status: calculateStatus(score),
                        recordedBy: admin.id
                    },
                    create: {
                        testId: test.id,
                        learnerId: learner.id,
                        marksObtained: score,
                        percentage: score,
                        grade: calculateGrade(score),
                        status: calculateStatus(score),
                        recordedBy: admin.id,
                        moderationStatus: ModerationStatus.APPROVED
                    }
                });

                fileResultsCount++;
                overallResultsCreated++;
            }
        }

        console.log(`   ✅ Processed: Created ${fileStudentCount} students, ${fileResultsCount} scores.`);
    }

    console.log('\n==================================================');
    console.log('Import Complete!');
    console.log(`Created ${overallLearnersCreated} new learners.`);
    console.log(`Created ${overallResultsCreated} test result scores.`);
    console.log(`Total students who were missing and got registered: ${initialMissingStudentsList.length}`);

    // Save report of missing students
    const reportPath = 'C:/Users/Ricos/.gemini/antigravity-ide/brain/120930c0-aa0e-4c81-a828-a0370f97aaf8/scratch/missing_students.json';
    fs.writeFileSync(reportPath, JSON.stringify(initialMissingStudentsList, null, 2));
    console.log(`List of missing students saved to ${reportPath}`);
}

main()
    .catch(err => console.error(err))
    .finally(() => prisma.$disconnect());

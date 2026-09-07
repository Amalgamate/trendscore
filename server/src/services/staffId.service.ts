import prisma from '../config/database';

/**
 * Generates a unique, human-readable staff number scoped per school
 * 
 * Format: STF-{SEQUENCE} (e.g., STF-0001, STF-0002)
 *
 * Uses database-level locking via transaction to prevent race conditions.
 * Ensures uniqueness against any existing manual entries in the database.
 */

/**
 * Generates a unique, incremental, collision-proof staff number.
 * 
 * Format: STF-{SEQUENCE} (e.g., STF-0001, STF-0002)
 */
export async function generateStaffId(): Promise<string> {
    try {
        let uniqueStaffId: string | null = null;

        // Loop until an unused staff ID is found (handles any manually-created legacy collision)
        while (!uniqueStaffId) {
            const result = await prisma.$transaction(async (tx) => {
                let sequence = await (tx as any).staffSequence.findFirst();

                if (!sequence) {
                    sequence = await (tx as any).staffSequence.create({
                        data: {
                            currentValue: 0
                        }
                    });
                }

                const updated = await (tx as any).staffSequence.update({
                    where: {
                        id: sequence.id
                    },
                    data: {
                        currentValue: {
                            increment: 1
                        }
                    }
                });

                return updated;
            });

            const paddedNumber = String(result.currentValue).padStart(4, '0');
            const candidate = `STF-${paddedNumber}`;

            // Verify not already taken by an existing user
            const existing = await prisma.user.findFirst({
                where: { staffId: candidate },
                select: { id: true }
            });

            if (!existing) {
                uniqueStaffId = candidate;
            }
        }

        console.log(`✓ Generated staff ID: ${uniqueStaffId}`);
        return uniqueStaffId;
    } catch (error) {
        console.error('✗ Error generating staff ID:', error);
        throw error;
    }
}

/**
 * Previews the next staff ID without incrementing the sequence counter.
 * Useful for frontend form previews.
 */
export async function getNextStaffIdPreview(): Promise<string> {
    try {
        const sequence = await (prisma as any).staffSequence.findFirst();
        let nextVal = (sequence?.currentValue || 0) + 1;

        // Ensure preview doesn't show a number that is already used
        while (true) {
            const candidate = `STF-${String(nextVal).padStart(4, '0')}`;
            const existing = await prisma.user.findFirst({
                where: { staffId: candidate },
                select: { id: true }
            });
            if (!existing) {
                return candidate;
            }
            nextVal++;
        }
    } catch (error) {
        console.error('✗ Error previewing next staff ID:', error);
        return 'STF-0001';
    }
}

/**
 * Gets the current sequence value
 */
export async function getCurrentStaffSequenceValue(): Promise<number | null> {
    try {
        const sequence = await (prisma as any).staffSequence.findFirst();
        if (!sequence) return null;
        return sequence.currentValue;
    } catch (error) {
        console.error('✗ Error fetching current staff sequence value:', error);
        throw error;
    }
}

/**
 * Resets the staff sequence. Use with caution.
 */
export async function resetStaffSequence(newValue: number = 0): Promise<void> {
    try {
        const sequence = await (prisma as any).staffSequence.findFirst();

        if (sequence) {
            await (prisma as any).staffSequence.update({
                where: { id: sequence.id },
                data: { currentValue: newValue }
            });
        } else {
            await (prisma as any).staffSequence.create({
                data: { currentValue: newValue }
            });
        }

        console.log(`✓ Staff sequence reset to ${newValue}`);
    } catch (error) {
        console.error('✗ Error resetting staff sequence:', error);
        throw error;
    }
}

/**
 * Automatically assigns incremental employee numbers to any existing staff
 * (teachers, head teachers, etc.) that currently have no staffId assigned.
 * Sorts chronologically by createdAt so earliest joiners receive earlier IDs.
 */
export async function autoAssignMissingStaffIds(): Promise<{
    count: number;
    assigned: Array<{ id: string; name: string; staffId: string }>;
}> {
    try {
        const staffRoles = ['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'];

        const unassignedUsers = await prisma.user.findMany({
            where: {
                role: { in: staffRoles as any },
                OR: [
                    { staffId: null },
                    { staffId: '' }
                ]
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true
            }
        });

        const assigned: Array<{ id: string; name: string; staffId: string }> = [];

        for (const user of unassignedUsers) {
            const newStaffId = await generateStaffId();
            await prisma.user.update({
                where: { id: user.id },
                data: { staffId: newStaffId }
            });
            assigned.push({
                id: user.id,
                name: `${user.firstName} ${user.lastName}`.trim(),
                staffId: newStaffId
            });
        }

        console.log(`✓ Auto-assigned ${assigned.length} missing staff IDs`);
        return { count: assigned.length, assigned };
    } catch (error) {
        console.error('✗ Error auto-assigning missing staff IDs:', error);
        throw error;
    }
}

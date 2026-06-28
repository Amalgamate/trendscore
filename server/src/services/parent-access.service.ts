import prisma from '../config/database';

const ACTIVE = 'ACTIVE';

const isMissingFamilyTableError = (error: unknown): boolean => {
  const maybeError = error as { code?: string; meta?: { table?: string; modelName?: string } };
  if (maybeError?.code !== 'P2021' && maybeError?.code !== 'P2022') return false;

  const table = String(maybeError.meta?.table || maybeError.meta?.modelName || '');
  return table.includes('family') || table.includes('Family');
};

export class ParentAccessService {
  async getAccessibleLearnerIds(parentUserId: string): Promise<string[]> {
    const directLearners = await prisma.learner.findMany({
      where: { parentId: parentUserId, archived: false },
      select: { id: true },
    });

    const learnerIds = new Set(directLearners.map((learner) => learner.id));

    try {
      const familyMember = await prisma.familyMember.findUnique({
        where: { userId: parentUserId },
        select: {
          status: true,
          canLogin: true,
          canViewReports: true,
          familyAccount: {
            select: {
              status: true,
              archived: true,
              learners: {
                select: { learnerId: true },
              },
            },
          },
        },
      });

      const canUseFamilyAccess =
        familyMember?.status === ACTIVE &&
        familyMember.canLogin !== false &&
        familyMember.canViewReports !== false &&
        familyMember.familyAccount?.status === ACTIVE &&
        familyMember.familyAccount.archived === false;

      if (canUseFamilyAccess) {
        familyMember.familyAccount.learners.forEach((link) => learnerIds.add(link.learnerId));
      }
    } catch (error) {
      if (!isMissingFamilyTableError(error)) throw error;
    }

    return [...learnerIds];
  }

  async canAccessLearner(parentUserId: string, learnerId: string): Promise<boolean> {
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { id: true, parentId: true, archived: true },
    });

    if (!learner || learner.archived) return false;
    if (learner.parentId === parentUserId) return true;

    try {
      const familyMember = await prisma.familyMember.findUnique({
        where: { userId: parentUserId },
        select: {
          status: true,
          canLogin: true,
          canViewReports: true,
          familyAccount: {
            select: {
              status: true,
              archived: true,
              learners: {
                where: { learnerId },
                select: { learnerId: true },
              },
            },
          },
        },
      });

      return Boolean(
        familyMember?.status === ACTIVE &&
        familyMember.canLogin !== false &&
        familyMember.canViewReports !== false &&
        familyMember.familyAccount?.status === ACTIVE &&
        familyMember.familyAccount.archived === false &&
        familyMember.familyAccount.learners.some((link) => link.learnerId === learnerId)
      );
    } catch (error) {
      if (isMissingFamilyTableError(error)) return false;
      throw error;
    }
  }
}

export const parentAccessService = new ParentAccessService();

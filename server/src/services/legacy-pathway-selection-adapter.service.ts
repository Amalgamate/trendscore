import { PrismaClient } from '@prisma/client';
import { AMBIGUOUS_ALIASES } from './senior-pathway-catalog.data';

export type LegacySelectionPreview = {
  learnerId: string;
  legacyPathwayId: string | null;
  mappedSubjects: Array<{
    legacyLearningAreaId: string;
    legacyName: string;
    officialLearningAreaId: string;
    officialName: string;
    subjectType: string;
  }>;
  unmappedSubjects: Array<{
    legacyLearningAreaId: string;
    legacyName: string;
    reason: string;
  }>;
  warnings: string[];
};

export async function previewLegacyPathwaySelection(
  prisma: PrismaClient,
  learnerId: string
): Promise<LegacySelectionPreview> {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: {
      id: true,
      pathwayId: true,
      subjectSelections: {
        where: { active: true },
        select: {
          learningArea: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!learner) {
    return {
      learnerId,
      legacyPathwayId: null,
      mappedSubjects: [],
      unmappedSubjects: [{ legacyLearningAreaId: '', legacyName: '', reason: 'Learner not found' }],
      warnings: [],
    };
  }

  const aliases = await prisma.learningAreaAlias.findMany({
    where: {
      alias: { in: learner.subjectSelections.map((selection) => selection.learningArea.name) },
      active: true,
    },
    select: {
      alias: true,
      officialLearningArea: {
        select: {
          id: true,
          officialName: true,
          subjectType: true,
        },
      },
    },
  });

  const aliasMap = new Map(aliases.map((alias) => [alias.alias.toLowerCase(), alias.officialLearningArea]));
  const mappedSubjects: LegacySelectionPreview['mappedSubjects'] = [];
  const unmappedSubjects: LegacySelectionPreview['unmappedSubjects'] = [];
  const warnings: string[] = [];

  for (const selection of learner.subjectSelections) {
    const legacyName = selection.learningArea.name;
    if (AMBIGUOUS_ALIASES.has(legacyName)) {
      unmappedSubjects.push({
        legacyLearningAreaId: selection.learningArea.id,
        legacyName,
        reason: 'Ambiguous legacy subject requires manual mapping',
      });
      continue;
    }

    const official = aliasMap.get(legacyName.toLowerCase());
    if (!official) {
      unmappedSubjects.push({
        legacyLearningAreaId: selection.learningArea.id,
        legacyName,
        reason: 'No official learning-area alias found',
      });
      continue;
    }

    if (official.subjectType === 'SUPPORT_SUBJECT') {
      warnings.push(`${legacyName} maps to support subject ${official.officialName}, not an examinable subject.`);
    }

    mappedSubjects.push({
      legacyLearningAreaId: selection.learningArea.id,
      legacyName,
      officialLearningAreaId: official.id,
      officialName: official.officialName,
      subjectType: official.subjectType,
    });
  }

  return {
    learnerId,
    legacyPathwayId: learner.pathwayId,
    mappedSubjects,
    unmappedSubjects,
    warnings,
  };
}

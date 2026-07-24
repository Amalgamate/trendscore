const clean = (value: unknown): string => String(value ?? '').trim();

export interface LearnerNameParts {
  rawName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}

export function buildLearnerNameParts(row: Record<string, unknown>): LearnerNameParts {
  const surname = clean(row['Surname']);
  const givenName = clean(row['First Name']);
  const otherNames = clean(row['Other Names']);

  if (surname || givenName || otherNames) {
    const rawName = [givenName, otherNames, surname].filter(Boolean).join(' ');

    if (surname) {
      return {
        rawName,
        firstName: givenName || otherNames || surname,
        middleName: givenName && otherNames ? otherNames : undefined,
        lastName: givenName || otherNames ? surname : '',
      };
    }

    if (givenName && otherNames) {
      return { rawName, firstName: givenName, lastName: otherNames };
    }

    const onlyName = givenName || otherNames;
    const parts = onlyName.split(/\s+/).filter(Boolean);
    return {
      rawName: onlyName,
      firstName: parts[0] || '',
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
      lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    };
  }

  const rawName = clean(row['Learner Name'] || row['Leaner Name'] || row['Name']);
  const parts = rawName.split(/\s+/).filter(Boolean);
  return {
    rawName,
    firstName: parts[0] || '',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

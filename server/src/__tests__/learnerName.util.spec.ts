import { buildLearnerNameParts } from '../utils/learnerName.util';

describe('buildLearnerNameParts', () => {
  it('uses the second supplied name when surname is blank', () => {
    expect(buildLearnerNameParts({ 'First Name': 'Hussein', 'Other Names': 'Ali', Surname: '' }))
      .toEqual({ rawName: 'Hussein Ali', firstName: 'Hussein', lastName: 'Ali' });
  });

  it('preserves first, other, and surname fields when all are supplied', () => {
    expect(buildLearnerNameParts({ 'First Name': 'Hussein', 'Other Names': 'Ali', Surname: 'Diba' }))
      .toEqual({ rawName: 'Hussein Ali Diba', firstName: 'Hussein', middleName: 'Ali', lastName: 'Diba' });
  });

  it('parses a full learner name without duplicating middle names', () => {
    expect(buildLearnerNameParts({ 'Learner Name': 'Hussein Ali Diba' }))
      .toEqual({ rawName: 'Hussein Ali Diba', firstName: 'Hussein', middleName: 'Ali', lastName: 'Diba' });
  });

  it('never manufactures Student when only one name is supplied', () => {
    expect(buildLearnerNameParts({ 'First Name': 'Hussein' }))
      .toEqual({ rawName: 'Hussein', firstName: 'Hussein', middleName: undefined, lastName: '' });
  });
});

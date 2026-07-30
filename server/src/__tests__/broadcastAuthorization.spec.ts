import { BROADCAST_MANAGER_ROLES } from '../config/permissions';
import { hasAnyRole } from '../utils/roleNormalizer';

describe('broadcast authorization contract', () => {
  test('Head of Curriculum can manage school broadcasts', () => {
    expect(
      hasAnyRole(
        { role: 'HEAD_OF_CURRICULUM', roles: ['HEAD_OF_CURRICULUM', 'TEACHER'] },
        BROADCAST_MANAGER_ROLES,
      ),
    ).toBe(true);
  });

  test('a teacher without a broadcast-management role cannot manage school broadcasts', () => {
    expect(hasAnyRole({ role: 'TEACHER', roles: ['TEACHER'] }, BROADCAST_MANAGER_ROLES)).toBe(false);
  });
});

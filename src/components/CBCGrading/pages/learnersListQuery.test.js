import { buildLearnerQueryParams } from './learnersListQuery';

describe('buildLearnerQueryParams', () => {
  it('returns the baseline learner query', () => {
    expect(
      buildLearnerQueryParams({
        page: 2,
        searchTerm: 'Amina',
        paginationLimit: 25,
      })
    ).toEqual({
      page: 2,
      search: 'Amina',
      limit: 25,
    });
  });

  it('includes only active filters', () => {
    expect(
      buildLearnerQueryParams({
        page: 1,
        searchTerm: '',
        paginationLimit: 50,
        filterGrade: ' GRADE_3 ',
        filterStatus: 'ACTIVE',
        filterStream: 'East',
      })
    ).toEqual({
      page: 1,
      search: '',
      limit: 50,
      grade: 'GRADE_3',
      status: 'ACTIVE',
      stream: 'East',
    });
  });

  it('omits stream filter when filterStream is all', () => {
    expect(
      buildLearnerQueryParams({
        page: 1,
        searchTerm: '',
        paginationLimit: 50,
        filterGrade: 'GRADE_5',
        filterStream: 'all',
      })
    ).toEqual({
      page: 1,
      search: '',
      limit: 50,
      grade: 'GRADE_5',
    });
  });
});

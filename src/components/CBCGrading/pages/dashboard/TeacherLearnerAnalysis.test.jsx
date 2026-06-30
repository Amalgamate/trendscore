import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import TeacherLearnerAnalysis from './TeacherLearnerAnalysis';

const { getTeacherMetrics } = vi.hoisted(() => ({
  getTeacherMetrics: vi.fn()
}));

const { getAllClassData } = vi.hoisted(() => ({
  getAllClassData: vi.fn()
}));

const { getLearners } = vi.hoisted(() => ({
  getLearners: vi.fn()
}));

const { rolePreviewState } = vi.hoisted(() => ({
  rolePreviewState: { isPreviewingRole: false }
}));

vi.mock('../../../../services/api', () => ({
  default: {
    classes: {
      getAllClassData
    },
    learners: {
      getAll: getLearners
    }
  },
  dashboardAPI: {
    getTeacherMetrics
  }
}));

vi.mock('../../../../contexts/RolePreviewContext', () => ({
  useRolePreview: () => rolePreviewState
}));

// Mock the CSS/Design System elements
vi.mock('@/design-system/components', () => ({
  EmptyState: ({ title, description, action }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <button onClick={action.onClick}>{action.label}</button>}
    </div>
  )
}));

describe('TeacherLearnerAnalysis', () => {
  const mockUser = { id: 'teacher-1', role: 'TEACHER', firstName: 'Jane', lastName: 'Doe' };
  
  const mockMetrics = {
    learnerAnalysis: {
      totalLearners: 45,
      totalClasses: 2,
      totalSubjects: 3,
      classes: [
        {
          classId: 'class-1',
          className: 'Grade 4 East',
          room: '10A',
          learnerCount: 25,
          subjects: [{ subject: 'Mathematics' }, { subject: 'Science' }]
        },
        {
          classId: 'class-2',
          className: 'Grade 5 West',
          room: '11B',
          learnerCount: 20,
          subjects: [{ subject: 'English' }]
        }
      ]
    },
    stats: {
      isClassTeacher: true,
      classTeacherOf: { id: 'class-1', name: 'Grade 4 East' }
    }
  };

  const mockClassData = {
    enrollments: [
      {
        learner: {
          id: 'learner-1',
          firstName: 'Amina',
          lastName: 'Ahmed',
          gender: 'FEMALE',
          admissionNumber: 'ADM001'
        }
      },
      {
        learner: {
          id: 'learner-2',
          firstName: 'Yusuf',
          lastName: 'Kamau',
          gender: 'MALE',
          admissionNumber: 'ADM002'
        }
      }
    ]
  };

  beforeEach(() => {
    rolePreviewState.isPreviewingRole = false;
    getTeacherMetrics.mockResolvedValue(mockMetrics);
    getAllClassData.mockResolvedValue(mockClassData);
    getLearners.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the two roster entry cards', async () => {
    render(<TeacherLearnerAnalysis user={mockUser} onNavigate={() => {}} />);

    // Loader is shown first
    expect(screen.getByText(/Loading your class analysis.../)).toBeTruthy();

    // Wait for metrics to load
    await waitFor(() => expect(screen.getByText('My Class')).toBeTruthy());
    expect(screen.getByText('My Subjects')).toBeTruthy();
    expect(screen.getByText('Grade 4 East student table')).toBeTruthy();
    expect(screen.getByText('Student tables')).toBeTruthy();
  });

  it('does not call teacher metrics while previewing a teacher role as super admin', async () => {
    rolePreviewState.isPreviewingRole = true;

    render(<TeacherLearnerAnalysis user={{ id: 'admin-1', role: 'SUPER_ADMIN' }} onNavigate={() => {}} />);

    await waitFor(() => expect(screen.getByText('My Class')).toBeTruthy());
    expect(getTeacherMetrics).not.toHaveBeenCalled();
  });

  it('opens the My Class student table', async () => {
    const onNavigateMock = vi.fn();
    render(<TeacherLearnerAnalysis user={mockUser} onNavigate={onNavigateMock} />);

    await waitFor(() => expect(screen.getByText('My Class')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /My Class/i }));

    await waitFor(() => expect(screen.getByPlaceholderText(/Search students by name or admission no.../i)).toBeTruthy());
    expect(screen.getByText('Amina Ahmed')).toBeTruthy();
    expect(screen.getByText('Yusuf Kamau')).toBeTruthy();

    // Filter by Girls
    const girlsButton = screen.getByRole('button', { name: /Girls ♀/i });
    fireEvent.click(girlsButton);
    expect(screen.queryByText('Yusuf Kamau')).toBeNull();
    expect(screen.getByText('Amina Ahmed')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /^View$/i })[0]);
    expect(onNavigateMock).toHaveBeenCalledWith('learner-profile', {
      learner: mockClassData.enrollments[0].learner
    });
  });

  it('falls back to grade and stream learners when class enrollments are empty', async () => {
    getTeacherMetrics.mockResolvedValue({
      ...mockMetrics,
      learnerAnalysis: {
        ...mockMetrics.learnerAnalysis,
        classes: [
          {
            classId: 'class-7a',
            className: 'GRADE 7 A',
            grade: 'GRADE_7',
            stream: 'A',
            learnerCount: 18,
            subjects: [{ subject: 'Mathematics' }]
          }
        ]
      }
    });
    getAllClassData.mockResolvedValue({
      data: {
        id: 'class-7a',
        grade: 'GRADE_7',
        stream: 'A',
        enrollments: []
      }
    });
    getLearners.mockResolvedValue({
      data: [
        {
          id: 'learner-7a-1',
          firstName: 'Zuleka',
          lastName: 'Issack',
          gender: 'FEMALE',
          admissionNumber: '999'
        }
      ]
    });

    render(<TeacherLearnerAnalysis user={mockUser} onNavigate={() => {}} />);

    await waitFor(() => expect(screen.getByText('My Subjects')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /My Subjects/i }));

    await waitFor(() => expect(screen.getByText('Zuleka Issack')).toBeTruthy());
    expect(screen.getByText('GRADE 7 A')).toBeTruthy();
    expect(getLearners).toHaveBeenCalledWith({
      grade: 'GRADE_7',
      stream: 'A',
      status: 'ACTIVE',
      page: 1,
      limit: 500
    });
  });
});

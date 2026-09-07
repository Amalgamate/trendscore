import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HorizontalSubmenu from './HorizontalSubmenu';

const mockNavSections = [
  {
    id: 'learners',
    label: 'Scholars',
    items: [
      { id: 'learners-list', label: 'Students List', path: 'learners-list' },
      { id: 'learners-admissions', label: 'Admissions', path: 'learners-admissions' },
    ],
  },
  {
    id: 'teachers',
    label: 'Tutors',
    items: [
      { id: 'teachers-list', label: 'Tutors List', path: 'teachers-list' },
      { id: 'tutors-directory', label: 'Staff Directory', path: 'hr-staff-profiles', params: { from: 'tutors' } },
      { id: 'tutors-duty-roster', label: 'Duty Roster', path: 'planner-duty-roster', params: { from: 'tutors' } },
      { id: 'tutors-timetable', label: 'Timetable', path: 'planner-timetable', params: { from: 'tutors' } },
      { id: 'tutors-analysis', label: 'Learner Analysis', path: 'teacher-learner-analysis', params: { from: 'tutors' } },
    ],
  },
  {
    id: 'planner',
    label: 'Planner',
    items: [
      { id: 'planner-timetable', label: 'Timetable', path: 'planner-timetable' },
      { id: 'planner-duty-roster', label: 'Duty Roster', path: 'planner-duty-roster' },
    ],
  },
];

vi.mock('../hooks/useNavigation', () => ({
  useNavigation: () => ({
    navSections: mockNavSections,
  }),
}));

describe('HorizontalSubmenu - Tutors Module', () => {
  it('renders all tutor horizontal menu items when on teachers-list', () => {
    const handleNavigate = vi.fn();
    render(
      <HorizontalSubmenu
        currentPage="teachers-list"
        pageParams={{}}
        onNavigate={handleNavigate}
      />
    );

    // Section label
    expect(screen.getByText('Tutors')).toBeDefined();

    // Tabs
    expect(screen.getByText('Tutors List')).toBeDefined();
    expect(screen.getByText('Staff Directory')).toBeDefined();
    expect(screen.getByText('Duty Roster')).toBeDefined();
    expect(screen.getByText('Timetable')).toBeDefined();
    expect(screen.getByText('Learner Analysis')).toBeDefined();

    // Add Tutor action button
    const addButton = screen.getByRole('button', { name: /Add Tutor/i });
    expect(addButton).toBeDefined();

    // Click Add Tutor
    fireEvent.click(addButton);
    expect(handleNavigate).toHaveBeenCalledWith('add-teacher');
  });

  it('navigates with correct parameters when clicking tabs in tutors menu', () => {
    const handleNavigate = vi.fn();
    render(
      <HorizontalSubmenu
        currentPage="teachers-list"
        pageParams={{}}
        onNavigate={handleNavigate}
      />
    );

    fireEvent.click(screen.getByText('Duty Roster'));
    expect(handleNavigate).toHaveBeenCalledWith('planner-duty-roster', { from: 'tutors' });

    fireEvent.click(screen.getByText('Staff Directory'));
    expect(handleNavigate).toHaveBeenCalledWith('hr-staff-profiles', { from: 'tutors' });
  });

  it('keeps the tutors horizontal menu visible and active when viewing teacher-profile or add-teacher', () => {
    const handleNavigate = vi.fn();
    const { unmount } = render(
      <HorizontalSubmenu
        currentPage="teacher-profile"
        pageParams={{ teacher: { id: 't1', name: 'John Doe' } }}
        onNavigate={handleNavigate}
      />
    );

    expect(screen.getByText('Tutors')).toBeDefined();
    expect(screen.getByText('Tutors List')).toBeDefined();
    expect(screen.getByText('Duty Roster')).toBeDefined();

    unmount();

    render(
      <HorizontalSubmenu
        currentPage="add-teacher"
        pageParams={{}}
        onNavigate={handleNavigate}
      />
    );

    expect(screen.getByText('Tutors')).toBeDefined();
    expect(screen.getByText('Tutors List')).toBeDefined();
  });

  it('preserves tutors section context when page has { from: "tutors" } parameter', () => {
    const handleNavigate = vi.fn();
    render(
      <HorizontalSubmenu
        currentPage="planner-duty-roster"
        pageParams={{ from: 'tutors' }}
        onNavigate={handleNavigate}
      />
    );

    // Should stay in Tutors section instead of falling back to Planner
    expect(screen.getByText('Tutors')).toBeDefined();
    expect(screen.getByText('Staff Directory')).toBeDefined();
    expect(screen.getByText('Duty Roster')).toBeDefined();
  });
});

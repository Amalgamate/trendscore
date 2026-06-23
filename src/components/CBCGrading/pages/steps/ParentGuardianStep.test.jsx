import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ParentGuardianStep from './ParentGuardianStep';

const { getAllParents } = vi.hoisted(() => ({
  getAllParents: vi.fn()
}));

vi.mock('../../../../services/api/parent.api', () => ({
  parentAPI: {
    getAll: getAllParents
  }
}));

const StatefulStep = ({ initialData }) => {
  const [formData, setFormData] = React.useState(initialData);

  return (
    <div>
      <ParentGuardianStep formData={formData} onChange={setFormData} />
      <pre data-testid="form-state">{JSON.stringify(formData)}</pre>
    </div>
  );
};

describe('ParentGuardianStep', () => {
  beforeEach(() => {
    getAllParents.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'parent-1',
          firstName: 'Jane',
          lastName: 'Doe',
          phone: '0712345678',
          email: '0712345678@trendscore.co.ke'
        }
      ]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searches existing parents, fills editable fields, and unlinks after manual edits', async () => {
    render(
      <StatefulStep
        initialData={{
          fatherName: '',
          fatherPhone: '',
          fatherEmail: '',
          motherName: '',
          motherPhone: '',
          motherEmail: '',
          guardianName: '',
          guardianPhone: '',
          guardianEmail: '',
          guardianRelation: '',
          primaryContactType: 'FATHER',
          primaryContactName: '',
          primaryContactPhone: '',
          primaryContactEmail: '',
          parentId: ''
        }}
      />
    );

    const searchInputs = screen.getAllByPlaceholderText(/type .* name to find an existing record/i);
    fireEvent.change(searchInputs[0], { target: { value: 'Jane Doe' } });

    await waitFor(() => expect(getAllParents).toHaveBeenCalledWith({ search: 'Jane', page: 1, limit: 25 }));
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeTruthy());

    fireEvent.mouseDown(screen.getByText('Jane Doe'));

    await waitFor(() => expect(screen.getByDisplayValue('Jane')).toBeTruthy());
    expect(screen.getByDisplayValue('Doe')).toBeTruthy();
    expect(screen.getByDisplayValue('0712345678')).toBeTruthy();
    expect(screen.getByText(/linked to existing parent account/i)).toBeTruthy();
    expect(screen.getByTestId('form-state').textContent).toContain('"parentId":"parent-1"');

    fireEvent.change(screen.getByDisplayValue('0712345678'), { target: { value: '0799999999' } });

    await waitFor(() => expect(screen.queryByText(/linked to existing parent account/i)).toBeNull());
    expect(screen.getByTestId('form-state').textContent).toContain('"parentId":""');
  }, 10000);
});

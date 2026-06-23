import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Search } from 'lucide-react';
import { parentAPI } from '../../../../services/api/parent.api';

const CONTACTS = [
  {
    key: 'FATHER',
    label: 'Father',
    nameField: 'fatherName',
    phoneField: 'fatherPhone',
    emailField: 'fatherEmail',
    deceasedField: 'fatherDeceased'
  },
  {
    key: 'MOTHER',
    label: 'Mother',
    nameField: 'motherName',
    phoneField: 'motherPhone',
    emailField: 'motherEmail',
    deceasedField: 'motherDeceased'
  },
  {
    key: 'GUARDIAN',
    label: 'Guardian',
    nameField: 'guardianName',
    phoneField: 'guardianPhone',
    emailField: 'guardianEmail',
    relationField: 'guardianRelation'
  }
];

const buildLookupDefaults = () =>
  CONTACTS.reduce((acc, contact) => {
    acc[contact.key] = {
      query: '',
      loading: false,
      open: false,
      results: [],
      selectedParent: null
    };
    return acc;
  }, {});

const normalizeSearchValue = (value = '') => String(value || '').trim().toLowerCase();

const parentMatchesQuery = (parent, query) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const fullName = normalizeSearchValue([parent.firstName, parent.lastName].filter(Boolean).join(' '));
  const email = normalizeSearchValue(parent.email);
  const phone = normalizeSearchValue(parent.phone);

  return tokens.every(
    (token) => fullName.includes(token) || email.includes(token) || phone.includes(token)
  );
};

const ParentGuardianStep = ({ formData = {}, onChange }) => {
  const [lookups, setLookups] = useState(buildLookupDefaults);
  const update = (patch) => onChange({ ...formData, ...patch });

  const selectedParentId = formData.parentId || '';
  const fatherLookupQuery = lookups.FATHER?.query || '';
  const motherLookupQuery = lookups.MOTHER?.query || '';
  const guardianLookupQuery = lookups.GUARDIAN?.query || '';

  const splitNameParts = (fullName = '') => {
    const tokens = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { first: '', middle: '', last: '' };
    if (tokens.length === 1) return { first: tokens[0], middle: '', last: '' };
    if (tokens.length === 2) return { first: tokens[0], middle: '', last: tokens[1] };
    return {
      first: tokens[0],
      middle: tokens.slice(1, -1).join(' '),
      last: tokens[tokens.length - 1]
    };
  };

  const composeName = (first = '', middle = '', last = '') => [first, middle, last].filter(Boolean).join(' ').trim();

  const buildLinkedParentPatch = (contact, parent) => {
    const parentName = composeName(parent.firstName, '', parent.lastName);
    const patch = {
      [contact.nameField]: parentName,
      [contact.phoneField]: parent.phone || '',
      [contact.emailField]: parent.email || '',
      parentId: parent.id
    };

    if (contact.relationField && !formData[contact.relationField]) {
      patch[contact.relationField] = 'Parent';
    }

    if (formData.primaryContactType === contact.key) {
      patch.primaryContactName = parentName;
      patch.primaryContactPhone = parent.phone || '';
      patch.primaryContactEmail = parent.email || '';
    }

    return patch;
  };

  const clearSelectedParentIfNeeded = (contact, nextValue, field) => {
    const linkedParent = lookups[contact.key]?.selectedParent;
    if (!linkedParent || selectedParentId !== linkedParent.id) return {};

    const linkedValues = {
      [contact.nameField]: composeName(linkedParent.firstName, '', linkedParent.lastName),
      [contact.phoneField]: linkedParent.phone || '',
      [contact.emailField]: linkedParent.email || ''
    };

    if ((linkedValues[field] || '') === (nextValue || '')) return {};

    setLookups((prev) => ({
      ...prev,
      [contact.key]: {
        ...prev[contact.key],
        selectedParent: null
      }
    }));

    return { parentId: '' };
  };

  const setPrimaryContact = (contact) => {
    const name = formData[contact.nameField] || '';
    const phone = formData[contact.phoneField] || '';
    const email = formData[contact.emailField] || '';
    update({
      primaryContactType: contact.key,
      primaryContactName: name,
      primaryContactPhone: phone,
      primaryContactEmail: email
    });
  };

  const clearPrimaryContact = () => {
    update({
      primaryContactType: '',
      primaryContactName: '',
      primaryContactPhone: '',
      primaryContactEmail: ''
    });
  };

  const handleFieldChange = (field, value) => {
    const contact = CONTACTS.find(
      (entry) =>
        field === entry.nameField ||
        field === entry.phoneField ||
        field === entry.emailField
    );
    const unlinkPatch = contact ? clearSelectedParentIfNeeded(contact, value, field) : {};
    const next = { ...formData, ...unlinkPatch, [field]: value };
    const selected = CONTACTS.find((c) => c.key === formData.primaryContactType);
    if (selected && (field === selected.nameField || field === selected.phoneField || field === selected.emailField)) {
      onChange({
        ...next,
        primaryContactName: next[selected.nameField] || '',
        primaryContactPhone: next[selected.phoneField] || '',
        primaryContactEmail: next[selected.emailField] || ''
      });
      return;
    }
    onChange(next);
  };

  const handleLookupInputChange = (contactKey, value) => {
    setLookups((prev) => ({
      ...prev,
      [contactKey]: {
        ...prev[contactKey],
        query: value,
        open: true
      }
    }));
  };

  const handleLookupFocus = (contactKey) => {
    setLookups((prev) => ({
      ...prev,
      [contactKey]: {
        ...prev[contactKey],
        open: true
      }
    }));
  };

  const handleLookupBlur = (contactKey) => {
    window.setTimeout(() => {
      setLookups((prev) => ({
        ...prev,
        [contactKey]: {
          ...prev[contactKey],
          open: false
        }
      }));
    }, 120);
  };

  const applyParentSelection = (contact, parent) => {
    const patch = buildLinkedParentPatch(contact, parent);
    onChange({ ...formData, ...patch });
    setLookups((prev) => ({
      ...prev,
      [contact.key]: {
        ...prev[contact.key],
        query: composeName(parent.firstName, '', parent.lastName),
        open: false,
        results: [],
        loading: false,
        selectedParent: parent
      }
    }));
  };

  useEffect(() => {
    const timeoutIds = [];
    const queryByContact = {
      FATHER: fatherLookupQuery,
      MOTHER: motherLookupQuery,
      GUARDIAN: guardianLookupQuery
    };

    CONTACTS.forEach((contact) => {
      const query = queryByContact[contact.key]?.trim() || '';

      if (query.length < 2) {
        setLookups((prev) => {
          if (!prev[contact.key]?.loading && !prev[contact.key]?.results?.length) return prev;
          return {
            ...prev,
            [contact.key]: {
              ...prev[contact.key],
              loading: false,
              results: []
            }
          };
        });
        return;
      }

      const timeoutId = window.setTimeout(async () => {
        setLookups((prev) => ({
          ...prev,
          [contact.key]: {
            ...prev[contact.key],
            loading: true
          }
        }));

        try {
          const fallbackSearch = query.split(/\s+/).filter(Boolean)[0] || query;
          const response = await parentAPI.getAll({
            search: fallbackSearch,
            page: 1,
            limit: 25
          });
          const parents = Array.isArray(response?.data) ? response.data : [];
          const filteredParents = parents.filter((parent) => parentMatchesQuery(parent, query)).slice(0, 8);

          setLookups((prev) => ({
            ...prev,
            [contact.key]: {
              ...prev[contact.key],
              loading: false,
              results: filteredParents,
              open: true
            }
          }));
        } catch (error) {
          console.error(`Failed to search ${contact.label.toLowerCase()} records:`, error);
          setLookups((prev) => ({
            ...prev,
            [contact.key]: {
              ...prev[contact.key],
              loading: false,
              results: []
            }
          }));
        }
      }, 250);
      timeoutIds.push(timeoutId);
    });

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [fatherLookupQuery, motherLookupQuery, guardianLookupQuery]);

  const linkedParentSummary = useMemo(() => {
    const currentLookup = CONTACTS.map((contact) => lookups[contact.key]?.selectedParent).find(
      (parent) => parent && parent.id === selectedParentId
    );

    if (!currentLookup) return null;
    return {
      id: currentLookup.id,
      label: composeName(currentLookup.firstName, '', currentLookup.lastName)
    };
  }, [lookups, selectedParentId]);

  const handlePrimaryToggle = (contact, checked) => {
    if (!checked) {
      clearPrimaryContact();
      return;
    }
    setPrimaryContact(contact);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Parent/Guardian Information</h3>
        <p className="text-xs text-gray-600 mt-0.5">Capture father, mother, and guardian details in one form.</p>
      </div>

      <div className="space-y-5">
        {CONTACTS.map((contact) => {
          const isPrimary = formData.primaryContactType === contact.key;
          const nameParts = splitNameParts(formData[contact.nameField]);
          const updateNamePart = (part, value) => {
            const next = {
              first: nameParts.first,
              middle: nameParts.middle,
              last: nameParts.last,
              [part]: value
            };
            handleFieldChange(contact.nameField, composeName(next.first, next.middle, next.last));
          };
          return (
            <div key={contact.key} className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">{contact.label}</h4>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => handlePrimaryToggle(contact, e.target.checked)}
                    className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
                  />
                  Primary Contact
                </label>
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-tight mb-1">
                  Search Existing Parent
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={lookups[contact.key]?.query || ''}
                    onChange={(e) => handleLookupInputChange(contact.key, e.target.value)}
                    onFocus={() => handleLookupFocus(contact.key)}
                    onBlur={() => handleLookupBlur(contact.key)}
                    className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-10 text-sm focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
                    placeholder={`Type ${contact.label.toLowerCase()} name to find an existing record`}
                  />
                  {lookups[contact.key]?.loading && (
                    <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-purple" />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Search as you type, then select a saved parent to auto-fill these editable fields.
                </p>

                {lookups[contact.key]?.open && (lookups[contact.key]?.results?.length > 0 || lookups[contact.key]?.query?.trim().length >= 2) && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {lookups[contact.key]?.results?.length > 0 ? (
                      lookups[contact.key].results.map((parent) => {
                        const parentName = composeName(parent.firstName, '', parent.lastName);
                        return (
                          <button
                            key={parent.id}
                            type="button"
                            onMouseDown={() => applyParentSelection(contact, parent)}
                            className="flex w-full items-start justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-brand-purple/5"
                          >
                            <span>
                              <span className="block text-sm font-medium text-gray-900">{parentName || 'Unnamed parent'}</span>
                              <span className="block text-xs text-gray-500">
                                {parent.phone || 'No phone'}{parent.email ? ` • ${parent.email}` : ''}
                              </span>
                            </span>
                            {selectedParentId === parent.id && (
                              <CheckCircle2 size={16} className="mt-0.5 text-green-600" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      !lookups[contact.key]?.loading && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No existing parent matched that name. Continue typing below to add a new one.
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-tight mb-1">First Name</label>
                  <input
                    type="text"
                    value={nameParts.first}
                    onChange={(e) => updateNamePart('first', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-tight mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={nameParts.middle}
                    onChange={(e) => updateNamePart('middle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                    placeholder="Middle name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-tight mb-1">Last Name</label>
                  <input
                    type="text"
                    value={nameParts.last}
                    onChange={(e) => updateNamePart('last', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-tight mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData[contact.phoneField] || ''}
                  onChange={(e) => handleFieldChange(contact.phoneField, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                  placeholder="0712345678 or +254712345678"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-tight mb-1">Email</label>
                <input
                  type="email"
                  value={formData[contact.emailField] || ''}
                  onChange={(e) => handleFieldChange(contact.emailField, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                  placeholder="optional@email.com"
                />
              </div>

              {contact.relationField && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-tight mb-1">Relationship</label>
                  <input
                    type="text"
                    value={formData[contact.relationField] || ''}
                    onChange={(e) => handleFieldChange(contact.relationField, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                    placeholder="e.g. Aunt, Uncle, Grandmother"
                  />
                </div>
              )}

              {contact.deceasedField && (
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!formData[contact.deceasedField]}
                    onChange={(e) => handleFieldChange(contact.deceasedField, e.target.checked)}
                    className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-400"
                  />
                  Mark as deceased
                </label>
              )}
            </div>
          );
        })}
      </div>

      {linkedParentSummary && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
          <p className="text-xs font-medium text-green-800">
            Linked to existing parent account: {linkedParentSummary.label}
          </p>
        </div>
      )}

      {!formData.primaryContactType && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">Please tick one Primary Contact checkbox.</p>
        </div>
      )}
    </div>
  );
};

export default ParentGuardianStep;

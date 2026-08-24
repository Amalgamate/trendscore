/**
 * Learner Admissions Page
 * Handle new learner admissions with multi-step form
 */

import React, { useState, useEffect } from 'react';
import { Save, X, ArrowRight, ArrowLeft, CheckCircle, User, Users as UsersIcon, Trash2, Loader, Settings, Bus } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../../../hooks/useAuth';
import { configAPI, learnerAPI, transportAPI } from '../../../services/api';
import { toInputDate } from '../utils/dateHelpers';
import ParentGuardianStep from './steps/ParentGuardianStep';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { MOBILE_MEDIA_QUERY } from '../../../constants/breakpoints';
import { sanitizeLearnerPayload } from '../contracts/learnerPayload.contract';
import { DatePicker } from '../../../components/ui/date-picker';

// Helper: Compute primary contact based on parent hierarchy.
const computePrimaryContact = (data) => {
  if (data.primaryContactType === 'FATHER' && data.fatherName && data.fatherPhone) {
    return {
      primaryContactType: 'FATHER',
      primaryContactName: data.fatherName,
      primaryContactPhone: data.fatherPhone,
      primaryContactEmail: data.fatherEmail || ''
    };
  }
  if (data.primaryContactType === 'MOTHER' && data.motherName && data.motherPhone) {
    return {
      primaryContactType: 'MOTHER',
      primaryContactName: data.motherName,
      primaryContactPhone: data.motherPhone,
      primaryContactEmail: data.motherEmail || ''
    };
  }
  if (data.primaryContactType === 'GUARDIAN' && data.guardianName && data.guardianPhone) {
    return {
      primaryContactType: 'GUARDIAN',
      primaryContactName: data.guardianName,
      primaryContactPhone: data.guardianPhone,
      primaryContactEmail: data.guardianEmail || ''
    };
  }

  if (!data.fatherDeceased && data.fatherName && data.fatherPhone) {
    return {
      primaryContactType: 'FATHER',
      primaryContactName: data.fatherName,
      primaryContactPhone: data.fatherPhone,
      primaryContactEmail: data.fatherEmail || ''
    };
  }
  if (!data.motherDeceased && data.motherName && data.motherPhone) {
    return {
      primaryContactType: 'MOTHER',
      primaryContactName: data.motherName,
      primaryContactPhone: data.motherPhone,
      primaryContactEmail: data.motherEmail || ''
    };
  }
  if (data.guardianName && data.guardianPhone) {
    return {
      primaryContactType: 'GUARDIAN',
      primaryContactName: data.guardianName,
      primaryContactPhone: data.guardianPhone,
      primaryContactEmail: data.guardianEmail || ''
    };
  }
  return {
    primaryContactType: null,
    primaryContactName: '',
    primaryContactPhone: '',
    primaryContactEmail: ''
  };
};

const AdmissionsPage = ({ onSave, onCancel, onDelete, onNavigateToFees, learner = null, learnerId = null }) => {
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [resolvedLearner, setResolvedLearner] = useState(learner);
  const activeLearner = resolvedLearner || learner;
  const isEdit = !!(activeLearner || learnerId);
  const [isLoadingLearner, setIsLoadingLearner] = useState(false);
  const [learnerLoadFailed, setLearnerLoadFailed] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [availableStreams, setAvailableStreams] = useState([]);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [isDraft, setIsDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [stepErrors, setStepErrors] = useState({});
  const [showFeesPrompt, setShowFeesPrompt] = useState(false);
  const [editBaseline, setEditBaseline] = useState(null);
  const [hasShownEditNotice, setHasShownEditNotice] = useState(false);
  const formId = 'learner-admissions-form';

  // Fetch streams — single-tenant, no schoolId needed
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const resp = await configAPI.getStreamConfigs();
        const arr = resp?.data || [];
        setAvailableStreams(arr.filter(s => s.active !== false));
      } catch (error) {
        console.error('Failed to fetch streams:', error);
      }
    };
    fetchStreams();
  }, []);

  // Fetch grades
  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const resp = await configAPI.getGrades();
        const grades = resp?.data || [];
        setAvailableGrades(grades);
      } catch (error) {
        console.error('Failed to fetch grades:', error);
        showError('Failed to load grades. Please ensure you are logged in and your session is active.');
      }
    };
    fetchGrades();
  }, [showError]);

  // Fetch transport routes for the transport student toggle
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const resp = await transportAPI.getRoutes();
        if (resp?.success) setAvailableRoutes(resp.data || []);
      } catch (error) {
        console.error('Failed to fetch transport routes:', error);
      }
    };
    fetchRoutes();
  }, []);

  const initialFormData = React.useMemo(() => {
    const now = new Date();
    const iso = now.toISOString().split('T')[0];
    return {
      firstName: '', middleName: '', lastName: '', gender: '', dateOfBirth: '',
      nationality: 'Kenya', religion: 'Islam', admissionNumber: '', upiNumber: '', grade: '', stream: '',
      dateOfAdmission: iso, previousSchool: '', previousClass: '',
      address: '', county: '',
      // Parent/Guardian Information (New Hierarchical System)
      fatherName: '', fatherPhone: '', fatherEmail: '', fatherDeceased: false,
      motherName: '', motherPhone: '', motherEmail: '', motherDeceased: false,
      guardianName: '', guardianPhone: '', guardianEmail: '', guardianRelation: '',
      primaryContactType: '', primaryContactName: '', primaryContactPhone: '', primaryContactEmail: '',
      // Medical & Emergency
      bloodGroup: '', allergies: '', medicalConditions: '',
      doctorName: '', doctorPhone: '', specialNeeds: '', photo: null,
      emergencyContact: '', emergencyPhone: '',
      isTransportStudent: false,
      transportRouteId: '',
      isScholarshipStudent: false,
      scholarshipType: '',
      scholarshipAmount: ''
    };
  }, []);

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    let isMounted = true;
    if (learner) {
      setResolvedLearner(learner);
      setLearnerLoadFailed(false);
      return () => {
        isMounted = false;
      };
    }
    if (!learnerId) {
      setResolvedLearner(null);
      setLearnerLoadFailed(false);
      return () => {
        isMounted = false;
      };
    }

    const loadLearner = async () => {
      setIsLoadingLearner(true);
      setLearnerLoadFailed(false);
      try {
        const response = await learnerAPI.getById(learnerId);
        const fetchedLearner = response?.data || null;
        if (isMounted) setResolvedLearner(fetchedLearner);
      } catch (error) {
        console.error('Failed to load learner for edit:', error);
        if (isMounted) {
          setLearnerLoadFailed(true);
          showError('Could not load this learner for editing. Please return to the learner list and try again.');
        }
      } finally {
        if (isMounted) setIsLoadingLearner(false);
      }
    };

    loadLearner();
    return () => {
      isMounted = false;
    };
  }, [learner, learnerId, showError]);

  const normalizeField = (value) => (value ?? '').toString().trim();
  const toDateOnly = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const hasSensitiveFieldChanges = React.useMemo(() => {
    if (!isEdit || !activeLearner) return false;
    const upiChanged = normalizeField(formData.upiNumber) !== normalizeField(activeLearner.upiNumber);
    const gradeChanged = normalizeField(formData.grade) !== normalizeField(activeLearner.grade);
    const dobChanged = toDateOnly(formData.dateOfBirth) !== toDateOnly(activeLearner.dateOfBirth);
    return upiChanged || gradeChanged || dobChanged;
  }, [activeLearner, formData.dateOfBirth, formData.grade, formData.upiNumber, isEdit]);

  const buildSubmissionPayload = React.useCallback((data) => {
    const primaryContact = computePrimaryContact(data);
    const finalFormData = { ...data, ...primaryContact };
    return sanitizeLearnerPayload(finalFormData);
  }, []);

  const hasUnsavedEdits = React.useMemo(() => {
    if (!isEdit || !editBaseline) return false;
    const currentPayload = buildSubmissionPayload(formData);
    return JSON.stringify(currentPayload) !== JSON.stringify(editBaseline);
  }, [buildSubmissionPayload, editBaseline, formData, isEdit]);

  // Initialize form with learner data if editing
  useEffect(() => {
    if (activeLearner) {
      // Prevent React warnings by replacing null values from the backend with empty strings
      const sanitizedLearner = Object.fromEntries(
        Object.entries(activeLearner).map(([key, value]) => [key, value === null ? '' : value])
      );

      setFormData({
        ...initialFormData,
        ...sanitizedLearner,
        id: activeLearner.id,          // always carry the real DB id for edit detection
        dateOfBirth: toInputDate(activeLearner.dateOfBirth),
        dateOfAdmission: toInputDate(activeLearner.admissionDate) || initialFormData.dateOfAdmission,
      });
      setEditBaseline(buildSubmissionPayload({
        ...initialFormData,
        ...sanitizedLearner,
        id: activeLearner.id,
        dateOfBirth: toInputDate(activeLearner.dateOfBirth),
        dateOfAdmission: toInputDate(activeLearner.admissionDate) || initialFormData.dateOfAdmission,
      }));
      setHasShownEditNotice(false);
      // Set photo preview if exists
      if (activeLearner.photoUrl) {
        setPhotoPreview(activeLearner.photoUrl);
      }
      setChangeReason('');
    } else {
      const savedDraft = localStorage.getItem('admission-form-draft');
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft);
          setFormData(parsedDraft);
          setIsDraft(true);
          setLastSaved(new Date());
          showSuccess('Restored unsaved admission progress');
        } catch (error) {
          console.error('Failed to parse admission draft:', error);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLearner, buildSubmissionPayload, initialFormData]);

  useEffect(() => {
    if (!isEdit || !hasUnsavedEdits || hasShownEditNotice) return;
    showSuccess('You have unsaved changes. Click Save Changes to update this student.');
    setHasShownEditNotice(true);
  }, [hasShownEditNotice, hasUnsavedEdits, isEdit, showSuccess]);

  // Fetch Next Admission Number Preview (only for new admissions)
  useEffect(() => {
    if (isEdit) return;
    const fetchAdmPreview = async () => {
      try {
        const resp = await learnerAPI.getNextAdmissionNumber();
        const next = resp?.data?.nextAdmissionNumber;
        if (next) {
          setFormData(prev => ({ ...prev, admissionNumber: next }));
        }
      } catch (error) {
        console.error('Failed to fetch admission preview:', error);
      }
    };
    fetchAdmPreview();
  }, [isEdit]);

  const toDraftPayload = React.useCallback((data) => {
    // Do not persist base64 photo blobs in draft storage.
    const { photo, ...rest } = data || {};
    return { ...rest, photo: null };
  }, []);

  // Debounced auto-save to localStorage (new admissions only — never save edit state)
  useEffect(() => {
    // Never persist draft state when editing an existing learner: the `id` field
    // would be written to localStorage and get picked up on the next *new* admission,
    // silently turning a create into an update.
    if (isEdit) return;
    // Keep review/upload step stable: avoid background draft writes while user is finalizing.
    if (currentStep === 3) return;
    const draftPayload = toDraftPayload(formData);
    const initialDraftPayload = toDraftPayload(initialFormData);
    // Check if the form has been interacted with (not initial state)
    const isInitial = JSON.stringify(draftPayload) === JSON.stringify(initialDraftPayload);
    if (isInitial) return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem('admission-form-draft', JSON.stringify(draftPayload));
      setIsDraft(true);
      setLastSaved(new Date());
      console.log('Admission draft saved.');
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [formData, initialFormData, isEdit, currentStep, toDraftPayload]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field if it becomes valid
    if (stepErrors[name]) {
      const newErrors = { ...stepErrors };

      // Check if field is now valid based on current step
      if (currentStep === 1) {
        if (name === 'firstName' && value.trim().length >= 2) {
          delete newErrors.firstName;
        } else if (name === 'lastName' && value.trim().length >= 2) {
          delete newErrors.lastName;
        } else if (name === 'gender' && value) {
          delete newErrors.gender;
        } else if (name === 'dateOfBirth' && value) {
          delete newErrors.dateOfBirth;
        } else if (name === 'grade' && value) {
          delete newErrors.grade;
        }
      }

      setStepErrors(newErrors);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setFormData(prev => ({ ...prev, photo: base64String }));
        setPhotoPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo: null }));
    setPhotoPreview(null);
  };

  // Camera capture functions
  // Age validation function
  const validateAge = (dateOfBirth, grade) => {
    if (!dateOfBirth || !grade) return { valid: true };

    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    const ageInYears = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    // Adjust age if birthday hasn't occurred this year
    let actualAge = ageInYears;
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      actualAge--;
    }

    // Minimum age requirements (Kenya CBC system)
    const minAges = {
      'PP1': 4,
      'PP2': 5,
      'GRADE_1': 6,
      'GRADE_2': 7,
      'GRADE_3': 8,
      'GRADE_4': 9,
      'GRADE_5': 10,
      'GRADE_6': 11,
      'GRADE_7': 12
    };

    const requiredAge = minAges[grade];
    if (requiredAge && actualAge < requiredAge) {
      return {
        valid: false,
        message: `Student is ${actualAge} years old. Minimum age for ${grade.replace('_', ' ').replace('GRADE', 'Grade')} is ${requiredAge} years.`,
        actualAge,
        requiredAge
      };
    }

    return { valid: true, actualAge };
  };

  // Validation function for each step
  const validateStep = (step) => {
    const errors = {};

    if (step === 1) {
      // Step 1: Student Information validation
      if (!formData.firstName?.trim()) errors.firstName = 'First name is required';
      else if (formData.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters';
      if (!formData.lastName?.trim()) errors.lastName = 'Last name is required';
      else if (formData.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters';
      if (!formData.gender) errors.gender = 'Gender is required';
      if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
      if (!formData.grade) errors.grade = 'Grade is required';

      // Validate age requirements on step 1
      if (formData.dateOfBirth && formData.grade) {
        const ageValidation = validateAge(formData.dateOfBirth, formData.grade);
        if (!ageValidation.valid) {
          errors.dateOfBirth = `⚠️ ${ageValidation.message}`;
        }
      }
      // Stream is now optional
    } else if (step === 2) {
      // Step 2: Parent/Guardian validation - at least one parent with phone
      const hasFatherPhone = formData.fatherPhone?.trim();
      const hasMotherPhone = formData.motherPhone?.trim();
      const hasGuardianPhone = formData.guardianPhone?.trim();

      if (!hasFatherPhone && !hasMotherPhone && !hasGuardianPhone) {
        errors.parentPhone = 'Please provide at least one parent/guardian with a phone number';
      }
    }
    // Step 3 (Review) has no required fields

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Clear parentPhone error when any parent/guardian phone is filled
  React.useEffect(() => {
    if (stepErrors.parentPhone) {
      const hasFatherPhone = formData.fatherPhone?.trim();
      const hasMotherPhone = formData.motherPhone?.trim();
      const hasGuardianPhone = formData.guardianPhone?.trim();

      if (hasFatherPhone || hasMotherPhone || hasGuardianPhone) {
        setStepErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.parentPhone;
          return newErrors;
        });
      }
    }
  }, [formData.fatherPhone, formData.motherPhone, formData.guardianPhone, stepErrors.parentPhone]);

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 3) {
        setStepErrors({}); // Clear errors when moving to next step
        setCurrentStep(currentStep + 1);
      }
    } else {
      showError('Please fill in all required fields');
    }
  };
  const handlePrevious = () => {
    if (currentStep > 1) {
      setStepErrors({}); // Clear errors when moving to previous step
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('📝 Form submission started...');

    if (isEdit && !activeLearner?.id) {
      showError('This edit session is still loading the learner record. Please wait and try again.');
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.gender || !formData.dateOfBirth) {
      showError('Please fill in all required fields'); setCurrentStep(1); return;
    }

    // Validate that at least one parent/guardian is provided with phone
    const primaryContact = computePrimaryContact(formData);
    if (!primaryContact.primaryContactPhone) {
      showError('Please provide at least one parent/guardian with a phone number'); setCurrentStep(2); return;
    }

    const finalFormData = {
      ...formData,
      ...primaryContact,
      changeReason: hasSensitiveFieldChanges ? changeReason.trim() : undefined
    };

    const sanitizedPayload = sanitizeLearnerPayload(finalFormData);

    if (hasSensitiveFieldChanges && (!changeReason || changeReason.trim().length < 10)) {
      showError('Please provide a clear reason (minimum 10 characters) for changing Birth Entry Number, Date of Birth, or Grade.');
      setCurrentStep(3);
      return;
    }

    console.log('📤 Submitting form data:', finalFormData);

    // Success logic managed by onSave handler
    if (onSave) {
      setIsSaving(true);
      try {
        const targetLearnerId = activeLearner?.id || learnerId || formData?.id || null;
        const result = await onSave(sanitizedPayload, { targetLearnerId, isEdit });
        console.log('📥 Save result:', result);

        if (result?.success) {
          console.log('✅ Save successful, showing success message...');

          // ── Auto-assign transport route if selected ───────────────────────
          // Must happen AFTER learner is created so the assignment can reference their ID.
          // The assignment controller auto-syncs the open invoice transport amount.
          const newLearnerId = result.data?.id || result.learner?.id;
          if (!isEdit && newLearnerId && sanitizedPayload.isTransportStudent && formData.transportRouteId) {
            try {
              await transportAPI.createAssignment({
                routeId: formData.transportRouteId,
                passengerId: newLearnerId,
                passengerType: 'LEARNER',
              });
            } catch (assignErr) {
              console.warn('[Admissions] Transport assignment failed (non-fatal):', assignErr?.message);
              showError(`Student admitted but transport route assignment failed: ${assignErr?.message || 'please assign manually'}. You can assign the route from Transport Manager.`);
            }
          }
          showSuccess(result?.message || 'Student admission successful!');

          localStorage.removeItem('admission-form-draft');
          if (!isEdit) {
            // Clear form with fresh date
            const now = new Date();
            const iso = now.toISOString().split('T')[0];
            const clearedForm = { ...initialFormData, dateOfAdmission: iso };
            setFormData(clearedForm);
            setIsDraft(false);
            setLastSaved(null);
            setCurrentStep(1);
            // Ask if user wants to configure fees
            setShowFeesPrompt(true);
          }
          if (isEdit) {
            setEditBaseline(sanitizedPayload);
            setHasShownEditNotice(false);
          } else if (!onNavigateToFees) {
            // No fee navigation available — fall back to list
            if (onCancel) onCancel();
          }
        } else {
          console.log('❌ Save failed:', result?.error);
          const actionLabel = isEdit ? 'update' : 'create';
          showError(`Failed to ${actionLabel} student: ` + (result?.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('❌ Error during save:', error);
        const actionLabel = isEdit ? 'update' : 'create';
        showError(`Failed to ${actionLabel} student: ` + (error?.message || 'Unknown error'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const steps = [
    { number: 1, title: 'Students Info', icon: User },
    { number: 2, title: 'Guardian Info', icon: UsersIcon },
    { number: 3, title: 'Review', icon: CheckCircle }
  ];

  if (isEdit && isLoadingLearner && !activeLearner) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium text-gray-600 shadow-sm">
          <Loader size={18} className="animate-spin text-brand-purple" />
          Loading student record...
        </div>
      </div>
    );
  }

  if (isEdit && learnerLoadFailed && !activeLearner) {
    return (
      <div className="flex min-h-[320px] items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-red-100 bg-white px-6 py-5 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <X size={20} />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Could not load learner</h2>
          <p className="mt-2 text-sm text-gray-600">
            Return to the learner list and open the record again.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
          >
            Back to List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="border-b border-gray-100 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-medium text-gray-900">{isEdit ? 'Edit Student Details' : 'Student Admission'}</h2>
            <p className="text-sm text-gray-500">{isEdit ? 'Update student records below.' : 'Fill in the details below to admit a new student.'}</p>
            {isEdit && hasUnsavedEdits && (
              <p className="text-xs font-medium text-amber-700 mt-1">Unsaved edits detected. Click Save Changes to apply updates.</p>
            )}
          </div>
          {isDraft && !isEdit && (
            <div className="flex items-center gap-2 mb-1 px-3 py-1 bg-green-50 rounded-full border border-green-100 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-medium text-green-700 uppercase tracking-wider">
                Draft Saved {lastSaved && lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                type="submit"
                form={formId}
                disabled={isSaving || !hasUnsavedEdits}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-purple text-white hover:bg-brand-purple/90 rounded-md transition-all text-sm font-medium border border-brand-purple shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                title="Save student changes"
              >
                {isSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            )}
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-all text-sm font-medium border border-red-200 shadow-sm"
                title="Delete this student record"
              >
                <Trash2 size={16} /> <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-all text-sm font-medium border border-gray-200"
            >
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Back to List</span>
            </button>
          </div>
        </div>

        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Progress Steps - More Compact */}
          <div className="flex items-center justify-between bg-gray-50/50 rounded-lg p-3 border border-gray-100">
            {isMobile ? (
              <div className="flex w-full items-center justify-between px-2">
                <div className="flex flex-col">
                  <h4 className="text-sm font-medium text-gray-800">Step {currentStep} of {steps.length}</h4>
                  <p className="text-xs text-brand-purple font-semibold">{steps[currentStep - 1].title}</p>
                </div>
                <div className="flex gap-1.5">
                  {steps.map(step => (
                    <div key={step.number} className={`h-2 rounded-full transition-all ${currentStep === step.number ? 'w-6 bg-brand-purple' : 'w-2 bg-gray-300'}`} />
                  ))}
                </div>
              </div>
            ) : (
              steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep >= step.number;
                return (
                  <React.Fragment key={step.number}>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-brand-purple text-white shadow-md shadow-brand-purple/20' : 'bg-gray-200 text-gray-500'}`}>
                        {isActive ? <StepIcon size={14} /> : step.number}
                      </div>
                      <div className="hidden sm:block">
                        <p className={`text-xs font-semibold uppercase tracking-widest ${isActive ? 'text-brand-purple' : 'text-gray-400'}`}>{step.title}</p>
                      </div>
                    </div>
                    {index < steps.length - 1 && <div className={`flex-1 h-px mx-2 ${currentStep > step.number ? 'bg-brand-purple' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                );
              })
            )}
          </div>

          <form id={formId} onSubmit={handleSubmit}>
            {/* Step 1: Students Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-medium text-gray-800 mb-4">Students Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[{ name: 'firstName', label: 'First Name', required: true },
                  { name: 'middleName', label: 'Middle Name', required: false },
                  { name: 'lastName', label: 'Last Name', required: true }].map(field => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <input type="text" name={field.name} value={formData[field.name]} onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-white border rounded-md text-sm transition-all focus:ring-1 focus:ring-brand-purple ${stepErrors[field.name]
                          ? 'border-red-500 bg-red-50 focus:border-red-500'
                          : 'border-gray-200 focus:border-brand-purple'
                          }`}
                        placeholder={`Enter ${field.label.toLowerCase()}`} required={field.required} />
                      {stepErrors[field.name] && <p className="text-xs text-red-500 font-semibold mt-1">{stepErrors[field.name]}</p>}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">Gender <span className="text-red-500">*</span></label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} className={`w-full px-3 py-2 bg-white border rounded-md text-sm transition-all focus:ring-1 focus:ring-brand-purple ${stepErrors.gender
                      ? 'border-red-500 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 focus:border-brand-purple'
                      }`} required>
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                    {stepErrors.gender && <p className="text-xs text-red-500 font-semibold mt-1">{stepErrors.gender}</p>}
                  </div>
                  <div>
                    <DatePicker
                      label="Date of Birth"
                      required
                      value={formData.dateOfBirth}
                      onChange={(val) => setFormData({ ...formData, dateOfBirth: val })}
                      disableFuture
                      fromYear={1950}
                      toYear={new Date().getFullYear()}
                      error={stepErrors.dateOfBirth}
                      placeholder="Select date of birth"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nationality</label>
                    <select name="nationality" value={formData.nationality} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple bg-white">
                      <option value="">Select Nationality</option>
                      {[
                        'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 
                        'Cameroon', 'Central African Republic', 'Chad', 'Comoros', 'Democratic Republic of the Congo', 
                        'Republic of the Congo', "Cote d'Ivoire", 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 
                        'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 
                        'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 
                        'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 
                        'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 
                        'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
                      ].map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Religion</label>
                    <select name="religion" value={formData.religion} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple bg-white">
                      <option value="">Select Religion</option>
                      <option value="Christianity">Christianity</option>
                      <option value="Islam">Islam</option>
                      <option value="Hinduism">Hinduism</option>
                      <option value="Buddhism">Buddhism</option>
                      <option value="Judaism">Judaism</option>
                      <option value="Other">Other</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-6 mt-6">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">Academic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">Admission Number</label>
                      <input
                        type="text"
                        name="admissionNumber"
                        value={formData.admissionNumber}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm shadow-sm focus:border-brand-purple focus:ring-1 focus:ring-brand-purple font-mono font-medium text-brand-purple"
                        placeholder="Auto-generating..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">Birth Entry Number</label>
                      <input
                        type="text"
                        name="upiNumber"
                        value={formData.upiNumber}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-md text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono font-medium text-emerald-700"
                        placeholder="e.g. 123456789"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">Grade <span className="text-red-500">*</span></label>
                      <select name="grade" value={formData.grade} onChange={handleInputChange} className={`w-full px-3 py-2 bg-white border rounded-md text-sm shadow-sm transition-all focus:ring-1 focus:ring-brand-purple ${stepErrors.grade
                        ? 'border-red-500 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 focus:border-brand-purple'
                        }`} required>
                        <option value="">Select Grade</option>
                        {availableGrades.map(grade => (
                          <option key={grade} value={grade}>
                            {grade.replace('_', ' ').replace('GRADE', 'Grade')}
                          </option>
                        ))}
                      </select>
                      {stepErrors.grade && <p className="text-xs text-red-500 font-semibold mt-1">{stepErrors.grade}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">Stream</label>
                      <select name="stream" value={formData.stream} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm shadow-sm focus:border-brand-purple focus:ring-1 focus:ring-brand-purple">
                        <option value="">Select Stream (Optional)</option>
                        {availableStreams.length > 0 ? (
                          availableStreams.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))
                        ) : (
                          <option disabled>No streams configured</option>
                        )}
                      </select>
                    </div>
                    {/* end of Academic Information grid */}
                  </div>
                </div>

                {/* Transport Student */}
                <div className="border-t pt-6 mt-6">
                  <div className="flex items-center gap-3 mb-1">
                    <Bus size={16} className="text-blue-500" />
                    <h4 className="text-lg font-medium text-gray-800">Transport</h4>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Enable if this student will use the school bus. An additional transport fee will be applied to their invoice automatically.</p>

                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      isTransportStudent: !prev.isTransportStudent,
                      transportRouteId: prev.isTransportStudent ? '' : prev.transportRouteId,
                    }))}
                    className={`flex items-center gap-3 w-full md:w-auto px-4 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                      formData.isTransportStudent
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-5 rounded-full flex items-center transition-all ${formData.isTransportStudent ? 'bg-blue-500 justify-end' : 'bg-gray-200 justify-start'}`}>
                      <div className="w-4 h-4 rounded-full bg-white shadow mx-0.5" />
                    </div>
                    {formData.isTransportStudent ? 'Transport Student — bus fee will be charged' : 'Not a transport student'}
                  </button>

                  {/* Route selector — shown when transport is enabled */}
                  {formData.isTransportStudent && (
                    <div className="mt-4 max-w-sm">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-tight mb-1">
                        Assign to Route
                        <span className="normal-case font-normal text-gray-400 ml-1">(recommended — sets the transport fee amount)</span>
                      </label>
                      {availableRoutes.length === 0 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          No active routes found. Student will be marked as a transport student but route must be assigned later in Transport Manager.
                        </p>
                      ) : (
                        <select
                          name="transportRouteId"
                          value={formData.transportRouteId}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-md text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select a route (optional)</option>
                          {availableRoutes.map(route => (
                            <option key={route.id} value={route.id}>
                              {route.name}
                              {Number(route.amount) > 0 ? ` — KES ${Number(route.amount).toLocaleString('en-KE')}/term` : ''}
                              {route.vehicle ? ` (${route.vehicle.registrationNumber})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Step 2: Parent/Guardian Information */}
            {currentStep === 2 && (
              <>
                <ParentGuardianStep
                  formData={formData}
                  onChange={setFormData}
                />
                {stepErrors.parentPhone && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-300 rounded-lg">
                    <p className="text-sm font-semibold text-red-700">⚠️ {stepErrors.parentPhone}</p>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="border-b border-gray-100 pb-2 mb-4">
                  <h3 className="text-lg font-medium text-gray-800">Review Admission Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-100 rounded-md p-3 bg-gray-50/30">
                    <h4 className="text-xs font-semibold text-brand-purple uppercase tracking-widest mb-2 border-b border-brand-purple/10 pb-1">Personal Info</h4>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between"><span className="text-gray-500">Name:</span> <span className="font-semibold text-gray-800">{formData.firstName} {formData.middleName} {formData.lastName}</span></p>
                      <p className="flex justify-between"><span className="text-gray-500">Gender:</span> <span className="font-semibold text-gray-800">{formData.gender === 'MALE' ? 'Male' : 'Female'}</span></p>
                      <p className="flex justify-between"><span className="text-gray-500">DOB:</span> <span className="font-semibold text-gray-800">{formData.dateOfBirth}</span></p>
                      <p className="flex justify-between"><span className="text-gray-500">Grade:</span> <span className="font-semibold text-gray-800">{formData.grade?.replace('GRADE_', 'Grade ')} - {formData.stream}</span></p>
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-md p-3 bg-gray-50/30">
                    <h4 className="text-xs font-medium text-green-600 uppercase tracking-widest mb-2 border-b border-green-50 pb-1">
                      {(() => {
                        const pc = computePrimaryContact(formData);
                        const typeLabel = { 'FATHER': '👨 Father', 'MOTHER': '👩 Mother', 'GUARDIAN': '👤 Guardian' }[pc.primaryContactType] || 'Contact';
                        return `Primary Guardian (${typeLabel})`;
                      })()}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between">
                        <span className="text-gray-500">Contact:</span>
                        <span className="font-semibold text-gray-800">{computePrimaryContact(formData).primaryContactName || 'Not specified'}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-gray-500">Phone:</span>
                        <span className="font-semibold text-gray-800">{computePrimaryContact(formData).primaryContactPhone || 'N/A'}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-gray-500">Email:</span>
                        <span className="font-semibold text-gray-800">{computePrimaryContact(formData).primaryContactEmail || 'N/A'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-md p-3 bg-gray-50/30">
                    <h4 className="text-xs font-medium text-orange-600 uppercase tracking-widest mb-2 border-b border-orange-50 pb-1">Admin Info</h4>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between"><span className="text-gray-500">Adm No:</span> <span className="font-semibold text-gray-800">{formData.admissionNumber || 'Auto-generated'}</span></p>
                      <p className="flex justify-between"><span className="text-gray-500">Birth Entry Number:</span> <span className="font-semibold text-emerald-600 font-mono">{formData.upiNumber || 'N/A'}</span></p>
                    </div>
                  </div>
                  {/* Transport summary */}
                  <div className={`border rounded-md p-3 ${formData.isTransportStudent ? 'border-blue-100 bg-blue-50/40' : 'border-gray-100 bg-gray-50/30'}`}>
                    <h4 className={`text-xs font-medium uppercase tracking-widest mb-2 border-b pb-1 flex items-center gap-1.5 ${formData.isTransportStudent ? 'text-blue-600 border-blue-100' : 'text-gray-400 border-gray-100'}`}>
                      <Bus size={11} /> Transport
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between">
                        <span className="text-gray-500">Transport Student:</span>
                        <span className={`font-semibold ${formData.isTransportStudent ? 'text-blue-700' : 'text-gray-500'}`}>
                          {formData.isTransportStudent ? '✓ Yes' : 'No'}
                        </span>
                      </p>
                      {formData.isTransportStudent && (
                        <p className="flex justify-between">
                          <span className="text-gray-500">Route:</span>
                          <span className="font-semibold text-blue-700">
                            {formData.transportRouteId
                              ? (availableRoutes.find(r => r.id === formData.transportRouteId)?.name || 'Selected')
                              : 'Not assigned yet'}
                          </span>
                        </p>
                      )}
                      {formData.isTransportStudent && formData.transportRouteId && (() => {
                        const route = availableRoutes.find(r => r.id === formData.transportRouteId);
                        return route && Number(route.amount) > 0 ? (
                          <p className="flex justify-between">
                            <span className="text-gray-500">Transport Fee:</span>
                            <span className="font-semibold text-blue-700">KES {Number(route.amount).toLocaleString('en-KE')}/term</span>
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-brand-purple/5 border border-brand-purple/10 rounded-md flex items-start gap-3 mt-4">
                  <CheckCircle className="text-brand-purple shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-brand-purple leading-relaxed font-medium">Please verify all information above before completing the admission. You can edit these details later in student management.</p>

                </div>

                {isEdit && hasSensitiveFieldChanges && (
                  <div className="mt-4 p-4 border border-amber-300 bg-amber-50 rounded-lg">
                    <label className="block text-sm font-semibold text-amber-900 mb-2">
                      Reason for Sensitive Change <span className="text-red-600">*</span>
                    </label>
                    <p className="text-xs text-amber-800 mb-2">
                      Required because Birth Entry Number, Date of Birth, or Grade was changed.
                    </p>
                    <textarea
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-md text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="Explain why this sensitive information is being changed..."
                    />
                  </div>
                )}

              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <button type="button" onClick={handlePrevious} disabled={currentStep === 1} className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-md transition-all text-sm font-medium ${currentStep === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <ArrowLeft size={16} /> <span className="hidden sm:inline">Previous</span>
              </button>
              <div className="flex items-center gap-2 md:gap-3">
                <button type="button" onClick={() => { setFormData(initialFormData); setCurrentStep(1); }} className="flex items-center gap-2 px-3 md:px-5 py-2.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-all text-sm font-medium border border-gray-200">
                  <X size={16} /> <span className="hidden sm:inline">Clear</span>
                </button>
                {currentStep < 3 ? (
                  <button type="button" onClick={handleNext} disabled={Object.keys(stepErrors).length > 0} className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-md transition-all shadow-sm text-sm font-medium ${Object.keys(stepErrors).length > 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-brand-teal text-white hover:bg-brand-teal/90'
                    }`}>
                    <span className="hidden sm:inline">Next Step</span><span className="inline sm:hidden">Next</span> <ArrowRight size={16} />
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 md:px-5 py-2.5 bg-brand-purple text-white rounded-md hover:bg-brand-purple/90 transition-all shadow-md text-sm font-medium disabled:opacity-70 disabled:cursor-wait"
                  >
                    {isSaving ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} /> 
                        {isEdit ? 'Save Changes' : 'Complete Admission'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ── Configure Fees Prompt ── */}
      {showFeesPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-purple/10 mx-auto mb-4">
                <Settings size={22} className="text-brand-purple" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center">Set Up Fee Structure</h3>
              <p className="text-sm text-gray-500 text-center mt-1.5 leading-relaxed">
                Would you like to configure fees for this student's grade now? You can always do this later from the Fees section.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex flex-col gap-2">
              {onNavigateToFees && (
                <button
                  type="button"
                  onClick={() => {
                    setShowFeesPrompt(false);
                    onNavigateToFees();
                  }}
                  className="w-full py-2.5 bg-brand-purple text-white rounded-xl font-medium text-sm hover:bg-brand-purple/90 transition-colors shadow-sm"
                >
                  Yes, configure fees
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowFeesPrompt(false);
                  if (onCancel) onCancel();
                }}
                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Not now — go to student list
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionsPage;

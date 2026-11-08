/**
 * useLearners Hook
 * Manages learner data from backend API
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';

export const useLearners = (options = {}) => {
  const { enabled = true } = options;
  const [learners, setLearners] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchLearners = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.learners.getAll(params);

      if (response.success) {
        if (response.pagination) {
          setPagination(response.pagination);
        }

        const transformedLearners = response.data.map(learner => ({
          id: learner.id,
          admissionNumber: learner.admissionNumber,
          name: `${learner.firstName} ${learner.lastName}`,
          firstName: learner.firstName,
          lastName: learner.lastName,
          middleName: learner.middleName,
          dateOfBirth: learner.dateOfBirth,
          age: calculateAge(learner.dateOfBirth),
          gender: learner.gender,
          avatar: learner.gender === 'MALE' ? '👦' : '👧',
          grade: learner.grade,
          stream: learner.stream,

          // Profiling
          photoUrl: learner.photoUrl,
          status: learner.status,
          admissionDate: learner.admissionDate || null,  // keep ISO string — do NOT format as locale string
          exitDate: learner.exitDate ? new Date(learner.exitDate).toLocaleDateString() : null,
          exitReason: learner.exitReason,

          // Contact & Parents
          parentId: learner?.parentId,
          parent: learner?.parent,

          // Primary Contact (explicit)
          primaryContactName: learner?.primaryContactName,
          primaryContactPhone: learner?.primaryContactPhone,
          primaryContactEmail: learner?.primaryContactEmail,
          primaryContactType: learner?.primaryContactType,

          // Guardian
          guardianName: learner?.guardianName || (learner?.parent ? `${learner.parent.firstName || ''} ${learner.parent.lastName || ''}`.trim() : undefined),
          guardianPhone: learner?.guardianPhone || learner?.parent?.phone,
          guardianEmail: learner?.guardianEmail || learner?.parent?.email,
          guardianRelation: learner?.guardianRelation,

          // Father
          fatherName: learner.fatherName,
          fatherPhone: learner.fatherPhone,
          fatherEmail: learner.fatherEmail,
          fatherDeceased: learner.fatherDeceased,

          // Mother
          motherName: learner.motherName,
          motherPhone: learner.motherPhone,
          motherEmail: learner.motherEmail,
          motherDeceased: learner.motherDeceased,

          // Health & other
          medicalConditions: learner.medicalConditions,
          allergies: learner.allergies,
          emergencyContact: learner.emergencyContact,
          emergencyPhone: learner.emergencyPhone,
          bloodGroup: learner.bloodGroup,
          specialNeeds: learner.specialNeeds,
          previousSchool: learner.previousSchool,
          religion: learner.religion,

          // Address
          address: learner.address,
          county: learner.county,
          subCounty: learner.subCounty,

          createdAt: learner.createdAt,
        }));

        setLearners(transformedLearners);
      }
    } catch (err) {
      console.error('Error fetching learners:', err);
      setError(err.message);
      setLearners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const createLearner = useCallback(async (learnerData) => {
    try {
      setLoading(true);
      setError(null);

      console.log('📤 CREATING LEARNER WITH DATA:', JSON.stringify(learnerData, null, 2));

      const response = await api.learners.create(learnerData);

      console.log('✅ LEARNER CREATION RESPONSE:', response);

      if (response?.success) {
        await fetchLearners();
        return { success: true, data: response.data };
      } else {
        const errorMsg = response?.message || 'Unknown error creating learner';
        console.error('❌ API returned error:', errorMsg);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      console.error('❌ ERROR CREATING LEARNER:', errorMsg);
      console.error('Full error:', err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchLearners]);

  const updateLearner = useCallback(async (id, learnerData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.learners.update(id, learnerData);

      if (response?.success) {
        await fetchLearners({
          page: pagination.page,
          limit: pagination.limit
        });
        return { success: true, data: response.data };
      }

      // API returned success:false — surface the message
      const msg = response?.message || response?.error || 'Failed to update learner';
      setError(msg);
      return { success: false, error: msg };
    } catch (err) {
      console.error('Error updating learner:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchLearners, pagination]);

  const deleteLearner = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.learners.delete(id);

      if (response.success) {
        await fetchLearners({
          page: pagination.page,
          limit: pagination.limit
        });
        return { success: true };
      } else {
        const errorMsg = response.message || 'Failed to delete learner';
        console.error('Delete failed:', errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      console.error('Error deleting learner:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchLearners, pagination]);

  const bulkDeleteLearners = useCallback(async (ids) => {
    try {
      setLoading(true);
      setError(null);

      const deletePromises = ids.map(async (id) => {
        try {
          return await api.learners.delete(id);
        } catch (e) {
          return { success: false, message: e.message };
        }
      });

      const results = await Promise.all(deletePromises);
      const failures = results.filter(r => !r.success);

      await fetchLearners({
        page: pagination.page,
        limit: pagination.limit
      });

      if (failures.length > 0) {
        return {
          success: false,
          error: `Failed to delete ${failures.length} out of ${ids.length} learners`,
          results
        };
      }

      return { success: true };
    } catch (err) {
      console.error('Error in bulk delete:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchLearners, pagination]);

  const promoteLearners = useCallback(async (promotionData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.learners.bulkPromote(promotionData);

      if (response.success) {
        await fetchLearners({
          page: pagination.page,
          limit: pagination.limit
        });
        return { success: true };
      }
      return { success: false, error: response.message || 'Failed to promote learners' };
    } catch (err) {
      console.error('Error in bulk promote:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchLearners, pagination]);

  const transferOutLearner = useCallback(async (transferData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.learners.transferOut(transferData);

      if (response.success) {
        await fetchLearners({
          page: pagination.page,
          limit: pagination.limit
        });
        return { success: true };
      }
      return { success: false, error: response.message || 'Failed to process transfer out' };
    } catch (err) {
      console.error('Error in transfer out:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchLearners, pagination]);

  useEffect(() => {
    if (!enabled) {
      setLearners([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchLearners();
  }, [fetchLearners, enabled]);

  return {
    learners,
    pagination,
    selectedLearner,
    setSelectedLearner,
    loading,
    error,
    fetchLearners,
    createLearner,
    updateLearner,
    deleteLearner,
    bulkDeleteLearners,
    promoteLearners,
    transferOutLearner,
  };
};

/**
 * useParents Hook
 * Manages parent data from backend API
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';

export const useParents = (options = {}) => {
  const { enabled = true } = options;
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  /**
   * Fetch all parents from backend
   */
  const fetchParents = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.parents.getAll(params);

      if (response.success) {
        // Transform backend data to match frontend format
        const transformedParents = response.data.map(parent => ({
          id: parent.id,
          name: `${parent.firstName} ${parent.lastName}`,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          phone: parent.phone || 'N/A',
          relationship: 'Parent/Guardian',
          status: parent.status,
          createdAt: parent.createdAt,
          learners: parent.learners || [],
          learnerIds: parent.learners ? parent.learners.map(l => l.admissionNumber) : [],
        }));

        setParents(transformedParents);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      }
    } catch (err) {
      console.error('Error fetching parents:', err);
      setError(err.message);
      setParents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create new parent
   */
  const createParent = useCallback(async (parentData) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Creating parent with data:', parentData);
      const response = await api.parents.create(parentData);
      console.log('Parent creation response:', response);

      if (response.success) {
        await fetchParents(); // Refresh the list
        return { success: true, data: response.data };
      }
    } catch (err) {
      console.error('Error creating parent:', err);
      console.error('Error details:', err.message);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchParents]);

  /**
   * Update parent
   */
  const updateParent = useCallback(async (id, parentData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.parents.update(id, parentData);

      if (response.success) {
        await fetchParents(); // Refresh the list
        return { success: true, data: response.data };
      }
    } catch (err) {
      console.error('Error updating parent:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchParents]);

  /**
   * Archive parent (soft delete)
   */
  const archiveParent = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.parents.archive(id);

      if (response.success) {
        await fetchParents(); // Refresh the list
        return { success: true };
      }
    } catch (err) {
      console.error('Error archiving parent:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchParents]);

  /**
   * Unarchive parent
   */
  const unarchiveParent = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.parents.unarchive(id);

      if (response.success) {
        await fetchParents(); // Refresh the list
        return { success: true };
      }
    } catch (err) {
      console.error('Error unarchiving parent:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchParents]);

  /**
   * Delete parent (hard delete)
   */
  const deleteParent = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.parents.delete(id);

      if (response.success) {
        await fetchParents(); // Refresh the list
        return { success: true };
      }
    } catch (err) {
      console.error('Error deleting parent:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchParents]);

  useEffect(() => {
    if (!enabled) {
      setParents([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchParents();
  }, [fetchParents, enabled]);

  return {
    parents,
    selectedParent,
    setSelectedParent,
    loading,
    error,
    pagination,
    fetchParents,
    createParent,
    updateParent,
    archiveParent,
    unarchiveParent,
    deleteParent,
  };
};

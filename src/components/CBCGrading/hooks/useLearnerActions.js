import { useCallback } from 'react';
import { refreshBus } from '../../../utils/refreshBus';

/**
 * Custom hook to handle complex learner actions
 * Extracted from CBCGradingSystem.jsx
 */
export const useLearnerActions = ({
  updateLearner,
  createLearner,
  deleteLearner,
  bulkDeleteLearners,
  promoteLearners,
  transferOutLearner,
  showSuccess,
  showError,
  setEditingLearner,
  setCurrentPage,
  setShowConfirmDialog,
  setConfirmAction,
  learners
}) => {

  const handleSaveLearner = useCallback(async (learnerData) => {
    // Use learnerData.id as the source of truth for edit vs create.
    const learnerId = learnerData.id;

    if (learnerId) {
      const result = await updateLearner(learnerId, learnerData);
      if (result?.success) {
        showSuccess('Student updated successfully!');
        setEditingLearner(null);
        refreshBus.emit('learners');
      } else {
        showError('Error updating student: ' + (result?.error || 'Unknown error'));
      }
      return result;
    } else {
      const result = await createLearner(learnerData);

      if (result.success) {
        showSuccess('Student added successfully!');
        refreshBus.emit('learners');
      } else {
        const errorMsg = typeof result?.error === 'object' ? JSON.stringify(result?.error) : result?.error;
        showError('Error creating student: ' + errorMsg);
      }
      return result;
    }
  }, [updateLearner, createLearner, showSuccess, showError, setEditingLearner]);

  const handleDeleteLearner = useCallback(async (learnerId) => {
    setConfirmAction(() => async () => {
      const result = await deleteLearner(learnerId);
      if (result.success) {
        showSuccess('Student deleted successfully');
        refreshBus.emit('learners');
      } else {
        showSuccess('Error deleting student: ' + result.error);
      }
      setShowConfirmDialog(false);
    });
    setShowConfirmDialog(true);
  }, [deleteLearner, showSuccess, setConfirmAction, setShowConfirmDialog]);

  const handleBulkDeleteLearners = useCallback(async (learnerIds) => {
    const result = await bulkDeleteLearners(learnerIds);
    if (result.success) {
      const count = learnerIds.length;
      showSuccess(`${count} student${count !== 1 ? 's' : ''} deleted successfully`);
    } else {
      showSuccess(result.error || 'Error deleting students');
    }
  }, [bulkDeleteLearners, showSuccess]);

  const handlePromoteLearners = useCallback(async (promotionData) => {
    const result = await promoteLearners(promotionData);
    if (!result.success && result.error) {
      showError('Error promoting students: ' + result.error);
    }
    return result;
  }, [promoteLearners, showError]);

  const handleMarkAsExited = useCallback((learnerId) => {
    setConfirmAction(() => async () => {
      const learner = learners.find(l => l.id === learnerId);
      if (learner) {
        await updateLearner(learnerId, { ...learner, status: 'Exited' });
        showSuccess('Learner marked as exited successfully');
      }
      setShowConfirmDialog(false);
    });
    setShowConfirmDialog(true);
  }, [learners, updateLearner, showSuccess, setConfirmAction, setShowConfirmDialog]);

  const handleTransferOut = useCallback(async (transferData) => {
    const result = await transferOutLearner(transferData);
    if (result.success) {
      showSuccess('Student transfer processed successfully');
      setCurrentPage('learners-exited');
    } else {
      showSuccess('Error processing transfer: ' + result.error);
    }
    return result;
  }, [transferOutLearner, showSuccess, setCurrentPage]);

  return {
    handleSaveLearner,
    handleDeleteLearner,
    handleBulkDeleteLearners,
    handlePromoteLearners,
    handleMarkAsExited,
    handleTransferOut
  };
};

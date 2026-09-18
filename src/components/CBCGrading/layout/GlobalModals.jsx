import React from 'react';
import ConfirmDialog from '../shared/ConfirmDialog';
import AddEditParentModal from '../shared/AddEditParentModal';

/**
 * Manager for global modals and notifications
 * Extracted from CBCGradingSystem.jsx
 */
const GlobalModals = ({
  showConfirmDialog,
  setShowConfirmDialog,
  confirmAction,
  showParentModal,
  setShowParentModal,
  editingParent,
  handleSaveParent
}) => {
  return (
    <>
      {/* Confirmation Dialog */}
      <ConfirmDialog
        show={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={() => {
          if (typeof confirmAction === 'function') confirmAction();
        }}
        title="Confirm Action"
        message="Are you sure you want to proceed? This action may be permanent."
      />

      {/* Parent Modal */}
      <AddEditParentModal
        isOpen={showParentModal}
        onClose={() => setShowParentModal(false)}
        onSave={handleSaveParent}
        parent={editingParent}
      />
    </>
  );
};

export default GlobalModals;

/**
 * Transfer Out Page
 * Process learner transfers to other institutions
 */

import React, { useState } from 'react';
import { CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { DatePicker } from '../../ui/date-picker';
import { TRANSFER_REASONS } from '../utils/constants';
import { getCurrentDate } from '../utils/dateHelpers';

const TransferOutPage = ({ learners = [], onTransferOut, showNotification }) => {
  const [formData, setFormData] = useState({
    learnerId: '',
    transferDate: getCurrentDate(),
    destinationSchool: '',
    destinationAddress: '',
    reason: '',
    certificateNumber: ''
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.learnerId) newErrors.learnerId = 'Please select a learner';
    if (!formData.transferDate) newErrors.transferDate = 'Transfer date is required';
    if (!formData.destinationSchool || formData.destinationSchool.trim() === '') {
      newErrors.destinationSchool = 'Destination school is required';
    }
    if (!formData.reason) newErrors.reason = 'Reason for transfer is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    const learner = learners.find(l => l.id === formData.learnerId);
    if (!learner) {
      showNotification('Learner not found', 'error');
      return;
    }

    onTransferOut(formData).then(result => {
      if (result.success) {
        // Success message and redirection is handled by CBCGradingSystem
        // Reset form
        setFormData({
          learnerId: '',
          transferDate: getCurrentDate(),
          destinationSchool: '',
          destinationAddress: '',
          reason: '',
          certificateNumber: ''
        });
      }
    });
  };

  const handleReset = () => {
    setFormData({
      learnerId: '',
      transferDate: getCurrentDate(),
      destinationSchool: '',
      destinationAddress: '',
      reason: '',
      certificateNumber: ''
    });
    setErrors({});
  };

  const activeLearners = learners.filter(l => l.status === 'Active');

  return (
    <div className="space-y-6">

      {/* Transfer Form */}
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-8">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="text-brand-purple" size={24} />
              <h3 className="text-xl font-medium text-brand-purple">Transfer Information</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Complete all required fields to process the transfer
            </p>
          </div>

          <div className="space-y-6">
            {/* Select Learner */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Learner <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.learnerId}
                onChange={(e) => handleChange('learnerId', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple ${errors.learnerId ? 'border-red-500' : 'border-gray-300'
                  }`}
              >
                <option value="">-- Select Learner --</option>
                {activeLearners.map(learner => (
                  <option key={learner.id} value={learner.id}>
                    {learner.firstName} {learner.lastName} ({learner.admNo}) - {learner.grade} {learner.stream}
                  </option>
                ))}
              </select>
              {errors.learnerId && (
                <p className="text-red-500 text-sm mt-1">{errors.learnerId}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Transfer Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={formData.transferDate}
                  onChange={(val) => handleChange('transferDate', val)}
                  className="w-full"
                />
                {errors.transferDate && (
                  <p className="text-red-500 text-sm mt-1">{errors.transferDate}</p>
                )}
              </div>

              {/* Certificate Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transfer Certificate Number
                </label>
                <input
                  type="text"
                  value={formData.certificateNumber}
                  onChange={(e) => handleChange('certificateNumber', e.target.value)}
                  placeholder="TC-2026-001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                />
              </div>
            </div>

            {/* Destination School */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Destination School Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.destinationSchool}
                onChange={(e) => handleChange('destinationSchool', e.target.value)}
                placeholder="e.g., Nairobi Academy"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple ${errors.destinationSchool ? 'border-red-500' : 'border-gray-300'
                  }`}
              />
              {errors.destinationSchool && (
                <p className="text-red-500 text-sm mt-1">{errors.destinationSchool}</p>
              )}
            </div>

            {/* Destination Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Destination Address
              </label>
              <textarea
                value={formData.destinationAddress}
                onChange={(e) => handleChange('destinationAddress', e.target.value)}
                placeholder="Enter full address of destination school"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              />
            </div>

            {/* Reason for Transfer */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason for Transfer <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple ${errors.reason ? 'border-red-500' : 'border-gray-300'
                  }`}
              >
                <option value="">-- Select Reason --</option>
                {TRANSFER_REASONS.map((reason, index) => (
                  <option key={index} value={reason}>{reason}</option>
                ))}
              </select>
              {errors.reason && (
                <p className="text-red-500 text-sm mt-1">{errors.reason}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="border-t pt-6 flex items-center gap-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-brand-purple text-white rounded-lg hover:opacity-90 transition font-medium"
              >
                <CheckCircle size={20} />
                Process Transfer
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Reset Form
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-6 py-3 bg-brand-teal text-white rounded-lg hover:bg-brand-teal/90 transition font-medium ml-auto"
              >
                <FileText size={20} />
                Generate Transfer Documents
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferOutPage;

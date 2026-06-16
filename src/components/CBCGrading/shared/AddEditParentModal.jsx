/**
 * Add/Edit Parent Modal
 * Modal for adding or editing parent/guardian information
 */

import React, { useState, useEffect } from 'react';
import { X, Save, User, Phone, Briefcase } from 'lucide-react';

const AddEditParentModal = ({ show, onClose, onSave, parent = null, learners = [] }) => {
  const isEdit = parent !== null;
  const getParentLogin = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `${digits}@trendscore.co.ke` : '';
  };

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (parent) {
      setFormData({
        firstName: parent.firstName || '',
        lastName: parent.lastName || '',
        email: parent.email || '',
        phone: parent.phone || '',
        password: '' // Don't populate password for edits
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: ''
      });
    }
  }, [parent, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';

    // Password is only required for new parents
    if (!isEdit && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    // Prepare data for API
    const parentData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone
    };

    // Only include password if it's provided
    if (formData.password) {
      parentData.password = formData.password;
    }

    onSave(parentData);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-purple-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-medium text-white">
            {isEdit ? 'Edit Parent/Guardian' : 'Add Parent/Guardian'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="text-purple-600" size={20} />
                <h3 className="text-lg font-medium text-purple-900">Personal Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Enter first name"
                  />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Enter last name"
                  />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="text-blue-600" size={20} />
                <h3 className="text-lg font-medium text-blue-900">Contact Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Enter phone number"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Login Email
                  </label>
                  <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                    {getParentLogin(formData.phone) || 'Enter a phone number to generate the login email'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Parent login is generated from phone number.</p>
                </div>
              </div>
            </div>

            {/* Account Security */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="text-green-600" size={20} />
                <h3 className="text-lg font-medium text-green-900">Account Security</h3>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password {!isEdit && <span className="text-red-500">*</span>}
                  {isEdit && <span className="text-gray-500 text-xs ml-2">(Leave empty to keep current password)</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder={isEdit ? "Enter new password (optional)" : "Enter password (min 8 characters)"}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                {!isEdit && <p className="text-xs text-gray-500 mt-1">Minimum 8 characters required</p>}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>Note:</strong> The parent will be created with the role "PARENT" and can access the system to view their children's information.
              </p>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="border-t px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition font-semibold shadow-md"
          >
            <Save size={18} />
            {isEdit ? 'Update Parent' : 'Add Parent'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEditParentModal;

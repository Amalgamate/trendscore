/**
 * Add/Edit Teacher Page
 * Full page form for adding or editing teacher/tutor information
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, User, Mail, BookOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../../../hooks/useAuth';

const normalizePhoneForApi = (raw) => {
    const cleaned = String(raw || '').replace(/[^\d+]/g, '');
    if (!cleaned) return '';

    // Keep +E.164 as-is (strip only spaces/symbols already done above).
    if (cleaned.startsWith('+')) return cleaned;

    // Kenya local formats -> international without plus
    // 07XXXXXXXX / 01XXXXXXXX => 2547XXXXXXXX / 2541XXXXXXXX
    if (/^0\d{9}$/.test(cleaned)) return `254${cleaned.slice(1)}`;

    // Already starts with country code
    if (/^254\d{9}$/.test(cleaned)) return cleaned;

    // Fallback: return cleaned for backend validation to decide
    return cleaned;
};

const AddEditTeacherPage = ({ onSave, onCancel, teacher = null }) => {
    const { user } = useAuth();
    const isEdit = !!teacher;
    // Admins/Head Teachers or the user themselves can edit the email
    const canEditEmail = !isEdit || 
        ['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER'].includes(user?.role) || 
        (user?.id === teacher?.id);
    const { showSuccess, showError } = useNotifications();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        middleName: '',
        email: '',
        phone: '',
        gender: '',
        subject: '',
        password: '',
        kraPin: '',
        nssfNumber: '',
        shifNumber: '',
        bankName: '',
        bankAccountNumber: '',
        basicSalary: ''
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (teacher) {
            setFormData({
                firstName: teacher.firstName || '',
                lastName: teacher.lastName || '',
                middleName: teacher.middleName || '',
                email: teacher.email || '',
                phone: teacher.phone || '',
                gender: teacher.gender || '',
                subject: teacher.subject || '',
                password: '', // Don't populate password for edits
                kraPin: teacher.kraPin || '',
                nssfNumber: teacher.nssfNumber || '',
                shifNumber: teacher.shifNumber || '',
                bankName: teacher.bankName || '',
                bankAccountNumber: teacher.bankAccountNumber || '',
                basicSalary: teacher.basicSalary || ''
            });
        }
    }, [teacher]);

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
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
        if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
        else {
            const normalized = normalizePhoneForApi(formData.phone);
            if (!/^\+?[1-9]\d{1,14}$/.test(normalized)) {
                newErrors.phone = 'Use a valid phone format, e.g. 0712345678 or +254712345678';
            }
        }

        // Password is only required for new teachers
        if (!isEdit && !formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password && formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            showError('Please check the form for errors');
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare data for API
            const teacherData = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                middleName: formData.middleName,
                email: formData.email,
                phone: normalizePhoneForApi(formData.phone),
                gender: formData.gender,
                subject: formData.subject,
                kraPin: formData.kraPin,
                nssfNumber: formData.nssfNumber,
                shifNumber: formData.shifNumber,
                bankName: formData.bankName,
                bankAccountNumber: formData.bankAccountNumber,
                basicSalary: formData.basicSalary
            };

            // Only include password if it's provided
            if (formData.password) {
                teacherData.password = formData.password;
            }

            await onSave(teacherData);
            // Success notification should be handled by the parent or useTeachers hook,
            // but we can show one here if ensuring logic flow
        } catch (error) {
            console.error('Error submitting form:', error);
            showError('Failed to save teacher details');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-12 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onCancel}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-medium text-gray-800">
                        {isEdit ? 'Edit Tutor Details' : 'Add New Tutor'}
                    </h1>
                    <p className="text-gray-500">
                        {isEdit ? 'Update existing tutor information' : 'Create a new tutor account with access privileges'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <User size={20} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-800">Personal Information</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                First Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple transition ${errors.firstName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'}`}
                                placeholder="Enter first name"
                            />
                            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Middle Name
                            </label>
                            <input
                                type="text"
                                name="middleName"
                                value={formData.middleName}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple transition"
                                placeholder="Enter middle name"
                            />
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
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple transition ${errors.lastName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'}`}
                                placeholder="Enter last name"
                            />
                            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Gender
                            </label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple transition"
                            >
                                <option value="">Select Gender</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                            <Mail size={20} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-800">Contact & Professional</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                disabled={!canEditEmail}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple transition ${errors.email ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'} ${!canEditEmail ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''}`}
                                placeholder="email@example.com"
                            />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Phone Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple transition ${errors.phone ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'}`}
                                placeholder="e.g. 0712345678 or +254712345678"
                            />
                            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Teaching Subject (Specialization)
                            </label>
                            <input
                                type="text"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple transition"
                                placeholder="e.g. Mathematics"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                                Primary specialization. Detailed CBC grade & stream allocations are managed in Academic Settings → Subject Allocation.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Government Compliance & Banking */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden border-l-4 border-l-emerald-500">
                    <div className="p-6 border-b border-gray-100 bg-emerald-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                <AlertCircle size={20} />
                            </div>
                            <h3 className="text-lg font-medium text-gray-800 uppercase tracking-tight">Government Compliance & Banking</h3>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100/50 px-2 py-1 rounded uppercase tracking-widest">KRA / NSSF / SHIF</span>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">KRA PIN</label>
                                <input
                                    type="text"
                                    name="kraPin"
                                    value={formData.kraPin}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono placeholder:font-sans"
                                    placeholder="Enter KRA PIN (e.g., A00...)"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">NSSF Number</label>
                                <input
                                    type="text"
                                    name="nssfNumber"
                                    value={formData.nssfNumber}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">SHIF Number</label>
                                <input
                                    type="text"
                                    name="shifNumber"
                                    value={formData.shifNumber}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Bank Name</label>
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-gray-100/50 border border-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 transition-all"
                                    placeholder="Enter Bank Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Account Number</label>
                                <input
                                    type="text"
                                    name="bankAccountNumber"
                                    value={formData.bankAccountNumber}
                                    onChange={handleChange}                                    
                                    className="w-full px-4 py-2 bg-gray-100/50 border border-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                                />
                            </div>
                            <div className="bg-emerald-600 rounded-xl p-4 text-white shadow-lg">
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] mb-1 opacity-80">Monthly Basic Salary</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-semibold italic opacity-60">KES</span>
                                    <input
                                        type="number"
                                        name="basicSalary"
                                        value={formData.basicSalary}
                                        onChange={handleChange}
                                        className="w-full bg-transparent border-none text-2xl font-semibold focus:ring-0 placeholder:text-white/30"
                                        placeholder="0.00"
                                    />
                                </div>
                                <p className="text-[9px] mt-2 font-medium opacity-70 italic">* Used for automated KRA/NSSF/SHIF calculations</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account Security */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                            <BookOpen size={20} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-800">Account Security</h3>
                    </div>
                    <div className="p-6">
                        <div className="max-w-md">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Password {!isEdit && <span className="text-red-500">*</span>}
                                {isEdit && <span className="text-gray-500 text-xs ml-2 font-normal">(Leave empty to keep current password)</span>}
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-purple transition ${errors.password ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'}`}
                                placeholder={isEdit ? "Enter new password (optional)" : "Enter password (min 8 characters)"}
                            />
                            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                            {!isEdit && <p className="text-xs text-gray-500 mt-1">Minimum 8 characters required</p>}
                        </div>
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                            <div className="mt-0.5">
                                <CheckCircle size={16} className="text-blue-600" />
                            </div>
                            <p className="text-sm text-blue-800">
                                The tutor will be created with the role "TEACHER" and can access the system using their email and password.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-8 py-2.5 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition font-semibold shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                {isEdit ? 'Update Tutor' : 'Add Tutor'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddEditTeacherPage;

import React, { useEffect, useState } from 'react';
import { X, Lock, Eye, EyeOff, MessageCircle, Send, Check } from 'lucide-react';
import { userAPI } from '../../../services/api';

const ResetPasswordModal = ({ isOpen, onClose, user, onResetSuccess }) => {
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [sendWhatsApp, setSendWhatsApp] = useState(true);
    const [sendSms, setSendSms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState(null);

    // The modal remains mounted while closed. Reset its local state whenever it
    // is opened so a previous successful reset cannot hide the password form.
    useEffect(() => {
        if (!isOpen) return;
        setNewPassword('');
        setShowPassword(false);
        setSendWhatsApp(true);
        setSendSms(false);
        setSuccess(false);
        setSuccessMessage('');
        setError(null);
    }, [isOpen, user?.id]);

    if (!isOpen || !user) return null;

    const handleReset = async () => {
        if (!newPassword || newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await userAPI.resetPassword(user.id, {
                newPassword,
                sendWhatsApp,
                sendSms
            });

            if (result.success) {
                setSuccess(true);
                setSuccessMessage(result.message || 'Password reset successfully');
                onResetSuccess(result.message || 'Password reset successfully');
            } else {
                setError(result.message || 'Failed to reset password');
            }
        } catch (err) {
            setError(err.message || 'An error occurred during password reset');
        } finally {
            setLoading(false);
        }
    };

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let pass = '';
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewPassword(pass);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-brand-teal px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-white">
                        <Lock size={20} />
                        <h3 className="text-lg font-medium">Issue New Password</h3>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition p-1 hover:bg-white/10 rounded-lg">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {success ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                                <Check size={48} className="animate-bounce" />
                            </div>
                            <div className="text-center space-y-2">
                                <h4 className="text-xl font-medium text-gray-900">Password Reset Successfully!</h4>
                                <p className="text-sm text-gray-500">{successMessage}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-brand-teal text-white rounded-xl hover:bg-brand-teal/90 font-medium transition shadow-md"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* User Info */}
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="w-12 h-12 bg-brand-teal text-white rounded-full flex items-center justify-center font-medium text-lg shadow-sm">
                                    {user.firstName[0]}{user.lastName[0]}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-gray-500">{user.email}</p>
                                    {user.phone && <p className="text-[10px] text-brand-teal font-medium mt-0.5">{user.phone}</p>}
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-gray-700">New Password</label>
                                    <button
                                        onClick={generatePassword}
                                        className="text-xs text-brand-teal font-medium hover:underline"
                                    >
                                        Generate Random
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal focus:bg-white transition-all outline-none font-mono"
                                        placeholder="Enter 8+ characters"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                {error && <p className="text-xs text-red-500 font-medium animate-pulse">{error}</p>}
                            </div>

                            {/* Notifications */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-gray-700">Send New Credentials Via:</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setSendWhatsApp(!sendWhatsApp)}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${sendWhatsApp
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                : 'bg-white border-gray-200 text-gray-500 grayscale'
                                            }`}
                                        disabled={!user.phone}
                                    >
                                        <div className="flex items-center gap-2">
                                            <MessageCircle size={18} />
                                            <span className="text-sm font-medium">WhatsApp</span>
                                        </div>
                                        {sendWhatsApp && <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white"><Check size={10} /></div>}
                                    </button>

                                    <button
                                        onClick={() => setSendSms(!sendSms)}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${sendSms
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-white border-gray-200 text-gray-500 grayscale'
                                            }`}
                                        disabled={!user.phone}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Send size={18} />
                                            <span className="text-sm font-medium">SMS</span>
                                        </div>
                                        {sendSms && <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white"><Check size={10} /></div>}
                                    </button>
                                </div>
                                {!user.phone && <p className="text-[10px] text-amber-600 font-medium italic">User has no phone number registered.</p>}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition shadow-sm"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReset}
                                    disabled={loading || !newPassword}
                                    className="flex-1 bg-brand-teal text-white px-6 py-3 rounded-xl hover:bg-brand-teal/90 font-medium transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Lock size={18} />
                                            Reset Now
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordModal;

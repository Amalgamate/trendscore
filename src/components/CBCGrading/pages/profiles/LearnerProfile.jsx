import React, { useState, useEffect } from 'react';
import {
    User, Calendar, MapPin, Users, Heart,
    GraduationCap, Receipt, FileText, Activity,
    Download, AlertCircle, Camera, Plus, Bus, Zap, TrendingUp, Brain, Lock
} from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../hooks/useAuth';
import { generatePDFFromElement } from '../../../../utils/simplePdfGenerator';
import StatusBadge from '../../shared/StatusBadge';
import ProfileHeader from '../../shared/ProfileHeader';
import ProfileLayout from '../../shared/ProfileLayout';
import { useNotifications } from '../../hooks/useNotifications';
import ProfilePhotoModal from '../../shared/ProfilePhotoModal';
import PathwaysWizard from './PathwaysWizard';

const LearnerProfile = ({ learner: initialLearner, onBack, brandingSettings, onNavigate }) => {
    const { showSuccess, showError } = useNotifications();
    const { user } = useAuth();
    const [currentLearner, setCurrentLearner] = useState(initialLearner);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [transportAssignments, setTransportAssignments] = useState([]);
    const [aiData, setAiData] = useState({ feedback: '', risk: '', trend: null });

    const [showPhotoModal, setShowPhotoModal] = useState(false);

    useEffect(() => {
        if (initialLearner && initialLearner.id !== currentLearner?.id) {
            setCurrentLearner(initialLearner);
        }
    }, [initialLearner]);

    useEffect(() => {
        const fetchLearnerDetails = async () => {
            if (initialLearner?.id) {
                try {
                    const response = await api.learners.getById(initialLearner.id);
                    if (response.success || response.data) {
                        setCurrentLearner(response.data || response);
                    }
                } catch (error) {
                    console.error('Failed to fetch latest learner details:', error);
                }
            }
        };
        fetchLearnerDetails();
    }, [initialLearner?.id]);

    useEffect(() => {
        if (currentLearner?.id) {
            fetchTabData('academic');
            fetchTabData('financials');
            if (activeTab !== 'overview' && activeTab !== 'academic' && activeTab !== 'financials' && activeTab !== 'pathways') {
                fetchTabData(activeTab);
            }
        }
    }, [activeTab, currentLearner?.id]);

    const fetchTabData = async (targetTab = activeTab) => {
        if (!currentLearner?.id) return;
        setLoading(true);
        try {
            if (targetTab === 'financials') {
                const response = await api.fees.getLearnerInvoices(currentLearner.id);
                const data = response.data || response;
                setInvoices(Array.isArray(data) ? data : []);
            } else if (targetTab === 'academic') {
                const data = await api.assessments.getSummativeByLearner(currentLearner.id);
                setAssessments(data?.success ? data.data : (Array.isArray(data) ? data : (data?.data || [])));
            } else if (targetTab === 'transport') {
                const res = await api.transport.getLearnerAssignments(currentLearner.id);
                setTransportAssignments(res.success ? (res.data || []) : []);
            } else if (targetTab === 'ai-insights') {
                const [feedbackRes, riskRes, trendRes] = await Promise.all([
                    api.ai.generateFeedback(currentLearner.id, 'TERM_1', 2026),
                    api.ai.analyzeRisk(currentLearner.id),
                    api.ai.getTrend(currentLearner.id)
                ]);
                setAiData({
                    feedback: feedbackRes.success ? feedbackRes.data : feedbackRes,
                    risk: riskRes.success ? riskRes.data : riskRes,
                    trend: trendRes.success ? trendRes.data : trendRes
                });
            }
        } catch (error) {
            console.error('Error fetching tab data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePhoto = async (photoData) => {
        try {
            const learnerId = currentLearner?.id || initialLearner?.id;
            const response = await api.learners.uploadPhoto(learnerId, photoData);
            if (response?.success) {
                showSuccess('Profile photo updated successfully');
                setCurrentLearner(prev => ({
                    ...prev,
                    photoUrl: response.data?.photoUrl || photoData
                }));
                return true;
            }
            showError(response?.error || 'Failed to update profile photo');
            return false;
        } catch (error) {
            console.error('Failed to upload photo:', error);
            showError('Failed to update profile photo');
            return false;
        }
    };

    const calculateAge = (dateOfBirth) => {
        if (!dateOfBirth) return 'N/A';
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    };

    const feeBalance = invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
    const isSecondaryLearner = currentLearner?.institutionType === 'SECONDARY';

    const tabs = [
        { id: 'overview',    label: 'Overview',    icon: User          },
        { id: 'financials',  label: 'Financials',  icon: Receipt       },
        { id: 'academic',    label: 'Academic',    icon: GraduationCap },
        { id: 'transport',   label: 'Transport',   icon: Bus           },
        { id: 'ai-insights', label: 'AI Insights', icon: Brain         },
        ...(isSecondaryLearner ? [{ id: 'pathways', label: 'Pathways', icon: Activity }] : []),
        { id: 'medical',     label: 'Medical',     icon: Heart         },
        { id: 'documents',   label: 'Documents',   icon: FileText      },
    ];

    if (!currentLearner) return null;

    return (
        <ProfileLayout
            title="Student Profile"
            onBack={onBack}
            primaryAction={{
                label: "Edit Profile",
                icon: FileText,
                onClick: () => onNavigate('learners-admissions', { learner: currentLearner })
            }}
        >
            <ProfileHeader
                name={`${currentLearner.firstName} ${currentLearner.middleName || ''} ${currentLearner.lastName}`}
                avatar={currentLearner.photoUrl}
                avatarFallback={`${currentLearner.firstName?.[0]}${currentLearner.lastName?.[0]}`}
                status={currentLearner.status}
                bannerColor="brand-purple"
                compact={true}
                badges={[
                    { text: currentLearner.admissionNumber, icon: GraduationCap, className: "bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-md" },
                    { text: `${currentLearner.grade} ${currentLearner.stream || ''}`, className: "font-medium text-gray-700" }
                ]}
                quickStats={[
                    { label: "Age", value: `${calculateAge(currentLearner.dateOfBirth)} years` },
                    {
                        label: "Fee Balance",
                        value: `KES ${feeBalance.toLocaleString()}`,
                        className: feeBalance > 0 ? 'text-red-500' : 'text-emerald-600'
                    }
                ]}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onPhotoClick={() => setShowPhotoModal(true)}
            />

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {loading && activeTab !== 'pathways' ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
                    </div>
                ) : (
                    <>
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                                {/* Personal Info Card */}
                                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                        <User className="text-brand-purple" size={18} />
                                        <h3 className="text-base font-medium text-gray-800">Personal Data</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <InfoRow label="Date of Birth" value={currentLearner.dateOfBirth ? new Date(currentLearner.dateOfBirth).toLocaleDateString() : 'N/A'} />
                                        <InfoRow label="Gender" value={currentLearner.gender} />
                                        <InfoRow label="Nationality" value={currentLearner.nationality || 'Kenyan'} />
                                        <InfoRow label="Religion" value={currentLearner.religion || 'Christian'} />
                                    </div>
                                </div>

                                {/* Academic Info Card */}
                                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                        <Calendar className="text-brand-teal" size={18} />
                                        <h3 className="text-base font-medium text-gray-800">Academic</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <InfoRow label="Adm Number" value={currentLearner.admissionNumber} />
                                        <InfoRow label="Date of Adm" value={currentLearner.dateOfAdmission ? new Date(currentLearner.dateOfAdmission).toLocaleDateString() : 'N/A'} />
                                        <InfoRow label="Current Grade" value={currentLearner.grade} />
                                        <InfoRow label="Stream" value={currentLearner.stream} />
                                    </div>
                                </div>

                                {/* Contacts Info Card */}
                                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                        <Users className="text-blue-500" size={18} />
                                        <h3 className="text-base font-medium text-gray-800">Contacts</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="pb-3 border-b border-dashed border-gray-100 last:border-0 last:pb-0">
                                            <p className="text-[10px] font-semibold uppercase text-blue-500 mb-1 tracking-wider">👨 Father</p>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-gray-800">{currentLearner.fatherName || 'N/A'}</p>
                                                {currentLearner.fatherPhone && (
                                                    <p className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                                                        <span className="opacity-50">📱</span> {currentLearner.fatherPhone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="pb-3 border-b border-dashed border-gray-100 last:border-0 last:pb-0">
                                            <p className="text-[10px] font-semibold uppercase text-amber-500 mb-1 tracking-wider">👩 Mother</p>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-gray-800">{currentLearner.motherName || 'N/A'}</p>
                                                {currentLearner.motherPhone && (
                                                    <p className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                                                        <span className="opacity-50">📱</span> {currentLearner.motherPhone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase text-rose-500 mb-1 tracking-wider">👤 Parent/Guardian</p>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-gray-800">{currentLearner.guardianName || 'N/A'} {currentLearner.guardianRelation && `(${currentLearner.guardianRelation})`}</p>
                                                {currentLearner.guardianPhone && (
                                                    <p className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                                                        <span className="opacity-50">📱</span> {currentLearner.guardianPhone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                            <MapPin className="text-orange-500" size={18} />
                                            <h3 className="text-base font-medium text-gray-800">Location Details</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InfoRow label="County" value={currentLearner.county || 'N/A'} />
                                            <InfoRow label="Address" value={currentLearner.address || 'N/A'} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FINANCIALS TAB */}
                        {activeTab === 'financials' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-800">Fee Statement</h3>
                                                <p className="text-sm text-gray-500">Recent invoices and payments</p>
                                            </div>
                                            {onNavigate && feeBalance > 0 && (
                                                <button
                                                    onClick={() => onNavigate('fees-collection', { learnerId: currentLearner.id })}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm text-xs font-medium uppercase tracking-wider"
                                                >
                                                    <Plus size={14} />
                                                    Record Payment
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500 mb-1">Total Outstanding</p>
                                            <p className="text-3xl font-medium text-brand-purple">
                                                KES {feeBalance.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    {invoices.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm text-gray-600">
                                                <thead className="uppercase text-xs border-b border-[color:var(--table-border)]">
                                                    <tr>
                                                        <th className="px-6 py-4 font-semibold text-[color:var(--table-header-fg)]">Invoice #</th>
                                                        <th className="px-6 py-4 font-semibold text-[color:var(--table-header-fg)]">Date</th>
                                                        <th className="px-6 py-4 font-semibold text-[color:var(--table-header-fg)]">Description</th>
                                                        <th className="px-6 py-4 text-right font-semibold text-[color:var(--table-header-fg)]">Amount</th>
                                                        <th className="px-6 py-4 text-center font-semibold text-[color:var(--table-header-fg)]">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {invoices.map((inv) => (
                                                        <tr key={inv.id} className="hover:bg-gray-50/50 text-xs">
                                                            <td className="px-6 py-4 font-medium text-gray-900">{inv.invoiceNumber}</td>
                                                            <td className="px-6 py-4">
                                                                {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="font-medium text-gray-800">{inv.feeStructure?.name || 'Academic Fee'}</p>
                                                                <p className="text-[10px] opacity-60 uppercase">{inv.feeStructure?.term?.replace('_', ' ')} • {inv.feeStructure?.academicYear}</p>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="font-semibold text-gray-900">KES {Number(inv.totalAmount || inv.amount).toLocaleString()}</div>
                                                                <div className="text-[10px] text-red-500 font-medium">Bal: {Number(inv.balance).toLocaleString()}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {inv.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                                            <Receipt size={48} className="mb-4 text-gray-200" />
                                            <p>No financial records found for this student.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ACADEMIC TAB */}
                        {activeTab === 'academic' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-lg font-medium text-gray-800 mb-6">Recent Assessments</h3>
                                    {assessments.length > 0 ? (
                                        <div className="space-y-4">
                                            {assessments.map((assessment, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-brand-purple/30 transition">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-3 bg-white rounded-lg border border-gray-200 text-brand-purple">
                                                            <Activity size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium text-gray-800">{assessment.test?.name || 'Assessment'}</h4>
                                                            <p className="text-sm text-gray-500">
                                                                {assessment.test?.subject} • {assessment.test?.term} • {assessment.createdAt ? new Date(assessment.createdAt).toLocaleDateString() : 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-2xl font-medium text-gray-900">{assessment.score}%</p>
                                                        <p className="text-xs font-semibold text-gray-500 uppercase">{assessment.grade}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                                            <GraduationCap size={48} className="mb-4 text-gray-200" />
                                            <p>No assessment records found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TRANSPORT TAB */}
                        {activeTab === 'transport' && (
                            <div className="animate-fade-in">
                                <div className="mb-4 flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                                        currentLearner.isTransportStudent
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        <Bus size={12} />
                                        {currentLearner.isTransportStudent ? 'Transport Student' : 'Not a Transport Student'}
                                    </span>
                                    {onNavigate && (
                                        <button
                                            onClick={() => onNavigate('transport-routes')}
                                            className="text-xs text-blue-600 font-medium hover:underline"
                                        >
                                            Manage in Transport module →
                                        </button>
                                    )}
                                </div>

                                {transportAssignments.length > 0 ? (
                                    <div className="space-y-4">
                                        {transportAssignments.map(a => (
                                            <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                        <Bus size={18} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-gray-900 text-base">{a.route?.name || 'Unknown Route'}</p>
                                                        {a.route?.description && (
                                                            <p className="text-xs text-gray-400 mt-0.5">{a.route.description}</p>
                                                        )}
                                                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Route Fee</p>
                                                                <p className="text-sm font-semibold text-emerald-600">
                                                                    KES {Number(a.route?.amount || 0).toLocaleString()}
                                                                </p>
                                                            </div>
                                                            {a.route?.vehicle && (
                                                                <div>
                                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Vehicle</p>
                                                                    <p className="text-sm font-medium text-gray-700">{a.route.vehicle.registrationNumber}</p>
                                                                </div>
                                                            )}
                                                            {a.route?.vehicle?.driverName && (
                                                                <div>
                                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Driver</p>
                                                                    <p className="text-sm font-medium text-gray-700">{a.route.vehicle.driverName}</p>
                                                                    {a.route.vehicle.driverPhone && (
                                                                        <p className="text-[11px] text-gray-400">{a.route.vehicle.driverPhone}</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {(a.pickupPoint || a.dropoffPoint) && (
                                                                <div>
                                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Stop</p>
                                                                    {a.pickupPoint  && <p className="text-[11px] font-medium text-gray-700">📍 {a.pickupPoint}</p>}
                                                                    {a.dropoffPoint && <p className="text-[11px] font-medium text-gray-700">🏁 {a.dropoffPoint}</p>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                                                        a.status === 'ACTIVE'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {a.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center">
                                        <Bus size={48} className="mb-4 text-gray-200" />
                                        <p className="font-medium text-gray-500">Not assigned to any transport route</p>
                                        {onNavigate && (
                                            <button
                                                onClick={() => onNavigate('transport-routes')}
                                                className="mt-4 text-sm text-blue-600 font-medium hover:underline"
                                            >
                                                Go to Transport module to assign →
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PATHWAYS TAB */}
                        {activeTab === 'pathways' && isSecondaryLearner && (
                            <div className="animate-fade-in">
                                <PathwaysWizard learner={currentLearner} brandingSettings={brandingSettings} />
                            </div>
                        )}

                        {/* MEDICAL TAB */}
                        {activeTab === 'medical' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                                        <Heart className="text-red-500" size={20} />
                                        <h3 className="text-lg font-medium text-gray-800">Medical Conditions</h3>
                                    </div>
                                    {currentLearner.medicalConditions ? (
                                        <div className="p-4 bg-red-50 rounded-lg border border-red-100 text-red-900">
                                            {currentLearner.medicalConditions}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                                            <AlertCircle size={32} className="mb-2 text-gray-200" />
                                            <p>No known medical conditions.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                                        <AlertCircle className="text-orange-500" size={20} />
                                        <h3 className="text-lg font-medium text-gray-800">Allergies</h3>
                                    </div>
                                    {currentLearner.allergies ? (
                                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 text-orange-900">
                                            {currentLearner.allergies}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                                            <AlertCircle size={32} className="mb-2 text-gray-200" />
                                            <p>No known allergies.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* DOCUMENTS TAB */}
                        {activeTab === 'documents' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="text-lg font-medium text-gray-800">Attached Documents</h3>
                                    <button className="text-sm text-brand-purple font-medium hover:underline">Upload New</button>
                                </div>
                                <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                                    <FileText size={48} className="mb-4 text-gray-200" />
                                    <p className="font-medium">No documents uploaded yet</p>
                                    <p className="text-sm mt-1">Upload student documents to view them here</p>
                                </div>
                            </div>
                        )}

                        {/* AI INSIGHTS TAB */}
                        {activeTab === 'ai-insights' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                            <Brain className="text-brand-purple" size={20} />
                                            <h3 className="text-lg font-medium text-gray-800">AI Teacher Commentary</h3>
                                        </div>
                                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-sm text-purple-900 leading-relaxed italic">
                                            "{aiData.feedback || 'Analyzing performance data...'}"
                                        </div>
                                        <p className="mt-3 text-[10px] text-gray-400 uppercase font-semibold tracking-wider flex items-center gap-1">
                                            <Zap size={10} className="text-amber-500" /> Powered by TrendScore AI Analysis Engine
                                        </p>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                            <AlertCircle className="text-rose-500" size={20} />
                                            <h3 className="text-lg font-medium text-gray-800">Risk Assessment</h3>
                                        </div>
                                        <div className="whitespace-pre-line text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                            {aiData.risk || 'Calculating risk factors...'}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="text-brand-teal" size={20} />
                                            <h3 className="text-lg font-medium text-gray-800">Longitudinal Performance Trend</h3>
                                        </div>
                                        {aiData.trend && (
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                                                aiData.trend.status === 'IMPROVING' ? 'bg-emerald-100 text-emerald-700' :
                                                aiData.trend.status === 'DECLINING' ? 'bg-rose-100 text-rose-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {aiData.trend.status}
                                            </span>
                                        )}
                                    </div>

                                    {aiData.trend?.trend?.length > 0 ? (
                                        <div className="space-y-4">
                                            <div className="flex items-end gap-2 h-32 px-4 border-b border-gray-100">
                                                {aiData.trend.trend.map((pt, i) => (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                                        <div
                                                            className="w-full bg-brand-purple/20 group-hover:bg-brand-purple/40 rounded-t-sm transition-all duration-500 relative"
                                                            style={{ height: `${pt.percentage}%` }}
                                                        >
                                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-brand-purple opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                                {pt.percentage}%
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                                                            {pt.period}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-medium px-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-brand-purple/40"></div>
                                                        <span className="text-gray-500">Term Average %</span>
                                                    </div>
                                                </div>
                                                <p className="text-gray-500">
                                                    Term-over-term growth: <span className={aiData.trend.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                        {aiData.trend.growth >= 0 ? '+' : ''}{aiData.trend.growth}%
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-gray-400">
                                            <TrendingUp size={48} className="mx-auto mb-3 opacity-20" />
                                            <p>Insufficient historical data to plot performance trends.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <ProfilePhotoModal
                isOpen={showPhotoModal}
                onClose={() => setShowPhotoModal(false)}
                onSave={handleSavePhoto}
                currentPhoto={currentLearner.photoUrl}
            />
        </ProfileLayout>
    );
};

const InfoRow = ({ label, value }) => (
    <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
);

export default LearnerProfile;

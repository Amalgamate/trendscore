import React, { useState, useEffect } from 'react';
import {
    User, Calendar, MapPin, Users, Heart,
    GraduationCap, Receipt, FileText, Activity,
    AlertCircle, Camera, Plus, Bus, Zap, TrendingUp, Brain,
    Bookmark, Gift, CreditCard
} from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../hooks/useAuth';
import StatusBadge from '../../shared/StatusBadge';
import ProfileLayout from '../../shared/ProfileLayout';
import { useNotifications } from '../../hooks/useNotifications';
import ProfilePhotoModal from '../../shared/ProfilePhotoModal';
import PathwaysWizard from './PathwaysWizard';
import LearnerFeeConfigurator from './LearnerFeeConfigurator';
import LearnerAcademicTab from './LearnerAcademicTab';

const CompactLearnerHeader = ({
    learner,
    name,
    avatarFallback,
    feeBalance,
    age,
    tabs,
    activeTab,
    onTabChange,
    onPhotoClick
}) => (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <button
                type="button"
                onClick={onPhotoClick}
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white bg-brand-purple text-xl font-semibold text-white shadow ring-1 ring-gray-200"
                title="Change profile photo"
            >
                {learner.photoUrl ? (
                    <img src={learner.photoUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                    <span className="flex h-full w-full items-center justify-center">{avatarFallback}</span>
                )}
                <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
                    <Camera size={18} />
                </span>
            </button>

            <div className="min-w-[220px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight text-gray-950">{name}</h2>
                    <StatusBadge status={learner.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-semibold">
                        <GraduationCap size={14} className="text-gray-400" />
                        {learner.admissionNumber}
                    </span>
                    <span className="font-semibold">{learner.grade} {learner.stream || ''}</span>
                </div>
            </div>

            <div className="grid min-w-[280px] grid-cols-2 gap-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Age</p>
                    <p className="text-sm font-semibold text-gray-950">{age} years</p>
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-500">Fee Balance</p>
                    <p className={`text-sm font-semibold ${feeBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        KES {feeBalance.toLocaleString()}
                    </p>
                </div>
            </div>
        </div>

        <div className="flex overflow-x-auto border-t border-gray-100 bg-gray-50/70 px-4 py-2 no-print">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`mr-2 flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${activeTab === tab.id
                        ? 'bg-white text-brand-purple shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-600 hover:bg-white hover:text-gray-950'
                    }`}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    </section>
);

const LearnerProfile = ({ learner: initialLearner, onBack, brandingSettings, onNavigate }) => {
    const { showSuccess, showError } = useNotifications();
    const { user } = useAuth();
    const [currentLearner, setCurrentLearner] = useState(initialLearner);
    const [activeTab, setActiveTab] = useState('overview');
    const [financeTab, setFinanceTab] = useState('configuration');
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

    const activePledges = invoices.flatMap((invoice) =>
        (invoice.pledges || [])
            .filter((pledge) => ['PENDING', 'DUE'].includes(pledge.status))
            .map((pledge) => ({ ...pledge, invoice }))
    );
    const feeWaivers = invoices.flatMap((invoice) =>
        (invoice.waivers || []).map((waiver) => ({ ...waiver, invoice }))
    );
    const creditInvoices = invoices.filter((invoice) => Number(invoice.balance || 0) < 0);
    const financeTabs = [
        { id: 'configuration', label: 'Fee Configuration', icon: CreditCard },
        { id: 'statement', label: 'Fee Statement', icon: Receipt },
        { id: 'pledges', label: 'Pledges', icon: Bookmark, count: activePledges.length },
        { id: 'waivers', label: 'Waivers', icon: Gift, count: feeWaivers.length },
        { id: 'credits', label: 'Credits & Adjustments', icon: TrendingUp, count: creditInvoices.length },
    ];

    if (!currentLearner) return null;

    const handleReviseInvoice = async (invoice) => {
        const reason = window.prompt('Reason for revising this unpaid invoice using the approved fee configuration:');
        if (!reason) return;
        try {
            await api.fees.reviseInvoiceFromConfiguration(invoice.id, reason);
            showSuccess('Invoice revised successfully');
            await fetchTabData('financials');
        } catch (error) {
            showError(error.message || 'Failed to revise invoice');
        }
    };

    return (
        <ProfileLayout
            title="Student Profile"
            onBack={onBack}
            compact
            primaryAction={{
                label: "Edit Profile",
                icon: FileText,
                onClick: () => onNavigate('learners-admissions', { learner: currentLearner })
            }}
        >
            <CompactLearnerHeader
                learner={currentLearner}
                name={`${currentLearner.firstName} ${currentLearner.middleName || ''} ${currentLearner.lastName}`}
                avatarFallback={`${currentLearner.firstName?.[0] || ''}${currentLearner.lastName?.[0] || ''}`}
                age={calculateAge(currentLearner.dateOfBirth)}
                feeBalance={feeBalance}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onPhotoClick={() => setShowPhotoModal(true)}
            />

            {/* Tab Content */}
            <div className="mt-3 min-h-[400px]">
                {loading && activeTab !== 'pathways' ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
                    </div>
                ) : (
                    <>
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                {/* Personal Info Card */}
                                <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                        <User className="text-brand-purple" size={18} />
                                        <h3 className="text-base font-medium text-gray-800">Personal Data</h3>
                                    </div>
                                    <div className="space-y-2.5">
                                        <InfoRow label="Date of Birth" value={currentLearner.dateOfBirth ? new Date(currentLearner.dateOfBirth).toLocaleDateString() : 'N/A'} />
                                        <InfoRow label="Gender" value={currentLearner.gender} />
                                        <InfoRow label="Nationality" value={currentLearner.nationality || 'Kenyan'} />
                                        <InfoRow label="Religion" value={currentLearner.religion || 'Christian'} />
                                    </div>
                                </div>

                                {/* Academic Info Card */}
                                <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                        <Calendar className="text-brand-teal" size={18} />
                                        <h3 className="text-base font-medium text-gray-800">Academic</h3>
                                    </div>
                                    <div className="space-y-2.5">
                                        <InfoRow label="Adm Number" value={currentLearner.admissionNumber} />
                                        <InfoRow label="Date of Adm" value={currentLearner.dateOfAdmission ? new Date(currentLearner.dateOfAdmission).toLocaleDateString() : 'N/A'} />
                                        <InfoRow label="Current Grade" value={currentLearner.grade} />
                                        <InfoRow label="Stream" value={currentLearner.stream} />
                                    </div>
                                </div>

                                {/* Contacts Info Card */}
                                <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                        <Users className="text-blue-500" size={18} />
                                        <h3 className="text-base font-medium text-gray-800">Contacts</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="pb-2.5 border-b border-dashed border-gray-100 last:border-0 last:pb-0">
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
                                        <div className="pb-2.5 border-b border-dashed border-gray-100 last:border-0 last:pb-0">
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

                                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
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
                            <div className="space-y-4 animate-fade-in">
                                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-3 py-2">
                                        <div className="flex gap-2 overflow-x-auto">
                                            {financeTabs.map((tab) => {
                                                const Icon = tab.icon;
                                                const active = financeTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setFinanceTab(tab.id)}
                                                        className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${active
                                                            ? 'bg-slate-950 text-white shadow-sm'
                                                            : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-gray-950'
                                                        }`}
                                                    >
                                                        <Icon size={15} />
                                                        {tab.label}
                                                        {tab.count > 0 && (
                                                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                                {tab.count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {onNavigate && feeBalance > 0 && (
                                            <button
                                                onClick={() => onNavigate('fees-collection', { learnerId: currentLearner.id })}
                                                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-sm transition hover:bg-green-700"
                                            >
                                                <Plus size={14} />
                                                Record Payment
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {financeTab === 'configuration' && (
                                    <LearnerFeeConfigurator
                                        learner={currentLearner}
                                        user={user}
                                        onChanged={() => fetchTabData('financials')}
                                    />
                                )}

                                {financeTab === 'pledges' && (
                                    <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                                        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
                                            <Bookmark size={17} className="text-amber-600" /> Pledges
                                        </h3>
                                        {activePledges.length > 0 ? (
                                            <div className="divide-y divide-gray-100">
                                                {activePledges.map((pledge) => (
                                                    <div key={pledge.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">KES {Number(pledge.pledgedAmount || 0).toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500">Invoice {pledge.invoice?.invoiceNumber} · Due {pledge.pledgeDate ? new Date(pledge.pledgeDate).toLocaleDateString() : 'N/A'}</p>
                                                        </div>
                                                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">{pledge.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">No active payment pledges for this learner.</p>
                                        )}
                                    </div>
                                )}

                                {financeTab === 'waivers' && (
                                    <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
                                        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
                                            <Gift size={17} className="text-teal-600" /> Waivers
                                        </h3>
                                        {feeWaivers.length > 0 ? (
                                            <div className="divide-y divide-gray-100">
                                                {feeWaivers.map((waiver) => (
                                                    <div key={waiver.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">KES {Number(waiver.amountWaived || 0).toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500">Invoice {waiver.invoice?.invoiceNumber} · {waiver.reason || 'No reason recorded'}</p>
                                                        </div>
                                                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase text-teal-700">{waiver.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">No waivers recorded for this learner.</p>
                                        )}
                                    </div>
                                )}

                                {financeTab === 'credits' && (
                                    <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
                                        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
                                            <TrendingUp size={17} className="text-indigo-600" /> Credits & Adjustments
                                        </h3>
                                        {creditInvoices.length > 0 ? (
                                            <div className="divide-y divide-gray-100">
                                                {creditInvoices.map((invoice) => (
                                                    <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">Credit on {invoice.invoiceNumber}</p>
                                                            <p className="text-xs text-gray-500">{invoice.feeStructure?.term?.replace('_', ' ')} · {invoice.feeStructure?.academicYear}</p>
                                                        </div>
                                                        <span className="font-bold text-indigo-700">KES {Math.abs(Number(invoice.balance || 0)).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">No credit balances or manual adjustments are currently recorded.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'financials' && financeTab === 'statement' && (
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
                                                        {user?.role === 'ADMIN' && <th className="px-6 py-4 text-right font-semibold text-[color:var(--table-header-fg)]">Action</th>}
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
                                                                 {Number(inv.sponsorAmount || 0) > 0 && (
                                                                     <div className="text-[10px] font-medium text-indigo-600">Sponsor: KES {Number(inv.sponsorAmount).toLocaleString()}</div>
                                                                 )}
                                                                 <div className="text-[10px] text-red-500 font-medium">Bal: {Number(inv.balance).toLocaleString()}</div>
                                                             </td>
                                                            <td className="px-6 py-4 text-center">
                                                                 <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {inv.status}
                                                                 </span>
                                                             </td>
                                                             {user?.role === 'ADMIN' && (
                                                                 <td className="px-6 py-4 text-right">
                                                                     {Number(inv.paidAmount || 0) === 0 && inv.status !== 'CANCELLED' && (
                                                                         <button
                                                                             onClick={() => handleReviseInvoice(inv)}
                                                                             className="rounded-md border border-indigo-200 px-2.5 py-1.5 text-[10px] font-semibold uppercase text-indigo-700 hover:bg-indigo-50"
                                                                         >
                                                                             Revise Invoice
                                                                         </button>
                                                                     )}
                                                                 </td>
                                                             )}
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
                            <div className="animate-fade-in">
                                <LearnerAcademicTab
                                    assessments={assessments}
                                    learnerId={currentLearner?.id}
                                    loading={loading}
                                />
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

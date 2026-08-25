import React, { useState, useEffect } from 'react';
import {
    User, Calendar, MapPin, Users, Heart,
    GraduationCap, Receipt, FileText, Activity,
    AlertCircle, Camera, Plus, Bus, Zap, TrendingUp, Brain,
    Bookmark, Gift, CreditCard, X, Loader2, CheckCircle, Phone
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
    const [availableRoutes, setAvailableRoutes] = useState([]);
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [savingTransport, setSavingTransport] = useState(false);
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
                // Also load available routes so the picker modal works
                const routeRes = await api.transport.getRoutes();
                if (routeRes.success) setAvailableRoutes(routeRes.data || []);
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

    // ── Transport toggle & assignment handlers ────────────────────────────────

    const handleTransportToggle = async () => {
        const newValue = !currentLearner.isTransportStudent;
        setSavingTransport(true);
        try {
            if (!newValue) {
                // Turning OFF — remove all active assignments, then update flag
                const active = transportAssignments.filter(a => !a.archived);
                await Promise.all(active.map(a => api.transport.deleteAssignment(a.id)));
                await api.learners.update(currentLearner.id, { isTransportStudent: false });
                setTransportAssignments([]);
                setCurrentLearner(prev => ({ ...prev, isTransportStudent: false }));
                showSuccess('Transport removed — fee will no longer be charged');
            } else {
                // Turning ON — update flag, then open route picker if routes exist
                await api.learners.update(currentLearner.id, { isTransportStudent: true });
                setCurrentLearner(prev => ({ ...prev, isTransportStudent: true }));
                if (availableRoutes.length > 0) {
                    setShowRouteModal(true);
                } else {
                    showSuccess('Marked as transport student. Assign a route from the Transport module to set the fee.');
                }
            }
        } catch (err) {
            showError(err?.message || 'Failed to update transport status');
        } finally {
            setSavingTransport(false);
        }
    };

    const handleAssignRoute = async (routeId) => {
        setSavingTransport(true);
        try {
            // Remove any existing active assignment first
            const active = transportAssignments.filter(a => !a.archived);
            await Promise.all(active.map(a => api.transport.deleteAssignment(a.id)));
            const res = await api.transport.createAssignment({
                routeId,
                passengerId: currentLearner.id,
                passengerType: 'LEARNER',
            });
            if (res.success) {
                const fresh = await api.transport.getLearnerAssignments(currentLearner.id);
                setTransportAssignments(fresh.success ? (fresh.data || []) : []);
                setShowRouteModal(false);
                const route = availableRoutes.find(r => r.id === routeId);
                showSuccess(`Assigned to ${route?.name || 'route'} — transport fee applied to invoice`);
            }
        } catch (err) {
            showError(err?.message || 'Failed to assign route');
        } finally {
            setSavingTransport(false);
        }
    };

    const handleRemoveAssignment = async (assignmentId) => {
        setSavingTransport(true);
        try {
            await api.transport.deleteAssignment(assignmentId);
            const fresh = await api.transport.getLearnerAssignments(currentLearner.id);
            setTransportAssignments(fresh.success ? (fresh.data || []) : []);
            showSuccess('Removed from route');
        } catch (err) {
            showError(err?.message || 'Failed to remove assignment');
        } finally {
            setSavingTransport(false);
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
                            <div className="animate-fade-in space-y-4">

                                {/* Toggle card */}
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${currentLearner.isTransportStudent ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                <Bus size={18} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">
                                                    {currentLearner.isTransportStudent ? 'Transport Student' : 'Not a Transport Student'}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {currentLearner.isTransportStudent
                                                        ? 'A transport fee will be added to this student\'s invoice'
                                                        : 'Toggle on to mark as transport student and assign a route'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Toggle */}
                                            <button
                                                type="button"
                                                disabled={savingTransport}
                                                onClick={handleTransportToggle}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${currentLearner.isTransportStudent ? 'bg-blue-500' : 'bg-gray-200'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${currentLearner.isTransportStudent ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                            {savingTransport && <Loader2 size={14} className="animate-spin text-blue-400" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Route assignment */}
                                {currentLearner.isTransportStudent && (
                                    <div>
                                        {transportAssignments.filter(a => !a.archived).length > 0 ? (
                                            <div className="space-y-3">
                                                {transportAssignments.filter(a => !a.archived).map(a => (
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
                                                                        <p className="text-sm font-semibold text-emerald-600">KES {Number(a.route?.amount || 0).toLocaleString()}</p>
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
                                                                                <a href={`tel:${a.route.vehicle.driverPhone}`} className="text-[11px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                                                                                    <Phone size={9} />{a.route.vehicle.driverPhone}
                                                                                </a>
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
                                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-700">{a.status}</span>
                                                                {availableRoutes.length > 0 && (
                                                                    <button
                                                                        onClick={() => setShowRouteModal(true)}
                                                                        disabled={savingTransport}
                                                                        className="text-[11px] text-blue-600 font-medium hover:underline disabled:opacity-50"
                                                                    >
                                                                        Change route
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleRemoveAssignment(a.id)}
                                                                    disabled={savingTransport}
                                                                    className="text-[11px] text-red-400 font-medium hover:text-red-600 hover:underline disabled:opacity-50"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {/* Assign to different route */}
                                                {availableRoutes.length > 1 && (
                                                    <button
                                                        onClick={() => setShowRouteModal(true)}
                                                        className="w-full py-2.5 border-2 border-dashed border-blue-200 rounded-xl text-xs font-semibold text-blue-500 hover:bg-blue-50 transition"
                                                    >
                                                        + Change to a different route
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            /* No assignment yet */
                                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                                                    <Bus size={24} className="text-amber-400" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-700 text-sm">No route assigned yet</p>
                                                    <p className="text-xs text-gray-400 mt-1">Assign a route so the correct transport fee is applied to this student's invoice.</p>
                                                </div>
                                                {availableRoutes.length > 0 ? (
                                                    <button
                                                        onClick={() => setShowRouteModal(true)}
                                                        disabled={savingTransport}
                                                        className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        {savingTransport ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                                        Assign to Route
                                                    </button>
                                                ) : (
                                                    <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                        No routes configured. Add routes in the Transport module first.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Route picker modal */}
                                {showRouteModal && (
                                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                                            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-base">Assign Transport Route</p>
                                                    <p className="text-blue-100 text-xs mt-0.5">{currentLearner.firstName} {currentLearner.lastName}</p>
                                                </div>
                                                <button onClick={() => setShowRouteModal(false)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition">
                                                    <X size={15} />
                                                </button>
                                            </div>
                                            <div className="p-5 space-y-3">
                                                <p className="text-xs text-gray-500">Select the route this student will use. The route fee will be applied to their invoice immediately.</p>
                                                {availableRoutes.map(route => {
                                                    const isCurrentRoute = transportAssignments.some(a => a.routeId === route.id && !a.archived);
                                                    return (
                                                        <button
                                                            key={route.id}
                                                            onClick={() => handleAssignRoute(route.id)}
                                                            disabled={savingTransport || isCurrentRoute}
                                                            className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition text-left disabled:opacity-60 ${
                                                                isCurrentRoute
                                                                    ? 'border-emerald-300 bg-emerald-50'
                                                                    : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCurrentRoute ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-500'}`}>
                                                                    <Bus size={15} />
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-900 text-sm">{route.name}</p>
                                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                                        KES {Number(route.amount || 0).toLocaleString()}/term
                                                                        {route.vehicle && ` · ${route.vehicle.registrationNumber}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {isCurrentRoute
                                                                ? <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                                                : savingTransport
                                                                    ? <Loader2 size={14} className="animate-spin text-blue-400 flex-shrink-0" />
                                                                    : null
                                                            }
                                                        </button>
                                                    );
                                                })}
                                                <button
                                                    onClick={() => setShowRouteModal(false)}
                                                    className="w-full py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition mt-2"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
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

import React, { useState, useEffect } from 'react';
import {
    Users, Calendar, CreditCard, FileText,
    ArrowRight, Plus, Clock, CheckCircle,
    AlertCircle, Briefcase, Activity
} from 'lucide-react';
import { hrAPI } from '../../../../services/api';
import { useAuth } from '../../../../hooks/useAuth';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STAT_TONES = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

const StatCard = ({ title, value, icon: Icon, color, sub }) => (
    <div className="surface-panel surface-panel-interactive p-6 rounded-2xl">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl border ${STAT_TONES[color] || STAT_TONES.blue}`}><Icon size={24} /></div>
        </div>
        <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-medium text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
);

const HRManager = ({ onNavigate }) => {
    const { user } = useAuth();
    const now = new Date();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const res = await hrAPI.getDashboardStats({
                    month: now.getMonth() + 1,
                    year: now.getFullYear()
                });
                if (res.success) setStats(res.data);
            } catch (err) {
                console.error('HR dashboard error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    const quickLinks = [
        { id: 'hr-staff-profiles', label: 'Staff Directory',  icon: Users,     color: 'blue',   desc: 'Manage profiles, roles and bank details' },
        { id: 'hr-leave',         label: 'Leave Management', icon: Calendar,   color: 'purple', desc: 'Approve, apply for, or track staff leave' },
        { id: 'hr-payroll',       label: 'Payroll Center',   icon: CreditCard, color: 'emerald',desc: 'Generate payslips and process salaries' },
        { id: 'hr-documents',     label: 'Document Center',  icon: FileText,   color: 'orange', desc: 'Manage contracts and employee IDs' },
        { id: 'hr-performance',   label: 'Performance',      icon: Activity,   color: 'indigo', desc: 'KRAs, evaluations and staff growth' },
        { id: 'hr-attendance',    label: 'Attendance',       icon: Clock,      color: 'rose',   desc: 'View clock-in/out logs and reports' },
    ];

    const payrollLabel = !stats ? '—'
        : stats.payrollDraftsCount > 0     ? `${stats.payrollDraftsCount} Draft${stats.payrollDraftsCount > 1 ? 's' : ''}`
        : stats.payrollGeneratedCount > 0  ? `${stats.payrollGeneratedCount} Confirmed`
        : 'Up to date';

    const payrollSub = !stats ? ''
        : stats.payrollDraftsCount > 0    ? 'Action needed'
        : stats.payrollGeneratedCount > 0 ? 'Awaiting payment'
        : `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-teal" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-medium text-gray-900">HR Management</h1>
                    <p className="text-gray-500">Manage your school's most valuable asset: your staff.</p>
                </div>
                <button
                    onClick={() => onNavigate('settings-users')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                    <Plus size={18} /> Add New User
                </button>
            </div>

            {/* Live Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Staff"         value={stats?.staffCount ?? '—'}         icon={Briefcase}   color="blue"    sub="Active employees" />
                <StatCard title="Pending Leave"        value={stats?.pendingLeaveCount ?? '—'}  icon={Calendar}    color="purple"  sub="Awaiting approval" />
                <StatCard title="Payroll Status"       value={payrollLabel}                     icon={Clock}       color="orange"  sub={payrollSub} />
                <StatCard title="Recent Requests"      value={stats?.recentRequests?.length ?? 0} icon={CheckCircle} color="emerald" sub="This month" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Access */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-medium text-gray-900">Quick Access</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quickLinks.map((link) => (
                            <button
                                key={link.id}
                                onClick={() => onNavigate(link.id)}
                                className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 hover:border-brand-teal/30 hover:shadow-md transition-all text-left group"
                            >
                                <div className={`p-3 rounded-xl bg-${link.color}-50 text-${link.color}-600 group-hover:scale-110 transition-transform`}>
                                    <link.icon size={22} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-gray-900 group-hover:text-brand-teal transition-colors">{link.label}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
                                </div>
                                <ArrowRight size={18} className="text-gray-300 group-hover:text-brand-teal group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sidebar: Pending Leave */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">Pending Requests</h2>
                        <button onClick={() => onNavigate('hr-leave')} className="text-brand-teal text-sm font-medium hover:underline">View All</button>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-sm overflow-hidden">
                        {stats?.recentRequests?.length > 0 ? (
                            stats.recentRequests.map((req) => (
                                <div key={req.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-medium text-brand-purple text-sm">
                                        {req.user.firstName[0]}{req.user.lastName[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-gray-900 truncate">{req.user.firstName} {req.user.lastName}</h4>
                                        <p className="text-xs text-gray-500">{req.leaveType?.name}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] font-medium rounded-full uppercase">Pending</span>
                                        <span className="text-[10px] text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <AlertCircle size={28} className="mx-auto mb-2 text-gray-300" />
                                <p className="text-sm text-gray-500">No pending requests</p>
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <h3 className="font-medium text-emerald-900 mb-1.5">HR Tip</h3>
                        <p className="text-sm text-emerald-700 leading-relaxed">
                            Ensure all staff have their KRA PIN, NSSF and SHIF numbers updated before generating payroll to avoid statutory filing errors.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HRManager;

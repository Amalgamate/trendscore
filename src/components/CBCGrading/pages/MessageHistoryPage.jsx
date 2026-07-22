import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, RefreshCw, Loader, MessageSquare, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Card, CardContent, Button, Input, Label, Badge } from '../../../components/ui';
import { useNotifications } from '../hooks/useNotifications';
import api from '../../../services/api';

const MessageHistoryPage = () => {
    const { showSuccess, showError } = useNotifications();

    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState({ totalSent: 0, successRate: 0, failed: 0, bounced: 0, estimatedCost: 0 });

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        channel: 'all',
        status: 'all',
        search: ''
    });

    // Debounce search so we don't fire on every keystroke
    const searchTimerRef = useRef(null);

    const [page, setPage] = useState(1);
    const [retryingId, setRetryingId] = useState(null);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 50;

    // ── Core fetch — single-tenant, no schoolId required ─────────────────────
    const fetchLogs = useCallback(async (overrideFilters, overridePage) => {
        const activeFilters = overrideFilters ?? filters;
        const activePage   = overridePage   ?? page;

        setLoading(true);
        try {
            const params = {
                page: activePage,
                limit,
                ...(activeFilters.startDate  && { startDate:  activeFilters.startDate }),
                ...(activeFilters.endDate    && { endDate:    activeFilters.endDate }),
                ...(activeFilters.channel !== 'all' && { channel: activeFilters.channel }),
                ...(activeFilters.status  !== 'all' && { status:  activeFilters.status }),
                ...(activeFilters.search     && { search:     activeFilters.search }),
            };

            const response = await api.notifications.getAuditLogs(params);

            if (response?.success) {
                setLogs(response.data?.logs ?? []);
                setSummary(response.data?.summary ?? { totalSent: 0, successRate: 0, failed: 0, bounced: 0, estimatedCost: 0 });
                setTotalPages(Math.max(1, Math.ceil((response.data?.total ?? 0) / limit)));
            } else {
                throw new Error(response?.message || 'Unexpected response');
            }
        } catch (error) {
            console.error('[MessageHistory] fetch error:', error);
            showError(error.message || 'Failed to load message history');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [filters, page, showError]);

    // Initial load
    useEffect(() => {
        fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-fetch when page changes
    useEffect(() => {
        fetchLogs(undefined, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    // Re-fetch when non-search filters change (date, channel, status)
    // Reset page to 1 on filter change
    const handleFilterChange = (key, value) => {
        const next = { ...filters, [key]: value };
        setFilters(next);

        if (key === 'search') {
            // Debounce search input — wait 600 ms after last keystroke
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            searchTimerRef.current = setTimeout(() => {
                setPage(1);
                fetchLogs(next, 1);
            }, 600);
        } else {
            setPage(1);
            fetchLogs(next, 1);
        }
    };

    const handleRefresh = () => {
        fetchLogs();
        showSuccess('Refreshed!');
    };

    const handleRetry = async (log) => {
        if (!log.auditId || retryingId) return;
        setRetryingId(log.auditId);
        try {
            const response = await api.notifications.retryAssessmentReportSms(log.auditId);
            if (!response?.success) throw new Error(response?.message || 'Retry failed');
            showSuccess(`SMS resent to ${log.learner?.firstName || 'recipient'}`);
            await fetchLogs();
        } catch (error) {
            showError(error.message || 'SMS retry failed');
        } finally {
            setRetryingId(null);
        }
    };

    const handleExportCSV = () => {
        if (logs.length === 0) {
            showError('No data to export');
            return;
        }

        const headers = ['Date/Time', 'Learner Name', 'Grade', 'Parent Phone', 'Channel', 'Status', 'Failure Reason', 'Sent By', 'Term'];
        const rows = logs.map(log => [
            new Date(log.createdAt).toLocaleString(),
            `${log.learner?.firstName || ''} ${log.learner?.lastName || ''}`.trim() || 'N/A',
            formatGrade(log.learner?.grade),
            log.phoneNumber || 'N/A',
            log.channel || 'N/A',
            log.status || 'N/A',
            log.failureReason || '',
            `${log.sentBy?.firstName || ''} ${log.sentBy?.lastName || ''}`.trim() || 'System',
            log.term || 'N/A'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `message_history_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        showSuccess('CSV exported successfully!');
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatGrade = (grade) => {
        if (!grade) return '—';
        const normalized = String(grade).trim().toUpperCase();
        if (normalized.startsWith('GRADE_')) return `Grade ${normalized.slice(6)}`;
        if (/^PP\d+$/.test(normalized)) return normalized;
        if (normalized === 'PLAYGROUP') return 'Playgroup';
        return normalized.replace(/_/g, ' ');
    };

    const getStatusMeta = (status) => {
        const s = String(status || '').toUpperCase();
        if (s === 'SENT')    return { label: 'Sent',    className: 'text-green-600',  icon: CheckCircle };
        if (s === 'BOUNCED') return { label: 'Bounced', className: 'text-orange-600', icon: XCircle };
        return                      { label: 'Failed',  className: 'text-red-600',    icon: XCircle };
    };

    return (
        <div className="h-full flex flex-col bg-white border border-slate-200 overflow-hidden">

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                        <MessageSquare size={24} className="text-slate-700" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Message History</h1>
                        <p className="text-sm text-slate-600">Track all communications sent to parents and guardians</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleExportCSV}
                        disabled={logs.length === 0}
                        className="bg-brand-teal text-white hover:bg-brand-teal/90 font-medium gap-2"
                    >
                        <Download size={18} />
                        Export CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Total Sent',    value: summary.totalSent,    color: 'text-brand-teal' },
                    { label: 'Success Rate',  value: `${summary.successRate}%`, color: 'text-green-600' },
                    { label: 'Failed',        value: summary.failed,       color: 'text-red-600' },
                    { label: 'Bounced',       value: summary.bounced ?? 0, color: 'text-orange-600' },
                    { label: 'Total Records', value: summary.totalSent,    color: 'text-brand-purple' },
                ].map(({ label, value, color }) => (
                    <Card key={label}>
                        <CardContent className="p-4">
                            <div className="text-center">
                                <p className="text-gray-600 text-sm mb-1">{label}</p>
                                <p className={`text-3xl font-medium ${color}`}>{value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="px-6 py-4 bg-white border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="startDate" className="text-xs font-medium">From Date</Label>
                        <Input
                            id="startDate"
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="endDate" className="text-xs font-medium">To Date</Label>
                        <Input
                            id="endDate"
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="channel" className="text-xs font-medium">Channel</Label>
                        <select
                            id="channel"
                            value={filters.channel}
                            onChange={(e) => handleFilterChange('channel', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-brand-teal text-sm"
                        >
                            <option value="all">All Channels</option>
                            <option value="SMS">SMS</option>
                            <option value="WHATSAPP">WhatsApp</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="status" className="text-xs font-medium">Status</Label>
                        <select
                            id="status"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-brand-teal text-sm"
                        >
                            <option value="all">All Status</option>
                            <option value="SENT">Sent</option>
                            <option value="FAILED">Failed</option>
                            <option value="BOUNCED">Bounced</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="search" className="text-xs font-medium">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <Input
                                id="search"
                                type="text"
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                placeholder="Name or phone..."
                                className="pl-10"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center">
                        <Loader className="animate-spin mb-4 text-brand-teal" size={32} />
                        <p className="text-gray-500 font-medium">Loading message history...</p>
                    </div>
                ) : logs.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[color:var(--table-header-bg)] border-b border-[color:var(--table-border)] sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Date/Time</th>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Learner</th>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Phone</th>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Channel</th>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Status</th>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Sent By</th>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Term</th>
                                        <th className="px-4 py-3 font-semibold text-[color:var(--table-header-fg)] uppercase text-xs">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {logs.map((log, idx) => {
                                        const { label, className, icon: StatusIcon } = getStatusMeta(log.status);
                                        return (
                                            <tr key={log.id || idx} className="hover:bg-gray-50 transition">
                                                <td className="px-4 py-3 text-xs text-gray-700 font-mono whitespace-nowrap">
                                                    {formatDate(log.createdAt)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-brand-teal/10 rounded-full flex items-center justify-center text-brand-teal font-medium text-sm flex-shrink-0">
                                                            {log.learner?.firstName?.charAt(0)?.toUpperCase() || 'L'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-800 whitespace-nowrap">
                                                                {log.learner?.firstName} {log.learner?.lastName}
                                                            </p>
                                                            <p className="text-xs text-gray-500 whitespace-nowrap">
                                                                {log.learner?.admissionNumber || '—'}
                                                                {log.learner?.grade && (
                                                                    <span className="ml-1.5 font-medium text-brand-teal">
                                                                        • {formatGrade(log.learner.grade)}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-gray-700 whitespace-nowrap">
                                                    {log.phoneNumber || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge
                                                        variant={log.channel === 'SMS' ? 'secondary' : 'outline'}
                                                        className={log.channel === 'WHATSAPP' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                                    >
                                                        {log.channel || '—'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <div className={`flex items-center gap-1 ${className}`}>
                                                            <StatusIcon size={14} />
                                                            <span className="text-xs font-medium">{label}</span>
                                                        </div>
                                                        {log.failureReason && (
                                                            <p className="mt-1 max-w-64 text-xs text-red-600" title={log.failureReason}>
                                                                {log.failureReason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                                                    {`${log.sentBy?.firstName || ''} ${log.sentBy?.lastName || ''}`.trim() || 'System'}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-700">
                                                    {log.term || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {log.canRetry ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRetry(log)}
                                                            disabled={retryingId === log.auditId}
                                                            className="gap-1 whitespace-nowrap"
                                                        >
                                                            <RotateCcw size={14} className={retryingId === log.auditId ? 'animate-spin' : ''} />
                                                            Retry
                                                        </Button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                                <p className="text-sm text-gray-600">
                                    Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || loading}
                                        className="gap-1"
                                    >
                                        <ChevronLeft size={16} /> Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || loading}
                                        className="gap-1"
                                    >
                                        Next <ChevronRight size={16} />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-12 flex flex-col items-center justify-center">
                        <MessageSquare size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">No Messages Found</h3>
                        <p className="text-gray-400 text-sm mt-2">
                            {filters.startDate || filters.endDate || filters.channel !== 'all' || filters.status !== 'all' || filters.search
                                ? 'No messages match your current filters — try adjusting the date range or clearing filters.'
                                : 'Messages will appear here once SMS or WhatsApp notifications are sent.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageHistoryPage;

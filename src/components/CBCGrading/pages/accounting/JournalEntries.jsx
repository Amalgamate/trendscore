import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    Plus,
    Download,
    Eye,
    CheckCircle2,
    Clock,
    ArrowRightLeft,
    Loader2,
    Trash2,
    Check,
    BarChart3
} from 'lucide-react';
import { accountingAPI } from '../../../../services/api/accounting.api';
import { configAPI } from '../../../../services/api';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "../../../ui/dialog";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { toast } from "react-hot-toast";

const JournalEntries = ({ onNavigate }) => {
    const [entries, setEntries] = useState([]);
    const [journals, setJournals] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [termConfigs, setTermConfigs] = useState([]);
    const [term, setTerm] = useState('TERM_1');
    const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // New Entry Form State
    const [newEntry, setNewEntry] = useState({
        journalId: '',
        date: new Date().toISOString().split('T')[0],
        reference: '',
        items: [
            { accountId: '', debit: 0, credit: 0, label: '' },
            { accountId: '', debit: 0, credit: 0, label: '' }
        ]
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [entriesRes, journalsRes, accountsRes] = await Promise.all([
                accountingAPI.getJournalEntries({ term, academicYear }),
                accountingAPI.getJournals(),
                accountingAPI.getAccounts()
            ]);

            if (entriesRes.success) setEntries(entriesRes.data);
            if (journalsRes.success) {
                setJournals(journalsRes.data);
                if (journalsRes.data.length > 0 && !newEntry.journalId) {
                    setNewEntry(prev => ({ ...prev, journalId: journalsRes.data[0].id }));
                }
            }
            if (accountsRes.success) setAccounts(accountsRes.data);
        } catch (error) {
            toast.error("Failed to load journal data");
        } finally {
            setLoading(false);
        }
    }, [newEntry.journalId, term, academicYear]);

    useEffect(() => {
        const loadTermConfigs = async () => {
            try {
                const response = await configAPI.getTermConfigs();
                if (response?.success) {
                    setTermConfigs(response.data || []);
                    const activeTerm = response.data?.find(cfg => cfg.isActive);
                    if (activeTerm) {
                        setTerm(activeTerm.term);
                        setAcademicYear(activeTerm.academicYear);
                    }
                }
            } catch (error) {
                console.error('Failed to load term configs', error);
            }
        };

        loadTermConfigs();
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddItem = () => {
        setNewEntry({
            ...newEntry,
            items: [...newEntry.items, { accountId: '', debit: 0, credit: 0, label: '' }]
        });
    };

    const handleRemoveItem = (index) => {
        const items = [...newEntry.items];
        items.splice(index, 1);
        setNewEntry({ ...newEntry, items });
    };

    const handleItemChange = (index, field, value) => {
        const items = [...newEntry.items];
        items[index][field] = value;
        
        // If debit is entered, clear credit and vice versa
        if (field === 'debit' && value > 0) items[index].credit = 0;
        if (field === 'credit' && value > 0) items[index].debit = 0;
        
        setNewEntry({ ...newEntry, items });
    };

    const totalDebits = newEntry.items.reduce((sum, item) => sum + Number(item.debit || 0), 0);
    const totalCredits = newEntry.items.reduce((sum, item) => sum + Number(item.credit || 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

    const handleCreateEntry = async (e) => {
        e.preventDefault();
        if (!isBalanced) {
            toast.error("Debits and Credits must be equal and greater than zero");
            return;
        }

        try {
            const payload = {
                ...newEntry,
                date: new Date(newEntry.date).toISOString(),
                items: newEntry.items.filter(item => item.accountId && (item.debit > 0 || item.credit > 0))
            };
            const response = await accountingAPI.createJournalEntry(payload);
            if (response.success) {
                toast.success("Journal entry created as Draft");
                setIsAddModalOpen(false);
                setNewEntry({
                    journalId: journals[0]?.id || '',
                    date: new Date().toISOString().split('T')[0],
                    reference: '',
                    items: [
                        { accountId: '', debit: 0, credit: 0 },
                        { accountId: '', debit: 0, credit: 0 }
                    ]
                });
                fetchData();
            }
        } catch (error) {
            toast.error(error.message || "Failed to create entry");
        }
    };

    const handlePostEntry = async (id) => {
        try {
            const response = await accountingAPI.postJournalEntry(id);
            if (response.success) {
                toast.success("Entry posted to ledger");
                fetchData();
            }
        } catch (error) {
            toast.error(error.message || "Failed to post entry");
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount || 0);
    };

    const filteredEntries = entries.filter(e => 
        e.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.items.some(i => i.account.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-medium text-gray-800 tracking-tight">Journal Entries</h1>
                    <p className="text-gray-500 text-sm">Review and manage double-entry bookkeeping records</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium">
                        <Download size={18} className="text-gray-400" />
                        Export
                    </button>
                    <button 
                        onClick={() => onNavigate?.('accounting-reports')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-all font-medium"
                    >
                        <BarChart3 size={18} />
                        Reports
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-all shadow-md font-medium"
                    >
                        <Plus size={18} />
                        New Entry
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search entries, references..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:bg-white transition-all text-sm"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4 md:w-auto">
                    <div className="space-y-2">
                        <Label>Term</Label>
                        <select
                            className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                        >
                            <option value="TERM_1">Term 1</option>
                            <option value="TERM_2">Term 2</option>
                            <option value="TERM_3">Term 3</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Academic Year</Label>
                        <select
                            className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                            value={academicYear}
                            onChange={(e) => setAcademicYear(Number(e.target.value))}
                        >
                            {Array.from(new Set([
                                academicYear,
                                new Date().getFullYear(),
                                ...(termConfigs?.map(cfg => cfg.academicYear) || [])
                            ])).sort((a, b) => b - a).map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                                <th className="px-6 py-4">Ref / Description</th>
                                <th className="px-6 py-4 text-center">Date</th>
                                <th className="px-6 py-4">Journal</th>
                                <th className="px-6 py-4 text-right">Total Amount</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="animate-spin text-brand-purple" />
                                            <span className="text-sm font-medium">Loading entries...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEntries.length > 0 ? (
                                filteredEntries.map(entry => {
                                    const totalDebits = entry.items.reduce((sum, i) => sum + Number(i.debit || 0), 0);
                                    const totalCredits = entry.items.reduce((sum, i) => sum + Number(i.credit || 0), 0);
                                    const total = Math.max(totalDebits, totalCredits);
                                    return (
                                        <tr key={entry.id} className="group hover:bg-gray-50/50 transition-all">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono font-medium text-brand-purple">{entry.reference || 'NO-REF'}</span>
                                                    <span className="text-sm font-medium text-gray-800">{entry.items[0]?.label || 'General Entry'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-xs font-medium text-gray-500">{new Date(entry.date).toLocaleDateString()}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <ArrowRightLeft size={14} className="text-gray-300" />
                                                    <span className="text-xs font-medium text-gray-600 uppercase">{entry.journal?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-medium text-gray-900">{formatCurrency(total)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {entry.status === 'POSTED' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 uppercase tracking-tighter">
                                                        <CheckCircle2 size={12} />
                                                        Posted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 uppercase tracking-tighter">
                                                        <Clock size={12} />
                                                        Draft
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {entry.status === 'DRAFT' && (
                                                        <button 
                                                            onClick={() => handlePostEntry(entry.id)}
                                                            className="p-1.5 h-8 flex items-center gap-1 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all text-[10px] font-medium uppercase"
                                                            title="Post to Ledger"
                                                        >
                                                            <Check size={14} />
                                                            Post
                                                        </button>
                                                    )}
                                                    <button className="p-1.5 h-8 w-8 flex items-center justify-center bg-gray-50 text-gray-600 rounded-lg hover:bg-brand-purple/10 hover:text-brand-purple transition-all">
                                                        <Eye size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500 italic">
                                        No journal entries found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Entry Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>New Journal Entry</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateEntry} className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Journal</Label>
                                <select 
                                    className="w-full flex h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                                    value={newEntry.journalId}
                                    onChange={(e) => setNewEntry({...newEntry, journalId: e.target.value})}
                                    required
                                >
                                    {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input 
                                    type="date" 
                                    value={newEntry.date}
                                    onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Reference</Label>
                            <Input 
                                placeholder="Ref (e.g. JV/2026/001)" 
                                value={newEntry.reference}
                                onChange={(e) => setNewEntry({...newEntry, reference: e.target.value})}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-gray-400 uppercase px-2">
                                <div className="col-span-5">Account</div>
                                <div className="col-span-3 text-right">Debit</div>
                                <div className="col-span-3 text-right">Credit</div>
                                <div className="col-span-1"></div>
                            </div>
                            {newEntry.items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5">
                                        <select 
                                            className="w-full flex h-9 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
                                            value={item.accountId}
                                            onChange={(e) => handleItemChange(idx, 'accountId', e.target.value)}
                                            required
                                        >
                                            <option value="">Select Account</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-3">
                                        <Input 
                                            type="number" 
                                            placeholder="0.00"
                                            className="h-9 text-right text-xs"
                                            value={item.debit || ''}
                                            onChange={(e) => handleItemChange(idx, 'debit', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <Input 
                                            type="number" 
                                            placeholder="0.00"
                                            className="h-9 text-right text-xs text-rose-600"
                                            value={item.credit || ''}
                                            onChange={(e) => handleItemChange(idx, 'credit', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        {newEntry.items.length > 2 && (
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveItem(idx)}
                                                className="text-gray-300 hover:text-rose-500"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={handleAddItem}
                                className="text-xs font-medium text-brand-purple hover:underline flex items-center gap-1 mt-2"
                            >
                                <Plus size={14} />
                                Add Row
                            </button>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <span className="text-xs font-medium text-gray-500">Totals</span>
                            <div className="flex gap-8">
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400 uppercase">Debit</p>
                                    <p className="text-sm font-medium">{formatCurrency(totalDebits)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400 uppercase">Credit</p>
                                    <p className="text-sm font-medium text-rose-600">{formatCurrency(totalCredits)}</p>
                                </div>
                            </div>
                        </div>

                        {!isBalanced && totalDebits > 0 && (
                            <p className="text-center text-xs text-rose-500 font-medium">Difference: {formatCurrency(Math.abs(totalDebits - totalCredits))}</p>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={!isBalanced} className="bg-brand-purple text-white hover:bg-brand-purple/90">
                                Save as Draft
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default JournalEntries;

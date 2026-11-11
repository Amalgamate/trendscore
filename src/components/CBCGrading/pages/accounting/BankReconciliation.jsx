import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRightLeft, CheckCircle2, FileUp, Loader2, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { reconciliationAPI } from '../../../../services/api/accounting.api';
import { toast } from 'react-hot-toast';

const formatCurrency = (amount) => new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
}).format(Number(amount) || 0);
const formatDate = (date) => {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString();
};

const BankReconciliation = () => {
    const [statements, setStatements] = useState([]);
    const [statementId, setStatementId] = useState('');
    const [statement, setStatement] = useState(null);
    const [lines, setLines] = useState([]);
    const [linePage, setLinePage] = useState(1);
    const [linePages, setLinePages] = useState(1);
    const [activeLine, setActiveLine] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [matching, setMatching] = useState(false);
    const [importing, setImporting] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [manualNote, setManualNote] = useState('');
    const inputRef = useRef(null);

    const loadStatements = async (preferredId = '') => {
        setLoading(true);
        try {
            const response = await reconciliationAPI.getStatements();
            const rows = Array.isArray(response.data) ? response.data : [];
            setStatements(rows);
            const nextId = rows.some((item) => item.id === preferredId) ? preferredId : (rows[0]?.id || '');
            setStatementId(nextId);
            if (!nextId) {
                setStatement(null);
                setLines([]);
                setActiveLine(null);
            }
        } catch (error) {
            toast.error(error.message || 'Could not load statements');
        } finally {
            setLoading(false);
        }
    };

    const loadStatement = async (id, page = 1, append = false) => {
        if (!id) return;
        setLoading(true);
        if (!append) {
            setActiveLine(null);
            setSuggestions([]);
        }
        try {
            const response = await reconciliationAPI.getStatement(id, { limit: 100, page });
            const result = response.data || {};
            setStatement(result.statement || null);
            setLines((current) => append ? current.concat(result.lines || []) : (Array.isArray(result.lines) ? result.lines : []));
            setLinePage(result.page || page);
            setLinePages(result.pages || 1);
        } catch (error) {
            toast.error(error.message || 'Could not load statement lines');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadStatements(); }, []);
    useEffect(() => { if (statementId) loadStatement(statementId); }, [statementId]);

    const selectLine = async (line) => {
        setActiveLine(line);
        setSuggestions([]);
        setManualNote('');
        if (line.status !== 'UNRECONCILED') return;
        setMatching(true);
        try {
            const response = await reconciliationAPI.getSuggestedMatches(line.id);
            setSuggestions(Array.isArray(response.data?.suggestions) ? response.data.suggestions : []);
        } catch (error) {
            toast.error(error.message || 'Could not find possible matches');
        } finally {
            setMatching(false);
        }
    };

    const refreshActiveStatement = async () => {
        if (!statementId) return loadStatements();
        await loadStatements(statementId);
        await loadStatement(statementId);
    };

    const importFile = async () => {
        if (!selectedFile) return toast.error('Choose a CSV file first.');
        setImporting(true);
        try {
            const response = await reconciliationAPI.importCsv(selectedFile);
            const imported = response.data || {};
            toast.success(response.message || 'Statement imported');
            setSelectedFile(null);
            if (inputRef.current) inputRef.current.value = '';
            await loadStatements(imported.statementId || '');
        } catch (error) {
            toast.error(error.message || 'Could not import this statement');
        } finally {
            setImporting(false);
        }
    };

    const reconcile = async (matchType, matchedId) => {
        if (!activeLine) return;
        setMatching(true);
        try {
            await reconciliationAPI.reconcileLine(activeLine.id, {
                matchType,
                matchedId,
                note: matchType === 'MANUAL' ? manualNote.trim() : undefined,
            });
            toast.success('Statement line matched');
            await loadStatement(statementId);
        } catch (error) {
            toast.error(error.message || 'Could not match this line');
        } finally {
            setMatching(false);
        }
    };

    const undoMatch = async (line) => {
        setMatching(true);
        try {
            await reconciliationAPI.undoReconciliation(line.id);
            toast.success('Match undone');
            setActiveLine(null);
            await loadStatement(statementId);
        } catch (error) {
            toast.error(error.message || 'Could not undo this match');
        } finally {
            setMatching(false);
        }
    };

    const summary = statements.find((item) => item.id === statementId);
    const activeIsRecordedMatch = activeLine?.status === 'RECONCILED' && Boolean(activeLine.matchType);

    return (
        <main className="p-4 md:p-6 space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Bank reconciliation</h1>
                    <p className="mt-1 text-sm text-slate-600">Import a CSV, review matches, and resolve the remaining lines.</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={refreshActiveStatement} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
                    <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Upload size={16} /> Import CSV</button>
                </div>
            </header>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <label className="flex-1 text-sm font-medium text-slate-800">
                        Imported statement
                        <select value={statementId} onChange={(event) => setStatementId(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                            <option value="">Choose a statement</option>
                            {statements.map((item) => <option key={item.id} value={item.id}>{formatDate(item.dateRange || item.createdAt)} · {item.totalLines} lines · {item.unreconciled} to review</option>)}
                        </select>
                    </label>
                    {summary && (
                        <div className="flex gap-4 text-sm">
                            <div><span className="block text-xs text-slate-500">Matched</span><strong className="text-emerald-700">{summary.reconciled}</strong></div>
                            <div><span className="block text-xs text-slate-500">To review</span><strong className="text-amber-700">{summary.unreconciled}</strong></div>
                            <div><span className="block text-xs text-slate-500">Unmatched value</span><strong>{formatCurrency(summary.unreconciledAmount)}</strong></div>
                        </div>
                    )}
                </div>
                {statement && <p className="mt-2 text-xs text-slate-600">Imported {formatDate(statement.createdAt)} · Closing balance {formatCurrency(statement.endingBalance)}</p>}
                <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
                {selectedFile && (
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3 rounded-md bg-blue-50 px-3 py-2 text-sm">
                        <span className="flex-1 truncate font-medium text-blue-950">{selectedFile.name}</span>
                        <button type="button" onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = ''; }} className="text-slate-600 hover:text-slate-900">Remove file</button>
                        <button type="button" disabled={importing} onClick={importFile} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-60">
                            {importing ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />} {importing ? 'Importing…' : 'Import statement'}
                        </button>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white xl:col-span-7">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-900">Statement lines</h2><span className="text-sm text-slate-500">{lines.length} shown</span></div>
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-600"><Loader2 className="animate-spin" size={18} /> Loading statement…</div>
                    ) : lines.length ? (
                        <div className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
                            {lines.map((line) => {
                                const reconciled = line.status === 'RECONCILED';
                                return (
                                    <button type="button" key={line.id} onClick={() => selectLine(line)} className={'flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 ' + (activeLine?.id === line.id ? 'bg-blue-50' : '')}>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-slate-900">{line.description || 'No description'}</span>
                                            <span className="mt-1 block text-xs text-slate-500">{formatDate(line.date)}{line.reference ? ' · ' + line.reference : ''}</span>
                                            {reconciled && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} /> {line.matchType ? 'Matched · ' + line.matchType.replaceAll('_', ' ').toLowerCase() : 'Legacy match details unavailable'}</span>}
                                        </span>
                                        <span className={'shrink-0 text-right text-sm font-semibold ' + (Number(line.amount) < 0 ? 'text-rose-700' : 'text-emerald-700')}>
                                            {formatCurrency(line.amount)}
                                            <span className={'mt-1 block text-xs font-medium ' + (reconciled ? 'text-emerald-700' : 'text-amber-700')}>{reconciled ? 'Matched' : 'Review'}</span>
                                        </span>
                                    </button>
                                );
                            })}
                            {linePage < linePages && <button type="button" disabled={loading} onClick={() => loadStatement(statementId, linePage + 1, true)} className="w-full px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60">Load next 100 lines</button>}
                        </div>
                    ) : (
                        <div className="p-10 text-center">
                            <FileUp className="mx-auto mb-3 text-slate-400" size={30} />
                            <p className="font-medium text-slate-900">{statementId ? 'No lines in this statement' : 'Import a statement to begin'}</p>
                            <p className="mt-1 text-sm text-slate-600">Choose an M-Pesa CSV file to review its transactions.</p>
                        </div>
                    )}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white xl:col-span-5">
                    <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-900">Match this line</h2></div>
                    {!activeLine ? (
                        <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center"><ArrowRightLeft className="mb-3 text-slate-400" size={28} /><p className="font-medium text-slate-900">Choose a statement line</p><p className="mt-1 text-sm text-slate-600">Possible matches will appear here.</p></div>
                    ) : activeIsRecordedMatch ? (
                        <div className="space-y-4 p-4">
                            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-950"><p className="font-semibold">This line is matched</p><p className="mt-1">{activeLine.matchType.replaceAll('_', ' ').toLowerCase()} · {activeLine.matchedId}</p>{activeLine.reconciledAt && <p className="mt-1 text-xs">Matched {new Date(activeLine.reconciledAt).toLocaleString()}</p>}</div>
                            <button type="button" disabled={matching} onClick={() => undoMatch(activeLine)} className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"><RotateCcw size={16} /> Undo match</button>
                        </div>
                    ) : activeLine.status === 'RECONCILED' ? (
                        <div className="p-4 text-sm text-amber-900"><AlertCircle className="mb-2" size={18} />This is a historical match without a saved target. It cannot be safely undone.</div>
                    ) : (
                        <div className="space-y-4 p-4">
                            <div className="rounded-md bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-900">{activeLine.description || 'No description'}</p><p className="mt-1 text-xs text-slate-600">{formatDate(activeLine.date)} · {activeLine.reference || 'No reference'}</p><p className="mt-2 font-semibold text-slate-900">{formatCurrency(activeLine.amount)}</p></div>
                            <div>
                                <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Suggested matches</h3>{matching && <Loader2 className="animate-spin text-blue-700" size={16} />}</div>
                                {suggestions.length ? (
                                    <div className="space-y-2">
                                        {suggestions.map((match) => (
                                            <div key={match.matchType + '-' + match.matchedId} className="rounded-md border border-slate-200 p-3">
                                                <div className="flex justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{match.description}</p><p className="mt-1 text-xs text-slate-600">{match.receiptNo || match.matchType.replaceAll('_', ' ')} · {formatDate(match.date)}</p></div><strong className="shrink-0 text-sm">{formatCurrency(match.amount)}</strong></div>
                                                <button type="button" disabled={matching} onClick={() => reconcile(match.matchType, match.matchedId)} className="mt-2 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">Match line</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : !matching ? <p className="text-sm text-slate-600">No exact matches. You can record a manual match with a reason.</p> : null}
                            </div>
                            <div className="border-t border-slate-200 pt-3">
                                <label className="block text-sm font-medium text-slate-800">Manual match note<textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} maxLength={1000} rows={2} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Explain what you verified" /></label>
                                <button type="button" disabled={matching || !manualNote.trim()} onClick={() => reconcile('MANUAL')} className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">Record manual match</button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
};

export default BankReconciliation;

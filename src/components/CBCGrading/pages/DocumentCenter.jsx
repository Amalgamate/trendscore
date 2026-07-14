import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Folder, FileText, Search,
    File, Image, FileSpreadsheet, Trash2,
    Download, RefreshCw, Grid, List, Plus
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useDocuments } from '../hooks/useDocuments';
import ConfirmDialog from '../shared/ConfirmDialog';
import ProfileLayout from '../shared/ProfileLayout';

const DocumentCenter = ({ initialCategory = 'all' }) => {
    const {
        documents,
        loading,
        uploadProgress,
        fetchDocuments,
        uploadDocument,
        deleteDocument
    } = useDocuments();

    const { showSuccess, showError } = useNotifications();
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState(null);
    const fileInputRef = useRef(null);

    const listQueryParams = useMemo(() => {
        const p = {};
        if (activeCategory !== 'all') p.category = activeCategory;
        if (searchQuery) p.search = searchQuery;
        return p;
    }, [activeCategory, searchQuery]);

    useEffect(() => {
        fetchDocuments(listQueryParams);
    }, [fetchDocuments, listQueryParams]);

    useEffect(() => {
        if (initialCategory) setActiveCategory(initialCategory);
    }, [initialCategory]);

    const [isDragging, setIsDragging] = useState(false);

    const handleFileUpload = async (file) => {
        if (!file) return;
        const category = activeCategory === 'all' ? 'general' : activeCategory;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        formData.append('name', file.name);

        const result = await uploadDocument(formData, listQueryParams);
        if (!result.success) {
            showError('Failed to upload document');
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        await handleFileUpload(file);
        e.target.value = null;
    };

    const confirmDelete = (doc) => {
        setDocumentToDelete(doc);
        setShowConfirmDialog(true);
    };

    const handleDelete = async () => {
        if (documentToDelete) {
            const result = await deleteDocument(documentToDelete.id);
            if (result.success) {
                showSuccess('Document deleted');
            } else {
                showError('Failed to delete');
            }
            setShowConfirmDialog(false);
            setDocumentToDelete(null);
        }
    };

    const handleDownload = (doc) => {
        window.open(doc.url, '_blank');
    };

    const isImage = (type) => {
        if (!type) return false;
        const t = type.toLowerCase();
        return t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('webp') || t.includes('gif');
    };

    const getFileIcon = (type) => {
        if (!type) return <File className="text-gray-400" size={24} />;
        const t = type.toLowerCase();
        if (t.includes('pdf')) return <FileText className="text-red-500" size={24} />;
        if (t.includes('excel') || t.includes('sheet') || t.includes('csv')) return <FileSpreadsheet className="text-green-600" size={24} />;
        if (isImage(t)) return <Image className="text-purple-500" size={24} />;
        if (t.includes('word') || t.includes('doc')) return <FileText className="text-blue-500" size={24} />;
        return <File className="text-gray-400" size={24} />;
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <ProfileLayout
            title="Document Center"
            subtitle="Manage institutional records, student files, and reports"
            primaryAction={{
                label: "Upload Document",
                icon: Plus,
                onClick: () => fileInputRef.current?.click()
            }}
            secondaryAction={{
                label: "Refresh",
                icon: RefreshCw,
                onClick: () => fetchDocuments(listQueryParams),
                isLoading: loading
            }}
        >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            <div className="flex h-[calc(100vh-220px)] min-h-0">
                {/* Main View Area */}
                <div
                    className={`flex-1 flex flex-col w-full min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${isDragging ? 'ring-2 ring-brand-teal ring-inset bg-brand-teal/5' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const files = e.dataTransfer.files;
                        if (files.length > 0) await handleFileUpload(files[0]);
                    }}
                >
                    {/* Inner Toolbar */}
                    <div className="p-4 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name or type..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-teal/20 transition text-sm font-medium"
                            />
                        </div>

                        <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-brand-teal' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Grid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-teal' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {uploadProgress > 0 && (
                        <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-gray-500 flex items-center gap-2">
                                    <RefreshCw className="animate-spin" size={12} />
                                    Uploading document...
                                </span>
                                <span className="text-xs font-semibold text-brand-teal">{uploadProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-brand-teal transition-all duration-300 ease-out" 
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Files Display */}
                    <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                        {loading && documents.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                                <RefreshCw className="animate-spin text-brand-teal" size={32} />
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Folder size={40} className="text-gray-200" />
                                </div>
                                <p className="text-lg font-semibold text-gray-400">Empty Category</p>
                                <p className="text-sm font-medium">Drop files here to start uploading</p>
                            </div>
                        ) : (
                            <div className={viewMode === 'grid'
                                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
                                : "space-y-2"
                            }>
                                {documents.map(file => (
                                    viewMode === 'grid' ? (
                                        <div
                                            key={file.id}
                                            className="group relative bg-white border border-gray-100 hover:border-brand-teal/30 hover:shadow-xl hover:shadow-brand-teal/5 rounded-2xl p-5 transition-all duration-300 cursor-pointer flex flex-col items-center text-center"
                                            onClick={() => handleDownload(file)}
                                        >
                                            <div className="w-16 h-16 mb-4 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm overflow-hidden border border-gray-100">
                                                {isImage(file.type) && file.url ? (
                                                    <img src={file.url} alt={file.name} loading="lazy" className="w-full h-full object-cover" />
                                                ) : getFileIcon(file.type)}
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-800 truncate w-full mb-1 px-2" title={file.name}>
                                                {file.name}
                                            </h3>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                                {formatSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                                            </p>

                                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); confirmDelete(file); }}
                                                    className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            key={file.id}
                                            className="group flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition cursor-pointer border border-transparent hover:border-gray-100"
                                            onClick={() => handleDownload(file)}
                                        >
                                            <div className="w-10 h-10 p-1 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-gray-100">
                                                {isImage(file.type) && file.url ? (
                                                    <img src={file.url} alt={file.name} loading="lazy" className="w-full h-full object-cover rounded-md" />
                                                ) : (
                                                    React.cloneElement(getFileIcon(file.type), { size: 20 })
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                                                <p className="text-xs text-gray-400">{formatSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-brand-teal"><Download size={16} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); confirmDelete(file); }} className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                show={showConfirmDialog}
                title="Delete Document"
                message={`Are you sure you want to permanentely delete "${documentToDelete?.name}"?`}
                confirmText="Delete"
                cancelText="Cancel"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
                onConfirm={handleDelete}
                onCancel={() => setShowConfirmDialog(false)}
            />
        </ProfileLayout>
    );
};

export default DocumentCenter;

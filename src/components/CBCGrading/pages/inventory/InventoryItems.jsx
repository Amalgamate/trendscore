import React, { useState, useEffect } from 'react';
import {
    Package, Plus, Search, Filter,
    MoreVertical, Download, AlertTriangle,
    ArrowUpRight, ArrowDownLeft, X
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { useMobile } from '../../../../hooks/useMobileDetection';
import { DataCard } from '../../shared';
import { KpiCard } from '../../../../design-system/components';

const InventoryItems = () => {
    const isMobile = useMobile();
    const { showSuccess, showError } = useNotifications();
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        categoryId: '',
        storeId: '',
        type: 'CONSUMABLE',
        quantity: 0,
        unitPrice: 0,
        sku: '',
        unitOfMeasure: 'Pieces'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [itemsRes, catRes, storesRes] = await Promise.all([
                api.inventory.getItems(),
                api.inventory.getCategories(),
                api.inventory.getStores()
            ]);
            setItems(itemsRes?.success ? itemsRes.data : (itemsRes || []));
            setCategories(catRes?.success ? catRes.data : (catRes || []));
            setStores(storesRes?.success ? storesRes.data : (storesRes || []));
        } catch (error) {
            console.error('Error fetching inventory data:', error);
            showError('Failed to load inventory data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await api.inventory.createItem({
                ...formData,
                quantity: Number(formData.quantity) || 0,
                unitPrice: Number(formData.unitPrice) || 0
            });
            showSuccess('Inventory item added successfully!');
            setShowModal(false);
            setFormData({ name: '', categoryId: '', storeId: '', type: 'CONSUMABLE', quantity: 0, unitPrice: 0, sku: '', unitOfMeasure: 'Pieces' });
            fetchData();
        } catch (error) {
            console.error('Error adding item:', error);
            showError(error.message || 'Failed to add item');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-medium text-gray-800">Inventory Items</h1>
                    <p className="text-gray-500 text-sm">Manage stock items, consumables and assets</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        <Plus size={20} />
                        <span>Add Item</span>
                    </button>
                    <button className="flex items-center gap-2 border border-blue-200 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                        <Download size={20} />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                {[
                    { label: 'Total Items', value: items.length, icon: Package, color: 'blue' },
                    { label: 'Low Stock', value: items.filter(i => (i.quantity || 0) <= (i.minimumStock || 5)).length, icon: AlertTriangle, color: 'amber' },
                    { label: 'Total Value', value: `Ksh ${items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toLocaleString()}`, icon: ArrowUpRight, color: 'green' },
                    { label: 'Asset Items', value: items.filter(i => i.type === 'ASSET').length, icon: ArrowDownLeft, color: 'purple' },
                ].map((stat, i) => {
                    const tones = { blue: 'sky', amber: 'amber', green: 'emerald', purple: 'violet' };
                    const orbs = ['top-right', 'bottom-left', 'bottom-right', 'top-center'];
                    const Icon = stat.icon;
                    return <KpiCard key={stat.label} label={stat.label} value={stat.value} icon={<Icon size={20} />} tone={tones[stat.color]} orbPosition={orbs[i]} />;
                })}
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center justify-between">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, SKU or barcode..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-3">
                    <select className="px-4 py-2 border border-gray-200 rounded-lg outline-none bg-white text-gray-600 text-sm">
                        <option>All Categories</option>
                        <option>Stationery</option>
                        <option>Laboratory</option>
                        <option>Electronics</option>
                    </select>
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 text-sm">
                        <Filter size={18} />
                        <span>Filters</span>
                    </button>
                </div>
            </div>

            {/* Items List/Table */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
                    <Package size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No inventory items found. Add your first item to get started.</p>
                </div>
            ) : isMobile ? (
                // ******************** MOBILE CARDS VIEW ********************
                <div className="grid grid-cols-1 gap-4 pb-10">
                    {items.map((item) => (
                        <DataCard
                            key={item.id}
                            icon={
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-sm shadow-inner">
                                    <Package size={20} />
                                </div>
                            }
                            title={item.name}
                            subtitle={`${item.category?.name || 'Uncategorized'} • ${item.sku || 'No SKU'}`}
                            badges={
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    (item.quantity || 0) === 0 ? 'bg-red-50 text-red-600' :
                                    (item.quantity || 0) <= (item.minimumStock || 5) ? 'bg-amber-50 text-amber-600' :
                                    'bg-emerald-50 text-emerald-600'
                                }`}>
                                    {(item.quantity || 0) === 0 ? 'OUT' : (item.quantity || 0) <= (item.minimumStock || 5) ? 'LOW' : 'STOCK'}
                                </span>
                            }
                            stats={{
                                "Quantity": `${item.quantity || 0} ${item.unitOfMeasure || ''}`,
                                "Unit Price": `KES ${item.unitPrice || 0}`
                            }}
                            actions={
                                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all">
                                    <MoreVertical size={18} />
                                </button>
                            }
                        />
                    ))}
                </div>
            ) : (
                // ******************** DESKTOP TABLE VIEW ********************
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="border-b border-[color:var(--table-border)]">
                            <tr>
                                <th className="px-6 py-4 text-sm font-semibold text-[color:var(--table-header-fg)]">Item Name</th>
                                <th className="px-6 py-4 text-sm font-semibold text-[color:var(--table-header-fg)]">SKU</th>
                                <th className="px-6 py-4 text-sm font-semibold text-[color:var(--table-header-fg)]">Category</th>
                                <th className="px-6 py-4 text-sm font-semibold text-[color:var(--table-header-fg)]">Type</th>
                                <th className="px-6 py-4 text-sm font-semibold text-[color:var(--table-header-fg)] text-right">Stock Level</th>
                                <th className="px-6 py-4 text-sm font-semibold text-[color:var(--table-header-fg)]">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-[color:var(--table-header-fg)]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-800">{item.name}</div>
                                        <div className="text-xs text-gray-500">{item.unitOfMeasure}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.sku || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.category?.name || 'Uncategorized'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.type === 'ASSET' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-semibold text-gray-800">{item.quantity || 0}</div>
                                        <div className="text-xs text-red-500">Reorder at {item.reorderLevel || 5}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(item.quantity || 0) === 0 ? (
                                            <span className="flex items-center gap-1.5 text-sm text-red-600">
                                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                Out of Stock
                                            </span>
                                        ) : (item.quantity || 0) <= (item.minimumStock || 5) ? (
                                            <span className="flex items-center gap-1.5 text-sm text-amber-600">
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                Low Stock
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-sm text-green-600">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                In Stock
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all">
                                            <MoreVertical size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Item Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h2 className="text-xl font-medium text-gray-800 text-left">Add Inventory Item</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-6 text-left">
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Item Name *</label>
                                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="E.g. Ruled Exercise Book" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">SKU / Barcode</label>
                                    <input value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="E.g. BOK-102" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Category *</label>
                                    <select required value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white">
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Store *</label>
                                    <select required value={formData.storeId} onChange={e => setFormData({ ...formData, storeId: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white">
                                        <option value="">Select Store</option>
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Item Type *</label>
                                    <select required value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white">
                                        <option value="CONSUMABLE">Consumable (Books, Chalks)</option>
                                        <option value="ASSET">Asset (Computers, Desks)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Unit of Measure</label>
                                    <input value={formData.unitOfMeasure} onChange={e => setFormData({ ...formData, unitOfMeasure: e.target.value })} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Pieces, Reams, Boxes" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Initial Quantity</label>
                                    <input required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} type="number" min="0" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Unit Price (KES)</label>
                                    <input value={formData.unitPrice} onChange={e => setFormData({ ...formData, unitPrice: e.target.value })} type="number" min="0" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    {submitting ? 'Adding...' : 'Save Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryItems;

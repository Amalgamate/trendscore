import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plus, Search, Filter, 
  CheckCircle, Clock, 
  XOctagon, FileEdit, Trash2, Eye 
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermissions } from '../../../../hooks/usePermissions';
import api from '../../../../services/api';
import { Card } from '../../../../components/ui/card';
import SchemeOfWorkForm from './SchemeOfWorkForm';

const StatusBadge = ({ status }) => {
  const styles = {
    DRAFT: 'bg-gray-100 text-gray-800 border-gray-200',
    SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
    APPROVED: 'bg-green-100 text-green-800 border-green-200',
    REJECTED: 'bg-red-100 text-red-800 border-red-200'
  };

  const icons = {
    DRAFT: <FileEdit size={12} className="mr-1" />,
    SUBMITTED: <Clock size={12} className="mr-1" />,
    APPROVED: <CheckCircle size={12} className="mr-1" />,
    REJECTED: <XOctagon size={12} className="mr-1" />
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status === 'SUBMITTED' ? 'PENDING APPROVAL' : status}
    </span>
  );
};

const SchemesOfWork = ({ onNavigate }) => {
  const { user } = useAuth();
  const { isAnyRole, role } = usePermissions();
  const canCreateScheme = isAnyRole(['TEACHER', 'HEAD_TEACHER', 'ADMIN', 'SUPER_ADMIN']);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // View states
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'form'
  const [selectedSchemeId, setSelectedSchemeId] = useState(null);

  const fetchSchemes = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      
      // If teacher, API automatically filters to own schemes.
      // If admin, we fetch all.
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.schemesOfWork.getAll(params);
      setSchemes(res.data || []);
    } catch (error) {
      console.error('Failed to fetch schemes of work:', error);
      // Fallback empty state on error handled gracefully by map
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (currentView === 'list') fetchSchemes();
  }, [currentView, fetchSchemes]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Scheme of Work?')) return;
    
    try {
      await api.schemesOfWork.delete(id);
      fetchSchemes();
    } catch (error) {
      alert(error.message || 'Failed to delete Scheme of Work');
    }
  };

  const handleEdit = (id) => {
    setSelectedSchemeId(id);
    setCurrentView('form');
  };

  const handleCreateNew = () => {
    setSelectedSchemeId(null);
    setCurrentView('form');
  };

  const handleFormBack = () => {
    setCurrentView('list');
    setSelectedSchemeId(null);
  };

  if (currentView === 'form') {
    return <SchemeOfWorkForm schemeId={selectedSchemeId} onBack={handleFormBack} />;
  }

  const filteredSchemes = schemes.filter(s => {
    if (searchTerm) {
      const matchTerm = (
        (s.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.learningArea.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `Grade ${s.grade}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.teacher?.firstName + ' ' + s.teacher?.lastName).toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchTerm) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Schemes of Work</h2>
          <p className="text-gray-500 text-sm">Manage teaching plans and termly schemes</p>
        </div>
        
        {canCreateScheme && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-lg hover:bg-teal-700 transition"
          >
            <Plus size={18} />
            <span>New Scheme</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((status) => {
          const count = schemes.filter((s) => s.status === status).length;
          return (
            <div key={status} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                {status === 'SUBMITTED' ? 'Pending Approval' : status}
              </p>
              <p className="text-lg font-semibold text-gray-800">{count}</p>
            </div>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by subject, grade, or teacher..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg appearance-none bg-white min-w-[140px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Drafts</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
          </div>
        ) : filteredSchemes.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Schemes of Work found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' 
                ? "We couldn't find any schemes matching your filters."
                : "You haven't created any Schemes of Work yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200 text-gray-600 text-sm">
                  <th className="py-3 px-4 font-medium">Topic / Subject</th>
                  {role !== 'TEACHER' && <th className="py-3 px-4 font-medium">Teacher</th>}
                  <th className="py-3 px-4 font-medium">Grade & Term</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Last Updated</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSchemes.map((scheme) => (
                  <tr key={scheme.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{scheme.title || scheme.learningArea}</div>
                      <div className="text-sm text-gray-500">{scheme.learningArea}</div>
                    </td>
                    
                    {role !== 'TEACHER' && (
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {scheme.teacher?.firstName} {scheme.teacher?.lastName}
                      </td>
                    )}
                    
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-900">Grade {scheme.grade}</div>
                      <div className="text-xs text-gray-500">{String(scheme.term).replace(/^TERM_(\d+)$/, 'Term $1')} - {scheme.academicYear}</div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <StatusBadge status={scheme.status} />
                    </td>
                    
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(scheme.updatedAt).toLocaleDateString()}
                    </td>
                    
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(scheme.id)}
                          className="p-1.5 text-gray-500 hover:text-brand-teal hover:bg-teal-50 rounded"
                          title="View / Edit"
                        >
                          {scheme.status === 'DRAFT' || scheme.status === 'REJECTED' ? <FileEdit size={16} /> : <Eye size={16} />}
                        </button>
                        
                        {(scheme.status === 'DRAFT' || scheme.status === 'REJECTED') && scheme.teacherId === user?.id && (
                          <button 
                            onClick={() => handleDelete(scheme.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SchemesOfWork;

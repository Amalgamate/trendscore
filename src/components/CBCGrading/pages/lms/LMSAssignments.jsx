import React, { useState } from 'react';
import { 
  ClipboardList, Plus, Search, Filter, MoreVertical, 
  Calendar, CheckCircle, Clock, FileText, CheckSquare, Users
} from 'lucide-react';
import { useSchoolData } from '../../../../contexts/SchoolDataContext';

const LMSAssignments = ({ onNavigate }) => {
  const { classes } = useSchoolData();
  const [activeTab, setActiveTab] = useState('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Dummy Data for Assignments
  const [assignments, setAssignments] = useState([
    {
      id: 1,
      title: 'Algebra: Linear Equations Worksheet',
      subject: 'Mathematics',
      className: 'Grade 7 - North',
      dueDate: '2026-04-10T23:59:00',
      status: 'active',
      submittedCount: 24,
      totalStudents: 30,
      points: 20
    },
    {
      id: 2,
      title: 'Photosynthesis Lab Report',
      subject: 'Science & Tech',
      className: 'Grade 6 - East',
      dueDate: '2026-04-05T12:00:00',
      status: 'reviewing',
      submittedCount: 28,
      totalStudents: 28,
      points: 50
    },
    {
      id: 3,
      title: 'Creative Writing: My Hero',
      subject: 'English',
      className: 'Grade 5 - South',
      dueDate: '2026-04-15T23:59:00',
      status: 'draft',
      submittedCount: 0,
      totalStudents: 32,
      points: 30
    }
  ]);

  const filteredAssignments = assignments.filter(a => {
    if (activeTab === 'active') return a.status === 'active';
    if (activeTab === 'marking') return a.status === 'reviewing';
    if (activeTab === 'drafts') return a.status === 'draft';
    return true;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'reviewing': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'active': return 'In Progress';
      case 'reviewing': return 'Needs Marking';
      case 'draft': return 'Draft';
      default: return 'Unknown';
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-medium text-gray-800 flex items-center gap-3">
            <ClipboardList className="text-brand-purple" size={32} />
            Assignments Manager
          </h1>
          <p className="text-gray-500 mt-1">Create, distribute, and grade student assignments seamlessly.</p>
        </div>
        <button 
          onClick={() => {
            if (onNavigate) onNavigate('learning-assignment-create');
            else setShowCreateModal(true);
          }}
          className="bg-brand-purple text-white px-5 py-2.5 rounded-lg font-medium hover:bg-purple-800 transition-colors shadow-m hover:shadow-lg flex items-center gap-2"
        >
          <Plus size={20} />
          Create Assignment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition duration-200">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Clock size={24} /></div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Active (Due Soon)</p>
                <p className="text-2xl font-medium text-gray-800">{assignments.filter(a => a.status === 'active').length}</p>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition duration-200">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><CheckSquare size={24} /></div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Ready to Mark</p>
                <p className="text-2xl font-medium text-gray-800">{assignments.filter(a => a.status === 'reviewing').length}</p>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition duration-200">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={24} /></div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Fully Graded</p>
                <p className="text-2xl font-medium text-gray-800">14</p>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition duration-200">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><FileText size={24} /></div>
            <div>
                <p className="text-sm text-gray-500 font-medium">Drafts</p>
                <p className="text-2xl font-medium text-gray-800">{assignments.filter(a => a.status === 'draft').length}</p>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Tabs & Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-gray-100 gap-4">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveTab('marking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'marking' ? 'bg-amber-50 text-amber-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Needs Marking
            </button>
            <button 
              onClick={() => setActiveTab('drafts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'drafts' ? 'bg-gray-100 text-gray-800' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Drafts
            </button>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search assignments..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-shadow"
              />
            </div>
            <button className="p-2 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Assignment List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="py-4 px-6">Assignment Details</th>
                <th className="py-4 px-6">Class/Subject</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6">Submissions</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.length > 0 ? filteredAssignments.map(assignment => (
                <tr key={assignment.id} className="border-b border-gray-50 hover:bg-purple-50/30 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-start gap-3">
                      <div className="bg-brand-purple/10 text-brand-purple p-2 rounded-lg mt-0.5">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm group-hover:text-brand-purple transition-colors">
                          {assignment.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{assignment.points} Points possible</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm font-medium text-gray-700">{assignment.className}</p>
                    <p className="text-xs text-gray-500">{assignment.subject}</p>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} className="text-gray-400" />
                      {new Date(assignment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-24">
                        <div 
                          className="h-full bg-brand-teal transition-all duration-500" 
                          style={{ width: `${(assignment.submittedCount / assignment.totalStudents) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-semibold text-gray-600">
                        {assignment.submittedCount}/{assignment.totalStudents}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(assignment.status)}`}>
                      {getStatusLabel(assignment.status)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {assignment.status === 'reviewing' && (
                         <button className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded font-medium shadow-sm transition-colors">
                           Start Marking
                         </button>
                       )}
                       {assignment.status === 'active' && (
                         <button className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded font-medium transition-colors">
                           View Progress
                         </button>
                       )}
                       {assignment.status === 'draft' && (
                         <button
                           onClick={() => onNavigate?.('learning-assignment-edit', { assignmentId: assignment.id })}
                           className="text-xs bg-brand-purple text-white hover:bg-purple-800 px-3 py-1.5 rounded font-medium transition-colors"
                         >
                           Edit & Publish
                         </button>
                       )}
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-500">
                    <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-base font-medium text-gray-600">No Assignments Found</p>
                    <p className="text-sm text-gray-400 mt-1">There are no assignments matching the current filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal Stub */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-medium text-gray-800">Create New Assignment</h2>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Title</label>
                  <input type="text" placeholder="e.g. Chapter 4: Fractions Quiz" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-purple" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To Class</label>
                    <select className="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-brand-purple">
                      <option>Select a class...</option>
                      {classes?.map(c => <option key={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-purple" />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Points</label>
                  <input type="number" placeholder="100" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-purple" />
               </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button className="px-5 py-2.5 bg-brand-purple text-white rounded-lg font-medium hover:bg-purple-800 transition">
                Create & Publish
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LMSAssignments;

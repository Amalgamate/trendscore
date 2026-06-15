import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { userAPI } from '../../../../services/api';

const MobileUserManagement = ({ onNavigate }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', role: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userAPI.getAll?.();
      if (response?.data) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, email: user.email, role: user.role, password: '' });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', role: 'TEACHER', password: '' });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingUser) {
        await userAPI.update?.(editingUser.id, formData);
      } else {
        await userAPI.create?.(formData);
      }
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      alert('Failed to save user: ' + error.message);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Delete this user?')) {
      try {
        await userAPI.delete?.(userId);
        fetchUsers();
      } catch (error) {
        alert('Failed to delete user: ' + error.message);
      }
    }
  };

  return (
    <div className="px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-3 py-2 bg-brand-purple text-white rounded-lg text-sm font-medium"
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No users yet</div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="font-semibold text-gray-900 text-sm">{user.name}</div>
                <div className="text-xs text-gray-500 mt-1">{user.email}</div>
                <div className="text-xs text-gray-600 mt-1 font-medium">{user.role}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenModal(user)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="Edit user"
                >
                  <Edit size={18} className="text-blue-600" />
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="Delete user"
                >
                  <Trash2 size={18} className="text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">
              {editingUser ? 'Edit User' : 'Create User'}
            </h2>

            {/* Form Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
              >
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
                <option value="HEAD_TEACHER">Head Teacher</option>
                <option value="ACCOUNTANT">Accountant</option>
              </select>
            </div>

            {!editingUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    placeholder="Set password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-brand-purple text-white rounded-lg font-medium text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileUserManagement;

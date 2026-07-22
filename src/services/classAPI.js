/**
 * Class API Service
 * Centralized API calls for class management, inventory, schedules, and facilities
 */

import axios from 'axios';
import { getAuthItem } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api';

// ============ CLASS CRUD ============

/**
 * Create new class with auto-generated class code
 */
export const createClass = async (classData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/classes`, classData, {
      headers: {
        Authorization: `Bearer ${getAuthItem('token')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error creating class:', error);
    throw error;
  }
};

// ============ CLASS DETAIL ============

/**
 * Get complete class details with all relations
 */
export const getClassDetails = async (classId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/classes/${classId}`, {
      headers: {
        Authorization: `Bearer ${getAuthItem('token')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching class details:', error);
    throw error;
  }
};

/**
 * Get class statistics
 */
export const getClassStatistics = async (classId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/classes/${classId}/statistics`, {
      headers: {
        Authorization: `Bearer ${getAuthItem('token')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching class statistics:', error);
    throw error;
  }
};

// ============ INVENTORY MANAGEMENT ============

/**
 * Get all inventory items for a class
 */
export const getInventoryItems = async (classId, filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.condition) params.append('condition', filters.condition);

    const response = await axios.get(
      `${API_BASE_URL}/classes/${classId}/inventory?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    throw error;
  }
};

/**
 * Add new inventory item
 */
export const addInventoryItem = async (classId, itemData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/classes/${classId}/inventory`,
      itemData,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error adding inventory item:', error);
    throw error;
  }
};

/**
 * Update inventory item
 */
export const updateInventoryItem = async (classId, itemId, itemData) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/classes/${classId}/inventory/${itemId}`,
      itemData,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
};

/**
 * Delete inventory item
 */
export const deleteInventoryItem = async (classId, itemId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/classes/${classId}/inventory/${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw error;
  }
};

// ============ SCHEDULE MANAGEMENT ============

/**
 * Get all schedules for a class
 */
export const getSchedules = async (classId, filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.day) params.append('day', filters.day);
    if (filters.semester) params.append('semester', filters.semester);

    const response = await axios.get(
      `${API_BASE_URL}/classes/${classId}/schedules?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
};

/**
 * Add new schedule
 */
export const addSchedule = async (classId, scheduleData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/classes/${classId}/schedules`,
      scheduleData,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error adding schedule:', error);
    throw error;
  }
};

/**
 * Update schedule
 */
export const updateSchedule = async (classId, scheduleId, scheduleData) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/classes/${classId}/schedules/${scheduleId}`,
      scheduleData,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating schedule:', error);
    throw error;
  }
};

/**
 * Delete schedule
 */
export const deleteSchedule = async (classId, scheduleId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/classes/${classId}/schedules/${scheduleId}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

// ============ FACILITY MANAGEMENT ============

/**
 * Get all facilities for a class
 */
export const getFacilities = async (classId, filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.facilityType) params.append('facilityType', filters.facilityType);
    if (filters.condition) params.append('condition', filters.condition);

    const response = await axios.get(
      `${API_BASE_URL}/classes/${classId}/facilities?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching facilities:', error);
    throw error;
  }
};

/**
 * Add new facility
 */
export const addFacility = async (classId, facilityData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/classes/${classId}/facilities`,
      facilityData,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error adding facility:', error);
    throw error;
  }
};

/**
 * Update facility
 */
export const updateFacility = async (classId, facilityId, facilityData) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/classes/${classId}/facilities/${facilityId}`,
      facilityData,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating facility:', error);
    throw error;
  }
};

/**
 * Delete facility
 */
export const deleteFacility = async (classId, facilityId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/classes/${classId}/facilities/${facilityId}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting facility:', error);
    throw error;
  }
};

// ============ BATCH OPERATIONS ============

/**
 * Fetch all class data (details + inventory + schedules + facilities)
 */
export const getAllClassData = async (classId) => {
  try {
    const [details, inventory, schedules, facilities] = await Promise.all([
      getClassDetails(classId),
      getInventoryItems(classId),
      getSchedules(classId),
      getFacilities(classId)
    ]);

    return {
      ...details,
      inventory,
      schedules,
      facilities
    };
  } catch (error) {
    console.error('Error fetching all class data:', error);
    throw error;
  }
};

/**
 * Export class data as CSV/JSON
 */
export const exportClassData = (classData, format = 'json') => {
  try {
    if (format === 'json') {
      const dataStr = JSON.stringify(classData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `class-${classData.id}-data.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
    // Add CSV export logic as needed
  } catch (error) {
    console.error('Error exporting class data:', error);
    throw error;
  }
};

export default {
  // Class Detail
  getClassDetails,
  getClassStatistics,

  // Inventory
  getInventoryItems,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,

  // Schedule
  getSchedules,
  addSchedule,
  updateSchedule,
  deleteSchedule,

  // Facilities
  getFacilities,
  addFacility,
  updateFacility,
  deleteFacility,

  // Batch
  getAllClassData,
  exportClassData
};

/**
 * School Context Module
 * Helpers for reading and writing school/branch context in local storage.
 */

export const getCurrentSchoolId = () => null;
const INSTITUTION_KEY = 'selectedInstitutionType';

export const getStoredUser = () => {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) return JSON.parse(userStr);
    } catch (err) {
        console.error('Failed to parse user from localStorage', err);
    }
    return null;
};

export const isSuperAdminUser = () => {
    const user = getStoredUser();
    return user?.role === 'SUPER_ADMIN';
};

export const resolveCurrentSchoolId = () => null;

export const getSelectedInstitutionType = () => {
    try {
        localStorage.removeItem(INSTITUTION_KEY);
        return getStoredUser()?.institutionType || null;
    } catch (_err) {
        return null;
    }
};

export const setSelectedInstitutionType = (institutionType) => {
    try {
        localStorage.removeItem(INSTITUTION_KEY);
    } catch (_err) {
        // no-op
    }
};

export const clearSelectedInstitutionType = () => {
    try {
        localStorage.removeItem(INSTITUTION_KEY);
    } catch (_err) {
        // no-op
    }
};

export const setCurrentSchoolId = (id) => { };
export const setBranchId = (id) => { };

export const clearCurrentSchoolId = () => { };
export const clearBranchId = () => { };

export const getBranchId = () => null;

/**
 * Branding Utilities
 * Centralized source of truth for school branding and document layout
 */
import { PRODUCT_BRAND_EMAIL, PRODUCT_DISPLAY_NAME, PRODUCT_NAME } from '../config/productIdentity';

/**
 * Gets the current school branding from the authenticated user context/storage
 * @returns {Object} School branding object
 */
export const getSchoolBranding = () => {
    try {
        const userString = localStorage.getItem('user');
        if (userString) {
            const user = JSON.parse(userString);
            if (user.school) {
                return {
                    name: user.school.name || PRODUCT_DISPLAY_NAME,
                    phone: user.school.phone || '',
                    email: user.school.email || '',
                    address: user.school.address || '',
                    motto: user.school.motto || '',
                    logo: user.school.logoUrl || user.school.logo || '/logo.png',
                    brandColor: user.school.brandColor || '#1a3668',
                    stamp: user.school.stampUrl || '/branding/stamp.svg'
                };
            }
        }
    } catch (e) {
        console.error('Error fetching school branding:', e);
    }

    // Robust Defaults
    return {
        name: PRODUCT_DISPLAY_NAME,
        phone: '+254712345000',
        email: PRODUCT_BRAND_EMAIL,
        address: 'Isiolo Central, Kenya',
        motto: 'Rise & Shine',
        logo: '/logo.png',
        brandColor: '#1a3668',
        stamp: '/branding/stamp.svg'
    };
};

/**
 * Draws the standard "Official Stamp" on a jsPDF document
 * @param {Object} doc - jsPDF instance
 * @param {number} x - X coordinate (top-left)
 * @param {number} y - Y coordinate (top-left)
 * @param {Object} options - Customization options
 */
export const drawOfficialStamp = (doc, x, y, options = {}) => {
    const {
        color = [30, 64, 175],
        status = 'APPROVED',
        dept = 'FINANCE DEPT.',
        date = new Date().toLocaleDateString('en-GB')
    } = options;

    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    doc.setLineDash([1, 0.5], 0);
    doc.roundedRect(x, y, 52, 26, 2, 2, 'S');
    doc.setLineDash([]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...color);
    doc.text('OFFICIAL SEAL', x + 26, y + 5, { align: 'center' });

    doc.setFontSize(16);
    doc.text(status, x + 26, y + 14, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${PRODUCT_NAME.toUpperCase()} ${dept}`, x + 26, y + 20, { align: 'center' });
    doc.text(date, x + 26, y + 23, { align: 'center' });
};

/**
 * Helper to convert hex to RGB
 * @param {string} hex - Hex color string
 * @returns {Object} {r, g, b}
 */
export const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#1a3668');
    if (!result) {
        return { r: 26, g: 54, b: 104 };
    }
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };
};

/**
 * Draws a professional banded letterhead on a jsPDF document
 * @param {Object} doc - jsPDF instance
 * @param {Object} branding - Branding data from getSchoolBranding()
 * @param {Object} docInfo - { type: 'INVOICE', ref: 'INV-001' }
 */
/**
 * Returns a high-quality HTML/CSS letterhead template for PDF generation
 * @param {Object} branding - School branding data
 * @param {Object} docInfo - { type: 'INVOICE', ref: 'INV-001' }
 * @returns {string} HTML string
 */
export const getOfficialLetterheadHTML = (branding, docInfo) => {
    return `
        <div style="background-color: ${branding.brandColor}; padding: 30px; color: white; display: flex; justify-content: space-between; align-items: center; font-family: 'Raleway', sans-serif;">
            <div style="display: flex; align-items: center; gap: 20px;">
                ${branding.logo ? `<img src="${branding.logo}" style="width: 80px; height: 80px; object-fit: contain; background: white; border-radius: 8px; padding: 5px;" />` : ''}
                <div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">${branding.name}</h1>
                    <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9; font-weight: 500;">
                        ${[branding.phone, branding.email, branding.address].filter(Boolean).join(' &nbsp;•&nbsp; ')}
                    </p>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${docInfo.type}</div>
                <div style="font-size: 13px; opacity: 0.8; margin-top: 5px; font-weight: 600;">${docInfo.ref}</div>
            </div>
        </div>
    `;
};

/**
 * Returns an HTML string for the official school stamp
 * @param {Object} options - { status: 'PAID', date: '...' }
 * @returns {string} HTML string
 */
export const getOfficialStampHTML = (options = {}) => {
    const {
        status = 'APPROVED',
        dept = 'FINANCE DEPT.',
        date = new Date().toLocaleDateString('en-GB'),
        color = '#1e40af'
    } = options;

    return `
        <div style="border: 3px dashed ${color}; width: 180px; padding: 10px; border-radius: 8px; transform: rotate(-5deg); text-align: center; color: ${color}; font-family: 'Courier New', Courier, monospace; background: rgba(255,255,255,0.8);">
            <div style="font-size: 10px; font-weight: bold; border-bottom: 1px solid ${color}; padding-bottom: 2px; margin-bottom: 5px;">OFFICIAL SEAL</div>
            <div style="font-size: 24px; font-weight: 900; margin: 5px 0;">${status}</div>
            <div style="font-size: 10px; font-weight: bold;">${PRODUCT_NAME.toUpperCase()} ${dept}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${date}</div>
        </div>
    `;
};

export const drawStandardHeader = async (doc, branding, docInfo) => {
    const pageW = doc.internal.pageSize.getWidth();
    const M = 15;

    // Background Band
    const rgb = hexToRgb(branding.brandColor);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, pageW, 40, 'F');

    // Load Logo
    let logoData = null;
    if (branding.logo) {
        try {
            const r = await fetch(branding.logo).catch(() => null);
            if (r && r.ok) {
                const b = await r.blob();
                logoData = await new Promise(res => {
                    const fr = new FileReader();
                    fr.onload = () => res(fr.result);
                    fr.readAsDataURL(b);
                });
            }
        } catch (_) { }
    }

    if (logoData) {
        try {
            doc.addImage(logoData, 'PNG', M, 10, 20, 20);
        } catch (_) { }
    }

    // School Name & Contact
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    const textX = M + (logoData ? 25 : 0);
    doc.text(branding.name.toUpperCase(), textX, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const contactInfo = [
        branding.phone,
        branding.email,
        branding.address
    ].filter(Boolean).join('  •  ');
    doc.text(contactInfo, textX, 29);

    // Document Type & Ref
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(docInfo.type, pageW - M, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(docInfo.ref, pageW - M, 29, { align: 'right' });

    return 45; // Returns the next Y position
};

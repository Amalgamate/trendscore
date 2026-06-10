import ExcelJS from 'exceljs';
import { PRODUCT_DISPLAY_NAME, PRODUCT_NAME } from '../config/productIdentity';

/**
 * Generates a professionally formatted Excel template for fee payments import.
 * One combined sheet for 'Payments/Collections' that maps Adm No, Amount, Date, and Reference.
 */
export const downloadFeeTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = PRODUCT_DISPLAY_NAME;
  workbook.lastModifiedBy = PRODUCT_DISPLAY_NAME;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Create sheet
  const sheet = workbook.addWorksheet('Fee Collections Template', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // Define columns
  sheet.columns = [
    { header: 'Adm No', key: 'admNo', width: 15 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Reference', key: 'reference', width: 25 },
    { header: 'Mode', key: 'mode', width: 15 },
    { header: 'Allocation', key: 'allocation', width: 15 },
    { header: 'Notes', key: 'notes', width: 30 }
  ];

  // Professional Styling for Header
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF002C60' } // Navy Blue
    };
    cell.font = {
      name: 'Arial',
      family: 2,
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' } // White
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'medium' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add Sample Data for Guidance
  const sampleData = [
    { admNo: '1001', amount: 15000, date: '2026-01-15', reference: 'TRX892348923', mode: 'BANK', allocation: 'TUITION', notes: 'First Term Initial Payment' },
    { admNo: '1002', amount: 5000, date: '2026-02-01', reference: 'BANK-X-901', mode: 'CHEQUE', allocation: 'AUTO', notes: 'Book Fund' },
    { admNo: '1005', amount: 12400, date: '2026-01-20', reference: 'MPESA-REF-772', mode: 'MPESA', allocation: 'TRANSPORT', notes: 'Transport Deposit' }
  ];

  sampleData.forEach(data => {
    const row = sheet.addRow(data);
    row.font = { italic: true, color: { argb: 'FF94A3B8' } }; // Slate 400
  });

  // Add a hidden helper row to explain format (optional, but keep it clean)
  // sheet.addRow([]);
  // const noteRow = sheet.addRow(['* IMPORTANT: Do not change the column headers. Format dates as YYYY-MM-DD.']);
  // noteRow.font = { bold: true, color: { argb: 'FFDC2626' }, size: 9 };

  // Write to Buffer and Trigger Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${PRODUCT_NAME}_Fee_Import_Template_${new Date().getFullYear()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};

/**
 * Generates a template for Initial Balances import.
 * Maps Adm No, Billed, Paid, Balance.
 */
export const downloadBalanceTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = PRODUCT_DISPLAY_NAME;
  workbook.lastModifiedBy = PRODUCT_DISPLAY_NAME;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Create sheet
  const sheet = workbook.addWorksheet('Initial Balances Template', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // Define columns
  sheet.columns = [
    { header: 'Adm No', key: 'admNo', width: 15 },
    { header: 'Billed', key: 'billed', width: 15 },
    { header: 'Paid', key: 'paid', width: 15 },
    { header: 'Balance', key: 'balance', width: 15 },
    { header: 'Transport Billed', key: 'transportBilled', width: 18 },
    { header: 'Transport Paid', key: 'transportPaid', width: 18 }
  ];

  // Professional Styling for Header
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' } // Blue 800
    };
    cell.font = {
      name: 'Arial',
      family: 2,
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' } // White
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'medium' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add Sample Data for Guidance
  const sampleData = [
    { admNo: '1291', billed: 8800, paid: 7000, balance: 1800, transportBilled: 0, transportPaid: 0 },
    { admNo: '1064', billed: 10300, paid: 10300, balance: 0, transportBilled: 5000, transportPaid: 2000 },
    { admNo: '1176', billed: 21100, paid: 0, balance: 21100, transportBilled: 0, transportPaid: 0 }
  ];

  sampleData.forEach(data => {
    const row = sheet.addRow(data);
    row.font = { italic: true, color: { argb: 'FF64748B' } }; // Slate 500
  });

  // Write to Buffer and Trigger Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${PRODUCT_NAME}_Initial_Balances_Template_${new Date().getFullYear()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};

/**
 * Generates a template for Fee Waivers import.
 * Maps Adm No, Waiver, Date, Reason.
 */
export const downloadWaiverTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = PRODUCT_DISPLAY_NAME;
  workbook.lastModifiedBy = PRODUCT_DISPLAY_NAME;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Create sheet
  const sheet = workbook.addWorksheet('Fee Waivers Template', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // Define columns
  sheet.columns = [
    { header: 'Adm No', key: 'admNo', width: 15 },
    { header: 'Waiver', key: 'waiver', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Reason', key: 'reason', width: 30 }
  ];

  // Professional Styling for Header
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D9488' } // Teal 600
    };
    cell.font = {
      name: 'Arial',
      family: 2,
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' } // White
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'medium' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add Sample Data for Guidance
  const sampleData = [
    { admNo: '1462', waiver: 19700, date: '2026-02-25', reason: 'Term 1 Scholarship Adjustment' },
    { admNo: '965', waiver: 18500, date: '2026-02-25', reason: 'Sibling Discount' },
    { admNo: '1307', waiver: 18300, date: '2026-02-25', reason: 'Sports Talent Waiver' }
  ];

  sampleData.forEach(data => {
    const row = sheet.addRow(data);
    row.font = { italic: true, color: { argb: 'FF64748B' } }; // Slate 500
  });

  // Write to Buffer and Trigger Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${PRODUCT_NAME}_Fee_Waivers_Template_${new Date().getFullYear()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};

/**
 * Generates a minimal template for Transport Fee bulk import.
 * Only needs: Adm No, Transport Billed
 */
export const downloadTransportTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = PRODUCT_DISPLAY_NAME;
  workbook.lastModifiedBy = PRODUCT_DISPLAY_NAME;
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Transport Fees Template', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'Adm No', key: 'admNo', width: 15 },
    { header: 'Charges', key: 'transportBilled', width: 15 },
    { header: 'Paid', key: 'transportPaid', width: 15 },
    { header: 'Bal', key: 'transportBalance', width: 15 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Amber
    cell.font = { name: 'Arial', family: 2, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'medium' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  const sampleData = [
    { admNo: '1001', transportBilled: 5000, transportPaid: 5000, transportBalance: 0 },
    { admNo: '1002', transportBilled: 5000, transportPaid: 3000, transportBalance: 2000 },
    { admNo: '1005', transportBilled: 7500, transportPaid: 0, transportBalance: 7500 }
  ];
  sampleData.forEach(data => {
    const row = sheet.addRow(data);
    row.font = { italic: true, color: { argb: 'FF64748B' } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${PRODUCT_NAME}_Transport_Fees_Template_${new Date().getFullYear()}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};

import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle, AlertCircle, Loader, Search } from 'lucide-react';
import ExcelJS from 'exceljs';

const BulkMarkImportModal = ({ show, onClose, onImport, learners, totalMarks }) => {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { validMarks: [], invalidEntries: [] }
  const [error, setError] = useState(null);

  if (!show) return null;

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setImportPreview(null);
    setError(null);
  };

  const parseCsv = (text) => {
    return text
      .split(/\r?\n/)
      .filter(line => line.trim().length > 0)
      .map(line => line.split(',').map(cell => cell.trim()));
  };

  const worksheetToArray = (worksheet) => {
    const rows = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rowValues[colNumber - 1] = cell.value;
      });
      rows.push(rowValues);
    });
    return rows;
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            resolve(parseCsv(e.target.result));
          } catch (err) {
            reject(new Error('Error parsing CSV file.'));
          }
        };
        reader.onerror = () => reject(new Error('Error reading file.'));
        reader.readAsText(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(e.target.result);
          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            reject(new Error('No worksheet found.'));
            return;
          }
          resolve(worksheetToArray(worksheet));
        } catch (err) {
          reject(new Error('Error parsing Excel file. Ensure it is a valid .xlsx file.'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file.'));
      reader.readAsArrayBuffer(file);
    });
  };

  const validateAndPreview = async () => {
    if (!file) {
      setError("Please select a file to import.");
      return;
    }

    setParsing(true);
    setError(null);
    setImportPreview(null);

    try {
      const data = await parseExcelFile(file);
      // Assuming header row is present: Admission Number, Student Name, Mark
      const headers = data[0];
      const rows = data.slice(1);

      const admissionNoIndex = headers.findIndex(h => h && h.toLowerCase().includes('admission number'));
      const markIndex = headers.findIndex(h => h && h.toLowerCase().includes('mark'));

      if (admissionNoIndex === -1 || markIndex === -1) {
        throw new Error("Missing required columns: 'Admission Number' and 'Mark'.");
      }

      const validMarks = {};
      const invalidEntries = [];
      const learnerMap = new Map(learners.map(l => [l.admissionNumber.toLowerCase(), l]));

      rows.forEach((row, index) => {
        const admissionNumber = String(row[admissionNoIndex]).trim();
        const mark = parseFloat(row[markIndex]);

        if (!admissionNumber || isNaN(mark)) {
          invalidEntries.push({ row: index + 2, reason: "Missing admission number or invalid mark.", data: row });
          return;
        }

        const learner = learnerMap.get(admissionNumber.toLowerCase());
        if (!learner) {
          invalidEntries.push({ row: index + 2, reason: `Learner with admission number '${admissionNumber}' not found.`, data: row });
          return;
        }

        if (mark < 0) {
          invalidEntries.push({
            row: index + 2,
            reason: `Mark ${mark} cannot be negative for learner ${admissionNumber}.`,
            data: row
          });
          return;
        }

        validMarks[learner.id] = mark;
      });

      setImportPreview({ validMarks, invalidEntries });

    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (importPreview && Object.keys(importPreview.validMarks).length > 0) {
      onImport(importPreview.validMarks);
      // Optionally clear state after successful import
      setFile(null);
      setImportPreview(null);
      setError(null);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportPreview(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium">Bulk Import Summative Marks</h3>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700 mb-4">
            Upload an Excel/CSV file containing student admission numbers and their marks.
            The file should have columns titled 'Admission Number' and 'Mark'.
            <br/>
            <a 
              href="/templates/summative_marks_template.xlsx" 
              download
              className="text-blue-600 hover:underline text-sm font-medium mt-2 inline-block"
            >Download Template File</a>
          </p>

          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition"
            onClick={() => document.getElementById('file-upload-input').click()}
          >
            <input 
              type="file" 
              id="file-upload-input" 
              className="hidden" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-green-700 font-medium">
                <FileText size={20} /> {file.name} loaded.
              </div>
            ) : (
              <div className="text-gray-500 flex flex-col items-center">
                <UploadCloud size={30} className="mb-2" />
                <span>Drag & drop or click to upload file</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-medium">Error! </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <button
            onClick={validateAndPreview}
            disabled={!file || parsing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsing ? <Loader className="animate-spin" size={20} /> : <Search size={20} />}
            {parsing ? 'Parsing...' : 'Preview Import'}
          </button>

          {importPreview && (
            <div className="mt-6">
              <h4 className="text-md font-medium mb-3">Import Preview:</h4>
              {importPreview.invalidEntries.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-4">
                  <p className="font-medium text-red-800 flex items-center gap-2">
                    <AlertCircle size={20} /> {importPreview.invalidEntries.length} Invalid Entries
                  </p>
                  <ul className="list-disc list-inside text-red-700 text-sm mt-2">
                    {importPreview.invalidEntries.map((entry, idx) => (
                      <li key={idx}>Row {entry.row}: {entry.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Object.keys(importPreview.validMarks).length > 0 && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3">
                  <p className="font-medium text-green-800 flex items-center gap-2">
                    <CheckCircle size={20} /> {Object.keys(importPreview.validMarks).length} Valid Marks Ready to Import
                  </p>
                  {/* Optional: Display a few valid entries as a sample */}
                  <ul className="list-disc list-inside text-green-700 text-sm mt-2 max-h-24 overflow-y-auto">
                    {Object.entries(importPreview.validMarks).slice(0, 5).map(([learnerId, mark]) => {
                      const learner = learners.find(l => l.id === learnerId);
                      return <li key={learnerId}>{learner?.firstName} {learner?.lastName} (Adm No: {learner?.admissionNumber}): {mark}</li>;
                    })}
                    {Object.keys(importPreview.validMarks).length > 5 && (
                      <li>... and {Object.keys(importPreview.validMarks).length - 5} more.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!importPreview || Object.keys(importPreview.validMarks).length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkMarkImportModal;

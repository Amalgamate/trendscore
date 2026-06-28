import React from 'react';

/**
 * ThermalReceipt
 * Specialized minimalist layout for 80mm / 58mm POS thermal printers.
 * Uses browser printing (window.print()).
 */
const ThermalReceipt = ({ invoice, schoolInfo }) => {
  if (!invoice) return null;

  const learner = invoice.learner || {};
  const items = invoice.feeStructure?.items || invoice.items || [];
  const totalPaid = Number(invoice.paidAmount || 0);
  const balance = Number(invoice.balance || 0);

  return (
    <div className="thermal-receipt-container font-mono text-[10px] leading-tight text-black p-1 w-[58mm] mx-auto bg-white border border-gray-100">
      {/* Header */}
      <div className="text-center mb-4 space-y-1">
        <h1 className="text-sm font-semibold uppercase">{schoolInfo?.name || 'TRENDSCORE SCHOOL'}</h1>
        <p>{schoolInfo?.address || 'P.O. BOX 123-00100, NAIROBI'}</p>
        <p>Tel: {schoolInfo?.phone || '0700 000 000'}</p>
        <div className="border-b border-dashed border-black my-2" />
        <p className="font-semibold text-xs">OFFICIAL RECEIPT</p>
        <p>No: RCT-{invoice.invoiceNumber}</p>
        <p>Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      {/* Student Details */}
      <div className="mb-4 space-y-0.5">
        <p><span className="font-medium">STUDENT:</span> {learner.firstName} {learner.lastName}</p>
        <p><span className="font-medium">ADM NO:</span> {learner.admissionNumber}</p>
        <p><span className="font-medium">CLASS:</span> {(learner.grade || '').replace(/_/g, ' ')}</p>
        <p><span className="font-medium">TERM:</span> {(invoice.term || '').replace(/_/g, ' ')} {invoice.academicYear}</p>
      </div>

      <div className="border-b border-dashed border-black mb-2" />

      {/* Items Table */}
      <table className="w-full text-left mb-4">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1">Description</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="py-1 uppercase text-[10px]">{item.name || item.description}</td>
              <td className="py-1 text-right">{Number(item.amount || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-b border-dashed border-black mb-2" />

      {/* Totals */}
      <div className="space-y-1 font-medium">
        <div className="flex justify-between">
          <span>SUBTOTAL:</span>
          <span>KES {Number(invoice.totalAmount || 0).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>TOTAL PAID:</span>
          <span>KES {totalPaid.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>BALANCE:</span>
          <span>KES {balance.toLocaleString()}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-4" />

      {/* Footer */}
      <div className="text-center space-y-1">
        <p className="font-medium">Mode: {invoice.paymentType || 'CASH/BANK'}</p>
        <p className="italic">Served by: {invoice.servedBy || 'System Admin'}</p>
        <div className="pt-2">
          <p className="font-semibold">THANK YOU</p>
          <p>Excellence in Education</p>
        </div>
      </div>
      
      {/* Signature placeholder for thermal */}
      <div className="mt-8 border-t border-dotted border-black pt-1 text-center">
        Accountant's Signature
      </div>
    </div>
  );
};

export default ThermalReceipt;

/**
 * InvoiceA5.jsx — TrendScore
 * ─────────────────────────────────────────────────────────────────────────────
 * A5 Portrait (148 × 210 mm) fee invoice / receipt.
 *
 * HOW TO USE IN InvoiceDetailPage.jsx
 * ────────────────────────────────────
 * 1. Drop this file into:
 *      src/components/CBCGrading/shared/InvoiceA5.jsx
 *
 * 2. In InvoiceDetailPage.jsx, import:
 *      import InvoiceA5 from '../shared/InvoiceA5';
 *
 * 3. Add state:
 *      const [showA5Preview, setShowA5Preview] = useState(false);
 *
 * 4. Replace the existing "A4" download button with:
 *      <button onClick={() => setShowA5Preview(true)} className="...">A5 Invoice</button>
 *
 * 5. At the bottom of the JSX (before closing </div>):
 *      {showA5Preview && (
 *        <InvoiceA5
 *          invoice={invoice}
 *          schoolInfo={schoolInfo}
 *          onClose={() => setShowA5Preview(false)}
 *        />
 *      )}
 *
 * Props
 * ─────
 *  invoice    — feeInvoice object from the API (with .learner, .feeStructure.feeItems, .payments, .waivers)
 *  schoolInfo — branding object from api.branding.get()   (optional — graceful fallback)
 *  onClose    — () => void
 */

import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

// ─── A5 constants ──────────────────────────────────────────────────────────────
const A5_W_MM  = 148;
const A5_H_MM  = 210;
const A5_W_PX  = 559;   // 148mm @ 96dpi
const A5_H_PX  = 794;   // 210mm @ 96dpi
const SCALE    = 3;     // 288 dpi capture

// ─── Brand palette ────────────────────────────────────────────────────────────
const BRAND = {
  navy:   '#520050',   // TrendScore primary (deep purple)
  teal:   '#0D9488',
  light:  '#f0e6f0',
  ink:    '#1a1a2e',
  muted:  '#6b7280',
  border: '#e5d9e5',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n)    => Number(n || 0).toLocaleString('en-KE');
const fmtDt = (d)    => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const label = (s='') => s.replace(/_/g, ' ');

function statusChip(status) {
  const map = {
    PAID:     { bg: '#dcfce7', color: '#15803d', text: 'PAID'     },
    PARTIAL:  { bg: '#fef9c3', color: '#854d0e', text: 'PARTIAL'  },
    PENDING:  { bg: '#fee2e2', color: '#b91c1c', text: 'PENDING'  },
    OVERPAID: { bg: '#dbeafe', color: '#1d4ed8', text: 'OVERPAID' },
    WAIVED:   { bg: '#d1fae5', color: '#065f46', text: 'WAIVED'   },
    CANCELLED:{ bg: '#f3f4f6', color: '#6b7280', text: 'CANCELLED'},
  };
  return map[status] || { bg:'#f3f4f6', color:'#6b7280', text: status };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InvoiceA5({ invoice, schoolInfo, onClose }) {
  const printRef  = useRef(null);
  const [saving, setSaving]   = useState(false);
  const [printing, setPrinting] = useState(false);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!invoice) return null;

  // ── derived data ────────────────────────────────────────────────────────────
  const learner    = invoice.learner  || {};
  const structure  = invoice.feeStructure || {};
  const feeItems   = structure.feeItems   || [];
  const payments   = invoice.payments     || [];
  const waivers    = (invoice.waivers || []).filter(w => w.status === 'APPROVED' || w.amountWaived);

  const totalWaived  = waivers.reduce((s, w) => s + Number(w.amountWaived || 0), 0);
  const totalPaid    = Number(invoice.paidAmount || 0);
  const totalCharged = Number(invoice.totalAmount || 0);
  const balance      = Number(invoice.balance     || 0);

  const isPaid = ['PAID','OVERPAID','WAIVED'].includes(invoice.status);
  const docType = isPaid ? 'OFFICIAL RECEIPT' : 'FEE INVOICE';
  const chip    = statusChip(invoice.status);

  const schoolName = schoolInfo?.name || schoolInfo?.schoolName || PRODUCT_DISPLAY_NAME;
  const schoolAddr = schoolInfo?.address || 'P.O. Box 123, Nairobi';
  const schoolPhone= schoolInfo?.phone  || '';
  const logoUrl    = schoolInfo?.logoUrl || '/branding/logo.png';
  const stampUrl   = schoolInfo?.stampUrl || '/branding/stamp.svg';

  // ── PDF download ────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (saving || !printRef.current) return;
    setSaving(true);
    try {
      await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const el = printRef.current;
      const canvas = await html2canvas(el, {
        scale: SCALE,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width:  A5_W_PX,
        height: A5_H_PX,
        windowWidth: A5_W_PX,
        scrollX: 0, scrollY: 0,
        onclone: (_doc, clone) => {
          clone.style.cssText = `
            position:absolute;left:0;top:0;margin:0;padding:0;
            width:${A5_W_PX}px;height:${A5_H_PX}px;overflow:hidden;
            background:#fff;
          `;
          clone.querySelectorAll('*').forEach(n => {
            n.style.visibility = 'visible';
            n.style.opacity    = '1';
          });
        },
      });

      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a5', compress:true });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData,'PNG', 0, 0, A5_W_MM, A5_H_MM);
      pdf.save(`Invoice_${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('[InvoiceA5 download]', err);
    } finally {
      setSaving(false);
    }
  };

  // ── browser print ───────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (printing || !printRef.current) return;
    setPrinting(true);
    try {
      await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await html2canvas(printRef.current, {
        scale: SCALE, useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
        width: A5_W_PX, height: A5_H_PX, windowWidth: A5_W_PX,
      });
      const img  = canvas.toDataURL('image/png');
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>*{margin:0;padding:0}body{background:#fff}img{display:block;width:148mm;height:210mm}
        @page{size:A5 portrait;margin:0}</style></head>
        <body><img src="${img}"/></body></html>`;
      const blob = new Blob([html], { type:'text/html' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (win) win.onload = () => { win.focus(); win.print(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
    } catch (err) { console.error('[InvoiceA5 print]', err); }
    finally { setPrinting(false); }
  };

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.65)',
        zIndex:9999, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'16px',
        backdropFilter:'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      {/* ── toolbar ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:'10px',
        marginBottom:'12px', width:'100%', maxWidth: `${A5_W_PX}px`,
        justifyContent:'flex-end',
      }}>
        <button
          onClick={handleDownload} disabled={saving}
          style={{
            display:'flex', alignItems:'center', gap:'6px',
            background: BRAND.navy, color:'#fff',
            border:'none', borderRadius:'8px',
            padding:'8px 18px', fontWeight:700, fontSize:'13px',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          <Download size={15}/> {saving ? 'Saving…' : 'Download PDF'}
        </button>
        <button
          onClick={handlePrint} disabled={printing}
          style={{
            display:'flex', alignItems:'center', gap:'6px',
            background: BRAND.teal, color:'#fff',
            border:'none', borderRadius:'8px',
            padding:'8px 18px', fontWeight:700, fontSize:'13px',
            cursor: printing ? 'not-allowed' : 'pointer', opacity: printing ? 0.6 : 1,
          }}
        >
          <Printer size={15}/> {printing ? 'Preparing…' : 'Print'}
        </button>
        <button
          onClick={onClose}
          style={{
            display:'flex', alignItems:'center', gap:'6px',
            background:'rgba(255,255,255,0.15)', color:'#fff',
            border:'1px solid rgba(255,255,255,0.3)', borderRadius:'8px',
            padding:'8px 12px', fontWeight:700, fontSize:'13px', cursor:'pointer',
          }}
        >
          <X size={15}/> Close
        </button>
      </div>

      {/* ── A5 invoice body ── */}
      <div
        ref={printRef}
        style={{
          width:`${A5_W_PX}px`, height:`${A5_H_PX}px`,
          background:'#fff',
          fontFamily: "'Georgia', 'Times New Roman', serif",
          overflow:'hidden', position:'relative',
          boxShadow:'0 8px 60px rgba(0,0,0,0.45)',
          display:'flex', flexDirection:'column',
          borderRadius:'2px',
          flexShrink: 0,
        }}
      >

        {/* ══ HEADER BAND ══════════════════════════════════════════════════════ */}
        <div style={{
          background: BRAND.navy,
          padding:'18px 24px 14px',
          display:'flex', alignItems:'center', gap:'14px',
          flexShrink:0,
        }}>
          {/* Logo */}
          <img
            src={logoUrl}
            alt="School Logo"
            crossOrigin="anonymous"
            style={{ width:'46px', height:'46px', objectFit:'contain', borderRadius:'4px', background:'#fff', padding:'3px', flexShrink:0 }}
            onError={(e) => { e.target.style.display='none'; }}
          />

          {/* School name + doc type */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              color:'#fff', fontFamily:"'Georgia', serif",
              fontSize:'15px', fontWeight:700, letterSpacing:'0.5px',
              textTransform:'uppercase', lineHeight:1.2,
            }}>
              {schoolName}
            </div>
            <div style={{ color: '#d4b8d4', fontSize:'9px', marginTop:'2px', letterSpacing:'1.5px', fontFamily:"'Arial', sans-serif" }}>
              {schoolAddr}{schoolPhone ? ` · ${schoolPhone}` : ''}
            </div>
          </div>

          {/* Doc type + status chip */}
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{
              color:'#fff', fontSize:'10px', fontWeight:700, letterSpacing:'2px',
              textTransform:'uppercase', fontFamily:"'Arial', sans-serif",
            }}>
              {docType}
            </div>
            <div style={{
              display:'inline-block', marginTop:'5px',
              background: chip.bg, color: chip.color,
              borderRadius:'20px', padding:'2px 10px',
              fontSize:'9px', fontWeight:800, letterSpacing:'1px',
              textTransform:'uppercase', fontFamily:"'Arial', sans-serif",
            }}>
              {chip.text}
            </div>
          </div>
        </div>

        {/* ── thin accent stripe ── */}
        <div style={{ height:'3px', background:`linear-gradient(90deg, ${BRAND.teal}, ${BRAND.navy})`, flexShrink:0 }} />

        {/* ══ INVOICE META ROW ═════════════════════════════════════════════════ */}
        <div style={{
          background: BRAND.light,
          padding:'8px 24px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          flexShrink:0,
          borderBottom:`1px solid ${BRAND.border}`,
        }}>
          <MetaItem label="Invoice No." value={invoice.invoiceNumber} bold />
          <MetaItem label="Term" value={`${label(invoice.term||'')} ${invoice.academicYear||''}`} />
          <MetaItem label="Issue Date" value={fmtDt(invoice.createdAt)} />
          <MetaItem label="Due Date"   value={fmtDt(invoice.dueDate)} color={balance > 0 ? '#b91c1c' : undefined} />
        </div>

        {/* ══ BILLED TO ════════════════════════════════════════════════════════ */}
        <div style={{ padding:'10px 24px 8px', flexShrink:0, display:'flex', gap:'20px' }}>
          {/* Student */}
          <div style={{ flex:1 }}>
            <SectionLabel text="Billed To" />
            <div style={{ fontSize:'13px', fontWeight:700, color: BRAND.ink, marginTop:'2px' }}>
              {learner.firstName} {learner.lastName}
            </div>
            <div style={{ fontSize:'9.5px', color: BRAND.muted, marginTop:'1px', fontFamily:"'Arial',sans-serif" }}>
              Adm No: {learner.admissionNumber || '—'} &nbsp;|&nbsp; {label(learner.grade||'')} {learner.stream||''}
            </div>
          </div>
          {/* Guardian */}
          <div style={{ flex:1 }}>
            <SectionLabel text="Parent / Guardian" />
            <div style={{ fontSize:'12px', fontWeight:600, color: BRAND.ink, marginTop:'2px' }}>
              {learner.primaryContactName || learner.guardianName || '—'}
            </div>
            <div style={{ fontSize:'9.5px', color: BRAND.muted, marginTop:'1px', fontFamily:"'Arial',sans-serif" }}>
              {learner.primaryContactPhone || learner.guardianPhone || ''}
            </div>
          </div>
        </div>

        {/* ══ FEE ITEMS TABLE ══════════════════════════════════════════════════ */}
        <div style={{ padding:'0 24px', flex:1, minHeight:0 }}>
          {/* Table head */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 68px 80px',
            background: BRAND.navy, borderRadius:'4px 4px 0 0',
            padding:'5px 10px',
          }}>
            {['Description','Type','Amount (KES)'].map((h, i) => (
              <div key={h} style={{
                color:'#fff', fontSize:'8.5px', fontWeight:700,
                letterSpacing:'0.8px', textTransform:'uppercase',
                fontFamily:"'Arial',sans-serif",
                textAlign: i === 2 ? 'right' : 'left',
              }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ border:`1px solid ${BRAND.border}`, borderTop:'none', borderRadius:'0 0 4px 4px', overflow:'hidden' }}>
            {feeItems.length === 0 ? (
              /* Fallback single row when feeItems not populated */
              <TableRow
                name={structure.name || 'School Fees'}
                type="MANDATORY"
                amount={fmt(totalCharged)}
                idx={0}
              />
            ) : (
              feeItems.map((item, idx) => (
                <TableRow
                  key={item.id || idx}
                  name={item.feeType?.name || item.name || 'Fee'}
                  type={item.mandatory !== false ? 'MANDATORY' : 'OPTIONAL'}
                  amount={fmt(item.amount)}
                  idx={idx}
                />
              ))
            )}

            {/* Transport row if visible in total but not in items */}
            {learner.isTransportStudent && !feeItems.find(i => i.feeType?.code === 'TRANSPORT') && (
              <TableRow
                name="Transport Fee"
                type="OPTIONAL"
                amount="—"
                idx={feeItems.length}
                italic
              />
            )}
          </div>
        </div>

        {/* ══ TOTALS + PAYMENTS ════════════════════════════════════════════════ */}
        <div style={{
          padding:'8px 24px 0',
          display:'flex', gap:'10px',
          alignItems:'flex-start',
          flexShrink:0,
        }}>
          {/* Payment history */}
          {payments.length > 0 && (
            <div style={{ flex:1, minWidth:0 }}>
              <SectionLabel text="Payments Received" />
              <div style={{ marginTop:'3px' }}>
                {payments.slice(0,4).map((p, i) => (
                  <div key={p.id||i} style={{
                    display:'flex', justifyContent:'space-between',
                    fontSize:'9px', color: BRAND.muted, padding:'2px 0',
                    borderBottom: i < payments.length - 1 ? `1px solid ${BRAND.border}` : 'none',
                    fontFamily:"'Arial',sans-serif",
                  }}>
                    <span>{fmtDt(p.paymentDate||p.createdAt)} · {p.paymentMethod}</span>
                    <span style={{ fontWeight:600, color:'#15803d' }}>KES {fmt(p.amount)}</span>
                  </div>
                ))}
                {payments.length > 4 && (
                  <div style={{ fontSize:'8px', color: BRAND.muted, fontStyle:'italic', marginTop:'2px', fontFamily:"'Arial',sans-serif" }}>
                    +{payments.length - 4} more payment(s) on record
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Totals box */}
          <div style={{
            minWidth:'160px',
            border:`1px solid ${BRAND.border}`,
            borderRadius:'6px', overflow:'hidden',
            flexShrink:0,
          }}>
            <TotalRow label="Total Charged" value={`KES ${fmt(totalCharged)}`} />
            {totalPaid > 0 && <TotalRow label="Total Paid"    value={`KES ${fmt(totalPaid)}`}    color="#15803d" />}
            {totalWaived > 0 && <TotalRow label="Waived"     value={`KES ${fmt(totalWaived)}`}   color="#0D9488" />}
            <TotalRow
              label={balance < 0 ? 'Credit' : 'Balance Due'}
              value={`KES ${fmt(Math.abs(balance))}`}
              color={balance <= 0 ? '#15803d' : '#b91c1c'}
              bold
              dark
            />
          </div>
        </div>

        {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
        <div style={{
          marginTop:'auto',
          padding:'6px 24px 10px',
          borderTop:`1px solid ${BRAND.border}`,
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          flexShrink:0,
        }}>
          <div>
            <div style={{ fontSize:'8px', color: BRAND.muted, fontFamily:"'Arial',sans-serif", lineHeight:1.5 }}>
              This is an official financial document issued by {schoolName}.<br/>
              For queries contact the Finance Office.
            </div>
            <div style={{ fontSize:'7.5px', color:'#9ca3af', marginTop:'3px', fontFamily:"'Arial',sans-serif" }}>
              Generated by {PRODUCT_DISPLAY_NAME} · {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>

          {/* Stamp */}
          <div style={{ textAlign:'center', position:'relative' }}>
            {isPaid && (
              <img
                src={stampUrl}
                alt="stamp"
                crossOrigin="anonymous"
                style={{ width:'60px', height:'60px', opacity:0.85 }}
                onError={(e) => { e.target.style.display='none'; }}
              />
            )}
            <div style={{
              width:'70px', borderTop:`1px solid ${BRAND.border}`,
              fontSize:'8px', color: BRAND.muted,
              paddingTop:'3px', textAlign:'center',
              fontFamily:"'Arial',sans-serif",
            }}>
              Authorised Signature
            </div>
          </div>
        </div>

        {/* ── decorative corner accent ── */}
        <div style={{
          position:'absolute', bottom:0, left:0,
          width:'40px', height:'40px',
          background: `linear-gradient(135deg, ${BRAND.teal} 0%, transparent 100%)`,
          opacity:0.12,
          pointerEvents:'none',
        }}/>
        <div style={{
          position:'absolute', top:'74px', right:0,
          width:'4px', height:'60px',
          background: BRAND.teal, opacity:0.5,
          pointerEvents:'none',
        }}/>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetaItem({ label: lbl, value, bold, color }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'7.5px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.7px', fontFamily:"'Arial',sans-serif" }}>{lbl}</div>
      <div style={{ fontSize:'10px', fontWeight: bold ? 800 : 600, color: color || '#1a1a2e', marginTop:'1px', fontFamily:"'Arial',sans-serif" }}>{value}</div>
    </div>
  );
}

function SectionLabel({ text }) {
  return (
    <div style={{
      fontSize:'7.5px', color:'#9ca3af',
      textTransform:'uppercase', letterSpacing:'1px', fontWeight:700,
      fontFamily:"'Arial',sans-serif",
    }}>
      {text}
    </div>
  );
}

function TableRow({ name, type, amount, idx, italic }) {
  const bg = idx % 2 === 0 ? '#fff' : '#faf6fa';
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'1fr 68px 80px',
      padding:'5px 10px', background: bg,
      borderBottom:`1px solid #f0e6f0`,
    }}>
      <div style={{
        fontSize:'10px', color:'#1a1a2e', fontWeight: italic ? 400 : 500,
        fontStyle: italic ? 'italic' : 'normal',
        fontFamily:"'Georgia',serif",
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        paddingRight:'8px',
      }}>
        {name}
      </div>
      <div style={{
        fontSize:'8px', color:'#9ca3af', fontWeight:600,
        textTransform:'uppercase', letterSpacing:'0.4px',
        fontFamily:"'Arial',sans-serif", alignSelf:'center',
      }}>
        {type}
      </div>
      <div style={{
        fontSize:'10.5px', fontWeight:700, color:'#1a1a2e',
        textAlign:'right', fontFamily:"'Arial',sans-serif", alignSelf:'center',
      }}>
        {amount}
      </div>
    </div>
  );
}

function TotalRow({ label: lbl, value, color, bold, dark }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'5px 10px',
      background: dark ? '#faf0fa' : '#fff',
      borderBottom:`1px solid #f0e6f0`,
    }}>
      <span style={{
        fontSize:'9px', color: dark ? '#520050' : '#6b7280',
        fontWeight: bold ? 700 : 500, letterSpacing:'0.3px',
        textTransform: bold ? 'uppercase' : 'none',
        fontFamily:"'Arial',sans-serif",
      }}>
        {lbl}
      </span>
      <span style={{
        fontSize: bold ? '11px' : '10px',
        fontWeight: bold ? 800 : 600,
        color: color || '#1a1a2e',
        fontFamily:"'Arial',sans-serif",
      }}>
        {value}
      </span>
    </div>
  );
}

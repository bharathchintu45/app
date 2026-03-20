import type { OrderReceipt } from "../../types";
import { useEffect, useRef, useState } from "react";
import { Printer, X, Eye } from "lucide-react";

/** Builds the raw HTML for one receipt label (inline styles, no external deps) */
export function buildSingleLabelHtml(order: OrderReceipt): string {
  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const isPaid = order.payment?.toLowerCase().includes('paid');
  const itemsHtml = (order.lines || []).map(l =>
    `<tr style="vertical-align:top;border-bottom:1px dashed #eee">
      <td style="padding:4px 0">
        <div style="display:flex;gap:4px">
          <span style="font-weight:900;font-size:12px">x${l.qty}</span>
          <span style="font-weight:700;text-transform:uppercase;font-size:10px">${l.label}</span>
        </div>
      </td>
      <td style="text-align:right;font-weight:700;padding:4px 0;font-size:10px">
        ${l.unitPriceAtOrder ? `₹${l.unitPriceAtOrder * l.qty}` : '—'}
      </td>
    </tr>`
  ).join('');

  return `
    <div style="page-break-after:always;font-family:'Courier New',monospace;font-size:10px;width:72mm;margin:0 auto;padding:4mm 2mm;color:#000;line-height:1.2">
      <div style="text-align:center;margin-bottom:4px">
        <div style="font-size:16px;font-weight:900;letter-spacing:-0.5px">THE FIT BOWL</div>
        <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:3px;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:4px">Precision Nutrition</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;background:#000;color:#fff;padding:4px 8px;margin-bottom:4px">
        <span style="font-weight:900;font-size:13px">#${order.orderNumber || order.id.slice(0,6).toUpperCase()}</span>
        <span style="font-weight:900;font-size:9px;text-transform:uppercase">${order.payment || 'COD'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:8px;font-weight:700;border-bottom:1px solid #eee;padding-bottom:3px;margin-bottom:4px">
        <span style="text-transform:uppercase">${order.kind} | ${order.deliveryAtLabel}</span>
        <span>${fmtDate(order.createdAt)} ${fmtTime(order.createdAt)}</span>
      </div>
      <div style="margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #000">
        <div style="font-weight:900;font-size:13px;text-transform:uppercase">${order.customer?.receiverName || ''}</div>
        <div style="font-weight:900;border:1px solid #000;display:inline-block;padding:2px 6px;margin:4px 0;font-size:11px">PH: ${order.customer?.receiverPhone || ''}</div>
        <div style="margin-top:4px;font-weight:700;font-size:9px">
          <span style="background:#000;color:#fff;padding:1px 4px;margin-right:4px;font-size:7px;text-transform:uppercase">${order.customer?.locationType || 'Home'}</span>
          ${order.customer?.building || ''}, ${order.customer?.area || ''}
        </div>
        ${order.customer?.instructions ? `<div style="margin-top:4px;padding:4px 6px;border-left:3px solid #000;background:#f8f8f8;font-weight:900;font-style:italic;font-size:9px">NOTE: ${order.customer.instructions}</div>` : ''}
      </div>
      <div style="margin-bottom:8px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid #000;font-size:7px;font-weight:900;text-transform:uppercase">
              <th style="text-align:left;padding-bottom:2px">Qty | Item</th>
              <th style="text-align:right;padding-bottom:2px">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>
      ${order.priceSummary ? `
        <div style="border-top:1px solid #000;padding-top:4px;margin-top:4px">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:8px;margin-bottom:2px">
            <span>SUBTOTAL</span>
            <span>₹${order.priceSummary.subtotal || order.priceSummary.discountedSubtotal}</span>
          </div>
          ${order.priceSummary.gst > 0 ? `
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:8px;margin-bottom:2px">
            <span>GST (5%)</span>
            <span>₹${order.priceSummary.gst}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:8px;margin-bottom:2px">
            <span>DELIVERY FEE</span>
            <span>${order.priceSummary.deliveryFee > 0 ? `₹${order.priceSummary.deliveryFee}` : 'FREE'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:#000;color:#fff;padding:4px 8px;margin-top:4px;font-weight:900">
            <span style="font-size:9px;text-transform:uppercase">Amount ${isPaid ? 'Paid' : 'To Pay'}</span>
            <span style="font-size:14px">₹${order.priceSummary.total}</span>
          </div>
        </div>
      ` : ''}
      <div style="text-align:center;border-top:1px dashed #ccc;padding-top:8px;margin-top:8px">
        <div style="font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Eat Clean \u2022 Feel Great</div>
        <div style="font-size:7px;margin-top:2px;font-weight:700">Support: +91 85009 29080</div>
        <div style="font-size:6px;margin-top:4px;opacity:0.5;text-transform:uppercase;font-weight:700">Precision delivery by THE FIT BOWL</div>
      </div>
    </div>`;
}

/** Builds the full page HTML for multiple labels */
export function buildLabelsPageHtml(orders: OrderReceipt[], title: string): string {
  const labelsHtml = orders.map(o => buildSingleLabelHtml(o)).join('');
  return `<!DOCTYPE html>
    <html><head><title>${title}</title>
    <style>
      @page { margin: 0; size: 80mm auto; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #fff; }
    </style></head>
    <body>${labelsHtml}</body></html>`;
}

/** Generates an auto-suggested filename for PDF saving */
export function generatePdfTitle(orders: OrderReceipt[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit' }).replace(/\s/g, '');

  if (orders.length === 1) {
    const o = orders[0];
    const num = o.orderNumber || o.id.slice(0, 6).toUpperCase();
    const name = (o.customer?.receiverName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 15);
    return `TFB-${num}_${name}`;
  }
  return `TFB_Ready_Bills_${dateStr}_${orders.length}orders`;
}

/** Full-screen preview modal with iframe */
export function BillPreviewModal({
  orders,
  onPrint,
  onClose,
}: {
  orders: OrderReceipt[];
  onPrint: () => void;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  const pdfTitle = generatePdfTitle(orders);
  const pageHtml = buildLabelsPageHtml(orders, pdfTitle);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(pageHtml);
        doc.close();
        setLoaded(true);
      }
    }
  }, [pageHtml]);

  const handlePrint = () => {
    onPrint();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '420px', maxWidth: '95vw', height: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-700">Bill Preview</h3>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {orders.length} {orders.length === 1 ? 'bill' : 'bills'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AUTO-SUGGEST FILENAME */}
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-100">
          <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-0.5">PDF Save Name</div>
          <div className="font-mono text-xs font-bold text-amber-800 truncate">{pdfTitle}.pdf</div>
        </div>

        {/* IFRAME PREVIEW */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          <div className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden" style={{ width: '80mm', minHeight: '200px' }}>
            <iframe
              ref={iframeRef}
              title="Bill Preview"
              className="w-full border-0"
              style={{ minHeight: '400px', height: loaded ? 'auto' : '400px' }}
            />
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-lg bg-black text-white font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

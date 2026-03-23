import type { OrderReceipt } from "../../types";
import { formatDateIndia, formatTimeIndia } from "../../lib/format";

export function OrderLabel({ order }: { order: OrderReceipt }) {
  if (!order) return null;

  const isPaid = order.payment?.toLowerCase().includes('paid');

  return (
    <div className="print:w-[80mm] print:m-0 print:p-0 text-black bg-white font-mono text-[10px] w-full leading-[1.2] px-1 py-1">
      
      {/* BRANDING: CLEAN & TASTEFUL */}
      <div className="text-center mb-1">
        <div className="text-[16px] font-black tracking-tight leading-none">THE FIT BOWLS</div>
        <div className="text-[7px] font-bold uppercase tracking-[3px] border-b border-black pb-1 mb-1">Precision Nutrition</div>
      </div>

      {/* PRIMARY STATUS BAR */}
      <div className="flex justify-between items-center bg-black text-white px-2 py-1 mb-1">
        <span className="font-black text-[13px]">#{order.orderNumber || order.id.slice(0,6).toUpperCase()}</span>
        <span className="font-black text-[9px] uppercase">{order.payment || "COD"}</span>
      </div>

      {/* ORDER METADATA */}
      <div className="flex justify-between items-center mb-1 text-[8px] font-bold border-b border-black/10 pb-0.5">
        <span className="uppercase">{order.kind} | {order.deliveryAtLabel}</span>
        <span>{formatDateIndia(order.createdAt)} {formatTimeIndia(order.createdAt)}</span>
      </div>

      {/* CUSTOMER & ADDRESS SECTION */}
      <div className="mb-2 pb-1 border-b border-black">
        <div className="font-black text-[13px] uppercase leading-tight mb-0.5">{order.customer?.receiverName}</div>
        <div className="font-black border border-black inline-block px-1.5 py-0.5 mb-1 text-xs">PH: {order.customer?.receiverPhone}</div>
        
        <div className="mt-1 font-bold leading-tight text-[9px]">
          <span className="bg-black text-white px-1 mr-1 uppercase text-[7px]">{order.customer?.receiverName === order.customer?.addressLabel ? "Home" : order.customer?.locationType || "Home"}</span>
          {order.customer?.building}, {order.customer?.area}
        </div>
        
        {order.customer?.instructions && (
          <div className="mt-1.5 p-1 border-l-2 border-black bg-slate-50 font-black italic text-[9px]">
            NOTE: {order.customer.instructions}
          </div>
        )}
      </div>

      {/* ITEMIZED KITCHEN LIST */}
      <div className="mb-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black/20 text-[7px] uppercase font-black">
              <th className="text-left py-1">Qty | Item</th>
              <th className="text-right py-1">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-black/10">
            {order.lines?.map((line, idx) => (
              <tr key={idx} className="align-top">
                <td className="py-1">
                  <div className="flex gap-1">
                    <span className="font-black text-[12px] shrink-0">x{line.qty}</span>
                    <span className="font-bold uppercase leading-tight">{line.label}</span>
                  </div>
                </td>
                <td className="text-right py-1 font-bold">
                  {line.unitPriceAtOrder ? `₹${line.unitPriceAtOrder * line.qty}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PRICE SUMMARY */}
      {order.priceSummary && (
        <div className="border-t border-black pt-1 mt-1 space-y-0.5 px-1">
          <div className="flex justify-between text-[8px] font-bold">
            <span>SUBTOTAL</span>
            <span>₹{order.priceSummary.subtotal || order.priceSummary.discountedSubtotal}</span>
          </div>
          {order.priceSummary.gst > 0 && (
            <div className="flex justify-between text-[8px] font-bold">
              <span>GST (5%)</span>
              <span>₹{order.priceSummary.gst}</span>
            </div>
          )}
          <div className="flex justify-between text-[8px] font-bold">
            <span>DELIVERY FEE</span>
            <span>{order.priceSummary.deliveryFee > 0 ? `₹${order.priceSummary.deliveryFee}` : 'FREE'}</span>
          </div>
          <div className="flex justify-between items-center bg-black text-white px-1.5 py-1 mt-1 font-black">
            <span className="text-[9px] uppercase">Amount {isPaid ? 'Paid' : 'To Pay'}</span>
            <span className="text-[14px]">₹{order.priceSummary.total}</span>
          </div>
        </div>
      )}

      {/* FOOTER: THANK YOU */}
      <div className="text-center pt-2 border-t border-dashed border-black/20 mt-2">
        <div className="text-[9px] font-black tracking-widest uppercase mb-0.5">Eat Clean • Feel Great</div>
        <div className="text-[7px] opacity-70">Support: +91 85009 29080</div>
        <div className="text-[6px] mt-1 opacity-50 uppercase font-bold tracking-tighter">Precision delivery by THE FIT BOWLS</div>
      </div>
      
    </div>
  );
}


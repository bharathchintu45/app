import type { OrderReceipt } from "../../types";
import { formatDateTimeIndia } from "../../lib/format";

export function OrderLabel({ order }: { order: OrderReceipt }) {
  if (!order) return null;

  // Calculate total item count
  const totalItems = order.lines?.reduce((sum, line) => sum + line.qty, 0) || 0;

  return (
    <div className="print:w-[80mm] print:m-0 print:p-0 text-black bg-white font-mono text-[10px] w-full leading-[1.2] px-1 py-2">
      
      {/* BRANDING: CLEAN & TASTEFUL */}
      <div className="text-center mb-2">
        <div className="text-sm font-black tracking-tighter">THE FIT BOWL</div>
        <div className="text-[7px] uppercase tracking-widest leading-none border-b border-black pb-1">Precision Nutrition</div>
      </div>

      {/* PRIMARY STATUS BAR */}
      <div className="flex justify-between items-center bg-black text-white px-2 py-0.5 mb-1">
        <span className="font-black text-xs">#{order.orderNumber || order.id.slice(0,6).toUpperCase()}</span>
        <span className="font-black text-[8px] uppercase">{order.payment || "COD"}</span>
      </div>

      {/* ORDER METADATA */}
      <div className="flex justify-between items-center mb-1 text-[8px] font-bold border-b border-black/20 pb-0.5">
        <span className="uppercase">{order.kind} Order</span>
        <span>{formatDateTimeIndia(order.createdAt)}</span>
      </div>

      {/* CUSTOMER & ADDRESS SECTION */}
      <div className="mb-2 pb-1 border-b border-black">
        <div className="font-black text-sm uppercase leading-tight mb-0.5">{order.customer?.receiverName}</div>
        <div className="font-black border border-black inline-block px-1 mb-1">PH: {order.customer?.receiverPhone}</div>
        
        <div className="mt-1 font-bold leading-tight">
          <span className="bg-black text-white px-1 mr-1 uppercase text-[7px]">{order.customer?.locationType || "Home"}</span>
          {order.customer?.building}, {order.customer?.area}
        </div>
        
        {order.customer?.instructions && (
          <div className="mt-1.5 p-1 border-l-2 border-black bg-slate-50 font-black italic">
            NOTE: {order.customer.instructions}
          </div>
        )}
      </div>

      {/* ITEMIZED KITCHEN LIST */}
      <div className="mb-2">
        <div className="flex justify-between font-black border-b border-black/10 text-[7px] uppercase mb-1">
          <span>Qty | Item Description</span>
        </div>
        <div className="space-y-1">
          {order.lines?.map((line, idx) => (
            <div key={idx} className="flex items-start gap-1 pb-0.5 border-b border-dashed border-black/5">
              <span className="font-black text-xs shrink-0 w-6">x{line.qty}</span>
              <span className="font-bold uppercase flex-1 leading-tight">{line.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-black border-t border-black pt-0.5 text-[8px]">
          <span>TOTAL QUANTITY</span>
          <span>{totalItems}</span>
        </div>
      </div>

      {/* FOOTER: THANK YOU */}
      <div className="text-center pt-2 border-t border-dashed border-black/20 mt-2">
        <div className="text-[7px] font-bold tracking-widest uppercase">Eat Clean • Feel Great</div>
        <div className="text-[6px] mt-0.5 opacity-50">Precision delivery by The Fit Bowl</div>
      </div>
      
    </div>
  );
}


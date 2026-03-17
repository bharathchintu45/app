import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { SectionTitle } from "../ui/Typography";
import { MessageCircle } from "lucide-react";
import { formatTimeIndia } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { AppUser, ThreadMsg } from "../../types";

interface DashboardChatProps {
  user: AppUser | null;
  thread: ThreadMsg[];
  sendMessage: (text: string) => Promise<void>;
  dashboardTab: "personal" | "group";
  clearUnread?: () => void;
}

export function DashboardChat({
  user,
  thread,
  sendMessage,
  dashboardTab,
  clearUnread,
}: DashboardChatProps) {
  const [note, setNote] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dashboardTab === "personal") {
      clearUnread?.();
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, [thread.length, dashboardTab, clearUnread]);

  async function sendNote() {
    const t = note.trim();
    if (!t || sendingMessage) return;
    setSendingMessage(true);
    try {
      await sendMessage(t);
      setNote("");

      // --- SIMULATED AI ASSISTANT RESPONSE ---
      const lower = t.toLowerCase();
      const isQuestion = lower.includes("?") || lower.includes("how many") || lower.includes("what is");
      const isDietary = lower.includes("calorie") || lower.includes("macro") || lower.includes("protein") || lower.includes("allergy") || lower.includes("vegan");

      if (isQuestion || isDietary) {
        setTimeout(() => {
          let aiResponse = "I've noted that! Our kitchen will make sure your meals align with your preference.";
          if (lower.includes("calorie") || lower.includes("macro") || lower.includes("protein")) {
             aiResponse = "Nutritional info query detected: Your daily plan is algorithmically balanced. If you're on the Pro plan, you can check the exact macro breakdown in the Pro Account tab!";
          } else if (lower.includes("allergy") || lower.includes("peanut") || lower.includes("dairy") || lower.includes("gluten") || lower.includes("vegan")) {
             aiResponse = "Dietary requirement noted! 🛡️ We take cross-contamination seriously and will prep your meals in a dedicated station.";
          }
          
          // Hacky simulate receiving a message back (Ideally this would be a DB insert & realtime subscription trigger)
          sendMessage(`[AI Assistant]: ${aiResponse}`);
        }, 1500); // 1.5s delay to feel "real"
      }
      // ---------------------------------------

    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <SectionTitle 
          icon={MessageCircle} 
          title="Chef's Inbox" 
          subtitle="Feedback perfectly translated to the kitchen." 
        />
      </CardHeader>
      <CardContent className="space-y-5">
        <div ref={scrollContainerRef} className="bg-slate-50 rounded-2xl border border-slate-100 p-4 h-[250px] overflow-y-auto space-y-3">
          {thread.length ? thread.map((m) => (
            <div key={m.id} className={cn("max-w-[85%] rounded-2xl p-3 text-sm", m.by === (user?.name||"You") ? "bg-slate-900 text-white ml-auto rounded-tr-sm shadow-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm")}>
              <div className="font-bold text-[10px] uppercase tracking-wider opacity-60 mb-1">{m.by} • {formatTimeIndia(m.at)}</div>
              {m.text}
            </div>
          )) : <div className="text-sm text-slate-400 italic text-center mt-10">Start a conversation to customize your meals.</div>}
        </div>
        <div className="flex items-end gap-2">
          <Textarea 
            value={note} 
            onChange={(e) => setNote(e.target.value)} 
            disabled={sendingMessage} 
            placeholder="Ask for extra spicy, less salt, hold the onions..." 
            className="resize-none min-h-[60px]" 
            onKeyDown={(e) => {
               if(e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 sendNote();
               }
            }}
          />
          <Button onClick={sendNote} disabled={sendingMessage || !note.trim()} className="h-full mb-0 rounded-xl px-5">{sendingMessage ? 'Sending...' : 'Send'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

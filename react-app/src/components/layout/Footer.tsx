import { ChefHat, Mail, Phone, MapPin } from "lucide-react";
import { useAppSettingString } from "../../hooks/useAppSettings";

export function Footer() {
  const { value: storeAddress } = useAppSettingString("store_address", "123 Health Avenue\nFitness District 500001");
  const { value: supportPhone } = useAppSettingString("support_phone", "+91 8008880000");
  const { value: bypassEmails } = useAppSettingString("maintenance_bypass_emails", "info@thefitbowl.in");
  
  const mainEmail = bypassEmails.split(',')[0].trim();

  return (
    <footer className="mt-16 pt-16 pb-8 border-t border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center transform -rotate-6">
              <ChefHat className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 uppercase">
              The <span className="text-emerald-500">Fit Bowls</span>
            </span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Delivering chef-crafted, nutritionally balanced meals straight to your door. Eat healthy, live better.
          </p>
        </div>

        <div>
          <h4 className="text-slate-900 font-bold mb-6">Quick Links</h4>
          <ul className="space-y-4 text-sm text-slate-500">
            <li><a href="#home" className="hover:text-emerald-600 transition-colors">Home</a></li>
            <li><a href="#about" className="hover:text-emerald-600 transition-colors">About Us</a></li>
            <li><a href="#contact" className="hover:text-emerald-600 transition-colors">Contact Us</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-slate-900 font-bold mb-6">Legal</h4>
          <ul className="space-y-4 text-sm text-slate-500">
            <li><a href="#terms" className="hover:text-emerald-600 transition-colors">Terms & Conditions</a></li>
            <li><a href="#privacy" className="hover:text-emerald-600 transition-colors">Privacy Policy</a></li>
            <li><a href="#refunds" className="hover:text-emerald-600 transition-colors">Refund & Cancellation</a></li>
            <li><a href="#shipping" className="hover:text-emerald-600 transition-colors">Shipping & Delivery</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-slate-900 font-bold mb-6">Contact</h4>
          <ul className="space-y-4 text-sm text-slate-500">
            <li className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="whitespace-pre-line">{storeAddress}</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{supportPhone}</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{mainEmail}</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400">
        <p>© {new Date().getFullYear()} THE FIT BOWLS. All rights reserved.</p>
        <p className="mt-2 md:mt-0">FSSAI License: [Pending]</p>
      </div>
    </footer>
  );
}

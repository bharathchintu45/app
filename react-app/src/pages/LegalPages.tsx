import { ArrowLeft, ChefHat, Mail, MapPin, Phone } from "lucide-react";
import { useAppSettingString } from "../hooks/useAppSettings";

function LegalLayout({ title, lastUpdated, onBack, children }: any) {
  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <button onClick={onBack} className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </button>
        
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">{title}</h1>
          {lastUpdated && <p className="text-sm text-slate-500 mb-10 pb-10 border-b border-slate-100 italic">Last updated: {lastUpdated}</p>}
          
          <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyPage({ onBack }: { onBack: () => void }) {
  const { value: bypassEmails } = useAppSettingString("maintenance_bypass_emails", "info@thefitbowl.in");
  const mainEmail = bypassEmails.split(',')[0].trim();

  return (
    <LegalLayout title="Privacy Policy" lastUpdated="March 20, 2026" onBack={onBack}>
      <h2>1. Information We Collect</h2>
      <p>We collect information you provide directly to us when setting up an account, placing an order, filling out health preferences, or communicating with us. This may include your name, email address, phone number, delivery address, dietary goals, and payment information.</p>
      
      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul className="list-disc pl-5 space-y-2 mt-2">
        <li>Process and fulfill your meal orders and subscriptions.</li>
        <li>Personalize your meal plans based on your health preferences.</li>
        <li>Communicate with you regarding your orders, delivery status, and our services.</li>
        <li>Improve our platform, kitchens, and delivery network.</li>
      </ul>

      <h2 className="mt-8">3. Information Sharing</h2>
      <p>We never sell your personal data. We only share information with third-party service providers (like payment processors and delivery partners) necessary to fulfill our services to you.</p>

      <h2 className="mt-8">4. Data Security</h2>
      <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>

      <h2 className="mt-8">5. Contact Us</h2>
      <p>If you have questions about this Privacy Policy, please contact us at <strong>{mainEmail}</strong>.</p>
    </LegalLayout>
  );
}

export function TermsPage({ onBack }: { onBack: () => void }) {
  return (
    <LegalLayout title="Terms & Conditions" lastUpdated="March 20, 2026" onBack={onBack}>
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using THE FIT BOWLS platform, you agree to be bound by these Terms & Conditions. If you disagree with any part of these terms, you may not access our service.</p>
      
      <h2 className="mt-8">2. Service Description</h2>
      <p>THE FIT BOWLS provides healthy meal preparation and delivery services. We offer regular one-time orders, personalized subscription plans, and group orders.</p>

      <h2 className="mt-8">3. Account Responsibilities</h2>
      <p>You are responsible for maintaining the confidentiality of your account credentials (like your OTP access) and for all activities that occur under your account. You must provide accurate and complete information when creating an account.</p>

      <h2 className="mt-8">4. Orders and Payments</h2>
      <p>All orders are subject to availability and confirmation of the order price. Payment must be made securely through our authorized payment gateways (e.g., Razorpay) prior to delivery. We reserve the right to refuse any order.</p>

      <h2 className="mt-8">5. Health Disclaimer</h2>
      <p>While our meals are designed to be healthy and nutritious, our dietary categorizations are not medical advice. Please consult with a healthcare professional regarding any specific dietary needs or severe allergies before placing an order.</p>

      <h2 className="mt-8">6. Governing Law</h2>
      <p>These terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p>
    </LegalLayout>
  );
}

export function RefundsPage({ onBack }: { onBack: () => void }) {
  return (
    <LegalLayout title="Refund & Cancellation Policy" lastUpdated="March 20, 2026" onBack={onBack}>
      <h2>1. Order Cancellations</h2>
      <p>For single/regular orders, cancellations must be requested at least 12 hours before the scheduled delivery slot. Cancellations made within 12 hours of the delivery window will not be eligible for a refund as food preparation will have already commenced.</p>

      <h2 className="mt-8">2. Subscription Modifications & Pauses</h2>
      <p>Active subscriptions can be paused or modified. You must pause your subscription before the daily order cutoff time (typically 10:00 PM the night before) to skip the next day's delivery without charge. Days explicitly skipped or paused will not be billed.</p>

      <h2 className="mt-8">3. Refunds</h2>
      <p>Refunds are applicable under the following conditions:</p>
      <ul className="list-disc pl-5 space-y-2 mt-2">
        <li>If an order was prepaid but we failed to deliver it.</li>
        <li>If the food delivered was spoiled, contaminated, or incorrect (subject to verification within 2 hours of delivery).</li>
        <li>If a valid cancellation was made before the cutoff period.</li>
      </ul>
      <p className="mt-4">Approved refunds will be processed back to the original payment method within 5-7 business days.</p>

      <h2 className="mt-8">4. Non-Refundable Scenarios</h2>
      <p>Refunds will not be issued if delivery failed because the customer was unreachable at the specified delivery location, or if the cancellation request was made after the kitchen had begun prep.</p>
    </LegalLayout>
  );
}

export function ShippingPage({ onBack }: { onBack: () => void }) {
  return (
    <LegalLayout title="Shipping & Delivery Policy" lastUpdated="March 20, 2026" onBack={onBack}>
      <h2>1. Delivery Areas</h2>
      <p>We currently deliver across select areas. If your address is outside our serviceable zones, our dynamic checkout routing will alert you during the checkout phase.</p>

      <h2 className="mt-8">2. Delivery Timing</h2>
      <p>We offer defined dietary slots (e.g., Breakfast, Lunch, Dinner). While our delivery personnel strive to meet your time preferences, deliveries may vary slightly due to traffic, weather, or other unforeseen logistical challenges.</p>

      <h2 className="mt-8">3. Delivery Charges</h2>
      <p>Standard delivery charges may apply based on your location and the type of order. The exact delivery fee is calculated and displayed clearly at checkout before payment. We occasionally offer Free Delivery promotions based on cart value or location.</p>

      <h2 className="mt-8">4. Receipt of Order</h2>
      <p>Our delivery partners require a smooth handover. Depending on the order value or location specifics, an OTP (One-Time Password) provided in your app may be required to safely complete the delivery handover.</p>
    </LegalLayout>
  );
}

export function AboutPage({ onBack }: { onBack: () => void }) {
  return (
    <LegalLayout title="About Us" onBack={onBack}>
      <div className="flex justify-center mb-8">
        <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center transform -rotate-6">
          <ChefHat className="w-12 h-12 text-emerald-600" />
        </div>
      </div>
      <p className="text-xl text-center font-medium text-slate-800 mb-8">
        Welcome to <strong>THE FIT BOWLS</strong> — the premier health-conscious cloud kitchen.
      </p>
      <div className="space-y-6 text-slate-600">
        <p>
          Founded with the belief that eating healthy shouldn't mean compromising on taste or convenience, we deliver chef-crafted, nutritionally balanced meals straight to your door.
        </p>
        <p>
          Whether you're an athlete tracking every macro, or a busy professional just trying to eat cleaner, our kitchens use farm-fresh ingredients to prepare meals that fit your specific lifestyle. 
        </p>
        <p>
          We take the hassle out of meal prepping by managing your personalized subscriptions and making it simple to pause, modify, or scale your nutritional path to fit your daily needs.
        </p>
      </div>
    </LegalLayout>
  );
}

export function ContactPage({ onBack }: { onBack: () => void }) {
  const { value: storeAddress } = useAppSettingString("store_address", "123 Health Avenue\nFitness District 500001");
  const { value: supportPhone } = useAppSettingString("support_phone", "+91 8008880000");
  const { value: bypassEmails } = useAppSettingString("maintenance_bypass_emails", "info@thefitbowl.in");
  const mainEmail = bypassEmails.split(',')[0].trim();

  return (
    <LegalLayout title="Contact Us" onBack={onBack}>
      <p className="mb-8 text-lg">We're here to help! Whether you have questions about our meal plans, need help with an order, or just want to say hi, reach out to us using the details below.</p>
      
      <div className="grid gap-6 sm:grid-cols-2 mt-8">
        <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-start gap-4">
          <div className="bg-emerald-100 p-3 rounded-xl shrink-0">
            <MapPin className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 mb-2">Operating Address</h3>
            <p className="text-sm text-slate-600 whitespace-pre-line">{storeAddress}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-start gap-4">
          <div className="bg-emerald-100 p-3 rounded-xl shrink-0">
            <Phone className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 mb-2">Phone Number</h3>
            <p className="text-sm text-slate-600">{supportPhone}</p>
            <p className="text-xs text-slate-400 mt-1">Available 8 AM - 8 PM</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-start gap-4 sm:col-span-2">
          <div className="bg-emerald-100 p-3 rounded-xl shrink-0">
            <Mail className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 mb-2">Email Address</h3>
            <p className="text-sm text-slate-600">{mainEmail}</p>
            <p className="text-xs text-slate-400 mt-1">We aim to respond to all inquiries within 24 hours.</p>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
}

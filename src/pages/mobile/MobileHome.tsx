import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Shield, Lock, Landmark, Zap, BadgeIndianRupee, Building2,
} from 'lucide-react';

export default function MobileHome() {
  const navigate = useNavigate();

  const features = [
    { icon: Shield, title: 'RBI Compliant', desc: 'KYC compliance as per RBI guidelines' },
    { icon: CreditCard, title: 'All Cards', desc: 'Visa, Mastercard & RuPay' },
    { icon: Landmark, title: 'Any Bank', desc: 'Pay any Indian bank account' },
    { icon: Lock, title: 'Secure', desc: 'Bank-grade encryption' },
  ];

  const highlights = [
    { icon: BadgeIndianRupee, label: 'Lowest Fees' },
    { icon: Shield, label: 'No Hidden MMC Charges' },
    { icon: Zap, label: 'Fast Settlement' },
    { icon: Building2, label: 'RBI Compliant' },
    { icon: Landmark, label: 'Registered Company' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      {/* Hero */}
      <section className="relative px-4 pt-8 pb-12 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-48 h-48 bg-[#8c76f0] rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
        <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>

        <div className="relative text-center space-y-5">
          <img src="/PayByCard-Logo.png" alt="PayByCard" className="w-32 h-16 mx-auto object-contain" />
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">
            Pay Bills with Your{' '}
            <span className="bg-gradient-to-r from-[#8c76f0] to-purple-600 bg-clip-text text-transparent">
              Credit Card
            </span>
          </h1>
          <p className="text-base text-gray-600 max-w-sm mx-auto">
            Credit Card to Bank Payment
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => navigate('/mobile/register')}
              className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-purple-500/30 active:scale-95 transition-transform"
            >
              Register
            </button>
            <button
              onClick={() => navigate('/mobile/login')}
              className="w-full border-2 border-[#8c76f0] text-[#8c76f0] font-semibold py-3.5 rounded-xl active:scale-95 transition-transform"
            >
              Login
            </button>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="px-4 py-2">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
          <div className="flex flex-wrap gap-2">
            {highlights.map((h) => (
              <div
                key={h.label}
                className="flex items-center gap-1.5 bg-[#f3f0fe] rounded-lg px-2.5 py-1.5"
              >
                <h.icon className="w-3.5 h-3.5 text-[#8c76f0] flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-6">
        <div className="grid grid-cols-2 gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm"
            >
              <div className="w-10 h-10 bg-[#f3f0fe] rounded-xl flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-[#8c76f0]" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

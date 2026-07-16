import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Shield, Lock, CheckCircle,
  Landmark, ArrowRight, Loader2,
  Zap, GraduationCap, Bus, Users, Heart, ShoppingBag, Wrench, Plane, Music,
  Stethoscope, Baby, Dog, Leaf, Truck, Gamepad2, Camera, Coffee, BookOpen,
  MonitorSmartphone, Wifi, Flame, Droplets, Building, Car, Scissors,
  Globe, Star, DollarSign, Receipt, Briefcase, Home as HomeIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  'business': Briefcase, 'vendor': Briefcase, 'professional': Briefcase, 'service': Wrench,
  'housing': HomeIcon, 'rent': HomeIcon, 'maintenance': Wrench, 'utilities': Zap,
  'tax': Receipt, 'administrative': Building, 'education': GraduationCap, 'academic': GraduationCap,
  'school': GraduationCap, 'college': GraduationCap, 'university': GraduationCap,
  'transportation': Bus, 'travel': Plane, 'student': Bus, 'membership': Users,
  'club': Users, 'subscription': Star, 'health': Stethoscope, 'medical': Stethoscope,
  'insurance': Shield, 'grocery': ShoppingBag, 'shopping': ShoppingBag,
  'entertainment': Music, 'gaming': Gamepad2, 'food': Coffee, 'restaurant': Coffee,
  'telecom': Wifi, 'internet': Wifi, 'mobile': MonitorSmartphone,
  'electricity': Flame, 'water': Droplets, 'gas': Flame,
  'vehicle': Car, 'automobile': Car, 'salon': Scissors, 'beauty': Scissors,
  'logistics': Truck, 'courier': Truck, 'charity': Heart, 'donation': Heart,
  'child': Baby, 'pet': Dog, 'environment': Leaf, 'photography': Camera,
  'books': BookOpen, 'import': Globe, 'export': Globe, 'foreign': Globe,
};

const CATEGORY_COLORS = [
  'from-blue-500 to-cyan-500', 'from-green-500 to-teal-500',
  'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500',
  'from-sky-500 to-blue-500', 'from-violet-500 to-purple-500',
  'from-emerald-500 to-green-500', 'from-red-500 to-rose-500',
  'from-indigo-500 to-blue-500', 'from-yellow-500 to-amber-500',
];

function getCategoryIcon(name: string): React.ElementType {
  const lower = name.toLowerCase();
  for (const [keyword, Icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (lower.includes(keyword)) return Icon;
  }
  return DollarSign;
}

export default function MobileHome() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<{ id: string; category_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-categories-list`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }
        );
        const data = await res.json();
        if (res.ok && data.categories) setCategories(data.categories);
      } catch { /* silently fail */ } finally { setLoading(false); }
    };
    fetchCategories();
  }, []);

  const features = [
    { icon: Shield, title: 'RBI Compliant', desc: 'KYC compliance as per RBI guidelines' },
    { icon: CreditCard, title: 'All Cards', desc: 'Visa, Mastercard & RuPay' },
    { icon: Landmark, title: 'Any Bank', desc: 'Pay any Indian bank account' },
    { icon: Lock, title: 'Secure', desc: 'Bank-grade encryption' },
  ];

  const benefits = [
    'Earn Reward Points on every payment',
    'Extended Interest-Free Credit Period',
    'Better Cash Flow Management',
    'Easy Expense Tracking',
    'Additional Cashback Offers',
    'Build Credit Score',
  ];

  const cardBrands = [
    { name: 'Visa', color: 'from-blue-600 to-blue-400' },
    { name: 'Mastercard', color: 'from-red-600 to-orange-400' },
    { name: 'RuPay', color: 'from-green-600 to-emerald-400' },
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
            Break payment barriers. Use your credit card to pay bills and expenses—where cards aren't accepted.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => navigate('/mobile/register')}
              className="w-full bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-purple-500/30 active:scale-95 transition-transform"
            >
              Get Started
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

      {/* Card Brands */}
      <section className="px-4 py-6">
        <div className="flex justify-center gap-3">
          {cardBrands.map((brand) => (
            <div
              key={brand.name}
              className={`flex-1 max-w-[100px] bg-gradient-to-r ${brand.color} rounded-xl p-3 text-center shadow-md`}
            >
              <p className="text-white font-bold text-sm">{brand.name}</p>
            </div>
          ))}
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

      {/* Benefits */}
      <section className="px-4 py-6 bg-gradient-to-b from-transparent via-purple-50/50 to-transparent">
        <h2 className="text-xl font-bold text-center text-gray-900 mb-4">
          Credit Card <span className="text-[#8c76f0]">Benefits</span>
        </h2>
        <div className="space-y-2">
          {benefits.map((b) => (
            <div key={b} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-200">
              <CheckCircle className="w-5 h-5 text-[#8c76f0] flex-shrink-0" />
              <p className="text-sm text-gray-900 font-medium">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Categories */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 text-[#8c76f0] animate-spin" />
        </div>
      ) : categories.length > 0 ? (
        <section className="px-4 py-6">
          <h2 className="text-xl font-bold text-center text-gray-900 mb-4">
            Payment <span className="text-[#8c76f0]">Categories</span>
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {categories.map((cat, idx) => {
              const Icon = getCategoryIcon(cat.category_name);
              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-2 aspect-square"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#f3f0fe] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#8c76f0]" />
                  </div>
                  <p className="text-[10px] text-gray-700 font-medium text-center leading-tight">{cat.category_name}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="px-4 py-8 bg-gradient-to-r from-purple-50 to-violet-50 mx-4 rounded-2xl mb-8">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to Transform Your Payments?</h2>
          <p className="text-sm text-gray-600 mb-4">Join thousands who trust PayByCard</p>
          <button
            onClick={() => navigate('/mobile/register')}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white font-bold px-8 py-3 rounded-full shadow-lg active:scale-95 transition-transform"
          >
            Get Started Now
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

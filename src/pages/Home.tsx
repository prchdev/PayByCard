import {
  CreditCard, Shield, Building2, TrendingUp, Lock, FileCheck, Clock, CheckCircle,
  Landmark, ArrowRight, Banknote, RefreshCw, UserCheck, Briefcase, Home as HomeIcon,
  Zap, GraduationCap, Bus, Users, Heart, ShoppingBag, Wrench, Plane, Music,
  Stethoscope, Baby, Dog, Leaf, Truck, Gamepad2, Camera, Coffee, BookOpen,
  MonitorSmartphone, Wifi, Flame, Droplets, Building, Car, Scissors, Package,
  Globe, Star, DollarSign, Receipt, Loader2
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  'business': Briefcase,
  'vendor': Briefcase,
  'professional': Briefcase,
  'service': Wrench,
  'housing': HomeIcon,
  'rent': HomeIcon,
  'maintenance': Wrench,
  'utilities': Zap,
  'tax': Receipt,
  'administrative': Building,
  'education': GraduationCap,
  'academic': GraduationCap,
  'school': GraduationCap,
  'college': GraduationCap,
  'university': GraduationCap,
  'transportation': Bus,
  'travel': Plane,
  'student': Bus,
  'membership': Users,
  'club': Users,
  'subscription': Star,
  'health': Stethoscope,
  'medical': Stethoscope,
  'insurance': Shield,
  'grocery': ShoppingBag,
  'shopping': ShoppingBag,
  'entertainment': Music,
  'gaming': Gamepad2,
  'food': Coffee,
  'restaurant': Coffee,
  'telecom': Wifi,
  'internet': Wifi,
  'mobile': MonitorSmartphone,
  'electricity': Flame,
  'water': Droplets,
  'gas': Flame,
  'vehicle': Car,
  'automobile': Car,
  'salon': Scissors,
  'beauty': Scissors,
  'logistics': Truck,
  'courier': Truck,
  'charity': Heart,
  'donation': Heart,
  'child': Baby,
  'pet': Dog,
  'environment': Leaf,
  'photography': Camera,
  'books': BookOpen,
  'import': Globe,
  'export': Globe,
  'foreign': Globe,
};

const CATEGORY_COLORS = [
  'from-blue-500 to-cyan-500',
  'from-green-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-blue-500',
  'from-violet-500 to-purple-500',
  'from-emerald-500 to-green-500',
  'from-red-500 to-rose-500',
  'from-indigo-500 to-blue-500',
  'from-yellow-500 to-amber-500',
];

function getCategoryIcon(categoryName: string): React.ElementType {
  const lower = categoryName.toLowerCase();
  for (const [keyword, Icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (lower.includes(keyword)) return Icon;
  }
  return DollarSign;
}

function PaymentCategoriesSection() {
  const [categories, setCategories] = useState<{ id: string; category_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-categories`,
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
        if (res.ok && data.categories) {
          setCategories(data.categories);
        }
      } catch {
        // silently fail — section simply won't render
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto flex justify-center">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </section>
    );
  }

  if (!categories.length) return null;

  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-4">
          Payment <span className="text-[#8c76f0]">Categories</span>
        </h2>
        <p className="text-center text-gray-600 text-xl mb-16">Choose from multiple payment types</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => {
            const Icon = getCategoryIcon(category.category_name);
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <div
                key={category.id}
                className="group relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${color} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity`} />
                <div className="relative bg-white rounded-2xl p-6 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 cursor-pointer text-center shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-4 py-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#f3f0fe] flex items-center justify-center shadow-md">
                    <Icon className="w-7 h-7 text-[#8c76f0] flex-shrink-0" />
                  </div>
                  <p className="text-gray-900 font-semibold text-sm leading-snug">{category.category_name}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const VisaLogo = () => (
    <div className="flex items-center justify-center w-32 h-32">
      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Visa_Inc._logo_%282021%E2%80%93present%29.svg/1280px-Visa_Inc._logo_%282021%E2%80%93present%29.svg.png" alt="Visa" className="max-h-full max-w-full object-contain" />
    </div>
  );

  const MastercardLogo = () => (
    <div className="flex items-center justify-center w-32 h-32">
      <svg viewBox="0 0 48 30" fill="none" className="h-16 w-auto">
        <circle cx="18" cy="15" r="11" fill="#EB001B"/>
        <circle cx="30" cy="15" r="11" fill="#F79E1B"/>
        <path d="M24 7.5C26.2 9.2 27.5 11.9 27.5 15C27.5 18.1 26.2 20.8 24 22.5C21.8 20.8 20.5 18.1 20.5 15C20.5 11.9 21.8 9.2 24 7.5Z" fill="#FF5F00"/>
      </svg>
    </div>
  );

  const RuPayLogo = () => (
    <div className="flex items-center justify-center w-32 h-32">
      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/RuPay.svg/330px-RuPay.svg.png" alt="RuPay" className="max-h-full max-w-full object-contain" />
    </div>
  );

  const cardBrands = [
    { name: 'Visa', color: 'from-blue-600 to-blue-400', logo: VisaLogo },
    { name: 'Mastercard', color: 'from-red-600 to-orange-400', logo: MastercardLogo },
    { name: 'RuPay', color: 'from-green-600 to-emerald-400', logo: RuPayLogo },
  ];

  const features = [
    {
      icon: Shield,
      title: 'Compliant with RBI regulations',
      description: 'The platform ensures merchant onboarding and KYC compliance in line with RBI guidelines.',
    },
    {
      icon: CreditCard,
      title: 'All Indian Credit Cards',
      description: 'Works seamlessly with Visa, Mastercard, and RuPay cards',
    },
    {
      icon: Landmark,
      title: 'Pay any Indian Bank Account',
      description: 'Use Bank IFSC & Account Number to pay bill instantly',
    },
    {
      icon: Shield,
      title: 'Maximum Fraud Protection',
      description: 'Bank-grade encryption and multi-layer security to protect every transaction',
    },
    {
      icon: Building2,
      title: 'Registered Company',
      description: 'RBI compliant and fully registered entity ensuring your trust and safety',
    },
  ];

  const creditCardBenefits = [
    'Earn Reward Points on every payment',
    'Extended Interest-Free Credit Period',
    'Better Cash Flow Management',
    'Easy Expense Tracking',
    'Additional Cashback Offers',
    'Build Credit Score',
  ];

  const platformBenefits = [
    {
      icon: CheckCircle,
      title: 'Surpass Non-Acceptance',
      description: "Pay anyone, anywhere - even vendors who don't accept cards",
    },
    {
      icon: Shield,
      title: 'No Cash Handling',
      description: 'Eliminate risks associated with carrying and managing cash',
    },
    {
      icon: TrendingUp,
      title: 'No Collection Limit',
      description: 'Process unlimited payment requests without any restrictions',
    },
    {
      icon: Clock,
      title: 'Instant Settlement',
      description: 'Payments settle instantly to beneficiary accounts',
    },
    {
      icon: FileCheck,
      title: 'GST Compliant Invoice',
      description: 'Automatically generated custom invoices for all transactions',
    },
    {
      icon: Lock,
      title: 'Secure & KYC Verified',
      description: 'Complete KYC compliance with bank-grade security protocols',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white">
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8c76f0] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-700"></div>
          <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-1000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center space-y-8">
            <div className="inline-block animate-bounce">
              <img src="/PayByCard-Logo.png" alt="PayByCard Logo" className="w-48 h-24 mx-auto object-contain" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 leading-tight">
              Pay Your Bills Conveniently with Your{' '}
              <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">
                Credit Card
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Break payment barriers. Use your credit card to pay bills and expenses—where cards aren't accepted.
            </p>

            <div className="flex flex-wrap justify-center gap-4 pt-8">
              {['Instant Processing', 'Zero Hassle', 'Maximum Rewards', 'Complete Security'].map((benefit, index) => (
                <div
                  key={benefit}
                  className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-full px-6 py-3 text-[#8c76f0] font-medium animate-fade-in shadow-sm"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  {benefit}
                </div>
              ))}
            </div>

            <div className="pt-8">
              <h3 className="text-lg text-gray-600 mb-6">Works with All Major Cards</h3>
              <div className="flex flex-wrap justify-center gap-6">
                {cardBrands.map((brand, index) => (
                  <div
                    key={brand.name}
                    className="group relative"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${brand.color} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                    <div className="relative bg-white rounded-2xl p-6 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 cursor-pointer shadow-lg hover:shadow-xl w-48">
                      <div className="flex items-center justify-center mx-auto mb-4">
                        <brand.logo />
                      </div>
                      <p className="text-center text-gray-900 font-bold text-lg">{brand.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group relative bg-white rounded-3xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 shadow-lg hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-violet-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <feature.icon className="w-16 h-16 text-[#8c76f0] mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PaymentCategoriesSection />

      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-purple-50 to-transparent">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-4">
            Credit Card <span className="text-[#8c76f0]">Benefits</span>
          </h2>
          <p className="text-center text-gray-600 text-xl mb-16">Maximize your rewards with every payment</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {creditCardBenefits.map((benefit, index) => (
              <div
                key={benefit}
                className="flex items-center space-x-4 bg-white rounded-2xl p-6 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 shadow-lg hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CheckCircle className="w-8 h-8 text-[#8c76f0] flex-shrink-0" />
                <p className="text-gray-900 font-medium">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-4">
            Why Choose <span className="text-[#8c76f0]">PayByCard</span>
          </h2>
          <p className="text-center text-gray-600 text-xl mb-16">Experience the future of digital payments</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {platformBenefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="group relative bg-white rounded-3xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 shadow-lg hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-violet-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="relative inline-block mb-6">
                    <benefit.icon className="w-14 h-14 text-[#8c76f0]" />
                    <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-20"></div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to Transform Your Payments?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join thousands of users who trust PayByCard for their daily transactions
          </p>
          <a href="/register" className="group relative inline-flex items-center justify-center px-12 py-5 text-lg font-bold text-white transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full blur-md group-hover:blur-lg transition-all opacity-50"></div>
            <span className="relative bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full px-12 py-5 shadow-lg">
              Get Started Now
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}

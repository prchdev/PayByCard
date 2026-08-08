import {
  CreditCard, Shield, Building2, TrendingUp, Lock, FileCheck, Clock, CheckCircle,
  Landmark, ArrowRight, Banknote, RefreshCw, UserCheck, Briefcase, Home as HomeIcon,
  Zap, GraduationCap, Bus, Users
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const PAYMENT_CATEGORIES = [
  { name: 'Business, Vendor & Professional Service Payments', icon: Briefcase, color: 'from-blue-500 to-cyan-500' },
  { name: 'Housing, Rent & Maintenance Payments', icon: HomeIcon, color: 'from-green-500 to-teal-500' },
  { name: 'Utilities, Tax & Administrative Payments', icon: Zap, color: 'from-amber-500 to-orange-500' },
  { name: 'Education & Academic Payments', icon: GraduationCap, color: 'from-rose-500 to-pink-500' },
  { name: 'Transportation & Student Travel Payments', icon: Bus, color: 'from-sky-500 to-blue-500' },
  { name: 'Memberships, Clubs & Subscriptions', icon: Users, color: 'from-violet-500 to-purple-500' },
];

function PaymentCategoriesSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-4">
          Payment <span className="text-[#8c76f0]">Categories</span>
        </h2>
        <p className="text-center text-gray-600 text-xl mb-16">Choose from multiple payment types</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PAYMENT_CATEGORIES.map((category, index) => (
            <div key={category.name} className="group relative" style={{ animationDelay: `${index * 100}ms` }}>
              <div className={`absolute inset-0 bg-gradient-to-r ${category.color} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity`} />
              <div className="relative bg-white rounded-2xl p-6 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 cursor-pointer text-center shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-4 py-8">
                <div className="w-14 h-14 rounded-2xl bg-[#f3f0fe] flex items-center justify-center shadow-md">
                  <category.icon className="w-7 h-7 text-[#8c76f0] flex-shrink-0" />
                </div>
                <p className="text-gray-900 font-semibold text-sm leading-snug">{category.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      icon: UserCheck,
      title: 'User Login & KYC',
      subtitle: 'Login & Verification',
      description: 'The user logs in to PayByCard and completes the required KYC verification.',
    },
    {
      icon: CreditCard,
      title: 'User Initiates Payment',
      subtitle: 'Enter Beneficiary Details',
      description: 'The user enters the beneficiary/merchant details and initiates the payment through PayByCard.',
    },
    {
      icon: Lock,
      title: 'Gateway Processes Card Payment',
      subtitle: 'Secure Card Processing',
      description: 'The payment gateway partner securely processes the user\u2019s credit card payment.',
    },
    {
      icon: FileCheck,
      title: 'PayByCard Verifies Onboarding',
      subtitle: 'Merchant Validation',
      description: 'PayByCard verifies the beneficiary/merchant onboarding and completes the necessary validation before processing the payment.',
    },
    {
      icon: Landmark,
      title: 'Gateway Settles Funds',
      subtitle: 'Nodal Account Settlement',
      description: 'The payment gateway partner settles the successfully processed payment amount into PayByCard\u2019s designated nodal account.',
    },
    {
      icon: Banknote,
      title: 'PayByCard Pays Beneficiary',
      subtitle: 'Bank Transfer',
      description: 'After receiving the settled funds, PayByCard transfers the applicable payment amount to the verified beneficiary/merchant bank account.',
    },
  ];

  const trustBadges = [
    { icon: Shield, title: 'RBI Compliant', description: 'Fully regulated and compliant with RBI guidelines' },
    { icon: Lock, title: '256-bit Encryption', description: 'Bank-grade SSL encryption on every transaction' },
    { icon: UserCheck, title: 'KYC Verified', description: 'All users undergo mandatory KYC verification' },
  ];

  return (
    <section ref={sectionRef} className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-4">
          How <span className="text-[#8c76f0]">PayByCard</span> Works
        </h2>
        <p className="text-center text-gray-600 text-xl mb-16">A secure, transparent 6-step flow — from login to settlement</p>

        {/* Desktop layout */}
        <div className="hidden lg:block">
          <div className="flex items-start justify-between mb-10">
            {steps.map((step, index) => (
              <div key={step.title} className="flex items-start flex-1 min-w-0">
                <div
                  className={`relative flex flex-col items-center flex-1 min-w-0 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${index * 120}ms` }}
                >
                  <div
                    onClick={() => setActiveStep(index)}
                    className={`group relative w-20 h-20 rounded-3xl flex items-center justify-center mb-4 transition-all duration-500 shadow-lg border-2 cursor-pointer ${
                      activeStep === index
                        ? 'bg-gradient-to-br from-purple-50 to-violet-100 border-[#8c76f0] scale-110 shadow-xl'
                        : 'bg-white border-gray-200 hover:border-[#8c76f0] hover:scale-105'
                    }`}
                  >
                    {activeStep === index && (
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-50/60 to-violet-100/60 animate-pulse" />
                    )}
                    <step.icon className={`w-9 h-9 transition-colors duration-300 ${activeStep === index ? 'text-[#8c76f0]' : 'text-gray-400 group-hover:text-[#8c76f0]'}`} />
                    <div className={`absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg transition-all duration-300 ${activeStep === index ? 'bg-[#8c76f0] scale-110' : 'bg-gray-400'}`}>
                      {index + 1}
                    </div>
                    {activeStep === index && (
                      <div className="absolute -inset-1 rounded-3xl border-2 border-[#8c76f0] animate-ping opacity-20" />
                    )}
                  </div>
                  <h3 className={`text-xs font-bold text-center mb-1 transition-colors duration-300 px-1 ${activeStep === index ? 'text-gray-900' : 'text-gray-600'}`}>{step.title}</h3>
                  <p className={`text-[11px] text-center font-medium transition-colors duration-300 px-1 leading-tight ${activeStep === index ? 'text-[#8c76f0]' : 'text-gray-400'}`}>{step.subtitle}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex items-center flex-shrink-0 mt-9 mx-0.5">
                    <div className="h-0.5 w-6 transition-all duration-700 bg-gray-200" />
                    <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 transition-colors duration-500 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Detail panel */}
          <div
            className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: '620ms' }}
          >
            <div className="relative bg-white rounded-3xl p-8 border-2 border-[#8c76f0] shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-violet-50/40 rounded-3xl" />
              <div className="relative flex items-center gap-5">
                <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-purple-50 border-2 border-[#8c76f0]/30 flex items-center justify-center">
                  {(() => { const Icon = steps[activeStep].icon; return <Icon className="w-8 h-8 text-[#8c76f0]" />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold text-gray-900 mb-1">Step {activeStep + 1}: {steps[activeStep].title}</p>
                  <p className="text-gray-600 leading-relaxed text-sm">{steps[activeStep].description}</p>
                </div>
                <div className="ml-auto flex gap-2 flex-shrink-0">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={`rounded-full transition-all duration-300 ${i === activeStep ? 'w-6 h-3 bg-[#8c76f0]' : 'w-3 h-3 bg-gray-300 hover:bg-[#8c76f0]/50'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`transition-all duration-700 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              <div className={`relative bg-white rounded-3xl p-5 border-2 shadow-lg transition-all duration-500 ${
                index === 0 ? 'border-[#8c76f0] shadow-xl' : 'border-gray-200 hover:border-[#8c76f0] hover:shadow-xl'
              }`}>
                {index === 0 && <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-violet-50/50 rounded-3xl pointer-events-none" />}
                <div className="relative flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${index === 0 ? 'bg-purple-50' : 'bg-gray-50'}`}>
                      <step.icon className={`w-6 h-6 transition-colors duration-300 ${index === 0 ? 'text-[#8c76f0]' : 'text-gray-400'}`} />
                    </div>
                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow ${index === 0 ? 'bg-[#8c76f0]' : 'bg-gray-400'}`}>
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-0.5">{step.title}</h3>
                    <p className={`text-xs font-semibold mb-1 ${index === 0 ? 'text-[#8c76f0]' : 'text-gray-400'}`}>{step.subtitle}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex justify-center py-1.5">
                  <ArrowRight className="w-4 h-4 rotate-90 transition-colors duration-300 text-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {trustBadges.map((badge, index) => (
            <div
              key={badge.title}
              className={`group relative bg-white rounded-3xl p-6 border-2 border-gray-200 shadow-lg hover:border-[#8c76f0] hover:shadow-xl transition-all duration-500 flex items-center gap-4 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${900 + index * 120}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-50/0 to-violet-50/0 group-hover:from-purple-50/40 group-hover:to-violet-50/40 rounded-3xl transition-all duration-500" />
              <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gray-50 border-2 border-gray-200 group-hover:border-[#8c76f0] group-hover:bg-purple-50 flex items-center justify-center transition-all duration-300">
                <badge.icon className="w-7 h-7 text-gray-400 group-hover:text-[#8c76f0] transition-colors duration-300" />
              </div>
              <div className="relative">
                <p className="text-lg font-bold text-gray-900">{badge.title}</p>
                <p className="text-sm text-gray-500">{badge.description}</p>
              </div>
            </div>
          ))}
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
      description: "Pay for vendors who don't accept cards",
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

      <HowItWorksSection />

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

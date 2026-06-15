import { Shield, FileCheck, Lock, DollarSign, CheckCircle, Building2 } from 'lucide-react';

export default function About() {
  const securityFeatures = [
    {
      icon: FileCheck,
      title: 'KYC Verification',
      description: 'Strict KYC procedures with Government-authorized APIs for Aadhaar and PAN authentication',
    },
    {
      icon: Shield,
      title: 'Data Protection',
      description: 'Strong IT safeguards to protect user data with bank-grade encryption',
    },
    {
      icon: Lock,
      title: 'No Card Storage',
      description: 'We never store card information and never route funds through our accounts',
    },
  ];

  const commitmentPoints = [
    'Enhanced website access with intuitive interface',
    'Mobile application for on-the-go payments',
    'Direct settlement through authorized partners',
    'Full regulatory and AML compliance',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white">
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8c76f0] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-700"></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            <div className="inline-block">
              <Building2 className="w-20 h-20 text-[#8c76f0] mx-auto animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              About <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">PayByCard</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Empowering retail and small-scale businesses with simple, secure, and fast digital payment solutions
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-gray-300 shadow-xl">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Who We <span className="text-[#8c76f0]">Are</span>
              </h2>
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 leading-relaxed text-lg mb-4">
                  PayByCard.in is operated and managed by <span className="font-semibold text-gray-900">PayByCard Technologies Private Limited</span>, a company registered with the Ministry of Corporate Affairs (CIN: U62099MH2025PTC462923). We are dedicated to empowering retail and small-scale businesses with simple, secure, and fast digital payment solutions.
                </p>
                <p className="text-gray-700 leading-relaxed text-lg">
                  Our upcoming offerings include enhanced access to PayByCard through our website and mobile application enabling seamless invoicing and payment processing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Our <span className="text-[#8c76f0]">Upcoming Offerings</span>
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">Building the future of digital payments</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {commitmentPoints.map((point, index) => (
              <div
                key={point}
                className="flex items-start space-x-4 bg-white rounded-2xl p-6 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 shadow-lg hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CheckCircle className="w-6 h-6 text-[#8c76f0] flex-shrink-0 mt-1" />
                <p className="text-gray-700 font-medium leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-purple-50 to-transparent">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Our Commitment to <span className="text-[#8c76f0]">Security & Compliance</span>
          </h2>
          <p className="text-center text-gray-600 text-lg mb-12">Your safety is our top priority</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className="group relative bg-white rounded-3xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all hover:scale-105 shadow-lg hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 to-violet-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="relative inline-block mb-6">
                    <feature.icon className="w-14 h-14 text-[#8c76f0]" />
                    <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-20"></div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-gray-300 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <Shield className="w-8 h-8 text-[#8c76f0] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Security at the Core</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Security is at the core of our platform. We employ strong information technology safeguards to protect user data and ensure secure payment processing. Importantly, PayByCard does not store any card information and does not route funds through our own accounts. All payments and payouts are directly processed through authorized partners to ensure instant and compliant settlement.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <FileCheck className="w-8 h-8 text-[#8c76f0] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Regulatory Compliance</h3>
                  <p className="text-gray-700 leading-relaxed">
                    To maintain full regulatory compliance, including adherence to Anti-Money Laundering (AML) guidelines, we may request invoice details or supporting documents for transactions carried out through our platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-3xl p-8 md:p-12 border-2 border-[#8c76f0]/30 shadow-xl">
            <div className="flex items-start space-x-6">
              <div className="relative">
                <DollarSign className="w-16 h-16 text-[#8c76f0]" />
                <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-30"></div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Transparent <span className="text-[#8c76f0]">Pricing</span>
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  Any convenience fee applicable to a transaction is calculated based on our payment gateway partner's charges and PayByCard's service fees. These charges are clearly shown on the payment summary page before you proceed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join us in revolutionizing digital payments for businesses across India
          </p>
          <button className="group relative inline-flex items-center justify-center px-12 py-5 text-lg font-bold text-white transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full blur-md group-hover:blur-lg transition-all opacity-50"></div>
            <span className="relative bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full px-12 py-5 shadow-lg">
              Register Now
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

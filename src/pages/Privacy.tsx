import { Shield, Lock, Cookie, Mail, Eye, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white">
      <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden pt-32 pb-16">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8c76f0] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-700"></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            <div className="inline-block">
              <Shield className="w-20 h-20 text-[#8c76f0] mx-auto animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Privacy <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">Policy</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              We are committed to protecting your privacy and personal data in compliance with Indian data protection laws.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-gray-300 shadow-xl mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
              <Eye className="w-8 h-8 text-[#8c76f0] mr-3" />
              Introduction
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                PayByCard Private Limited ("PayByCard", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, store, and protect your personal data when you access or use the website <a href="https://paybycard.in" className="text-[#8c76f0] hover:underline font-semibold">https://paybycard.in</a> and the payment facilitation services provided therein (collectively, the "Platform" or "Services").
              </p>
              <p>
                By using the Platform, you consent to the practices described in this Privacy Policy. If you do not agree, please do not use the Services.
              </p>
              <p className="font-semibold text-gray-900">
                This Policy is governed by the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and other applicable Indian laws.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">1. Information We Collect</h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>We collect the following categories of information:</p>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">A. Information Provided by You</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><span className="font-semibold">Contact details:</span> Name, email address, phone number, and mailing address</li>
                    <li><span className="font-semibold">Payment-related information:</span> Invoice or fee details, transaction amount, and payment references</li>
                    <li><span className="font-semibold">Account information</span> (if you create an account): Login credentials and preferences</li>
                    <li>Any other information you voluntarily submit through forms, support requests, or communications</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">B. Automatically Collected Information</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><span className="font-semibold">Device and usage data:</span> IP address, browser type, operating system, device identifiers, and pages visited</li>
                    <li><span className="font-semibold">Transaction metadata:</span> Date, time, and status of payments</li>
                    <li>Cookies and similar technologies for session management, analytics, and improving user experience</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">C. Payment Card Information</p>
                  <p>
                    We do not store your complete credit/debit card details, CVV, or sensitive authentication data on our servers. All card transactions are processed securely through RBI-authorized payment gateways and banks that are compliant with Payment Card Industry Data Security Standard (PCI-DSS). Card data is tokenized or encrypted during transmission.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">2. Purpose of Collection and Processing</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We collect and process your personal data only for the following legitimate purposes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>To facilitate and process online payments for fees, invoices, or institutional transactions</li>
                  <li>To provide transaction confirmations, digital receipts, and customer support</li>
                  <li>To verify your identity and prevent fraudulent or unauthorized transactions</li>
                  <li>To improve the Platform, analyze usage trends, and enhance security</li>
                  <li>To comply with legal and regulatory obligations, including RBI guidelines, anti-money laundering laws, and tax requirements</li>
                  <li>To communicate important updates, security alerts, or service-related notices</li>
                </ul>
                <p className="font-semibold text-gray-900 mt-4">
                  We do not process your data for any purpose incompatible with the above.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">3. Data Sharing and Disclosure</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We may share your personal data only in the following limited circumstances:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>With RBI-authorized payment gateways, banks, and card networks solely to complete the payment transaction</li>
                  <li>With service providers (data processors) who assist us in operating the Platform (e.g., hosting, analytics, fraud detection), under strict confidentiality and data processing agreements</li>
                  <li>When required by law, court order, or government/regulatory authorities (including RBI, cybercrime cells, or law enforcement)</li>
                  <li>In the event of a merger, acquisition, or restructuring of our business (with appropriate safeguards)</li>
                </ul>
                <p className="font-semibold text-gray-900 mt-4">
                  We do not sell, rent, or trade your personal data to any third party for marketing purposes.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Lock className="w-7 h-7 text-[#8c76f0] mr-3" />
                4. Data Security
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We implement reasonable and appropriate technical and organizational security measures to protect your personal data, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encryption of data in transit (HTTPS/TLS)</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Regular security audits and monitoring</li>
                  <li>Tokenization for payment flows</li>
                </ul>
                <p className="font-semibold text-gray-900 mt-4">
                  While we strive to protect your information, no system is completely secure. In the unlikely event of a data breach that is likely to result in risk to your rights, we will notify you and the relevant authorities as required under the DPDP Act.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">5. Data Retention</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We retain your personal data only as long as necessary to fulfill the purposes for which it was collected or as required by applicable laws (including for audit, legal, or regulatory compliance). Transaction records are typically retained for a minimum of 5–7 years or as mandated by RBI and tax authorities.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Shield className="w-7 h-7 text-[#8c76f0] mr-3" />
                6. Your Rights under the DPDP Act
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  As a Data Principal, you have the following rights regarding your personal data:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Right to access and obtain a summary of your data</li>
                  <li>Right to correction or erasure of inaccurate or unnecessary data</li>
                  <li>Right to nomination (to appoint another person to exercise rights in case of your death or incapacity)</li>
                  <li>Right to withdraw consent (where processing is based on consent)</li>
                  <li>Right to grievance redressal</li>
                </ul>
                <p className="mt-4">
                  To exercise any of these rights, please write to us at <a href="mailto:support@paybycard.in" className="text-[#8c76f0] hover:underline font-semibold">support@paybycard.in</a> with sufficient details for verification. We will respond within the timelines prescribed under applicable law.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Cookie className="w-7 h-7 text-[#8c76f0] mr-3" />
                7. Cookies and Tracking Technologies
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We use essential cookies to enable core functionality (e.g., session management and secure checkout). You may manage cookie preferences through your browser settings. Disabling certain cookies may affect your experience on the Platform.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">8. Third-Party Links</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  The Platform may contain links to third-party websites (including payee institutions). We are not responsible for the privacy practices or content of such external sites. We encourage you to review their privacy policies before providing any information.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">9. Children's Privacy</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  Our Services are not directed at individuals under 18 years of age. We do not knowingly collect personal data from children. If we become aware that we have collected data from a child without verifiable parental consent, we will take steps to delete it.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-7 h-7 text-[#8c76f0] mr-3" />
                10. Changes to This Privacy Policy
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. The updated Policy will be posted on the Platform with a new effective date. Your continued use of the Services after such changes constitutes your acceptance of the revised Policy.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Mail className="w-7 h-7 text-[#8c76f0] mr-3" />
                11. Contact Us / Grievance Officer
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  For any questions, concerns, or to exercise your data rights, please contact us at:
                </p>
                <p className="font-semibold text-[#8c76f0] text-lg">
                  Email: <a href="mailto:support@paybycard.in" className="hover:underline">support@paybycard.in</a>
                </p>
                <p className="mt-4">
                  We will address your grievance within 30 days or as required by law.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <div className="space-y-3 text-gray-700 leading-relaxed text-center">
                <p className="font-semibold text-gray-900 text-lg">
                  By using PayByCard, you acknowledge that you have read, understood, and agreed to this Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Questions About Your Privacy?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            We're committed to protecting your personal information. If you have any concerns, please reach out to us.
          </p>
          <Link to="/contact" className="group relative inline-flex items-center justify-center px-10 py-4 text-base font-bold text-white transition-all duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full blur-md group-hover:blur-lg transition-all opacity-50"></div>
            <span className="relative bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full px-10 py-4 shadow-lg">
              Contact Support
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

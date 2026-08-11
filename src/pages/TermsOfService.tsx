import { FileText, Scale, Shield, AlertTriangle, Gavel, Globe, Mail, Building, CreditCard, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
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
              <FileText className="w-20 h-20 text-[#8c76f0] mx-auto animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Terms of <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">Service</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Please read these terms carefully before using our payment facilitation services.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-gray-300 shadow-xl mb-8">
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Welcome to <span className="font-semibold">PayByCard</span> operated through the website <a href="https://paybycard.in" className="text-[#8c76f0] hover:underline">https://paybycard.in</a> (collectively referred to as the "Platform" or "Services").
              </p>
              <p>
                These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you", or "your") and <span className="font-semibold">PayByCard Technologies Private Limited</span> (CIN: [Insert CIN if available], hereinafter referred to as "PayByCard", "we", "us", or "our"), a company incorporated under the Companies Act, 2013, having its registered office at <span className="font-semibold">3701, IRIS, Runwal Bliss, Crompton Greaves Compound, Kanjurmarg East, Mumbai, Maharashtra 400 042</span>.
              </p>
              <p>
                By accessing, browsing, or using the Platform or Services in any manner, you acknowledge that you have read, understood, and unconditionally agree to be bound by these Terms, along with our Privacy Policy, Refund Policy, and Fraud Reporting & Management Policy (collectively referred to as "Policies"). If you do not agree, you must immediately cease all use of the Platform.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <CreditCard className="w-7 h-7 text-[#8c76f0] mr-3" />
                1. About Our Services
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  PayByCard is a technology platform that facilitates online payments using debit cards, credit cards, UPI, net banking, and other supported payment instruments for various fees, invoices, and institutional payments.
                </p>
                <p>
                  We act solely as a payment facilitator and intermediary. We are not a bank, financial institution, or party to the underlying transaction between the payer (you) and the payee (merchant, school, college, coaching institute, or any other recipient). All funds are processed through RBI-authorized payment gateways and banks.
                </p>
                <p>
                  We do not hold customer funds beyond the time required for settlement, nor do we provide any banking or credit services.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <UserCheck className="w-7 h-7 text-[#8c76f0] mr-3" />
                2. Eligibility
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You must be at least 18 years of age and legally competent to enter into contracts under Indian law.</li>
                  <li>Corporate or institutional users must ensure the authorized representative has the necessary power to bind the entity.</li>
                  <li>By using the Services, you represent and warrant that you meet the above criteria and will comply with all applicable laws, including those prescribed by the Reserve Bank of India (RBI).</li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">3. User Account and Security</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  Certain features may require account registration. You are solely responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Maintaining the confidentiality of your login credentials.</li>
                  <li>All activities conducted under your account.</li>
                  <li>Immediately notifying us of any unauthorized access.</li>
                </ul>
                <p className="mt-3">
                  We reserve the right to suspend or terminate accounts suspected of misuse, fraud, or violation of these Terms.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">4. Mandatory KYC and Merchant Onboarding</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  As required under applicable laws, regulations, and guidelines, including applicable RBI requirements, PayByCard may be required to verify the identity and KYC details of both the payer/sender and the beneficiary/merchant/recipient before processing a payment.
                </p>
                <p>
                  Completion of the required KYC verification is mandatory for users before they can initiate or make payments through the Platform. Similarly, the beneficiary/merchant must complete the applicable onboarding and KYC requirements within the timeline specified by PayByCard or its payment/banking partners.
                </p>
                <p>
                  PayByCard reserves the right to decline, hold, suspend, or refund a transaction where the required KYC or merchant onboarding is incomplete, unsuccessful, expired, or not completed within the prescribed timeline. Any refund will be processed in accordance with the applicable refund policy and the procedures of the relevant payment gateway and banking partners.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">4. Fees and Charges</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  All applicable convenience fees, processing charges, GST, and other costs are clearly displayed before you confirm any transaction. By proceeding, you agree to pay these charges.
                </p>
                <p>
                  Our fees are non-refundable except in limited cases explicitly mentioned in the Refund Policy. We may revise fees with prior notice on the Platform.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-7 h-7 text-[#8c76f0] mr-3" />
                5. Prohibited Conduct
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  You agree not to use the Services for any purpose that is unlawful, fraudulent, or prohibited under these Terms or applicable laws. Prohibited activities include (but are not limited to):
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>PayByCard is not a cash withdrawal or credit-card-to-bank-account cash conversion service. Payments are intended only for genuine underlying transactions to verified recipients and are subject to applicable card-network, payment-partner and regulatory requirements.</li>
                  <li>Making payments for illegal goods, services, or purposes.</li>
                  <li>Providing false, inaccurate, or misleading information.</li>
                  <li>Attempting to circumvent security measures, fees, or transaction limits.</li>
                  <li>Sharing sensitive payment details (card number, CVV, OTP) with unauthorized persons.</li>
                  <li>Engaging in money laundering, terrorist financing, or any activity violating Prevention of Money Laundering Act (PMLA) or RBI guidelines.</li>
                  <li>Using automated scripts, bots, or any means to overload or interfere with the Platform.</li>
                </ul>
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mt-4">
                  <p className="font-semibold text-amber-900">
                    Important Security Advisory: PayByCard or its representatives will never request your CVV, OTP, or full card details over phone, email, SMS, or any unsolicited communication. Any such request is fraudulent — report it immediately.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">6. Intellectual Property Rights</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  All content, logos, trademarks, designs, software, and technology on the Platform are owned by or licensed to PayByCard. You are granted a limited, revocable, non-exclusive, non-transferable license to access and use the Services for personal or authorized business purposes only.
                </p>
                <p>
                  Any unauthorized reproduction, modification, distribution, or reverse engineering is strictly prohibited.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Shield className="w-7 h-7 text-[#8c76f0] mr-3" />
                7. Privacy and Data Protection
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We collect, process, and protect your personal and transaction data in accordance with our Privacy Policy and applicable laws, including the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000.
                </p>
                <p>
                  By using the Services, you consent to such collection and processing as described in the Privacy Policy.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">8. Disclaimers</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  The Platform and Services are provided on an "as is" and "as available" basis without any warranties, express or implied.
                </p>
                <p>We do not warrant:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Uninterrupted, error-free, or secure operation of the Services.</li>
                  <li>Success of every transaction (failures may occur due to bank, card issuer, or network issues).</li>
                  <li>Accuracy or completeness of any information on the Platform.</li>
                </ul>
                <p className="mt-3">
                  We are not liable for any disputes between you and the payee regarding the underlying goods, services, or fees.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">9. Limitation of Liability</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  To the maximum extent permitted by law, PayByCard, its directors, officers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Services.
                </p>
                <p>
                  Our total aggregate liability shall not exceed the total fees paid by you to us in the twelve (12) months immediately preceding the claim.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">10. Indemnification</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  You agree to indemnify, defend, and hold harmless PayByCard and its affiliates from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or relating to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Your use or misuse of the Services.</li>
                  <li>Any violation of these Terms or applicable laws.</li>
                  <li>Any dispute with the payee or third parties.</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">11. Termination</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We may suspend or terminate your access to the Services at any time, with or without notice, for breach of these Terms, suspected fraud, or regulatory requirements.
                </p>
                <p>
                  Upon termination, all rights granted to you under these Terms cease immediately. Surviving provisions include those relating to disclaimers, limitation of liability, indemnification, and governing law.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">12. Amendments</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We reserve the right to modify these Terms at any time. We will post the updated Terms on the Platform with a new effective date. Your continued use of the Services after such changes constitutes your acceptance of the revised Terms.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Gavel className="w-7 h-7 text-[#8c76f0] mr-3" />
                13. Governing Law and Dispute Resolution
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of India.
                </p>
                <p>
                  Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Mumbai, Maharashtra.
                </p>
                <p>
                  Parties may first attempt amicable resolution. Unresolved disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996, by a sole arbitrator appointed by us. The seat of arbitration shall be Mumbai, and proceedings shall be conducted in English.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Globe className="w-7 h-7 text-[#8c76f0] mr-3" />
                14. Miscellaneous
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Severability:</p>
                  <p>If any provision is held invalid or unenforceable, the remaining provisions shall remain in full force.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Waiver:</p>
                  <p>Failure to enforce any right does not constitute a waiver.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Entire Agreement:</p>
                  <p>These Terms, together with the referenced Policies, constitute the entire agreement between you and PayByCard.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Force Majeure:</p>
                  <p>We are not liable for delays or failures due to events beyond our reasonable control.</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Mail className="w-7 h-7 text-[#8c76f0] mr-3" />
                Contact Us
              </h3>
              <div className="space-y-2 text-gray-700 leading-relaxed">
                <p>For any questions regarding these Terms, please contact us at:</p>
                <div className="mt-4 space-y-1">
                  <p><span className="font-semibold">Email:</span> <a href="mailto:support@paybycard.in" className="text-[#8c76f0] hover:underline">support@paybycard.in</a></p>
                  <p><span className="font-semibold">Address:</span> PayByCard Technologies Pvt. Ltd., 3701, IRIS, Runwal Bliss, Crompton Greaves Compound, Kanjurmarg East, Mumbai, Maharashtra 400 042</p>
                  <p><span className="font-semibold">Phone:</span> <a href="tel:+918850144143" className="text-[#8c76f0] hover:underline">+91 88501 44143</a></p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-[#8c76f0] shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Building className="w-7 h-7 text-[#8c76f0] mr-3" />
                Acknowledgement
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p className="font-semibold text-gray-900 text-lg">
                  By using PayByCard, you confirm that you have read, understood, and agreed to these Terms of Service.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Questions About These Terms?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            If you have any questions or need clarification regarding these terms, our team is here to help.
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

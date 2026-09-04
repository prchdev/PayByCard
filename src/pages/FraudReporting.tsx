import { AlertTriangle, Shield, Phone, Mail, FileText, CheckCircle, AlertCircle, Eye, Lock, UserX, Ban } from 'lucide-react';

export default function FraudReporting() {
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
              <AlertTriangle className="w-20 h-20 text-[#8c76f0] mx-auto animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Fraud Reporting & <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">Management</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              We are committed to maintaining a secure payment environment and preventing fraudulent activities
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
                At PayByCard (operated through <a href="https://paybycard.in" className="text-[#8c76f0] hover:text-purple-700 font-semibold">https://paybycard.in</a>), we are committed to maintaining a secure and trustworthy payment environment. This Fraud Reporting & Management Policy explains how we prevent, detect, and handle fraudulent activities, and outlines the steps you should take if you suspect fraud.
              </p>
              <p>
                This Policy forms an integral part of our Terms of Service and should be read along with our Privacy Policy and Refund Policy.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Shield className="w-7 h-7 text-[#8c76f0] mr-3" />
                1. Our Commitment to Fraud Prevention
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  PayByCard acts as a technology platform that facilitates secure online payments through RBI-authorized payment gateways and banks. We implement industry-standard measures to minimize fraud risks, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Real-time transaction monitoring for suspicious patterns</li>
                  <li>Tokenization and encryption of sensitive data</li>
                  <li>Compliance with PCI-DSS standards (where applicable) and RBI guidelines</li>
                  <li>Advanced security protocols to detect unusual activity such as high-velocity transactions or mismatched locations</li>
                </ul>
                <p className="mt-4">
                  We do not store your complete credit/debit card details, CVV, or sensitive authentication data on our servers.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Lock className="w-7 h-7 text-[#8c76f0] mr-3" />
                2. Important Security Advisory – Protect Yourself
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>To safeguard your payments:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Never share your card number, CVV, OTP (One-Time Password), or any banking credentials with anyone.</li>
                  <li>PayByCard or its representatives will never ask for your CVV, OTP, or full card details via phone, email, SMS, WhatsApp, or any unsolicited communication.</li>
                  <li>Always verify that you are on the official website <span className="font-semibold text-gray-900">https://paybycard.in</span> before entering payment details.</li>
                  <li>Enable two-factor authentication wherever available and regularly monitor your bank/card statements.</li>
                </ul>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mt-4">
                  <p className="font-semibold text-red-900">Important Warning:</p>
                  <p className="text-red-800">Any unsolicited request for sensitive information is likely a phishing or social engineering scam. Report such incidents immediately to your bank and the National Cyber Crime Reporting Portal (<a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="underline">cybercrime.gov.in</a>).</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Ban className="w-7 h-7 text-[#8c76f0] mr-3" />
                3. What Constitutes Fraudulent Activity
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>Fraudulent activity on the Platform includes, but is not limited to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Unauthorized use of a payment instrument (card, UPI, etc.)</li>
                  <li>Use of stolen, cloned, or compromised payment credentials</li>
                  <li>Attempts to bypass security checks, fees, or transaction limits</li>
                  <li>Filing chargebacks without valid reason ("friendly fraud")</li>
                  <li>Any transaction that violates applicable laws, including the Prevention of Money Laundering Act (PMLA) or RBI regulations</li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-7 h-7 text-[#8c76f0] mr-3" />
                4. How to Report Suspected Fraud
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p className="font-semibold text-gray-900">If you suspect a fraudulent transaction made through PayByCard:</p>

                <div className="bg-white rounded-lg p-6">
                  <p className="font-semibold text-gray-900 mb-3">Step 1: Contact Your Bank/Card Issuer Immediately</p>
                  <p className="text-gray-700">Report the unauthorized transaction to your issuing bank or card provider and request a dispute/chargeback as per their timeline (usually within 3–60 days, depending on the card network).</p>
                </div>

                <div className="bg-white rounded-lg p-6">
                  <p className="font-semibold text-gray-900 mb-3">Step 2: Notify PayByCard</p>
                  <p className="text-gray-700 mb-2">Email us at <a href="mailto:support@paybycard.in" className="text-[#8c76f0] hover:text-purple-700 font-semibold">support@paybycard.in</a> within <span className="font-semibold text-gray-900">24 hours</span> of noticing the suspicious activity. Please include:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                    <li>Transaction ID / Reference Number</li>
                    <li>Date and time of the transaction</li>
                    <li>Amount involved</li>
                    <li>Description of the suspected fraud</li>
                    <li>Supporting evidence (screenshots, bank statement excerpts, etc.)</li>
                    <li>Your contact details</li>
                  </ul>
                </div>

                <p>
                  We will acknowledge your report promptly and initiate an internal review. However, the final resolution of chargebacks lies with your bank, the card networks (Visa, Mastercard, RuPay, etc.), and the payment gateway.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <FileText className="w-7 h-7 text-[#8c76f0] mr-3" />
                5. Our Fraud Management Process
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>Upon receiving a fraud report or detecting suspicious activity, we may:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Temporarily suspend the involved transaction or account</li>
                  <li>Block further use of the payment instrument or user account</li>
                  <li>Cooperate fully with your bank, payment partners, law enforcement, and regulatory authorities (including RBI and cybercrime cells)</li>
                  <li>Withhold settlements pending investigation where required</li>
                </ul>

                <div className="bg-purple-50 rounded-lg p-4 mt-4">
                  <p className="font-semibold text-gray-900 mb-2">If fraud is confirmed:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                    <li>We reserve the right to reverse the transaction where possible.</li>
                    <li>You may be held liable if the fraud resulted from your negligence (e.g., sharing OTP or card details).</li>
                    <li>Repeated fraudulent activity or high chargeback ratios may lead to account suspension, termination, or additional fees.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <UserX className="w-7 h-7 text-[#8c76f0] mr-3" />
                6. Consequences of Misuse
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  Any user found engaging in, facilitating, or benefiting from fraudulent activity will face immediate suspension or permanent termination of access to the Platform. We may report such cases to appropriate authorities and pursue legal action.
                </p>
                <p>
                  You agree to indemnify PayByCard against any losses, claims, or liabilities arising from your involvement in fraudulent transactions.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">7. Limitation of Liability</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>While we take reasonable measures to prevent fraud, we are not liable for losses arising from:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Your disclosure of sensitive information</li>
                  <li>Phishing or scams originating outside our Platform</li>
                  <li>Issues on the side of your bank, card issuer, or the payee</li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">8. Updates to This Policy</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We may revise this Fraud Reporting & Management Policy from time to time. The updated version will be posted on <a href="https://paybycard.in" className="text-[#8c76f0] hover:underline font-semibold">https://paybycard.in</a> with a new effective date. Your continued use of the Services constitutes acceptance of the revised policy.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Mail className="w-7 h-7 text-[#8c76f0] mr-3" />
                9. Contact Us
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  For fraud reporting or related concerns, please email us at <a href="mailto:support@paybycard.in" className="text-[#8c76f0] hover:text-purple-700 font-semibold">support@paybycard.in</a>.
                </p>
                <p className="font-semibold text-gray-900">In case of emergency, also contact:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Your bank/card issuer immediately</li>
                  <li>National Cyber Crime Reporting Portal: <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="text-[#8c76f0] hover:text-purple-700 font-semibold">https://cybercrime.gov.in</a></li>
                </ul>
                <p className="font-semibold text-gray-900 mt-4">
                  By using PayByCard, you acknowledge that you have read, understood, and agreed to this Fraud Reporting & Management Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="py-16 px-4 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Need to Report Fraud?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Contact us immediately if you suspect any fraudulent activity. Our team is here to help you 24/7.
          </p>
          <a
            href="mailto:support@paybycard.in"
            className="group relative inline-flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full blur-md group-hover:blur-lg transition-all opacity-50"></div>
            <span className="relative bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full px-10 py-4 shadow-lg flex items-center space-x-2 text-white font-bold hover:scale-105 transition-all duration-300">
              <Mail className="w-5 h-5" />
              <span>Report Fraud</span>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}

import { RefreshCw, AlertTriangle, FileText, Clock, Ban, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RefundPolicy() {
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
              <RefreshCw className="w-20 h-20 text-[#8c76f0] mx-auto animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Refund <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">Policy</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Understanding our refund and cancellation policies for all transactions processed through PayByCard
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-gray-300 shadow-xl mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
              <FileText className="w-8 h-8 text-[#8c76f0] mr-3" />
              Introduction
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                This Refund Policy forms an integral part of the Terms of Service and governs all payments made through the website <a href="https://paybycard.in" className="text-[#8c76f0] hover:text-purple-700 font-semibold">https://paybycard.in</a> and the services provided by PayByCard Private Limited ("PayByCard", "we", "us", or "our").
              </p>
              <p className="font-semibold text-gray-900">
                By initiating any payment on the Platform, you expressly agree to the terms outlined in this Refund Policy.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Ban className="w-7 h-7 text-[#8c76f0] mr-3" />
                1. General Principle – Non-Refundable Transactions
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p className="font-semibold text-gray-900">
                  All payments processed through PayByCard are final and non-refundable. This includes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>The principal amount paid to the payee (school, college, coaching institute, institution, or any other recipient)</li>
                  <li>Convenience fees, service charges, processing fees, GST, and any other charges levied by us</li>
                </ul>
                <p>
                  Once a transaction is successfully completed and the funds are forwarded to the intended payee, no refund or cancellation request will be accepted, even if the underlying service or fee has not been availed or utilized by you.
                </p>
                <p>
                  Our service charges are clearly displayed before you confirm the transaction. By proceeding with the payment, you acknowledge and accept the applicable fees.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">2. Limited Exceptions for Refunds</h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  We may consider a refund request only in the following exceptional cases, subject to verification and at our sole discretion:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><span className="font-semibold text-gray-900">Duplicate Payment:</span> The same invoice or amount was charged more than once due to a technical error on our Platform.</li>
                  <li><span className="font-semibold text-gray-900">Technical Failure on Our End:</span> The amount was debited from your account but not credited to the payee's account (confirmed by our payment gateway partner).</li>
                  <li><span className="font-semibold text-gray-900">Incorrect Beneficiary Due to Platform Error:</span> Payment was routed to a wrong recipient solely because of an error attributable to PayByCard (not due to incorrect details entered by you).</li>
                </ul>
                <div className="bg-white rounded-lg p-4 mt-4">
                  <p className="font-semibold text-gray-900 mb-2">Refunds will NOT be provided in cases such as:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                    <li>Change of mind after successful payment</li>
                    <li>Errors made by you (wrong amount, wrong invoice number, or incorrect payee details)</li>
                    <li>Disputes with the payee regarding service delivery, quality, or eligibility</li>
                    <li>Transactions where the payee has already received or utilized the funds</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Clock className="w-7 h-7 text-[#8c76f0] mr-3" />
                3. Refund Request Procedure
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>To request a refund under the limited exceptions above, you must:</p>
                <ul className="list-disc list-inside space-y-3 ml-4">
                  <li>Submit the request in writing via email to <a href="mailto:support@paybycard.in" className="text-[#8c76f0] hover:text-purple-700 font-semibold">support@paybycard.in</a> within <span className="font-semibold text-gray-900">2 hours</span> of the transaction.</li>
                  <li>Provide the following mandatory details:
                    <ul className="list-circle list-inside space-y-1 ml-6 mt-2">
                      <li>Transaction ID / Reference Number</li>
                      <li>Date and time of the transaction</li>
                      <li>Amount paid</li>
                      <li>Reason for the refund request</li>
                      <li>Supporting documents (screenshots, bank statement, invoice copy, etc.)</li>
                    </ul>
                  </li>
                </ul>
                <p>
                  We will review your request and respond within <span className="font-semibold text-gray-900">5 to 7 business days</span>. If approved, the refund (net of any bank or gateway charges) will be processed back to the original payment source within <span className="font-semibold text-gray-900">7 to 15 business days</span>, depending on your bank or card issuer's processing time.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">4. Refund Charges</h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>In case a refund is approved:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Our original convenience/service fees remain non-refundable.</li>
                  <li>An additional Refund Processing Fee of up to <span className="font-semibold text-gray-900">2%</span> of the transaction amount or <span className="font-semibold text-gray-900">₹100</span> (whichever is higher) may be deducted.</li>
                  <li>Any charges imposed by the payment gateway, card networks, or your bank will also be borne by you.</li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-7 h-7 text-[#8c76f0] mr-3" />
                5. Chargebacks and Disputes
              </h3>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Initiating a chargeback or dispute directly with your bank or card issuer without first contacting us may result in additional penalties and fees.</li>
                  <li>We reserve the right to charge a Chargeback Handling Fee (minimum <span className="font-semibold text-gray-900">₹500</span> or actual cost incurred) for each invalid or frivolous chargeback.</li>
                  <li>Repeated chargebacks may lead to suspension or permanent termination of your access to the Platform.</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">6. No Liability for Payee Disputes</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  PayByCard acts only as a technology facilitator between you and the payee. Any disputes regarding the underlying transaction (such as non-delivery of service by the institution) must be resolved directly with the payee. We are not responsible for processing refunds arising from such disputes.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">7. Modifications to the Policy</h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  We reserve the right to update or modify this Refund Policy at any time. The revised policy will be posted on <a href="https://paybycard.in" className="text-[#8c76f0] hover:underline font-semibold">https://paybycard.in</a> with the updated effective date. Your continued use of the Platform after such changes constitutes your acceptance of the revised policy.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 rounded-2xl p-8 border-2 border-[#8c76f0]/30 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Mail className="w-7 h-7 text-[#8c76f0] mr-3" />
                8. Contact Us
              </h3>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  For any refund-related queries, please write to us at <a href="mailto:support@paybycard.in" className="text-[#8c76f0] hover:text-purple-700 font-semibold">support@paybycard.in</a>.
                </p>
                <p className="font-semibold text-gray-900 mt-4">
                  By making a payment on PayByCard, you confirm that you have read, understood, and agreed to this Refund Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="py-16 px-4 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Have Questions About Our Refund Policy?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            If you need clarification on our refund and cancellation policies, our support team is here to help.
          </p>
          <Link
            to="/contact"
            className="group relative inline-flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full blur-md group-hover:blur-lg transition-all opacity-50"></div>
            <span className="relative bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full px-10 py-4 shadow-lg flex items-center space-x-2 text-white font-bold hover:scale-105 transition-all duration-300">
              <Mail className="w-5 h-5" />
              <span>Contact Support</span>
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

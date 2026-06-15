import { ChevronDown, HelpCircle, CreditCard, RefreshCw, Shield, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left hover:text-[#8c76f0] transition-colors"
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-[#8c76f0] flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="pb-5 text-gray-600 leading-relaxed whitespace-pre-line">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const faqSections = [
    {
      title: 'General',
      icon: HelpCircle,
      questions: [
        {
          question: 'What is PayByCard.in?',
          answer:
            'PayByCard.in is a secure online payment gateway service that allows users to make purchases using their credit cards. We aim to provide a fast, reliable and secure checkout experience for merchants and customers alike.',
        },
        {
          question: 'Which payment methods/cards are accepted?',
          answer:
            'We support all major credit cards (Visa, MasterCard, RuPay, etc.) issued by Indian banks.',
        },
        {
          question: 'Is card details stored on PayByCard.in?',
          answer:
            'No. We do not store your full card details. All card information is processed securely through our payment processor, in compliance with security and data-protection standards.',
        },
      ],
    },
    {
      title: 'Payment & Transaction Processing',
      icon: CreditCard,
      questions: [
        {
          question: 'When will my payment be settled?',
          answer:
            'Most payments are settled instantly. However, for a first-time-used card on your account, the payment will be placed on hold and processed only after a 4-hour verification window. This helps protect against unauthorized or fraudulent card usage.',
        },
        {
          question: 'Will I receive confirmation after payment?',
          answer:
            'Yes. Once your payment is successfully processed, you will receive a confirmation via email and/or SMS (according to the information provided at checkout).',
        },
        {
          question: 'What if the payment fails or is declined?',
          answer:
            'If the card is declined (e.g., insufficient funds, bank rejection, invalid card), you will receive a failure notification. You may retry with the same card (if allowed by bank rules) or try a different payment method.',
        },
      ],
    },
    {
      title: 'Refunds, Cancellations & Disputes',
      icon: RefreshCw,
      questions: [
        {
          question: 'How do I request a refund or cancellation?',
          answer:
            "Refunds or cancellations depend on the merchant's policies. Please request refund/cancellation with the merchant first. If you believe the transaction is fraudulent, you can refer to our Fraud Reporting Policy and contact us.",
        },
        {
          question: "What happens if I report a fraudulent transaction before it's processed?",
          answer:
            'If the transaction is still pending (within the 4-hour window or before final settlement), we will pause processing immediately. Upon verification, we will refund the amount to your original payment method — deducting a 3% processing/administrative fee.',
        },
        {
          question: 'What if the transaction was already processed and settled?',
          answer:
            'Once a transaction has been processed, we cannot reverse it directly. You may file a police complaint for a fraudulent transaction. Upon receiving a verified request from a law enforcement or other authorized government agency, we will share relevant receiver/merchant details to assist the investigation.',
        },
      ],
    },
    {
      title: 'Security & Fraud Prevention',
      icon: Shield,
      questions: [
        {
          question: 'How does PayByCard.in protect me from fraud?',
          answer: `We implement multiple security measures, including:

• Delayed processing for first-time card usage (4-hour verification window)
• Strict identity verification through KYC when reporting fraud
• Secure handling of card data via compliant payment processors
• Support for dispute or fraud reporting and cooperation with law enforcement`,
        },
        {
          question: 'What should I do if I suspect fraudulent activity on my card?',
          answer:
            'Immediately contact us at support@paybycard.in or call our helpline +91 88501 44143. Provide the transaction reference number, date/time, amount, and your registered KYC details. If the payment is pending, we will pause & refund; if already processed, you can file a police complaint and we will assist authorized agencies.',
        },
      ],
    },
    {
      title: 'Account & Customer Support',
      icon: Users,
      questions: [
        {
          question: 'Do I need to register an account to use PayByCard.in?',
          answer:
            "It depends on the merchant's implementation. Some merchants may require account registration for repeat purchases or saved-card features; others may allow one-time guest checkout.",
        },
        {
          question: 'Where can I find my transaction history or receipts?',
          answer:
            "Transaction history and receipts are visible on the merchant's website/order page. Additionally, after each payment you will receive a confirmation email/SMS with the transaction details.",
        },
        {
          question: 'How do I contact customer support?',
          answer: `You can reach us via:

Email: support@paybycard.in
Helpline: +91 88501 44143

Please include your transaction reference, date, and relevant details so we can assist you efficiently.`,
        },
        {
          question: 'What should I do if I lose access to my registered email or phone number?',
          answer:
            'Please contact support with your registered name, approximate transaction date, KYC details, and any other relevant information so we can help you recover access or verify identity.',
        },
      ],
    },
  ];

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
              <HelpCircle className="w-20 h-20 text-[#8c76f0] mx-auto animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Frequently Asked <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">Questions</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Find answers to common questions about PayByCard.in
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-6">
            {faqSections.map((section, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-8 border-2 border-gray-300 hover:border-[#8c76f0] transition-all shadow-lg"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <section.icon className="w-7 h-7 text-[#8c76f0] mr-3" />
                  {section.title}
                </h2>
                <div className="space-y-1">
                  {section.questions.map((faq, faqIdx) => (
                    <FAQItem key={faqIdx} question={faq.question} answer={faq.answer} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Still Have Questions?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Our support team is here to help you with any queries you may have
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

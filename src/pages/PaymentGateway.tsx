import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, Lock, ArrowLeft, AlertCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import DashboardNavigation from '../components/DashboardNavigation';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

const CARD_TYPE_INFO = {
  'visa': { name: 'Visa', color: 'bg-blue-600' },
  'mastercard': { name: 'Mastercard', color: 'bg-orange-600' },
  'rupay': { name: 'RuPay', color: 'bg-green-600' },
  'amex': { name: 'American Express', color: 'bg-blue-800' },
  'diners': { name: 'Diners Club', color: 'bg-purple-600' },
};

export default function PaymentGateway() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    paymentId,
    reference,
    amount,
    gatewayName,
    gatewayUrl,
    environment,
    allowedCards,
    userId,
    userEmail,
    beneficiary,
    category
  } = location.state || {};

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [selectedCardType, setSelectedCardType] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [transactionComplete, setTransactionComplete] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);

  useEffect(() => {
    if (!paymentId || !userId) {
      const stored = sessionStorage.getItem('pendingPayment');
      if (!stored) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [paymentId, userId, navigate]);

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
  };

  const detectCardType = (cardNumber: string): string | null => {
    const cleaned = cardNumber.replace(/\s/g, '');

    if (/^4/.test(cleaned)) {
      return 'visa';
    } else if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) {
      return 'mastercard';
    } else if (/^(6[05]|81|82|508)/.test(cleaned)) {
      return 'rupay';
    } else if (/^3[47]/.test(cleaned)) {
      return 'amex';
    } else if (/^(30[0-5]|36|38)/.test(cleaned)) {
      return 'diners';
    }

    return null;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '');
    if (value.length <= 16 && /^\d*$/.test(value)) {
      setCardNumber(value);

      if (value.length >= 2) {
        const detectedType = detectCardType(value);
        if (detectedType && allowedCards?.includes(detectedType)) {
          setSelectedCardType(detectedType);
          setMessage(null);
        } else if (detectedType && !allowedCards?.includes(detectedType)) {
          setSelectedCardType('');
          setMessage({
            type: 'error',
            text: `${CARD_TYPE_INFO[detectedType as keyof typeof CARD_TYPE_INFO]?.name || 'This card type'} is not supported for this transaction.`
          });
        } else if (value.length >= 6) {
          setSelectedCardType('');
          setMessage({
            type: 'error',
            text: 'Card type not recognized. Please check your card number.'
          });
        }
      } else {
        setSelectedCardType('');
        setMessage(null);
      }
    }
  };

  const handleExpiryMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 2 && /^\d*$/.test(value)) {
      const num = parseInt(value);
      if (value === '' || (num >= 1 && num <= 12)) {
        setExpiryMonth(value);
      }
    }
  };

  const handleExpiryYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 2 && /^\d*$/.test(value)) {
      setExpiryYear(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 4 && /^\d*$/.test(value)) {
      setCvv(value);
    }
  };

  const validateForm = () => {
    if (cardNumber.length !== 16) {
      setMessage({ type: 'error', text: 'Card number must be 16 digits' });
      return false;
    }

    if (!selectedCardType) {
      const detectedType = detectCardType(cardNumber);
      if (!detectedType) {
        setMessage({ type: 'error', text: 'Card type not recognized. Please check your card number.' });
      } else if (!allowedCards?.includes(detectedType)) {
        setMessage({
          type: 'error',
          text: `${CARD_TYPE_INFO[detectedType as keyof typeof CARD_TYPE_INFO]?.name || 'This card type'} is not supported for this transaction.`
        });
      } else {
        setMessage({ type: 'error', text: 'Unable to detect card type. Please check your card number.' });
      }
      return false;
    }

    if (!cardHolderName.trim()) {
      setMessage({ type: 'error', text: 'Please enter card holder name' });
      return false;
    }

    if (!expiryMonth || !expiryYear) {
      setMessage({ type: 'error', text: 'Please enter card expiry date' });
      return false;
    }

    if (cvv.length < 3) {
      setMessage({ type: 'error', text: 'Please enter valid CVV' });
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    setMessage(null);

    if (!validateForm()) {
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: paymentId,
          card_number: cardNumber,
          card_expiry_month: expiryMonth.padStart(2, '0'),
          card_expiry_year: expiryYear,
          card_cvv: cvv,
          card_holder_name: cardHolderName,
          card_type: selectedCardType,
          environment: environment,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTransactionSuccess(true);
        setTransactionComplete(true);
        setTransactionData({
          reference: reference,
          amount: amount,
          transactionId: result.transactionId,
          gatewayName: gatewayName,
          message: result.message || 'Payment completed successfully',
          timestamp: new Date().toISOString(),
        });

        sessionStorage.removeItem('pendingPayment');
      } else {
        setTransactionSuccess(false);
        setTransactionComplete(true);
        setTransactionData({
          reference: reference,
          amount: amount,
          gatewayName: gatewayName,
          message: result.message || 'Payment failed. Please try again.',
          error: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      setTransactionSuccess(false);
      setTransactionComplete(true);
      setTransactionData({
        reference: reference,
        amount: amount,
        gatewayName: gatewayName,
        message: 'An error occurred while processing payment.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setProcessing(false);
    }
  };

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!paymentId || !userId) {
    return null;
  }

  const TransactionStatusModal = () => {
    if (!transactionComplete) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
          <div className="text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              transactionSuccess ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {transactionSuccess ? (
                <CheckCircle className="w-12 h-12 text-green-600" />
              ) : (
                <XCircle className="w-12 h-12 text-red-600" />
              )}
            </div>

            <h2 className={`text-2xl font-bold mb-3 ${
              transactionSuccess ? 'text-green-900' : 'text-red-900'
            }`}>
              {transactionSuccess ? 'Payment Successful!' : 'Payment Failed'}
            </h2>

            <p className="text-gray-600 mb-6">
              {transactionData?.message}
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Reference</span>
                <span className="font-mono font-semibold text-gray-900">
                  {transactionData?.reference}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold text-gray-900">
                  ₹{parseFloat(transactionData?.amount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gateway</span>
                <span className="font-semibold text-gray-900">
                  {transactionData?.gatewayName}
                </span>
              </div>
              {transactionSuccess && transactionData?.transactionId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Transaction ID</span>
                  <span className="font-mono text-xs font-semibold text-gray-900">
                    {transactionData.transactionId}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Timestamp</span>
                <span className="text-xs text-gray-900">
                  {new Date(transactionData?.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            {transactionSuccess ? (
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/dashboard', { state: { userId, userEmail } })}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => navigate('/make-payment', { state: { userId, userEmail } })}
                  className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Make Another Payment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setTransactionComplete(false);
                    setTransactionData(null);
                    setCardNumber('');
                    setCardHolderName('');
                    setExpiryMonth('');
                    setExpiryYear('');
                    setCvv('');
                    setSelectedCardType('');
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate('/dashboard', { state: { userId, userEmail } })}
                  className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TransactionStatusModal />
      <DashboardNavigation
        userEmail={userEmail}
        userId={userId}
        onLogout={handleLogout}
        onMenuToggle={() => {}}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/make-payment', { state: { userId, userEmail } })}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Payment
        </button>

        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Secure Payment</h1>
                <p className="text-blue-100 text-sm">via {gatewayName}</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white bg-opacity-10 rounded-xl p-4">
              <div>
                <p className="text-blue-100 text-sm">Payment Reference</p>
                <p className="font-mono font-bold">{reference}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm">Amount to Pay</p>
                <p className="text-2xl font-bold">₹{parseFloat(amount).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {message && (
              <div
                className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-50 border-green-300'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                <AlertCircle
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    message.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}
                />
                <p
                  className={`text-sm font-medium ${
                    message.type === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {message.text}
                </p>
              </div>
            )}

            <div className="space-y-6">
              {selectedCardType && (
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-green-700 font-medium">Detected Card Type</p>
                      <p className="text-green-900 font-bold">
                        {CARD_TYPE_INFO[selectedCardType as keyof typeof CARD_TYPE_INFO]?.name}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Card Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="cardNumber"
                    value={formatCardNumber(cardNumber)}
                    onChange={handleCardNumberChange}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    placeholder="1234 5678 9012 3456"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cardHolderName" className="block text-sm font-medium text-gray-700 mb-2">
                  Card Holder Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="cardHolderName"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  placeholder="JOHN DOE"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="expiryMonth" className="block text-sm font-medium text-gray-700 mb-2">
                    Month <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="expiryMonth"
                    value={expiryMonth}
                    onChange={handleExpiryMonthChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    placeholder="MM"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label htmlFor="expiryYear" className="block text-sm font-medium text-gray-700 mb-2">
                    Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="expiryYear"
                    value={expiryYear}
                    onChange={handleExpiryYearChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    placeholder="YY"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-2">
                    CVV <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="cvv"
                    value={cvv}
                    onChange={handleCvvChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    placeholder="123"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Secure Transaction</p>
                    <p className="text-xs text-blue-800">
                      Your card details are encrypted and secure. We never store your complete card information.
                    </p>
                    <p className="text-xs text-blue-700 mt-2">
                      Environment: <span className="font-bold">{environment}</span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Lock className="w-6 h-6" />
                    Pay ₹{parseFloat(amount).toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Users,
  DollarSign,
  FileText,
  CheckCircle,
  Upload,
  X,
  AlertCircle,
  CreditCard,
  Loader2,
} from 'lucide-react';
import MobileLayout from '../../components/mobile/MobileLayout';
import { useAuth } from '../../contexts/AuthContext';
import { getClientIp } from '../../utils/getClientIp';

interface Beneficiary {
  id: string;
  full_name: string;
  bank_account: string;
  ifsc: string;
  bank_name: string;
  branch_name: string;
  account_type: string;
  email: string;
  mobile: string;
  pan_number?: string;
  status: string;
  is_verified_merchant?: boolean;
}

interface PaymentCategory {
  id: string;
  category_name: string;
  is_enabled: boolean;
  display_order: number;
  receiver_kyc_required: boolean;
  new_card_payment_delay_hours: number;
  refund_after_hours: number;
  settlement_time: string;
}

interface PaymentGateway {
  id: string;
  gateway_name: string;
  status: string;
  payout_mode: string;
  registered_name: string;
  gst_number: string;
}

interface PaymentOption {
  id: string;
  gateway_id: string;
  category_id: string;
  gateway_name: string;
  gateway_registered_name: string;
  gateway_gst_number: string;
  gateway_gst_percentage: number;
  payout_mode: string;
  category_name: string;
  card_type: string;
  charges_percentage: number;
  discounted_charges_percentage: number;
  show_discount: boolean;
  gst_percentage: number;
  business_surcharge_percentage: number;
  receiver_kyc_required: boolean;
  terms_and_conditions: string;
  settlement_time: string;
  is_instant_settlement: boolean;
}

interface ChargesDetails {
  amount: number;
  charges: string;
  gst: string;
  discount: string;
  discountApplied: boolean;
  totalAmount: string;
  isBusiness: boolean;
  baseChargesPercentage: number;
  surchargePercentage: number;
  effectiveChargesPercentage: number;
  category: {
    id: string;
    name: string;
    description: string;
    gstPercentage: number;
  };
  gateway: {
    id: string;
    name: string;
    registeredName: string;
    gstNumber: string;
    payoutMode: string;
    chargesInfo: {
      visa: number;
      mastercard: number;
      rupay: number;
      amex: number;
      diners: number;
      gst_percentage: number;
    };
  };
}

function formatSettlementTime(t: string): string {
  if (!t) return '';
  switch (t.toLowerCase()) {
    case 'instant': return 'Instant Settlement';
    case 'same_day': return 'Same Day Settlement';
    case 't1':
    case 't+1': return 'T+1 Day Settlement';
    case 't2':
    case 't+2': return 'T+2 Days Settlement';
    default: return t;
  }
}

export default function MobileMakePayment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [paymentLimits, setPaymentLimits] = useState<{ min_amount: number; max_amount: number } | null>(null);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);

  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billFileUrl, setBillFileUrl] = useState<string>('');
  const [chargesDetails, setChargesDetails] = useState<ChargesDetails | null>(null);
  const [processing, setProcessing] = useState(false);
  const [kycStatus, setKycStatus] = useState<{ isVerified: boolean; status: string; isRestricted?: boolean } | null>(null);
  const [isCheckingKyc, setIsCheckingKyc] = useState(true);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef<number>(0);
  const [paymentResult, setPaymentResult] = useState<{
    reference: string;
    status: 'success' | 'failed' | 'pending' | 'cancelled';
    amount: string;
    message: string;
    paymentId?: string;
    gatewayResponse?: any;
  } | null>(null);

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/mobile/login', { replace: true });
  };

  useEffect(() => {
    if (!userId) {
      navigate('/mobile/login', { replace: true });
    } else {
      checkKycStatus();
    }
  }, [userId, navigate]);

  // Poll every 15 seconds (max 20 attempts = 5 minutes) after payment window is closed
  useEffect(() => {
    if (!pendingPaymentId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      pollAttemptsRef.current = 0;
      return;
    }

    pollAttemptsRef.current = 0;

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const poll = async () => {
      pollAttemptsRef.current += 1;
      const attempt = pollAttemptsRef.current;
      const maxAttempts = 1;

      setMessage({
        type: 'error',
        text: `Checking payment status — please do not close this window.`,
      });

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-payment-status`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentId: pendingPaymentId, userId }),
          }
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
          if (attempt >= maxAttempts) {
            stopPolling();
            setPendingPaymentId(null);
            await markPaymentCancelled(pendingPaymentId);
          }
          return;
        }

        const status = result.payment?.status;
        const paymentRef = result.payment?.payment_reference ?? 'N/A';
        const totalAmt = result.payment?.total_amount?.toString() ?? chargesDetails?.totalAmount ?? '0';

        if (status === 'completed') {
          stopPolling();
          setPendingPaymentId(null);
          // Trigger save-transaction-status so emails and auto-payout fire
          await saveTransactionStatus(
            paymentRef,
            'success',
            totalAmt,
            result.payment,
            undefined,
            result.payment.id
          );
          setPaymentResult({
            reference: paymentRef,
            status: 'success',
            amount: totalAmt,
            message: 'Your payment has been processed successfully!',
            paymentId: result.payment.id,
          });
          sessionStorage.removeItem('pendingPayment');
          setProcessing(false);
          setCurrentStep(5);
        } else if (status === 'failed' || status === 'cancelled') {
          stopPolling();
          setPendingPaymentId(null);
          await saveTransactionStatus(
            paymentRef,
            'failed',
            totalAmt,
            result.payment,
            result.payment.failure_reason || 'Payment failed',
            result.payment.id
          );
          setPaymentResult({
            reference: paymentRef,
            status: 'failed',
            amount: totalAmt,
            message: result.payment.failure_reason || 'Payment processing failed.',
            paymentId: result.payment.id,
          });
          sessionStorage.removeItem('pendingPayment');
          setProcessing(false);
          setCurrentStep(5);
        } else if (attempt >= maxAttempts) {
          // Timed out — treat as cancelled
          stopPolling();
          setPendingPaymentId(null);
          await markPaymentCancelled(pendingPaymentId);
        }
      } catch (err) {
        console.error('Poll error:', err);
        if (attempt >= maxAttempts) {
          stopPolling();
          setPendingPaymentId(null);
          await markPaymentCancelled(pendingPaymentId);
        }
      }
    };

    // Single immediate check on dismiss
    poll();

    return () => stopPolling();
  }, [pendingPaymentId, userId]);

  const markPaymentCancelled = async (paymentId: string | null) => {
    if (!paymentId) return;
    const pending = sessionStorage.getItem('pendingPayment');
    const pendingData = pending ? JSON.parse(pending) : null;
    const reference = pendingData?.reference ?? 'N/A';
    const amt = pendingData?.amount ?? chargesDetails?.totalAmount ?? '0';

    await saveTransactionStatus(reference, 'cancelled', amt, {}, 'Payment status could not be confirmed. Please contact support.', paymentId);

    setPaymentResult({
      reference,
      status: 'failed',
      amount: amt,
      message: 'Payment status could not be confirmed after multiple checks. Please contact support if your amount was debited.',
      paymentId,
    });
    sessionStorage.removeItem('pendingPayment');
    setProcessing(false);
    setCurrentStep(5);
  };

  const checkKycStatus = async () => {
    try {
      setIsCheckingKyc(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-kyc-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();
      if (response.ok) {
        setKycStatus(result);
        if (result.isVerified) {
          fetchInitialData();
        }
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    } finally {
      setIsCheckingKyc(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBeneficiaries(),
        fetchGateways(),
        fetchGatewayCharges(),
        fetchPaymentLimits(),
        fetchPaymentCategories()
      ]);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGatewayCharges = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-gateway-charges`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (response.ok && result.paymentOptions) {
        setPaymentOptions(result.paymentOptions);
      }
    } catch (error) {
      console.error('Error fetching payment options:', error);
    }
  };

  const fetchBeneficiaries = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-active-beneficiaries`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();
      if (response.ok) {
        setBeneficiaries(result.beneficiaries || []);
      } else {
        console.error('Failed to fetch beneficiaries:', result);
        setMessage({ type: 'error', text: result.error || 'Failed to load beneficiaries' });
      }
    } catch (error) {
      console.error('Error fetching beneficiaries:', error);
      setMessage({ type: 'error', text: 'Failed to load beneficiaries' });
    }
  };

  const fetchGateways = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-gateways`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (response.ok) {
        const activeGateways = (result.gateways || []).filter((g: PaymentGateway) => g.status === 'active');
        setGateways(activeGateways);
        if (activeGateways.length > 0) {
          setSelectedGateway(activeGateways[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching gateways:', error);
    }
  };

  const fetchPaymentLimits = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-limits`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.minimum_amount && result.maximum_amount) {
        setPaymentLimits({
          min_amount: result.minimum_amount,
          max_amount: result.maximum_amount
        });
      } else {
        console.error('Failed to fetch payment limits:', result);
        setPaymentLimits({
          min_amount: 1,
          max_amount: 100000
        });
      }
    } catch (error) {
      console.error('Error fetching payment limits:', error);
      setPaymentLimits({
        min_amount: 1,
        max_amount: 100000
      });
    }
  };

  const fetchPaymentCategories = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-categories-list`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (response.ok && result.categories) {
        setPaymentCategories(result.categories);
      } else {
        console.error('Failed to fetch payment categories:', result);
      }
    } catch (error) {
      console.error('Error fetching payment categories:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    const maxSize = 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Only PNG, JPEG, and PDF files are allowed' });
      return;
    }

    if (file.size > maxSize) {
      setMessage({ type: 'error', text: 'File size must be less than 1 MB' });
      return;
    }

    setBillFile(file);
    setMessage(null);
  };

  const removeFile = () => {
    setBillFile(null);
    setBillFileUrl('');
  };

  const calculateCharges = async () => {
    if (!amount || !selectedCategory || !selectedGateway) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return false;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-payment-charges`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            categoryId: selectedCategory.id,
            gatewayId: selectedGateway.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to calculate charges' });
        return false;
      }

      setChargesDetails(result);
      return true;
    } catch {
      setMessage({ type: 'error', text: 'Failed to calculate charges' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (currentStep === 1) {
      if (!selectedBeneficiary) {
        setMessage({ type: 'error', text: 'Please select a beneficiary' });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!amount || !selectedCategory) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        return;
      }

      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setMessage({ type: 'error', text: 'Please enter a valid amount' });
        return;
      }

      if (paymentLimits) {
        if (amountValue < paymentLimits.min_amount) {
          setMessage({
            type: 'error',
            text: `Amount must be at least ₹${paymentLimits.min_amount.toFixed(2)}`
          });
          return;
        }
        if (amountValue > paymentLimits.max_amount) {
          setMessage({
            type: 'error',
            text: `Amount cannot exceed ₹${paymentLimits.max_amount.toFixed(2)}`
          });
          return;
        }
      }

      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!selectedPaymentOption) {
        setMessage({ type: 'error', text: 'Please select a payment option' });
        return;
      }

      const baseAmount = parseFloat(amount) || 0;
      const isBusiness = selectedBeneficiary?.account_type === 'Current';
      const useDiscountedCharges = selectedPaymentOption.show_discount;
      const baseChargePercentage = useDiscountedCharges
        ? selectedPaymentOption.discounted_charges_percentage
        : selectedPaymentOption.charges_percentage;
      const surchargePercentage = isBusiness ? (selectedPaymentOption.business_surcharge_percentage || 0) : 0;
      const effectiveChargesPercentage = baseChargePercentage + surchargePercentage;

      const normalCharges = (baseAmount * selectedPaymentOption.charges_percentage) / 100;
      const charges = (baseAmount * effectiveChargesPercentage) / 100;
      const discount = useDiscountedCharges
        ? (baseAmount * selectedPaymentOption.charges_percentage) / 100 - (baseAmount * selectedPaymentOption.discounted_charges_percentage) / 100
        : 0;
      const gst = (charges * selectedPaymentOption.gst_percentage) / 100;
      const total = baseAmount + charges + gst;

      setChargesDetails({
        amount: baseAmount,
        charges: charges.toFixed(2),
        gst: gst.toFixed(2),
        discount: discount.toFixed(2),
        discountApplied: useDiscountedCharges,
        totalAmount: total.toFixed(2),
        isBusiness,
        baseChargesPercentage: baseChargePercentage,
        surchargePercentage,
        effectiveChargesPercentage,
        category: {
          id: selectedCategory?.id || '',
          name: selectedCategory?.category_name || '',
          description: '',
          gstPercentage: selectedPaymentOption.gst_percentage,
        },
        gateway: {
          id: selectedPaymentOption.gateway_id,
          name: selectedPaymentOption.gateway_name,
          registeredName: selectedPaymentOption.gateway_registered_name || '',
          gstNumber: selectedPaymentOption.gateway_gst_number || '',
          payoutMode: selectedPaymentOption.payout_mode || 'manual',
          chargesInfo: {
            visa: 0, mastercard: 0, rupay: 0, amex: 0, diners: 0,
            gst_percentage: selectedPaymentOption.gateway_gst_percentage || 18,
          },
        },
      });

      void normalCharges; // used in discount calc above

      const matchingGateway = gateways.find(g => g.id === selectedPaymentOption.gateway_id);
      if (matchingGateway) {
        setSelectedGateway(matchingGateway);
      }

      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    setMessage(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleMakePayment = async () => {
    setProcessing(true);
    setMessage(null);
    let gatewayOpened = false;

    try {
      if (billFile) {
        setBillFileUrl(`uploads/${userId}/${Date.now()}_${billFile.name}`);
      }

      if (!selectedPaymentOption) {
        throw new Error('Please select a payment option');
      }

      if (!selectedBeneficiary?.id) {
        throw new Error('Beneficiary is not selected');
      }

      if (!selectedCategory?.id) {
        throw new Error('Payment category is not selected');
      }

      if (!selectedPaymentOption.gateway_id) {
        throw new Error('Payment gateway is not selected');
      }

      if (!selectedPaymentOption.card_type) {
        throw new Error('Card type is not selected');
      }

      if (!chargesDetails?.amount || !chargesDetails?.totalAmount) {
        throw new Error('Payment amount is not calculated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initiate-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            beneficiaryId: selectedBeneficiary?.id,
            businessCategoryId: selectedCategory?.id,
            paymentOptionId: selectedPaymentOption.category_id,
            gatewayId: selectedPaymentOption.gateway_id,
            cardType: selectedPaymentOption.card_type,
            amount: chargesDetails?.amount,
            charges: chargesDetails?.charges,
            gst: chargesDetails?.gst,
            discount: chargesDetails?.discount,
            totalAmount: chargesDetails?.totalAmount,
            billFileUrl: billFileUrl || null,
            ipAddress: await getClientIp(),
            beneficiaryDetails: {
              full_name: selectedBeneficiary?.full_name,
              email: selectedBeneficiary?.email,
              mobile: selectedBeneficiary?.mobile,
              pan_number: selectedBeneficiary?.pan_number,
              bank_name: selectedBeneficiary?.bank_name,
              branch_name: selectedBeneficiary?.branch_name,
              bank_account: selectedBeneficiary?.bank_account,
              ifsc: selectedBeneficiary?.ifsc,
              account_type: selectedBeneficiary?.account_type,
              is_verified_merchant: selectedBeneficiary?.is_verified_merchant || false,
            },
            categoryDetails: {
              category_name: selectedCategory?.category_name,
              is_enabled: selectedCategory?.is_enabled,
              display_order: selectedCategory?.display_order,
              receiver_kyc_required: selectedCategory?.receiver_kyc_required || false,
              refund_after_hours: selectedCategory?.refund_after_hours || 0,
              settlement_time: selectedPaymentOption.settlement_time || selectedCategory?.settlement_time || '',
            },
            paymentOptionDetails: {
              gateway_name: selectedPaymentOption.gateway_name,
              card_type: selectedPaymentOption.card_type,
              charges_percentage: selectedPaymentOption.charges_percentage,
              discounted_charges_percentage: selectedPaymentOption.discounted_charges_percentage,
              show_discount: selectedPaymentOption.show_discount,
              gst_percentage: selectedPaymentOption.gst_percentage,
              business_surcharge_percentage: selectedPaymentOption.business_surcharge_percentage || 0,
              settlement_time: selectedPaymentOption.settlement_time || '',
              is_instant_settlement: selectedPaymentOption.is_instant_settlement,
              terms_and_conditions: selectedPaymentOption.terms_and_conditions,
              receiver_kyc_required: selectedPaymentOption.receiver_kyc_required || false,
            },
            payoutMode: selectedGateway?.payout_mode || 'payment_split',
            receiverKycRequired: selectedCategory?.receiver_kyc_required || false,
            refundAfterHours: selectedCategory?.refund_after_hours || 0,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.details
          ? `${result.error}: ${result.details}`
          : result.error || 'Failed to initiate payment';
        console.error('Payment initiation error:', result);
        throw new Error(errorMessage);
      }

      if (result.gatewayConfig) {
        gatewayOpened = true;
        setMessage({
          type: 'success',
          text: `Loading payment gateway...`,
        });

        sessionStorage.setItem('pendingPayment', JSON.stringify({
          paymentId: result.payment.id,
          reference: result.payment.reference,
          amount: result.payment.totalAmount,
          gatewayName: result.gatewayConfig.gateway,
        }));

        setTimeout(() => {
          openGatewayPayment(result.gatewayConfig, result.payment);
        }, 500);
      } else {
        setMessage({
          type: 'success',
          text: `Payment initiated successfully! Reference: ${result.payment.reference}`,
        });

        setTimeout(() => {
          navigate('/mobile/dashboard', { state: { userId, userEmail } });
        }, 3000);
      }
    } catch (error) {
      console.error('Error initiating payment:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to initiate payment',
      });
      setProcessing(false);
    } finally {
      // Only reset processing if the gateway was NOT opened.
      // When the gateway is open, processing stays true to keep the button disabled
      // until the payment result comes back (success/failure/dismiss).
      if (!gatewayOpened) {
        setProcessing(false);
      }
    }
  };

  const loadScript = (src: string, retries = 2): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve(true);
          return;
        }
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load SDK script from ${src}`)), { once: true });
        return;
      }

      let attempts = 0;
      const tryLoad = () => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
          script.dataset.loaded = 'true';
          resolve(true);
        };
        script.onerror = () => {
          script.remove();
          attempts++;
          if (attempts <= retries) {
            console.warn(`SDK load attempt ${attempts} failed for ${src}, retrying...`);
            setTimeout(tryLoad, 500 * attempts);
          } else {
            reject(new Error(`Failed to load SDK script from ${src} after ${retries + 1} attempts. Please check your internet connection and try again.`));
          }
        };
        document.body.appendChild(script);
      };
      tryLoad();
    });
  };

  const waitForSDKReady = async (checkFunction: () => boolean, sdkName: string, maxAttempts = 50): Promise<boolean> => {
    console.log(`Waiting for ${sdkName} SDK to be ready...`);
    for (let i = 0; i < maxAttempts; i++) {
      if (checkFunction()) {
        console.log(`${sdkName} SDK is ready!`);
        return true;
      }
      if (i % 10 === 0 && i > 0) {
        console.log(`Still waiting for ${sdkName} SDK... (attempt ${i}/${maxAttempts})`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.error(`${sdkName} SDK failed to initialize after ${maxAttempts} attempts`);
    return false;
  };

  const openGatewayPayment = async (gatewayConfig: any, paymentInfo: any) => {
    try {
      const gatewayName = gatewayConfig.gateway.toLowerCase();

      // Only load SDK for gateways that need it (CCAvenue uses form POST, no SDK)
      const needsSDK = !['ccavenue'].includes(gatewayName);
      if (needsSDK && gatewayConfig.sdkUrl) {
        await loadScript(gatewayConfig.sdkUrl);
      }

      let sdkReady = false;

      switch (gatewayName) {
        case 'razorpay':
          sdkReady = await waitForSDKReady(() => typeof (window as any).Razorpay !== 'undefined', 'Razorpay');
          if (!sdkReady) throw new Error('Razorpay SDK failed to initialize');
          openRazorpayCheckout(gatewayConfig, paymentInfo);
          break;
        case 'cashfree':
          // Cashfree JS SDK v3: window.Cashfree is a constructor function
          sdkReady = await waitForSDKReady(
            () => typeof (window as any).Cashfree === 'function',
            'Cashfree',
            100  // 100 × 100ms = 10 seconds
          );
          if (!sdkReady) throw new Error('Cashfree SDK failed to initialize');
          await openCashfreeCheckout(gatewayConfig, paymentInfo);
          break;
        case 'payu':
          sdkReady = await waitForSDKReady(() => typeof (window as any).bolt !== 'undefined', 'PayU Bolt');
          if (!sdkReady) throw new Error('PayU Bolt SDK failed to initialize');
          openPayUCheckout(gatewayConfig, paymentInfo);
          break;
        case 'ccavenue':
          openCCAvenueCheckout(gatewayConfig, paymentInfo);
          break;
        case 'easebuzz':
          sdkReady = await waitForSDKReady(() => typeof (window as any).EasebuzzCheckout !== 'undefined', 'Easebuzz');
          if (!sdkReady) throw new Error('Easebuzz SDK failed to initialize');
          openEasebuzzCheckout(gatewayConfig, paymentInfo);
          break;
        case 'zaakpay':
          sdkReady = await waitForSDKReady(() => typeof (window as any).ZaakPayCheckout !== 'undefined', 'ZaakPay');
          if (!sdkReady) throw new Error('ZaakPay SDK failed to initialize');
          openZaakPayCheckout(gatewayConfig, paymentInfo);
          break;
        case 'enkash':
          sdkReady = await waitForSDKReady(() => typeof (window as any).EnkashCheckout !== 'undefined', 'Enkash');
          if (!sdkReady) throw new Error('Enkash SDK failed to initialize');
          openEnkashCheckout(gatewayConfig, paymentInfo);
          break;
        default:
          throw new Error(`Gateway ${gatewayName} not supported`);
      }
    } catch (error) {
      console.error('Error opening payment gateway:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to open payment gateway',
      });
      setProcessing(false);
    }
  };

  const openRazorpayCheckout = (config: any, payment: any) => {
    try {
      const options = {
        ...config.options,
        handler: (response: any) => {
          handlePaymentSuccess(response, payment);
        },
        modal: {
          ondismiss: () => {
            handlePaymentDismiss();
          }
        }
      };
      const RazorpayClass = (window as any).Razorpay;
      const rzp = new RazorpayClass(options);
      rzp.open();
    } catch (error) {
      console.error('Razorpay checkout error:', error);
      throw error;
    }
  };

  const openCashfreeCheckout = async (config: any, payment: any) => {
    try {
      // Cashfree JS SDK v3: window.Cashfree is a constructor function
      const CashfreeSDK = (window as any).Cashfree;
      if (typeof CashfreeSDK !== 'function') {
        throw new Error('Cashfree SDK not loaded.');
      }

      const cashfree = CashfreeSDK({
        mode: config.environment === 'production' ? 'production' : 'sandbox',
      });

      const checkoutOptions = {
        paymentSessionId: config.options.paymentSessionId || config.options.orderToken,
        redirectTarget: '_modal',
      };

      setProcessing(true);

      cashfree.checkout(checkoutOptions).then((result: any) => {
        if (result && result.error) {
          handlePaymentFailure(result.error.message || 'Payment failed');
        } else if (result && result.paymentDetails) {
          handlePaymentSuccess(result.paymentDetails, payment);
        } else if (result && result.order && result.order.status === 'PAID') {
          handlePaymentSuccess(result.order, payment);
        } else {
          handlePaymentDismiss();
        }
      }).catch((error: any) => {
        handlePaymentFailure(error.message || 'Payment failed');
      });

    } catch (error: any) {
      console.error('Cashfree checkout error:', error);
      handlePaymentFailure(error.message || 'Payment initialization failed');
    }
  };

  const openPayUCheckout = (config: any, payment: any) => {
    try {
      console.log('Opening PayU Bolt checkout with config:', config);

      const payuOptions = {
        ...config.options,
        handler: {
          responseHandler: (response: any) => {
            console.log('PayU response:', response);
            if (response.response && response.response.txnStatus === 'SUCCESS') {
              handlePaymentSuccess(response, payment);
            } else {
              handlePaymentFailure(response);
            }
          },
          catchException: (error: any) => {
            console.error('PayU exception:', error);
            handlePaymentFailure(error);
          }
        }
      };

      console.log('Launching PayU Bolt with options:', payuOptions);
      (window as any).bolt.launch(payuOptions);
    } catch (error) {
      console.error('PayU checkout error:', error);
      throw error;
    }
  };

  const openCCAvenueCheckout = (config: any, _payment: any) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = config.sdkUrl;
    Object.keys(config.options).forEach(key => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = config.options[key];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  const openEasebuzzCheckout = (config: any, payment: any) => {
    try {
      const EasebuzzClass = (window as any).EasebuzzCheckout;
      const easebuzz = new EasebuzzClass(config.options.key, config.environment);
      easebuzz.initiatePayment(config.options, (response: any) => {
        if (response.status === 'success') {
          handlePaymentSuccess(response, payment);
        } else {
          handlePaymentFailure(response);
        }
      });
    } catch (error) {
      console.error('Easebuzz checkout error:', error);
      throw error;
    }
  };

  const openZaakPayCheckout = (config: any, payment: any) => {
    try {
      const ZaakPayClass = (window as any).ZaakPayCheckout;
      const checkout = new ZaakPayClass(config.options);
      checkout.open({
        onSuccess: (response: any) => handlePaymentSuccess(response, payment),
        onFailure: (response: any) => handlePaymentFailure(response),
        onDismiss: () => handlePaymentDismiss()
      });
    } catch (error) {
      console.error('ZaakPay checkout error:', error);
      throw error;
    }
  };

  const openEnkashCheckout = (config: any, payment: any) => {
    try {
      const EnkashCheckout = (window as any).EnkashCheckout;
      EnkashCheckout.open(config.options, {
        onSuccess: (response: any) => handlePaymentSuccess(response, payment),
        onFailure: (response: any) => handlePaymentFailure(response),
        onDismiss: () => handlePaymentDismiss()
      });
    } catch (error) {
      console.error('Enkash checkout error:', error);
      throw error;
    }
  };

  const saveTransactionStatus = async (
    reference: string,
    status: 'success' | 'failed' | 'pending' | 'cancelled',
    amount: string,
    gatewayResponse?: any,
    errorMessage?: string,
    paymentId?: string
  ) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-transaction-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            paymentId: paymentId || null,
            transactionReference: reference,
            status,
            amount,
            gatewayResponse: gatewayResponse || {},
            errorMessage: errorMessage || null,
            gatewayTransactionId: gatewayResponse?.razorpay_payment_id || gatewayResponse?.transactionId || gatewayResponse?.id || gatewayResponse?.cf_payment_id || gatewayResponse?.mihpayid || null,
            paymentMethod: 'card',
            cardType: selectedPaymentOption?.card_type || null,
            gatewayName: selectedPaymentOption?.gateway_name || null,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Failed to save transaction status:', result);
      }
    } catch (error) {
      console.error('Error saving transaction status:', error);
    }
  };

  const handlePaymentSuccess = async (response: any, payment: any) => {
    setMessage(null);
    // Stop any polling — we have a definitive result
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPendingPaymentId(null);

    const paymentData = {
      reference: payment.reference || 'N/A',
      status: 'success' as const,
      amount: payment.totalAmount || chargesDetails?.totalAmount || '0',
      message: 'Your payment has been processed successfully!',
      paymentId: payment.id,
      gatewayResponse: response,
    };

    setPaymentResult(paymentData);

    await saveTransactionStatus(
      paymentData.reference,
      paymentData.status,
      paymentData.amount,
      response,
      undefined,
      payment.id
    );

    sessionStorage.removeItem('pendingPayment');
    setProcessing(false);
    setCurrentStep(5);
  };

  const handlePaymentFailure = async (response: any) => {
    setMessage(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPendingPaymentId(null);

    // Get paymentId from session storage if available
    const pending = sessionStorage.getItem('pendingPayment');
    const pendingData = pending ? JSON.parse(pending) : null;
    const paymentId = pendingData?.paymentId;
    const reference = pendingData?.reference || response?.reference || 'N/A';

    const paymentData = {
      reference,
      status: 'failed' as const,
      amount: chargesDetails?.totalAmount || '0',
      message: response?.message || response?.error?.description || 'Payment processing failed. Please try again.',
      paymentId,
      gatewayResponse: response,
    };

    setPaymentResult(paymentData);

    await saveTransactionStatus(
      paymentData.reference,
      paymentData.status,
      paymentData.amount,
      response,
      paymentData.message,
      paymentId
    );

    sessionStorage.removeItem('pendingPayment');
    setProcessing(false);
    setCurrentStep(5);
  };

  const handlePaymentDismiss = async () => {
    setMessage(null);
    // Don't clear poll interval on dismiss — start polling to detect if user completed payment
    const pending = sessionStorage.getItem('pendingPayment');
    const pendingData = pending ? JSON.parse(pending) : null;

    if (pendingData?.paymentId) {
      setPendingPaymentId(pendingData.paymentId);
      setMessage({ type: 'error', text: 'Payment window closed. Checking payment status — please do not close this window.' });
      setProcessing(false);
      return;
    }

    const paymentData = {
      reference: 'N/A',
      status: 'cancelled' as const,
      amount: chargesDetails?.totalAmount || '0',
      message: 'Payment was cancelled by user.',
    };

    setPaymentResult(paymentData);

    await saveTransactionStatus(
      paymentData.reference,
      paymentData.status,
      paymentData.amount,
      {},
      paymentData.message
    );

    sessionStorage.removeItem('pendingPayment');
    setProcessing(false);
    setCurrentStep(5);
  };

  if (!userId) return null;

  // --- KYC checking screen ---
  if (isCheckingKyc) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  // --- KYC not verified screen ---
  if (kycStatus && !kycStatus.isVerified) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="px-4 py-6">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl border-2 border-yellow-300 p-6 text-center">
              <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-yellow-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">KYC Verification Required</h2>
              <p className="text-sm text-gray-700 mb-6 leading-relaxed">
                {kycStatus.status === 'not_submitted' &&
                  'Please complete your KYC verification to access payment features. You need to submit your PAN and Address details.'
                }
                {kycStatus.status === 'incomplete' &&
                  'Your KYC submission is incomplete. Please complete all required sections to proceed.'
                }
                {kycStatus.status === 'pending' &&
                  'Your KYC documents are under review. Please wait for admin approval before making payments.'
                }
                {kycStatus.status === 'rejected' &&
                  'Your KYC verification was rejected. Please review the feedback and resubmit your documents.'
                }
              </p>
              <button
                onClick={() => navigate('/mobile/kyc-verification', { state: { userId, userEmail } })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Go to KYC Verification
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // --- Restricted account screen ---
  if (kycStatus?.isRestricted) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="px-4 py-6">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl border-2 border-red-300 p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Account Restricted</h2>
              <p className="text-sm text-gray-700 mb-6 leading-relaxed">
                Your account has been restricted by our compliance team. You are unable to make payments at this time. Please raise a support ticket for assistance.
              </p>
              <button
                onClick={() => navigate('/mobile/help-support', { state: { userId, userEmail } })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Raise Support Ticket
              </button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // --- Loading initial data ---
  if (loading && currentStep === 1) {
    return (
      <MobileLayout
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        showBack={true}
        showBottomNav={false}
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  // --- Main payment flow ---
  return (
    <MobileLayout
      userId={userId}
      userEmail={userEmail}
      onLogout={handleLogout}
      showBack={true}
    >
      <div className="px-4 py-4 pb-40">
        <div className="max-w-md mx-auto">
          {/* Page title */}
          <h1 className="text-xl font-bold text-gray-900 mb-4">Make Payment</h1>

          {/* Compact step indicator */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                      currentStep >= step
                        ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step ? <CheckCircle className="w-4 h-4" /> : step}
                  </div>
                  {step < 4 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 rounded ${
                        currentStep > step ? 'bg-[#8c76f0]' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Message banner */}
          {message && (
            <div
              className={`mb-4 p-3 rounded-xl border flex items-start gap-2 ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-xs font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
                {message.text}
              </p>
            </div>
          )}

          {/* Main card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {/* Step 1: Select Beneficiary */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-[#8c76f0]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Select Beneficiary <span className="text-red-600">*</span></h2>
                    <p className="text-xs text-gray-600">Choose one beneficiary to send payment</p>
                  </div>
                </div>

                {beneficiaries.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-4">No active beneficiaries found</p>
                    <button
                      onClick={() => navigate('/mobile/my-beneficiaries', { state: { userId, userEmail } })}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Add Beneficiary
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {beneficiaries.map((beneficiary) => (
                      <div
                        key={beneficiary.id}
                        onClick={() => setSelectedBeneficiary(beneficiary)}
                        className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${
                          selectedBeneficiary?.id === beneficiary.id
                            ? 'border-[#8c76f0] bg-gradient-to-r from-purple-50 to-violet-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{beneficiary.full_name}</h3>
                            <p className="text-xs text-gray-600 truncate">{beneficiary.email}</p>
                          </div>
                          {selectedBeneficiary?.id === beneficiary.id && (
                            <CheckCircle className="w-4 h-4 text-[#8c76f0] flex-shrink-0 ml-2" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">A/C:</span> {beneficiary.bank_account}
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Bank:</span> {beneficiary.bank_name}
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">IFSC:</span> {beneficiary.ifsc}
                          </p>
                        </div>
                        {beneficiary.is_verified_merchant && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">
                              <CheckCircle className="w-3 h-3" />
                              Verified Merchant
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Payment Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-[#8c76f0]" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">Payment Details</h2>
                </div>

                <div>
                  <label htmlFor="amount" className="block text-xs font-medium text-gray-700 mb-1.5">
                    Amount to Pay <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₹</span>
                    <input
                      type="number"
                      id="amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min={paymentLimits?.min_amount || 0}
                      max={paymentLimits?.max_amount || 999999}
                      step="0.01"
                      className="w-full pl-8 pr-3 py-2 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-50 outline-none transition-all text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  {paymentLimits && (
                    <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg p-2.5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-amber-900 mb-1.5">Payment Limits</p>
                          <div className="flex gap-2">
                            <div className="flex-1 bg-white bg-opacity-70 rounded px-2 py-1.5">
                              <p className="text-[10px] text-gray-600">Min</p>
                              <p className="text-sm font-bold text-green-700">₹{paymentLimits.min_amount.toFixed(2)}</p>
                            </div>
                            <div className="flex-1 bg-white bg-opacity-70 rounded px-2 py-1.5">
                              <p className="text-[10px] text-gray-600">Max</p>
                              <p className="text-sm font-bold text-red-700">₹{paymentLimits.max_amount.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="category" className="block text-xs font-medium text-gray-700 mb-1.5">
                    Payment Category <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="category"
                    value={selectedCategory?.id || ''}
                    onChange={(e) => {
                      const categoryId = e.target.value;
                      const category = paymentCategories.find(c => c.id === categoryId);
                      if (category) {
                        setSelectedCategory(category);
                      }
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-50 outline-none transition-all text-sm"
                  >
                    <option value="">Select a category</option>
                    {paymentCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                  {selectedCategory && (selectedCategory.receiver_kyc_required || selectedCategory.new_card_payment_delay_hours > 0) && (
                    <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <ul className="text-[11px] text-amber-800 leading-relaxed space-y-1 list-disc list-inside">
                        {selectedCategory.receiver_kyc_required && (
                          <li>As per RBI guidelines, receiver KYC is required to complete payment settlement, if not already completed.</li>
                        )}
                        {selectedCategory.new_card_payment_delay_hours > 0 && (
                          <li>As per RBI guidelines, payments made using a new credit card will be settled after {selectedCategory.new_card_payment_delay_hours} hours.</li>
                        )}
                        {selectedCategory.receiver_kyc_required && selectedCategory.refund_after_hours > 0 && (
                          <li>As per RBI guidelines, if the receiver does not complete KYC within {selectedCategory.refund_after_hours} hours, the payment will be refunded to the card after deducting convenience charges.</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Upload Bill (Optional)
                  </label>
                  <p className="text-[11px] text-gray-500 mb-1.5">PNG, JPEG, or PDF. Max 1 MB</p>

                  {!billFile ? (
                    <label className="block">
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#8c76f0] transition-colors">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-600">Tap to upload</p>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                    </label>
                  ) : (
                    <div className="border-2 border-gray-300 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-6 h-6 text-[#8c76f0] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{billFile.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {(billFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={removeFile}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Payment Option */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-[#8c76f0]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Payment Option <span className="text-red-600">*</span></h2>
                    <p className="text-xs text-gray-600">Select one payment method</p>
                  </div>
                </div>

                {paymentOptions.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">No payment options available</p>
                    <p className="text-xs text-gray-500 mt-1">Please contact administrator to configure payment gateways</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentOptions.map((option) => {
                        const baseAmount = parseFloat(amount) || 0;
                        const isBusiness = selectedBeneficiary?.account_type === 'Current';
                        const useDiscountedCharges = option.show_discount;

                        const normalChargePercentage = option.charges_percentage;
                        const discountedChargePercentage = option.discounted_charges_percentage;
                        const baseChargePercentage = useDiscountedCharges ? discountedChargePercentage : normalChargePercentage;
                        const surchargePercentage = isBusiness ? (option.business_surcharge_percentage || 0) : 0;
                        const effectiveChargePercentage = baseChargePercentage + surchargePercentage;

                        const normalCharges = (baseAmount * normalChargePercentage) / 100;
                        const effectiveCharges = (baseAmount * effectiveChargePercentage) / 100;
                        const gst = (effectiveCharges * option.gst_percentage) / 100;
                        const total = baseAmount + effectiveCharges + gst;
                        const chargesLabel = surchargePercentage > 0 ? 'Charges & Surcharge' : 'Charges';

                        return (
                          <div
                            key={option.id}
                            onClick={() => setSelectedPaymentOption(option)}
                            className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${
                              selectedPaymentOption?.id === option.id
                                ? 'border-[#8c76f0] bg-gradient-to-r from-purple-50 to-violet-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-gray-900 text-sm">{option.card_type}</h3>
                                  {useDiscountedCharges && (
                                    <span className="px-1.5 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-[10px] font-bold rounded">
                                      Discounted
                                    </span>
                                  )}
                                  {surchargePercentage > 0 && (
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                                      Business
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mb-0.5">{option.gateway_name}</p>
                                {option.settlement_time && (
                                  <p className="text-[11px] text-gray-500 mb-2">
                                    Settlement:{' '}
                                    <span className="font-medium text-gray-700">
                                      {formatSettlementTime(option.settlement_time)}
                                    </span>
                                  </p>
                                )}

                                <div className="bg-white bg-opacity-60 rounded-lg p-2 space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">Amount</span>
                                    <span className="font-medium text-gray-900">₹{baseAmount.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">
                                      {chargesLabel}{' '}
                                      {useDiscountedCharges && (
                                        <span className="line-through text-gray-400">
                                          ({normalChargePercentage.toFixed(2)}%)
                                        </span>
                                      )}
                                      {useDiscountedCharges ? (
                                        <span className="text-green-600 ml-0.5">
                                          ({discountedChargePercentage.toFixed(2)}%{surchargePercentage > 0 ? ` + ${surchargePercentage.toFixed(2)}%` : ''})
                                        </span>
                                      ) : (
                                        <span>({effectiveChargePercentage.toFixed(2)}%)</span>
                                      )}
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      {useDiscountedCharges && (
                                        <span className="line-through text-gray-400 mr-1">
                                          ₹{normalCharges.toFixed(2)}
                                        </span>
                                      )}
                                      <span className={useDiscountedCharges ? 'text-green-600' : ''}>
                                        ₹{effectiveCharges.toFixed(2)}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">GST ({option.gst_percentage.toFixed(2)}%)</span>
                                    <span className="font-medium text-gray-900">₹{gst.toFixed(2)}</span>
                                  </div>
                                  <div className="border-t border-gray-200 pt-1 flex justify-between">
                                    <span className="text-xs font-semibold text-gray-900">Total</span>
                                    <span className="text-sm font-bold text-[#8c76f0]">₹{total.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                              {selectedPaymentOption?.id === option.id && (
                                <CheckCircle className="w-5 h-5 text-[#8c76f0] ml-2 flex-shrink-0" />
                              )}
                            </div>

                            {option.terms_and_conditions && (
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <h4 className="text-[11px] font-semibold text-gray-900 mb-1">Terms & Conditions</h4>
                                <div className="text-[11px] text-gray-600 leading-relaxed space-y-0.5">
                                  {option.terms_and_conditions.split('\n').map((line, i) => (
                                    <p key={i}>{line}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review & Pay */}
            {currentStep === 4 && chargesDetails && selectedBeneficiary && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-[#8c76f0]" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">Payment Summary</h2>
                </div>

                <div className="space-y-4">
                  {/* Beneficiary Details */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900 mb-2">Beneficiary Details</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Name</span>
                        <span className="text-xs font-medium text-gray-900 text-right">{selectedBeneficiary.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Email</span>
                        <span className="text-xs font-medium text-gray-900 text-right truncate ml-2">{selectedBeneficiary.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Mobile</span>
                        <span className="text-xs font-medium text-gray-900">{selectedBeneficiary.mobile}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">PAN</span>
                        <span className="text-xs font-medium text-gray-900">{selectedBeneficiary.pan_number || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900 mb-2">Bank Details</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Bank</span>
                        <span className="text-xs font-medium text-gray-900 text-right">{selectedBeneficiary.bank_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Branch</span>
                        <span className="text-xs font-medium text-gray-900 text-right">{selectedBeneficiary.branch_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">A/C No.</span>
                        <span className="text-xs font-medium text-gray-900">{selectedBeneficiary.bank_account}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">IFSC</span>
                        <span className="text-xs font-medium text-gray-900">{selectedBeneficiary.ifsc}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Type</span>
                        <span className="text-xs font-medium text-gray-900">{selectedBeneficiary.account_type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900 mb-2">Payment Information</h3>
                    <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-700">Category</span>
                        <span className="text-xs font-semibold text-gray-900 text-right">{selectedCategory?.category_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-700">Option</span>
                        <span className="text-xs font-semibold text-gray-900">{selectedPaymentOption?.card_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-700">Amount</span>
                        <span className="text-xs font-semibold text-gray-900">₹{chargesDetails.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-700">
                          {chargesDetails.surchargePercentage > 0 ? 'Charges & Surcharge' : 'Platform Charges'}
                          <span className="ml-0.5 text-gray-500 text-[10px]">
                            ({chargesDetails.effectiveChargesPercentage?.toFixed(2)}%)
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-gray-900">₹{chargesDetails.charges}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-700">GST ({chargesDetails.category.gstPercentage}%)</span>
                        <span className="text-xs font-semibold text-gray-900">₹{chargesDetails.gst}</span>
                      </div>
                      {chargesDetails.discountApplied && parseFloat(chargesDetails.discount) > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span className="text-xs">Discount</span>
                          <span className="text-xs font-semibold">-₹{chargesDetails.discount}</span>
                        </div>
                      )}
                      <div className="border-t-2 border-[#8c76f0] pt-1.5 flex justify-between">
                        <span className="text-sm font-bold text-gray-900">Total</span>
                        <span className="text-lg font-bold text-[#8c76f0]">₹{chargesDetails.totalAmount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Gateway Details */}
                  {selectedGateway && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900 mb-2">Payment Gateway</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-600">Gateway</span>
                          <span className="text-xs font-medium text-gray-900">{chargesDetails.gateway.name}</span>
                        </div>
                        {(selectedPaymentOption?.settlement_time || selectedCategory?.settlement_time) && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600">Settlement</span>
                            <span className="text-xs font-medium text-gray-900 text-right">
                              {formatSettlementTime(selectedPaymentOption?.settlement_time || selectedCategory?.settlement_time || '')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Attached Bill */}
                  {billFile && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900 mb-2">Attached Bill</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-[#8c76f0] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{billFile.name}</p>
                          <p className="text-[11px] text-gray-500">{(billFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Receiver KYC Required warning */}
                  {selectedCategory?.receiver_kyc_required && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-900">Receiver KYC Required</p>
                          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                            A verification link will be sent to the receiver after payment. Settlement will be completed once the receiver verifies their identity.
                            {selectedCategory.refund_after_hours > 0 && (
                              <span className="block mt-0.5">
                                If KYC is not completed within {selectedCategory.refund_after_hours} hours, the payment will be refunded after deducting convenience charges.
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ready to Process */}
                  <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#8c76f0] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">Ready to Process</p>
                        <p className="text-xs text-gray-700 mt-0.5">
                          Please review all details carefully before proceeding.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Result */}
            {currentStep === 5 && paymentResult && (() => {
              const isSuccess = paymentResult.status === 'success';
              const isFailed = paymentResult.status === 'failed';
              const isKycPending = isSuccess &&
                selectedCategory?.receiver_kyc_required === true &&
                selectedBeneficiary?.is_verified_merchant !== true;
              const displayStatusLabel = isSuccess
                ? (isKycPending ? 'Payment Received – KYC Pending' : 'Settlement In Progress')
                : 'Transaction Failed';
              const displayStatusNote = isSuccess
                ? (isKycPending
                    ? 'Your payment was received successfully. Payout to the beneficiary will be processed after Merchant KYC / Onboarding is completed by the receiver.'
                    : 'Payment gateway transaction was successful. Your payment is now being settled to the beneficiary.')
                : paymentResult.message;
              return (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSuccess
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50'
                      : 'bg-gradient-to-r from-red-50 to-rose-50'
                  }`}>
                    {isSuccess ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">Transaction Status</h2>
                </div>

                <div className={`rounded-xl p-5 border-2 ${
                  isSuccess
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500'
                    : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-500'
                }`}>
                  {/* Large success/failure icon */}
                  <div className="flex items-center justify-center mb-4">
                    {isSuccess ? (
                      <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-white" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-white" />
                      </div>
                    )}
                  </div>

                  <h3 className={`text-lg font-bold text-center mb-2 ${
                    isSuccess ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {displayStatusLabel}
                  </h3>

                  <p className="text-center text-xs text-gray-700 mb-5 leading-relaxed">
                    {displayStatusNote}
                  </p>

                  <div className="space-y-3">
                    <div className="bg-white bg-opacity-60 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-gray-600">Reference</span>
                        <span className="text-xs font-bold text-gray-900">{paymentResult.reference}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-gray-600">Amount</span>
                        <span className="text-xs font-bold text-gray-900">₹{paymentResult.amount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Status</span>
                        <span className={`text-xs font-bold ${
                          isSuccess ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {displayStatusLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSuccess && isKycPending && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                      <p className="text-xs font-semibold text-amber-800 mb-0.5">Awaiting Receiver KYC</p>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        The receiver has been notified via email and SMS to complete their Merchant KYC verification.
                        Once verified, the payout will be processed automatically.
                        {selectedCategory?.refund_after_hours ? ` If KYC is not completed within ${selectedCategory.refund_after_hours} hours, the payment will be refunded.` : ''}
                      </p>
                    </div>
                  )}
                  {isSuccess && !isKycPending && (
                    <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        <strong>Note:</strong> Save your transaction reference for future reference.
                        Track settlement under <strong>My Transactions</strong>.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/mobile/dashboard', { state: { userId, userEmail } })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Dashboard
                  </button>
                  {isSuccess && (
                    <button
                      onClick={() => navigate('/mobile/my-transactions', { state: { userId, userEmail } })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 border-2 border-[#8c76f0] text-[#8c76f0] rounded-xl text-sm font-medium hover:bg-purple-50 transition-colors"
                    >
                      Transactions
                    </button>
                  )}
                  {isFailed && (
                    <button
                      onClick={() => {
                        setCurrentStep(1);
                        setPaymentResult(null);
                        setSelectedBeneficiary(null);
                        setSelectedCategory(null);
                        setSelectedPaymentOption(null);
                        setAmount('');
                        setBillFile(null);
                        setBillFileUrl('');
                        setChargesDetails(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 border-2 border-[#8c76f0] text-[#8c76f0] rounded-xl text-sm font-medium hover:bg-purple-50 transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Sticky bottom navigation bar */}
      {currentStep !== 5 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-40">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <button
                onClick={handleBack}
                disabled={processing}
                className="flex items-center gap-1.5 px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 && (
              <button
                onClick={handleNext}
                disabled={loading || (currentStep === 1 && beneficiaries.length === 0)}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
            {currentStep === 4 && (
              <button
                onClick={handleMakePayment}
                disabled={processing}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initiating...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pay Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </MobileLayout>
  );
}

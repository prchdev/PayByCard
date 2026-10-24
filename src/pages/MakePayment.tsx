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
  Ticket,
} from 'lucide-react';
import DashboardNavigation from '../components/DashboardNavigation';
import DashboardSidebar from '../components/DashboardSidebar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';


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
  invoice_required: boolean;
  invoice_frequency_months: number;
  invoice_min_amount: number;
  max_payment_per_beneficiary: number;
  available_to_retail?: boolean;
  available_to_business?: boolean;
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
  razorpay_config?: {
    methods: string[];
    allowed_card_networks: string[];
    card_types: string[];
    card_sub_types: string[];
  } | null;
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

export default function MakePayment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, userEmail } = location.state || {};
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billFileUrl, setBillFileUrl] = useState<string>('');
  const [monthlyLimitExceeded, setMonthlyLimitExceeded] = useState(false);
  const [monthlyLimitInfo, setMonthlyLimitInfo] = useState<{ max: number; total: number } | null>(null);
  const [checkingMonthlyLimit, setCheckingMonthlyLimit] = useState(false);
  const [invoiceCheck, setInvoiceCheck] = useState<{
    invoiceRequired: boolean;
    hasConfirmedInvoice: boolean;
    canUsePreviousInvoice: boolean;
    needsInvoiceUpload: boolean;
    lastConfirmedAt?: string;
  } | null>(null);
  const [checkingInvoice, setCheckingInvoice] = useState(false);
  const [billRequired, setBillRequired] = useState(false);
  const [checkingBillRequired, setCheckingBillRequired] = useState(false);
  // Check if bill is required whenever amount, category, or beneficiary changes
  useEffect(() => {
    const checkRequirement = async () => {
      if (!selectedCategory || !selectedBeneficiary || !amount) {
        setBillRequired(false);
        return;
      }
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setBillRequired(false);
        return;
      }
      setCheckingBillRequired(true);
      const required = await checkBillRequired(selectedCategory.id, selectedBeneficiary.id, amountValue);
      setBillRequired(required);
      setCheckingBillRequired(false);
    };
    checkRequirement();
  }, [selectedCategory, selectedBeneficiary, amount]);

  // Check monthly beneficiary limit whenever category or beneficiary changes
  useEffect(() => {
    const checkLimit = async () => {
      if (!selectedCategory || !selectedBeneficiary) {
        setMonthlyLimitExceeded(false);
        setMonthlyLimitInfo(null);
        return;
      }
      if (!selectedCategory.max_payment_per_beneficiary || selectedCategory.max_payment_per_beneficiary <= 0) {
        setMonthlyLimitExceeded(false);
        setMonthlyLimitInfo(null);
        return;
      }
      setCheckingMonthlyLimit(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-beneficiary-monthly-limit`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              beneficiaryId: selectedBeneficiary.id,
              categoryId: selectedCategory.id,
            }),
          }
        );
        const result = await response.json();
        if (response.ok) {
          setMonthlyLimitExceeded(result.limitExceeded);
          setMonthlyLimitInfo({
            max: result.maxPerBeneficiary,
            total: result.totalThisMonth,
          });
        }
      } catch (err) {
        console.error('Error checking monthly limit:', err);
      } finally {
        setCheckingMonthlyLimit(false);
      }
    };
    checkLimit();
  }, [selectedCategory, selectedBeneficiary, userId]);

  // Check invoice verification status whenever category or beneficiary changes
  useEffect(() => {
    const checkInvoice = async () => {
      if (!selectedCategory || !selectedBeneficiary) {
        setInvoiceCheck(null);
        return;
      }
      setCheckingInvoice(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-invoice-verification`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              beneficiaryId: selectedBeneficiary.id,
              categoryId: selectedCategory.id,
              amount: parseFloat(amount) || 0,
            }),
          }
        );
        const result = await response.json();
        if (response.ok) {
          setInvoiceCheck(result);
        }
      } catch (err) {
        console.error('Error checking invoice verification:', err);
      } finally {
        setCheckingInvoice(false);
      }
    };
    checkInvoice();
  }, [selectedCategory, selectedBeneficiary, userId, amount]);
  const [chargesDetails, setChargesDetails] = useState<ChargesDetails | null>(null);
  const [processing, setProcessing] = useState(false);
  const [kycStatus, setKycStatus] = useState<{ isVerified: boolean; status: string; isRestricted?: boolean; businessCategorySurgeCharge?: number } | null>(null);
  const [isCheckingKyc, setIsCheckingKyc] = useState(true);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef<number>(0);
  const [paymentResult, setPaymentResult] = useState<{
    reference: string;
    status: 'success' | 'failed' | 'pending';
    amount: string;
    message: string;
    paymentId?: string;
    gatewayResponse?: any;
  } | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    couponId: string;
    couponCode: string;
    discountAmount: number;
    newTotal: number;
  } | null>(null);
  const [couponStatus, setCouponStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [validatingCoupon, setValidatingCoupon] = useState(false);


  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
    } else {
      checkKycStatus();
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (currentStep === 3 && selectedPaymentOption?.gateway_name?.toLowerCase() === 'razorpay') {
      const src = 'https://checkout.razorpay.com/v1/checkout.js';
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.body.appendChild(script);
      }
    }
  }, [currentStep, selectedPaymentOption]);

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
    const amount = pendingData?.amount ?? chargesDetails?.totalAmount ?? '0';

    await saveTransactionStatus(reference, 'cancelled', amount, {}, 'Payment status could not be confirmed. Please contact support.', paymentId);

    setPaymentResult({
      reference,
      status: 'failed',
      amount,
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
      console.log('Payment limits response:', result);

      if (response.ok && result.minimum_amount && result.maximum_amount) {
        setPaymentLimits({
          min_amount: result.minimum_amount,
          max_amount: result.maximum_amount
        });
        console.log('Payment limits set:', {
          min: result.minimum_amount,
          max: result.maximum_amount
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
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
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

  const checkBillRequired = async (
    categoryId: string,
    beneficiaryId: string,
    amountValue: number,
  ): Promise<boolean> => {
    const category = paymentCategories.find((c) => c.id === categoryId);
    if (!category || !category.invoice_required) return false;

    // If amount is less than minimum amount, bill is optional
    if (category.invoice_min_amount > 0 && amountValue < category.invoice_min_amount) {
      return false;
    }

    // If frequency is 0, bill is required for every payment
    if (category.invoice_frequency_months === 0) {
      return true;
    }

    // Check if a bill was submitted for this beneficiary + category within the frequency period
    try {
      const frequencyMs = category.invoice_frequency_months * 30 * 24 * 60 * 60 * 1000;
      const sinceDate = new Date(Date.now() - frequencyMs).toISOString();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-transactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, status: 'all', page: 1, limit: 100 }),
        },
      );
      const result = await response.json();
      if (response.ok && result.payments) {
        const recentWithBill = result.payments.some((tx: any) => {
          const txBeneficiaryId = tx.beneficiary_details?.id || tx.beneficiary_id;
          const txCategoryId = tx.category_details?.id || tx.business_category_id;
          return (
            txBeneficiaryId === beneficiaryId &&
            txCategoryId === categoryId &&
            tx.bill_file_url &&
            new Date(tx.created_at) >= new Date(sinceDate)
          );
        });
        // If a bill was submitted within the frequency period, bill is NOT required now
        return !recentWithBill;
      }
    } catch (err) {
      console.error('Error checking previous bill submissions:', err);
    }

    // Default to required if we can't check
    return true;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    const maxSize = 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setFieldErrors(prev => ({ ...prev, billFile: 'Only PNG, JPEG, and PDF files are allowed' }));
      return;
    }

    if (file.size > maxSize) {
      setFieldErrors(prev => ({ ...prev, billFile: 'File size must be less than 1 MB' }));
      return;
    }

    setBillFile(file);
    setFieldErrors(prev => { const next = { ...prev }; delete next.billFile; return next; });
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-payment-option-charges`,
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
            businessCategorySurgeCharge: kycStatus?.businessCategorySurgeCharge || 0,
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
    } catch (error) {
      console.error('Error calculating charges:', error);
      setMessage({ type: 'error', text: 'Failed to calculate charges' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    setMessage(null);
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (currentStep === 1) {
      if (!selectedBeneficiary) {
        setFieldErrors({ beneficiary: 'Please select a beneficiary' });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const errors: Record<string, string> = {};
      if (!amount) errors.amount = 'Please enter an amount';
      if (!selectedCategory) errors.category = 'Please select a payment category';

      if (billRequired && !billFile) {
        errors.billFile = 'Please upload a bill/invoice for this payment';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setFieldErrors({ amount: 'Please enter a valid amount' });
        return;
      }

      if (paymentLimits) {
        if (amountValue < paymentLimits.min_amount) {
          setFieldErrors({ amount: `Amount must be at least ₹${paymentLimits.min_amount.toFixed(2)}` });
          return;
        }
        if (amountValue > paymentLimits.max_amount) {
          setFieldErrors({ amount: `Amount cannot exceed ₹${paymentLimits.max_amount.toFixed(2)}` });
          return;
        }
      }

      if (monthlyLimitExceeded) {
        setMessage({
          type: 'error',
          text: `The maximum permitted payment of ₹${monthlyLimitInfo?.max.toLocaleString('en-IN', { minimumFractionDigits: 2 })} per beneficiary per month for "${selectedCategory.category_name}" has already been reached for ${selectedBeneficiary?.full_name || 'this beneficiary'} this month. You cannot make another payment to this beneficiary in this category until next month.`,
        });
        return;
      }

      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!selectedPaymentOption) {
        setFieldErrors({ paymentOption: 'Please select a payment option' });
        return;
      }

      const baseAmount = parseFloat(amount) || 0;
      const isBusiness = selectedBeneficiary?.account_type === 'Current';
      const useDiscountedCharges = selectedPaymentOption.show_discount;
      const baseChargePercentage = useDiscountedCharges
        ? selectedPaymentOption.discounted_charges_percentage
        : selectedPaymentOption.charges_percentage;
      const surchargePercentage = selectedPaymentOption.business_surcharge_percentage || 0;
      const surgeChargePercentage = kycStatus?.businessCategorySurgeCharge || 0;
      const effectiveChargesPercentage = baseChargePercentage + surchargePercentage + surgeChargePercentage;

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

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponStatus({ type: 'error', message: 'Please enter a coupon code' });
      return;
    }
    if (!chargesDetails?.totalAmount) {
      setCouponStatus({ type: 'error', message: 'Calculate charges first' });
      return;
    }

    setValidatingCoupon(true);
    setCouponStatus({ type: null, message: '' });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-coupon`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            couponCode: couponInput.trim(),
            totalAmount: parseFloat(chargesDetails.totalAmount),
          }),
        }
      );
      const data = await response.json();

      if (data.valid) {
        setAppliedCoupon({
          couponId: data.couponId,
          couponCode: data.couponCode,
          discountAmount: data.discountAmount,
          newTotal: data.newTotal,
        });
        setCouponStatus({ type: 'success', message: `Coupon applied! You save ₹${data.discountAmount.toFixed(2)}` });
      } else {
        setAppliedCoupon(null);
        setCouponStatus({ type: 'error', message: data.error || 'Invalid coupon' });
      }
    } catch {
      setCouponStatus({ type: 'error', message: 'Failed to validate coupon. Please try again.' });
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInput('');
    setAppliedCoupon(null);
    setCouponStatus({ type: null, message: '' });
  };

  const handleMakePayment = async () => {
    setProcessing(true);
    setMessage(null);
    let gatewayOpened = false;

    try {
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

      let uploadedBillFileUrl: string | null = null;
      if (billFile) {
        uploadedBillFileUrl = `uploads/${userId}/${Date.now()}_${billFile.name}`;
        setBillFileUrl(uploadedBillFileUrl);
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
            paymentOptionId: selectedPaymentOption.id,
            gatewayId: selectedPaymentOption.gateway_id,
            cardType: selectedPaymentOption.card_type,
            amount: chargesDetails?.amount,
            charges: chargesDetails?.charges,
            gst: chargesDetails?.gst,
            discount: chargesDetails?.discount,
            totalAmount: chargesDetails?.totalAmount,
            billFileUrl: uploadedBillFileUrl,
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
              category_name: selectedPaymentOption.category_name,
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
            couponId: appliedCoupon?.couponId || null,
            couponCode: appliedCoupon?.couponCode || null,
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

        openGatewayPayment(result.gatewayConfig, result.payment);
      } else {
        setMessage({
          type: 'success',
          text: `Payment initiated successfully! Reference: ${result.payment.reference}`,
        });

        setTimeout(() => {
          navigate('/dashboard', { state: { userId, userEmail } });
        }, 3000);
      }
    } catch (error) {
      console.error('Error initiating payment:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to initiate payment';
      const displayMsg = errMsg === 'Failed to fetch'
        ? 'Unable to connect to the payment server. Please check your internet connection and try again.'
        : errMsg;
      setMessage({
        type: 'error',
        text: displayMsg,
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

  const loadScript = (src: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      // PCI DSS 6.4.3 — validate SDK URL against allowlist of known gateway domains
      const ALLOWED_SDK_DOMAINS = [
        'checkout.razorpay.com',
        'sdk.cashfree.com',
        'jssdk.cashfree.com',
        'js.cashfree.com',
        'checkout-static.cashfree.com',
        'easebuzz.in',
        'payu.in',
        'zaakpay.com',
        'api.enkash.com',
        'cdn.enkash.com',
      ];
      try {
        const parsed = new URL(src);
        const isAllowed = ALLOWED_SDK_DOMAINS.some(
          d => parsed.hostname === d || parsed.hostname.endsWith('.' + d)
        );
        if (!isAllowed) {
          reject(new Error(`Blocked script from unverified domain: ${parsed.hostname}`));
          return;
        }
      } catch {
        reject(new Error(`Invalid SDK URL: ${src}`));
        return;
      }
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Failed to load SDK script from ${src}`));
      document.body.appendChild(script);
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
        case 'phonepe':
          await openPhonePeCheckout(gatewayConfig, paymentInfo);
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

  const openCCAvenueCheckout = (config: any, payment: any) => {
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

  const openPhonePeCheckout = async (config: any, payment: any) => {
    try {
      setProcessing(true);
      // PhonePe uses redirect-based checkout — redirect to the checkout URL
      // returned by the initiate-payment edge function.
      const checkoutUrl = config.options?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error('PhonePe checkout URL not available');
      }
      // Validate the checkout URL belongs to PhonePe's domain to prevent open redirect
      try {
        const parsed = new URL(checkoutUrl);
        const allowedHosts = ['api.phonepe.com', 'api-preprod.phonepe.com', 'phonepe.com', 'phonepe.merchant.sdk'];
        if (!allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
          throw new Error('Invalid checkout URL');
        }
      } catch {
        throw new Error('Invalid checkout URL');
      }
      window.location.href = checkoutUrl;
    } catch (error: any) {
      console.error('PhonePe checkout error:', error);
      handlePaymentFailure(error.message || 'PhonePe checkout failed');
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

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!userId) return null;

  if (isCheckingKyc) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavigation
          userEmail={userEmail}
          userId={userId}
          onLogout={handleLogout}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </div>
    );
  }

  if (kycStatus && !kycStatus.isVerified) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavigation
          userEmail={userEmail}
          userId={userId}
          onLogout={handleLogout}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <div className="flex max-w-7xl mx-auto">
          <DashboardSidebar
            userId={userId}
            userEmail={userEmail}
            currentPage="make-payment"
            isMobileMenuOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            onLogout={handleLogout}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border-2 border-yellow-300 p-8 text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">KYC Verification Required</h2>
                <p className="text-gray-700 mb-6">
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
                  onClick={() => navigate('/kyc-verification', { state: { userId, userEmail } })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  Go to KYC Verification
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </main>
        </div>

        <Footer />
      </div>
    );
  }

  if (kycStatus?.isRestricted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavigation
          userEmail={userEmail}
          userId={userId}
          onLogout={handleLogout}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <div className="flex max-w-7xl mx-auto">
          <DashboardSidebar
            userId={userId}
            userEmail={userEmail}
            currentPage="make-payment"
            isMobileMenuOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            onLogout={handleLogout}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border-2 border-red-300 p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Account Restricted</h2>
                <p className="text-gray-700 mb-6">
                  Your account has been restricted by our compliance team. You are unable to make payments at this time. Please raise a support ticket for assistance.
                </p>
                <button
                  onClick={() => navigate('/help-support', { state: { userId, userEmail } })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  Raise Support Ticket
                </button>
              </div>
            </div>
          </main>
        </div>

        <Footer />
      </div>
    );
  }

  if (loading && currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavigation
          userEmail={userEmail}
          userId={userId}
          onLogout={handleLogout}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[#8c76f0] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavigation
        userEmail={userEmail}
        userId={userId}
        onLogout={handleLogout}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex max-w-7xl mx-auto">
        <DashboardSidebar
          userId={userId}
          userEmail={userEmail}
          currentPage="make-payment"
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Make Payment</h1>
              <p className="text-gray-600 mt-1">Complete the payment in simple steps</p>
            </div>

            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex items-center">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
                          currentStep >= step
                            ? 'bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {currentStep > step ? <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" /> : step}
                      </div>
                      <div className="ml-2 sm:ml-3 hidden sm:block">
                        <p className={`text-sm font-medium ${currentStep >= step ? 'text-[#8c76f0]' : 'text-gray-500'}`}>
                          Step {step}
                        </p>
                        <p className="text-xs text-gray-500">
                          {step === 1 && 'Select Beneficiary'}
                          {step === 2 && 'Payment Details'}
                          {step === 3 && 'Payment Option'}
                          {step === 4 && 'Review & Pay'}
                        </p>
                      </div>
                    </div>
                    {step < 4 && (
                      <div
                        className={`flex-1 h-1 mx-2 sm:mx-4 rounded ${
                          currentStep > step ? 'bg-[#8c76f0]' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {message && (
              <div
                className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-50 border-green-300'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
                  {message.text}
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl border-2 border-gray-300 p-4 sm:p-6">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Select Beneficiary <span className="text-red-600">*</span></h2>
                      <p className="text-sm text-gray-600">Choose one beneficiary to send payment</p>
                    </div>
                  </div>

                  {fieldErrors.beneficiary && (
                    <p className="text-sm text-red-600 font-medium mt-2">{fieldErrors.beneficiary}</p>
                  )}
                  {beneficiaries.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">No active beneficiaries found</p>
                      <button
                        onClick={() => navigate('/my-beneficiaries', { state: { userId, userEmail } })}
                        className="px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                      >
                        Add Beneficiary
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {beneficiaries.map((beneficiary) => (
                        <div
                          key={beneficiary.id}
                          onClick={() => setSelectedBeneficiary(beneficiary)}
                          className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                            selectedBeneficiary?.id === beneficiary.id
                              ? 'border-[#8c76f0] bg-gradient-to-r from-purple-50 to-violet-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-gray-900">{beneficiary.full_name}</h3>
                              <p className="text-sm text-gray-600">{beneficiary.email}</p>
                            </div>
                            {selectedBeneficiary?.id === beneficiary.id && (
                              <CheckCircle className="w-5 h-5 text-[#8c76f0]" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Account:</span> {beneficiary.bank_account}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Bank:</span> {beneficiary.bank_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">IFSC:</span> {beneficiary.ifsc}
                            </p>
                          </div>
                          <div className="mt-3">
                            {beneficiary.is_verified_merchant && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Verified Merchant
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
                  </div>

                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                      Amount to Pay <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                      <input
                        type="number"
                        id="amount"
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.amount; delete n.billFile; return n; }); }}
                        min={paymentLimits?.min_amount || 0}
                        max={paymentLimits?.max_amount || 999999}
                        step="0.01"
                        className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-xl focus:ring-4 focus:ring-purple-50 outline-none transition-all ${fieldErrors.amount ? 'border-red-500' : 'border-gray-300 focus:border-[#8c76f0]'}`}
                        placeholder="0.00"
                      />
                    </div>
                    {fieldErrors.amount && (
                      <p className="text-sm text-red-600 font-medium mt-1">{fieldErrors.amount}</p>
                    )}
                    {paymentLimits && (
                      <div className="mt-2 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-400 rounded-lg p-3.5 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-amber-900 mb-2">Payment Amount Limits</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white bg-opacity-70 rounded-lg p-2.5">
                                <p className="text-xs text-gray-600 mb-1">Minimum Amount</p>
                                <p className="text-lg font-bold text-green-700">₹{paymentLimits.min_amount.toFixed(2)}</p>
                              </div>
                              <div className="bg-white bg-opacity-70 rounded-lg p-2.5">
                                <p className="text-xs text-gray-600 mb-1">Maximum Amount</p>
                                <p className="text-lg font-bold text-red-700">₹{paymentLimits.max_amount.toFixed(2)}</p>
                              </div>
                            </div>
                            <p className="text-xs text-amber-800 mt-2 font-medium">
                              Please enter an amount between the minimum and maximum limits
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
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
                          setFieldErrors(prev => { const n = {...prev}; delete n.category; delete n.billFile; return n; });
                        }
                      }}
                      className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-4 focus:ring-purple-50 outline-none transition-all ${fieldErrors.category ? 'border-red-500' : 'border-gray-300 focus:border-[#8c76f0]'}`}
                    >
                      <option value="">Select a category</option>
                      {paymentCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.category_name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.category && (
                      <p className="text-sm text-red-600 font-medium mt-1">{fieldErrors.category}</p>
                    )}
                    {selectedCategory && selectedCategory.new_card_payment_delay_hours > 0 && (
                      <div className="mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <ul className="text-xs text-amber-800 leading-relaxed space-y-1.5 list-disc list-inside">
                          {selectedCategory.new_card_payment_delay_hours > 0 && (
                            <li>As per RBI guidelines, payments made using a new credit card will be settled after {selectedCategory.new_card_payment_delay_hours} hours.</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {checkingMonthlyLimit && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking beneficiary monthly limit...
                    </div>
                  )}

                  {monthlyLimitExceeded && monthlyLimitInfo && (
                    <div className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3.5">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-900 mb-1">
                          Monthly Limit Exceeded for this Beneficiary
                        </p>
                        <p className="text-xs text-red-800 leading-relaxed">
                          The maximum permitted payment for "{selectedCategory?.category_name}" is{' '}
                          ₹{monthlyLimitInfo.max.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                          per beneficiary per month. {selectedBeneficiary?.full_name || 'This beneficiary'}{' '}
                          has already received payments totaling{' '}
                          ₹{monthlyLimitInfo.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                          this month. You cannot proceed with another payment to this beneficiary in this category until next month.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Agreement/Invoice/Bill {billRequired ? <span className="text-red-600">*</span> : '(Optional)'}
                    </label>
                    {checkingBillRequired && (
                      <p className="text-xs text-gray-400 mb-1">Checking requirement...</p>
                    )}
                    {checkingInvoice && (
                      <p className="text-xs text-gray-400 mb-1">Checking invoice verification status...</p>
                    )}
                    {invoiceCheck && invoiceCheck.canUsePreviousInvoice && (
                      <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-green-800 mb-0.5">Previous Invoice Confirmed</p>
                          <p className="text-xs text-green-700 leading-relaxed">
                            A previously uploaded invoice for this beneficiary has been confirmed by the admin
                            {invoiceCheck.lastConfirmedAt && (
                              <> on {new Date(invoiceCheck.lastConfirmedAt).toLocaleDateString('en-IN')}</>
                            )}
                            . It is still within the frequency period for this category, so you do not need to upload a new invoice. The previous confirmed invoice will be applied to this transaction.
                          </p>
                        </div>
                      </div>
                    )}
                    {invoiceCheck && invoiceCheck.needsInvoiceUpload && invoiceCheck.invoiceRequired && (
                      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800 mb-0.5">
                            {invoiceCheck.hasConfirmedInvoice
                              ? 'Agreement/Invoice/Bill Verification Required — Previous Invoice Expired'
                              : 'Agreement/Invoice/Bill Verification Required'}
                          </p>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            {invoiceCheck.hasConfirmedInvoice
                              ? 'The previous confirmed invoice for this beneficiary is outside the frequency period for this category. Please upload a new invoice/bill for verification.'
                              : 'No previously confirmed agreement/invoice/bill exists for this beneficiary in this category. Please upload an agreement/invoice/bill for verification by the admin.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {billRequired && selectedCategory?.invoice_min_amount > 0 && (
                      <p className="text-xs text-amber-600 mb-1">
                        Invoice required for amounts ≥ ₹{selectedCategory.invoice_min_amount}
                      </p>
                    )}
                    {billRequired && selectedCategory?.invoice_frequency_months > 0 && (
                      <p className="text-xs text-amber-600 mb-1">
                        Required every {selectedCategory.invoice_frequency_months} month(s) for this beneficiary
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mb-2">PNG, JPEG, or PDF. Max size: 1 MB</p>

                    {fieldErrors.billFile && (
                      <p className="text-sm text-red-600 font-medium mb-2">{fieldErrors.billFile}</p>
                    )}
                    {!billFile ? (
                      <label className="block">
                        <div className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer hover:border-[#8c76f0] transition-colors ${fieldErrors.billFile ? 'border-red-400' : 'border-gray-300'}`}>
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Tap to upload</p>
                          <p className="text-xs text-gray-400 mt-1">PNG, JPEG, or PDF</p>
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </div>
                      </label>
                    ) : (
                      <div className="border-2 border-gray-300 rounded-xl p-3 sm:p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-[#8c76f0] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{billFile.name}</p>
                            <p className="text-xs text-gray-500">
                              {(billFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={removeFile}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Payment Option <span className="text-red-600">*</span></h2>
                      <p className="text-sm text-gray-600">Select one payment method</p>
                    </div>
                  </div>

                  {fieldErrors.paymentOption && (
                    <p className="text-sm text-red-600 font-medium">{fieldErrors.paymentOption}</p>
                  )}
                  {paymentOptions.length === 0 ? (
                    <div className="text-center py-12">
                      <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No payment options available</p>
                      <p className="text-sm text-gray-500 mt-2">Please contact administrator to configure payment gateways</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentOptions.map((option) => {
                          const baseAmount = parseFloat(amount) || 0;
                          const isBusiness = selectedBeneficiary?.account_type === 'Current';
                          const useDiscountedCharges = option.show_discount;

                          const normalChargePercentage = option.charges_percentage;
                          const discountedChargePercentage = option.discounted_charges_percentage;
                          const baseChargePercentage = useDiscountedCharges ? discountedChargePercentage : normalChargePercentage;
                          const surchargePercentage = option.business_surcharge_percentage || 0;
                          const surgeChargePercentage = kycStatus?.businessCategorySurgeCharge || 0;
                          const effectiveChargePercentage = baseChargePercentage + surchargePercentage + surgeChargePercentage;

                          const normalCharges = (baseAmount * normalChargePercentage) / 100;
                          const effectiveCharges = (baseAmount * effectiveChargePercentage) / 100;
                          const gst = (effectiveCharges * option.gst_percentage) / 100;
                          const total = baseAmount + effectiveCharges + gst;
                          const chargesLabel = 'Charges';

                          return (
                            <div
                              key={option.id}
                              onClick={() => setSelectedPaymentOption(option)}
                              className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                                selectedPaymentOption?.id === option.id
                                  ? 'border-[#8c76f0] bg-gradient-to-r from-purple-50 to-violet-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-gray-900 text-base">{option.card_type}</h3>
                                    {useDiscountedCharges && (
                                      <span className="px-2.5 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold rounded shadow-sm">
                                        Discounted
                                      </span>
                                    )}

                                  </div>
                                  <p className="text-sm text-gray-600 mb-1">{option.gateway_name}</p>
                                  {option.settlement_time && (
                                    <p className="text-sm text-gray-500 mb-3">
                                      Transaction Settlement Time:{' '}
                                      <span className="font-medium text-gray-700">
                                        {formatSettlementTime(option.settlement_time)}
                                      </span>
                                    </p>
                                  )}

                                  <div className="bg-white bg-opacity-60 rounded-lg p-3 space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Amount</span>
                                      <span className="font-medium text-gray-900">₹{baseAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">
                                        {chargesLabel}{' '}
                                        {useDiscountedCharges && (
                                          <span className="line-through text-gray-400">
                                            ({normalChargePercentage.toFixed(2)}%)
                                          </span>
                                        )}
                                        {useDiscountedCharges ? (
                                          <span className="text-green-600 ml-1">
                                            ({discountedChargePercentage.toFixed(2)}%)
                                          </span>
                                        ) : (
                                          <span>({effectiveChargePercentage.toFixed(2)}%)</span>
                                        )}
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {useDiscountedCharges && (
                                          <span className="line-through text-gray-400 mr-2">
                                            ₹{normalCharges.toFixed(2)}
                                          </span>
                                        )}
                                        <span className={useDiscountedCharges ? 'text-green-600' : ''}>
                                          ₹{effectiveCharges.toFixed(2)}
                                        </span>
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">GST ({option.gst_percentage.toFixed(2)}%)</span>
                                      <span className="font-medium text-gray-900">₹{gst.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-gray-200 pt-1.5 flex justify-between">
                                      <span className="text-sm font-semibold text-gray-900">Total Amount</span>
                                      <span className="text-base font-bold text-[#8c76f0]">₹{total.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                                {selectedPaymentOption?.id === option.id && (
                                  <CheckCircle className="w-6 h-6 text-[#8c76f0] ml-4 flex-shrink-0" />
                                )}
                              </div>

                              {option.terms_and_conditions && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <h4 className="text-xs font-semibold text-gray-900 mb-2">Terms and Conditions</h4>
                                  <div className="text-xs text-gray-600 leading-relaxed space-y-1">
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

              {currentStep === 4 && chargesDetails && selectedBeneficiary && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-[#8c76f0]" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Payment Summary</h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Beneficiary Details</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Name</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.full_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Email</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Mobile</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.mobile}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">PAN Number</span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedBeneficiary.pan_number || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Bank Details</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bank Name</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.bank_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Branch Name</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.branch_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Account Number</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.bank_account}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">IFSC Code</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.ifsc}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Account Type</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBeneficiary.account_type}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Information</h3>
                      <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-700">Payment Category</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedCategory?.category_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-700">Payment Option</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedPaymentOption?.category_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-700">Amount to Send</span>
                          <span className="text-sm font-semibold text-gray-900">₹{chargesDetails.amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-700">
                            {'Platform Charges'}
                            <span className="ml-1 text-gray-500 text-xs">
                              ({chargesDetails.effectiveChargesPercentage?.toFixed(2)}%)
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-gray-900">₹{chargesDetails.charges}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-700">GST ({chargesDetails.category.gstPercentage}%)</span>
                          <span className="text-sm font-semibold text-gray-900">₹{chargesDetails.gst}</span>
                        </div>
                        <div className="border-t-2 border-[#8c76f0] pt-2 flex justify-between">
                          <span className="text-base font-bold text-gray-900">Total Amount</span>
                          <span className="text-xl font-bold text-[#8c76f0]">₹{chargesDetails.totalAmount}</span>
                        </div>
                      </div>

                      {/* Apply Coupon (Optional) */}
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-[#8c76f0]" />
                          Apply Coupon Code
                          <span className="text-xs font-normal text-gray-400">(Optional)</span>
                        </h4>
                        {!appliedCoupon ? (
                          <div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={couponInput}
                                onChange={(e) => {
                                  setCouponInput(e.target.value.toUpperCase());
                                  if (couponStatus.type !== null) setCouponStatus({ type: null, message: '' });
                                }}
                                placeholder="Enter coupon code"
                                className={`flex-1 px-4 py-2.5 border-2 rounded-xl focus:ring-4 focus:ring-purple-50 outline-none transition-all uppercase tracking-wider font-mono text-sm ${
                                  couponStatus.type === 'error'
                                    ? 'border-red-400 focus:border-red-400'
                                    : 'border-gray-300 focus:border-[#8c76f0]'
                                }`}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon(); } }}
                              />
                              <button
                                onClick={handleApplyCoupon}
                                disabled={validatingCoupon || !couponInput.trim()}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {validatingCoupon ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Checking...
                                  </>
                                ) : (
                                  'Apply'
                                )}
                              </button>
                            </div>
                            {couponStatus.type === 'error' && (
                              <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-red-800">Coupon could not be applied</p>
                                  <p className="text-xs text-red-600 mt-0.5">{couponStatus.message}</p>
                                </div>
                              </div>
                            )}
                            {couponStatus.type === null && !couponInput.trim() && (
                              <p className="text-xs text-gray-400 mt-1.5">
                                Have a coupon code? Enter it above to get a discount on your payment.
                              </p>
                            )}
                            {validatingCoupon && (
                              <p className="text-xs text-[#8c76f0] mt-1.5 flex items-center gap-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Verifying coupon...
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <div>
                                  <p className="text-sm font-semibold text-green-900 font-mono">{appliedCoupon.couponCode}</p>
                                  <p className="text-xs text-green-700">You save ₹{appliedCoupon.discountAmount.toFixed(2)} on this payment</p>
                                </div>
                              </div>
                              <button
                                onClick={handleRemoveCoupon}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove coupon"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Coupon Discount + Updated Total */}
                      {appliedCoupon && (
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                            <span className="text-sm font-medium text-green-800">Coupon Discount</span>
                            <span className="text-sm font-bold text-green-700">-₹{appliedCoupon.discountAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center border-t-2 border-[#8c76f0] pt-2">
                            <span className="text-base font-bold text-gray-900">Total After Discount</span>
                            <span className="text-xl font-bold text-[#8c76f0]">₹{appliedCoupon.newTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Gateway charges note */}
                    </div>

                    {/* Gateway Details */}
                    {selectedGateway && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Gateway</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Gateway</span>
                            <span className="text-sm font-medium text-gray-900">{chargesDetails.gateway.name}</span>
                          </div>
                          {(selectedPaymentOption?.settlement_time || selectedCategory?.settlement_time) && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Transaction Settlement Time</span>
                              <span className="text-sm font-medium text-gray-900">
                                {formatSettlementTime(selectedPaymentOption?.settlement_time || selectedCategory?.settlement_time || '')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {billFile && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Attached Bill</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                          <FileText className="w-8 h-8 text-[#8c76f0]" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{billFile.name}</p>
                            <p className="text-xs text-gray-500">{(billFile.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-[#8c76f0] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#8c76f0] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Ready to Process</p>
                        <p className="text-sm text-gray-700 mt-1">
                          Please review all details carefully before proceeding with the payment.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && paymentResult && (() => {
                const isSuccess = paymentResult.status === 'success';
                const isFailed = paymentResult.status === 'failed';
                const isKycPending = isSuccess &&
                  selectedCategory?.receiver_kyc_required === true &&
                  selectedBeneficiary?.is_verified_merchant !== true;
                const displayStatusLabel = isSuccess
                  ? (isKycPending ? 'Payment Received – KYC Verification Pending' : 'Transaction Settlement In Progress')
                  : 'Transaction Failed';
                const displayStatusNote = isSuccess
                  ? (isKycPending
                      ? 'Your payment was received successfully. Payout to the beneficiary will be processed after Merchant KYC / Onboarding is completed by the receiver.'
                      : 'Payment gateway transaction was successful. Your payment is now being settled to the beneficiary.')
                  : paymentResult.message;
                return (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSuccess
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50'
                        : 'bg-gradient-to-r from-red-50 to-rose-50'
                    }`}>
                      {isSuccess ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Transaction Status</h2>
                  </div>

                  <div className={`rounded-xl p-6 border-2 ${
                    isSuccess
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500'
                      : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-500'
                  }`}>
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

                    <h3 className={`text-2xl font-bold text-center mb-2 ${
                      isSuccess ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {displayStatusLabel}
                    </h3>

                    <p className="text-center text-gray-700 mb-6">
                      {displayStatusNote}
                    </p>

                    <div className="space-y-3">
                      <div className="bg-white bg-opacity-60 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-600">Transaction Reference</span>
                          <span className="text-sm font-bold text-gray-900">{paymentResult.reference}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-600">Amount</span>
                          <span className="text-sm font-bold text-gray-900">₹{paymentResult.amount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Status</span>
                          <span className={`text-sm font-bold ${
                            isSuccess ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {displayStatusLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSuccess && isKycPending && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                        <p className="text-sm font-semibold text-amber-800 mb-1">Awaiting Receiver KYC / Merchant Onboarding</p>
                        <p className="text-xs text-amber-700">
                          The receiver has been notified via email and SMS to complete their Merchant KYC verification.
                          Once verified, the payout will be processed automatically.
                          {selectedCategory?.refund_after_hours ? ` If KYC is not completed within ${selectedCategory.refund_after_hours} hours, the payment will be refunded.` : ''}
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                          Merchant KYC collection is carried out in accordance with applicable RBI guidelines. We maintain the confidentiality of merchant information and do not share it with the Income Tax Department or any other government agency, except where disclosure is required by applicable law or a lawful order.
                        </p>
                      </div>
                    )}
                    {isSuccess && !isKycPending && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>Note:</strong> Please save your transaction reference number for future reference.
                          You can track the settlement status under <strong>My Transactions</strong>.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/dashboard', { state: { userId, userEmail } })}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                      Go to Dashboard
                    </button>
                    {isSuccess && (
                      <button
                        onClick={() => navigate('/my-transactions', { state: { userId, userEmail } })}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#8c76f0] text-[#8c76f0] rounded-xl font-medium hover:bg-purple-50 transition-colors"
                      >
                        My Transactions
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
                          handleRemoveCoupon();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#8c76f0] text-[#8c76f0] rounded-xl font-medium hover:bg-purple-50 transition-colors"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                </div>
                );
              })()}

              {currentStep !== 5 && (
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
                  {currentStep > 1 && (
                    <button
                      onClick={handleBack}
                      disabled={processing}
                      className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Back
                    </button>
                  )}

                  {currentStep < 4 && (
                    <button
                      onClick={handleNext}
                      disabled={loading || (currentStep === 1 && beneficiaries.length === 0)}
                      className="ml-auto flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  )}
                  {currentStep === 4 && (
                    <button
                      onClick={handleMakePayment}
                      disabled={processing}
                      className="ml-auto flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Initiating Payment...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          Proceed to Payment
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import TermsOfService from './pages/TermsOfService';
import Privacy from './pages/Privacy';
import RefundPolicy from './pages/RefundPolicy';
import Contact from './pages/Contact';
import FraudReporting from './pages/FraudReporting';
import FAQ from './pages/FAQ';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyOTP from './pages/VerifyOTP';
import ForgotPassword from './pages/ForgotPassword';
import KYCVerification from './pages/KYCVerification';
import Dashboard from './pages/Dashboard';
import ChangePassword from './pages/ChangePassword';
import MyBeneficiaries from './pages/MyBeneficiaries';
import MyBankAccounts from './pages/MyBankAccounts';
import MakePayment from './pages/MakePayment';
import PaymentGateway from './pages/PaymentGateway';
import HelpSupport from './pages/HelpSupport';
import MyTransactions from './pages/MyTransactions';
import AdminLogin from './pages/admin/AdminLogin';
import AdminHome from './pages/admin/AdminHome';
import AdminKycVerification from './pages/admin/AdminKycVerification';
import AdminForgotPassword from './pages/admin/AdminForgotPassword';
import EmailSettings from './pages/admin/EmailSettings';
import AdminChangePassword from './pages/admin/AdminChangePassword';
import PaymentOption from './pages/admin/PaymentOption';
import PaymentGatewaySettings from './pages/admin/PaymentGatewaySettings';
import SMSSettings from './pages/admin/SMSSettings';
import AdminUserManagement from './pages/admin/AdminUserManagement';
import RolePermissions from './pages/admin/RolePermissions';
import PaymentLimits from './pages/admin/PaymentLimits';
import AdminSupportTickets from './pages/admin/AdminSupportTickets';
import PaymentCategories from './pages/admin/PaymentCategories';
import MasterSettings from './pages/admin/MasterSettings';
import MerchantOnboarding from './pages/MerchantOnboarding';
import ManualPayout from './pages/admin/ManualPayout';
import PayoutSettings from './pages/admin/PayoutSettings';
import AdminReports from './pages/admin/AdminReports';
import AdminUserSummary from './pages/admin/AdminUserSummary';
import AdminNotifications from './pages/admin/AdminNotifications';
import BulkEmail from './pages/admin/BulkEmail';
import BulkSMS from './pages/admin/BulkSMS';
import KycMethodSettings from './pages/admin/KycMethodSettings';
import DashboardNotification from './pages/admin/DashboardNotification';
import AdminMerchantKyc from './pages/admin/AdminMerchantKyc';
import DigiLockerCallback from './pages/DigiLockerCallback';
import MobileHome from './pages/mobile/MobileHome';
import MobileLogin from './pages/mobile/MobileLogin';
import MobileRegister from './pages/mobile/MobileRegister';
import MobileVerifyOTP from './pages/mobile/MobileVerifyOTP';
import MobileForgotPassword from './pages/mobile/MobileForgotPassword';
import MobileDashboard from './pages/mobile/MobileDashboard';
import MobileMakePayment from './pages/mobile/MobileMakePayment';
import MobileMyTransactions from './pages/mobile/MobileMyTransactions';
import MobileMyBeneficiaries from './pages/mobile/MobileMyBeneficiaries';
import MobileMyBankAccounts from './pages/mobile/MobileMyBankAccounts';
import MobileKYCVerification from './pages/mobile/MobileKYCVerification';
import MobileHelpSupport from './pages/mobile/MobileHelpSupport';
import MobileChangePassword from './pages/mobile/MobileChangePassword';
import MobileMore from './pages/mobile/MobileMore';

function MainLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (page: string) => {
    if (page === 'home') {
      navigate('/');
    } else if (page === 'terms') {
      navigate('/terms-of-service');
    } else if (page === 'refund') {
      navigate('/refund-policy');
    } else if (page === 'fraud') {
      navigate('/fraud-reporting');
    } else {
      navigate(`/${page}`);
    }
  };

  // Map pathname to page name for Navigation component
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path === '/about') return 'about';
    if (path === '/terms-of-service') return 'terms';
    if (path === '/privacy') return 'privacy';
    if (path === '/contact') return 'contact';
    if (path === '/refund-policy') return 'refund';
    if (path === '/fraud-reporting') return 'fraud';
    if (path === '/faq') return 'faq';
    return '';
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation currentPage={getCurrentPage()} onNavigate={handleNavigate} />
      <main>{children}</main>
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/about" element={<MainLayout><About /></MainLayout>} />
          <Route path="/faq" element={<MainLayout><FAQ /></MainLayout>} />
          <Route path="/terms-of-service" element={<MainLayout><TermsOfService /></MainLayout>} />
          <Route path="/privacy" element={<MainLayout><Privacy /></MainLayout>} />
          <Route path="/refund-policy" element={<MainLayout><RefundPolicy /></MainLayout>} />
          <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />
          <Route path="/fraud-reporting" element={<MainLayout><FraudReporting /></MainLayout>} />
          <Route path="/register" element={<MainLayout><Register /></MainLayout>} />
          <Route path="/login" element={<MainLayout><Login /></MainLayout>} />
          <Route path="/verify-otp" element={<MainLayout><VerifyOTP /></MainLayout>} />
          <Route path="/forgot-password" element={<MainLayout><ForgotPassword /></MainLayout>} />
          <Route path="/kyc-verification" element={<MainLayout><KYCVerification /></MainLayout>} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/my-bank-accounts" element={<MyBankAccounts />} />
          <Route path="/my-beneficiaries" element={<MyBeneficiaries />} />
          <Route path="/make-payment" element={<MakePayment />} />
          <Route path="/my-transactions" element={<MyTransactions />} />
          <Route path="/payment-gateway" element={<PaymentGateway />} />
          <Route path="/help-support" element={<HelpSupport />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
          <Route path="/admin/dashboard" element={<AdminHome />} />
          <Route path="/admin/kyc-verification" element={<AdminKycVerification />} />
          <Route path="/admin/payment-option" element={<PaymentOption />} />
          <Route path="/admin/payment-charges" element={<Navigate to="/admin/payment-option" replace />} />
          <Route path="/admin/payment-gateway-settings" element={<PaymentGatewaySettings />} />
          <Route path="/admin/email-settings" element={<EmailSettings />} />
          <Route path="/admin/sms-settings" element={<SMSSettings />} />
          <Route path="/admin/change-password" element={<AdminChangePassword />} />
          <Route path="/admin/user-management" element={<AdminUserManagement />} />
          <Route path="/admin/role-permissions" element={<RolePermissions />} />
          <Route path="/admin/payment-limits" element={<PaymentLimits />} />
          <Route path="/admin/support-tickets" element={<AdminSupportTickets />} />
          <Route path="/admin/payment-categories" element={<PaymentCategories />} />
          <Route path="/admin/master-settings" element={<MasterSettings />} />
          <Route path="/admin/manual-payout" element={<ManualPayout />} />
          <Route path="/admin/payout-settings" element={<PayoutSettings />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/user-summary" element={<AdminUserSummary />} />
          <Route path="/admin/kyc-method" element={<KycMethodSettings />} />
          <Route path="/admin/merchant-kyc" element={<AdminMerchantKyc />} />
          <Route path="/admin/dashboard-notification" element={<DashboardNotification />} />
          <Route path="/admin/mobile-notifications" element={<AdminNotifications />} />
          <Route path="/admin/bulk-email" element={<BulkEmail />} />
          <Route path="/admin/bulk-sms" element={<BulkSMS />} />
          <Route path="/merchant-onboarding" element={<MerchantOnboarding />} />
          <Route path="/digilocker-callback" element={<DigiLockerCallback />} />

          {/* Mobile app routes */}
          <Route path="/mobile" element={<MobileHome />} />
          <Route path="/mobile/login" element={<MobileLogin />} />
          <Route path="/mobile/register" element={<MobileRegister />} />
          <Route path="/mobile/verify-otp" element={<MobileVerifyOTP />} />
          <Route path="/mobile/forgot-password" element={<MobileForgotPassword />} />
          <Route path="/mobile/dashboard" element={<MobileDashboard />} />
          <Route path="/mobile/make-payment" element={<MobileMakePayment />} />
          <Route path="/mobile/my-transactions" element={<MobileMyTransactions />} />
          <Route path="/mobile/my-beneficiaries" element={<MobileMyBeneficiaries />} />
          <Route path="/mobile/my-bank-accounts" element={<MobileMyBankAccounts />} />
          <Route path="/mobile/kyc-verification" element={<MobileKYCVerification />} />
          <Route path="/mobile/help-support" element={<MobileHelpSupport />} />
          <Route path="/mobile/change-password" element={<MobileChangePassword />} />
          <Route path="/mobile/more" element={<MobileMore />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

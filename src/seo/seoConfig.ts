export interface SeoMeta {
  title: string;
  description: string;
  keywords: string;
  canonical?: string;
}

const DEFAULT_META: SeoMeta = {
  title: 'Pay eligible vendor, business, education and rent payments using your credit card | PayByCard India',
  description: 'Pay any bill instantly using your Visa, MasterCard, RuPay, Amex, Diners Club credit card. Make secure online payments, pay bills, invoices and more with ease.',
  keywords: 'pay any bill using credit card, credit card to bank transfer, credit card bill payment platform, credit card cash transfer service, instant credit card payments',
  canonical: 'https://paybycard.in/',
};

export const seoConfig: Record<string, SeoMeta> = {
  '/': {
    title: 'PayByCard – Pay Rent, Fees & Business Payments by Credit Card',
    description: 'Pay rent, education fees, vendor invoices and eligible business payments using your visa, master card, rupay, american express(Amex), diners club credit card with PayByCard.',
    keywords: 'pay rent by credit card, pay fees by credit card, credit card payments, vendor payment by credit card, business payment by credit card',
    canonical: 'https://paybycard.in/',
  },
  '/about': {
    title: 'About PayByCard – Credit Card Payment Platform in India',
    description: 'Learn about PayByCard, an Indian payment technology platform helping users make eligible rent, education, vendor and business payments using credit cards.',
    keywords: 'PayByCard, credit card payment platform India, payment technology company India',
    canonical: 'https://paybycard.in/about',
  },
  '/faq': {
    title: 'PayByCard FAQ – Credit Card Payments, Fees & Refunds',
    description: 'Find answers about PayByCard credit card payments, supported cards, transaction processing, settlement, refunds, cancellations, security and fraud prevention.',
    keywords: 'PayByCard FAQ, credit card payment FAQ, credit card payment India, PayByCard refund',
    canonical: 'https://paybycard.in/faq',
  },
  '/terms-of-service': {
    title: 'Terms of Service | PayByCard',
    description: 'Read the PayByCard Terms of Service governing the use of our platform, eligible payments, transactions, user responsibilities, refunds and prohibited activities.',
    keywords: 'PayByCard terms of service, PayByCard terms and conditions, PayByCard user agreement, PayByCard payment terms',
    canonical: 'https://paybycard.in/terms-of-service',
  },
  '/privacy': {
    title: 'Privacy Policy | PayByCard India',
    description: 'Review the PayByCard India privacy policy to understand how we collect, use, and protect your personal and payment data.',
    keywords: 'paybycard privacy policy, data protection, privacy, credit card data security',
    canonical: 'https://paybycard.in/privacy',
  },
  '/refund-policy': {
    title: 'Refund Policy | PayByCard India',
    description: 'Understand the PayByCard India refund policy, including eligibility, processing times, and conditions for credit card payment refunds.',
    keywords: 'paybycard refund policy, refund, credit card refund, payment refund terms',
    canonical: 'https://paybycard.in/refund-policy',
  },
  '/contact': {
    title: 'Contact Us | PayByCard India',
    description: 'Get in touch with PayByCard India for support, queries, or feedback regarding credit card payments and platform usage.',
    keywords: 'contact paybycard, paybycard support, credit card payment help, paybycard contact',
    canonical: 'https://paybycard.in/contact',
  },
  '/fraud-reporting': {
    title: 'Fraud Reporting | PayByCard India',
    description: 'Report fraud, suspicious activity, or unauthorized transactions on the PayByCard India platform.',
    keywords: 'fraud reporting, report fraud, paybycard fraud, credit card fraud, suspicious activity',
    canonical: 'https://paybycard.in/fraud-reporting',
  },
  '/register': {
    title: 'Register | PayByCard India',
    description: 'Create your PayByCard India account to start making secure credit card payments to vendors, businesses, and institutions.',
    keywords: 'register paybycard, create account, sign up, credit card payment account',
    canonical: 'https://paybycard.in/register',
  },
  '/login': {
    title: 'Login | PayByCard India',
    description: 'Login to your PayByCard India account to manage payments, beneficiaries, and transactions.',
    keywords: 'paybycard login, sign in, credit card payment login, account login',
    canonical: 'https://paybycard.in/login',
  },
  '/verify-otp': {
    title: 'Verify OTP | PayByCard India',
    description: 'Verify your mobile number with OTP to complete registration on PayByCard India.',
    keywords: 'otp verification, mobile verification, paybycard otp, account verification',
    canonical: 'https://paybycard.in/verify-otp',
  },
  '/forgot-password': {
    title: 'Forgot Password | PayByCard India',
    description: 'Reset your PayByCard India account password if you have forgotten it.',
    keywords: 'forgot password, reset password, paybycard password reset, account recovery',
    canonical: 'https://paybycard.in/forgot-password',
  },
  '/kyc-verification': {
    title: 'KYC Verification | PayByCard India',
    description: 'Complete your KYC verification on PayByCard India to unlock full payment features and higher transaction limits.',
    keywords: 'kyc verification, paybycard kyc, identity verification, aadhaar verification, pan verification',
    canonical: 'https://paybycard.in/kyc-verification',
  },
  '/dashboard': {
    title: 'Dashboard | PayByCard India',
    description: 'View your PayByCard India dashboard with payment summaries, transaction history, and account overview.',
    keywords: 'paybycard dashboard, account dashboard, payment summary, transaction overview',
    canonical: 'https://paybycard.in/dashboard',
  },
  '/change-password': {
    title: 'Change Password | PayByCard India',
    description: 'Change your PayByCard India account password for improved security.',
    keywords: 'change password, paybycard password, account security, update password',
    canonical: 'https://paybycard.in/change-password',
  },
  '/my-bank-accounts': {
    title: 'My Bank Accounts | PayByCard India',
    description: 'Manage your linked bank accounts on PayByCard India for receiving credit card payments.',
    keywords: 'bank accounts, linked bank accounts, paybycard bank accounts, manage bank accounts',
    canonical: 'https://paybycard.in/my-bank-accounts',
  },
  '/my-beneficiaries': {
    title: 'My Beneficiaries | PayByCard India',
    description: 'Manage your beneficiaries on PayByCard India to make quick and secure credit card payments.',
    keywords: 'beneficiaries, paybycard beneficiaries, payment beneficiaries, manage beneficiaries',
    canonical: 'https://paybycard.in/my-beneficiaries',
  },
  '/make-payment': {
    title: 'Make a Payment | PayByCard India',
    description: 'Make a secure credit card payment to your beneficiary using PayByCard India.',
    keywords: 'make payment, credit card payment, pay bill, paybycard payment, online payment',
    canonical: 'https://paybycard.in/make-payment',
  },
  '/my-transactions': {
    title: 'My Transactions | PayByCard India',
    description: 'View your complete transaction history on PayByCard India, including payment status and details.',
    keywords: 'transactions, payment history, paybycard transactions, transaction records',
    canonical: 'https://paybycard.in/my-transactions',
  },
  '/payment-gateway': {
    title: 'Payment Gateway | PayByCard India',
    description: 'Secure payment gateway for processing credit card payments on PayByCard India.',
    keywords: 'payment gateway, secure payment, credit card gateway, paybycard gateway',
    canonical: 'https://paybycard.in/payment-gateway',
  },
  '/help-support': {
    title: 'Help & Support | PayByCard India',
    description: 'Get help and support for PayByCard India, including support tickets, FAQs, and contact options.',
    keywords: 'help, support, paybycard support, customer support, help desk',
    canonical: 'https://paybycard.in/help-support',
  },
  '/merchant-onboarding': {
    title: 'Merchant Onboarding | PayByCard India',
    description: 'Onboard your business as a merchant on PayByCard India to accept credit card payments.',
    keywords: 'merchant onboarding, business onboarding, merchant account, paybycard merchant',
    canonical: 'https://paybycard.in/merchant-onboarding',
  },
  '/admin/login': {
    title: 'Admin Login | PayByCard India',
    description: 'Administrator login for PayByCard India platform management.',
    keywords: 'admin login, paybycard admin, administrator login',
    canonical: 'https://paybycard.in/admin/login',
  },
  '/admin/dashboard': {
    title: 'Admin Dashboard | PayByCard India',
    description: 'Administrator dashboard for managing PayByCard India platform operations.',
    keywords: 'admin dashboard, paybycard admin dashboard, platform management',
    canonical: 'https://paybycard.in/admin/dashboard',
  },
  '/admin/kyc-verification': {
    title: 'Admin KYC Verification | PayByCard India',
    description: 'Review and verify user KYC submissions on the PayByCard India admin panel.',
    keywords: 'admin kyc, kyc verification, kyc review, admin panel',
    canonical: 'https://paybycard.in/admin/kyc-verification',
  },
  '/admin/payment-option': {
    title: 'Payment Options | PayByCard India Admin',
    description: 'Manage payment options and charges on the PayByCard India admin panel.',
    keywords: 'payment options, admin payment options, payment charges, paybycard admin',
    canonical: 'https://paybycard.in/admin/payment-option',
  },
  '/admin/payment-gateway-settings': {
    title: 'Payment Gateway Settings | PayByCard India Admin',
    description: 'Configure payment gateway settings on the PayByCard India admin panel.',
    keywords: 'payment gateway settings, gateway configuration, admin gateway settings',
    canonical: 'https://paybycard.in/admin/payment-gateway-settings',
  },
  '/admin/email-settings': {
    title: 'Email Settings | PayByCard India Admin',
    description: 'Configure email settings and templates on the PayByCard India admin panel.',
    keywords: 'email settings, email configuration, admin email, smtp settings',
    canonical: 'https://paybycard.in/admin/email-settings',
  },
  '/admin/sms-settings': {
    title: 'SMS Settings | PayByCard India Admin',
    description: 'Configure SMS gateway settings and templates on the PayByCard India admin panel.',
    keywords: 'sms settings, sms configuration, admin sms, sms gateway',
    canonical: 'https://paybycard.in/admin/sms-settings',
  },
  '/admin/change-password': {
    title: 'Admin Change Password | PayByCard India',
    description: 'Change the admin account password on PayByCard India.',
    keywords: 'admin change password, admin password, admin security',
    canonical: 'https://paybycard.in/admin/change-password',
  },
  '/admin/user-management': {
    title: 'User Management | PayByCard India Admin',
    description: 'Manage user accounts, roles, and permissions on the PayByCard India admin panel.',
    keywords: 'user management, admin users, account management, user roles',
    canonical: 'https://paybycard.in/admin/user-management',
  },
  '/admin/role-permissions': {
    title: 'Role Permissions | PayByCard India Admin',
    description: 'Configure role-based access control and permissions on the PayByCard India admin panel.',
    keywords: 'role permissions, access control, admin roles, permissions management',
    canonical: 'https://paybycard.in/admin/role-permissions',
  },
  '/admin/payment-limits': {
    title: 'Payment Limits | PayByCard India Admin',
    description: 'Configure payment limits and thresholds on the PayByCard India admin panel.',
    keywords: 'payment limits, transaction limits, admin payment limits, payment thresholds',
    canonical: 'https://paybycard.in/admin/payment-limits',
  },
  '/admin/support-tickets': {
    title: 'Support Tickets | PayByCard India Admin',
    description: 'Manage customer support tickets on the PayByCard India admin panel.',
    keywords: 'support tickets, admin support, ticket management, customer support',
    canonical: 'https://paybycard.in/admin/support-tickets',
  },
  '/admin/payment-categories': {
    title: 'Payment Categories | PayByCard India Admin',
    description: 'Manage payment categories and options on the PayByCard India admin panel.',
    keywords: 'payment categories, admin categories, payment types, category management',
    canonical: 'https://paybycard.in/admin/payment-categories',
  },
  '/admin/master-settings': {
    title: 'Master Settings | PayByCard India Admin',
    description: 'Configure master platform settings on the PayByCard India admin panel.',
    keywords: 'master settings, platform settings, admin configuration, site settings',
    canonical: 'https://paybycard.in/admin/master-settings',
  },
  '/admin/manual-payout': {
    title: 'Manual Payout | PayByCard India Admin',
    description: 'Process manual payouts and manage pending transactions on the PayByCard India admin panel.',
    keywords: 'manual payout, admin payout, payout processing, transaction payout',
    canonical: 'https://paybycard.in/admin/manual-payout',
  },
  '/admin/payout-settings': {
    title: 'Payout Settings | PayByCard India Admin',
    description: 'Configure payout gateway settings and credentials on the PayByCard India admin panel.',
    keywords: 'payout settings, payout configuration, admin payout settings, payout gateway',
    canonical: 'https://paybycard.in/admin/payout-settings',
  },
  '/admin/reports': {
    title: 'Reports | PayByCard India Admin',
    description: 'View platform reports, transaction analytics, and financial summaries on the PayByCard India admin panel.',
    keywords: 'reports, analytics, admin reports, transaction reports, financial reports',
    canonical: 'https://paybycard.in/admin/reports',
  },
  '/admin/user-summary': {
    title: 'User Summary | PayByCard India Admin',
    description: 'View user summaries and account overviews on the PayByCard India admin panel.',
    keywords: 'user summary, admin user summary, user overview, account summary',
    canonical: 'https://paybycard.in/admin/user-summary',
  },
  '/admin/kyc-method': {
    title: 'KYC Method Settings | PayByCard India Admin',
    description: 'Configure KYC verification methods and provider settings on the PayByCard India admin panel.',
    keywords: 'kyc method, kyc settings, kyc provider, admin kyc configuration',
    canonical: 'https://paybycard.in/admin/kyc-method',
  },
  '/admin/merchant-kyc': {
    title: 'Merchant KYC | PayByCard India Admin',
    description: 'Review and verify merchant KYC submissions on the PayByCard India admin panel.',
    keywords: 'merchant kyc, admin merchant kyc, merchant verification, merchant review',
    canonical: 'https://paybycard.in/admin/merchant-kyc',
  },
  '/admin/dashboard-notification': {
    title: 'Dashboard Notifications | PayByCard India Admin',
    description: 'Manage dashboard notifications and announcements on the PayByCard India admin panel.',
    keywords: 'dashboard notifications, admin notifications, announcements, notification management',
    canonical: 'https://paybycard.in/admin/dashboard-notification',
  },
  '/admin/mobile-notifications': {
    title: 'Mobile Notifications | PayByCard India Admin',
    description: 'Manage mobile push notification campaigns on the PayByCard India admin panel.',
    keywords: 'mobile notifications, push notifications, notification campaigns, admin notifications',
    canonical: 'https://paybycard.in/admin/mobile-notifications',
  },
  '/admin/bulk-email': {
    title: 'Bulk Email | PayByCard India Admin',
    description: 'Send bulk email campaigns to users on the PayByCard India admin panel.',
    keywords: 'bulk email, email campaign, admin email, mass email',
    canonical: 'https://paybycard.in/admin/bulk-email',
  },
  '/admin/bulk-sms': {
    title: 'Bulk SMS | PayByCard India Admin',
    description: 'Send bulk SMS campaigns to users on the PayByCard India admin panel.',
    keywords: 'bulk sms, sms campaign, admin sms, mass sms',
    canonical: 'https://paybycard.in/admin/bulk-sms',
  },
  '/admin/vendor-management': {
    title: 'Vendor Management | PayByCard India Admin',
    description: 'Manage vendor accounts and configurations on the PayByCard India admin panel.',
    keywords: 'vendor management, admin vendors, vendor accounts, vendor configuration',
    canonical: 'https://paybycard.in/admin/vendor-management',
  },
  '/admin/invoicing': {
    title: 'Invoicing | PayByCard India Admin',
    description: 'Manage invoices and billing on the PayByCard India admin panel.',
    keywords: 'invoicing, admin invoices, billing, invoice management',
    canonical: 'https://paybycard.in/admin/invoicing',
  },
  '/admin/forgot-password': {
    title: 'Admin Forgot Password | PayByCard India',
    description: 'Reset your PayByCard India admin account password.',
    keywords: 'admin forgot password, admin password reset, admin recovery',
    canonical: 'https://paybycard.in/admin/forgot-password',
  },
};

export function getSeoMeta(pathname: string): SeoMeta {
  return seoConfig[pathname] ?? DEFAULT_META;
}

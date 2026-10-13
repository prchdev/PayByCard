import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Origin': 'https://paybycard.in',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'sha256-qmRIvbuzeY3VoFLJHZppZ7rNhWnaMNzUg9AwWGlt/8o=' https://www.googletagmanager.com https://www.google-analytics.com https://checkout.razorpay.com https://api.razorpay.com https://sdk.cashfree.com https://jssdk.cashfree.com https://js.cashfree.com https://checkout-static.cashfree.com https://easebuzz.in https://payu.in https://zaakpay.com https://api.enkash.com https://cdn.enkash.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.ipify.org https://*.supabase.co https://api.paybycard.in https://www.google-analytics.com https://www.googletagmanager.com https://api.razorpay.com https://api.cashfree.com https://sandbox.cashfree.com https://api.easebuzz.in https://testpay.easebuzz.in https://secure.payu.in https://secure.ccavenue.com https://api.zaakpay.com https://api.enkash.com wss:; frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://sdk.cashfree.com https://jssdk.cashfree.com https://js.cashfree.com https://checkout-static.cashfree.com https://payu.in https://secure.payu.in https://easebuzz.in https://pay.easebuzz.in https://testpay.easebuzz.in https://zaakpay.com https://api.zaakpay.com https://secure.ccavenue.com https://test.ccavenue.com https://api.enkash.com https://uat.enkash.com https://cdn.enkash.com https://www.google-analytics.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://secure.ccavenue.com https://api.enkash.com https://checkout.razorpay.com https://easebuzz.in https://payu.in https://zaakpay.com; upgrade-insecure-requests;",
    },
  },
});

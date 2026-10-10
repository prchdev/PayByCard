import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SUPABASE_URL = 'https://api.paybycard.in';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
  },
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
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'sha256-qmRIvbuzeY3VoFLJHZppZ7rNhWnaMNzUg9AwWGlt/8o=' https://www.googletagmanager.com https://www.google-analytics.com https://checkout.razorpay.com https://sdk.cashfree.com https://jssdk.cashfree.com https://js.cashfree.com https://checkout-static.cashfree.com https://easebuzz.in https://payu.in https://zaakpay.com https://api.enkash.com https://cdn.enkash.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.paybycard.in https://www.google-analytics.com https://www.googletagmanager.com wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://secure.ccavenue.com https://api.enkash.com; upgrade-insecure-requests;",
    },
  },
});

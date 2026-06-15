// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Access-Control-Allow-Origin": "https://paybycard.in",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://vinllmoxlxgahnwpjxea.supabase.co https://www.google-analytics.com https://www.googletagmanager.com ws:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgICdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJzogJ25vc25pZmYnLFxuICAgICAgJ1gtRnJhbWUtT3B0aW9ucyc6ICdERU5ZJyxcbiAgICAgICdYLVhTUy1Qcm90ZWN0aW9uJzogJzE7IG1vZGU9YmxvY2snLFxuICAgICAgJ1Blcm1pc3Npb25zLVBvbGljeSc6ICdhY2NlbGVyb21ldGVyPSgpLCBjYW1lcmE9KCksIGdlb2xvY2F0aW9uPSgpLCBneXJvc2NvcGU9KCksIG1hZ25ldG9tZXRlcj0oKSwgbWljcm9waG9uZT0oKSwgcGF5bWVudD0oKSwgdXNiPSgpLCBpbnRlcmVzdC1jb2hvcnQ9KCknLFxuICAgICAgJ1JlZmVycmVyLVBvbGljeSc6ICdzdHJpY3Qtb3JpZ2luLXdoZW4tY3Jvc3Mtb3JpZ2luJyxcbiAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnaHR0cHM6Ly9wYXlieWNhcmQuaW4nLFxuICAgICAgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JzogXCJkZWZhdWx0LXNyYyAnc2VsZic7IHNjcmlwdC1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJyAndW5zYWZlLWV2YWwnIGh0dHBzOi8vd3d3Lmdvb2dsZXRhZ21hbmFnZXIuY29tIGh0dHBzOi8vd3d3Lmdvb2dsZS1hbmFseXRpY3MuY29tOyBzdHlsZS1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJyBodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tOyBmb250LXNyYyAnc2VsZicgaHR0cHM6Ly9mb250cy5nc3RhdGljLmNvbTsgaW1nLXNyYyAnc2VsZicgZGF0YTogaHR0cHM6IGJsb2I6OyBjb25uZWN0LXNyYyAnc2VsZicgaHR0cHM6Ly92aW5sbG1veGx4Z2FobndwanhlYS5zdXBhYmFzZS5jbyBodHRwczovL3d3dy5nb29nbGUtYW5hbHl0aWNzLmNvbSBodHRwczovL3d3dy5nb29nbGV0YWdtYW5hZ2VyLmNvbSB3czo7IGZyYW1lLWFuY2VzdG9ycyAnbm9uZSc7IG9iamVjdC1zcmMgJ25vbmUnOyBiYXNlLXVyaSAnc2VsZic7IGZvcm0tYWN0aW9uICdzZWxmJztcIixcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGNBQWM7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sU0FBUztBQUFBLE1BQ1AsMEJBQTBCO0FBQUEsTUFDMUIsbUJBQW1CO0FBQUEsTUFDbkIsb0JBQW9CO0FBQUEsTUFDcEIsc0JBQXNCO0FBQUEsTUFDdEIsbUJBQW1CO0FBQUEsTUFDbkIsK0JBQStCO0FBQUEsTUFDL0IsMkJBQTJCO0FBQUEsSUFDN0I7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

import { Mail, Phone, MapPin, Clock, MessageSquare } from 'lucide-react';

export default function Contact() {
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
              <MessageSquare className="w-20 h-20 text-[#8c76f0] mx-auto animate-pulse" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Get in <span className="bg-gradient-to-r from-[#8c76f0] via-purple-600 to-violet-600 bg-clip-text text-transparent">Touch</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Have questions? We're here to help. Reach out to us through any of the channels below.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-3xl p-8 md:p-10 border-2 border-gray-300 shadow-xl hover:shadow-2xl transition-all hover:border-[#8c76f0]">
              <div className="flex items-start space-x-4 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Email Us</h3>
                  <p className="text-gray-600 mb-3">Send us an email anytime</p>
                  <a
                    href="mailto:support@paybycard.in"
                    className="text-[#8c76f0] hover:text-purple-700 font-semibold text-lg transition-colors"
                  >
                    support@paybycard.in
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-10 border-2 border-gray-300 shadow-xl hover:shadow-2xl transition-all hover:border-[#8c76f0]">
              <div className="flex items-start space-x-4 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Phone className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Call Us</h3>
                  <p className="text-gray-600 mb-3">Give us a call during business hours</p>
                  <a
                    href="tel:+918850144143"
                    className="text-[#8c76f0] hover:text-purple-700 font-semibold text-lg transition-colors"
                  >
                    +91 88501 44143
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-[#8c76f0] to-purple-600 rounded-3xl p-8 md:p-10 text-white shadow-2xl">
              <div className="flex items-start space-x-4 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-4">Working Hours</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-lg p-3">
                      <span className="font-medium">Monday - Friday</span>
                      <span className="font-bold">10 AM - 6 PM</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-lg p-3">
                      <span className="font-medium">Saturday - Sunday</span>
                      <span className="font-bold">Closed</span>
                    </div>
                  </div>
                  <p className="mt-4 text-white/90 text-sm">
                    We respond to all inquiries within 24 business hours
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-10 border-2 border-gray-300 shadow-xl hover:shadow-2xl transition-all hover:border-[#8c76f0]">
              <div className="flex items-start space-x-4 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <MapPin className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Visit Us</h3>
                  <p className="text-gray-600 mb-3">Our office location</p>
                  <address className="not-italic text-gray-700 leading-relaxed">
                    <p className="font-semibold text-gray-900 mb-1">PayByCard Technologies Pvt. Ltd.</p>
                    <p>3701, IRIS, Runwal Bliss</p>
                    <p>Crompton Greaves Compound, Kanjur Marg East</p>
                    <p>Mumbai, Maharashtra 400 042</p>
                    <p className="mt-2">India</p>
                  </address>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Need Immediate Assistance?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Our support team is available during business hours to help you with any questions or concerns.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:support@paybycard.in"
              className="group relative inline-flex items-center justify-center px-10 py-4 text-base font-bold text-white transition-all duration-300 hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full blur-md group-hover:blur-lg transition-all opacity-50"></div>
              <span className="relative bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-full px-10 py-4 shadow-lg flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>Email Support</span>
              </span>
            </a>
            <a
              href="tel:+918850144143"
              className="group relative inline-flex items-center justify-center px-10 py-4 text-base font-bold transition-all duration-300 hover:scale-105"
            >
              <span className="relative bg-white border-2 border-[#8c76f0] text-[#8c76f0] rounded-full px-10 py-4 shadow-lg flex items-center space-x-2 hover:bg-purple-50">
                <Phone className="w-5 h-5" />
                <span>Call Us</span>
              </span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

import { Facebook, Twitter, Linkedin, Instagram, Mail, Phone, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const navigate = useNavigate();

  const handleNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
      return;
    }
    if (page === 'home') navigate('/');
    else if (page === 'terms') navigate('/terms-of-service');
    else if (page === 'refund') navigate('/refund-policy');
    else if (page === 'fraud') navigate('/fraud-reporting');
    else navigate(`/${page}`);
  };

  const footerLinks = {
    company: [
      { name: 'About Us', page: 'about' },
      { name: 'FAQ', page: 'faq' },
    ],
    legal: [
      { name: 'Terms & Services', page: 'terms' },
      { name: 'Privacy Policy', page: 'privacy' },
      { name: 'Refund Policy', page: 'refund' },
      { name: 'Fraud Reporting', page: 'fraud' },
    ],
  };

  return (
    <footer className="bg-gradient-to-b from-gray-50 to-gray-100 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img src="/PayByCard-Logo.png" alt="PayByCard Logo" className="w-20 h-10 object-contain" />
                <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-30"></div>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-[#8c76f0] to-purple-600 bg-clip-text text-transparent">
                PayByCard
              </span>
            </div>
            <div className="space-y-2 text-gray-600 text-sm">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-[#8c76f0]" />
                <p>PayByCard Technologies Pvt. Ltd.<br />
                3701, IRIS, Runwal Bliss, Crompton Greaves Compund, KanjurMarg East<br />
                Mumbai, Maharashtra 400 042</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-lg">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.page}>
                  <button
                    onClick={() => handleNavigate(link.page)}
                    className="text-gray-600 hover:text-[#8c76f0] transition-colors text-sm"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-lg">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.page}>
                  <button
                    onClick={() => handleNavigate(link.page)}
                    className="text-gray-600 hover:text-[#8c76f0] transition-colors text-sm"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-gray-900 font-semibold mb-4 text-lg">Connect With Us</h3>
            <div className="flex space-x-4 mb-4">
              <a href="https://www.facebook.com/PayByCardIn" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors">
                <Facebook className="w-6 h-6" />
              </a>
              <a href="https://x.com/PayByCardIN" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors">
                <Twitter className="w-6 h-6" />
              </a>
              <a href="https://linkedin.com/company/paybycard" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors">
                <Linkedin className="w-6 h-6" />
              </a>
              <a href="https://www.instagram.com/paybycardin" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#8c76f0] transition-colors">
                <Instagram className="w-6 h-6" />
              </a>
            </div>
            <div className="space-y-2 text-gray-600 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#8c76f0]" />
                <span>support@paybycard.in</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-[#8c76f0]" />
                <span>+91 88501 44143</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-300 text-center text-gray-600 text-sm">
          <p>© {new Date().getFullYear()} PayByCard Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="mt-2">CIN: U62099MH2025PTC462923</p>
        </div>
      </div>
    </footer>
  );
}

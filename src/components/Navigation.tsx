import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const navItems = [
    { name: 'Home', page: 'home' },
    { name: 'About Us', page: 'about' },
    { name: 'Terms of Service', page: 'terms' },
    { name: 'Privacy Policy', page: 'privacy' },
    { name: 'Contact', page: 'contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="relative">
              <img src="/PayByCard-Logo.png" alt="PayByCard Logo" className="w-20 h-10 object-contain" />
              <div className="absolute inset-0 bg-[#8c76f0] blur-xl opacity-30"></div>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#8c76f0] to-purple-600 bg-clip-text text-transparent">
              PayByCard
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <div className="flex space-x-8">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`relative px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    currentPage === item.page
                      ? 'text-[#8c76f0]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                  {currentPage === item.page && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#8c76f0] to-purple-600"></span>
                  )}
                </button>
              ))}
            </div>
            {!isAuthenticated && (
              <div className="flex items-center space-x-3">
                <a
                  href="/login"
                  className="px-6 py-2.5 text-sm font-medium text-[#8c76f0] border-2 border-[#8c76f0] rounded-lg hover:bg-purple-50 transition-all duration-300"
                >
                  Login
                </a>
                <a
                  href="/register"
                  className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
                >
                  Register
                </a>
              </div>
            )}
          </div>

          <button
            className="md:hidden text-gray-900"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 pt-2 pb-4 space-y-3">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => {
                  onNavigate(item.page);
                  setIsMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  currentPage === item.page
                    ? 'text-[#8c76f0] bg-purple-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </button>
            ))}
            {!isAuthenticated && (
              <div className="pt-2 space-y-2">
                <a
                  href="/login"
                  className="block w-full px-6 py-2.5 text-sm font-medium text-[#8c76f0] border-2 border-[#8c76f0] rounded-lg hover:bg-purple-50 transition-all duration-300 text-center"
                >
                  Login
                </a>
                <a
                  href="/register"
                  className="block w-full px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#8c76f0] to-purple-600 rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 text-center"
                >
                  Register
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

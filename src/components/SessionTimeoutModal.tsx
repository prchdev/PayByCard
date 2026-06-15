import { LogOut, Clock, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SessionTimeoutModal({ secondsLeft, onStay, onLogout }: SessionTimeoutModalProps) {
  const fraction = secondsLeft / 120;
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference * (1 - fraction);
  const isUrgent = secondsLeft <= 30;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Top accent bar */}
        <div className={`h-1.5 w-full transition-colors duration-500 ${isUrgent ? 'bg-red-500' : 'bg-amber-400'}`} />

        <div className="p-8">
          {/* Icon + countdown ring */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-24 h-24 mb-4">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
                {/* Track */}
                <circle
                  cx="44" cy="44" r="36"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="7"
                />
                {/* Progress */}
                <circle
                  cx="44" cy="44" r="36"
                  fill="none"
                  stroke={isUrgent ? '#ef4444' : '#f59e0b'}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock className={`w-5 h-5 mb-0.5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                <span className={`text-xl font-bold tabular-nums ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                  {fmt(secondsLeft)}
                </span>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 text-center">
              Session Expiring Soon
            </h2>
            <p className="text-gray-500 text-sm text-center mt-2 leading-relaxed">
              You have been inactive for a while. Your session will expire in{' '}
              <span className={`font-semibold ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                {fmt(secondsLeft)}
              </span>{' '}
              due to inactivity.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStay}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Stay on Page
            </button>
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

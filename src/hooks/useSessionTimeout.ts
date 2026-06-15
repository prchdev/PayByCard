import { useEffect, useRef, useCallback, useState } from 'react';

const TIMEOUT_MS = 15 * 60 * 1000;   // 15 minutes
const WARNING_MS = 2 * 60 * 1000;    // show warning at 2 minutes remaining

export function useSessionTimeout(onLogout: () => void) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = () => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  const startCountdown = useCallback(() => {
    setSecondsLeft(120);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownInterval.current) clearInterval(countdownInterval.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, TIMEOUT_MS - WARNING_MS);

    logoutTimer.current = setTimeout(() => {
      setShowWarning(false);
      onLogout();
    }, TIMEOUT_MS);
  }, [onLogout, startCountdown]);

  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

    let activityThrottle: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      // Only reset if warning is not showing — once warning is visible, user must explicitly act
      if (activityThrottle || showWarning) return;
      activityThrottle = setTimeout(() => {
        activityThrottle = null;
      }, 10_000); // throttle resets to once every 10 seconds
      resetTimers();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      clearAllTimers();
      if (activityThrottle) clearTimeout(activityThrottle);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning]);

  return { showWarning, secondsLeft, extendSession };
}

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Contest Timer Hook
 * Handles countdown with server time synchronization
 */

export function useContestTimer(endTime, options = {}) {
  const { serverTime, onEnd, syncInterval = 60000 } = options;
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  
  const endTimeRef = useRef(new Date(endTime).getTime());
  const serverOffsetRef = useRef(0);
  const intervalRef = useRef(null);

  // Calculate server time offset
  useEffect(() => {
    if (serverTime) {
      serverOffsetRef.current = serverTime - Date.now();
    }
  }, [serverTime]);

  // Get corrected current time
  const getCorrectedTime = useCallback(() => {
    return Date.now() + serverOffsetRef.current;
  }, []);

  // Calculate time left
  const calculateTimeLeft = useCallback(() => {
    const now = getCorrectedTime();
    const remaining = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
    return remaining;
  }, [getCorrectedTime]);

  // Start timer
  const start = useCallback(() => {
    if (intervalRef.current) return;
    
    setIsRunning(true);
    setIsEnded(false);
    
    // Initial calculation
    setTimeLeft(calculateTimeLeft());
    
    // Update every second
    intervalRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        stop();
        setIsEnded(true);
        onEnd?.();
      }
    }, 1000);
  }, [calculateTimeLeft, onEnd]);

  // Stop timer
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Update end time
  const updateEndTime = useCallback((newEndTime) => {
    endTimeRef.current = new Date(newEndTime).getTime();
    setTimeLeft(calculateTimeLeft());
  }, [calculateTimeLeft]);

  // Format time as HH:MM:SS
  const formatTime = useCallback((seconds) => {
    if (seconds <= 0) return '00:00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0'),
    ].join(':');
  }, []);

  // Auto-start when endTime is set
  useEffect(() => {
    if (endTime) {
      endTimeRef.current = new Date(endTime).getTime();
      const remaining = calculateTimeLeft();
      
      if (remaining > 0) {
        start();
      } else {
        setIsEnded(true);
      }
    }
    
    return () => stop();
  }, [endTime, start, stop, calculateTimeLeft]);

  return {
    timeLeft,
    formattedTime: formatTime(timeLeft),
    isRunning,
    isEnded,
    start,
    stop,
    updateEndTime,
    // Helpers
    hours: Math.floor(timeLeft / 3600),
    minutes: Math.floor((timeLeft % 3600) / 60),
    seconds: timeLeft % 60,
    // Progress (0-100)
    progress: endTime ? 
      Math.max(0, Math.min(100, (1 - timeLeft / ((new Date(endTime) - Date.now()) / 1000 + timeLeft)) * 100)) : 0,
  };
}

/**
 * Countdown to start timer
 */
export function useCountdownTimer(startTime, options = {}) {
  const { serverTime, onStart } = options;
  
  const [timeUntilStart, setTimeUntilStart] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  
  const startTimeRef = useRef(new Date(startTime).getTime());
  const serverOffsetRef = useRef(0);

  useEffect(() => {
    if (serverTime) {
      serverOffsetRef.current = serverTime - Date.now();
    }
  }, [serverTime]);

  useEffect(() => {
    if (!startTime) return;
    
    startTimeRef.current = new Date(startTime).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now() + serverOffsetRef.current;
      const remaining = Math.max(0, Math.floor((startTimeRef.current - now) / 1000));
      
      setTimeUntilStart(remaining);
      
      if (remaining <= 0 && !hasStarted) {
        setHasStarted(true);
        onStart?.();
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, hasStarted, onStart]);

  const formatCountdown = useCallback((seconds) => {
    if (seconds <= 0) return 'Started!';
    
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hrs}h ${mins}m`;
    }
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  }, []);

  return {
    timeUntilStart,
    formattedCountdown: formatCountdown(timeUntilStart),
    hasStarted,
    days: Math.floor(timeUntilStart / 86400),
    hours: Math.floor((timeUntilStart % 86400) / 3600),
    minutes: Math.floor((timeUntilStart % 3600) / 60),
    seconds: timeUntilStart % 60,
  };
}

export default useContestTimer;

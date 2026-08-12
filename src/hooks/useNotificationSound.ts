'use client';

import { useCallback } from 'react';

export function useNotificationSound() {
  const playSound = useCallback(() => {
    try {
      const audio = new Audio('/assets/sounds/notification.mp3');
      // Browsers require user interaction before playing audio, so we catch the error silently if it fails.
      audio.play().catch((e) => console.warn('Audio play prevented by browser:', e));
    } catch (error) {
      console.error('Audio error:', error);
    }
  }, []);

  return playSound;
}

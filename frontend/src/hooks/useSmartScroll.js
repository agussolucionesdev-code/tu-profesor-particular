import { useCallback, useEffect, useRef } from "react";

const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export const useSmartScroll = ({
  duration = 360,
  enableVoiceAnnouncement = false,
  voiceMessage = null,
} = {}) => {
  const scrollFrameRef = useRef(null);
  const announcementQueueRef = useRef([]);

  const processAnnouncements = useCallback(() => {
    if (!enableVoiceAnnouncement || !voiceMessage) return;
    const message = announcementQueueRef.current.shift();
    if (!message || typeof window === "undefined") return;

    const event = new CustomEvent("booking:voice-guidance", {
      detail: { message },
    });
    window.dispatchEvent(event);
  }, [enableVoiceAnnouncement, voiceMessage]);

  const detectScrollIntent = useCallback((mouseEvent, scrollContainer) => {
    if (!mouseEvent || !scrollContainer) return null;
    const rect = scrollContainer.getBoundingClientRect();
    const mouseY = mouseEvent.clientY - rect.top;
    const intentZone = rect.height * 0.15;
    const intentThreshold = 0.7;

    if (mouseY < intentZone) {
      const strength = 1 - mouseY / intentZone;
      return strength > intentThreshold ? { intent: "up", strength } : null;
    }

    if (mouseY > rect.height - intentZone) {
      const strength = (mouseY - (rect.height - intentZone)) / intentZone;
      return strength > intentThreshold ? { intent: "down", strength } : null;
    }

    return null;
  }, []);

  const smoothScrollTo = useCallback(
    (targetY, options = {}) => {
      const {
        offset = 0,
        focusElement = null,
        announceMessage = null,
        onComplete = null,
      } = options;
      const scrollContainer = options.container || window;
      const startY =
        scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
      const targetPosition = targetY + offset;
      const distance = targetPosition - startY;

      const finish = () => {
        focusElement?.focus?.({ preventScroll: true });
        if (announceMessage && enableVoiceAnnouncement) {
          announcementQueueRef.current.push(announceMessage);
          processAnnouncements();
        }
        onComplete?.();
      };

      if (Math.abs(distance) < 2 || prefersReducedMotion()) {
        if (scrollContainer === window) window.scrollTo(0, targetPosition);
        else scrollContainer.scrollTop = targetPosition;
        finish();
        return;
      }

      const startTime = performance.now();
      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentPosition = startY + distance * easeOutCubic(progress);

        if (scrollContainer === window) window.scrollTo(0, currentPosition);
        else scrollContainer.scrollTop = currentPosition;

        if (progress < 1) {
          scrollFrameRef.current = requestAnimationFrame(animateScroll);
        } else {
          finish();
        }
      };

      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = requestAnimationFrame(animateScroll);
    },
    [duration, enableVoiceAnnouncement, processAnnouncements],
  );

  const scrollToElement = useCallback(
    (element, options = {}) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      smoothScrollTo(rect.top + scrollTop, { ...options, focusElement: element });
    },
    [smoothScrollTo],
  );

  const guideToNext = useCallback(
    (currentElement, nextElement, options = {}) => {
      if (!nextElement) return;
      const { announceMessage = "Seguimos con el siguiente paso.", offset = -96 } =
        options;
      scrollToElement(nextElement, { offset, announceMessage });
      currentElement?.blur?.();
    },
    [scrollToElement],
  );

  useEffect(() => {
    const frame = scrollFrameRef.current;
    return () => {
      if (frame) cancelAnimationFrame(frame);
      announcementQueueRef.current = [];
    };
  }, []);

  return {
    detectScrollIntent,
    smoothScrollTo,
    scrollToElement,
    guideToNext,
  };
};

export default useSmartScroll;

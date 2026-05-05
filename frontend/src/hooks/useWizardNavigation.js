import { startTransition, useCallback, useState } from "react";

// Pure state for wizard step navigation. Side effects (scroll, voice, sound) are composed by the consumer.
export const useWizardNavigation = (totalSteps, initialStep = 1) => {
  if (
    import.meta.env.DEV &&
    (initialStep < 1 || initialStep > totalSteps)
  ) {
    console.warn(
      `[useWizardNavigation] initialStep ${initialStep} is out of range [1, ${totalSteps}]. Falling back to 1.`,
    );
  }

  const safeInitialStep =
    initialStep < 1 || initialStep > totalSteps ? 1 : initialStep;

  const [currentStep, setCurrentStep] = useState(safeInitialStep);
  const [slideDirection, setSlideDirection] = useState("forward");

  const goToStep = useCallback(
    (targetStep) => {
      if (targetStep === currentStep) return false;
      if (targetStep < 1 || targetStep > totalSteps) return false;

      setSlideDirection(targetStep > currentStep ? "forward" : "backward");
      startTransition(() => {
        setCurrentStep(targetStep);
      });
      return true;
    },
    [currentStep, totalSteps],
  );

  const resetToFirstStep = useCallback(() => {
    setSlideDirection("forward");
    setCurrentStep(safeInitialStep);
  }, [safeInitialStep]);

  return {
    currentStep,
    slideDirection,
    isFirstStep: currentStep === safeInitialStep,
    isLastStep: currentStep === totalSteps,
    goToStep,
    resetToFirstStep,
  };
};

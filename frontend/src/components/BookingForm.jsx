import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import DatePicker, { registerLocale } from "react-datepicker";
import {
  addMinutes,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import es from "date-fns/locale/es";
import {
  FaWhatsapp,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaInfoCircle,
  FaExclamationCircle,
  FaLightbulb,
  FaCalendarCheck,
  FaArrowRight,
  FaArrowLeft,
  FaHourglassHalf,
  FaShieldAlt,
  FaTicketAlt,
  FaTimesCircle,
  FaUserLock,
  FaChevronLeft,
  FaChevronRight,
  FaSearchPlus,
  FaTimes,
  FaVolumeUp,
} from "react-icons/fa";
import BookingConfirmationSummary from "./booking/BookingConfirmationSummary";
import BookingSuccessModal from "./booking/BookingSuccessModal";
import PersonalInfoStep from "./booking/steps/PersonalInfoStep";
import AcademicInfoStep from "./booking/steps/AcademicInfoStep";
import DateSelectionStep from "./booking/steps/DateSelectionStep";
import TimeSelectionStep from "./booking/steps/TimeSelectionStep";
import ConfirmationStep from "./booking/steps/ConfirmationStep";
import { createBooking, fetchPublicSettings } from "../api/bookingApi";
import { useBookingWizard } from "../hooks/useBookingWizard";
import { useBookingAvailability } from "../hooks/useBookingAvailability";
import { useWizardNavigation } from "../hooks/useWizardNavigation";
import {
  BOOKING_SUPPORT_PILLS,
  WIZARD_STEPS,
} from "../constants/bookingWizard";
import {
  ADULT_RELATIONSHIP_VALUE,
  formatDurationOptionLabel,
  formatDurationVoiceLabel,
  formatResponsibleRelationshipLabel,
  getBookingApiMessage,
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
} from "../utils/bookingFormatters";
import {
  isVoiceMuted,
  primeVoicePlayback,
  setVoiceMuted,
  speakAlert,
  spellCodeForVoice,
  useNeuroToast,
} from "../utils/neuroToast";
import "../styles/tokens.css";
import "../index.css";
import "./BookingForm.css";
import "./booking/BookingFinalExperience.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";
import "../styles/confirmation-ux.css";

registerLocale("es", es);

const STEP_VOICE_OPTIONS = {
  rate: 0.86,
  pitch: 0.98,
  volume: 0.9,
};

const STEP_VOICE_GUIDANCE = {
  1: "Empezamos simple. Completá solo lo necesario y avanzamos de a poco, sin apuro. Yo te acompaño para que el turno quede claro desde el primer intento.",
  2: "Muy bien. Ahora elegí el día que te dé más tranquilidad. Te muestro opciones disponibles para que no tengas que adivinar ni preocuparte por cruces.",
  3: "Ya tenemos el día. Elegí el horario que mejor encaje con tu rutina; cuando lo marques, te llevo al resumen para cerrar todo con calma.",
  4: "Último tramo. Revisá el resumen, elegí la duración ideal y confirmamos solo cuando todo se sienta correcto.",
};

const VOICE_TIP_KEY = "voice_guide_tip_dismissed";
const VOICE_CHANGE_EVENT = "neuro-voice-muted-changed";

const BookingForm = () => {
  const supportPillIcons = [FaCheckCircle, FaWhatsapp, FaUserLock];
  const sliderWindowRef = useRef(null);
  const slideRefs = useRef({});

  const {
    currentStep,
    slideDirection,
    isFirstStep,
    goToStep: navigateToStep,
    resetToFirstStep,
  } = useWizardNavigation(WIZARD_STEPS.length);

  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [pricePerHour, setPricePerHour] = useState(0);
  const [stepOneSection, setStepOneSection] = useState("personal");
  const { toast, showToast } = useNeuroToast({ duration: 4500 });

  useEffect(() => {
    fetchPublicSettings()
      .then((res) => {
        const price = Number(res.data?.data?.["booking.pricePerHour"] ?? 0);
        if (price > 0) setPricePerHour(price);
      })
      .catch(() => {});
  }, []);

  const [showVoiceTip, setShowVoiceTip] = useState(() => {
    try {
      return (
        isVoiceMuted() &&
        window.localStorage.getItem(VOICE_TIP_KEY) !== "true"
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleVoiceChange = (e) => {
      const muted =
        typeof e.detail?.muted === "boolean" ? e.detail.muted : isVoiceMuted();
      if (!muted) setShowVoiceTip(false);
    };
    window.addEventListener(VOICE_CHANGE_EVENT, handleVoiceChange);
    return () =>
      window.removeEventListener(VOICE_CHANGE_EVENT, handleVoiceChange);
  }, []);

  const activateVoiceGuide = () => {
    setVoiceMuted(false);
    setShowVoiceTip(false);
    try {
      window.localStorage.setItem(VOICE_TIP_KEY, "true");
    } catch {
      // ignore
    }
    primeVoicePlayback({
      message: STEP_VOICE_GUIDANCE[1],
      voiceOptions: STEP_VOICE_OPTIONS,
    });
  };

  const dismissVoiceTip = () => {
    setShowVoiceTip(false);
    try {
      window.localStorage.setItem(VOICE_TIP_KEY, "true");
    } catch {
      // ignore
    }
  };

  const {
    formData,
    setFormData,
    isAdult,
    hasAttemptedNext,
    setHasAttemptedNext,
    hasUnlockedAcademic,
    hasUnlockedComments,
    isValidField,
    isPersonalInfoComplete,
    isAcademicInfoComplete,
    canProceedToStep2,
    handleChange,
    toggleAdultMode,
    resetForm,
    getFieldStateClass,
    completionPercent,
    requiredChecks,
  } = useBookingWizard(showToast);

  const {
    availableSlots,
    slotSections,
    getDayClassName,
    renderDayContents,
    isDateAvailable,
    maxAllowedDuration,
    durationOptions,
    availableSlotCount,
    nextFreeSlot,
    selectedDayOnly,
  } = useBookingAvailability(formData.timeSlot, showToast);

  const [sliderHeight, setSliderHeight] = useState(0);
  const [isDesktopCalendarViewport, setIsDesktopCalendarViewport] = useState(
    () => {
      if (typeof window === "undefined") return false;
      return window.matchMedia("(min-width: 1024px)").matches;
    },
  );
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  const formCardRef = useRef(null);
  const textareaRef = useRef(null);
  const prevUnlockedAcademicRef = useRef(false);
  const prevUnlockedCommentsRef = useRef(false);

  const playStepSound = () => {};
  const playUnlockSound = () => {};

  useEffect(() => {
    if (!isPersonalInfoComplete) {
      setStepOneSection("personal");
    }
  }, [isPersonalInfoComplete]);

  const syncSliderHeight = useCallback(() => {
    const activePanel = slideRefs.current[currentStep];
    if (!activePanel) return;

    const nextHeight = activePanel.scrollHeight;
    if (nextHeight) {
      setSliderHeight(nextHeight);
    }
  }, [currentStep]);

  const smoothScrollToStep = useCallback(
    (
      targetStep = currentStep,
      { selector = ".section-title", delay = 170 } = {},
    ) => {
      if (typeof window === "undefined") return;

      window.setTimeout(() => {
        const navHeight =
          document.querySelector(".navbar-elite")?.getBoundingClientRect()
            .height ?? 0;
        const activePanel = slideRefs.current[targetStep];
        const scrollAnchor =
          (selector ? activePanel?.querySelector(selector) : null) ||
          activePanel?.querySelector(".section-title") ||
          formCardRef.current?.querySelector(".journey-compass") ||
          formCardRef.current;

        if (!scrollAnchor) return;

        const prefersReducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        )?.matches;
        const breathingRoom = window.innerWidth < 768 ? 14 : 24;
        const top =
          scrollAnchor.getBoundingClientRect().top +
          window.scrollY -
          navHeight -
          breathingRoom;

        window.scrollTo({
          top: Math.max(0, top),
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });

        // Guide Focus: Focus the first invalid or first empty field in the step
        if (targetStep === 1) {
          const firstField = activePanel.querySelector(
            "input, select, textarea",
          );
          firstField?.focus({ preventScroll: true });
        }
      }, delay);
    },
    [currentStep],
  );

  const speakWarmGuidance = useCallback((message) => {
    if (!message) return;

    const didStartVoice = primeVoicePlayback({
      message,
      voiceOptions: STEP_VOICE_OPTIONS,
    });

    if (!didStartVoice) {
      speakAlert(message, STEP_VOICE_OPTIONS);
    }
  }, []);

  const scrollToStepAction = useCallback(
    (targetStep = currentStep) => {
      smoothScrollToStep(targetStep, {
        selector:
          ".btn-stage-next.is-ready, .btn-neuro-primary.btn-ready, .btn-neuro-success.ready-to-pulse, .calendar-selection-banner.is-active, .duration-summary-card.is-ready",
        delay: 260,
      });
    },
    [currentStep, smoothScrollToStep],
  );

  const scrollToStepIssue = useCallback(
    (targetStep = currentStep, selector = ".section-title") => {
      smoothScrollToStep(targetStep, {
        selector,
        delay: 140,
      });
    },
    [currentStep, smoothScrollToStep],
  );

  useEffect(() => {
    const activeTitle = formCardRef.current?.querySelector(
      ".active-panel .section-title",
    );
    activeTitle?.focus({ preventScroll: true });
  }, [currentStep]);

  useEffect(() => {
    syncSliderHeight();

    const activePanel = slideRefs.current[currentStep];
    if (!activePanel) return undefined;

    const rafId = window.requestAnimationFrame(syncSliderHeight);
    let observer;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => syncSliderHeight());
      observer.observe(activePanel);
    }

    window.addEventListener("resize", syncSliderHeight);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", syncSliderHeight);
    };
  }, [
    currentStep,
    isAdult,
    formData.educationLevel,
    formData.yearGrade,
    formData.subject,
    formData.school,
    formData.email,
    formData.academicSituation,
    formData.timeSlot,
    formData.duration,
    availableSlots.length,
    syncSliderHeight,
  ]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.academicSituation]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const media = window.matchMedia("(min-width: 1024px)");
    const syncViewport = (event) => setIsDesktopCalendarViewport(event.matches);

    setIsDesktopCalendarViewport(media.matches);
    media.addEventListener("change", syncViewport);

    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isDesktopCalendarViewport || currentStep !== 2) {
      setIsCalendarExpanded(false);
    }
  }, [currentStep, isDesktopCalendarViewport]);

  useEffect(() => {
    if (!isCalendarExpanded) return undefined;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsCalendarExpanded(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCalendarExpanded]);

  const completedRequiredFields = requiredChecks.filter(Boolean).length;
  const currentStepInfo = WIZARD_STEPS.find((step) => step.id === currentStep);
  const nextStepInfo = WIZARD_STEPS.find((step) => step.id === currentStep + 1);
  const getSlidePanelA11y = (stepId) => {
    const isActive = currentStep === stepId;
    return {
      "aria-hidden": !isActive,
      inert: !isActive,
    };
  };
  const stepperFlowCopy = nextStepInfo
    ? `Completá este tramo y enseguida seguimos con ${nextStepInfo.label.toLowerCase()}.`
    : "Ya estás en el cierre final: revisá el resumen y confirmá tu reserva.";
  const stepperInteractionCopy =
    currentStep > 1
      ? "Podés tocar cualquier paso completado para volver sin perder lo que ya cargaste."
      : "Vamos habilitando cada paso en orden para que la reserva quede clara, prolija y sin errores.";
  const isTimeSelected = Boolean(
    formData.timeSlot && formData.timeSlot.getHours() !== 0,
  );
  const stepProgressWidth =
    ((currentStep - 1) / Math.max(WIZARD_STEPS.length - 1, 1)) * 100;
  const confirmationDateLabel =
    formData.timeSlot && formData.timeSlot.getHours() > 0
      ? format(formData.timeSlot, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
      : "";
  const confirmationDurationLabel = formData.duration
    ? formatDurationOptionLabel(formData.duration)
    : "";
  const confirmationTimeRangeLabel =
    formData.timeSlot && formData.timeSlot.getHours() > 0
      ? `${format(formData.timeSlot, "HH:mm")} a ${
          formData.duration
            ? format(
                addMinutes(formData.timeSlot, Number(formData.duration) * 60),
                "HH:mm",
              )
            : "--:--"
        } hs`
      : "";
  const confirmationEducationLabel = [
    formData.educationLevel,
    formData.yearGrade,
  ]
    .filter(Boolean)
    .join(" - ");
  const confirmationLookupHint =
    "Después de confirmar te mostramos un código grande para usar en Mis Turnos. Si no lo tenés a mano, también podés entrar con el email o el número de teléfono cargados.";
  const responsibleRelationshipLabel = formatResponsibleRelationshipLabel(
    isAdult ? ADULT_RELATIONSHIP_VALUE : formData.responsibleRelationship,
    formData.responsibleRelationshipOther,
  );
  const isConfirmationReady = Number(formData.duration) >= 0.5;

  // Scroll into view when a new progressive-disclosure section unlocks
  useEffect(() => {
    if (hasUnlockedAcademic && !prevUnlockedAcademicRef.current) {
      playUnlockSound();
      window.setTimeout(() => {
        const panel = slideRefs.current[1];
        const anchor = panel?.querySelectorAll(".progressive-disclosure-grid.is-active")?.[0];
        if (!anchor) return;
        const navH = document.querySelector(".navbar-elite")?.getBoundingClientRect().height ?? 0;
        const top = anchor.getBoundingClientRect().top + window.scrollY - navH - 20;
        const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced ? "auto" : "smooth" });
      }, 320);
    }
    prevUnlockedAcademicRef.current = hasUnlockedAcademic;
  }, [hasUnlockedAcademic]);

  useEffect(() => {
    if (hasUnlockedComments && !prevUnlockedCommentsRef.current) {
      playUnlockSound();
      window.setTimeout(() => {
        const panel = slideRefs.current[1];
        const sections = panel?.querySelectorAll(".progressive-disclosure-grid.is-active");
        const anchor = sections?.[sections.length - 1];
        if (!anchor) return;
        const navH = document.querySelector(".navbar-elite")?.getBoundingClientRect().height ?? 0;
        const top = anchor.getBoundingClientRect().top + window.scrollY - navH - 20;
        const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced ? "auto" : "smooth" });
      }, 320);
    }
    prevUnlockedCommentsRef.current = hasUnlockedComments;
  }, [hasUnlockedComments]);

  const getYearGradeOptions = () => {
    const level = formData.educationLevel;
    if (level === "Primaria")
      return [
        "1er grado",
        "2do grado",
        "3er grado",
        "4to grado",
        "5to grado",
        "6to grado",
      ];
    if (level === "Secundaria" || level === "Secundaria Tecnica")
      return [
        "1er año",
        "2do año",
        "3er año",
        "4to año",
        "5to año",
        "6to año",
        level === "Secundaria Tecnica" ? "7mo año" : null,
      ].filter(Boolean);
    if (level === "Terciario" || level === "Universitario")
      return [
        "1er año",
        "2do año",
        "3er año",
        "4to año",
        "5to año",
        "6to año",
        "Avanzado",
      ];
    return [];
  };

  const validateStep = (step) => {
    if (step === 1 && !canProceedToStep2) {
      setHasAttemptedNext(true);
      showToast(
        "Faltan algunos datos. Revisa los campos resaltados para continuar.",
        "error",
        {
          title: "Revisemos este paso",
          speak:
            "Nos falta completar algunos datos. No pasa nada: revisá los campos señalados con calma y seguimos cuando esté listo.",
          voiceOptions: STEP_VOICE_OPTIONS,
        },
      );
      scrollToStepIssue(
        1,
        ".premium-input.error, .neuro-input-wrapper.error, .neuro-toggle-wrapper.error, .section-title",
      );
      return false;
    }
    if (step === 2 && !formData.timeSlot) {
      showToast(
        "Elegí una fecha en el calendario para descubrir los horarios libres.",
        "warning",
        {
          title: "Elegí una fecha",
          speak:
            "Para seguir, elegí una fecha disponible en el calendario. Después te llevo a los horarios libres, paso a paso.",
          voiceOptions: STEP_VOICE_OPTIONS,
        },
      );
      scrollToStepIssue(2, ".calendar-glass-box, .section-title");
      return false;
    }
    if (
      step === 3 &&
      (!formData.timeSlot || formData.timeSlot.getHours() === 0)
    ) {
      showToast(
        "Seleccioná el horario que mejor se adapte a vos para continuar.",
        "warning",
        {
          title: "Falta el horario",
          speak:
            "Ya tenemos el día. Ahora elegí un horario libre que te resulte cómodo; después revisamos todo antes de confirmar.",
          voiceOptions: STEP_VOICE_OPTIONS,
        },
      );
      scrollToStepIssue(3, ".slot-btn:not(.disabled), .section-title");
      return false;
    }
    return true;
  };

  const goToStep = (targetStep) => {
    if (!navigateToStep(targetStep)) return;

    playStepSound();
    smoothScrollToStep(targetStep);
    speakWarmGuidance(STEP_VOICE_GUIDANCE[targetStep]);
  };

  const handleStepClick = (targetStep) => {
    if (targetStep >= currentStep) return;
    goToStep(targetStep);
  };

  const goToNext = () => {
    if (validateStep(currentStep)) {
      setHasAttemptedNext(false);
      goToStep(currentStep + 1);
    }
  };

  const goToPrev = () => {
    if (isFirstStep) return;
    goToStep(currentStep - 1);
  };

  const openCalendarExpanded = () => {
    if (!isDesktopCalendarViewport) return;
    setIsCalendarExpanded(true);
  };

  const closeCalendarExpanded = () => {
    setIsCalendarExpanded(false);
  };

  const handleProceedToTimeStep = () => {
    if (!formData.timeSlot) {
      showToast(
        "Elegí una fecha en el calendario para descubrir los horarios libres.",
        "warning",
        {
          title: "Elegí una fecha",
          speak:
            "Primero elegí una fecha disponible. Apenas la marques, te dejo listo el avance a horarios sin que tengas que buscar de más.",
          voiceOptions: STEP_VOICE_OPTIONS,
        },
      );
      scrollToStepIssue(2, ".calendar-glass-box, .section-title");
      return;
    }

    goToNext();
  };

  const handleProceedToConfirmationStep = () => {
    if (!isTimeSelected) {
      showToast(
        "Seleccioná el horario que mejor se adapte a vos para continuar.",
        "warning",
        {
          title: "Elegí un horario",
          speak:
            "Te falta elegir un horario libre. Cuando lo marques, avanzamos al resumen final para que confirmes con seguridad.",
          voiceOptions: STEP_VOICE_OPTIONS,
        },
      );
      scrollToStepIssue(3, ".slot-btn:not(.disabled), .section-title");
      return;
    }

    goToNext();
  };

  const handleDateSelect = (date) => {
    if (!date) return;

    if (formData.timeSlot && isSameDay(date, formData.timeSlot)) {
      setFormData((prev) => ({ ...prev, timeSlot: null }));
      playStepSound();
      scrollToStepIssue(2, ".calendar-glass-box, .calendar-selection-banner");
      speakWarmGuidance(
        "Fecha quitada. Elegí otro día disponible cuando quieras; seguimos con los horarios libres sin perder lo que ya completaste.",
      );
    } else {
      setFormData((prev) => ({ ...prev, timeSlot: startOfDay(date) }));
      playUnlockSound();
      if (isCalendarExpanded) {
        setIsCalendarExpanded(false);
      }
      scrollToStepAction(2);
      speakWarmGuidance(
        "Fecha elegida. Bien: ahora tocá el botón para ver horarios disponibles y elegir el que te quede más cómodo.",
      );
    }
  };

  const clearDateSelection = () => {
    setFormData((prev) => ({ ...prev, timeSlot: null }));
    playStepSound();
    scrollToStepIssue(2, ".calendar-glass-box, .calendar-selection-banner");
    speakWarmGuidance(
      "Fecha quitada. Cuando quieras, elegí otra fecha disponible y seguimos con calma.",
    );
  };

  const handleTimeSelect = (timeObj) => {
    if (
      formData.timeSlot &&
      formData.timeSlot.getTime() === timeObj.getTime()
    ) {
      setFormData((prev) => ({
        ...prev,
        timeSlot: prev.timeSlot ? startOfDay(prev.timeSlot) : null,
      }));
      playStepSound();
      scrollToStepIssue(3, ".slot-btn:not(.disabled), .section-title");
      speakWarmGuidance(
        "Horario quitado. Elegí otro bloque libre y seguimos sin apuro.",
      );
    } else {
      setFormData((prev) => ({ ...prev, timeSlot: timeObj }));
      playUnlockSound();
      scrollToStepAction(3);
      speakWarmGuidance(
        `Horario elegido: a las ${format(timeObj, "HH:mm")}. Perfecto. Ahora revisamos el resumen y ajustamos la duración ideal.`,
      );
    }
  };

  const clearTimeSelection = () => {
    setFormData((prev) => ({
      ...prev,
      timeSlot: prev.timeSlot ? startOfDay(prev.timeSlot) : null,
    }));
    playStepSound();
    scrollToStepIssue(3, ".slot-btn:not(.disabled), .section-title");
    speakWarmGuidance(
      "Horario quitado. Podés tocar cualquier bloque libre para elegir uno nuevo.",
    );
  };

  const selectedDayLabel = selectedDayOnly
    ? format(selectedDayOnly, "EEEE d 'de' MMMM 'de' yyyy", {
        locale: es,
      })
    : "";
  const selectedTimeLabel = isTimeSelected
    ? `${format(formData.timeSlot, "HH:mm")} hs`
    : "";

  useEffect(() => {
    if (formData.duration !== "" && formData.duration > maxAllowedDuration) {
      setFormData((prev) => ({ ...prev, duration: maxAllowedDuration }));
    }
  }, [maxAllowedDuration, formData.timeSlot, formData.duration, setFormData]);

  const handleDurationSelect = (duration) => {
    if (duration > maxAllowedDuration) {
      showToast(
        `El límite para este turno es ${formatDurationOptionLabel(maxAllowedDuration)}.`,
        "warning",
      );
      return;
    }
    setFormData((prev) => ({ ...prev, duration }));
    scrollToStepAction(4);
    speakWarmGuidance(
      `Duración elegida: ${formatDurationVoiceLabel(duration)}. Revisá el resumen con tranquilidad y confirmá solo si todo está correcto.`,
    );
  };

  const resetFormAfterSuccess = () => {
    setShowModal(false);
    resetForm();
    resetToFirstStep();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    primeVoicePlayback();
    setLoading(true);
    setLoadingPhase(0);
    const phaseTimers = [];
    phaseTimers.push(window.setTimeout(() => setLoadingPhase(1), 1800));
    phaseTimers.push(window.setTimeout(() => setLoadingPhase(2), 3500));
    phaseTimers.push(window.setTimeout(() => setLoadingPhase(3), 5500));
    try {
      const dateObj = formData.timeSlot;
      const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
      const finalResponsibleName = isAdult
        ? "Mayor de edad / Responsable"
        : formData.responsibleName;
      const finalResponsibleRelationship = isAdult
        ? ADULT_RELATIONSHIP_VALUE
        : formData.responsibleRelationship;
      const finalResponsibleRelationshipOther =
        finalResponsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE
          ? formData.responsibleRelationshipOther.trim()
          : "";
      const safeEmail =
        formData.email.trim() !== "" ? formData.email.trim() : "";

      const response = await createBooking({
        ...formData,
        email: safeEmail,
        responsibleName: finalResponsibleName,
        responsibleRelationship: finalResponsibleRelationship,
        responsibleRelationshipOther: finalResponsibleRelationshipOther,
        timeSlot: formattedDate,
        duration: Number(formData.duration),
        tutorName: "Agustin",
      });

      const end = addMinutes(dateObj, Number(formData.duration) * 60);
      const bookingCode = response.data.data.bookingCode;
      const managementMethods = [
        {
          label: "Código",
          value: bookingCode,
          helper: "Pegalo tal cual en Mis Turnos.",
        },
        ...(safeEmail
          ? [
              {
                label: "Email",
                value: safeEmail,
                helper: "También te sirve para volver a encontrar la reserva.",
              },
            ]
          : []),
        ...(formData.phone
          ? [
              {
                label: "Teléfono",
                value: formData.phone,
                helper: "Usa el mismo número que cargaste al reservar.",
              },
            ]
          : []),
      ];
      setSuccessData({
        bookingCode,
        day: format(dateObj, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
        startTime: format(dateObj, "HH:mm"),
        endTime: format(end, "HH:mm"),
        actualDuration: formData.duration,
        durationLabel: formatDurationOptionLabel(formData.duration),
        cleanStudentName: formData.studentName,
        responsibleLabel: isAdult
          ? "Alumno mayor de edad"
          : formData.responsibleName,
        responsibleRelationshipLabel,
        email: safeEmail,
        phone: formData.phone,
        subject: formData.subject,
        school: formData.school,
        educationLevel: confirmationEducationLabel || formData.educationLevel,
        notifications: response.data.notifications || null,
        managementMethods,
      });
      setShowModal(true);
      speakAlert(
        `Reserva confirmada. Gracias por confiar en este espacio. Tu turno quedó agendado para ${format(
          dateObj,
          "EEEE d 'de' MMMM",
          { locale: es },
        )} a las ${format(dateObj, "HH:mm")} horas. Guardá el código ${spellCodeForVoice(
          bookingCode,
        )}. Te voy a esperar en Mis Turnos para cualquier cambio, con ese código, tu correo o tu número de teléfono.`,
        STEP_VOICE_OPTIONS,
      );
    } catch (error) {
      console.error("Error al reservar:", error);
      showToast(getBookingApiMessage(error), "error");
    } finally {
      phaseTimers.forEach((t) => window.clearTimeout(t));
      setLoadingPhase(0);
      setLoading(false);
    }
  };

  const copyBookingCode = async () => {
    if (!successData?.bookingCode) return;
    primeVoicePlayback();
    try {
      await navigator.clipboard.writeText(successData.bookingCode);
      showToast(
        "Código copiado. Ya podés guardarlo o compartirlo.",
        "success",
        {
          title: "Código listo",
          detail: "Lo vas a usar después en Mis Turnos.",
          speak: `Código ${spellCodeForVoice(successData.bookingCode)} copiado. Ya podés guardarlo con tranquilidad para gestionar el turno después.`,
        },
      );
    } catch {
      showToast(
        "No pude copiarlo automáticamente. Seleccionalo manualmente.",
        "warning",
        {
          title: "Copia manual",
          speak:
            "No pude copiar el código de forma automática. Podés seleccionarlo manualmente desde el comprobante.",
        },
      );
    }
  };

  const whatsappConfirmText = successData
    ? `Hola Prof. Agustín. Acabo de reservar un turno.\n\nAlumno: ${successData.cleanStudentName}\nResponsable: ${successData.responsibleLabel}\nParentesco: ${successData.responsibleRelationshipLabel}\nFecha: ${successData.day}\nHorario: ${successData.startTime} a ${successData.endTime} hs (${successData.actualDuration} hs)\nCódigo: ${successData.bookingCode}\nGestión: después voy a entrar en Mis Turnos con este código.\n\nGracias.`
    : "";
  const toastMeta = {
    success: {
      icon: <FaCheckCircle />,
      title: "Todo listo",
    },
    warning: {
      icon: <FaExclamationCircle />,
      title: "Atención",
    },
    error: {
      icon: <FaTimesCircle />,
      title: "Revisa esto",
    },
    info: {
      icon: <FaInfoCircle />,
      title: "Acompañamiento",
    },
  }[toast.type || "info"];

  const renderCalendarHeader =
    (monthsCount = 1) =>
    ({
      date,
      decreaseMonth,
      increaseMonth,
      prevMonthButtonDisabled,
      nextMonthButtonDisabled,
      customHeaderCount,
    }) => {
      const canGoPrev = customHeaderCount === 0;
      const canGoNext = customHeaderCount === monthsCount - 1;

      return (
        <div
          className={`booking-datepicker-header ${monthsCount > 1 ? "is-expanded" : ""}`}
        >
          <button
            type="button"
            className="booking-month-nav"
            onClick={decreaseMonth}
            disabled={prevMonthButtonDisabled || !canGoPrev}
            aria-label="Mes anterior"
          >
            <FaChevronLeft />
          </button>

          <div className="booking-month-copy">
            {monthsCount > 1 && (
              <span className="booking-month-kicker">
                {customHeaderCount === 0 ? "Mes actual" : "Mes siguiente"}
              </span>
            )}
            <strong>{format(date, "MMMM yyyy", { locale: es })}</strong>
          </div>

          <button
            type="button"
            className="booking-month-nav"
            onClick={increaseMonth}
            disabled={nextMonthButtonDisabled || !canGoNext}
            aria-label="Mes siguiente"
          >
            <FaChevronRight />
          </button>
        </div>
      );
    };

  return (
    <div className="booking-page-wrapper">
      <div
        className={`neuro-toast ${toast.show ? "show" : ""} ${toast.type}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={`toast-icon-shell ${toast.type || "info"}`}>
          {toastMeta.icon}
        </div>
        <div className="toast-copy">
          <strong>{toast.title || toastMeta.title}</strong>
          <span>{toast.message}</span>
          {toast.detail ? <small>{toast.detail}</small> : null}
        </div>
      </div>

      <div className="form-card-elevation" ref={formCardRef}>
        <div className="card-top-actions">
          <Link to="/portal" className="manage-booking-link">
            <FaTicketAlt /> Ver mis turnos
          </Link>
        </div>

        <div className="form-header-neuro">
          <span className="form-supertitle">SISTEMA DE GESTIÓN DE TURNOS</span>
          <h2 className="form-main-title">Asegurá tu clase</h2>
          <p className="form-subtitle">
            Completá tus datos y elegí el momento ideal para aprender.
          </p>
          <div
            className="form-support-strip"
            aria-label="Beneficios del sistema de reserva"
          >
            {BOOKING_SUPPORT_PILLS.map((pill, index) => {
              const Icon = supportPillIcons[index];
              return (
                <div key={pill} className="support-pill">
                  <Icon />
                  <span>{pill}</span>
                </div>
              );
            })}
          </div>

          {showVoiceTip && (
            <div className="voice-guide-tip" role="note" aria-label="Sugerencia: guía por voz disponible">
              <span className="voice-tip-icon" aria-hidden="true">
                <FaVolumeUp />
              </span>
              <div className="voice-tip-copy">
                <strong>Guía por voz disponible</strong>
                <span>Te acompaño paso a paso con voz cálida mientras reservás.</span>
              </div>
              <button
                type="button"
                className="voice-tip-activate"
                onClick={activateVoiceGuide}
              >
                Activar
              </button>
              <button
                type="button"
                className="voice-tip-dismiss"
                onClick={dismissVoiceTip}
                aria-label="Cerrar sugerencia"
              >
                <FaTimes />
              </button>
            </div>
          )}
        </div>

        <section
          className="journey-compass"
          aria-labelledby="journey-step-title"
          aria-live="polite"
        >
          <div className="journey-copy">
            <span className="journey-kicker">
              Paso {currentStep} de {WIZARD_STEPS.length}
            </span>
            <div className="journey-heading-row">
              <h3 id="journey-step-title">{currentStepInfo?.title}</h3>
              {nextStepInfo && (
                <span className="journey-next-pill">
                  Sigue: {nextStepInfo.label}
                </span>
              )}
            </div>
            <p className="journey-one-line">{currentStepInfo?.message}</p>
            <div
              className="journey-chip-row"
              aria-label="Claves del paso actual"
            >
              {currentStepInfo?.chips?.map((chip) => (
                <span key={chip} className="journey-mini-chip">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div
            className="journey-meter"
            aria-label="Datos requeridos completos"
          >
            <span>{completionPercent}%</span>
            <div className="journey-meter-track">
              <div style={{ width: `${completionPercent}%` }}></div>
            </div>
            <small className="journey-meter-copy">
              {completedRequiredFields} de {requiredChecks.length} datos clave
            </small>
          </div>
        </section>

        <div
          className="neuro-stepper"
          role="progressbar"
          aria-label="Progreso de reserva"
          aria-valuemin="1"
          aria-valuemax={WIZARD_STEPS.length}
          aria-valuenow={currentStep}
        >
          <div className="stepper-head">
            <div className="stepper-head-copy">
              <span className="stepper-kicker">Recorrido guiado</span>
              <div className="stepper-context-row">
                <strong className="stepper-head-title">
                  {currentStepInfo?.label}
                </strong>
                <span className="stepper-current-pill">
                  {currentStep} / {WIZARD_STEPS.length}
                </span>
              </div>
              <p>{stepperFlowCopy}</p>
            </div>
            <p className="stepper-nav-hint">{stepperInteractionCopy}</p>
          </div>

          <div className="stepper-progress-rail" aria-hidden="true">
            <div className="stepper-progress-bar">
              <div
                className="stepper-progress-fill"
                style={{ width: `${stepProgressWidth}%` }}
              ></div>
            </div>
          </div>

          <div className="stepper-grid">
            {WIZARD_STEPS.map((step) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const isUpcoming = step.id === currentStep + 1;
              const stepState = isCompleted
                ? "completed"
                : isCurrent
                  ? "current"
                  : isUpcoming
                    ? "upcoming"
                    : "locked";
              const stepStatusLabel = isCompleted
                ? "Listo"
                : isCurrent
                  ? "Ahora"
                  : isUpcoming
                    ? "Sigue"
                    : "Después";
              const stepHint = isCompleted
                ? "Tocá para volver"
                : isCurrent
                  ? "Estás aquí"
                  : isUpcoming
                    ? "Se habilita al completar este paso"
                    : "Aún bloqueado";

              return (
                <button
                  type="button"
                  key={step.id}
                  className={`stepper-item is-${stepState} ${isCompleted ? "is-clickable" : ""}`}
                  onClick={() => handleStepClick(step.id)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={
                    isCompleted
                      ? `Volver a ${step.label}`
                      : isCurrent
                        ? `${step.label} es el paso actual`
                        : `${step.label} se habilita más adelante`
                  }
                  disabled={step.id > currentStep}
                >
                  <span className="step-node">
                    <span
                      className={`step-circle ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                    >
                      {isCompleted ? (
                        <FaCheckCircle className="check-icon" />
                      ) : (
                        step.id
                      )}
                    </span>
                  </span>

                  <span className="step-card">
                    <span className="step-card-meta">
                      <span className={`step-status-pill is-${stepState}`}>
                        {stepStatusLabel}
                      </span>
                      <span className="step-action-hint">{stepHint}</span>
                    </span>
                    <span
                      className={`step-label ${currentStep >= step.id ? "active-label" : ""}`}
                    >
                      {step.label}
                    </span>
                    <small className="step-caption">{step.title}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={sliderWindowRef}
          className={`form-slider-window ${slideDirection === "backward" ? "is-backward" : "is-forward"}`}
          style={{ height: sliderHeight ? `${sliderHeight}px` : "auto" }}
        >
          <div
            className="form-slider-track"
            style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
          >
            {/* =======================================
                PASO 1: DATOS (DISENO PREMIUM SaaS)
                ======================================= */}
            <div
              ref={(element) => {
                slideRefs.current[1] = element;
              }}
              className={`form-slide-panel ${currentStep === 1 ? "active-panel" : ""}`}
              {...getSlidePanelA11y(1)}
            >
                <PersonalInfoStep
                  formData={formData}
                  isAdult={isAdult}
                  isVisible={stepOneSection === "personal"}
                  hasAttemptedNext={hasAttemptedNext}
                  setHasAttemptedNext={setHasAttemptedNext}
                  isValidField={isValidField}
                  getFieldStateClass={getFieldStateClass}
                  handleChange={handleChange}
                  toggleAdultMode={toggleAdultMode}
                  onContinueToAcademic={() => setStepOneSection("academic")}
                />

              <AcademicInfoStep
                formData={formData}
                isAdult={isAdult}
                isVisible={stepOneSection === "academic"}
                hasAttemptedNext={hasAttemptedNext}
                setHasAttemptedNext={setHasAttemptedNext}
                isValidField={isValidField}
                getFieldStateClass={getFieldStateClass}
                handleChange={handleChange}
                isPersonalInfoComplete={isPersonalInfoComplete}
                isAcademicInfoComplete={isAcademicInfoComplete}
                canProceedToStep2={canProceedToStep2}
                textareaRef={textareaRef}
                getYearGradeOptions={getYearGradeOptions}
                goToNext={goToNext}
                onBackToPersonal={() => setStepOneSection("personal")}
              />
            </div>

            {/* =======================================
                PASO 2: CALENDARIO
                ======================================= */}
            <div
              ref={(element) => {
                slideRefs.current[2] = element;
              }}
              className={`form-slide-panel ${currentStep === 2 ? "active-panel" : ""}`}
              {...getSlidePanelA11y(2)}
            >
              <DateSelectionStep
                formData={formData}
                selectedDayOnly={selectedDayOnly}
                selectedDayLabel={selectedDayLabel}
                availableSlotCount={availableSlotCount}
                nextFreeSlot={nextFreeSlot}
                isDesktopCalendarViewport={isDesktopCalendarViewport}
                isCalendarExpanded={isCalendarExpanded}
                handleDateSelect={handleDateSelect}
                clearDateSelection={clearDateSelection}
                handleProceedToTimeStep={handleProceedToTimeStep}
                goToPrev={goToPrev}
                openCalendarExpanded={openCalendarExpanded}
                renderCalendarHeader={renderCalendarHeader}
                getDayClassName={getDayClassName}
                renderDayContents={renderDayContents}
                isDateAvailable={isDateAvailable}
              />
            </div>

            {/* =======================================
                PASO 3: HORARIOS
                ======================================= */}
            <div
              ref={(element) => {
                slideRefs.current[3] = element;
              }}
              className={`form-slide-panel ${currentStep === 3 ? "active-panel" : ""}`}
              {...getSlidePanelA11y(3)}
            >
              <TimeSelectionStep
                formData={formData}
                isTimeSelected={isTimeSelected}
                selectedTimeLabel={selectedTimeLabel}
                selectedDayLabel={selectedDayLabel}
                selectedDayOnly={selectedDayOnly}
                slotSections={slotSections}
                availableSlots={availableSlots}
                availableSlotCount={availableSlotCount}
                nextFreeSlot={nextFreeSlot}
                handleTimeSelect={handleTimeSelect}
                clearTimeSelection={clearTimeSelection}
                handleProceedToConfirmationStep={
                  handleProceedToConfirmationStep
                }
                goToPrev={goToPrev}
              />
            </div>

            {/* =======================================
                PASO 4: CONFIRMACION
                ======================================= */}
            <div
              ref={(element) => {
                slideRefs.current[4] = element;
              }}
              className={`form-slide-panel ${currentStep === 4 ? "active-panel" : ""}`}
              {...getSlidePanelA11y(4)}
            >
              <ConfirmationStep
                formData={formData}
                isAdult={isAdult}
                isTimeSelected={isTimeSelected}
                isConfirmationReady={isConfirmationReady}
                confirmationDateLabel={confirmationDateLabel}
                confirmationDurationLabel={confirmationDurationLabel}
                confirmationTimeRangeLabel={confirmationTimeRangeLabel}
                confirmationEducationLabel={confirmationEducationLabel}
                responsibleRelationshipLabel={responsibleRelationshipLabel}
                confirmationLookupHint={confirmationLookupHint}
                durationOptions={durationOptions}
                maxAllowedDuration={maxAllowedDuration}
                handleDurationSelect={handleDurationSelect}
                handleSubmit={handleSubmit}
                goToPrev={goToPrev}
                loading={loading}
                loadingPhase={loadingPhase}
                pricePerHour={pricePerHour}
              />
            </div>
          </div>
        </div>
      </div>

      <BookingSuccessModal
        show={showModal}
        successData={successData}
        whatsappConfirmText={whatsappConfirmText}
        onCopyCode={copyBookingCode}
        onClose={resetFormAfterSuccess}
      />

      {isCalendarExpanded && (
        <div
          className="calendar-zoom-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeCalendarExpanded();
            }
          }}
        >
          <div
            className="calendar-zoom-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-zoom-title"
          >
            <div className="calendar-zoom-header">
              <div>
                <span className="calendar-zoom-kicker">Vista ampliada</span>
                <h3 id="calendar-zoom-title">Elegí tu fecha con más espacio</h3>
                <p>
                  Mostramos una grilla más grande y enfocada en un solo mes para
                  que la selecciones con comodidad sin perder armonía visual.
                </p>
              </div>

              <button
                type="button"
                className="calendar-zoom-close"
                onClick={closeCalendarExpanded}
              >
                <FaTimes /> Cerrar
              </button>
            </div>

            <div className="calendar-zoom-body">
              <aside className="calendar-zoom-sidebar">
                <article className="selection-insight-card accent">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon">
                      <FaCalendarCheck />
                    </span>
                    <span className="insight-label">Fecha actual</span>
                  </div>
                  <strong>
                    {selectedDayOnly ? selectedDayLabel : "Todavía sin fecha"}
                  </strong>
                  <small>
                    {selectedDayOnly
                      ? "Cuando toques otro día, cerramos esta vista y volvemos al flujo normal."
                      : "Tocá un día y volvemos automáticamente a la reserva para seguir al paso siguiente."}
                  </small>
                </article>

                <article className="selection-insight-card">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon">
                      <FaClock />
                    </span>
                    <span className="insight-label">Horarios libres</span>
                  </div>
                  <strong>
                    {selectedDayOnly ? `${availableSlotCount} opciones` : "--"}
                  </strong>
                  <small>
                    {selectedDayOnly
                      ? "La agenda del paso siguiente se recalcula apenas cerrás esta vista."
                      : "Este contador aparece en cuanto confirmás una fecha."}
                  </small>
                </article>

                <article className="selection-insight-card">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon">
                      <FaLightbulb />
                    </span>
                    <span className="insight-label">Consejo</span>
                  </div>
                  <strong>
                    {nextFreeSlot
                      ? `Probá ${format(nextFreeSlot, "HH:mm")} hs`
                      : "Mirá varios días"}
                  </strong>
                  <small>
                    Si un día no te cierra, acá podés avanzar o volver de mes
                    sin perder el contexto.
                  </small>
                </article>
              </aside>

              <div className="calendar-zoom-picker-shell">
                <DatePicker
                  selected={formData.timeSlot}
                  onChange={() => {}}
                  onSelect={handleDateSelect}
                  minDate={new Date()}
                  inline
                  locale="es"
                  fixedHeight
                  monthsShown={1}
                  calendarClassName="neuro-calendar neuro-calendar-rich neuro-calendar-expanded"
                  dayClassName={getDayClassName}
                  renderDayContents={renderDayContents}
                  filterDate={isDateAvailable}
                  renderCustomHeader={renderCalendarHeader(1)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingForm;

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
  FaClock,
  FaCheckCircle,
  FaInfoCircle,
  FaExclamationCircle,
  FaLightbulb,
  FaCalendarCheck,
  FaTicketAlt,
  FaTimesCircle,
  FaChevronLeft,
  FaChevronRight,
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
import { WIZARD_STEPS } from "../constants/bookingWizard";
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
import { usePageMeta } from "../hooks/useDocumentTitle";
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
  usePageMeta(
    "Reservar clase",
    "Reserva tu clase particular de matematica, fisica, quimica y mas. Confirmacion inmediata. Agustin Elias Sosa, Buenos Aires.",
  );
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
  const [submitSlow, setSubmitSlow] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [pricePerHour, setPricePerHour] = useState(0);
  const [subjectsByLevelOverride, setSubjectsByLevelOverride] = useState(null);
  const [stepOneSection, setStepOneSection] = useState("personal");
  const { toast, showToast } = useNeuroToast({ duration: 4500 });

  useEffect(() => {
    fetchPublicSettings()
      .then((res) => {
        const data = res.data?.data ?? {};
        const price = Number(data["booking.pricePerHour"] ?? 0);
        if (price > 0) setPricePerHour(price);
        const subjects = data["booking.subjectsByLevel"];
        if (subjects && typeof subjects === "object") setSubjectsByLevelOverride(subjects);
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
  } = useBookingWizard(showToast);

  const {
    availableSlots,
    slotSections,
    getDayClassName,
    renderDayContents,
    isDateAvailable,
    hasAnyAvailability,
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
          ".calendar-actions-row, .btn-date-next.is-ready, .btn-neuro-success.ready-to-pulse, .duration-summary-card.is-ready",
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

  const currentStepInfo = WIZARD_STEPS.find((step) => step.id === currentStep);
  const getSlidePanelA11y = (stepId) => {
    const isActive = currentStep === stepId;
    return {
      "aria-hidden": !isActive,
      inert: !isActive,
    };
  };
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
        } h`
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
      scrollToStepIssue(2, ".calendar-card, .section-title");
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

    // 1A: Default duration to 1h when entering confirmation step
    if (targetStep === 4 && !formData.duration) {
      handleChange({ target: { name: "duration", value: 1 } });
    }

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
      scrollToStepIssue(2, ".calendar-card, .section-title");
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
      scrollToStepIssue(2, ".calendar-card, .section-title");
      speakWarmGuidance(
        "Fecha quitada. Elegí otro día disponible cuando quieras; seguimos con los horarios libres sin perder lo que ya completaste.",
      );
    } else {
      setFormData((prev) => ({ ...prev, timeSlot: startOfDay(date) }));
      if (isCalendarExpanded) {
        setIsCalendarExpanded(false);
      }
      // No scroll on date pick — user is already viewing the calendar.
      // Only nudge if the section-title is above the fold.
      smoothScrollToStep(2, { selector: ".date-step-content", delay: 80 });
      speakWarmGuidance(
        "Fecha elegida. Bien: ahora tocá el botón para ver horarios disponibles y elegir el que te quede más cómodo.",
      );
    }
  };

  const clearDateSelection = () => {
    setFormData((prev) => ({ ...prev, timeSlot: null }));
    scrollToStepIssue(2, ".calendar-card, .section-title");
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
      smoothScrollToStep(3, { selector: ".time-step-content", delay: 80 });
      speakWarmGuidance(
        "Horario quitado. Elegí otro bloque libre y seguimos sin apuro.",
      );
    } else {
      setFormData((prev) => ({ ...prev, timeSlot: timeObj }));
      smoothScrollToStep(3, { selector: ".time-step-content", delay: 80 });
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
    smoothScrollToStep(3, { selector: ".time-step-content", delay: 80 });
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
    ? `${format(formData.timeSlot, "HH:mm")} h`
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
    setSubmitError("");
    setSubmitSlow(false);
    setLoadingPhase(0);
    const phaseTimers = [];
    phaseTimers.push(window.setTimeout(() => setLoadingPhase(1), 1800));
    phaseTimers.push(window.setTimeout(() => setLoadingPhase(2), 3500));
    phaseTimers.push(window.setTimeout(() => setLoadingPhase(3), 5500));
    const slowTimer = window.setTimeout(() => setSubmitSlow(true), 8000);
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
        rawTimeSlot: dateObj.toISOString(),
        rawEndTime: end.toISOString(),
        day: format(dateObj, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
        startTime: format(dateObj, "HH:mm"),
        endTime: format(end, "HH:mm"),
        actualDuration: formData.duration,
        durationLabel: formatDurationOptionLabel(formData.duration),
        cleanStudentName: formData.studentName,
        responsibleLabel: isAdult ? null : formData.responsibleName,
        responsibleRelationshipLabel: isAdult ? null : responsibleRelationshipLabel,
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
      const msg = getBookingApiMessage(error);
      showToast(msg, "error");
      setSubmitError(msg);
    } finally {
      window.clearTimeout(slowTimer);
      phaseTimers.forEach((t) => window.clearTimeout(t));
      setLoadingPhase(0);
      setSubmitSlow(false);
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
    ? [
        `Hola Prof. Agustín. Acabo de reservar un turno.`,
        ``,
        `Alumno: ${successData.cleanStudentName}`,
        successData.responsibleLabel ? `Responsable: ${successData.responsibleLabel}` : null,
        successData.responsibleRelationshipLabel ? `Parentesco: ${successData.responsibleRelationshipLabel}` : null,
        `Fecha: ${successData.day}`,
        `Horario: ${successData.startTime} a ${successData.endTime} h (${successData.actualDuration} h)`,
        `Código: ${successData.bookingCode}`,
        `Gestión: después voy a entrar en Mis Turnos con este código.`,
        ``,
        `Gracias.`,
      ].filter((l) => l !== null).join("\n")
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
          <h1 className="form-main-title">Asegurá tu clase</h1>
          <p className="form-subtitle">
            Completá tus datos y elegí el momento ideal para aprender.
          </p>

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

        <nav
          className="neuro-stepper neuro-stepper-compact"
          role="progressbar"
          aria-label="Progreso de reserva"
          aria-valuemin="1"
          aria-valuemax={WIZARD_STEPS.length}
          aria-valuenow={currentStep}
        >
          <div className="stepper-progress-rail" aria-hidden="true">
            <div className="stepper-progress-bar">
              <div
                className="stepper-progress-fill"
                style={{ width: `${stepProgressWidth}%` }}
              ></div>
            </div>
          </div>

          <div className="stepper-grid stepper-grid-horizontal">
            {WIZARD_STEPS.map((step) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const stepState = isCompleted
                ? "completed"
                : isCurrent
                  ? "current"
                  : "locked";

              return (
                <button
                  type="button"
                  key={step.id}
                  className={`stepper-item stepper-item-compact is-${stepState} ${isCompleted ? "is-clickable" : ""}`}
                  onClick={() => handleStepClick(step.id)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={
                    isCompleted
                      ? `Volver a ${step.label}`
                      : isCurrent
                        ? `${step.label} — paso actual`
                        : `${step.label} — pendiente`
                  }
                  disabled={step.id > currentStep}
                >
                  <span
                    className={`step-circle ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                  >
                    {isCompleted ? (
                      <FaCheckCircle className="check-icon" />
                    ) : (
                      step.id
                    )}
                  </span>
                  <span className="step-label-compact">{step.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

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
                subjectsByLevelOverride={subjectsByLevelOverride}
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
                hasAnyAvailability={hasAnyAvailability}
                handleDateSelect={handleDateSelect}
                clearDateSelection={clearDateSelection}
                handleProceedToTimeStep={handleProceedToTimeStep}
                goToPrev={goToPrev}
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
                submitSlow={submitSlow}
                submitError={submitError}
                onRetry={(e) => { setSubmitError(""); handleSubmit(e); }}
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
                      ? `Probá ${format(nextFreeSlot, "HH:mm")} h`
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

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { addMinutes, format } from "date-fns";
import es from "date-fns/locale/es";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronDown,
  FaChevronLeft,
  FaTicketAlt,
  FaLaptop,
  FaMapMarkerAlt,
  FaExclamationCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaArrowRight,
  FaPencilAlt,
} from "react-icons/fa";
import BookingSuccessModal from "./booking/BookingSuccessModal";
import KioskSlotCalendar from "./KioskSlotCalendar";
import ThemeLogo from "./ui/ThemeLogo";
import {
  createBooking,
  fetchPublicSettings,
  sendSeriesSummary,
} from "../api/bookingApi";
import { useBookingWizard } from "../hooks/useBookingWizard";
import { useBookingAvailability } from "../hooks/useBookingAvailability";
import { SUBJECT_SUGGESTIONS_BY_LEVEL } from "../constants/bookingWizard";
import { usaBuscador } from "../constants/materiasSuperior";
import BuscadorDeMateria from "./booking/BuscadorDeMateria";
import NivelIcono from "./booking/NivelIcono";
import {
  getSubjectVisual,
  OTHER_SUBJECT_VISUAL,
} from "../constants/bookingVisuals";;
import {
  KIOSK_STEPS,
  LEVEL_OPTIONS,
  MODALITY_OPTIONS,
  KIOSK_DURATION_OPTIONS,
  getKioskYearGradeOptions,
} from "../constants/kioskWizard";
import { toBookingApiAcademicSituation } from "../constants/bookingWizard";
import {
  ADULT_RELATIONSHIP_VALUE,
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
  formatResponsibleRelationshipLabel,
  formatDurationOptionLabel,
  getBookingApiMessage,
} from "../utils/bookingFormatters";
import { createIdempotencyKey } from "../utils/idempotencyKey";
import {
  OPCIONES_DE_REPETICION,
  reservarSerie,
  resumirSerie,
} from "../utils/bookingSeries";
import { parsePublicSubjectsByLevel } from "../utils/subjectSettings";
import { desglosarPrecio } from "../utils/precio";
import {
  FALLBACK_TEACHER_LOCATION,
  parseTeacherLocation,
} from "../constants/teacherLocation";
import {
  OPCIONES_PARA_QUIEN,
  PARA_MI,
  vozDelWizard,
} from "../constants/kioskVoz";
import { NO_PUEDO_AYUDARTE } from "../constants/voz";
import { materiaCanonica } from "../utils/materiaCanonica";
import { useNeuroToast } from "../utils/neuroToast";
import { usePageMeta } from "../hooks/useDocumentTitle";
import { createBookingFunnelTracker } from "../utils/bookingFunnel";
import "../styles/tokens.css";
import "../index.css";
// BookingSuccessModal no trae su CSS: sus clases (.success-overlay, .success-modal…)
// viven en estos dos archivos. El kiosco los importa para no renderizar el
// comprobante sin estilos.
import "./booking/BookingFinalExperience.css";
import "../styles/theme-polish.css";
import "./BookingKiosk.css";

const RELATIONSHIP_OPTIONS = [
  { value: "madre", label: "Madre" },
  { value: "padre", label: "Padre" },
  { value: "hermana", label: "Hermana" },
  { value: "hermano", label: "Hermano" },
  { value: "tia", label: "Tía" },
  { value: "tio", label: "Tío" },
  { value: "abuela", label: "Abuela" },
  { value: "abuelo", label: "Abuelo" },
  { value: "prima", label: "Prima" },
  { value: "primo", label: "Primo" },
  { value: RESPONSIBLE_RELATIONSHIP_OTHER_VALUE, label: "Otro" },
];

const BookingKiosk = () => {
  usePageMeta(
    "Reservar clase",
    "Reservá tu clase particular en pocos pasos. Elegí materia, modalidad y horario. Agustín Elías Sosa, Buenos Aires.",
  );

  const { toast, showToast } = useNeuroToast({ duration: 4500 });
  const [step, setStep] = useState(1);
  const [pricePerHour, setPricePerHour] = useState(0);
  // La matriz nivel x materia. Viaja en los ajustes públicos para poder cotizar el
  // estimado del paso 3 sin una llamada de red por cada cambio de duración.
  const [pricingMatrix, setPricingMatrix] = useState(null);
  const [subjectsByLevelOverride, setSubjectsByLevelOverride] = useState(null);
  // Arranca con el fallback y no en null: el paso 2 puede renderizarse antes de
  // que responda el endpoint, y ahí es donde va la dirección.
  const [teacherLocation, setTeacherLocation] = useState(FALLBACK_TEACHER_LOCATION);
  const [ajustesFallaron, setAjustesFallaron] = useState(false);
  // Cuántas semanas repetir. 1 = una sola clase, que es el default.
  const [semanas, setSemanas] = useState(1);
  const [showAllDays, setShowAllDays] = useState(false);
  // Paso 1: materia escrita a mano cuando no está en las sugeridas.
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherSubject, setOtherSubject] = useState("");
  const [otherSubjectError, setOtherSubjectError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const cardRef = useRef(null);
  const bookingAttemptRef = useRef(null);
  const funnelRef = useRef(null);
  if (!funnelRef.current) funnelRef.current = createBookingFunnelTracker();

  const [searchParams] = useSearchParams();
  const prefill = useMemo(() => {
    const overrides = {};
    const materia = searchParams.get("materia");
    const nivel = searchParams.get("nivel");
    /* Normalizada, no tal cual viene. Un `?materia=Matemáticas` en plural
       —que es lo que enlazó el sitio institucional durante meses, y lo que
       sigue habiendo en los WhatsApp ya mandados— dejaba la tarjeta sin marcar
       y, peor, la clase cotizada a la tarifa base. El detalle completo está en
       `utils/materiaCanonica.js`.
       Y sin `decodeURIComponent`: `useSearchParams` YA devuelve el valor
       decodificado, así que había un doble decode. No era cosmético — con
       `?materia=Matem%C3%A1tica%20100%25` el segundo decode recibía
       "Matemática 100%" y lanzaba `URIError: URI malformed`. Como esto corre
       dentro de un `useMemo` durante el render, la excepción tumbaba la página
       de reserva entera: pantalla en blanco, no un campo vacío. */
    if (materia) overrides.subject = materiaCanonica(materia);
    if (nivel) overrides.educationLevel = nivel.trim();
    return overrides;
  }, [searchParams]);

  const {
    formData,
    setFormData,
    isAdult,
    setIsAdult,
    setHasAttemptedNext,
    isValidField,
    isPersonalInfoComplete,
    handleChange,

    handleBlur,
    resetForm,
    getFieldStateClass,
    getFieldError,
  } = useBookingWizard(showToast, prefill);

  /* Para quién es la clase. `null` = todavía no se preguntó, y es un estado propio a
     propósito: `isAdult === false` significaba a la vez "reserva para otro" y "no
     contestó todavía", así que con ese único dato el paso 1 no podía exigir la
     respuesta ni el wizard sabía si ya podía tutear. */
  const [paraQuien, setParaQuien] = useState(null);
  const voz = vozDelWizard(paraQuien);

  const elegirParaQuien = (valor) => {
    setParaQuien(valor);
    /* `isAdult` pasa a ser una consecuencia de esta respuesta y no un checkbox aparte.
       Se usa `setIsAdult` y no `toggleAdultMode` porque acá el valor se conoce: un
       toggle podría dejarlo invertido si la persona vuelve y elige lo mismo. */
    setIsAdult(valor === PARA_MI);
    if (valor === PARA_MI) {
      // Reserva para uno mismo: no hay adulto responsable que cargar.
      setFormData((prev) => ({
        ...prev,
        responsibleName: "",
        responsibleRelationship: "",
        responsibleRelationshipOther: "",
      }));
    }
  };

  const {
    upcomingSlotsByDay,
    availabilityStatus,
    availabilityMatchesSelectedDuration,
    isSelectedTimeVerified,
    maxAllowedDuration,
    retryAvailability,
    // showAllDays = calendario abierto: ahí sí se necesita toda la agenda.
  } = useBookingAvailability(
    formData.timeSlot,
    formData.duration,
    showToast,
    showAllDays,
    formData.modality,
  );

  useEffect(() => {
    funnelRef.current.start(1);
  }, []);

  /* Los ajustes públicos son mejoras sobre valores que ya tienen fallback: el
     precio, las materias configuradas y la dirección. Si la llamada falla, el
     wizard tiene que seguir funcionando —bloquear una reserva porque no cargó un
     precio estimado sería absurdo—, así que no hay toast ni error acá.

     Lo que sí cambia: antes era un `.catch(() => {})` a secas y el estimado
     simplemente no aparecía, sin ninguna explicación. Ahora se recuerda que
     falló para poder decirlo en el paso donde se nota. */
  useEffect(() => {
    fetchPublicSettings()
      .then((res) => {
        const data = res.data?.data ?? {};
        const price = Number(data["booking.pricePerHour"] ?? 0);
        if (price > 0) setPricePerHour(price);
        const matriz = data["booking.pricingMatrix"];
        if (matriz && typeof matriz === "object") setPricingMatrix(matriz);
        const parsed = parsePublicSubjectsByLevel(data["booking.subjectsByLevel"]);
        if (parsed) setSubjectsByLevelOverride(parsed);
        setTeacherLocation(parseTeacherLocation(data));
      })
      .catch((error) => {
        if (error?.falla?.seMuestra === false) return; // Desmontaje.
        setAjustesFallaron(true);
      });
  }, []);

  // Al cambiar de paso: (1) llevar la tarjeta al tope del viewport solo si quedó
  // por encima —nada de auto-scroll agresivo, ese era el bug—, y (2) mover el
  // foco al título del paso para que teclado y lectores de pantalla no queden
  // huérfanos cuando la tarjeta anterior se desmonta. Se saltea en el primer
  // render (isMounted) para no robar el foco al cargar la página.
  const isMountedRef = useRef(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    const prefersReduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const top = node.getBoundingClientRect().top;
    if (top < 0 || top > 160) {
      const navH = document.querySelector(".navbar-elite")?.getBoundingClientRect().height ?? 0;
      const y = node.getBoundingClientRect().top + window.scrollY - navH - 16;
      window.scrollTo({ top: Math.max(0, y), behavior: prefersReduced ? "auto" : "smooth" });
    }

    if (isMountedRef.current) {
      const heading = node.querySelector(".kiosk-title");
      heading?.focus?.({ preventScroll: true });
    }
    isMountedRef.current = true;
  }, [step]);

  const subjectsForLevel = useMemo(() => {
    const source = subjectsByLevelOverride ?? SUBJECT_SUGGESTIONS_BY_LEVEL;
    return source[formData.educationLevel] ?? [];
  }, [subjectsByLevelOverride, formData.educationLevel]);

  const selectableDurations = useMemo(
    () => KIOSK_DURATION_OPTIONS.filter((opt) => opt.value <= maxAllowedDuration),
    [maxAllowedDuration],
  );


  const setField = (name, value) => handleChange({ target: { name, value } });

  // ── Navegación ──────────────────────────────────────────────────────────
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (target) => {
    if (target < step) setStep(target);
  };

  // ── Paso 1: Materia ───────────────────────────────────────────────────────
  const chooseLevel = (level) => {
    setField("educationLevel", level); // handleChange limpia subject y yearGrade
    setOtherOpen(false);
    setOtherSubject("");
    setOtherSubjectError("");
    funnelRef.current.stageChange(1, 1);
  };
  const chooseSubject = (subject) => {
    setField("subject", subject);
    setOtherOpen(false);
  };
  const confirmSubject = () => {
    if (!formData.subject) return;
    setStep(2);
  };

  /* Salida de escape del paso 1. Las listas sugeridas cubren lo que se dicta
     habitualmente, pero un universitario cursa "Análisis Matemático" o "Álgebra
     Lineal", no "Matemática": sin esto se quedaría sin poder reservar. El
     backend acepta la materia como texto libre (2 a 120 caracteres), así que
     alcanza con enviarla escrita. */
  const confirmOtherSubject = () => {
    const value = otherSubject.trim();
    if (value.length < 2) {
      setOtherSubjectError("Escribí el nombre de la materia (mínimo 2 letras).");
      return;
    }
    if (value.length > 120) {
      setOtherSubjectError("El nombre es demasiado largo (máximo 120).");
      return;
    }
    setOtherSubjectError("");
    setField("subject", value);
    setStep(2);
  };

  /* ── Paso 2: Modalidad ─────────────────────────────────────────────────────
     Tampoco salta de paso. Este paso ahora muestra la dirección de la clase
     presencial, y avanzar en el mismo toque significaba mostrarla durante cero
     milisegundos: quien elige Presencial tiene que poder LEER adónde va antes
     de seguir. Misma mecánica que el horario: se marca, se suelta tocando de
     nuevo, y se avanza cuando la persona lo decide. */
  const chooseModality = (modality) => {
    setFormData((prev) => ({
      ...prev,
      modality: prev.modality === modality ? null : modality,
    }));
  };

  const confirmModality = () => {
    if (!formData.modality) return;
    setStep(3);
  };

  // ── Paso 3: Turno ─────────────────────────────────────────────────────────
  const chooseDuration = (value) => {
    // Cambiar la duración puede invalidar el turno ya elegido: se limpia para
    // forzar una nueva elección coherente con la disponibilidad recalculada.
    setFormData((prev) => ({ ...prev, duration: value, timeSlot: null }));
  };
  /* Elegir un horario ya NO salta de paso. Antes tocabas una hora y la pantalla
     cambiaba en el acto: no llegabas a ver qué habías elegido y, si te habías
     equivocado, tenías que volver para atrás para darte cuenta. Ahora la
     elección se marca, se puede deshacer tocando de nuevo, y se avanza cuando
     la persona lo decide. */
  const chooseSlot = (timeObj) => {
    setFormData((prev) => {
      const yaElegido =
        prev.timeSlot && new Date(prev.timeSlot).getTime() === timeObj.getTime();
      return { ...prev, timeSlot: yaElegido ? null : timeObj };
    });
  };

  const confirmSlot = () => {
    if (!formData.timeSlot) return;
    setStep(4);
  };

  // ── Paso 4: Datos ─────────────────────────────────────────────────────────
  const canProceedContact =
    isPersonalInfoComplete && isValidField("yearGrade") && isValidField("objective");

  /* Cada intento de avanzar con datos incompletos manda el foco al primer campo
     que falla. Corre en un efecto porque los `aria-invalid` recién existen
     después del commit del re-render que dispara el intento. */
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  useEffect(() => {
    if (!intentosFallidos) return;
    cardRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [intentosFallidos]);

  const submitContact = () => {
    if (!canProceedContact) {
      setHasAttemptedNext(true);
      /* Antes decía «revisá los campos resaltados». "Resaltado" sólo existe en el
         color: quien no lo ve escuchaba el aviso sin manera de saber cuáles eran.
         Ahora cada campo dice su motivo al lado, y el mensaje manda a leerlos. */
      showToast("Cada campo que falta dice abajo qué necesita.", "error", {
        title: "Faltan datos",
      });
      /* Y además el foco va al primero que falla: sin eso hay que recorrer el
         formulario entero a ciegas para encontrarlo. Va por un contador y no
         acá mismo porque los `aria-invalid` los pinta el re-render que este
         `setHasAttemptedNext` acaba de encolar —buscarlos ahora, o dentro de un
         requestAnimationFrame, los busca antes de que existan—. El contador
         sube en cada intento fallido, no un booleano, para que el segundo
         intento seguido también mueva el foco. */
      setIntentosFallidos((n) => n + 1);
      return;
    }
    setHasAttemptedNext(false);
    setStep(5);
  };

  // ── Paso 5: Confirmar ─────────────────────────────────────────────────────
  const isReadyToSubmit =
    Boolean(formData.timeSlot) &&
    Number(formData.duration) >= 0.5 &&
    availabilityStatus === "ready" &&
    availabilityMatchesSelectedDuration &&
    isSelectedTimeVerified;

  const responsibleRelationshipLabel = formatResponsibleRelationshipLabel(
    isAdult ? ADULT_RELATIONSHIP_VALUE : formData.responsibleRelationship,
    formData.responsibleRelationshipOther,
  );

  /* El desglose se calcula una vez y lo usan los pasos 3 y 5. Devuelve null cuando no
     hay tarifa cargada, y eso es deliberado: nunca se muestra «$0», que se leería como
     «es gratis». */
  const precio = desglosarPrecio({
    matriz: pricingMatrix,
    nivel: formData.educationLevel,
    materia: formData.subject,
    // Red de última instancia: la tarifa única que existía antes de la matriz.
    tarifaGeneral: pricePerHour,
    duracionHoras: formData.duration,
    clases: semanas,
  });
  // El paso 5 y el comprobante siguen esperando un string.
  const priceLabel = precio?.porClaseTexto ?? "";

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!isReadyToSubmit) {
      showToast("Esperá a que confirmemos la disponibilidad del turno.", "warning");
      return;
    }
    setLoading(true);
    setSubmitError("");
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
      const safeEmail = formData.email.trim();

      const payload = {
        studentName: formData.studentName,
        responsibleName: finalResponsibleName,
        responsibleRelationship: finalResponsibleRelationship,
        responsibleRelationshipOther: finalResponsibleRelationshipOther,
        email: safeEmail,
        phone: formData.phone,
        school: formData.school.trim(),
        educationLevel: formData.educationLevel,
        yearGrade: formData.yearGrade,
        subject: formData.subject,
        modality: formData.modality,
        academicSituation: toBookingApiAcademicSituation(formData),
        timeSlot: formattedDate,
        duration: Number(formData.duration),
        tutorName: "Agustin",
      };

      const fingerprint = JSON.stringify(payload);
      if (bookingAttemptRef.current?.fingerprint !== fingerprint) {
        /* Las claves se generan UNA vez por intento y se guardan: si la primera
           llamada falla por red y la persona reintenta, el backend reconoce la
           repetición en lugar de crear una reserva más. Con claves nuevas en cada
           reintento, dos clics seguidos serían dos clases. */
        bookingAttemptRef.current = {
          fingerprint,
          key: createIdempotencyKey(),
          claves: Array.from({ length: semanas }, () => createIdempotencyKey()),
        };
      }

      /* Una clase o una serie. El camino de una clase queda exactamente como
         estaba —es el que mueve la plata y no hay motivo para tocarlo—; la serie
         hace una llamada por semana al mismo endpoint. */
      let response;
      let serie = null;
      if (semanas > 1) {
        let i = 0;
        const claves = bookingAttemptRef.current.claves;
        const { resultados, seriesId } = await reservarSerie({
          payloadBase: payload,
          primeraFecha: dateObj,
          semanas,
          aFormatoApi: (f) => format(f, "dd/MM/yyyy HH:mm"),
          nuevaClave: () => claves[i++] ?? createIdempotencyKey(),
          crearReserva: (cuerpo, clave) => createBooking(cuerpo, clave),
        });
        serie = resumirSerie(resultados);
        if (serie.ningunaOk) {
          // Ni la primera se pudo reservar: se trata como un fallo común y se
          // muestra el error de esa primera, que es el que explica por qué.
          throw resultados[0].error;
        }
        response = { data: { data: serie.logradas[0].datos } };

        /* UN email con todas las fechas y códigos, en lugar de ocho
           confirmaciones que llegan juntas y se leen como un error del sistema.
           Las reservas de una serie no encolan confirmación individual, así que
           este pedido es el que le deja el registro durable a la persona.

           Si falla, las clases igual están reservadas y el comprobante en
           pantalla tiene todos los códigos: se avisa y se sigue, nunca se
           presenta como si la reserva hubiera fallado. */
        const tokenDeLaSerie = serie.logradas[0].datos?.managementToken;
        if (tokenDeLaSerie) {
          try {
            await sendSeriesSummary(seriesId, tokenDeLaSerie);
          } catch {
            serie.resumenFallo = true;
          }
        }
      } else {
        response = await createBooking(payload, bookingAttemptRef.current.key);
      }
      bookingAttemptRef.current = null;
      funnelRef.current.complete(5);

      const end = addMinutes(dateObj, Number(formData.duration) * 60);
      const bookingCode = response.data.data.bookingCode;
      const managementUrl = response.data.data.managementUrl;
      const bookingStatus = response.data.data.status;
      const managementMethods = [
        { label: "Código", value: bookingCode, helper: "Pegalo tal cual en Mis Turnos." },
        ...(safeEmail
          ? [{ label: "Email", value: safeEmail, helper: "También sirve para reencontrar la reserva." }]
          : []),
        ...(formData.phone
          ? [{ label: "Teléfono", value: formData.phone, helper: "El mismo número que cargaste." }]
          : []),
      ];
      setSuccessData({
        bookingCode,
        status: bookingStatus,
        rawTimeSlot: dateObj.toISOString(),
        rawEndTime: end.toISOString(),
        day: format(dateObj, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
        startTime: format(dateObj, "HH:mm"),
        endTime: format(end, "HH:mm"),
        actualDuration: formData.duration,
        durationLabel: formatDurationOptionLabel(formData.duration),
        /* El mismo estimado que se mostró en el paso 5. Va al comprobante para
           que lo que se cotizó y lo que queda por escrito sean lo mismo: hasta
           ahora el número aparecía antes de confirmar y después desaparecía. */
        priceLabel,
        /* El detalle de la serie: qué semanas quedaron reservadas, con su código,
           y cuáles no. Sin esto, ocho reservas se verían como un comprobante
           suelto y la persona no tendría los otros siete códigos. */
        serie: serie && {
          total: serie.total,
          logradas: serie.logradas.map((r) => ({
            fecha: format(r.fecha, "EEEE d 'de' MMMM", { locale: es }),
            hora: format(r.fecha, "HH:mm"),
            bookingCode: r.datos?.bookingCode ?? null,
          })),
          falladas: serie.falladas.map((r) => ({
            fecha: format(r.fecha, "EEEE d 'de' MMMM", { locale: es }),
            hora: format(r.fecha, "HH:mm"),
          })),
          todasOk: serie.todasOk,
          resumenFallo: Boolean(serie.resumenFallo),
        },
        cleanStudentName: formData.studentName,
        responsibleLabel: isAdult ? null : formData.responsibleName,
        responsibleRelationshipLabel: isAdult ? null : responsibleRelationshipLabel,
        email: safeEmail,
        phone: formData.phone,
        subject: formData.subject,
        modality: formData.modality,
        // La ubicación viaja al comprobante y de ahí al .ics. Antes el alumno
        // solo la recibía por email, y el archivo del calendario no la llevaba.
        teacherLocation,
        educationLevel: [formData.educationLevel, formData.yearGrade].filter(Boolean).join(" - "),
        notifications: response.data.notifications || null,
        managementMethods,
        managementUrl,
      });
      setShowModal(true);
    } catch (error) {
      const msg = getBookingApiMessage(error);
      showToast(msg, "error");
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetAfterSuccess = () => {
    setShowModal(false);
    resetForm();
    setStep(1);
    setShowAllDays(false);
    // Sin esto, quien reserva una serie de 8 y después vuelve a reservar se
    // encuentra con "8 semanas" ya elegido y reserva 8 clases sin querer.
    setSemanas(1);
    funnelRef.current = createBookingFunnelTracker();
    funnelRef.current.start(1);
  };

  const whatsappConfirmText = successData
    ? [
        "Hola Prof. Agustín. Acabo de reservar un turno.",
        "",
        `Alumno: ${successData.cleanStudentName}`,
        `Materia: ${successData.subject}`,
        `Modalidad: ${successData.modality === "presencial" ? "Presencial" : "Online"}`,
        successData.modality === "presencial"
          ? `Dirección: ${successData.teacherLocation?.address ?? ""}`
          : null,
        `Fecha: ${successData.day}`,
        `Horario: ${successData.startTime} a ${successData.endTime} h`,
        `Código: ${successData.bookingCode}`,
        successData.managementUrl ? `Gestión: ${successData.managementUrl}` : null,
        "",
        "Gracias.",
      ]
        .filter((l) => l !== null)
        .join("\n")
    : "";

  const toastMeta = {
    success: { icon: <FaCheckCircle />, title: "Todo listo" },
    warning: { icon: <FaExclamationCircle />, title: "Atención" },
    error: { icon: <FaTimesCircle />, title: "Revisá esto" },
    info: { icon: <FaInfoCircle />, title: "Info" },
  }[toast.type || "info"];

  /* El error de cada campo, en texto, o null si todavía no corresponde mostrarlo.

     El toast dice «revisá los campos resaltados», y "resaltado" es una propiedad
     que sólo existe en el color: quien no lo ve no tiene manera de saber cuáles
     son. Estas tres piezas —el texto al lado del campo, `aria-invalid` y
     `aria-describedby`— hacen que el motivo llegue leyendo, no mirando. */
  const erroresDeCampo = {
    studentName: getFieldError("studentName"),
    phone: getFieldError("phone"),
    email: getFieldError("email", true),
    yearGrade: getFieldError("yearGrade"),
    responsibleName: getFieldError("responsibleName"),
    responsibleRelationship: getFieldError("responsibleRelationship"),
    responsibleRelationshipOther: getFieldError("responsibleRelationshipOther"),
    objective: getFieldError("objective"),
  };

  /* La ayuda del campo —si la tiene— y el error comparten aria-describedby: primero la
     ayuda y después el error, que es el orden en que se leen en pantalla. Pasar uno
     solo pisaría al otro. */
  const propsDeError = (campo, ayudaId) => {
    const errorId = erroresDeCampo[campo] ? `kiosk-err-${campo}` : null;
    const describedBy = [ayudaId, errorId].filter(Boolean).join(" ");
    return {
      ...(errorId ? { "aria-invalid": true } : {}),
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
    };
  };

  /* Función y no componente: declarar un componente dentro del render le cambia
     la identidad en cada pasada y React remonta el nodo, que en un `role="alert"`
     significa que el lector de pantalla vuelve a anunciarlo mientras se tipea. */
  const mensajeDeError = (campo) =>
    erroresDeCampo[campo] ? (
      <span id={`kiosk-err-${campo}`} className="kiosk-field-error" role="alert">
        {erroresDeCampo[campo]}
      </span>
    ) : null;

  return (
    <div className="kiosk-wrapper">
      <div
        className={`kiosk-toast ${toast.show ? "show" : ""} ${toast.type}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="kiosk-toast-icon" aria-hidden="true">{toastMeta.icon}</span>
        <div className="kiosk-toast-copy">
          <strong>{toast.title || toastMeta.title}</strong>
          <span>{toast.message}</span>
        </div>
      </div>

      <div className={`kiosk-card kiosk-card--step-${step}`} ref={cardRef}>
        {/* Sin logo ni nombre acá.
            La barra de arriba es fija y ya lleva el monograma y «Tu Profesor
            Particular». Repetirlos dentro de la tarjeta gastaba unos 60 px de
            alto en un teléfono —donde el primer paso ya no entra en pantalla—
            para decir dos veces lo mismo. «Reserva inteligente» tampoco
            aportaba: nadie viene a evaluar si la reserva es inteligente, viene
            a conseguir un turno. Queda sólo la acción. */}
        <div className="kiosk-card-head">
          <Link to="/portal" className="kiosk-portal-link">
            <FaTicketAlt aria-hidden="true" /> Ver mis turnos
          </Link>
        </div>

        {/* Stepper honesto: 5 pasos reales */}
        <nav
          className="kiosk-stepper"
          aria-label="Progreso de la reserva"
        >
          <span className="sr-only" aria-live="polite">
            Paso {step} de {KIOSK_STEPS.length}: {KIOSK_STEPS[step - 1].label}
          </span>
          {KIOSK_STEPS.map((s) => {
            const state = step > s.id ? "done" : step === s.id ? "current" : "todo";
            return (
              <button
                key={s.id}
                type="button"
                className={`kiosk-step is-${state}`}
                onClick={() => goToStep(s.id)}
                disabled={s.id >= step}
                aria-current={step === s.id ? "step" : undefined}
              >
                <span className="kiosk-step-dot" aria-hidden="true">
                  {step > s.id ? <FaCheckCircle /> : s.id}
                </span>
                <span className="kiosk-step-label">{s.short}</span>
              </button>
            );
          })}
        </nav>

        {/* ─── PASO 1: MATERIA ─── */}
        {step === 1 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s1-title">
            {/* FASE CERO: para quién es la clase.
                Va antes que todo porque de esta respuesta sale el trato del resto del
                wizard. Es un solo toque, y va acá arriba —donde la paciencia está
                intacta— en lugar de sumar un sexto paso. */}
            {!paraQuien ? (
              <>
                <span className="kiosk-eyebrow">Antes de empezar</span>
                <h1 id="kiosk-s1-title" className="kiosk-title" tabIndex={-1}>
                  ¿Para quién es la clase?
                </h1>
                <p className="kiosk-subtitle">
                  Con esto sabemos a quién le estamos hablando y qué datos hace falta
                  pedirte. Un solo toque.
                </p>
                <div className="kiosk-grid kiosk-grid-para-quien">
                  {OPCIONES_PARA_QUIEN.map((opcion) => (
                    <button
                      key={opcion.value}
                      type="button"
                      className="kiosk-choice-card kiosk-para-quien-card"
                      onClick={() => elegirParaQuien(opcion.value)}
                      aria-label={`${opcion.label}. ${opcion.hint}`}
                    >
                      <span className="kiosk-visual-copy">
                        <span className="kiosk-choice-label">{opcion.label}</span>
                        <span className="kiosk-choice-hint">{opcion.hint}</span>
                      </span>
                      <span className="kiosk-card-arrow" aria-hidden="true"><FaArrowRight /></span>
                    </button>
                  ))}
                </div>
              </>
            ) : !formData.educationLevel ? (
              <>
                <div className="kiosk-title-row">
                  <div>
                    <span className="kiosk-eyebrow">{voz.nivelEyebrow}</span>
                    <h1 id="kiosk-s1-title" className="kiosk-title" tabIndex={-1}>{voz.nivelTitulo}</h1>
                    <p className="kiosk-subtitle">{voz.nivelSubtitulo}</p>
                  </div>
                  {/* Sin esta salida, elegir mal en la fase cero es una trampa: no hay
                      paso anterior al que volver desde el paso 1. */}
                  <button
                    type="button"
                    className="kiosk-inline-btn"
                    onClick={() => elegirParaQuien(null)}
                  >
                    <FaPencilAlt aria-hidden="true" /> ¿Para quién es?
                  </button>
                </div>
                <div className="kiosk-grid kiosk-grid-levels">
                  {/* Sin imagen acá, a propósito.
                      Este paso y el de la materia son consecutivos, y las
                      portadas de materia son las que venden. Si los dos están
                      llenos de ilustración compiten y ninguno lidera. Elegir
                      el nivel es administrativo y dura dos segundos: necesita
                      ser instantáneo, no lindo. Ver el comentario largo en
                      booking/NivelIcono.jsx. */}
                  {LEVEL_OPTIONS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        className="kiosk-choice-card kiosk-level-card"
                        onClick={() => chooseLevel(lvl.value)}
                        aria-label={`${lvl.label}. ${lvl.hint}`}
                      >
                        <span className="kiosk-level-icon" aria-hidden="true">
                          <NivelIcono nivel={lvl.value} />
                        </span>
                        {/* Sin el rótulo «Nivel educativo»: el título de arriba
                            ya pregunta qué nivel está cursando, así que repetirlo
                            en cada una de las seis tarjetas sólo le robaba ancho
                            al nombre. Medido: el nombre se cortaba en
                            «Secundari» y «Universitari». */}
                        <span className="kiosk-visual-copy">
                          <span className="kiosk-choice-label">{lvl.label}</span>
                          <span className="kiosk-choice-hint">{lvl.hint}</span>
                        </span>
                        {/* Sin flecha: la tarjeta entera es el botón. Una flecha dentro de
                            algo que ya se toca completo no agrega información y
                            acá se comía 40 px del ancho del nombre. El relleno del
                            ícono al apuntarla es la señal de que es clickeable. */}
                      </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="kiosk-title-row">
                  <div>
                    <span className="kiosk-eyebrow">{voz.materiaEyebrow}</span>
                    <h1 id="kiosk-s1-title" className="kiosk-title" tabIndex={-1}>{voz.materiaTitulo}</h1>
                    <p className="kiosk-subtitle">
                      Estás buscando clases para <strong>{formData.educationLevel}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="kiosk-inline-btn"
                    onClick={() => setField("educationLevel", "")}
                  >
                    <FaPencilAlt aria-hidden="true" /> Cambiar nivel
                  </button>
                </div>
                {/* Terciario y Universitario no llevan grilla: la misma materia se
                    llama distinto en cada facultad y ninguna lista fija alcanza.
                    Ver el comentario largo en constants/materiasSuperior.js. */}
                {usaBuscador(formData.educationLevel) ? (
                  <BuscadorDeMateria
                    nivel={formData.educationLevel}
                    valor={formData.subject}
                    onElegir={chooseSubject}
                    autoFocus
                  />
                ) : (
                <div className="kiosk-grid kiosk-grid-subjects">
                  {subjectsForLevel.map((subject, index) => {
                    /* El nivel decide la familia de portada: Primaria usa las
                       multicolor, el resto la de marca. Ver constants/bookingVisuals.js */
                    const visual = getSubjectVisual(subject, formData.educationLevel);
                    return (
                      <button
                        key={subject}
                        type="button"
                        className={`kiosk-choice-card kiosk-visual-card kiosk-choice-subject ${formData.subject === subject ? "is-selected" : ""}`}
                        onClick={() => chooseSubject(subject)}
                        aria-pressed={formData.subject === subject}
                        /* Sin aria-label, el nombre accesible sale de concatenar los
                           dos spans de adentro y queda "MateriaMatemática", sin
                           espacio: es lo que anuncia un lector de pantalla. Las
                           tarjetas de nivel ya se salvaban porque tienen su propio
                           aria-label; estas no lo tenían. */
                        aria-label={`Materia: ${subject}`}
                      >
                        <span className="kiosk-visual-media" aria-hidden="true">
                          <span className="kiosk-visual-halo" />
                          <img
                            src={visual.src}
                            width={visual.width}
                            height={visual.height}
                            alt=""
                            loading={index < 6 ? "eager" : "lazy"}
                            decoding="async"
                          />
                        </span>
                        <span className="kiosk-visual-copy">
                          <span className="kiosk-choice-kicker">Materia</span>
                          <span className="kiosk-choice-label">{subject}</span>
                        </span>
                        <span className="kiosk-selected-mark" aria-hidden="true"><FaCheckCircle /></span>
                      </button>
                    );
                  })}

                  {/* Última tarjeta: escribir una materia que no está listada. */}
                  <button
                    type="button"
                    className={`kiosk-choice-card kiosk-visual-card kiosk-choice-subject kiosk-choice-other ${otherOpen ? "is-selected" : ""}`}
                    onClick={() => {
                      setField("subject", "");
                      setOtherOpen((v) => !v);
                    }}
                    aria-expanded={otherOpen}
                    aria-controls="kiosk-other-subject"
                    // Mismo caso: sin esto se anuncia "PersonalizadaOtra materia".
                    aria-label="Otra materia: escribirla a mano"
                  >
                    <span className="kiosk-visual-media" aria-hidden="true">
                      <span className="kiosk-visual-halo" />
                      <img
                        src={OTHER_SUBJECT_VISUAL.src}
                        width={OTHER_SUBJECT_VISUAL.width}
                        height={OTHER_SUBJECT_VISUAL.height}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className="kiosk-visual-copy">
                      <span className="kiosk-choice-kicker">Personalizada</span>
                      <span className="kiosk-choice-label">Otra materia</span>
                    </span>
                    <span className="kiosk-card-arrow" aria-hidden="true"><FaPencilAlt /></span>
                  </button>
                </div>
                )}

                {formData.subject && !otherOpen && (
                  <div className="kiosk-selection-dock" role="status" aria-live="polite">
                    <div className="kiosk-selection-copy">
                      <span className="kiosk-confirmar-label">Tu elección</span>
                      <strong>{formData.subject}</strong>
                      <span>{formData.educationLevel}</span>
                    </div>
                    <button type="button" className="kiosk-avanzar" onClick={confirmSubject}>
                      Continuar <FaArrowRight aria-hidden="true" />
                    </button>
                  </div>
                )}

                {otherOpen && (
                  <div className="kiosk-other" id="kiosk-other-subject">
                    <label className="kiosk-other-label" htmlFor="kiosk-other-input">
                      {voz.otraMateriaTitulo}
                    </label>
                    <p id="kiosk-other-hint" className="kiosk-other-hint">
                      {voz.otraMateriaAyuda}
                    </p>
                    <div className="kiosk-other-row">
                      <input
                        id="kiosk-other-input"
                        type="text"
                        className="kiosk-other-input"
                        value={otherSubject}
                        maxLength={120}
                        autoComplete="off"
                        placeholder="Ej.: Análisis Matemático II"
                        onChange={(e) => {
                          setOtherSubject(e.target.value);
                          if (otherSubjectError) setOtherSubjectError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmOtherSubject();
                          }
                        }}
                        aria-invalid={otherSubjectError ? "true" : undefined}
                        aria-describedby={
                          otherSubjectError
                            ? "kiosk-other-hint kiosk-other-error"
                            : "kiosk-other-hint"
                        }
                      />
                      <button
                        type="button"
                        className="kiosk-other-go"
                        onClick={confirmOtherSubject}
                      >
                        Continuar
                      </button>
                    </div>
                    {otherSubjectError && (
                      <p
                        className="kiosk-other-error"
                        id="kiosk-other-error"
                        role="alert"
                      >
                        {otherSubjectError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ─── PASO 2: MODALIDAD ─── */}
        {step === 2 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s2-title">
            <h1 id="kiosk-s2-title" className="kiosk-title" tabIndex={-1}>¿Cómo preferís la clase?</h1>
            <p className="kiosk-subtitle">
              {formData.subject} · {formData.educationLevel}
            </p>
            <div className="kiosk-grid kiosk-grid-modality">
              {MODALITY_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`kiosk-choice-card kiosk-choice-modality ${formData.modality === m.value ? "is-selected" : ""}`}
                  onClick={() => chooseModality(m.value)}
                  aria-pressed={formData.modality === m.value}
                  /* Mismo caso que las materias: sin aria-label el nombre accesible
                     concatena los spans y se anuncia "OnlineVideollamada. Recibís el
                     enlace por email.", sin espacio después de la modalidad. */
                  aria-label={`${m.label}. ${m.value === "presencial" ? teacherLocation.address : m.hint}`}
                >
                  <span className="kiosk-choice-icon" aria-hidden="true">
                    {m.value === "online" ? <FaLaptop /> : <FaMapMarkerAlt />}
                  </span>
                  <span className="kiosk-choice-label">{m.label}</span>
                  {/* La dirección real en la tarjeta, no un "en el espacio de
                      Temperley" hardcodeado: acá es donde se decide, y decidir
                      sin saber a cuántas cuadras queda no es decidir. */}
                  <span className="kiosk-choice-hint">
                    {m.value === "presencial" ? teacherLocation.address : m.hint}
                  </span>
                </button>
              ))}
            </div>

            <p className="kiosk-hint-deselect">
              Tocá una opción para elegirla. Si querés cambiarla, tocala de
              nuevo para soltarla.
            </p>

            {/* Barra de confirmación, igual que en el horario: repite en
                palabras qué se eligió y recién ahí deja avanzar.
                El enlace al mapa va acá y no dentro de la tarjeta porque un
                <a> dentro de un <button> es HTML inválido: el navegador lo
                saca del botón y queda un control que no se puede tabular. */}
            {formData.modality && (
              <div className="kiosk-confirmar" role="status" aria-live="polite">
                <div className="kiosk-confirmar-txt">
                  <span className="kiosk-confirmar-label">Elegiste</span>
                  <strong className="kiosk-confirmar-valor">
                    {formData.modality === "presencial" ? "Presencial" : "Online"}
                  </strong>
                  {formData.modality === "presencial" ? (
                    <a
                      className="kiosk-confirmar-mapa"
                      href={teacherLocation.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FaMapMarkerAlt aria-hidden="true" />
                      {teacherLocation.address}
                      <span className="sr-only"> — ver en el mapa (abre en una pestaña nueva)</span>
                    </a>
                  ) : (
                    <span className="kiosk-confirmar-detalle">
                      Te mandamos el enlace de la videollamada por email.
                    </span>
                  )}
                </div>
                <div className="kiosk-confirmar-acciones">
                  <button
                    type="button"
                    className="kiosk-soltar"
                    onClick={() => chooseModality(formData.modality)}
                  >
                    Soltar
                  </button>
                  <button
                    type="button"
                    className="kiosk-avanzar"
                    onClick={confirmModality}
                  >
                    Continuar <FaArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
            </div>
          </section>
        )}

        {/* ─── PASO 3: TURNO ─── */}
        {step === 3 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s3-title">
            <h1 id="kiosk-s3-title" className="kiosk-title" tabIndex={-1}>¿Cuánto dura y cuándo?</h1>
            <p className="kiosk-subtitle">{voz.turnoSubtitulo}</p>

            <div className="kiosk-field-label">Duración</div>
            <div className="kiosk-chips">
              {selectableDurations.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`kiosk-chip ${Number(formData.duration) === opt.value ? "is-selected" : ""}`}
                  onClick={() => chooseDuration(opt.value)}
                >
                  {opt.label}
                  {opt.recommended && <span className="kiosk-chip-tag">Recomendado</span>}
                </button>
              ))}
            </div>

            {/* Repetir semanalmente. Va después de la duración y antes del
                calendario porque cambia el significado del horario que se elija:
                no es "este miércoles" sino "todos los miércoles".

                El default es una sola clase, a propósito: repetir tiene que ser
                algo que se elige, no algo que pasa sin querer. */}
            <div className="kiosk-field-label">¿Se repite?</div>
            <div className="kiosk-chips">
              {OPCIONES_DE_REPETICION.map((opt) => (
                <button
                  key={opt.semanas}
                  type="button"
                  className={`kiosk-chip ${semanas === opt.semanas ? "is-selected" : ""}`}
                  onClick={() => setSemanas(opt.semanas)}
                >
                  {opt.label}
                  {opt.recomendado && <span className="kiosk-chip-tag">Lo habitual</span>}
                </button>
              ))}
            </div>
            {semanas > 1 && (
              <p className="kiosk-repeticion-aviso" role="status">
                Se van a reservar {semanas} clases, una por semana, el mismo día y
                a la misma hora. Cada una queda con su propio código, así que
                podés cancelar o mover una sin tocar las demás.
              </p>
            )}

            {/* EL PRECIO, ACÁ Y NO EN EL PASO 5.
                Antes aparecía sólo al confirmar, o sea después de entregar nombre,
                teléfono, email y objetivo: el dato que más pesa para decidir llegaba
                último. Un costo que aparece al final no genera un reclamo, genera una
                pestaña cerrada, y deja la sensación de que estaba escondido.
                Va debajo de la duración porque es donde el número se vuelve calculable
                —precio = tarifa × horas— y donde de verdad informa la decisión. */}
            {precio && (
              <div className="kiosk-precio" role="status">
                <p className="kiosk-precio-monto">
                  {precio.porClaseTexto}
                  <span> por clase de {formatDurationOptionLabel(precio.duracionHoras)}</span>
                </p>
                {precio.totalSerieTexto && (
                  /* El total de la serie es EL número cuando alguien reserva ocho
                     clases: confirmar viendo sólo el precio por clase es enterarse del
                     total más tarde. */
                  <p className="kiosk-precio-total">
                    {precio.clases} clases: <strong>{precio.totalSerieTexto}</strong> en total
                  </p>
                )}
                {precio.huboDescuento && (
                  /* El ahorro dicho como ahorro, no como un precio más bajo a secas.
                     Es la diferencia entre "sale $22.500" y "te ahorrás $2.500 por hora
                     por venir dos": lo segundo explica POR QUÉ conviene quedarse más
                     tiempo, que es justamente lo que el descuento busca. */
                  <p className="kiosk-precio-ahorro">
                    Ya con el descuento por {formatDurationOptionLabel(precio.duracionHoras)}:
                    de {precio.tarifaBaseTexto} baja a <strong>{precio.tarifaTexto}</strong> la hora.
                  </p>
                )}
                <p className="kiosk-precio-nota">
                  Es el valor de referencia ({precio.tarifaTexto} por hora). No se paga
                  nada por adelantado: lo arreglás con Agustín.
                </p>
              </div>
            )}

            {/* Sin tarifa cargada no se inventa un número ni se deja un hueco mudo. */}
            {!precio && (
              <p className="kiosk-muted kiosk-precio-sin-dato">
                El valor de la clase lo acordás directamente con Agustín. No se paga nada
                por adelantado.
              </p>
            )}

            {formData.duration ? (
              <div role="status" aria-live="polite">
                <div className="kiosk-field-label">Elegí el día y el horario</div>
                {availabilityStatus === "loading" && (
                  <p className="kiosk-muted">Buscando horarios libres…</p>
                )}
                {availabilityStatus === "error" && (
                  <div className="kiosk-empty">
                    <p>No pudimos cargar la agenda.</p>
                    <button type="button" className="kiosk-inline-btn" onClick={retryAvailability}>
                      Reintentar
                    </button>
                  </div>
                )}
                {availabilityStatus === "ready" && upcomingSlotsByDay.length === 0 && (
                  <p className="kiosk-muted">
                    No hay turnos para esta duración en el período habilitado. Probá una duración más corta.
                  </p>
                )}
                {/* Un solo camino para elegir turno. Antes convivían una lista de
                    "próximos turnos" y un calendario detrás de un botón: dos formas
                    de hacer lo mismo, y el que llegaba primero a la lista no sabía
                    que existía el resto de la agenda. */}
                {availabilityStatus === "ready" && upcomingSlotsByDay.length > 0 && (
                  <KioskSlotCalendar
                    slotsByDay={upcomingSlotsByDay}
                    onPick={chooseSlot}
                    selectedSlot={formData.timeSlot}
                    onConfirm={confirmSlot}
                    onNeedFullRange={() => setShowAllDays(true)}
                  />
                )}
              </div>
            ) : (
              <p className="kiosk-muted">Elegí una duración para ver los horarios.</p>
            )}

            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
            </div>
          </section>
        )}

        {/* ─── PASO 4: DATOS ─── */}
        {step === 4 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s4-title">
            <h1 id="kiosk-s4-title" className="kiosk-title" tabIndex={-1}>{voz.datosTitulo}</h1>
            <p className="kiosk-subtitle">Solo lo necesario para confirmar tu reserva y preparar la clase.</p>

            {/* LA VOZ DE AGUSTÍN, UNA SOLA VEZ EN TODO EL FLUJO, Y ACÁ.

                Este es el paso donde más gente se cae: hasta recién elegías
                opciones —reversible, anónimo, sin costo—; a partir de este campo
                estás entregando el nombre de tu hijo y tu teléfono. Cambia la
                naturaleza de lo que se pide, y es exactamente donde alguien que
                no conoce al profesor cierra la pestaña.

                Contra eso no sirve otro argumento de servicio: todos los de
                arriba ya se leyeron. Sirve saber QUIÉN está del otro lado. Y de
                todo el material que grabó, esta es la frase que más confianza
                construye, porque va en contra de su propio interés comercial:
                alguien que avisa cuándo NO puede ayudarte es alguien a quien le
                creés cuando dice que sí.

                Es textual, sale de `constants/voz.js`, y es la misma que publica
                el sitio institucional en /sobre-mi. Un solo momento: dos serían
                un folleto en medio de un formulario. */}
            <figure className="kiosk-voz">
              <blockquote className="kiosk-voz-cita">{NO_PUEDO_AYUDARTE}</blockquote>
              <figcaption className="kiosk-voz-firma">
                Agustín Sosa, tu profesor
              </figcaption>
            </figure>

            {/* ETIQUETA, AYUDA, CAMPO, ERROR.
                Cada campo va en un <div> con su <label htmlFor> y no dentro de un
                <label> que lo envuelve todo. Envuelto, el mensaje de error pasaba a
                formar parte del NOMBRE del campo: un lector de pantalla anunciaba
                «Email (opcional) Revisá el email…» como si ese fuera el nombre, y
                después lo repetía por aria-describedby. La ayuda va arriba del campo
                porque se lee antes de escribir; el placeholder sólo muestra un ejemplo
                y ninguna instrucción depende de él, porque desaparece al tipear. */}
            <p className="kiosk-form-leyenda">Los campos con * son obligatorios.</p>

            <div className="kiosk-form-grid">
              <div className="kiosk-field">
                <label className="kiosk-field-label" htmlFor="kiosk-studentName">
                  {voz.nombreAlumnoLabel}
                </label>
                <input
                  id="kiosk-studentName"
                  type="text"
                  name="studentName"
                  className={`kiosk-input ${getFieldStateClass("studentName")}`}
                  value={formData.studentName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete={voz.autoCompleteAlumno}
                  required
                  {...propsDeError("studentName")}
                />
                {mensajeDeError("studentName")}
              </div>

              <div className="kiosk-field">
                {/* Quien lee es quien reserva, y el número es el suyo: «tu» en las dos
                    voces. */}
                <label className="kiosk-field-label" htmlFor="kiosk-phone">
                  Tu número de WhatsApp *
                </label>
                <span id="kiosk-ayuda-phone" className="kiosk-field-ayuda">
                  Te escribo para confirmar la reserva.
                </span>
                <input
                  id="kiosk-phone"
                  type="tel"
                  inputMode="tel"
                  name="phone"
                  className={`kiosk-input ${getFieldStateClass("phone")}`}
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  /* El ejemplo es lo que la gente tipea, no el resultado: la máscara
                     agrega sola el +54 9 y descarta el 0 inicial. */
                  placeholder="Ej.: 11 2345-6789"
                  autoComplete="tel"
                  required
                  {...propsDeError("phone", "kiosk-ayuda-phone")}
                />
                {mensajeDeError("phone")}
              </div>

              <div className="kiosk-field">
                <label className="kiosk-field-label" htmlFor="kiosk-email">
                  Email (opcional)
                </label>
                {/* Lo que dice es lo que hace el sistema de avisos: al email del
                    cliente le manda la confirmación y el recordatorio del turno. */}
                <span id="kiosk-ayuda-email" className="kiosk-field-ayuda">
                  Te llegan la confirmación y el recordatorio del turno.
                </span>
                <input
                  id="kiosk-email"
                  type="email"
                  inputMode="email"
                  name="email"
                  className={`kiosk-input ${getFieldStateClass("email", true)}`}
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ej.: nombre@correo.com"
                  autoComplete="email"
                  {...propsDeError("email", "kiosk-ayuda-email")}
                />
                {mensajeDeError("email")}
              </div>

              <div className="kiosk-field">
                <label className="kiosk-field-label" htmlFor="kiosk-yearGrade">
                  {voz.anioLabel}
                </label>
                <select
                  id="kiosk-yearGrade"
                  name="yearGrade"
                  className={`kiosk-input ${getFieldStateClass("yearGrade")}`}
                  value={formData.yearGrade}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  {...propsDeError("yearGrade")}
                >
                  <option value="">Elegí una opción</option>
                  {getKioskYearGradeOptions(formData.educationLevel).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {mensajeDeError("yearGrade")}
              </div>
            </div>

            {/* Antes acá había un checkbox: «Soy el alumno y soy mayor de edad».
                Preguntaba en el paso 4 algo que decide el trato de los pasos 1 al 3,
                así que ahora se pregunta al principio y esto sólo confirma la
                respuesta —con salida, porque una respuesta que no se puede corregir
                obliga a reiniciar toda la reserva—. */}
            <div className="kiosk-para-quien-recap">
              <p>
                {isAdult
                  ? "Reservás para vos, como mayor de edad."
                  : "Reservás para otra persona. Ahora completá tus datos como responsable."}
              </p>
              <button
                type="button"
                className="kiosk-inline-btn"
                /* «Cambiar» a secas no dice qué cambia fuera de contexto, que es como
                   lo oye quien recorre la lista de controles con un lector. */
                aria-label="Cambiar para quién es la clase"
                onClick={() => {
                  elegirParaQuien(null);
                  setStep(1);
                }}
              >
                <FaPencilAlt aria-hidden="true" /> Cambiar
              </button>
            </div>

            {!isAdult && (
              <div className="kiosk-form-grid">
                <div className="kiosk-field">
                  <label className="kiosk-field-label" htmlFor="kiosk-responsibleName">
                    Tu nombre completo *
                  </label>
                  <input
                    id="kiosk-responsibleName"
                    type="text"
                    name="responsibleName"
                    className={`kiosk-input ${getFieldStateClass("responsibleName")}`}
                    value={formData.responsibleName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete={voz.autoCompleteResponsable}
                    required
                    {...propsDeError("responsibleName")}
                  />
                  {mensajeDeError("responsibleName")}
                </div>
                <div className="kiosk-field">
                  <label
                    className="kiosk-field-label"
                    htmlFor="kiosk-responsibleRelationship"
                  >
                    Tu vínculo con el alumno *
                  </label>
                  <select
                    id="kiosk-responsibleRelationship"
                    name="responsibleRelationship"
                    className={`kiosk-input ${getFieldStateClass("responsibleRelationship")}`}
                    value={formData.responsibleRelationship}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    {...propsDeError("responsibleRelationship")}
                  >
                    <option value="">Elegí una opción</option>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {mensajeDeError("responsibleRelationship")}
                </div>
                {formData.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE && (
                  <div className="kiosk-field">
                    {/* «¿Cuál?» perdía el sentido fuera del bloque: la etiqueta tiene
                        que entenderse sola. */}
                    <label
                      className="kiosk-field-label"
                      htmlFor="kiosk-responsibleRelationshipOther"
                    >
                      ¿Qué vínculo tenés? *
                    </label>
                    <input
                      id="kiosk-responsibleRelationshipOther"
                      type="text"
                      name="responsibleRelationshipOther"
                      className={`kiosk-input ${getFieldStateClass("responsibleRelationshipOther")}`}
                      value={formData.responsibleRelationshipOther}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Ej.: tutor legal"
                      required
                      {...propsDeError("responsibleRelationshipOther")}
                    />
                    {mensajeDeError("responsibleRelationshipOther")}
                  </div>
                )}
              </div>
            )}

            <div className="kiosk-field">
              <label className="kiosk-field-label" htmlFor="kiosk-objective">
                {voz.objetivoLabel}
              </label>
              <span id="kiosk-ayuda-objective" className="kiosk-field-ayuda">
                {voz.objetivoAyuda}
              </span>
              <textarea
                id="kiosk-objective"
                name="objective"
                className={`kiosk-input kiosk-textarea ${getFieldStateClass("objective")}`}
                value={formData.objective}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={3}
                /* Sin materia en el ejemplo: la materia ya se eligió, y un ejemplo de
                   Física en una reserva de Química confunde más de lo que ayuda. */
                placeholder="Ej.: examen del viernes"
                maxLength={300}
                required
                {...propsDeError("objective", "kiosk-ayuda-objective")}
              />
              {mensajeDeError("objective")}
            </div>

            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
              <button type="button" className="kiosk-primary" onClick={submitContact}>
                Continuar <FaArrowRight aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* ─── PASO 5: CONFIRMAR ─── */}
        {step === 5 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s5-title">
            <h1 id="kiosk-s5-title" className="kiosk-title" tabIndex={-1}>Revisá y confirmá</h1>
            <p className="kiosk-subtitle">Si algo no está bien, tocá el paso de arriba para editarlo.</p>

            <dl className="kiosk-summary">
              <div><dt>Materia</dt><dd>{formData.subject}</dd></div>
              <div><dt>Nivel</dt><dd>{[formData.educationLevel, formData.yearGrade].filter(Boolean).join(" · ")}</dd></div>
              <div>
                <dt>Modalidad</dt>
                <dd>{formData.modality === "presencial" ? "Presencial" : "Online"}</dd>
              </div>
              {/* La dirección también acá: este es el paso donde alguien revisa
                  antes de comprometerse, y "Presencial" sin decir dónde no es
                  algo que se pueda revisar. */}
              {formData.modality === "presencial" && (
                <div>
                  <dt>Dónde</dt>
                  <dd>
                    <a
                      className="kiosk-summary-link"
                      href={teacherLocation.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {teacherLocation.address}
                      <span className="sr-only"> — ver en el mapa (pestaña nueva)</span>
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt>Fecha</dt>
                <dd>
                  {formData.timeSlot
                    ? format(formData.timeSlot, "EEEE d 'de' MMMM", { locale: es })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>
                  {formData.timeSlot
                    ? `${format(formData.timeSlot, "HH:mm")} a ${format(addMinutes(formData.timeSlot, Number(formData.duration) * 60), "HH:mm")} h`
                    : "—"}
                </dd>
              </div>
              {/* Cuántas clases se están por reservar. Faltaba, y es el dato más
                  importante de este paso cuando la serie es de ocho: confirmar
                  sin ver que son ocho clases es confirmar a ciegas. */}
              {semanas > 1 && (
                <div>
                  <dt>Repite</dt>
                  <dd>
                    {semanas} clases, una por semana
                  </dd>
                </div>
              )}
              <div><dt>Alumno</dt><dd>{formData.studentName}</dd></div>
              {priceLabel && (
                <div><dt>Estimado</dt><dd>{priceLabel}</dd></div>
              )}
            </dl>

            {/* Decirlo en lugar de dejar un hueco. La reserva se puede confirmar
                igual: el precio es informativo y nunca fue lo que se cobra. */}
            {ajustesFallaron && !priceLabel && (
              <p className="kiosk-aviso-suave" role="status">
                No pudimos cargar el precio estimado. Podés confirmar igual y lo
                acordás con Agustín; el valor no cambia por esto.
              </p>
            )}

            {submitError && (
              <p className="kiosk-error" role="alert">{submitError}</p>
            )}

            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev} disabled={loading}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
              <button
                type="button"
                className="kiosk-primary kiosk-confirm"
                onClick={handleSubmit}
                disabled={loading || !isReadyToSubmit}
              >
                {loading ? "Confirmando…" : "Confirmar reserva"}
              </button>
            </div>
          </section>
        )}
      </div>

      <BookingSuccessModal
        show={showModal}
        successData={successData}
        whatsappConfirmText={whatsappConfirmText}
        onCopyCode={() => {
          if (successData?.bookingCode) navigator.clipboard?.writeText(successData.bookingCode);
        }}
        onCopyManagementLink={() => {
          if (successData?.managementUrl) navigator.clipboard?.writeText(successData.managementUrl);
        }}
        onClose={resetAfterSuccess}
      />
    </div>
  );
};

export default BookingKiosk;

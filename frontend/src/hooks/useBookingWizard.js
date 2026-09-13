import { useCallback, useMemo, useState } from "react";
import {
  BOOKING_INITIAL_FORM_DATA,
  WIZARD_STEPS,
  isAcademicDraftComplete,
  updateBookingDraft,
} from "../constants/bookingWizard";
import {
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
  sanitizePersonNameAr,
  sanitizeRelationshipOtherAr,
  formatPhoneMaskAr,
} from "../utils/bookingFormatters";

// Con guion: «María-José». Ver `sanitizePersonNameAr`.
const regexName = /^[A-Za-zÀ-ÿ\u00f1\u00d1\s'-]{3,60}$/;
const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const useBookingWizard = (showToast, initialOverrides = {}) => {
  const [formData, setFormData] = useState(() => ({
    ...BOOKING_INITIAL_FORM_DATA,
    ...initialOverrides,
  }));
  const [isAdult, setIsAdult] = useState(false);
  const [hasAttemptedNext, setHasAttemptedNext] = useState(false);
  /* Los campos que la persona ya dejó al menos una vez. Es lo que habilita el
     rojo: ver `getFieldStateClass`. */
  const [camposDejados, setCamposDejados] = useState({});

  const isValidField = useCallback(
    (field) => {
      switch (field) {
        case "studentName":
          return (
            formData.studentName.trim().length > 0 &&
            regexName.test(formData.studentName.trim())
          );
        case "responsibleName":
          return (
            formData.responsibleName.trim().length > 0 &&
            regexName.test(formData.responsibleName.trim())
          );
        case "responsibleRelationship":
          return isAdult ? true : formData.responsibleRelationship !== "";
        case "responsibleRelationshipOther":
          return formData.responsibleRelationship !==
            RESPONSIBLE_RELATIONSHIP_OTHER_VALUE
            ? true
            : regexName.test(formData.responsibleRelationshipOther.trim());
        case "email":
          return (
            formData.email.trim().length > 0 &&
            regexEmail.test(formData.email.trim())
          );
        case "phone":
          return formData.phone.replace(/\D/g, "").length === 13;
        case "educationLevel":
          return formData.educationLevel !== "";
        case "yearGrade":
          return formData.yearGrade.trim().length > 0;
        case "subject":
          return formData.subject.trim().length > 0;
        case "objective":
          return (
            formData.objective.trim().length >= 3 &&
            formData.objective.trim().length <= 300
          );
        case "school":
          return (
            formData.school.trim().length === 0 ||
            formData.school.trim().length >= 2
          );
        case "academicSituation":
          return true;
        default:
          return false;
      }
    },
    [formData, isAdult],
  );

  const isEmailAcceptable = useMemo(
    () => formData.email.trim() === "" || regexEmail.test(formData.email.trim()),
    [formData.email],
  );

  const isPersonalInfoComplete = useMemo(
    () =>
      isValidField("studentName") &&
      isValidField("phone") &&
      (isAdult
        ? true
        : isValidField("responsibleName") &&
          isValidField("responsibleRelationship") &&
          isValidField("responsibleRelationshipOther")) &&
      isEmailAcceptable,
    [isValidField, isAdult, isEmailAcceptable],
  );

  const isAcademicInfoComplete = useMemo(
    () => isAcademicDraftComplete(formData),
    [formData],
  );

  const canProceedToStep2 = useMemo(
    () => isPersonalInfoComplete && isAcademicInfoComplete,
    [isPersonalInfoComplete, isAcademicInfoComplete],
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === "studentName" || name === "responsibleName") {
      finalValue = sanitizePersonNameAr(value);
    }
    if (name === "responsibleRelationshipOther") {
      finalValue = sanitizeRelationshipOtherAr(value);
    }
    if (name === "phone") finalValue = formatPhoneMaskAr(value);
    if (name === "email") finalValue = value.trimStart().toLowerCase();

    setFormData((prev) => {
      const newData = updateBookingDraft(prev, { [name]: finalValue });
      if (name === "educationLevel") {
        newData.yearGrade = "";
        newData.subject = "";
      }
      if (
        name === "responsibleRelationship" &&
        value !== RESPONSIBLE_RELATIONSHIP_OTHER_VALUE
      ) {
        newData.responsibleRelationshipOther = "";
      }
      return newData;
    });
  }, []);

  const toggleAdultMode = useCallback(() => {
    setIsAdult((current) => {
      const next = !current;
      if (next) {
        setFormData((prev) => ({
          ...prev,
          responsibleName: "",
          responsibleRelationship: "",
          responsibleRelationshipOther: "",
        }));
      }
      return next;
    });
    showToast?.(
      isAdult
        ? "Volviste al modo con responsable. Ahora podés cargar los datos del adulto que acompaña la reserva."
        : "Activaste reserva directa. Limpié los datos del adulto responsable para que el formulario quede prolijo.",
      "info",
      {
        title: isAdult ? "Modo con responsable" : "Reserva directa activada",
      },
    );
  }, [isAdult, showToast]);

  const resetForm = useCallback(() => {
    setFormData(BOOKING_INITIAL_FORM_DATA);
    setIsAdult(false);
    setHasAttemptedNext(false);
    setCamposDejados({});
  }, []);

  /* Se cuelga del `onBlur` de cada campo. Sólo anota el `name`: no valida
     nada, la decisión de mostrar el rojo sigue siendo de
     `getFieldStateClass`. El `prev[name]` evita un re-render cada vez que la
     persona entra y sale de un campo que ya estaba anotado. */
  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    if (!name) return;
    setCamposDejados((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  /* PREMIAR TEMPRANO, RETAR TARDE.

     El verde aparece apenas el dato está bien, mientras se escribe. El rojo,
     en cambio, espera a una de dos cosas: que la persona haya dejado el campo
     con algo escrito, o que haya intentado avanzar.

     Antes el rojo salía con la primera letra —con el cuarto dígito en el
     teléfono—. Medido en un teléfono: escribiendo «lucia.f», con el foco
     todavía en el campo, ya decía «parece que le falta el @», antes de que la
     persona llegara a escribirlo. Un formulario que reta mientras se escribe
     se siente hostil, y además es más lento: hace frenar a leer un error que
     todavía no es un error.

     Dejar un campo VACÍO no lo pone en rojo. Quien recorre el formulario con
     Tab, o tocando campos para ver qué hay, no tiene que dejar una estela roja
     detrás; lo que falta se reclama cuando intenta seguir.

     Una vez que el rojo apareció, se queda mientras la persona corrige —el
     campo ya está anotado como dejado— y se va en cuanto el dato queda bien,
     porque `isValidField` se evalúa primero. */
  const getFieldStateClass = useCallback(
    (field, isOptional = false) => {
      if (isValidField(field)) return "is-valid";
      if (isOptional && formData[field]?.trim() === "") return "";
      const value = String(formData[field] ?? "").trim();
      const dejadoConAlgoEscrito = Boolean(camposDejados[field]) && value.length > 0;
      return hasAttemptedNext || dejadoConAlgoEscrito ? "error" : "";
    },
    [isValidField, formData, hasAttemptedNext, camposDejados],
  );

  /* El motivo por el que un campo está mal, en texto.

     Hasta ahora el único aviso era el borde rojo más un toast que decía
     «revisá los campos resaltados». "Resaltado" es una propiedad que sólo
     existe en el color: quien no lo ve escucha el toast y no tiene manera de
     saber cuáles son. Devolver el motivo por campo permite escribirlo al lado
     del campo y colgarlo de `aria-describedby`, que es lo que un lector de
     pantalla lee cuando el foco llega ahí.

     Devuelve null cuando el campo no debe mostrar error todavía —misma
     condición que `getFieldStateClass`, para que el texto y el borde rojo
     aparezcan y desaparezcan juntos y nunca se contradigan. */
  const getFieldError = useCallback(
    (field, isOptional = false) => {
      if (getFieldStateClass(field, isOptional) !== "error") return null;
      const value = String(formData[field] ?? "").trim();
      const vacio = value.length === 0;
      /* Quien lee es siempre quien reserva. `isAdult` es «para mí»: ahí el alumno
         es quien lee y se le habla de «tu». Reservando para otra persona, el
         alumno va en tercera y el responsable —que es quien lee— va con «tu».
         Agustín habla en singular: «contame», no «contanos». */
      const paraMi = isAdult;
      switch (field) {
        case "studentName":
          if (!vacio) return "Usá letras, espacios, apóstrofes o guiones.";
          return paraMi
            ? "Escribí tu nombre completo."
            : "Escribí el nombre completo del alumno.";
        case "responsibleName":
          return vacio
            ? "Escribí tu nombre completo."
            : "Usá letras, espacios, apóstrofes o guiones.";
        case "responsibleRelationship":
          return "Elegí tu vínculo con el alumno.";
        case "responsibleRelationshipOther":
          return "Escribí qué vínculo tenés con el alumno.";
        case "email":
          /* Muestra el formato en vez de adivinar qué falta: «le falta el @» es
             falso cuando lo que falta es el dominio, y al revés. */
          return "Escribí el email con este formato: nombre@correo.com";
        case "phone":
          /* No promete una cantidad de dígitos. Decía «los 8 dígitos», pero el
             número nacional tiene diez entre código de área y abonado, y como el
             código de área es de dos, tres o cuatro, el abonado no siempre tiene
             ocho. */
          return vacio
            ? "Escribí tu número de WhatsApp."
            : "Ingresá el número completo, con el código de área.";
        case "educationLevel":
          return "Volvé al paso 1 y elegí el nivel.";
        case "yearGrade":
          return paraMi ? "Elegí tu año o grado." : "Elegí el año o grado del alumno.";
        case "subject":
          return "Volvé al paso 1 y elegí la materia.";
        case "objective":
          if (value.length > 300) return "Es un poco largo: contalo en 300 caracteres o menos.";
          return paraMi
            ? "Contame qué querés lograr en la clase."
            : "Contame qué necesita lograr en la clase.";
        case "school":
          return "Si ponés la escuela, escribí al menos dos letras.";
        default:
          return "Revisá este dato.";
      }
    },
    [getFieldStateClass, formData, isAdult],
  );

  const requiredChecks = useMemo(
    () => [
      isValidField("studentName"),
      isValidField("phone"),
      isAdult ? true : isValidField("responsibleName"),
      isAdult ? true : isValidField("responsibleRelationship"),
      isValidField("educationLevel"),
      isValidField("yearGrade"),
      isValidField("subject"),
      isValidField("objective"),
    ],
    [isValidField, isAdult],
  );

  const completionPercent = useMemo(() => {
    const completed = requiredChecks.filter(Boolean).length;
    return Math.round((completed / requiredChecks.length) * 100);
  }, [requiredChecks]);

  return {
    formData,
    setFormData,
    isAdult,
    setIsAdult,
    hasAttemptedNext,
    setHasAttemptedNext,
    hasUnlockedAcademic: isPersonalInfoComplete,
    hasUnlockedComments: isAcademicInfoComplete,
    isValidField,
    isEmailAcceptable,
    isPersonalInfoComplete,
    isAcademicInfoComplete,
    canProceedToStep2,
    handleChange,
    handleBlur,
    toggleAdultMode,
    resetForm,
    getFieldStateClass,
    getFieldError,
    completionPercent,
    requiredChecks,
    WIZARD_STEPS,
  };
};

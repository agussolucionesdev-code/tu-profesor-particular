import { useCallback, useMemo, useState } from "react";
import { WIZARD_STEPS } from "../constants/bookingWizard";
import {
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
  sanitizePersonNameAr,
  sanitizeRelationshipOtherAr,
  formatPhoneMaskAr,
} from "../utils/bookingFormatters";

const INITIAL_FORM_DATA = {
  responsibleName: "",
  responsibleRelationship: "",
  responsibleRelationshipOther: "",
  studentName: "",
  email: "",
  phone: "",
  school: "",
  educationLevel: "",
  yearGrade: "",
  subject: "",
  academicSituation: "",
  timeSlot: null,
  duration: "",
};

const regexName = /^[A-Za-zÀ-ÿ\u00f1\u00d1\s']{3,60}$/;
const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const useBookingWizard = (showToast) => {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isAdult, setIsAdult] = useState(false);
  const [hasAttemptedNext, setHasAttemptedNext] = useState(false);

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
        case "school":
          return formData.school.trim().length > 0;
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
    () =>
      isValidField("educationLevel") &&
      isValidField("yearGrade") &&
      isValidField("subject") &&
      isValidField("school"),
    [isValidField],
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
      const newData = { ...prev, [name]: finalValue };
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
    setFormData(INITIAL_FORM_DATA);
    setIsAdult(false);
    setHasAttemptedNext(false);
  }, []);

  const getFieldStateClass = useCallback(
    (field, isOptional = false) => {
      if (isValidField(field)) return "is-valid";
      if (isOptional && formData[field]?.trim() === "") return "";
      const value = String(formData[field] ?? "").trim();
      const hasStartedTyping =
        field === "phone"
          ? formData.phone.replace(/\D/g, "").length >= 4
          : value.length > 0;
      return hasAttemptedNext || hasStartedTyping ? "error" : "";
    },
    [isValidField, formData, hasAttemptedNext],
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
      isValidField("school"),
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
    toggleAdultMode,
    resetForm,
    getFieldStateClass,
    completionPercent,
    requiredChecks,
    WIZARD_STEPS,
  };
};

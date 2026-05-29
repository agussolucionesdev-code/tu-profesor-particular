import { useMemo } from "react";
import {
  buildStudentKey as studentKey,
  formatDayLabel as formatDay,
  getBookingStatusBucket as bookingStatusBucket,
  getResponsibleDisplay as responsibleLabel,
  getResponsibleRelationshipDisplay as responsibleRelationshipLabel,
  getResponsibleSummary as responsibleSummary,
  isSameCalendarDay as sameDay,
  normalizeText as norm,
  toSafeDate as toDate,
} from "../utils/bookingFormatters";

export const useDashboardStats = (sortedBookings) => {
  const dashboard = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const enriched = sortedBookings.map((booking) => ({
      ...booking,
      start: toDate(booking.timeSlot),
      end: toDate(booking.endTime),
    }));

    const stats = {
      total: enriched.length,
      pending: enriched.filter((b) => b.status === "Pendiente").length,
      confirmed: enriched.filter(
        (b) => bookingStatusBucket(b.status) === "Confirmado",
      ).length,
      cancelled: enriched.filter((b) => b.status === "Cancelado").length,
      finalized: enriched.filter((b) => b.status === "Finalizado").length,
    };

    return { now, today, next24h, enriched, stats };
  }, [sortedBookings]);

  const overviewData = useMemo(() => {
    const todayBookings = dashboard.enriched.filter(
      (b) =>
        b.start &&
        sameDay(b.start, dashboard.today) &&
        b.status !== "Cancelado",
    );
    const upcomingBookings = dashboard.enriched.filter(
      (b) =>
        b.start &&
        b.start >= dashboard.now &&
        b.status !== "Cancelado",
    );
    const upcoming24h = upcomingBookings.filter(
      (b) => b.start && b.start <= dashboard.next24h,
    );
    const overduePending = dashboard.enriched.filter(
      (b) =>
        b.status === "Pendiente" &&
        b.start &&
        b.start < dashboard.now,
    );

    const tomorrowStart = new Date(dashboard.today);
    tomorrowStart.setDate(dashboard.today.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const tomorrowWithoutEmail = dashboard.enriched.filter(
      (b) =>
        b.start &&
        b.start >= tomorrowStart &&
        b.start <= tomorrowEnd &&
        b.status !== "Cancelado" &&
        !b.email,
    );

    const weekFlow = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(dashboard.today);
      date.setDate(dashboard.today.getDate() + index);
      const count = dashboard.enriched.filter(
        (b) =>
          b.start &&
          sameDay(b.start, date) &&
          b.status !== "Cancelado",
      ).length;
      return {
        label: formatDay(date),
        fullLabel: date.toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        count,
        isToday: index === 0,
        isPast: false, // weekFlow starts from today, all items are today or future
      };
    });

    const subjectsMap = new Map();
    dashboard.enriched.forEach((b) => {
      const subject =
        String(b.subject || "Sin materia").trim() || "Sin materia";
      subjectsMap.set(subject, (subjectsMap.get(subject) || 0) + 1);
    });
    const topSubjects = [...subjectsMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const studentsMap = new Map();
    dashboard.enriched.forEach((booking) => {
      const key = studentKey(booking);
      const existing = studentsMap.get(key);
      if (!existing) {
        studentsMap.set(key, {
          key,
          studentName: booking.studentName,
          responsibleName: responsibleLabel(booking),
          responsibleRelationship: responsibleRelationshipLabel(booking),
          responsibleSummary: responsibleSummary(booking),
          school: booking.school,
          educationLevel: booking.educationLevel,
          yearGrade: booking.yearGrade,
          phone: booking.phone,
          email: booking.email,
          totalBookings: 1,
          nextBooking:
            booking.start &&
            booking.start >= dashboard.now &&
            booking.status !== "Cancelado"
              ? booking.start
              : null,
          subjects: new Set([booking.subject].filter(Boolean)),
          searchBlob: norm(
            [
              booking.studentName,
              booking.responsibleName,
              responsibleRelationshipLabel(booking),
              booking.phone,
              booking.email,
              booking.subject,
              booking.school,
            ].join(" "),
          ),
        });
        return;
      }

      existing.totalBookings += 1;
      if (booking.subject) existing.subjects.add(booking.subject);
      if (
        booking.start &&
        booking.start >= dashboard.now &&
        booking.status !== "Cancelado" &&
        (!existing.nextBooking || booking.start < existing.nextBooking)
      ) {
        existing.nextBooking = booking.start;
      }
    });

    const students = [...studentsMap.values()]
      .map((student) => ({ ...student, subjects: [...student.subjects] }))
      .sort(
        (a, b) =>
          (a.nextBooking?.getTime() ?? Infinity) -
          (b.nextBooking?.getTime() ?? Infinity),
      );

    const recentActivity = [...dashboard.enriched]
      .sort(
        (a, b) =>
          (toDate(b.updatedAt)?.getTime() ?? 0) -
          (toDate(a.updatedAt)?.getTime() ?? 0),
      )
      .slice(0, 6);

    /* --- Revenue tracking --- */
    const now = dashboard.now;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthRevenue = dashboard.enriched
      .filter((b) => {
        if (b.status !== "Finalizado") return false;
        return (
          b.start &&
          b.start.getFullYear() === currentYear &&
          b.start.getMonth() === currentMonth
        );
      })
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthRevenue = dashboard.enriched
      .filter((b) => {
        if (b.status !== "Finalizado") return false;
        return (
          b.start &&
          b.start.getFullYear() === lastMonthDate.getFullYear() &&
          b.start.getMonth() === lastMonthDate.getMonth()
        );
      })
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    return {
      todayBookings,
      upcomingBookings,
      upcoming24h,
      overduePending,
      tomorrowWithoutEmail,
      weekFlow,
      topSubjects,
      students,
      recentActivity,
      monthRevenue,
      lastMonthRevenue,
    };
  }, [dashboard]);

  const filteredStudents = useMemo(() => {
    return overviewData.students;
  }, [overviewData.students]);

  const heroText = useMemo(() => {
    if (!dashboard.stats.total) return "Todavía no hay reservas cargadas.";
    if (overviewData.todayBookings.length > 0) {
      return `Hoy tenés ${overviewData.todayBookings.length} clases activas y ${overviewData.upcoming24h.length} movimientos en las próximas 24 horas.`;
    }
    if (dashboard.stats.pending > 0) {
      return `Tenés ${dashboard.stats.pending} registros pendientes para revisar.`;
    }
    return "Todo en orden. Buen momento para revisar alumnos y agenda.";
  }, [
    dashboard.stats.pending,
    dashboard.stats.total,
    overviewData.todayBookings.length,
    overviewData.upcoming24h.length,
  ]);

  return {
    dashboard,
    overviewData,
    filteredStudents,
    heroText,
  };
};

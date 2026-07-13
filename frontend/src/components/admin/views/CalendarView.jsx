import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaRegCalendarAlt,
} from "react-icons/fa";
import { fetchAdminSettings } from "../../../api/bookingApi";
import { toSafeDate as toDate } from "../../../utils/bookingFormatters";
import {
  createCalendarRange,
  parseCalendarSchedule,
} from "../../../utils/calendarSchedule";
import "./CalendarView.css";

const HOUR_HEIGHT = 64;
const TIME_GUTTER = 56;

const getBookingTop = (booking, range) => {
  const hour = booking.start.getHours() + booking.start.getMinutes() / 60;
  return Math.max(0, (hour - range.openingHour) * HOUR_HEIGHT);
};

const getBookingHeight = (booking) => {
  const duration = Number(booking.duration) || 1;
  return Math.max(duration * HOUR_HEIGHT, HOUR_HEIGHT / 2);
};

const isOutOfHours = (booking, range) => {
  if (!booking.start) return false;
  const startHour = booking.start.getHours() + booking.start.getMinutes() / 60;
  const endHour = booking.end
    ? booking.end.getHours() + booking.end.getMinutes() / 60
    : startHour + (Number(booking.duration) || 1);
  return startHour < range.openingHour || endHour > range.closingHour;
};

const statusClass = (status) => {
  const map = {
    Pendiente: "cal-pending",
    Confirmado: "cal-confirmed",
    Finalizado: "cal-finalized",
    Cancelado: "cal-cancelled",
  };
  return map[status] || "cal-confirmed";
};

const BookingBlock = ({ booking, onClick, range }) => {
  const startStr = booking.start
    ? format(booking.start, "HH:mm", { locale: es })
    : "";
  const dateStr = booking.start
    ? format(booking.start, "EEEE d 'de' MMMM", { locale: es })
    : "";
  const ariaLabel = [
    `Turno de ${booking.studentName}`,
    booking.subject,
    dateStr && `el ${dateStr}`,
    startStr && `a las ${startStr} h`,
    `Estado: ${booking.status}`,
  ].filter(Boolean).join(", ");

  return (
    <button
      type="button"
      className={`cal-booking-block ${statusClass(booking.status)}`}
      style={{
        top: `${getBookingTop(booking, range)}px`,
        height: `${getBookingHeight(booking)}px`,
      }}
      onClick={() => onClick(booking)}
      aria-label={ariaLabel}
      title={`${booking.studentName} · ${booking.subject} · ${booking.status}`}
    >
      <strong className="cal-block-name">{booking.studentName}</strong>
      <span className="cal-block-subject">{booking.subject}</span>
    </button>
  );
};

const CalendarWeekView = ({ weekStart, bookings, onSelectBooking, range }) => {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const bookingsForDay = (day) =>
    bookings.filter((booking) => booking.start && isSameDay(booking.start, day));

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowIsVisible =
    nowHour >= range.openingHour && nowHour <= range.closingHour;
  const nowTop =
    nowIsVisible && now >= weekStart && now <= addDays(weekStart, 6)
      ? (nowHour - range.openingHour) * HOUR_HEIGHT
      : null;

  return (
    <div className="cal-week-scroll">
      <div className="cal-week-head" style={{ paddingLeft: TIME_GUTTER }}>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`cal-day-header ${isToday(day) ? "is-today" : ""}`}
          >
            <span className="cal-day-name">
              {format(day, "EEE", { locale: es })}
            </span>
            <strong className="cal-day-num">{format(day, "d")}</strong>
          </div>
        ))}
      </div>

      <div
        className="cal-week-body"
        style={{ height: `${range.totalHours * HOUR_HEIGHT}px` }}
      >
        <div className="cal-time-gutter" style={{ width: TIME_GUTTER }}>
          {range.hours.map((hour) => (
            <div
              key={hour}
              className="cal-hour-label"
              style={{ top: `${(hour - range.openingHour) * HOUR_HEIGHT}px` }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`cal-day-col ${isToday(day) ? "is-today" : ""}`}
          >
            {range.hours.map((hour) => (
              <div
                key={hour}
                className="cal-hour-line"
                style={{ top: `${(hour - range.openingHour) * HOUR_HEIGHT}px` }}
              />
            ))}

            {nowTop !== null && isToday(day) && (
              <div className="cal-now-line" style={{ top: `${nowTop}px` }} />
            )}

            {bookingsForDay(day).map((booking) => (
              <BookingBlock
                key={booking._id}
                booking={booking}
                onClick={onSelectBooking}
                range={range}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const CalendarDayView = ({ currentDay, bookings, onSelectBooking, range }) => {
  const dayBookings = bookings.filter(
    (booking) => booking.start && isSameDay(booking.start, currentDay),
  );
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const isCurrentDay = isToday(currentDay);
  const nowTop =
    isCurrentDay && nowHour >= range.openingHour && nowHour <= range.closingHour
      ? (nowHour - range.openingHour) * HOUR_HEIGHT
      : null;

  return (
    <div
      className="cal-day-body"
      style={{ height: `${range.totalHours * HOUR_HEIGHT}px` }}
    >
      <div className="cal-time-gutter" style={{ width: TIME_GUTTER }}>
        {range.hours.map((hour) => (
          <div
            key={hour}
            className="cal-hour-label"
            style={{ top: `${(hour - range.openingHour) * HOUR_HEIGHT}px` }}
          >
            {String(hour).padStart(2, "0")}:00
          </div>
        ))}
      </div>

      <div className={`cal-day-col is-full ${isCurrentDay ? "is-today" : ""}`}>
        {range.hours.map((hour) => (
          <div
            key={hour}
            className="cal-hour-line"
            style={{ top: `${(hour - range.openingHour) * HOUR_HEIGHT}px` }}
          />
        ))}

        {nowTop !== null && (
          <div className="cal-now-line" style={{ top: `${nowTop}px` }} />
        )}

        {dayBookings.length === 0 ? (
          <p className="cal-empty-day">Sin clases este día</p>
        ) : (
          dayBookings.map((booking) => (
            <BookingBlock
              key={booking._id}
              booking={booking}
              onClick={onSelectBooking}
              range={range}
            />
          ))
        )}
      </div>
    </div>
  );
};

const CalendarView = ({ sortedBookings, onSelectBooking, authConfig }) => {
  const enriched = useMemo(
    () => sortedBookings.map((booking) => ({
      ...booking,
      start: toDate(booking.timeSlot),
      end: toDate(booking.endTime),
    })),
    [sortedBookings],
  );
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 720);
  const [scheduleStatus, setScheduleStatus] = useState("loading");
  const [scheduleRange, setScheduleRange] = useState(null);
  const [scheduleRequestVersion, setScheduleRequestVersion] = useState(0);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;
    fetchAdminSettings(authConfig)
      .then((response) => {
        if (!isCurrentRequest) return;
        const range = createCalendarRange(
          parseCalendarSchedule(response.data.data),
        );
        setScheduleRange(range);
        setScheduleStatus(range ? "ready" : "error");
      })
      .catch(() => {
        if (!isCurrentRequest) return;
        setScheduleRange(null);
        setScheduleStatus("error");
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [authConfig, scheduleRequestVersion]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const outOfHoursBookings = scheduleRange
    ? enriched.filter((booking) => {
      if (!booking.start) return false;
      if (isMobile) {
        return isSameDay(booking.start, currentDate) &&
          isOutOfHours(booking, scheduleRange);
      }
      return booking.start >= weekStart &&
        booking.start <= weekEnd &&
        isOutOfHours(booking, scheduleRange);
    })
    : [];

  const goToPrevious = () =>
    setCurrentDate((date) => isMobile ? subDays(date, 1) : subWeeks(date, 1));
  const goToNext = () =>
    setCurrentDate((date) => isMobile ? addDays(date, 1) : addWeeks(date, 1));
  const goToToday = () => setCurrentDate(new Date());

  const headingText = isMobile
    ? format(currentDate, "EEEE d 'de' MMMM", { locale: es })
    : `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
  const visibleRangeLabel = scheduleRange
    ? `${String(scheduleRange.openingHour).padStart(2, "0")}:00–${String(scheduleRange.closingHour).padStart(2, "0")}:00`
    : "";

  return (
    <section className="admin-card cal-container">
      <div className="cal-toolbar">
        <button
          type="button"
          className="cal-nav-btn"
          onClick={goToPrevious}
          title={isMobile ? "Día anterior" : "Semana anterior"}
        >
          <FaChevronLeft aria-hidden="true" />
        </button>

        <div className="cal-toolbar-center">
          <FaRegCalendarAlt aria-hidden="true" className="cal-toolbar-icon" />
          <h3 className="cal-heading">{headingText}</h3>
        </div>

        <button
          type="button"
          className="cal-nav-btn"
          onClick={goToNext}
          title={isMobile ? "Día siguiente" : "Semana siguiente"}
        >
          <FaChevronRight aria-hidden="true" />
        </button>

        <button type="button" className="cal-today-btn" onClick={goToToday}>
          Hoy
        </button>
      </div>

      <div className="cal-legend">
        {["Pendiente", "Confirmado", "Finalizado", "Cancelado"].map((status) => (
          <span key={status} className={`cal-legend-item ${statusClass(status)}`}>
            {status}
          </span>
        ))}
      </div>

      {outOfHoursBookings.length > 0 && (
        <div className="cal-out-of-hours-warning" role="alert">
          <FaExclamationTriangle aria-hidden="true" />
          <span>
            {outOfHoursBookings.length === 1
              ? `Hay 1 turno fuera del horario visible (${visibleRangeLabel})`
              : `Hay ${outOfHoursBookings.length} turnos fuera del horario visible (${visibleRangeLabel})`}
            :{" "}
            {outOfHoursBookings.map((booking) => (
              <strong key={booking._id}>
                {booking.studentName}{" "}
                {booking.start ? format(booking.start, "EEE d HH:mm", { locale: es }) : ""}
              </strong>
            )).reduce((items, item, index) => index === 0 ? [item] : [...items, ", ", item], [])}
            . Revisá la configuración de horario.
          </span>
        </div>
      )}

      {scheduleStatus === "loading" && (
        <div className="cal-schedule-state" role="status">
          Cargando horario configurado…
        </div>
      )}
      {scheduleStatus === "error" && (
        <div className="cal-schedule-state" role="alert">
          <FaExclamationTriangle aria-hidden="true" />
          <span>No pudimos verificar el horario configurado. El calendario queda deshabilitado para evitar mostrar una agenda incorrecta.</span>
          <button
            type="button"
            className="cal-today-btn"
            onClick={() => {
              setScheduleStatus("loading");
              setScheduleRange(null);
              setScheduleRequestVersion((version) => version + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {scheduleStatus === "ready" && scheduleRange && (
        <div className="cal-scroll-wrapper">
          {isMobile ? (
            <CalendarDayView
              currentDay={currentDate}
              bookings={enriched}
              onSelectBooking={onSelectBooking}
              range={scheduleRange}
            />
          ) : (
            <CalendarWeekView
              weekStart={weekStart}
              bookings={enriched}
              onSelectBooking={onSelectBooking}
              range={scheduleRange}
            />
          )}
        </div>
      )}
    </section>
  );
};

export default CalendarView;

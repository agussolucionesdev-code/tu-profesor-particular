import { useEffect, useState } from "react";
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
  FaRegCalendarAlt,
} from "react-icons/fa";
import { toSafeDate as toDate } from "../../../utils/bookingFormatters";
import "./CalendarView.css";

const OPENING_HOUR = 7;
const CLOSING_HOUR = 22;
const TOTAL_HOURS = CLOSING_HOUR - OPENING_HOUR;
const HOUR_HEIGHT = 64; // px per hour
const TIME_GUTTER = 56; // px for the time label column

const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => OPENING_HOUR + i);

/* ─── helpers ─── */
const getBookingTop = (booking) => {
  const h = booking.start.getHours() + booking.start.getMinutes() / 60;
  return Math.max(0, (h - OPENING_HOUR) * HOUR_HEIGHT);
};

const getBookingHeight = (booking) => {
  const dur = Number(booking.duration) || 1;
  return Math.max(dur * HOUR_HEIGHT, HOUR_HEIGHT / 2);
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

/* ─── Booking block ─── */
const BookingBlock = ({ booking, onClick }) => (
  <button
    type="button"
    className={`cal-booking-block ${statusClass(booking.status)}`}
    style={{
      top: `${getBookingTop(booking)}px`,
      height: `${getBookingHeight(booking)}px`,
    }}
    onClick={() => onClick(booking)}
    title={`${booking.studentName} · ${booking.subject} · ${booking.status}`}
  >
    <strong className="cal-block-name">{booking.studentName}</strong>
    <span className="cal-block-subject">{booking.subject}</span>
  </button>
);

/* ─── Week view ─── */
const CalendarWeekView = ({ weekStart, bookings, onSelectBooking }) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const bookingsForDay = (day) =>
    bookings.filter((b) => b.start && isSameDay(b.start, day));

  const now = new Date();
  const nowTop =
    now >= weekStart && now <= addDays(weekStart, 6)
      ? (now.getHours() + now.getMinutes() / 60 - OPENING_HOUR) * HOUR_HEIGHT
      : null;

  const todayIndex = days.findIndex((d) => isToday(d));

  return (
    <div className="cal-week-scroll">
      {/* Day headers */}
      <div className="cal-week-head" style={{ paddingLeft: TIME_GUTTER }}>
        {days.map((day, i) => (
          <div
            key={i}
            className={`cal-day-header ${isToday(day) ? "is-today" : ""}`}
          >
            <span className="cal-day-name">
              {format(day, "EEE", { locale: es })}
            </span>
            <strong className="cal-day-num">{format(day, "d")}</strong>
          </div>
        ))}
      </div>

      {/* Body: time gutter + day columns */}
      <div
        className="cal-week-body"
        style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
      >
        {/* Time gutter */}
        <div className="cal-time-gutter" style={{ width: TIME_GUTTER }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="cal-hour-label"
              style={{ top: `${(h - OPENING_HOUR) * HOUR_HEIGHT}px` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, i) => (
          <div
            key={i}
            className={`cal-day-col ${isToday(day) ? "is-today" : ""}`}
          >
            {/* Hour lines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="cal-hour-line"
                style={{ top: `${(h - OPENING_HOUR) * HOUR_HEIGHT}px` }}
              />
            ))}

            {/* Current time indicator */}
            {nowTop !== null && isToday(day) && (
              <div
                className="cal-now-line"
                style={{ top: `${nowTop}px` }}
              />
            )}

            {/* Bookings */}
            {bookingsForDay(day).map((booking) => (
              <BookingBlock
                key={booking._id}
                booking={booking}
                onClick={onSelectBooking}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Day view (mobile) ─── */
const CalendarDayView = ({ currentDay, bookings, onSelectBooking }) => {
  const dayBookings = bookings.filter(
    (b) => b.start && isSameDay(b.start, currentDay),
  );

  const now = new Date();
  const isCurrentDay = isToday(currentDay);
  const nowTop = isCurrentDay
    ? (now.getHours() + now.getMinutes() / 60 - OPENING_HOUR) * HOUR_HEIGHT
    : null;

  return (
    <div
      className="cal-day-body"
      style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
    >
      {/* Time gutter */}
      <div className="cal-time-gutter" style={{ width: TIME_GUTTER }}>
        {HOURS.map((h) => (
          <div
            key={h}
            className="cal-hour-label"
            style={{ top: `${(h - OPENING_HOUR) * HOUR_HEIGHT}px` }}
          >
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>

      {/* Single day column */}
      <div className={`cal-day-col is-full ${isCurrentDay ? "is-today" : ""}`}>
        {HOURS.map((h) => (
          <div
            key={h}
            className="cal-hour-line"
            style={{ top: `${(h - OPENING_HOUR) * HOUR_HEIGHT}px` }}
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
            />
          ))
        )}
      </div>
    </div>
  );
};

/* ─── Main CalendarView wrapper ─── */
const CalendarView = ({ sortedBookings, onSelectBooking }) => {
  const enriched = sortedBookings.map((b) => ({
    ...b,
    start: toDate(b.timeSlot),
    end: toDate(b.endTime),
  }));

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 720);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const goToPrevious = () =>
    setCurrentDate((d) => (isMobile ? subDays(d, 1) : subWeeks(d, 1)));
  const goToNext = () =>
    setCurrentDate((d) => (isMobile ? addDays(d, 1) : addWeeks(d, 1)));
  const goToToday = () => setCurrentDate(new Date());

  const headingText = isMobile
    ? format(currentDate, "EEEE d 'de' MMMM", { locale: es })
    : `${format(weekStart, "d MMM", { locale: es })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}`;

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

        <button
          type="button"
          className="cal-today-btn"
          onClick={goToToday}
        >
          Hoy
        </button>
      </div>

      {/* Status legend */}
      <div className="cal-legend">
        {["Pendiente", "Confirmado", "Finalizado", "Cancelado"].map((s) => (
          <span key={s} className={`cal-legend-item ${statusClass(s)}`}>
            {s}
          </span>
        ))}
      </div>

      <div className="cal-scroll-wrapper">
        {isMobile ? (
          <CalendarDayView
            currentDay={currentDate}
            bookings={enriched}
            onSelectBooking={onSelectBooking}
          />
        ) : (
          <CalendarWeekView
            weekStart={weekStart}
            bookings={enriched}
            onSelectBooking={onSelectBooking}
          />
        )}
      </div>
    </section>
  );
};

export default CalendarView;

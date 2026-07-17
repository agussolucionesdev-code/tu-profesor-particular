import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  fetchAdminNotifications,
  retryAdminNotification,
} from "../../src/api/bookingApi";
import NotificationsView from "../../src/components/admin/views/NotificationsView";

vi.mock("../../src/api/bookingApi", () => ({
  fetchAdminNotifications: vi.fn(),
  retryAdminNotification: vi.fn(),
}));

const authConfig = Object.freeze({
  headers: { Authorization: "Bearer test-token" },
});

const notification = (overrides = {}) => ({
  id: "notification-1",
  status: "failed",
  retryable: true,
  failureDisposition: "retryable",
  type: "booking_confirmation",
  channel: "email",
  booking: { id: "booking-1", bookingCode: "ABC123" },
  recipient: { masked: "a***@example.com" },
  attempts: 2,
  maxAttempts: 4,
  nextAttemptAt: null,
  expiresAt: "2026-07-16T12:00:00.000Z",
  providerMessageId: "msg.ABC-123@example.net",
  sentAt: null,
  lastError: {
    category: "provider",
    message: "El proveedor no confirmó la entrega.",
  },
  createdAt: "2026-07-14T12:00:00.000Z",
  updatedAt: "2026-07-14T12:05:00.000Z",
  ...overrides,
});

const listResponse = (items = [notification()], pagination = {}) => ({
  data: {
    success: true,
    data: {
      items,
      pagination: {
        page: 1,
        limit: 20,
        total: items.length,
        totalPages: items.length === 0 ? 0 : 1,
        ...pagination,
      },
    },
    requestId: "notifications-list",
  },
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  fetchAdminNotifications.mockResolvedValue(listResponse());
  retryAdminNotification.mockResolvedValue({
    data: {
      success: true,
      data: notification({ status: "queued", retryable: false, attempts: 2 }),
      requestId: "notification-retry",
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NotificationsView", () => {
  test("loads and renders only the sanitized operational DTO", async () => {
    render(<NotificationsView authConfig={authConfig} />);

    expect(await screen.findByRole("heading", { name: "Centro de notificaciones" })).toBeVisible();
    expect(screen.getByLabelText("Estado: Fallida")).toBeVisible();
    const table = screen.getByRole("table", { name: "Notificaciones operativas" });
    expect(within(table).getByText("Confirmación de turno")).toBeVisible();
    expect(screen.getByText("ABC123")).toBeVisible();
    expect(screen.getByText("a***@example.com")).toBeVisible();
    expect(screen.getByText("2 de 4")).toBeVisible();
    expect(screen.getByText("El proveedor no confirmó la entrega.")).toBeVisible();
    expect(screen.getByText("Detalle técnico")).toBeVisible();
    expect(screen.getByText("msg.ABC-123@example.net")).toBeInTheDocument();
    expect(screen.queryByText(/payload|provider rejected request/i)).not.toBeInTheDocument();
    expect(screen.queryByText("persona@example.com")).not.toBeInTheDocument();
    expect(fetchAdminNotifications).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "",
      type: "",
    }, authConfig, expect.any(AbortSignal));
  });

  test("renders pending updates and management-link requests in a mixed page", async () => {
    fetchAdminNotifications.mockResolvedValueOnce(listResponse([
      notification({ id: "pending-update", type: "booking_pending_updated" }),
      notification({ id: "management-link", type: "management_link_requested" }),
    ]));
    render(<NotificationsView authConfig={authConfig} />);
    const table = await screen.findByRole("table", { name: "Notificaciones operativas" });
    expect(within(table).getByText("Actualización de solicitud pendiente")).toBeVisible();
    expect(within(table).getByText("Enlace seguro solicitado")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("renders honest loading, empty and retryable global error states", async () => {
    const pending = deferred();
    fetchAdminNotifications.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<NotificationsView authConfig={authConfig} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando notificaciones");

    pending.resolve(listResponse([]));
    expect(await screen.findByText("No hay notificaciones para estos filtros.")).toBeVisible();

    fetchAdminNotifications.mockRejectedValueOnce(new Error("network secret"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar notificaciones" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar las notificaciones");
    expect(screen.queryByText("network secret")).not.toBeInTheDocument();

    fetchAdminNotifications.mockResolvedValueOnce(listResponse([]));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    expect(await screen.findByText("No hay notificaciones para estos filtros.")).toBeVisible();
    rerender(<NotificationsView authConfig={authConfig} />);
  });

  test("applies exact status/type filters and server pagination", async () => {
    const user = userEvent.setup();
    fetchAdminNotifications.mockImplementation(({ page, status, type }) => {
      if (status || type) {
        return Promise.resolve(listResponse([notification()], { total: 1, totalPages: 1 }));
      }
      return Promise.resolve(listResponse(
        [notification({ id: page === 2 ? "notification-2" : "notification-1" })],
        { page, total: 21, totalPages: 2 },
      ));
    });
    render(<NotificationsView authConfig={authConfig} />);
    await screen.findByText("ABC123");

    await user.selectOptions(screen.getByLabelText("Estado"), "failed");
    await waitFor(() => expect(fetchAdminNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, status: "failed", type: "" }),
      authConfig,
      expect.any(AbortSignal),
    ));
    await user.selectOptions(screen.getByLabelText("Tipo"), "booking_reminder");
    await waitFor(() => expect(fetchAdminNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, status: "failed", type: "booking_reminder" }),
      authConfig,
      expect.any(AbortSignal),
    ));

    await user.selectOptions(screen.getByLabelText("Estado"), "");
    await user.selectOptions(screen.getByLabelText("Tipo"), "");
    await screen.findByText("Página 1 de 2");
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(fetchAdminNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, status: "", type: "" }),
      authConfig,
      expect.any(AbortSignal),
    ));
  });

  test("refetches the canonical first page when the requested page disappears", async () => {
    const user = userEvent.setup();
    fetchAdminNotifications.mockImplementation(({ page }) => {
      if (page === 2) {
        return Promise.resolve(listResponse([notification()], { page: 1, total: 1, totalPages: 1 }));
      }
      const firstPageCalls = fetchAdminNotifications.mock.calls
        .filter(([query]) => query.page === 1).length;
      return Promise.resolve(firstPageCalls === 1
        ? listResponse([notification()], { page: 1, total: 21, totalPages: 2 })
        : listResponse([notification()], { page: 1, total: 1, totalPages: 1 }));
    });
    render(<NotificationsView authConfig={authConfig} />);
    await screen.findByText("Página 1 de 2");
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(fetchAdminNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }), authConfig, expect.any(AbortSignal),
    ));
    await waitFor(() => {
      const pages = fetchAdminNotifications.mock.calls.map(([query]) => query.page);
      expect(pages.slice(-2)).toEqual([2, 1]);
    });
  });

  test("uses one controlled polling interval and cleans it on disable and unmount", async () => {
    vi.useFakeTimers();
    fetchAdminNotifications.mockResolvedValue(listResponse());
    const { unmount } = render(<NotificationsView authConfig={authConfig} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetchAdminNotifications).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetchAdminNotifications).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("checkbox", { name: "Actualización automática" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchAdminNotifications).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchAdminNotifications).toHaveBeenCalledTimes(2);
  });

  test("does not report retry success until the canonical DTO arrives", async () => {
    const user = userEvent.setup();
    const retry = deferred();
    retryAdminNotification.mockReturnValueOnce(retry.promise);
    render(<NotificationsView authConfig={authConfig} />);
    await screen.findByLabelText("Estado: Fallida");

    await user.click(screen.getByRole("button", { name: "Reintentar notificación ABC123" }));
    expect(screen.getByLabelText("Estado: Fallida")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentando notificación ABC123" })).toBeDisabled();
    expect(screen.queryByLabelText("Estado: En cola")).not.toBeInTheDocument();

    retry.resolve({
      data: {
        success: true,
        data: notification({ status: "queued", retryable: false }),
        requestId: "retry-success",
      },
    });
    expect(await screen.findByLabelText("Estado: En cola")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Reintento solicitado");
  });

  test("preserves the row and exposes retry failure without leaking server details", async () => {
    const user = userEvent.setup();
    retryAdminNotification.mockRejectedValueOnce({
      response: { status: 500, data: { message: "SMTP password secret stack" } },
    });
    render(<NotificationsView authConfig={authConfig} />);
    await screen.findByLabelText("Estado: Fallida");

    await user.click(screen.getByRole("button", { name: "Reintentar notificación ABC123" }));
    expect(await screen.findByText("No se pudo reintentar. Intentá nuevamente.")).toBeVisible();
    expect(screen.getByLabelText("Estado: Fallida")).toBeVisible();
    expect(screen.queryByText(/SMTP|password|stack/i)).not.toBeInTheDocument();
  });

  test("handles a retry conflict by refetching canonical state and keeping visible feedback", async () => {
    const user = userEvent.setup();
    fetchAdminNotifications
      .mockResolvedValueOnce(listResponse())
      .mockResolvedValueOnce(listResponse([notification({ status: "sent", retryable: false, sentAt: "2026-07-14T12:06:00.000Z" })]));
    retryAdminNotification.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { code: "NOTIFICATION_NOT_RETRYABLE", message: "raw internal state" },
      },
    });
    render(<NotificationsView authConfig={authConfig} />);
    await screen.findByLabelText("Estado: Fallida");

    await user.click(screen.getByRole("button", { name: "Reintentar notificación ABC123" }));
    expect(await screen.findByText("La notificación ya no admite reintento. Actualizamos su estado.")).toBeVisible();
    expect(await screen.findByLabelText("Estado: Enviada")).toBeVisible();
    expect(screen.queryByText("raw internal state")).not.toBeInTheDocument();
  });

  test("supports keyboard retry and fails closed on unexpected DTO fields", async () => {
    const user = userEvent.setup();
    render(<NotificationsView authConfig={authConfig} />);
    await screen.findByLabelText("Estado: Fallida");
    screen.getByRole("button", { name: "Reintentar notificación ABC123" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(retryAdminNotification).toHaveBeenCalledTimes(1));

    fetchAdminNotifications.mockResolvedValueOnce(listResponse([{
      ...notification(),
      payload: { email: "persona@example.com", secret: "token" },
    }]));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar notificaciones" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("respuesta inválida");
    expect(screen.queryByText(/persona@example\.com|token/)).not.toBeInTheDocument();
  });

  test("shows superseded traceability without exposing a retry action", async () => {
    fetchAdminNotifications.mockResolvedValueOnce(listResponse([notification({
      status: "superseded",
      retryable: false,
      providerMessageId: null,
      lastError: {
        category: "superseded",
        message: "La notificación quedó obsoleta por un cambio posterior.",
      },
    })]));

    render(<NotificationsView authConfig={authConfig} />);

    expect(await screen.findByLabelText("Estado: Obsoleta")).toBeVisible();
    expect(screen.getByText("La notificación quedó obsoleta por un cambio posterior.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Reintentar notificación/ })).not.toBeInTheDocument();
  });

  test("uses only the canonical retryable flag and never infers an invalid action", async () => {
    fetchAdminNotifications.mockResolvedValueOnce(listResponse([
      notification({ status: "failed", retryable: false }),
    ]));
    render(<NotificationsView authConfig={authConfig} />);
    expect(await screen.findByLabelText("Estado: Fallida")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Reintentar notificación/ })).not.toBeInTheDocument();
  });
});

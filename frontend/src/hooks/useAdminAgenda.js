import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminAvailability,
  fetchAdminSchedule,
} from "../api/bookingApi";
import { parseAdminScheduleResponse } from "../utils/availabilitySchedule";
import {
  businessBoundaryIso,
  createAgendaRange,
  parseAdminAvailabilityResponse,
} from "../utils/adminAgenda";

export const useAdminAgenda = ({
  authConfig,
  anchorDateKey,
  mode,
  duration = 1,
  excludeBookingId,
  enabled = true,
}) => {
  const range = useMemo(
    () => createAgendaRange(anchorDateKey, mode),
    [anchorDateKey, mode],
  );
  const [state, setState] = useState({
    requestKey: "",
    status: "loading",
    data: null,
    error: "",
  });
  const [requestVersion, setRequestVersion] = useState(0);
  const requestKey = `${enabled}:${range.fromDateKey}:${range.toDateKey}:${duration}:${excludeBookingId || ""}:${requestVersion}`;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetchAdminAvailability(
      {
        from: businessBoundaryIso(range.fromDateKey),
        to: businessBoundaryIso(range.toDateKey),
        duration: Number(duration),
        ...(excludeBookingId ? { excludeBookingId } : {}),
      },
      authConfig,
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setState({
          requestKey,
          status: "ready",
          data: parseAdminAvailabilityResponse(response.data),
          error: "",
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
        setState({
          requestKey,
          status: "error",
          data: null,
          error:
            error?.response?.data?.message ||
            error?.message ||
            "No se pudo cargar la disponibilidad autoritativa.",
        });
      });
    return () => controller.abort();
  }, [
    authConfig,
    duration,
    enabled,
    excludeBookingId,
    range.fromDateKey,
    range.toDateKey,
    requestKey,
    requestVersion,
  ]);

  const retry = useCallback(
    () => setRequestVersion((current) => current + 1),
    [],
  );

  const effectiveState = !enabled
    ? { requestKey, status: "idle", data: null, error: "" }
    : state.requestKey === requestKey
    ? state
    : { requestKey, status: "loading", data: null, error: "" };

  return { ...effectiveState, range, retry };
};

export const useAdminAgendaSchedule = (authConfig) => {
  const [state, setState] = useState({
    requestKey: -1,
    status: "loading",
    data: null,
    error: "",
  });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminSchedule({
      ...authConfig,
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        setState({
          requestKey: requestVersion,
          status: "ready",
          data: parseAdminScheduleResponse(response.data),
          error: "",
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
        setState({
          requestKey: requestVersion,
          status: "error",
          data: null,
          error:
            error?.response?.data?.message ||
            error?.message ||
            "No se pudo verificar la grilla horaria.",
        });
      });
    return () => controller.abort();
  }, [authConfig, requestVersion]);

  const effectiveState = state.requestKey === requestVersion
    ? state
    : { requestKey: requestVersion, status: "loading", data: null, error: "" };

  return {
    ...effectiveState,
    retry: () => setRequestVersion((current) => current + 1),
  };
};

# MASTER IMPLEMENTATION PLAN

## Tu Profesor Particular - Gestion de Turnos

**Architect:** Claude Opus 4.6 (Principal Software Architect & UX Auditor)
**Client:** Agustin Elias Sosa
**Date:** 2026-04-16
**Executor:** Autonomous AI Agent (Sonnet)

---

## 1. Executive Summary

### Current State

The application is a **fully functional booking system** for private tutoring. It consists of:

- **Frontend:** React 19 + Vite 7, with React Router v7, react-datepicker, date-fns, axios, and react-icons. Deployed on Vercel.
- **Backend:** Node.js + Express 5, MongoDB/Mongoose 9, Zod validation, JWT auth, Nodemailer, Google Sheets integration. Deployed on Render.
- **Routes:** `/` and `/reservar` (BookingForm wizard), `/portal` (ClientPortal), `/admin` (AdminPanel with JWT login).
- **Core flows:** 4-step booking wizard, client self-service portal (search/reschedule/cancel), and admin dashboard (overview/agenda/students/bookings views).

### Architecture Audit Findings

| Area | Finding | Severity |
|------|---------|----------|
| **BookingForm.jsx** | ~900+ lines monolith. Duplicates validation logic from `useBookingWizard.js` hook (which exists but is NOT used). Contains inline `isValidField`, `handleChange`, `toggleAdultMode`, `getFieldStateClass` that are already extracted in the hook. | High |
| **AdminPanel.jsx** | ~1240 lines monolith. All views (overview, agenda, students, bookings), modals, and data logic in one file. No extracted hooks or sub-components. | High |
| **ClientPortal.jsx** | ~970 lines. Better structured but still contains reschedule modal, cancel modal, and toast UI inline. | Medium |
| **Code Duplication** | `isValidField`, `handleChange`, `toggleAdultMode`, field state logic exist in BOTH `BookingForm.jsx` AND `useBookingWizard.js`. The hook is imported nowhere. | High |
| **API URL Construction** | Each component builds its own `API_URL` from `import.meta.env.VITE_BACKEND_URL`. No shared API client. | Medium |
| **Payment Readiness** | `openMercadoPago` in AdminPanel is a placeholder with `PLACEHOLDER` in URL. No isolated payment abstraction. | Medium |
| **Email Templates** | HTML email built with string concatenation in `mailer.js`. Hard to maintain. `applyNeurocopyPrinciples` and `generateDynamicVariables` are partially used. | Low |
| **CSS Architecture** | Styles scattered across 10+ CSS files with no shared design tokens beyond `variables.css`. Some imported multiple times. | Medium |
| **Voice/Accessibility** | Full speech synthesis system (`neuroToast.js`), smart scroll hook, accessibility controls. Well-built but tightly coupled to individual components. | Low |
| **Backend** | Clean and well-structured. Zod schemas, proper middleware, rate limiting, CORS, Helmet. Express 5 with proper error handling. Minor: `bookingRules.js` shares constants with frontend via duplication. | Low |

### Architecture Vision

```
frontend/src/
  api/                      # Shared Axios instance + endpoint helpers
  components/
    booking/
      BookingWizard.jsx       # Orchestrator (uses useBookingWizard hook)
      steps/
        PersonalInfoStep.jsx  # Step 1 (exists, refine)
        AcademicInfoStep.jsx  # Step 1 continued
        DateSelectionStep.jsx # Step 2
        TimeSelectionStep.jsx # Step 3
        ConfirmationStep.jsx  # Step 4
      BookingConfirmationSummary.jsx  # (exists)
      BookingSuccessModal.jsx         # (exists)
    portal/
      ClientPortal.jsx        # Search + results only
      RescheduleModal.jsx     # Extracted
      CancelModal.jsx         # Extracted
    admin/
      AdminPanel.jsx          # Shell + auth only
      views/
        OverviewView.jsx
        AgendaView.jsx
        StudentsView.jsx
        BookingsView.jsx
      modals/
        BookingEditModal.jsx
        BookingDetailModal.jsx
    shared/
      BookingTicket.jsx       # (exists)
      NeuroToast.jsx          # Extracted toast UI
  hooks/
    useBookingWizard.js       # (exists, wire it up)
    useSmartScroll.js         # (exists)
    useAdminData.js           # Extracted from AdminPanel
    useAuth.js                # Extracted from AdminPanel
  constants/
    bookingWizard.js          # (exists)
    shared.js                 # Shared relationship values, status constants
  layouts/
    Navbar.jsx                # (exists)
    Footer.jsx                # (exists)
  styles/
    variables.css             # Design tokens (exists, expand)
    animations.css            # (exists)
    ...
  utils/
    bookingFormatters.js      # (exists)
    neuroToast.js             # (exists)
    apiClient.js              # NEW: shared Axios instance
```

---

## 2. Execution Phases

---

### PHASE 0: Foundation & Shared Infrastructure

**Goal:** Create the shared utilities and design token system that all subsequent phases depend on. Zero visual changes.

---

#### Task 0.1: Create shared API client

**Target files:**
- CREATE `frontend/src/api/apiClient.js`

**Goal:** Single Axios instance with base URL, interceptors for error formatting, and request ID headers.

**Spec:**
```javascript
// apiClient.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4100";

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export default apiClient;
export { API_BASE };
```

**Guardrails:**
- Do NOT change any component imports yet. This file is consumed starting in Phase 1.
- Do NOT add retry logic or interceptors beyond the base configuration.

---

#### Task 0.2: Create shared API endpoint helpers

**Target files:**
- CREATE `frontend/src/api/bookingApi.js`

**Goal:** Encapsulate every backend call used across the app. Each function returns the axios promise.

**Spec:**
```javascript
import apiClient from "./apiClient";

export const fetchAvailability = (params) =>
  apiClient.get("/api/bookings/availability", { params });

export const createBooking = (data) =>
  apiClient.post("/api/bookings/reserve", data);

export const lookupBookings = (identifier) =>
  apiClient.get(`/api/bookings/${encodeURIComponent(identifier)}`);

export const rescheduleBooking = (data) =>
  apiClient.post("/api/bookings/reschedule", data);

export const cancelBooking = (data) =>
  apiClient.post("/api/bookings/cancel", data);

// Admin (require auth header)
export const fetchAllBookings = (authConfig) =>
  apiClient.get("/api/bookings", authConfig);

export const updateBooking = (id, data, authConfig) =>
  apiClient.put(`/api/bookings/${id}`, data, authConfig);

export const deleteBooking = (id, authConfig) =>
  apiClient.delete(`/api/bookings/${id}`, authConfig);

export const deleteAllBookings = (authConfig) =>
  apiClient.delete("/api/bookings/all", authConfig);

export const loginAdmin = (credentials) =>
  apiClient.post("/api/auth/login", credentials);
```

**Guardrails:**
- Match the exact endpoints and methods currently used in each component.
- Do NOT modify backend routes.

---

#### Task 0.3: Create shared constants file

**Target files:**
- CREATE `frontend/src/constants/shared.js`

**Goal:** Single source of truth for values duplicated between `bookingFormatters.js`, `bookingWizard.js`, and components.

**Spec:**
```javascript
export const ADULT_RELATIONSHIP_VALUE = "self";
export const RESPONSIBLE_RELATIONSHIP_OTHER_VALUE = "otro";

export const BOOKING_STATUS = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendiente",
  CANCELLED: "Cancelado",
  FINALIZED: "Finalizado",
};
```

**Guardrails:**
- Do NOT delete the existing exports from `bookingFormatters.js` yet. Re-export from there to avoid breaking imports during the transition.
- Do NOT touch `backend/src/utils/bookingRules.js`. The backend has its own source of truth.

---

#### Task 0.4: Create payment abstraction stub

**Target files:**
- CREATE `frontend/src/services/paymentService.js`

**Goal:** Isolate the current manual payment logic (WhatsApp-based + MercadoPago placeholder) behind a clean interface that can be swapped for a real payment gateway later.

**Spec:**
```javascript
/**
 * Payment service abstraction.
 * Current implementation: manual (WhatsApp notification).
 * Future: Mercado Pago SDK integration.
 */

export const PAYMENT_METHOD = "manual"; // future: "mercadopago"

export const buildPaymentLink = (booking) => {
  // Placeholder for future Mercado Pago integration
  return null;
};

export const buildWhatsAppPaymentMessage = (booking) => {
  const name = booking.studentName || "Alumno";
  const subject = booking.subject || "Clase";
  const amount = booking.price || 0;
  return `Hola ${name}, te escribo por el pago de la clase de ${subject}. El valor es $${amount}.`;
};
```

**Guardrails:**
- Do NOT modify `AdminPanel.jsx` `openMercadoPago` yet. That happens in Phase 3.
- This is a forward-looking abstraction only.

---

### PHASE 1: BookingForm Decomposition

**Goal:** Break the ~900-line `BookingForm.jsx` monolith into clean, focused step components. Wire up the existing `useBookingWizard` hook that is currently unused.

---

#### Task 1.1: Wire up `useBookingWizard` hook in BookingForm

**Target files:**
- MODIFY `frontend/src/components/BookingForm.jsx`
- MODIFY `frontend/src/hooks/useBookingWizard.js`

**Goal:** Replace the inline duplicated state and validation logic in `BookingForm.jsx` with the already-extracted `useBookingWizard` hook.

**Detailed steps:**

1. In `BookingForm.jsx`, add `import { useBookingWizard } from "../hooks/useBookingWizard";`
2. At the top of the `BookingForm` component, call the hook:
   ```javascript
   const wizard = useBookingWizard(API_URL, showToast);
   ```
3. Remove the following inline duplications from `BookingForm.jsx` (they already exist in the hook):
   - `isValidField` function (lines ~399-443)
   - `handleChange` function (lines ~551-601) - replace with `wizard.handleChange`
   - `toggleAdultMode` function (lines ~604-630) - replace with `wizard.toggleAdultMode`
   - `getFieldStateClass` function (lines ~526-533) - replace with `wizard.getFieldStateClass`
   - Inline `isPersonalInfoComplete`, `isAcademicInfoComplete`, `canProceedToStep2` computations - replace with `wizard.isPersonalInfoComplete`, etc.
   - The `hasUnlockedAcademic` / `hasUnlockedComments` state and effects - already in hook
   - The `requiredChecks` / `completionPercent` computations - already in hook
4. Keep the following in `BookingForm.jsx` (NOT in the hook): `currentStep`/`setCurrentStep` with `startTransition`, `slideDirection`, UI-specific state (`showModal`, `successData`, `sliderHeight`, `isCalendarExpanded`, etc.), sound effects, voice guidance, scroll logic.
5. Update the hook to accept `formData` and `setFormData` as parameters instead of owning them, OR let the hook own form state and have `BookingForm` consume it. **Preferred:** Let the hook own `formData`, `isAdult`, `currentStep`, `hasAttemptedNext` and expose them. `BookingForm` uses the returned values.

**Guardrails:**
- Run `npm run build` after changes to verify no broken imports or missing variables.
- The form behavior must remain 100% identical. Same validation rules, same field order, same error messages.
- Do NOT modify the visual JSX yet. Only swap the data/logic source.
- Do NOT remove the `useEffect` hooks for `hasUnlockedAcademic`/`hasUnlockedComments` unlock sounds from `BookingForm`. The hook manages state; the component plays sounds.

---

#### Task 1.2: Extract Step 1 - Personal & Academic Info

**Target files:**
- MODIFY `frontend/src/components/booking/steps/PersonalInfoStep.jsx` (exists, refine)
- CREATE `frontend/src/components/booking/steps/AcademicInfoStep.jsx`
- MODIFY `frontend/src/components/BookingForm.jsx`

**Goal:** Move the Step 1 JSX (personal info block + academic info block + comments block) into dedicated sub-components.

**PersonalInfoStep props:**
```javascript
{
  formData, handleChange, isAdult, toggleAdultMode,
  getFieldStateClass, isValidField, hasAttemptedNext,
  isPersonalInfoComplete, adultModeLocked
}
```

**AcademicInfoStep props:**
```javascript
{
  formData, handleChange, getFieldStateClass, isValidField,
  isAcademicInfoComplete, hasUnlockedAcademic,
  getYearGradeOptions, textareaRef, hasUnlockedComments
}
```

**Guardrails:**
- Each sub-component receives everything via props. No internal state, no API calls.
- Keep the `getYearGradeOptions` function in `BookingForm` and pass it down.
- The existing `PersonalInfoStep.jsx` file exists but may need updates; check its current content vs what BookingForm renders.
- Do NOT move CSS. The existing `BookingForm.css` class names remain unchanged.

---

#### Task 1.3: Extract Step 2 - Date Selection

**Target files:**
- CREATE `frontend/src/components/booking/steps/DateSelectionStep.jsx`
- MODIFY `frontend/src/components/BookingForm.jsx`

**Goal:** Move the calendar/date-picker JSX (Step 2) into its own component.

**Props:**
```javascript
{
  formData, setFormData, existingBookings,
  isDesktopCalendarViewport, isCalendarExpanded,
  openCalendarExpanded, closeCalendarExpanded,
  onDateSelect, // handleDateSelect from BookingForm
  onProceedToTimeStep, // handleProceedToTimeStep
}
```

**Guardrails:**
- The `react-datepicker` import moves to this component.
- The `excludeTimes` / `calculateMinTime` helper functions move with the component.
- The `isCalendarExpanded` overlay/modal logic moves here.
- Keep scroll logic in `BookingForm` - the step calls `onProceedToTimeStep` which triggers scroll.

---

#### Task 1.4: Extract Step 3 - Time Selection

**Target files:**
- CREATE `frontend/src/components/booking/steps/TimeSelectionStep.jsx`
- MODIFY `frontend/src/components/BookingForm.jsx`

**Goal:** Move the time slot grid JSX (Step 3) into its own component.

**Props:**
```javascript
{
  formData, setFormData, availableSlots,
  onTimeSelect, onProceedToConfirmation
}
```

**Guardrails:**
- The slot computation (`availableSlots` state + the `useEffect` that computes it) stays in `BookingForm`. The step component receives pre-computed slots.
- Do NOT change the slot button styling or behavior.

---

#### Task 1.5: Extract Step 4 - Confirmation & Submit

**Target files:**
- CREATE `frontend/src/components/booking/steps/ConfirmationStep.jsx`
- MODIFY `frontend/src/components/BookingForm.jsx`

**Goal:** Move the confirmation summary + duration selector + submit button JSX into its own component.

**Props:**
```javascript
{
  formData, setFormData,
  confirmationDateLabel, confirmationDurationLabel,
  confirmationTimeRangeLabel, confirmationEducationLabel,
  responsibleRelationshipLabel, isAdult,
  isConfirmationReady, onSubmit, loading,
  confirmationLookupHint
}
```

**Guardrails:**
- `BookingConfirmationSummary` is already a sub-component. This step wraps it together with the duration selector and submit button.
- The actual `handleSubmit` / API call stays in `BookingForm`. The step calls `onSubmit`.

---

#### Task 1.6: Replace API calls with shared API client

**Target files:**
- MODIFY `frontend/src/components/BookingForm.jsx`

**Goal:** Replace all inline `axios.get(`${API_URL}/api/bookings/...`)` calls with imports from `frontend/src/api/bookingApi.js`.

**Changes:**
1. Remove `const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4100";`
2. Import `{ fetchAvailability, createBooking }` from `../../api/bookingApi`
3. Replace `axios.get(\`${API_URL}/api/bookings/availability\`)` with `fetchAvailability()`
4. Replace the booking creation `axios.post(...)` with `createBooking(payload)`

**Guardrails:**
- Verify the response shape is accessed correctly (`.data.data`, `.data.success`, etc.)
- Run `npm run build` to verify.

---

### PHASE 2: ClientPortal Decomposition

**Goal:** Extract modals and clean up the ClientPortal component.

---

#### Task 2.1: Extract RescheduleModal

**Target files:**
- CREATE `frontend/src/components/portal/RescheduleModal.jsx`
- MODIFY `frontend/src/components/ClientPortal.jsx`

**Goal:** Move the ~250 lines of reschedule modal JSX + logic into a focused component.

**Props:**
```javascript
{
  booking, // editingBooking
  existingBookings, // for blocking occupied times
  onConfirm, // (newDate, newDuration) => Promise
  onClose,
  showToast,
}
```

**Internal state (owned by the modal):**
- `newDate`, `newDuration`
- Computed values: `newEndDate`, `hasRescheduleChanges`, `durationQuickOptions`, etc.
- Voice guidance functions

**Guardrails:**
- The `DatePicker` and date-fns imports move here.
- `handleReschedule` API call stays in `ClientPortal` and is passed as `onConfirm`.
- All reschedule-specific CSS class names remain unchanged.

---

#### Task 2.2: Extract CancelModal

**Target files:**
- CREATE `frontend/src/components/portal/CancelModal.jsx`
- MODIFY `frontend/src/components/ClientPortal.jsx`

**Goal:** Move the cancel confirmation modal (~80 lines) into a focused component.

**Props:**
```javascript
{
  booking, // cancelingBooking
  onConfirm, // () => Promise
  onClose,
}
```

**Guardrails:**
- Voice guidance for cancel stays within the modal.
- Danger styling classes remain unchanged.

---

#### Task 2.3: Replace API calls with shared API client

**Target files:**
- MODIFY `frontend/src/components/ClientPortal.jsx`

**Goal:** Replace all inline axios calls with `bookingApi` imports.

**Changes:**
1. Replace `axios.get(\`${API_URL}/api/bookings/${trimmedCode}\`)` with `lookupBookings(trimmedCode)`
2. Replace `axios.get(\`${API_URL}/api/bookings/availability\`)` with `fetchAvailability()`
3. Replace `axios.post(\`${API_URL}/api/bookings/reschedule\`, ...)` with `rescheduleBooking(...)`
4. Replace `axios.post(\`${API_URL}/api/bookings/cancel\`, ...)` with `cancelBooking(...)`

**Guardrails:**
- Test the portal search flow with code, email, and phone number.

---

### PHASE 3: AdminPanel Decomposition

**Goal:** Break the 1240-line `AdminPanel.jsx` into auth, data hooks, and view components.

---

#### Task 3.1: Extract useAuth hook

**Target files:**
- CREATE `frontend/src/hooks/useAuth.js`
- MODIFY `frontend/src/components/AdminPanel.jsx`

**Goal:** Extract authentication state and login logic.

**Hook interface:**
```javascript
export const useAuth = () => {
  // State: authToken, isAuthenticated, username, password, loading
  // Functions: handleLogin, handleLogout
  // Computed: authConfig (headers object)
  return { authToken, isAuthenticated, username, setUsername, password, setPassword,
           loading, handleLogin, handleLogout, authConfig };
};
```

**Guardrails:**
- `sessionStorage` access stays in this hook.
- The `401` auto-logout logic stays in the data-fetching hook (Task 3.2), not here.

---

#### Task 3.2: Extract useAdminData hook

**Target files:**
- CREATE `frontend/src/hooks/useAdminData.js`
- MODIFY `frontend/src/components/AdminPanel.jsx`

**Goal:** Extract all booking data fetching, filtering, dashboard computations, and CRUD operations.

**Hook interface:**
```javascript
export const useAdminData = (authConfig, isAuthenticated) => {
  // State: bookings, dataLoading, searchTerm, filterStatus
  // Computed: sortedBookings, filteredBookings, dashboard, overviewData, filteredStudents, heroText
  // Functions: handleQuickStatusChange, handleUpdate, handleDelete, handleDeleteAll, sendWhatsApp
  return { ... };
};
```

**Guardrails:**
- All `useMemo` computations (`dashboard`, `overviewData`, `filteredBookings`, etc.) move to this hook.
- The hook uses `bookingApi` imports, not raw axios.
- `sentMessages` state moves here.

---

#### Task 3.3: Extract AdminLoginScreen component

**Target files:**
- CREATE `frontend/src/components/admin/AdminLoginScreen.jsx`
- MODIFY `frontend/src/components/AdminPanel.jsx`

**Goal:** Move the login UI (~80 lines of JSX) into its own component.

**Props:**
```javascript
{
  username, setUsername, password, setPassword,
  loading, onLogin
}
```

**Guardrails:**
- Keep the same CSS class names. AdminPanel.css is shared.

---

#### Task 3.4: Extract admin view components

**Target files:**
- CREATE `frontend/src/components/admin/views/OverviewView.jsx`
- CREATE `frontend/src/components/admin/views/AgendaView.jsx`
- CREATE `frontend/src/components/admin/views/StudentsView.jsx`
- CREATE `frontend/src/components/admin/views/BookingsView.jsx`
- MODIFY `frontend/src/components/AdminPanel.jsx`

**Goal:** Each `activeView` case becomes its own component.

**Common pattern - each view receives:**
```javascript
{
  overviewData, dashboard, // data
  searchTerm, filterStatus, // filters
  onViewBooking, onEditBooking, onSendWhatsApp, // actions
  onQuickStatusChange, onDeleteBooking, // mutations
  filteredBookings, filteredStudents, // pre-filtered data
}
```

**Guardrails:**
- The view switching logic stays in `AdminPanel.jsx` shell.
- The sidebar stays in `AdminPanel.jsx`.
- Do ONE view at a time. Verify build after each.

---

#### Task 3.5: Extract admin modals

**Target files:**
- CREATE `frontend/src/components/admin/modals/BookingEditModal.jsx`
- CREATE `frontend/src/components/admin/modals/BookingDetailModal.jsx`
- MODIFY `frontend/src/components/AdminPanel.jsx`

**Goal:** Move the edit modal (~60 lines) and detail/view modal (~80 lines) into dedicated components.

**Guardrails:**
- `editNotes`, `editEvolution`, `editEmotionalState` state moves into `BookingEditModal` as local state.
- The `handleUpdate` callback is passed from parent.

---

#### Task 3.6: Replace API calls with shared API client and wire up payment abstraction

**Target files:**
- MODIFY `frontend/src/components/AdminPanel.jsx` (or the extracted hooks)
- MODIFY the relevant admin view/modal that uses `openMercadoPago`

**Goal:** Replace all raw axios calls with `bookingApi` helpers. Replace `openMercadoPago` placeholder with `paymentService` import.

**Guardrails:**
- The `openMercadoPago` function currently opens a broken URL. Replace with `buildPaymentLink` from `paymentService.js` which returns `null` (gracefully handled). When MercadoPago is integrated, only `paymentService.js` changes.

---

### PHASE 4: UI/Theme Polish & Accessibility

**Goal:** Audit and refine the CSS design token system, contrast ratios, and dark mode consistency. No structural changes.

---

#### Task 4.1: Audit and consolidate CSS variables

**Target files:**
- MODIFY `frontend/src/styles/variables.css`
- MODIFY `frontend/src/index.css`

**Goal:** Ensure ALL color values used across the app reference CSS custom properties. No hardcoded hex values in component CSS files.

**Detailed steps:**
1. Grep all `.css` files for hardcoded hex colors (`#[0-9a-fA-F]{3,8}`)
2. Map each to an existing CSS variable or create a new one in `variables.css`
3. Replace hardcoded values with `var(--token-name)`
4. Ensure dark mode (`[data-theme="dark"]`) overrides every token

**Guardrails:**
- Do NOT change visual appearance. Same colors, just tokenized.
- Test both light and dark mode after changes.

---

#### Task 4.2: Validate WCAG contrast ratios

**Target files:**
- MODIFY `frontend/src/styles/variables.css`
- MODIFY component CSS files as needed

**Goal:** Every text/background combination must meet WCAG AA (4.5:1 for body text, 3:1 for large text) in BOTH light and dark mode.

**Priority areas:**
- Status pills (Confirmado/Cancelado) in admin table
- Toast notification text
- Calendar date picker custom styles
- Footer links
- Disabled button text

**Guardrails:**
- Use `frontend/src/utils/contrastValidator.js` (already exists) to verify ratios.
- Document any intentional exceptions.

---

#### Task 4.3: Ensure consistent dark mode across all views

**Target files:**
- MODIFY `frontend/src/styles/theme-polish.css`
- MODIFY `frontend/src/components/AdminPanel.css`
- MODIFY `frontend/src/components/ClientPortal.css`
- MODIFY `frontend/src/components/BookingForm.css`

**Goal:** Audit every view in dark mode for:
- Background discontinuities (different shades between sections)
- Input field backgrounds (should be visible but not jarring)
- Modal overlays (consistent opacity and backdrop)
- Card shadows (should use subtle light shadows, not black)

**Guardrails:**
- Screenshots from the existing `artifacts/` folder show previous dark mode work. Use them as a visual baseline.
- Do NOT introduce new visual patterns. Refine existing ones.

---

### PHASE 5: Email & Copy Refinement

**Goal:** Clean up email templates and ensure all user-facing Spanish copy is warm, empathetic, and consistent.

---

#### Task 5.1: Refactor email template system

**Target files:**
- MODIFY `backend/src/config/mailer.js`

**Goal:** Extract the HTML email template into a cleaner structure. Remove unused `applyNeurocopyPrinciples` function (it does regex replacements that produce emoji-doubled text like "Confirmado" -> "Confirmado"). Clean up `generateDynamicVariables` to only produce values that are actually interpolated.

**Detailed steps:**
1. Remove `applyNeurocopyPrinciples` function entirely. It produces undesirable output (double emojis around status words).
2. Simplify `generateDynamicVariables` to only return values used in the template: `rescheduleUrl`, `contactPhone`, year for copyright.
3. Keep the existing HTML structure but ensure all dynamic values use the `safe.*` escaped variables consistently.
4. Verify `sendBookingNotifications` passes all required data for created/rescheduled/cancelled events.

**Guardrails:**
- Do NOT change the visual design of the email.
- Run `npm test` in backend to verify mailer doesn't break.
- The HTML must remain inline-styled (email clients don't support external CSS).

---

#### Task 5.2: Audit all user-facing Spanish copy

**Target files:**
- MODIFY `frontend/src/constants/bookingWizard.js`
- MODIFY `frontend/src/components/booking/BookingConfirmationSummary.jsx`
- MODIFY `frontend/src/components/booking/BookingSuccessModal.jsx`
- MODIFY `frontend/src/components/BookingTicket.jsx`
- MODIFY `frontend/src/components/ClientPortal.jsx`

**Goal:** Review every string visible to the user. Ensure:
- Consistent use of "vos" form (Argentine Spanish) - not mixing "tu/vos"
- Warm, empathetic tone without being patronizing
- No leftover English text in UI
- WhatsApp number `5491133365937` is consistent everywhere

**Guardrails:**
- Do NOT change internal variable names, function names, or comments (those stay in English).
- Do NOT change voice guidance messages (those are already well-crafted).
- Focus on static JSX strings and constants only.

---

### PHASE 6: Auto-Scroll & Micro-Interactions Polish

**Goal:** Refine the predictive auto-scroll system and ensure butter-smooth transitions.

---

#### Task 6.1: Audit and refine scroll behavior

**Target files:**
- MODIFY `frontend/src/components/BookingForm.jsx` (or the orchestrator after Phase 1)

**Goal:** Verify that `smoothScrollToStep` correctly targets the focal point of each step:
- Step 1 -> First empty input field
- Step 2 -> Calendar component
- Step 3 -> First available time slot
- Step 4 -> Duration selector (the action item)

**Test matrix:**
- Mobile (< 768px): Scroll should account for fixed navbar
- Tablet (768-1024px): Scroll should center the step
- Desktop (> 1024px): Scroll should be minimal, just ensure visibility

**Guardrails:**
- Do NOT add Framer Motion. The existing CSS transitions + `smoothScrollToStep` are sufficient.
- Respect `prefers-reduced-motion` (already implemented).

---

#### Task 6.2: Polish step transition animations

**Target files:**
- MODIFY `frontend/src/styles/animations.css`
- MODIFY `frontend/src/components/BookingForm.css`

**Goal:** Ensure the slide direction (`forward`/`backward`) animation is smooth and doesn't cause layout jumps.

**Specific checks:**
- The `sliderHeight` dynamic height transition should ease smoothly (not jump)
- Step panels should slide in/out without visible overflow clipping
- The stepper progress bar should animate its width

**Guardrails:**
- Keep animation durations under 400ms.
- Do NOT add animations to admin or portal. Only the booking wizard.

---

### PHASE 7: Backend Hardening & Minor Improvements

**Goal:** Small backend improvements that don't affect the API contract.

---

#### Task 7.1: Add timeSlot update support to updateBooking

**Target files:**
- MODIFY `backend/src/utils/bookingRules.js`
- MODIFY `backend/src/controllers/bookingController.js`

**Goal:** The admin drag-and-drop feature in `AdminPanel` sends `{ timeSlot: newDate.toISOString() }` via `PUT /api/bookings/:id`, but `updateBookingSchema` only allows `status`, `price`, `notes`, `studentEvolution`, `emotionalState`. The drag-drop silently fails.

**Fix:**
1. Add `timeSlot` (optional Date/string) to `updateBookingSchema`
2. In `updateBooking` controller, if `timeSlot` is provided, recalculate `endTime` using the booking's existing `duration`
3. Validate the new slot (working hours, not in the past, no conflicts)

**Guardrails:**
- This is an admin-only endpoint (behind `requireAdmin` middleware), so no public abuse risk.
- Run `npm test` after changes.

---

#### Task 7.2: Add reminder service scheduling (if not already active)

**Target files:**
- REVIEW `backend/src/services/reminderService.js`

**Goal:** Verify the reminder service is wired up in `server.js`. If not, wire it up with a cron-like interval to send reminder emails 24h before appointments.

**Guardrails:**
- If `reminderService.js` is a placeholder/incomplete, document what needs to be done but do NOT implement a half-working solution.
- Do NOT add external cron dependencies. Use `setInterval` for MVP.

---

### PHASE 8: Final Integration & Smoke Test

**Goal:** Verify everything works end-to-end after all refactoring.

---

#### Task 8.1: Full build verification

**Target files:** All

**Steps:**
1. `cd frontend && npm run lint && npm run build` - must pass with zero errors
2. `cd backend && npm test` - must pass all tests
3. Verify no unused imports (lint should catch this)
4. Verify no circular dependencies

---

#### Task 8.2: Manual smoke test checklist

**Flows to verify:**

1. **Booking wizard (/):**
   - Fill Step 1 (adult + minor paths)
   - Select date in Step 2
   - Select time in Step 3
   - Adjust duration + confirm in Step 4
   - Verify success modal shows booking code
   - Verify email notification (if configured)

2. **Client portal (/portal):**
   - Search by booking code
   - Search by email
   - Search by phone
   - Reschedule a booking
   - Cancel a booking
   - Verify toast notifications

3. **Admin panel (/admin):**
   - Login
   - Overview dashboard displays correctly
   - Agenda view shows upcoming/overdue
   - Students view shows aggregated data
   - Bookings view: search, filter, edit, delete, WhatsApp
   - Logout

4. **Dark mode:** Toggle in every view
5. **Mobile:** Check responsive layout in all views

---

## 3. Dependency Graph

```
Phase 0 (Foundation)
  |
  +---> Phase 1 (BookingForm)  ---+
  |                                |
  +---> Phase 2 (ClientPortal) ---+---> Phase 5 (Copy)
  |                                |
  +---> Phase 3 (AdminPanel)   ---+---> Phase 7 (Backend)
  |
  +---> Phase 4 (CSS/Theme) ---------> Phase 6 (Scroll/Animations)
  |
  All --------------------------------> Phase 8 (Integration)
```

**Phases 1, 2, 3 can be executed in parallel** after Phase 0 is complete.
**Phase 4 can start immediately** after Phase 0 (it's CSS-only).
**Phase 5 depends on** Phases 1-3 being complete (copy lives in the refactored components).
**Phase 6 depends on** Phase 1 and Phase 4.
**Phase 7 is independent** of frontend phases.
**Phase 8 must be last.**

---

## 4. Critical Rules for the Executor

1. **One task at a time.** Complete each task fully before moving to the next. Run `npm run build` (frontend) or `npm test` (backend) after every task.

2. **Never break the build.** If a task introduces a build error, fix it before proceeding.

3. **Internal code in English.** Variable names, function names, component names, comments, file names -- all in English.

4. **User-facing text in Spanish.** All labels, messages, emails, toasts, voice guidance -- in warm, empathetic Argentine Spanish (voseo).

5. **Do not add dependencies.** The current stack is sufficient. No Framer Motion, no state management libraries, no CSS-in-JS.

6. **Preserve existing behavior.** Every refactoring task must produce identical user-facing behavior. The goal is structural improvement, not feature changes (except Task 7.1 which is a bug fix).

7. **Respect the CSS.** Do not rename CSS classes unless absolutely necessary. The existing class names are used across multiple component/CSS file pairs.

8. **No speculative abstractions.** Do not create generic utilities, factories, or patterns "for the future." The payment service stub in Task 0.4 is the only forward-looking exception, and it's explicitly required.

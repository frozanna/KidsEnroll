# Specyfikacja techniczna: Moduł Autentykacji (Rejestracja, Logowanie, Odzyskiwanie hasła)

Dokument opisuje architekturę funkcjonalności zgodnie z PRD (US-001, US-002) i stackiem technologicznym (Astro 5, React 19, TypeScript 5, Tailwind 4, Shadcn/ui, Supabase). Celem jest dostarczenie spójnej, rozszerzalnej i bezpiecznej integracji autentykacji z istniejącą aplikacją KidsEnroll bez naruszania aktualnego działania.

## 1. Architektura Interfejsu Użytkownika

### 1.1. Strony Astro i Layouty
- `src/layouts/Layout.astro`
  - Rozszerzenie o warianty widoku dla stanów: `auth` (logowanie/rejestracja/odzyskiwanie) i `app` (po zalogowaniu).
  - Wersja `auth` z uproszczonym nagłówkiem (logo + linki „Zaloguj”, „Zarejestruj się”), bez nawigacji paneli (`ParentNavbar`, `AdminNavbar`).
  - Wersja `app` bez zmian w istniejącej nawigacji; dodanie przycisku `Wyloguj` w prawym górnym rogu (zgodnie z US-001 pkt. 7) – jako klientowy komponent React osadzony w layoucie.
  - Warunkowe renderowanie na podstawie stanu sesji dostarczonego przez Astro middleware (server-side) i/lub klientowego hooka stanu autentykacji.

- Nowe strony Astro (SSR, `export const prerender = false`):
  - `src/pages/auth/login.astro`: formularz logowania + link do „Odzyskaj hasło” + link „Zarejestruj się”.
  - `src/pages/auth/register.astro`: formularz rejestracji (email, hasło, potwierdzenie hasła) + wymagania walidacji.
  - `src/pages/auth/reset.astro`: formularz inicjacji odzyskiwania hasła (email). Po wysłaniu: komunikat o wysłaniu maila.
  - `src/pages/auth/update-password.astro`: formularz ustawienia nowego hasła (po linku z maila Supabase). Obsługa tokenu z query.
  - Nawigacja po akcji: przy udanym logowaniu – przekierowanie na panel użytkownika: rodzic → `src/pages/app/dashboard` (istniejący `ParentDashboardPage.tsx`), administrator → `src/pages/admin` (np. `admin/activities.astro`).

### 1.2. Komponenty React (Client-side)
- `src/components/auth/LoginForm.tsx` (Shadcn/ui + Tailwind):
  - Pola: `email`, `password`.
  - Walidacje: format email (zod), minimalna długość hasła (≥ 8 znaków), brak pustych pól.
  - Stany: `loading`, `error`, `success`.
  - Akcje: submit → wywołanie `POST /api/auth/login`.
  - Komunikaty: błędne dane, brak konta, błąd serwera, sukces.

- `src/components/auth/RegisterForm.tsx`:
  - Pola: `email`, `password`, `confirmPassword`.
  - Walidacje: email, hasło (≥ 8, litera, cyfra), zgodność `confirmPassword`.
  - Akcje: submit → `POST /api/auth/register`.
  - Po sukcesie: automatyczne zalogowanie i przekierowanie do onboardingu dziecka (US-001 pkt. 5, US-003) – `src/pages/app/onboarding/child.astro`.

- `src/components/auth/ResetRequestForm.tsx`:
  - Pole: `email`.
  - Submit → `POST /api/auth/reset`.
  - Komunikat informacyjny o wysłaniu instrukcji resetu (mock w UI, realnie Supabase wysyła mail).

- `src/components/auth/UpdatePasswordForm.tsx`:
  - Pola: `newPassword`, `confirmPassword`.
  - Walidacje: jak dla rejestracji.
  - Submit → `POST /api/auth/update-password` (z tokenem z URL).

- `src/components/auth/LogoutButton.tsx`:
  - Akcja: `POST /api/auth/logout`.
  - Po sukcesie: przekierowanie na `index.astro` lub `auth/login.astro`.

- Wykorzystanie istniejących komponentów UI:
  - `src/components/ui/button.tsx`, `toast.tsx`, `toaster-wrapper.tsx`, `use-toast.ts`, `useToastFeedback.ts` dla feedbacku.
  - Spójna typografia i spacing zgodnie z Tailwind 4.

### 1.3. Rozdzielenie odpowiedzialności Astro vs React
- Astro (strony): SSR, routowanie, pobranie stanu sesji z middleware (`context.locals.supabase.auth.getUser()`), renderowanie odpowiednich layoutów, ochrona tras (guardy).
- React (formularze): interakcje i walidacja client-side, komunikacja z backendem przez `fetch` do endpointów Astro Server Endpoints (`src/pages/api/auth/*.ts`).
- Zasada: logika auth (business) i wywołania SDK Supabase po stronie serwera (API routes) oraz middleware; klient tylko przesyła dane i prezentuje wyniki.

### 1.4. Walidacje i komunikaty błędów
- Walidacja client-side: zod schematy: `email: string().email()`, `password: string().min(8).regex(...)`, `confirmPassword: refine(równość)`.
- Walidacja server-side: zod (te same reguły) + dodatkowe ograniczenia (np. rate limiting per IP – rozważane na później).
- Komunikaty błędów: krótkie, przyjazne, nie ujawniające nadmiernych szczegółów bezpieczeństwa.
- Przykłady scenariuszy:
  - Rejestracja istniejącego emaila: komunikat „Konto z tym adresem już istnieje”.
  - Błędne hasło przy logowaniu: „Nieprawidłowy e-mail lub hasło”.
  - Brak połączenia z serwerem: „Problem z połączeniem. Spróbuj ponownie później.”
  - Token resetu nieprawidłowy lub wygasły: „Link do resetu wygasł lub jest nieprawidłowy”.

### 1.5. Scenariusze kluczowe (flow)
- Rejestracja (Rodzic): `register.astro` → `RegisterForm` → `/api/auth/register` → Supabase `signUp` → autologin → redirect: onboarding dziecka.
- Logowanie (Rodzic/Admin): `login.astro` → `LoginForm` → `/api/auth/login` → Supabase `signInWithPassword` → redirect: admin → `/admin`, rodzic → `/app`.
- Odzyskiwanie hasła: `reset.astro` → `ResetRequestForm` → `/api/auth/reset` → Supabase `resetPasswordForEmail` (z odpowiednią `redirectTo` dla `update-password.astro`).
- Ustawienie nowego hasła: `update-password.astro` → `UpdatePasswordForm` → `/api/auth/update-password` → Supabase `updateUser` z tokenem.
- Wylogowanie: `LogoutButton` → `/api/auth/logout` → Supabase `signOut` → redirect: `auth/login.astro`.

## 2. Logika Backendowa

### 2.1. Struktura endpointów API (Astro Server Endpoints)
- Katalog: `src/pages/api/auth/` (wszystkie `export const prerender = false`).
  - `register.ts` (POST): wejście `{ email, password }`. Walidacja zod. Akcje: `supabase.auth.signUp`. Po sukcesie: tworzenie sesji (Supabase) i odpowiedź `{ role, redirectTo }` ustalona na podstawie konta (admin vs rodzic).
  - `login.ts` (POST): wejście `{ email, password }`. Walidacja zod. Akcje: `supabase.auth.signInWithPassword`. Odpowiedź `{ role, redirectTo }`.
  - `logout.ts` (POST): brak body. Akcja: `supabase.auth.signOut`. Odpowiedź `{ ok: true }`.
  - `reset.ts` (POST): wejście `{ email }`. Walidacja zod. Akcja: `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/update-password })`. Odpowiedź `{ ok: true }`.
  - `update-password.ts` (POST): wejście `{ newPassword, token }` (token z query lub body). Walidacja zod. Akcja: `supabase.auth.updateUser({ password: newPassword })` (Supabase wykorzysta sesję z linku). Odpowiedź `{ ok: true }`.

- Wspólne:
  - Dostęp do Supabase: z `context.locals.supabase` (zgodnie z projektem), typ `SupabaseClient` z `src/db/supabase.client.ts`.
  - Helper: `src/lib/api/helper.ts` do ujednolicenia odpowiedzi i błędów (już istnieje; rozszerzyć jeśli potrzebne).

### 2.2. Modele danych i typy
- `src/types.ts`: dodać/wykorzystać wspólne DTO:
  - `AuthRegisterDTO { email: string; password: string }`
  - `AuthLoginDTO { email: string; password: string }`
  - `AuthResetDTO { email: string }`
  - `AuthUpdatePasswordDTO { newPassword: string; token?: string }`
  - `AuthResponse { ok?: boolean; role?: 'admin'|'parent'; redirectTo?: string; message?: string }`

### 2.3. Walidacja danych wejściowych
- `src/lib/validation/auth.schema.ts` (nowy plik): zod schematy dla powyższych DTO.
- Zastosowanie w endpointach przed wywołaniem Supabase.

### 2.4. Obsługa wyjątków
- Użycie `try/catch` w endpointach; błędy zwracane jako `{ message, code? }` z odpowiednim HTTP status (400 dla walidacji, 401 dla auth, 500 dla niespodziewanych).
- Logowanie błędów przez `src/lib/services/errors.ts` (jeśli istnieje mechanizm – wykorzystać konsekwentnie).
- Nie ujawniać szczegółów z Supabase (maskować techniczne kody w UI).

### 2.5. SSR i konfiguracja Astro
- Wszystkie auth strony i API działają server-side (`prerender = false`).
- Middleware `src/middleware/index.ts`:
  - Ochrona tras: blokuje dostęp do paneli bez sesji (US-002 pkt. 6). Przekierowuje niezalogowanych do `/auth/login`.
  - Post-onboarding guard: nowy rodzic po rejestracji musi dodać dziecko (US-003). Jeśli brak dzieci → przekierowanie do `/app/dzieci/dodaj`.
  - Admin vs Parent routing: po zalogowaniu ustala docelowe ścieżki.
- `astro.config.mjs`: bez zmian funkcjonalnych, ale pamiętać o SSR i integracji cookies (Supabase wykorzystuje cookies/sesje). Jeśli włączony `experimental.clientRouter`, wykorzystać do płynnych przejść.

## 3. System Autentykacji (Supabase Auth + Astro)

### 3.1. Rejestracja
- `supabase.auth.signUp({ email, password })` z automatycznym zalogowaniem (session). W zależności od polityk bezpieczeństwa Supabase:
  - Jeśli wymagana weryfikacja email (opcjonalne w MVP), UI informuje o konieczności kliknięcia w link, ale PRD wymaga automatycznego dostępu – dla MVP wyłączamy obowiązkową weryfikację lub traktujemy sesję jako aktywną po signUp.
- Po rejestracji: redirect do onboardingu dziecka.

### 3.2. Logowanie
- `supabase.auth.signInWithPassword({ email, password })`.
- Identyfikacja roli:
  - Admin: predefiniowane konto; rozpoznanie po emailu lub rekordzie w tabeli profile (`profiles.role` = 'admin').
  - Parent: domyślna rola.
- Redirect zgodnie z rolą.

### 3.3. Wylogowanie
- `supabase.auth.signOut()` w endpointcie; usunięcie sesji po stronie Supabase (cookie). Frontend przekierowuje do `auth/login` lub strony głównej.

### 3.4. Odzyskiwanie hasła
- `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/update-password })`.
- Strona `update-password.astro` konsumuje sesję ustanowioną przez link resetujący i wywołuje `supabase.auth.updateUser({ password })`.

### 3.5. Middleware + Guardy
- Middleware czyta sesję: `const { data: { user } } = await locals.supabase.auth.getUser()`.
- Jeśli brak `user` i trasa wymaga autoryzacji → redirect do `/auth/login`.
- Dla stron auth: jeśli zalogowany, przekierowanie do panelu.
- Dla rodzica: jeśli brak dzieci (sprawdzenie przez `src/lib/services/children.service.ts`) → wymuszenie onboardingu.

### 3.6. Bezpieczeństwo i UX
- CSRF: API tylko `POST`, wykorzystanie same-site cookies Supabase; w przyszłości dodatkowe tokeny.
- Dostępność: wszystkie formularze z etykietami, `aria-invalid`, `aria-live` dla komunikatów, `useId()` do powiązań label/input.
- i18n: na razie polskie komunikaty zgodne z PRD.

## 4. Kontrakty i moduły

### 4.1. Nowe pliki/komponenty
- `src/pages/auth/login.astro`
- `src/pages/auth/register.astro`
- `src/pages/auth/reset.astro`
- `src/pages/auth/update-password.astro`
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/RegisterForm.tsx`
- `src/components/auth/ResetRequestForm.tsx`
- `src/components/auth/UpdatePasswordForm.tsx`
- `src/components/auth/LogoutButton.tsx`
- `src/pages/api/auth/login.ts`
- `src/pages/api/auth/register.ts`
- `src/pages/api/auth/logout.ts`
- `src/pages/api/auth/reset.ts`
- `src/pages/api/auth/update-password.ts`
- `src/lib/validation/auth.schema.ts`
- Aktualizacje: `src/middleware/index.ts`, `src/types.ts`, `src/layouts/Layout.astro`

### 4.2. Interfejsy/Dane
- DTO jak w sekcji 2.2; odpowiedzi `{ role, redirectTo }` dla spójnej nawigacji.
- Błędy: `{ message, fieldErrors? }` dla walidacji.

### 4.3. Integracje
- `children.service.ts` do sprawdzania onboardingu.
- `profile.service.ts` lub `parents.service.ts` do rozróżnienia ról (admin vs parent).

## 5. Przypadki brzegowe i zachowanie
- Duplikacja emaila: zwrócić błąd walidacji z serwera, UI pokazuje inline error.
- Błędne hasło: komunikat ogólny bez ujawniania, że email istnieje.
- Zablokowany dostęp do tras: middleware przekierowuje do loginu.
- Zalogowany użytkownik na stronach auth: przekierowanie do właściwego panelu.
- Reset hasła dla nieistniejącego emaila: UI zawsze zwraca informację o wysłaniu instrukcji (nie potwierdzać istnienia konta).

## 6. Zgodność z istniejącą aplikacją
- Nie naruszamy istniejących paneli rodzica (`ParentDashboardPage.tsx`) i admina; dodajemy guardy.
- Wykorzystujemy Supabase z `context.locals` i typ z `src/db/supabase.client.ts` zgodnie z instrukcjami.
- Walidacje zod i serwisy w `src/lib/services/*` pozostają spójne z dotychczasowym stylem.

## 7. Nawigacja i przekierowania
- Po rejestracji: `/app/onboarding/child`.
- Po zalogowaniu (admin): `/admin/activities`.
- Po zalogowaniu (rodzic): `/app/dashboard`.
- Po wylogowaniu: `/auth/login`.

## 8. Dodatkowe uwagi implementacyjne (bez kodu)
- Utrzymać spójne wzorce: early returns, guard clauses, jasne komunikaty.
- Używać `toast` dla globalnych komunikatów i inline błędów przy polach.
- Testy e2e i unit (w przyszłości): kluczowe ścieżki auth + middleware.

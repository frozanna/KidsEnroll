# Plan implementacji widoku Edycja zajęć

## 1. Przegląd
Widok umożliwia administratorowi edycję istniejących zajęć: zmianę nazwy, opisu, kosztu, limitu miejsc, terminu (data+godzina), przypisanego opiekuna oraz tagów. Dane są wstępnie ładowane (prefill) z API, formularz bazuje na istniejącym komponencie tworzenia zajęć i wykorzystuje podobny schemat zarządzania stanem i walidacji jak widok edycji dziecka.

## 2. Routing widoku
- Ścieżka: `/admin/activities/:id/edit`
- Plik: `src/pages/admin/activities/[id]/edit.astro`
- SSR: Ładowanie danych aktywności, listy opiekunów i dostępnych tagów po stronie serwera; przekazanie ich jako props do komponentu React formularza.

## 3. Struktura komponentów
- `edit.astro`
  - `Layout` (Astro)
  - `AdminNavbar` (React, `client:load`)
  - `AdminActivityEditForm` (React, `client:load`)
    - Wykorzystuje elementy formularza z `src/components/form/*` (TextField, Textarea, NumberInput, DateTimePicker, SubmitButton, ValidationErrors)
    - Listę opiekunów: `select`
    - Tag input + lista tagów (dodawanie/usuwanie)

## 4. Szczegóły komponentów
### AdminActivityEditForm
- Opis komponentu: Formularz edycji zajęć z prewypełnionymi danymi; zarządza stanem wartości, walidacją, wysyłką PATCH do `/api/admin/activities/:id` i obsługą błędów.
- Główne elementy:
  - Pola: `name`, `description`, `cost`, `participant_limit`, `start_datetime_local` (lokalne), `worker_id` (select), tagi (input + lista)
  - Komponenty: `TextField`, `Textarea`, `NumberInput`, `DateTimePicker`, `SubmitButton`, `ValidationErrors`
- Obsługiwane interakcje:
  - Zmiana wartości pól, dodawanie/usuwanie tagów
  - Walidacja po zmianie i przed wysyłką
  - Wysyłka `PATCH` do API; przekierowanie po sukcesie
- Obsługiwana walidacja (frontend, spójna z API):
  - `name`: wymagane, max 120 znaków
  - `description`: opcjonalne, max 1000 znaków
  - `cost`: wymagane, liczba ≥ 0, maks. 2 miejsca po przecinku (regex `^\d+(?:\.\d{1,2})?$`)
  - `participant_limit`: wymagane, liczba całkowita ≥ 1
  - `start_datetime_local`: wymagane, format `YYYY-MM-DDTHH:mm`, data w przyszłości; konwersja do UTC ISO przy PATCH
  - `worker_id`: wymagane; wartość musi istnieć w liście `workers`
  - `tags`: bez pustych wpisów; unikalne po trimie
- Typy:
  - DTO: `ActivityDTO` (do prefill), `ActivityWorkerDTO[]`, `TagsListResponseDTO`
  - Request: `AdminActivityUpdateCommand`
  - Response: `AdminActivityUpdateResponseDTO` (z polem `notifications_sent`)
  - Błąd: `ErrorResponseDTO`
- Propsy:
  - `initialActivity: ActivityDTO`
  - `workers: ActivityWorkerDTO[]`
  - `availableTags: string[]`
  - `onSuccessRedirect?: string` (domyślnie `/admin/activities`)

### edit.astro
- Opis: SSR kontener strony; pobiera `id`, wykonuje fetch do API po `ActivityDTO`, listę opiekunów i tagów, renderuje formularz.
- Główne elementy: `Layout`, `AdminNavbar`, komunikaty o błędach (alerty), `AdminActivityEditForm`
- Interakcje: Brak klientowych poza renderem; dane ładowane na serwerze.
- Walidacja: Sprawdzenie poprawności `id` (liczba > 0) i obsługa odpowiedzi API.
- Propsy do formularza: `initialActivity`, `workers`, `availableTags`.

## 5. Typy
- `ActivityDTO`: istniejący typ; używany do prefillu.
- `ActivityWorkerDTO[]`: istniejący typ; dane do selecta opiekuna.
- `AdminActivityUpdateCommand` (Partial): pola opcjonalne; formularz wysyła zmienione lub pełne wartości (MVP: pełny payload zgodny z danymi formularza).
- `AdminActivityUpdateResponseDTO`: odpowiedź po edycji, zawiera `notifications_sent` i aktualny stan aktywności.
- `ErrorResponseDTO`: standardowy kształt błędów; używany do mapowania błędów na formularz.
- ViewModely (nowe, lokalne dla komponentu):
  - `AdminActivityEditFormValues`: { name: string; description: string; cost: string; participant_limit: string; start_datetime_local: string; worker_id: string; tags: string[] }
  - `AdminActivityEditFormErrors`: `Partial<Record<keyof AdminActivityEditFormValues, string>> & { _global?: string[] }`

## 6. Zarządzanie stanem
- Reducer (jak w `ChildForm` / `AdminActivityCreateForm`): akcje `SET_FIELD`, `SET_ERRORS`, `SUBMIT_START`, `SUBMIT_SUCCESS`, `SUBMIT_ERROR`.
- `initState(initial?: AdminActivityEditFormValues)`: inicjalizacja z prefillu.
- `firstInvalidRef` + efekt skupienia na pierwszym błędnym polu po zmianie `errors`.
- `useToastFeedback` (jeśli dostępne w projekcie) do powiadomień sukces/błąd.

## 7. Integracja API
- Prefetch (SSR, w `edit.astro`):
  - `GET /api/admin/activities/:id` (jeśli istnieje endpoint; alternatywnie `getActivityById` przez serwis z Supabase w SSR)
  - `GET /api/admin/workers` (lista opiekunów; istniejący endpoint w katalogu `pages/api/admin/...`)
  - `GET /api/admin/tags` (lista dozwolonych tagów)
- Submit (klient):
  - `PATCH /api/admin/activities/:id`
  - Body (UTC): `AdminActivityUpdateCommand` z polami wysłanymi jako liczby/stringi zgodnie z typami; `start_datetime_local` konwertowane do `start_datetime` (UTC ISO) przed wysyłką.
- Response: `AdminActivityUpdateResponseDTO`; po sukcesie przekierowanie.

## 8. Interakcje użytkownika
- Edycja pól tekstowych/liczbowych, wyboru opiekuna, daty/godziny.
- Zarządzanie tagami: wpis + Enter dodaje, przycisk/usunięcie pojedynczego taga.
- Kliknięcie „Zapisz zmiany” wysyła PATCH; po sukcesie przekierowanie do listy zajęć z komunikatem.

## 9. Warunki i walidacja
- Walidacja frontendowa opisana w sekcji komponentu; blokuje submit, ustawia błędy.
- Dodatkowa weryfikacja: konwersja lokalnego czasu do UTC ISO; sprawdzenie przyszłej daty względem `now`.
- `worker_id` musi pochodzić z listy `workers` (sprawdzenie `some((w) => String(w.id) === worker_id)`).
- Tagi: trim + unikalność; brak pustych wartości.

## 10. Obsługa błędów
- Mapping `ErrorResponseDTO` → `AdminActivityEditFormErrors`:
  - `VALIDATION_ERROR`: mapowanie `details.fields`; jeśli brak szczegółów → `_global` z `message`.
  - `WORKER_NOT_FOUND`: błąd `worker_id`.
  - `AUTH_UNAUTHORIZED` / `FORBIDDEN`: `_global` komunikat o uprawnieniach/sesji.
  - `INTERNAL_ERROR`: `_global` komunikat o błędzie serwera.
- SSR: komunikaty „Aktywność nie znaleziona” / „Brak uprawnień” / „Błąd ładowania”.

## 11. Kroki implementacji
1. Routing: Utwórz `src/pages/admin/activities/[id]/edit.astro` z SSR fetchem danych (activity, workers, tags) i renderowaniem `AdminActivityEditForm`.
2. Komponent: Utwórz `src/components/admin/activities/AdminActivityEditForm.tsx` bazując na `AdminActivityCreateForm.tsx`:
   - Zmień `initState`, dodaj prefill `initialActivity` → wypełnij pola, przelicz `start_datetime` (UTC) na lokalne `YYYY-MM-DDTHH:mm`.
   - Dostosuj label przycisku do „Zapisz zmiany”.
   - Zmień submit na `PATCH /api/admin/activities/:id` i mapowanie błędów.
3. Walidacja: Użyj identycznych reguł jak w formularzu tworzenia; zaktualizuj komunikaty.
4. Tagi: Dodaj obsługę tagów (input + lista, unikalność, usuwanie).
5. UX: Focus na pierwszym błędnym polu; `aria-live` dla stanu „Zapisywanie…”, komunikaty błędów dostępne semantycznie.s
7. Dokumentacja: Krótki opis w PR/README sekcji admin (opcjonalnie) oraz zgodność z `copilot-instructions.md` (middleware, Supabase z `Astro.locals`).

# Plan implementacji widoku Dodawanie zajęć (Admin)

## 1. Przegląd
Widok służy administratorowi do tworzenia nowych zajęć dodatkowych. Umożliwia wprowadzenie parametrów zajęć: nazwa, opis, koszt, limit miejsc, data i godzina rozpoczęcia (konwersja do UTC), przypisanie opiekuna z listy, wybór tagów z predefiniowanej listy. Po pomyślnym zapisie aktywność pojawia się na liście zajęć i jest widoczna dla rodziców.

## 2. Routing widoku
- Ścieżka: `/admin/activities/new`
- Dostęp: tylko rola Administrator (weryfikacja po stronie API/middleware).
- Renderowanie: strona Astro z osadzonym komponentem React dla formularza (interaktywny), SSR pobiera listę opiekunów oraz tagi.

## 3. Struktura komponentów
- Layout: `src/layouts/Layout.astro` (istniejący)
- Strona: `src/pages/admin/activities/new.astro` (nowa)
  - SSR: pobranie `workers` oraz `tags` (GET `/api/admin/workers`, GET `/api/admin/tags`)
  - Mount: `AdminActivityCreateForm` (React)
- Komponent: `src/components/admin/activities/AdminActivityCreateForm.tsx`
  - Wykorzystuje komponenty z `src/components/form` oraz `src/components/ui`
  - Podkomponenty formularza:
    - `TextField` (nazwa)
    - `Textarea` (opis)
    - `NumberInput` (koszt)
    - `NumberInput` (limit miejsc)
    - `DateTimePicker` (data i godzina; konwersja do ISO UTC)
    - `Select` (opiekun)
    - `MultiSelect/ComboBox` (tagi)
    - `SubmitButton`, `ValidationErrors`, `toast`

## 4. Szczegóły komponentów
### AdminActivityCreateForm
- Opis: Interaktywny formularz tworzenia zajęć, inspirowany istniejącym `ChildForm`. Zapewnia walidację po stronie klienta, obsługę stanu i komunikację z API.
- Główne elementy:
  - `TextField` dla `name` (wymagane, max 120 znaków)
  - `Textarea` dla `description` (opcjonalne, max 1000 znaków)
  - `NumberInput` dla `cost` (wymagane, >= 0, dokładność do 2 miejsc po przecinku)
  - `NumberInput` dla `participant_limit` (wymagane, całkowita liczba >= 1)
  - `DateTimePicker` dla `start_datetime_local` (wymagane; konwersja do UTC)
  - `Select` dla `worker_id` (wymagane; wartości z SSR)
  - `MultiSelect` dla `tags` (opcjonalne; wartości z SSR)
  - `SubmitButton` + `ValidationErrors` (globalne i per-field)
- Obsługiwane interakcje:
  - Zmiana pól formularza (onChange)
  - Wysłanie formularza (onSubmit)
  - Wyświetlenie toastów sukces/błąd
- Obsługiwana walidacja (frontend, spójna z API):
  - `name`: wymagane, `name.trim().length > 0`, max 120
  - `description`: opcjonalne, max 1000
  - `cost`: wymagane, liczba >= 0, max 2 miejsca po przecinku (walidacja formatowa)
  - `participant_limit`: wymagane, liczba całkowita >= 1
  - `start_datetime_local`: wymagane, musi przekładać się na przyszłe `start_datetime` w UTC; konwersja do ISO: `new Date(local).toISOString()` i walidacja `> Date.now()`
  - `worker_id`: wymagane, musi być jednym z pobranych ID
  - `tags`: opcjonalne, z predefiniowanej listy; duplikaty usuwamy
- Typy: patrz sekcja 5 (DTO i ViewModel)
- Propsy:
  - `workers: ActivityWorkerDTO[]` lub prostsze: `{ id: number; first_name: string; last_name: string; email: string }[]`
  - `tags: string[]`
  - `onSuccessRedirect?: string` (domyślnie `/admin/activities`)

### Form Controls (z `src/components/form` lub nowe)
- `NumberInput`: Kontrolka liczbowa z obsługą ograniczeń i formatowania (value jako string; walidacja/parsing do number)
- `DateTimePicker`: Kontrolka daty i czasu (local). Zwraca string lub `Date` w lokalnym TZ; komponent przekształca to na ISO UTC.
- `Select`/`MultiSelect`: Oparte na shadcn/ui + Radix; dostępne, z klawiaturą i ARIA.

## 5. Typy
- DTO (z `src/types.ts`):
  - `AdminActivityCreateCommand`: `{ name: string; description?: string | null; cost: number; participant_limit: number; start_datetime: string; worker_id: number; tags?: string[] }`
  - `AdminActivityDTO`: pełny rekord aktywności.
- ViewModel (frontend):
  - `AdminActivityFormValues`:
    - `name: string`
    - `description?: string`
    - `cost: string` (string w UI, parsowany do `number` przy wysyłce)
    - `participant_limit: string` (string w UI, parsowany do `number`)
    - `start_datetime_local: string` (np. `YYYY-MM-DDTHH:mm` w lokalnym TZ)
    - `worker_id: string` (select; parsowany do `number`)
    - `tags: string[]`
  - `AdminActivityFormErrors`: `Record<keyof AdminActivityFormValues, string> & { _global?: string[] }` (per-field tekst błędu, globalne komunikaty)
  - `ApiErrorDTO` (analogicznie jak w istniejących komponentach – `ErrorResponseDTO['error']`)

## 6. Zarządzanie stanem
- Podejście: `useReducer` inspirowane `ChildForm`:
  - Akcje: `SET_FIELD`, `SET_ERRORS`, `SUBMIT_START`, `SUBMIT_SUCCESS`, `SUBMIT_ERROR`
  - Inicjalny stan: wartości domyślne, brak błędów, `submitting=false`, `submitSuccess=false`
- Fokus pierwszego błędnego pola: ref + efekt, analogicznie do `ChildForm`.
- Derived values:
  - ISO UTC dla `start_datetime`: na submit
  - Disable submit: `submitting || hasErrors`
- Toasty: hook `useToastFeedback` (obecny w repo) dla sygnału sukcesu/błędu.

## 7. Integracja API
- Endpoint: `POST /api/admin/activities`
- Auth: wymagane; token typu `bearer` (zgodnie z `AuthTokenDTO.token_type`)
- Request body: `AdminActivityCreateCommand` (parsowane z ViewModelu)
- Response 201: `AdminActivityDTO`
- Błędy:
  - 400: `VALIDATION_ERROR` (np. przeszła data)
  - 404: `WORKER_NOT_FOUND`
  - 401/403: autoryzacja/rola
- Implementacja:
  - `fetch('/api/admin/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`
  - Obsługa `!res.ok`: mapowanie `error` do `AdminActivityFormErrors`
  - Po sukcesie: redirect do `/admin/activities` i toast „Zajęcia utworzone”

## 8. Interakcje użytkownika
- Wpisywanie danych w polach formularza -> natychmiastowa walidacja i czyszczenie błędów danego pola.
- Zmiana daty/godziny -> przeliczenie na ISO UTC przy submit; w UI wyświetlamy informacyjny tekst o konwersji.
- Wybór opiekuna z listy -> ustawienie `worker_id`.
- Wybór tagów -> dodawanie/odejmowanie z listy bez duplikatów.
- Kliknięcie „Zapisz” -> walidacja i wysyłka; spinner `Zapisywanie...`; po sukcesie redirect.

## 9. Warunki i walidacja
- Walidacja po stronie UI:
  - Nazwa: wymagane, max 120.
  - Opis: opcjonalny, max 1000.
  - Koszt: wymagany, liczba >= 0, maks. 2 miejsca po przecinku.
  - Limit miejsc: wymagany, całkowita liczba >= 1.
  - Data/Godzina: wymagane, wynikowa UTC > teraz.
  - Opiekun: wymagany, ID musi istnieć w dostarczonej liście.
  - Tagi: opcjonalne, tylko z listy; brak duplikatów.
- API dodatkowo wymusza: `start_datetime` w przyszłości; istnienie `worker_id`.

## 10. Obsługa błędów
- Mapowanie błędów API na formularz:
  - `WORKER_NOT_FOUND` -> `_global: ["Wybrany opiekun nie istnieje."]` lub błąd przy `worker_id`.
  - `VALIDATION_ERROR` -> per-field (np. `{ start_datetime: "Data musi być w przyszłości" }`)
  - `AUTH_UNAUTHORIZED`/`FORBIDDEN` -> `_global: ["Brak uprawnień lub sesja wygasła."]`
  - `INTERNAL_ERROR` -> `_global: ["Wewnętrzny błąd serwera. Spróbuj później."]`
- Błędy sieci: `_global` z komunikatem o połączeniu.
- A11y: `aria-live` dla komunikatów i spinners.

## 11. Kroki implementacji
1. Routing: utwórz stronę `src/pages/admin/activities/new.astro` opartą o `Layout.astro`.
2. SSR: w `new.astro` pobierz listę opiekunów i tagi (użyj dostępnych usług/endpointów) i przekaż do komponentu.
3. Komponent: utwórz `src/components/admin/activities/AdminActivityCreateForm.tsx` podobny do `ChildForm.tsx` z `useReducer`.
4. Kontrolki: użyj istniejących `TextField`, `Textarea`, `SubmitButton`, `ValidationErrors`. Dodaj `NumberInput` i `DateTimePicker` (jeśli brak, utwórz w `src/components/form/`).
5. Walidacja: zaimplementuj funkcję `validate(values)` zgodną z sekcją 9. Dodaj konwersję daty lokalnej do ISO UTC przy submit.
6. API: wywołaj `POST /api/admin/activities` z payloadem zgodnym z `AdminActivityCreateCommand`. Obsłuż błędy (`mapApiErrorToFormErrors`).
7. UX: dodaj `aria-live` dla stanu zapisu; po sukcesie redirect do `/admin/activities` oraz toast sukcesu.
8. Testy manualne: wprowadź poprawne i błędne dane (np. przeszła data, brak opiekuna). Sprawdź błędy i redirect.
9. Stylowanie: zastosuj Tailwind (spójnie z `ChildForm`), responsywność i dostępność.
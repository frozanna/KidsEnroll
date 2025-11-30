# Plan implementacji widoku Admin Workers (Dodawanie/Edycja opiekuna)

## 1. Przegląd
Widok służy administratorowi do zarządzania opiekunami (workers): dodawania nowych oraz edycji istniejących. Umożliwia wprowadzenie i aktualizację pól: imię, nazwisko, e‑mail. Po poprawnym dodaniu/aktualizacji wyświetla komunikat sukcesu (toast) i przekierowuje do listy opiekunów. Zapewnia walidację pól na froncie oraz obsługę błędów i konfliktów z API.

## 2. Routing widoku
- Dodawanie: `/admin/workers/new`
- Edycja: `/admin/workers/:id/edit`

Oba widoki dostępne wyłącznie dla roli Admin (egzekwowane przez middleware). SSR pobiera dane opiekuna w trybie edycji.

## 3. Struktura komponentów
- `pages/admin/workers/new.astro` (SSR wrapper)
  - `AdminNavbar` (istniejący)
  - `WorkerForm` (React, tryb `create`)
- `pages/admin/workers/[id]/edit.astro` (SSR wrapper)
  - `AdminNavbar`
  - `WorkerForm` (React, tryb `edit`, z `initialData`)
- `components/admin/workers/WorkerForm.tsx` (React formularz)
  - Pola: `TextField` ×2 (imię, nazwisko), `TextField` dla e‑mail
  - `ValidationErrors`, `SubmitButton`, `Toast` integracja

## 4. Szczegóły komponentów
### WorkerForm
- Opis komponentu: Reużywalny formularz dla tworzenia i edycji opiekuna. Renderuje pola tekstowe, waliduje lokalnie, wysyła żądania do API i obsługuje wynik (sukces/błąd).
- Główne elementy:
  - `form` z polami: `TextField` (`first_name`, `last_name`, `email`)
  - `ValidationErrors` dla błędów globalnych
  - `SubmitButton` z kontrolą stanu ładowania
  - Informacyjny tekst asystujący (opcjonalny)
- Obsługiwane interakcje:
  - `onChange` pól: aktualizacja stanu i czyszczenie błędów per‑pole
  - `onSubmit`: walidacja, wywołanie API (`POST`/`PATCH`), ustawienie stanu wynikowego
- Obsługiwana walidacja:
  - `first_name`: wymagane, `trim().length > 0`, max np. 120 znaków (konserwatywnie)
  - `last_name`: wymagane, `trim().length > 0`, max 120 znaków
  - `email`: wymagane, format email (regex), max 255 znaków
  - Dodatkowo: wyświetlenie konfliktu przy 409 (email istnieje)
- Typy:
  - DTO: `WorkerDTO` (z `src/types.ts`)
  - Komendy: `WorkerCreateCommand`, `WorkerUpdateCommand` (z `src/types.ts`)
  - Błąd API: `ErrorResponseDTO` (+ wewnętrzny `ApiErrorDTO` jeżeli używany)
  - ViewModel: `WorkerFormValues` { `first_name`: string; `last_name`: string; `email`: string }
  - `WorkerFormErrors`: { `first_name`?: string; `last_name`?: string; `email`?: string; `_global`?: string[] }
- Propsy:
  - `mode`: `'create' | 'edit'`
  - `initialData?`: `WorkerFormValues`
  - `workerId?`: number (dla trybu edycji)
  - `onSuccessRedirect?`: string (domyślnie `/admin/workers`)

### new.astro (Dodawanie)
- SSR: minimalny wrapper z `Layout` i `AdminNavbar`
- Render: `<WorkerForm client:load mode="create" />`
- A11y: odpowiednie nagłówki, landmark `main`, aria‑live dla statusów

### edit.astro (Edycja)
- SSR: pobranie danych opiekuna: `GET /api/admin/workers/:id` (absolutny URL jak w przykładzie `edytuj.astro`), mapowanie błędów 404/403/401
- Render: `<WorkerForm client:load mode="edit" workerId={id} initialData={...} />`
- A11y: komunikaty błędów w SSR (alert role) dla 404/403

## 5. Typy
- `WorkerFormValues`:
  - `first_name: string` — wymagane
  - `last_name: string` — wymagane
  - `email: string` — wymagane, format email
- `WorkerFormErrors`:
  - klucze pól opcjonalne: `string`
  - `_global?: string[]` — błędy nieskojarzone z polami
- Reużycie istniejących typów z `src/types.ts`:
  - `WorkerDTO`
  - `WorkerCreateCommand`
  - `WorkerUpdateCommand`
  - `WorkerDeleteResponseDTO` (nie używany w tym widoku, ale warto mieć na radarze)

## 6. Zarządzanie stanem
- W `WorkerForm` zastosować `useReducer` (analogicznie jak w `ChildForm`) z akcjami:
  - `SET_FIELD`, `SET_ERRORS`, `SUBMIT_START`, `SUBMIT_SUCCESS`, `SUBMIT_ERROR`
- Dodatkowe zmienne stanu:
  - `submitting: boolean`, `submitSuccess: boolean`
  - `firstInvalidRef` do focusowania pierwszego błędnego pola
- Hooki:
  - `useEffect` do przekierowania po sukcesie
  - `useEffect` do autofocusu błędu
- Opcjonalnie: `useToastFeedback` do spójnej informacji o sukcesie/błędach

## 7. Integracja API
- Dodawanie: `POST /api/admin/workers`
  - Body: `WorkerCreateCommand`
  - Oczekiwany sukces: 201, zwrot `WorkerDTO`
  - Błędy: 400/401/403/409 — mapowanie do komunikatów
- Edycja: `PATCH /api/admin/workers/:id`
  - Body: `WorkerUpdateCommand` (pełny overwrite jak w definicji)
  - Oczekiwany sukces: 200, zwrot `WorkerDTO`
  - Błędy: 400/401/403/404/409
- SSR pobieranie do edycji: `GET /api/admin/workers/:id`
  - Oczekiwany sukces: 200, `WorkerDTO`
  - Błędy: 401/403/404 — wyświetlić banner w SSR
- Budowa URL w SSR przez `new URL(path, Astro.url)` (jak w `edytuj.astro`)

## 8. Interakcje użytkownika
- Wpisywanie danych w pola — natychmiastowe czyszczenie błędu danego pola po zmianie
- Submit:
  - Walidacja frontowa, blokada przy błędach
  - Wysyłka żądania, stan ładowania w przycisku
  - Po sukcesie: toast „Opiekun zapisany” i redirect do `/admin/workers`
- Błędy:
  - Wyświetlenie pod polem lub globalny alert (np. 500)

## 9. Warunki i walidacja
- `first_name`/`last_name`: wymagane, brak wyłącznie spacji, limit długości (bezpieczny front 120)
- `email`: wymagane, poprawny format RFC 5322 (praktyczny regex), limit 255
- API warunki:
  - `401/403`: dostęp tylko dla admin — SSR/Client pokazuje alert i sugeruje powrót
  - `404` (edycja): opiekun nie istnieje — SSR komunikat „Nie znaleziono opiekuna”
  - `409`: e‑mail już istnieje — komunikat pod polem `email`
  - `400`: nieprawidłowe dane — mapowanie szczegółów z `details.fields` jeśli dostępne

## 10. Obsługa błędów
- Mapowanie kodów błędów na przyjazne komunikaty:
  - `WORKER_NOT_FOUND` → alert w SSR (edycja)
  - `WORKER_EMAIL_CONFLICT` lub `409 Conflict` → błąd pod `email`
  - `INTERNAL_ERROR` → banner globalny, zachęta do ponowienia
- Fallback: nieznany błąd → `_global` z treścią z serwera lub „Wewnętrzny błąd”
- A11y: role `alert`, `aria-live="polite"` dla statusów

## 11. Kroki implementacji
1. Routing: dodać pliki `src/pages/admin/workers/new.astro` i `src/pages/admin/workers/[id]/edit.astro` zgodnie z konwencją.
2. SSR (edit): zaimplementować pobranie `GET /api/admin/workers/:id` i mapowanie błędów (404/403/401) do flag i komunikatów.
3. Komponent React: utworzyć `src/components/admin/workers/WorkerForm.tsx` wzorując się na `ChildForm` (useReducer, walidacja, submit, redirect).
4. Walidacja: dodać funkcję `validate(values)` obejmującą trzy pola, w tym regex email.
5. Obsługa API: w `handleSubmit` wywołać `POST`/`PATCH` w zależności od `mode`, ustawić `Content-Type: application/json`.
6. Mapowanie błędów: z `409` → błąd `email`; `400` → rozbić na pola; inne → `_global`.
7. UI i A11y: nagłówki, `main` landmark, `aria-live` oraz focus na pierwsze błędne pole.
8. Toast/Redirect: po sukcesie `toast.success` (jeśli używany hook) i `window.location.href = "/admin/workers"`.
10. Refaktor opcjonalny: wyekstrahować wspólne utilsy (np. email regex) jeśli już istnieją w projekcie.

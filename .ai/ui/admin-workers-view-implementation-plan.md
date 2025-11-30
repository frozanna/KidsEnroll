# Plan implementacji widoku Lista Opiekunów (Admin)

## 1. Przegląd
Widok `/admin/workers` prezentuje listę opiekunów (pracowników) dla administratora. Umożliwia jednorazowe pobranie danych i wyświetlenie tabeli bez paginacji oraz dodanie nowego opiekuna. Usuwanie opiekuna jest dostępne z potwierdzeniem; w przypadku przypisanych zajęć należy pokazać toast o niemożliwości usunięcia.

## 2. Routing widoku
- Ścieżka: `/admin/workers`
- Pliki:
  - `src/pages/admin/workers.astro` – strona Astro z układem i osadzeniem komponentu React.
  - `src/components/admin/workers/AdminWorkersPage.tsx` – komponent główny React (interaktywny).
- Ochrona dostępu: Ruta admina (middleware `src/middleware/index.ts`) – wymagany użytkownik z rolą administratora.

## 3. Struktura komponentów
- `workers.astro` (Astro, strona)
  - `Layout.astro` + `AdminNavbar.tsx`
  - `AdminWorkersPage` (React, klient: `client:load`)
- `AdminWorkersPage` (React, kontener)
  - `WorkersToolbar` (przycisk Dodaj)
  - `WorkersDataTable` (tabela danych, inspirowana `ActivitiesTable.tsx`)
  - `AddWorkerDialog` (formularz dodania opiekuna)
  - `Toast` (Shadcn) + `toaster-wrapper.tsx`

## 4. Szczegóły komponentów
### AdminWorkersPage
- Opis: Kontener widoku. Ładuje listę opiekunów, zarządza stanem, wyświetla toolbar, tabelę i dialog dodawania.
- Główne elementy: wrapper, nagłówek, toolbar, tabela, `Toast`.
- Obsługiwane interakcje: inicjalny fetch, odświeżanie po dodaniu/usunięciu, otwieranie/zamykanie dialogu.
- Walidacja: brak (delegacja do formularza w dialogu).
- Typy: `WorkersListResponseDTO`, `WorkerDTO`, `WorkerRowVM`.
- Propsy: brak (komponent główny zarządza własnym stanem).

### WorkersToolbar
- Opis: Pasek narzędzi nad tabelą z przyciskiem „Dodaj opiekuna”.
- Elementy: `Button` (Shadcn/ui), opcjonalnie liczba rekordów.
- Zdarzenia: `onAddClick` otwiera `AddWorkerDialog`.
- Walidacja: brak.
- Typy: brak dodatkowych.
- Propsy: `{ onAddClick: () => void, count?: number }`.

### WorkersDataTable
- Opis: Tabela bez paginacji. Kolumny: Imię, Nazwisko, E-mail, Data dodania, Akcje (Usuń).
- Elementy: `<table>` z semantyką ARIA, `Button` usuń w każdej linii.
- Zdarzenia: `onDelete(id)` na kliknięcie Usuń; wsparcie `aria-label`, `aria-disabled`.
- Walidacja: brak (akcje są potwierdzane przed wywołaniem API).
- Typy: `WorkerRowVM`.
- Propsy: `{ rows: WorkerRowVM[], onDelete: (id: number) => void, isBusy?: boolean }`.

### AddWorkerDialog
- Opis: Formularz dodania opiekuna (imię, nazwisko, e-mail). Walidacja z `zod`.
- Elementy: `TextField` x3, `SubmitButton`, komunikaty błędów (`ValidationErrors`).
- Zdarzenia: `onSubmit(formData)`, `onClose()`; po sukcesie toast + zamknięcie.
- Walidacja: wymagane `first_name`, `last_name` (min. 1 znak), poprawny `email` (RFC), brak spacji wiodących/końcowych.
- Typy: `CreateWorkerFormState`, `WorkerCreateCommand` (dla requestu).
- Propsy: `{ open: boolean, onClose: () => void, onCreated: (worker: WorkerDTO) => void }`.

### DeleteWorkerButton (część wiersza tabeli)
- Opis: Przycisk „Usuń” z potwierdzeniem.
- Elementy: `Button`, prosty `window.confirm` (lub `AlertDialog` jeśli dostępny).
- Zdarzenia: `onConfirmDelete(id)`.
- Walidacja: brak; błąd z API obsłużyć toastem.
- Typy: brak dodatkowych.
- Propsy: `{ workerId: number, onDelete: (id: number) => void }`.

## 5. Typy
- Istniejące DTO:
  - `WorkerDTO` (z `src/types.ts`): `{ id, first_name, last_name, email, created_at }`.
  - `WorkersListResponseDTO`: `{ workers: WorkerDTO[] }`.
  - `WorkerCreateCommand`: `{ first_name: string; last_name: string; email: string }`.
- Nowe typy ViewModel:
  - `WorkerRowVM`: `{ id: number; firstName: string; lastName: string; email: string; createdAtLocal: string }` – `createdAtLocal` sformatowany w strefie użytkownika.
  - `CreateWorkerFormState`: `{ first_name: string; last_name: string; email: string }` + błędy `{ fieldErrors?: Record<string,string> }`.

## 6. Zarządzanie stanem
- Hook: `useAdminWorkers` w `src/components/hooks/adminDashboard/useAdminWorkers.ts`:
  - Stan: `workers: WorkerRowVM[]`, `isLoading: boolean`, `error?: string`, `isSubmitting: boolean`.
  - Akcje: `fetchWorkers()`, `createWorker(input)`, `deleteWorker(id)`.
  - Implementacja: `useEffect` dla inicjalnego fetchu; `useCallback` dla akcji; `useTransition` dla niekrytycznych aktualizacji UI.
  - Formatowanie dat: helper w hooku lub `src/lib/utils.ts`.

## 7. Integracja API
- Endpoints (admin auth):
  - GET ` /api/admin/workers` → `WorkersListResponseDTO`.
  - POST `/api/admin/workers` → `WorkerDTO` (201).
  - DELETE `/api/admin/workers/:id` → `{ message: string }` (200).
- Uwaga: W repo istnieje `GET` i `POST` (`src/pages/api/admin/workers.ts`). Dla `DELETE` należy dodać endpoint, który użyje `deleteWorker` z `src/lib/services/workers.service.ts` i zmapuje kody błędów (`WORKER_HAS_ACTIVITIES` → 400, `WORKER_NOT_FOUND` → 404, `INTERNAL_ERROR` → 500).
- Wywołania z frontendu: `fetch` z nagłówkami `Content-Type: application/json`; cookies sesyjne są wysyłane automatycznie (SSR/Auth Supabase).

## 8. Interakcje użytkownika
- Wejście na `/admin/workers`: pobranie listy i wyświetlenie tabeli; w razie braku danych – pusty stan.
- Klik „Dodaj opiekuna”: otwarcie dialogu; po walidacji i sukcesie – toast „Opiekun dodany”, zamknięcie dialogu i odświeżenie listy.
- Klik „Usuń” przy wierszu: potwierdzenie; na sukces – toast „Opiekun usunięty” i odświeżenie; na błąd zależny od kodu – toast z komunikatem (np. „Nie można usunąć – ma przypisane zajęcia”).

## 9. Warunki i walidacja
- Formularz:
  - `first_name`, `last_name` wymagane, min. 1 znak, `trim()`; tylko litery i myślniki (opcjonalnie, jeśli wymagane przez UX).
  - `email` poprawny adres (z `zod.email()`), `toLowerCase()`.
- Tabela/Akcje:
  - Blokowanie wielokrotnego submitu (`isSubmitting`).
  - Disabled przycisków podczas trwających akcji (`aria-disabled`).
- A11y:
  - Semantyczna `<table>` z nagłówkami (`<th scope="col">`) i etykietami `aria-label`.
  - Przyciski z `title` i czytelnym tekstem.

## 10. Obsługa błędów
- 401/403: Przekierowanie/komunikat „Brak uprawnień” (zależnie od globalnego flow admin panelu).
- 409 (POST): „E-mail opiekuna już istnieje”.
- 400 (DELETE): `WORKER_HAS_ACTIVITIES` → „Nie można usunąć – opiekun ma przypisane zajęcia”.
- 404 (DELETE): „Opiekun nie istnieje”.
- 500/INTERNAL_ERROR: „Wystąpił błąd serwera. Spróbuj ponownie.”
- Network: „Brak połączenia. Sprawdź sieć.”

## 11. Kroki implementacji
1. Routing: Utwórz `src/pages/admin/workers.astro` z `Layout.astro` i `AdminNavbar.tsx`; osadź `AdminWorkersPage` z `client:load`.
2. Hook: Dodaj `src/components/hooks/adminDashboard/useAdminWorkers.ts` z fetchem, tworzeniem i usuwaniem.
3. Typy: Zdefiniuj `WorkerRowVM` i `CreateWorkerFormState` w pliku hooka lub `src/components/admin/workers/types.ts`.
4. Komponent kontenera: Utwórz `src/components/admin/workers/AdminWorkersPage.tsx` (React) – użyj hooka, `WorkersToolbar`, `WorkersDataTable`, `AddWorkerDialog`, toasty.
5. Toolbar: `WorkersToolbar.tsx` z przyciskiem Dodaj.
6. Tabela: `WorkersDataTable.tsx` – semantyka jak w `ActivitiesTable.tsx`; kolumny i przycisk Usuń.
7. Dialog: `AddWorkerDialog.tsx` – formularz z `zod`; użyj `TextField`, `SubmitButton`, `ValidationErrors`.
8. Toasty: Upewnij się, że `toaster-wrapper.tsx` jest zainicjalizowany na stronie; użyj `useToastFeedback.ts` jeśli dostępne.
9. API DELETE: Dodaj `src/pages/api/admin/workers/[id].ts` (DELETE) korzystający z `deleteWorker()`; mapuj kody błędów zgodnie z planem.
10. Formatowanie dat: Dodaj helper formatujący `created_at` do lokalnej strefy (np. `toLocaleDateString()`/`toLocaleString()`), zachowując zgodność z PRD (UTC w DB, wyświetlanie w lokalnej strefie).
11. A11y i UX: Dodaj `aria-label`s, `title`s, stany disabled; potwierdzenie usuwania przez `window.confirm`.
13. Refaktoryzacja: Zastosuj `React.memo`, `useCallback`, `useTransition` tam gdzie zasadne; zadbaj o Tailwind klasy zgodnie z wytycznymi.

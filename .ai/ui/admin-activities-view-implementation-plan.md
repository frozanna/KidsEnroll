# Plan implementacji widoku Lista zajęć (Admin)

## 1. Przegląd
Widok umożliwia administratorowi zarządzanie zajęciami: przegląd listy, wyszukiwanie, paginację, edycję oraz usuwanie. Dodatkowo `/admin` służy jako startowy redirect (302) do `/admin/activities` bez UI.

## 2. Routing widoku
- Redirect startowy admina: ścieżka `/admin` → 302 do `/admin/activities` (bez UI).
- Lista zajęć (admin): ścieżka `/admin/activities`.
- Parametry query: `page` (liczba, domyślnie 1), `search` (string, opcjonalnie).

## 3. Struktura komponentów
- `pages/admin/index.astro` (redirect 302 → `/admin/activities`).
- `pages/admin/activities/index.astro` (SSR kontener dla listy):
  - `src/components/admin/activities/AdminActivitiesPage.tsx` (React, klientowy):
    - `ActivitiesToolbar.tsx` (wyszukiwarka, przyciski akcji)
    - `ActivitiesTable.tsx` (DataTable: kolumny i działania)
      - `ConfirmDeleteDialog.tsx` (AlertDialog)
      - `Skeleton` (LoadingSkeleton.tsx)
    - `Toast` (globalna informacja o sukcesie/błędzie)
    - `Pagination` (w toolbarze lub pod tabelą)

## 4. Szczegóły komponentów
### pages/admin/index.astro
- Opis: prosty redirect bez UI.
- Główne elementy: brak, tylko odpowiedź 302.
- Obsługiwane interakcje: brak.
- Walidacja: brak.
- Typy: brak.
- Propsy: brak.

### pages/admin/activities/index.astro
- Opis: SSR kontener, wyciąga parametry `page` i `search` z query, renderuje `AdminActivitiesPage` z propami startowymi.
- Główne elementy: layout, import komponentu React.
- Obsługiwane interakcje: odświeżenie strony przy zmianie query (Astro View Transitions zalecane).
- Walidacja: sanity dla `page` (>=1), `search` (trim, max długość np. 100 znaków).
- Typy: `{ initialPage: number; initialSearch?: string }`.
- Propsy: przekazuje `initialPage`, `initialSearch` do `AdminActivitiesPage`.

### AdminActivitiesPage.tsx
- Opis: główny widok klientowy. Orkiestruje pobieranie danych, reaguje na interakcje (szukanie, paginacja, usuwanie, edycja).
- Główne elementy: `ActivitiesToolbar`, `ActivitiesTable`, `Toast`, `Pagination`.
- Obsługiwane interakcje:
  - Wpisanie frazy w search i potwierdzenie (Enter/klik).
  - Zmiana strony.
  - Klik "Edytuj" (link do przyszłego widoku edycji).
  - Klik "Usuń" → `ConfirmDeleteDialog` → potwierdzenie.
- Walidacja:
  - `search`: trim, brak znaków kontrolnych; długość do 100.
  - `page`: liczba całkowita >= 1.
- Typy (DTO / ViewModel):
  - `AdminActivityDTO` (z backendu): `{ id, name, description, cost, participant_limit, start_datetime, worker_id, facility_id, created_at }`.
  - `AdminActivityRowVM`: `{ id, name, tags: string[], workerName: string | null, startDate: string, startTime: string, limit: number, freeSlots: number | null, cost: number }`.
  - `ActivitiesListResponse`: `{ items: AdminActivityRowVM[], page: number, pageSize: number, total: number }`.
  - `DeleteResponse`: `{ message: string; notifications_sent: number }`.
- Propsy: `{ initialPage: number; initialSearch?: string }`.

### ActivitiesToolbar.tsx
- Opis: pasek narzędzi nad tabelą (pole wyszukiwania, przyciski).
- Główne elementy: `TextField`, `Button`, (opcjonalnie) `Badge` dla aktywnego filtra.
- Obsługiwane interakcje: wpisywanie frazy, submit (onSearch), reset (onReset), nawigacja po stronie.
- Walidacja: jak wyżej dla `search`.
- Typy: `ToolbarProps = { search: string; onSearch: (q: string) => void; onReset?: () => void }`.
- Propsy: `search`, `onSearch`, `onReset`.

### ActivitiesTable.tsx
- Opis: tabela z kolumnami: nazwa, tagi, opiekun, data/godzina, limit, wolne miejsca, koszt, akcje.
- Główne elementy: tabela z wierszami, `Button` (Edytuj/Usuń), `Badge` (tagi), `Skeleton` (loading), stan pusty.
- Obsługiwane interakcje: klik Edytuj (link), klik Usuń (otwiera `ConfirmDeleteDialog`).
- Walidacja: brak (dotyczy wejściowych danych, filtrowanych w rodzicu).
- Typy: `ActivitiesTableProps = { rows: AdminActivityRowVM[]; loading: boolean; onDelete: (id: number) => void }`.
- Propsy: `rows`, `loading`, `onDelete`.

### ConfirmDeleteDialog.tsx
- Opis: modal potwierdzenia usunięcia, pokazuje informację o liczbie powiadomień (mock: toasts) po usunięciu.
- Główne elementy: `AlertDialog` z potwierdzeniem i anulowaniem.
- Obsługiwane interakcje: potwierdź → wywołanie `onConfirm`; anuluj → zamknięcie.
- Walidacja: brak.
- Typy: `ConfirmDeleteDialogProps = { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => Promise<void>; busy: boolean }`.
- Propsy: `open`, `onOpenChange`, `onConfirm`, `busy`.

### Toast
- Opis: feedback po operacjach (sukces/błąd), w szczególności po usunięciu.
- Główne elementy: shadcn/ui `toast` + wrapper `toaster-wrapper.tsx`.
- Obsługiwane interakcje: zamknięcie toastu.
- Walidacja: brak.
- Typy: wbudowane z `use-toast`.
- Propsy: brak (hook).

### Skeleton / Loading
- Opis: placeholdery przy pobieraniu danych tabeli.
- Główne elementy: `LoadingSkeleton.tsx`.
- Obsługiwane interakcje: brak.
- Walidacja: brak.
- Typy: brak.
- Propsy: `rows`, `columns` opcjonalnie.

## 5. Typy
- `AdminActivityDTO` (z backendu) – używany do transformacji do `AdminActivityRowVM`.
- `AdminActivityRowVM` – ViewModel wiersza tabeli:
  - `id: number`
  - `name: string`
  - `tags: string[]` (pobrane z `activity_tags` – może wymagać rozszerzenia zapytania w serwisie lub pobrania w UI)
  - `workerName: string | null` (może wymagać joinu/pobrania w UI)
  - `startDate: string` (YYYY-MM-DD)
  - `startTime: string` (HH:mm)
  - `limit: number`
  - `freeSlots: number | null` (liczone z `participant_limit` - liczba zapisów; może wymagać API liczącego lub dodatkowego zapytania)
  - `cost: number`
- `ActivitiesListResponse` – lista z paginacją: `{ items: AdminActivityRowVM[]; page: number; pageSize: number; total: number }`.
- `DeleteResponse` – odpowiedź po usunięciu: `{ message: string; notifications_sent: number }`.
- `ToolbarProps`, `ActivitiesTableProps`, `ConfirmDeleteDialogProps` – jak w sekcji komponentów.

## 6. Zarządzanie stanem
- Lokalny stan w `AdminActivitiesPage`:
  - `search` (string) – zsynchronizowany z query (`?search=`) i polem w toolbarze.
  - `page` (number) – zsynchronizowany z query (`?page=`).
  - `loading` (boolean) – dla listy.
  - `rows` (`AdminActivityRowVM[]`).
  - `total`, `pageSize` – do paginacji.
  - `deleteDialog` (`{ open: boolean; targetId?: number; busy: boolean }`).
- Custom hook: `useAdminActivities` (opcjonalnie) – kapsułkuje pobieranie listy, parametry, oraz mutacje usuwania.
- Synchronizacja z URL: przy zmianach `page`/`search`, aktualizacja `window.history.replaceState` lub `ClientRouter` (Astro View Transitions) dla płynnych przejść.

## 7. Integracja API
- Lista zajęć: w MVP brak dedykowanego endpointu w `admin.activities.service.ts` dla listy z tagami i wolnymi miejscami. Opcje:
  1) Dodać w warstwie API rozszerzone selecty (join do `activity_tags`, `workers`, i count enrollments). Albo
  2) W UI zrobić wielokrotne zapytania: pobrać `activities`, potem dla widocznych ID pobrać `activity_tags` i policzyć `enrollments` per ID (head count). Zalecane 1) dla wydajności.
- Usuwanie: `deleteActivity(supabase, id)` zwraca `{ message, notifications_sent }`.
- Edycja: `updateActivity(...)` (przyszłe użycie przy widoku edycji – tu tylko link).
- Tworzenie: `createActivity(...)` (przyszłe).

Typy żądań/odpowiedzi:
- GET `/api/admin/activities?search=...&page=...` → `ActivitiesListResponse` (server paginated).
- DELETE `/api/admin/activities/:id` → `DeleteResponse`.

## 8. Interakcje użytkownika
- Wpisanie frazy i submit: odświeża listę od strony 1, aktualizuje query, pokazuje loading/skeleton.
- Zmiana strony: aktualizuje query, pobiera nową stronę, pokazuje loading/skeleton.
- Kliknięcie „Edytuj”: przejście do dedykowanego widoku edycji (link).
- Kliknięcie „Usuń”: otwarcie dialogu; potwierdzenie usuwa zajęcia, pokazuje Toast z informacją „Usunięto. Wysłano powiadomienia: X” (mock), odświeża listę.

## 9. Warunki i walidacja
- `search`: trim, długość ≤ 100; brak znaków kontrolnych.
- `page`: integer ≥ 1. Jeśli niepoprawne, cofnięcie do 1.
- Dane tabeli: formatowanie daty/godziny z `start_datetime` (ISO) na `startDate`, `startTime`.
- `freeSlots`: jeśli brak danych o liczbie zapisów – pokazać `null`/„—” lub policzyć gdy endpoint dostępny.

## 10. Obsługa błędów
- Pobranie listy: błąd sieci/serwera → Toast z komunikatem i sugestia ponowienia; tabela pusta.
- Usunięcie: błąd → Toast, pozostawienie dialogu z możliwością ponowienia.
- Brak wyników: render pustej tabeli ze stanem pustym.
- Edge cases: znikające dane między zapytaniami (race conditions) – traktować jako odświeżenie listy po błędzie.

## 11. Kroki implementacji
1. Utwórz `pages/admin/index.astro` z 302 redirectem do `/admin/activities` (Astro Response.redirect).
2. Utwórz `pages/admin/activities/index.astro` (SSR) – odczyt `page`/`search` z `Astro.url`, sanity check, przekazanie do klientowego komponentu.
3. Dodaj `src/components/admin/activities/AdminActivitiesPage.tsx` – stan, pobieranie, integracje, synchronizacja z URL.
4. Użyj istniejących komponentów z `src/components/dashboard/activities/` jako punktu odniesienia (np. `ActivitiesTable.tsx`, `LoadingSkeleton.tsx`) lub sklonuj w nowej ścieżce `src/components/admin/activities/` i dostosuj kolumny.
5. Zaimplementuj `ActivitiesToolbar.tsx` (pole wyszukiwania + akcje), `Pagination` (prosty komponent lub integracja istniejąca).
6. Zaimplementuj `ConfirmDeleteDialog.tsx` w oparciu o shadcn/ui `AlertDialog`.
7. Podłącz `toast` z `src/components/ui/use-toast.ts` i `toaster-wrapper.tsx` w layoucie lub lokalnie.
8. Zaimplementuj API endpoint `/pages/api/admin/activities/index.ts` (GET) z paginacją i wyszukiwaniem; rozszerz selekcje o tagi i liczbę zapisów (JOIN/COUNT) lub zaimplementuj agregację po stronie serwera w `admin.activities.service.ts`.
9. Zaimplementuj endpoint `/pages/api/admin/activities/[id].ts` (DELETE) używający `deleteActivity` z serwisu.
10. W `AdminActivitiesPage` podłącz GET/DELETE endpointy; zmapuj `AdminActivityDTO` + dodatkowe dane do `AdminActivityRowVM`.
11. Dodaj walidacje i edge cases (pusty stan, skeletony, błędy) zgodnie z sekcjami powyżej.

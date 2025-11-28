# Plan implementacji widoku Admin Activities

## 1. Przegląd
Widok administracyjny zarządzania zajęciami umożliwia administratorowi przegląd, wyszukiwanie, paginację, edycję oraz usuwanie zajęć. Dostarcza tabelę z kluczowymi atrybutami (nazwa, tagi, opiekun, data/godzina, limit, wolne miejsca, koszt) oraz akcjami (Edytuj, Usuń). Usunięcie wymaga potwierdzenia w oknie dialogowym i prezentuje informację o mockowanych powiadomieniach do rodziców poprzez toast po sukcesie.

## 2. Routing widoku
- Redirect startowy: `/admin` → 302 do `/admin/activities`
- Główny widok listy: `/admin/activities`
  - Parametry query: `page` (number, >=1), `search` (string, opcjonalny), w przyszłości `limit` (number) jeśli konfigurowalne.

## 3. Struktura komponentów
```
AdminActivitiesPage (layout wrapper)
  ├─ AdminNavbar (analogiczny do ParentNavbar – nawigacja admina)
  ├─ ActivitiesAdminToolbar
  │    ├─ SearchField
  │    ├─ ResetButton
  │    ├─ CreateActivityLinkButton (opcjonalnie – jeśli edycja/dodawanie w MVP)
  ├─ ActivitiesAdminTable
  │    ├─ TableHeader (kolumny)
  │    ├─ TableBody
  │    │    ├─ ActivityRow (dla każdej aktywności)
  │    │           ├─ TagsBadgeList
  │    │           ├─ ActivityRowActions
  │    │                  ├─ EditLinkButton
  │    │                  ├─ DeleteActivityTriggerButton
  │    ├─ EmptyState (gdy brak danych)
  ├─ PaginationControls (reuse z rodzica z adaptacją stylów)
  ├─ DeleteActivityDialog (AlertDialog)
  ├─ GlobalToastProvider (jeśli nie istnieje już w Layout)
  ├─ LoadingSkeleton (przy initial/loading transitions)
```

## 4. Szczegóły komponentów
### AdminActivitiesPage
- Opis: Kontener strony /admin/activities, pobiera dane (hook), synchronizuje stan z URL (page, search), renderuje toolbar + tabelę + dialog i toast. Odpowiada za SSR/CSR wybór strategii (client:load React, bo interaktywność).
- Główne elementy: `<main>`, `<section>` dla tabeli; komponenty dzieci wymienione wyżej.
- Interakcje: Inicjalizacja fetch, zmiana page, zmiana search, otwarcie dialogu usunięcia, potwierdzenie usunięcia.
- Walidacja: Normalizacja `page` (jeśli <1 → 1), sanity dla `search` (trim, max length np. 64), debounce wyszukiwania.
- Typy: `AdminActivitiesListState`, `AdminActivityViewModel`, `AdminActivitiesFilters`, `DeleteActivityState`.
- Propsy: Brak (top-level page). Wewnętrzny state via hooks.

### ActivitiesAdminToolbar
- Opis: Panel filtracji/wyszukiwania + opcjonalne akcje (dodaj zajęcia). Analogiczny do `ActivitiesToolbar` z panelu rodzica, ale uproszczony do search.
- Elementy: `<form>` (opcjonalnie), `<input type="search">`, przycisk reset, przycisk utworzenia (link do np. `/admin/activities/new`).
- Interakcje: onSearchChange (debounced), onSubmit (prevent default), onReset (czyści search i page=1).
- Walidacja: Maksymalna długość, dopuszczalne znaki (np. litery, cyfry, spacje, przecinki); w przypadku blokowania – wskaźnik błędu (aria-invalid).
- Typy: `AdminActivitiesFilters` (z polem `search?: string`).
- Propsy: `{ search: string; onSearchChange(v: string): void; onReset(): void; }`

### ActivitiesAdminTable
- Opis: Tabela danych z headerem, body i stanami (loading, empty). Wyświetla listę aktywności, umożliwia akcje w wierszu.
- Elementy: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`, `<caption>` (opcjonalnie dla a11y), Skeleton overlay.
- Interakcje: Klik przycisków w `ActivityRowActions`. (Sortowanie w przyszłości – obecnie brak implementacji jeśli backend nie wspiera.)
- Walidacja: N/A dla wejść – prezentacja danych. Waliduje obecność pól (fallbacky np. brak opisu → "—").
- Typy: `AdminActivityViewModel[]`.
- Propsy: `{ activities: AdminActivityViewModel[]; loading: boolean; onDelete(id: number): void; }`

### ActivityRow
- Opis: Reprezentacja jednego rekordu aktywności.
- Elementy: `<tr>` z komórkami: name, tags (TagsBadgeList), worker, date/time, limit/available, cost, actions.
- Interakcje: Przekazuje do `ActivityRowActions`.
- Walidacja: Formatowanie daty/czasu (locale), walidacja cost (number → currency), available vs participantLimit (gdy 0 wolnych miejsc – styl czerwony, aria-label informujący).
- Typy: `AdminActivityViewModel`.
- Propsy: `{ activity: AdminActivityViewModel; onDelete(id: number): void; }`

### TagsBadgeList
- Opis: Lista tagów jako wizualne badge. Reużywa `Badge` z shadcn/ui.
- Elementy: `<div>` wrapper + `<span>`/Badge.
- Interakcje: Brak (display only).
- Walidacja: Puste tagi → renderuje "—".
- Typy: `string[]`.
- Propsy: `{ tags: string[] }`

### ActivityRowActions
- Opis: Kontener przycisków Edytuj/Usuń. Edytuj: link do `/admin/activities/[id]/edit` (future). Usuń: otwiera dialog.
- Elementy: `<div>` + `<Button>` / `<Link>`.
- Interakcje: onClick Delete → wywołuje callback.
- Walidacja: Disabled przycisku Usuń jeśli trwa usuwanie.
- Typy: `RowActionHandlers`.
- Propsy: `{ activityId: number; onRequestDelete(id: number): void; }`

### DeleteActivityDialog
- Opis: AlertDialog do potwierdzenia usunięcia; ostrzega o mock powiadomieniach do rodziców. W trakcie submit pokazuje spinner w przycisku.
- Elementy: `AlertDialog` z tytułem, opisem, przyciskami Cancel/Confirm.
- Interakcje: Confirm → wywołanie API DELETE, sukces → toast, zamknięcie dialogu.
- Walidacja: Blokada Confirm przy loading; anulowanie resetuje stan.
- Typy: `DeleteActivityState`, `ApiErrorShape`.
- Propsy: `{ open: boolean; activity?: AdminActivityViewModel | null; onConfirm(id: number): void; onCancel(): void; submitting: boolean; error?: ApiErrorShape | null; }`

### PaginationControls
- Opis: Nawigacja po stronach wyników. Reuse istniejącego komponentu z ewentualną modyfikacją do admin.
- Elementy: `<nav>` + przyciski Prev/Next + info o bieżącej stronie / total.
- Interakcje: onPageChange(page).
- Walidacja: Brak – blokuje Prev gdy page=1; blokuje Next gdy page*limit >= total.
- Typy: `PaginationState`.
- Propsy: `{ page: number; limit: number; total: number; onPageChange(p: number): void; }`

### LoadingSkeleton
- Opis: Wskazanie ładowania początkowego i przy przełączaniu page/search (opcjonalny fade).
- Elementy: Placeholdery Shadcn Skeleton.
- Interakcje: Brak.
- Walidacja: N/A.
- Typy: N/A.
- Propsy: `{ variant?: "table" }` (opcjonalnie).

### EmptyState
- Opis: Komponent informujący o braku wyników (po wyszukiwaniu lub brak danych w bazie).
- Elementy: Ikona / tekst / opcjonalny link resetujący filtr.
- Interakcje: Reset search.
- Walidacja: N/A.
- Typy: N/A.
- Propsy: `{ message?: string; onResetSearch?(): void; }`

## 5. Typy
### Istniejące
- `AdminActivityDTO`: pełny rekord aktywności (backend row) + pola bazowe.
### Nowe / Rozszerzone
- `AdminActivityListItemDTO` (opcjonalnie jeśli chcemy odchudzić): Pick pól: id, name, cost, participant_limit, start_datetime, worker_id + joined worker (first_name, last_name, email) + computed available_spots + tags.
- `AdminActivitiesListResponseDTO`: `{ activities: AdminActivityDTO[]; page: number; limit: number; total: number; }`
- `AdminActivityViewModel`: `{ id: number; name: string; description: string | null; costFormatted: string; participantLimit: number; availableSpots: number; isFull: boolean; startDateLocal: string; startTimeLocal: string; workerName: string; workerEmail: string; tags: string[]; startISO: string; }`
- `AdminActivitiesFilters`: `{ search?: string; }`
- `PaginationState`: `{ page: number; limit: number; total: number; }`
- `AdminActivitiesListState`: `{ filters: AdminActivitiesFilters; pagination: PaginationState; data: AdminActivityViewModel[]; loadState: LoadState; error?: string; deleteDialog: { open: boolean; activityId?: number }; }`
- `DeleteActivityState`: `{ submitting: boolean; error?: ApiErrorShape | null; success?: boolean; }`
- `ApiErrorShape`: `{ code: string; message: string; }`
- `LoadState`: union (`"idle" | "loading" | "error" | "success"`).

### Mapowanie DTO → ViewModel
Funkcja `mapAdminActivityDtoToVm(dto: AdminActivityDTO): AdminActivityViewModel` (analogiczna do istniejącego `mapDtoToVm`). Formatowanie walut PLN, dat lokalnych, `isFull = available_spots === 0`.

## 6. Zarządzanie stanem
- Hook `useAdminActivitiesList`:
  - Stan: `AdminActivitiesListState`.
  - Efekty: Na zmianę `filters.search` (debounced 300ms) lub `pagination.page` – refetch.
  - API: `fetchActivities({ page, limit, search })` → ustawia loadState.
  - Metody: `setSearch(s)`, `goToPage(p)`, `openDeleteDialog(id)`, `closeDeleteDialog()`, `confirmDelete()`.
- Hook `useDeleteActivity` (może być wbudowany w główny, jeśli prosty): zarządza submitting + wywołaniem DELETE.
- Synchronizacja z URL: przy mount odczyt `page`, `search`; przy zmianie push/replace do `window.history` (`?page=...&search=...`).
- Optymistyczne usunięcie: Po sukcesie usuń z `data` lokalnie bez refetch lub wykonaj refetch dla spójności (jeśli wpływa na dostępne miejsca w innych rekordach – raczej nie wprost).

## 7. Integracja API
- GET `/api/admin/activities?page={page}&limit={limit}&search={search}`
  - Request params: `page:number`, `limit:number`, `search?:string`.
  - Response: `AdminActivitiesListResponseDTO`.
- DELETE `/api/admin/activities/{id}`
  - Response: `{ id: number; notifications_sent: number; }` (AdminActivityDeleteResponseDTO – istniejący typ z serwisu).
- Mapowanie błędów: 401/403 → komunikat o braku uprawnień; 404 przy DELETE → toast błędu i zamknięcie dialogu; 500 → toast ogólny.

## 8. Interakcje użytkownika
- Wpisanie tekstu w pole szukania → debounce → aktualizacja URL → fetch.
- Klik "Reset" → czyści search, page=1, refetch.
- Klik przycisku paginacji (Prev/Next) → aktualizacja page → refetch.
- Klik "Usuń" w wierszu → otwiera dialog.
- Potwierdzenie w dialogu → DELETE → toast sukcesu z informacją o liczbie powiadomień (mock) → zamyka dialog.
- Anulowanie dialogu → zamyka bez akcji.
- Brak wyników po search → EmptyState z możliwością resetu.

## 9. Warunki i walidacja
- `page`: jeśli brak lub <1 → 1.
- `search`: przy trim pusty string → usunięcie parametru; długość >64 → przycięcie.
- Dostępność przycisku Prev: `page > 1`; Next: `page < ceil(total/limit)`.
- W dialogu Delete: disabled Confirm gdy `submitting`.
- Formatowanie daty/czasu: użycie `Intl.DateTimeFormat` z locale użytkownika.
- Koszt: `Intl.NumberFormat` z PLN.
- Wskaźnik pełnych zajęć: `availableSpots === 0` → aria-label "Brak wolnych miejsc".

## 10. Obsługa błędów
- Sieć / fetch fail: `loadState = "error"` + komunikat i przycisk retry.
- Brak uprawnień (401/403): Redirect do strony logowania lub toast + blokada widoku.
- API 404 przy DELETE: Komunikat "Zajęcia nie istnieją" → usunięcie z listy jeśli były widoczne.
- Walidacja parametrów (page): automatyczna korekta.
- Timeout (opcjonalnie): pokaż ogólny błąd.
- Race condition (usunięcie zanim dialog potwierdzony): 404 obsłużone jak wyżej.

## 11. Kroki implementacji
1. Dodaj redirect stronę `/src/pages/admin/index.astro` z 302 do `/admin/activities` (Astro endpoint lub meta refresh + server response). 
2. Utwórz stronę `/src/pages/admin/activities/index.astro` z layoutem i osadzeniem komponentu `AdminActivitiesPage` (`client:load`).
3. Dodaj komponent `AdminActivitiesPage.tsx` w `src/components/admin/activities/` (nowy katalog) – analogia do rodzica.
4. Zaimplementuj typy: `AdminActivityViewModel`, `AdminActivitiesListResponseDTO` (jeśli backend doda), `AdminActivitiesListState` w pliku `types.ts` lub lokalnym `types.ts` obok komponentów.
5. Dodaj mapping funkcję `mapAdminActivityDtoToVm`.
6. Utwórz hook `useAdminActivitiesList.ts` w `src/components/hooks/admin/` z zarządzaniem stanem, integracją URL i fetch API.
7. Zaimplementuj `ActivitiesAdminToolbar.tsx` – search + reset; integracja z hookiem.
8. Zaimplementuj `ActivitiesAdminTable.tsx`, `ActivityRow.tsx`, `ActivityRowActions.tsx`, `TagsBadgeList.tsx`.
9. Reużyj lub skopiuj `PaginationControls.tsx` z panelu rodzica do katalogu admin (lub uogólnij wspólny komponent w `src/components/dashboard/shared/`).
10. Dodaj `DeleteActivityDialog.tsx` – wykorzystaj AlertDialog z shadcn/ui.
11. Dodaj logikę wywołania DELETE w hooku (metoda `confirmDelete`).
12. Podłącz toast: użyj istniejącego `toaster-wrapper.tsx` (lub globalny provider). Wyświetl sukces z liczbą `notifications_sent`.
13. Obsłuż stany: loading (Skeleton), error (retry), empty (EmptyState).
14. Dodaj atrybuty a11y: aria-label dla pełnych zajęć, odpowiednie role w tabeli (caption/aria-describedby dla opisów).
15. Test manualny: wyszukiwanie, paginacja (symulowana jeśli brak backend), usuwanie (mock). 
16. Dodaj e2e scenariusz (opcjonalnie) lub jednostkowe testy mappingu typów.
17. Refaktoryzuj wspólne code (np. formatowanie daty/kosztu) do utili w `src/lib/utils.ts` jeśli duplikacja.
20. Finalne review kodu pod kątem wytycznych (.github/instructions/*.md) i dostępności.

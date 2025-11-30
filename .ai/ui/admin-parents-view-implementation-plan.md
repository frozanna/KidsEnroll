# Plan implementacji widoku Admin Parents

## 1. Przegląd
Widok zarządzania rodzicami dla administratora dostarcza listę wszystkich kont rodziców z paginacją i wyszukiwaniem oraz możliwość wglądu w szczegóły wybranego rodzica (profil + dzieci). Widok musi być zabezpieczony (rola admin), dostępny, odporny na błędy i spójny z istniejącymi wzorcami UX (DataTable + Toast).

## 2. Routing widoku
- Lista: `/admin/parents`
- Szczegóły: `/admin/parents/:id`

## 3. Struktura komponentów
```
AdminParentsPage (Astro + React island) /admin/parents
  ├─ ParentsTableContainer (React)
  │   ├─ ParentsSearchBar
  │   ├─ ParentsDataTable
  │   │   ├─ TableHeader (kolumny: Email, Imię, Nazwisko, Dzieci, Data utworzenia, Akcje)
  │   │   ├─ TableBody
  │   │   │   ├─ ParentRow * n
  │   │   │       ├─ ParentRowActions (Przycisk Szczegóły)
  │   ├─ PaginationControls
  │   ├─ EmptyState (gdy brak rekordów po filtracji)
  │   ├─ LoadingOverlay / Skeleton
  └─ ToastViewport (shadcn/ui)

AdminParentDetailPage (Astro SSR) /admin/parents/:id
  ├─ ParentDetailLayout (React lub czysty Astro)
      ├─ ParentProfileCard
      ├─ ParentChildrenList
      │   ├─ ParentChildItem * n
      ├─ BackButton
      ├─ NotFoundState (gdy 404)
      └─ LoadingState (opcjonalny fallback przy client-side hydration)
```

## 4. Szczegóły komponentów
### AdminParentsPage
- Opis: Strona listy rodziców; inicjuje pobieranie danych (GET), utrzymuje stan wyszukiwania, paginacji.
- Główne elementy: wrapper `<div>`, nagłówek (opcjonalny), kontener tabeli, toast viewport.
- Interakcje: wpisywanie w pole wyszukiwania, zmiana strony, przejście do szczegółów.
- Walidacja: parametry `page` (>=1), `limit` (1..100), `search` (trim, dł. ≤100). Puste search ignorowane.
- Typy: `ParentsListResponseDTO`, `ParentListItemDTO`, ViewModels (patrz sekcja Typy).
- Propsy: (jeśli jako wyspa) opcjonalnie wstępne dane SSR `{initialData?: ParentsListResponseDTO}`.

### ParentsTableContainer
- Opis: Logiczny wrapper zarządzający lokalnym stanem wyszukiwania i paginacji; deleguje do API hooka.
- Elementy: SearchBar, DataTable, PaginationControls.
- Interakcje: `onSearchChange`, `onPageChange`.
- Walidacja: opóźniona walidacja search (trim + długość); numer strony w zakresie.
- Typy: `ParentsTableState`, `ParentsActions`.
- Propsy: `{ state: ParentsTableState; actions: ParentsActions }`.

### ParentsSearchBar
- Opis: Pole tekstowe + ikona; debounce ~300ms.
- Elementy: `<input type="search">`, przycisk reset.
- Interakcje: `onChange`, `onClear`.
- Walidacja: długość ≤100, trim whitespace; jeśli po trim pusty -> clear search.
- Typy: używa `string | undefined` dla wartości search.
- Propsy: `{ value: string; onChange(v: string): void; onClear(): void; loading: boolean }`.

### ParentsDataTable
- Opis: Tabela wyników z kolumnami i wierszami rodziców.
- Elementy: `<table>` z `<thead>`, `<tbody>`, `<tr>`, `<td>`, sortowanie brak (MVP).
- Opis: Zestaw przycisków akcji w wierszu.
- Elementy: 2 przyciski (`Szczegóły`).
- Opis: Nawigacja między stronami.
- Elementy: przyciski "Poprzednia", "Następna", info "Strona X z Y".
- Opis: Komunikat o braku danych (pusty wynik lub brak rodziców).
- Elementy: ikona, tekst.
- Opis: Warstwa wizualna w trakcie fetch.
- Elementy: animowane placeholdery.
- Opis: Prezentacja komunikatów sukcesu i błędu.
- Elementy: shadcn/ui `<Toaster />`.
### AdminParentDetailPage
- Opis: Strona szczegółów rodzica; SSR fetch profilu i dzieci.
- Typy: `ParentDetailDTO` -> `ParentDetailVM`.
- Propsy: `{ initialDetail: ParentDetailDTO }` lub dynamiczny fetch.
- Elementy: nazwa, email, data utworzenia.
- Interakcje: brak (MVP).
- Opis: Lista dzieci z liczbą zapisów.
- Elementy: `<ul>` z `<li>`.
- Propsy: `{ children: ParentChildItemVM[] }`.

- Elementy: imię, nazwisko, birth_date, enrollments_count.
- Interakcje: brak.

### BackButton
- Interakcje: `onClick` navigate.
- Walidacja: brak.

### NotFoundState
- Opis: Prezentacja 404 dla szczegółów.
- Propsy: `{}`.

## 5. Typy
### Istniejące DTO (z `@types.ts`)
- `ParentListItemDTO`: { id: string; first_name: string; last_name: string; created_at: string; email: string; children_count: number }
- `ParentsListResponseDTO`: { parents: ParentListItemDTO[]; pagination: { page:number; limit:number; total:number } }
- `ParentDetailDTO`: { id: string; email: string; first_name: string; last_name: string; created_at: string; children: ParentDetailChildDTO[] }
- `ParentDetailChildDTO`: { id:number; first_name:string; last_name:string; birth_date:string; enrollments_count:number }

### Nowe ViewModel
- `ParentRowViewModel`: uproszczony model do tabeli
```
interface ParentRowViewMode {
  id: string;
  displayName: string; // first_name + ' ' + last_name lub '—'
  email: string;
  childrenCount: number;
  createdAtISO: string; // oryginalny ISO
  createdAtFormatted: string; // lokalny format (DD.MM.YYYY)
}
```
- `ParentsTableState`:
```
interface ParentsTableState {
  page: number;
  limit: number;
  total: number;
  search: string;
  rows: ParentRowVM[];
  loading: boolean;
  error?: string; // błąd listy
  lastUpdated: number; // timestamp do ewentualnego odświeżenia
}
```
- `ParentsActions`:
```
interface ParentsActions {
  setSearch(v: string): void;
  setPage(p: number): void;
  refresh(): void;
}
```

```
interface ParentChildItemVM {
```

- Szczegóły: `useParentDetail` może być prostym hookiem jeśli potrzebne client-side odświeżenie; preferowane SSR w Astro (fetch w pliku `.astro` i przekazanie danych jako props do komponentu React statycznego).
- Globalne toast: `useToastFeedback`.
1. `GET /api/admin/parents?page=<page>&limit=<limit>&search=<search?>`
   - Response: `ParentsListResponseDTO`.
2. `GET /api/admin/parents/:id`
   - Response: `ParentDetailDTO`. 404 -> NotFoundState.
### Walidacja parametrów
- page (int >=1), limit (1..100), search (trim, length <=100) – walidacja serwerowa; front dba o niegenerowanie nieprawidłowych wartości.
### Autoryzacja
- Wszystkie wywołania wymagają nagłówka Bearer; front używa supabase session lub token z kontekstu.

## 8. Interakcje użytkownika
- Wpisanie tekstu w wyszukiwarkę → debounce → aktualizacja `search` → nowy fetch.
- Klik "Następna" / "Poprzednia" strona → zmiana `page` → fetch.
- Brak wyników (pusta lista) → pokazanie komponentu `EmptyState`.
- Błąd sieci → toast błędu + opcja retry (przycisk odświeżania / automatyczny refresh).

## 9. Warunki i walidacja
- Paginacja: blokada przycisków gdy brak kolejnych stron (obliczenie `hasNext = page * limit < total`).
- Search: trim; jeśli po trim pusty → traktuj jako brak filtra; długość >100 nie wysyłaj request (opcjonalnie przytnij / pokaż toast ostrzegający).
- Format daty: konwersja ISO -> lokalny (Intl.DateTimeFormat) – dopuszczalne wszystkie strefy użytkownika.
- Dostępność: aria-label dla tabeli, scope="col" dla nagłówków.
- Błędy HTTP: 401/403 → przekierowanie do logowania / komunikat o braku uprawnień; 404 w szczegółach → NotFoundState.

## 10. Obsługa błędów
- Fetch listy: jeśli error → `state.error` + toast; zachowaj ostatnie poprawne dane (optimistic stale view pattern).
- Timeout: konfigurowalny abort controller; w razie przekroczenia → toast „Przekroczono czas żądania”.
- Brak dzieci w szczegółach: render sekcji dzieci z informacją „Brak dzieci”.
- Nieautoryzowany: intercept 401/403 → centralny handler (np. redirect). W widoku tylko prezentacja komunikatu.

## 11. Kroki implementacji
1. Dodaj plik routingu Astro: `src/pages/admin/parents.astro` (layout, mount React island z `AdminParentsPage`).
2. Utwórz komponent `AdminParentsPage.tsx` w `src/components/admin/parents/` (nowy katalog jeśli brak) – integracja hooka i struktury.
4. Dodaj komponenty: `ParentsSearchBar.tsx`, `ParentsDataTable.tsx`, `ParentRowActions.tsx`, `PaginationControls.tsx`,  `EmptyState.tsx`, `LoadingOverlay.tsx` zgodnie z opisami.
5. Użyj komponentów UI z shadcn/ui (Button, Spinner, Input, Toast). Dodaj odpowiednie klasy Tailwind.
6. Mapuj DTO → VM (funkcje `mapParentListItemToRowVM`, `mapParentDetailToVM`) w osobnym pliku `mappers/parents.mappers.ts`.
7. Zaimplementuj integrację API (fetch) w helperze `src/lib/api/helper.ts` lub dedykowany service frontendowy `admin.parents.api.ts` (GET list, GET detail)
8. Dodaj stronę szczegółów: `src/pages/admin/parents/[id].astro` – SSR fetch `GET /api/admin/parents/:id`; przekazanie danych do komponentu `AdminParentDetailPage.tsx`.
9. Utwórz komponenty detalu: `AdminParentDetailPage.tsx`, `ParentProfileCard.tsx`, `ParentChildrenList.tsx`, `ParentChildItem.tsx`, `BackButton.tsx`, `NotFoundState.tsx`.
10. Zapewnij a11y: tabela (aria-label). Dodaj `sr-only` nagłówki jeśli potrzebne.
11. Dodaj obsługę toast (błędy fetch) korzystając z istniejącego `useToastFeedback`.
14. Refine performance: memoizacja wierszy (`React.memo` dla `ParentRowActions`).
15. Code review pod kątem zgodności z instrukcjami (Tailwind, a11y, early returns, error handling).

---
Plan kompletny – gotowy do implementacji zgodnie z architekturą projektu i wymaganiami PRD.

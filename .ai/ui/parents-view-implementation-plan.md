# Plan implementacji widoku Rodzice (Lista) oraz Szczegóły Rodzica

## 1. Przegląd
Widok administracyjny „Rodzice” składa się z dwóch powiązanych ekranów:
1. Lista rodziców (`/admin/parents`) – przegląd kont rodziców z paginacją, wyszukiwaniem oraz akcją usunięcia (kaskadowe usunięcie dzieci i ich zapisów).
2. Szczegóły rodzica (`/admin/parents/:id`) – prezentacja podstawowych danych profilu oraz listy jego dzieci z liczbą zapisów (enrollments_count).

Cele biznesowe: szybki wgląd w strukturę rodziców, kontrola nadużyć, możliwość porządkowania danych poprzez usuwanie kont (MVP – brak edycji i tworzenia z poziomu administratora).

## 2. Routing widoku
- Lista: `GET /admin/parents` → plik `src/pages/admin/parents.astro`
- Szczegóły: `GET /admin/parents/[id].astro` (dynamiczna trasa) → plik `src/pages/admin/parents/[id].astro`
- API (już istniejące / zakładane):
  - Lista: `GET /api/admin/parents?page&limit&search`
  - Szczegóły: `GET /api/admin/parents/:id`

## 3. Struktura komponentów
```
/pages/admin/parents.astro (SSR shell)
  └─ <AdminParentsList /> (React – interaktywny)
       ├─ <ParentsTableToolbar /> (search + limit)
       ├─ <ParentsDataTable /> (tabela właściwa)
       │    ├─ <ParentRow /> (wiersz + akcje)
       ├─ <PaginationControls />
       └─ <ToastViewport /> (już istniejący wrapper/toast jeśli globalny)

/pages/admin/parents/[id].astro (SSR fetch detail – minimal JS)
  └─ <ParentDetailCard /> (opcjonalnie React dla drobnej interakcji, ale może być czysty Astro)
       ├─ Sekcja: Dane profilu
       ├─ Sekcja: Lista dzieci <ChildrenList /> (lista statyczna)
       └─ <BackButton />
```

## 4. Szczegóły komponentów
### AdminParentsList
- Opis: Główny komponent logiki listy. Odpowiada za pobieranie danych, utrzymanie stanu paginacji, wyszukiwarki i obsługę usuwania.
- Główne elementy: wrapper `div`, `<ParentsTableToolbar />`, `<ParentsDataTable />`, `<PaginationControls />`
- Obsługiwane interakcje:
  - Wpisanie tekstu w pole wyszukiwania → opóźnione (debounce) zapytanie.
  - Zmiana limitu na stronę.
  - Kliknięcie numeru strony / przycisk następna / poprzednia.
- Obsługiwana walidacja:
  - `page` ≥ 1.
  - `limit` w dozwolonym zakresie (1–100, domyślnie 20).
  - `search` obcięcie spacji, maksymalna długość (np. 120) dla bezpieczeństwa.
- Typy: `ParentListItemDTO`, `ParentsListResponseDTO`, `PaginationDTO`.
- Propsy: Brak (komponent sam pobiera z API). Ewentualnie `initialPage?: number`, `initialSearch?: string` odczytane z SSR query params w Astro i przekazane jako initial state.

### ParentsTableToolbar
- Opis: Pasek narzędzi nad tabelą – wyszukiwarka, selektor limitu.
- Główne elementy: `<input type="search" />`, `<select>` limitu, opcjonalnie licznik wyników.
- Interakcje: `onChange` search (z debounce), `onChange` limit.
- Walidacja: trim search, nie wysyła pustych zmian jeśli identyczne.
- Typy: `ToolbarProps` (search, limit, onSearchChange, onLimitChange, loading).
- Propsy: `search: string`, `limit: number`, `onSearchChange(value: string)`, `onLimitChange(limit: number)`, `loading: boolean`.

### ParentsDataTable
- Opis: Renderuje tabelę wyników lub stan pusty / loading / error.
- Główne elementy: `<table>` z `<thead>` (Email / Imię / Nazwisko / Dzieci / Data / Akcje), `<tbody>` z `<ParentRow />`.
- Interakcje: Deleguje akcje do rodzica – klik w wierszu (przejście do szczegółów), klik przycisku Usuń.
- Walidacja: Brak dodatkowej – wejściowe dane już zweryfikowane.
- Typy: `ParentsDataTableProps`.
- Propsy: `data: ParentListItemDTO[]`, `loading: boolean`, `error?: string`, `onDelete(id: string)`, `onRowClick(id: string)`.

### ParentRow
- Opis: Pojedynczy wiersz z danymi i przyciskami.
- Główne elementy: `<tr>` z `<td>`; przycisk „Szczegóły” (lub klikalny wiersz), przycisk „Usuń”.
- Interakcje: `onDeleteClick(id)`, `onDetails(id)`.
- Walidacja: Brak – prezentacja.
- Typy: `ParentListItemDTO`.
- Propsy: `item: ParentListItemDTO`, `onDelete(id: string)`, `onDetails(id: string)`.

### PaginationControls
- Opis: Nawigacja stron: aktualna strona, poprzednia, następna, ewentualnie szybki wybór.
- Główne elementy: `<nav>` z przyciskami.
- Interakcje: `onPageChange(newPage)`.
- Walidacja: Blokada przycisku poprzednia gdy page === 1; blokada następna gdy `page * limit >= total`.
- Typy: `PaginationProps`.
- Propsy: `page: number`, `limit: number`, `total: number`, `onPageChange(page: number)`.

### DeleteParentDialog
- Opis: Okno potwierdzenia. Informuje o kaskadowym usunięciu dzieci i zapisów.
- Główne elementy: Shadcn `<AlertDialog>` z tytułem, opisem, przyciskami „Anuluj” / „Usuń”.
- Interakcje: Potwierdzenie => CALL DELETE; Anuluj => close.
- Walidacja: Blokada przycisku podczas requestu.
- Typy: `DeleteDialogProps`, `ParentDeleteResponseDTO`.
- Propsy: `open: boolean`, `onConfirm(): void`, `onCancel(): void`, `loading: boolean`, `counts?: { children: number; enrollments: number }` (opcjonalnie jeśli pobrane przed usunięciem).

### ParentDetailCard (widok szczegółów)
- Opis: Kontener dla danych profilu rodzica + lista dzieci.
- Główne elementy: `<section>`: nagłówek (Imię Nazwisko + Email + Data utworzenia), `<ChildrenList />`, `<BackButton />`.
- Interakcje: Powrót do listy.
- Walidacja: 404 gdy brak danych – obsłużone na poziomie Astro SSR (render strony z komunikatem).
- Typy: `ParentDetailDTO`, `ParentDetailVM`.
- Propsy: `data: ParentDetailVM`.

### ChildrenList
- Opis: Prezentacja dzieci danego rodzica z liczbą zapisów.
- Główne elementy: `<ul>` z `<li>` (Imię, nazwisko, data urodzenia, enrollments_count).
- Interakcje: Brak (MVP).
- Walidacja: Brak.
- Typy: `ParentDetailChildDTO`.
- Propsy: `children: ParentDetailChildDTO[]`.

### BackButton
- Opis: Prosty przycisk nawigacyjny do `/admin/parents`.
- Główne elementy: `<button>` / `<a>`.
- Interakcje: `onClick` → `window.location.href` lub `<a href>`.
- Walidacja: Brak.
- Typy: Brak dedykowanych.
- Propsy: `href?: string` (domyślnie `/admin/parents`).

## 5. Typy
### Istniejące DTO (z `src/types.ts`)
- `ParentListItemDTO` – pola: `id: string`, `first_name: string`, `last_name: string`, `created_at: string`, `email: string`, `children_count: number`.
- `ParentsListResponseDTO` – pola: `parents: ParentListItemDTO[]`, `pagination: PaginationDTO`.
- `ParentDetailDTO` – pola: `id`, `first_name`, `last_name`, `created_at`, `email`, `children: ParentDetailChildDTO[]`.
- `ParentDetailChildDTO` – pola: `id: number`, `first_name: string`, `last_name: string`, `birth_date: string`, `enrollments_count: number`.
- `ParentDeleteResponseDTO` – pola: `message: string`, `deleted_children: number`, `deleted_enrollments: number`.

### Nowe typy ViewModel
1. `ParentListRowVM` – rozszerzenie dla tabeli (opcjonalne):
```ts
interface ParentListRowVM {
  id: string;
  displayName: string; // `${first_name} ${last_name}` trimmed
  email: string; // może być pusty string – wyświetl komunikat zastępczy
  childrenCount: number;
  createdDate: string; // sformatowana lokalnie data
  createdTime?: string; // opcjonalnie HH:mm dla tooltipu
}
```
2. `ParentDetailVM` – odwzorowanie szczegółów z formatowaniem:
```ts
interface ParentDetailVM {
  id: string;
  displayName: string;
  email: string;
  createdAtLocal: string; // lokalna data + czas
  children: ParentDetailChildVM[];
}
interface ParentDetailChildVM {
  id: number;
  fullName: string;
  birthDateLocal: string; // data w lokalnym formacie
  enrollmentsCount: number;
}
```
3. `DeleteParentResultVM` – do toast:
```ts
interface DeleteParentResultVM {
  deletedChildren: number;
  deletedEnrollments: number;
  message: string;
}
```

### Typy pomocnicze
- `FetchState<T>`:
```ts
interface FetchState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}
```
- `PaginationQuery`:
```ts
interface PaginationQuery {
  page: number; // >=1
  limit: number; // <=100
  search?: string;
}
```

## 6. Zarządzanie stanem
- Stan lokalny w `AdminParentsList` utrzymywany przez `useReducer` lub `useState` + `useEffect` dla danych.
- Główne zmienne stanu: `page`, `limit`, `searchInput`, `debouncedSearch`, `fetchState (list)`, `deleteDialogOpen`, `selectedParentId`, `deleting`.
- Hooki niestandardowe:
  - `useDebouncedValue(value, delay)` – do opóźniania wyszukiwania (500 ms).
  - `useAdminParentsList(query: PaginationQuery)` – odpowiedzialny za pobranie listy; zwraca `{data, loading, error}` i aktualizuje przy zmianach query.
  - `useParentDelete()` – wrapper na DELETE z zarządzaniem stanem `loading` i mapowaniem odpowiedzi.
  - Szczegóły rodzica mogą być pobrane server-side (SSR w pliku `.astro`), więc dodatkowy hook nie jest konieczny (statyczny rendering). Jeśli potrzebna dynamiczna aktualizacja, można dodać `useParentDetail(id)`.

## 7. Integracja API
### Lista
Żądanie: `GET /api/admin/parents?page=PAGE&limit=LIMIT&search=SEARCH`
Oczekiwane typy: `ParentsListResponseDTO` → mapowane do `ParentListRowVM[]`.
Transformacje:
- Formatowanie daty `created_at` do lokalnej.
- Sklejanie imienia i nazwiska.
- Fallback dla pustego email ("Brak email" lub `—`).

### Usunięcie
Żądanie: `DELETE /api/admin/parents/:id`
Odpowiedź: `ParentDeleteResponseDTO` → `DeleteParentResultVM`.
Po sukcesie: zamknięcie dialogu, toast z informacją, ponowne pobranie listy (lub optymistyczne usunięcie wiersza).

### Szczegóły
SSR: w `getStatic` lub bezpośrednio w `.astro` (ponieważ `prerender = false`). Użycie supabase z `Astro.locals`. Otrzymany `ParentDetailDTO` mapowany do `ParentDetailVM` (formaty dat, łączenie imię+nazwisko).

### Błędy API
- 401/403 → redirect / komunikat „Brak uprawnień”.
- 404 (szczegóły) → render strony z komunikatem „Rodzic nie znaleziony”.
- 500 / INTERNAL_ERROR → toast / komunikat błędu w tabeli.

## 8. Interakcje użytkownika
1. Wpisanie tekstu w wyszukiwarkę → po 500 ms aktualizacja listy z `search`.
2. Zmiana limitu → reset `page` do 1 i refetch.
3. Klik „Następna” / „Poprzednia” → zmiana `page` i refetch.
4. Klik w wiersz / przycisk „Szczegóły” → nawigacja `/admin/parents/:id`.
5. Klik „Usuń” → otwarcie dialogu potwierdzenia.
6. Potwierdzenie „Usuń” → wywołanie DELETE; w trakcie przycisk disabled, po sukcesie toast.
7. Anulowanie dialogu → zamknięcie bez efektu.

## 9. Warunki i walidacja
- `page` zawsze >= 1 – wymuszane przy zmianach.
- `limit` ograniczony do {10,20,50,100} – zestaw kontrolowany.
- `search` trim + jeśli długość > 120 znaków → obcięcie i wysłanie krótszej wersji.
- Blokada przycisków paginacji gdy brak kolejnych stron.
- W dialogu usunięcia – komunikat ostrzegawczy o kaskadowym usunięciu dzieci i zapisów (wyjaśnienie konsekwencji).
- Po usunięciu – jeśli bieżąca strona stała się pusta i page > 1 → page - 1 i refetch (zapewnienie ciągłości UX).

## 10. Obsługa błędów
- Lista: Jeśli błąd fetch → render stanu błędu w miejscu tabeli + przycisk „Spróbuj ponownie”.
- Wyszukiwanie: Błąd traktowany jak w liście – nie resetujemy ostatnich dobrych danych (można zachować poprzednie wyniki i wyświetlić overlay błędu).
- Usunięcie: Błąd (np. 403 / 404 / 500) → toast z komunikatem, dialog zamknięty lub pozostaje z możliwością ponowienia (preferowane: pozostawienie i pokazanie błędu). Jeśli 404 → odświeżenie listy w celu synchronizacji.
- Szczegóły: 404 → dedykowany komponent „NotFound”; inne błędy → ogólny komunikat i link powrotu.
- Sieć niedostępna: toast „Błąd sieci” + możliwość ponowienia.

## 11. Kroki implementacji
1. Dodaj pliki routingu: `src/pages/admin/parents.astro`, `src/pages/admin/parents/[id].astro` (ustaw `export const prerender = false` jeśli dynamiczne SSR wymagane).
2. W pliku listy pobierz initial query params (page, search, limit) i przekaż do `<AdminParentsList client:load />` jako props (lub data-attrib).
3. Utwórz katalog komponentów: `src/components/admin/parents/`.
4. Zaimplementuj `useDebouncedValue` w `src/components/hooks/adminDashboard/useDebouncedValue.ts` (lub wspólny katalog hooks). Test: opóźnienie updates.
5. Zaimplementuj `useAdminParentsList(query)` – fetch z abort controllerem; mapowanie DTO → VM.
6. Stwórz komponent `AdminParentsList.tsx`: zarządzanie stanem (page, limit, searchInput, debouncedSearch, data, loading, error, dialog).
7. Dodaj `ParentsTableToolbar.tsx` – pola wejściowe, wywołuje callbacks.
8. Dodaj `ParentsDataTable.tsx` oraz `ParentRow.tsx` – tabela + wiersze + akcje.
9. Dodaj `PaginationControls.tsx` – logika blokad i wywołań.
10. Dodaj `DeleteParentDialog.tsx` – AlertDialog z ostrzeżeniem. Opcjonalnie przed usunięciem pobierz szczegóły dla dynamicznych liczb dzieci; jeśli pomijamy prefetch, pokaż generowany tekst „Usunięcie spowoduje skasowanie wszystkich dzieci i ich zapisów.”, a liczby pokaż po operacji w toast.
11. Implementacja `useParentDelete` – wywołanie DELETE, mapowanie odpowiedzi do `DeleteParentResultVM`.
12. Integracja toastów: sukces usunięcia („Konto rodzica usunięte. Dzieci: X, Zapisy: Y”), błąd („Nie udało się usunąć konta rodzica”).
13. Mechanizm odświeżenia listy po usunięciu: refetch; jeśli lista pusta & page > 1 → decrement page i refetch.
14. W `parents/[id].astro`: SSR fetch szczegółów przez supabase (z `Astro.locals.supabase`), mapowanie do `ParentDetailVM`, render statyczny HTML (opcjonalnie minimalny React tylko jeśli potrzebne). Obsłuż 404.
15. Utwórz komponent `ParentDetailCard.astro` lub `.tsx` (jeśli potrzebne interakcje) + `ChildrenList.astro`.
16. Dodaj a11y: nagłówki `<h1>` dla stron, aria-labels dla wyszukiwarki („Wyszukaj rodzica po imieniu lub nazwisku”), role dialogu, focus trap w dialogu.
17. Dodaj testy jednostkowe (opcjonalnie w MVP) dla hooka debounce i mapowania VM (jeśli istnieje infrastruktura testowa).
18. Przegląd kodu pod kątem zasad (guard clauses, brak zbędnych else, obsługa błędów).
19. Manualna walidacja: wyszukiwanie, paginacja, scenariusz usunięcia ostatniego wiersza na stronie.
20. Dokumentacja krótkiego README sekcji komponentów (opcjonalne) lub komentarz na górze głównego komponentu.

---
Gotowe. Implementacja według powyższego planu zapewni spójność z PRD (US-012), zachowa konwencje projektu oraz umożliwi rozszerzenia (np. dodanie sortowania, eksportu) w przyszłych iteracjach.

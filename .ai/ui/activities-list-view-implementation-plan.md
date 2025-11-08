# Plan implementacji widoku Lista zajęć (rodzic)

## 1. Przegląd
Widok prezentuje listę dostępnych zajęć dla rodzica w celu przeglądania oferty i rozpoczęcia procesu zapisu dziecka. Umożliwia filtrowanie (dostępne miejsca, zakres dat, tagi), paginację, podgląd szczegółów (opis), informację o opiekunie, koszt, harmonogram oraz liczbę wolnych miejsc. Zapewnia akcję „Zapisz” (gdy są miejsca) oraz informację „Brak miejsc” w przypadku pełnego obłożenia. Pusty wynik pokazuje komunikat „Brak dostępnych zajęć”. Widok integruje się z endpointem `GET /api/activities`.

## 2. Routing widoku
- Ścieżka: `/app/zajecia`
- Dostęp: Uwierzytelniony użytkownik z rolą `parent` (weryfikacja wcześniej w logice dashboardu lub guardzie). Jeśli brak dzieci (onboarding nieukończony) – przekierowanie do dodania dziecka (logika poza zakresem tego widoku, ale uwzględnić warunek przy mount).

## 3. Struktura komponentów
```
ActivitiesListPage (React w Astro page wrapper lub sekcja w `dashboard.astro`)
└─ ActivitiesToolbar
   ├─ DateRangeFilter (opcjonalnie: pojedynczy komponent z kalendarzem)
   ├─ TagsFilter (wielokrotny wybór tagów / input comma separated)
   ├─ AvailableSpotsToggle (checkbox lub switch: tylko z wolnymi miejscami)
   └─ ResetFiltersButton
└─ ActivitiesTableWrapper
   ├─ ActivitiesTable
   │  ├─ TableHeader
   │  ├─ TableBody
   │  │  ├─ ActivityRow (dla każdej aktywności)
   │  │  │  ├─ TagsBadges (Badge[])
   │  │  │  └─ EnrollActionCell
   │  │  │     └─ EnrollButton (disabled jeśli pełne)
   │  └─ TableFooter (PaginationControls)
   ├─ EmptyState (puste dane)
   ├─ LoadingSkeleton (ładowanie)
└─ EnrollDialog (modal wywoływany z EnrollButton)
   ├─ ChildSelectionList (lista dzieci z możliwością wyboru jednego)
   ├─ DialogActions (Zapisz / Anuluj)
└─ ToastContainer (globalny – już istniejący `toaster-wrapper`)
```

## 4. Szczegóły komponentów
### ActivitiesListPage
- Opis: Komponent nadrzędny zarządzający stanem filtrowania, paginacji, pobierania danych i zapisu na zajęcia. Odpowiada za integrację z API, prezentację wyników i obsługę dialogu.
- Główne elementy: wrapper `<section role="main">`, `ActivitiesToolbar`, `ActivitiesTableWrapper`, `EnrollDialog`, toast.
- Obsługiwane interakcje:
  - Zmiana filtrów (daty, tagi, dostępne miejsca) -> refetch.
  - Zmiana strony paginacji -> refetch.
  - Klik „Zapisz” -> otwarcie dialogu.
  - Potwierdzenie zapisu w dialogu -> POST (wykonane w osobnym hooku w dalszym etapie MVP – tu tylko inicjacja procesu).
- Walidacja:
  - Daty: startDate <= endDate; poprawny format ISO (YYYY-MM-DD).
  - Tagi: lista stringów bez pustych po konwersji.
  - hasAvailableSpots: boolean.
  - Granice paginacji: page ≥ 1, limit (1..100).
- Typy: `ActivitiesFilters`, `ActivitiesPagination`, `ActivityDTO`, `ActivityViewModel`, `ActivitiesResponseDTO`, `LoadState`.
- Propsy: (prawdopodobnie brak – stan lokalny widoku). Jeśli włączona integracja SSR, można przekazać `initialData?: ActivitiesResponseDTO`.

### ActivitiesToolbar
- Opis: Panel sterujący filtrami i resetem.
- Elementy: `<form>` lub `<div role="search">`, pola daty, input tagów, checkbox „Tylko z miejscami”, przycisk „Resetuj”.
- Interakcje:
  - onChange pól filtrów -> aktualizacja stanu.
  - onClick reset -> wyczyszczenie stanu filtrów.
- Walidacja: natychmiastowa: format dat (opcjonalnie HTML5 date input), tagi split po przecinkach trim.
- Typy: `ActivitiesFilters`.
- Propsy:
  - `filters: ActivitiesFilters`
  - `onFiltersChange: (partial: Partial<ActivitiesFilters>) => void`
  - `onReset: () => void`

### DateRangeFilter
- Opis: Dwa pola daty lub pojedynczy komponent z wyborem zakresu; uproszczenie: dwa niezależne `<input type="date">`.
- Elementy: label + input start, label + input end.
- Interakcje: onChange start/end -> walidacja wzajemna.
- Walidacja: jeśli end < start -> błąd lokalny + blokada wysłania (opóźnienie refetch do czasu poprawy).
- Typy: wykorzystuje część `ActivitiesFilters`.
- Propsy: `startDate`, `endDate`, `onChange`.

### TagsFilter
- Opis: Pole tekstowe umożliwiające wpisanie listy tagów (podpowiedzi w późniejszych iteracjach). Tag badges generowane inline po rozdzieleniu.
- Elementy: input text + kontener z generowanymi Badge.
- Interakcje: onBlur/onChange -> aktualizacja `tags`.
- Walidacja: usunięcie pustych, normalizacja do lowercase.
- Typy: string[].
- Propsy: `tags: string[]`, `onChange: (tags: string[]) => void`.

### AvailableSpotsToggle
- Opis: Checkbox/switch filtrujący tylko zajęcia z wolnymi miejscami.
- Elementy: input type=checkbox.
- Interakcje: onChange -> `hasAvailableSpots`.
- Walidacja: brak (boolean).
- Typy: boolean.
- Propsy: `value: boolean`, `onChange: (value: boolean) => void`.

### ResetFiltersButton
- Opis: Przywraca domyślne filtry.
- Elementy: `<button type="button">`.
- Interakcje: onClick -> `onReset`.
- Walidacja: n/d.
- Typy: n/d.
- Propsy: `onReset: () => void`.

### ActivitiesTableWrapper
- Opis: Decyduje o renderowaniu skeletonu, pustego stanu lub tabeli.
- Elementy: warunkowe: `LoadingSkeleton | EmptyState | ActivitiesTable`.
- Interakcje: brak własnych (delegowane z dzieci).
- Walidacja: n/d.
- Typy: `loadState: LoadState`, `activities: ActivityViewModel[]`.
- Propsy: `activities`, `loading`, `empty`, `pagination`, `onPageChange`.

### ActivitiesTable
- Opis: Semantyczna tabela z nagłówkami i wierszami zajęć.
- Elementy: `<table role="table">`, `<thead>`, `<tbody>`, `<tr>`, `<td>`, `<th>`.
- Interakcje: wewnątrz w wierszu – klik „Zapisz”.
- Walidacja: n/d (pre-walidowane dane).
- Typy: `ActivityViewModel[]`.
- Propsy: `activities: ActivityViewModel[]`, `onEnrollClick: (activity: ActivityViewModel) => void`.

### ActivityRow
- Opis: Wiersz prezentujący pojedynczą aktywność.
- Elementy: komórki: nazwa, opis (truncate + tooltip / pełny tekst), opiekun, data/godzina (w lokalnej strefie), koszt, wolne miejsca, tagi (Badges), akcja.
- Interakcje: klik „Zapisz” -> if !isFull.
- Walidacja: przycisk disabled gdy `isFull`.
- Typy: `ActivityViewModel`.
- Propsy: `activity`, `onEnroll: (id: number) => void`.

### TagsBadges
- Opis: Lista tagów jako `Badge` (komponent z Shadcn/ui).
- Elementy: `<div role="list">` + wiele `<span>` / `<Badge>`.
- Interakcje: brak.
- Walidacja: n/d.
- Typy: `string[]`.
- Propsy: `tags: string[]`.

### EnrollActionCell / EnrollButton
- Opis: Komórka tabeli pokazująca stan zapisu. Tekst/tooltip gdy brak miejsc.
- Elementy: `<button>` (variant primary), disabled jeśli `isFull`.
- Interakcje: onClick otwiera dialog.
- Walidacja: disabled gdy `available_spots === 0`.
- Typy: boolean (isFull).
- Propsy: `disabled: boolean`, `onClick: () => void`.

### PaginationControls
- Opis: Nawigacja po stronach – numery lub poprzednia/następna.
- Elementy: `<nav aria-label="Paginacja">`, przyciski.
- Interakcje: onClick zmienia page.
- Walidacja: blokada przycisku poprzedniej gdy page=1, blokada następnej gdy `page * limit >= total`.
- Typy: `ActivitiesPagination`.
- Propsy: `page`, `limit`, `total`, `onPageChange`.

### EmptyState
- Opis: Informacja „Brak dostępnych zajęć”.
- Elementy: `<div role="status">` + tekst.
- Interakcje: brak.
- Walidacja: n/d.
- Typy: n/d.
- Propsy: opcjonalnie `message?: string`.

### LoadingSkeleton
- Opis: Placeholder w trakcie pobierania.
- Elementy: zestaw prostokątów (Tailwind + animate-pulse).
- Interakcje: brak.
- Typy: n/d.
- Propsy: n/d.

### EnrollDialog
- Opis: Modal do wyboru dziecka przed finalizacją zapisu (w tej iteracji może tylko emitować zdarzenie; rzeczywiste POST /api/enrollments w innym widoku lub rozszerzeniu).
- Elementy: `<Dialog>` (Shadcn), lista dzieci (radio group), przyciski.
- Interakcje: wybór dziecka, potwierdzenie -> wywołanie callback.
- Walidacja: wymagany wybór dziecka przed aktywacją przycisku „Zapisz”.
- Typy: `ChildSummary` (z istniejącego API dzieci – przyszła integracja), lokalnie tymczasowo placeholder.
- Propsy: `open`, `onOpenChange`, `activity: ActivityViewModel | null`, `children: ChildSummary[]`, `onConfirm: (childId: number, activityId: number) => void`.

### ChildSelectionList
- Opis: Lista dzieci do wyboru.
- Elementy: `<ul>` + `<li>` z radio input.
- Interakcje: onChange -> setSelected.
- Walidacja: musi być wybrane jedno dziecko.
- Typy: `ChildSummary[]`.
- Propsy: `children`, `selectedChildId`, `onSelect`.

## 5. Typy
```ts
interface ActivityDTO {
  id: number;
  name: string;
  description: string;
  cost: number; // wartości w jednostce walutowej bez formatowania
  participant_limit: number;
  available_spots: number; // obliczane przez backend
  start_datetime: string; // ISO UTC
  worker: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  tags: string[];
  created_at: string; // ISO
}

interface ActivitiesResponseDTO {
  activities: ActivityDTO[];
  pagination: { page: number; limit: number; total: number };
}

interface ActivityViewModel {
  id: number;
  name: string;
  description: string;
  costFormatted: string; // np. '45,00 zł'
  participantLimit: number;
  availableSpots: number;
  isFull: boolean; // availableSpots === 0
  startDateLocal: string; // YYYY-MM-DD lokalnie
  startTimeLocal: string; // HH:mm lokalnie
  workerName: string; // 'Jane Doe'
  workerEmail: string;
  tags: string[];
  startISO: string; // oryginał
}

interface ActivitiesFilters {
  hasAvailableSpots?: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  tags?: string[];    // normalizowane do lowercase
}

interface ActivitiesPagination {
  page: number;
  limit: number;
  total: number;
}

type LoadState = 'idle' | 'loading' | 'error' | 'success';

interface ActivitiesListState {
  filters: ActivitiesFilters;
  pagination: ActivitiesPagination;
  data: ActivityViewModel[];
  loadState: LoadState;
  error?: string;
  enrollDialog: { open: boolean; activityId?: number };
}

interface ChildSummary {
  id: number;
  first_name: string;
  last_name: string;
}
```

## 6. Zarządzanie stanem
- Lokalny stan w komponencie `ActivitiesListPage` + dedykowany hook `useActivitiesList`.
- `useActivitiesList` odpowiedzialny za:
  - Utrzymanie `filters`, `pagination`, `loadState`, `data`, `error`.
  - Funkcje: `setFilters(partial)`, `goToPage(page)`, `refetch()`, `openEnrollDialog(activityId)`, `closeEnrollDialog()`.
  - Efekt: refetch przy zmianie filtrów lub paginacji (debounce 150ms dla tagów i dat aby uniknąć nadmiernych wywołań).
- Drugi hook `useEnrollDialog` (opcjonalnie) do zarządzania modalem i wyborem dziecka.
- Wydzielone transformacje: `mapDtoToVm(dto: ActivityDTO): ActivityViewModel`.
- Brak potrzeby globalnego store (Zustand) – stan związany z pojedynczym widokiem.

## 7. Integracja API
- Endpoint: `GET /api/activities`.
- Budowa URL z query parametrami zgodnie z `filters` i `pagination`:
  - `hasAvailableSpots` => `?hasAvailableSpots=true` jeśli true.
  - `startDate`, `endDate` -> `startDate`, `endDate`.
  - `tags` -> jeśli lista niepusta: `tags=tag1,tag2`.
  - `page`, `limit` zawsze (limit domyślnie 20).
- Fetch (fetch API) z obsługą błędów HTTP (status != 200 -> JSON błędu -> mapowanie na `error` w stanie + toast).
- Transformacja odpowiedzi: każda `ActivityDTO` -> `ActivityViewModel`.
- Lokalna konwersja czasu: `new Date(dto.start_datetime)` -> formatowanie daty i godziny w strefie użytkownika (`Intl.DateTimeFormat`).
- W przypadku pustej listy: `data.length === 0` -> `EmptyState`.

## 8. Interakcje użytkownika
1. Zmiana daty start/end -> aktualizacja filtrów -> refetch.
2. Wpisanie tagów -> normalizacja -> refetch (po debounce).
3. Zaznaczenie „Tylko z miejscami” -> filtr -> refetch.
4. Klik „Resetuj” -> domyślne filtry (wszystkie undefined) -> refetch.
5. Klik „Następna/Poprzednia strona” -> zmiana `page` -> refetch.
6. Klik „Zapisz” w pełnej aktywności (isFull) – brak akcji (disabled + tooltip „Brak miejsc”).
7. Klik „Zapisz” w dostępnej aktywności -> otwarcie dialogu.
8. Wybór dziecka w dialogu -> aktywacja przycisku „Potwierdź”.
9. Potwierdzenie -> (w tej wersji) pokazanie toast „Funkcja zapisu dostępna w kolejnym kroku” lub integracja kiedy endpoint POST będzie gotowy.

## 9. Warunki i walidacja
- Przyciski paginacji: disabled gdy poza zakresem.
- EnrollButton: disabled gdy `isFull`.
- Dialog: przycisk „Zapisz” disabled dopóki `selectedChildId` undefined.
- Daty: jeśli `endDate` < `startDate` -> wizualny komunikat (np. czerwona obwódka) i brak refetch do czasu poprawy.
- Tagi: usunięcie pustych wpisów; limit długości tagu (np. 30 znaków – zapobiega wklejeniu bardzo długich stringów).
- Query param sanitization: zawsze encode URI; brak wysyłania pustych tagów.

## 10. Obsługa błędów
- Błędy sieci (fetch reject) -> `loadState = 'error'`, toast „Nie udało się pobrać listy zajęć. Spróbuj ponownie.” + przycisk retry.
- Błędy walidacji parametrów (400) -> wyświetlenie toast z komunikatem z API; stan danych pozostaje poprzedni lub pusty.
- 401 (utrata sesji) -> redirect do logowania (globalny handler – w tym widoku: toast „Sesja wygasła”).
- Nietypowe dane (np. brak `worker`) – guard: jeśli brak `worker` w DTO -> pominąć render imienia/nazwiska i pokazać „—”.
- Opóźnione ładowanie (>600ms) -> skeleton.
- Pusty wynik -> `EmptyState` zamiast błędu.

## 11. Kroki implementacji
1. Utwórz routing / szablon strony w `dashboard.astro` lub jako osobny plik `app/zajecia/index.astro` wstawiający React komponent `ActivitiesListPage` (client:load lub client:visible).
2. Dodaj folder `src/components/dashboard/activities/` (jeśli nie istnieje) i w nim pliki komponentów: `ActivitiesListPage.tsx`, `ActivitiesToolbar.tsx`, `ActivitiesTable.tsx`, `EnrollDialog.tsx`, `PaginationControls.tsx`, `EmptyState.tsx`, `LoadingSkeleton.tsx`.
3. Zdefiniuj typy w osobnym pliku `src/components/dashboard/activities/types.ts` (DTO można referencjonować z `src/types.ts` jeśli istnieje global, inaczej lokalnie dopóki nie zostanie scalone).
4. Zaimplementuj funkcję fetchującą `fetchActivities(filters, pagination)` w nowym pliku `src/lib/services/activities.fetch.ts` (wykorzystuje istniejący endpoint; użyj wspólnego helpera jeśli dostępny – sprawdź `lib/api/helper.ts`).
5. Napisz mapper `mapDtoToVm` w `activities.fetch.ts` lub osobnym `activities.mapper.ts`.
6. Utwórz hook `useActivitiesList.ts` w `src/components/hooks/parentDashboard/` (spójność z istniejącą strukturą) – zawiera stan, refetch i handlers.
7. Dodaj debounce (np. `useEffect` + `setTimeout`) dla filtrów dat i tagów.
8. Zaimplementuj `ActivitiesToolbar` – wykorzystaj komponenty z Shadcn (Button, Input, Switch). Zapewnij ARIA (`role="search"`).
9. Zaimplementuj `ActivitiesTable` + `ActivityRow`: semantyczna tabela, użyj Tailwind do stylu, truncated opis (CSS `line-clamp`).
10. Dodaj `TagsBadges` – mapowanie tagów na `<Badge variant="secondary">`.
11. Dodaj `PaginationControls` – poprzednia/następna + informacja „Strona X z Y”.
12. Dodaj `EmptyState` i `LoadingSkeleton` (Tailwind `animate-pulse`).
13. Dodaj `EnrollDialog` z logiką wyboru dziecka (tymczasowo pobierz listę dzieci z istniejącego hooka `useChildren` jeśli dostępny). Jeśli brak – placeholder `Nie masz jeszcze dzieci` i disabled.
14. Integruj toast (istniejący `useToastFeedback` / `toast` z `ui/toast.tsx`). Wywołuj w błędach oraz sukcesie (na razie pseudo-sukces zapisu).
17. Review dostępności: nagłówki tabeli (`<th scope="col">`), aria-disabled przycisku „Zapisz” jeśli pełne.
18. Optymalizacje: `React.memo` dla `ActivityRow` (props proste), `useCallback` dla event handlerów.


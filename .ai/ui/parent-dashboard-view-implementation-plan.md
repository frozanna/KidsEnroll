# Plan implementacji widoku Dashboard Rodzica (Parent Dashboard)

## 1. Przegląd
Widok "Dashboard Rodzica" pod ścieżką `/app/dashboard` jest centralnym miejscem panelu rodzica. Prezentuje listę jego dzieci (akordeon), wraz z aktualnymi zapisami (enrollments) każdego dziecka, pozwala wygenerować tygodniowy raport kosztów oraz dodać kolejne dziecko. Zapisy dziecka są ładowane leniwie przy rozwinięciu sekcji dziecka. Widok uwzględnia stan onboardingu (brak dzieci) oraz ograniczenia akcji (np. wypisanie tylko gdy `can_withdraw = true`).

## 2. Routing widoku
- Ścieżka: `/app/dashboard`
- Ochrona dostępu: wymagana autentykacja i rola `parent` (zabezpieczenie poprzez middleware / guard globalny lub lokalny wrapper). Jeśli użytkownik nie dodał żadnego dziecka – wyświetlany jest stan onboardingu (zachęta do dodania pierwszego dziecka).

## 3. Struktura komponentów
```
ParentDashboardPage
 ├─ HeaderBar (wspólny layout)
 ├─ ActionsBar
 │   ├─ ReportButton
 │   └─ AddChildButton
 ├─ ChildrenAccordion
 │   ├─ ChildPanel (repeat per child)
 │   │   ├─ ChildSummaryHeader
 │   │   ├─ EnrollmentList (lazy loaded)
 │   │   │   ├─ EnrollmentItem (repeat per enrollment)
 │   │   │   └─ EmptyEnrollmentsState
 ├─ EmptyChildrenState (gdy brak dzieci)
 └─ ToastManager (global toasty)
```

## 4. Szczegóły komponentów
### ParentDashboardPage
- Opis: Główny kontener widoku; inicjuje pobranie listy dzieci, zarządza globalnymi stanami ładowania, błędów, raportu.
- Elementy: wrapper `<main>`, pasek akcji, akordeon dzieci, placeholdery, toasty.
- Interakcje: inicjalne pobranie dzieci (on mount), generowanie raportu, dodanie dziecka (przekierowanie/otwarcie formularza), rozwijanie dziecka.
- Walidacja: sprawdza czy lista dzieci pusta → pokazuje `EmptyChildrenState` i blokuje część akcji.
- Typy: `ChildDTO[]`, `ChildrenListResponseDTO`, `EnrollmentListItemDTO`, `WeeklyCostReportDTO`, własne view modele.
- Propsy: w kontekście strony najczęściej brak (renderowana przez router). Może przyjąć z layoutu np. `profile` jeśli dostępne.

### ActionsBar
- Opis: Pasek z akcjami globalnymi (generowanie raportu, dodanie dziecka). Ukazuje się gdy ≥ 1 dziecko.
- Elementy: `<div>` flex; przyciski `ReportButton`, `AddChildButton`.
- Interakcje: kliknięcia w oba przyciski.
- Walidacja: `ReportButton` wymaga co najmniej jednego dziecka i co najmniej jednego enrollmentu (warunek miękki – jeśli brak zapisów, może pokazać toast "Brak danych do raportu").
- Typy: używa flag z ParentDashboard (np. `hasEnrollments`).
- Propsy: `{ onGenerateReport: () => void; onAddChild: () => void; disabledReport?: boolean }`.

### ReportButton
- Opis: Uruchamia proces generowania raportu kosztów tygodnia; może wyświetlać spinner w stanie `loadingReport`.
- Elementy: `<Button>`, spinner (shadcn/ui) przy stanie ładowania.
- Interakcje: `onClick` → wywołanie hooka raportu.
- Walidacja: disabled gdy brak dzieci / brak danych / raport w trakcie generowania.
- Typy: korzysta z `WeeklyCostReportDTO` po sukcesie do pobrania pliku.
- Propsy: `{ loading: boolean; disabled: boolean; onGenerate: () => void }`.

### AddChildButton
- Opis: Nawiguje do formularza dodania dziecka lub otwiera modal.
- Elementy: `<Button>`.
- Interakcje: `onClick` → nawigacja.
- Walidacja: zawsze dostępny (nie ma limitu dzieci).
- Typy: brak dodatkowych.
- Propsy: `{ onAdd: () => void }`.

### ChildrenAccordion
- Opis: Lista dzieci jako akordeon; każdy panel reprezentuje jedno dziecko. Rozwinięcie panelu inicjuje leniwe pobranie enrollments.
- Elementy: Kontener akordeonu (np. własny + ARIA: `role="region"`, `aria-expanded`), lista `ChildPanel`.
- Interakcje: Expand/Collapse child.
- Walidacja: brak specjalnej poza dostępnością ARIA (zapewnienie `aria-controls`, unikalnych `id`).
- Typy: przyjmuje `ChildViewModel[]`.
- Propsy: `{ childrenData: ChildViewModel[]; onExpand: (childId: number) => void; expandedIds: number[]; loadingChildIds: number[] }`.

### ChildPanel
- Opis: Pojedynczy panel akordeonu reprezentujący dziecko; zawiera nagłówek i sekcję z enrollments.
- Elementy: `<section>` z nagłówkiem `<button>` (toggle), wnętrze z `EnrollmentList` po rozwinięciu.
- Interakcje: klik nagłówka → toggle.
- Walidacja: w środku `EnrollmentList` weryfikuje warunki wypisania.
- Typy: `ChildViewModel`.
- Propsy: `{ child: ChildViewModel; isExpanded: boolean; loading: boolean; enrollments: EnrollmentViewModel[]; onToggle: () => void }`.

### EnrollmentList
- Opis: Lista zapisów dziecka; renderuje `EnrollmentItem` dla każdego albo pusty stan.
- Elementy: `<ul>` / `<div>` listy, `EnrollmentItem`, `EmptyEnrollmentsState`.
- Interakcje: w obrębie itemów (wypisanie z zajęć – w przyszłości; w tym widoku tylko wyświetlanie).
- Walidacja: brak wypisywania tutaj
- Typy: `EnrollmentListItemDTO` → mapowane do `EnrollmentViewModel`.
- Propsy: `{ enrollments: EnrollmentViewModel[]; loading: boolean }`.

### EnrollmentItem
- Opis: Pojedynczy zapis na zajęcia zawierający szczegóły aktywności + status wypisania.
- Elementy: `<li>`: nazwa zajęć, worker (imię/nazwisko), data/godzina (przekonwertowana z UTC), koszt, przycisk "Wypisz" (disabled jeśli `!can_withdraw`).
- Interakcje: `onWithdraw` (jeśli w scope sprintu; jeśli nie – placeholder disabled/hidden).
- Walidacja: `can_withdraw` steruje dostępnością przycisku.
- Typy: `EnrollmentViewModel`.
- Propsy: `{ enrollment: EnrollmentViewModel; onWithdraw?: (id: { childId: number; activityId: number }) => void }`.

### EmptyChildrenState
- Opis: Komunikat onboardingowy gdy brak dzieci; duży CTA "Dodaj dziecko".
- Elementy: `<div>` z tekstem i `AddChildButton`.
- Interakcje: `onAddChild`.
- Walidacja: Wyświetlany gdy `children.length === 0`.
- Typy: brak nowych.
- Propsy: `{ onAddChild: () => void }`.

### EmptyEnrollmentsState
- Opis: Komunikat, że dziecko nie ma zapisów.
- Elementy: `<div>` z tekstem / ikoną.
- Interakcje: brak.
- Walidacja: `enrollments.length === 0`.
- Typy: brak.
- Propsy: brak.

### LoadingSpinner
- Opis: Wskazuje stan ładowania przy pobieraniu enrollments lub całej listy dzieci.
- Propsy: `{ size?: 'sm'|'md'|'lg'; message?: string }`.

### ToastManager
- Opis: Zarządza komunikatami (błąd, info, sukces). Integracja z shadcn/ui (np. `useToast`).
- Propsy: globalny context / hook.

## 5. Typy
### Istniejące DTO (z `types.ts`)
- `ChildDTO`: używany do podstawowych danych dziecka.
- `ChildrenListResponseDTO`: wrapper z listą dzieci.
- `EnrollmentListItemDTO`: pełny zapis w kontekście dziecka.
- `ChildEnrollmentsListResponseDTO`: lista zapisów.

### Nowe ViewModel typy (frontend specyficzne)
```ts
interface ChildViewModel {
  id: number;
  fullName: string;            // first_name + last_name
  age: string;                 // wyliczone z birth_date (np. "5 lat")
  description?: string | null; // z DTO
}

interface EnrollmentViewModel {
  childId: number;
  activityId: number;
  activityName: string;
  workerFullName: string;
  startLocalDate: string;      // sformatowana lokalna data (YYYY-MM-DD)
  startLocalTime: string;      // sformatowany lokalny czas (HH:mm)
  cost: number;
  canWithdraw: boolean;
  description?: string;        // aktywności
}

interface DashboardState {
  children: ChildViewModel[];
  expandedChildIds: number[];
  enrollmentsByChild: Record<number, EnrollmentViewModel[]>; // leniwe wypełnianie
  loadingChildren: boolean;
  loadingChildEnrollments: number[]; // id aktualnie pobierane
  errorChildren?: string;
  errorEnrollments?: Record<number, string>;
  loadingReport: boolean;
  reportError?: string;
}
```

## 6. Zarządzanie stanem
- Lokalny stan w komponencie `ParentDashboardPage` (hook `useParentDashboard`):
  - Pobieranie dzieci (effect on mount).
  - Rozwijanie/zwijanie paneli → aktualizacja `expandedChildIds`.
  - Leniwe pobieranie enrollments: przy rozwinięciu jeśli brak w `enrollmentsByChild`.
  - Generowanie raportu (przyszłe API – placeholder stan `loadingReport`).
- Niestandardowe hooki:
  - `useChildren()` – odpowiedzialny za pobranie listy dzieci i transformację do `ChildViewModel[]`.
  - `useChildEnrollmentsLazy(childId)` – pobiera zapisy dla konkretnego dziecka, zarządza listą aktywnych żądań.
  - `useToastFeedback()` – wrapper nad shadcn/ui toast dla standaryzacji komunikatów.
- Mechanizmy wydajności: Memoizacja mapowania DTO → ViewModel (`useMemo`) oraz callbacków (`useCallback`).

## 7. Integracja API
### Wywołania
1. `GET /api/children` → Po mount. Oczekiwany typ odpowiedzi: `ChildrenListResponseDTO`.
2. `GET /api/children/:childId/enrollments` → Przy pierwszym rozwinięciu panelu dziecka. Odpowiedź: `ChildEnrollmentsListResponseDTO`.
- Autoryzacja: token / sesja zapewniona przez warstwę globalną (middleware). Błędy 401/403 obsłużone komunikatem toast.
- Mapowanie pól: daty UTC `start_datetime` → lokalna strefa (Intl.DateTimeFormat); `worker.first_name/last_name` → `workerFullName`.

## 8. Interakcje użytkownika
- Otwarcie strony: automatyczny fetch dzieci.
- Rozwinięcie panelu dziecka: pobranie jego zapisów (jeśli nie pobrano wcześniej). Spinner w panelu w trakcie żądania.
- Kliknięcie "Dodaj dziecko": nawigacja do formularza dodania (`/app/children/new`).
- Kliknięcie "Generuj raport kosztów": uruchomienie procedury raportu (backend: GET `/report/costs`)
- Klik "Wypisz" przy `EnrollmentItem`: warunek `canWithdraw` → sukces toast, aktualizacja listy; w przeciwnym wypadku przycisk disabled z tooltipem.

## 9. Warunki i walidacja
- Onboarding: `children.length === 0` → pokazuje `EmptyChildrenState`; brak akordeonu i raportu.
- Leniwe ładowanie: przed pobraniem enrollments panel pokazuje spinner; po sukcesie lista.
- Wypisanie: przycisk aktywny tylko gdy `enrollment.can_withdraw === true`.
- Raport: disabled jeśli `loadingReport === true` lub brak dzieci; dodatkowo można sprawdzić czy istnieje przynajmniej jeden enrollment globalnie.
- ARIA: Akordeon – atrybuty `aria-expanded`, `aria-controls`, unikalne `id` sekcji.

## 10. Obsługa błędów
- `GET /api/children`:
  - 401/403 → toast "Brak uprawnień".
  - Inne (5xx/network) → toast "Nie udało się pobrać listy dzieci" + przycisk retry w `EmptyChildrenState`.
- `GET /api/children/:id/enrollments`:
  - 404 → toast "Dziecko nie znalezione".
  - 403 → toast "To dziecko nie należy do Twojego konta".
  - Inne → toast z możliwością ponownego rozwinięcia (retry).
- Raport: jeśli error → toast "Nie udało się wygenerować raportu".
- Fallback: globalny handler dla nieoczekiwanych błędów (normalizeUnknown → komunikat przyjazny użytkownikowi).

## 11. Kroki implementacji
1. Utwórz plik strony `src/pages/app/dashboard.astro` (lub `.tsx` jeśli bardziej interaktywny) – osadź komponent React `ParentDashboardPage`.
2. Dodaj komponent `ParentDashboardPage.tsx` w `src/components/dashboard/` wraz z hookiem `useParentDashboard.ts`.
3. Zaimplementuj hook `useChildren` (fetch / transform DTO → ViewModel + stan ładowania i błędów).
4. Zaimplementuj hook `useChildEnrollmentsLazy` (metoda pobrania przy zapotrzebowaniu, cashowanie w `enrollmentsByChild`).
5. Zdefiniuj typy ViewModel w `src/components/dashboard/types.ts` (lub wspólny plik `src/types.dashboard.ts`).
6. Utwórz komponenty strukturalne: `ChildrenAccordion.tsx`, `ChildPanel.tsx`, `EnrollmentList.tsx`, `EnrollmentItem.tsx`, `EmptyChildrenState.tsx`, `EmptyEnrollmentsState.tsx`, `ActionsBar.tsx`, `ReportButton.tsx`, `AddChildButton.tsx`.
7. Dodaj dostępnościowe atrybuty ARIA w akordeonie (`aria-expanded`, `aria-controls`, `id`).
8. Zaimplementuj transformację dat UTC → lokalna (helper `formatUtcToLocal(dateString)` w `src/lib/utils.ts`).
9. Podłącz toasty (np. `useToast` z shadcn/ui) w `ParentDashboardPage` – ustandaryzuj helper `useToastFeedback`.
10. Obsłuż stany ładowania: spinner globalny dla dzieci, spinner per panel dla enrollments.
11. Dodaj warunki wyświetlenia `EmptyChildrenState` gdy brak dzieci.
12. Dodaj leniwe pobieranie enrollments przy rozwinięciu: w `onExpand(childId)` wywołaj hook jeśli brak danych.
13. Implementuj przycisk wypisania jeśli endpoint istnieje – kontrola disabled przez `canWithdraw`.
14. Implementuj `ReportButton` z placeholderem (jeśli raport endpoint jeszcze nie istnieje – toast informacyjny).
15. Przeprowadź manualne testy interakcji (rozwinie/zwinięcie, błędy sieci – sztuczne odcięcie, brak dzieci, brak enrollments).
16. Dodaj podstawowe testy jednostkowe hooków (transformacje dat, mapowania DTO → ViewModel).
17. Lint + typowanie (ESLint / TypeScript) – popraw ewentualne ostrzeżenia.
18. Finalna weryfikacja a11y (tab focus, aria atrybuty) + przegląd kodu pod kątem wczesnych zwrotów i guard clauses.
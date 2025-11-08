# Plan implementacji widoku Dialog zapisu na zajęcia

## 1. Przegląd
Dialog (modal) służący do zapisania wybranego dziecka rodzica na konkretne zajęcia. Udostępnia: wybór dziecka (radio), prezentację kluczowych informacji o zajęciach (nazwa, termin, koszt, dostępne miejsca jeśli potrzebne), przycisk potwierdzenia wywołujący żądanie `POST /api/enrollments`. Zapewnia pełną dostępność (focus trap, obsługa klawiatury, zamykanie ESC, role="dialog"), informuje użytkownika o stanie (ładowanie, sukces, błąd) poprzez interfejs (disabled, alert, toast). Implementowany w React z użyciem komponentów UI (docelowo shadcn/ui Dialog + RadioGroup, tymczasowo można rozpocząć od własnej implementacji – plan zakłada docelowy refaktor do shadcn po instalacji paczek).

## 2. Routing widoku
Brak dedykowanej trasy (modal osadzany wewnątrz strony listy zajęć lub dashboardu rodzica). Kontrola widoczności poprzez stan w komponencie rodzica (np. `ActivitiesListPage` lub `ParentDashboardPage`).

## 3. Struktura komponentów
```
ParentDashboardPage / ActivitiesListPage
  └─ EnrollDialog (modal)
       ├─ ActivitySummary (sekcja podsumowania zajęć) [opcjonalnie wydzielony]
       ├─ ChildrenSelect (lista dzieci – RadioGroup)
       ├─ ErrorAlert (komunikat błędu) [warunkowo]
       └─ ActionsBar (Anuluj / Zapisz)
```
Możliwe, że część (ActivitySummary, ChildrenSelect, ErrorAlert) pozostanie jako funkcje pomocnicze w pliku dopóki nie pojawi się potrzeba reużywalności.

## 4. Szczegóły komponentów
### EnrollDialog
- Opis: Kontener okna dialogowego z logiką wyboru dziecka i zapisania na zajęcia. Zarządza stanem lokalnym (wybrane dziecko, loading, error). Wywołuje `onConfirm` przekazany z rodzica lub wewnętrznie wykonuje fetch – rekomendowane: wewnątrz komponentu, aby hermetyzować logikę.
- Główne elementy: 
  - Overlay (`div` z półprzezroczystym tłem)
  - Dialog panel (`div` z rolą `dialog` + atrybuty aria)
  - Nagłówek (tytuł: „Zapis na zajęcia”)
  - Opis (nazwa aktywności + termin + koszt)
  - Lista dzieci (RadioGroup / lista input type=radio)
  - Sekcja błędu (alert)
  - Przyciski: Anuluj (zamknięcie), Zapisz (submit)
- Obsługiwane interakcje:
  - Zmiana wyboru dziecka (onChange radio)
  - Klik „Zapisz” → walidacja → wywołanie API → obsługa odpowiedzi
  - Klik „Anuluj” / klik w overlay (opcjonalnie) / ESC → zamknięcie
  - Klawisz Tab / Shift+Tab – cykl w focus trapie
- Obsługiwana walidacja (frontend):
  - Czy wybrano dziecko (wymagane do aktywacji przycisku „Zapisz”)
  - Czy dialog ma prawidłowy obiekt `activity` (jeśli nie – nie renderować)
  - Blokada przycisku podczas `isSubmitting`
- Walidacja po stronie API (wymieniona dla mapowania błędów): pełne miejsca, już zapisane dziecko, brak autoryzacji, brak zasobu, brak uprawnień → mapowane do komunikatów user-friendly.
- Typy: `ActivityViewModel`, `ChildSummary`, `EnrollmentRequestPayload`, `CreateEnrollmentResponseDTO`, `EnrollmentErrorKind` (własny union), `EnrollDialogProps`.
- Propsy (interfejs):
  - `open: boolean`
  - `activity: ActivityViewModel | null`
  - `childrenList: ChildSummary[]`
  - `onClose: () => void`
  - (Opcja A) `onSuccess?: (result: CreateEnrollmentResponseDTO) => void` (po sukcesie, do odświeżenia listy)
  - (Opcja B) `onConfirm?: (childId: number, activityId: number) => Promise<void>` (jeśli logika w rodzicu)
  (Zalecenie: wybrać spójny model – preferowany onSuccess + lokalne fetch w dialogu.)

### ActivitySummary (opcjonalny)
- Opis: Prezentuje nazwę, termin, koszt, ewentualnie dostępne miejsca. Formatowanie daty w lokalnej strefie czasowej.
- Elementy: nagłówki, paragrafy.
- Interakcje: brak (statyczne).
- Walidacja: brak – zakładamy poprawność `activity`.
- Propsy: `activity: ActivityViewModel`.

### ChildrenSelect (opcjonalny)
- Opis: Lista wyboru dziecka (radio). Zwraca ID zaznaczonego dziecka.
- Elementy: `ul` / `div` + elementy z input type=radio
- Interakcje: onChange -> `setSelectedChildId`.
- Walidacja: sprawdzenie czy lista pusta → komunikat.
- Propsy: `childrenList: ChildSummary[]`, `selectedId?: number`, `onChange: (id: number) => void`.

### ErrorAlert (opcjonalny)
- Opis: Prezentuje sparametryzowany komunikat błędu wynikający z API lub walidacji.
- Elementy: `div` o roli `alert` / komponent z shadcn (Alert) w przyszłości.
- Propsy: `message: string`.

### ActionsBar (opcjonalny)
- Opis: Kontener przycisków sterujących.
- Elementy: Button outline (Anuluj), Button primary (Zapisz).
- Propsy: `onCancel: () => void`, `onSubmit: () => void`, `disabled: boolean`, `submitting: boolean`.

## 5. Typy
Nowe / pochodne typy (ViewModel) względem `src/types.ts`:
- `ChildSummary`: Minimalne dane dziecka do listy wyboru.
```ts
interface ChildSummary {
  id: number;
  first_name: string;
  last_name: string;
}
```
- `ActivityViewModel`: Dane potrzebne w dialogu (podzbiór `ActivityListItemDTO` / `ActivityDTO`).
```ts
interface ActivityViewModel {
  id: number;
  name: string;
  start_datetime: string; // ISO UTC
  cost: number;
  participant_limit?: number; // opcjonalnie jeśli potrzebne
  available_spots?: number;   // jeśli dostarczane upstream
}
```
- `EnrollmentRequestPayload` (lokalne):
```ts
interface EnrollmentRequestPayload { child_id: number; activity_id: number; }
```
(Używa istniejącego kontraktu API – zgodne z body endpointu.)
- Użycie istniejącego `CreateEnrollmentResponseDTO` (import).
- `EnrollmentErrorKind` (mapowanie):
```ts
type EnrollmentErrorKind = 'ACTIVITY_FULL' | 'ALREADY_ENROLLED' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'UNKNOWN';
```
- `ApiErrorShape` (opcjonalny adapter jeśli `errorToDto` daje inny format):
```ts
interface ApiErrorShape { code: string; message: string; }
```
- `EnrollDialogState` (lokalne):
```ts
interface EnrollDialogState {
  selectedChildId?: number;
  isSubmitting: boolean;
  error?: ApiErrorShape | null;
  success?: CreateEnrollmentResponseDTO | null;
}
```
- `EnrollDialogProps` – jak w sekcji komponentów.

## 6. Zarządzanie stanem
Stan lokalny w komponencie `EnrollDialog` (hooki React):
- `selectedChildId` – aktualny wybór dziecka.
- `isSubmitting` – flaga wyłączająca interakcje + aria-disabled.
- `error` – ostatni błąd API.
- `success` (opcjonalnie) – wynik do pokazania toast/ przekazania rodzicowi.
Czyszczenie stanu przy: zamknięciu dialogu lub zmianie `activity` (useEffect reset). Custom hook opcjonalny (`useEnrollActivity`) jeśli logika rozrośnie się: przyjmie `activityId` i zwróci { enroll(childId), loading, error }. W MVP można utrzymać prostą strukturę wewnętrzną.

## 7. Integracja API
- Endpoint: `POST /api/enrollments` (JSON, autoryzacja – token w ciasteczkach/sesji – Supabase session cookie; zakładamy brak manualnego dodawania nagłówków jeśli sesja jest po stronie serwera).
- Request body: `{ child_id, activity_id }` (zgodne z `EnrollmentRequestPayload`).
- Sukces 201 → `CreateEnrollmentResponseDTO` (aktualizuje rodzica: odświeżenie listy aktywności i/lub zapisów, zamknięcie dialogu, toast „Zapisano dziecko {child} na {activity}”).
- Błędy: mapowanie kodów / statusów HTTP do przyjaznych komunikatów:
  - 400: `ACTIVITY_FULL` lub `ALREADY_ENROLLED` (heurystyka po `error.code`/`message` – trzeba ustalić kody z backendu; jeśli brak, parsować fragmenty message).
  - 401: `UNAUTHORIZED` → prośba o ponowne logowanie.
  - 403: `FORBIDDEN` → komunikat o braku uprawnień / niezgodności dziecka.
  - 404: `NOT_FOUND` → „Nie znaleziono dziecka lub zajęć.”
  - Inne: `UNKNOWN` → generyczny fallback.

## 8. Interakcje użytkownika
1. Otwarcie dialogu → focus na tytuł lub pierwszym radio (jeśli jest dziecko), fallback na przycisk Anuluj.
2. Wybór dziecka (klik / klawiatura) → aktualizacja `selectedChildId`.
3. Klik „Zapisz” → jeśli brak `selectedChildId`, disabled (brak akcji). Jeśli jest – wywołanie fetch.
4. Oczekiwanie (loading) → przycisk Zapisz disabled, aria-busy na panelu.
5. Sukces → zamknięcie (po krótkim >0ms tick) + toast sukcesu + informowanie rodzica (callback).
6. Błąd → wyświetlenie `ErrorAlert`, focus przeniesiony do alertu (aria-live=assertive / rola=alert).
7. ESC → zamyka dialog (onClose) i reset stanu.
8. Klik tła (opcjonalne) → zamyka jeśli nie w trakcie submit (zabezpieczenie przed utratą akcji – można blokować jeśli loading).

## 9. Warunki i walidacja
- Wymagany wybór dziecka → `selectedChildId !== undefined` dla enable przycisku Zapisz.
- `open && activity` muszą być spełnione do renderu.
- Podczas `isSubmitting` wszystkie elementy wyboru oraz zamykanie przez overlay wyłączone (zapobiega wielokrotnym requestom / przerwaniu).
- Focus trap: wchodzące Tab nie opuszcza modalu; ESC aktywne jeśli nie submitting.
- Walidacja domenowa (pełne miejsca, już zapisany) delegowana do backendu – UI jedynie reaguje i komunikuje.
- Sanitizacja: brak manualnych inputów tekstowych – niskie ryzyko XSS (nazwy z backendu powinny być escapowane przez React). Ewentualnie upewnić się, że nazwy nie są interpretowane jako HTML.

## 10. Obsługa błędów
Scenariusze i reakcje:
- Activity full (400) → Komunikat: „Brak wolnych miejsc na te zajęcia.”
- Already enrolled (400) → „To dziecko jest już zapisane na te zajęcia.”
- Unauthorized (401) → „Sesja wygasła. Zaloguj się ponownie.” + opcjonalny redirect/log out flow.
- Forbidden (403) → „Nie możesz zapisać tego dziecka na te zajęcia.”
- Not found (404) → „Nie znaleziono zasobu (dziecko lub zajęcia mogły zostać usunięte).”
- Network / inne (>=500) → „Wystąpił nieoczekiwany błąd. Spróbuj ponownie.”
Mechanika: ustawienie `error` + rola alert + przywrócenie focusu do alertu. Po zamknięciu dialogu – reset stanu. Opcjonalnie retry automatyczny wyłączony (manualny user action).

## 11. Kroki implementacji
1. Utworzyć / zaktualizować typy: `ChildSummary`, `ActivityViewModel`, `EnrollmentRequestPayload`, `EnrollmentErrorKind` w nowym pliku np. `src/components/dashboard/activities/types.ts` (jeśli nie istnieją – sprawdzić istniejący plik typu; rozszerzyć zamiast duplikować).
2. Dodać komponent `EnrollDialog.tsx` (jeśli już istnieje – rozbudować): 
   - Przyjąć nowe propsy `onSuccess`.
   - Wprowadzić stan: `selectedChildId`, `isSubmitting`, `error`.
3. Zaimplementować focus trap (prosta implementacja lub hook – docelowo zastąpić gotowym Dialogiem shadcn/ui).
4. Dodać obsługę ESC (event listener na `keydown` podczas open).
5. Dodać mapowanie błędów: funkcja `mapEnrollmentError(response: Response, json: any): ApiErrorShape`.
6. Zaimplementować funkcję `submitEnrollment` (fetch POST `/api/enrollments`).
7. UI: 
   - Overlay + panel z atrybutami ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`).
   - Lista dzieci (radio) – disabled gdy submitting.
   - Przycisk „Zapisz” – disabled gdy brak wyboru lub submitting.
   - Sekcja błędu warunkowa – rola alert.
8. Dodać toast sukcesu (wykorzystać istniejący `useToastFeedback` lub `toast` hook).
9. W rodzicu (np. ActivitiesListPage) dodać callback `handleEnrollmentSuccess` odświeżający listę aktywności/enrollmentów (np. refetch lub optimistic update: zmniejszenie `available_spots`).
10. Upewnić się, że zamknięcie dialogu resetuje stan (useEffect watch `open`).
11. Testy manualne A11y: Tab order, ESC, SR (nagłówki, role, alert), brak focus escape.
12. (Opcjonalne) Napisać testy jednostkowe (React Testing Library): 
    - Render przy `open=false` → nic.
    - Wybór dziecka aktywuje przycisk.
    - Symulacja sukcesu → onSuccess wywołany.
    - Symulacja błędu 400 full → pokazuje komunikat.
13. Dokumentacja krótkiego użycia w README sekcji developerskiej / komentarz w pliku.
14. (Po instalacji shadcn Dialog) Refaktor: podmienić strukturę na `<Dialog>` + `<DialogContent>` itd.

---
Plan gotowy do implementacji; uwzględnia prostą ścieżkę MVP oraz możliwość późniejszego refaktoru do komponentów shadcn/ui bez zmiany kontraktów zewnętrznych.
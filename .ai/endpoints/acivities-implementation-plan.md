# API Endpoint Implementation Plan: GET /api/activities

## 1. Przegląd punktu końcowego
Endpoint udostępnia listę dostępnych zajęć (activities) dla zalogowanego użytkownika o roli `parent`, wzbogaconą o:
- Informacje o prowadzącym (worker subset)
- Agregowane tagi zajęć
- Dynamiczną liczbę wolnych miejsc (`available_spots = participant_limit - current_enrollments`)
- Paginację z możliwością filtrowania po dostępności miejsc, zakresie dat oraz tagach.
Zwraca zawsze 200 z listą (również pustą); błędy walidacji lub autoryzacji zwracają kody zgodne z polityką API.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- URL: `/api/activities`
- Autoryzacja: Wymagane uwierzytelnienie + rola `parent` (profil w `profiles.role`).
- Parametry zapytania (wszystkie opcjonalne):
  - `hasAvailableSpots` (boolean): jeśli `true`, filtruje tylko zajęcia z `available_spots > 0`.
  - `startDate` (ISO YYYY-MM-DD): zajęcia rozpoczynające się w dniu lub po tej dacie.
  - `endDate` (ISO YYYY-MM-DD): zajęcia rozpoczynające się w dniu lub przed tą datą.
  - `tags` (comma-separated string): lista tagów; zwracane zajęcia muszą zawierać każdy z podanych tagów (intersekcja). Pusta wartość ignorowana.
  - `page` (int, default 1, >0): numer strony.
  - `limit` (int, default 20, max 100, >0): liczba elementów na stronę.
- Brak body (GET).

### Walidacja parametrów
Zod schema (nowa):
- `page`: domyślnie 1; błąd gdy <1
- `limit`: domyślnie 20; błąd gdy <1 lub >100
- `startDate`, `endDate`: regex `^\d{4}-\d{2}-\d{2}$`; refine poprawności daty i logiczne sprawdzenie (startDate <= endDate jeśli oba podane)
- `tags`: split po `,`, trim, filtracja pustych; każdy tag: max 50 znaków, alfanumeryczne plus `-/_` (refine) – w razie naruszenia -> VALIDATION_ERROR
- `hasAvailableSpots`: akceptuj "true"/"false" (case-insensitive); inne wartości -> VALIDATION_ERROR

## 3. Wykorzystywane typy
Z pliku `src/types.ts`:
- `ActivityListItemDTO`
- `ActivityWorkerDTO`
- `ActivitiesListResponseDTO`
- `PaginationDTO`
- `ErrorResponseDTO`
Dodatkowe lokalne typy (nowe, nie-eksporotwane poza service):
```ts
interface ActivitiesQueryFilters {
  hasAvailableSpots?: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  tags?: string[];    // already normalized
  page: number;
  limit: number;
}
```
Service zwraca `ActivitiesListResponseDTO`.

## 4. Szczegóły odpowiedzi
- Status 200: Body:
```jsonc
{
  "activities": [
    {
      "id": 1,
      "name": "Art Class",
      "description": "Creative painting and drawing",
      "cost": 45.00,
      "participant_limit": 10,
      "available_spots": 3,
      "start_datetime": "2025-01-20T14:00:00Z",
      "worker": {
        "id": 1,
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@facility.com"
      },
      "tags": ["art", "creative"],
      "created_at": "2025-01-05T10:00:00Z"
    }
  ],
  "pagination": {"page": 1, "limit": 20, "total": 45}
}
```
- Błędy:
  - 400 VALIDATION_ERROR (niepoprawne parametry / format dat / przekroczony limit / sprzeczny zakres dat)
  - 401 AUTH_UNAUTHORIZED (brak sesji / niepoprawny token)
  - 403 (nie stosowany – listing dla parent; inna rola traktowana jako 401 lub 403 wg istniejącego `authenticateParent` – zachowujemy spójność z helperem)
  - 500 INTERNAL_ERROR (nieoczekiwane błędy DB / agregacji)

`404` nie jest używany dla listowania – pusta lista = 200.

## 5. Przepływ danych
1. Warstwa endpointu (`src/pages/api/activities.ts`):
   - Odczyt query paramów z `context.request.url`.
   - Autentykacja i rola poprzez istniejący `authenticateParent` (import z `lib/api/helper.ts`).
   - Walidacja Zod (nowy plik `activities.schema.ts`).
   - Delegacja do service `listActivities()`.
2. Service (`src/lib/services/activities.service.ts`):
   - Budowa bazowego filtra dla tabeli `activities`:
     - Data: `start_datetime >= startDate` i/lub `<= endDate` (TIMESTAMPTZ porównania; przy założeniu strefy Z). Parametry konwertujemy do pełnych ISO przez dodanie `T00:00:00Z` dla start oraz `T23:59:59Z` dla end (lub używamy `< startDate + 1 day`).
   - Paginacja: offset = `(page - 1) * limit`.
   - Pobranie całkowitej liczby rekordów (po filtrach dat + po tagach jeśli dotyczy) dla `pagination.total`.
   - Pobranie strony rekordów: kolumny: `id, name, description, cost, participant_limit, start_datetime, created_at, worker_id`.
   - Pobranie workerów dla aktywności (JOIN metoda Supabase: `.select('..., workers(id, first_name, last_name, email)')` jeśli relacje są skonfigurowane; jeśli nie – dodatkowa kwerenda `workers` po zebranym zbiorze `worker_id`).
   - Pobranie tagów: `activity_tags` WHERE `activity_id IN (...)`; grupowanie w mapie `activityId -> string[]`.
   - Pobranie liczby zapisów: `enrollments` WHERE `activity_id IN (...)` z `select('activity_id', { count: 'exact', head: true })` w pętli lub (optymalniej) pojedyncza kwerenda agregująca (Supabase ograniczenia – rozważ RPC przyszłościowo). W MVP: jedna kwerenda `from('enrollments').select('activity_id', { count: 'exact', head: true })` nie grupuje – więc preferowana: zwykłe zapytanie `.select('activity_id')` i liczenie w pamięci.
   - Obliczenie `available_spots` dla każdej aktywności.
   - Jeśli `hasAvailableSpots === true`, odfiltrowanie po stronie aplikacji przed paginacją może zniekształcić liczby – LEPSZE: filtr przed liczeniem total:
     - Po wyliczeniu enrollmentów, zastosować filtr i dopiero wtedy liczyć total + wybrać stronę (wymaga dwóch faz: wstępne pobranie kandydatów bez limitu dla strony → w przypadku dużych zbiorów nieoptymalne). Kompromis: najpierw pobieramy stronę wg bazy (bez tego filtra), liczymy i usuwamy te bez miejsc – jeśli strona pusta a są wcześniejsze z miejscami → niespójność. Aby uniknąć, implementacja prostsza: wykonujemy agregację enrollmentów dla wszystkich pasujących rekordów gdy `hasAvailableSpots=true` (z ograniczeniem dat + tagów), filtrujemy, następnie paginujemy w pamięci. W planie oznaczamy to jako wariant MVP.
3. Endpoint formatuje wynik do `ActivitiesListResponseDTO` i zwraca JSON.

## 6. Względy bezpieczeństwa
- Autoryzacja: tylko rola `parent` – weryfikacja istniejącym helperem (spójność z innymi endpointami).
- Ograniczenie `limit` do 100 zapobiega nadmiernym obciążeniom i enumeracji masowej.
- Walidacja tagów eliminuje możliwość wstrzyknięcia niepoprawnych znaków (chociaż Supabase query builder jest parametryzowany, zachowujemy defense-in-depth).
- Nie budujemy dynamicznych fragmentów SQL – używamy selektorów Supabase, ewentualnie RPC w przyszłości z parametryzacją.
- RLS w tabelach zapewnia brak ekspozycji wrażliwych danych (Workers, Activities – administrator vs parent). Parent ma dostęp tylko do dozwolonych rekordów (zakładane polityki).
- Format daty kontrolowany – brak akceptacji swobodnych stringów.
- Brak body → minimalny wektor ataku.
- Logowanie zdarzeń (start/success/error) JSON.

## 7. Obsługa błędów
| Scenariusz | Kod błędu | HTTP | Opis |
|------------|-----------|------|------|
| Niepoprawny format parametru (np. limit > 100) | VALIDATION_ERROR | 400 | Zod parse failure lub własne refine |
| startDate > endDate | VALIDATION_ERROR | 400 | Logika w refine |
| Brak autentykacji | AUTH_UNAUTHORIZED | 401 | `authenticateParent` rzuca ApiError |
| Rola inna niż parent | AUTH_UNAUTHORIZED (lub 403) | 401/403 | Spójnie z istniejącym helperem |
| Błąd DB w trakcie pobierania | INTERNAL_ERROR | 500 | Z mapowania supabase error |
| Nieoczekiwane wyjątki | INTERNAL_ERROR | 500 | Fallback w `normalizeUnknownError` |

Brak 404 – lista może być pusta.

### Rejestrowanie błędów
Aktualnie brak tabeli `error_logs`. Kontynuujemy strategię console JSON. Propozycja rozszerzenia: dodać tabelę `api_errors` (id, timestamp, action, code, details) – etap future.

## 8. Rozważania dotyczące wydajności
Potencjalne wąskie gardła:
- Filtr `hasAvailableSpots=true` wymaga znajomości count zapisów – agregacja może być kosztowna przy dużej liczbie aktywności.
- Pobieranie tagów i zapisów w osobnych kwerendach (N+1) – rozwiązane grupowymi IN queries.
- Sortowanie domyślne – należy jednoznacznie ustalić (np. `ORDER BY start_datetime ASC`).

Strategie optymalizacji (MVP vs przyszłość):
- MVP: 3–4 kwerendy: activities (paged), workers (jeśli brak relacji), tags (IN), enrollments (IN). Liczenie dostępnych miejsc w pamięci
- Limit maks. 100 chroni przed pełnym skanem.

## 9. Etapy wdrożenia
1. Utworzenie pliku walidacji `src/lib/validation/activities.schema.ts`:
   - Zod schema `activitiesQuerySchema`
   - Parser funkcja `validateActivitiesQuery(params: URLSearchParams): ActivitiesQueryFilters`
   - Implementacja konwersji i domyślnych wartości.
2. Utworzenie pliku serwisu `src/lib/services/activities.service.ts`:
   - Eksport funkcji `listActivities(supabase: SupabaseClient, filters: ActivitiesQueryFilters): Promise<ActivitiesListResponseDTO>`
   - Kontrakt:
     - Wejście: zwalidowane filtry + supabase
     - Wyjście: DTO
     - Błędy: rzuca `ApiError(INTERNAL_ERROR)` gdy zapytania zawiodą
   - Implementacja logiki pobierania + kalkulacji `available_spots` + filtr `hasAvailableSpots` (patrz sekcja przepływu danych).
3. Utworzenie endpointu `src/pages/api/activities.ts`:
   - `export const prerender = false`
   - Handler `GET`: autoryzacja (jak w `children.ts`), walidacja query, logowanie (start/success/error), wywołanie service, mapowanie błędów.
   - Statusy: 200 sukces, inne wg `ApiError`.

## 10. Kontrakt funkcji service (podsumowanie)
- Wejście: `SupabaseClient`, `ActivitiesQueryFilters`
- Wyjście: `ActivitiesListResponseDTO`
- Błędy: tylko `ApiError` (INTERNAL_ERROR) – brak VALIDATION_ERROR (wychwycone wcześniej)

## 11. Edge Cases & Scenariusze testowe
- Brak parametrów → domyślna paginacja (page=1, limit=20)
- `limit=0` → 400 VALIDATION_ERROR
- `page=0` → 400 VALIDATION_ERROR
- `startDate` bez `endDate` (działa poprawnie – dolna granica)
- `endDate` bez `startDate` (działa – górna granica)
- `startDate > endDate` → 400 VALIDATION_ERROR
- `tags=art,,creative` (pusty segment ignorowany) → filtr na ['art','creative']
- `hasAvailableSpots=false` → zachowanie identyczne jak brak parametru (ignorujemy filtr)
- Brak pasujących aktywności → 200 z pustą tablicą i `total=0`

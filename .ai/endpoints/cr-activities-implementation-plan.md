# API Endpoint Implementation Plan: Admin Activities Create & Update

## 1. Przegląd punktu końcowego
Admin endpoints pozwalają administratorowi tworzyć oraz aktualizować zajęcia (activities) w systemie. Tworzenie (`POST /api/admin/activities`) dodaje nową aktywność powiązaną z istniejącym pracownikiem (worker) i domyślną placówką (facility_id=1 w MVP). Aktualizacja (`PATCH /api/admin/activities/:id`) umożliwia modyfikację dowolnego podzbioru pól (pełna lub częściowa zmiana) i generuje liczbę powiadomień (`notifications_sent`) jako pochodną (mock). Oba endpointy wymagają uwierzytelnienia i roli `admin`, wykonują walidację danych wejściowych, sprawdzają spójność referencji (istnienie worker), oraz stosują standardowe kody statusu.

## 2. Szczegóły żądania
### Create Activity
- Metoda: POST
- URL: `/api/admin/activities`
- Autoryzacja: Nagłówek autentykacyjny Supabase (sesja), rola `admin` wymagana
- Body (JSON):
  - name (string, required, 1..200 chars)
  - description (string|null, optional, max 2000 chars; pusty string -> null)
  - cost (number, required, >=0, max np. 10000; decimal akceptowany)
  - participant_limit (number, required, int > 0, np. max 1000)
  - start_datetime (string, required, ISO 8601 w przyszłości; must be > now)
  - worker_id (number, required, int > 0)
  - tags (string[], optional; element 1..50 chars, allowed [A-Za-z0-9-_\/], deduplikacja)

### Update Activity
- Metoda: PATCH
- URL: `/api/admin/activities/:id`
- Parametr ścieżki: id (number, int > 0)
- Body (JSON) – wszystkie pola opcjonalne, co najmniej jedno musi wystąpić:
  - name (string, 1..200)
  - description (string|null, max 2000; pusty string -> null)
  - cost (number, >=0, <=10000)
  - participant_limit (number, int > 0, <=1000)
  - start_datetime (string, ISO future)
  - worker_id (number, int > 0)
  - tags (string[], jak wyżej)

### Parametry
- Wymagane (POST): name, cost, participant_limit, start_datetime, worker_id
- Opcjonalne (POST): description, tags
- Wymagane (PATCH): id (path)
- Opcjonalne (PATCH body): wszystkie pola; wymagane jest wystąpienie co najmniej jednego

## 3. Wykorzystywane typy
- `AdminActivityCreateCommand` (src/types.ts) – wejście do warstwy service dla create
- `AdminActivityUpdateCommand` – wejście do service dla update (Partial)
- `AdminActivityDTO` – surowy rekord aktywności zwracany po create
- `AdminActivityUpdateResponseDTO` – rekord + pole `notifications_sent` po update
- `ErrorResponseDTO` – błąd transportowy
- `WorkerEntity` (pośrednio do walidacji referencji) – sprawdzenie istnienia `worker_id`

## 4. Szczegóły odpowiedzi
### Create (201)
Zwraca `AdminActivityDTO` (id, name, description, cost, participant_limit, start_datetime, worker_id, facility_id, created_at). Kod 201.

### Update (200)
Zwraca `AdminActivityUpdateResponseDTO`: jak `AdminActivityDTO` + `notifications_sent` (liczba wysłanych/mokowanych powiadomień). Kod 200.

### Kody błędów
- 400: VALIDATION_ERROR, ACTIVITY_STARTED (dla update gdy start_datetime w przeszłości ? – biznes: jeśli aktualizujemy na przeszłość), ACTIVITY_FULL (nie dotyczy create/update w MVP), WORKER_HAS_ACTIVITIES (nie dotyczy tu), ogólne złe dane
- 401/403: AUTH_UNAUTHORIZED (brak sesji lub roli admin) – helper
- 404: WORKER_NOT_FOUND, ACTIVITY_NOT_FOUND (dla PATCH i worker_id na create gdy nie istnieje) 
- 500: INTERNAL_ERROR (nieoczekiwane błędy Supabase lub transformacji)

## 5. Przepływ danych
1. Warstwa endpointu (Astro route):
   - Pobranie `supabase` z `context.locals`
   - Autentykacja `authenticateAdmin`
   - Walidacja body przez zod (oddzielne schematy: create/update) -> konwersja do Command modelu
2. Service (nowy plik `admin.activities.service.ts` lub rozszerzenie istniejącego `activities.service.ts`):
   - Create:
     a. Weryfikacja istnienia `worker_id` (SELECT id LIMIT 1)
     b. Weryfikacja `start_datetime` (parsowanie Date, > now)
     c. Insert do `activities` (facility_id hard-coded = 1 w MVP) + try/catch mapping Postgrest errors
     d. Insert tags: batch w pętli (opcjonalnie w jednej operacji `.insert([...])`)
     e. Select final row (id, wszystkie pola) -> DTO
   - Update:
     a. Select istniejącej aktywności (id) – jeśli brak -> ACTIVITY_NOT_FOUND
     b. Jeśli jest `worker_id`: sprawdzenie istnienia (404 w razie braku)
     c. Jeśli jest `start_datetime`: walidacja przyszłości ( > now )
     d. Update pola (tylko dostarczone) – `supabase.from("activities").update({...}).eq("id", id)`
     e. Jeżeli dostarczono `tags`: usunięcie istniejących (`delete where activity_id`) + wstawienie nowych
     f. Obliczenie `notifications_sent` – mock: SELECT count(*) enrollments dla aktywności (parents count) lub stała (np. liczba zapisów) -> plan: liczymy enrollments i zwracamy tę liczbę
     g. Select final row -> DTO + notifications_sent
3. Transport: JSON response, odpowiedni status.

## 6. Względy bezpieczeństwa
- Autentykacja: Supabase session + rola admin; brak -> 401/403
- Autoryzacja: Endpointy admin w `/api/admin/*` zawsze wywołują `authenticateAdmin`
- Walidacja wejścia: zod zapewnia ograniczenia typów i długości, defensywa przed injection (tag regex, limit kosztu)
- Data future check eliminuje tworzenie aktywności w przeszłości
- Hard-coded `facility_id` minimalizuje powierzchnię ataku (brak możliwości wstrzyknięcia obcej placówki)
- Ograniczenie długości stringów (name <=200, description <=2000, tag <=50) – redukcja ryzyka DoS poprzez bardzo długie payloady
- Weryfikacja istnienia worker zapobiega referencyjnym błędom i “dangling references”
- Brak bezpośredniego zwracania stack traces – błędy 500 mapowane do kodu INTERNAL_ERROR
- JSON output z nagłówkiem Content-Type application/json (bez HTML injection)

## 7. Obsługa błędów
Mapa sytuacji -> ApiError:
- Zod validation -> VALIDATION_ERROR (400) z listą issues
- Worker nie istnieje -> WORKER_NOT_FOUND (404)
- Activity nie istnieje (PATCH) -> ACTIVITY_NOT_FOUND (404)
- start_datetime w przeszłości -> VALIDATION_ERROR (400)
- Supabase insert/update error -> INTERNAL_ERROR (500) chyba że specyficzny kod (np. naruszenie klucza obcego) – mapujemy ogólnie
- Brak tagów po update (OK) – pusta lista
- Nieprawidłowy format ISO daty -> VALIDATION_ERROR

Transport warstwa używa `errorToDto(apiErr)`.

## 8. Rozważania dotyczące wydajności
- Insert + tag insert w osobnych operacjach – akceptowalne w MVP (mała skala). Można zgrupować tagi do jednego bulk insert.
- Update kasuje tagi i wstawia nowe – przy małej liczbie tagów koszty są minimalne.
- Liczenie enrollments dla `notifications_sent` używa `select count exact head` (O(1)) – wydajne.
- Indeksy: activities(id), enrollments(activity_id) już opisane – zapewniają wydajność.
- Brak potrzeby transakcji w Supabase PostgREST – potencjalne ryzyko niezsynchronizowanego stanu tagów jeśli insert tagów częściowo się nie powiedzie (MVP akceptuje). W przyszłości: RPC funkcja transakcyjna.

## 9. Etapy wdrożenia
1. Dodaj plik walidacji `admin.activities.schema.ts` w `src/lib/validation/` z zod schematami: `createAdminActivitySchema`, `updateAdminActivitySchema`, `validateCreateAdminActivityBody`, `validateUpdateAdminActivityBody`, `validateAdminActivityIdParam`.
2. Utwórz/rozszerz service: nowy plik `src/lib/services/admin.activities.service.ts` z funkcjami `createAdminActivity(supabase, command: AdminActivityCreateCommand): Promise<AdminActivityDTO>` i `updateAdminActivity(supabase, id: number, command: AdminActivityUpdateCommand): Promise<AdminActivityUpdateResponseDTO>`.
3. Implementacja create:
   - Validate referencje worker
   - Validate facility (hard-coded id=1, lub select facilities LIMIT 1 aby uzyskać id) -> wstawienie facility_id
   - Parse & validate datę startową (future)
   - Insert activity + select row
   - Insert tags jeśli istnieją (bulk)
   - Return DTO (bez `notifications_sent`)
4. Implementacja update:
   - Fetch istniejącej aktywności; 404 jeśli brak
   - Walidacja worker_id jeśli dostarczone
   - Walidacja daty jeśli dostarczona
   - Update tylko dostarczonych pól
   - Replace tags jeśli dostarczone: delete + bulk insert
   - Policzenie enrollments `count exact head` dla notifications_sent
   - Select końcowy rekord -> zbudowanie `AdminActivityUpdateResponseDTO`
5. Dodaj endpoint plik `src/pages/api/admin/activities.ts` (POST) oraz folder `activities/[id].ts` dla PATCH (`/api/admin/activities/:id`). W każdym:
   - `export const prerender = false`
   - Auth przez `authenticateAdmin`
   - Walidacja body / path params
   - Logowanie start/sukces/błąd (analogicznie do `workers.ts`) z polami: action, admin_id, activity_id, timestamp
6. Mapowanie błędów: Zod -> fromZodError, ApiError -> errorToDto.
8. (Opcjonalnie) Rozbuduj `ErrorCode` gdy potrzeba nowych (np. ACTIVITY_TAGS_CONSTRAINT) – na razie nie dodajemy.
9. Review lint & typy.

## 10. Edge Cases (checklist podczas implementacji)
- Brak `tags` -> pusta lista; nie tworzymy wierszy w `activity_tags`.
- `tags: []` explicite -> upewnić się, że nie wstawiamy nic i stare tagi przy update są usuwane.
- Duplikaty tagów -> deduplikacja w warstwie walidacji.
- `description: ""` -> transform -> null.
- `start_datetime` milisekundy / offsety – przyjmujemy pełny ISO i zapisujemy jak dostarczono; walidacja opiera się na Date.parse.
- Update tylko `tags` (pozostałe pola puste) – poprawny; musi przejść refine (co najmniej jedno pole).
- Update z `start_datetime` w przeszłości -> odrzucenie WALIDACJA.
- Worker id zmiana na nieistniejący -> 404 WORKER_NOT_FOUND.
- Race: usunięty worker między walidacją a insert/update -> przy insert SUPABASE FK błąd -> INTERNAL_ERROR (akceptowane w MVP).

## 11. Kontrakt funkcji service
createAdminActivity:
- Input: SupabaseClient, AdminActivityCreateCommand
- Output: AdminActivityDTO
- Errors: WORKER_NOT_FOUND, VALIDATION_ERROR (data), INTERNAL_ERROR

updateAdminActivity:
- Input: SupabaseClient, id:number, AdminActivityUpdateCommand
- Output: AdminActivityUpdateResponseDTO
- Errors: ACTIVITY_NOT_FOUND, WORKER_NOT_FOUND, VALIDATION_ERROR, INTERNAL_ERROR

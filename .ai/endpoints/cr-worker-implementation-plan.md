# API Endpoint Implementation Plan: Create & Update Worker (Admin)

## 1. Przegląd punktu końcowego
Dwa admin endpoints do zarządzania instruktorem (workerem):
- POST /api/admin/workers – tworzy nowego pracownika (instruktora). Zwraca 201 oraz pełny obiekt `WorkerDTO`.
- PATCH /api/admin/workers/:id – pełna aktualizacja istniejącego pracownika według specyfikacji (semantyka replace wszystkich pól – brak partial). Zwraca 200 z uaktualnionym `WorkerDTO`.

Cele:
- Zapewnienie walidacji danych (imiona, email) oraz unikalności email.
- Spójne logowanie (start/success/error) zgodnie z istniejącym stylem list/get workers.
- Spójna obsługa błędów (400/401/403/404/409/500) z centralnym systemem `ApiError` + mapowanie.
- Zachowanie konwencji projektu (Zod, services, auth admin, supabase z `context.locals`).

## 2. Szczegóły żądania
### POST /api/admin/workers
- Metoda: POST
- URL: /api/admin/workers
- Autoryzacja: wymagana rola admin (re-use `authenticateAdmin`).
- Body (JSON):
  ```json
  {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@facility.com"
  }
  ```
- Parametry wymagane w body: first_name, last_name, email.
- Parametry opcjonalne: brak (wszystkie muszą być dostarczone).

### PATCH /api/admin/workers/:id
- Metoda: PATCH
- URL: /api/admin/workers/:id (param `id` > 0, integer)
- Autoryzacja: admin.
- Body (JSON): identyczne pola jak POST (pełna aktualizacja):
  ```json
  {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@facility.com"
  }
  ```
- Parametry wymagane: path param `id`, body: first_name, last_name, email.
- Parametry opcjonalne: brak.

## 3. Wykorzystywane typy
Z `src/types.ts`:
- `WorkerDTO` (alias `WorkerEntity`): { id, first_name, last_name, email, created_at }
- `WorkerCreateCommand` (first_name, last_name, email)
- `WorkerUpdateCommand` (alias `WorkerCreateCommand` – full overwrite)
- `ErrorResponseDTO`
Nowe / rozszerzenia:
- Dodanie kodu błędu `WORKER_EMAIL_CONFLICT` (409) do `ErrorCode` w `errors.ts` (Status map + union) – alternatywnie nazwa ogólna `EMAIL_CONFLICT`; planujemy specyficzną dla przejrzystości.
  - Jeśli preferowane minimalne zmiany – można użyć istniejących kodów i 409 override, lecz w planie proponujemy dedykowany kod.

## 4. Szczegóły odpowiedzi
### Sukces
- POST 201 Created: `WorkerDTO` (id, first_name, last_name, email, created_at)
- PATCH 200 OK: `WorkerDTO`

### Błędy (JSON `ErrorResponseDTO`):
- 400 VALIDATION_ERROR – niepoprawne body/param (np. brak pola, zły email)
- 401 AUTH_UNAUTHORIZED – brak/niepoprawny token
- 403 AUTH_UNAUTHORIZED (message: Forbidden: admin role required) – brak roli admin
- 404 WORKER_NOT_FOUND – przy PATCH gdy worker nie istnieje
- 409 WORKER_EMAIL_CONFLICT – unikalny email naruszony
- 500 INTERNAL_ERROR – pozostałe błędy

## 5. Przepływ danych
1. Klient wysyła żądanie z Bearer tokenem.
2. Endpoint (POST/PATCH) wywołuje `authenticateAdmin`:
   - Supabase Auth getUser → profiles (id, role) → walidacja roli.
3. Walidacja body poprzez nowe funkcje w `workers.schema.ts` (Zod):
   - Trim, normalizacja email do lowercase (transform).
   - first_name / last_name długość 1..100, tylko sprawdzenie non-empty (opcjonalne dodatkowe regex).
   - email: `z.string().email().max(255)`.
4. POST: service `createWorker` wykona insert do `workers` (kolumny: first_name, last_name, email) z `.select("id, first_name, last_name, email, created_at").single()`.
5. PATCH: service `updateWorker`:
   - `.update({ first_name, last_name, email }).eq("id", id).select("id, first_name, last_name, email, created_at").maybeSingle()`.
   - Jeśli brak wiersza → WORKER_NOT_FOUND.
6. Obsługa konfliktu email: przechwycić błąd Supabase (Postgres error code 23505) → mapować do `WORKER_EMAIL_CONFLICT` (status 409).
7. Zwrócenie JSON `WorkerDTO` / error DTO.
8. Logowanie structured JSON (action, phase, admin_id, worker_id (dla PATCH), timestamp, email).

## 6. Względy bezpieczeństwa
- Autoryzacja: tylko admin (centralna funkcja reuse). Sprawdza zarówno istnienie usera jak i role.
- Walidacja wejścia ogranicza długość i format (zapobieganie injection, chociaż Supabase parametryzowane zapytania minimalizują ryzyko SQL injection).
- Normalizacja email do lowercase redukuje duplikaty w różnej wielkości liter.
- Unikalność email wymuszona constraintem DB + obsłużona defensywnie w kodzie (race-safe).
- Brak ujawniania szczegółów wewnętrznych błędów – message z DB tylko dla INTERNAL_ERROR (rozważ w przyszłości maskowanie).
- Audyt / logi: zapewnione structured logs dla działań admina.

## 7. Obsługa błędów
Tabela mapowania scenariuszy:
- Zod validation fail → fromZodError → 400 VALIDATION_ERROR
- Brak tokena lub brak profilu → AUTH_UNAUTHORIZED 401
- Rola ≠ admin → AUTH_UNAUTHORIZED 403 (message: Forbidden...)
- PATCH id nie-int → VALIDATION_ERROR 400 (z param schema – już istnieje `validateWorkerIdParam`)
- PATCH worker nie istnieje → WORKER_NOT_FOUND 404
- Insert/update: Postgres 23505 (unique violation na email) → WORKER_EMAIL_CONFLICT 409
- Inne Supabase error → INTERNAL_ERROR 500
- Nieznane exception → normalizeUnknownError → INTERNAL_ERROR 500

Log format (przykład POST):
```json
{"action":"CREATE_WORKER","phase":"start","admin_id":"<uuid>","email":"jane.doe@facility.com","timestamp":"..."}
{"action":"CREATE_WORKER","phase":"success","admin_id":"<uuid>","worker_id":1,"timestamp":"..."}
{"action":"CREATE_WORKER","phase":"error","admin_id":"<uuid>","error_code":"WORKER_EMAIL_CONFLICT","status":409,"timestamp":"..."}
```
Analogicznie dla PATCH: `UPDATE_WORKER` + pola.

## 8. Rozważania dotyczące wydajności
- Operacje jednostkowe (insert/update) – znikomy koszt.
- Indeksy: unikalny indeks na email użyty do szybkiego sprawdzenia duplikatu.
- Brak potrzeby cache w MVP.
- Ograniczyć pobierane kolumny do wymaganych (`select(...)`).
- Jedna runda trip do DB per operacja.

## 9. Etapy wdrożenia (kroki implementacji)
1. (Types) Rozszerz `ErrorCode` w `src/lib/services/errors.ts` o `WORKER_EMAIL_CONFLICT` + status 409 w `STATUS_MAP`.
2. (Validation) Zaktualizuj `workers.schema.ts`:
   - Dodaj schemas: `workerCreateBodySchema`, `workerUpdateBodySchema` (ta sama definicja).
   - Eksportuj funkcje: `validateWorkerCreateBody(json: unknown): WorkerCreateCommand`, `validateWorkerUpdateBody(json: unknown): WorkerUpdateCommand`.
3. (Service) Rozszerz `workers.service.ts`:
   - Dodaj `createWorker(supabase, input: WorkerCreateCommand): Promise<WorkerDTO>`
     - Insert + select; mapuj unique violation → `createError("WORKER_EMAIL_CONFLICT", "Worker email already exists", { status: 409 })`.
   - Dodaj `updateWorker(supabase, id: number, input: WorkerUpdateCommand): Promise<WorkerDTO>`
     - Update by id + select; 0 rows → WORKER_NOT_FOUND; unique violation → WORKER_EMAIL_CONFLICT.
   - Helper do rozpoznawania unique violation: sprawdź `error.code === '23505'`.
4. (API Route POST) Edytuj `src/pages/api/admin/workers.ts`:
   - Dodaj handler `export const POST: APIRoute`.
   - Reuse auth, parse `await request.json()`, walidacja Zod, log start, call `createWorker`, log success, return 201.
   - Error handling analogiczny do GET list: catch Zod, map errors, log error.
5. (API Route PATCH) Edytuj `src/pages/api/admin/workers/[id].ts`:
   - Dodaj handler `export const PATCH: APIRoute`.
   - Reuse id validation (`validateWorkerIdParam`), body validation, auth, log start, call `updateWorker`, log success, return 200.
6. (Consistency) Upewnij się, że oba nowe handlery ustawiają `export const prerender = false` (już istnieje w plikach – nie duplikować jeśli wspólne).

## 10. Minimalne przykłady service (referencyjne – do implementacji)
Pseudo (do wykorzystania w kodzie właściwym):
```ts
export async function createWorker(supabase, input) {
  const { data, error } = await supabase
    .from('workers')
    .insert({ ...input })
    .select('id, first_name, last_name, email, created_at')
    .single();
  if (error) return handleWorkerPgError(error);
  return data as WorkerDTO;
}

function handleWorkerPgError(error) {
  if ((error as any).code === '23505') {
    throw createError('WORKER_EMAIL_CONFLICT', 'Worker email already exists', { status: 409 });
  }
  throw createError('INTERNAL_ERROR', error.message);
}
```

## 11. Edge Cases & Guard Clauses
- Body undefined / invalid JSON → JSON parse exception → INTERNAL_ERROR? (Lepsze: try/catch parse i rzucić VALIDATION_ERROR – można dodać wrapper w implementacji.)
- Whitespaces only in names → po trim -> puste → walidacja 400.
- Email z wielkimi literami → transform do lowercase (traktowany identycznie przy unikalności).
- PATCH brak zmian (identyczne wartości) → Postgres update succeed; zwracamy aktualny rekord (OK).
- Równoczesne tworzenie dwóch workerów z tym samym email → jeden succeed, drugi 409.
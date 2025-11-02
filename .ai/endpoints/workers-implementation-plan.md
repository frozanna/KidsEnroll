# API Endpoint Implementation Plan: Admin Workers (List & Detail)

## 1. Przegląd punktu końcowego
Endpointy zapewniają administratorowi możliwość: 
- Pobrania paginowanej listy wszystkich pracowników (instruktorów) `GET /api/admin/workers`.
- Pobrania szczegółów pojedynczego pracownika po jego identyfikatorze `GET /api/admin/workers/:id`.

Cele biznesowe:
- Umożliwienie zarządzania zasobem "workers" w panelu admina.
- Dostarczenie stabilnych struktur DTO zgodnych z typami `WorkerDTO` oraz wzorcem paginacji `PaginationDTO`.
- Zapewnienie bezpiecznej autoryzacji tylko dla roli `admin`.

## 2. Szczegóły żądania
### List Workers
- Metoda: GET
- URL: `/api/admin/workers`
- Query parametry:
  - `page` (opcjonalny, int >=1, domyślnie 1)
  - `limit` (opcjonalny, int 1..100, domyślnie 20, maksymalny 100)
- Body: brak
- Nagłówki: `Authorization: Bearer <access_token>` (wymagane)

### Get Worker by ID
- Metoda: GET
- URL: `/api/admin/workers/:id`
- Path parametry:
  - `id` (wymagany, int > 0)
- Body: brak
- Nagłówki: `Authorization: Bearer <access_token>` (wymagane)

### Parametry
- Wymagane: token autoryzacyjny z rolą admin (pośrednio weryfikowany przez profil).
- Opcjonalne (list): `page`, `limit`.

## 3. Wykorzystywane typy
Z pliku `src/types.ts`:
- `WorkerDTO` (alias pełnego wiersza `workers`)
- `WorkersListResponseDTO` { workers: WorkerDTO[]; pagination: PaginationDTO }
- `PaginationDTO` { page: number; limit: number; total: number }

Dodatkowe wewnętrzne:
- `ListWorkersQuery` (lokalny typ pomocniczy po walidacji query)
- `RawWorkerRow` (lokalny do mapowania gdyby rozszerzone wybory się pojawiły; MVP może bezpośrednio użyć wiersza)

## 4. Szczegóły odpowiedzi
### Sukces
- List: 200 OK
```
{
  "workers": [WorkerDTO, ...],
  "pagination": { "page": n, "limit": m, "total": t }
}
```
- Detail: 200 OK
```
WorkerDTO
```
### Błędy (JSON `ErrorResponseDTO`)
- 401 Unauthorized: brak ważnego tokenu / użytkownik niezalogowany.
- 403 Forbidden: zalogowany użytkownik nie ma roli `admin`.
- 404 Not Found: przy GET /:id gdy pracownik nie istnieje.
- 400 Validation Error: niepoprawne wartości `page`, `limit`, `id`.
- 500 Internal Error: błąd Supabase / niespodziewany wyjątek.

## 5. Przepływ danych
1. Middleware (`src/middleware/index.ts`) dostarcza `supabase` w `context.locals`.
2. Endpoint transport layer:
   - Autentykacja przez analogiczny helper do `authenticateParent` -> nowy `authenticateAdmin`.
   - Walidacja parametrów (Zod) -> utworzenie obiektu `ListWorkersQuery`.
   - Wywołanie serwisu `listWorkers(supabase, query)` lub `getWorkerById(supabase, id)`.
3. Serwis:
   - Buduje zapytanie SELECT z paginacją (użycie `range` lub manualne slice po pobraniu count).
   - Pobiera `count` w trybie HEAD (select with `count: "exact", head: true`) albo wykonuje dwa zapytania (MVP: jeden SELECT + drugi COUNT jeśli HEAD nie obejmie kolumn) – preferowane HEAD.
   - Mapuje wiersze na `WorkerDTO` (proste odwzorowanie).
4. Transport zwraca odpowiedź JSON wraz z paginacją lub pojedynczym obiektem.
5. Logowanie JSON (start, success, error) w konsoli tak jak w istniejących endpointach.

## 6. Względy bezpieczeństwa
- Autentykacja: Supabase Auth (`supabase.auth.getUser()`).
- Autoryzacja: Sprawdzenie `profiles.role === 'admin'`.
- RLS: Zakłada się globalny dostęp admina; w tabeli `workers` RLS może zezwalać tylko adminom (jeżeli polityka istnieje). W planie implementujemy kontrolę w warstwie aplikacji.
- Brak danych wrażliwych poza email (public business data). Email jest już unikatowy; nie ujawniamy dodatkowych metadanych.
- Ochrona przed enumeration: Paginacja + brak możliwości filtrów w MVP. Brak limitu > 100.
- Ochrona przed injection: Zod waliduje ograniczone parametry; nie interpolujemy parametrów manualnie.
- Rate limiting (przyszłość): Można dodać w middleware.

## 7. Obsługa błędów
Potencjalne scenariusze:
- Token wygasł / brak: `AUTH_UNAUTHORIZED` (status 401)
- Rola != admin: `AUTH_UNAUTHORIZED` z nadpisanym statusem 403 (spójnie ze stylem helpera)
- Nieprawidłowy `page`, `limit`, `id`: `VALIDATION_ERROR` (400)
- Worker nie istnieje: `WORKER_NOT_FOUND` (404) – NOWY kod błędu w `errors.ts`
- Błąd zapytania Supabase: `INTERNAL_ERROR` (500)
- Nieoczekiwany null w wierszu: `INTERNAL_ERROR` (500)

Mapowanie: `ApiError` -> `ErrorResponseDTO` przez `errorToDto`.
Dodanie nowych kodów w `ErrorCode` enum: `WORKER_NOT_FOUND`.

## 8. Rozważania dotyczące wydajności
- Paginacja: użycie `range` aby uniknąć pobierania całej tabeli.
- Liczenie total: `select('*', { count: 'exact', head: true })` dla total, następnie właściwy zakres; lub pojedyncze zapytanie z `count` (Supabase pozwala na pobranie count razem z danymi) – preferujemy jedno zapytanie.
- Indeks: domyślny PK `workers.id` wystarcza dla sortowania i stronicowania.
- Limit maks 100 ogranicza użycie pamięci.
- Brak joinów -> tanie zapytanie.
- Możliwość dodania kolumny sortowania (np. created_at) – wykorzystamy `order('created_at', { ascending: false })` aby zawsze mieć deterministyczną kolejność.

## 9. Etapy wdrożenia
1. Dodaj nowy kod błędu do `errors.ts`: `WORKER_NOT_FOUND` z mapowaniem na 404.
2. Utwórz Zod walidator dla query `/api/admin/workers` (`workers.schema.ts`):
   - `page` i `limit` jak w `activities.schema.ts` (z możliwością reuse utili) – nowy plik `src/lib/validation/workers.schema.ts`.
3. Dodaj helper `authenticateAdmin` w `api/helper.ts` (analogiczny do `authenticateParent`, zmiana roli i komunikatów):
   - Sprawdza `profile.role === 'admin'`.
4. Utwórz serwis `workers.service.ts` w `src/lib/services/`:
   - `listWorkers(supabase, { page, limit }): Promise<WorkersListResponseDTO>`
     - Zapytanie: `supabase.from('workers').select('id, first_name, last_name, email, created_at', { count: 'exact' })`.
     - Sortowanie: `.order('created_at', { ascending: false })`.
     - Paginacja: `.range(offset, offset+limit-1)`.
     - Błąd -> `createError('INTERNAL_ERROR', ...)`.
   - `getWorkerById(supabase, id): Promise<WorkerDTO>`
     - `maybeSingle()`; brak wiersza -> `createError('WORKER_NOT_FOUND', 'Worker not found')`.
5. Utwórz endpoint pliki:
   - `src/pages/api/admin/workers.ts` (GET lista)
   - `src/pages/api/admin/workers/[id].ts` (GET detail)
   Zgodnie z konwencją: `export const prerender = false;` oraz `GET: APIRoute`.
6. W endpointach:
   - Pobierz `supabase` z `context.locals`.
   - Autoryzacja `authenticateAdmin`.
   - Walidacja query lub parametru `id` przez nowy schemat (param: regex/transform jak w `childIdParamSchema`).
   - Logowanie JSON (akcje `LIST_WORKERS` i `GET_WORKER`).

## 10. Edge Cases & Test Matrix
- `page=0` -> 400 Validation Error.
- `limit=101` -> 400 Validation Error.
- Brak parametrów -> domyślne (page=1, limit=20).
- Pusta tabela workers -> `workers: []`, `pagination.total=0` (200 OK).
- Duża liczba rekordów -> poprawne dzielenie na strony.
- `id` nieistniejący -> 404 WORKER_NOT_FOUND.
- Token ważny ale rola parent -> 403.
- Brak profilu (teoretycznie niespójność) -> 401.

## 11. Kontrakt funkcji serwisowych
### listWorkers
- Wejście: `{ page: number; limit: number }`
- Wyjście: `WorkersListResponseDTO`
- Błędy: `INTERNAL_ERROR`
### getWorkerById
- Wejście: `id: number (>0)`
- Wyjście: `WorkerDTO`
- Błędy: `WORKER_NOT_FOUND | INTERNAL_ERROR`

## 13. Powiązanie z istniejącymi wzorcami
- Wzorujemy się na stylu `activities.ts` (paginacja, logowanie) i `children.ts` (proste listy).
- Spójne użycie `errors.ts` + `ApiError`.
- Walidacja analogiczna do `activities.schema.ts` dla `page`/`limit`.

## 14. Nowe elementy do dodania
- `WORKER_NOT_FOUND` w `errors.ts`.
- `workers.schema.ts` (Zod walidacja listy + id param). 
- `workers.service.ts` (logika DB).
- Endpointy transportowe pod `/api/admin/workers`.
- `authenticateAdmin` helper.

## 15. Pseudokod serwisu
```ts
export async function listWorkers(supabase, { page, limit }): Promise<WorkersListResponseDTO> {
  const offset = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from('workers')
    .select('id, first_name, last_name, email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw createError('INTERNAL_ERROR', error.message);
  return { workers: data ?? [], pagination: { page, limit, total: count ?? 0 } };
}

export async function getWorkerById(supabase, id: number): Promise<WorkerDTO> {
  const { data, error } = await supabase
    .from('workers')
    .select('id, first_name, last_name, email, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw createError('INTERNAL_ERROR', error.message);
  if (!data) throw createError('WORKER_NOT_FOUND', 'Worker not found');
  return data;
}
```

## 16. Pseudokod endpointu listy
```ts
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;
  let admin; try { admin = await authenticateAdmin(supabase); } catch (e) { /* map error */ }
  const params = validateWorkersQuery(new URL(context.request.url).searchParams); // page/limit
  log(start,...);
  try {
    const result = await listWorkers(supabase, params);
    log(success,...);
    return jsonResponse(result, 200);
  } catch (e) { /* map & log error */ }
};
```
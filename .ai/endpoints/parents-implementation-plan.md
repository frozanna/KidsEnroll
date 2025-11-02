# API Endpoint Implementation Plan: Admin Parents (List & Detail)

## 1. Przegląd punktu końcowego
Dwa endpointy administracyjne do zarządzania kontami rodziców:
1. GET `/api/admin/parents` – paginowana lista rodziców (profile + agregaty: liczba dzieci). Opcjonalne wyszukiwanie po emailu / imieniu / nazwisku.
2. GET `/api/admin/parents/:id` – szczegółowe dane rodzica wraz z listą jego dzieci (zliczona liczba zapisów dla każdego dziecka).

Cele biznesowe:
- Umożliwienie administratorowi szybkiego przeglądu bazy rodziców, filtrowania i analizy aktywności.
- Umożliwienie wglądu w strukturę rodziny (dzieci + liczba zapisów) dla działań operacyjnych (np. wsparcie, raporty).

## 2. Szczegóły żądania
### List Parents
- Metoda: GET
- URL: `/api/admin/parents`
- Parametry zapytania:
  - `page` (number, default=1, min=1)
  - `limit` (number, default=20, min=1, max=100)
  - `search` (string, optional, max length np. 100, trimming whitespace)
- Nagłówki: `Authorization: Bearer <access_token>` (musi istnieć i wskazywać profil o roli `admin`)
- Body: brak

### Get Parent by ID
- Metoda: GET
- URL: `/api/admin/parents/:id`
- Parametry ścieżki:
  - `id` (UUID, profil rodzica)
- Nagłówki: `Authorization: Bearer <access_token>` (musi wskazywać admina)
- Body: brak

## 3. Wykorzystywane typy
Z `src/types.ts`:
- `ParentListItemDTO` (lista): { id, first_name, last_name, email, created_at, children_count }
- `ParentsListResponseDTO` (lista): { parents: ParentListItemDTO[], pagination }
- `ParentDetailChildDTO` (szczegóły dziecka): { id, first_name, last_name, birth_date, enrollments_count }
- `ParentDetailDTO` (szczegóły rodzica): { id, first_name, last_name, email, created_at, children: ParentDetailChildDTO[] }
- `PaginationDTO`
- `ErrorResponseDTO`

Nowe (jeśli potrzebne): Brak – obecne typy wystarczające.

## 4. Szczegóły odpowiedzi
### Sukces
- Lista:
```json
{
  "parents": [ParentListItemDTO],
  "pagination": { "page": 1, "limit": 20, "total": 150 }
}
```
- Szczegół:
```json
{
  "id": "uuid",
  "email": "parent@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "created_at": "2025-01-10T10:00:00Z",
  "children": [ParentDetailChildDTO]
}
```

### Błędy (konsekwentny kształt `ErrorResponseDTO`)
- 400 VALIDATION_ERROR (np. niepoprawne page/limit lub nieprawidłowy UUID)
- 401 AUTH_UNAUTHORIZED (brak/niepoprawny token)
- 403 FORBIDDEN (użytkownik zalogowany nie jest adminem -> mapowanie do CHILD_NOT_OWNED analogiczne, ale tu nowy kod? Użyj AUTH_UNAUTHORIZED lub rozszerz `ErrorCode` o ADMIN_FORBIDDEN – w MVP można zwrócić 403 z code=`AUTH_UNAUTHORIZED` message=`Admin role required`) – rekomendacja: dodać kod `FORBIDDEN` dla spójności w przyszłości.
- 404 NOT_FOUND (Parent nie istnieje dla GET /:id -> `PARENT_NOT_FOUND` – należy dodać nowy kod)
- 500 INTERNAL_ERROR (awarie db)

Rozszerzenie `ErrorCode` (opcjonalne w tym zadaniu):
- `PARENT_NOT_FOUND`
- `FORBIDDEN` (jeśli chcemy semantycznie odróżnić od braku autoryzacji)

## 5. Przepływ danych
### GET /api/admin/parents
1. Middleware autentykacji pozyskuje profil admina (context.locals.supabase + session -> profile.role).
2. Walidacja query (Zod): page, limit, search.
3. Konwersja: offset = (page-1)*limit, rangeEnd = offset+limit-1.
4. Budowa zapytania bazowego:
   - Tabela: `profiles` (role='parent').
   - JOIN (agregacja dzieci): wykorzystamy subquery count dzieci per parent_id w jednym zapytaniu lub dwa zapytania:
     a) SELECT parent rows paginowane (range & exact count) + ich id.
     b) Oddzielne zapytanie `children` GROUP BY parent_id w IN(ids) aby policzyć dzieci.
   - Wyszukiwanie `search`: (case-insensitive ILIKE) na first_name/last_name/email. Email pochodzi z auth.users – nie mamy bezpośrednio w profiles. Strategia: Supabase nie łączy automatycznie `auth.users`. Rozwiązania:
     - (MVP) utrzymywać w `profiles` redundancję email (rozbudowa schematu) – brak w obecnym schemacie. Alternatywa: użyć RPC lub dodatkowego klienta admin do tabeli `auth.users`. Aby uniknąć komplikacji, w MVP ograniczyć search do first_name/last_name. Plan uwzględnia: jeśli email search konieczny, potrzebny widok lub edge function. -> Założenie: search dotyczy tylko first_name/last_name w aktualnym schemacie. (Assumption logged.)
5. Pobranie rekordów + total count (Supabase `select(..., { count: 'exact' })` + `range`).
6. Drugi query children counts (IN parent ids) -> mapowanie do `children_count`.
7. Złożenie `ParentListItemDTO[]` (null first_name/last_name -> wymuszone jako empty string per ForceNonNullable kontrakt – transformacja: `first_name ?? ''`).
8. Zwrot `ParentsListResponseDTO`.

### GET /api/admin/parents/:id
1. Middleware autentykacji (rola admin) – walidacja UUID.
2. Zapytanie profilu rodzica po id (select id, first_name, last_name, created_at). Brak email w profiles – patrz powyżej; założenie: email dostępny z supabase.auth admin channel (potrzeba dodatkowego call). MVP: jeśli brak prostego dostępu, w planie zakładamy dodanie kolumny email do profiles w przyszłej migracji. Tymczasowo można zwrócić placeholder lub pominąć? W spec jest email wymagany. -> Wymagana migracja lub alternate fetch.
   - Propozycja implementacyjna: utworzyć widok materializowany lub funkcję RPC `get_parent_with_email(parent_uuid)` która łączy `auth.users` i `profiles`. (Out of current code scope; plan opisuje.)
3. Jeśli brak profilu -> PARENT_NOT_FOUND (404).
4. Zapytanie dzieci rodzica: select id, first_name, last_name, birth_date.
5. Zapytanie liczby enrollments per child (GROUP BY child_id) w IN(child ids).
6. Złożenie listy children z `enrollments_count` (0 gdy brak wpisu).
7. Zwrot `ParentDetailDTO`.

## 6. Względy bezpieczeństwa
- Uwierzytelnienie: Bearer JWT przez Supabase; używać `context.locals.supabase`.
- Autoryzacja: weryfikacja `profile.role === 'admin'`; w razie niezgodności 403.
- RLS: tabele `profiles`, `children`, `enrollments` – administrator ma pełen dostęp. Sprawdzić polityki (jeśli brak -> dodać politykę dopuszczającą admina).
- Walidacja wejścia: Zod dla query param (page/limit/search) i path param (UUID).
- Ochrona przed nadużyciem search: limit length, trim, optional normalizacja do lower-case.
- Unikanie enumeracji użytkowników przez różnicowanie komunikatów – zwracamy standardowe `PARENT_NOT_FOUND` dla nieistniejącego id; brak konieczności maskowania jako 404 vs 403 (administrator ma pełen dostęp).
- SQL Injection odporność: Supabase klient parametryzuje `.eq/.ilike/.in`.

## 7. Obsługa błędów
Scenariusze:
- Invalid page/limit/search -> 400 VALIDATION_ERROR
- Invalid UUID path param -> 400 VALIDATION_ERROR
- Missing/expired token -> 401 AUTH_UNAUTHORIZED
- Non-admin role -> 403 AUTH_UNAUTHORIZED (lub FORBIDDEN jeśli rozbudujemy) -> status override 403
- Parent not found -> 404 PARENT_NOT_FOUND
- DB error (network, syntax, RLS misconfig) -> 500 INTERNAL_ERROR
- Email join unavailability -> 500 INTERNAL_ERROR (tymczasowe; docelowo poprawić schemat)

Mapowanie: korzystamy z `createError` i rozszerzamy `ErrorCode`.

## 8. Rozważania dotyczące wydajności
- Paginated list: dwa zapytania (profiles + children counts). Skalowalne dla typowych rozmiarów (<10k rodziców). Możliwa optymalizacja przez single SQL z LEFT JOIN + COUNT(children.id) GROUP BY profile.id (ale Supabase ograniczenia – można użyć RPC). MVP: dwa zapytania prostsze.
- Counting enrollments per child w szczególe: jedno zapytanie GROUP BY. O(liczba dzieci rodzica) – typowo małe.
- Indeksy: istniejący indeks na children(parent_id). Zalecenie: dodać indeks na enrollments(child_id).
- Limit 100 chroni przed dużymi payloadami.
- Search: ILIKE może pełnić pełnotekstowe skanowanie – dodać indeks GIN/trigram w przyszłości jeśli potrzebne.

## 9. Etapy wdrożenia
2. Rozszerzyć `ErrorCode` w `errors.ts` o `PARENT_NOT_FOUND` oraz ewentualnie `FORBIDDEN`.
3. Utworzyć plik `src/lib/validation/admin.parents.schema.ts`:
   - Zod schema dla query: page (default 1, min 1), limit (default 20, min1 max100), search (optional, trim, max len 100).
   - Export typu wynikowego: `ListParentsQuery`.
4. Utworzyć plik `src/lib/services/parents.service.ts` z funkcjami:
   - `listParents(supabase, { page, limit, search }): Promise<ParentsListResponseDTO>`
     a) Build base query: select id, first_name, last_name, created_at from profiles where role='parent'.
     b) Apply search (if provided) via `.or()` constructing ILIKE conditions (first_name,last_name[,email]).
     c) Pagination: range(offset, rangeEnd) + exact count.
     d) Collect ids -> second query children counts.
     e) Map rows -> enforce non-null names (empty string fallback) -> build DTO array.
   - `getParentById(supabase, id: string): Promise<ParentDetailDTO>`
     a) Fetch parent profile (fields + email source). If missing -> PARENT_NOT_FOUND.
     b) Fetch children rows.
     c) If no children -> children=[], enrollments_count=0.
     d) Fetch enrollments count per child (GROUP BY child_id) via single query.
     e) Assemble DTO.
5. Implement endpoint handlers:
   - `src/pages/api/admin/parents.ts` for list (export const GET):
     a) Parse & validate query via schema.
     b) Auth + role check.
     c) Call service & return 200 with JSON.
     d) Error handling wrap (normalizeUnknownError) -> map status & shape ErrorResponseDTO.
   - `src/pages/api/admin/parents/[id].ts` for detail:
     a) Validate UUID param (Zod regex / uuid()).
     b) Auth + role check.
     c) Call service -> return 200.
7. Logowanie błędów: obecny system używa `createError` (brak oddzielnej tabeli). Jeśli dodajemy tabelę audit/errors -> hook w catch blokach endpointu (INSERT code, message, timestamp). MVP: brak implementacji.
9. Weryfikacja RLS: upewnić się, że admin może SELECT na profiles/children/enrollments (polityki). Jeśli brak, dodać RLS policy.

## 10. Założenia / Otwarte kwestie
- Dostęp do email rodzica: wymaga rozszerzenia schematu lub RPC – zaznaczono jako krok migracyjny.
- Search ograniczone do first_name/last_name w MVP jeśli email niedostępny.
- Brak dodatkowej tabeli logów błędów – poza zakresem.
- Zakładamy niską liczbę dzieci na rodzica (kilka), co upraszcza agregacje.

## 11. Edge Cases
- page poza zakresem (np. za duże) -> parents=[] total zachowany.
- limit=100 (maks) -> normalne działanie.
- search pusty string -> traktowany jak brak (po trim) -> pominięcie filtra.
- Rodzic bez dzieci -> children=[], enrollments_count=0 (detail endpoint).
- Dziecko bez enrollments -> enrollments_count=0.
- Null first_name/last_name w DB -> API gwarantuje string: zwracamy "" lub decyzja: wymusić walidacją tworzenia profilu.

## 12. Przykłady zapytań
- Lista: `/api/admin/parents?page=2&limit=50&search=anna`
- Szczegół: `/api/admin/parents/7f4fd3d2-6b0d-4dcb-9df3-9b9d8a2c1abc`

## 13. Walidacja Zod (szkic)
```ts
import { z } from 'zod';
export const listParentsQuerySchema = z.object({
  page: z.preprocess(v => v === undefined ? 1 : Number(v), z.number().int().min(1)),
  limit: z.preprocess(v => v === undefined ? 20 : Number(v), z.number().int().min(1).max(100)),
  search: z.string().trim().min(1).max(100).optional()
});
export type ListParentsQuery = z.infer<typeof listParentsQuerySchema>;
```
UUID walidacja: `z.string().uuid()`.

## 14. Mapowanie statusów HTTP
- 200 OK: lista / szczegół
- 400 VALIDATION_ERROR (schema) / WORKER_HAS_ACTIVITIES analogiczne nie używane tu
- 401 AUTH_UNAUTHORIZED (brak sesji)
- 403 FORBIDDEN (rola != admin) – jeśli brak kodu dodaj status override w createError
- 404 PARENT_NOT_FOUND
- 500 INTERNAL_ERROR

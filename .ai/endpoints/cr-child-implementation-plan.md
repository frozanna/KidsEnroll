# API Endpoint Implementation Plan: Create Child (POST /api/children)

## 1. Przegląd punktu końcowego
Endpoint służy do utworzenia nowego rekordu dziecka (child) powiązanego z aktualnie zalogowanym rodzicem (profile z rolą `parent`). Zapewnia: walidację danych wejściowych, kontrolę uprawnień (autentykacja + rola), wstawienie rekordu do tabeli `children`, zwrócenie pełnego utworzonego obiektu (wraz z `parent_id` i `created_at`). Operacja jest idempotentna tylko w sensie pojedynczego wywołania (brak mechanizmu deduplikacji po imieniu / dacie urodzenia); wielokrotne żądania mogą tworzyć wiele rekordów.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- URL: `/api/children`
- Parametry:
  - Wymagane (body JSON): `first_name`, `last_name`, `birth_date`
  - Opcjonalne (body JSON): `description`
- Body (przykład):
```json
{
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing and music"
}
```
- Nagłówki istotne: `Content-Type: application/json`, nagłówki autentykacji obsługiwane przez Supabase (token Bearer)
- Autentykacja: wymagana (Supabase Auth), rola `parent` w tabeli `profiles`

## 3. Wykorzystywane typy
Z istniejącego pliku `src/types.ts`:
- `CreateChildCommand` (input dla warstwy serwisu)
- `CreateChildResponseDTO` (alias rekordu `ChildEntity` zawierający m.in. `parent_id`, `created_at`)
- `ErrorResponseDTO` (standardowy format błędu)
- `ChildEntity` (DB row; wstawiany rekord)
Dodatkowo w schemacie walidacji:
- Lokalny typ: `CreateChildSchemaInput` (wynik parsowania z Zod, zgodny z `CreateChildCommand`)

## 4. Szczegóły odpowiedzi
- Sukces (201): pełny obiekt dziecka (zgodny z `CreateChildResponseDTO`):
```json
{
  "id": 1,
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing and music",
  "parent_id": "uuid-string",
  "created_at": "2025-01-10T10:00:00Z"
}
```
- Błędy (JSON w formacie `ErrorResponseDTO`):
  - 400 VALIDATION_ERROR (niepoprawny JSON, brak pól, zła data, zbyt długie pola)
  - 401 AUTH_UNAUTHORIZED (brak użytkownika / brak profilu)
  - 403 AUTH_UNAUTHORIZED (nadpisany status przy roli ≠ parent)
  - 500 INTERNAL_ERROR (nieoczekiwane błędy DB / inne wyjątki)

## 5. Przepływ danych
1. Klient wysyła `POST /api/children` z body JSON.
2. Endpoint:
   - Pobiera z `context.locals.supabase` klienta `SupabaseClient`.
   - `supabase.auth.getUser()` → walidacja sesji.
   - Pobiera profil: `profiles.id, role` dla `authData.user.id`.
   - Sprawdza `role === 'parent'`.
   - Próbuje odczytać raw JSON (`request.json()`); jeśli błąd → VALIDATION_ERROR.
   - Waliduje strukturę i podstawowe reguły Zod (plik `children.schema.ts`).
3. Serwis `createChild(supabase, parentId, command)`:
   - (Opcjonalne dodatkowe walidacje semantyczne jeśli nie wykonane w schemacie – np. data nie z przyszłości; można mieć `refine` w schemacie.)
   - Wstawia rekord do `children` z wartościami + `parent_id = parentId`.
   - Po wstawieniu pobiera `id, first_name, last_name, birth_date, description, parent_id, created_at` (select z `maybeSingle`).
   - Zwraca rekord; w razie błędu rzuca `ApiError`.
4. Endpoint loguje wynik (success / error), mapuje `ApiError` na `ErrorResponseDTO` i ustawia status HTTP.

## 6. Względy bezpieczeństwa
- Autentykacja: Supabase JWT (bearer) → `auth.getUser()`. Brak usera → 401.
- Autoryzacja: sprawdzenie roli w `profiles.role`; jeśli ≠ `parent` → 403.
- RLS: Zakładamy wdrożone reguły (opis w planie DB) – gwarantują izolację danych. Jednak `parent_id` jest doklejane serwerowo i nie pochodzi z body (ochrona przed masową modyfikacją / injection).
- Walidacja długości pól:
  - `first_name`, `last_name` max 100 znaków, trim → zapobiega nadużyciu wielkich ciągów.
  - `description` max 1000 znaków (opcjonalna); pusty string → traktujemy jako `null` (normalizacja).
- Walidacja formatu `birth_date` ISO (YYYY-MM-DD) + brak dat przyszłych (refine). Chroni przed bezsensownymi danymi.
- Odporność na injection: Supabase klient buduje zapytania parametryzowane; brak interpolacji stringów.
- Brak nadpisania `parent_id` przez klienta – ignorujemy wszelkie próby podania dodatkowych pól (schema ogranicza).
- Potencjalne DoS: Ograniczenie wielkości pojedynczych pól zmniejsza koszt parsowania.
- Rate limiting: Niewdrożone (zalecenie przyszłe: middleware throttling). Wzmianka w dalszych usprawnieniach.

## 7. Obsługa błędów
| Scenariusz | Kod błędu (`error.code`) | HTTP | Opis |
|------------|---------------------------|------|------|
| Brak / niepoprawny token | AUTH_UNAUTHORIZED | 401 | Nie zalogowany użytkownik |
| Brak profilu | AUTH_UNAUTHORIZED | 401 | Profil powiązany z userem nie istnieje |
| Rola inna niż parent | AUTH_UNAUTHORIZED (status override) | 403 | Zabroniony dostęp |
| Body nie-JSON | VALIDATION_ERROR | 400 | Nie można sparsować body |
| Złe pola / brak wymaganych | VALIDATION_ERROR | 400 | Błędy Zod issues |
| Data urodzenia przyszła | VALIDATION_ERROR | 400 | Semantyczna walidacja daty |
| Zbyt długie pola | VALIDATION_ERROR | 400 | Przekroczone limity długości |
| Błąd DB (insert / select) | INTERNAL_ERROR | 500 | Problem po stronie serwera |
| Niesklasyfikowany wyjątek | INTERNAL_ERROR | 500 | Fallback |

Mapowanie: `ApiError` posiada `code`, `status`, opcjonalne `details`. Endpoint przez `errorToDto()` formatuje odpowiedź zgodnie z `ErrorResponseDTO`.

## 8. Rozważania dotyczące wydajności
- Operacja to pojedynczy insert + pojedynczy select (część supabase `insert().select()`), minimalne obciążenie.
- Indeks na `children.parent_id` przyspiesza zapytania przyszłe (listowanie), nie wpływa negatywnie na tworzenie (niewielki koszt). Już uwzględniony w planie DB.
- Brak potrzeby cache; dane natychmiast wykorzystywane przez klienta.
- Ewentualne mikro-optymalizacje: zredukowanie dodatkowego selecta jeśli Supabase zwraca inserted row (używamy `select()` w tym samym łańcuchu – jest optymalne).

## 9. Etapy wdrożenia
1. Utworzyć plik `src/lib/validation/children.schema.ts`:
   - Definicja: Zod `createChildSchema` z polami: `first_name`, `last_name` → `z.string().trim().min(1).max(100)`; `birth_date` → `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(pastDateCheck)`; `description` → `z.string().trim().max(500).optional().transform(v => v === '' ? null : v)`.
   - Eksport funkcji `validateCreateChildBody(body: unknown)` (analogicznie do `validateCreateEnrollmentBody`).
2. Utworzyć plik `src/lib/services/children.service.ts` z funkcją `createChild(supabase, parentId, command)`:
   - (Jeśli refine daty nie w schemacie: sprawdzić `new Date(birth_date)` czy <= dziś; w razie naruszenia rzucić `createError('VALIDATION_ERROR', 'Birth date cannot be in the future')`.)
   - Wywołać `insert` do tabeli `children` z obiektem: `{ parent_id: parentId, first_name, last_name, birth_date, description }`.
   - Użyć `.select("id, first_name, last_name, birth_date, description, parent_id, created_at").maybeSingle()`.
   - Obsłużyć błąd oraz pusty wynik → `INTERNAL_ERROR`.
   - Zwrócić rekord jako `CreateChildResponseDTO`.
3. Zmodyfikować `src/pages/api/children.ts`:
   - Dodać `POST` export analogiczny stylistycznie do `POST` w `enrollments.ts`.
   - Kroki: auth + profil + rola, parse JSON, walidacja Zod, log start, serwis, log success, zwrot 201.
   - Logowanie JSON (console.log) z polami: `action: "CREATE_CHILD"`, `phase`, `parent_id`, `child_id` (w success/error po uzyskaniu), `timestamp`.
4. Dodać do `errors.ts` ewentualnie nowy kod jeśli potrzebny (na ten moment wystarczą istniejące; nie dodajemy). Używamy `VALIDATION_ERROR` i `INTERNAL_ERROR`.
5. Test manualny (lub jednostkowy jeśli framework testowy dodany później):
   - Scenariusze: brak auth (401), rola ≠ parent (403), pusty body (400), poprawny body (201), future `birth_date` (400).
6. (Opcjonalnie przyszłość) Dodać plan szerszego logowania do ewentualnej tabeli audytowej.
7. Aktualizacja dokumentacji / planów API (już zgodna ze specyfikacją – brak zmian).

## 10. Edge Cases & Uwagi Dodatkowe
- `description` jako pusty string traktowany jako `null` dla spójności z opcjonalną naturą kolumny.
- Nie ma wymagań deduplikacji dzieci o tym samym imieniu/dacie – świadomie pomijamy.
- Weryfikacja formatu daty ogranicza przypadki jak `2020-13-40`; dodatkowy check obiektu `Date` może odrzucić nierealne daty (opcjonalne). Można dodać refine: konstruujemy `dateObj` i sprawdzamy `!isNaN(dateObj.getTime())`.
- Jeśli w przyszłości dojdzie paginacja lub limit dzieci na rodzica – serwis rozszerzymy o dodatkowe zapytania / liczniki.

## 11. Minimalny kontrakt serwisu (dla deweloperów)
- Wejście: `{ first_name, last_name, birth_date, description? }` + `parentId` (string)
- Wyjście: pełny rekord dziecka (`CreateChildResponseDTO`).
- Błędy: rzuca `ApiError` z jednym z kodów: `VALIDATION_ERROR`, `INTERNAL_ERROR`.
- Gwarancje: `parent_id` ustawione prawidłowo, daty nie z przyszłości.

## 12. Logowanie
Struktura wpisów (console.log JSON):
- Start: `{ action: "CREATE_CHILD", phase: "start", parent_id, timestamp }`
- Sukces: `{ action: "CREATE_CHILD", phase: "success", parent_id, child_id, timestamp }`
- Błąd: `{ action: "CREATE_CHILD", phase: "error", parent_id, error_code, status, timestamp }`

## 13. Przyszłe rozszerzenia (Backlog)
- Rate limiting na poziomie middleware.
- Audyt / tabela logów operacji administracyjnych / rodzica.
- Dodatkowe reguły walidacji wieku dziecka (np. minimalny / maksymalny wiek).
- Internationalization dla komunikatów błędów.
- Dedykowany kod błędu np. `CHILD_CREATE_FAILED` (jeśli pojawią się specyficzne scenariusze wstawiania).

# API Endpoint Implementation Plan: List Child's Enrollments (GET /api/children/:childId/enrollments)

## 1. Przegląd punktu końcowego
Punkt końcowy zwraca listę zapisów (enrollments) na zajęcia danego dziecka należącego do uwierzytelnionego rodzica (rola `parent`). Dane obejmują datę zapisu, powiązane zajęcia z podstawowymi informacjami oraz możliwość wycofania zapisu (`can_withdraw`) wyliczaną na podstawie czasu rozpoczęcia zajęć (>= 24h w przyszłości). Zwracana jest pełna lista lub pusty zbiór — brak zapisów nie jest błędem. Endpoint nie implementuje paginacji w MVP (możliwość rozszerzenia później).

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/api/children/:childId/enrollments`
- Parametry:
  - Wymagane: `childId` (segment ścieżki, dodatnia liczba całkowita)
  - Opcjonalne: brak
- Query Params: brak
- Request Body: brak
- Headers: `Authorization: Bearer <token>` (wymagane)

### Walidacja parametrów
- `childId`: walidacja Zod poprzez istniejący `childIdParamSchema` (parsowanie na number, > 0). Błąd walidacji -> 400.
- Autentykacja: sprawdzana przez warstwę middleware (token JWT Supabase). Brak lub nieważny -> 401.
- Autoryzacja: weryfikacja, że profil rodzica (locals.profile.id) jest właścicielem dziecka; rozróżnienie 404 vs 403 (patrz przepływ).

## 3. Wykorzystywane typy
Z pliku `src/types.ts`:
- `EnrollmentActivityNestedDTO` – zagnieżdżona reprezentacja aktywności w kontekście zapisu (id, name, description, cost, start_datetime + worker names).
- `EnrollmentListItemDTO` – pojedynczy zapis: pola z `EnrollmentEntity` + `can_withdraw` + `activity: EnrollmentActivityNestedDTO`.
- `ChildEnrollmentsListResponseDTO` – obiekt odpowiedzi: `{ enrollments: EnrollmentListItemDTO[] }`.
- `ChildDTO` – używany pośrednio przy walidacji własności (poprzez `getChildById`).

Dodatkowe aliasy w kodzie serwisu (lokalne, niewychodzące poza implementację):
- Stała czasu: `WITHDRAW_DEADLINE_MS = 24 * 60 * 60 * 1000`.

## 4. Szczegóły odpowiedzi
### Sukces (200 OK)
```json
{
  "enrollments": [
    {
      "child_id": 1,
      "activity_id": 1,
      "enrolled_at": "2025-01-10T10:00:00Z",
      "can_withdraw": true,
      "activity": {
        "id": 1,
        "name": "Art Class",
        "description": "Creative painting and drawing",
        "cost": 45.0,
        "start_datetime": "2025-01-20T14:00:00Z",
        "worker": { "first_name": "Jane", "last_name": "Doe" }
      }
    }
  ]
}
```
### Błędy
- 400 VALIDATION_ERROR: niepoprawny `childId` (np. znakowe, 0, ujemne).
- 401 AUTH_UNAUTHORIZED: brak lub nieważny token.
- 403 CHILD_NOT_OWNED: dziecko istnieje, ale nie należy do bieżącego rodzica.
- 404 CHILD_NOT_FOUND: dziecko nie istnieje.
- 500 INTERNAL_ERROR: każdy niesklasyfikowany błąd wewnętrzny / błąd zapytań do DB.

Brak dedykowanego kodu błędu dla sytuacji „brak zapisów” — zwracamy pustą listę z 200.

## 5. Przepływ danych
1. Warstwa endpointu pobiera `childId` z `Astro.params` i waliduje przez `childIdParamSchema` (Zod).
2. Middleware wcześniej uwierzytelnia użytkownika i umieszcza `supabase` oraz `profile` w `locals`.
3. Serwis weryfikuje własność dziecka:
   - Próba pobrania rekordu `children` z dopasowaniem `id` + `parent_id = profile.id`.
   - Jeśli brak: druga próba z samym `id` dla rozróżnienia 404 vs 403.
4. Pobranie zapisów:
   - Zapytanie do `enrollments` filtrowane po `child_id`.
   - Zagnieżdżona selekcja: `activities(id, name, description, cost, start_datetime, workers(first_name, last_name))`.
   - Jeden round-trip (eliminuje N+1).
5. Mapowanie wyników do `EnrollmentListItemDTO`:
   - Obliczenie `can_withdraw = (new Date(activity.start_datetime).getTime() - Date.now()) >= WITHDRAW_DEADLINE_MS`.
   - Redukcja danych pracownika do `first_name`, `last_name` (bez email).
6. Konstrukcja `ChildEnrollmentsListResponseDTO` i zwrot JSON.
7. Błędy z serwisu rzutowane na `ApiError` (z `errors.ts`) -> endpoint formatuje do `ErrorResponseDTO`.

## 6. Względy bezpieczeństwa
- IDOR: podwójna walidacja własności (wzorzec z `getChildById`), aby nie ujawniać istnienia cudzego dziecka (403 vs 404).
- Ograniczenie danych: brak adresu email pracownika w odpowiedzi; tylko imię i nazwisko.
- Brak body -> mniejsze ryzyko injection; param walidowany jako liczba całkowita > 0.
- Dane czasu: przetwarzanie w pamięci, brak dynamicznego wykonywania kodu.
- Ochrona przed enumeration timing: ujednolicony przepływ i podobny czas odpowiedzi (brak dodatkowych ciężkich operacji dla 403).
- Uwierzytelnienie: wymuszone przez middleware (token Supabase) -> brak bezpośredniego dostępu anonimowego.
- RLS: Zakładamy włączone polityki RLS w tabelach (defense-in-depth). Mimo RLS robimy manualne sprawdzenie własności (warstwa aplikacji).
- Brak ekspozycji kosztów wewnętrznych poza wymaganymi polami.

## 7. Obsługa błędów
| Scenariusz | Kod ApiError | HTTP | Opis |
|------------|--------------|------|------|
| `childId` niepoprawny (np. "abc", 0) | VALIDATION_ERROR | 400 | Walidacja Zod parametru |
| Brak/nieprawidłowy token | AUTH_UNAUTHORIZED | 401 | Middleware odrzuca dostęp |
| Dziecko nie istnieje | CHILD_NOT_FOUND | 404 | Druga kwerenda po nieudanym owned fetch |
| Dziecko istnieje, ale inny parent | CHILD_NOT_OWNED | 403 | Własność niezgodna |
| Błąd DB podczas fetchu dziecka | INTERNAL_ERROR | 500 | Supabase error message |
| Błąd DB podczas fetchu enrollments | INTERNAL_ERROR | 500 | Supabase error message |
| Dane zagnieżdżone niespójne (brak worker) | INTERNAL_ERROR | 500 | Oczekiwana integralność naruszona |

Format błędu: `ErrorResponseDTO` z `code`, `message`, opcjonalnie `details` (np. issues z Zod).

## 8. Rozważania dotyczące wydajności
- Pojedyncze zagnieżdżone zapytanie eliminuje N+1 dla aktywności/pracownika.
- Indeks `enrollments(child_id)` przyspiesza filtrację.
- Brak paginacji może prowadzić do dużych odpowiedzi dla bardzo aktywnych dzieci — w przyszłości dodać `?page`/`?limit` wraz z typem `PaginationDTO`.
- `can_withdraw` wyliczane w pamięci (O(n)), n = liczba zapisów — tani koszt.
- Możliwe optymalizacje przyszłe: materializowany widok na nadchodzące zajęcia, paginacja, caching warstwowy (ETag / If-None-Match).

## 9. Etapy wdrożenia
1. Dodanie nowej funkcji serwisowej `listChildEnrollments(supabase, parentId: string, childId: number): Promise<ChildEnrollmentsListResponseDTO>` w `src/lib/services/enrollments.service.ts` (lub wydzielenie do nowego pliku jeśli chcemy rozdzielić create/list – w MVP: rozszerzenie istniejącego pliku dla spójności).
   - Reużycie wzorca własności z `getChildById` (rozważ użycie tej funkcji bez powielania kodu, import).
   - Implementacja pojedynczego zapytania zagnieżdżonego.
   - Mapowanie wyników na DTO (kontrola null wartości i integralności).
2. Stała `WITHDRAW_DEADLINE_MS` + helper lokalny obliczający `can_withdraw`.
3. Dodanie (ew. reużycie) walidacji parametru: import `childIdParamSchema` z `children.schema.ts` w nowym endpointzie.
4. Utworzenie pliku endpointu `src/pages/api/children/[id]/enrollments.ts`:
   - `export const prerender = false`.
   - GET handler: pobiera `params.id`, waliduje, pobiera `supabase` i `profile.id` z `locals`.
   - Wywołanie serwisu `listChildEnrollments`.
   - Zwrócenie JSON 200 z `ChildEnrollmentsListResponseDTO`.
   - Blok try/catch: normalizacja błędu (`normalizeUnknownError`), mapowanie na HTTP, zwrot `ErrorResponseDTO`.
5. Weryfikacja formatów dat (`start_datetime`, `enrolled_at`) — ISO 8601 (Supabase zwraca TIMESTAMPTZ -> ISO string). Nie transformować.
6. Linter & typy: uruchomić `eslint` / `tsc` i upewnić się że brak błędów.

## 10. Kontrakt funkcji serwisowej (skrót)
- Input: `supabase: SupabaseClient`, `parentId: string`, `childId: number` (>0)
- Output: `ChildEnrollmentsListResponseDTO`
- Errors: `CHILD_NOT_FOUND | CHILD_NOT_OWNED | INTERNAL_ERROR`
- Edge Cases: brak zapisów -> pusty array, nieprawidłowy `start_datetime` -> INTERNAL_ERROR (nietypowe, oczekiwana integralność).

## 11. Przykład pseudokodu serwisu
```ts
export async function listChildEnrollments(supabase, parentId, childId) {
  // Własność (można reużyć getChildById)
  await getChildById(supabase, parentId, childId); // rzuca ApiError jeśli niepoprawne

  const { data, error } = await supabase
    .from("enrollments")
    .select("child_id, activity_id, enrolled_at, activities(id, name, description, cost, start_datetime, workers(first_name, last_name))")
    .eq("child_id", childId);
  if (error) throw createError("INTERNAL_ERROR", error.message);

  const enrollments = (data || []).map((row) => {
    const act = row.activities;
    if (!act || !act.workers) throw createError("INTERNAL_ERROR", "Missing nested activity/worker data");
    const startsAtMs = new Date(act.start_datetime).getTime();
    const can_withdraw = !Number.isNaN(startsAtMs) && (startsAtMs - Date.now()) >= 24 * 60 * 60 * 1000;
    return {
      child_id: row.child_id,
      activity_id: row.activity_id,
      enrolled_at: row.enrolled_at,
      can_withdraw,
      activity: {
        id: act.id,
        name: act.name,
        description: act.description,
        cost: act.cost,
        start_datetime: act.start_datetime,
        worker: {
          first_name: act.workers.first_name,
          last_name: act.workers.last_name,
        },
      },
    };
  });

  return { enrollments };
}
```

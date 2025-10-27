# API Endpoint Implementation Plan: Update Child (PATCH /api/children/:id)

## 1. Przegląd punktu końcowego
Endpoint służy do częściowej lub pełnej aktualizacji danych dziecka (profil dziecka) należącego do zalogowanego rodzica. Obsługuje zmianę imienia, nazwiska, daty urodzenia oraz opisu. Zapewnia kontrolę własności zasobu (brak możliwości edycji cudzych rekordów) i walidację semantyczną (format daty, brak przyszłych dat). Odpowiedź zwraca pełny zaktualizowany rekord (`ChildEntity` / `CreateChildResponseDTO` shape) z `parent_id`.

## 2. Szczegóły żądania
- Metoda HTTP: PATCH
- Struktura URL: `/api/children/:id`
- Parametry ścieżki:
  - `id` (wymagany): dodatnia liczba całkowita > 0 (identyfikator dziecka)
- Nagłówki:
  - `Authorization: Bearer <JWT>` (Supabase session token)
- Body (JSON) – wszystkie pola opcjonalne, ale musi wystąpić co najmniej jedno:
```json
{
  "first_name": "Alice",        // string > 0, max 100 znaków
  "last_name": "Smith",         // string > 0, max 100 znaków
  "birth_date": "2020-05-15",   // ISO YYYY-MM-DD, nie przyszła data
  "description": "Enjoys drawing" // string max 1000 znaków, pusty string => null
}
```
- Wymagane elementy:
  - Path param: `id`
  - Nagłówek autoryzacji (sesja rodzica)
  - Body z co najmniej jednym polem z zestawu: `first_name`, `last_name`, `birth_date`, `description`
- Niedozwolone pola / ignorowane: `id`, `parent_id`, `created_at` (muszą być niewystawione w schemacie)

## 3. Wykorzystywane typy
- `UpdateChildCommand` (z `types.ts`) – częściowy model aktualizacji (wszystkie pola opcjonalne)
- `ChildEntity` / alias `CreateChildResponseDTO` – pełna odpowiedź rekordowa z parent_id
- `ChildDTO` – używana dla GET (referencja różnicy – tu zwracamy pełen rekord z parent_id)
- Pomocnicze: `ErrorResponseDTO` (kształt błędu), `ApiError` (warstwa usług), `ErrorCode`
- Nowe (do dodania jeśli potrzebne): brak konieczności wprowadzania nowego typu odpowiedzi; wykorzystujemy istniejący alias pełnego wiersza.

## 4. Szczegóły odpowiedzi
- 200 OK (sukces):
```json
{
  "id": 1,
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing, music, and sports",
  "parent_id": "uuid-string",
  "created_at": "2025-01-10T10:00:00Z"
}
```
- Błędy (JSON w kształcie `ErrorResponseDTO`):
  - 400 VALIDATION_ERROR – niepoprawne dane body lub param id
  - 401 AUTH_UNAUTHORIZED – brak ważnej sesji / niewłaściwa rola
  - 403 CHILD_NOT_OWNED – dziecko istnieje, ale należy do innego rodzica
  - 404 CHILD_NOT_FOUND – dziecko o podanym id nie istnieje
  - 500 INTERNAL_ERROR – nieoczekiwany błąd operacji / DB

## 5. Przepływ danych
1. Klient wysyła żądanie PATCH z tokenem sesji Supabase.
2. Middleware / helper `authenticateParent` pobiera profil i weryfikuje rolę `parent`.
3. Walidacja parametru `id` (Zod schema `childIdParamSchema`).
4. Walidacja body w nowym `updateChildSchema` (Zod):
   - Każde pole opcjonalne; refine zapewnia, że >=1 pole obecne.
   - Normalizacja `description": ""` -> `null`.
   - Walidacja daty: regex + przeszłość / dziś.
5. Warstwa service `updateChild`:
   - `UPDATE children SET ... WHERE id = :id AND parent_id = :parentId RETURNING ...` (pojedyncza runda).
   - Jeśli wynik pusty -> dodatkowy SELECT `id, parent_id` po samym `id` dla rozróżnienia 404 vs 403.
6. Zwrócenie zaktualizowanego rekordu do endpointu.
7. Endpoint formatuje odpowiedź JSON (200) lub błąd przez `errorToDto`.
8. Logowanie (JSON) faz: start / success / error.

## 6. Względy bezpieczeństwa
- Autoryzacja: tylko zalogowany rodzic z rolą `parent` (helper `authenticateParent`).
- Własność: filtrowanie `WHERE id = :id AND parent_id = :parentId` w UPDATE.
- RLS w tabeli `children` (obrona dodatkowa) – zakładane aktywne.
- Zapobieganie masowej aktualizacji: aktualizujemy pojedynczy rekord po id; brak batch.
- Whitelist pól: manualne mapowanie tylko do `first_name`, `last_name`, `birth_date`, `description`.
- Ochrona przed injection: Supabase query builder parametryzuje zapytania.
- Walidacja daty i długości stringów ogranicza wektory (np. bardzo długie payloady).
- Brak ekspozycji wrażliwych pól – odsyłamy tylko whitelisted + parent_id.
- Logi nie zawierają danych wrażliwych poza identyfikatorami i kodami błędów.
- Rate limiting (opcjonalny przyszły krok) – nie implementowany teraz, można dodać w middleware.

## 7. Obsługa błędów
| Scenariusz | Kod błędu | HTTP | Opis |
|------------|-----------|------|------|
| Niepoprawny param id | VALIDATION_ERROR | 400 | Regex / typ / <=0 |
| Body pusty lub bez pól | VALIDATION_ERROR | 400 | Refine minimum 1 field |
| Pole first_name / last_name puste | VALIDATION_ERROR | 400 | min(1) |
| birth_date format zły | VALIDATION_ERROR | 400 | Regex YYYY-MM-DD |
| birth_date w przyszłości | VALIDATION_ERROR | 400 | refine past/today |
| Brak sesji / token wygasł | AUTH_UNAUTHORIZED | 401 | brak autoryzacji |
| Rola ≠ parent | AUTH_UNAUTHORIZED | 401 / (ew. 403 jeśli helper tak mapuje) | niedozwolone |
| Dziecko nie istnieje | CHILD_NOT_FOUND | 404 | brak rekordu |
| Dziecko należy do innego rodzica | CHILD_NOT_OWNED | 403 | własność |
| Błąd DB (network, constraint) | INTERNAL_ERROR | 500 | insert/update/select fail |
| Inny nieoczekiwany wyjątek | INTERNAL_ERROR | 500 | fallback |

Mechanika:
- Zod -> `fromZodError` => VALIDATION_ERROR.
- Service -> rzuca `ApiError` (`createError`).
- Endpoint -> `normalizeUnknownError` => mapowanie.

## 8. Rozważania dotyczące wydajności
- Operacja pojedynczej aktualizacji – niski koszt.
- W większości przypadków jedna runda DB (UPDATE ... RETURNING). Druga tylko przy rozróżnieniu 404 vs 403.
- Indeks na `children(parent_id)` wspiera filtr w UPDATE.
- Złożoność czasowa O(1); pamięć minimalna.
- Brak potrzeby cache – dane transakcyjne.
- Optymalizacja: Unikać pobierania zbędnych kolumn (select tylko potrzebne).

## 9. Etapy wdrożenia
1. Utwórz plik `src/lib/validation/children.update.schema.ts` (lub rozszerz istniejący `children.schema.ts` dodając `updateChildSchema`).
   - Schemat: wszystkie pola opcjonalne, długości jak w create, refine ≥1 pola, normalizacja pustego `description`.
2. Dodaj funkcję `validateUpdateChildBody(body: unknown)` – analogicznie do create.
3. W pliku `children.service.ts` dodaj funkcję `updateChild(supabase, parentId, childId, command)`:
   - Zbuduj obiekt aktualizacji tylko z obecnych pól.
   - Jeśli obiekt pusty -> rzuć `createError("VALIDATION_ERROR", "No fields to update")` (obrona adicionalna).
   - Wykonaj `update(...).eq("id", childId).eq("parent_id", parentId).select("id, first_name, last_name, birth_date, description, parent_id, created_at").maybeSingle()`.
   - Jeśli brak danych: drugi SELECT `id, parent_id` dla rozróżnienia -> rzuć `CHILD_NOT_FOUND` lub `CHILD_NOT_OWNED`.
4. Dodaj endpoint `PATCH` w `src/pages/api/children/[id].ts` (obok GET):
   - Export `PATCH: APIRoute`.
   - Walidacja `id` (reuse `childIdParamSchema`).
   - Autentykacja `authenticateParent`.
   - Walidacja body `validateUpdateChildBody`.
   - Log start (action: UPDATE_CHILD, phase: start).
   - Wywołanie `updateChild`.
   - Log success (phase: success).
   - Zwróć JSON (200).
   - Obsługa błędu -> mapowanie -> log error (phase: error, code/status).
5. Testy (jeśli harness istnieje / w przyszłości):
   - Sukces: aktualizacja pojedynczego pola (np. description).
   - Sukces: wielopolowa aktualizacja.
   - Błąd: body puste.
   - Błąd: future birth_date.
   - Błąd: child not found.
   - Błąd: child owned by inny rodzic (symulacja innym parentId).

## 10. Mini kontrakt funkcji `updateChild`
- Wejście: `(supabase: SupabaseClient, parentId: string, childId: number, command: UpdateChildCommand)`
- Wyjście: `Promise<CreateChildResponseDTO>` (pełny rekord)
- Błędy: rzuca `ApiError` kodami: CHILD_NOT_FOUND | CHILD_NOT_OWNED | VALIDATION_ERROR | INTERNAL_ERROR
- Warunki brzegowe: pusty command -> VALIDATION_ERROR, childId <=0 -> walidacja param, brak pól -> refine.

## 11. Edge cases
- Pusty JSON `{}` -> 400 VALIDATION_ERROR.
- Wszystkie pola ustawione na te same wartości -> dozwolone (update zwróci rekord).
- `description` pusty string -> zapis jako `null`.
- `birth_date` 0000-00-00 -> regex odrzuci.
- `birth_date` niepoprawna (np. 2025-13-40) -> refine odrzuci (Date invalid).
- Wielkie spacje w imieniu -> `.trim()` usuwa; jeśli po trim pusty -> min(1) odrzuca.

## 12. Dane logów
Przykłady wpisów:
```json
{ "action": "UPDATE_CHILD", "phase": "start", "parent_id": "<uuid>", "child_id": 12, "timestamp": "..." }
{ "action": "UPDATE_CHILD", "phase": "success", "parent_id": "<uuid>", "child_id": 12, "timestamp": "..." }
{ "action": "UPDATE_CHILD", "phase": "error", "parent_id": "<uuid>", "child_id": 12, "error_code": "CHILD_NOT_FOUND", "status": 404, "timestamp": "..." }
```
---
Plan gotowy do implementacji zgodnie z przyjętymi konwencjami projektu.
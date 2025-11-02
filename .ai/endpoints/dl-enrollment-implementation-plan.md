# API Endpoint Implementation Plan: Delete Enrollment (Withdraw Child from Activity)

## 1. Przegląd punktu końcowego
Endpoint umożliwia rodzicowi wycofanie dziecka z wcześniej zapisanych zajęć (usunięcie rekordu z tabeli `enrollments`). Operacja jest dozwolona wyłącznie jeśli do rozpoczęcia zajęć pozostało co najmniej 24 godziny. Zapewnia kontrolę własności (dziecko należy do zalogowanego rodzica), walidację parametrów oraz spójne kody błędów. Wykorzystuje istniejące wzorce architektoniczne (warstwa service + transport) oraz centralny mechanizm błędów.

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: `/api/enrollments/:childId/:activityId`
- Parametry:
  - Wymagane Path Params:
    - `childId` (number, int > 0)
    - `activityId` (number, int > 0)
  - Opcjonalne: brak
- Request Body: brak (brak treści żądania)
- Headers: `Authorization: Bearer <access_token>` (wymagane)

### Walidacja parametrów (Transport Layer)
Zostanie dodany Zod schema:
```ts
const withdrawParamsSchema = z.object({
  childId: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
  activityId: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
});
```
Konwersja string -> number z kontrolą błędów. Błędy walidacji mapowane do `VALIDATION_ERROR` (HTTP 400).

## 3. Wykorzystywane typy
- `DeleteEnrollmentResponseDTO` (już zdefiniowany w `types.ts`): `{ message: string }`
- `ErrorResponseDTO`
- Nowe kody błędów (wymagane dopisanie w `errors.ts`):
  - `ENROLLMENT_NOT_FOUND` (404)
  - `WITHDRAWAL_TOO_LATE` (400) – naruszenie okna >= 24h

Aktualizacja enumu `ErrorCode` + `STATUS_MAP` w `errors.ts`.

## 4. Szczegóły odpowiedzi
- Success (200 OK):
```json
{ "message": "Child successfully withdrawn from activity" }
```
- Error Responses (JSON shape `ErrorResponseDTO`):
  - 400 `VALIDATION_ERROR`: Nieprawidłowe parametry / próba wycofania < 24h przed startem (`WITHDRAWAL_TOO_LATE`)
  - 401 `AUTH_UNAUTHORIZED`: Brak lub nieważny token / rola ≠ parent
  - 403 `CHILD_NOT_OWNED`: Dziecko nie należy do rodzica
  - 404 `ENROLLMENT_NOT_FOUND` lub `CHILD_NOT_FOUND` / `ACTIVITY_NOT_FOUND` (detale poniżej) 
  - 500 `INTERNAL_ERROR`: Niespodziewany błąd

## 5. Przepływ danych
1. Klient wysyła żądanie DELETE z bearer tokenem do `/api/enrollments/:childId/:activityId`.
2. Transport layer:
   - Autoryzacja: `authenticateParent(supabase)` zwraca profil (id, role); w razie błędu mapuje do `AUTH_UNAUTHORIZED`.
   - Walidacja parametrów przez Zod.
3. Delegacja do service `withdrawEnrollment(supabase, parentId, childId, activityId)`:
   - Sprawdzenie własności dziecka: podobny wzorzec jak w `createEnrollment` (dwa zapytania aby rozróżnić 404 vs 403).
   - Pobranie obecnego enrollment + powiązanego `start_datetime` z `activities` w jednym zapytaniu:
     ```sql
     select child_id, activity_id, activities(start_datetime)
     from enrollments
     where child_id = :childId and activity_id = :activityId
     limit 1;
     ```
   - Jeśli brak rekordu → `ENROLLMENT_NOT_FOUND` (404). Można wcześniej opcjonalnie sprawdzić istnienie activity/child aby zwrócić precyzyjniejszy kod (patrz sekcja błędów).
   - Obliczenie deadline: `new Date(start_datetime).getTime() - Date.now() >= 24h`.
   - Jeśli < 24h → `WITHDRAWAL_TOO_LATE` (400).
   - Usunięcie enrollment: `delete from enrollments where child_id = :childId and activity_id = :activityId returning child_id;` (walidacja że usunięto 1 wiersz).
4. Service zwraca `DeleteEnrollmentResponseDTO`.

### Alternatywa (Atomic check + delete)
Możliwa przyszła optymalizacja: pojedyncza funkcja RPC lub warunek `delete ... where ... and activities.start_datetime > (now() + interval '24 hours')` (wymaga join w subselect). Na razie pozostajemy przy czytelności.

## 6. Względy bezpieczeństwa
- Uwierzytelnianie: Supabase JWT (bearer) – wykorzystanie istniejącej funkcji `authenticateParent`.
- Autoryzacja: weryfikacja, że profil ma rolę `parent` oraz że `child.parent_id === parentId`.
- Ochrona przed IDOR: wyraźne sprawdzenie własności dziecka przed operacją.
- RLS: Zakładamy aktywne polityki w bazie; mimo to wykonujemy jawne sprawdzenia dla spójnego kodu błędów.
- Walidacja parametrów zapobiega SQL injection (liczby int > 0)
- Strefa czasowa: używać czasu z instancji aplikacji (UTC) – upewnić się, że `start_datetime` jest TIMESTAMPTZ i interpretowany w UTC. Dokumentacja w komentarzu.
- Brak treści w body minimalizuje powierzchnię ataku.

## 7. Obsługa błędów
| Scenariusz | Kod błędu | HTTP | Opis |
|------------|-----------|------|------|
| Parametry niepoprawne (non-int / <=0) | VALIDATION_ERROR | 400 | Walidacja Zod |
| Brak/expired token | AUTH_UNAUTHORIZED | 401 | `authenticateParent` rzuca ApiError |
| Rola nie parent | AUTH_UNAUTHORIZED (lub alternatywnie 403, lecz spójność z istniejącym kodem) | 401 | Odmowa dostępu |
| Dziecko nie istnieje | CHILD_NOT_FOUND | 404 | Własność fallback po drugim zapytaniu |
| Dziecko należy do innego rodzica | CHILD_NOT_OWNED | 403 | Weryfikacja parent_id |
| Enrollment nie istnieje | ENROLLMENT_NOT_FOUND | 404 | Brak rekordu pary child/activity |
| Activity nie istnieje (opcjonalne rozróżnienie) | ACTIVITY_NOT_FOUND | 404 | Jeśli sprawdzamy przed enrollment |
| < 24h do startu | WITHDRAWAL_TOO_LATE | 400 | Warunek deadline |
| Format daty startu nieprawidłowy | INTERNAL_ERROR | 500 | Dane niespójne |
| Inny niespodziewany wyjątek | INTERNAL_ERROR | 500 | Fallback |

Strategia: minimalne dodatkowe zapytania (preferujemy ENROLLMENT_NOT_FOUND zamiast rozbijania na brak child/activity, chyba że spec rozszerzy wymagania). Można skonfigurować feature flag w przyszłości.

## 8. Rozważania dotyczące wydajności
- Dane wejściowe małe; brak body → szybkie parsowanie.
- Jedno zapytanie SELECT + jedno DELETE (2 round-trips). Akceptowalne dla MVP.
- Indeks (PK) na enrollments (child_id, activity_id) zapewnia O(log n) dostęp.
- Możliwa przyszła optymalizacja: pojedyncze CTE z warunkiem czasowym oraz DELETE RETURNING.
- Unikać niepotrzebnych dodatkowych zapytań (np. oddzielnego pobrania activity) – start_datetime dostępne przez relację; jeśli PostgREST nie zwróci nested bez explicit join, użyć dodatkowego SELECT (trade-off prostoty vs 1 zapytanie). Plan: jeden SELECT enrollment + nested activity.

## 9. Etapy wdrożenia
1. Dodaj nowe kody błędów w `src/lib/services/errors.ts`: `ENROLLMENT_NOT_FOUND`, `WITHDRAWAL_TOO_LATE` + wpisy w `STATUS_MAP`.
2. Utwórz Zod schema `withdrawParamsSchema` w nowym pliku `src/lib/validation/enrollments.withdraw.schema.ts` (lub rozszerz istniejący `enrollments.schema.ts`).
3. Dodaj funkcję service `withdrawEnrollment(supabase, parentId, childId, activityId)` w `enrollments.service.ts`:
   - Wzorzec walidacji własności dziecka jak w `createEnrollment`.
   - SELECT enrollment z nested activity start_datetime.
   - Sprawdź 24h warunek; rzuć `WITHDRAWAL_TOO_LATE` jeśli niespełniony.
   - DELETE ... RETURNING; jeśli brak wiersza → `ENROLLMENT_NOT_FOUND`.
   - Zwróć `{ message: "Child successfully withdrawn from activity" }`.
4. Dodaj endpoint file: `src/pages/api/enrollments/[childId]/[activityId].ts`:
   - `export const prerender = false;`
   - Implementuj `DELETE: APIRoute`.
   - Auth via `authenticateParent`.
   - Parsuj params -> Zod.
   - Log: action `WITHDRAW_ENROLLMENT` (phase: start/success/error) JSON structured.
   - Delegacja do service; mapowanie ApiError -> DTO via istniejące helpery.
5. Testy manualne / e2e (przykłady curl):
   - Sukces >24h.
   - Próba <24h (ustaw testową activity). 
   - Brak enrollment.
   - Dziecko innego rodzica.
   - Nieprawidłowe parametry (np. `abc`).
6. Refaktoryzacje (opcjonalne): przeniesienie wspólnych parametrów do jednego pliku schema.

## 10. Edge Cases i Uwagi Techniczne
- Race condition: wycofanie na granicy 24h – akceptujemy milisekundową różnicę czasu serwera vs klienta (pobieramy czas w Node). W przyszłości: użyć `SELECT now()` z DB dla porównania.
- Strefy czasowe: Upewnij się, że `start_datetime` jest w UTC (TIMESTAMPTZ). Jeśli różne strefy, normalizuj do UTC przed porównaniem.
- Dane niespójne (brak nested activity) → `INTERNAL_ERROR` aby wskazać problem integralności.
- Jeśli enrollment istnieje ale activity usunięte (teoretycznie dzięki ON DELETE CASCADE nie wystąpi) – traktować jako `INTERNAL_ERROR`.

## 11. Przykładowy Logging (JSON)
Start:
```json
{"action":"WITHDRAW_ENROLLMENT","phase":"start","parent_id":"<uuid>","child_id":123,"activity_id":456,"timestamp":"<iso>"}
```
Sukces:
```json
{"action":"WITHDRAW_ENROLLMENT","phase":"success","parent_id":"<uuid>","child_id":123,"activity_id":456,"timestamp":"<iso>"}
```
Błąd:
```json
{"action":"WITHDRAW_ENROLLMENT","phase":"error","parent_id":"<uuid>","child_id":123,"activity_id":456,"error_code":"WITHDRAWAL_TOO_LATE","status":400,"timestamp":"<iso>"}
```

## 12. Kryteria Akceptacji
- Usunięcie enrollment działa tylko gdy >24h do startu.
- Błędy zwracają poprawne kody HTTP oraz `error.code` zgodne z mapą.
- Brak body → brak błędów parsowania JSON (nie wymaga content-type).
- Struktura plików zgodna z konwencjami repo.
- Logging zgodny ze wzorcem istniejących endpointów.
- Dodane kody błędów nie naruszają istniejących testów (jeśli pojawią się testy w przyszłości).
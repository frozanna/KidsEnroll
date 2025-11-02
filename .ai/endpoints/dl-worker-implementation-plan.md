# API Endpoint Implementation Plan: Delete Worker (DELETE /api/admin/workers/:id)

## 1. Przegląd punktu końcowego
Endpoint umożliwia usunięcie pracownika (worker) przez administratora systemu pod warunkiem, że dany pracownik nie jest przypisany do żadnych istniejących zajęć (`activities`). Operacja jest nieodwracalna i kaskadowo usuwa tylko rekord w tabeli `workers` (inne tabele nie posiadają bezpośrednich zależności poza kluczem obcym w `activities`, dlatego musimy wymusić brak powiązań przed usunięciem). Służy do utrzymania aktualnej listy kadry. Wspiera spójne logowanie zdarzeń oraz jednolite modelowanie błędów.

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: `/api/admin/workers/:id`
- Parametry:
  - Wymagane (Path): `id` (pozytywny integer > 0)
  - Opcjonalne: brak parametrów zapytania, brak body
- Request Body: brak (ignorujemy ewentualną zawartość, zwracamy błąd jeśli ktoś prześle? -> strategia: zignorować; brak body jest wymogiem)
- Nagłówki: `Authorization: Bearer <token>` (token Supabase) – autoryzuje użytkownika i jego rolę.

## 3. Wykorzystywane typy
- DTO odpowiedzi sukcesu: `WorkerDeleteResponseDTO` (zdefiniowany w `src/types.ts`): `{ message: string }`
- Typ błędu: `ErrorResponseDTO`
- Klasy i helpery błędów: `ApiError`, `createError`, `normalizeUnknownError` z `src/lib/services/errors.ts`
- Walidacja parametru: `validateWorkerIdParam` z `src/lib/validation/workers.schema.ts`
- Klient bazy: `SupabaseClient` z `src/db/supabase.client.ts`

Nowe / rozszerzone:
- Rozszerzymy `ErrorCode` o nowy kod: `WORKER_HAS_ACTIVITIES` (HTTP 400) – sytuacja gdy worker jest przypisany do co najmniej jednej aktywności.

## 3. Szczegóły odpowiedzi
- Sukces (200 OK):
```json
{ "message": "Worker deleted successfully" }
```
- Błędy:
  - 400 Bad Request: `WORKER_HAS_ACTIVITIES` lub `VALIDATION_ERROR` (np. niepoprawny id)
  - 401 Unauthorized: `AUTH_UNAUTHORIZED` (brak lub niepoprawny token / sesja) – z mechanizmu `authenticateAdmin`
  - 403 Forbidden: (gdy rola != admin) – obecnie odwzorowane jako `AUTH_UNAUTHORIZED` lub można rozszerzyć; zgodnie ze specyfikacją zwrócimy 403 jeśli rola nie jest admin. Użyjemy `createError("AUTH_UNAUTHORIZED", ...)` z nadpisaniem status=403.
  - 404 Not Found: `WORKER_NOT_FOUND`
  - 500 Internal Server Error: `INTERNAL_ERROR`

Struktura błędu:
```json
{
  "error": {
    "code": "WORKER_NOT_FOUND",
    "message": "Worker not found",
    "details": { /* opcjonalne */ }
  }
}
```

## 4. Przepływ danych
1. Klient (Admin panel) wysyła `DELETE /api/admin/workers/123` z nagłówkiem Authorization.
2. Middleware / helper `authenticateAdmin` pobiera i waliduje sesję za pomocą Supabase, sprawdza rolę w profilu.
3. Walidacja parametru `id` (`validateWorkerIdParam`) – Zod transformuje string na number i wymusza >0.
4. Serwis `deleteWorker` (nowa funkcja w `workers.service.ts`):
   - Sprawdza istnienie worker’a – pojedyncze zapytanie SELECT (możemy pominąć kolumny poza id dla minimalizmu, lub użyć existing pattern). Jeśli brak -> `WORKER_NOT_FOUND`.
   - Sprawdza powiązane aktywności: zapytanie `select id` z tabeli `activities` z `worker_id = id` ograniczone do jednej sztuki (`limit 1`). Jeśli istnieje -> `WORKER_HAS_ACTIVITIES`.
   - Wykonuje `delete` na tabeli `workers` (warunek id) i oczekuje success (Supabase: `.delete().eq("id", id)`).
5. Endpoint loguje: `DELETE_WORKER` w fazach `start`, `success`, `error` (JSON log to console).
6. Zwraca wynik JSON sukcesu lub błąd z odpowiednim statusem.

## 5. Względy bezpieczeństwa
- Autentykacja: Supabase JWT; wykorzystanie istniejącego helpera `authenticateAdmin` (upewnić się, że różnicuje 401 vs 403 – jeśli nie, wymusić status override=403 dla nie-admin role).
- Autoryzacja: tylko użytkownicy z rolą `admin`. Rodzic nie może usuwać pracownika.
- Walidacja danych wejściowych: Path param `id` zwalidowany przez Zod; brak body -> brak potrzeby walidacji payload.
- Ochrona przed enumeracją ID: standardowe 404 dla nieistniejących workerów; brak ujawniania, czy worker miał aktywności w 404 case.
- Ochrona integralności: Precondition check aby nie usuwać pracownika przypisanego do aktywności (zapobiega osieroconym rekordom lub naruszeniu obcych kluczy).
- Brak side-channel: Używamy minimalnych SELECT (limit 1) dla checków.
- Rate limiting (opcjonalne w przyszłości) – nie implementujemy teraz.

## 6. Obsługa błędów
Potencjalne scenariusze:
- Invalid param (np. `id=abc`): Zod -> `VALIDATION_ERROR` 400.
- Brak nagłówka Authorization / wygasła sesja: `AUTH_UNAUTHORIZED` 401.
- Rola != admin: `AUTH_UNAUTHORIZED` z override status=403 (Forbidden).
- Worker nie istnieje: `WORKER_NOT_FOUND` 404.
- Worker posiada przypisane aktywności: `WORKER_HAS_ACTIVITIES` 400.
- Konflikt DB / błąd zapytania: `INTERNAL_ERROR` 500.
- Nieoczekiwany wyjątek: `INTERNAL_ERROR` 500.

Mapowanie kodów (rozszerzenie `STATUS_MAP`):
- `WORKER_HAS_ACTIVITIES` -> 400.

Logowanie błędów: konsola w formacie JSON (spójne z istniejącymi endpointami). W przyszłości można rozszerzyć o centralny system (np. table `error_logs`). Obecnie brak implementacji takiej tabeli – notujemy jako potencjalny future improvement.

## 7. Rozważenia dotyczące wydajności
- Precondition check używa `select id` + `limit 1` na `activities` – minimalizuje transfer danych.
- Dwa dodatkowe zapytania (istnienie + powiązania) przed delete – konieczność z uwagi na semantykę i uniknięcie naruszenia FK (chociaż FK ON DELETE CASCADE w `activities` nie istnieje – jest odwrotny kierunek; worker_id w `activities` ma CASCADE co spowodowałoby kaskadowe usunięcie aktywności? Spec mówi: usuwamy tylko jeśli brak aktywności -> musimy manualnie blokować mimo CASCADE). Jeśli w schemacie jest `ON DELETE CASCADE` na `activities.worker_id` (tak jest w planie), to usuwając worker usunęlibyśmy aktywności – niepożądane. Precondition uniknie niezamierzonej kaskady.
- Możliwe race condition: równoczesne przypisanie aktywności do worker’a po precondition a przed delete. Ryzyko minimalne; można rozważyć transakcję RPC w przyszłości. Na razie akceptujemy okienko.
- Indeks na `activities.worker_id` (pośrednio) umożliwia szybkie sprawdzenie powiązań.

## 8. Etapy wdrożenia
1. Rozszerz `ErrorCode` w `src/lib/services/errors.ts` o `WORKER_HAS_ACTIVITIES` + wpis do `STATUS_MAP` (400).
2. Dodaj funkcję `deleteWorker(supabase: SupabaseClient, id: number): Promise<WorkerDeleteResponseDTO>` do `workers.service.ts`:
   - SELECT `id` FROM `workers` WHERE `id` = :id (maybeSingle) -> jeśli brak -> `WORKER_NOT_FOUND`.
   - SELECT `id` FROM `activities` WHERE `worker_id` = :id LIMIT 1 -> jeśli istnieje -> `WORKER_HAS_ACTIVITIES`.
   - DELETE FROM `workers` WHERE `id` = :id -> sprawdź `error` i `count` (opcjonalnie) / jeśli `error` -> `INTERNAL_ERROR`.
   - Return `{ message: "Worker deleted successfully" }`.
3. Utwórz endpoint `DELETE` w `src/pages/api/admin/workers/[id].ts` poniżej istniejących metod:
   - `export const DELETE: APIRoute = async (context) => { ... }`
   - Autentykacja `authenticateAdmin`
   - Walidacja `id` param via `validateWorkerIdParam`
   - Log start: `{ action: "DELETE_WORKER", phase: "start", admin_id, worker_id, timestamp }`
   - Wywołanie `deleteWorker`
   - Log success / error z kodem błędu
   - `jsonResponse` ze statusem 200 lub błędem
4. Aktualizuj dokumentację / plan endpointów (np. w `.ai/endpoints/...` jeśli istnieje) – dodać opis DELETE.
5. Dodać test jednostkowy (jeśli framework testowy jest skonfigurowany – brak w repo; odłożyć na później) – potencjalne scenariusze: sukces, has activities, not found.
6. Manualna weryfikacja lokalna (po wdrożeniu):
   - Utwórz worker -> delete (powinno działać)
   - Przypisz worker do aktywności -> delete (400 WORKER_HAS_ACTIVITIES)
   - Delete non-existent id -> 404 WORKER_NOT_FOUND
   - Delete bez autoryzacji -> 401
   - Delete jako parent -> 403
7. Review log output formatting dla spójności.
8. (Opcjonalnie) Rozważyć transakcyjny RPC aby wyeliminować race condition (future task).

## 9. Edge Cases Checklist
- id = 0 / ujemny / nie-numeric -> VALIDATION_ERROR
- Worker istnieje, ale ma aktywności -> WORKER_HAS_ACTIVITIES (400)
- Worker istnieje, nie ma aktywności -> sukces 200
- Równoczesne przypisanie aktywności tuż przed delete -> możliwe usunięcie wraz z aktywnościami (FK CASCADE) – zaakceptowany risk w MVP
- Supabase downtime / error -> INTERNAL_ERROR 500

## 10. Kontrakt funkcji serwisowej (deleteWorker)
- Input: `(supabase: SupabaseClient, id: number)` (id > 0 gwarantowane przez walidację endpointu)
- Output: `WorkerDeleteResponseDTO`
- Errors: throws `ApiError` (WORKER_NOT_FOUND, WORKER_HAS_ACTIVITIES, INTERNAL_ERROR)
- Side effects: Usunięcie rekordu w `workers`

## 11. Przyszłe rozszerzenia (not in scope now)
- Audyt usunięć (tabela `worker_audit_log`)
- Transakcyjny stored procedure do atomowego sprawdzenia i kasacji
- Soft-delete kolumna `deleted_at` zamiast fizycznego usunięcia
- Emisja eventu (webhook / queue) dla systemów zewnętrznych


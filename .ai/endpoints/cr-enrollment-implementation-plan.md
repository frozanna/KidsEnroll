# API Endpoint Implementation Plan: Create Enrollment (POST /api/enrollments)

## 1. Przegląd punktu końcowego
Endpoint umożliwia zapisanie dziecka (child) na wybrane zajęcia (activity). Tworzy nowy rekord w tabeli `enrollments` (klucz złożony: `child_id`, `activity_id`). Zwraca szczegóły zapisu wraz z wybranymi polami aktywności i dziecka. Operacja dostępna wyłącznie dla użytkowników z rolą `parent`.

Cele biznesowe:
- Centralizacja procesu zapisów na zajęcia dodatkowe.
- Walidacja własności dziecka (brak możliwości zapisu cudzego dziecka).
- Respektowanie limitu miejsc (`participant_limit`).
- Zapobieganie duplikatom (z wykorzystaniem PK i pre-checków).

Reguły (odwołania do zasad): @shared.mdc, @backend.mdc, @astro.mdc.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- URL: `/api/enrollments`
- Autentykacja: Wymagana (Bearer JWT przez Supabase).
- Autoryzacja: Rola `parent`.
- Body (JSON):
```json
{
  "child_id": 1,
  "activity_id": 1
}
```

Parametry:
- Wymagane (body): `child_id` (int > 0), `activity_id` (int > 0)
- Opcjonalne: brak
- Nagłówki: `Authorization: Bearer <token>`

Walidacja wstępna:
- Struktura i typy -> Zod schema
- Liczby całkowite dodatnie

## 3. Wykorzystywane typy
Z pliku `src/types.ts`:
- `CreateEnrollmentCommand` – struktura wejściowa (body)
- `CreateEnrollmentResponseDTO` – struktura sukcesu 201
- `ErrorResponseDTO` – zunifikowane odpowiedzi błędów
- Internally:
  - `ActivityEntity` (SELECT aktywności)
  - `ChildEntity` (SELECT dziecka)
  - `EnrollmentEntity` (INSERT)

## 4. Szczegóły odpowiedzi
Sukces (201 Created):
```json
{
  "child_id": 1,
  "activity_id": 1,
  "enrolled_at": "2025-01-10T10:00:00Z",
  "activity": {
    "name": "Klasa Artistyczna",
    "start_datetime": "2025-01-20T14:00:00Z",
    "cost": 45.00
  },
  "child": {
    "first_name": "Alicja",
    "last_name": "Kowalska"
  }
}
```

Kody statusu:
- 201: Udane utworzenie zapisu
- 400: Błędne dane wejściowe / brak miejsc / duplikat / zajęcia już się rozpoczęły
- 401: Brak autentykacji / nieważny token
- 403: Dziecko nie należy do zalogowanego rodzica
- 404: Dziecko lub aktywność nie istnieje
- 500: Niespodziewany błąd serwera / transakcji / bazy

Format błędu (przykład):
```json
{
  "error": {
    "code": "ACTIVITY_FULL",
    "message": "Activity has no available spots"
  }
}
```

## 5. Przepływ danych
1. Klient wysyła POST z body (child_id, activity_id).
2. Middleware autentykacji korzysta z Supabase (`context.locals.supabase.auth.getUser()`), pobiera profil + rolę.
3. Handler endpointu:
   - Parsuje i waliduje body (Zod).
   - Sprawdza rolę `parent` (inaczej 403 lub 401 jeśli brak tokena).
   - Wywołuje serwis `enrollmentsService.createEnrollment(...)`.
4. Serwis:
   - SELECT dziecka z `children` WHERE id = child_id AND parent_id = currentParentId -> brak: jeśli nie istnieje globalnie 404, a jeśli istnieje lecz nie należy do parenta 403.
   - SELECT aktywności z `activities` WHERE id = activity_id -> brak: 404.
   - Sprawdzenie `start_datetime > now()` -> gdy nie: 400.
   - Liczenie zapisów: `SELECT COUNT(*) FROM enrollments WHERE activity_id = $1` i porównanie do `participant_limit` -> pełne: 400.
   - Sprawdzenie duplikatu: `SELECT 1 FROM enrollments WHERE child_id = $1 AND activity_id = $2` -> istnieje: 400.
   - INSERT INTO enrollments (child_id, activity_id, enrolled_at default).
   - SELECT minimalnych danych do odpowiedzi (JOIN children, activities).
5. Zwrócenie odpowiedzi 201 z `CreateEnrollmentResponseDTO`.
6. Błędy w trakcie -> mapowanie do `ErrorResponseDTO` i odpowiedniego statusu.

Opcjonalnie (concurrency hardening): RPC SQL function z blokadą `SELECT ... FROM activities WHERE id = $1 FOR UPDATE` + warunki w transakcji.

## 6. Względy bezpieczeństwa
- Autentykacja: Supabase JWT / session; brak wstrzykiwania tokenów do zapytań – używamy oficjalnego klienta.
- Autoryzacja zasobów: Dziecko musi być powiązane z aktualnym `parent_id`.
- IDOR: Bezpośrednie ID obce w body – zabezpieczone sprawdzaniem własności.
- Race condition przy ostatnim miejscu: potencjalny podwójny zapis – wzmianka w krokach optymalizacji o wykorzystaniu transakcji / RPC.
- Minimalna ekspozycja danych: zwracamy tylko definicję z typu `CreateEnrollmentResponseDTO` (bez email dziecka, bez kosztów spoza aktywności, bez parent_id).
- Walidacja typów: Zod zapobiega przyjęciu stringów zamiast liczb.
- Ochrona przed enumeracją: Rozróżniamy 403 vs 404 zgodnie z wymaganiem

## 7. Obsługa błędów
Mapa kodów:
- VALIDATION_ERROR -> 400 (np. ujemne ID, brak pola)
- CHILD_NOT_FOUND -> 404
- ACTIVITY_NOT_FOUND -> 404
- CHILD_NOT_OWNED -> 403
- ACTIVITY_STARTED -> 400
- ACTIVITY_FULL -> 400
- ENROLLMENT_DUPLICATE -> 400
- AUTH_UNAUTHORIZED -> 401
- INTERNAL_ERROR -> 500

Strategia:
- W serwisie rzucamy kontrolowane błędy (np. poprzez helper `throwApiError(code, message)`)
- W endpoint handler catch: mapowanie do `ErrorResponseDTO` + status.
- Błędy niekontrolowane -> 500 + logowanie stack trace.

## 8. Rozważania dotyczące wydajności
- Liczenie wolnych miejsc: pojedyncze `COUNT(*)` per request – akceptowalne w MVP
- Concurrency: Jeśli wysoki ruch przy zapisie, warto przenieść logikę do transakcyjnej funkcji SQL.
- Redukcja round-trips: Serwis może wykonać zbiorcze zapytania (np. pobranie aktywności i aktualnej liczby zapisów jednym SELECT z subquery).

## 9. Etapy wdrożenia
1. Utwórz plik `src/lib/validation/enrollments.schema.ts` z Zod schemą:
   - `export const createEnrollmentSchema = z.object({ child_id: z.number().int().positive(), activity_id: z.number().int().positive() });`
2. Dodaj serwis `src/lib/services/enrollments.service.ts`:
   - Eksport funkcji `createEnrollment(supabase, parentId, command)`.
   - Implementacja kroków: validate ownership, fetch activity, check capacity, check duplicate, insert, fetch response.
   - Wewnętrzny typ błędu lub użycie istniejącej struktury (`throwApiError`).
3. Utwórz helper błędów `src/lib/services/errors.ts` (jeśli nie istnieje):
   - Funkcja `createError(code: string, message: string, status: number)`.
   - Można dodać mapę kod→status.
4. Utwórz endpoint `src/pages/api/enrollments.ts`:
   - `export const prerender = false;`
   - Import schemy Zod, serwisu.
   - Pobierz supabase z `context.locals.supabase`.
   - Sprawdź użytkownika i rolę (SELECT profiles WHERE id = user.id; confirm role === 'parent').
   - Parsuj body `await request.json()` + walidacja.
   - Wywołaj serwis.
   - Zwróć 201 z JSON.
   - Obsłuż błędy (try/catch, mapowanie do `ErrorResponseDTO`).
5. Krótki audit log – w loggerze wypisz: action="ENROLL_CHILD" user=<id> child_id=<id> activity_id=<id> success=true/false.

## 10. Kryteria akceptacji
- 201 zwraca pełny `CreateEnrollmentResponseDTO` zgodnie z typem.
- Błędy zgodnie z tabelą kodów i statusem.
- Nie można zapisać cudzego dziecka.
- Nie można przekroczyć limitu miejsc.
- Duplikat zwraca 400 bez tworzenia rekordów.
- Osoba bez roli parent dostaje 403 (lub 401 jeśli brak tokena).

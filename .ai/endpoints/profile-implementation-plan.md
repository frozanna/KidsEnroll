# API Endpoint Implementation Plan: /api/profile (GET & PATCH)

## 1. Przegląd punktu końcowego
Endpoint `/api/profile` udostępnia aktualnie uwierzytelniony profil użytkownika (rola: parent) oraz pozwala na jego aktualizację (zmiana imienia i nazwiska). Zapewnia spójny dostęp do danych z tabeli `profiles` oraz email z Supabase Auth (`auth.users`). Implementacja rozdziela warstwę transportu (Astro API Route) od logiki biznesowej (warstwa service). Obsługa błędów jest ujednolicona poprzez `ApiError` i mapowanie do `ErrorResponseDTO`.

## 2. Szczegóły żądania
- Metody HTTP: 
  - GET `/api/profile` (odczyt bieżącego profilu)
  - PATCH `/api/profile` (aktualizacja pól `first_name`, `last_name`)
- Struktura URL: `/api/profile`
- Parametry:
  - Wymagane (GET): brak parametrów ani body
  - Wymagane (PATCH Body): `first_name`, `last_name` (oba wymagane, niepuste)
  - Opcjonalne: brak (świadomie brak częściowych aktualizacji w MVP; endpoint wymaga pełnej pary pól)
- Request Body (PATCH – JSON):
```json
{
  "first_name": "John",
  "last_name": "Doe"
}
```
- Nagłówki: standardowe `Authorization: Bearer <access_token>` (zarządzane przez Supabase klienta w przeglądarce – po stronie serwera pozyskiwane przez `supabase.auth.getUser()`).

## 3. Wykorzystywane typy
- `ProfileDTO` (z `src/types.ts`) – struktura odpowiedzi dla obu metod.
- `UpdateProfileCommand` – input dla operacji aktualizacji (alias `CreateProfileCommand`).
- `ErrorResponseDTO` – ujednolicony kształt błędu.
- Dodatkowo wewnętrznie: klasa `ApiError` oraz kody z `src/lib/services/errors.ts` (`AUTH_UNAUTHORIZED`, `PARENT_NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`).

## 4. Szczegóły odpowiedzi
### Sukces
- GET 200 OK – `ProfileDTO`:
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "parent",
  "created_at": "2025-01-15T10:00:00Z"
}
```
- PATCH 200 OK – identyczny kształt `ProfileDTO` po aktualizacji.

### Błędy
| Kod | HTTP | Przyczyna |
|-----|------|-----------|
| AUTH_UNAUTHORIZED | 401 | Brak ważnego uwierzytelnienia (`getUser()` zwraca błąd/brak użytkownika) |
| AUTH_UNAUTHORIZED (Forbidden) | 403 | Użytkownik nie ma roli `parent` |
| PARENT_NOT_FOUND | 404 | Brak wpisu w `profiles` dla UUID użytkownika |
| VALIDATION_ERROR | 400 | Niepoprawny body (brak pól, puste lub przekroczone limity) |
| INTERNAL_ERROR | 500 | Niespodziewany błąd DB lub runtime |

Błąd zwracany jako `ErrorResponseDTO`:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": { "issues": [ /* zod issues */ ] }
  }
}
```

## 5. Przepływ danych
1. Warstwa transportu (Astro API Route `src/pages/api/profile.ts`) pobiera `supabase` z `context.locals`.
2. Auth: `supabase.auth.getUser()` – uzyskanie `user.id` oraz `user.email`.
3. Zapytanie do `profiles` (SELECT) według `id` – pobranie `first_name`, `last_name`, `role`, `created_at`.
4. Walidacja roli (musi być `parent`).
5. GET: złożenie `ProfileDTO` i zwrot.
6. PATCH: parsowanie JSON body, walidacja Zod, wykonanie `UPDATE profiles SET first_name=?, last_name=? WHERE id=? RETURNING ...`.
7. Złożenie `ProfileDTO` z aktualnymi danymi + email (z auth).
8. Logowanie (console JSON) faz: `GET_PROFILE` lub `UPDATE_PROFILE` (`start`, `success`, `error`).
9. Błędy z DB / walidacji opakowywane w `ApiError` i mapowane przez `errorToDto`.

## 6. Względy bezpieczeństwa
- Uwierzytelnianie i autoryzacja: obowiązkowe sprawdzenie tokenu oraz roli parent.
- Brak możliwości modyfikacji `role`, `email`, `id` – serwer buduje odpowiedź bez wpływu klienta na te pola.
- Ochrona przed masowym przypisaniem: body zawiera wyłącznie dozwolone pola; zod odrzuca pola nieznane (użycie `.strict()` w schemacie).
- RLS w tabeli `profiles` (z planu DB) zapewnia dodatkową ochronę; mimo to serwer sprawdza role.
- Brak ujawniania danych wrażliwych (np. brak metadanych auth, refresh tokens, itp.).
- Walidacja długości i treści zapobiega prostym wektorom DoS (nadmiernie długie pola imienia/nazwiska) – limit sugerowany 100 znaków.
- W logach nie zapisujemy tokena ani pełnego body poza krótkimi polami (`first_name`, `last_name`).

## 7. Obsługa błędów
Scenariusze:
1. Brak tokenu / nieważny token – 401 `AUTH_UNAUTHORIZED`.
2. Użytkownik nie ma roli parent – 403 `AUTH_UNAUTHORIZED` (status override).
3. Brak wpisu w `profiles` – 404 `PARENT_NOT_FOUND` (spec: "Profile not found").
4. Body PATCH niepoprawne (brak pól, puste stringi, zbyt długie) – 400 `VALIDATION_ERROR`.
5. Błąd DB SELECT/UPDATE – 500 `INTERNAL_ERROR`.
6. Niespodziewany wyjątek runtime – 500 `INTERNAL_ERROR`.

Strategia:
- Każdy błąd opakowany w `ApiError` (fabryki: `createError`, `fromZodError`, `normalizeUnknownError`).
- Transport używa `errorToDto` + `jsonResponse` do spójnego formatu.
- Logowanie strukturalne z `phase: error`, `error_code`, `status`.

## 8. Rozważania dotyczące wydajności
- Operacje per-użytkownik: pojedyncze SELECT/UPDATE – małe obciążenie.
- Brak potrzeby cache (niska częstotliwość zmian). Możliwa przyszła optymalizacja przez etag/If-None-Match.
- Zmniejszenie round-trip: PATCH używa `UPDATE ... RETURNING` zamiast SELECT po aktualizacji.
- Autoryzacja i profil wymagają dwóch źródeł (auth + profiles); ujednolicone w jednym service wywołaniu.
- Zod walidacja o znikomej złożoności (O(1) pola).

## 9. Etapy wdrożenia
1. Utworzenie pliku walidacji `src/lib/validation/profile.schema.ts`:
   - Zod schema: `updateProfileSchema = z.object({ first_name: z.string().trim().min(1).max(100), last_name: z.string().trim().min(1).max(100) }).strict();`
   - Eksport funkcji `validateUpdateProfileBody(raw)`.
2. Utworzenie pliku service `src/lib/services/profile.service.ts` z funkcjami:
   - `getCurrentProfile(supabase): Promise<ProfileDTO>` – auth, select, rola, składanie DTO.
   - `updateCurrentProfile(supabase, command: UpdateProfileCommand): Promise<ProfileDTO>` – auth, update, składanie DTO, obsługa braku rekordu.
3. Implementacja API route `src/pages/api/profile.ts`:
   - `export const prerender = false`.
   - Import: `jsonResponse`, `errorToDto`, `normalizeUnknownError`, `fromZodError`, service & schema.
   - GET handler: wywołanie `getCurrentProfile`, logowanie start/sukces/błąd.
   - PATCH handler: parse JSON -> walidacja -> wywołanie `updateCurrentProfile` -> logowanie.
4. Dodanie strukturalnego logowania (`GET_PROFILE`, `UPDATE_PROFILE`).
5. Testy ręczne (curl / Postman) + ewentualnie dodanie minimalnych testów jednostkowych usług (jeśli framework testowy jest dostępny w repo – obecnie brak, więc można zaplanować w następnych krokach).
6. Weryfikacja kodów statusu i spójności z `ErrorResponseDTO` – szybkie lokalne uruchomienie.
7. Przegląd bezpieczeństwa: upewnienie się, że `role` i `email` nie są modyfikowane przez klienta.


## 10. Kontrakt funkcji service (skrót)
`getCurrentProfile`:
- Wejście: `supabase: SupabaseClient`
- Wyjście: `ProfileDTO`
- Błędy: `AUTH_UNAUTHORIZED`, `PARENT_NOT_FOUND`, `INTERNAL_ERROR`

`updateCurrentProfile`:
- Wejście: `supabase: SupabaseClient`, `command: UpdateProfileCommand`
- Wyjście: `ProfileDTO`
- Błędy: `AUTH_UNAUTHORIZED`, `PARENT_NOT_FOUND`, `VALIDATION_ERROR` (teoretycznie upstream), `INTERNAL_ERROR`

## 11. Edge Cases
- Użytkownik uwierzytelniony, ale brak wpisu w `profiles` -> 404 (`PARENT_NOT_FOUND`).
- Użytkownik z rolą `admin` próbuje GET/PATCH -> 403.
- PATCH z pustym JSON `{}` lub brak body -> 400 (nie przejdzie Zod). 
- Imię lub nazwisko zawiera wyłącznie spacje -> po `.trim()` stanie się puste -> 400.
- Równoczesne aktualizacje – ostatnia wygrywa (brak blokad optymistycznych w MVP).

## 12. Przykładowe logi
```json
{"action":"GET_PROFILE","phase":"start","timestamp":"2025-11-02T10:30:00.000Z"}
{"action":"GET_PROFILE","phase":"success","profile_id":"uuid","timestamp":"2025-11-02T10:30:00.050Z"}
{"action":"UPDATE_PROFILE","phase":"error","profile_id":"uuid","error_code":"INTERNAL_ERROR","status":500,"timestamp":"2025-11-02T10:31:00.120Z"}
```

---
Plan zapewnia pełną ścieżkę implementacji zgodną z obecnymi wzorcami projektu (np. endpoint `children.ts`) oraz zasadami czystego kodu i bezpieczeństwa.

# API Endpoint Implementation Plan: List Available Tags (GET /api/admin/tags)

## 1. Przegląd punktu końcowego
Endpoint udostępnia predefiniowaną, zamkniętą listę tagów możliwych do przypisania do zajęć (activities). Służy administratorom do wyświetlenia słownika do użycia w formularzach tworzenia/aktualizacji zajęć oraz potencjalnego filtrowania. Lista jest stała w MVP i nie jest pobierana z bazy (może zostać w przyszłości zmigrowana do tabeli lub pliku konfiguracyjnego). Dostęp wyłącznie dla użytkowników z rolą `admin`.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- URL: `/api/admin/tags`
- Auth: Wymagany ważny JWT Supabase; rola profilu `admin` (walidacja przez `authenticateAdmin`).
- Parametry:
  - Wymagane: brak parametrów path/query.
  - Opcjonalne: brak.
- Request Body: brak (GET bez body).
- Nagłówki wymagane (pośrednio): `Authorization: Bearer <access_token>` zapewniany przez klienta (Supabase session).

## 3. Wykorzystywane typy
- DTO: `TagsListResponseDTO` z pliku `src/types.ts`:
```ts
export interface TagsListResponseDTO { tags: string[] }
```
- Brak Command modeli (endpoint tylko odczytowy).
- Błędy: struktura błędu `ErrorResponseDTO` oraz kody z `ApiError` (`AUTH_UNAUTHORIZED`, opcjonalnie `INTERNAL_ERROR`).

## 4. Szczegóły odpowiedzi
- 200 OK (sukces):
```json
{ "tags": ["zajęcia kreatywne","sport","muzyka","taniec","nauka","język obcy","na świezym powietrzu","w pomieszczeniu","indywidualne"] }
```
- 401 Unauthorized: Brak lub nieważny token / brak profilu.
- 403 Forbidden: Użytkownik uwierzytelniony lecz rola ≠ `admin`.
- 500 Internal Server Error: Niespodziewany błąd serwera (np. błąd podczas sprawdzania profilu w Supabase).

Format błędu:
```json
{ "error": { "code": "AUTH_UNAUTHORIZED", "message": "Forbidden: admin role required" } }
```
(plus `details` gdy dostępne).

## 5. Przepływ danych
1. Klient (panel admina) wysyła GET `/api/admin/tags` z nagłówkiem autoryzacji.
2. Middleware dostarcza `supabase` w `context.locals`.
3. Handler wywołuje `authenticateAdmin(supabase)` (pobranie użytkownika -> selekcja profilu -> walidacja roli).
4. Po pozytywnej autoryzacji zwracana jest statyczna lista tagów:
   - Źródło: stała zdefiniowana w nowym pliku serwisowym `admin.tags.service.ts` lub jako eksport z istniejącego `admin.activities.service.ts` (preferowany osobny plik dla separacji odpowiedzialności).
5. Lista opakowana w `TagsListResponseDTO` -> `jsonResponse(dto, 200)`.
6. W przypadku błędu autoryzacji lub innego: `normalizeUnknownError` + `errorToDto`.

## 6. Względy bezpieczeństwa
- Autentykacja: Supabase JWT, weryfikacja poprzez `supabase.auth.getUser()`.
- Autoryzacja: Rola admin sprawdzana w `profiles.role`.
- Brak danych wejściowych redukuje powierzchnię ataku (brak body injection).
- Odpowiedź statyczna – brak ryzyka SQL injection / nadmiernej ekspozycji danych.
- Ograniczenie: Zapewnienie szybkiego fail-fast dla użytkowników bez roli admin (401/403).
- Nagłówki: Zwracamy tylko `Content-Type: application/json`.
- Rate limiting (opcjonalne przyszłe rozszerzenie) – obecnie niskie ryzyko nadużyć.

## 7. Obsługa błędów
Scenariusze:
- Brak session / token wygasł -> `AUTH_UNAUTHORIZED` (401).
- Profil nie istnieje -> `AUTH_UNAUTHORIZED` (401, message: "Profile not found").
- Rola inna niż `admin` -> `AUTH_UNAUTHORIZED` z komunikatem o wymaganej roli, status 403 (override w helperze).
- Nieoczekiwany błąd Supabase (np. sieć) -> `INTERNAL_ERROR` (500).

Mapowanie:
- Użycie istniejących utili: `normalizeUnknownError`, `errorToDto`.
- Konsystencja z innymi endpointami – identyczny format.

Logowanie:
- Start/success/error event (opcjonalnie) analogicznie do `CREATE_ACTIVITY`. Minimalny log JSON:
  - action: "LIST_TAGS"
  - phase: start|success|error
  - admin_id (po autoryzacji)
  - timestamp ISO
  - error_code & status przy błędzie.

## 8. Rozważania dotyczące wydajności
- Lista statyczna: O(1) dostęp, brak hitów DB (poza auth check).
- Auth zapytanie: 1 selekcja do `profiles`. Koszt minimalny.
- Możliwość cache po stronie klienta / HTTP (krótki max-age) – wymaga rozważenia czy dane mogą się zmieniać (w MVP nie). Na ten moment brak nagłówków cache dla prostoty.
- Skalowalność: Stałe koszty niezależne od liczby tagów (niska liczebność). Ewentualne przeniesienie do DB/tabeli w przyszłości – wtedy dodać indeks na kolumnie tag + ewentualny sorting.

## 9. Etapy wdrożenia
1. Utwórz plik serwisowy `src/lib/services/admin.tags.service.ts` eksportujący funkcję `listAdminActivityTags()` zwracającą `TagsListResponseDTO` (lub same `string[]`). Zdefiniuj stałą `ADMIN_ACTIVITY_TAGS`.
2. Dodaj endpoint `src/pages/api/admin/tags.ts`:
   - `export const prerender = false;`
   - Implementuj `GET: APIRoute`.
   - Pobierz `supabase` z `context.locals`.
   - Wywołaj `authenticateAdmin`.
   - Loguj start.
   - Uzyskaj listę tagów z serwisu i zwróć `jsonResponse({ tags }, 200)`.
   - Obsłuż błędy przez `normalizeUnknownError` -> `errorToDto` + log error.
3. Dodaj prosty test manualny (opcjonalny opis w README: curl z tokenem admina).
4. (Opcjonalnie) Rozszerz `errors.ts` jeśli potrzebny nowy kod (nie jest potrzebny – brak specyficznych błędów domenowych).
5. Code review pod kątem zgodności ze stylem (zod niepotrzebny – brak body). Upewnij się, że brak nieużywanych importów.

## 11. Kontrakt (quick reference)
- Input: (headers Authorization) -> brak body.
- Output Success: `TagsListResponseDTO`.
- Errors: `ErrorResponseDTO` z kodami powyżej.
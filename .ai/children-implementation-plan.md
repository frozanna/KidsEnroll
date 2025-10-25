# API Endpoint Implementation Plan: List Children (GET /api/children)

## 1. Przegląd punktu końcowego
Endpoint zwraca listę wszystkich dzieci należących do aktualnie uwierzytelnionego rodzica. Służy jako podstawowy zasób do prezentacji dzieci w panelu rodzica (np. lista do dalszych operacji zapisu na zajęcia). Zapewnia filtrację po `parent_id` na bazie identyfikatora profilu powiązanego z zalogowanym użytkownikiem. Nie implementujemy paginacji w MVP (zdefiniujemy możliwość łatwego dodania w przyszłości), zwracamy pełną listę.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- URL: `/api/children`
- Parametry:
  - Wymagane: brak (autentykacja przez nagłówek autoryzacji / sesję Supabase).
- Body: brak (GET nie przyjmuje treści).
- Nagłówki: Standardowe nagłówki autoryzacji dostarczane przez Supabase (np. cookie lub bearer token).

## 3. Wykorzystywane typy
- `ChildEntity` (definicja z bazy: pełny wiersz tabeli `children`).
- `ChildDTO` = `Omit<ChildEntity, "parent_id">` (już zdefiniowane w `types.ts`).
- Nowa odpowiedź transportowa: `ChildrenListResponseDTO` (do dodania) o kształcie:
  ```ts
  export interface ChildrenListResponseDTO { children: ChildDTO[] }
  ```
- `ErrorResponseDTO` dla błędnych scenariuszy.

## 4. Szczegóły odpowiedzi
- 200 OK (zawsze przy poprawnym uwierzytelnieniu i autoryzacji):
  ```json
  {
    "children": [
      {
        "id": 1,
        "first_name": "Alice",
        "last_name": "Smith",
        "birth_date": "2020-05-15",
        "description": "Enjoys drawing and music",
        "created_at": "2025-01-10T10:00:00Z"
      }
    ]
  }
  ```
  - Pusta lista, jeśli rodzic nie ma dzieci: `{ "children": [] }`.
- 401 Unauthorized: brak sesji / token nieprawidłowy.
- 403 Forbidden: profil zalogowanego użytkownika nie ma roli `parent`.
- 500 Internal Server Error: problemy z bazą lub inne nieoczekiwane błędy.

Kody statusu nieużywane w tym MVP dla tego endpointu: 400 (brak walidacji wejścia), 404 (brak konceptu szukania pojedynczego zasobu — pustą listę traktujemy jako sukces).

## 5. Przepływ danych
1. `GET /api/children` trafia do pliku `src/pages/api/children.ts` (dodamy).
2. Transport warstwa pobiera klienta Supabase z `context.locals.supabase`.
3. Autentykacja: `supabase.auth.getUser()` — weryfikacja obecności użytkownika.
4. Pobranie profilu: `profiles` (kolumny: `id, role`) z filtrem po `auth.user.id`.
5. Autoryzacja: sprawdzenie `role === 'parent'`. Jeśli nie — 403.
6. Zapytanie do tabeli `children`: selekcja wybranych kolumn: `id, first_name, last_name, birth_date, description, created_at` + filtr `parent_id = profile.id`.
7. Mapowanie wyników: każdy wiersz do `ChildDTO` (pominięcie `parent_id` już na SELECT — brak potrzeby dodatkowego transform). Formatowanie dat pozostawione w formacie bazowym (ISO). `birth_date` (DATE) — Postgres przez Supabase zwraca jako string ISO daty (YYYY-MM-DD) zgodnie z oczekiwaniem.
8. Konstrukcja obiektu `{ children: ChildDTO[] }` i zwrot JSON (200).
9. Błędy (auth/db) przechwycone i translacja do `ErrorResponseDTO` poprzez util z `errors.ts` (rozszerzymy error codes gdy potrzebne: brak nowych kodów na tę chwilę).
10. Logging: structured `console.log(JSON.stringify(...))` dla faz: `start`, `success`, `error` podobnie do endpointu enrollments.

## 6. Względy bezpieczeństwa
- Uwierzytelnienie: konieczne — sprawdzamy czy użytkownik istnieje (sesja Supabase). Bez użytkownika: 401.
- Autoryzacja roli: profil musi mieć `role = 'parent'`. Inaczej 403 (używamy kodu `AUTH_UNAUTHORIZED` z nadpisanym statusem 403 lub wprowadzamy nowy kod np. `AUTH_FORBIDDEN` — w MVP pozostajemy przy istniejącym wzorcu z enrollments i stosujemy `AUTH_UNAUTHORIZED` + status 403).
- Ograniczenie zakresu danych: filtr `parent_id` eliminuje możliwość enumeracji cudzych dzieci. RLS w tabeli `children` dodatkowo wzmacnia ochronę (powinno być aktywne wg planu, ale endpoint zakłada logiczny filtr niezależnie).
- Unikanie overexposure: nie zwracamy `parent_id` ani innych powiązanych zasobów.
- Validation surface minimalny (brak body / query) — mniejsza powierzchnia ataku (brak SQL injection ryzyka poza kontrolowanym eq parent_id).
- Brak możliwości wstrzyknięcia zewnętrznych danych poprzez parametr — SELECT z equality jest bezpieczny (Supabase parametryzuje).

## 7. Obsługa błędów
| Scenariusz | Kod błędu | HTTP | Opis |
|------------|-----------|------|------|
| Brak sesji / token wygasł | AUTH_UNAUTHORIZED | 401 | Użytkownik niezalogowany |
| Profil nie znaleziony | AUTH_UNAUTHORIZED | 401 | Spójność: brak profilu do kontynuacji |
| Rola różna od parent | AUTH_UNAUTHORIZED (status 403) | 403 | Odmowa dostępu do zasobu |
| Błąd bazy przy pobieraniu profilu | INTERNAL_ERROR | 500 | Problem z warstwą danych |
| Błąd bazy przy pobieraniu children | INTERNAL_ERROR | 500 | Problem z warstwą danych |
| Nieznany wyjątek | INTERNAL_ERROR | 500 | Fallback dla innych błędów |

Transport warstwa: mapowanie `ApiError` -> `ErrorResponseDTO` (funkcja pomocnicza analogiczna do `errorToDto` z enrollments). Brak walidacji body — nie występuje `VALIDATION_ERROR`.

## 8. Rozważania dotyczące wydajności
- Brak agregacji — pojedyncze proste SELECT.
- Payload minimalny — tylko niezbędne pola. Usuwamy `parent_id` już na SELECT zmniejszając rozmiar odpowiedzi.

## 9. Etapy wdrożenia
1. Dodanie typu odpowiedzi: W pliku `src/types.ts` dodać `export interface ChildrenListResponseDTO { children: ChildDTO[] }` (jeśli uznamy za wartość — lub reuse inline; preferujemy jawny interfejs dla spójności). 
2. Utworzenie pliku endpointu: `src/pages/api/children.ts`.
3. Wstawienie `export const prerender = false` na górze.
4. Implementacja helperów: `jsonResponse` i `errorToDto` (kopiowane/zrefaktoryzowane z enrollments aby uniknąć duplikacji — opcja: wyodrębnić wspólne util w `src/lib/utils.ts` w przyszłości; w MVP lokalnie). 
5. Flow auth: `supabase.auth.getUser()` + pobranie profilu + walidacja roli. Zwracamy 401/403 zgodnie z regułami.
6. Query children: `.from("children").select("id, first_name, last_name, birth_date, description, created_at").eq("parent_id", profile.id)`.
7. Mapowanie wyniku (Supabase zwróci tablicę) — bez transformacji poza JSON.
8. Logowanie: `console.log(JSON.stringify({ action: "LIST_CHILDREN", phase: "start" ... }))` start; analogicznie `success` i `error` (z kodem błędu, liczbą rekordów). 
9. Zwrócenie 200 z `{ children: [...] }`. 

## 10. Edge Cases & Uwagi
- Rodzic bez dzieci -> pusta lista (nie błąd).
- `description` może być `null` — zwracamy jako `null` (front powinien obsłużyć).
- Data urodzenia: format YYYY-MM-DD (bez czasu) — brak transformacji.
- Spójność stref czasowych: `created_at` w UTC (Postgres TIMESTAMPTZ) — front może sformatować lokalnie.
- Brak potrzeby transakcji (pojedynczy read). 
- Przy przyszłej paginacji: Rozszerzenie odpowiedzi o `pagination` analogiczne do istniejących wzorców DTO.

## 11. Kryteria sukcesu
- Zalogowany rodzic otrzymuje pełną listę swoich dzieci (dokładne pola zgodne ze specyfikacją).
- Brak wycieków danych innych rodziców.
- Błędy autoryzacji i brak sesji poprawnie mapowane do 401/403.
- Struktura błędów zgodna z `ErrorResponseDTO`.
- Logi zawierają udane i nieudane próby (action=LIST_CHILDREN).

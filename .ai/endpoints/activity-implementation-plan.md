# API Endpoint Implementation Plan: GET /api/activities/:id

## 1. Przegląd punktu końcowego
Punkt końcowy dostarcza szczegółowe informacje o pojedynczych zajęciach (activity) dla zalogowanego użytkownika z rolą `parent`. Odpowiedź zawiera metadane aktywności, powiązanego instruktora (worker), listę tagów, liczbę dostępnych miejsc (wyliczaną dynamicznie) oraz pola audytowe. Dane służą do wyświetlenia widoku szczegółowego zajęć w panelu rodzica.

Cele:
- Udostępnienie szczegółów pojedynczej aktywności.
- Zapewnienie spójnego wyliczenia `available_spots` (participant_limit - liczba zapisów).
- Egzekwowanie autoryzacji (tylko rodzic) i bezpiecznej walidacji parametru `id`.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- URL: `/api/activities/:id`
- Parametry:
  - Wymagane (Path): `id` (liczba całkowita dodatnia, identyfikator aktywności)
  - Opcjonalne: brak
- Query Params: brak (MVP – brak rozszerzeń)
- Request Body: brak
- Nagłówki (implikowane):
  - `Authorization: Bearer <token>` (Supabase JWT) – walidowane w middleware

### Walidacja Parametru `id`
- Typ: number (integer)
- Zakres: `id >= 1`
- Narzędzia: Zod schema (np. `z.object({ id: z.coerce.number().int().positive() })`)
- Błędy walidacji: HTTP 400 + `ErrorResponseDTO` (code: VALIDATION_ERROR)

## 3. Wykorzystywane typy
Z `src/types.ts`:
- `ActivityDTO` (równoważne `ActivityListItemDTO` – używane jako wynik)
- `ActivityWorkerDTO` (dla pola `worker` wewnątrz `ActivityDTO`)
- `ErrorResponseDTO` (standardowy kształt błędów)
- Encje pomocnicze w implementacji (nie eksponowane bezpośrednio):
  - `ActivityEntity` (bazowa tabela `activities`)
  - `EnrollmentEntity` (do wyliczenia liczby zapisów)
  - `ActivityTagEntity` (do pobrania tagów)
  - `WorkerEntity` (dane instruktora)

### Finalna Struktura Odpowiedzi (200)
Odpowiada `ActivityDTO`:
```
{
  id: number,
  name: string,
  description: string | null,
  cost: number,
  participant_limit: number,
  available_spots: number, // participant_limit - enrollments_count
  start_datetime: string,  // ISO TIMESTAMPTZ
  worker: { id, first_name, last_name, email },
  tags: string[],
  created_at: string
}
```

## 4. Szczegóły odpowiedzi
### Kody statusu
- 200 OK – sukces, zwraca `ActivityDTO`
- 400 Bad Request – niepoprawny parametryczny `id`
- 401 Unauthorized – brak ważnego tokena / brak roli `parent`
- 404 Not Found – aktywność nie istnieje
- 500 Internal Server Error – nieoczekiwany błąd (logowany)

### Format błędów
`ErrorResponseDTO`:
```
{
  "error": {
    "code": "NOT_FOUND" | "VALIDATION_ERROR" | "AUTH_UNAUTHORIZED" | "INTERNAL_ERROR",
    "message": string,
    "details": { ...opcjonalne szczegóły }
  }
}
```

## 5. Przepływ danych
1. Middleware uwierzytelnia użytkownika poprzez Supabase (JWT) i osadza `locals.supabase` + profil/rolę.
2. Endpoint odbiera żądanie: wyodrębnia param `id` z `Astro.params`.
3. Walidacja `id` przez Zod.
4. Wywołanie serwisu `activities.service.ts#getActivityById(id, supabase)`.
5. Serwis wykonuje pojedyncze zoptymalizowane zapytanie (lub zestaw zapytań w transakcji logicznej):
   - Pobiera rekord `activities` + powiązanego `worker`.
   - Agreguje tagi (`activity_tags`) do listy `string[]`.
   - Liczy liczbę zapisów (COUNT w `enrollments`).
6. Oblicza `available_spots = participant_limit - enrollments_count` (minimalnie 0, nie ujemne).
7. Mapuje wynik do `ActivityDTO`.
8. Zwraca przez handler HTTP 200.
9. W przypadku problemów (brak rekordu, błędy DB, brak uprawnień) rzuca kontrolowane wyjątki mapowane na `ErrorResponseDTO`.

### Struktura zapytania (propozycja jednego round-trip):
Przy użyciu Supabase (PostgREST) możliwe są wielokrotne połączenia; dla redukcji opóźnień preferowana strategia:
- Pobranie aktywności + worker: `activities.select('id,name,description,cost,participant_limit,start_datetime,created_at, worker:workers(id,first_name,last_name,email)')` z filtracją `eq('id', id)`.
- Osobne zapytanie: `enrollments.select('child_id', { count: 'exact', head: true }).eq('activity_id', id)` – wykorzystanie nagłówka licznika.
- Zapytanie tagów: `activity_tags.select('tag').eq('activity_id', id)`.
Agregacja w serwisie. (Alternatywa: widok/materialized view w przyszłości).

## 6. Względy bezpieczeństwa
- Autentykacja: Sprawdzana w middleware; dostęp tylko dla zalogowanych.
- Autoryzacja: Wymagana rola `parent`; jeśli rola != parent → 401 (lub 403; w spec wskazano 401 – trzymamy się 401).
- Ochrona przed ID enumeration: Brak dodatkowych ograniczeń – publiczny katalog aktywności jest dozwolony; monitorować nienaturalnie częste zapytania (przyszłość: rate limiting).
- Walidacja typów: Zod gwarantuje brak wstrzyknięć typu (param jest liczbą). Minimalizuje SQL injection (Supabase SDK już parametryzuje zapytania).
- Ograniczenie danych: Udostępniane pola zgodne ze specyfikacją – brak ekspozycji `facility_id`, `worker_id` (internal), itp.
- Ścieżka błędów: Nie ujawnia szczegółów stack trace – generowany generyczny komunikat przy 500.

## 7. Obsługa błędów
| Scenariusz | Kod | code (ErrorResponseDTO) | Opis |
|------------|-----|--------------------------|------|
| Niepoprawny `id` (np. 0, ujemny, NaN) | 400 | VALIDATION_ERROR | Walidacja Zod odrzucona |
| Brak tokena / nieważny token | 401 | AUTH_UNAUTHORIZED | Middleware nie uwierzytelnił |
| Rola != parent | 401 | AUTH_UNAUTHORIZED | Brak uprawnień roli |
| Aktywność nie istnieje | 404 | NOT_FOUND | Brak rekordu w DB |
| Błąd połączenia z DB | 500 | INTERNAL_ERROR | Nieoczekiwany wyjątek SDK |
| Nieoczekiwany wyjątek runtime | 500 | INTERNAL_ERROR | Fallback |

Mechanizm:
- Serwis rzuca kontrolowane błędy z klasy/fabryki w `errors.ts` (np. `createNotFoundError('activity')`).
- Endpoint mapuje do odpowiedniego statusu i `ErrorResponseDTO`.
- Logowanie: `console.error` + (przyszłościowo) zapis do tabeli logów – obecnie brak dedykowanej tabeli; opcja rozszerzenia.

## 8. Rozważania dotyczące wydajności
- Liczba zapytań: 3 (activity+worker, count enrollments, tags). Akceptowalne w MVP. Możliwa optymalizacja:
  - Użycie RPC/funkcji Postgres do zwrotu złożonego obiektu (1 round-trip).
  - Materialized view dla często odwiedzanych aktywności.
- Indeksy: `enrollments(activity_id)` przyspiesza COUNT; `activities(id)` PRIMARY KEY; `activity_tags(activity_id)` przyspiesza pobieranie tagów.
- Cache warstwy aplikacji (np. in-memory TTL) – do rozważenia później.
- Unikanie nadmiaru JavaScript – transformacje proste, brak kosztownych pętli.
- Skalowanie: Wysokie równoległe odczyty – COUNT na indeksowanej kolumnie wydajne.

## 9. Etapy wdrożenia
1. UTWORZYC Zod schema parametru `id` (`src/lib/validation/activity.schema.ts` lub w nowym pliku; minimalnie w route jeśli nie planujemy reużycia).
2. DODAĆ nowy serwis `src/lib/services/activities.service.ts` z funkcją `getActivityById(supabase, id): Promise<ActivityDTO>`:
   - Walidacje wewnętrzne (brak rekordu → rzuca NOT_FOUND).
   - Pobranie danych z 3 zapytań.
   - Mapowanie do DTO + obliczenie `available_spots` (max 0 dolny limit).
3. DODAĆ nowy endpoint `src/pages/api/activities/[id].ts`:
   - `export const prerender = false`
   - Import serwisu + walidacja paramów.
   - Sprawdzenie roli (z kontekstu middleware) – jeśli brak lub != parent → 401.
   - Wywołanie serwisu i zwrócenie JSON 200.
   - Obsługa błędów (try/catch) → mapowanie standardowe.
4. UŻYĆ istniejącego `errors.ts` (jeśli brak metod, rozszerzyć fabryki: `notFound(code, message)` etc.).
5. PRZEGLĄD kodu pod kątem standardów (lint, typy) – upewnienie się, że brak naruszeń.

## 10. Edge Cases & Dodatkowe Uwagi
- `participant_limit = 0` (teoretycznie) → `available_spots = 0`.
- Więcej zapisów niż limit (dane niespójne) → `available_spots` może być ujemne; należy zabezpieczyć: `Math.max(0, participant_limit - count)`.
- Puste tagi → `tags: []`.
- Worker usunięty (ON DELETE CASCADE) – aktywność wtedy też usunięta; brak dodatkowego scenariusza.
- Strefy czasowe: zwracamy `start_datetime` w formacie z DB (UTC), konsument UI dokonuje lokalizacji.

## 11. Mini Kontrakt Serwisu
- Input: `supabase` (SupabaseClient), `id: number`.
- Output: `ActivityDTO`.
- Error Modes: rzuca kontrolowane (NOT_FOUND) lub propaguje nieoczekiwane (mapowane na 500).
- Success Criteria: Wszystkie pola obecne, `available_spots >= 0`.

## 12. Przyszłe Rozszerzenia
- Dodanie pola `is_full` dla szybszej logiki UI.
- Prefetch podobnych aktywności (rekomendacje) – osobny endpoint.
- Implementacja warstwy cache + ETag.

---
Plan gotowy do implementacji zgodnie z zasadami projektu.

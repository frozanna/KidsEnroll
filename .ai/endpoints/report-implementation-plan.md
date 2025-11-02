# API Endpoint Implementation Plan: Weekly Activity Cost Report (GET /api/reports/costs)

## 1. Przegląd punktu końcowego
Endpoint generuje tygodniowy raport kosztów zajęć dla dzieci przypisanych do zalogowanego rodzica. Zwraca plik Excel (`.xlsx`) zawierający wiersze reprezentujące każdy zapis dziecka na aktywność w wybranym tygodniu (domyślnie bieżący tydzień, licząc poniedziałek–niedziela, wg strefy UTC lub konfigurowalnej w przyszłości). Ostatni wiersz zawiera podsumowanie ("Total") z sumą kosztów. Służy do szybkiego wglądu w sumaryczne koszty zaplanowanych / nadchodzących zajęć w bieżącym tygodniu.

Cele biznesowe:
- Umożliwić rodzicom kontrolę wydatków tygodniowych.
- Dostarczyć materiał do eksportu / archiwizacji.
- Przygotować bazę pod przyszłe raporty miesięczne / filtrowanie według dziecka.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- URL: `/api/reports/costs`
- Parametry Query:
  - `week` (opcjonalny, ISO date `YYYY-MM-DD`): Poniedziałek tygodnia, dla którego generujemy raport. Gdy brak parametru -> użyj poniedziałku bieżącego tygodnia.
- Headers wysyłane przez klienta: `Authorization: Bearer <token>` (typowe dla Supabase Auth).
- Brak body (GET).

Walidacja parametru `week`:
- Jeżeli obecny: musi spełniać regex `^\d{4}-\d{2}-\d{2}$` i parsowanie do poprawnej daty.
- Musi być dniem poniedziałku (dow=1 w ISO) – jeśli nie, błąd 400.

## 3. Wykorzystywane typy
Z `src/types.ts`:
- `WeeklyCostReportRowDTO`: { child_first_name, child_last_name, activity_name, activity_date, activity_time, cost }
- `WeeklyCostReportDTO`: { rows: WeeklyCostReportRowDTO[]; total: number; week_start: string; week_end: string }

Choć endpoint zwraca binarny Excel, wewnętrzna reprezentacja danych przed serializacją do pliku będzie w strukturze `WeeklyCostReportDTO` (ułatwia testy i separację warstw). Nie ma Command modelu (GET).

## 4. Szczegóły odpowiedzi
- Sukces (200 OK):
  - Headers:
    - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    - `Content-Disposition: attachment; filename="activity-costs-week-{week_start}.xlsx"`
    - `Cache-Control: no-store`
  - Body: binarny strumień pliku Excel.
- Błąd (walidacja/autoryzacja/serwer): JSON wg `ErrorResponseDTO` z odpowiednim kodem statusu (400/401/403/404/500). Dla 404 w tej implementacji raczej brak zastosowania (brak pojedynczego zasobu) – pusta lista -> nadal raport z Total=0 (zwracamy plik z nagłówkiem i wierszem Total). Błędy 404 mogą wystąpić tylko przy nietypowych stanach (np. brak profilu – już mapowane jako 401 / 403 w warstwie auth).

Struktura Excela:
- Arkusz: `WeeklyCosts`
- Kolumny (nagłówki dokładne):
  1. `Child First Name`
  2. `Child Last Name`
  3. `Activity Name`
  4. `Activity Date` (YYYY-MM-DD)
  5. `Activity Time` (HH:mm, wyciągnięte z `start_datetime` i znormalizowane do strefy serwera – MVP: UTC)
  6. `Cost` (liczba)
- Ostatni wiersz: w kolumnie A tekst `Total`, puste w kolumnach B–E, suma kosztów w kolumnie F.

## 5. Przepływ danych
1. Transport (handler GET) pobiera `supabase` z `context.locals` i wykonuje autentykację rodzica (`authenticateParent`).
2. Parsowanie parametru `week` z `URLSearchParams`. Jeśli brak -> obliczenie bieżącego poniedziałku.
3. Walidacja daty (regex + parsowanie + dzień tygodnia).
4. Wyznaczenie `week_start` (poniedziałek) i `week_end` (niedziela: week_start + 6 dni). Granice czasu: od `week_startT00:00:00Z` (inclusive) do `< week_end+1 day T00:00:00Z`.
5. Serwis `generateWeeklyCostReport(supabase, parentId, weekStartDate)`:
   - Pobiera wszystkie dzieci rodzica (SELECT id, first_name, last_name FROM children WHERE parent_id = parentId). Jeśli 0 dzieci -> zwraca strukturalnie pusty DTO.
   - Pobiera wszystkie enrollments z joinem do activities w zakresie daty: FROM enrollments e JOIN activities a ON e.activity_id=a.id WHERE e.child_id IN (...) AND a.start_datetime >= startIso AND a.start_datetime < nextWeekIso.
   - Mapuje wiersze do `WeeklyCostReportRowDTO`: data i czas rozdzielone z `start_datetime`.
   - Sumuje koszt -> `total`.
   - Zwraca `WeeklyCostReportDTO`.
6. Transport tworzy plik Excel z DTO. Używa biblioteki (propozycja: `exceljs` – dodamy do dependencies) lub lżejszej `xlsx` jeśli preferencja minimalizmu. (ExcelJS ułatwia generowanie komórek i formatowanie; MVP wystarczy bez stylowania.)
7. Serializacja workbook do `Buffer` (Node) -> Response binarny z odpowiednimi nagłówkami.
8. Logowanie: JSON start/success/error (akcja: `REPORT_WEEKLY_COSTS`).

## 6. Względy bezpieczeństwa
- Autoryzacja: tylko użytkownik z rolą `parent`. Wykorzystujemy istniejące helpery.
- Dostęp wyłącznie do własnych dzieci (filtr parent_id w zapytaniu children). Brak ekspozycji innych profili.
- Ochrona przed enumeracją: brak ID wejściowych – nie ma wektora enumeracji.
- Walidacja parametru `week` zapobiega SQL injection (używamy parametryzowanego API Supabase + format ISO w logice, nie interpolujemy stringów). 
- Brak danych wrażliwych poza imionami – e-mail dziecka nie istnieje. Profil rodzica nie trafia do raportu.
- Nagłówki `Cache-Control: no-store` eliminują ryzyko pozostawienia raportu w cache (zawiera dane dzieci).

## 7. Obsługa błędów
Potencjalne scenariusze:
- Nieprawidłowy format `week` -> 400 VALIDATION_ERROR.
- `week` nie jest poniedziałkiem -> 400 VALIDATION_ERROR (komunikat: "week must be Monday ISO date").
- Użytkownik nieautentykowany -> 401 AUTH_UNAUTHORIZED.
- Niewłaściwa rola (nie parent) -> 403 AUTH_UNAUTHORIZED (z komunikatem Forbidden). *Zauważ:* klasa błędu już mapowana na kod 403.
- Błąd w komunikacji z DB (supabase error) -> 500 INTERNAL_ERROR.
- Niewłaściwy format `start_datetime` w danych aktywności (dane uszkodzone) -> 500 INTERNAL_ERROR.

Zwracamy JSON `ErrorResponseDTO` dla błędów (nie plik); plik tylko przy sukcesie. Brak 404 specyficznego – pusty raport jest poprawny (Total=0). Wewnętrzne wyjątki normalizowane przez `normalizeUnknownError`.

## 8. Rozważania dotyczące wydajności
- Jeden tydzień danych: typowo kilka–kilkadziesiąt wierszy -> generowanie Excel błyskawiczne.
- Zapytania: dwie fazy (children, enrollments + activities join). 
  - Można zoptymalizować do pojedynczego zapytania używając nested selects: SELECT enrollments(..., activities(...), children(...)) WHERE parent_id = ? AND date range. Jednak czytelność MVP: dwa zapytania + IN list.
- `IN` lista dzieci: przy dużej liczbie dzieci (np. 100+) nadal OK; można przyszłościowo przejść na join przez View lub RPC.
- Excel generowany w pamięci – dla <10k wierszy bez problemu. (MVP nie przewiduje większych tygodni.)
- Brak potrzeby cache; dane dynamiczne + prywatne.

## 9. Etapy wdrożenia
1. Dodaj zależność: `exceljs` (lub `xlsx`). (Propozycja: exceljs) w `package.json`. 
2. Utwórz plik walidacji `src/lib/validation/reports.schema.ts` z Zod schematem: `{ week?: string }` + efekt refine (format + Monday check).
3. Dodaj serwis `src/lib/services/reports.service.ts` z funkcją `generateWeeklyCostReport(supabase, parentId: string, weekStart: string): Promise<WeeklyCostReportDTO>`.
   - Implementacja: pobierz dzieci -> map id list -> gdy puste -> zwróć DTO z `rows: []`, `total: 0`, właściwe `week_start`, `week_end`.
   - Gdy dzieci są: pobierz enrollments z joinem activities: `.from("enrollments").select("child_id, activities(name, cost, start_datetime), children(first_name, last_name)").in("child_id", childIds).gte("activities.start_datetime", startIso).lt("activities.start_datetime", nextWeekIso)` (jeśli Supabase wspiera aliasy/nested; alternatywa: dwa zapytania i manualne łączenie).
   - Transformacja: parse `start_datetime` -> date part (slice 0..10), time part (slice 11..16) przy formacie ISO, fallback na `new Date()` format.
   - Sumowanie kosztów.
4. Utwórz endpoint `src/pages/api/reports/costs.ts`:
   - `export const prerender = false;`
   - GET handler: auth -> walidacja query -> log start -> serwis -> generacja Excel -> log success -> return Response (binary).
   - Obsługa błędów: catch, normalize, log error, zwróć JSON.
5. Implementacja generowania Excela w endpoint (nie w serwisie, by serwis był agnostyczny transportu):
   - `import { Workbook } from 'exceljs';`
   - Utwórz workbook & sheet -> dodaj nagłówki -> iteruj wiersze -> wiersz total.
   - `await workbook.xlsx.writeBuffer()` -> Node 18+ w Astro; w razie potrzeby `Buffer.from(await workbook.xlsx.writeBuffer())`.
6. Dodaj test manualny (uruchom dev, wywołaj GET z tokenem w Postmanie / curl) – zapewnij nazewnictwo pliku.
7. Logowanie (console.log JSON) w trzech fazach: start/success/error z akcją `REPORT_WEEKLY_COSTS` i polami: parent_id, week_start, week_end, row_count, total, status, error_code.
8. Review bezpieczeństwa: upewnij się, że brak `profile.id` ani innych PII w pliku poza imionami dzieci (zaakceptowane). 
10. Potencjalny refactoring (przyszłe): przenieść generację pliku do oddzielnego helpera `lib/utils/reportExcel.ts` gdy pojawi się więcej raportów.

## 10. Kontrakt funkcji serwisowej (podsumowanie)
- Input: `supabase`, `parentId: string`, `weekStart: string (YYYY-MM-DD Monday)`
- Output: `WeeklyCostReportDTO`
- Error modes: rzuca `ApiError(INTERNAL_ERROR)` przy błędach DB lub złych danych datetime.
- Gwarancje: `rows` posortowane rosnąco po `activity_date, activity_time` (warto dodać sortowanie w implementacji), `total` zgodny z sumą `cost`.

## 11. Edge Cases
- Brak dzieci -> arkusz z samym nagłówkiem + wiersz Total (0). 
- Dzieci bez zapisów w tygodniu -> jw.
- Zajęcia w sobotę/niedzielę -> mieszczą się w zakresie tygodnia.
- Aktywności z identycznym czasem -> wiele wierszy; brak grupowania.
- Niepoprawne `week` (np. 2025-02-30) -> 400.
- `week` jest niedzielą -> 400 (musi być poniedziałek).
- Nietypowy błąd exceljs (rzadkie) -> 500 INTERNAL_ERROR.

## 12. Przykładowe logi
START: `{"action":"REPORT_WEEKLY_COSTS","phase":"start","parent_id":"<uuid>","week_start":"2025-10-27","week_end":"2025-11-02","timestamp":"2025-10-31T10:15:00.000Z"}`
SUCCESS: `{"action":"REPORT_WEEKLY_COSTS","phase":"success","parent_id":"<uuid>","week_start":"2025-10-27","week_end":"2025-11-02","row_count":6,"total":180,"filename":"activity-costs-week-2025-10-27.xlsx","timestamp":"2025-10-31T10:15:00.200Z"}`
ERROR: `{"action":"REPORT_WEEKLY_COSTS","phase":"error","parent_id":"<uuid>","error_code":"VALIDATION_ERROR","status":400,"timestamp":"2025-10-31T10:15:00.050Z"}`

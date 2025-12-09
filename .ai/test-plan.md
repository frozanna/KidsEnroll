# Plan testów dla projektu KidsEnroll

## 1. Wprowadzenie i cele testowania

Celem testów dla projektu KidsEnroll jest zapewnienie wysokiej jakości i niezawodności aplikacji służącej do zarządzania zajęciami dodatkowymi w przedszkolach/żłobkach. Aplikacja zawiera panel administratora oraz panel rodzica, integruje się z Supabase (PostgreSQL + auth), wykorzystuje Astro 5, React 19, TypeScript 5 oraz Tailwind 4 i komponenty shadcn/ui.

Główne cele testowania:
- Zweryfikowanie poprawności kluczowych przepływów biznesowych (zarządzanie zajęciami, rodzicami, dziećmi, zapisami).
- Zapewnienie bezpieczeństwa danych (autentykacja, autoryzacja, polityki dostępu do danych).
- Wykrycie i ograniczenie regresji poprzez wprowadzenie systematycznych testów automatycznych.
- Upewnienie się, że UI jest responsywne, dostępne oraz użyteczne dla docelowych użytkowników (administratorzy, rodzice).
- Weryfikacja poprawności integracji z Supabase (auth, tabele, funkcje RPC) oraz stabilności API Astro.

## 2. Zakres testów

### 2.1 Zakres funkcjonalny

Obszary objęte testami:

- **Autentykacja i autoryzacja (`src/components/auth`, `src/pages/auth`, API `auth/*`)**
  - Rejestracja użytkownika (rodzica, potencjalnie administratora).
  - Logowanie, wylogowanie, reset hasła, zmiana hasła.
  - Obsługa stanów błędów (niepoprawne dane, zablokowane konto, brak potwierdzenia maila – jeśli dotyczy).
  - Poprawne odzwierciedlenie stanu sesji po stronie UI (nawigacja, przyciski, dostępy).

- **Panel rodzica (`src/components/dashboard`, `src/pages/app`)**
  - Przeglądanie listy dzieci, dodawanie/edycja danych dziecka.
  - Przeglądanie listy zajęć (dostępnych dla danego przedszkola/instytucji).
  - Zapisywania/wyrejestrowanie dziecka na/z zajęć.
  - Podgląd aktualnych zapisów i historii (jeśli występuje).
  - Działanie paginacji, filtrów i sortowania (jeśli obecne).

- **Panel administratora (`src/components/admin`, `src/pages/admin`)**
  - Zarządzanie zajęciami (`admin.activities.*`): tworzenie/edycja/usuwanie zajęć, przypisywanie tagów, ustawianie limitów, godzin, opłat.
  - Zarządzanie rodzicami (`admin.parents.*`): lista rodziców (zliczanie dzieci, maile przez RPC `get_auth_emails`), podgląd szczegółów, ewentualne akcje administracyjne.
  - Zarządzanie pracownikami (`admin.workers.*`): tworzenie, edycja, przypisywanie do zajęć.
  - Przegląd raportów (`reports.service.ts`, API `reports/*`) – liczba zapisów, obłożenie zajęć, raporty agregujące.
  - Obsługa paginacji (`pagination.utils.ts`), wyszukiwania i filtrów w listach.

- **Zarządzanie zapisami (`enrollments.*`)**
  - Tworzenie zapisów dzieci na zajęcia (sprawdzenie limitów, konfliktów czasowych – jeśli istnieją).
  - Anulowanie zapisów.
  - Wyliczanie liczby zapisów (np. funkcje w migracjach supabase `add_enrollment_counts_function.sql`).
  - Spójność danych pomiędzy widokami rodzica i administratora.

- **Profile użytkowników (`profile.service.ts`, API `profile.ts`, strony `/app/profil.astro`)**
  - Aktualizacja danych profilu (imiona, nazwisko itd.).
  - Pobieranie i prezentacja danych profilu.
  - Łączenie danych z tabeli `profiles` i `auth.users` (RPC `get_auth_emails`).

- **Warstwa UI wspólna (`src/components/ui`, `src/components/form`)**
  - Poprawność działania komponentów formularzowych (walidacja, komunikaty o błędach, integracja z Zod).
  - Spójność nawigacji (`AdminNavbar`, `ParentNavbar`).
  - Poprawne działanie feedbacku (`toast`, `useToastFeedback`).

- **Middleware (`src/middleware/index.ts`)**
  - Przekierowania dla niezalogowanych użytkowników.
  - Ochrona ścieżek `/admin/*` oraz `/app/*` w zależności od roli.
  - Obsługa scenariuszy typu: próba wejścia na stronę admina jako rodzic.

Poza zakresem (na tym etapie):
- Zaawansowane testy bezpieczeństwa (pentesty) – mogą zostać zaplanowane osobno.
- Testy migracji danych produkcyjnych (wczesny etap projektu).
- Testy lokalizacyjne (jeżeli brak pełnej wielojęzyczności).

### 2.2 Zakres niefunkcjonalny

- Wydajność i skalowalność podstawowych operacji (lista zajęć, lista rodziców, raporty).
- Użyteczność i dostępność (ARIA, responsywność, klawiaturowa nawigacja).
- Stabilność integracji z Supabase (testy w sytuacjach awaryjnych: brak połączenia, błędy RPC).
- Spójność UI (kolory, style, zachowanie komponentów głównych).

## 3. Typy testów do przeprowadzenia

### 3.1 Testy jednostkowe (Unit Tests)

Zakres:
- Funkcje usług w `src/lib/services/*.ts` (np. `activities.service.ts`, `enrollments.service.ts`, `parents.service.ts` – w tym logika pobierania maili przez `get_auth_emails`, liczenia dzieci i zapisów).
- Funkcje pomocnicze w `src/lib/pagination.utils.ts`, `src/lib/utils.ts`, `src/lib/postgres.utils.ts`.
- Walidacje Zod w `src/lib/validation/*.schema.ts` (sprawdzanie poprawnych i niepoprawnych payloadów).

Cele:
- Zweryfikowanie poprawności logiki biznesowej bez zależności zewnętrznych.
- Umożliwienie szybkiego wykrywania regresji przy zmianach w serwisach.

Narzędzia: Vitest.

### 3.2 Testy integracyjne

Zakres:
- API Astro w `src/pages/api/*` w połączeniu z warstwą usług (`src/lib/services`) i Supabase (lub stub/embedded DB na środowisku testowym).
- Integracja z Supabase (auth, tabele, funkcje, RPC `get_auth_emails`, triggery profilowe z migracji).
- Middleware (`src/middleware/index.ts`) – zachowanie przekierowań w kontekście requestów HTTP.

Cele:
- Zweryfikowanie poprawności współdziałania warstw: API ↔ services ↔ Supabase.
- Testy rzeczywistych scenariuszy: założenie konta, logowanie, zapis dziecka na zajęcia, wygenerowanie raportu.

Narzędzia:
- Testy HTTP (np. Supertest + Vitest), ewentualnie Playwright API request fixture.
- Testowa instancja Supabase lub dockerowy PostgreSQL z odtworzonymi migracjami.

### 3.3 Testy end-to-end (E2E)

Zakres:
- Kluczowe ścieżki użytkownika (rodzic, administrator) w przeglądarce.
- Interakcja z komponentami React (formularze, nawigacja, paginacja, toasty).

Przykładowe scenariusze:
- Rodzic: rejestracja → logowanie → dodanie dziecka → zapis na zajęcia → podejrzenie zapisów.
- Administrator: logowanie → dodanie zajęć → sprawdzenie listy rodziców → weryfikacja liczby dzieci i zapisów.
- Ochrona tras: próba wejścia na `/admin` jako rodzic → przekierowanie.

Narzędzia: Playwright (Playwright preferowany ze względu na integrację UI + API + auth).

### 3.4 Testy UI/komponentów (Component Tests)

Zakres:
- Kluczowe komponenty React w `src/components/admin`, `src/components/dashboard`, `src/components/form` i `src/components/ui`.
- Sprawdzenie renderingów, obsługi zdarzeń, integracji z formularzami i walidacją.

Narzędzia:
- React Testing Library + Vitest.
- Visual regression (opcjonalnie) – Playwright z porównaniem screenshotów.

### 3.5 Testy bezpieczeństwa (w ograniczonym zakresie)

Zakres:
- Weryfikacja poprawności autoryzacji na endpointach (Supabase policies + warstwa API Astro).
- Sprawdzenie, że dane rodziców/dzieci nie są dostępne z niewłaściwych kont.
- Testy odporności na proste ataki (np. brak wstrzykiwania na poziomie zapytań dzięki parametryzacji Supabase).

Narzędzia:
- Ręczne testy + kontrolne skrypty (np. Postman/Insomnia).
- Lintery bezpieczeństwa (np. ESLint pluginy).

### 3.6 Testy wydajności

Zakres:
- Lista zajęć (API `activities`).
- Lista rodziców z agregacją dzieci i maili (RPC + dodatkowe zapytania).
- Raporty (funkcje agregujące w DB).

Narzędzia:
- K6, Artillery, Locust lub podobne (w zależności od standardów zespołu).
- Analiza logów i metryk środowiska (np. parametry Supabase, monitoring).

### 3.7 Testy użyteczności i dostępności

Zakres:
- Główne widoki: dashboard rodzica, dashboard admina, strony auth.
- Poruszanie się po stronie z klawiatury, czytelność dla screen readerów (role, aria-*).
- Responsywność (widoki mobilne, tablet, desktop).

Narzędzia:
- Ręczne przejścia + checklisty UX.
- Lighthouse, axe-core (np. integracja z Playwright).

## 4. Scenariusze testowe dla kluczowych funkcjonalności

Poniżej przykładowe scenariusze wysokiego poziomu (będą rozpisane na szczegółowe przypadki testowe w narzędziu zarządzania testami).

### 4.1 Autentykacja

1. **Rejestracja nowego rodzica**
   - Wejście na `/auth/register`.
   - Wypełnienie poprawnych danych.
   - Otrzymanie komunikatu sukcesu.
   - Możliwość zalogowania się na nowe konto.

2. **Logowanie rodzica**
   - Poprawne dane → wejście na `/app`.
   - Błędne hasło → komunikat o błędzie, brak logowania.
   - Nieistniejący e-mail → komunikat o błędzie.

3. **Reset hasła**
   - Wysłanie formularza resetu (`ResetRequestForm.tsx`).
   - Otrzymanie maila (w testach: mock).
   - Ustawienie nowego hasła (`UpdatePasswordForm.tsx`), ponowne logowanie.

4. **Autoryzacja ról**
   - Rodzic próbuje odwiedzić `/admin` → przekierowanie do odpowiedniej strony/komunikat.
   - Administrator odwiedza `/app` → w zależności od wymagań, dopuszczone/odrzucane.

### 4.2 Panel rodzica

1. **Zarządzanie dziećmi**
   - Dodanie nowego dziecka (poprawne i błędne dane).
   - Edycja istniejącego dziecka.
   - Walidacja daty urodzenia (`DatePicker`, `DateTimePicker`).

2. **Przeglądanie oferty zajęć**
   - Lista zajęć ładuje się poprawnie (uwzględnia paginację i filtry).
   - Sprawdzenie, że dane zajęć pokrywają się z danymi w panelu admina.

3. **Zapisy na zajęcia**
   - Rodzic wybiera dziecko i zajęcia → zapis powodzi się, pojawia się na liście zapisów.
   - Próba ponownego zapisu tego samego dziecka na te same zajęcia → odpowiednie zachowanie (błąd lub idempotencja).
   - Anulowanie zapisu – aktualizacja statusu na liście i w panelu admina.

4. **Przegląd zapisów**
   - Widok wszystkich aktualnych zapisów danego dziecka (liczba, nazwy zajęć).
   - Spójność z danymi w raporcie admina.

### 4.3 Panel administratora

1. **Zarządzanie zajęciami**
   - Dodanie nowych zajęć (`AdminActivityForm.tsx`) – wymagane pola, walidacje (daty, limity).
   - Edycja istniejących zajęć (zmiana godzin, limitów).
   - Usuwanie zajęć (`DeleteActivityDialog.tsx`) – potwierdzenie, konsekwencje dla istniejących zapisów.

2. **Zarządzanie rodzicami**
   - Lista rodziców (`AdminParentsTable.tsx`) – sprawdzenie paginacji, wyszukiwania po imieniu/nazwisku.
   - Weryfikacja kolumn: imię, nazwisko, e-mail (z `get_auth_emails`), liczba dzieci.
   - Sprawdzenie szczegółów rodzica (dzieci, liczba zapisów na dziecko).

3. **Zarządzanie pracownikami**
   - Dodawanie pracownika (walidacje, rola).
   - Przypisywanie do zajęć (jeśli funkcjonalność istnieje).
   - Sprawdzenie, że pracownik nie ma dostępu do panelu rodzica.

4. **Raporty**
   - Generowanie raportu zapisów per zajęcia (ilości).
   - Porównanie z rzeczywistymi danymi zapisów w bazie (spójność).

### 4.4 Integracje z Supabase i RPC

1. **Profil użytkownika i e-mail**
   - Dodanie profilu w `profiles`.
   - Weryfikacja, że RPC `get_auth_emails` zwraca poprawny e-mail dla listy użytkowników.
   - Błąd RPC → obsługa błędu w serwisach (`createError("INTERNAL_ERROR", ...)`), poprawne komunikaty na UI.

2. **Trigger profilu po rejestracji**
   - Rejestracja nowego użytkownika.
   - Automatyczne stworzenie profilu w `profiles` poprzez trigger (z migracji `add_profile_trigger*.sql`).
   - Spójność pól: `id`, `role`, daty.

### 4.5 Scenariusze negatywne i brzegowe

- Brak połączenia z Supabase (symulacja) → przyjazny komunikat błędu, brak wycieku szczegółów technicznych.
- Odpowiedź Supabase z błędem (np. błąd w RPC, limit zapytań) → poprawne zalogowanie i obsługa.
- Dane niekompletne (np. brak `first_name`/`last_name` w `profiles`) → poprawne mapowanie na pusty string z `ForceNonNullable` w DTO.

## 5. Środowisko testowe

### 5.1 Konfiguracja środowisk

- **Środowisko developerskie (DEV)** – lokalne uruchomienie Astro, podpięcie do instancji Supabase DEV.
- **Środowisko testowe (TEST)** – osobna instancja aplikacji i Supabase (inne klucze, osobne bazy), wykorzystywana przez integrację CI oraz testy E2E.
- **Środowisko ciągłej integracji (CI)** – pipeline GitHub Actions uruchamiający:
  - Lint + testy jednostkowe + testy integracyjne.
  - Opcjonalnie testy E2E w trybie headless (np. Playwright na dockerowym Chromium).

### 5.2 Baza danych i migracje

- Automatyczne odtwarzanie schematu na TEST/CI poprzez `supabase/migrations/*.sql`.
- Seed danych testowych:
  - Użytkownicy testowi (admin1, parent1, parent2).
  - Przykładowe zajęcia (z różnymi limitami, datami).
  - Dzieci powiązane z rodzicami.
  - Przykładowe zapisy dla scenariuszy raportów.

### 5.3 Konfiguracja aplikacji

- Pliki `.env.test` i `.env.ci` z odpowiednimi kluczami Supabase (anon, service role – jeśli potrzebne do testów integracyjnych/internych).
- Konfiguracja Astro do pracy w trybie testowym (np. inne URL-e backendu, log-level).

## 6. Narzędzia do testowania

- **Runner testów jednostkowych/integracyjnych:** Vitest (w zależności od standardu repo) z integracją dla TypeScript.
- **Biblioteka do testów UI/React:** React Testing Library.
- **Narzędzie do testów E2E:** Playwright (preferowane).
- **Narzędzie do testów API:** Supertest, Postman/Insomnia (ręczne), Playwright request API.
- **Lintery i formatowanie:** ESLint, Prettier (zgodnie z `eslint.config.js` i `tsconfig.json`).
- **Testy wydajności:** K6/Artillery (uruchamiane z CI lub lokalnie).
- **Dostępność:** axe-core (np. `@axe-core/playwright`) + Lighthouse.

## 7. Harmonogram testów

### Faza 1 – Przygotowanie (1–2 sprinty)

- Ustalenie standardu testów (runner, konwencje katalogów testów, np. `src/**/__tests__` lub `*.test.ts(x)`).
- Przygotowanie środowisk TEST/CI (Supabase, migracje, seedy).
- Wprowadzenie podstawowego zestawu testów jednostkowych dla:
  - `src/lib/pagination.utils.ts`
  - `src/lib/validation/*.schema.ts`
  - `src/lib/services/activities.service.ts` (część kluczowych funkcji).

### Faza 2 – Pokrycie krytycznych funkcji (2–3 sprinty)

- Rozszerzenie testów jednostkowych na pozostałe serwisy (`parents.service.ts`, `enrollments.service.ts`, `profile.service.ts` itd.).
- Wprowadzenie testów integracyjnych dla najważniejszych endpointów API (auth, children, enrollments).
- Pierwsze scenariusze E2E: rejestracja/logowanie, podstawowe zapisy na zajęcia.

### Faza 3 – Stabilizacja i rozszerzenie (ciągła)

- Rozbudowa zestawu testów E2E o panel admina i raporty.
- Dodanie testów wydajnościowych dla najcięższych endpointów.
- Regularna analiza pokrycia kodu i uzupełnianie braków w krytycznych miejscach.

### Faza 4 – Przed wydaniem produkcyjnym

- Wykonanie pełnego regresyjnego przebiegu E2E na aktualnym buildzie.
- Analiza defektów, fixy i retesty.
- Zatwierdzenie kryteriów akceptacji.

## 8. Kryteria akceptacji testów

- **Funkcjonalne:**
  - 100% zrealizowanych i zaliczonych scenariuszy testowych dla kluczowych przepływów:
    - Rejestracja/logowanie/reset hasła.
    - Zarządzanie dziećmi (dodanie/edycja).
    - Zapisy i wypisy na/z zajęć.
    - Podstawowe operacje w panelu admina (dodanie zajęć, lista rodziców, raporty).
- **Pokrycie testami:**
  - Minimum 70% pokrycia kodu (statement/branch) dla warstwy serwisów w `src/lib/services`.
  - Minimum 60% pokrycia komponentów formularzowych i UI handlerów.
- **Defekty:**
  - Brak otwartych defektów o priorytecie krytycznym i wysokim.
  - Łączna liczba defektów średnich i niskich zaakceptowana przez Product Ownera.
- **Wydajność:**
  - Czas odpowiedzi kluczowych endpointów pod obciążeniem testowym w akceptowalnych granicach (do zdefiniowania, np. P95 < 500 ms).
- **Bezpieczeństwo:**
  - Brak wykrytych luk w autoryzacji podstawowych zasobów (rodzice, dzieci, zapisy).
- **Dostępność:**
  - Kluczowe widoki przechodzą podstawowe testy axe-core bez krytycznych błędów.

## 9. Role i odpowiedzialności w procesie testowania

- **QA Engineer:**
  - Definiowanie strategii testów i tworzenie planu testów.
  - Projektowanie przypadków testowych funkcjonalnych i niefunkcjonalnych.
  - Implementacja testów automatycznych (unit, integration, E2E) we współpracy z zespołem.
  - Analiza wyników testów, raportowanie defektów, wsparcie przy ich diagnozowaniu.

- **Backend/Fullstack Developer:**
  - Implementacja i utrzymanie testów jednostkowych dla usług i logiki backendowej (Supabase, serwisy).
  - Wsparcie przy testach integracyjnych i poprawie wydajności.
  - Szybkie reagowanie na zgłoszone defekty backendowe.

- **Frontend Developer:**
  - Implementacja i utrzymanie testów komponentów React oraz części scenariuszy E2E.
  - Dbanie o dostępność, responsywność i poprawny UX.
  - Współpraca z QA przy tworzeniu przypadków regresyjnych UI.

- **DevOps / Inżynier CI/CD:**
  - Konfiguracja pipeline’ów GitHub Actions (lint, unit, integration, E2E).
  - Utrzymanie środowisk TEST i CI (Supabase, sekrety, zmienne środowiskowe).
  - Monitorowanie stabilności uruchamianych testów (np. flaky tests).

- **Product Owner / Analityk:**
  - Priorytetyzacja scenariuszy testowych.
  - Akceptacja kryteriów wejścia/wyjścia z faz testowych.
  - Odbiór funkcjonalności na podstawie raportów z testów.

## 10. Procedury raportowania błędów

### 10.1 Zgłaszanie defektów

Każdy zidentyfikowany defekt powinien zostać zgłoszony w systemie do zarządzania zadaniami (np. GitHub Issues, Jira) z następującymi informacjami:

- **Tytuł:** Krótkie, opisowe streszczenie problemu.
- **Opis:** 
  - Oczekiwane zachowanie.
  - Obserwowane zachowanie.
- **Kroki do odtworzenia:**
  - Precyzyjna lista działań użytkownika (np. URL, dane wejściowe).
  - Informacja o koncie (rola: rodzic/admin, testowy login).
- **Środowisko:**
  - Środowisko (DEV/TEST/CI).
  - Wersja aplikacji (commit SHA, tag).
  - Przeglądarka/system (dla defektów UI).
- **Logi i załączniki:**
  - Zrzuty ekranu.
  - Fragmenty logów (z maskowaniem wrażliwych danych).
  - Export requestów (np. z Postmana/Playwright).
- **Kategoryzacja:**
  - Priorytet (Krytyczny, Wysoki, Średni, Niski).
  - Typ defektu (Funkcjonalny, UI, Wydajnościowy, Bezpieczeństwa, Inny).
  - Obszar systemu (auth, admin-activities, parents, enrollments, profile, reports).

### 10.2 Cykl życia defektu

1. **Nowy (New):** Defekt zgłoszony przez QA, dewelopera lub innego członka zespołu.
2. **Analiza (Triaged):** Określenie priorytetu, przypisanie do odpowiedniego dewelopera/zespołu.
3. **W trakcie (In Progress):** Deweloper pracuje nad poprawką.
4. **Do weryfikacji (Ready for QA):** Poprawka wdrożona na środowisko testowe, oczekuje na retest.
5. **Zamknięty (Closed):**
   - QA potwierdził brak problemu w retestach.
   - Jeśli problem nadal występuje – defekt jest ponownie otwierany (Reopened).
6. **Odrzucony (Rejected):** W uzasadnionych przypadkach (np. duplikat, nie błąd, oczekiwane zachowanie).

### 10.3 Raporty z testów

- **Raport sprintowy:**
  - Liczba wykonanych przypadków testowych, liczba zaliczonych/niezaliczonych.
  - Liczba i typy zidentyfikowanych defektów (z podziałem na priorytety).
  - Stan pokrycia testami (przynajmniej dla kluczowych modułów).
- **Raport przedwydaniowy (release):**
  - Podsumowanie wszystkich krytycznych scenariuszy E2E i ich statusu.
  - Lista otwartych defektów wraz z akceptacją/odroczeniem.
  - Rekomendacja QA: gotowość/niegotowość do wydania.

---

Ten plik stanowi źródło prawdy dla strategii testowania projektu KidsEnroll i powinien być aktualizowany wraz z rozwojem funkcjonalności i zmianami w architekturze systemu.

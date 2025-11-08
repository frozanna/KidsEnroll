# Architektura UI dla KidsEnroll (MVP)

## 1. Przegląd struktury UI

KidsEnroll (MVP) zapewnia dwa główne konteksty aplikacyjne oparte o role: Panel Rodzica oraz Panel Administratora. Aplikacja jest projektowana Desktop‑first (≥1024px) z wykorzystaniem Astro (routing + SSR) i wysp React do interaktywności. Wszystkie operacje CRUD odbywają się na dedykowanych stronach (trasy), a nie w modalach (z wyjątkiem wyboru dziecka przy zapisie oraz potwierdzeń destrukcyjnych). SSR jest używane dla stron wymagających wstępnego pobrania danych (edycja zasobów, formularze z referencjami), natomiast tabele i lazy‑load sekcji (rozsuwane akordeony) pobierają dane klientowo poprzez API. Uwierzytelnianie i autoryzacja bazują na Supabase (sesja w cookies + middleware). UI konsekwentnie stosuje wzorce: formularze (z walidacją Zod), DataTable (paginacja/wyszukiwanie serwerowe), Accordion (lazy-load zapisów), Dialog / AlertDialog (zapis, potwierdzenia), Toast (globalny feedback) oraz Alert (błędy walidacji w formularzach). Wszystkie daty w UI wyświetlane są w lokalnej strefie użytkownika, a komunikacja z API używa UTC.

## 2. Lista widoków

Każdy widok opisany wg schematu: Nazwa | Ścieżka | Cel | Kluczowe informacje | Kluczowe komponenty | Uwagi UX / A11y / Security.

### 2.1. Strony publiczne / auth
1. Strona startowa (landing minimalny) | `/` | Wejście do aplikacji, CTA do logowania/rejestracji | Logo, krótki opis, przyciski "Zaloguj", "Zarejestruj" | Static Astro, Button | Minimalizm; linki dostępne klawiaturą; brak wrażliwych danych.
2. Rejestracja | `/register` | Utworzenie konta rodzica | Formularz: email, hasło; komunikaty błędów | Card, Form, Input (email/password), Alert (błędy), Button | Walidacja siły hasła (min 8), focus management po błędzie, blokada wielokrotnego submitu.
3. Logowanie | `/login` | Uwierzytelnienie (rodzic/admin) | Formularz: email, hasło; przekierowanie wg roli | Card, Form, Alert (błędy), Button | Maskowanie hasła, brak enumeracji kont, generyczne komunikaty przy błędach.

### 2.2. Panel Rodzica
4. Dashboard Rodzica | `/app/dashboard` | Centralny widok: lista dzieci + ich zapisy | Lista dzieci (accordion), stany zapisów, przycisk generowania raportu, przycisk dodania dziecka (jeśli >0 dzieci też dostępny) | Accordion (lazy), Spinner, EnrollmentItem, Button, Toast | Lazy load enrollments on expand; aria-controls/aria-expanded; ograniczenia dostępu gdy brak dzieci (onboarding soft gate).
5. Dodaj dziecko | `/app/dzieci/dodaj` (również redirect po rejestracji) | Wymuszenie utworzenia co najmniej jednego dziecka | Formularz: imię, nazwisko, data urodzenia, opis (opcjonalny) | Form, Input, DatePicker, Textarea, Alert (błędy), Button | Walidacja daty (nie w przyszłości); po sukcesie redirect do dashboard; brak nawigacji do innych sekcji przed ukończeniem.
7. Edycja dziecka | `/app/dzieci/:id/edit` | Korekta danych profilu dziecka | Dane dziecka, formularz edycji | SSR fetch + Form, Inputs, DatePicker, Alert, Button | Sprawdzenie właścicielstwa dziecka (403 jeśli nie należy do rodzica).
8. Lista zajęć (rodzic) | `/app/zajecia` | Przegląd dostępnych zajęć | Tabela: nazwa, opis, opiekun, data/godzina, koszt, wolne miejsca, tagi, akcja Zapisz (lub zablokowana) | DataTable, Badge (tagi), Button (Zapisz), Dialog (wybór dziecka), Skeleton, Toast | Pełny opis w kolumnie; disabled button jeśli brak miejsc; komunikat "Brak dostępnych zajęć" przy pustej liście.
9. Dialog zapisu na zajęcia | (modal, bez własnej trasy – inicjowany z 8) | Wybór dziecka i potwierdzenie zapisu | Lista dzieci (radio/select), streszczenie zajęć, przycisk Potwierdź | Dialog, RadioGroup / Select, Button, Alert (błędy), Toast | Focus trap; ESC close
10. Wypisanie z zajęć (potwierdzenie) | (AlertDialog - akcja z dashboardu) | Potwierdzenie akcji destrukcyjnej | Nazwa zajęć, dziecko, reguła 24h | AlertDialog, Button (destructive) | Blokada przy <24h (przycisk disabled + tooltip wyjaśniający).
11. Raport kosztów tygodniowych | (akcja z dashboardu) | Generacja i pobranie pliku XLSX | Spinner podczas generacji, toast po sukcesie | Button, Toast, Loading overlay | Obsługa błędów (Toast); poprawna nazwa pliku; guard brak dzieci/zajęć.
12. Profil rodzica | `/app/profil` | Edycja danych profilu (imię/nazwisko) | Formularz z prefill | Form, Input, Alert, Button, Toast | SSR prefetch; ochronić email przed edycją.

### 2.3. Panel Administratora
13. Redirect startowy admina | `/admin` | Przekierowanie do listy zajęć | (Brak UI) | 302 redirect | Minimalny.
14. Lista zajęć (admin) | `/admin/activities` | Zarządzanie zajęciami | Tabela: nazwa, tagi, opiekun, data/godzina, limit, wolne miejsca, koszt, akcje (Edytuj/Usuń) | DataTable (server pagination+search), Badge, Button (link), AlertDialog (Usuń), Skeleton, Toast | Parametry page/search w query; potwierdzenie usunięcia wraz z infomacją o mock powiadomieniach - Toast; obsługa pustej listy (pusta tabela).
15. Dodawanie zajęć | `/admin/activities/new` | Utworzenie nowej aktywności | Formularz: nazwa, opis, koszt, limit, data/godzina (UTC konwersja), wybór opiekuna, tagi | SSR fetch workers + tags; Form, Input, Textarea, NumberInput, DateTimePicker, Select (workers), MultiSelect/ComboBox (tags), Alert, Button, Toast | Walidacja przyszłej daty; maks. liczby znaków; tagi pobierane z backendowego endpointu GET `/admin/tags`.
16. Edycja zajęć | `/admin/activities/:id/edit` | Aktualizacja istniejącej aktywności | Prefill danych + formularz jak w (15) | SSR fetch activity + workers + tags; Form itd. | -
17. Lista opiekunów | `/admin/workers` | Przegląd opiekunów | Tabela: imię, nazwisko, email; brak paginacji | DataTable (client load once), Button (Dodaj, Usuń), Toast | Spójne kolumny; brak paginacji; powiadomienie o niemożliwości usunięcia opiekuna.
18. Dodawanie opiekuna | `/admin/workers/new` | Utworzenie nowego opiekuna | Formularz: imię, nazwisko, email | Form, Input, Alert, Button, Toast | Walidacja unikalności email po stronie API; po sukcesie redirect do listy.
19. Edycja opiekuna | `/admin/workers/:id/edit` | Aktualizacja danych opiekuna | Prefill danych + formularz | SSR fetch worker; Form, Input, Alert, Button, Toast | -
20. Lista rodziców | `/admin/parents` | Przegląd kont rodziców | Tabela z paginacją/ wyszukiwaniem (email, imię, nazwisko), akcja Usuń | DataTable (server pagination+search), AlertDialog (potwierdzenie), Toast | Potwierdzenie skutków kaskadowych (tekst w dialogu); brak edycji.
21. Szczegóły rodzica | `/admin/parents/:id` | Wgląd w dane rodzica i jego dzieci | Dane profilu, lista dzieci (z podstawowymi parametrami) | SSR fetch; Card sekcje, List, Button (powrót) | 404 gdy brak; ochrona administracyjna.

### 2.4. Wspólne / systemowe
22. Błędy globalne | `/error/401`, `/error/403`, `/error/404`, `/error/500` (lub jeden dynamiczny) | Czytelne komunikaty błędów | Kod, opis, CTA (powrót / logowanie) | Static Astro, Button | Dostępność: nagłówek h1 z kodem i opisem.
23. Wylogowanie | `/logout` (akcja) | Inicjuje zakończenie sesji i redirect do `/` | (Brak UI) | Action + redirect | CSRF safe (cookie based) – w MVP minimalnie.

## 3. Mapa podróży użytkownika

### 3.1. Rejestracja i onboarding (Rodzic)
1. Wejście na `/` → klik "Zarejestruj" → `/register`.
2. Wypełnia formularz → sukces → backend tworzy profil → redirect do `/app/dzieci/dodaj`.
3. Wypełnia dane dziecka → sukces → redirect `/app/dashboard` (accordion z jednym dzieckiem, sekcja zapisów pusta).
4. Może: a) dodać kolejne dziecko (link) b) przejść do `/app/zajecia` c) wygenerować raport (jeśli istnieją zapisy – na początku brak).

### 3.2. Zapis dziecka na zajęcia
1. Z Dashboardu lub z `/app/zajecia` użytkownik widzi zajęcia.
2. Klik "Zapisz" → otwiera Dialog wyboru dziecka.
3. Wybór dziecka → Potwierdź → POST enrollment → sukces: Toast + aktualizacja wolnych miejsc + pojawienie się zajęć w accordion dziecka po ponownym załadowaniu / lazy refresh.
4. Jeśli limit osiągnięty: przycisk disabled + tooltip "Brak miejsc".

### 3.3. Wypisanie
1. Użytkownik rozwija dziecko w accordion.
2. Klik "Wypisz" przy danej aktywności (enabled jeśli >=24h).
3. AlertDialog: potwierdzenie → DELETE → sukces Toast + usunięcie z listy.

### 3.4. Raport kosztów
1. Na Dashboard klik "Generuj raport".
2. GET raport (blob) → loading overlay/spinner.
3. Po sukcesie – pobieranie pliku + Toast.

### 3.5. Przepływ Administratora – Zarządzanie zajęciami
1. Logowanie (admin) → redirect `/admin` → 302 `/admin/activities`.
2. Lista zajęć (paginacja, wyszukiwanie) → klik "Dodaj" → `/admin/activities/new`.
3. Wypełnienie formularza → POST → sukces Toast + redirect `/admin/activities`.
4. Edycja: link przy wierszu → `/admin/activities/:id/edit` → PATCH → Toast (liczba powiadomień) → powrót.
5. Usuwanie: AlertDialog → DELETE → Toast (liczba powiadomień) → refresh tabeli.

### 3.6. Przepływ Administratora – Zarządzanie opiekunamy
1. Nawigacja do `/admin/wokers`.
2. Lista opiekunów → klik "Dodaj" → `/admin/workers/new`.
3. Wypełnienie formularza → POST → sukces Toast + redirect `/admin/workers`.
4. Edycja: link przy wierszu → `/admin/workers/:id/edit` → PATCH → powrót.
5. Usuwanie: AlertDialog → DELETE → Toast (informacja, jeśli nie udało sie usunąć) → refresh tabeli.

### 3.7. Zarządzanie rodzicami (Admin)
1. Nawigacja do `/admin/parents`.
2. Wpisanie frazy w search → debounce → reload z parametrem.
3. Usuwanie rodzica → AlertDialog z ostrzeżeniem kaskady → DELETE → Toast → odświeżenie listy.

## 4. Układ i struktura nawigacji

### 4.1. Warstwy nawigacji
1. Globalna górna belka (po zalogowaniu): logo + (po stronie rodzica) linki: Dashboard, Zajęcia, Profil, Wyloguj. W stanie onboarding (brak dzieci) – tylko logo, Profil i Wyloguj + wyróżniony przycisk "Dodaj dziecko".
2. Panel Admina: top bar + poziome menu lub boczny panel z sekcjami: Zajęcia, Opiekunowie, Rodzice. Aktywny stan wyróżniony.
3. Breadcrumbs dla stron formularzy i widoków podrzędnych (np. Admin: Zajęcia > Edycja). 
4. CTA kontekstowe (primary action) w prawym obszarze nagłówka sekcji (np. "Dodaj zajęcia").

### 4.2. Stany nawigacyjne
– Onboarding lock: ukrycie większości linków do czasu dodania pierwszego dziecka (miękka blokada – bez dostępu do innych tras z UI).
– Po zmianie roli (admin vs rodzic) – odseparowane przestrzenie routingu (`/app/*` vs `/admin/*`).

## 5. Kluczowe komponenty
1. DataTable: kolumny definiowalne, wsparcie dla server pagination (page, limit, search), skeleton rows, empty state prosty (brak wierszy).
2. Accordion (Dashboard dzieci): lazy load w onExpand, spinner w treści, aria-controls/expanded, klawisze strzałek.
3. Formularze (Generic Form Wrapper): integracja z Zod; pola z label + aria-invalid + opis błędu w Alert (destructive) wewnętrznie; disabled state przy submit.
4. Dialog (Zapis na zajęcia): focus trap, ESC, aria-labelledby, rolę dialog; radio/select list dzieci.
5. AlertDialog (Potwierdzenia destrukcyjne): wzorzec Radix – confirm i cancel; treść zawiera konsekwencje (np. usunięcie zajęć wysyła powiadomienia).
6. Toast (Global Feedback): sukces, błąd, autohide; wywoływany po działaniach asynchronicznych; aria-live="polite".
7. Alert (Validation): jednorazowy blok błędów formularza u góry sekcji, rola alert.
8. Select / ComboBox (Opiekunowie, tagi): klawiatura, filtracja, czytelne focus ringi.
9. DatePicker / DateTimePicker: wybór lokalnej daty/czasu → transformacja do UTC ISO na submit.
10. Badge (Tagi): semantyczny span z rolą presentation, kontrast kolorów.
11. Spinner / Skeleton: spinner dla krótkich operacji (lazy loads, dialog submission), skeleton dla tabel.
12. Pagination Controls: przyciski poprzednia/następna strona z aria-label; wskaźnik bieżącej strony.
13. Search Input (debounced): aria-label, clear button.
14. Breadcrumbs: lista nawigacyjna (nav aria-label="breadcrumbs").
15. FileDownload Helper (Raport): obsługa blob, ustawienie nazwy pliku, fallback komunikat przy błędzie.

## 6. Przypadki brzegowe i stany błędów

| Kontekst | Przypadek | Reakcja UI |
|----------|-----------|-----------|
| Onboarding | Brak dzieci | Redirect do `/app/dzieci/dodaj`, dashboard pokazuje CTA dodania dziecka gdy wymuszone ręcznie |
| Lista zajęć (rodzic) | Brak zajęć | Tabela pusta + tekst w nagłówku: "Brak dostępnych zajęć" |
| Lista zajęć | Pełen limit | Disabled "Zapisz" + tooltip "Brak miejsc" |
| Zapis | Duplikat zapisu | Toast (error) + brak zmian w UI |
| Wypisanie | <24h do startu | Przycisk disabled + tooltip z regułą |
| Raport | Brak zapisów w tygodniu | Toast info: "Brak danych do raportu" |
| Admin – usuwanie rodzica | Rodzic nie istnieje | Toast error, odświeżenie listy |
| Admin – tworzenie zajęć | Data w przeszłości | Alert (validation) w formularzu |
| Brak autoryzacji | 401/403 | Redirect do strony błędu lub login; zachowanie poprzedniej docelowej trasy w param | 
| 404 zasobu | Dziecko / zajęcia / aktywność | Strona 404 z CTA powrotu |
| Błąd sieci | Timeout API | Toast error + opcja Retry (przycisk w toast) |
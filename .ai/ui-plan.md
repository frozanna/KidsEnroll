# Architektura UI dla KidsEnroll (MVP)

## 1. Przegląd struktury UI

KidsEnroll (MVP) zapewnia dwa główne konteksty aplikacyjne oparte o role: Panel Rodzica oraz Panel Administratora. Aplikacja jest projektowana Desktop‑first (≥1024px) z wykorzystaniem Astro (routing + SSR) i wysp React do interaktywności. Wszystkie operacje CRUD odbywają się na dedykowanych stronach (trasy), a nie w modalach (z wyjątkiem wyboru dziecka przy zapisie oraz potwierdzeń destrukcyjnych). SSR jest używane dla stron wymagających wstępnego pobrania danych (edycja zasobów, formularze z referencjami), natomiast tabele i lazy‑load sekcji (rozsuwane akordeony) pobierają dane klientowo poprzez API. Uwierzytelnianie i autoryzacja bazują na Supabase (sesja w cookies + middleware). UI konsekwentnie stosuje wzorce: formularze (z walidacją Zod), DataTable (paginacja/wyszukiwanie serwerowe), Accordion (lazy-load zapisów), Dialog / AlertDialog (zapis, potwierdzenia), Toast (globalny feedback) oraz Alert (błędy walidacji w formularzach). Wszystkie daty w UI wyświetlane są w lokalnej strefie użytkownika, a komunikacja z API używa UTC.

## 2. Lista widoków

### 2.1. Strony publiczne / auth
1. **Strona startowa (landing minimalny)**
- **Ścieżka**: `/`
- **Cel**: Wejście do aplikacji, CTA do logowania/rejestracji
- **Kluczowe informacje**: Logo, krótki opis, przyciski "Zaloguj", "Zarejestruj"
- **Kluczowe komponenty**: Static Astro, Button
- **Uwagi UX / A11y / Security**: Minimalizm; linki dostępne klawiaturą; brak wrażliwych danych.
2. **Rejestracja**
- **Ścieżka**: `/register`
- **Cel**: Utworzenie konta rodzica
- **Kluczowe informacje**: Formularz: email, hasło; komunikaty błędów
- **Kluczowe komponenty**: Card, Form, Input (email/password), Alert (błędy), Button
- **Uwagi UX / A11y / Security**: Walidacja siły hasła (min 8), focus management po błędzie, blokada wielokrotnego submitu.
3. **Logowanie**
- **Ścieżka**: `/login`
- **Cel**: Uwierzytelnienie (rodzic/admin)
- **Kluczowe informacje**: Formularz: email, hasło; przekierowanie wg roli
- **Kluczowe komponenty**: Card, Form, Alert (błędy), Button
- **Uwagi UX / A11y / Security**: Maskowanie hasła, brak enumeracji kont, generyczne komunikaty przy błędach.

### 2.2. Panel Rodzica
4. **Dashboard Rodzica**
- **Ścieżka**: `/app/dashboard`
- **Cel**: Centralny widok: lista dzieci + ich zapisy
- **Kluczowe informacje**: Lista dzieci (accordion), stany zapisów, przycisk generowania raportu, przycisk dodania dziecka (jeśli >0 dzieci też dostępny)
- **Kluczowe komponenty**: Accordion (lazy), Spinner, EnrollmentItem, Button, Toast
- **Uwagi UX / A11y / Security**: Lazy load enrollments on expand; aria-controls/aria-expanded; ograniczenia dostępu gdy brak dzieci (onboarding soft gate).
5. **Dodaj dziecko**
- **Ścieżka**: `/app/dzieci/dodaj` (również redirect po rejestracji)
- **Cel**: Wymuszenie utworzenia co najmniej jednego dziecka
- **Kluczowe informacje**: Formularz: imię, nazwisko, data urodzenia, opis (opcjonalny)
- **Kluczowe komponenty**: Form, Input, DatePicker, Textarea, Alert (błędy), Button
- **Uwagi UX / A11y / Security**: Walidacja daty (nie w przyszłości); po sukcesie redirect do dashboard; brak nawigacji do innych sekcji przed ukończeniem.
7. **Edycja dziecka**
- **Ścieżka**: `/app/dzieci/:id/edit`
- **Cel**: Korekta danych profilu dziecka
- **Kluczowe informacje**: Dane dziecka, formularz edycji
- **Kluczowe komponenty**: SSR fetch + Form, Inputs, DatePicker, Alert, Button
- **Uwagi UX / A11y / Security**: Sprawdzenie właścicielstwa dziecka (403 jeśli nie należy do rodzica).
8. **Lista zajęć (rodzic)**
- **Ścieżka**: `/app/zajecia`
- **Cel**: Przegląd dostępnych zajęć
- **Kluczowe informacje**: Tabela: nazwa, opis, opiekun, data/godzina, koszt, wolne miejsca, tagi, akcja Zapisz (lub zablokowana)
- **Kluczowe komponenty**: DataTable, Badge (tagi), Button (Zapisz), Dialog (wybór dziecka), Skeleton, Toast
- **Uwagi UX / A11y / Security**: Pełny opis w kolumnie; disabled button jeśli brak miejsc; komunikat "Brak dostępnych zajęć" przy pustej liście.
9. **Dialog zapisu na zajęcia**
- **Ścieżka**: (modal, bez własnej trasy – inicjowany z 8)
- **Cel**: Wybór dziecka i potwierdzenie zapisu
- **Kluczowe informacje**: Lista dzieci (radio/select), streszczenie zajęć, przycisk Potwierdź
- **Kluczowe komponenty**: Dialog, RadioGroup / Select, Button, Alert (błędy), Toast
- **Uwagi UX / A11y / Security**: Focus trap; ESC close
10. **Wypisanie z zajęć (potwierdzenie)**
- **Ścieżka**: (AlertDialog - akcja z dashboardu)
- **Cel**: Potwierdzenie akcji destrukcyjnej
- **Kluczowe informacje**: Nazwa zajęć, dziecko, reguła 24h
- **Kluczowe komponenty**: AlertDialog, Button (destructive)
- **Uwagi UX / A11y / Security**: Blokada przy <24h (przycisk disabled + tooltip wyjaśniający).
11. **Raport kosztów tygodniowych**
- **Ścieżka**: (akcja z dashboardu)
- **Cel**: Generacja i pobranie pliku XLSX
- **Kluczowe informacje**: Spinner podczas generacji, toast po sukcesie
- **Kluczowe komponenty**: Button, Toast, Loading overlay
- **Uwagi UX / A11y / Security**: Obsługa błędów (Toast); poprawna nazwa pliku; guard brak dzieci/zajęć.
12. **Profil rodzica**
- **Ścieżka**: `/app/profil`
- **Cel**: Edycja danych profilu (imię/nazwisko)
- **Kluczowe informacje**: Formularz z prefill
- **Kluczowe komponenty**: Form, Input, Alert, Button, Toast
- **Uwagi UX / A11y / Security**: SSR prefetch; ochronić email przed edycją.

### 2.3. Panel Administratora
13. **Redirect startowy admina**
- **Ścieżka**: `/admin`
- **Cel**: Przekierowanie do listy zajęć
- **Kluczowe informacje**: (Brak UI)
- **Kluczowe komponenty**: 302 redirect
- **Uwagi UX / A11y / Security**: Minimalny.
14. **Lista zajęć (admin)**
- **Ścieżka**: `/admin/activities`
- **Cel**: Zarządzanie zajęciami
- **Kluczowe informacje**: Tabela: nazwa, tagi, opiekun, data/godzina, limit, wolne miejsca, koszt, akcje (Edytuj/Usuń)
- **Kluczowe komponenty**: DataTable (server pagination+search), Badge, Button (link), AlertDialog (Usuń), Skeleton, Toast
- **Uwagi UX / A11y / Security**: Parametry page/search w query; potwierdzenie usunięcia wraz z infomacją o mock powiadomieniach - Toast; obsługa pustej listy (pusta tabela).
15. **Dodawanie zajęć**
- **Ścieżka**: `/admin/activities/new`
- **Cel**: Utworzenie nowej aktywności
- **Kluczowe informacje**: Formularz: nazwa, opis, koszt, limit, data/godzina (UTC konwersja), wybór opiekuna, tagi
- **Kluczowe komponenty**: SSR fetch workers + tags; Form, Input, Textarea, NumberInput, DateTimePicker, Select (workers), MultiSelect/ComboBox (tags), Alert, Button, Toast
- **Uwagi UX / A11y / Security**: Walidacja przyszłej daty; maks. liczby znaków; tagi pobierane z backendowego endpointu GET `/admin/tags`.
16. **Edycja zajęć**
- **Ścieżka**: `/admin/activities/:id/edit`
- **Cel**: Aktualizacja istniejącej aktywności
- **Kluczowe informacje**: Prefill danych + formularz jak w (15)
- **Kluczowe komponenty**: SSR fetch activity + workers + tags; Form itd.
- **Uwagi UX / A11y / Security**: -
17. **Lista opiekunów**
- **Ścieżka**: `/admin/workers`
- **Cel**: Przegląd opiekunów
- **Kluczowe informacje**: Tabela: imię, nazwisko, email; brak paginacji
- **Kluczowe komponenty**: DataTable (client load once), Button (Dodaj, Usuń), Toast
- **Uwagi UX / A11y / Security**: Spójne kolumny; brak paginacji; powiadomienie o niemożliwości usunięcia opiekuna.
18. **Dodawanie opiekuna**
- **Ścieżka**: `/admin/workers/new`
- **Cel**: Utworzenie nowego opiekuna
- **Kluczowe informacje**: Formularz: imię, nazwisko, email
- **Kluczowe komponenty**: Form, Input, Alert, Button, Toast
- **Uwagi UX / A11y / Security**: Walidacja unikalności email po stronie API; po sukcesie redirect do listy.
19. **Edycja opiekuna**
- **Ścieżka**: `/admin/workers/:id/edit`
- **Cel**: Aktualizacja danych opiekuna
- **Kluczowe informacje**: Prefill danych + formularz
- **Kluczowe komponenty**: SSR fetch worker; Form, Input, Alert, Button, Toast
- **Uwagi UX / A11y / Security**: -
20. **Lista rodziców**
- **Ścieżka**: `/admin/parents`
- **Cel**: Przegląd kont rodziców
- **Kluczowe informacje**: Tabela z paginacją/ wyszukiwaniem (email, imię, nazwisko), akcja Usuń
- **Kluczowe komponenty**: DataTable (server pagination+search), AlertDialog (potwierdzenie), Toast
- **Uwagi UX / A11y / Security**: Potwierdzenie skutków kaskadowych (tekst w dialogu); brak edycji.
21. **Szczegóły rodzica**
- **Ścieżka**: `/admin/parents/:id`
- **Cel**: Wgląd w dane rodzica i jego dzieci
- **Kluczowe informacje**: Dane profilu, lista dzieci (z podstawowymi parametrami)
- **Kluczowe komponenty**: SSR fetch; Card sekcje, List, Button (powrót)
- **Uwagi UX / A11y / Security**: 404 gdy brak; ochrona administracyjna.

### 2.4. Wspólne / systemowe
22. **Błędy globalne**
- **Ścieżka**: `/error/401`, `/error/403`, `/error/404`, `/error/500` (lub jeden dynamiczny)
- **Cel**: Czytelne komunikaty błędów
- **Kluczowe informacje**: Kod, opis, CTA (powrót / logowanie)
- **Kluczowe komponenty**: Static Astro, Button
- **Uwagi UX / A11y / Security**: Dostępność: nagłówek h1 z kodem i opisem.
23. **Wylogowanie**
- **Ścieżka**: `/logout` (akcja)
- **Cel**: Inicjuje zakończenie sesji i redirect do `/`
- **Kluczowe informacje**: (Brak UI)
- **Kluczowe komponenty**: Action + redirect
- **Uwagi UX / A11y / Security**: CSRF safe (cookie based) – w MVP minimalnie.

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
# Plan implementacji widoku Dodaj / Edytuj Dziecko

## 1. Przegląd
Widok służy do tworzenia oraz edytowania profilu dziecka w panelu rodzica. Wariant „Dodaj dziecko” (ścieżka `/app/dzieci/dodaj`) jest wykorzystywany również w procesie onboardingowym – must have: rodzic musi mieć co najmniej jedno dziecko zanim uzyska pełny dostęp do dashboardu. Wariant „Edycja dziecka” (ścieżka `/app/dzieci/:id/edit`) pozwala korygować dane istniejącego profilu. Formularz zawiera pola: imię, nazwisko, data urodzenia (nie może być przyszła), opis (opcjonalny). Po powodzeniu następuje redirect do dashboardu (`/app/dashboard`). Brak funkcji usuwania w MVP.

## 2. Routing widoku
- `GET /app/dzieci/dodaj` – render formularza tworzenia (SSR + interaktywny React component). Dostęp tylko dla zalogowanego rodzica.
- `GET /app/dzieci/:id/edit` – SSR pobiera dane dziecka + renderuje formularz edycji. Dostęp tylko jeśli dziecko należy do zalogowanego rodzica (403 w razie naruszenia).
- Middleware lub logika w `dashboard.astro`: jeśli użytkownik nie ma dzieci → redirect do `/app/dzieci/dodaj`.

## 3. Struktura komponentów
```
AddEditChildPage (Astro + osadzenie komponentu React)
└── ChildForm (React) [tryb create | edit]
    ├── TextField(first_name)
    ├── TextField(last_name)
    ├── DatePicker(birth_date)
    ├── Textarea(description)
    ├── ValidationErrors / Alert
    ├── SubmitButton (disabled w trakcie wysyłania)
```
Wariant edycji: Astro warstwa pobiera dane przez `GET /api/children/:id` (SSR), przekazuje je jako initialData do `ChildForm`.

## 4. Szczegóły komponentów
### AddEditChildPage (Astro wrapper)
- Opis: Strona routingu; przygotowuje dane i osadza komponent `ChildForm` z odpowiednim trybem.
- Główne elementy: Layout + sekcja z nagłówkiem (np. „Dodaj dziecko” / „Edytuj dziecko”).
- Interakcje: Brak bezpośrednich; delegacja do `ChildForm`.
- Walidacja: W wariancie edycji – wczytanie dziecka; jeśli API zwróci 404/403 → wyświetlenie komunikatu błędu lub redirect do `/app/dashboard` (decyzja: preferowany Alert na stronie). 401 → redirect do logowania (globalna ochrona).
- Typy: `ChildDTO` (z backendu), `ChildFormInitialData`.
- Propsy (przekazywane do React komponentu): `mode: 'create' | 'edit'`, `initialData?: ChildFormInitialData`.

### ChildForm (React)
- Opis: Uniwersalny formularz do tworzenia i edycji profilu dziecka.
- Elementy: `<form>` + pola: imię, nazwisko (input text), data urodzenia (DatePicker), opis (textarea), przycisk zapisu, obszar błędów, spinner w przycisku.
- Interakcje (zdarzenia):
  - onChange pól – aktualizacja lokalnego stanu
  - onSubmit – walidacja + wywołanie odpowiedniego API (`POST /api/children` lub `PATCH /api/children/:id`)
  - onDateSelect – przeliczenie wieku (AgePreview)
- Walidacja (frontend przed wysłaniem):
  - first_name: wymagane, min 2 znaki, max np. 50 (dopasować do schematu z backendu jeśli istnieje)
  - last_name: wymagane, min 2, max 50
  - birth_date: wymagane, format YYYY-MM-DD, nie w przyszłości, nie pusta
  - description: opcjonalne, max np. 500 znaków (dopasować do schematu jeśli istnieje)
  - Dodatkowa logika: jeśli data > dziś → blok submit + komunikat
- Typy: `ChildFormValues`, `ChildFormErrors`, `ChildFormMode`, `CreateChildRequestDTO`, `UpdateChildRequestDTO`, `ApiErrorDTO` (transport), `ChildDTO` (odpowiedź sukces).
- Propsy: `{ mode: ChildFormMode; initialData?: ChildFormValues; onSuccessRedirect?: string }`.

### TextField
- Opis: Reużywalny wrapper dla `<input type="text">` z etykietą, informacją o błędzie i atrybutami a11y.
- Elementy: `<label>`, `<input>`, `<p role="alert">` dla błędów.
- Interakcje: onChange, onBlur.
- Walidacja: Przekazywana z rodzica – brak własnej logiki poza required.
- Typy: `{ name: string; value: string; error?: string; onChange(v: string): void; onBlur?(): void; label: string; required?: boolean }`.

### DatePicker
- Opis: Komponent wyboru daty urodzenia; może opierać się na lekkim rozwiązaniu (native `<input type="date">` dla MVP) lub później Shadcn.
- Elementy: `<label>`, `<input type="date">`, komunikat błędu.
- Interakcje: onChange (parsowanie), walidacja natychmiastowa jeśli przyszła data.
- Walidacja: format ISO, nie przyszła, nie pusta.
- Typy: `{ value: string; onChange(v: string): void; error?: string; label: string; required?: boolean }`.

### Textarea (Opis)
- Opis: Opcjonalny opis zainteresowań.
- Elementy: `<label>`, `<textarea>`.
- Interakcje: onChange.
- Walidacja: max długość.
- Typy: analogicznie do TextField.

### ValidationErrors / Alert
- Opis: Lista błędów globalnych (np. z API). Dla dostępności: `role="alert"`.
- Elementy: `<div role="alert">` + list itemy.
- Interakcje: Brak.
- Typy: `ApiErrorDTO` lub `string[]`.

### SubmitButton
- Opis: Wywołuje submit formularza; pokazuje spinner i stan disabled podczas wysyłania.
- Elementy: `<button>` z warstwą loading.
- Interakcje: onClick.
- Walidacja: Disabled jeśli są niespełnione wymagania (lub jeśli w trakcie requestu).
- Typy: `{ loading: boolean; label: string }`.

## 5. Typy
- `ChildFormMode = 'create' | 'edit'`
- `ChildFormValues`: `{ first_name: string; last_name: string; birth_date: string; description?: string | null }`
- `ChildFormErrors`: `{ first_name?: string; last_name?: string; birth_date?: string; description?: string; _global?: string[] }`
- `CreateChildRequestDTO` = `ChildFormValues` (wszystkie wymagane poza description opcjonalnie)
- `UpdateChildRequestDTO` = częściowy update, ale w UI wysyłamy pełny zestaw (spójność): `{ first_name: string; last_name: string; birth_date: string; description?: string | null }`
- `ChildDTO` (z backendu) już istnieje; używany do wczytania initialData; zawiera m.in. `id`, `first_name`, `last_name`, `birth_date`, `description`, `created_at`.
- `ApiErrorDTO`: `{ code: string; message: string; status: number }` (zgodnie z helperem – zmapowane w frontend).
- `ChildFormState`: `{ values: ChildFormValues; errors: ChildFormErrors; submitting: boolean; submitSuccess: boolean }`.
- Dodatkowy pomocniczy typ: `OwnershipError = { type: 'OWNERSHIP'; message: string }` dla 403 przy edycji.

## 6. Zarządzanie stanem
- Lokalny stan w komponencie `ChildForm` zarządzany przez `useReducer` (zaleta: jedno źródło prawdy dla values/errors/submitting).
- Custom hook `useChildForm(mode, initialData)`:
  - Inicjalizacja wartości (dla create pusty; dla edit wypełniony).
  - Funkcje: `updateField(name, value)`, `validateAll()`, `submit()`.
  - Walidacja synchroniczna zwraca `ChildFormErrors`.
  - Obsługa requestu: dynamiczne wybranie metody i endpointu.
  - Po sukcesie: sygnał do redirect (np. callback `onSuccess`).

## 7. Integracja API
- Create:
  - `POST /api/children`
  - Body: `CreateChildRequestDTO`
  - Sukces: `201` + `ChildDTO` (ignorujemy `parent_id` w UI).
- Update:
  - `PATCH /api/children/:id`
  - Body: `UpdateChildRequestDTO`
  - Sukces: `200` + `ChildDTO`.
- Błędy:
  - 400 → wyświetlenie błędów walidacyjnych globalnie + mapowanie pola jeśli możliwe.
  - 401 → redirect do logowania.
  - 403 → dla create (rola) => komunikat; dla edit (brak własności) => Alert + brak możliwości edycji / ewentualny redirect do dashboardu.
  - 404 (edit) → Alert „Dziecko nie znalezione”.
- Implementacja fetch:
  - `fetch('/api/children', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(values) })`
  - `fetch('/api/children/'+id, { method: 'PATCH', ... })`
  - Sprawdzenie `response.ok`; jeśli nie → `response.json()` dla błędu.

## 8. Interakcje użytkownika
1. Wprowadzenie tekstu w polach imię/nazwisko → aktualizacja stanu, czyszczenie błędu pola.
2. Wybór daty urodzenia → walidacja natychmiastowa; jeśli przyszłość → komunikat i blok przycisku.
3. Wypełnienie opcjonalnego opisu → aktualizacja stanu.
4. Kliknięcie „Zapisz” → walidacja pełna; jeśli brak błędów → ustaw `submitting=true`, wywołanie API.
5. Sukces (201/200) → `submitSuccess=true` → redirect (`window.location.href='/app/dashboard'`).
6. Błąd walidacyjny (400) → pokazanie komunikatów; fokus na pierwszy błędny element (`ref.focus()`).
7. Błąd 403 (edycja) → komunikat „Brak uprawnień do edycji tego dziecka”.
8. Błąd sieci (fetch reject) → globalny komunikat „Problem z połączeniem – spróbuj ponownie”.

## 9. Warunki i walidacja
- Warunek posiadania roli „parent”: zakładamy globalną ochronę (middleware); jeśli jednak API zwróci 403/401 → obsługa wg sekcji błędów.
- Walidacja imienia/nazwiska: długość + niepuste (frontend) + ewentualnie transliteracja / trimming.
- Data urodzenia: nie przyszła (`new Date(birth_date) <= today`), poprawny format, nie pusta.
- Opis: jeżeli istnieje – długość <= 500.
- Przyciski: disabled jeśli `submitting` albo istnieją niepoprawne pola.
- Wariant edycji: wstępne pobranie danych (SSR) – jeśli brak danych (404/403) → brak renderu formularza, tylko Alert.

## 10. Obsługa błędów
- Mapowanie kodów z `ApiErrorDTO.code` na przyjazne komunikaty:
  - `VALIDATION_ERROR` → rozbicie na pola (jeśli backend zwraca strukturę); inaczej globalny.
  - `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN` → redirect do logowania lub komunikat.
  - `CHILD_NOT_FOUND` → Alert + link „Powrót do dashboardu”.
  - `CHILD_NOT_OWNED` → Alert + brak formularza.
  - `INTERNAL_ERROR` → globalny Alert „Wewnętrzny błąd serwera. Spróbuj później.”
- Retry logic (prosty): użytkownik ponownie klika „Zapisz”.
- Sieć: catch przy fetch → komunikat + możliwość ponownej próby.

## 11. Kroki implementacji
1. Dodaj nowy plik routingu Astro: `src/pages/app/dzieci/dodaj.astro` z osadzeniem komponentu `ChildForm` w trybie `create`.
2. Dodaj plik `src/pages/app/dzieci/[id]/edit.astro` – SSR fetch dziecka (użyj `context.locals.supabase` lub wywołanie fetch do API) → przekazanie danych do `ChildForm`.
3. Utwórz folder `src/components/children/` i dodaj główny komponent `ChildForm.tsx` + subkomponenty (`TextField.tsx`, `DatePicker.tsx`, `Textarea.tsx`, `SubmitButton.tsx`, `ValidationErrors.tsx`).
4. Zaimplementuj typy w dedykowanym pliku: `src/components/children/types.ts` (FormMode, Values, Errors, State).
5. Dodaj hook `useChildForm.ts` w tym samym folderze; implementuj reducer + akcje.
6. Dodaj funkcję util `formatAge(birth_date)` (jeśli potrzebne) w `src/lib/utils.ts` lub lokalnie.
7. Zaimplementuj walidację frontendową (funkcja `validate(values): ChildFormErrors`).
8. W `ChildForm` obsłuż submit: wybór endpointu zależny od `mode`; pokaż loading, zablokuj pola.
9. Obsłuż mapowanie błędów API do `errors._global` albo konkretnych pól.
10. Po sukcesie – redirect do `/app/dashboard` (krótki timeout lub natychmiast). Dodaj prosty komunikat sukcesu (opcjonalny toast z istniejącego systemu `use-toast`).
11. Zaktualizuj dashboard (jeśli potrzebne) – dodaj przycisk „Edytuj” przy każdym dziecku: link do `/app/dzieci/{id}/edit`.
12. Dodaj w middleware/logice dashboardu sprawdzenie liczby dzieci (pobranie `/api/children`); jeśli 0 → redirect do `/app/dzieci/dodaj`.

# Plan implementacji widoku Profil rodzica

## 1. Przegląd
Widok umożliwia rodzicowi (rola `parent`) podgląd i edycję podstawowych danych profilu: imię i nazwisko. Email jest prezentowany jako pole tylko do odczytu (pochodzi z Supabase Auth) i nie podlega edycji. Widok korzysta z SSR do wstępnego pobrania danych (`/api/profile` / warstwa usług `getCurrentProfile`) zapewniając szybkie wyświetlenie wypełnionego formularza oraz brak migotania. Edycja odbywa się poprzez żądanie `PATCH /api/profile`. Dostarczane są informacyjne komunikaty (Alert + Toast) dla sukcesu i błędów walidacji / autoryzacji.

## 2. Routing widoku
- Ścieżka: `/app/profil`
- Plik strony: `src/pages/app/profil.astro`
- Ochrona dostępu: wykonywana wcześniej (middleware) + sprawdzenie roli przez usługę profilu (403 jeśli rola ≠ parent)

## 3. Struktura komponentów
```
ProfilPage (Astro)
  └─ ParentProfileForm (React)
       ├─ ReadOnlyEmailField (input type="email" disabled)
       ├─ NameFields
       │    ├─ FirstNameInput
       │    └─ LastNameInput
       ├─ ValidationErrors (reuse: src/components/form/ValidationErrors.tsx)
       ├─ SubmitButton (reuse: src/components/form/SubmitButton.tsx)
       ├─ ErrorAlert (shadcn/ui Alert / variant destructive)
       └─ SuccessToast (shadcn/ui toast / via existing useToast/useToastFeedback)
```
Opcjonalne mikro-komponenty mogą być zagnieżdżone w jednym pliku jeśli proste (np. EmailField, NameField). Główny komponent React: `ParentProfileForm.tsx` w katalogu `src/components/dashboard/profile/`.

## 4. Szczegóły komponentów
### ProfilPage (Astro)
- Opis: Strona SSR pobierająca profil rodzica przed renderem; przekazuje dane do komponentu React.
- Elementy: Layout (`Layout.astro`), sekcja główna `<main>`, montaż `ParentProfileForm` z propem `initialProfile`.
- Zdarzenia: Brak (statyczna część). SSR fetch przez usługę `getCurrentProfile`.
- Walidacja: Brak – sprawdzanie roli i istnienia profilu w warstwie usług (błąd -> wyświetlenie fallbacku). Można warunkowo wyrenderować komunikat błędu zamiast formularza.
- Typy: `ProfileDTO` jako wejście.
- Propsy dla React: `initialProfile: ProfileDTO`.

### ParentProfileForm
- Opis: Interaktywny formularz edycji danych (imię, nazwisko) z prefill i obsługą PATCH.
- Elementy: `<form>`, pola imię/nazwisko (TextField - istniejący wzorzec lub własne), pole email (read-only), komponent `ValidationErrors`, przycisk `SubmitButton`, `ErrorAlert`, integracja toast.
- Zdarzenia: `onChange` (aktualizacja wartości), `onBlur` (oznaczenie touched do wyświetlania błędów), `onSubmit` (walidacja + PATCH), `onToastDismiss`.
- Walidacja: Lokalna (Zod `updateProfileSchema`):
  - `first_name`: trim, min(1), max(100)
  - `last_name`: trim, min(1), max(100)
  - Email nie walidowany (readonly).
- Typy: `ParentProfileFormValues`, `ParentProfileFormState`, `ApiErrorView`, `ProfileDTO`, `UpdateProfileCommand`.
- Propsy: `{ initialProfile: ProfileDTO }`.

### ReadOnlyEmailField
- Opis: Pole wyświetlające email z profilu; nieedytowalne.
- Elementy: `<input type="email" readOnly disabled>` + etykieta.
- Zdarzenia: Brak.
- Walidacja: Brak (źródło z SSR gwarantowane).
- Typy: korzysta z `ProfileDTO.email`.
- Propsy: `{ email: string }`.

### FirstNameInput / LastNameInput
- Opis: Pojedyncze kontrolki tekstowe z lokalną walidacją i sygnałem błędu.
- Elementy: `<input type="text">`, etykieta, komunikat błędu inline (opcjonalnie).
- Zdarzenia: `onChange`, `onBlur`.
- Walidacja: jak w schemacie (min/max, trim, required). Błędy z lokalnej Zod + serwer (mapa fieldErrors).
- Typy: korzysta z `ParentProfileFormValues`.
- Propsy: `{ value: string; onChange: (v:string)=>void; error?: string }`.

### ValidationErrors (reuse)
- Opis: Komponent listujący błędy ogólne lub polowe (jeśli reuse wymaga adaptacji – przekazać w poprawnym formacie).
- Elementy: lista `<ul>` / `<div>`.
- Zdarzenia: Brak.
- Walidacja: Prezentacja błędów.
- Typy: adaptacja do przyjęcia `string[]` lub mapy; w razie potrzeby wrapper.
- Propsy: `{ errors: string[] }` lub adapter.

### SubmitButton (reuse)
- Opis: Przycisk wysyłający formularz; pokazuje stan ładowania.
- Elementy: `<button>`.
- Zdarzenia: `onClick` (submit) / disabled.
- Walidacja: Disabled jeśli brak zmian lub aktywna walidacja błędów.
- Typy: wbudowane.
- Propsy: `{ loading: boolean; disabled?: boolean }`.

### ErrorAlert
- Opis: Wyświetla błąd globalny (np. 401, 403, 404, INTERNAL_ERROR).
- Elementy: shadcn/ui `Alert`.
- Zdarzenia: Możliwy przycisk zamknięcia / retry.
- Walidacja: Prezentacja.
- Typy: `ApiErrorView`.
- Propsy: `{ error: ApiErrorView | null; onRetry?: ()=>void }`.

### SuccessToast
- Opis: Potwierdzenie udanej aktualizacji; wykorzystanie istniejącego systemu toastów.
- Elementy: `toast` z tytułem i opisem.
- Zdarzenia: Zamknięcie.
- Walidacja: Brak.
- Typy: `ProfileDTO` (może przekazać zaktualizowane imię/nazwisko).
- Propsy: `{ profile: ProfileDTO }` (opcjonalnie) albo treść statyczna.

## 5. Typy
Nowe typy lokalne (ViewModel / stan):
- `ParentProfileFormValues`:
  - `first_name: string` – edytowane pole
  - `last_name: string` – edytowane pole
- `ParentProfileFormState`:
  - `values: ParentProfileFormValues`
  - `touched: { first_name?: boolean; last_name?: boolean }`
  - `status: 'idle' | 'submitting' | 'success' | 'error'`
  - `error?: ApiErrorView | null`
  - `dirty: boolean` (czy zmieniono wartości względem początkowych)
- `ApiErrorView` (adaptacja z `ErrorResponseDTO` + szczegóły Zod):
  - `code: string` (np. VALIDATION_ERROR, AUTH_UNAUTHORIZED)
  - `message: string`
  - `fieldErrors?: Record<string,string>` (mapowanie z `issues` Zoda lub z `error.details` jeśli dostępne)
- `UpdateProfileResult = ProfileDTO`
- Reuse: `ProfileDTO`, `UpdateProfileCommand` (z `types.ts`)

## 6. Zarządzanie stanem
- Lokalny stan w komponencie / dedykowany hook `useParentProfileForm(initial: ProfileDTO)`:
  - Inicjalizacja wartości z `initialProfile`
  - Funkcje: `updateField(name,value)`, `markTouched(name)`, `reset()`, `submit()`
  - `submit()` wykonuje: lokalna walidacja Zod -> jeśli ok -> `PATCH /api/profile` -> aktualizacja stanu (success/error)
- Brak potrzeby globalnego store (Zustand) – zakres wyłącznie dla tego widoku.
- Debouncing niepotrzebny (mała liczba pól). Można dodać blokadę podwójnych submitów poprzez `status==='submitting'`.

## 7. Integracja API
- GET `/api/profile` (SSR): zwraca `ProfileDTO` – użycie usługi `getCurrentProfile(locals.supabase)` w bloku frontmatter Astro, przekazanie danych do React.
- PATCH `/api/profile` (CSR): body `UpdateProfileCommand { first_name, last_name }`.
  - Odpowiedź sukcesu: `ProfileDTO`.
  - Błędy: 400 VALIDATION_ERROR (mapa issues), 401 AUTH_UNAUTHORIZED, 403 AUTH_UNAUTHORIZED (Forbidden), 404 PARENT_NOT_FOUND, 500 INTERNAL_ERROR.
- Implementacja wywołania: `fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })`.
- Normalizacja błędów: jeśli `response.error.code === 'VALIDATION_ERROR'` z `details.issues` -> konwersja do `fieldErrors`.

## 8. Interakcje użytkownika
1. Wejście na stronę: użytkownik widzi wypełniony formularz (SSR).
2. Zmiana imienia/nazwiska: aktualizacja lokalnego stanu, ustawienie `dirty`.
3. Blur pola: oznaczenie `touched`, wymuszenie wyświetlenia błędu jeśli nieważne.
4. Próba submit:
   - Jeśli lokalna walidacja błędna -> pokazanie błędów, brak requestu.
   - Jeśli poprawna -> stan `submitting`, wysłanie PATCH.
5. Sukces: stan `success`, aktualizacja `initialProfile` lokalnie, `dirty=false`, toast potwierdzenia.
6. Błąd walidacji serwera: wyświetlenie błędów globalnych + polowych.
7. Błąd auth/rola: Alert z komunikatem i ewentualną sugestią odświeżenia / wylogowania.
8. Błąd 404 (profil nie istnieje): Alert z informacją, brak formularza lub disabled przycisk.

## 9. Warunki i walidacja
- Pola wymagane: oba (`first_name`, `last_name`) – blokują submit jeśli puste po trim.
- Limity długości: max 100 znaków – walidacja lokalna & serwerowa.
- Nie wysyłamy PATCH jeśli brak zmian (`dirty=false`) – przycisk disabled.
- Email: wyświetlany w disabled input, nieserializowany do PATCH, chroni przed modyfikacją.
- Obsługa whitespace-only: po `trim()` min(1) -> błąd.
- Po sukcesie wartości w formularzu synchronizowane z odpowiedzią (gdyby backend przyciął dane).

## 10. Obsługa błędów
- VALIDATION_ERROR: wyświetlenie listy błędów, mapowanie issues -> pola (issue.path[0]).
- AUTH_UNAUTHORIZED (401): Alert + opcja „Zaloguj ponownie” (link do login). Możliwe automatyczne przekierowanie przez globalny handler – tu fallback.
- AUTH_UNAUTHORIZED (403): Rola niewłaściwa – Alert „Brak dostępu”. Brak formularza (lub disabled).
- PARENT_NOT_FOUND (404): Alert „Profil nie znaleziony”. Propozycja kontaktu z administratorem.
- INTERNAL_ERROR (500): Alert + przycisk „Spróbuj ponownie”. Retry powtarza ostatni PATCH.
- Sieć przerwana: traktować jak INTERNAL_ERROR z komunikatem „Network error”.
- Timeout (opcjonalnie): jeśli dodamy – analogicznie sieć.

## 11. Kroki implementacji
1. Utwórz katalog `src/components/dashboard/profile/` (jeśli nie istnieje).
2. Dodaj plik `ParentProfileForm.tsx` z komponentem głównym + lokalnymi typami i hookiem `useParentProfileForm`.
3. Zaimportuj w komponencie Zod schemat `updateProfileSchema` do lokalnej walidacji.
4. Zaimplementuj hook: inicjalizacja stanu, funkcje `updateField`, `submit` (z walidacją), mapowanie błędów.
5. Dodaj render pól: email (readonly), first_name, last_name (controlled inputs) + integracja z `ValidationErrors`.
6. Dodaj blok warunkowy błędów globalnych (`ErrorAlert`).
7. Dodaj `SubmitButton` (reuse) z disabled gdy `!dirty || status==='submitting' || hasErrors`.
8. Implementuj `submit()` – PATCH `/api/profile` -> obsługa JSON, rozróżnienie `error.code`.
9. Na sukces: aktualizacja stanu, wywołanie `toast({ title: 'Profil zaktualizowany', description: ... })`.
10. Utwórz stronę `src/pages/app/profil.astro`: SSR pobranie `profile` przez usługę `getCurrentProfile(locals.supabase)`; przekazanie do React komponentu.
11. Obsłuż przypadek błędu SSR (try/catch): wyrenderuj komunikat błędu zamiast formularza.
12. Dodaj ewentualne testy jednostkowe dla hooka (opcjonalnie) – walidacja mappingu błędów.
13. Sprawdź dostępność: etykiety `<label for>` + aria-invalid przy błędach.
14. Sprawdź style z Tailwind / shadcn (Card lub sekcja flex/stack) dla spójności z dashboardem.
15. Code review pod kątem zgodności z instrukcjami (brak niepotrzebnego JS, wczesne zwroty błędów).
17. Final refaktoryzacja (usunięcie zbędnych console.log, utrzymanie czystości kodu).


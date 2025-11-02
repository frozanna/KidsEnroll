# API Endpoint Implementation Plan: Delete Activity (DELETE /api/admin/activities/:id)

## 1. Przegląd punktu końcowego
Endpoint usuwa pojedyncze zajęcia (activity) z systemu panelu administratora. Operacja powoduje kaskadowe usunięcie powiązanych tagów (`activity_tags`) oraz zapisów (`enrollments`) dzięki więzom ON DELETE CASCADE. Przed usunięciem zliczana jest liczba zapisów aby zwrócić w odpowiedzi liczbę rodziców, którym (hipotetycznie) wysłano powiadomienia o anulowaniu (`notifications_sent`). Dostęp wyłącznie dla użytkowników z rolą `admin`.

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- URL: `/api/admin/activities/:id`
- Parametry:
  - Path: `id` (string cyfr → konwersja do dodatniego `number`)
- Body: brak
- Nagłówki: Autoryzacja realizowana przez Supabase (sesja/token); kod wywołuje `supabase.auth.getUser()`.

Walidacja `id` przy użyciu istniejącego `adminActivityIdParamSchema` (regex tylko cyfry). Błąd walidacji → `VALIDATION_ERROR` (HTTP 400).

## 3. Szczegóły odpowiedzi
### Wykorzystywane typy (z `src/types.ts`)
- `AdminActivityDeleteResponseDTO`:
```ts
interface AdminActivityDeleteResponseDTO {
  message: string;
  notifications_sent: number;
}
```
- Błąd: `ErrorResponseDTO` (używany przez helper `errorToDto`).

### Sukces (200 OK)
```json
{
  "message": "Activity deleted successfully",
  "notifications_sent": 7
}
```
`notifications_sent` = liczba wierszy w `enrollments` powiązanych z aktywnością policzona przed usunięciem.

### Kody błędów / odpowiedzi
- 400 VALIDATION_ERROR: niepoprawny parametr `id`.
- 401 AUTH_UNAUTHORIZED: brak ważnej sesji.
- 403 AUTH_UNAUTHORIZED (status override 403): rola ≠ admin.
- 404 ACTIVITY_NOT_FOUND: brak aktywności.
- 500 INTERNAL_ERROR: niespodziewany błąd Supabase / runtime.

## 4. Przepływ danych
1. Handler `DELETE` w `src/pages/api/admin/activities/[id].ts` (analogiczny styl do istniejącego `PATCH`).
2. Autentykacja: `authenticateAdmin(supabase)` → pobranie użytkownika + profil + weryfikacja roli.
3. Walidacja parametru `id` (`validateAdminActivityIdParam`).
4. Serwis `deleteAdminActivity(supabase, id)`:
   - Sprawdza istnienie (re-using `fetchActivityRow`).
   - Liczy enrollments (`select('child_id', { count: 'exact', head: true })`).
   - Usuwa rekord z `activities` (CASCADE usuwa `activity_tags`, `enrollments`).
   - Zwraca DTO z komunikatem i `notifications_sent`.
5. Endpoint zwraca JSON przez `jsonResponse`. Błędy konwertowane przez `errorToDto`.
6. Logowanie: start / success / error w formacie JSON (action: DELETE_ACTIVITY).

## 5. Względy bezpieczeństwa
- Autoryzacja roli admin (brak możliwości przez rodzica).
- Walidacja parametru eliminuje wstrzyknięcia w ścieżce.
- Brak request body → mniejsza powierzchnia ataku.
- Supabase client generuje parametryzowane zapytania → brak SQL injection.
- Ograniczone logowanie (bez treści wrażliwych).
- Race condition przy równoczesnych zapisach minimalnie wpływa jedynie na wartość `notifications_sent` (akceptowalne w MVP).

## 6. Obsługa błędów
| Scenariusz | Kod błędu | HTTP | Źródło |
|------------|-----------|------|--------|
| Brak sesji | AUTH_UNAUTHORIZED | 401 | `authenticateAdmin` |
| Zła rola | AUTH_UNAUTHORIZED | 403 | `authenticateAdmin` (override) |
| Parametr `id` niecyfrowy | VALIDATION_ERROR | 400 | Zod schema param |
| Aktywność nie istnieje | ACTIVITY_NOT_FOUND | 404 | Serwis (check fetch) |
| Błąd count | INTERNAL_ERROR | 500 | Serwis (select count) |
| Błąd delete | INTERNAL_ERROR | 500 | Serwis (delete) |
| Nieznany wyjątek | INTERNAL_ERROR | 500 | Normalizacja błędu |

Strategia: Serwis rzuca tylko `ApiError`; endpoint normalizuje przez `normalizeUnknownError` i mapuje do `ErrorResponseDTO`.

## 7. Wydajność
- Operacje: 1 szybkie zapytanie COUNT (z indeksem na `enrollments.activity_id`) + 1 DELETE.
- Brak pobierania pełnych wierszy zapisów (użycie `head: true`).
- CASCADE usuwa zależności bez dodatkowych zapytań.
- Złożoność czasowa ~O(1) poza kosztem fizycznego kasowania zależnych wierszy przez PostgreSQL.
- Możliwe przyszłe optymalizacje: soft delete (`deleted_at`), batch event emission (async) dla realnych powiadomień.

## 8. Kroki implementacji
1. Dodaj funkcję `deleteAdminActivity` do `admin.activities.service.ts`:
   - Re-use `fetchActivityRow`; brak → `createError('ACTIVITY_NOT_FOUND', ...)`.
   - COUNT enrollments (exact, head) → `notifications_sent`.
   - DELETE activity → handle error → INTERNAL_ERROR.
   - Zwrot `AdminActivityDeleteResponseDTO`.
2. W pliku endpointu `src/pages/api/admin/activities/[id].ts` dodaj handler `DELETE`:
   - Autentykacja: `authenticateAdmin`.
   - Walidacja param `id`.
   - Log (phase start).
   - Wywołanie serwisu i log (success) lub log (error).
   - Zwróć 200 z DTO lub kod błędu przez `errorToDto`.
3. Uaktualnij komentarz nagłówkowy endpointu (`// REST API Endpoint: ...`) aby zawierał DELETE.
4. Lint + build (sprawdzenie braków typów / błędów). Dodaj ewentualnie prosty test manualny.
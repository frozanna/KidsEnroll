# API Endpoint Implementation Plan: Delete Parent (DELETE /api/admin/parents/:id)

## 1. Przegląd punktu końcowego
Endpoint pozwala administratorowi usunąć konto rodzica (profil) wraz ze wszystkimi powiązanymi danymi domenowymi: dziećmi (children) oraz zapisami na zajęcia (enrollments). Operacja jest destrukcyjna i nieodwracalna. Dzięki relacjom ON DELETE CASCADE w schemacie bazy PostgreSQL większość powiązanych rekordów zostanie usunięta automatycznie po skasowaniu profilu oraz dzieci. Endpoint zwraca podsumowanie liczby usuniętych dzieci i zapisów. Nie może usuwać konta administratora.

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: `/api/admin/parents/:id`
  - `:id` — UUID profilu rodzica (powiązany z `profiles.id` i `auth.users.id`)
- Parametry:
  - Wymagane: `id` (path param, UUID)
  - Opcjonalne: brak
- Request Body: brak (nie wymagamy treści w DELETE)
- Nagłówki: `Authorization: Bearer <token>` (Supabase auth JWT)

## 3. Wykorzystywane typy
- Wejście: path param `id` (string UUID)
- DTO odpowiedzi sukcesu: `ParentDeleteResponseDTO`:
```ts
interface ParentDeleteResponseDTO {
  message: string;
  deleted_children: number;
  deleted_enrollments: number;
}
```
- Błędy: `ErrorResponseDTO` (zdefiniowany w `types.ts`) przy użyciu `ApiError` i kodów:
  - `VALIDATION_ERROR` (400)
  - `AUTH_UNAUTHORIZED` (401)
  - `PARENT_NOT_FOUND` (404)
  - `INTERNAL_ERROR` (500)
  - Specyficzny warunek biznesowy: próba usunięcia admina -> własny kod (np. `VALIDATION_ERROR` lub dedykowany – rekomendacja poniżej) z wiadomością "Cannot delete admin account" (400)

## 4. Szczegóły odpowiedzi
- 200 OK (Sukces):
```json
{
  "message": "Parent account and all associated data deleted successfully",
  "deleted_children": <number>,
  "deleted_enrollments": <number>
}
```
- 400 Bad Request:
  - Niepoprawny UUID path param -> `VALIDATION_ERROR`
  - Próba usunięcia profilu o roli `admin` -> proponujemy `VALIDATION_ERROR` (status 400) z message: "Cannot delete admin account" (alternatywa: nowy kod np. `ADMIN_DELETE_FORBIDDEN`; na MVP zostajemy przy istniejącej mapie kodów)
- 401 Unauthorized: brak lub nieważny token -> `AUTH_UNAUTHORIZED`
- 403 Forbidden: jeśli uwierzytelniony użytkownik nie jest adminem (obsługiwane przez `authenticateAdmin`) -> `AUTH_UNAUTHORIZED` lub ewentualnie przyszły kod `AUTH_FORBIDDEN`; obecny helper prawdopodobnie zwróci 401 – pozostawiamy spójność (opcjonalna przyszła poprawka)
- 404 Not Found: rodzic nie istnieje lub profil nie ma roli `parent` -> `PARENT_NOT_FOUND`
- 500 Internal Server Error: problemy bazodanowe / inne nieoczekiwane -> `INTERNAL_ERROR`

## 5. Przepływ danych
1. Klient (panel admina) wysyła żądanie DELETE na `/api/admin/parents/{uuid}` z nagłówkiem Authorization.
2. Middleware / helper `authenticateAdmin` waliduje token i rolę:
   - Pobiera kontekst Supabase (z `context.locals.supabase`).
   - Weryfikuje autentykację; jeśli rola ≠ `admin` — błąd.
3. Walidacja parametru `id` przy użyciu Zod (`z.string().uuid()`) w nowej funkcji `validateParentDeleteIdParam` (możemy użyć istniejącej `validateParentIdParam`).
4. Service `deleteParent` (nowy plik lub rozszerzenie `parents.service.ts`) wykonuje logikę:
   - Sprawdza rekord w `profiles` o podanym `id`.
   - Jeśli brak lub rola ≠ `parent` -> rzuca `PARENT_NOT_FOUND`.
   - Jeśli rola == `admin` -> rzuca `createError("VALIDATION_ERROR", "Cannot delete admin account")`.
   - Pobiera listę dzieci `children` z `parent_id = id` (zlicza sztuki).
   - Jeżeli lista dzieci niepusta, pobiera liczbę enrollmentów powiązanych z tymi dziećmi (zliczając w `enrollments`).
   - Wykonuje transakcyjne usunięcie danych:
     * W Supabase JS nie ma natywnych transakcji; potrzebne RPC lub reliance on CASCADE.
     * Prostą strategią: najpierw policzyć (select / counts), a następnie usunąć profil: `delete from profiles where id = ?` (ON DELETE CASCADE zapewni skasowanie children i enrollments dzięki relacjom). Uwaga: enrollments kasują się wraz z children (children ON DELETE CASCADE). Dodatkowe tagi, aktywności nie są bezpośrednio powiązane z rodzicem – brak efektu ubocznego.
   - Zwraca `ParentDeleteResponseDTO` opartą o uprzednio policzone liczby.
5. Endpoint opakowuje wynik w JSON, status 200.
6. W przypadku błędów: konwersja przez `normalizeUnknownError` i `errorToDto`.

## 6. Względy bezpieczeństwa
- Autoryzacja: wyłącznie rola `admin` może wywołać endpoint (wymuszone przez `authenticateAdmin`).
- Uwierzytelnienie: Supabase JWT z nagłówka `Authorization`.
- Walidacja danych wejściowych: UUID path param – zapobiega SQL injection (filtr parametryczny). Brak body.
- Least privilege: używamy serwera po stronie backendu; nie ujawniamy danych zbędnych.
- Audyt/Logowanie: krótki log JSON (action, admin_id, target_parent_id, result/success/failure) w konsoli. Możliwość późniejszej agregacji. Nie logujemy prywatnych danych dzieci.
- Unikanie enumeracji: ten endpoint nie ujawnia istniejących ID poza wynikiem 404.
- Zachowanie integralności: Reliance na ON DELETE CASCADE w definicji bazy zapewnia spójność danych powiązanych.

## 7. Obsługa błędów
Tabela scenariuszy:

| Scenariusz | Kod błędu (ApiError.code) | HTTP Status | message |
|------------|---------------------------|-------------|---------|
| Brak tokenu / niepoprawny | AUTH_UNAUTHORIZED | 401 | Unauthorized |
| Użytkownik nie-admin | AUTH_UNAUTHORIZED (lub przyszły FORBIDDEN) | 401 (spec plan: 403 docelowo) | Unauthorized |
| Niepoprawny UUID | VALIDATION_ERROR | 400 | Invalid request body |
| Profil nie istnieje / nie-parent | PARENT_NOT_FOUND | 404 | Parent not found |
| Próba usunięcia admina | VALIDATION_ERROR | 400 | Cannot delete admin account |
| Błąd bazy przy select/delete | INTERNAL_ERROR | 500 | <DB message> |
| Inne nieznane | INTERNAL_ERROR | 500 | Unknown error |

Mapowanie zgodne z istniejącym `STATUS_MAP` w `errors.ts`.

## 8. Rozważania dotyczące wydajności
- Operacja polega na kilku SELECT count oraz jednym DELETE:
  - SELECT children by parent_id (index na `children(parent_id)` przyspiesza).
  - SELECT enrollments by child_ids (index na `enrollments(child_id)` przyspiesza). Można zredukować do jednego zapytania agregującego COUNT z JOIN na children, ale prostota jest priorytetem.
- Liczba dzieci i enrollmentów typowo niska → brak potrzeby dodatkowej optymalizacji.
- Redukcja round-trips: Możliwy future improvement: RPC PL/pgSQL funkcja `delete_parent(uuid)` zwracająca counts w jednym wywołaniu (transakcja atomowa). MVP: standardowe zapytania.
- Obsługa równoległości: Jednoczesne kasowanie tego samego rodzica – drugi DELETE zwróci 404 (po pierwszym usunięciu). Nie wymaga specjalnego locka.

## 9. Etapy wdrożenia
1. Dodaj funkcję serwisową `deleteParent(supabase, parentId): Promise<ParentDeleteResponseDTO>` w `parents.service.ts` lub w osobnym pliku (pozostajemy w tym samym pliku dla spójności). 
2. Implementacja deleteParent:
   - Pobierz profil: `select id, role from profiles where id = ? maybeSingle()`.
   - Waliduj istnienie + rola `parent`; jeśli `admin` -> error VALIDATION_ERROR.
   - Pobierz dzieci: `select id from children where parent_id = ?` (zlicz). Jeśli 0 -> `deleted_children=0`, `deleted_enrollments=0`.
   - Jeśli dzieci >0: pobierz enrollments count: `select child_id from enrollments in(childIds)` zlicz occurrences.
   - Wykonaj `delete from profiles where id = ?` (CASCADE).
   - Zwrot DTO z policzonych wartości i message.
3. Dodaj obsługę DELETE w pliku endpointowym: utwórz `src/pages/api/admin/parents/[id].ts` (już istnieje dla GET) – rozszerz o `export const DELETE: APIRoute`.
4. W DELETE handler:
   - Auth przez `authenticateAdmin`.
   - Walidacja param id przez istniejące `validateParentIdParam` (lub alias).
   - Wywołanie `deleteParent`.
   - Zwrócenie JSON + status 200.
   - Błędy opakować w `normalizeUnknownError` -> `errorToDto`.
5. Dodać logging (console.log JSON) dla akcji DELETE (phases: auth_ok, delete_start, delete_success / delete_error).
8. Review zgodności z zasadami (`export const prerender = false`, użycie Supabase z `context.locals`).

## 10. Edge Cases & Dodatkowe Uwagi
- Parent bez dzieci -> szybka ścieżka: tylko jedne zapytanie SELECT + DELETE.
- Race: Nowe enrollments dodane między liczeniem a delete – counts mogą być minimalnie zaniżone w odpowiedzi (akceptowalne w MVP). RPC transakcyjne mogłoby to wyeliminować.
- Jeśli delete profilu zawiedzie (np. constraint), zwracamy INTERNAL_ERROR.
- Brak potrzeby walidacji referencji poza profilem (CASCADE załatwia spójność). 
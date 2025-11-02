# Możliwe refaktoryzacje warstwy services

Poniżej zebrane obszary powtarzalności i propozycje wyniesienia kodu do wspólnych helperów / modułów. Lista pogrupowana wg wpływu (najpierw najłatwiejsze o wysokiej wartości). Wszystkie punkty odnoszą się do plików w `src/lib/services` oraz istniejących utili (`utils.ts`, `postgres.utils.ts`).

## 1. Paginacja
- Powtarzane obliczenia: `offset = (page - 1) * limit`, `rangeEnd = offset + limit - 1` (`workers.service.ts`, `parents.service.ts`).
- Budowa obiektu `PaginationDTO` niemal identyczna w wielu usługach.
- Propozycja: helper `buildRange(page, limit): { offset, end }` oraz `buildPagination(page, limit, total): PaginationDTO` w nowym pliku `pagination.utils.ts` lub w `utils.ts`.

## 2. Agregacje zliczeń (Map count pattern)
- Wielokrotne tworzenie map: `childrenCountMap`, `enrollmentCountMap`, `tagsMap` itd.
- Wzorzec: iteracja i `map.set(key, (map.get(key) || 0) + 1)` + uzupełnianie brakujących kluczy zerem.
- Propozycja: `countBy<T>(rows: T[], keyFn: (row: T) => KeyType): Map<KeyType, number>` oraz `ensureKeysWithZero(map, keys)` w `collections.utils.ts`.

## 3. Walidacja / parsowanie dat ISO
- Powtarzające się sprawdzanie czy data w przyszłości oraz czy format poprawny (`admin.activities.service.ts`, `enrollments.service.ts`, `reports.service.ts`).
- Propozycja: `datetime.utils.ts` z funkcjami: `parseIsoOrThrow(label, iso): number`, `assertFuture(label, ms)`, `splitIsoDateTime(iso): { date, time }`.

## 4. Ownership / existence check dziecka
- Duplikacja logiki rozróżniania: brak vs cudze dziecko (`getChildById`, fragment w `createEnrollment`).
- Propozycja: helper `assertChildOwned(supabase, parentId, childId)` zwracający pełny rekord lub rzucający `ApiError` (CHILD_NOT_FOUND / CHILD_NOT_OWNED). Zastąpi ręczne podwójne zapytanie w `createEnrollment` i uprości inne funkcje.

## 5. Budowa payloadów update (pick defined)
- Wzorca `const updatePayload: Record<string, unknown> = {}; if (x !== undefined) updatePayload.x = ...` używają `updateChild`, `updateAdminActivity`.
- Propozycja: util `pickDefined<T extends object>(obj: T): Partial<T>` odfiltrowujący `undefined` i zostawiający wartości + możliwość dalszego mapowania (np. nullowanie pól).

## 6. Abstrakcja nad błędami Supabase
- Niezmiennie: `if (error) throw createError('INTERNAL_ERROR', error.message)` w większości funkcji.
- Propozycja rozszerzenia `postgres.utils.ts`: `ensureNoError(error, code = 'INTERNAL_ERROR')` lub `mapSupabaseError(error, domainMap?)` oraz `isRowNotFound(error)` dla kodu `PGRST116`.

## 7. Standaryzacja maybeSingle row-not-found
- Wiele miejsc sprawdza `error && error.code !== PGRST_ROW_NOT_FOUND` (`admin.activities.service.ts`, `workers.service.ts`).
- Propozycja: `safeMaybeSingle<T>(result): T | null` (przyjmujący `{ data, error }`) obsługujący kod not-found i rzucający przy innych błędach.

## 8. Liczenie enrollments dla aktywności
- Powtarza się w: `activities.service.ts` (available_spots), `enrollments.service.ts` (capacity check), `admin.activities.service.ts` (notifications_sent).
- Propozycja: `countEnrollmentsForActivity(supabase, activityId)` oraz wersja batch `countEnrollmentsForActivities(supabase, ids)` zwracająca `Map<number, number>`.

## 9. Operacje na tagach aktywności
- W `activities.service.ts` (pobranie + budowa mapy) oraz `admin.activities.service.ts` (insert + replace).
- Propozycja dedykowanego modułu `activityTags.repository.ts`: `getTagsForActivities`, `getTagsForActivity`, `insertTags`, `replaceTags`.

## 10. Formatowanie daty/czasu do raportu
- `reports.service.ts` rozcina ISO ręcznie; można użyć wspólnego `splitIsoDateTime` (pkt 3) dla spójności.

## 11. Puste odpowiedzi listowe
- Lokalnie różne nazwy pól: `emptyResponse`, `emptyParentsResponse`, `emptyReport`.
- Propozycja tylko jeśli chcemy ujednolicenia kontraktów: generyczny `emptyPaginated<T>(page, limit, total)` lub pozostawienie jak jest (niska wartość obecnie).

## 12. Użycie istniejących funkcji między serwisami
- W `createEnrollment` można zastąpić custom ownership check wywołaniem `getChildById` (już istnieje) – najprostszy quick win.

## Priorytety wdrożenia (szybkie korzyści vs koszt)
1. Ownership helper / użycie `getChildById` (natychmiastowy zysk w czytelności). 
2. `pickDefined` + refaktory w update funkcjach. 
3. Liczenie enrollments (pojawi się jeszcze w przyszłych funkcjach). 
4. Datetime utils (ujednolicenie walidacji, mniejsza ilość literówek). 
5. Tag repository (jeśli planowane rozszerzenia tagów). 
6. Paginacja & countBy abstractions (lekki bonus w redukcji linii). 

## Ryzyko nadmiernej abstrakcji
- Zbyt agresywne łączenie może ukryć logikę domenową (np. available_spots vs notifications_sent używają tych samych danych ale mają inne semantyki). Dlatego helpery powinny być małe i jednoznaczne.

## Rekomendacja implementacyjna
- Wdrażać iteracyjnie: najpierw stworzyć nowe pliki utils, następnie w 1–2 serwisach, dopiero później w pozostałych (minimalizacja ryzyka szerokich konfliktów). 
- Zachować nazwy plików jasno oddające odpowiedzialność (`datetime.utils.ts`, `activityTags.repository.ts`).
- Dodać krótkie testy jednostkowe (przy rozbudowie projektu) dla kluczowych helperów: daty, countBy, pickDefined.

## Potencjalne przyszłe rozszerzenia
- Centralny moduł do mapowania PostgREST / Postgres error codes na domenowe (np. UNIQUE na konkretne *_CONFLICT kody). 
- Wspólna abstrakcja dla list endpoints (standard pagination + optional filters) gdy pojawi się więcej list.

---
Aktualizacja wg potrzeb – plik służy jako backlog refaktoryzacyjny.

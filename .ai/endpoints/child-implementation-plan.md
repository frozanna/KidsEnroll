# API Endpoint Implementation Plan: GET /api/children/:id

## 1. Przegląd punktu końcowego
Endpoint umożliwia pobranie szczegółów pojedynczego dziecka należącego do aktualnie uwierzytelnionego rodzica (rola `parent`). Zwraca: `id, first_name, last_name, birth_date, description, created_at`. Zapewnia kontrolę dostępu (autentykacja + własność) oraz spójną strukturę błędów.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/api/children/:id`
- Parametry:
  - Wymagane (Path): `id` (integer > 0)
  - Opcjonalne: brak
- Request Body: brak
- Nagłówki: Autoryzacja przez Supabase (sesja / JWT) – wykorzystywana pośrednio przez `supabase.auth.getUser()` lub istniejącą abstrakcję.

### Walidacja Parametru `id`
Zod schema (w warstwie endpointu):
```ts
const childIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/,'id must be a positive integer string')
    .transform(v => Number(v))
    .refine(n => Number.isInteger(n) && n > 0, 'id must be > 0')
});
```

## 3. Wykorzystywane typy
- `ChildDTO` (z `types.ts`): `Omit<ChildEntity, 'parent_id'>` – dokładnie pola wymagane w odpowiedzi.
- `ErrorResponseDTO` – zunifikowany format błędu.
- Kody błędów: `CHILD_NOT_FOUND`, `CHILD_NOT_OWNED`, `AUTH_UNAUTHORIZED`, `VALIDATION_ERROR`, `INTERNAL_ERROR` (z mapowaniem w `errors.ts`).

## 4. Szczegóły odpowiedzi
### Sukces (200 OK)
```json
{
  "id": 1,
  "first_name": "Alice",
  "last_name": "Smith",
  "birth_date": "2020-05-15",
  "description": "Enjoys drawing and music",
  "created_at": "2025-01-10T10:00:00Z"
}
```

### Błędy
- 400 VALIDATION_ERROR (niepoprawny parametr `id`)
- 401 AUTH_UNAUTHORIZED (brak lub nieważny token, brak roli rodzica) 
- 403 CHILD_NOT_OWNED (dziecko istnieje lecz nie należy do rodzica)
- 404 CHILD_NOT_FOUND (dziecko nie istnieje)
- 500 INTERNAL_ERROR (nieoczekiwany błąd / problem DB)

Format błędu:
```json
{
  "error": {
    "code": "CHILD_NOT_FOUND",
    "message": "Child not found",
    "details": { }
  }
}
```

## 5. Przepływ danych
1. Otrzymanie żądania: `GET /api/children/:id`.
2. Walidacja param path przez Zod – transformacja do `number childId`.
3. Pobranie kontekstu Supabase: `const supabase = context.locals.supabase`.
4. Ustalenie `parentId` (UUID) – np. z profilu użytkownika (w kolejnych etapach implementacji profilu / lub przez `auth.getUser()` + powiązanie z tabelą `profiles`). Założenie: istnieje helper np. `authenticateParent()` - src/lib/api/helper.ts.
5. Wywołanie serwisu `getChildById(supabase, parentId, childId)`:
   - Zapytanie 1: `select id, first_name, last_name, birth_date, description, created_at from children where id = childId and parent_id = parentId maybeSingle()`.
   - Jeśli rekord znaleziony -> mapowanie wprost.
   - Jeśli brak -> Zapytanie 2: `select id, parent_id from children where id = childId maybeSingle()` aby rozróżnić 404 vs 403.
6. Serwis zwraca `ChildDTO` lub rzuca `ApiError` z odpowiednim kodem.
7. Endpoint formatuje odpowiedź sukcesu lub błąd w standardowym JSON.
8. RLS (Row-Level Security) w bazie wspiera ograniczenie dostępu, lecz logika aplikacyjna nadal odróżnia 403/404.

## 6. Względy bezpieczeństwa
- Autentykacja: wymagane aktywne uwierzytelnienie w Supabase.
- Autoryzacja: sprawdzenie roli `parent`; w przypadku innej roli -> 401/403 (preferowane: 401 jeśli brak uwierzytelnienia, 403 jeśli autentykacja poprawna ale rola nieuprawniona – spec wymienia 401 dla invalid token; brak roli rodzica interpretujemy jako 403 jeśli użytkownik jest autentykowany).
- Minimalizacja danych: nie ujawniamy `parent_id`.
- Walidacja parametru eliminuje injection; Supabase query builder neutralizuje SQL injection wewnętrznie.
- Enumeracja zasobów: rozróżnienie 403 vs 404 ujawnia istnienie ID; zaakceptowane przez spec – odnotowane jako ryzyko.
- Brak body (niższa powierzchnia ataku).
- Zalecane przyszłe rozszerzenie: rate limiting i audit logging.

## 7. Obsługa błędów
| Sytuacja | Kod błędu | HTTP | Działanie |
|----------|----------|------|-----------|
| Parametr `id` niepoprawny | VALIDATION_ERROR | 400 | ZodError -> `fromZodError()` |
| Brak uwierzytelnienia | AUTH_UNAUTHORIZED | 401 | Rzuć `createError('AUTH_UNAUTHORIZED', 'Unauthorized')` |
| Rola nie parent | CHILD_NOT_OWNED lub AUTH_UNAUTHORIZED? | 403 | Preferowane `CHILD_NOT_OWNED` jest semantycznie niepoprawne; lepiej: `createError('AUTH_UNAUTHORIZED', 'Parent role required', {status:403})` |
| Dziecko nie istnieje | CHILD_NOT_FOUND | 404 | Serwis po 2 zapytaniach |
| Dziecko należy do innego rodzica | CHILD_NOT_OWNED | 403 | Drugie zapytanie wykazało istnienie innego parent_id |
| Błąd DB / niespodziewany | INTERNAL_ERROR | 500 | Zmapować supabase error.message |

Response formatter: jednolity `ErrorResponseDTO`.

## 8. Rozważania dotyczące wydajności
- Pojedynczy dostęp do rekordu – obciążenie minimalne.
- Drugie zapytanie dla rozróżnienia 403 vs 404 dodaje stały narzut; akceptowalny. Można zoptymalizować przez jedno zapytanie bez parent_id i porównanie client-side, ale wymagałoby ujawnienia parent_id lub selekcji parent_id (nie chcemy zwracać). Zapytanie dodatkowe jest prostsze i czytelne.
- Tabela `children` powinna mieć indeks po PK (id) – standardowo tak jest. Dodatkowy indeks na `parent_id` istnieje (wg planu DB) – szybkie filtrowanie.
- Brak potrzeby cache. Ewentualny CDN nie ma zastosowania (dane prywatne).

## 9. Etapy wdrożenia
1. Dodaj Zod schema parametru ID w nowym pliku `src/lib/validation/params.schema.ts` (lub rozszerz istniejący) – `childIdParamSchema`.
2. Rozszerz `children.service.ts` o funkcję:
   ```ts
   export async function getChildById(supabase: SupabaseClient, parentId: string, childId: number): Promise<ChildDTO> {
     const { data: owned, error: ownedError } = await supabase
       .from('children')
       .select('id, first_name, last_name, birth_date, description, created_at')
       .eq('id', childId)
       .eq('parent_id', parentId)
       .maybeSingle();

     if (ownedError) throw createError('INTERNAL_ERROR', ownedError.message);
     if (owned) return owned;

     // Rozróżnienie 403 vs 404
     const { data: anyChild, error: anyError } = await supabase
       .from('children')
       .select('id, parent_id')
       .eq('id', childId)
       .maybeSingle();

     if (anyError) throw createError('INTERNAL_ERROR', anyError.message);
     if (!anyChild) throw createError('CHILD_NOT_FOUND', 'Child not found');
     throw createError('CHILD_NOT_OWNED', 'Child does not belong to current parent');
   }
   ```
3. Utwórz endpoint plik `src/pages/api/children/[id].ts` (Astro endpoint). Ustaw: `export const prerender = false`.
4. W endpoint:
   - Import Zod schema paramów i `getChildById`.
   - Parsuj parametry: `const { id: childId } = childIdParamSchema.parse(params);`
   - Ustal autentykację: `const { data: { user }, error } = await supabase.auth.getUser();` -> jeśli błąd lub brak user -> 401.
   - Pobierz profil (jeśli mechanizm istnieje) lub zakładaj że user.id = parent profile id (MVP) – w przyszłości walidacja roli.
   - Wywołaj serwis `getChildById`. 
   - Zwróć JSON 200 z danymi.
5. Obsługa błędów w endpoint:
   - Catch: jeśli `err instanceof ZodError` -> `fromZodError(err)`.
   - Inaczej `normalizeUnknownError(err)`.
   - `return new Response(JSON.stringify({ error: {...} }), { status: apiError.status, headers: {'Content-Type': 'application/json'}});`
6. Manualne sprawdzenie w dev środowisku: `curl GET /api/children/1` z poprawnym tokenem.
7. Dokumentacja: uzupełnij `.ai/api-plan.md` jeśli wymaga aktualizacji (już istnieje spec – odnotuj implementację jako done).

## 10. Minimalny kontrakt funkcji serwisowej
- Input: `supabase: SupabaseClient`, `parentId: string (UUID)`, `childId: number (>0)`
- Output: `Promise<ChildDTO>` lub `ApiError` throw
- Error modes: `CHILD_NOT_FOUND`, `CHILD_NOT_OWNED`, `INTERNAL_ERROR`
- Sukces: Prawidłowy obiekt bez `parent_id`

## 11. Edge Cases
- `id` = 0 lub ujemny -> 400
- `id` bardzo duży (np. 999999999) -> szybkie 404 (brak rekordu)
- Rekord z `description = null` -> zwrócić `description: null` (zgodnie z typem) lub pominąć? Spec pokazuje pole – zwracać null jeśli brak.
- Błąd sieciowy Supabase -> 500
- Sesja wygasła -> 401

## 12. Przykładowy szkielet endpointu (referencja)
*(Nie implementujemy teraz – tylko plan)*
```ts
import type { APIRoute } from 'astro';
import { z, ZodError } from 'zod';
import { getChildById } from '../../../lib/services/children.service';
import { fromZodError, normalizeUnknownError } from '../../../lib/services/errors';

export const prerender = false;

const childIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0)
});

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id: childId } = childIdParamSchema.parse(params);
    const supabase = locals.supabase;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw createError('AUTH_UNAUTHORIZED', 'Unauthorized');

    // TODO: fetch profile & role (MVP: assume parent)
    const parentId = user.id; // assumption for MVP

    const child = await getChildById(supabase, parentId, childId);
    return new Response(JSON.stringify(child), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const apiErr = err instanceof ZodError ? fromZodError(err) : normalizeUnknownError(err);
    return new Response(JSON.stringify({ error: { code: apiErr.code, message: apiErr.message, details: apiErr.details }}), {
      status: apiErr.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

---
Plan zapewnia spójność z obecnymi plikami (`children.service.ts`, `errors.ts`), stosuje Zod, SupabaseClient z `locals`, oraz standard błędów wg projektu.

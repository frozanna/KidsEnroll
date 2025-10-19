# Schemat bazy danych - KidsEnroll

## 1. Tabele

### users
Tabela zarządzana przez Supabase Auth.

- id: UUID PRIMARY KEY
- email: VARCHAR(255) NOT NULL UNIQUE
- encrypted_password: VARCHAR NOT NULL
- created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- confirmed_at: TIMESTAMPTZ

### facilities
- id: SERIAL PRIMARY KEY
- name: TEXT NOT NULL 
- address: TEXT
- created_at: TIMESTAMPTZ DEFAULT now()

### profiles
- id: UUID PRIMARY KEY  -- powiązane z auth.users
- first_name: TEXT NULLABLE
- last_name: TEXT NULLABLE
- role: user_role NOT NULL
- created_at: TIMESTAMPTZ DEFAULT now()

**Enum Definition:**
```sql
CREATE TYPE user_role AS ENUM ('admin', 'parent');
```

### workers
- id: SERIAL PRIMARY KEY
- first_name: TEXT NOT NULL
- last_name: TEXT NOT NULL
- email: TEXT UNIQUE NOT NULL
- created_at: TIMESTAMPTZ DEFAULT now()

### children
- id: SERIAL PRIMARY KEY
- parent_id: UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
- first_name: TEXT NOT NULL
- last_name: TEXT NOT NULL
- birth_date: DATE NOT NULL
- description TEXT NULLABLE
- created_at: TIMESTAMPTZ DEFAULT now()

### activities
- id: SERIAL PRIMARY KEY
- facility_id: INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE
- worker_id: INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE
- name: TEXT NOT NULL
- description: TEXT NULLABLE
- cost: DECIMAL(10,2) NOT NULL
- participant_limit: INTEGER NOT NULL
- start_datetime: TIMESTAMPTZ NOT NULL
- created_at: TIMESTAMPTZ DEFAULT now()

### enrollments
- child_id: INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE
- activity_id: INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE
- enrolled_at: TIMESTAMPTZ DEFAULT now()

**Primary Key:** (child_id, activity_id)

### activity_tags
- id: SERIAL PRIMARY KEY
- activity_id: INTEGER REFERENCES activities(id) ON DELETE CASCADE
- tag: TEXT NOT NULL
- created_at: TIMESTAMPTZ DEFAULT now()

## 2. Relacje między tabelami

- profiles -> children: jeden do wielu (każdy rodzic może mieć wiele dzieci)
- facilities -> activities: jeden do wielu
- workers -> activities: jeden do wielu
- activities -> activity_tags: jeden do wielu
- children <-> activities: relacja wiele do wielu poprzez tabelę enrollments

## 3. Indeksy

- INDEX na activities(start_datetime) dla optymalizacji zapytań czasowych.
- INDEX na enrollments(activity_id) dla szybszego wyszukiwania zapisów.
- INDEX na enrollments(child_id) dla szybszego wyszukiwania zajęć dzieci.
- INDEX na children(parent_id) dla szybszego wyszukiwania dzieci danego rodzica

## 4. Zasady PostgreSQL (RLS)

- RLS (Row-Level Security) powinno być implementowane na tabelach:
  - profiles: aby rodzice mieli dostęp tylko do swoich danych.
  - children: aby rodzice mogli zarządzać tylko danymi swoich dzieci.
  - enrollments: aby rodzice mieli uprawnienia modyfikacji dotyczące jedynie zapisów swoich dzieci.
- administrator powinien mieć dostęp do wszystkich danych

## 5. Dodatkowe uwagi

- Klucze obce wykorzystują opcję ON DELETE CASCADE w celu zachowania spójności danych.
- Schemat został zaprojektowany zgodnie z zasadami 3NF, z możliwością rozbudowy i optymalizacji w przyszłych iteracjach.
- Dynamiczne obliczanie liczby zapisanych dzieci na zajęciach (wolnych miejsc) realizowane jest w warstwie aplikacji.
- Supabase zarządza tabelą `auth.users`, która przechowuje podstawowe dane uwierzytelniające użytkowników (takie jak email, hasło, metadata) i obsługuje mechanizmy autoryzacji.
- Tabela `profiles` jest powiązana relacją 1:1 z `auth.users` poprzez identyfikator UUID, co umożliwia przechowywanie dodatkowych informacji (np. imię, nazwisko, rola) specyficznych dla aplikacji KidsEnroll.
- Aktualizacja i zarządzanie danymi w tabeli `auth.users` odbywa się poprzez mechanizmy wbudowane w Supabase Auth, co zapewnia wysoki poziom bezpieczeństwa i spójność danych.
 
-- Migration: Add Default Facility
-- Description: Inserts a default facility with ID 1 to satisfy foreign key constraints
--              for the MVP hardcoded facility_id.

insert into facilities (id, name, address)
values (1, 'Wesołe Przedszkole', 'ul. Wesoła 123, 00-001 Warszawa')
on conflict (id) do nothing;

# Dokument wymagań produktu (PRD) - KidsEnroll (MVP)
## 1. Przegląd produktu
KidsEnroll to aplikacja internetowa zaprojektowana w celu usprawnienia procesu zarządzania zajęciami dodatkowymi w przedszkolach. Wersja MVP (Minimum Viable Product) skupia się na dostarczeniu kluczowych funkcjonalności, które rozwiązują podstawowe problemy administratorów placówek oraz rodziców. Aplikacja oferuje dwa główne panele: panel administratora do zarządzania ofertą zajęć, opiekunami i użytkownikami, oraz panel rodzica, który umożliwia łatwe przeglądanie oferty i zapisywanie dzieci na wybrane zajęcia. Celem jest zastąpienie nieefektywnych, manualnych metod (takich jak papierowe listy czy komunikacja mailowa) jednym, scentralizowanym narzędziem cyfrowym.

## 2. Problem użytkownika
Obecnie proces zarządzania zajęciami dodatkowymi w przedszkolach jest często chaotyczny i czasochłonny.
### Dla administratorów przedszkola:
- Brak centralnego systemu do zarządzania listą dostępnych zajęć i przypisanymi opiekunami.
- Ręczne zbieranie zapisów od rodziców jest nieefektywne i podatne na błędy.
- Utrudnione śledzenie, które dzieci są zapisane na które zajęcia oraz monitorowanie wolnych miejsc.
- Komunikacja z rodzicami na temat zmian w harmonogramie jest rozproszona i wymaga indywidualnego kontaktu.

### Dla rodziców:
- Brak łatwego dostępu do aktualnej oferty zajęć dodatkowych.
- Proces zapisu dziecka jest niewygodny, często wymaga fizycznej obecności w placówce lub wymiany maili.
- Brak przejrzystego widoku zajęć, na które zapisane jest ich dziecko.
- Utrudnione zarządzanie rezygnacjami i brak jasnych informacji o kosztach.

KidsEnroll ma na celu rozwiązanie tych problemów poprzez automatyzację i cyfryzację kluczowych procesów, oszczędzając czas obu stronom i minimalizując ryzyko błędów.

## 3. Wymagania funkcjonalne
### 3.1. Panel Administratora
- Zarządzanie kontami rodziców: Przeglądanie listy zarejestrowanych rodziców oraz możliwość ręcznego usuwania ich kont wraz ze wszystkimi powiązanymi danymi.
- Zarządzanie opiekunami: Dodawanie i zarządzanie listą opiekunów (imię, nazwisko, e-mail kontaktowy).
- Zarządzanie zajęciami:
    - Dodawanie nowych zajęć (nazwa, opis, predefiniowane tagi, harmonogram, koszt, limit miejsc).
    - Przypisywanie opiekunów do zajęć.
    - Edycja istniejących zajęć (dzień/godzina, opiekun, koszt).
    - Usuwanie zajęć.
- Powiadomienia: Edycja lub usunięcie zajęć powoduje wysłanie mockowanego (symulowanego) powiadomienia e-mail do rodziców dzieci zapisanych na te zajęcia.
### 3.2. Panel Rodzica
- Uwierzytelnianie: Możliwość samodzielnej rejestracji i logowania do systemu. Konto administratora jest predefiniowane i niedostępne do publicznej rejestracji.
- Onboarding: Nowo zarejestrowany rodzic musi dodać co najmniej jedno dziecko, aby uzyskać dostęp do pełnej funkcjonalności aplikacji.
- Zarządzanie dziećmi:
    - Dodawanie profili dzieci (imię, nazwisko, data urodzenia, opis zainteresowań).
    - Edycja danych istniejących dzieci.
- Przeglądanie i zapisy na zajęcia:
    - Dostęp do listy wszystkich dostępnych zajęć.
    - Wyraźna informacja o braku wolnych miejsc (zablokowany przycisk zapisu).
    - Wyświetlanie komunikatu "Brak dostępnych zajęć", jeśli administrator żadnych nie dodał.
    - Możliwość zapisu dziecka na wybrane zajęcia.
- Zarządzanie zapisami:
    - Widok listy zajęć, na które zapisane są dzieci danego rodzica.
    - Możliwość wypisania dziecka z zajęć do 24 godzin przed ich rozpoczęciem.
- Raportowanie: Generowanie tygodniowego raportu kosztów (za bieżący tydzień kalendarzowy) w formacie Excel. Raport zawiera kolumny: Imię dziecka, Nazwisko dziecka, Nazwa zajęć, Data zajęć, Godzina zajęć, Koszt oraz wiersz sumujący.
### 3.3. Wymagania ogólne (niefunkcjonalne)
- Obsługa stref czasowych: Wszystkie daty w systemie są przechowywane w strefie czasowej UTC i wyświetlane użytkownikowi w jego lokalnej strefie czasowej.
- Architektura: System od początku projektowany jest z myślą o potencjalnej obsłudze wielu placówek w przyszłości.

## 4. Granice produktu
Następujące funkcjonalności celowo NIE wchodzą w zakres wersji MVP i mogą zostać rozważone w przyszłych iteracjach produktu:
- System płatności: Brak integracji z bramkami płatniczymi, automatycznego naliczania opłat i rozliczeń z opiekunami.
- Mechanizmy planowania: Brak narzędzi pomagających administratorom i opiekunom planować harmonogramy i unikać konfliktów czasowych.
- Rekomendacje AI: Funkcja generowania spersonalizowanej listy zajęć na podstawie zainteresowań dziecka jest odłożona na okres po wdrożeniu MVP.
- Weryfikacja rodziców: Brak mechanizmu weryfikacji tożsamości rodziców podczas rejestracji (np. przez kod z przedszkola).
- Zaawansowane powiadomienia: Powiadomienia e-mail w MVP są jedynie symulowane (mockowane) i nie będą faktycznie wysyłane.
- Zarządzanie rolami: Poza podziałem na role Administratora i Rodzica nie ma bardziej granularnego systemu uprawnień.

## 5. Historyjki użytkowników
### Uwierzytelnianie i Zarządzanie Kontem
---
- ID: US-001
- Tytuł: Rejestracja konta rodzica
- Opis: Jako nowy użytkownik (rodzic), chcę móc założyć konto w aplikacji, podając podstawowe dane, aby uzyskać dostęp do jej funkcjonalności.
- Kryteria akceptacji:
    1.  Na stronie głównej znajduje się przycisk "Zarejestruj się".
    2.  Formularz rejestracji wymaga podania adresu e-mail i hasła.
    3.  System waliduje poprawność formatu adresu e-mail.
    4.  System waliduje siłę hasła (np. minimum 8 znaków).
    5.  Po pomyślnej rejestracji jestem automatycznie zalogowany i przekierowany do ekranu onboardingu (dodawania dziecka).
    6.  Nie mogę zarejestrować się na e-mail, który już istnieje w systemie.

---
- ID: US-002
- Tytuł: Logowanie użytkownika (Rodzic/Administrator)
- Opis: Jako zarejestrowany użytkownik (rodzic lub administrator), chcę móc zalogować się na swoje konto, aby uzyskać dostęp do odpowiedniego panelu.
- Kryteria akceptacji:
    1.  Strona logowania zawiera pola na e-mail i hasło.
    2.  Po podaniu poprawnych danych logowania i kliknięciu "Zaloguj", zostaję przekierowany do swojego panelu (rodzica lub administratora).
    3.  W przypadku podania błędnych danych, wyświetlany jest czytelny komunikat o błędzie.
    4.  System rozróżnia konta rodziców i predefiniowane konto administratora.

---
- ID: US-003
- Tytuł: Onboarding nowego rodzica
- Opis: Jako nowo zarejestrowany rodzic, po pierwszym zalogowaniu muszę dodać profil co najmniej jednego dziecka, zanim uzyskam dostęp do reszty aplikacji.
- Kryteria akceptacji:
    1.  Po pierwszej rejestracji/logowaniu jestem przekierowany na stronę z formularzem "Dodaj dziecko".
    2.  Nie mogę opuścić tego widoku ani przejść do innych części aplikacji, dopóki nie dodam pierwszego dziecka.
    3.  Formularz dodawania dziecka wymaga podania imienia, nazwiska, daty urodzenia i opcjonalnie opisu zainteresowań.
    4.  Po pomyślnym dodaniu dziecka jestem przekierowany do głównego panelu rodzica.

### Panel Rodzica
---
- ID: US-004
- Tytuł: Zarządzanie profilami dzieci
- Opis: Jako rodzic, chcę mieć możliwość dodawania i edytowania profili moich dzieci, aby utrzymać aktualne dane i móc zapisywać je na zajęcia.
- Kryteria akceptacji:
    1.  W panelu rodzica widoczna jest lista moich dodanych dzieci.
    2.  Istnieje przycisk "Dodaj kolejne dziecko", który otwiera formularz dodawania dziecka.
    3.  Przy każdym profilu dziecka znajduje się opcja "Edytuj", która pozwala na modyfikację jego danych.
    4.  Nie ma możliwości usunięcia profilu dziecka w MVP.

---
- ID: US-005
- Tytuł: Przeglądanie dostępnych zajęć
- Opis: Jako rodzic, chcę móc przeglądać listę wszystkich dostępnych zajęć dodatkowych, aby zorientować się w ofercie przedszkola.
- Kryteria akceptacji:
    1.  W panelu rodzica znajduje się sekcja lub przycisk prowadzący do listy zajęć.
    2.  Na liście widoczna jest nazwa zajęć, imię i nazwisko opiekuna, harmonogram, koszt i liczba wolnych miejsc.
    3.  Jeśli administrator nie dodał żadnych zajęć, wyświetlany jest komunikat "Brak dostępnych zajęć".
    4.  Jeśli zajęcia mają komplet uczestników, są one widoczne na liście z adnotacją "Brak miejsc", a przycisk zapisu jest nieaktywny.

---
- ID: US-006
- Tytuł: Zapisywanie dziecka na zajęcia
- Opis: Jako rodzic, chcę móc zapisać swoje dziecko na wybrane zajęcia z listy dostępnych aktywności.
- Kryteria akceptacji:
    1.  Z poziomu panelu głównego (przy każdym dziecku) lub z ogólnej listy zajęć, mogę zainicjować proces zapisu.
    2.  Po kliknięciu "Zapisz" przy wybranych zajęciach, muszę wybrać, które z moich dzieci chcę zapisać.
    3.  Po wybraniu dziecka przechodzę do ekranu podsumowania z danymi zajęć i dziecka.
    4.  Po potwierdzeniu, dziecko zostaje zapisane na zajęcia, a liczba wolnych miejsc w tych zajęciach zmniejsza się o jeden.
    5.  Zapisane zajęcia pojawiają się w panelu rodzica, w sekcji danego dziecka.
    6.  Jeśli dziecko nie spełnia kryterium wiekowego (opartego na dacie urodzenia), system wyświetla ostrzeżenie, ale pozwala na kontynuację zapisu.

---
- ID: US-007
- Tytuł: Rezygnacja z zajęć
- Opis: Jako rodzic, chcę mieć możliwość wypisania dziecka z zajęć, na które je wcześniej zapisałem.
- Kryteria akceptacji:
    1.  W panelu rodzica, na liście zajęć, na które zapisane jest moje dziecko, przy każdych zajęciach znajduje się przycisk "Wypisz".
    2.  Mogę wypisać dziecko z zajęć nie później niż 24 godziny przed ich planowanym rozpoczęciem.
    3.  Jeśli do rozpoczęcia zajęć pozostało mniej niż 24 godziny, przycisk "Wypisz" jest nieaktywny lub niewidoczny.
    4.  Po pomyślnym wypisaniu dziecka, zajęcia znikają z jego listy, a liczba wolnych miejsc w tych zajęciach zwiększa się o jeden.

---
- ID: US-008
- Tytuł: Generowanie raportu kosztów
- Opis: Jako rodzic, chcę móc wygenerować raport kosztów zajęć moich dzieci z bieżącego tygodnia, aby kontrolować wydatki.
- Kryteria akceptacji:
    1.  W panelu rodzica znajduje się przycisk "Wygeneruj raport kosztów".
    2.  Kliknięcie przycisku powoduje wygenerowanie i pobranie pliku w formacie Excel.
    3.  Raport obejmuje okres od ostatniego poniedziałku do nadchodzącej niedzieli.
    4.  Plik zawiera kolumny: Imię dziecka, Nazwisko dziecka, Nazwa zajęć, Data zajęć, Godzina zajęć, Koszt.
    5.  Na końcu raportu znajduje się wiersz "Suma" z podsumowaniem kosztów wszystkich zajęć w raporcie.

### Panel Administratora
---
- ID: US-009
- Tytuł: Zarządzanie opiekunami
- Opis: Jako administrator, chcę móc dodawać i przeglądać listę opiekunów, aby móc ich później przypisywać do zajęć.
- Kryteria akceptacji:
    1.  W panelu administratora jest sekcja "Opiekunowie".
    2.  Mogę dodać nowego opiekuna, podając jego imię, nazwisko i kontaktowy adres e-mail.
    3.  Widzę listę wszystkich dodanych opiekunów.

---
- ID: US-010
- Tytuł: Tworzenie nowych zajęć
- Opis: Jako administrator, chcę móc tworzyć nowe zajęcia dodatkowe, definiując wszystkie ich parametry, aby udostępnić je rodzicom do zapisu.
- Kryteria akceptacji:
    1.  W panelu administratora jest sekcja "Zajęcia" z opcją "Dodaj nowe zajęcia".
    2.  Formularz dodawania zajęć zawiera pola: nazwa, opis, koszt, limit miejsc, dzień tygodnia, godzina rozpoczęcia.
    3.  Mogę przypisać do zajęć jednego z wcześniej zdefiniowanych opiekunów z listy.
    4.  Mogę przypisać do zajęć tagi z predefiniowanej, zamkniętej listy.
    5.  Po zapisaniu, nowe zajęcia pojawiają się na liście zajęć w panelu administratora i stają się widoczne dla rodziców.

---
- ID: US-011
- Tytuł: Edycja i usuwanie zajęć
- Opis: Jako administrator, chcę móc edytować szczegóły istniejących zajęć oraz je usuwać, aby oferta była zawsze aktualna.
- Kryteria akceptacji:
    1.  Na liście zajęć w panelu administratora przy każdej pozycji znajdują się opcje "Edytuj" i "Usuń".
    2.  Opcja "Edytuj" pozwala na zmianę dnia/godziny, opiekuna i kosztu zajęć.
    3.  Opcja "Usuń" powoduje usunięcie zajęć z systemu po uprzednim potwierdzeniu.
    4.  Każda z tych akcji (edycja lub usunięcie) generuje mockowane powiadomienie e-mail do rodziców dzieci zapisanych na te zajęcia.

---
- ID: US-012
- Tytuł: Zarządzanie kontami rodziców
- Opis: Jako administrator, chcę mieć wgląd w listę zarejestrowanych rodziców i możliwość usunięcia ich konta w razie potrzeby.
- Kryteria akceptacji:
    1.  W panelu administratora znajduje się sekcja "Rodzice" z listą wszystkich zarejestrowanych kont.
    2.  Przy każdym koncie rodzica widoczny jest przycisk "Usuń".
    3.  Po kliknięciu "Usuń" i potwierdzeniu operacji, konto rodzica oraz wszystkie powiązane z nim dane (w tym profile dzieci i zapisy na zajęcia) są trwale usuwane z systemu.

## 6. Metryki sukcesu
Sukces wdrożenia wersji MVP będzie mierzony na podstawie danych zbieranych w ciągu pierwszego miesiąca od uruchomienia aplikacji. Celem jest walidacja, czy produkt rozwiązuje realne problemy użytkowników i czy jest przez nich adoptowany.
### Kluczowe wskaźniki (KPIs):
1. Adopcja po stronie rodziców: Co najmniej 90% zarejestrowanych rodziców dodało profil przynajmniej jednego dziecka.
2. Zaangażowanie w zapisy: Co najmniej 75% rodziców, którzy dodali dziecko, zapisało je na minimum jedne zajęcia.
3. Kompletność oferty po stronie przedszkola: W systemie zdefiniowane są co najmniej 2 różne zajęcia dodatkowe.
4. Gotowość operacyjna: Do systemu dodany i przypisany do zajęć jest co najmniej 1 opiekun.
### Sposób pomiaru
Na etapie MVP, ze względu na brak wbudowanych narzędzi analitycznych, metryki będą pozyskiwane ręcznie przez zespół deweloperski poprzez bezpośrednie zapytania do bazy danych. Raport z powyższych wskaźników będzie przygotowywany na koniec każdego miesiąca.


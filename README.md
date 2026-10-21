# Etykiety roślin — AGRA PSK Kłodzko

Aplikacja dla pracowników sklepu ogrodniczego **AGRA PSK** w Kłodzku (od 1991 r.). Z nazwy rośliny i ceny składa kartę na półkę: krótki opis po polsku, piktogramy pielęgnacji i cenę. Kartę drukuje się w formacie A5 albo dwie sztuki na arkuszu A4.

## Co robi program

1. Pracownik wpisuje polską nazwę (i ewentualnie łacińską) oraz cenę w złotych. Może dodać zdjęcie z dysku.
2. Opis i dane pielęgnacji biorą się z katalogu ponad stu roślin popularnych w polskich szkółkach. Jeśli rośliny nie ma w katalogu, a na serwerze jest klucz API, opis przygotowuje model językowy. Zawsze można wpisać treść ręcznie.
3. Przed drukiem da się poprawić każde pole: opis, podlewanie, stanowisko, mrozoodporność, typ, wysokość, nazwy i cenę.
4. Podgląd pokazuje kartę A5 (148 × 210 mm) oraz arkusz A4 w poziomie z dwiema kartami i linią cięcia. Jest też pobieranie PDF.
5. Gotowe opisy (także poprawki) zostają w pamięci przeglądarki, więc ta sama roślina nie woła modelu drugi raz. Zdjęcia nie są zapisywane.

Do modelu wysyłana jest **wyłącznie nazwa rośliny**. Cena, zdjęcie i dane sklepu nie opuszczają przeglądarki.

## Uruchomienie na komputerze

Potrzebny jest Node.js 22.

```bash
npm install
npm run dev
```

Aplikacja startuje pod adresem [http://localhost:3000](http://localhost:3000).

Sprawdzenie katalogu i parserów:

```bash
npm test
```

Bez żadnego klucza API działa katalog i wpis ręczny. Żeby włączyć opisy z modelu, skopiuj `.env.example` do `.env.local` i uzupełnij klucz.

## Zmienne środowiskowe

| Zmienna | Znaczenie |
| --- | --- |
| `LLM_API_KEY` | Klucz API. Pusty = tylko katalog. |
| `LLM_PROVIDER` | `openai` (domyślnie) albo `anthropic`. |
| `LLM_API_BASE` | Adres API. Dla OpenAI: `https://api.openai.com/v1`. Dla zgodnych usług (OpenRouter, Groq, lokalne Ollama) podmień adres. |
| `LLM_MODEL` | Nazwa modelu, domyślnie `gpt-4o-mini`. Dla Anthropic domyślnie `claude-3-5-haiku-latest`. |
| `OPENAI_API_KEY` | Zapasowy klucz, gdy dostawcą jest `openai`, a `LLM_API_KEY` jest puste. |

Klucz czytają tylko trasy serwerowe `app/api/generate` i `app/api/status`. Nie używaj przedrostka `NEXT_PUBLIC_` — taki klucz trafiłby do przeglądarki.

## Wdrożenie na Vercel

1. Wypchnij to repozytorium na publiczny Git (GitHub, GitLab albo podobny). W repozytorium nie commituj `.env.local` ani żadnego pliku z kluczem. Wzorzec `.env.example` jest pusty i może zostać.
2. Na [vercel.com](https://vercel.com) wybierz **Add New… → Project** i wskaż repozytorium.
3. Framework wykryje się jako Next.js. Zostaw polecenia: instalacja `npm install`, build `npm run build`.
4. W **Environment Variables** dodaj `LLM_API_KEY`. Opcjonalnie `LLM_PROVIDER`, `LLM_API_BASE` i `LLM_MODEL`. Zaznacz środowisko Production (oraz Preview, jeśli ma działać tak samo).
5. Kliknij **Deploy**. Po zbudowaniu Vercel poda adres strony.
6. Otwórz stronę, wpisz „Lawenda wąskolistna” i cenę `19,99`. Karta powinna powstać z katalogu nawet bez klucza. Z kluczem przycisk „Poproś AI o nowy opis” woła model tylko z nazwą rośliny.

Zmiana zmiennych wymaga ponownego wdrożenia (Redeploy), jeśli Vercel nie podmieni ich sam.

## Wdrożenie na Netlify

1. **Add new project → Import an existing project** i wskaż to samo repozytorium.
2. Netlify powinien rozpoznać Next.js. Build: `npm run build`.
3. W **Site configuration → Environment variables** ustaw te same zmienne co wyżej (`LLM_API_KEY` i ewentualnie dostawcę oraz model).
4. Wdróż stronę i sprawdź kartę lawendy tak jak na Vercelu.

Trasa `/api/generate` musi działać jako funkcja serwerowa, nie jako sam statyczny eksport. Przy domyślnym wykrywaniu Next.js na Netlify tak właśnie jest.

## Drukowanie

- **Drukuj kartę A5** — jedna strona 148 × 210 mm.
- **Dwie karty na A4** — arkusz poziomy 297 × 210 mm, dwie takie same karty i przerywana linia cięcia pośrodku.
- W oknie drukowania: skala **100%** (rzeczywisty rozmiar), marginesy **brak**, wyłączone nagłówki i stopki przeglądarki.
- Tekst, ramki i piktogramy są czarne, więc karta jest czytelna na zwykłej drukarce laserowej bez kolorowego tonera. Kremowe tło schodzi tylko wtedy, gdy włączysz grafikę w tle.
- **PDF** to osobny plik o tych samych wymiarach stron. Do druku w sklepie pewniejszy jest przycisk drukowania — podgląd na ekranie i wydruk biorą się z tego samego układu.

## Prywatność

Żądanie do `/api/generate` jest obcinane do pól `polishName` i `latinName`. Cena nie wchodzi do treści wysyłanej modelowi. Zdjęcie jest czytane lokalnie jako podgląd i nie jest przesyłane. Opisy trzymane są w `localStorage` tej przeglądarki.

Adres wdrożonej strony jest publiczny, jeśli tak ustawisz hosting. Klucz nie wycieka do kodu strony, ale każdy, kto zna adres, może zużywać limit modelu (jest prosty hamulec: 20 zapytań na minutę z jednego adresu). Gdy to przeszkadza, zostaw klucz pusty i korzystaj z katalogu.

## Ograniczenia

- Katalog opisuje gatunki i kilka częstych odmian, nie każdą roślinę ze stoiska. Nietypową odmianę trzeba poprawić ręcznie albo dopytać model.
- Liczby mrozoodporności są typowe dla gatunku, nie obietnicą dla konkretnej zimy w Kotlinie Kłodzkiej. Przy roślinach wrażliwych opis o tym mówi, ale przed drukiem i tak warto rzucić okiem.
- Model bywa pewny siebie i myli odmiany. Opis z AI jest do sprawdzenia, nie do ślepego wydruku.
- Zdjęcie znika po odświeżeniu strony. Zostają nazwy, opis i cena.
- Przeglądarki potrafią dodać własny nagłówek albo zeskalować stronę. Bez skali 100% karta nie zejdzie na A5.
- PDF odtwarza treść karty wektorowo i może minimalnie różnić się od podglądu (szczególnie przy zdjęciu). Wzorem do druku jest podgląd i przycisk „Drukuj”.

Czcionki na karcie: [Source Sans 3](https://github.com/adobe-fonts/source-sans) (Adobe, SIL OFL) i [Fraunces](https://github.com/undercasetype/Fraunces) (SIL OFL). Teksty licencji są w `public/fonts/`.

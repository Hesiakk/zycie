# Życie na Twoich warunkach

Sklep korzysta z Express i Stripe Checkout. Frontend znajduje się w `public/`, a backend, katalog produktów i pliki do pobrania w katalogu głównym projektu.

## Uruchomienie z folderu `public`

1. Zainstaluj Node.js 20 lub nowszy.
2. Uruchom `public/start.bat` albo otwórz terminal w katalogu głównym i wykonaj:
   ```bash
   npm install
   npm start
   ```
   Skrypt `start.bat` przechodzi do katalogu głównego projektu, instaluje brakujące zależności i uruchamia serwer.
3. Otwórz `http://localhost:3000`. Nie otwieraj `index.html` bezpośrednio z dysku — sklep wymaga serwera, aby połączyć frontend z API.

## Konfiguracja płatności i plików

- Skopiuj `.env.example` do `.env` w katalogu głównym. Wstaw klucze Stripe; `PUBLIC_URL` i `CONTACT_EMAIL` można tam dostosować. Plik `.env` jest wczytywany przez serwer.
- W `data/products.json` skonfiguruj produkty. Pliki PDF umieść w `ebooks/`, używając nazw wskazanych w polu `file`.
- Bez `STRIPE_SECRET_KEY` można oglądać sklep, ale płatności i pobieranie będą wyłączone. W repozytorium nie ma plików PDF, więc przed sprzedażą trzeba je dodać.
- Dla produkcji ustaw `PUBLIC_URL` na adres HTTPS i skonfiguruj webhook Stripe `POST /api/stripe/webhook`, używając `STRIPE_WEBHOOK_SECRET`.

Pliki e-booków nie są publicznie serwowane. Pobieranie jest dostępne wyłącznie po potwierdzeniu płatności i weryfikacji podpisanego linku.

Przed uruchomieniem sprzedaży uzupełnij regulamin, politykę prywatności i prawdziwe dane sprzedawcy oraz sprawdź wymagania dotyczące sprzedaży treści cyfrowych.

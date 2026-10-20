# KSK PRETOR · AK-47 3D

Interaktywny, stylizowany model 3D karabinka AK-47 w barwach KSK Pretor (strzelnica w Racławiu koło Gorzowa Wlkp.).
Działa w przeglądarce na komputerze i telefonie. Służy do pokazywania budowy broni i robienia zdjęć na Instagram.

## Co potrafi

- obracanie, przybliżanie i przesuwanie myszką oraz dotykiem,
- podświetlenie części na czerwono i podpis z jej nazwą po najechaniu (na telefonie po dotknięciu),
- kliknięcie **spustu**: ruch spustu, błysk z lufy i drgnięcie kamery (w pozycji ZABEZPIECZONY spust nie strzela),
- kliknięcie **rączki zamka**: suwadło cofa się i wraca,
- kliknięcie **przełącznika**: ZABEZPIECZONY → OGIEŃ CIĄGŁY → OGIEŃ POJEDYNCZY (tylko wizualnie),
- **ROZŁÓŻ / ZŁÓŻ**, suwak rozłożenia i tryb krok po kroku (◀ WSTECZ / DALEJ ▶) – niepełne rozkładanie:
  magazynek, pokrywa komory zamkowej, zespół sprężyny powrotnej, suwadło z zamkiem, rura gazowa z nakładką,
- **TRYB ZDJĘCIA**: 5 gotowych ujęć, ramka kadru i eksport PNG 1080×1350 (post) lub 1080×1920 (relacja)
  z napisem „KSK PRETOR”; opcjonalnie podpisy części i błysk z lufy.

Model jest budowany w kodzie z prostych brył (bez gotowych modeli), tekstura drewna generowana jest w canvasie.

## Jak otworzyć lokalnie

Strona używa modułów ES, więc trzeba ją otworzyć przez prosty serwer (nie przez `file://`):

```bash
cd ksk-ak47-3d
python3 -m http.server 8000
```

Potem w przeglądarce: <http://localhost:8000>. Potrzebny jest internet (three.js i fonty ładują się z CDN).

## Jak włączyć GitHub Pages

1. W repozytorium na GitHubie wejdź w **Settings → Pages**.
2. W **Build and deployment → Source** wybierz **Deploy from a branch**.
3. Gałąź **main**, folder **/ (root)** → **Save**.
4. Po minucie–dwóch strona będzie pod adresem: <https://hubbit005.github.io/ksk-ak47-3d/>

## Struktura

```
index.html        interfejs
css/style.css     styl KSK Pretor (czerń, czerwień #C82323, fonty Anton i Barlow)
js/main.js        scena, światła, interakcje, pętla renderowania
js/model.js       budowa modelu z części
js/disassembly.js rozkładanie, podpisy części
js/photo.js       tryb zdjęcia i eksport PNG
js/textures.js    tekstury drewna i metalu, błysk, odbicia studyjne
```

Na telefonach strona sama zmniejsza rozdzielczość renderowania i cieni oraz wyłącza odbicie w podłodze.

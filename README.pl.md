# Warhammer GM Suite (`warhammer-gm-suite`)

[English](README.md) | **Polski**

Jeden panel MG dla wszystkich systemów Warhammera. Moduł wykrywa aktywny system i dostosowuje do niego opcje: kto należy do drużyny, jak działa doświadczenie, jaki zasób wraca na koniec sesji i jak rzuca się testy.

Wymaga **Foundry VTT v14** i jednego z poniższych systemów.

| System | PD | Zasób na koniec sesji | Testy grupowe |
|---|---|---|---|
| **WFRP 4e / 5e** (`wfrp4e` 10.0+) | Dziennik PD | Punkty Szczęścia do Przeznaczenia + talent Szczęście | Umiejętności i cechy, trudność, modyfikator |
| **The Old World** (`whtow`) | Dziennik PD | Punkty Losu do maksimum | Umiejętności (pula kości) |
| **Imperium Maledictum** (`impmal`) | Dziennik PD | Punkty Losu do maksimum | Umiejętności i cechy, trudność, modyfikator |
| **Wrath & Glory** (`wrath-and-glory`) | Suma PD | Gniew ustawiony na 1 | Umiejętności i atrybuty, ST |
| **Soulbound** (`age-of-sigmar-soulbound`) | Suma PD | Ogień Duszy aktora drużyny do maksimum | Umiejętności i atrybuty, ST i złożoność |

Interfejs jest w języku ustawionym w Foundry: **angielski** i **polski** są wbudowane, a kolejne języki można dodać (zobacz *Języki*). To, co nieprzetłumaczone, wyświetla się po angielsku.

## 🧭 Otwieranie panelu

Tylko MG: przycisk z wieżą w **narzędziach tokenów** albo w makrze `game.modules.get("warhammer-gm-suite").api.open()` (`open("group")` otwiera zakładkę Test grupowy).

Każdą zakładkę można wyłączyć w ustawieniach modułu. Lista na górze wybiera postacie: postacie graczy, wszystkie postacie należące do graczy albo zaznaczone tokeny. Odznacz tych, których chcesz pominąć.

## 🏁 Zakładka Sesja

* Przyznawanie PD zaznaczonym postaciom z powodem (`%session%` zamienia się w numer sesji).
* Odnowienie zasobu systemu jednym kliknięciem; aktualna wartość każdej postaci jest na liście.
* **Zakończ sesję** wykonuje zaznaczone kroki po potwierdzeniu: zapis czatu do pliku, wyczyszczenie czatu, przyznanie PD, odnowienie zasobu, aktywacja sceny przejściowej, zwiększenie numeru sesji. Na koniec na czacie pojawia się podsumowanie.

## 🎲 Zakładka Test grupowy

* Wybór testu: szybkie przyciski, lista systemu, a w WFRP także własny tekst z podpowiedziami (*Język (Reikspiel)*), ze specjalizacjami drużyny na początku.
* Trudność ustawiasz tak, jak robi to dany system; wybierasz też, kto widzi poszczególne karty.
* Moduł rzuca za każdą zaznaczoną postać i szepcze MG jedno podsumowanie, od najlepszych wyników. Domyślnie okno rzutu jest pomijane.
* WFRP: postać bez umiejętności podstawowej testuje cechę. Postać bez umiejętności zaawansowanej jest pomijana albo (ustawienie) testuje cechę z wyższą trudnością.

## ⚔️ Zakładka Walka

* Zadawanie obrażeń zaznaczonym postaciom: liczba albo wzór z kośćmi, jeden rzut dla wszystkich albo osobny dla każdej postaci. Wynik liczy system według własnych zasad, a MG dostaje jedno podsumowanie.
* Opcje zależą od systemu: lokacja trafienia, pominięcie pancerza lub Bonusu z Wytrzymałości (WFRP, gdzie obrażenia mogą dostać też pojazdy: zaznacz ich tokeny), pominięcie pancerza (The Old World, Imperium Maledictum), przebicie pancerza, Szok i Rany śmiertelne (Wrath & Glory), Przebijanie i Nieskuteczne (Soulbound).
* Pule walki, jeśli system je ma: Przewaga w WFRP (każdy walczący albo obie strony przy zasadzie Przewagi Grupowej), Superiority w Imperium Maledictum, Chwała i Zguba w Wrath & Glory.

## 💡 Zakładka Światło i wizja

* Presety światła i wizji dla tokenów zaznaczonych na scenie, z opcjonalnym własnym zasięgiem. WFRP ma własne źródła światła, pozostałe systemy krótszą listę.
* Zasięgi są w jednostkach sceny. Tylko wartości WFRP pochodzą z zasad, pozostałe to punkt wyjścia.

## 👁️ Zakładka Mroczne Szepty

Tylko w systemach ze Spaczeniem (WFRP, Imperium Maledictum, Wrath & Glory). MG pisze pokusę, a każda zaznaczona postać ze Spaczeniem dostaje ją jako prywatną kartę z przyciskami **Usłuchaj** i **Oprzyj się**. MG dostaje odpowiedź, a posłuchanie szeptu usuwa 1 punkt Spaczenia (można to wyłączyć).

## 🎯 Token HUD

Każdy właściciel postaci widzi przy HUD tokena jej szybkie testy z wartościami. Kliknięcie otwiera okno rzutu systemu.

## ⚙️ Ustawienia (świat)

* Włączanie każdej zakładki i testów w Token HUD
* Czy posłuchanie Mrocznego Szeptu usuwa Spaczenie
* Domyślny wybór postaci
* Domyślna widoczność kart testów grupowych
* WFRP: test cechy zamiast nieznanej umiejętności zaawansowanej i o ile stopni jest trudniejszy

## 🛠️ Rozwój

```bash
npm install
npm run check   # walidacja manifestu i tłumaczeń, lint, testy
npm run link    # podłączenie do lokalnego Foundry (FOUNDRY_DATA=ścieżka)
```

Nowy system to jeden plik w `scripts/systems/` i jedna linia w `scripts/systems/index.mjs`.

## 🌐 Języki

Angielski i polski są wbudowane. Aby dodać kolejny język:

```bash
npm run lang:add -- de "Deutsch"
```

Polecenie tworzy `lang/de.json` (kopię tekstów angielskich) i dopisuje go do `module.json`. Przetłumacz teksty; brakujące klucze wyświetlą się po angielsku, a `npm run check` je wypisze. Tłumaczenia mile widziane jako pull requesty.

Osobny moduł tłumaczenia też może dodać język bez zmian tutaj: deklaruje wpis `languages` z `"lang": "de"` wskazujący jego własny plik z tymi samymi kluczami.

## 🙏 Podziękowania

Inspirowane modułem [WFRP4e GM Toolkit](https://github.com/Foundry-Workshop/fvtt-wfrp4e-gmtoolkit) autorstwa Jaga Goraya i Foundry-Workshop (MIT). To nowa implementacja, bez kopiowania kodu.

## 📄 Licencja

MIT – zobacz [LICENSE](LICENSE).

Nieoficjalna twórczość fanowska, niezwiązana z Games Workshop ani Cubicle 7 i przez nie niepopierana. Warhammer i powiązane nazwy są znakami towarowymi Games Workshop Limited. Moduł nie zawiera tekstów ani grafik z podręczników – działa z treściami, które już posiadasz.

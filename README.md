# Warhammer GM Suite (`warhammer-gm-suite`)

**English** | [Polski](README.pl.md)

One GM dashboard for every Warhammer system. The module detects the active system and adapts the options to it: which characters count as the party, how XP works, which resource comes back at the end of a session and how tests are rolled.

Requires **Foundry VTT v14** and one of the systems below.

| System | XP | End-of-session resource | Group tests |
|---|---|---|---|
| **WFRP 4e / 5e** (`wfrp4e` 10.0+) | XP log | Fortune back to Fate + Luck talent | Skills and characteristics, difficulty, modifier |
| **The Old World** (`whtow`) | XP log | Fate back to maximum | Skills (dice pool) |
| **Imperium Maledictum** (`impmal`) | XP log | Fate back to maximum | Skills and characteristics, difficulty, modifier |
| **Wrath & Glory** (`wrath-and-glory`) | XP total | Wrath set to 1 | Skills and attributes, DN |
| **Soulbound** (`age-of-sigmar-soulbound`) | XP total | Party actor's Soulfire refilled | Skills and attributes, DN and complexity |

The interface follows Foundry's language: **English** and **Polish** are built in, and more languages can be added (see *Languages*); anything untranslated falls back to English.

## 🧭 Opening the dashboard

GM only: the chess rook button in the **Token controls**, or `game.modules.get("warhammer-gm-suite").api.open()` in a macro (`open("group")` opens the Group Test tab).

Each tab can be switched off in the module settings. The list at the top chooses the characters: player characters, all player-owned characters or the selected tokens. Untick anyone who should be left out.

## 🏁 Session tab

* Award XP to the ticked characters, with a reason (`%session%` becomes the session number).
* Restore the system's resource in one click; each character's current value is on the list.
* **End session** runs the steps you tick, after a confirmation: save the chat log to a file, clear the chat, award XP, restore the resource, activate a holding scene, advance the session number. A summary is posted to the chat afterwards.

## 🎲 Group Test tab

* Choose a test: quick buttons, the system's list, and in WFRP also free text with suggestions (*Language (Reikspiel)*), with the party's specialisations first.
* Set the difficulty the way the system does it, and who sees the individual cards.
* The module rolls for every ticked character and whispers one summary to the GM, best results first. By default the roll dialog is skipped.
* WFRP: a character without a basic skill tests the characteristic. A character without an advanced skill is left out, or (setting) tests the characteristic at a harder difficulty.

## ⚙️ Settings (world)

* Session tab and Group Test tab on/off
* Default character selection
* Default visibility of group test cards
* WFRP: fallback for untrained advanced skills and how many difficulty steps it costs

## 🛠️ Development

```bash
npm install
npm run check   # manifest and translation validation, lint, tests
npm run link    # link into your local Foundry (FOUNDRY_DATA=path)
```

A new system is one file in `scripts/systems/` and one line in `scripts/systems/index.mjs`.

## 🌐 Languages

English and Polish are built in. To add another language:

```bash
npm run lang:add -- de "Deutsch"
```

This creates `lang/de.json` (a copy of the English texts) and registers it in `module.json`. Translate the texts; any key you leave out falls back to English, and `npm run check` lists the untranslated keys. Translations are welcome as pull requests.

A separate translation module can also add a language without touching this one: it declares a `languages` entry with `"lang": "de"` that points to its own file with the same keys.

## 🙏 Credits

Inspired by [WFRP4e GM Toolkit](https://github.com/Foundry-Workshop/fvtt-wfrp4e-gmtoolkit) by Jag Goraya and Foundry-Workshop (MIT). This is a new implementation; no code was copied.

## 📄 License

MIT – see [LICENSE](LICENSE).

Unofficial fan content, not affiliated with or endorsed by Games Workshop or Cubicle 7. Warhammer and all related names are trademarks of Games Workshop Limited. The module ships no rulebook text or artwork; it works with the content you already own.

# Kingdom — Crown of Embers

Et Kingdom-inspireret 2D base-defense spil. Ren HTML5 + Canvas 2D + vanilla
JavaScript — ingen build, ingen dependencies, ingen eksterne assets. Al grafik
tegnes proceduralt i silhuet-stil, og al lyd genereres med Web Audio API.

## Spil nu
Serveren kører allerede lokalt:

👉 **http://localhost:8000/**

Åbn linket i Chrome.

## Start igen senere
Hvis serveren er stoppet (fx efter genstart), så enten:

- **Dobbeltklik `start-game.bat`** (starter server + åbner browseren), eller
- kør manuelt i en terminal i denne mappe:
  ```
  python -m http.server 8000
  ```
  og åbn `http://localhost:8000/`.

## Sådan spilles
| Tast | Handling |
|------|----------|
| `A` / `D` eller `←` `→` | Rid til siderne |
| `Shift` | Galop |
| `M` | Lyd til/fra |
| `P` | Pause |

Du betaler **automatisk** med dit guld, når du står stille ved et blåt
bygge-mærke, en butik (🏹 bue / 🔨 hammer / 🌱 gård), basen, eller en vagabond.

### Loopet
1. **Saml guld** – ligger på jorden; bueskytter jager dyr om dagen for mønter; en gård giver passiv indkomst.
2. **Rekruttér vagabonder** → undersåtter. Køb 🏹 buer (→ bueskytter) og 🔨 hamre (→ byggere).
3. **Byg mure** ved de blå mærker; byggere rejser og reparerer dem; opgradér træ → sten.
4. **Opgradér basen**: Lejr → Lille landsby → Stor landsby → **Slot**.
5. **Overlev natten** – grådighedens horder spawner fra portalerne og angriber mure, undersåtter og dit guld. Bueskytter forsvarer murene automatisk.
6. **Bliv ved** – der er ingen sejrsslutning; trusselsniveauet stiger med dagene.

### Mål
- **Overlevelse:** Se hvor mange dage du kan holde riget i live.
- **Nederlag:** Slottet ødelægges, eller kronen stjæles (sker hvis en fjende når dig uden du har guld).

Spillet **gemmer automatisk** (localStorage) — vælg "Fortsæt" på startskærmen.

## Filer
- `index.html` – markup + HUD/overlays
- `style.css` – styling
- `game.js` – hele spillet (verden, døgncyklus, økonomi, NPC-AI, byggeri, kamp, gem/indlæs, rendering, lyd)
- `start-game.bat` – lokal launcher

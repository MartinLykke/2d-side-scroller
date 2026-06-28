# Kingdom — Crown of Embers

Et Kingdom-inspireret 2D base-defense spil. Ren HTML5 + Canvas 2D + vanilla JavaScript — ingen build, ingen dependencies, ingen eksterne assets. Al grafik tegnes proceduralt, og al lyd genereres med Web Audio API.

## Start spillet

Kør en lokal HTTP-server fra projektmappen:

```
python -m http.server 8000
```

Åbn derefter `http://localhost:8000/` i Chrome.

## Styring

| Tast | Handling |
|------|----------|
| `A` / `D` eller `←` `→` | Rid til siderne |
| `Shift` | Galop |
| `↓` / `S` (hold) | Betal ved station / rekruttér vagabond |
| `Space` | Hop |
| `F` | Saml våben / åbn kiste |
| `I` | Inventar |
| `B` | Butik (kræver base niveau 2+) |
| `+` / `-` / `0` | Zoom ind/ud/reset |
| `M` | Lyd til/fra |
| `Esc` | Pause / luk menu |
| `P` | Dev-panel |

## Spilmekanikker

### Loopet
1. **Saml guld** – mønter ligger på verden; bueskytter jager dyr om dagen for mønter; en gård giver passiv indkomst.
2. **Rekruttér vagabonder** → undersåtter. Køb 🏹 buer (→ bueskytter) og 🔨 hamre (→ byggere) ved stationerne ved basen.
3. **Byg og opgradér mure** ved de blå mærker (op til niveau 5); byggere rejser til og reparerer dem automatisk.
4. **Opgradér basen**: Lejr → Lille landsby → Stor landsby → Slot (niveau 1–4).
5. **Overlev natten** – horder spawner fra portaler i øst og vest og angriber mure, undersåtter og dig.
6. **Udforsk verden** – lejre, ruiner, vogne og andre lokationer gemmer fjender, overlevende og loot.

### Progression
- **XP og niveauer**: Dræb fjender og byg strukturer for XP. Ved level-up vælger du en opgradering til dit aktuelle våben.
- **Våben og rustning**: Findes som loot i verden eller købes i butikken. Tryk `F` for at samle op; du kan kun bære ét våben ad gangen.
- **Trusselsniveau**: Stiger med dagene — der er ingen sejrsslutning.

### Sejr og nederlag
- **Nederlag**: Slottet ødelægges, eller spilleren dør.
- Spillet **gemmer automatisk** (localStorage) — vælg "Fortsæt" på startskærmen.

## Dev-panel (`P`)

- Injicer guld, spring til nat/dag eller dag 10/15/20
- Opgradér base, spawn specifikke fjender, slå god mode til
- Giv ethvert våben eller rustning direkte
- Juster spilhastighed (×1 / ×2 / ×4)

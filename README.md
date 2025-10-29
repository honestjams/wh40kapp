# WH40K Companion (starter)

This repository contains a small starter React + TypeScript app (Vite) that implements two features:

- List Builder: import a CSV of units (name,points,count) or add units manually
- In-game display: a swipeable card carousel to show each unit during a game

How to run (Windows PowerShell):

```powershell
npm install
npm run dev
```

Try importing a CSV with lines like:

```
Intercessor Squad,60,3
Captain,120,1
Rhino,80,1
```

Next steps:

- Persist lists to localStorage or cloud sync
- Improve CSV parsing and support other formats (BattleScribe export)
- Add unit details, weapons, and profiles
- Mobile packaging (Capacitor / React Native / Tauri)
# wh40kapp
Warhammer 40k in gameapp

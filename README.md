# MUSIK : Lecteur de musique desktop haute fidelite

Application de bureau (Windows, macOS, Linux) pour la lecture de musique locale, concue avec Tauri v2, React, TypeScript et SQLite.

---

## 1. Description du projet

MUSIK propose une experience d'ecoute moderne, fluide et entierement locale, sans compte utilisateur et sans dependance au reseau. L'application scanne et surveille vos dossiers musicaux, extrait automatiquement les metadonnees et pochettes d'album, organise votre collection et conserve l'historique et les statistiques d'ecoute sur votre appareil.

---

## 2. Fonctionnalites principales

- Gestion persistance des dossiers surveilles avec re-scan silencieux au demarrage.
- Extraction recursive des metadonnees audio (MP3, FLAC, WAV, OGG, M4A, AAC, OPUS).
- Detection et mise en cache des pochettes embarquees ou locales avec visuel de repli genere.
- Navigation complete par morceaux, albums, artistes, genres et playlists.
- Playlists intelligentes automatiques (Recemment ajoutes, Les plus ecoutes, Jamais ecoutes).
- Import et export de playlists au format standard M3U / M3U8.
- Lecteur audio haute precision : lecture aleatoire avec cycle anti-doublon, repetition 3 etats, reglage de vitesse, minuterie de mise en veille.
- Anneau de progression conique autour de la pochette active et barres d'egaliseur animees sur les pistes en cours de lecture.
- File d'attente et historique d'ecoute manipulables en temps reel.
- Recherche instantanee globale categorisee (titres, albums, artistes, playlists).
- Statistiques d'ecoute calculees exclusivement en local.
- Support des touches multimedia systeme et des raccourcis clavier.

---

## 3. Architecture technique

- Shell desktop : Tauri v2
- Frontend : React 18, TypeScript, TailwindCSS, Framer Motion, Zustand
- Backend : Rust avec SQLite embarque (rusqlite) et bibliotheque Lofty pour l'extraction de tags
- Typographie : Syne (interface et titres) et DM Mono (horodatages et donnees chiffrees)
- Palette : Mode sombre haute lisibilite (#0a0a0c, #111114, #1db954)

---

## 4. Instructions de lancement

### Prerequis
- Node.js version 18 ou superieure
- Rust et Cargo version 1.75 ou superieure

### Developpement Web
```bash
npm install
npm run dev
```

### Developpement Desktop (Tauri)
```bash
npm run tauri dev
```

### Compilation finale
```bash
npm run tauri build
```

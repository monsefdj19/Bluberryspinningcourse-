# Blueberry Spinning Course

A self-contained indoor-cycling instructor guide and five-program live training console.

## Live features

- Choose one of five approximately 45-minute programs before entering live training
- 64 ordered ride blocks with RPM, RPE, resistance, position, patterns, coaching cues, and hosted full-track music
- No folder selection: all five complete playlists are included with the website
- One Start/Pause control keeps the music and exercise timer together
- Automatic track changes for Previous, Next, exercise transitions, Reset, and restored sessions
- Program artwork, track title, artist, playback time, progress, and volume in the player
- Persistent selected-program title while teaching
- Wall-clock-based timer that reconciles after background throttling, `pageshow`, visibility changes, and window focus
- Automatic transitions, countdown tones, completion states, and next-section preview
- Wake lock, program-aware reset, saved-session migration, and persistent progress
- Keyboard-contained dialog with Escape close and focus restoration
- Responsive layouts for 320×568, 390×844, and desktop sizes
- Installable Progressive Web App with same-origin offline caching
- Downloadable instructor PDF backup

## Programs

1. Rhythm Ride — 14 tracks, 44:56
2. Rolling Hills and Recoveries — 13 tracks, 45:38
3. Dance Road — 12 tracks, 45:00
4. Throwback Power — 12 tracks, 44:58
5. Global Energy — 13 tracks, 44:54

## Built-in music

1. Open Live Ride and choose a program.
2. Press **Start music + timer**.
3. The matching full track starts automatically and changes with the exercise.

The 64 hosted files in `music/` map one-to-one to the five program plans. The exercise timer remains authoritative: shorter music loops safely until the exercise boundary, and longer music changes when the next exercise starts. The invalid first source file for Rolling Hills was replaced with the complete original `Blueberry Warm-Up` track.

## Hosting

Published with GitHub Pages from the `main` branch root. Music files are network-loaded on demand rather than included in the PWA installation cache.

This is an educational planning aid and not a substitute for recognized instructor certification, CPR/AED training, participant screening, or medical advice.

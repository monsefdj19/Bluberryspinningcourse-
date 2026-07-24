# Blueberry Spinning Course

A self-contained indoor-cycling instructor guide and five-program live training console.

## Live features

- Choose one of five approximately 45-minute programs before entering live training
- 64 ordered ride blocks with RPM, RPE, resistance, position, patterns, coaching cues, and hosted test-audio mapping
- No folder selection: generated rights-cleared test loops are included with the website
- One Start/Pause control keeps the test music and exercise timer together
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

## Test music

1. Open Live Ride and choose a program.
2. Press **Start music + timer**.
3. The matching generated loop starts automatically and changes with the exercise.

The short electronic loops in `test-audio/` were generated specifically for functional testing and contain no third-party recordings. Each loop repeats until the authoritative exercise timer advances to the next ride block. Program artwork in `test-art/` was generated for the same test release.

## Hosting

Published with GitHub Pages from the `main` branch root. Commercial audio files are intentionally excluded from the public repository and deployment. Replace the test system only with properly authorized media or an official streaming integration.

This is an educational planning aid and not a substitute for recognized instructor certification, CPR/AED training, participant screening, or medical advice.

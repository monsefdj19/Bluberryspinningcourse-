#!/usr/bin/env python3
from pathlib import Path
import json, re

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text(encoding='utf-8')
programs_js = (root / 'programs.js').read_text(encoding='utf-8') if (root / 'programs.js').exists() else ''
live_app = (root / 'live-app.js').read_text(encoding='utf-8') if (root / 'live-app.js').exists() else ''
service_worker = (root / 'service-worker.js').read_text(encoding='utf-8')
local_audio = (root / 'local-audio.js').read_text(encoding='utf-8') if (root / 'local-audio.js').exists() else ''

assert 'id="programChooser"' in html, 'program chooser is missing'
assert 'id="liveProgramTitle"' in html, 'persistent selected-program title is missing'
assert 'id="changeProgram"' not in html, 'live mode must exit before choosing another program'
assert '<script src="programs.js"></script>' in html, 'program data script is missing'
assert '<script src="local-audio.js"></script>' in html, 'local audio script is missing'
assert html.index('<script src="local-audio.js"></script>') < html.index('<script src="live-app.js"></script>')
assert all(f'id="{element}"' in html for element in ('localAudio','localCover','localAudioTitle','localAudioArtist','localAudioState','localAudioTime','localAudioBar'))
assert 'id="localAudioFiles"' not in html and 'id="chooseLocalMusic"' not in html, 'hosted test music must not ask for a folder'
assert 'id="liveSpotify"' not in html and 'id="spotifyEmbed"' not in html and 'open.spotify.com/embed/iframe-api' not in html
assert 'class="page cover home-hero"' in html and all(phrase in html for phrase in ('Pick the energy.','Press start.','Teach the room.')), 'five-program landing hero is missing'
assert html.count('data-home-program=') == 5, 'landing page must show all five programs'
assert '<em>44:58 · 13 tracks · Music included →</em>' in html, 'Program 4 landing count must match its 13-track ride'
assert 'class="guide-disclosure"' in html and '<summary>Open the complete instructor guide' in html, 'long-form guide must be organized behind one compact disclosure'
assert all(label in html for label in ('Prepare','Rehearse','Teach')) and 'class="first-visit-flow"' in html, 'first-time teaching workflow is missing'
assert 'Recommended first ride' in html and 'Climb focus' in html and 'High-energy' in html, 'ride cards must explain their distinct use cases'
assert 'First-ride preparation guide' in html and 'uses Rhythm Ride as the rehearsal example' in html, 'guide scope must be explicit'
assert 'id="printGuide"' in html and 'window.print()' in html, 'the guide must provide a real print action'
assert 'not connected to the current live console' not in html and 'Alternative ride for later' not in html, 'obsolete disconnected ride plan must be removed'
assert 'id="mobileExerciseSummary"' not in html, 'mobile live mode must not duplicate the current exercise title'
assert html.count('id="liveExercise"') == 1, 'current exercise title must render once'
assert html.count('class="prescription-icon ') == 3, 'all three instruction fields need colorful icons'
assert html.count('class="metric-icon ') == 2, 'RPM and RPE need colorful icons'
assert '65</b> music-led blocks' not in html and 'Music + coaching' in html, 'hero metrics must describe instructor value rather than internal inventory'
assert html.index('class="guide-disclosure"') < html.index('id="foundations"') < html.index('id="liveOverlay"'), 'guide disclosure must contain the long-form preparation content'
assert 'data:image/png;base64' in html and 'background-size:auto 100%;background-position:78% center' in html, 'landing must preserve the original embedded photographic cover treatment'
assert 'hero-spin.jpg' not in html and '.home-hero:before{' not in html and '.home-hero:after{' not in html, 'landing must not override the original cover image or crop'
assert '.home-hero .eyebrow{margin:0 0 14px;color:#146cff' in html and '.home-hero .display em{color:#146cff}' in html, 'home accents must retain the established blue identity'
assert '.home-primary{gap:18px;background:#146cff;color:#fff;border:1px solid #146cff}' in html, 'home CTA must retain the established blue identity'
assert 'height:clamp(500px,calc(100vh - 110px),620px);min-height:500px' in html, 'desktop hero must be compact rather than a full tall page'
assert 'min-height:150px' in html and 'min-height:92px' in html, 'program cards must stay compact on desktop and phones'
assert 'Five complete 45-minute rides with full music' in html and 'Music included' in html, 'main-page content must clearly communicate complete built-in music'
assert '<span><b>Music + coaching</b> included</span>' in html, 'hero must clarify that teaching support is included'
assert 'Built-in class music' in html and 'Full playlist' in html and 'Loading full track' in html, 'live player must present complete class music'
assert 'Temporary functional test' not in html and 'Generated audio' not in html, 'test-fixture copy must not remain in the final UI'
assert 'connect the parent <b>Spinning Audio</b> folder' not in html and 'The browser never uploads or caches the music files.' not in html, 'obsolete local-folder setup copy must be removed'
assert 'Music is built into every ride.' in html, 'guide must explain the final hosted-music setup'
assert 'Looping until the next exercise' not in live_app and 'Loading full track' in live_app, 'runtime copy must describe full tracks instead of test loops'
assert 'window.TRAINING_PROGRAMS' in programs_js, 'five-program data export is missing'
match = re.search(r'window\.TRAINING_PROGRAMS\s*=\s*(\[.*\]);\s*$', programs_js, re.S)
assert match, 'programs.js is not parseable as a JSON-backed export'
programs = json.loads(match.group(1))
assert [p['name'] for p in programs] == [
    'Rhythm Ride',
    'Rolling Hills and Recoveries',
    'Dance Road',
    'Throwback Power',
    'Global Energy',
]
assert [len(p['tracks']) for p in programs] == [14, 13, 12, 13, 13]
assert all(sum(t['seconds'] for t in p['tracks']) == p['totalSeconds'] for p in programs)
assert all('url' not in t and 'embedUrl' not in t for p in programs for t in p['tracks'])
assert all(t['audioSrc'].startswith('./music/') for p in programs for t in p['tracks'])
artwork=[f"./artwork/{p['id']}-{index:02d}.jpg" for p in programs for index,_ in enumerate(p['tracks'],1)]
assert 'songArtwork' in live_app and 'artworkSrc:songArtwork(program.id,index)' in live_app, 'runtime must map artwork per song rather than per program'
assert len(set(artwork)) == 65, 'album artwork paths must be unique per song'
assert all((root / path.removeprefix('./')).is_file() for path in artwork), 'mapped song artwork is missing'
assert all((root / path.removeprefix('./')).stat().st_size > 1000 for path in artwork), 'song artwork must contain a real image'
assert './artwork/01-01.jpg' in html and './test-art/' not in html, 'initial player fallback must use the first song cover, not obsolete shared artwork'
assert html.count('id="localAudio"') == 1 and 'local-player-foot' in html, 'song-cover fallback change must preserve the existing player markup'
assert programs[1]['tracks'][0]['title'] == 'Best Day Of My Life' and programs[1]['tracks'][0]['artist'] == 'American Authors', 'Rolling Hills must open with the newly supplied American Authors track'
assert programs[2]['tracks'][0]['title'] == 'Physical' and programs[2]['tracks'][0]['artist'] == 'Dua Lipa', 'Dance Road must open with the newly supplied Dua Lipa track'
program4=programs[3]
assert program4['totalTime'] == '44:58' and program4['totalSeconds'] == 2698
assert [(track['title'],track['artist'],track['seconds']) for track in program4['tracks']] == [
    ("Don't Stop The Music", 'Crystal Rock, CALVO & DAZZ', 223),
    ('Wake Me Up Before You Go-Go', 'Wham!', 229),
    ("Livin' la Vida Loca", 'Ricky Martin', 218),
    ('Disturbia', 'Crystal Rock, DJ Olde & Slenderino', 199),
    ('Gimme! Gimme! Gimme! (A Man After Midnight)', 'ABBA', 192),
    ("Hips Don't Lie (feat. Wyclef Jean)", 'Shakira feat. Wyclef Jean', 214),
    ('All Around The World (La La La)', 'KALUMA', 117),
    ('Sun Is Up', 'Pazoo', 192),
    ('Freed From Desire', 'Gala, Molella & Phil Jay', 209),
    ('Needle On The Record', "D'Angello & Francis", 217),
    ('Rude Boy', 'KALUMA', 226),
    ('Crazy In Love (feat. JAY-Z)', 'Beyoncé feat. JAY-Z', 232),
    ('The Days — NOTION Remix', 'Chrystal & NOTION', 230),
]
assert [track['audioSrc'] for track in program4['tracks']] == [f'./music/04-{index:02d}.mp3' for index in range(1,14)]
other_titles={re.sub(r'[^a-z0-9]+','',track['title'].casefold()) for program in programs if program['id']!='04' for track in program['tracks']}
assert not other_titles.intersection(re.sub(r'[^a-z0-9]+','',track['title'].casefold()) for track in program4['tracks']), 'Program 4 must not duplicate another program title'
assert 'Blueberry Warm-Up' not in programs_js and 'Extended Ride Mix' not in programs_js, 'replaced fallback tracks must not remain in program data'
assert len({t['audioSrc'] for p in programs for t in p['tracks']}) == 65
assert all(all(t.get(field) for field in ('title', 'artist', 'exercise', 'rpm', 'rpe', 'position', 'resistance', 'pattern', 'cue')) for p in programs for t in p['tracks'])
patterns=[t['pattern'].lower() for p in programs for t in p['tracks']]
assert not any('45 sec' in pattern for pattern in patterns)
assert not any(re.search(r'(?:[5-9]\d|\d{3,})\s*sec\s*(?:hard|quick|strong|tempo)', pattern) for pattern in patterns)
assert 'runningStartedAt' in live_app and 'Date.now()-runningStartedAt' in live_app.replace(' ', ''), 'wall-clock timer reconciliation is missing'
assert 'firstRideLiveV5' in live_app and 'firstRideLiveV4' in live_app, 'saved-session migration is missing'
assert 'version:5' in live_app, 'saved state schema version is missing'
assert 'Math.trunc(rawIndex)' in live_app and 'trackSeconds-1' in live_app and 'Number.isFinite(rawOffset)' in live_app, 'legacy index/offset clamps are missing'
assert "if(!saved||typeof saved!=='object')" in live_app and 'safeStore' in live_app, 'storage failure guards are missing'
assert 'Spotify' not in live_app and 'spotify' not in live_app, 'Spotify runtime must be removed'
assert 'LocalAudio.createController' in live_app and '.sync(' in live_app and '.setSources(' in live_app, 'hosted audio synchronization is missing'
assert '.prepareBoundary(' in live_app and '.setVolume(' in live_app, 'smooth exercise-boundary audio transition is missing'
assert 'tone(720' not in live_app and 'tone(980' not in live_app, 'song switches must not add an artificial transition tick'
assert 'Number(options.fadeOutSeconds)||3' in local_audio and 'Number(options.fadeInMs)||2000' in local_audio, 'song switches must use the longer smooth fade defaults'
assert 'audio.loop=false' in local_audio and '%duration' not in local_audio, 'songs must never loop or wrap to fill an exercise window'
assert 'if(switching)audio.volume=0;audio.pause()' in local_audio, 'the outgoing deck must reach silence before it is paused or replaced'
assert "if(!ready){running=false" not in live_app, 'audio playback failure must not prevent the authoritative exercise timer from starting'
assert 'setSources' in local_audio and 'createController' in local_audio
assert "overlay.setAttribute('aria-label','Choose a training program')" in live_app, 'chooser dialog label is not restored'
assert "addEventListener('pageshow'" in live_app, 'pageshow reconciliation is missing'
assert 'if(response.ok&&!isMusic)' in service_worker and 'await cache.put' in service_worker, 'service worker must cache successful app assets while leaving large music network-loaded'
assert './local-audio.js' in service_worker, 'local audio runtime must be cached'
assert './hero-spin.jpg' not in service_worker, 'removed replacement cover must not block service-worker installation'
assert "first-ride-live-v27" in service_worker, 'Tabler mobile icon set must ship under a fresh service-worker cache'
assert './test-art/' not in service_worker, 'obsolete shared program artwork must not remain in the app shell'
print('five-program static contract: PASS')

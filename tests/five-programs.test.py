#!/usr/bin/env python3
from pathlib import Path
import json, re

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text(encoding='utf-8')
programs_js = (root / 'programs.js').read_text(encoding='utf-8') if (root / 'programs.js').exists() else ''
live_app = (root / 'live-app.js').read_text(encoding='utf-8') if (root / 'live-app.js').exists() else ''
service_worker = (root / 'service-worker.js').read_text(encoding='utf-8')

assert 'id="programChooser"' in html, 'program chooser is missing'
assert 'id="liveProgramTitle"' in html, 'persistent selected-program title is missing'
assert 'id="changeProgram"' in html, 'change-program control is missing'
assert '<script src="programs.js"></script>' in html, 'program data script is missing'
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
assert [len(p['tracks']) for p in programs] == [14, 13, 12, 12, 13]
assert all(sum(t['seconds'] for t in p['tracks']) == p['totalSeconds'] for p in programs)
assert all(t['url'].startswith('https://open.spotify.com/') for p in programs for t in p['tracks'])
assert all(all(t.get(field) for field in ('title', 'artist', 'exercise', 'rpm', 'rpe', 'position', 'resistance', 'pattern', 'cue')) for p in programs for t in p['tracks'])
patterns=[t['pattern'].lower() for p in programs for t in p['tracks']]
assert not any('45 sec' in pattern for pattern in patterns)
assert not any(re.search(r'(?:[5-9]\d|\d{3,})\s*sec\s*(?:hard|quick|strong|tempo)', pattern) for pattern in patterns)
assert 'runningStartedAt' in live_app and 'Date.now()-runningStartedAt' in live_app.replace(' ', ''), 'wall-clock timer reconciliation is missing'
assert 'firstRideLiveV5' in live_app and 'firstRideLiveV4' in live_app, 'saved-session migration is missing'
assert 'version:5' in live_app, 'saved state schema version is missing'
assert 'Math.trunc(rawIndex)' in live_app and 'trackSeconds-1' in live_app and 'Number.isFinite(rawOffset)' in live_app, 'legacy index/offset clamps are missing'
assert "if(!saved||typeof saved!=='object')" in live_app and 'safeStore' in live_app, 'storage failure guards are missing'
assert 'spotifyController.play()' not in live_app and 'spotifyController.pause()' not in live_app, 'timer must not control Spotify playback'
assert "overlay.setAttribute('aria-label','Choose a training program')" in live_app, 'chooser dialog label is not restored'
assert "addEventListener('pageshow'" in live_app, 'pageshow reconciliation is missing'
assert 'if(response.ok)' in service_worker and 'await cache.put' in service_worker, 'service worker must only await-cache successful responses'
print('five-program static contract: PASS')

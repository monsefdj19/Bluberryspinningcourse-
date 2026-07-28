#!/usr/bin/env python3
from pathlib import Path
import json, re, subprocess

root=Path(__file__).resolve().parents[1]
program_text=(root/'programs.js').read_text()
programs=json.loads(program_text.split('=',1)[1].rsplit(';',1)[0])
mapped=[root/track['audioSrc'].removeprefix('./') for program in programs for track in program['tracks']]
files=sorted((root/'music').glob('*.mp3'))
assert len(mapped)==64 and len(files)==64, f'expected 64 complete music tracks, found {len(files)}'
assert set(mapped)==set(files), 'program music mapping and hosted files must match exactly'
for file in files:
    probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(file)],capture_output=True,text=True,check=True)
    duration=float(json.loads(probe.stdout)['format']['duration'])
    assert duration>=90, f'{file.name} is not a complete track ({duration:.1f}s)'
    if file.name=='03-01.mp3': assert duration>=165, f'{file.name} extended ride mix must cover the full 166-second block'
    assert file.stat().st_size<100*1024*1024, f'{file.name} exceeds the GitHub single-file limit'
    run=subprocess.run(['ffmpeg','-hide_banner','-i',str(file),'-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True)
    mean=re.search(r'mean_volume:\s*(-?[0-9.]+) dB',run.stderr)
    peak=re.search(r'max_volume:\s*(-?[0-9.]+) dB',run.stderr)
    assert mean and peak, f'could not measure {file.name}'
    mean_db=float(mean.group(1));peak_db=float(peak.group(1))
    assert mean_db>=-28, f'{file.name} is effectively inaudible at {mean_db} dB mean'
    assert peak_db<=0.1, f'{file.name} clips at {peak_db} dB peak'
print('complete-music inventory and loudness contract: PASS')

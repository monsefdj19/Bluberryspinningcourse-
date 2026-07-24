#!/usr/bin/env python3
from pathlib import Path
import re, subprocess

root=Path(__file__).resolve().parents[1]
files=sorted((root/'test-audio').glob('*.mp3'))
assert len(files)==64, f'expected 64 generated test tracks, found {len(files)}'
for file in files:
    run=subprocess.run(['ffmpeg','-hide_banner','-i',str(file),'-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True)
    mean=re.search(r'mean_volume:\s*(-?[0-9.]+) dB',run.stderr)
    peak=re.search(r'max_volume:\s*(-?[0-9.]+) dB',run.stderr)
    assert mean and peak, f'could not measure {file.name}'
    mean_db=float(mean.group(1));peak_db=float(peak.group(1))
    assert mean_db>=-22, f'{file.name} is effectively inaudible at {mean_db} dB mean'
    assert peak_db<=-0.5, f'{file.name} clips or lacks headroom at {peak_db} dB peak'
print('generated-audio loudness contract: PASS')

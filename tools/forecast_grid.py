#!/usr/bin/env python3
"""يجيب توقع المطر لشبكة نقاط تغطي السعودية وما حولها من Open-Meteo،
ويكتب ملف fc.json يقرأه «اخايله» ويرسمه على الخريطة.
الشبكة كل نص درجة (تقريباً 55 كم). يحترم حد Open-Meteo المجاني: دفعات صغيرة مع انتظار."""
import json, time, urllib.request, urllib.parse, datetime, sys

LAT0, LAT1, LON0, LON1, STEP = 16.0, 32.5, 34.5, 56.0, 0.5
HOURS = 36          # كم ساعة جاية نحفظها بالساعة
CHUNK, PAUSE = 100, 11

lats = [round(LAT1 - i*STEP, 3) for i in range(int((LAT1-LAT0)/STEP)+1)]   # من الشمال للجنوب
lons = [round(LON0 + j*STEP, 3) for j in range(int((LON1-LON0)/STEP)+1)]
pts = [(la, lo) for la in lats for lo in lons]
ny, nx = len(lats), len(lons)
print(f'grid {nx}x{ny} = {len(pts)} points', flush=True)

hourly = [None]*len(pts); daily = [None]*len(pts); t0 = None; days = None
for c in range(0, len(pts), CHUNK):
    part = pts[c:c+CHUNK]
    q = urllib.parse.urlencode({
        'latitude': ','.join(str(p[0]) for p in part), 'longitude': ','.join(str(p[1]) for p in part),
        'hourly': 'precipitation', 'daily': 'precipitation_sum', 'forecast_days': 7, 'timezone': 'UTC', 'precipitation_unit': 'mm'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen('https://api.open-meteo.com/v1/forecast?' + q, timeout=60) as r:
                data = json.load(r)
            break
        except Exception as e:
            print('retry', c, e, flush=True); time.sleep(20*(attempt+1))
    else:
        sys.exit('Open-Meteo failed')
    if isinstance(data, dict): data = [data]
    for k, d in enumerate(data):
        h = d['hourly']
        if t0 is None:
            now = datetime.datetime.now(datetime.timezone.utc).replace(minute=0, second=0, microsecond=0)
            times = h['time']
            # أول ساعة = الساعة الحالية
            t0i = next((i for i, t in enumerate(times) if datetime.datetime.fromisoformat(t).replace(tzinfo=datetime.timezone.utc) >= now), 0)
            t0 = times[t0i]; days = d['daily']['time']
        i0 = h['time'].index(t0)
        hourly[c+k] = [round(v or 0, 1) for v in h['precipitation'][i0:i0+HOURS]]
        daily[c+k] = [round(v or 0, 1) for v in d['daily']['precipitation_sum']]
    print(f'{c+len(part)}/{len(pts)}', flush=True)
    time.sleep(PAUSE)

out = {'v': 1, 'made': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
       'start': t0 + 'Z', 'days': days, 'step': STEP, 'lat0': LAT1, 'lon0': LON0, 'nx': nx, 'ny': ny,
       # ترتيب النقاط: صف صف من الشمال، وكل صف من الغرب للشرق
       'h': hourly, 'd': daily, 'src': 'Open-Meteo (best match)'}
with open('fc.json', 'w') as f: json.dump(out, f, separators=(',', ':'))
print('written', flush=True)

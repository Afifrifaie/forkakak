#!/usr/bin/env python3
"""
Procedural soundtrack for the 15 s reel (numpy only).

128 BPM  ->  32 beats == 15.000 s  ->  8 bars, one per scene.
Everything is placed on the same beat grid the visuals use, plus a few
hand-synced events (UI click in scene 5, letter-by-letter wordmark bells).

usage: python3 synth.py out.wav
"""
import sys
import numpy as np
import wave

SR = 44100
DUR = 15.0
N = int(SR * DUR)
BPM = 128
BEAT = 60.0 / BPM
BAR = 4 * BEAT
S5_START = 4 * BAR      # scene 5 downbeat
S5_CLICK = 1.42         # mirrors S5_CLICK in js/scenes_b.js
rng = np.random.default_rng(2026)


# ----------------------------------------------------------------- utils
def midi(n):
    return 440.0 * 2 ** ((np.asarray(n, dtype=float) - 69) / 12)


def fft_filter(x, lo=None, hi=None, order=4):
    """zero-phase butterworth-ish band limit"""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-9)) ** (2 * order))
    if hi:
        g *= 1 / np.sqrt(1 + (np.maximum(f, 1e-9) / hi) ** (2 * order))
    return np.fft.irfft(X * g, len(x))


def band_noise(n, lo=None, hi=None):
    x = rng.standard_normal(n)
    x = fft_filter(x, lo, hi)
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-9)


def sweep_noise(dur, f0, f1, bw=1.6, curve=1.0):
    """noise through a band-pass whose centre glides f0 -> f1 (STFT overlap-add)"""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    F, hop = 2048, 512
    win = np.hanning(F)
    freqs = np.fft.rfftfreq(F, 1 / SR)
    lf = np.log2(freqs + 1e-9)
    out = np.zeros(n + F)
    for i in range(0, n, hop):
        seg = x[i:i + F]
        if len(seg) < F:
            seg = np.pad(seg, (0, F - len(seg)))
        p = min(1.0, (i + F / 2) / n)
        fc = f0 * (f1 / f0) ** (p ** curve)
        g = np.exp(-0.5 * ((lf - np.log2(fc)) / (bw / 2)) ** 2)
        out[i:i + F] += np.fft.irfft(np.fft.rfft(seg * win) * g, F)
    y = out[:n] / 2
    return y / (np.sqrt(np.mean(y ** 2)) + 1e-9)


def fade(n, a=0.002, r=0.004):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def bus():
    return np.zeros((2, N))


def put(b, sig, t0, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= N or i0 + len(sig) <= 0:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    a = (pan + 1) * np.pi / 4
    b[0, i0:i0 + n] += sig[:n] * np.cos(a) * gain
    b[1, i0:i0 + n] += sig[:n] * np.sin(a) * gain


def play(b, sig, t0, pan=0.0, gain=1.0, rv=0.0):
    put(b, sig, t0, pan, gain)
    if rv:
        put(REVSEND, sig, t0, pan, gain * rv)


# --------------------------------------------------------------- buses
DRUMS, MUSIC, FX, REVSEND = bus(), bus(), bus(), bus()

# ----------------------------------------------------------- instruments
def kick(vol=1.0):
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    f = 46 + 125 * np.exp(-t * 30)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.8)
    y += rng.standard_normal(n) * np.exp(-t * 900) * 0.22
    y = np.tanh(1.9 * y) * vol
    y *= fade(n, 0.0012, 0.01)
    return y


def clap(vol=1.0):
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    nz = band_noise(n, 900, 3200)
    env = sum(np.exp(-np.clip(t - o, 0, None) * d) * (t >= o) for o, d in ((0, 160), (0.011, 160), (0.022, 160), (0.034, 22)))
    return nz * env * 0.5 * vol * fade(n, 0.0005, 0.02)


def hat(vol=1.0, open_=False):
    d = 0.2 if open_ else 0.035
    n = int((d * 5 + 0.01) * SR)
    t = np.arange(n) / SR
    y = band_noise(n, 7000, 15000) * np.exp(-t / d)
    return y * vol * 0.35 * fade(n, 0.0004, 0.004)


def snare(vol=1.0):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    y = band_noise(n, 1500, 9000) * np.exp(-t * 22) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * 0.5
    return y * vol * fade(n, 0.0005, 0.01)


def saw(f, t, fc, K=None):
    """band-limited saw with a (time-varying) low-pass magnitude"""
    f = float(f)
    K = K or int(min(36, 14000 / f))
    y = np.zeros_like(t)
    for k in range(1, K + 1):
        y += np.sin(2 * np.pi * k * f * t) / k / np.sqrt(1 + (k * f / fc) ** 4)
    return y


def bass(f, dur=0.34, cut=900.0, wob=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fc = cut * (1 + wob * np.sin(2 * np.pi * (BPM / 60 * 2) * t)) * (0.6 + 0.4 * np.exp(-t / 0.08)) + 120
    y = 0.75 * np.sin(2 * np.pi * f * t) + 0.55 * saw(f, t, fc, 22)
    return np.tanh(1.3 * y) * np.exp(-t / 0.22) * fade(n, 0.003, 0.03) * 0.7


def pluck(f, dur=0.3, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fc = 450 + 5200 * bright * np.exp(-t / 0.07)
    y = 0.5 * (saw(f * 2 ** (-7 / 1200), t, fc) + saw(f * 2 ** (7 / 1200), t, fc))
    return y * np.exp(-t / 0.12) * fade(n, 0.002, 0.02) * 0.5


def pad(freqs, dur, cutoff=2400.0, atk=0.35, rel=0.6):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for c in (-13, 0, 13):
            y += saw(f * 2 ** (c / 1200), t, cutoff, int(min(24, 9000 / f)))
    env = np.minimum(1, t / atk) ** 2 * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 4)))
    return y * env * 0.16 / len(freqs) ** 0.5


def stab(freqs, dur=0.32, cut=5000.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fc = 700 + cut * np.exp(-t / 0.06)
    y = sum(saw(f, t, fc) for f in freqs)
    return y * np.exp(-t / 0.13) * fade(n, 0.002, 0.02) * 0.2


def bell(f, dur=1.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.0)
         + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6.5)
         + 0.22 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12))
    return y * fade(n, 0.001, 0.05) * 0.35


def tick(f=2200.0):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 140) + band_noise(n, 3000, 12000) * np.exp(-t * 300) * 0.4
    return y * 0.3 * fade(n, 0.0004, 0.004)


def boom(vol=1.0, tail=1.6):
    n = int(tail * SR)
    t = np.arange(n) / SR
    f = 34 + 70 * np.exp(-t * 9)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.9)
    y += band_noise(n, 60, 1200) * np.exp(-t * 6) * 0.25
    return np.tanh(1.4 * y) * vol * fade(n, 0.002, 0.2)


def crash(vol=1.0, dur=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = band_noise(n, 3500, 16000) * np.exp(-t / (dur / 4))
    return y * vol * 0.3 * fade(n, 0.002, 0.1)


def riser(dur, f0=250.0, f1=9000.0, vol=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sweep_noise(dur, f0, f1, 1.8, 0.9) * (t / dur) ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(180 * (6.0 ** (t / dur))) / SR) * (t / dur) ** 2.5 * 0.18
    return (y * 0.45 + tone) * vol * fade(n, 0.01, 0.006)


def whoosh(dur=0.55, f0=500.0, f1=5500.0, vol=1.0, peak=0.7):
    n = int(dur * SR)
    p = np.arange(n) / n
    env = np.where(p < peak, (p / peak) ** 1.8, ((1 - p) / (1 - peak)) ** 1.5)
    return sweep_noise(dur, f0, f1, 2.0) * env * 0.4 * vol


def glitch(t0, width=0.3, count=10, vol=1.0):
    for _ in range(count):
        s = t0 + (rng.random() - 0.5) * width
        n = int((0.008 + rng.random() * 0.03) * SR)
        lo = rng.choice([800, 1800, 3500, 6000])
        y = band_noise(n, lo, lo * 2.2)
        step = int(rng.choice([4, 9, 17]))                  # crude bit-/sample-rate crush
        y = np.repeat(y[::step], step)[:n]
        y = np.sign(y) * np.abs(y) ** 0.6 * fade(n, 0.0003, 0.002)
        play(FX, y, s, pan=rng.uniform(-0.9, 0.9), gain=0.16 * vol, rv=0.15)


# --------------------------------------------------------------- score
CHORDS = [  # (pad voicing, bass root, arp pool)   one per bar / scene
    ([57, 60, 64], 33, [69, 72, 76, 81]),        # Am
    ([53, 57, 60], 29, [65, 69, 72, 77]),        # F
    ([55, 60, 64], 36, [72, 76, 79, 84]),        # C
    ([55, 59, 62], 31, [67, 71, 74, 79]),        # G
    ([57, 60, 64], 33, [69, 72, 76, 81]),        # Am
    ([53, 57, 60], 29, [65, 69, 72, 77]),        # F
    ([55, 59, 62], 31, [67, 71, 74, 79]),        # G
    ([57, 60, 64, 67, 71], 33, [69, 72, 76, 81]),  # Am9 (finale)
]
FINAL_B = 28    # beat index of the finale downbeat

# ---- drums -------------------------------------------------------------
kick_times = []
for b in range(0, FINAL_B):
    t0 = b * BEAT
    kick_times.append(t0)
    play(DRUMS, kick(1.0 if b % 4 == 0 else 0.92), t0, gain=0.95)
kick_times.append(FINAL_B * BEAT)
play(DRUMS, kick(1.15), FINAL_B * BEAT, gain=0.95)

for b in range(0, FINAL_B):
    off = (b + 0.5) * BEAT
    play(DRUMS, hat(0.9 if b % 2 else 0.75), off, pan=0.25, gain=0.5, rv=0.08)
    if b >= 8:
        for sub, v in ((0.25, 0.4), (0.75, 0.5)):
            play(DRUMS, hat(v), (b + sub) * BEAT, pan=-0.2, gain=0.5)
    if b % 4 == 3:
        play(DRUMS, hat(1.0, open_=True), off, pan=0.3, gain=0.45, rv=0.1)
    if b >= 4 and b % 4 in (1, 3) and b < 26:
        play(DRUMS, clap(1.0), b * BEAT, gain=0.8, rv=0.28)

# snare roll into the finale (beats 26 -> 28), accelerating
roll_t = 26 * BEAT
step = BEAT / 4
while roll_t < FINAL_B * BEAT - 1e-6:
    p = (roll_t - 26 * BEAT) / (2 * BEAT)
    play(DRUMS, snare(0.25 + 0.75 * p), roll_t, pan=0.0, gain=0.55, rv=0.18)
    step = BEAT / 4 if roll_t < 27 * BEAT else BEAT / 8
    roll_t += step

# ---- bass (off-beat 8ths) -----------------------------------------------
for b in range(2, FINAL_B):
    bar = b // 4
    root = CHORDS[bar][1]
    j = b % 4
    for sub in (0.5, 0.75 if j == 3 else None):
        if sub is None:
            continue
        note = root + (12 if (j == 3 and sub == 0.75) else 0)
        wob = 0.6 if bar == 3 else 0.0
        play(MUSIC, bass(float(midi(note)), 0.3, 900 + 300 * (bar >= 4), wob), (b + sub) * BEAT, gain=0.9)

# ---- pad: one chord per bar ---------------------------------------------
for bar in range(7):
    notes = CHORDS[bar][0]
    cutoff = [1000, 1500, 2000, 2400, 2600, 2800, 3000][bar]
    play(MUSIC, pad([float(midi(n)) for n in notes], BAR + 0.12, cutoff, atk=0.25), bar * BAR - 0.06, pan=0.0, gain=0.5, rv=0.35)
    play(MUSIC, pad([float(midi(notes[0] - 12))], BAR + 0.1, 700, atk=0.1), bar * BAR - 0.03, gain=0.5)
# finale chord: bright, immediate, rings out
fin = CHORDS[7][0]
play(MUSIC, pad([float(midi(n)) for n in fin], BAR - 0.05, 4200, atk=0.04, rel=0.4), FINAL_B * BEAT - 0.01, gain=0.75, rv=0.5)
play(MUSIC, pad([float(midi(33 - 12)), float(midi(33))], BAR, 600, atk=0.02), FINAL_B * BEAT, gain=1.1)

# ---- arp (16ths from bar 2 until the finale) ----------------------------
PAT = [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 3, 2, 1, 2]
for b in range(8, FINAL_B):
    pool = CHORDS[b // 4][2]
    for s in range(4):
        step_i = (b % 4) * 4 + s
        note = pool[PAT[step_i]] + (12 if b >= 16 and step_i % 8 == 7 else 0)
        acc = 1.0 if s == 0 else 0.7
        play(MUSIC, pluck(float(midi(note)), 0.3, 1.0 if b >= 16 else 0.7), (b + s / 4) * BEAT,
             pan=-0.45 if (step_i % 2) else 0.45, gain=0.6 * acc, rv=0.3)

# ---- word stabs, beats 24..27 (TYPE / SHAPE / LIGHT / RHYTHM) --------------
stab_notes = [[69, 72, 76], [72, 76, 79], [74, 77, 81], [76, 79, 83]]
for k, ch in enumerate(stab_notes):
    f = [float(midi(n)) for n in ch]
    play(MUSIC, stab(f, 0.34, 5200), (24 + k) * BEAT, gain=1.0, rv=0.3)
    play(MUSIC, stab(f, 0.2, 3500), (24 + k + 0.75) * BEAT, gain=0.6, pan=0.3, rv=0.3)

# ---- FX: risers, whooshes, impacts, glitches ------------------------------
play(FX, riser(2 * BEAT, 300, 8000, 1.0), 10 * BEAT, gain=0.55, rv=0.25)
play(FX, riser(2 * BEAT, 300, 8500, 1.0), 14 * BEAT, gain=0.5, rv=0.25)
play(FX, riser(2 * BEAT, 400, 9000, 1.0), 22 * BEAT, gain=0.5, rv=0.25)
play(FX, riser(4 * BEAT, 200, 11000, 1.0), 24 * BEAT, gain=0.7, rv=0.3)

whoosh_set = {1: (400, 3500, 0.7), 2: (700, 7000, 0.7), 3: (300, 9000, 0.8), 4: (500, 4500, 0.9),
              5: (900, 8000, 0.7), 6: (600, 6000, 0.6)}
for i, (f0, f1, v) in whoosh_set.items():
    play(FX, whoosh(0.55, f0, f1, 1.0), i * BAR - 0.4, gain=v * 0.55, pan=0.0, rv=0.2)
play(FX, whoosh(0.5, 8000, 300, 1.0), 7 * BAR - 0.18, gain=0.5, rv=0.3)   # iris-close sucks inward
play(FX, boom(1.0, 1.6), 0.26, gain=0.7)                                  # slit opens
play(FX, whoosh(0.34, 700, 7000), 0.0, gain=0.35)                         # line draws
for i, (v, c) in {1: (0.5, 0.0), 2: (0.55, 0.5), 3: (0.8, 0.9), 4: (0.55, 0.6), 5: (0.5, 0.5), 6: (0.55, 0.5)}.items():
    play(FX, boom(v, 1.2), i * BAR - 0.02, gain=0.6)
    if c:
        play(FX, crash(c, 1.4), i * BAR - 0.02, gain=0.55, rv=0.25)
glitch(2 * BAR, 0.38, 12, 1.0)
glitch(5 * BAR, 0.38, 12, 1.0)
glitch(6 * BAR, 0.38, 14, 1.0)
glitch(3 * BAR, 0.2, 5, 0.6)

# the big one
play(FX, boom(1.4, 2.4), FINAL_B * BEAT, gain=0.9, rv=0.2)
play(FX, crash(1.0, 2.6), FINAL_B * BEAT, gain=0.8, rv=0.35)

# type ticks while S1 letters rise (MOTION 0.38.., DESIGN 0.62..)
for i in range(6):
    play(FX, tick(1800 + 160 * i), 0.38 + 0.05 * i, gain=0.8, pan=-0.3)
    play(FX, tick(1500 + 160 * i), 0.62 + 0.05 * i, gain=0.7, pan=0.3)
play(FX, bell(float(midi(81)), 0.9), 0.55, gain=0.35, rv=0.4)          # spark pops in

# ---- S5: UI foley ---------------------------------------------------------
pent = [69, 72, 74, 76, 79, 81, 84]
for i, n in enumerate(pent):                                              # bars growing
    play(MUSIC, bell(float(midi(n + 12)), 0.7), S5_START + 0.31 + 0.3 + i * 0.06, gain=0.5, pan=0.4, rv=0.35)
for i in range(4):                                                        # donut segments
    play(FX, tick(2600 + 300 * i), S5_START + 0.15 + 0.2 + i * 0.1, gain=0.6, pan=-0.4)
click_t = S5_START + S5_CLICK
n = int(0.03 * SR)
t = np.arange(n) / SR
clk = (np.sin(2 * np.pi * 1300 * t) * np.exp(-t * 180) + band_noise(n, 2000, 9000) * np.exp(-t * 400) * 0.5) * fade(n, 0.0003, 0.003)
play(FX, clk, click_t, gain=0.9)
play(MUSIC, bell(float(midi(88)), 1.0), click_t + 0.05, gain=0.55, rv=0.4)   # tooltip pops
play(MUSIC, bell(float(midi(93)), 0.8), click_t + 0.09, gain=0.35, rv=0.4)

# ---- finale: sparkle run, wordmark bells, tagline --------------------------
sp = [69, 72, 76, 79, 83, 88, 91, 95, 100]
for i, nn in enumerate(sp):
    play(MUSIC, bell(float(midi(nn)), 1.5), FINAL_B * BEAT + 0.04 + i * (BEAT / 8), gain=0.5, pan=-0.6 + 1.2 * i / (len(sp) - 1), rv=0.45)
word_notes = [81, 84, 86, 88, 91, 93]
for i, nn in enumerate(word_notes):                                       # C L A U D E
    play(MUSIC, bell(float(midi(nn)), 1.2), FINAL_B * BEAT + 0.62 + i * 0.045, gain=0.5, pan=-0.3 + 0.12 * i, rv=0.45)
for i, nn in enumerate([88, 91, 93, 96]):                                 # tagline
    play(MUSIC, bell(float(midi(nn)), 1.3), FINAL_B * BEAT + 1.05 + i * 0.07, gain=0.38, pan=0.3 - 0.2 * i, rv=0.5)

# ------------------------------------------------------------- mixdown
duck = np.ones(N)
tt = np.arange(int(0.6 * SR)) / SR
shape = 1 - 0.68 * np.exp(-tt / 0.11) * np.minimum(1, tt / 0.004 + 0.0) + 0.0
shape[0] = 1 - 0.68
for tk in kick_times:
    i0 = int(tk * SR)
    n = min(len(shape), N - i0)
    if n > 0:
        duck[i0:i0 + n] = np.minimum(duck[i0:i0 + n], shape[:n])
MUSIC *= duck

# reverb
def ir(seed, sec=1.9, decay=0.5):
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t / decay) * (1 - np.exp(-t / 0.012))
    x = fft_filter(x, 180, 6500)
    return x / np.sqrt(np.sum(x ** 2))

size = 1 << int(np.ceil(np.log2(N + int(1.9 * SR))))
wet = np.zeros((2, N))
for ch, seed in ((0, 11), (1, 12)):
    # cross-feed L/R sends so the tail is wide
    src = REVSEND[ch] * 0.75 + REVSEND[1 - ch] * 0.25
    wet[ch] = np.fft.irfft(np.fft.rfft(src, size) * np.fft.rfft(ir(seed), size), size)[:N]

master = DRUMS * 0.9 + MUSIC * 1.0 + FX * 0.95 + wet * 0.55
master = np.array([fft_filter(master[0], 28), fft_filter(master[1], 28)])
# fade out together with the picture
fo = int(0.45 * SR)
master[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5
master[:, :int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))


def limit(x, th=0.7):
    """soft-knee limiter: transparent below th, asymptotes at 1.0"""
    a = np.abs(x)
    y = x.copy()
    o = a > th
    y[o] = np.sign(x[o]) * (th + (1 - th) * np.tanh((a[o] - th) / (1 - th)))
    return y


def write_wav(path, m):
    pcm = (np.clip(m.T, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def measure(path):
    import subprocess, re
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    summ = r[r.rindex('Summary:'):]
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', summ).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summ).group(1))


out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
TARGET = -14.0
CEIL = 10 ** (-2.4 / 20)             # leave true-peak headroom
g = 0.45 / np.max(np.abs(master))     # starting point
for it in range(6):
    final = limit(master * g) * CEIL
    write_wav(out, final)
    lufs, tp = measure(out)
    print(f'  pass {it}: gain {20 * np.log10(g):+.1f} dB -> {lufs:.1f} LUFS, true peak {tp:+.1f} dBFS')
    if abs(lufs - TARGET) < 0.3:
        break
    g *= 10 ** ((TARGET - lufs) / 20)
print(f'wrote {out}  {N / SR:.2f}s  {lufs:.1f} LUFS  true peak {tp:+.1f} dBFS')

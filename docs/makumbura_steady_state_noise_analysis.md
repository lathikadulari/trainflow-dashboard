# Makumbura Steady-State Sensor Analysis

Date: 2026-03-15

## 1) Objective
This document summarizes the steady-state data from the real-time analyzer and explains:
- how the calculations are done,
- what the measured values mean,
- and what conclusions we can make for filtering and detection.

## 2) Data Source
Input stream used:
- Sensor A and Sensor B
- X and Z axes
- Window size: 200 samples
- Sample rate: 10 Hz
- Window duration: 20 seconds

From analyzer output, each report includes:
- mean (g)
- RMS (g)
- standard deviation (g)
- peak-to-peak (g)
- dominant frequency (Hz)

## 3) Calculation Method
For a signal x with N samples:

Mean:
mean = (1/N) * sum(x_i)

RMS:
rms = sqrt((1/N) * sum(x_i^2))

Standard deviation:
std = sqrt((1/N) * sum((x_i - mean)^2))

Peak-to-peak:
p2p = max(x_i) - min(x_i)

Dominant frequency:
- Computed from the spectral peak of the current window.
- With fs = 10 Hz and N = 200, frequency-bin resolution is:
  df = fs / N = 10 / 200 = 0.05 Hz
- So nearby values such as 0.25, 0.30, 0.35 Hz are expected neighboring bins.

## 4) Observed Steady-State Ranges
### Sensor A
X-axis (steady range seen in log):
- mean: about 0.1306 to 0.1317 g
- std: about 0.0022 to 0.0026 g
- p2p: about 0.0075 to 0.0091 g
- dominant frequency: mostly 0.30 Hz (sometimes 0.25 to 0.35 Hz)

Z-axis (steady range seen in log):
- mean: about 0.9590 to 0.9601 g
- std: about 0.0028 to 0.0033 g
- p2p: about 0.0112 to 0.0138 g
- dominant frequency: mostly 0.30 to 0.35 Hz (occasional neighboring bins)

### Sensor B
X-axis (steady range seen in log):
- mean: about 1.0723 to 1.0738 g
- std: about 0.0028 to 0.0031 g
- p2p: about 0.0091 to 0.0112 g
- dominant frequency: mostly 0.30 to 0.35 Hz

Z-axis (steady range seen in log):
- mean: about -0.0246 to -0.0238 g
- std: about 0.0022 to 0.0032 g
- p2p: about 0.0113 to 0.0150 g
- dominant frequency: mostly 0.25 to 0.35 Hz

## 5) What These Numbers Mean
1. Baseline noise floor is low.
- Typical std is around 0.0022 to 0.0033 g (2.2 to 3.3 mg).

2. Signal is in steady state.
- Means are stable over time.
- p2p variation remains small and bounded.

3. Dominant low-frequency drift exists near 0.30 Hz.
- This is likely slow drift/environmental movement rather than train vibration.
- The 0.25/0.30/0.35 switching is normal due to 0.05 Hz FFT bin steps.

## 6) Recommended Baseline Thresholds (from this run)
Use these as initial trigger values for event detection:

Per-axis warning threshold (std):
- warning if std > 0.006 g

Per-axis event threshold (std):
- event if std > 0.009 g

Peak-to-peak event support:
- event support if p2p > 0.020 g

Rationale:
- Baseline std is about 0.003 g.
- Warning near 2x baseline, event near 3x baseline is a practical first pass.

## 7) Filter Guidance from This Baseline
If the goal is smoother display only:
- Use low-pass cutoff around 0.8 to 1.0 Hz.

If the goal is train-event detection (remove slow drift):
- Use high-pass cutoff around 0.4 to 0.5 Hz before feature extraction.

If both are needed:
- Keep two paths:
  - display path: low-pass,
  - detection path: high-pass + thresholding.

## 8) Final Conclusion
From this steady-state dataset:
- The system is stable.
- Baseline noise is small (mg-level).
- The strongest recurring component is a low-frequency drift around 0.30 Hz.
- This dataset is suitable as a baseline reference for future train-event comparisons and threshold tuning.

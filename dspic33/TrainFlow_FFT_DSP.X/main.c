/*
 * ============================================================================
 *  TRAINFLOW DSP MODULE — dsPIC33CK256MP502-I/SS
 *  Real-Time FFT + Train Direction Detection
 * ============================================================================
 *
 *  PURPOSE:
 *    Offload real-time FFT computation and direction detection from the
 *    ESP32/server to a dedicated DSP chip. The dsPIC reads raw analog
 *    vibration data from two ADXL335 accelerometers, computes 256-point
 *    FFT on each axis, detects vibration onset on each sensor, and
 *    determines train travel direction from onset timing.
 *
 *  HARDWARE:
 *    MCU:   dsPIC33CK256MP502-I/SS  (100 MIPS, DSP engine)
 *    ADC:   Internal 12-bit SAR ADC (up to 3.25 Msps shared)
 *    UART:  TX results to ESP32 at 115200 baud
 *
 *  PIN ASSIGNMENTS:
 *    RA0 / AN0  → Sensor 1 X-axis (ADXL335 XOUT)
 *    RA1 / AN1  → Sensor 1 Z-axis (ADXL335 ZOUT)
 *    RB0 / AN2  → Sensor 2 X-axis (ADXL335 XOUT)
 *    RB1 / AN3  → Sensor 2 Z-axis (ADXL335 ZOUT)
 *    RB7        → UART1 TX (to ESP32 RX)
 *    RB8        → UART1 RX (from ESP32 TX) [optional commands]
 *    RB15       → LED heartbeat indicator
 *
 *  DATA FLOW:
 *    ADXL335 analog → dsPIC ADC → Hanning window → 256-pt Radix-2 FFT
 *    → Peak extraction → Direction vote → UART JSON to ESP32
 *
 *  SAMPLE RATE:
 *    Timer1 ISR at 500 Hz (2 ms period) for each sensor pair.
 *    FFT computed every 256 samples (0.512 s window at 500 Hz).
 *
 *  UART OUTPUT FORMAT (JSON, newline-delimited):
 *    FFT result:
 *      {"type":"fft","sensor":1,"axis":"x","peaks":[{"hz":12.5,"mag":0.45},...],"rms":0.12}
 *    Direction result:
 *      {"type":"dir","direction":"left_to_right","confidence":85,
 *       "delay_ms":42,"first":"sensor1","method":"combined_rms"}
 *    Heartbeat (every 2s):
 *      {"type":"hb","uptime":12345,"s1_samples":6000,"s2_samples":6000}
 *
 *  BUILD:
 *    MPLAB X IDE + XC16 Compiler v2.10+
 *    Include DSP library: libdsp-elf.a
 *    Linker: p33CK256MP502.gld
 *
 *  LIBRARIES:
 *    - XC16 DSP Library (FFTComplexIP, TwidFactorInit, BitReverseComplex)
 *
 * ============================================================================
 */

/* ── Configuration Bits ─────────────────────────────────────────────────────── */
// FSEC
#pragma config BWRP = OFF               // Boot Segment Write-Protect: disabled
#pragma config BSS = DISABLED           // Boot Segment Code-Protect: disabled
#pragma config BSEN = OFF               // Boot Segment Control: disabled
#pragma config GWRP = OFF               // General Segment Write-Protect: disabled
#pragma config GSS = DISABLED           // General Segment Code-Protect: disabled
#pragma config CWRP = OFF               // Configuration Segment Write-Protect: disabled
#pragma config CSS = DISABLED           // Configuration Segment Code-Protect: disabled
#pragma config APTS = OFF               // Application Segment Programming disable

// FOSCSEL
#pragma config FNOSC = FRC              // Initial Oscillator Source: FRC (8 MHz)
#pragma config IESO = OFF               // Two-speed Oscillator Start-up: disabled

// FOSC
#pragma config POSCMD = NONE            // Primary Oscillator Mode: disabled
#pragma config OSCIOFNC = ON            // OSC2 Pin Function: digital I/O
#pragma config FCKSM = CSECMD           // Clock Switching: enabled, Fail-Safe: disabled
#pragma config PLLKEN = ON              // PLL Lock Enable: on

// FWDT
#pragma config WDTPOST = PS32768        // Watchdog Timer Postscaler
#pragma config WDTPRE = PR128           // Watchdog Timer Prescaler
#pragma config WDTEN = OFF              // Watchdog Timer Enable: disabled
#pragma config WINDIS = OFF             // Watchdog Timer Window: disabled

// FPOR
#pragma config BOREN = ON               // Brown-out Reset: enabled

// FICD
#pragma config ICS = PGD2              // ICD Communication Channel: PGD2
#pragma config JTAGEN = OFF            // JTAG: disabled
#pragma config BTSWP = OFF             // Boot/General segment swap: disabled

/* ── Includes ───────────────────────────────────────────────────────────────── */
#include <xc.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <stdio.h>
#include <math.h>
#include <dsp.h>           /* XC16 DSP library: FFT, twiddle factors, etc. */
#include <libpic30.h>      /* __delay_ms, __delay32 */

/* ── Clock Configuration ────────────────────────────────────────────────────── */
/*
 * FRC = 8 MHz
 * PLL: 8 MHz / 1 (PLLPRE) * 100 (PLLDIV) / 2 (PLLPOST) = 200 MHz Fvco
 * Fosc = 200 MHz, Fcy = Fosc/2 = 100 MHz (100 MIPS)
 */
#define FCY 100000000UL     /* Instruction cycle frequency for __delay_ms */

/* ── FFT Configuration ──────────────────────────────────────────────────────── */
#define FFT_SIZE        256             /* Must be power of 2 */
#define LOG2_FFT_SIZE   8               /* log2(256) = 8 */
#define SAMPLE_RATE_HZ  500             /* ADC sample rate per sensor */
#define FFT_BIN_HZ      ((float)SAMPLE_RATE_HZ / FFT_SIZE)  /* 1.953 Hz/bin */
#define NUM_PEAKS       5               /* Top-N FFT peaks to report */
#define NYQUIST_BIN     (FFT_SIZE / 2)  /* 128 bins usable */

/* ── ADC Channels ───────────────────────────────────────────────────────────── */
#define ADC_CH_S1_X     0   /* AN0: Sensor 1 X-axis */
#define ADC_CH_S1_Z     1   /* AN1: Sensor 1 Z-axis */
#define ADC_CH_S2_X     2   /* AN2: Sensor 2 X-axis */
#define ADC_CH_S2_Z     3   /* AN3: Sensor 2 Z-axis */

/* ── ADXL335 Calibration ───────────────────────────────────────────────────── */
#define SUPPLY_VOLTAGE      3.3f
#define ADC_RESOLUTION      4096.0f     /* 12-bit ADC */
#define ZERO_G_VOLTAGE      (SUPPLY_VOLTAGE / 2.0f)   /* 1.65 V at 0g */
#define SENSITIVITY_V_PER_G 0.300f      /* 300 mV/g for ADXL335 */

/* ── Direction Detection Thresholds ─────────────────────────────────────────── */
#define VIBRATION_THRESHOLD_G   0.08f   /* Combined magnitude threshold */
#define CONSECUTIVE_REQUIRED    3       /* Consecutive above-threshold for onset */
#define RMS_WINDOW_SAMPLES      50      /* ~100 ms at 500 Hz */
#define COMBINED_RMS_THRESHOLD  0.08f   /* RMS onset threshold */
#define BASELINE_SAMPLES_MIN    100     /* Minimum samples before detection */
#define BASELINE_EMA_ALPHA      0.02f   /* EMA smoothing for baseline */

/* ── LED / Heartbeat ────────────────────────────────────────────────────────── */
#define LED_TRIS    TRISBbits.TRISB15
#define LED_LAT     LATBbits.LATB15

/* ── UART Configuration ─────────────────────────────────────────────────────── */
#define UART_BAUD   115200UL
#define UART_BRG    ((FCY / (16UL * UART_BAUD)) - 1)   /* Standard baud rate */

/* ── Global Buffers (DSP library uses fractional Q15 format) ────────────────── */

/* Twiddle factor table for 256-point FFT (in program memory for speed) */
fractcomplex __attribute__((space(ymemory), aligned(FFT_SIZE * 2 * 2)))
    twiddleFactors[FFT_SIZE / 2];

/*
 * FFT input/output buffers — interleaved complex format [Re, Im, Re, Im, ...]
 * We have 4 channels: S1_X, S1_Z, S2_X, S2_Z
 * Each buffer holds FFT_SIZE complex pairs = FFT_SIZE * 2 fractional words
 */
fractcomplex __attribute__((space(ymemory), aligned(FFT_SIZE * 2 * 2)))
    fftBuffer[FFT_SIZE];

/* Raw ADC sample buffers (float, for direction detection + pre-FFT windowing) */
static float s1_x_buf[FFT_SIZE];
static float s1_z_buf[FFT_SIZE];
static float s2_x_buf[FFT_SIZE];
static float s2_z_buf[FFT_SIZE];

/* Hanning window coefficients (precomputed at init) */
static float hanningWindow[FFT_SIZE];

/* Sample buffer write index */
static volatile uint16_t sampleIndex = 0;
static volatile bool     fftReady    = false;   /* Set when 256 samples collected */

/* ── Direction Detection State ──────────────────────────────────────────────── */
typedef struct {
    float xMean;
    float zMean;
    uint16_t samples;
} Baseline;

typedef struct {
    /* Baselines */
    Baseline s1_baseline;
    Baseline s2_baseline;

    /* Vibration onset tracking */
    bool vibrationDetected;
    uint16_t s1_consecutive;
    uint16_t s2_consecutive;
    bool s1_onset;
    bool s2_onset;
    uint32_t s1_onset_tick;     /* Timer tick when S1 triggered */
    uint32_t s2_onset_tick;     /* Timer tick when S2 triggered */

    /* Rolling RMS buffers */
    float s1_rms_buf[RMS_WINDOW_SAMPLES];
    float s2_rms_buf[RMS_WINDOW_SAMPLES];
    uint16_t rms_idx;
    bool s1_rms_onset;
    bool s2_rms_onset;
    uint32_t s1_rms_onset_tick;
    uint32_t s2_rms_onset_tick;

    /* Direction result */
    bool directionDetermined;
    char direction[20];         /* "left_to_right" or "right_to_left" */
    uint8_t confidence;
    int32_t delay_ms;
    char firstSensor[10];       /* "sensor1" or "sensor2" */
} DirectionState;

static DirectionState dirState;

/* ── Timing ─────────────────────────────────────────────────────────────────── */
static volatile uint32_t systemTick = 0;    /* Incremented at 500 Hz by Timer1 ISR */
static volatile uint32_t uptimeSeconds = 0;
static uint32_t lastHeartbeatTick = 0;

/* ── UART TX Buffer ─────────────────────────────────────────────────────────── */
#define UART_TX_BUF_SIZE  512
static char uartTxBuf[UART_TX_BUF_SIZE];

/* ── FFT Result Storage ─────────────────────────────────────────────────────── */
typedef struct {
    float frequency;
    float magnitude;
} FFTPeak;

typedef struct {
    FFTPeak peaks[NUM_PEAKS];
    float rms;
    uint8_t numPeaks;
} FFTResult;

/* ═══════════════════════════════════════════════════════════════════════════════
 * FUNCTION PROTOTYPES
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initClock(void);
static void initPorts(void);
static void initUART1(void);
static void initADC(void);
static void initTimer1(void);
static void initHanningWindow(void);
static void initTwiddleFactors(void);
static void resetDirectionState(void);

static uint16_t readADC(uint8_t channel);
static float    adcToG(uint16_t raw);
static void     uartSendString(const char *str);
static void     uartSendChar(char c);

static void     processFFT(const float *samples, FFTResult *result);
static void     updateDirection(float s1_x, float s1_z, float s2_x, float s2_z);
static void     sendFFTResult(uint8_t sensorNum, const char *axis, const FFTResult *result);
static void     sendDirectionResult(void);
static void     sendHeartbeat(void);

/* ═══════════════════════════════════════════════════════════════════════════════
 * CLOCK INITIALIZATION — FRC + PLL → 100 MIPS
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initClock(void) {
    /*
     * dsPIC33CK PLL configuration:
     * Fin = 8 MHz (FRC)
     * Fvco = Fin * M / N1 = 8 * 100 / 2 = 400 MHz
     * Fosc = Fvco / N2 / N3 = 400 / 2 / 1 = 200 MHz
     * Fcy = Fosc / 2 = 100 MHz
     */
    CLKDIVbits.PLLPRE  = 0;     /* N1 = 2 (PLL prescaler) */
    PLLFBDbits.PLLFBDIV = 100;  /* M = 100 (PLL feedback divider) */
    PLLDIVbits.POST1DIV = 2;    /* N2 = 2 (PLL postscaler 1) */
    PLLDIVbits.POST2DIV = 1;    /* N3 = 1 (PLL postscaler 2) */

    /* Initiate clock switch to FRC with PLL */
    __builtin_write_OSCCONH(0x01);  /* New oscillator = FRC with PLL */
    __builtin_write_OSCCONL(OSCCON | 0x01);  /* Request switch */

    /* Wait for PLL to lock */
    while (OSCCONbits.OSWEN != 0);
    while (OSCCONbits.LOCK != 1);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * PORT INITIALIZATION
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initPorts(void) {
    /* All analog pins as input (AN0-AN3) */
    TRISAbits.TRISA0 = 1;  /* AN0 - S1 X */
    TRISAbits.TRISA1 = 1;  /* AN1 - S1 Z */
    TRISBbits.TRISB0 = 1;  /* AN2 - S2 X */
    TRISBbits.TRISB1 = 1;  /* AN3 - S2 Z */

    /* Configure as analog */
    ANSELAbits.ANSELA0 = 1;
    ANSELAbits.ANSELA1 = 1;
    ANSELBbits.ANSELB0 = 1;
    ANSELBbits.ANSELB1 = 1;

    /* LED output */
    LED_TRIS = 0;
    LED_LAT  = 0;

    /* UART1 TX on RB7 (via PPS) */
    TRISBbits.TRISB7 = 0;      /* TX = output */
    TRISBbits.TRISB8 = 1;      /* RX = input */
    ANSELBbits.ANSELB7 = 0;    /* Digital */
    ANSELBbits.ANSELB8 = 0;    /* Digital */

    /* PPS: Map UART1 TX → RB7, UART1 RX → RB8 */
    __builtin_write_RPCON(0x0000);  /* Unlock PPS */
    RPOR3bits.RP39R = 1;            /* RB7 (RP39) → U1TX */
    RPINR18bits.U1RXR = 40;        /* RB8 (RP40) → U1RX */
    __builtin_write_RPCON(0x0800);  /* Lock PPS */
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * UART1 INITIALIZATION — 115200 baud, 8N1
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initUART1(void) {
    U1MODEbits.UARTEN = 0;     /* Disable during config */
    U1MODEbits.BRGH  = 0;      /* Standard speed mode (16x) */
    U1BRG = UART_BRG;          /* Baud rate generator value */
    U1MODEbits.PDSEL = 0;      /* 8-bit, no parity */
    U1MODEbits.STSEL = 0;      /* 1 stop bit */
    U1STAbits.UTXEN  = 1;      /* Enable transmitter */
    U1MODEbits.UARTEN = 1;     /* Enable UART */
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * ADC INITIALIZATION — 12-bit, manual sampling, channels AN0-AN3
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initADC(void) {
    /* ADC Core Configuration */
    ADCON1Lbits.ADON = 0;           /* ADC off during config */

    ADCON1Hbits.SHRRES = 0b11;     /* Shared core: 12-bit resolution */
    ADCON1Hbits.FORM   = 0;        /* Integer format (0 .. 4095) */

    ADCON2Lbits.SHRADCS = 0;      /* Shared ADC clock divider (Tad = Tcy) */
    ADCON2Hbits.SHRSAMC = 15;     /* Shared core sample time: 15 Tad */

    ADCON3Hbits.SHREN  = 1;       /* Enable shared core */
    ADCON3Lbits.REFSEL = 0;       /* AVdd / AVss reference */

    /* Configure channels as shared-core inputs */
    ADCON4Lbits.SAMC0EN = 0;      /* AN0 uses shared core */
    ADCON4Lbits.SAMC1EN = 0;      /* AN1 uses shared core */
    /* AN2, AN3 default to shared core */

    /* Set all 4 channels to unsigned integer, single-ended */
    ADMOD0Lbits.SIGN0 = 0;  ADMOD0Lbits.DIFF0 = 0;
    ADMOD0Lbits.SIGN1 = 0;  ADMOD0Lbits.DIFF1 = 0;
    ADMOD0Lbits.SIGN2 = 0;  ADMOD0Lbits.DIFF2 = 0;
    ADMOD0Lbits.SIGN3 = 0;  ADMOD0Lbits.DIFF3 = 0;

    /* Enable ADC */
    ADCON1Lbits.ADON = 1;

    /* Wait for ADC to be ready */
    while (!ADCON5Lbits.SHRDY);
    ADCON3Hbits.SHREN = 1;         /* Confirm shared core enabled */
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * TIMER1 — 500 Hz sample rate ISR
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initTimer1(void) {
    T1CONbits.TON  = 0;         /* Timer off during config */
    T1CONbits.TCKPS = 0b01;    /* Prescaler 1:8 */
    T1CONbits.TCS  = 0;        /* Internal clock (Fcy) */
    /*
     * Period = Fcy / (prescaler * desired_freq) - 1
     * = 100,000,000 / (8 * 500) - 1 = 24999
     */
    PR1 = 24999;
    TMR1 = 0;
    IPC0bits.T1IP = 5;         /* Priority 5 (high) */
    IFS0bits.T1IF = 0;         /* Clear flag */
    IEC0bits.T1IE = 1;         /* Enable interrupt */
    T1CONbits.TON = 1;         /* Start timer */
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * HANNING WINDOW — Precompute coefficients
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initHanningWindow(void) {
    uint16_t i;
    for (i = 0; i < FFT_SIZE; i++) {
        /* w[n] = 0.5 * (1 - cos(2*pi*n / (N-1))) */
        hanningWindow[i] = 0.5f * (1.0f - cosf(2.0f * M_PI * (float)i / (float)(FFT_SIZE - 1)));
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * TWIDDLE FACTORS — Init for DSP library FFT
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void initTwiddleFactors(void) {
    TwidFactorInit(LOG2_FFT_SIZE, &twiddleFactors[0], 0);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * ADC READ — Manual trigger, single channel
 * ═══════════════════════════════════════════════════════════════════════════════ */
static uint16_t readADC(uint8_t channel) {
    /* Select channel and trigger conversion */
    ADCON3Lbits.CNVCHSEL = channel;     /* Select shared-core input channel */
    ADCON3Lbits.CNVRTCH  = 1;          /* Trigger shared-core conversion */

    /* Wait for conversion complete */
    while (!ADSTATLbits.AN0RDY && channel == 0);
    while (!ADSTATLbits.AN1RDY && channel == 1);
    while (!ADSTATLbits.AN2RDY && channel == 2);
    while (!ADSTATLbits.AN3RDY && channel == 3);

    /* Read result from the appropriate buffer */
    switch (channel) {
        case 0: return ADCBUF0;
        case 1: return ADCBUF1;
        case 2: return ADCBUF2;
        case 3: return ADCBUF3;
        default: return 0;
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * ADC VALUE TO g-FORCE
 * ═══════════════════════════════════════════════════════════════════════════════ */
static float adcToG(uint16_t raw) {
    float voltage = ((float)raw / ADC_RESOLUTION) * SUPPLY_VOLTAGE;
    return (voltage - ZERO_G_VOLTAGE) / SENSITIVITY_V_PER_G;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * UART HELPERS
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void uartSendChar(char c) {
    while (U1STAbits.UTXBF);    /* Wait if TX buffer full */
    U1TXREG = c;
}

static void uartSendString(const char *str) {
    while (*str) {
        uartSendChar(*str++);
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * DIRECTION DETECTION STATE RESET
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void resetDirectionState(void) {
    memset(&dirState, 0, sizeof(DirectionState));
    dirState.s1_baseline.xMean = 0.0f;
    dirState.s1_baseline.zMean = -1.05f;  /* Approx 1g downward at rest */
    dirState.s2_baseline.xMean = 0.0f;
    dirState.s2_baseline.zMean = -1.05f;
    strcpy(dirState.direction, "unknown");
    strcpy(dirState.firstSensor, "none");
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * PROCESS FFT — Apply window, convert to Q15, run FFT, extract peaks
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void processFFT(const float *samples, FFTResult *result) {
    uint16_t i;
    float maxVal = 0.0f;
    float rmsSum = 0.0f;

    /* ── Step 1: Remove DC offset (mean subtraction) ──────────────────────── */
    float mean = 0.0f;
    for (i = 0; i < FFT_SIZE; i++) {
        mean += samples[i];
    }
    mean /= (float)FFT_SIZE;

    /* ── Step 2: Apply Hanning window + convert to Q1.15 fractional ──────── */
    for (i = 0; i < FFT_SIZE; i++) {
        float windowed = (samples[i] - mean) * hanningWindow[i];

        /* Clamp to [-1, +1) for Q15 conversion */
        if (windowed > 0.999f)  windowed = 0.999f;
        if (windowed < -1.0f)   windowed = -1.0f;

        /* Convert float to Q15: multiply by 32767 */
        fftBuffer[i].real = Float2Fract(windowed);
        fftBuffer[i].imag = 0;  /* Imaginary = 0 for real input */

        rmsSum += windowed * windowed;
    }

    result->rms = sqrtf(rmsSum / (float)FFT_SIZE);

    /* ── Step 3: Perform in-place Radix-2 FFT ─────────────────────────────── */
    FFTComplexIP(LOG2_FFT_SIZE, &fftBuffer[0], &twiddleFactors[0], COEFFS_IN_DATA);

    /* ── Step 4: Bit-reverse the output ───────────────────────────────────── */
    BitReverseComplex(LOG2_FFT_SIZE, &fftBuffer[0]);

    /* ── Step 5: Compute magnitude spectrum (first half only: DC to Nyquist) */
    float magnitudes[NYQUIST_BIN];
    for (i = 0; i < NYQUIST_BIN; i++) {
        float re = Fract2Float(fftBuffer[i].real);
        float im = Fract2Float(fftBuffer[i].imag);
        magnitudes[i] = sqrtf(re * re + im * im);
    }

    /* ── Step 6: Extract top-N peaks (skip DC bin 0, skip bins < 1 Hz) ──── */
    /* Minimum bin index for ~1 Hz = ceil(1.0 / FFT_BIN_HZ) = 1 */
    uint16_t minBin = 1;

    result->numPeaks = 0;
    for (i = 0; i < NUM_PEAKS; i++) {
        result->peaks[i].frequency  = 0.0f;
        result->peaks[i].magnitude  = 0.0f;
    }

    /* Simple iterative peak extraction (find max, zero it, repeat) */
    float magCopy[NYQUIST_BIN];
    memcpy(magCopy, magnitudes, sizeof(magnitudes));

    uint8_t peakCount = 0;
    while (peakCount < NUM_PEAKS) {
        uint16_t maxIdx = minBin;
        float maxMag = 0.0f;

        for (i = minBin; i < NYQUIST_BIN; i++) {
            if (magCopy[i] > maxMag) {
                maxMag = magCopy[i];
                maxIdx = i;
            }
        }

        if (maxMag < 0.001f) break;     /* No more significant peaks */

        result->peaks[peakCount].frequency = (float)maxIdx * FFT_BIN_HZ;
        result->peaks[peakCount].magnitude = maxMag;
        peakCount++;

        /* Zero out the peak and its neighbors to avoid sidelobes */
        int16_t lo = (int16_t)maxIdx - 2;
        int16_t hi = (int16_t)maxIdx + 2;
        if (lo < (int16_t)minBin) lo = minBin;
        if (hi >= NYQUIST_BIN) hi = NYQUIST_BIN - 1;
        for (i = lo; i <= hi; i++) {
            magCopy[i] = 0.0f;
        }
    }
    result->numPeaks = peakCount;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * DIRECTION DETECTION UPDATE — Called every sample (500 Hz)
 *
 * Mirrors the server-side DirectionDetector V2 algorithm:
 *   1. Baseline EMA update during quiet periods
 *   2. Combined magnitude onset detection (consecutive threshold)
 *   3. Rolling RMS onset detection
 *   4. Weighted voting for direction determination
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void updateDirection(float s1_x, float s1_z, float s2_x, float s2_z) {
    if (dirState.directionDetermined) return;   /* Already decided */

    /* ── Compute combined deviations ──────────────────────────────────────── */
    float s1_xDev = fabsf(s1_x - dirState.s1_baseline.xMean);
    float s1_zDev = fabsf(s1_z - dirState.s1_baseline.zMean);
    float s1_mag  = sqrtf(s1_xDev * s1_xDev + s1_zDev * s1_zDev);

    float s2_xDev = fabsf(s2_x - dirState.s2_baseline.xMean);
    float s2_zDev = fabsf(s2_z - dirState.s2_baseline.zMean);
    float s2_mag  = sqrtf(s2_xDev * s2_xDev + s2_zDev * s2_zDev);

    /* ── Phase 1: Baseline update (quiet periods only) ────────────────────── */
    if (!dirState.vibrationDetected) {
        /* Update S1 baseline */
        if (dirState.s1_baseline.samples < BASELINE_SAMPLES_MIN) {
            dirState.s1_baseline.xMean = (dirState.s1_baseline.xMean * dirState.s1_baseline.samples + s1_x)
                                          / (dirState.s1_baseline.samples + 1);
            dirState.s1_baseline.zMean = (dirState.s1_baseline.zMean * dirState.s1_baseline.samples + s1_z)
                                          / (dirState.s1_baseline.samples + 1);
        } else {
            dirState.s1_baseline.xMean = dirState.s1_baseline.xMean * (1.0f - BASELINE_EMA_ALPHA)
                                         + s1_x * BASELINE_EMA_ALPHA;
            dirState.s1_baseline.zMean = dirState.s1_baseline.zMean * (1.0f - BASELINE_EMA_ALPHA)
                                         + s1_z * BASELINE_EMA_ALPHA;
        }
        dirState.s1_baseline.samples++;

        /* Update S2 baseline */
        if (dirState.s2_baseline.samples < BASELINE_SAMPLES_MIN) {
            dirState.s2_baseline.xMean = (dirState.s2_baseline.xMean * dirState.s2_baseline.samples + s2_x)
                                          / (dirState.s2_baseline.samples + 1);
            dirState.s2_baseline.zMean = (dirState.s2_baseline.zMean * dirState.s2_baseline.samples + s2_z)
                                          / (dirState.s2_baseline.samples + 1);
        } else {
            dirState.s2_baseline.xMean = dirState.s2_baseline.xMean * (1.0f - BASELINE_EMA_ALPHA)
                                         + s2_x * BASELINE_EMA_ALPHA;
            dirState.s2_baseline.zMean = dirState.s2_baseline.zMean * (1.0f - BASELINE_EMA_ALPHA)
                                         + s2_z * BASELINE_EMA_ALPHA;
        }
        dirState.s2_baseline.samples++;

        /* Check for vibration start */
        bool enoughBaseline = (dirState.s1_baseline.samples >= BASELINE_SAMPLES_MIN) &&
                              (dirState.s2_baseline.samples >= BASELINE_SAMPLES_MIN);
        if (enoughBaseline && (s1_mag > VIBRATION_THRESHOLD_G || s2_mag > VIBRATION_THRESHOLD_G)) {
            dirState.vibrationDetected = true;
        }
        return;
    }

    /* ── Phase 2: Combined magnitude onset (consecutive threshold) ────────── */
    if (s1_mag > VIBRATION_THRESHOLD_G) {
        dirState.s1_consecutive++;
        if (dirState.s1_consecutive >= CONSECUTIVE_REQUIRED && !dirState.s1_onset) {
            dirState.s1_onset = true;
            dirState.s1_onset_tick = systemTick;
        }
    } else {
        dirState.s1_consecutive = 0;
    }

    if (s2_mag > VIBRATION_THRESHOLD_G) {
        dirState.s2_consecutive++;
        if (dirState.s2_consecutive >= CONSECUTIVE_REQUIRED && !dirState.s2_onset) {
            dirState.s2_onset = true;
            dirState.s2_onset_tick = systemTick;
        }
    } else {
        dirState.s2_consecutive = 0;
    }

    /* ── Phase 3: Rolling RMS onset ───────────────────────────────────────── */
    uint16_t rmsIdx = dirState.rms_idx % RMS_WINDOW_SAMPLES;
    dirState.s1_rms_buf[rmsIdx] = s1_mag * s1_mag;
    dirState.s2_rms_buf[rmsIdx] = s2_mag * s2_mag;
    dirState.rms_idx++;

    uint16_t rmsCount = (dirState.rms_idx < RMS_WINDOW_SAMPLES) ?
                         dirState.rms_idx : RMS_WINDOW_SAMPLES;
    if (rmsCount >= 3) {
        float s1_rmsSum = 0.0f, s2_rmsSum = 0.0f;
        uint16_t j;
        for (j = 0; j < rmsCount; j++) {
            s1_rmsSum += dirState.s1_rms_buf[j];
            s2_rmsSum += dirState.s2_rms_buf[j];
        }
        float s1_rms = sqrtf(s1_rmsSum / (float)rmsCount);
        float s2_rms = sqrtf(s2_rmsSum / (float)rmsCount);

        if (s1_rms > COMBINED_RMS_THRESHOLD && !dirState.s1_rms_onset) {
            dirState.s1_rms_onset = true;
            dirState.s1_rms_onset_tick = systemTick;
        }
        if (s2_rms > COMBINED_RMS_THRESHOLD && !dirState.s2_rms_onset) {
            dirState.s2_rms_onset = true;
            dirState.s2_rms_onset_tick = systemTick;
        }
    }

    /* ── Phase 4: Determine direction (weighted voting) ───────────────────── */
    bool hasCombinedRms = dirState.s1_rms_onset && dirState.s2_rms_onset;
    bool hasMagOnset    = dirState.s1_onset && dirState.s2_onset;

    if (hasCombinedRms || hasMagOnset) {
        int16_t votesLeft  = 0;
        int16_t votesRight = 0;

        /* Method 1: Combined RMS onset timing (weight 4 — most reliable) */
        if (hasCombinedRms) {
            int32_t delta = (int32_t)dirState.s1_rms_onset_tick - (int32_t)dirState.s2_rms_onset_tick;
            if (delta < 0) votesRight += 4;  /* S1 (right rail) triggered first */
            else           votesLeft  += 4;  /* S2 (left rail) triggered first */
        }

        /* Method 2: Combined magnitude onset timing (weight 2) */
        if (hasMagOnset) {
            int32_t delta = (int32_t)dirState.s1_onset_tick - (int32_t)dirState.s2_onset_tick;
            if (delta < 0) votesRight += 2;
            else           votesLeft  += 2;
        }

        /* Determine direction */
        int16_t totalVotes = votesLeft + votesRight;
        if (votesLeft > votesRight) {
            strcpy(dirState.direction, "left_to_right");
            strcpy(dirState.firstSensor, "sensor2");
        } else {
            strcpy(dirState.direction, "right_to_left");
            strcpy(dirState.firstSensor, "sensor1");
        }

        /* Confidence: proportional to vote margin */
        dirState.confidence = (totalVotes > 0) ?
            (uint8_t)(((uint32_t)abs(votesLeft - votesRight) * 100) / totalVotes) : 0;

        /* Propagation delay in ms (from RMS onset if available, else mag onset) */
        if (hasCombinedRms) {
            int32_t delta = (int32_t)dirState.s1_rms_onset_tick - (int32_t)dirState.s2_rms_onset_tick;
            /* Each tick = 2 ms (500 Hz) */
            dirState.delay_ms = (delta < 0 ? -delta : delta) * 2;
        } else if (hasMagOnset) {
            int32_t delta = (int32_t)dirState.s1_onset_tick - (int32_t)dirState.s2_onset_tick;
            dirState.delay_ms = (delta < 0 ? -delta : delta) * 2;
        }

        dirState.directionDetermined = true;
        sendDirectionResult();
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * UART OUTPUT — JSON-formatted results
 * ═══════════════════════════════════════════════════════════════════════════════ */
static void sendFFTResult(uint8_t sensorNum, const char *axis, const FFTResult *result) {
    int len;
    uint8_t i;

    /* Build peaks array string */
    char peaksBuf[200] = "[";
    for (i = 0; i < result->numPeaks; i++) {
        char entry[50];
        snprintf(entry, sizeof(entry), "%s{\"hz\":%.1f,\"mag\":%.3f}",
                 (i > 0) ? "," : "",
                 (double)result->peaks[i].frequency,
                 (double)result->peaks[i].magnitude);
        strncat(peaksBuf, entry, sizeof(peaksBuf) - strlen(peaksBuf) - 1);
    }
    strncat(peaksBuf, "]", sizeof(peaksBuf) - strlen(peaksBuf) - 1);

    len = snprintf(uartTxBuf, UART_TX_BUF_SIZE,
        "{\"type\":\"fft\",\"sensor\":%u,\"axis\":\"%s\","
        "\"peaks\":%s,\"rms\":%.4f}\n",
        sensorNum, axis, peaksBuf, (double)result->rms);

    if (len > 0 && len < UART_TX_BUF_SIZE) {
        uartSendString(uartTxBuf);
    }
}

static void sendDirectionResult(void) {
    int len = snprintf(uartTxBuf, UART_TX_BUF_SIZE,
        "{\"type\":\"dir\",\"direction\":\"%s\",\"confidence\":%u,"
        "\"delay_ms\":%ld,\"first\":\"%s\",\"method\":\"combined_rms\"}\n",
        dirState.direction, dirState.confidence,
        dirState.delay_ms, dirState.firstSensor);

    if (len > 0 && len < UART_TX_BUF_SIZE) {
        uartSendString(uartTxBuf);
    }
}

static void sendHeartbeat(void) {
    int len = snprintf(uartTxBuf, UART_TX_BUF_SIZE,
        "{\"type\":\"hb\",\"uptime\":%lu,\"s1_bl\":%u,\"s2_bl\":%u,"
        "\"vib\":%s,\"dir_det\":%s}\n",
        uptimeSeconds,
        dirState.s1_baseline.samples,
        dirState.s2_baseline.samples,
        dirState.vibrationDetected ? "true" : "false",
        dirState.directionDetermined ? "true" : "false");

    if (len > 0 && len < UART_TX_BUF_SIZE) {
        uartSendString(uartTxBuf);
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * TIMER1 ISR — 500 Hz ADC Sampling
 *
 * Reads all 4 ADC channels, stores in circular buffers, updates direction
 * detection, and sets fftReady flag every FFT_SIZE samples.
 * ═══════════════════════════════════════════════════════════════════════════════ */
void __attribute__((__interrupt__, auto_psv)) _T1Interrupt(void) {
    IFS0bits.T1IF = 0;     /* Clear interrupt flag */
    systemTick++;

    /* Update uptime (500 ticks = 1 second) */
    if ((systemTick % 500) == 0) {
        uptimeSeconds++;
    }

    /* If previous FFT not yet processed, skip (backpressure) */
    if (fftReady) return;

    /* ── Read all 4 ADC channels ──────────────────────────────────────────── */
    uint16_t raw_s1_x = readADC(ADC_CH_S1_X);
    uint16_t raw_s1_z = readADC(ADC_CH_S1_Z);
    uint16_t raw_s2_x = readADC(ADC_CH_S2_X);
    uint16_t raw_s2_z = readADC(ADC_CH_S2_Z);

    /* Convert to g-force */
    float g_s1_x = adcToG(raw_s1_x);
    float g_s1_z = adcToG(raw_s1_z);
    float g_s2_x = adcToG(raw_s2_x);
    float g_s2_z = adcToG(raw_s2_z);

    /* Store in sample buffers */
    s1_x_buf[sampleIndex] = g_s1_x;
    s1_z_buf[sampleIndex] = g_s1_z;
    s2_x_buf[sampleIndex] = g_s2_x;
    s2_z_buf[sampleIndex] = g_s2_z;

    /* ── Direction detection runs at full 500 Hz rate ─────────────────────── */
    updateDirection(g_s1_x, g_s1_z, g_s2_x, g_s2_z);

    sampleIndex++;
    if (sampleIndex >= FFT_SIZE) {
        sampleIndex = 0;
        fftReady = true;    /* Signal main loop to compute FFT */
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * MAIN
 * ═══════════════════════════════════════════════════════════════════════════════ */
int main(void) {

    /* ── System initialization ────────────────────────────────────────────── */
    initClock();
    initPorts();
    initUART1();
    initADC();
    initHanningWindow();
    initTwiddleFactors();
    resetDirectionState();

    /* ── Startup banner ───────────────────────────────────────────────────── */
    uartSendString("\n========================================\n");
    uartSendString("  TrainFlow DSP Module v1.0\n");
    uartSendString("  dsPIC33CK256MP502 | 100 MIPS\n");
    uartSendString("  FFT: 256-pt @ 500 Hz | Direction V2\n");
    uartSendString("========================================\n\n");

    /* ── Start sampling ───────────────────────────────────────────────────── */
    initTimer1();   /* Begin Timer1 ISR → ADC sampling at 500 Hz */

    LED_LAT = 1;    /* LED on = running */

    /* ── FFT result storage ───────────────────────────────────────────────── */
    FFTResult result_s1_x, result_s1_z, result_s2_x, result_s2_z;

    /* ── Main loop ────────────────────────────────────────────────────────── */
    while (1) {

        /* ── Process FFT when 256 samples are ready ───────────────────────── */
        if (fftReady) {

            /* Compute FFT for all 4 channels */
            processFFT(s1_x_buf, &result_s1_x);
            processFFT(s1_z_buf, &result_s1_z);
            processFFT(s2_x_buf, &result_s2_x);
            processFFT(s2_z_buf, &result_s2_z);

            /* Send FFT results over UART (only if significant signal) */
            if (result_s1_x.rms > 0.005f) sendFFTResult(1, "x", &result_s1_x);
            if (result_s1_z.rms > 0.005f) sendFFTResult(1, "z", &result_s1_z);
            if (result_s2_x.rms > 0.005f) sendFFTResult(2, "x", &result_s2_x);
            if (result_s2_z.rms > 0.005f) sendFFTResult(2, "z", &result_s2_z);

            /* Toggle LED to show processing activity */
            LED_LAT ^= 1;

            fftReady = false;   /* Ready for next window */
        }

        /* ── Heartbeat every 1000 ticks (2 seconds) ───────────────────────── */
        if (systemTick - lastHeartbeatTick >= 1000) {
            lastHeartbeatTick = systemTick;
            sendHeartbeat();
        }

        /* ── Reset direction after quiet period (30s no vibration = new event) */
        if (dirState.directionDetermined && !dirState.vibrationDetected) {
            /* Check if we've been quiet for 15000 ticks (30 seconds) */
            uint32_t ticksSinceDirection = systemTick -
                (dirState.s1_rms_onset_tick > dirState.s2_rms_onset_tick ?
                 dirState.s1_rms_onset_tick : dirState.s2_rms_onset_tick);
            if (ticksSinceDirection > 15000) {
                resetDirectionState();
                uartSendString("{\"type\":\"dir_reset\"}\n");
            }
        }
    }

    return 0;   /* Never reached */
}

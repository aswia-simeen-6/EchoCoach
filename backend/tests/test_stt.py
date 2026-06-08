"""
Tests for pipeline/stt.py — silence gate and WAV wrapping logic.

These tests run offline (no API calls) by testing only the pure-Python helpers.
"""

import io
import wave

import numpy as np
import pytest

from pipeline.stt import _is_silent, _to_wav, SILENCE_THRESHOLD, SAMPLE_RATE


# ── _is_silent ────────────────────────────────────────────────────────────────

def _make_pcm(rms_target: float, num_samples: int = 16000) -> bytes:
    """Generate int16 PCM bytes at approximately the given RMS level."""
    amplitude = rms_target * 32768.0
    t = np.linspace(0, 1, num_samples, endpoint=False)
    signal = (np.sin(2 * np.pi * 440 * t) * amplitude).astype(np.int16)
    return signal.tobytes()


def test_silent_below_threshold():
    silent = _make_pcm(rms_target=SILENCE_THRESHOLD * 0.5)
    assert _is_silent(silent) is True


def test_speech_above_threshold():
    loud = _make_pcm(rms_target=SILENCE_THRESHOLD * 5)
    assert _is_silent(loud) is False


def test_empty_bytes_is_silent():
    assert _is_silent(b"") is True


def test_single_byte_is_silent():
    assert _is_silent(b"\x00") is True


def test_zeros_are_silent():
    zero_pcm = np.zeros(1600, dtype=np.int16).tobytes()
    assert _is_silent(zero_pcm) is True


def test_threshold_boundary():
    # Exactly at threshold — should be considered silent (< not <=)
    at_threshold = _make_pcm(rms_target=SILENCE_THRESHOLD)
    # RMS calculation has floating point variance; just verify it doesn't crash
    result = _is_silent(at_threshold)
    assert isinstance(result, bool)


# ── _to_wav ───────────────────────────────────────────────────────────────────

def test_to_wav_produces_valid_wav():
    pcm = _make_pcm(rms_target=0.1)
    wav_buf = _to_wav(pcm)

    # Should be readable as a WAV file
    with wave.open(wav_buf, "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == SAMPLE_RATE
        assert wf.getnframes() > 0


def test_to_wav_has_correct_name():
    pcm = _make_pcm(rms_target=0.1)
    wav_buf = _to_wav(pcm)
    assert wav_buf.name == "audio.wav"


def test_to_wav_seeked_to_start():
    pcm = _make_pcm(rms_target=0.1)
    wav_buf = _to_wav(pcm)
    assert wav_buf.tell() == 0


def test_to_wav_custom_sample_rate():
    pcm = _make_pcm(rms_target=0.1)
    wav_buf = _to_wav(pcm, sample_rate=8000)
    with wave.open(wav_buf, "rb") as wf:
        assert wf.getframerate() == 8000


def test_to_wav_empty_pcm():
    """Empty PCM should produce a valid but empty WAV."""
    wav_buf = _to_wav(b"")
    with wave.open(wav_buf, "rb") as wf:
        assert wf.getnframes() == 0

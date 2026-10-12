import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../services/sound';
import { Mic, MicOff, CheckCircle2, Volume2, ShieldCheck, Sparkles, X, ArrowRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
}

export const MicrophonePermissionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onPermissionGranted,
}) => {
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startLiveVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setVolumeLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn('Microphone visualizer:', e);
    }
  };

  const cleanupAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setVolumeLevel(0);
  };

  const requestPermission = async () => {
    sound.playClick();
    setIsRequesting(true);
    setErrorMessage('');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone API is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionStatus('granted');
      sound.playRewardFanfare();
      startLiveVisualizer(stream);
      onPermissionGranted();
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      setPermissionStatus('denied');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone in your browser address bar.'
          : err.message || 'Unable to access microphone.'
      );
      sound.playWrong();
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 md:p-6 max-w-md w-full text-slate-100 shadow-2xl relative flex flex-col gap-4">
        {/* Close Button */}
        <button
          onClick={() => {
            sound.playClick();
            cleanupAudio();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
            permissionStatus === 'granted'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              : 'bg-amber-400/20 border-amber-400 text-amber-300'
          }`}>
            {permissionStatus === 'granted' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-pulse" />
            ) : (
              <Mic className="w-6 h-6 text-amber-300" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-black font-game text-amber-300">
              MICROPHONE PERMISSION
            </h3>
            <p className="text-xs text-slate-400">
              Required for IELTS Speaking & Voice Battles
            </p>
          </div>
        </div>

        {/* Explanatory Features */}
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block">Real-time Speech Recognition</strong>
              <span className="text-slate-400 text-[11px]">Transcribes your spoken English responses instantly during Phase 1.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block">Official 4-Criteria AI Examiner</strong>
              <span className="text-slate-400 text-[11px]">Evaluates Fluency, Lexical Resource, Grammar, and Pronunciation.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block">Turn Activation (Slot #3)</strong>
              <span className="text-slate-400 text-[11px]">Score Band 5.5 or higher to unlock Starmon #3 for match-3 combat!</span>
            </div>
          </div>
        </div>

        {/* Live Audio Test Waveform when granted */}
        {permissionStatus === 'granted' && (
          <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-500/60 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Microphone is Active & Listening! Speak to test:</span>
            </div>

            {/* Volume waveform visualizer */}
            <div className="flex items-end justify-center gap-1 h-8 w-full max-w-xs">
              {[25, 60, 90, 100, 75, 45, 85, 95, 65, 35].map((h, idx) => (
                <div
                  key={idx}
                  className="w-2 bg-emerald-400 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(6, Math.min(32, (volumeLevel / 100) * h))}px`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error message if denied */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-600 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <MicOff className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
          {permissionStatus !== 'granted' ? (
            <button
              onClick={requestPermission}
              disabled={isRequesting}
              className="w-full py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-xs md:text-sm rounded-xl shadow-lg shadow-amber-400/20 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              <span>{isRequesting ? 'REQUESTING PERMISSION...' : 'ALLOW MICROPHONE ACCESS'}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                sound.playClick();
                cleanupAudio();
                onClose();
              }}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black font-game text-xs md:text-sm rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <span>CONTINUE TO GAME</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              cleanupAudio();
              onClose();
            }}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
          >
            {permissionStatus === 'granted' ? 'Close' : 'Skip for now (Play in Quiet Mode)'}
          </button>
        </div>
      </div>
    </div>
  );
};

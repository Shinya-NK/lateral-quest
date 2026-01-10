import React, { useState, useEffect, useRef, useCallback } from 'react';

// Audio Manager Hook - Uses Web Audio API to synthesize sounds
const useAudioManager = () => {
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);
  const seGainRef = useRef(null);
  const isUnlockedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const bgmIntervalRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  const lastSETimeRef = useRef({});
  const SE_COOLDOWN = 100; // ms between same SE plays
  
  const [isBgmOn, setIsBgmOn] = useState(() => {
    const saved = localStorage.getItem('lateralquest_bgm_on');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [bgmVolume, setBgmVolume] = useState(() => {
    const saved = localStorage.getItem('lateralquest_bgm_volume');
    return saved !== null ? JSON.parse(saved) : 50;
  });
  
  const [isSEOn, setIsSEOn] = useState(() => {
    const saved = localStorage.getItem('lateralquest_se_on');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [seVolume, setSEVolume] = useState(() => {
    const saved = localStorage.getItem('lateralquest_se_volume');
    return saved !== null ? JSON.parse(saved) : 35; // Lower than BGM by default
  });
  
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('lateralquest_bgm_on', JSON.stringify(isBgmOn));
  }, [isBgmOn]);

  useEffect(() => {
    localStorage.setItem('lateralquest_bgm_volume', JSON.stringify(bgmVolume));
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        bgmVolume / 100 * 0.3,
        audioContextRef.current.currentTime
      );
    }
  }, [bgmVolume]);
  
  useEffect(() => {
    localStorage.setItem('lateralquest_se_on', JSON.stringify(isSEOn));
  }, [isSEOn]);
  
  useEffect(() => {
    localStorage.setItem('lateralquest_se_volume', JSON.stringify(seVolume));
  }, [seVolume]);

  // Initialize AudioContext
  const initAudio = useCallback(async () => {
    if (isUnlockedRef.current) return true;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // iOS unlock with silent buffer
      const silentBuffer = audioContextRef.current.createBuffer(1, 1, 22050);
      const silentSource = audioContextRef.current.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(audioContextRef.current.destination);
      silentSource.start(0);
      
      // Master gain for BGM
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.setValueAtTime(bgmVolume / 100 * 0.3, audioContextRef.current.currentTime);
      
      // SE gain
      seGainRef.current = audioContextRef.current.createGain();
      seGainRef.current.connect(audioContextRef.current.destination);
      seGainRef.current.gain.setValueAtTime(seVolume / 100 * 0.5, audioContextRef.current.currentTime);
      
      isUnlockedRef.current = true;
      setIsAudioReady(true);
      return true;
    } catch (error) {
      console.error('Audio initialization failed:', error);
      return false;
    }
  }, [bgmVolume, seVolume]);

  // Clear fade interval
  const clearFade = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  // Check SE cooldown to prevent spam
  const canPlaySE = useCallback((seName) => {
    const now = Date.now();
    const lastTime = lastSETimeRef.current[seName] || 0;
    if (now - lastTime < SE_COOLDOWN) {
      return false;
    }
    lastSETimeRef.current[seName] = now;
    return true;
  }, []);

  // ============================================
  // SE Sound Definitions
  // ============================================
  
  // se_send - Quick whoosh/send sound
  const playSESend = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.4;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(seGainRef.current);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }, [seVolume]);

  // se_yes - Positive confirmation ding
  const playSEYes = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.35;
    
    // Two-note ascending chime
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(vol, now + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
      
      osc.connect(gain);
      gain.connect(seGainRef.current);
      
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.35);
    });
  }, [seVolume]);

  // se_no - Negative buzz
  const playSENo = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.3;
    
    // Low descending tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    osc.connect(gain);
    gain.connect(seGainRef.current);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }, [seVolume]);

  // se_irrelevant - Neutral blip
  const playSEIrrelevant = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.25;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(440, now + 0.1);
    
    gain.gain.setValueAtTime(vol, now);
    gain.gain.setValueAtTime(vol * 0.7, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.connect(gain);
    gain.connect(seGainRef.current);
    
    osc.start(now);
    osc.stop(now + 0.25);
  }, [seVolume]);

  // se_unknown - Mysterious wobble
  const playSEUnknown = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.25;
    
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(8, now);
    lfoGain.gain.setValueAtTime(30, now);
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    
    osc.connect(gain);
    gain.connect(seGainRef.current);
    
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.4);
    osc.stop(now + 0.4);
  }, [seVolume]);

  // se_progress_up - Level up sparkle
  const playSEProgressUp = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.3;
    
    // Quick ascending arpeggio
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      
      gain.gain.setValueAtTime(0, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(vol, now + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.2);
      
      osc.connect(gain);
      gain.connect(seGainRef.current);
      
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.25);
    });
  }, [seVolume]);

  // se_hint - Magical hint sound
  const playSEHint = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.35;
    
    // Shimmering dual-tone
    [392, 523.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 0.3);
      
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 2, now);
      filter.Q.setValueAtTime(2, now);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * (i === 0 ? 1 : 0.7), now + 0.05);
      gain.gain.setValueAtTime(vol * (i === 0 ? 0.8 : 0.5), now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(seGainRef.current);
      
      osc.start(now);
      osc.stop(now + 0.55);
    });
  }, [seVolume]);

  // se_clear - Victory fanfare
  const playSEClear = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.4;
    
    // Triumphant ascending arpeggio + chord
    const notes = [523.25, 659.25, 783.99, 1046.50];
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(vol, now + i * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.4);
      
      osc.connect(gain);
      gain.connect(seGainRef.current);
      
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.5);
    });
    
    // Final chord
    const chordTime = now + 0.5;
    [523.25, 659.25, 783.99].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, chordTime);
      
      gain.gain.setValueAtTime(0, chordTime);
      gain.gain.linearRampToValueAtTime(vol * 0.7, chordTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, chordTime + 1.2);
      
      osc.connect(gain);
      gain.connect(seGainRef.current);
      
      osc.start(chordTime);
      osc.stop(chordTime + 1.3);
    });
  }, [seVolume]);

  // se_reveal - Dramatic reveal sound
  const playSEReveal = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.35;
    
    // Deep dramatic sweep
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(200, now);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 0.4);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
    filter.Q.setValueAtTime(5, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.1);
    gain.gain.setValueAtTime(vol * 0.8, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(seGainRef.current);
    
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.9);
    osc2.stop(now + 0.9);
  }, [seVolume]);

  // se_error - Error buzz
  const playSEError = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.25;
    
    // Two short buzzes
    [0, 0.12].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now + offset);
      
      gain.gain.setValueAtTime(vol, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.08);
      
      osc.connect(gain);
      gain.connect(seGainRef.current);
      
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }, [seVolume]);

  // se_click - UI click
  const playSEClick = useCallback(() => {
    if (!audioContextRef.current || !seGainRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const vol = seVolume / 100 * 0.2;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    
    osc.connect(gain);
    gain.connect(seGainRef.current);
    
    osc.start(now);
    osc.stop(now + 0.08);
  }, [seVolume]);

  // Main SE play function with cooldown
  const playSE = useCallback((seName) => {
    if (!isSEOn || !isUnlockedRef.current) return;
    if (!canPlaySE(seName)) return;
    
    // Update SE gain before playing
    if (seGainRef.current && audioContextRef.current) {
      seGainRef.current.gain.setValueAtTime(seVolume / 100 * 0.5, audioContextRef.current.currentTime);
    }
    
    switch (seName) {
      case 'send': playSESend(); break;
      case 'yes': playSEYes(); break;
      case 'no': playSENo(); break;
      case 'irrelevant': playSEIrrelevant(); break;
      case 'unknown': playSEUnknown(); break;
      case 'progress_up': playSEProgressUp(); break;
      case 'hint': playSEHint(); break;
      case 'clear': playSEClear(); break;
      case 'reveal': playSEReveal(); break;
      case 'error': playSEError(); break;
      case 'click': playSEClick(); break;
      default: break;
    }
  }, [isSEOn, seVolume, canPlaySE, playSESend, playSEYes, playSENo, playSEIrrelevant, 
      playSEUnknown, playSEProgressUp, playSEHint, playSEClear, playSEReveal, playSEError, playSEClick]);

  // ============================================
  // BGM Functions
  // ============================================

  // Create ambient pad sound
  const createPadNote = useCallback((freq, startTime, duration) => {
    if (!audioContextRef.current || !masterGainRef.current) return;
    
    const ctx = audioContextRef.current;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.002, startTime);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, startTime);
    filter.Q.setValueAtTime(1, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.15, startTime + 0.5);
    gain.gain.setValueAtTime(0.15, startTime + duration - 0.5);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);
    
    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
    
    return { osc1, osc2, gain };
  }, []);

  // Create arpeggio note
  const createArpNote = useCallback((freq, startTime, duration) => {
    if (!audioContextRef.current || !masterGainRef.current) return;
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
    
    return { osc, gain };
  }, []);

  // BGM loop
  const playBgmLoop = useCallback(() => {
    if (!audioContextRef.current || !masterGainRef.current) return;
    
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [196, 246.94, 293.66],
    ];
    
    const loopDuration = 16;
    const chordDuration = 4;
    
    chords.forEach((chord, i) => {
      chord.forEach(freq => {
        createPadNote(freq, now + i * chordDuration, chordDuration + 0.5);
      });
    });
    
    const arpNotes = [329.63, 392, 493.88, 392, 329.63, 261.63, 329.63, 392];
    const arpInterval = 0.5;
    
    arpNotes.forEach((freq, i) => {
      for (let repeat = 0; repeat < 4; repeat++) {
        const noteTime = now + repeat * 4 + i * arpInterval;
        if (noteTime < now + loopDuration) {
          createArpNote(freq, noteTime, 0.4);
        }
      }
    });
    
    bgmIntervalRef.current = setTimeout(() => {
      if (isPlayingRef.current) {
        playBgmLoop();
      }
    }, (loopDuration - 0.5) * 1000);
    
  }, [createPadNote, createArpNote]);

  // Fade in
  const fadeInBgm = useCallback((duration = 1000) => {
    if (!masterGainRef.current || !audioContextRef.current) return;
    
    clearFade();
    
    const targetVolume = bgmVolume / 100 * 0.3;
    const startVolume = 0;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;
    
    masterGainRef.current.gain.setValueAtTime(startVolume, audioContextRef.current.currentTime);
    
    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = startVolume + (volumeStep * currentStep);
      if (masterGainRef.current && audioContextRef.current) {
        masterGainRef.current.gain.setValueAtTime(
          Math.min(newVolume, targetVolume),
          audioContextRef.current.currentTime
        );
      }
      if (currentStep >= steps) {
        clearFade();
      }
    }, stepTime);
  }, [bgmVolume, clearFade]);

  // Fade out
  const fadeOutBgm = useCallback((duration = 500) => {
    return new Promise((resolve) => {
      if (!masterGainRef.current || !audioContextRef.current) {
        resolve();
        return;
      }
      
      clearFade();
      
      const startVolume = masterGainRef.current.gain.value;
      const targetVolume = 0;
      const steps = 20;
      const stepTime = duration / steps;
      const volumeStep = (startVolume - targetVolume) / steps;
      let currentStep = 0;
      
      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        const newVolume = startVolume - (volumeStep * currentStep);
        if (masterGainRef.current && audioContextRef.current) {
          masterGainRef.current.gain.setValueAtTime(
            Math.max(newVolume, 0),
            audioContextRef.current.currentTime
          );
        }
        if (currentStep >= steps) {
          clearFade();
          resolve();
        }
      }, stepTime);
    });
  }, [clearFade]);

  // Start BGM
  const startBgm = useCallback((fadeIn = true) => {
    if (!audioContextRef.current || !isBgmOn) return;
    if (isPlayingRef.current) return;
    
    try {
      if (fadeIn) {
        masterGainRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      }
      
      isPlayingRef.current = true;
      playBgmLoop();
      
      if (fadeIn) {
        fadeInBgm(1000);
      }
    } catch (error) {
      console.error('Failed to start BGM:', error);
    }
  }, [isBgmOn, playBgmLoop, fadeInBgm]);

  // Stop BGM
  const stopBgm = useCallback(async (fadeOut = true) => {
    if (!isPlayingRef.current) return;
    
    if (fadeOut) {
      await fadeOutBgm(500);
    }
    
    if (bgmIntervalRef.current) {
      clearTimeout(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    
    isPlayingRef.current = false;
  }, [fadeOutBgm]);

  // Toggle BGM
  const toggleBgm = useCallback(() => {
    setIsBgmOn(prev => {
      const newValue = !prev;
      if (newValue && isUnlockedRef.current && !isPlayingRef.current) {
        setTimeout(() => startBgm(true), 0);
      } else if (!newValue && isPlayingRef.current) {
        stopBgm(true);
      }
      return newValue;
    });
  }, [startBgm, stopBgm]);
  
  // Toggle SE
  const toggleSE = useCallback(() => {
    setIsSEOn(prev => !prev);
  }, []);

  // Screen transition
  const transitionScreen = useCallback(async (callback) => {
    if (isPlayingRef.current) {
      await fadeOutBgm(500);
      if (bgmIntervalRef.current) {
        clearTimeout(bgmIntervalRef.current);
        bgmIntervalRef.current = null;
      }
      isPlayingRef.current = false;
    }
    callback();
    if (isBgmOn && isUnlockedRef.current) {
      setTimeout(() => startBgm(true), 100);
    }
  }, [fadeOutBgm, isBgmOn, startBgm]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearFade();
      if (bgmIntervalRef.current) {
        clearTimeout(bgmIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [clearFade]);

  return {
    initAudio,
    startBgm,
    stopBgm,
    playSE,
    toggleBgm,
    toggleSE,
    transitionScreen,
    isBgmOn,
    bgmVolume,
    setBgmVolume,
    isSEOn,
    seVolume,
    setSEVolume,
    isAudioReady
  };
};

// System prompt for the LLM game engine - Enhanced for high quality problems
const SYSTEM_PROMPT = `あなたは水平思考ゲーム（ウミガメのスープ）のゲームエンジンです。
必ずJSON形式のみで返答してください。JSON以外の出力は絶対禁止です。

═══════════════════════════════════════════════════
【最重要】良問の条件 - これを満たさない問題は出題禁止
═══════════════════════════════════════════════════

■ 良問の絶対条件
1. 「なぜ？」「どういうこと？」と思わせる意外な状況設定
2. 真相を聞いたとき「なるほど！」「そういうことか！」と納得できる
3. 質問を重ねることで少しずつ真相に近づける構造
4. 日常の延長線上にあるリアルな設定（SF・ファンタジー禁止）
5. 一般常識で理解できる（専門知識不要）

■ 問題作成の黄金パターン（必ずいずれかを使用）

【パターンA：言葉の誤解型】
・ある言葉が別の意味で使われている
・例：「アジト」→子供の秘密基地、「下着泥棒」→洗濯物を畳む父親

【パターンB：状況の誤解型】
・一見〇〇に見えるが、実際は△△という状況
・例：「銃を向けられてありがとう」→しゃっくりを止めるため驚かせてくれた

【パターンC：立場・関係性の誤解型】
・登場人物の関係性が想像と異なる
・例：「結婚を誓った相手に妻がいた」→娘がパパと結婚すると言っている

【パターンD：時間・順序の誤解型】
・時系列や因果関係が想像と異なる
・例：「荷造りして火をつけた」→海外逃亡を諦め焼身自殺

【パターンE：行動の真意型】
・行動の本当の目的が想像と異なる
・例：「尻尾から食べると嘘をついた」→あんこが多い頭側をもらうため

■ 禁止事項（これらは絶対に使用しない）
× 偶然や運に頼る設定
× 超自然現象・SF設定
× 専門的すぎる知識が必要な設定
× 固有名詞（実在の人物・場所・作品名）
× 心理描写や感情の説明
× 答えが複数考えられる曖昧な設定
× 不自然な動機や行動
× 「実は〇〇だった」だけで納得感のない真相

═══════════════════════════════════════════════════
【ジャンル別の問題設計指針】
═══════════════════════════════════════════════════

■ daily（日常）
・買い物、食事、家事、移動、趣味などの日常シーン
・「あるある」と思える状況からの意外な展開
・例：「温めますか？と聞かれてお願いしたが弁当を持たずに帰った」→マヨネーズが爆発

■ work（仕事）
・職場、取引、面接、通勤などの仕事シーン
・立場や役職の誤解を利用
・例：「新人が社長室で堂々と座っていた」→清掃員として窓を拭いていた

■ school（学校）
・授業、部活、テスト、友人関係などの学校シーン
・生徒・先生の立場の違いを利用
・例：「カンニングしたのに先生に感謝された」→自分の答案を見せてあげた（相手は視覚障害）

■ relationship（人間関係）
・家族、恋愛、友情、近所付き合いなどの人間関係
・関係性の誤解を利用
・例：「毎晩女性の部屋に忍び込む男を妻は許していた」→自分の娘に絵本を読む父親

■ medical（医療）
・病院、健康、治療、身体に関するシーン
・医療行為の誤解を利用
・例：「刃物で切りつけられた男女が笑顔だった」→出産で臍の緒を切った

■ mystery（ミステリー）
・事件、犯罪、謎めいた状況
・トリックや誤解を利用
・例：「5つの銀行を襲った強盗が1つだけ襲わなかった」→そこに盗んだ金を預けていた

■ dark（ダーク）※genre=darkの場合のみ
・死、犯罪、裏社会などの暗いテーマ
・衝撃的だが納得感のある真相
・例：「海外に行く準備をして火をつけた」→逃亡を諦め焼身自殺

■ random（ランダム）
・上記のいずれかをランダムに選択（darkは除外）

═══════════════════════════════════════════════════
【難易度別の設計】
═══════════════════════════════════════════════════

■ easy（簡単）
・誤解の構造が1層のみ
・問題文に明確なヒントが含まれる
・5〜10問の質問で解ける
・例：「人生ゲームの話」「ルービックキューブの話」

■ normal（普通）
・誤解の構造が1〜2層
・問題文からある程度推測可能
・10〜20問の質問で解ける
・例：「たいやきの話」「コンビニ弁当の話」

■ hard（難しい）
・誤解の構造が2〜3層
・視点の大きな転換が必要
・20〜30問の質問で解ける
・例：「ウミガメのスープ」「迷子の女の子」

═══════════════════════════════════════════════════
【API応答仕様】
═══════════════════════════════════════════════════

■ action: "start" の場合
内部で以下を準備してから応答：
1. 真相（解答）を先に決める
2. 真相から逆算して問題文を作成
3. どの「黄金パターン」を使うか明確にする

応答JSON:
{
  "type": "problem",
  "message": "問題文（100〜160文字、2〜5行、事実のみ記述）",
  "answer": null,
  "progress": 0,
  "question_count": 0,
  "hint_level": 0,
  "is_active": true
}

■ action: "question" の場合
・内部で保持している真相と照合して回答を決定
・answerは必ず4択のいずれか: "yes" / "no" / "irrelevant" / "unknown"
・核心に近い質問→progressを大きく上げる（+15〜+25）
・関連する質問→progressを少し上げる（+5〜+10）
・関係ない質問→progressは上げない（+0〜+3）

応答JSON:
{
  "type": "answer",
  "message": "短い演出文（10〜20文字程度）",
  "answer": "yes/no/irrelevant/unknown",
  "progress": 更新後の値,
  "question_count": 更新後の値,
  "hint_level": 現在値,
  "is_active": true
}

■ action: "hint" の場合
・視点誘導のみ（時間/立場/定義/状況のどれに注目すべきか）
・答えを直接示唆しない

応答JSON:
{
  "type": "hint",
  "message": "ヒント（誘導的な質問形式が望ましい）",
  "answer": null,
  "progress": 現在値,
  "question_count": 現在値,
  "hint_level": 更新後の値,
  "is_active": true
}

■ action: "reveal" の場合
応答JSON:
{
  "type": "result",
  "message": "真相（2〜4行で説明）",
  "answer": null,
  "progress": 現在値,
  "question_count": 現在値,
  "hint_level": 現在値,
  "is_active": false
}

■ action: "grade_guess" の場合
応答JSON:
{
  "type": "grade",
  "message": "フィードバック",
  "answer": null,
  "progress": 現在値,
  "question_count": 現在値,
  "hint_level": 現在値,
  "is_active": false,
  "grade": {
    "match": 0〜100の一致度,
    "bonus_title": "称号（高一致度の場合のみ）または null",
    "feedback": "肯定的なコメント"
  }
}

═══════════════════════════════════════════════════
【厳守事項】
═══════════════════════════════════════════════════
・真相はrevealまで絶対に出力しない
・questionへの回答は yes/no/irrelevant/unknown の4択のみ
・理由説明は禁止（messageは演出のみ）
・darkジャンルは genre=dark の場合のみ使用
・JSON以外の出力は絶対禁止`;

// High-quality example problems for reference (used in prompts and fallback)
const EXAMPLE_PROBLEMS = {
  daily: [
    {
      problem: "「お弁当温めますか？」と聞かれた男は「お願いします」と答えた。\nしかし、その弁当を持たずに店を出た。\n一体どういうことだろうか？",
      truth: "店員が弁当を温める際、レンジNGの調味料を外し忘れて爆発させてしまった。商品にならなくなったため、男は別の弁当を買って帰った。",
      pattern: "状況の誤解型"
    },
    {
      problem: "男は毎朝15階の自宅からエレベーターで1階に降りて出勤する。\n帰宅時は10階までエレベーターで上がり、そこから階段を使う。\nしかし雨の日だけは15階までエレベーターで上がる。\nなぜだろうか？",
      truth: "男は背が低く、エレベーターの10階のボタンまでしか手が届かない。雨の日は傘を持っているので、傘を使って15階のボタンを押すことができる。",
      pattern: "状況の誤解型"
    },
    {
      problem: "無精髭を生やした男は、女性用下着を手に取ると大事そうに持っていった。\n男は毎日この行動を繰り返していたが、逮捕されることはなかった。\nなぜだろうか？",
      truth: "男は洗濯物を畳んでいた。家族（妻や娘）の下着も丁寧に畳み、それぞれの部屋に持って行ってあげる優しい父親だった。",
      pattern: "言葉の誤解型"
    }
  ],
  work: [
    {
      problem: "面接に来た男は、社長室で堂々と椅子に座っていた。\n秘書はそれを見ても何も言わなかった。\n一体どういうことだろうか？",
      truth: "男は窓清掃の面接に来ていた。社長室の窓を外から清掃するため、作業用の椅子に座って窓を拭いていたのだ。",
      pattern: "立場の誤解型"
    },
    {
      problem: "新入社員は初日から遅刻したが、上司に褒められた。\nなぜだろうか？",
      truth: "新入社員は電車内で急病人の救護に当たっていた。その様子が監視カメラに映っており、会社に報告が入っていたため、上司は彼の行動を褒めた。",
      pattern: "行動の真意型"
    }
  ],
  school: [
    {
      problem: "先生は生徒の答案を見て「カンニングだ」と確信した。\nしかし、その生徒を叱ることはなかった。\nなぜだろうか？",
      truth: "その生徒は視覚障害のある隣の生徒に自分の答案を見せてあげていた。先生はその優しさを知っていたので、叱らなかった。",
      pattern: "行動の真意型"
    },
    {
      problem: "テストで0点を取った生徒が、教室で拍手を浴びた。\nなぜだろうか？",
      truth: "これは英語のリスニングテストで、生徒は聴覚障害がある。今回初めて補聴器をつけてテストに挑戦し、聞き取れなかったが、その挑戦をクラスメイトが称えた。",
      pattern: "状況の誤解型"
    }
  ],
  relationship: [
    {
      problem: "ミユキは結婚しようと心に決めた男に妻がいることを知っていた。\nその妻もミユキの存在に気づいていたが、夫がミユキと仲良くすることを認めていた。\nしかし、男が離婚した途端にミユキとの関係も終わった。\n一体どういうことだろうか？",
      truth: "ミユキは男の娘。「大きくなったらパパと結婚する」と言っていた。両親が離婚し、ミユキは母親に引き取られたため、父親と会えなくなった。",
      pattern: "関係性の誤解型"
    },
    {
      problem: "毎晩、知らない女性の部屋に忍び込む男がいる。\n女性はそれに気づいているが、通報しなかった。\n男の妻もそれを知っているが、怒らなかった。\nなぜだろうか？",
      truth: "男は自分の幼い娘の部屋に忍び込んで、寝顔を確認している父親。女性は娘のこと。妻は夫の愛情深さを微笑ましく思っている。",
      pattern: "関係性の誤解型"
    }
  ],
  medical: [
    {
      problem: "男女が同時刻に鋭利な刃物で切りつけられた。\n同一犯人による同一の凶器での犯行だったが、誰も逮捕されなかった。\nなぜだろうか？",
      truth: "現場は分娩室。医師がハサミで臍の緒を切った瞬間、母親と赤ちゃんが同時に「切りつけられた」のだ。",
      pattern: "言葉の誤解型"
    },
    {
      problem: "医者は患者を殺したいと思いながら手術をした。\nしかし、患者は無事に回復し、医者に感謝した。\nなぜだろうか？",
      truth: "患者はがん細胞を持っていた。医者は「がん（患者の一部）を殺したい」と思いながら手術し、見事にがんを取り除いた。",
      pattern: "言葉の誤解型"
    }
  ],
  mystery: [
    {
      problem: "5つの銀行を連続で襲った強盗が、残る1つの銀行だけは絶対に襲わなかった。\nなぜだろうか？",
      truth: "強盗は奪った大金を自宅に置くことを不安に感じ、最もセキュリティがしっかりした銀行に預けていた。自分の金を預けている銀行を襲うわけにはいかなかった。",
      pattern: "行動の真意型"
    },
    {
      problem: "警察官は女性を発見すると車に乗せて警察署に向かった。\n署に着いて同僚に報告すると、警察官の方が保護された。\n一体どういうことだろうか？",
      truth: "その警察官は精神的な病を患っており、自分が警察官だと思い込んでいた。実際は脱走した患者であり、女性警察官に保護されてパトカーで署に連れてこられたのだ。",
      pattern: "立場の誤解型"
    }
  ],
  dark: [
    {
      problem: "海外に行く準備をしていた男は、荷造りを終えると荷物に火をつけた。\nなぜだろうか？",
      truth: "犯罪を犯して海外逃亡を計画していた男。しかし、準備を終えて計画を振り返っても成功する未来が描けなかった。諦めた男は荷物に火をつけて焼身自殺した。",
      pattern: "行動の真意型"
    },
    {
      problem: "「ウミガメのスープ」を注文した男は、一口飲んで店員に尋ねた。\n「これは本当にウミガメのスープですか？」\n店員が「はい」と答えると、男は帰宅後に自殺した。\nなぜだろうか？",
      truth: "男はかつて漂流し、仲間の肉を「ウミガメのスープ」と偽って食べさせられていた。本物の味を知った彼は、自分が人肉を食べていたことを悟り、命を絶った。",
      pattern: "状況の誤解型"
    }
  ]
};

// Tutorial problem (fixed, super easy) - Improved
const TUTORIAL_PROBLEM = {
  problem: "男は毎朝同じカフェで同じ席に座り、同じコーヒーを注文していた。\nある日、いつもの席が空いていなかったので、違う席に座った。\nその日から、彼の人生は大きく変わった。\nなぜだろうか？",
  truth: "違う席に座ったことで、隣に座っていた女性と話すきっかけができた。二人は意気投合し、やがて結婚した。",
  guided_questions: [
    { q: "男はカフェに一人で来ていましたか？", a: "yes", progress: 20, narration: "重要な視点です" },
    { q: "席を変えたことで誰かと出会いましたか？", a: "yes", progress: 45, narration: "核心に近づいています" },
    { q: "出会った相手は女性ですか？", a: "yes", progress: 70, narration: "その通りです" },
    { q: "二人は恋愛関係になりましたか？", a: "yes", progress: 100, narration: "正解です！" }
  ]
};

// Title calculation
const getTitleFromStats = (progress, questionCount, hintCount, bonusTitle) => {
  if (bonusTitle) return bonusTitle;
  
  const efficiency = progress / Math.max(questionCount, 1);
  
  if (efficiency >= 15 && hintCount === 0) return "Master Thinker";
  if (efficiency >= 10 && hintCount <= 1) return "Sharp Mind";
  if (questionCount <= 10 && progress >= 90) return "Pattern Breaker";
  if (hintCount >= 2) return "Curious Explorer";
  return "Persistent Seeker";
};

// Answer display mapping
const answerDisplay = {
  yes: { text: "YES", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
  no: { text: "NO", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  irrelevant: { text: "IRRELEVANT", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  unknown: { text: "UNKNOWN", color: "#6366f1", bg: "rgba(99, 102, 241, 0.15)" }
};

// Narration messages
const narrationMessages = {
  yes: ["その視点は重要です", "核心に近づいています", "良い着眼点です"],
  no: ["別の角度が良さそうです", "その方向ではないようです", "違う視点を試してみては"],
  irrelevant: ["本質ではなさそうです", "謎には関係がないようです", "別の要素に注目してみては"],
  unknown: ["まだ確定できません", "その情報は不明です", "謎の一部は闇の中です"]
};

const getNarration = (answer) => {
  const msgs = narrationMessages[answer] || narrationMessages.unknown;
  return msgs[Math.floor(Math.random() * msgs.length)];
};

export default function LateralQuest() {
  // Audio Manager
  const {
    initAudio,
    startBgm,
    stopBgm,
    playSE,
    toggleBgm,
    toggleSE,
    transitionScreen,
    isBgmOn,
    bgmVolume,
    setBgmVolume,
    isSEOn,
    seVolume,
    setSEVolume,
    isAudioReady
  } = useAudioManager();
  
  // Screen state
  const [screen, setScreen] = useState('home'); // home, settings, game, result, tutorial
  
  // Settings
  const [difficulty, setDifficulty] = useState('normal');
  const [genre, setGenre] = useState('random');
  const [hasPlayedTutorial, setHasPlayedTutorial] = useState(false);
  const [gameMode, setGameMode] = useState('offline'); // 'ai' or 'offline' - default to offline for no API key needed

  // API Key management - supports both env var (local) and localStorage (GitHub Pages)
  const [apiKey, setApiKey] = useState(() => {
    const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (envKey && envKey !== 'your_api_key_here') {
      return envKey;
    }
    return localStorage.getItem('lateralquest_api_key') || '';
  });

  // Save API key to localStorage when changed
  useEffect(() => {
    if (apiKey && !import.meta.env.VITE_ANTHROPIC_API_KEY) {
      localStorage.setItem('lateralquest_api_key', apiKey);
    }
  }, [apiKey]);
  
  // Audio UI state
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  // Progress tracking for SE
  const prevProgressRef = useRef(0);
  
  // Game state
  const [problemText, setProblemText] = useState('');
  const [truthText, setTruthText] = useState('');
  const [progress, setProgress] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Tutorial state
  const [tutorialStep, setTutorialStep] = useState(0);
  
  // Result state
  const [finalTitle, setFinalTitle] = useState('');
  const [userGuess, setUserGuess] = useState('');
  const [gradeResult, setGradeResult] = useState(null);
  const [showGuessInput, setShowGuessInput] = useState(false);
  
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);
  
  // Check tutorial status on mount
  useEffect(() => {
    const played = localStorage.getItem('lateralquest_tutorial');
    if (played) setHasPlayedTutorial(true);
  }, []);
  
  // Close volume slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showVolumeSlider && !e.target.closest('[data-volume-control]')) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showVolumeSlider]);
  
  // Generate offline response (simple keyword matching for pre-defined problems)
  const generateOfflineResponse = (question, truth, currentProgress) => {
    const q = question.toLowerCase();
    const keywords = {
      // Common lateral thinking question patterns
      person: /人|男|女|誰|彼|彼女/,
      place: /場所|どこ|部屋|店|家/,
      time: /時間|いつ|毎日|朝|夜/,
      reason: /なぜ|理由|どうして/,
      object: /物|何|もの|こと/,
      death: /死|殺|亡くなる|命/,
      family: /家族|妻|夫|子|親|娘|息子/,
      work: /仕事|会社|職|勤務/,
    };

    // Simple yes/no logic based on truth text content
    let answer = 'unknown';
    let progressIncrease = 5;

    // Check if question keywords match truth content
    if (q.includes('人') || q.includes('男') || q.includes('女')) {
      if (truth.includes('男') || truth.includes('女') || truth.includes('人')) {
        answer = 'yes';
        progressIncrease = 10;
      } else {
        answer = 'no';
        progressIncrease = 5;
      }
    } else if (q.includes('家族') || q.includes('妻') || q.includes('夫') || q.includes('子') || q.includes('娘') || q.includes('息子') || q.includes('親')) {
      if (truth.includes('家族') || truth.includes('妻') || truth.includes('夫') || truth.includes('子') || truth.includes('娘') || truth.includes('息子') || truth.includes('親') || truth.includes('父') || truth.includes('母')) {
        answer = 'yes';
        progressIncrease = 15;
      } else {
        answer = 'no';
        progressIncrease = 5;
      }
    } else if (q.includes('死') || q.includes('殺') || q.includes('亡くな')) {
      if (truth.includes('死') || truth.includes('殺') || truth.includes('亡くな') || truth.includes('命')) {
        answer = 'yes';
        progressIncrease = 12;
      } else {
        answer = 'no';
        progressIncrease = 5;
      }
    } else if (q.includes('仕事') || q.includes('会社') || q.includes('職')) {
      if (truth.includes('仕事') || truth.includes('会社') || truth.includes('職') || truth.includes('勤務')) {
        answer = 'yes';
        progressIncrease = 10;
      } else {
        answer = 'no';
        progressIncrease = 5;
      }
    } else {
      // Random answer for generic questions
      const random = Math.random();
      if (random < 0.4) answer = 'yes';
      else if (random < 0.7) answer = 'no';
      else if (random < 0.9) answer = 'irrelevant';
      else answer = 'unknown';
      progressIncrease = answer === 'yes' ? 8 : 3;
    }

    const newProgress = Math.min(currentProgress + progressIncrease, 100);
    const newQuestionCount = questionCount + 1;

    return {
      type: 'answer',
      answer,
      message: getNarration(answer),
      progress: newProgress,
      question_count: newQuestionCount,
      hint_level: 0,
      is_active: newProgress < 100
    };
  };

  // Call LLM API
  const callLLM = async (action, extraInput = '') => {
    const payload = {
      action,
      difficulty,
      genre,
      user_input: extraInput,
      state: {
        question_count: questionCount,
        hint_level: hintLevel,
        progress,
        is_active: isActive
      }
    };
    
    // Get example problems for the genre to help LLM generate better problems
    const getExampleProblems = () => {
      const genreKey = genre === 'random' 
        ? ['daily', 'work', 'school', 'relationship', 'medical', 'mystery'][Math.floor(Math.random() * 6)]
        : genre;
      const examples = EXAMPLE_PROBLEMS[genreKey] || EXAMPLE_PROBLEMS.daily;
      return examples.map((ex, i) => 
        `【参考例${i + 1}】\n問題：${ex.problem}\n真相：${ex.truth}\nパターン：${ex.pattern}`
      ).join('\n\n');
    };
    
    // Build context message based on action
    let contextMessage = '';
    if (action === 'start') {
      contextMessage = `【タスク】新しい水平思考問題を生成してください。

【設定】
- 難易度: ${difficulty}
- ジャンル: ${genre}

【このジャンルの良問例】
${getExampleProblems()}

【重要】
上記の例を参考に、同等以上のクオリティの問題を新しく作成してください。
例をそのままコピーせず、同じパターンを使って新しい状況を考えてください。

入力JSON:
${JSON.stringify(payload, null, 2)}`;
    } else if (action === 'question') {
      contextMessage = `【タスク】質問に回答してください。

【現在の問題】
${problemText}

【ユーザーの質問】
${extraInput}

【指示】
- 内部で保持している真相と照合し、yes/no/irrelevant/unknownの4択で回答
- 核心に近い質問ならprogressを大きく上げる（+15〜25）
- 関連する質問なら少し上げる（+5〜10）
- 関係ない質問なら上げない（+0〜3）

入力JSON:
${JSON.stringify(payload, null, 2)}`;
    } else if (action === 'hint') {
      contextMessage = `【タスク】ヒントを提供してください。

【現在の問題】
${problemText}

【指示】
- 視点誘導のみ（時間/立場/定義/状況のどれに注目すべきか）
- 答えを直接示唆しない
- 質問形式のヒントが効果的

入力JSON:
${JSON.stringify(payload, null, 2)}`;
    } else if (action === 'reveal') {
      contextMessage = `【タスク】真相を開示してください。

【現在の問題】
${problemText}

【指示】
- 2〜4行で真相を説明
- 「なるほど！」と思える説明を

入力JSON:
${JSON.stringify(payload, null, 2)}`;
    } else if (action === 'grade_guess') {
      contextMessage = `【タスク】ユーザーの推理を評価してください。

【現在の問題】
${problemText}

【ユーザーの推理】
${extraInput}

【指示】
- 真相との一致度を0〜100で評価
- 不一致でも否定的な表現は禁止
- 70%以上ならbonus_titleを付与

入力JSON:
${JSON.stringify(payload, null, 2)}`;
    } else {
      contextMessage = `入力JSON:\n${JSON.stringify(payload, null, 2)}`;
    }
    
    try {
      // Check if API key is available
      if (!apiKey) {
        throw new Error('API_KEY_MISSING');
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: contextMessage
            }
          ]
        })
      });
      
      // Check for API errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('API_KEY_INVALID');
        }
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '{}';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Invalid JSON response');
    } catch (error) {
      console.error('LLM Error:', error);

      // Provide user-friendly error messages
      if (error.message === 'API_KEY_MISSING') {
        return { type: 'error', message: 'APIキーが設定されていません。設定画面でAPIキーを入力してください。' };
      }
      if (error.message === 'API_KEY_INVALID') {
        return { type: 'error', message: 'APIキーが無効です。設定画面で正しいAPIキーを入力してください。' };
      }
      return { type: 'error', message: 'エラーが発生しました。もう一度お試しください。' };
    }
  };
  
  // Start new game
  const startGame = async () => {
    // Initialize audio on first user interaction
    await initAudio();
    playSE('click');
    
    setIsLoading(true);
    setChatLog([]);
    setProgress(0);
    setQuestionCount(0);
    setHintLevel(0);
    setUserGuess('');
    setGradeResult(null);
    setShowGuessInput(false);
    prevProgressRef.current = 0;
    
    const result = await callLLM('start');

    if (result.type === 'problem') {
      setProblemText(result.message);
      setTruthText(''); // Will be revealed later
      setIsActive(true);

      // Transition with audio fade
      transitionScreen(() => setScreen('game'));
    } else if (result.type === 'error') {
      // Show error message to user
      alert(result.message);
    }
    setIsLoading(false);
  };

  // Start offline game with pre-defined problems
  const startOfflineGame = async () => {
    console.log('startOfflineGame called');
    try {
      // Initialize audio on first user interaction
      await initAudio();
      playSE('click');
      console.log('Audio initialized');

      setIsLoading(true);
      setChatLog([]);
      setProgress(0);
      setQuestionCount(0);
      setHintLevel(0);
      setUserGuess('');
      setGradeResult(null);
      setShowGuessInput(false);
      prevProgressRef.current = 0;

      // Select random problem from the chosen genre
      const genreKey = genre === 'random'
        ? ['daily', 'work', 'school', 'relationship', 'medical', 'mystery', 'dark'][Math.floor(Math.random() * 7)]
        : genre;

      const problems = EXAMPLE_PROBLEMS[genreKey] || EXAMPLE_PROBLEMS.daily;
      const selectedProblem = problems[Math.floor(Math.random() * problems.length)];

      console.log('Selected problem:', selectedProblem);

      setProblemText(selectedProblem.problem);
      setTruthText(selectedProblem.truth);
      setIsActive(true);

      console.log('Transitioning to game screen');
      // Transition with audio fade
      transitionScreen(() => setScreen('game'));
    } catch (error) {
      console.error('Offline game start error:', error);
      alert('オフラインモードの開始に失敗しました。ページを再読み込みしてください。');
    } finally {
      setIsLoading(false);
    }
  };

  // Start tutorial
  const startTutorial = async () => {
    // Initialize audio on first user interaction
    await initAudio();
    playSE('click');
    
    setChatLog([]);
    setProgress(0);
    setQuestionCount(0);
    setHintLevel(0);
    setTutorialStep(0);
    setProblemText(TUTORIAL_PROBLEM.problem);
    setTruthText(TUTORIAL_PROBLEM.truth);
    setIsActive(true);
    prevProgressRef.current = 0;
    
    // Transition with audio fade
    transitionScreen(() => setScreen('tutorial'));
    
    // Show first guided question hint
    setTimeout(() => {
      setUserInput(TUTORIAL_PROBLEM.guided_questions[0].q);
    }, 1000);
  };
  
  // Handle tutorial question
  const handleTutorialQuestion = () => {
    if (!userInput.trim()) return;
    
    playSE('send');
    
    const currentGuide = TUTORIAL_PROBLEM.guided_questions[tutorialStep];
    const answer = currentGuide?.a || 'yes';
    const newProgress = currentGuide?.progress || Math.min(progress + 25, 100);
    const narration = currentGuide?.narration || getNarration(answer);
    
    setChatLog(prev => [...prev, 
      { type: 'user', text: userInput },
      { type: 'gm', answer, narration }
    ]);
    
    // Play answer SE after short delay
    setTimeout(() => {
      playSE(answer);
      // Check progress increase
      if (newProgress - prevProgressRef.current >= 5) {
        setTimeout(() => playSE('progress_up'), 200);
      }
      prevProgressRef.current = newProgress;
    }, 300);
    
    setProgress(newProgress);
    setQuestionCount(prev => prev + 1);
    setUserInput('');
    
    const nextStep = tutorialStep + 1;
    setTutorialStep(nextStep);
    
    if (nextStep >= TUTORIAL_PROBLEM.guided_questions.length || newProgress >= 100) {
      // Tutorial complete
      setTimeout(() => {
        setTruthText(TUTORIAL_PROBLEM.truth);
        setIsActive(false);
        localStorage.setItem('lateralquest_tutorial', 'true');
        setHasPlayedTutorial(true);
        setFinalTitle('Quick Learner');
        
        // Play clear SE
        playSE('clear');
        
        // Transition with audio fade
        transitionScreen(() => setScreen('result'));
      }, 1500);
    } else {
      // Show next guided question
      setTimeout(() => {
        setUserInput(TUTORIAL_PROBLEM.guided_questions[nextStep].q);
      }, 1000);
    }
  };
  
  // Handle question submission
  const handleQuestion = async () => {
    if (!userInput.trim() || isLoading || !isActive) return;

    if (screen === 'tutorial') {
      handleTutorialQuestion();
      return;
    }

    playSE('send');

    const question = userInput.trim();
    setUserInput('');
    setChatLog(prev => [...prev, { type: 'user', text: question }]);
    setIsLoading(true);

    let result;

    // Use offline mode if selected
    if (gameMode === 'offline') {
      result = generateOfflineResponse(question, truthText, progress);
    } else {
      result = await callLLM('question', question);
    }
    
    if (result.answer) {
      setChatLog(prev => [...prev, { 
        type: 'gm', 
        answer: result.answer, 
        narration: result.message || getNarration(result.answer)
      }]);
      
      const newProgress = result.progress ?? progress;
      
      // Play answer SE
      playSE(result.answer);
      
      // Check progress increase for SE
      if (newProgress - prevProgressRef.current >= 5) {
        setTimeout(() => playSE('progress_up'), 200);
      }
      prevProgressRef.current = newProgress;
      
      setProgress(newProgress);
      setQuestionCount(result.question_count ?? questionCount + 1);
    } else {
      playSE('error');
    }
    
    setIsLoading(false);
    inputRef.current?.focus();
  };
  
  // Handle hint request
  const handleHint = async () => {
    if (hintLevel >= 3 || isLoading || !isActive) {
      playSE('error');
      return;
    }
    
    playSE('hint');
    
    setIsLoading(true);
    const result = await callLLM('hint');
    
    if (result.message) {
      setChatLog(prev => [...prev, { type: 'hint', text: result.message }]);
      setHintLevel(result.hint_level ?? hintLevel + 1);
    }
    
    setIsLoading(false);
  };
  
  // Handle reveal (can be called when progress >= 90 OR when all hints used as give up)
  const handleReveal = async () => {
    if (isLoading) return;
    // Allow reveal if progress >= 90 OR if all hints are used (give up)
    if (progress < 90 && hintLevel < 3) {
      playSE('error');
      return;
    }
    
    setIsLoading(true);
    const result = await callLLM('reveal');
    
    if (result.type === 'result') {
      setTruthText(result.message);
      setIsActive(false);
      // Different title based on whether it was a solve or give up
      const title = progress >= 90 
        ? getTitleFromStats(progress, questionCount, hintLevel, null)
        : 'Curious Explorer'; // Give up title
      setFinalTitle(title);
      
      // Play SE based on result
      if (progress >= 90) {
        playSE('clear');
      } else {
        playSE('reveal');
      }
      
      // Transition with audio fade
      transitionScreen(() => setScreen('result'));
    }
    
    setIsLoading(false);
  };
  
  // Handle user guess grading
  const handleGradeGuess = async () => {
    if (!userGuess.trim() || isLoading) return;
    
    setIsLoading(true);
    const result = await callLLM('grade_guess', userGuess);
    
    if (result.grade) {
      setGradeResult(result.grade);
      if (result.grade.bonus_title) {
        setFinalTitle(result.grade.bonus_title);
      }
    }
    
    setIsLoading(false);
  };
  
  // Reset game
  const resetGame = () => {
    playSE('click');
    transitionScreen(() => {
      setScreen('home');
      setProblemText('');
      setTruthText('');
      setProgress(0);
      setQuestionCount(0);
      setHintLevel(0);
      setIsActive(false);
      setChatLog([]);
      setUserInput('');
      setUserGuess('');
      setGradeResult(null);
      setShowGuessInput(false);
      prevProgressRef.current = 0;
    });
  };
  
  // Genre display names
  const genreNames = {
    daily: '日常',
    work: '仕事',
    school: '学校',
    relationship: '人間関係',
    medical: '医療',
    mystery: 'ミステリー',
    dark: 'ダーク',
    random: 'ランダム'
  };
  
  const difficultyNames = {
    easy: '簡単',
    normal: '普通',
    hard: '難しい'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
      color: '#e4e4e7',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 168, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(78, 205, 196, 0.04) 0%, transparent 30%)
        `,
        pointerEvents: 'none'
      }} />
      
      {/* Noise texture overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none'
      }} />

      {/* HOME SCREEN */}
      {screen === 'home' && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Logo */}
          <div style={{
            marginBottom: '1rem',
            animation: 'float 6s ease-in-out infinite'
          }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="url(#logoGrad)" strokeWidth="2" fill="none" opacity="0.6"/>
              <path d="M40 15 L55 30 L55 50 L40 65 L25 50 L25 30 Z" stroke="url(#logoGrad)" strokeWidth="1.5" fill="rgba(120, 119, 198, 0.1)"/>
              <circle cx="40" cy="40" r="8" fill="url(#logoGrad)"/>
              <text x="40" y="45" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">?</text>
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7877c6"/>
                  <stop offset="100%" stopColor="#ff77a8"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          <h1 style={{
            fontSize: 'clamp(2.5rem, 8vw, 4rem)',
            fontWeight: '300',
            letterSpacing: '0.3em',
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #e4e4e7 0%, #a8a8b3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textAlign: 'center'
          }}>
            LATERAL
          </h1>
          <h2 style={{
            fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
            fontWeight: '200',
            letterSpacing: '0.5em',
            color: '#7877c6',
            marginBottom: '3rem',
            textAlign: 'center'
          }}>
            QUEST
          </h2>
          
          <p style={{
            fontSize: '0.95rem',
            color: '#71717a',
            marginBottom: '3rem',
            textAlign: 'center',
            maxWidth: '300px',
            lineHeight: 1.7
          }}>
            真相は、問いの先にある
          </p>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            width: '100%',
            maxWidth: '280px'
          }}>
            <button
              onClick={() => setScreen('settings')}
              style={{
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: '500',
                letterSpacing: '0.1em',
                background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.2) 0%, rgba(255, 119, 168, 0.15) 100%)',
                border: '1px solid rgba(120, 119, 198, 0.4)',
                borderRadius: '8px',
                color: '#e4e4e7',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(120, 119, 198, 0.35) 0%, rgba(255, 119, 168, 0.25) 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(120, 119, 198, 0.3)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(120, 119, 198, 0.2) 0%, rgba(255, 119, 168, 0.15) 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              ゲームを始める
            </button>
            
            {!hasPlayedTutorial && (
              <button
                onClick={startTutorial}
                style={{
                  padding: '0.8rem 2rem',
                  fontSize: '0.9rem',
                  fontWeight: '400',
                  letterSpacing: '0.1em',
                  background: 'transparent',
                  border: '1px solid rgba(113, 113, 122, 0.4)',
                  borderRadius: '8px',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.borderColor = 'rgba(120, 119, 198, 0.6)';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = 'rgba(113, 113, 122, 0.4)';
                  e.currentTarget.style.color = '#a1a1aa';
                }}
              >
                チュートリアル（推奨）
              </button>
            )}
          </div>
          
          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
            
            /* Range slider styles */
            input[type="range"] {
              -webkit-appearance: none;
              appearance: none;
              height: 4px;
              border-radius: 2px;
              outline: none;
            }
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: #7877c6;
              cursor: pointer;
              border: 2px solid #1a1a2e;
              box-shadow: 0 0 4px rgba(120, 119, 198, 0.5);
            }
            input[type="range"]::-moz-range-thumb {
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: #7877c6;
              cursor: pointer;
              border: 2px solid #1a1a2e;
              box-shadow: 0 0 4px rgba(120, 119, 198, 0.5);
            }
          `}</style>
        </div>
      )}

      {/* SETTINGS SCREEN */}
      {screen === 'settings' && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          position: 'relative',
          zIndex: 1
        }}>
          <button
            onClick={() => setScreen('home')}
            style={{
              position: 'absolute',
              top: '1.5rem',
              left: '1.5rem',
              background: 'none',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ← 戻る
          </button>
          
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '300',
            letterSpacing: '0.2em',
            marginBottom: '2.5rem',
            color: '#e4e4e7'
          }}>
            設定
          </h2>

          {/* Game Mode Selection */}
          <div style={{
            width: '100%',
            maxWidth: '320px',
            marginBottom: '2rem'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              color: '#71717a',
              marginBottom: '0.75rem',
              letterSpacing: '0.1em'
            }}>
              ゲームモード
            </label>
            <div style={{
              display: 'flex',
              gap: '0.5rem'
            }}>
              <button
                onClick={() => setGameMode('offline')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  background: gameMode === 'offline'
                    ? 'linear-gradient(135deg, rgba(120, 119, 198, 0.3) 0%, rgba(255, 119, 168, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: gameMode === 'offline'
                    ? '1px solid rgba(120, 119, 198, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: gameMode === 'offline' ? '#e4e4e7' : '#71717a',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                オフライン
              </button>
              <button
                onClick={() => setGameMode('ai')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  background: gameMode === 'ai'
                    ? 'linear-gradient(135deg, rgba(120, 119, 198, 0.3) 0%, rgba(255, 119, 168, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: gameMode === 'ai'
                    ? '1px solid rgba(120, 119, 198, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: gameMode === 'ai' ? '#e4e4e7' : '#71717a',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                AI生成
              </button>
            </div>
            <p style={{
              fontSize: '0.7rem',
              color: '#52525b',
              marginTop: '0.5rem',
              lineHeight: 1.4
            }}>
              {gameMode === 'offline'
                ? '※ 事前に用意された良質な問題をプレイ（APIキー不要）'
                : '※ AIが毎回新しい問題を生成（APIキーが必要）'
              }
            </p>
          </div>

          {/* Difficulty */}
          <div style={{
            width: '100%',
            maxWidth: '320px',
            marginBottom: '2rem'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              color: '#71717a',
              marginBottom: '0.75rem',
              letterSpacing: '0.1em'
            }}>
              難易度
            </label>
            <div style={{
              display: 'flex',
              gap: '0.5rem'
            }}>
              {['easy', 'normal', 'hard'].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    fontSize: '0.85rem',
                    background: difficulty === d 
                      ? 'linear-gradient(135deg, rgba(120, 119, 198, 0.3) 0%, rgba(255, 119, 168, 0.2) 100%)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: difficulty === d 
                      ? '1px solid rgba(120, 119, 198, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: difficulty === d ? '#e4e4e7' : '#71717a',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {difficultyNames[d]}
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input (only show if AI mode and not using env var) */}
          {gameMode === 'ai' && !import.meta.env.VITE_ANTHROPIC_API_KEY && (
            <div style={{
              width: '100%',
              maxWidth: '320px',
              marginBottom: '2rem'
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                color: '#71717a',
                marginBottom: '0.75rem',
                letterSpacing: '0.1em'
              }}>
                Anthropic API キー
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#7877c6',
                    textDecoration: 'none'
                  }}
                >
                  (取得する)
                </a>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#e4e4e7',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(120, 119, 198, 0.5)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              />
              <p style={{
                fontSize: '0.7rem',
                color: '#52525b',
                marginTop: '0.5rem',
                lineHeight: 1.4
              }}>
                ※ ブラウザに保存されます。APIキーは安全に管理してください。
              </p>
            </div>
          )}

          {/* Genre */}
          <div style={{
            width: '100%',
            maxWidth: '320px',
            marginBottom: '3rem'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              color: '#71717a',
              marginBottom: '0.75rem',
              letterSpacing: '0.1em'
            }}>
              ジャンル
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem'
            }}>
              {Object.entries(genreNames).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => setGenre(key)}
                  style={{
                    padding: '0.75rem',
                    fontSize: '0.85rem',
                    background: genre === key 
                      ? key === 'dark'
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(153, 27, 27, 0.2) 100%)'
                        : 'linear-gradient(135deg, rgba(120, 119, 198, 0.3) 0%, rgba(255, 119, 168, 0.2) 100%)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: genre === key 
                      ? key === 'dark'
                        ? '1px solid rgba(239, 68, 68, 0.5)'
                        : '1px solid rgba(120, 119, 198, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: genre === key ? '#e4e4e7' : '#71717a',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {name}
                  {key === 'dark' && <span style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}>⚠</span>}
                </button>
              ))}
            </div>
            {genre === 'dark' && (
              <p style={{
                fontSize: '0.75rem',
                color: '#ef4444',
                marginTop: '0.75rem',
                opacity: 0.8
              }}>
                ※ ダークな内容を含む問題が出題されます
              </p>
            )}
          </div>
          
          <button
            onClick={() => {
              console.log('Start button clicked. Mode:', gameMode);
              if (gameMode === 'offline') {
                startOfflineGame();
              } else {
                startGame();
              }
            }}
            disabled={isLoading || (gameMode === 'ai' && !apiKey)}
            style={{
              padding: '1rem 3rem',
              fontSize: '1rem',
              fontWeight: '500',
              letterSpacing: '0.15em',
              background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.3) 0%, rgba(255, 119, 168, 0.2) 100%)',
              border: '1px solid rgba(120, 119, 198, 0.5)',
              borderRadius: '8px',
              color: '#e4e4e7',
              cursor: (isLoading || (gameMode === 'ai' && !apiKey)) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: (isLoading || (gameMode === 'ai' && !apiKey)) ? 0.6 : 1
            }}
          >
            {isLoading ? '問題を生成中...' : (gameMode === 'ai' && !apiKey) ? 'APIキーが必要です' : 'スタート'}
          </button>

          {gameMode === 'ai' && !apiKey && !import.meta.env.VITE_ANTHROPIC_API_KEY && (
            <p style={{
              fontSize: '0.8rem',
              color: '#ef4444',
              marginTop: '1rem',
              textAlign: 'center'
            }}>
              AI生成モードではAPIキーが必要です
            </p>
          )}
        </div>
      )}

      {/* GAME SCREEN */}
      {(screen === 'game' || screen === 'tutorial') && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Header */}
          <header style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(10px)',
            background: 'rgba(15, 15, 35, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h1 style={{
                fontSize: '1.1rem',
                fontWeight: '300',
                letterSpacing: '0.15em',
                color: '#e4e4e7'
              }}>
                {screen === 'tutorial' ? 'TUTORIAL' : 'LATERAL QUEST'}
              </h1>
              {screen !== 'tutorial' && (
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  fontSize: '0.75rem'
                }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(120, 119, 198, 0.2)',
                    borderRadius: '4px',
                    color: '#a8a8b3'
                  }}>
                    {difficultyNames[difficulty]}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: genre === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 119, 168, 0.15)',
                    borderRadius: '4px',
                    color: genre === 'dark' ? '#fca5a5' : '#a8a8b3'
                  }}>
                    {genreNames[genre]}
                  </span>
                </div>
              )}
            </div>
            
            {/* Right side controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Audio Controls */}
              <div data-volume-control style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* BGM Toggle */}
                <button
                  onClick={toggleBgm}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isBgmOn ? '#7877c6' : '#52525b',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease'
                  }}
                  title={isBgmOn ? 'BGM OFF' : 'BGM ON'}
                >
                  {isBgmOn ? '🎵' : '🎵'}
                  {!isBgmOn && <span style={{ position: 'absolute', fontSize: '0.6rem', marginLeft: '-0.3rem', marginTop: '0.5rem' }}>✕</span>}
                </button>
                
                {/* SE Toggle */}
                <button
                  onClick={toggleSE}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isSEOn ? '#7877c6' : '#52525b',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease'
                  }}
                  title={isSEOn ? 'SE OFF' : 'SE ON'}
                >
                  {isSEOn ? '🔊' : '🔇'}
                </button>
                
                <button
                  onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#71717a',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="音量調整"
                >
                  ▼
                </button>
                
                {/* Volume Slider Dropdown */}
                {showVolumeSlider && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    background: 'rgba(30, 30, 50, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '1rem',
                    zIndex: 100,
                    minWidth: '180px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    {/* BGM Volume */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.4rem'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>🎵 BGM</span>
                        <span style={{ fontSize: '0.7rem', color: '#71717a' }}>{bgmVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={bgmVolume}
                        onChange={(e) => setBgmVolume(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: '4px',
                          appearance: 'none',
                          background: `linear-gradient(to right, #7877c6 0%, #7877c6 ${bgmVolume}%, #3f3f46 ${bgmVolume}%, #3f3f46 100%)`,
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                    
                    {/* SE Volume */}
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.4rem'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>🔊 SE</span>
                        <span style={{ fontSize: '0.7rem', color: '#71717a' }}>{seVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={seVolume}
                        onChange={(e) => setSEVolume(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: '4px',
                          appearance: 'none',
                          background: `linear-gradient(to right, #ff77a8 0%, #ff77a8 ${seVolume}%, #3f3f46 ${seVolume}%, #3f3f46 100%)`,
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={resetGame}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                終了
              </button>
            </div>
          </header>

          {/* Problem Card */}
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.8) 0%, rgba(25, 25, 45, 0.9) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, #7877c6 0%, #ff77a8 100%)',
                opacity: 0.6
              }} />
              <p style={{
                fontSize: '0.95rem',
                lineHeight: 1.9,
                color: '#e4e4e7',
                whiteSpace: 'pre-wrap'
              }}>
                {problemText}
              </p>
            </div>
          </div>

          {/* Status Bar */}
          <div style={{
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
          }}>
            {/* Progress */}
            <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#71717a' }}>推理進捗</span>
                <span style={{ 
                  fontSize: '0.85rem', 
                  color: progress >= 90 ? '#10b981' : '#e4e4e7',
                  fontWeight: progress >= 90 ? '600' : '400'
                }}>
                  {progress}%
                </span>
              </div>
              <div style={{
                height: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: progress >= 90 
                    ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                    : 'linear-gradient(90deg, #7877c6 0%, #ff77a8 100%)',
                  borderRadius: '3px',
                  transition: 'width 0.5s ease, background 0.3s ease'
                }} />
              </div>
            </div>
            
            {/* Stats */}
            <div style={{
              display: 'flex',
              gap: '1.5rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#71717a', fontSize: '0.7rem', marginBottom: '0.25rem' }}>質問</div>
                <div style={{ color: '#e4e4e7' }}>{questionCount}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#71717a', fontSize: '0.7rem', marginBottom: '0.25rem' }}>ヒント</div>
                <div style={{ color: hintLevel >= 3 ? '#71717a' : '#e4e4e7' }}>{hintLevel}/3</div>
              </div>
            </div>
          </div>

          {/* Chat Log */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {chatLog.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#52525b',
                padding: '2rem',
                fontSize: '0.9rem'
              }}>
                {screen === 'tutorial' 
                  ? '入力欄の質問を送信してみましょう'
                  : 'Yes/No で答えられる質問をしてみましょう'
                }
              </div>
            )}
            
            {chatLog.map((msg, i) => (
              <div 
                key={i}
                style={{
                  animation: 'fadeSlideIn 0.3s ease forwards',
                  opacity: 0
                }}
              >
                {msg.type === 'user' && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}>
                    <div style={{
                      background: 'rgba(120, 119, 198, 0.15)',
                      border: '1px solid rgba(120, 119, 198, 0.3)',
                      borderRadius: '12px 12px 4px 12px',
                      padding: '0.75rem 1rem',
                      maxWidth: '80%',
                      fontSize: '0.9rem',
                      color: '#e4e4e7'
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )}
                
                {msg.type === 'gm' && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      alignSelf: 'flex-start'
                    }}>
                      <span style={{
                        padding: '0.4rem 0.8rem',
                        background: answerDisplay[msg.answer]?.bg || 'rgba(255,255,255,0.1)',
                        color: answerDisplay[msg.answer]?.color || '#e4e4e7',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        letterSpacing: '0.05em'
                      }}>
                        {answerDisplay[msg.answer]?.text || msg.answer.toUpperCase()}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.85rem',
                      color: '#a1a1aa',
                      fontStyle: 'italic',
                      paddingLeft: '0.5rem'
                    }}>
                      {msg.narration}
                    </p>
                  </div>
                )}
                
                {msg.type === 'hint' && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.85rem',
                    color: '#fbbf24'
                  }}>
                    💡 {msg.text}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(15, 15, 35, 0.9)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleQuestion();
                  }
                }}
                placeholder="Yes/No で答えられる質問を入力... (⌘/Ctrl + Enter で送信)"
                disabled={!isActive || isLoading}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#e4e4e7',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              />
              <button
                onClick={handleQuestion}
                disabled={!isActive || isLoading || !userInput.trim()}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.3) 0%, rgba(255, 119, 168, 0.2) 100%)',
                  border: '1px solid rgba(120, 119, 198, 0.4)',
                  borderRadius: '8px',
                  color: '#e4e4e7',
                  cursor: !isActive || isLoading ? 'not-allowed' : 'pointer',
                  opacity: !isActive || isLoading || !userInput.trim() ? 0.5 : 1,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? '...' : '送信'}
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              {screen !== 'tutorial' && (
                <>
                  <button
                    onClick={handleHint}
                    disabled={hintLevel >= 3 || isLoading || !isActive}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '6px',
                      color: hintLevel >= 3 ? '#52525b' : '#fbbf24',
                      cursor: hintLevel >= 3 || isLoading || !isActive ? 'not-allowed' : 'pointer',
                      opacity: hintLevel >= 3 ? 0.5 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ヒント ({3 - hintLevel}回)
                  </button>
                  
                  <button
                    onClick={handleReveal}
                    disabled={progress < 90 || isLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
                      background: progress >= 90 
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.15) 100%)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: progress >= 90 
                        ? '1px solid rgba(16, 185, 129, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      color: progress >= 90 ? '#34d399' : '#52525b',
                      cursor: progress < 90 || isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    答えを言う {progress < 90 && `(${90 - progress}%不足)`}
                  </button>
                  
                  {hintLevel >= 3 && progress < 90 && (
                    <button
                      onClick={handleReveal}
                      disabled={isLoading}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.8rem',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '6px',
                        color: '#f87171',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: isLoading ? 0.5 : 1
                      }}
                    >
                      🏳️ 答えを見る
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          
          <style>{`
            @keyframes fadeSlideIn {
              from {
                opacity: 0;
                transform: translateY(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}

      {/* RESULT SCREEN */}
      {screen === 'result' && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Success decoration */}
          <div style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem',
            animation: 'popIn 0.5s ease'
          }}>
            🎉
          </div>
          
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: '300',
            letterSpacing: '0.15em',
            marginBottom: '0.5rem',
            color: '#e4e4e7'
          }}>
            SOLVED
          </h2>
          
          <p style={{
            fontSize: '1.2rem',
            color: '#7877c6',
            marginBottom: '2rem',
            letterSpacing: '0.1em'
          }}>
            {finalTitle}
          </p>
          
          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: '2rem',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#e4e4e7', fontWeight: '200' }}>{progress}%</div>
              <div style={{ fontSize: '0.75rem', color: '#71717a' }}>進捗</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#e4e4e7', fontWeight: '200' }}>{questionCount}</div>
              <div style={{ fontSize: '0.75rem', color: '#71717a' }}>質問数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#e4e4e7', fontWeight: '200' }}>{hintLevel}</div>
              <div style={{ fontSize: '0.75rem', color: '#71717a' }}>ヒント</div>
            </div>
          </div>
          
          {/* Truth */}
          <div style={{
            width: '100%',
            maxWidth: '400px',
            background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.8) 0%, rgba(25, 25, 45, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{
              fontSize: '0.85rem',
              color: '#71717a',
              marginBottom: '0.75rem',
              letterSpacing: '0.1em'
            }}>
              真相
            </h3>
            <p style={{
              fontSize: '0.95rem',
              lineHeight: 1.8,
              color: '#e4e4e7',
              whiteSpace: 'pre-wrap'
            }}>
              {truthText}
            </p>
          </div>
          
          {/* User guess section */}
          {!gradeResult && (
            <div style={{
              width: '100%',
              maxWidth: '400px',
              marginBottom: '2rem'
            }}>
              {!showGuessInput ? (
                <button
                  onClick={() => setShowGuessInput(true)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.85rem',
                    background: 'transparent',
                    border: '1px solid rgba(113, 113, 122, 0.4)',
                    borderRadius: '8px',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  自分の言葉で真相を説明してボーナスを狙う
                </button>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <textarea
                    value={userGuess}
                    onChange={e => setUserGuess(e.target.value)}
                    placeholder="あなたの推理を書いてください..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#e4e4e7',
                      resize: 'vertical',
                      minHeight: '80px',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                  <button
                    onClick={handleGradeGuess}
                    disabled={!userGuess.trim() || isLoading}
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.25) 0%, rgba(255, 119, 168, 0.15) 100%)',
                      border: '1px solid rgba(120, 119, 198, 0.4)',
                      borderRadius: '8px',
                      color: '#e4e4e7',
                      cursor: !userGuess.trim() || isLoading ? 'not-allowed' : 'pointer',
                      opacity: !userGuess.trim() || isLoading ? 0.5 : 1
                    }}
                  >
                    {isLoading ? '評価中...' : '評価する'}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Grade result */}
          {gradeResult && (
            <div style={{
              width: '100%',
              maxWidth: '400px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.05) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '1.5rem',
                color: '#34d399',
                marginBottom: '0.5rem'
              }}>
                一致度: {gradeResult.match}%
              </div>
              {gradeResult.bonus_title && (
                <div style={{
                  fontSize: '1rem',
                  color: '#fbbf24',
                  marginBottom: '0.5rem'
                }}>
                  🏆 {gradeResult.bonus_title}
                </div>
              )}
              {gradeResult.feedback && (
                <p style={{
                  fontSize: '0.85rem',
                  color: '#a1a1aa',
                  fontStyle: 'italic'
                }}>
                  {gradeResult.feedback}
                </p>
              )}
            </div>
          )}
          
          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setScreen('settings')}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.25) 0%, rgba(255, 119, 168, 0.15) 100%)',
                border: '1px solid rgba(120, 119, 198, 0.4)',
                borderRadius: '8px',
                color: '#e4e4e7',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              再挑戦
            </button>
            <button
              onClick={resetGame}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                background: 'transparent',
                border: '1px solid rgba(113, 113, 122, 0.4)',
                borderRadius: '8px',
                color: '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ホームへ
            </button>
          </div>
          
          <style>{`
            @keyframes popIn {
              0% { transform: scale(0); opacity: 0; }
              50% { transform: scale(1.2); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

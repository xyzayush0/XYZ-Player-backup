/**
 * OBSIDIAN MUSIC PLAYER — CORE APPLICATION LOGIC
 * High-performance Web Audio API, Canvas Visualizer & Synced Lyrics Engine
 */

import { TRACKS_DATA } from './tracks.js';
import { offlineStorage } from './offlineDb.js';

class ObsidianMusicApp {
  constructor() {
    this.tracks = [...TRACKS_DATA];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'off'; // 'off' | 'all' | 'one'
    this.likedTrackIds = new Set(JSON.parse(localStorage.getItem('obsidian_liked_tracks') || '[]'));
    this.activeFilter = 'all'; // 'all' | 'liked' | 'local' | playlistName
    this.visualizerMode = 'bars'; // 'bars' | 'circle' | 'wave' | 'particles'
    this.autoScrollLyrics = true;
    this.parsedLyrics = [];
    this.activeLyricIndex = -1;
    this.isMuted = false;
    this.previousVolume = 0.8;
    this.sleepTimerId = null;
    this.sleepTimerSeconds = 0;

    // YouTube Streaming
    this.ytPlayer = null;
    this.ytReady = false;
    this.ytApiLoaded = false;
    this.activeYtVideoId = null;
    this.isYoutubeTrackActive = false;
    this.isManuallyStoppingYt = false;
    this.isYtAudioOnlyHidden = false;
    this.miniplayerPos = null;
    this.offlineTracks = [];
    this.isDownloadingTrack = false;
    this.deferredPwaPrompt = null;
    try {
      const savedPos = localStorage.getItem('xyz_miniplayer_pos');
      if (savedPos) this.miniplayerPos = JSON.parse(savedPos);
    } catch(e) {}
    this.ytRecentStreams = JSON.parse(localStorage.getItem('obsidian_yt_recent') || '[]');
    this.ytPollIntervalId = null;

    // Direct YouTube Search & Dropdown State
    this.currentYtSearchResults = [];
    this.rawYtSearchResults = [];
    this.currentMusicFilter = 'music';
    this.filteredCount = 0;
    this.musicCount = 0;
    this.searchActiveTab = 'yt';
    this.searchDebounceTimer = null;
    this.searchHighlightedIndex = -1;
    this.isSearchOpen = false;

    // Web Audio API Context & Nodes
    this.audioContext = null;
    this.audioSourceNode = null;
    this.analyser = null;
    this.gainNode = null;
    this.eqNodes = [];
    this.isSynthFallbackActive = false;
    this.synthIntervalId = null;

    // Canvas Visualizer
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.particles = [];

    this.initDOM();
    this.initEventListeners();
    this.initPWA();
    this.loadTrack(0, false);
    this.renderQueue();
    this.updateLikedCounts();
    this.updateOfflineCounts();
  }

  getApiEndpoint(path) {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      const serverUrl = localStorage.getItem('xyz_server_url') || 'http://192.168.1.7:8080';
      return `${serverUrl.replace(/\/$/, '')}${path}`;
    }
    return path;
  }

  /* --------------------------------------------------------------------------
     DOM Initialization
     -------------------------------------------------------------------------- */
  initDOM() {
    // Native Audio
    this.audio = document.getElementById('nativeAudio');
    this.audio.volume = 0.8;

    // Canvas
    this.canvas = document.getElementById('visualizerCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Main Stage Elements
    this.artworkDisc = document.getElementById('artworkDisc');
    this.mainArtworkImg = document.getElementById('mainArtworkImg');
    this.headlineTitle = document.getElementById('headlineTitle');
    this.headlineArtist = document.getElementById('headlineArtist');
    this.headlineAlbum = document.getElementById('headlineAlbum');
    this.trackGenreTag = document.getElementById('trackGenreTag');
    this.trackBpmTag = document.getElementById('trackBpmTag');
    this.ambientGlow = document.getElementById('ambientGlow');
    this.synthIndicator = document.getElementById('synthIndicator');

    // Bottom Dock Elements
    this.dockThumbImg = document.getElementById('dockThumbImg');
    this.dockTitle = document.getElementById('dockTitle');
    this.dockArtist = document.getElementById('dockArtist');
    this.playBtn = document.getElementById('playBtn');
    this.playIcon = document.getElementById('playIcon');
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.shuffleBtn = document.getElementById('shuffleBtn');
    this.repeatBtn = document.getElementById('repeatBtn');
    this.repeatIcon = document.getElementById('repeatIcon');
    this.likeTrackBtn = document.getElementById('likeTrackBtn');
    this.heartIcon = document.getElementById('heartIcon');
    this.currentTimeLabel = document.getElementById('currentTimeLabel');
    this.durationLabel = document.getElementById('durationLabel');
    this.scrubberBar = document.getElementById('scrubberBar');
    this.scrubberPlayed = document.getElementById('scrubberPlayed');
    this.scrubberBuffered = document.getElementById('scrubberBuffered');
    this.scrubberTooltip = document.getElementById('scrubberTooltip');
    this.volumeSliderBar = document.getElementById('volumeSliderBar');
    this.volumeLevel = document.getElementById('volumeLevel');
    this.muteBtn = document.getElementById('muteBtn');
    this.volumeIcon = document.getElementById('volumeIcon');

    // Lyrics Elements
    this.lyricsContainer = document.getElementById('lyricsContainer');
    this.lyricsTrackName = document.getElementById('lyricsTrackName');
    this.lyricsNotice = document.getElementById('lyricsNotice');
    this.tabPlayerView = document.getElementById('tabPlayerView');
    this.tabLyricsView = document.getElementById('tabLyricsView');
    this.playerStageView = document.getElementById('playerStageView');
    this.lyricsStageView = document.getElementById('lyricsStageView');
    this.toggleAutoScrollBtn = document.getElementById('toggleAutoScrollBtn');

    // Sidebar & Queue
    this.queueList = document.getElementById('queueList');
    this.queueCount = document.getElementById('queueCount');
    this.countAll = document.getElementById('countAll');
    this.countLiked = document.getElementById('countLiked');
    this.countLocal = document.getElementById('countLocal');
    this.fileUploadInput = document.getElementById('fileUploadInput');
    this.dropZone = document.getElementById('dropZone');
    this.navSearchContainer = document.getElementById('navSearchContainer');
    this.searchInput = document.getElementById('searchInput');
    this.searchLoader = document.getElementById('searchLoader');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.ytSearchDropdown = document.getElementById('ytSearchDropdown');
    this.ytSearchResultsList = document.getElementById('ytSearchResultsList');
    this.ytSearchTabYt = document.getElementById('ytSearchTabYt');
    this.ytSearchTabLocal = document.getElementById('ytSearchTabLocal');
    this.ytResultCountBadge = document.getElementById('ytResultCountBadge');
    this.localResultCountBadge = document.getElementById('localResultCountBadge');
    this.ytSearchStatus = document.getElementById('ytSearchStatus');
    this.ytFilterBar = document.getElementById('ytFilterBar');
    this.ytSearchAddAllBtn = document.getElementById('ytSearchAddAllBtn');

    // Audio Fidelity Info Display
    this.fidelityBadge = document.getElementById('fidelityBadge');
    this.fidelitySpec = document.getElementById('fidelitySpec');
    this.fidelityDesc = document.getElementById('fidelityDesc');

    // Live Pill
    this.obsidianLivePill = document.getElementById('obsidianLivePill');
    this.pillArtworkImg = document.getElementById('pillArtworkImg');
    this.pillTitle = document.getElementById('pillTitle');
    this.pillArtist = document.getElementById('pillArtist');
    this.pillPlayBtn = document.getElementById('pillPlayBtn');
    this.pillPlayIcon = document.getElementById('pillPlayIcon');
    this.pillPrevBtn = document.getElementById('pillPrevBtn');
    this.pillNextBtn = document.getElementById('pillNextBtn');
    this.pillCloseBtn = document.getElementById('pillCloseBtn');
    this.toggleLivePillBtn = document.getElementById('toggleLivePillBtn');

    // Modals
    this.eqModalBackdrop = document.getElementById('eqModalBackdrop');
    this.timerModalBackdrop = document.getElementById('timerModalBackdrop');
    this.shortcutsModalBackdrop = document.getElementById('shortcutsModalBackdrop');
    this.youtubeModalBackdrop = document.getElementById('youtubeModalBackdrop');

    // YouTube Elements
    this.youtubeUrlInput = document.getElementById('youtubeUrlInput');
    this.youtubeAddBtn = document.getElementById('youtubeAddBtn');
    this.ytErrorMsg = document.getElementById('ytErrorMsg');
    this.ytErrorText = document.getElementById('ytErrorText');
    this.ytPlayerContainer = document.getElementById('ytPlayerContainer');
    this.ytRecentList = document.getElementById('ytRecentList');
    this.countYoutube = document.getElementById('countYoutube');
    this.ytStreamHost = document.getElementById('ytStreamHost');
    this.ytStreamHostTitle = document.getElementById('ytStreamHostTitle');
    this.ytDragHandle = document.getElementById('ytDragHandle');
    this.ytAudioOnlyBtn = document.getElementById('ytAudioOnlyBtn');
    this.ytMinimizeBtn = document.getElementById('ytMinimizeBtn');
    this.ytExpandSizeBtn = document.getElementById('ytExpandSizeBtn');
    this.ytExpandSizeIcon = document.getElementById('ytExpandSizeIcon');
    this.ytCloseStreamBtn = document.getElementById('ytCloseStreamBtn');
    this.ytStreamMinBar = document.getElementById('ytStreamMinBar');
    this.ytMinDragHandle = document.getElementById('ytMinDragHandle');
    this.ytMinInfoTrigger = document.getElementById('ytMinInfoTrigger');
    this.ytMinTitle = document.getElementById('ytMinTitle');
    this.ytMinPlayBtn = document.getElementById('ytMinPlayBtn');
    this.ytMinPlayIcon = document.getElementById('ytMinPlayIcon');
    this.ytMinExpandBtn = document.getElementById('ytMinExpandBtn');
    this.ytMinAudioOnlyBtn = document.getElementById('ytMinAudioOnlyBtn');
    this.ytMinCloseBtn = document.getElementById('ytMinCloseBtn');
    this.dockYtToggleBtn = document.getElementById('dockYtToggleBtn');
    this.dockYtToggleIcon = document.getElementById('dockYtToggleIcon');
    this.navOfflineTracks = document.getElementById('navOfflineTracks');
    this.countOffline = document.getElementById('countOffline');
    this.dockDownloadBtn = document.getElementById('dockDownloadBtn');
    this.dockDownloadIcon = document.getElementById('dockDownloadIcon');
    this.ytDownloadBtn = document.getElementById('ytDownloadBtn');
    this.ytDownloadIcon = document.getElementById('ytDownloadIcon');
    this.ytMinDownloadBtn = document.getElementById('ytMinDownloadBtn');
    this.ytMinDownloadIcon = document.getElementById('ytMinDownloadIcon');
    this.pwaInstallBanner = document.getElementById('pwaInstallBanner');
    this.pwaInstallBtn = document.getElementById('pwaInstallBtn');
    this.pwaDismissBtn = document.getElementById('pwaDismissBtn');
    this.offlineIndicator = document.getElementById('offlineIndicator');
    this.ytModalStreamingText = document.getElementById('ytModalStreamingText');

    // YouTube Music Signature Controls
    this.ytmPlayerHeader = document.getElementById('ytmPlayerHeader');
    this.ytmCollapseBtn = document.getElementById('ytmCollapseBtn');
    this.ytmSwitchSong = document.getElementById('ytmSwitchSong');
    this.ytmSwitchVideo = document.getElementById('ytmSwitchVideo');
    this.ytmStageVideoWrapper = document.getElementById('ytStageVideoWrapper');
    this.ytStageVideoFrame = document.getElementById('ytStageVideoFrame');
    this.ytmOptionsBtn = document.getElementById('ytmOptionsBtn');
    this.ytmLikeBtn = document.getElementById('ytmLikeBtn');
    this.ytmLikeIcon = document.getElementById('ytmLikeIcon');
    this.ytmDownloadBtn = document.getElementById('ytmDownloadBtn');
    this.ytmDownloadIcon = document.getElementById('ytmDownloadIcon');
    this.ytmDownloadLabel = document.getElementById('ytmDownloadLabel');
    this.ytmLyricsBtn = document.getElementById('ytmLyricsBtn');
    this.ytmQueueBtn = document.getElementById('ytmQueueBtn');
    this.ytmQueueBadge = document.getElementById('ytmQueueBadge');

    // Mobile Fullscreen Scrubber & Controls
    this.ytmCurrentTime = document.getElementById('ytmCurrentTime');
    this.ytmDuration = document.getElementById('ytmDuration');
    this.ytmScrubberBar = document.getElementById('ytmScrubberBar');
    this.ytmScrubberPlayed = document.getElementById('ytmScrubberPlayed');
    this.ytmScrubberBuffered = document.getElementById('ytmScrubberBuffered');
    this.ytmPlayBtn = document.getElementById('ytmPlayBtn');
    this.ytmPlayIcon = document.getElementById('ytmPlayIcon');
    this.ytmPrevBtn = document.getElementById('ytmPrevBtn');
    this.ytmNextBtn = document.getElementById('ytmNextBtn');
    this.ytmShuffleBtn = document.getElementById('ytmShuffleBtn');
    this.ytmShuffleIcon = document.getElementById('ytmShuffleIcon');
    this.ytmRepeatBtn = document.getElementById('ytmRepeatBtn');
    this.ytmRepeatIcon = document.getElementById('ytmRepeatIcon');
    this.mediaViewMode = 'song';
    this.mobilePlayerFullscreen = false;
  }

  /* --------------------------------------------------------------------------
     Canvas Setup & Particles
     -------------------------------------------------------------------------- */
  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    const count = Math.floor(this.canvas.width / 18);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        baseAlpha: Math.random() * 0.5 + 0.2
      });
    }
  }

  /* --------------------------------------------------------------------------
     Web Audio API Setup & 5-Band EQ
     -------------------------------------------------------------------------- */
  setupWebAudio() {
    if (this.audioContext) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();

      // Analyser Node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;

      // Master Gain
      this.gainNode = this.audioContext.createGain();

      // 5-Band EQ Setup
      const frequencies = [60, 250, 1000, 4000, 16000];
      const types = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

      this.eqNodes = frequencies.map((freq, index) => {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = types[index];
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // Chain EQ Filters
      for (let i = 0; i < this.eqNodes.length - 1; i++) {
        this.eqNodes[i].connect(this.eqNodes[i + 1]);
      }

      // Connect Native Audio element
      this.audioSourceNode = this.audioContext.createMediaElementSource(this.audio);
      this.audioSourceNode.connect(this.eqNodes[0]);
      this.eqNodes[this.eqNodes.length - 1].connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.startVisualizerLoop();
    } catch (err) {
      console.warn("Web Audio setup notice:", err);
    }
  }

  /* --------------------------------------------------------------------------
     Track Loading & Audio Routing
     -------------------------------------------------------------------------- */
  loadTrack(index, autoPlay = true) {
    if (index < 0 || index >= this.tracks.length) return;
    this.currentTrackIndex = index;
    const track = this.tracks[this.currentTrackIndex];

    // Update Stage UI
    this.headlineTitle.textContent = track.title;
    this.headlineArtist.textContent = track.artist;
    this.headlineAlbum.textContent = track.album || "XYZ Collection";
    this.trackGenreTag.textContent = track.genre || "Digital Audio";
    this.trackBpmTag.textContent = `${track.bpm || 120} BPM`;
    this.updateFidelityInfo(track);
    this.mainArtworkImg.src = track.coverArt;
    this.dockThumbImg.src = track.coverArt;
    this.pillArtworkImg.src = track.coverArt;
    this.lyricsTrackName.textContent = `${track.title} — ${track.artist}`;

    // Update Dock & Mobile Fullscreen Player UI
    this.dockTitle.textContent = track.title;
    this.dockArtist.textContent = track.artist;
    const durStr = this.formatTime(track.duration || 180);
    this.durationLabel.textContent = durStr;
    this.currentTimeLabel.textContent = "0:00";
    this.scrubberPlayed.style.width = "0%";
    if (this.ytmDuration) this.ytmDuration.textContent = durStr;
    if (this.ytmCurrentTime) this.ytmCurrentTime.textContent = "0:00";
    if (this.ytmScrubberPlayed) this.ytmScrubberPlayed.style.width = "0%";

    // Update Dynamic Colors & Ambient Glow
    const primaryColor = track.color || '#7F52FF';
    const accentColor = track.accentColor || '#00F2FE';
    document.documentElement.style.setProperty('--accent-primary', primaryColor);
    document.documentElement.style.setProperty('--accent-secondary', accentColor);
    document.documentElement.style.setProperty('--accent-glow', `${primaryColor}66`);

    // Update Liked status & Offline Cache status
    this.updateLikeButton();
    this.checkIfCurrentTrackIsCached();
    this.updateMediaSession(track);

    // Parse Lyrics
    this.parseAndRenderLyrics(track.lyrics || "");

    // Set Audio Source
    this.stopSynthFallback();

    // Stop YouTube playback if switching to a non-YouTube track
    if (!track.isYoutube) {
      this.stopYouTubePlayback();
      this.isYoutubeTrackActive = false;
      this.audio.src = track.audioUrl;
      this.setMediaViewMode('song');
    }

    if (autoPlay) {
      if (track.isYoutube) {
        this.streamYouTubeVideo(track.youtubeVideoId);
      } else {
        this.play();
      }
    } else {
      this.pause();
    }

    this.renderQueue();
  }

  updateFidelityInfo(track) {
    if (!this.fidelityBadge || !this.fidelitySpec || !this.fidelityDesc || !track) return;

    if (track.isYoutube) {
      this.fidelityBadge.innerHTML = '<i class="ri-youtube-fill" style="color: #FF0033;"></i> YOUTUBE HQ';
      this.fidelitySpec.textContent = 'Opus/AAC • 48kHz';
      this.fidelityDesc.textContent = 'High-bitrate compressed digital audio stream via YouTube Engine (~160kbps).';
    } else if (track.isLocal) {
      const isHiRes = track.fileType?.includes('flac') || track.fileType?.includes('wav');
      const sampleRate = this.audioContext ? Math.round(this.audioContext.sampleRate / 1000) : 48;
      if (isHiRes) {
        this.fidelityBadge.innerHTML = '<i class="ri-sparkling-fill" style="color: #00F5A0;"></i> HI-RES LOSSLESS';
        this.fidelitySpec.textContent = `24-Bit / ${sampleRate}kHz`;
        this.fidelityDesc.textContent = 'Bit-perfect lossless PCM/FLAC stream decoded locally in your browser.';
      } else {
        this.fidelityBadge.innerHTML = '<i class="ri-folder-music-line" style="color: #00F2FE;"></i> LOCAL AUDIO';
        this.fidelitySpec.textContent = `320kbps • ${sampleRate}kHz`;
        this.fidelityDesc.textContent = 'Imported local file processed through 32-bit floating point Web Audio engine.';
      }
    } else if (this.isSynthFallbackActive) {
      const sampleRate = this.audioContext ? Math.round(this.audioContext.sampleRate / 1000) : 48;
      this.fidelityBadge.innerHTML = '<i class="ri-cpu-line" style="color: #7F52FF;"></i> SYNTH ENGINE';
      this.fidelitySpec.textContent = `32-Bit Float • ${sampleRate}kHz`;
      this.fidelityDesc.textContent = 'Real-time procedural audio synthesis rendered via browser Web Audio API.';
    } else {
      // Demo preset MP3
      this.fidelityBadge.innerHTML = '<i class="ri-disc-line" style="color: #00F2FE;"></i> MP3 STREAM';
      this.fidelitySpec.textContent = '192kbps • 44.1kHz';
      this.fidelityDesc.textContent = 'Standard compressed web audio stream with 32-bit float EQ and dynamic filtering.';
    }
  }

  /* --------------------------------------------------------------------------
     Playback Controls (Play, Pause, Next, Prev, Shuffle, Repeat)
     -------------------------------------------------------------------------- */
  async play() {
    this.setupWebAudio();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (err) {
        // Native media playback can still work when the analyser cannot resume.
        console.warn('Audio context resume failed:', err);
      }
    }

    try {
      await this.audio.play();
      this.isPlaying = true;
      this.synthIndicator.style.display = 'none';
      this.onPlaybackStateChange();
    } catch (err) {
      console.warn("Direct audio playback failed or blocked; activating native Studio Synth fallback:", err);
      this.startSynthFallback();
    }
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.stopSynthFallback();
    this.onPlaybackStateChange();
  }

  togglePlay() {
    if (this.isYoutubeTrackActive) {
      if (this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
        try {
          const state = this.ytPlayer.getPlayerState();
          if (state === 1) { // YT.PlayerState.PLAYING
            this.ytPlayer.pauseVideo();
            this.isPlaying = false;
          } else {
            this.ytPlayer.playVideo();
            this.isPlaying = true;
          }
          this.onPlaybackStateChange();
          return;
        } catch(e) {}
      } else {
        const cur = this.tracks[this.currentTrackIndex];
        if (cur && cur.youtubeVideoId) {
          this.streamYouTubeVideo(cur.youtubeVideoId, cur);
          return;
        }
      }
    } else {
      // If currently selected track is a YouTube track, resume YouTube stream rather than default audio
      const cur = this.tracks[this.currentTrackIndex];
      if (cur && cur.isYoutube && cur.youtubeVideoId) {
        this.streamYouTubeVideo(cur.youtubeVideoId, cur);
        return;
      }
    }

    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  onPlaybackStateChange() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }

    if (this.isPlaying) {
      this.playIcon.className = 'ri-pause-fill';
      this.pillPlayIcon.className = 'ri-pause-mini-fill';
      if (this.ytMinPlayIcon) this.ytMinPlayIcon.className = 'ri-pause-mini-fill';
      if (this.ytmPlayIcon) this.ytmPlayIcon.className = 'ri-pause-fill';
      this.artworkDisc.classList.add('spinning');
    } else {
      this.playIcon.className = 'ri-play-fill';
      this.pillPlayIcon.className = 'ri-play-mini-fill';
      if (this.ytMinPlayIcon) this.ytMinPlayIcon.className = 'ri-play-mini-fill';
      if (this.ytmPlayIcon) this.ytmPlayIcon.className = 'ri-play-fill';
      this.artworkDisc.classList.remove('spinning');
    }
    this.renderQueue();
  }

  nextTrack() {
    if (this.isShuffle) {
      let nextIndex = Math.floor(Math.random() * this.tracks.length);
      if (this.tracks.length > 1 && nextIndex === this.currentTrackIndex) {
        nextIndex = (nextIndex + 1) % this.tracks.length;
      }
      this.loadTrack(nextIndex, true);
    } else {
      if (this.repeatMode === 'off' && this.currentTrackIndex === this.tracks.length - 1) {
        this.pause();
        this.showToast("Queue finished", "ri-stop-circle-line");
        return;
      }
      const nextIndex = (this.currentTrackIndex + 1) % this.tracks.length;
      this.loadTrack(nextIndex, true);
    }
  }

  prevTrack() {
    const curTime = (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady)
      ? (this.ytPlayer.getCurrentTime() || 0)
      : (this.audio.currentTime || 0);

    if (curTime > 3) {
      this.seekTo(0);
      return;
    }
    const prevIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.loadTrack(prevIndex, true);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.shuffleBtn.classList.toggle('active', this.isShuffle);
    if (this.ytmShuffleBtn) this.ytmShuffleBtn.classList.toggle('active', this.isShuffle);
    this.showToast(this.isShuffle ? "Shuffle Mode: Enabled" : "Shuffle Mode: Disabled", "ri-shuffle-line");
  }

  toggleRepeat() {
    if (this.repeatMode === 'off') {
      this.repeatMode = 'all';
      this.repeatBtn.classList.add('active');
      this.repeatIcon.className = 'ri-repeat-line';
      if (this.ytmRepeatBtn) this.ytmRepeatBtn.classList.add('active');
      if (this.ytmRepeatIcon) this.ytmRepeatIcon.className = 'ri-repeat-line';
      this.showToast("Repeat All Tracks", "ri-repeat-line");
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
      this.repeatBtn.classList.add('active');
      this.repeatIcon.className = 'ri-repeat-one-line';
      if (this.ytmRepeatBtn) this.ytmRepeatBtn.classList.add('active');
      if (this.ytmRepeatIcon) this.ytmRepeatIcon.className = 'ri-repeat-one-line';
      this.showToast("Repeat Current Track", "ri-repeat-one-line");
    } else {
      this.repeatMode = 'off';
      this.repeatBtn.classList.remove('active');
      this.repeatIcon.className = 'ri-repeat-line';
      if (this.ytmRepeatBtn) this.ytmRepeatBtn.classList.remove('active');
      if (this.ytmRepeatIcon) this.ytmRepeatIcon.className = 'ri-repeat-line';
      this.showToast("Repeat Mode: Off", "ri-repeat-line");
    }
  }

  /* --------------------------------------------------------------------------
     Studio Synthesizer Fallback (Generates Real Audio when offline/CORS)
     -------------------------------------------------------------------------- */
  startSynthFallback() {
    this.isSynthFallbackActive = true;
    this.isPlaying = true;
    this.synthIndicator.style.display = 'flex';
    this.onPlaybackStateChange();

    const track = this.tracks[this.currentTrackIndex];
    const bpm = track.bpm || 110;
    const intervalMs = (60 / bpm) * 1000 / 2; // 8th notes

    const noteFreqs = {
      "C4": 261.63, "D4": 293.66, "D#4": 311.13, "E4": 329.63, "F4": 349.23,
      "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "A#4": 466.16,
      "B4": 493.88, "C5": 523.25, "D#5": 622.25
    };

    const scale = track.scale || ["C4", "D#4", "F4", "G4", "A#4", "C5"];
    let step = 0;
    let simCurrentTime = 0;

    clearInterval(this.synthIntervalId);
    this.synthIntervalId = setInterval(() => {
      if (!this.isPlaying) return;

      simCurrentTime += (intervalMs / 1000);
      this.updateProgress(simCurrentTime, track.duration || 180);

      // Play Note via Web Audio
      if (this.audioContext && this.audioContext.state === 'running') {
        const osc = this.audioContext.createOscillator();
        const noteGain = this.audioContext.createGain();

        const noteKey = scale[step % scale.length];
        const freq = noteFreqs[noteKey] || 330;

        osc.type = (step % 4 === 0) ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

        noteGain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.35);

        osc.connect(noteGain);
        noteGain.connect(this.gainNode);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.36);

        // Sub bass kick on every 4 steps
        if (step % 4 === 0) {
          const kickOsc = this.audioContext.createOscillator();
          const kickGain = this.audioContext.createGain();
          kickOsc.frequency.setValueAtTime(130, this.audioContext.currentTime);
          kickOsc.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.2);
          kickGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
          kickGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
          kickOsc.connect(kickGain);
          kickGain.connect(this.gainNode);
          kickOsc.start();
          kickOsc.stop(this.audioContext.currentTime + 0.21);
        }
      }

      step++;
      if (simCurrentTime >= (track.duration || 180)) {
        this.onTrackEnded();
      }
    }, intervalMs);
  }

  stopSynthFallback() {
    this.isSynthFallbackActive = false;
    clearInterval(this.synthIntervalId);
    this.synthIntervalId = null;
    this.synthIndicator.style.display = 'none';
  }

  onTrackEnded() {
    if (this.repeatMode === 'one') {
      if (this.isYoutubeTrackActive && this.ytPlayer) {
        this.ytPlayer.seekTo(0);
        this.ytPlayer.playVideo();
      } else {
        this.audio.currentTime = 0;
        this.play();
      }
    } else {
      this.nextTrack();
    }
  }

  /* --------------------------------------------------------------------------
     YouTube Streaming Engine
     -------------------------------------------------------------------------- */
  loadYouTubeApi() {
    if (this.ytApiLoaded) return Promise.resolve();
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        this.ytApiLoaded = true;
        resolve();
        return;
      }
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => {
        this.ytApiLoaded = true;
        resolve();
      };
    });
  }

  extractYouTubeVideoId(url) {
    if (!url) return null;
    url = url.trim();

    // Direct video ID (11 chars alphanumeric + _ + -)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

    const patterns = [
      /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/.*[?&]v=)([a-zA-Z0-9_-]{11})/,
      /(?:music\.youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async streamYouTubeVideo(videoId, meta = {}) {
    // 1. Check if this track is cached in IndexedDB for instant offline playback
    try {
      const cached = await offlineStorage.getTrack(`yt-${videoId}`) || await offlineStorage.getTrack(videoId);
      if (cached && cached.audioBlob) {
        this.playOfflineCachedTrack(cached);
        return;
      }
    } catch(e) {}

    // 2. If not cached and network is offline, prevent broken iframe
    if (!navigator.onLine) {
      this.showToast("Offline Mode: Connect to stream or play tracks from Offline Songs", "ri-wifi-off-line");
      return;
    }

    await this.loadYouTubeApi();
    this.setupWebAudio();

    // Stop any current native playback
    this.audio.pause();
    this.audio.src = '';
    this.stopSynthFallback();
    this.stopYtPoll();

    this.activeYtVideoId = videoId;
    this.isYoutubeTrackActive = true;
    this.isManuallyStoppingYt = false;
    if (this.ytPlayerContainer) this.ytPlayerContainer.style.display = 'block';

    const trackTitle = meta.title || 'YouTube Stream';
    const trackArtist = meta.author || meta.artist || 'YouTube';
    const trackArt = meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const trackDuration = meta.durationSeconds || (meta.duration ? this.parseDurationToSeconds(meta.duration) : 0);

    // Show floating stream host
    if (this.ytStreamHost) {
      this.ytStreamHost.style.display = 'flex';
      if (!this.isYtAudioOnlyHidden) {
        this.ytStreamHost.classList.remove('audio-only-hidden');
      }
      this.applyMiniplayerSavedPosition();
    }
    if (this.dockYtToggleBtn) {
      this.dockYtToggleBtn.style.display = 'flex';
      this.dockYtToggleBtn.classList.toggle('active', !this.isYtAudioOnlyHidden);
      if (this.dockYtToggleIcon) {
        this.dockYtToggleIcon.className = this.isYtAudioOnlyHidden ? 'ri-tv-off-line' : 'ri-tv-line';
      }
    }
    if (this.ytStreamHostTitle) {
      this.ytStreamHostTitle.textContent = trackTitle;
    }
    if (this.ytMinTitle) {
      this.ytMinTitle.textContent = trackTitle;
    }

    // Ensure video player div exists inside stage video frame
    const stageFrame = document.getElementById('ytStageVideoFrame');
    const wrapper = document.getElementById('ytPlayerWrapper');
    if (stageFrame) {
      stageFrame.innerHTML = '<div id="youtubePlayer"></div>';
    } else if (wrapper && !document.getElementById('youtubePlayer')) {
      wrapper.innerHTML = '<div id="youtubePlayer"></div>';
    }

    // Create a track entry for the queue
    const ytTrack = {
      id: `yt-${videoId}`,
      title: trackTitle,
      artist: trackArtist,
      album: 'YouTube Stream',
      duration: trackDuration,
      genre: 'YouTube Stream',
      color: '#FF0033',
      accentColor: '#FF5577',
      audioUrl: '',
      isYoutube: true,
      youtubeVideoId: videoId,
      coverArt: trackArt,
      lyrics: `[00:00.00] Streaming: ${trackTitle}\n[00:05.00] Channel: ${trackArtist}\n[00:10.00] Video ID: ${videoId}\n[00:15.00] Audio streamed via YouTube IFrame API`
    };

    // Check if this track already exists
    const existingIdx = this.tracks.findIndex(t => t.id === `yt-${videoId}`);
    if (existingIdx >= 0) {
      this.tracks[existingIdx] = { ...this.tracks[existingIdx], ...ytTrack };
    } else {
      this.tracks.unshift(ytTrack);
    }

    const trackIndex = this.tracks.findIndex(t => t.id === `yt-${videoId}`);
    this.currentTrackIndex = trackIndex;

    // Update UI for the track
    this.headlineTitle.textContent = ytTrack.title;
    this.headlineArtist.textContent = ytTrack.artist;
    this.headlineAlbum.textContent = 'YouTube';
    this.trackGenreTag.textContent = 'YouTube Stream';
    this.trackBpmTag.textContent = 'LIVE';
    this.mainArtworkImg.src = ytTrack.coverArt;
    this.dockThumbImg.src = ytTrack.coverArt;
    this.pillArtworkImg.src = ytTrack.coverArt;
    this.lyricsTrackName.textContent = `${ytTrack.title} — ${ytTrack.artist}`;
    this.dockTitle.textContent = ytTrack.title;
    this.dockArtist.textContent = ytTrack.artist;
    this.pillTitle.textContent = ytTrack.title;
    this.pillArtist.textContent = ytTrack.artist;

    if (trackDuration > 0) {
      const durStr = this.formatTime(trackDuration);
      this.durationLabel.textContent = durStr;
      if (this.ytmDuration) this.ytmDuration.textContent = durStr;
    }
    if (this.ytmCurrentTime) this.ytmCurrentTime.textContent = "0:00";
    if (this.ytmScrubberPlayed) this.ytmScrubberPlayed.style.width = "0%";

    this.updateFidelityInfo(ytTrack);

    // Colors
    document.documentElement.style.setProperty('--accent-primary', '#FF0033');
    document.documentElement.style.setProperty('--accent-secondary', '#FF5577');
    document.documentElement.style.setProperty('--accent-glow', 'rgba(255, 0, 51, 0.4)');

    this.updateLikeButton();
    this.checkIfCurrentTrackIsCached();
    this.updateMediaSession(ytTrack);
    this.parseAndRenderLyrics(ytTrack.lyrics);

    // Apply current media view mode (Song or Video)
    this.setMediaViewMode(this.mediaViewMode || 'song');

    // On mobile, expand to fullscreen YouTube Music player
    if (window.innerWidth <= 768) {
      this.openMobileFullscreenPlayer();
    }

    // 1. Direct pristine audio stream via our backend proxy (bypasses all YouTube iframe blocks & Video Unavailable errors)
    const streamUrl = this.getApiEndpoint(`/api/stream?id=${encodeURIComponent(videoId)}`);
    this.audio.src = streamUrl;
    this.audio.load();
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.isPlaying = true;
        this.updatePlayPauseUI(true);
        this.startVisualizer();
      }).catch(err => {
        console.warn('Audio play initiated on user tap:', err);
      });
    }

    // 2. Also initialize floating/stage video iframe if available
    if (this.ytPlayer) {
      try { this.ytPlayer.destroy(); } catch(e) {}
      this.ytPlayer = null;
    }

    try {
      this.ytPlayer = new YT.Player('youtubePlayer', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => this.onYtPlayerReady(event),
          onStateChange: (event) => this.onYtStateChange(event),
          onError: (event) => this.onYtError(event)
        }
      });
    } catch(e) {
      console.warn('IFrame player optional init:', e);
    }

    // Save to recent streams
    this.saveYtRecentStream(videoId, meta);
    this.updateLikedCounts();
    this.renderQueue();
  }

  onYtPlayerReady(event) {
    this.ytReady = true;
    // Mute iframe audio so sound originates directly from our pristine Web Audio engine stream
    try { event.target.mute(); } catch(e) {}
    try { event.target.playVideo(); } catch(e) {}

    // Get video data for title if needed
    const videoData = event.target.getVideoData();
    const currentTrack = this.tracks[this.currentTrackIndex];
    if (videoData && videoData.title && currentTrack && currentTrack.isYoutube) {
      if (!currentTrack.title || currentTrack.title === 'YouTube Stream') {
        const title = videoData.title;
        currentTrack.title = title;
        currentTrack.artist = videoData.author || currentTrack.artist || 'YouTube';
        this.headlineTitle.textContent = title;
        this.headlineArtist.textContent = currentTrack.artist;
        this.dockTitle.textContent = title;
        this.dockArtist.textContent = currentTrack.artist;
        this.pillTitle.textContent = title;
        this.pillArtist.textContent = currentTrack.artist;
        this.lyricsTrackName.textContent = `${title} — ${currentTrack.artist}`;
        if (this.ytStreamHostTitle) this.ytStreamHostTitle.textContent = title;
        if (this.ytMinTitle) this.ytMinTitle.textContent = title;

        // Update recent stream with title
        this.updateYtRecentTitle(currentTrack.youtubeVideoId, title);
        this.renderYtRecentList();
        this.renderQueue();
      }
    }

    // Get duration
    const duration = event.target.getDuration();
    if (duration) {
      const currentTrack = this.tracks[this.currentTrackIndex];
      if (currentTrack) currentTrack.duration = duration;
      const durStr = this.formatTime(duration);
      this.durationLabel.textContent = durStr;
      if (this.ytmDuration) this.ytmDuration.textContent = durStr;
    }

    this.isPlaying = true;
    this.onPlaybackStateChange();

    // Start polling for time updates
    this.startYtPoll();

    this.showToast('YouTube stream connected', 'ri-youtube-line');
  }

  onYtStateChange(event) {
    switch (event.data) {
      case YT.PlayerState.PLAYING:
        this.isPlaying = true;
        this.onPlaybackStateChange();
        this.startYtPoll();
        break;
      case YT.PlayerState.PAUSED:
        this.isPlaying = false;
        this.onPlaybackStateChange();
        this.stopYtPoll();
        break;
      case YT.PlayerState.ENDED:
        this.isPlaying = false;
        this.stopYtPoll();
        this.onPlaybackStateChange();
        // NEVER advance track or redirect to default audio if user stopped stream manually!
        if (!this.isManuallyStoppingYt) {
          this.onTrackEnded();
        }
        break;
      case YT.PlayerState.BUFFERING:
        // Update buffered indicator if needed
        break;
    }
  }

  onYtError(event) {
    console.warn('YouTube IFrame embed notification:', event.data);
    if (event.data === 101 || event.data === 150) {
      // IFrame video is blocked by record label (VEVO, T-Series, Sony), but audio is streaming directly!
      this.showToast("Playing pristine studio audio (video embed disabled by label)", "ri-music-2-fill");
      if (this.ytStreamHost) this.ytStreamHost.classList.add('audio-only-hidden');
      return;
    }
    const msg = `Notice: Playing direct audio (${event.data})`;
    console.log(msg);
  }

  startYtPoll() {
    this.stopYtPoll();
    this.ytPollIntervalId = setInterval(() => {
      if (!this.ytPlayer || !this.isYoutubeTrackActive) {
        this.stopYtPoll();
        return;
      }
      try {
        const currentTime = this.ytPlayer.getCurrentTime() || 0;
        const duration = this.ytPlayer.getDuration() || 0;
        this.updateProgress(currentTime, duration);
      } catch(e) {}
    }, 250);
  }

  stopYtPoll() {
    if (this.ytPollIntervalId) {
      clearInterval(this.ytPollIntervalId);
      this.ytPollIntervalId = null;
    }
  }

  stopYouTubePlayback() {
    this.isManuallyStoppingYt = true;
    this.isYoutubeTrackActive = false;
    this.activeYtVideoId = null;
    this.stopYtPoll();
    if (this.ytPlayer) {
      try {
        this.ytPlayer.stopVideo();
        this.ytPlayer.destroy();
      } catch(e) {}
      this.ytPlayer = null;
      this.ytReady = false;
      // Re-create the div for future use
      const wrapper = document.getElementById('ytPlayerWrapper');
      if (wrapper) {
        wrapper.innerHTML = '<div id="youtubePlayer"></div>';
      }
    }
    if (this.ytStreamHost) {
      this.ytStreamHost.style.display = 'none';
      this.ytStreamHost.classList.remove('minimized');
      this.ytStreamHost.classList.remove('large-size');
      this.ytStreamHost.classList.remove('audio-only-hidden');
    }
    if (this.dockYtToggleBtn) {
      this.dockYtToggleBtn.style.display = 'none';
    }
    if (this.ytPlayerContainer) {
      this.ytPlayerContainer.style.display = 'none';
    }
    this.isPlaying = false;
    try {
      this.audio.pause();
    } catch(e) {}
    this.onPlaybackStateChange();

    setTimeout(() => {
      this.isManuallyStoppingYt = false;
    }, 600);
  }

  toggleYouTubeAudioOnly() {
    if (!this.ytStreamHost) return;
    this.isYtAudioOnlyHidden = !this.isYtAudioOnlyHidden;
    this.ytStreamHost.classList.toggle('audio-only-hidden', this.isYtAudioOnlyHidden);

    if (this.dockYtToggleBtn) {
      this.dockYtToggleBtn.classList.toggle('active', !this.isYtAudioOnlyHidden);
      this.dockYtToggleBtn.title = this.isYtAudioOnlyHidden 
        ? "Restore Floating Video Player" 
        : "Hide Video (Pure Audio Mode)";
    }
    if (this.dockYtToggleIcon) {
      this.dockYtToggleIcon.className = this.isYtAudioOnlyHidden ? 'ri-tv-off-line' : 'ri-tv-line';
    }

    if (this.isYtAudioOnlyHidden) {
      this.showToast("Miniplayer hidden • Music continues playing", "ri-headphone-line");
    } else {
      this.showToast("Miniplayer restored", "ri-tv-line");
      this.applyMiniplayerSavedPosition();
    }
  }

  minimizeYouTubeStream(minimized = true) {
    if (!this.ytStreamHost) return;
    if (minimized) {
      this.ytStreamHost.classList.add('minimized');
      this.showToast("YouTube minimized to floating pill (drag anywhere!)", "ri-subtract-line");
    } else {
      this.ytStreamHost.classList.remove('minimized');
      this.showToast("YouTube player expanded", "ri-arrow-up-s-line");
    }
    setTimeout(() => this.applyMiniplayerSavedPosition(), 40);
  }

  toggleYouTubeSize() {
    if (!this.ytStreamHost) return;
    this.ytStreamHost.classList.toggle('large-size');
    const isLarge = this.ytStreamHost.classList.contains('large-size');
    if (this.ytExpandSizeIcon) {
      this.ytExpandSizeIcon.className = isLarge ? 'ri-aspect-ratio-fill' : 'ri-aspect-ratio-line';
    }
    this.showToast(isLarge ? "Theater size enabled" : "Standard size restored", "ri-aspect-ratio-line");
    setTimeout(() => this.applyMiniplayerSavedPosition(), 40);
  }

  /* --------------------------------------------------------------------------
     Draggable Miniplayer Engine (Smooth Drag & Reposition Anywhere on Viewport)
     -------------------------------------------------------------------------- */
  setupDraggableMiniplayer() {
    if (!this.ytStreamHost) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    const onStart = (e) => {
      // Don't drag if clicking action buttons or interactive elements
      if (e.target.closest('button') || e.target.closest('input')) return;

      // Only allow drag if initiated from header, minimized bar, drag handles, or info container
      const isHeader = e.target.closest('.yt-stream-header');
      const isPill = e.target.closest('.yt-stream-min-bar');
      const isHandle = e.target.closest('.yt-drag-handle, .yt-min-drag-handle');
      if (!isHeader && !isPill && !isHandle) return;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const rect = this.ytStreamHost.getBoundingClientRect();
      startX = clientX;
      startY = clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      hasMoved = false;
      isDragging = true;

      this.ytStreamHost.classList.add('is-dragging');

      // Crucial: disable iframe pointer events during drag so cursor is never stolen by cross-origin iframe
      const embed = document.getElementById('ytPlayerWrapper');
      if (embed) embed.style.pointerEvents = 'none';

      document.addEventListener('mousemove', onMove, { passive: false });
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      // Clamping within viewport
      const hostWidth = this.ytStreamHost.offsetWidth || 320;
      const hostHeight = this.ytStreamHost.offsetHeight || 44;
      const minLeft = 12;
      const maxLeft = Math.max(minLeft, window.innerWidth - hostWidth - 12);
      const minTop = 64; // below navbar
      const maxTop = Math.max(minTop, window.innerHeight - hostHeight - 88); // above bottom player dock

      newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
      newTop = Math.max(minTop, Math.min(newTop, maxTop));

      this.ytStreamHost.style.left = `${newLeft}px`;
      this.ytStreamHost.style.top = `${newTop}px`;
      this.ytStreamHost.style.right = 'auto';
      this.ytStreamHost.style.bottom = 'auto';

      this.miniplayerPos = { left: newLeft, top: newTop };
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      this.ytStreamHost.classList.remove('is-dragging');

      const embed = document.getElementById('ytPlayerWrapper');
      if (embed) embed.style.pointerEvents = '';

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);

      if (hasMoved && this.miniplayerPos) {
        try {
          localStorage.setItem('xyz_miniplayer_pos', JSON.stringify(this.miniplayerPos));
        } catch(e) {}
      }
    };

    this.ytStreamHost.addEventListener('mousedown', onStart);
    this.ytStreamHost.addEventListener('touchstart', onStart, { passive: true });

    // Double-click drag handles to reset position back to default
    const resetPosition = (e) => {
      e.stopPropagation();
      this.resetMiniplayerPosition();
    };
    if (this.ytDragHandle) this.ytDragHandle.addEventListener('dblclick', resetPosition);
    if (this.ytMinDragHandle) this.ytMinDragHandle.addEventListener('dblclick', resetPosition);
  }

  applyMiniplayerSavedPosition() {
    if (!this.ytStreamHost) return;
    if (this.miniplayerPos && typeof this.miniplayerPos.left === 'number') {
      const hostWidth = this.ytStreamHost.offsetWidth || 320;
      const hostHeight = this.ytStreamHost.offsetHeight || 44;
      const minLeft = 12;
      const maxLeft = Math.max(minLeft, window.innerWidth - hostWidth - 12);
      const minTop = 64;
      const maxTop = Math.max(minTop, window.innerHeight - hostHeight - 88);

      const clampedX = Math.max(minLeft, Math.min(this.miniplayerPos.left, maxLeft));
      const clampedY = Math.max(minTop, Math.min(this.miniplayerPos.top, maxTop));

      this.ytStreamHost.style.left = `${clampedX}px`;
      this.ytStreamHost.style.top = `${clampedY}px`;
      this.ytStreamHost.style.right = 'auto';
      this.ytStreamHost.style.bottom = 'auto';
    }
  }

  resetMiniplayerPosition() {
    if (!this.ytStreamHost) return;
    this.miniplayerPos = null;
    try {
      localStorage.removeItem('xyz_miniplayer_pos');
    } catch(e) {}
    this.ytStreamHost.style.left = '';
    this.ytStreamHost.style.top = '';
    this.ytStreamHost.style.right = '28px';
    this.ytStreamHost.style.bottom = '140px';
    this.showToast("Miniplayer reset to default position", "ri-refresh-line");
  }

  showYtError(message) {
    this.ytErrorText.textContent = message;
    this.ytErrorMsg.style.display = 'flex';
    setTimeout(() => {
      this.ytErrorMsg.style.display = 'none';
    }, 5000);
  }

  // Recent Streams Management
  saveYtRecentStream(videoId, meta = {}) {
    // Remove if already in list
    this.ytRecentStreams = this.ytRecentStreams.filter(s => s.videoId !== videoId);
    // Add to front
    this.ytRecentStreams.unshift({
      videoId,
      title: meta.title || `YouTube Stream (${videoId})`,
      author: meta.author || meta.artist || 'YouTube',
      thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: meta.duration || '',
      timestamp: Date.now()
    });
    // Keep last 15
    this.ytRecentStreams = this.ytRecentStreams.slice(0, 15);
    localStorage.setItem('obsidian_yt_recent', JSON.stringify(this.ytRecentStreams));
    this.renderYtRecentList();
  }

  updateYtRecentTitle(videoId, title) {
    const item = this.ytRecentStreams.find(s => s.videoId === videoId);
    if (item) {
      item.title = title;
      localStorage.setItem('obsidian_yt_recent', JSON.stringify(this.ytRecentStreams));
    }
  }

  clearYtRecentStreams() {
    this.ytRecentStreams = [];
    localStorage.removeItem('obsidian_yt_recent');
    this.renderYtRecentList();
    this.showToast('YouTube stream history cleared', 'ri-delete-bin-line');
  }

  renderYtRecentList() {
    if (!this.ytRecentList) return;

    if (this.ytRecentStreams.length === 0) {
      this.ytRecentList.innerHTML = `
        <div class="yt-recent-empty">
          <i class="ri-youtube-line"></i>
          <span>No recent streams yet</span>
        </div>
      `;
      return;
    }

    this.ytRecentList.innerHTML = this.ytRecentStreams.map(stream => `
      <div class="yt-recent-item" data-video-id="${stream.videoId}">
        <img class="yt-recent-thumb" src="${stream.thumbnail || `https://i.ytimg.com/vi/${stream.videoId}/hqdefault.jpg`}" alt="Thumbnail" onerror="this.src='https://i.ytimg.com/vi/${stream.videoId}/default.jpg'">
        <div class="yt-recent-info">
          <div class="yt-recent-title">${this.escapeHtml(stream.title)}</div>
          <div class="yt-recent-id">${this.escapeHtml(stream.author || stream.videoId)}${stream.duration ? ` &bull; ${stream.duration}` : ''}</div>
        </div>
        <i class="ri-play-circle-fill yt-recent-play-icon"></i>
      </div>
    `).join('');

    // Attach click events
    this.ytRecentList.querySelectorAll('.yt-recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const videoId = item.dataset.videoId;
        const stream = this.ytRecentStreams.find(s => s.videoId === videoId);
        this.youtubeUrlInput.value = `https://youtube.com/watch?v=${videoId}`;
        this.streamYouTubeVideo(videoId, stream || {});
      });
    });
  }

  /* --------------------------------------------------------------------------
     Real-Time Synced Lyrics Parser & Renderer
     -------------------------------------------------------------------------- */
  parseAndRenderLyrics(lrcText) {
    this.parsedLyrics = [];
    this.lyricsContainer.innerHTML = '';
    this.activeLyricIndex = -1;

    if (!lrcText || !lrcText.trim()) {
      this.lyricsContainer.innerHTML = `<div class="lyric-line" style="color: var(--text-muted);">Instrumental / No synced lyrics available</div>`;
      return;
    }

    const lines = lrcText.split('\n');
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

    lines.forEach((line) => {
      const match = regex.exec(line);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = parseFloat('0.' + match[3]);
        const time = min * 60 + sec + ms;
        const text = match[4].trim();
        if (text) {
          this.parsedLyrics.push({ time, text });
        }
      }
    });

    this.parsedLyrics.sort((a, b) => a.time - b.time);

    // Create DOM Elements
    this.parsedLyrics.forEach((lyric, idx) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'lyric-line';
      lineEl.dataset.index = idx;
      lineEl.dataset.time = lyric.time;
      lineEl.textContent = lyric.text;

      // Click to seek to that lyric point!
      lineEl.addEventListener('click', () => {
        this.seekTo(lyric.time);
      });

      this.lyricsContainer.appendChild(lineEl);
    });
  }

  updateLyrics(currentTime) {
    if (!this.parsedLyrics.length) return;

    let newIndex = -1;
    for (let i = 0; i < this.parsedLyrics.length; i++) {
      if (currentTime >= this.parsedLyrics[i].time) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== this.activeLyricIndex) {
      this.activeLyricIndex = newIndex;
      const allLines = this.lyricsContainer.querySelectorAll('.lyric-line');
      allLines.forEach((el, idx) => {
        if (idx === this.activeLyricIndex) {
          el.classList.add('active');
          if (this.autoScrollLyrics) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          el.classList.remove('active');
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     Canvas Visualizer Engine (Bars, Circle, Wave, Particles)
     -------------------------------------------------------------------------- */
  startVisualizerLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      if (!this.ctx) return;

      const width = this.canvas.width;
      const height = this.canvas.height;
      this.ctx.clearRect(0, 0, width, height);

      let dataArray = new Uint8Array(64);
      if (this.isYoutubeTrackActive && this.isPlaying) {
        // High-energy procedural audio spectrum for YouTube stream
        const time = Date.now() * 0.005;
        dataArray = new Uint8Array(64);
        for (let i = 0; i < 64; i++) {
          const bass = Math.sin(time * 3) > 0.3 ? Math.sin(time * 3) * 140 : 25;
          const mid = Math.sin(time * 5 + i * 0.4) * 60 + 80;
          const high = Math.cos(time * 7 + i * 0.6) * 40 + 50;
          const beat = (i < 8) ? bass + Math.random() * 40 : (i < 32 ? mid + Math.random() * 30 : high + Math.random() * 20);
          dataArray[i] = Math.max(10, Math.min(255, Math.floor(beat)));
        }
      } else if (this.analyser && this.isPlaying) {
        dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
      } else {
        // Subtle ambient idle motion
        const time = Date.now() * 0.002;
        for (let i = 0; i < 64; i++) {
          dataArray[i] = Math.sin(time + i * 0.15) * 15 + 20;
        }
      }

      // Draw Selected Visualizer Mode
      switch (this.visualizerMode) {
        case 'bars':
          this.drawBarsVisualizer(dataArray, width, height);
          break;
        case 'circle':
          this.drawCircleVisualizer(dataArray, width, height);
          break;
        case 'wave':
          this.drawWaveVisualizer(dataArray, width, height);
          break;
        case 'particles':
          this.drawParticlesVisualizer(dataArray, width, height);
          break;
      }
    };

    render();
  }

  drawBarsVisualizer(dataArray, width, height) {
    const barsCount = 48;
    const barWidth = (width / barsCount) * 0.7;
    const gap = (width / barsCount) * 0.3;
    const currentTrack = this.tracks[this.currentTrackIndex];
    const primaryColor = currentTrack?.color || '#7F52FF';
    const accentColor = currentTrack?.accentColor || '#00F2FE';

    for (let i = 0; i < barsCount; i++) {
      const dataIndex = Math.floor((i / barsCount) * dataArray.length * 0.7);
      const val = dataArray[dataIndex] || 0;
      const barHeight = Math.max(4, (val / 255) * (height * 0.65));

      const x = i * (barWidth + gap) + gap / 2;
      const y = height - barHeight;

      const grad = this.ctx.createLinearGradient(0, y, 0, height);
      grad.addColorStop(0, accentColor);
      grad.addColorStop(1, primaryColor);

      this.ctx.fillStyle = grad;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = primaryColor;

      // Rounded top bars
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      this.ctx.fill();

      // Mirror reflection below
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      this.ctx.fillRect(x, height, barWidth, barHeight * 0.2);
    }
    this.ctx.shadowBlur = 0;
  }

  drawCircleVisualizer(dataArray, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = 140;
    const raysCount = 64;
    const currentTrack = this.tracks[this.currentTrackIndex];
    const accentColor = currentTrack?.accentColor || '#00F2FE';

    this.ctx.save();
    this.ctx.translate(centerX, centerY);

    for (let i = 0; i < raysCount; i++) {
      const angle = (i / raysCount) * Math.PI * 2;
      const dataIndex = Math.floor((i / raysCount) * dataArray.length * 0.8);
      const val = dataArray[dataIndex] || 0;
      const rayLength = (val / 255) * 80;

      const x1 = Math.cos(angle) * baseRadius;
      const y1 = Math.sin(angle) * baseRadius;
      const x2 = Math.cos(angle) * (baseRadius + rayLength);
      const y2 = Math.sin(angle) * (baseRadius + rayLength);

      this.ctx.strokeStyle = accentColor;
      this.ctx.lineWidth = 3;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = accentColor;

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }

  drawWaveVisualizer(dataArray, width, height) {
    const currentTrack = this.tracks[this.currentTrackIndex];
    const primaryColor = currentTrack?.color || '#7F52FF';
    const accentColor = currentTrack?.accentColor || '#00F2FE';

    this.ctx.beginPath();
    this.ctx.lineWidth = 4;
    const grad = this.ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, primaryColor);
    grad.addColorStop(0.5, accentColor);
    grad.addColorStop(1, primaryColor);

    this.ctx.strokeStyle = grad;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowColor = accentColor;

    const sliceWidth = width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  drawParticlesVisualizer(dataArray, width, height) {
    const currentTrack = this.tracks[this.currentTrackIndex];
    const accentColor = currentTrack?.accentColor || '#00F2FE';

    // Calculate average energy
    let sum = 0;
    for (let i = 0; i < 32; i++) sum += dataArray[i] || 0;
    const energy = sum / 32 / 255;

    this.particles.forEach((p) => {
      p.x += p.speedX * (1 + energy * 4);
      p.y += p.speedY * (1 + energy * 4);

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      const dynamicRadius = p.radius * (1 + energy * 2);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, dynamicRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = accentColor;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = accentColor;
      this.ctx.globalAlpha = p.baseAlpha + energy * 0.4;
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
  }

  /* --------------------------------------------------------------------------
     Queue & Library Management
     -------------------------------------------------------------------------- */
  renderQueue() {
    if (this.activeFilter === 'offline') {
      this.renderOfflineQueue();
      return;
    }

    let filtered = this.tracks;

    if (this.activeFilter === 'liked') {
      filtered = this.tracks.filter(t => this.likedTrackIds.has(t.id));
    } else if (this.activeFilter === 'local') {
      filtered = this.tracks.filter(t => t.isLocal);
    } else if (this.activeFilter === 'youtube') {
      filtered = this.tracks.filter(t => t.isYoutube);
    } else if (this.activeFilter !== 'all') {
      filtered = this.tracks.filter(t => t.album === this.activeFilter || t.genre?.includes(this.activeFilter));
    }

    // Only filter the main queue if search dropdown is closed or explicitly in library tab
    if (!this.isSearchOpen || this.searchActiveTab === 'local') {
      const searchQuery = this.searchInput.value.trim().toLowerCase();
      if (searchQuery) {
        filtered = filtered.filter(t =>
          t.title.toLowerCase().includes(searchQuery) ||
          t.artist.toLowerCase().includes(searchQuery) ||
          t.album?.toLowerCase().includes(searchQuery)
        );
      }
    }

    this.queueCount.textContent = `${filtered.length} tracks`;
    const mobileQueueBadge = document.getElementById('mobileQueueNavBadge');
    if (mobileQueueBadge) mobileQueueBadge.textContent = filtered.length;
    if (this.ytmQueueBadge) this.ytmQueueBadge.textContent = filtered.length;
    this.queueList.innerHTML = '';

    if (filtered.length === 0) {
      this.queueList.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.82rem;">No tracks found</div>`;
      return;
    }

    filtered.forEach((track) => {
      const item = document.createElement('div');
      item.className = 'queue-item';
      const actualIndex = this.tracks.findIndex(t => t.id === track.id);
      const isCurrent = actualIndex === this.currentTrackIndex;

      if (isCurrent) {
        item.classList.add('active');
      }

      item.innerHTML = `
        <img src="${track.coverArt}" alt="${track.title}" class="queue-thumb">
        <div class="queue-item-info">
          <div class="queue-item-title">${track.title}${track.isYoutube ? ' <span class="yt-badge"><i class="ri-youtube-line"></i> YT</span>' : ''}</div>
          <div class="queue-item-artist">${track.artist}</div>
        </div>
        <div class="queue-item-right">
          <div class="queue-playing-indicator">
            <span></span><span></span><span></span>
          </div>
          <span class="queue-duration">${this.formatTime(track.duration || 180)}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        this.loadTrack(actualIndex, true);
      });

      this.queueList.appendChild(item);
    });
  }

  updateLikedCounts() {
    this.countAll.textContent = this.tracks.length;
    this.countLiked.textContent = this.likedTrackIds.size;
    this.countLocal.textContent = this.tracks.filter(t => t.isLocal).length;
    if (this.countYoutube) {
      this.countYoutube.textContent = this.tracks.filter(t => t.isYoutube).length;
    }
  }

  toggleLikeCurrentTrack() {
    const currentTrack = this.tracks[this.currentTrackIndex];
    if (!currentTrack) return;

    if (this.likedTrackIds.has(currentTrack.id)) {
      this.likedTrackIds.delete(currentTrack.id);
      this.showToast(`Removed from Liked Songs`, "ri-heart-line");
    } else {
      this.likedTrackIds.add(currentTrack.id);
      this.showToast(`Saved to Liked Songs ❤️`, "ri-heart-fill");
    }

    localStorage.setItem('obsidian_liked_tracks', JSON.stringify([...this.likedTrackIds]));
    this.updateLikeButton();
    this.updateLikedCounts();
    if (this.activeFilter === 'liked') this.renderQueue();
  }

  updateLikeButton() {
    const currentTrack = this.tracks[this.currentTrackIndex];
    if (!currentTrack) return;
    const isLiked = this.likedTrackIds.has(currentTrack.id);

    if (isLiked) {
      if (this.likeTrackBtn) this.likeTrackBtn.classList.add('liked');
      if (this.heartIcon) this.heartIcon.className = 'ri-heart-fill';
      if (this.ytmLikeBtn) this.ytmLikeBtn.classList.add('liked');
      if (this.ytmLikeIcon) this.ytmLikeIcon.className = 'ri-thumb-up-fill';
    } else {
      if (this.likeTrackBtn) this.likeTrackBtn.classList.remove('liked');
      if (this.heartIcon) this.heartIcon.className = 'ri-heart-line';
      if (this.ytmLikeBtn) this.ytmLikeBtn.classList.remove('liked');
      if (this.ytmLikeIcon) this.ytmLikeIcon.className = 'ri-thumb-up-line';
    }
  }

  /* --------------------------------------------------------------------------
     Local Audio Import (Drag & Drop + File Input)
     -------------------------------------------------------------------------- */
  handleAudioUpload(files) {
    if (!files || !files.length) return;

    let addedCount = 0;
    Array.from(files).forEach((file) => {
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac|webm)$/i.test(file.name);
      if (!isAudio) return;

      const blobUrl = URL.createObjectURL(file);
      const nameClean = file.name.replace(/\.[^/.]+$/, "");
      const [artistGuess, titleGuess] = nameClean.includes(' - ') ? nameClean.split(' - ') : ['Local Artist', nameClean];

      const newTrack = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: titleGuess.trim(),
        artist: artistGuess.trim(),
        album: "Local Storage Vault",
        duration: 180,
        genre: "Imported Audio",
        color: "#00F2FE",
        accentColor: "#7F52FF",
        audioUrl: blobUrl,
        isLocal: true,
        coverArt: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="%23121520"/><circle cx="300" cy="300" r="160" fill="none" stroke="%2300f2fe" stroke-width="4"/><text x="300" y="320" font-family="sans-serif" font-weight="800" font-size="28" fill="%23ffffff" text-anchor="middle">LOCAL FILE</text></svg>`,
        lyrics: `[00:00.00] Playing local imported track\n[00:05.00] ${file.name}\n[00:15.00] Native lossless decoding active`
      };

      this.tracks.unshift(newTrack);
      addedCount++;
    });

    if (addedCount > 0) {
      this.updateLikedCounts();
      this.loadTrack(0, true);
      this.showToast(`Imported ${addedCount} audio file(s) into XYZ Player`, "ri-check-line");
    }
  }

  /* --------------------------------------------------------------------------
     Scrubber & Timing
     -------------------------------------------------------------------------- */
  updateProgress(currentTime, duration) {
    if (!this.isScrubbing) {
      const curStr = this.formatTime(currentTime);
      this.currentTimeLabel.textContent = curStr;
      if (this.ytmCurrentTime) this.ytmCurrentTime.textContent = curStr;

      if (duration && !isNaN(duration) && duration > 0) {
        const durStr = this.formatTime(duration);
        this.durationLabel.textContent = durStr;
        if (this.ytmDuration) this.ytmDuration.textContent = durStr;

        const percent = (currentTime / duration) * 100;
        const clampedPercent = `${Math.min(100, Math.max(0, percent))}%`;
        this.scrubberPlayed.style.width = clampedPercent;
        if (this.ytmScrubberPlayed) this.ytmScrubberPlayed.style.width = clampedPercent;

        const mobileBar = document.getElementById('mobileMiniplayerBar');
        if (mobileBar) {
          mobileBar.style.width = clampedPercent;
        }
      }
    }
    this.updateLyrics(currentTime);
  }

  seekTo(seconds) {
    const curTrack = this.tracks[this.currentTrackIndex] || {};
    if (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady) {
      try {
        const dur = this.ytPlayer.getDuration() || curTrack.duration || 180;
        const clamped = Math.max(0, Math.min(seconds, dur));
        this.ytPlayer.seekTo(clamped, true);
        this.updateProgress(clamped, dur);
      } catch(e) {}
      return;
    }

    const dur = this.audio.duration || curTrack.duration || 180;
    const clamped = Math.max(0, Math.min(seconds, dur));
    try {
      this.audio.currentTime = clamped;
    } catch(e) {}
    this.updateProgress(clamped, dur);
  }

  setVolume(ratio) {
    ratio = Math.max(0, Math.min(1, ratio));
    this.audio.volume = ratio;
    this.volumeLevel.style.width = `${ratio * 100}%`;
    this.isMuted = ratio === 0;
    this.volumeIcon.className = ratio === 0 ? 'ri-volume-mute-line' : (ratio < 0.5 ? 'ri-volume-down-line' : 'ri-volume-up-line');

    if (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady) {
      try {
        if (ratio === 0) {
          this.ytPlayer.mute();
        } else {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(ratio * 100);
        }
      } catch(e) {}
    }
  }

  formatTime(secs) {
    if (isNaN(secs) || secs < 0) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  /* --------------------------------------------------------------------------
     Sleep Timer
     -------------------------------------------------------------------------- */
  startSleepTimer(minutes) {
    this.clearSleepTimer();
    this.sleepTimerSeconds = minutes * 60;
    const badge = document.getElementById('timerBadge');
    const countdown = document.getElementById('timerCountdown');
    const statusRow = document.getElementById('timerStatusRow');

    badge.style.display = 'block';
    badge.textContent = `${minutes}m`;
    statusRow.style.display = 'flex';
    countdown.textContent = this.formatTime(this.sleepTimerSeconds);

    this.showToast(`Sleep Timer set for ${minutes} minutes`, "ri-timer-line");

    this.sleepTimerId = setInterval(() => {
      this.sleepTimerSeconds--;
      countdown.textContent = this.formatTime(this.sleepTimerSeconds);
      badge.textContent = `${Math.ceil(this.sleepTimerSeconds / 60)}m`;

      // Last 10 seconds: gentle fade out
      if (this.sleepTimerSeconds <= 10 && this.sleepTimerSeconds > 0) {
        this.audio.volume = Math.max(0, this.audio.volume - 0.08);
      }

      if (this.sleepTimerSeconds <= 0) {
        this.clearSleepTimer();
        this.pause();
        this.audio.volume = this.previousVolume;
        this.showToast("Sleep Timer completed — playback paused", "ri-moon-line");
      }
    }, 1000);
  }

  clearSleepTimer() {
    if (this.sleepTimerId) {
      clearInterval(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    document.getElementById('timerBadge').style.display = 'none';
    document.getElementById('timerStatusRow').style.display = 'none';
    document.querySelectorAll('.timer-opt-btn').forEach(btn => btn.classList.remove('active'));
  }

  /* --------------------------------------------------------------------------
     Toast Notification System
     -------------------------------------------------------------------------- */
  showToast(message, iconClass = "ri-information-line") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  /* --------------------------------------------------------------------------
     Event Listeners
     -------------------------------------------------------------------------- */
  initEventListeners() {
    // Playback events
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.pillPlayBtn.addEventListener('click', () => this.togglePlay());
    this.nextBtn.addEventListener('click', () => this.nextTrack());
    this.pillNextBtn.addEventListener('click', () => this.nextTrack());
    this.prevBtn.addEventListener('click', () => this.prevTrack());
    this.pillPrevBtn.addEventListener('click', () => this.prevTrack());
    this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
    this.likeTrackBtn.addEventListener('click', () => this.toggleLikeCurrentTrack());

    // Vinyl Disc Center Artwork Click (Play/Pause)
    if (this.artworkDisc) {
      this.artworkDisc.addEventListener('click', () => this.togglePlay());
    }

    // Native audio events
    this.audio.addEventListener('timeupdate', () => {
      this.updateProgress(this.audio.currentTime, this.audio.duration);
    });

    this.audio.addEventListener('ended', () => {
      this.onTrackEnded();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      const dur = this.audio.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        const curTrack = this.tracks[this.currentTrackIndex];
        if (curTrack && !curTrack.isYoutube) {
          curTrack.duration = dur;
        }
        this.durationLabel.textContent = this.formatTime(dur);
        this.updateProgress(this.audio.currentTime, dur);
      }
    });

    // Scrubber click & smooth drag seek
    this.isScrubbing = false;

    const getScrubberRatio = (clientX) => {
      const rect = this.scrubberBar.getBoundingClientRect();
      const clickX = clientX - rect.left;
      return Math.max(0, Math.min(1, clickX / rect.width));
    };

    const handleScrubMove = (clientX) => {
      const ratio = getScrubberRatio(clientX);
      const rect = this.scrubberBar.getBoundingClientRect();
      const currentTrack = this.tracks[this.currentTrackIndex] || {};
      const duration = (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady)
        ? (this.ytPlayer.getDuration() || currentTrack.duration || 180)
        : (this.audio.duration || currentTrack.duration || 180);

      const targetTime = ratio * duration;
      this.scrubberPlayed.style.width = `${ratio * 100}%`;
      this.currentTimeLabel.textContent = this.formatTime(targetTime);
      this.scrubberTooltip.textContent = this.formatTime(targetTime);
      this.scrubberTooltip.style.left = `${Math.max(0, Math.min(rect.width, clientX - rect.left))}px`;
      return targetTime;
    };

    this.scrubberBar.addEventListener('mousedown', (e) => {
      this.isScrubbing = true;
      handleScrubMove(e.clientX);

      const onMouseMove = (moveEv) => {
        if (this.isScrubbing) {
          handleScrubMove(moveEv.clientX);
        }
      };

      const onMouseUp = (upEv) => {
        if (this.isScrubbing) {
          this.isScrubbing = false;
          const targetTime = handleScrubMove(upEv.clientX);
          this.seekTo(targetTime);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    this.scrubberBar.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      this.isScrubbing = true;
      handleScrubMove(e.touches[0].clientX);

      const onTouchMove = (moveEv) => {
        if (this.isScrubbing && moveEv.touches.length) {
          handleScrubMove(moveEv.touches[0].clientX);
        }
      };

      const onTouchEnd = (endEv) => {
        if (this.isScrubbing) {
          this.isScrubbing = false;
          const clientX = endEv.changedTouches?.[0]?.clientX || 0;
          const targetTime = handleScrubMove(clientX);
          this.seekTo(targetTime);
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
        }
      };

      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
    }, { passive: true });

    this.scrubberBar.addEventListener('mousemove', (e) => {
      if (!this.isScrubbing) {
        const rect = this.scrubberBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const currentTrack = this.tracks[this.currentTrackIndex] || {};
        const duration = (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady)
          ? (this.ytPlayer.getDuration() || currentTrack.duration || 180)
          : (this.audio.duration || currentTrack.duration || 180);
        this.scrubberTooltip.textContent = this.formatTime(ratio * duration);
        this.scrubberTooltip.style.left = `${clickX}px`;
      }
    });

    // Volume Slider smooth drag & click
    const updateVolumeFromClientX = (clientX) => {
      const rect = this.volumeSliderBar.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      this.setVolume(ratio);
    };

    this.volumeSliderBar.addEventListener('mousedown', (e) => {
      updateVolumeFromClientX(e.clientX);

      const onMouseMove = (moveEv) => {
        updateVolumeFromClientX(moveEv.clientX);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    this.volumeSliderBar.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      updateVolumeFromClientX(e.touches[0].clientX);

      const onTouchMove = (moveEv) => {
        if (moveEv.touches.length) {
          updateVolumeFromClientX(moveEv.touches[0].clientX);
        }
      };

      const onTouchEnd = () => {
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };

      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
    }, { passive: true });

    // Mute Button toggle
    this.muteBtn.addEventListener('click', () => {
      if (this.isMuted) {
        const restoreVol = this.previousVolume || 0.8;
        this.setVolume(restoreVol);
        this.isMuted = false;
      } else {
        this.previousVolume = this.audio.volume || 0.8;
        this.setVolume(0);
        this.isMuted = true;
      }
    });

    // Speed Selector (syncs with both native audio and YouTube stream)
    const speedBtn = document.getElementById('speedBtn');
    const speedDropdown = document.getElementById('speedDropdown');
    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speedDropdown.classList.toggle('show');
    });

    speedDropdown.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        this.audio.playbackRate = speed;
        if (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady && typeof this.ytPlayer.setPlaybackRate === 'function') {
          try {
            this.ytPlayer.setPlaybackRate(speed);
          } catch(e) {}
        }
        speedBtn.textContent = `${speed}x`;
        speedDropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        speedDropdown.classList.remove('show');
        this.showToast(`Playback speed: ${speed}x`, "ri-speed-line");
      });
    });

    document.addEventListener('click', () => {
      speedDropdown.classList.remove('show');
    });

    // YouTube Stream Host Controls
    if (this.ytAudioOnlyBtn) {
      this.ytAudioOnlyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleYouTubeAudioOnly();
      });
    }

    if (this.ytMinAudioOnlyBtn) {
      this.ytMinAudioOnlyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleYouTubeAudioOnly();
      });
    }

    if (this.dockYtToggleBtn) {
      this.dockYtToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleYouTubeAudioOnly();
      });
    }

    if (this.ytMinimizeBtn) {
      this.ytMinimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.minimizeYouTubeStream(true);
      });
    }

    if (this.ytExpandSizeBtn) {
      this.ytExpandSizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleYouTubeSize();
      });
    }

    if (this.ytMinExpandBtn) {
      this.ytMinExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.minimizeYouTubeStream(false);
      });
    }

    if (this.ytMinInfoTrigger) {
      this.ytMinInfoTrigger.addEventListener('click', (e) => {
        // Only expand if click was not on a button or drag handle
        if (e.target.closest('button') || e.target.closest('.yt-min-drag-handle')) return;
        this.minimizeYouTubeStream(false);
      });
    }

    if (this.ytMinPlayBtn) {
      this.ytMinPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }

    if (this.ytCloseStreamBtn) {
      this.ytCloseStreamBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stopYouTubePlayback();
        this.showToast("YouTube stream stopped", "ri-stop-circle-line");
      });
    }

    if (this.ytMinCloseBtn) {
      this.ytMinCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stopYouTubePlayback();
        this.showToast("YouTube stream stopped", "ri-stop-circle-line");
      });
    }

    // Manual Offline Download Buttons
    if (this.dockDownloadBtn) {
      this.dockDownloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadCurrentTrackForOffline();
      });
    }

    if (this.ytDownloadBtn) {
      this.ytDownloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadCurrentTrackForOffline();
      });
    }

    if (this.ytMinDownloadBtn) {
      this.ytMinDownloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadCurrentTrackForOffline();
      });
    }

    // Initialize Draggable Miniplayer
    this.setupDraggableMiniplayer();

    // Stage Tab Switcher (Player vs Synced Lyrics)
    this.tabPlayerView.addEventListener('click', () => {
      this.tabPlayerView.classList.add('active');
      this.tabLyricsView.classList.remove('active');
      this.playerStageView.classList.add('active-view');
      this.lyricsStageView.classList.remove('active-view');
    });

    this.tabLyricsView.addEventListener('click', () => {
      this.tabLyricsView.classList.add('active');
      this.tabPlayerView.classList.remove('active');
      this.lyricsStageView.classList.add('active-view');
      this.playerStageView.classList.remove('active-view');
      // Scroll to current active lyric
      const activeLine = this.lyricsContainer.querySelector('.lyric-line.active');
      if (activeLine) activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    document.getElementById('dockLyricsBtn').addEventListener('click', () => {
      this.tabLyricsView.click();
    });

    // Auto-scroll toggle for lyrics
    this.toggleAutoScrollBtn.addEventListener('click', () => {
      this.autoScrollLyrics = !this.autoScrollLyrics;
      this.toggleAutoScrollBtn.classList.toggle('active', this.autoScrollLyrics);
      this.toggleAutoScrollBtn.innerHTML = `<i class="ri-scroll-to-bottom-line"></i> Auto-Scroll: ${this.autoScrollLyrics ? 'On' : 'Off'}`;
    });

    // Visualizer Mode Buttons
    document.querySelectorAll('.viz-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viz-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.visualizerMode = btn.dataset.mode;
        this.showToast(`Visualizer: ${btn.textContent}`, "ri-bar-chart-2-line");
      });
    });

    // Library Navigation Filters
    document.querySelectorAll('.nav-menu .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-menu .nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.activeFilter = item.dataset.filter || item.dataset.playlist || 'all';
        this.renderQueue();
      });
    });

    // Search Feature & Direct YouTube Dropdown
    this.initSearchFeature();

    // Queue action buttons
    document.getElementById('shuffleQueueBtn').addEventListener('click', () => {
      this.tracks.sort(() => Math.random() - 0.5);
      this.renderQueue();
      this.showToast("Queue shuffled", "ri-shuffle-line");
    });

    document.getElementById('clearQueueBtn').addEventListener('click', () => {
      this.tracks = [...TRACKS_DATA];
      this.currentTrackIndex = 0;
      this.loadTrack(0, false);
      this.renderQueue();
      this.showToast("Queue reset to original", "ri-refresh-line");
    });

    // Audio File Import (input + full window drag and drop)
    this.fileUploadInput.addEventListener('change', (e) => {
      this.handleAudioUpload(e.target.files);
    });

    const preventDrag = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
      this.dropZone.addEventListener(ev, preventDrag);
      window.addEventListener(ev, preventDrag);
    });

    this.dropZone.addEventListener('dragover', () => this.dropZone.classList.add('drag-over'));
    this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-over'));
    this.dropZone.addEventListener('drop', (e) => {
      this.dropZone.classList.remove('drag-over');
      this.handleAudioUpload(e.dataTransfer.files);
    });

    window.addEventListener('drop', (e) => {
      if (e.target !== this.dropZone && !this.dropZone.contains(e.target)) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          this.handleAudioUpload(e.dataTransfer.files);
        }
      }
    });

    // Live Pill Widget Toggle
    this.toggleLivePillBtn.addEventListener('click', () => {
      this.obsidianLivePill.classList.toggle('visible');
    });

    this.pillCloseBtn.addEventListener('click', () => {
      this.obsidianLivePill.classList.remove('visible');
    });

    // Modals Handlers
    this.initModals();

    // Keyboard Shortcuts
    this.initShortcuts();

    // Mobile & Android Navigation & Drawers
    this.initMobileNav();
  }

  /* --------------------------------------------------------------------------
     Mobile & Android Navigation, Drawers & Mini-Player
     -------------------------------------------------------------------------- */
  initMobileNav() {
    const mobileBackdrop = document.getElementById('mobileDrawerBackdrop');
    const sidebarLibrary = document.getElementById('sidebarLibrary');
    const sidebarQueue = document.getElementById('sidebarQueue');
    const closeLibBtn = document.getElementById('closeLibraryDrawerBtn');
    const closeQueueBtn = document.getElementById('closeQueueDrawerBtn');
    const mobileSearchToggleBtn = document.getElementById('mobileSearchToggleBtn');
    const navSearchContainer = document.getElementById('navSearchContainer');
    const searchInput = document.getElementById('searchInput');

    this.closeAllDrawers = () => {
      if (sidebarLibrary) sidebarLibrary.classList.remove('mobile-drawer-open');
      if (sidebarQueue) sidebarQueue.classList.remove('mobile-drawer-open');
      if (mobileBackdrop) mobileBackdrop.classList.remove('active');
      if (navSearchContainer) navSearchContainer.classList.remove('mobile-active');
      document.getElementById('appContainer')?.classList.remove('mobile-drawer-visible');
    };

    this.setActiveTab = (tabName) => {
      const tabs = document.querySelectorAll('.mobile-nav-btn');
      tabs.forEach(t => {
        if (t.dataset.tab === tabName) t.classList.add('active');
        else t.classList.remove('active');
      });
    };

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', () => {
        this.closeAllDrawers();
        this.setActiveTab('player');
      });
    }

    if (closeLibBtn) {
      closeLibBtn.addEventListener('click', () => {
        this.closeAllDrawers();
        this.setActiveTab('player');
      });
    }

    if (closeQueueBtn) {
      closeQueueBtn.addEventListener('click', () => {
        this.closeAllDrawers();
        this.setActiveTab('player');
      });
    }

    // Mobile Search Toggle Button in top bar
    if (mobileSearchToggleBtn) {
      mobileSearchToggleBtn.addEventListener('click', () => {
        if (navSearchContainer) {
          const isActive = navSearchContainer.classList.toggle('mobile-active');
          if (isActive) {
            this.closeAllDrawers();
            this.closeMobileFullscreenPlayer();
            this.setActiveTab('search');
            if (searchInput) searchInput.focus();
          } else {
            this.setActiveTab('player');
          }
        }
      });
    }

    // Tapping dock track info or miniplayer body expands Now Playing full-screen on mobile
    const dockTrackInfo = document.getElementById('dockTrackInfo');
    if (dockTrackInfo) {
      dockTrackInfo.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          if (e.target.closest('#likeTrackBtn') || e.target.closest('#dockDownloadBtn')) return;
          this.openMobileFullscreenPlayer();
        }
      });
    }

    const playerDock = document.getElementById('playerDock');
    if (playerDock) {
      playerDock.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.speed-dropdown')) return;
          this.openMobileFullscreenPlayer();
        }
      });
    }

    // Bottom Navigation Buttons
    const navPlayer = document.getElementById('mobileNavPlayer');
    const navSearch = document.getElementById('mobileNavSearch');
    const navOffline = document.getElementById('mobileNavOffline');
    const navLibrary = document.getElementById('mobileNavLibrary');
    const navQueue = document.getElementById('mobileNavQueue');

    if (navPlayer) {
      navPlayer.addEventListener('click', () => {
        this.closeAllDrawers();
        this.closeMobileFullscreenPlayer();
        this.setActiveTab('player');
        const playerTab = document.getElementById('tabPlayerView');
        if (playerTab) playerTab.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (navSearch) {
      navSearch.addEventListener('click', () => {
        this.closeAllDrawers();
        this.closeMobileFullscreenPlayer();
        this.setActiveTab('search');
        if (navSearchContainer) navSearchContainer.classList.add('mobile-active');
        if (searchInput) {
          searchInput.focus();
          const dropdown = document.getElementById('ytSearchDropdown');
          if (dropdown) dropdown.style.display = 'flex';
        }
      });
    }

    if (navOffline) {
      navOffline.addEventListener('click', () => {
        this.closeAllDrawers();
        this.closeMobileFullscreenPlayer();
        this.setActiveTab('library');
        if (sidebarLibrary) sidebarLibrary.classList.add('mobile-drawer-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        document.getElementById('appContainer')?.classList.add('mobile-drawer-visible');
        const offlineNav = document.getElementById('navOfflineTracks');
        if (offlineNav) offlineNav.click();
      });
    }

    if (navLibrary) {
      navLibrary.addEventListener('click', () => {
        this.closeAllDrawers();
        this.closeMobileFullscreenPlayer();
        this.setActiveTab('library');
        if (sidebarLibrary) sidebarLibrary.classList.add('mobile-drawer-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        document.getElementById('appContainer')?.classList.add('mobile-drawer-visible');
      });
    }

    if (navQueue) {
      navQueue.addEventListener('click', () => {
        this.closeAllDrawers();
        this.setActiveTab('queue');
        if (sidebarQueue) sidebarQueue.classList.add('mobile-drawer-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        document.getElementById('appContainer')?.classList.add('mobile-drawer-visible');
      });
    }

    // Initialize YouTube Music Signature Controls
    this.initYouTubeMusicControls();
  }

  /* --------------------------------------------------------------------------
     YouTube Music Mobile Player & [ Song | Video ] Controls
     -------------------------------------------------------------------------- */
  initYouTubeMusicControls() {
    // 1. Collapse Fullscreen Player back to Miniplayer
    if (this.ytmCollapseBtn) {
      this.ytmCollapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMobileFullscreenPlayer();
      });
    }

    // 2. [ Song | Video ] Pill Switcher
    if (this.ytmSwitchSong) {
      this.ytmSwitchSong.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setMediaViewMode('song');
      });
    }

    if (this.ytmSwitchVideo) {
      this.ytmSwitchVideo.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setMediaViewMode('video');
      });
    }

    // 3. Action Bar Buttons
    if (this.ytmLikeBtn) {
      this.ytmLikeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleLikeCurrentTrack();
      });
    }

    if (this.ytmDownloadBtn) {
      this.ytmDownloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadCurrentTrackForOffline();
      });
    }

    if (this.ytmLyricsBtn) {
      this.ytmLyricsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isLyricsActive = this.lyricsStageView?.classList.contains('active-view');
        if (isLyricsActive) {
          if (this.tabPlayerView) this.tabPlayerView.click();
          this.ytmLyricsBtn.classList.remove('active');
        } else {
          if (this.tabLyricsView) this.tabLyricsView.click();
          this.ytmLyricsBtn.classList.add('active');
        }
      });
    }

    if (this.ytmQueueBtn) {
      this.ytmQueueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sidebarQueue = document.getElementById('sidebarQueue');
        const mobileBackdrop = document.getElementById('mobileDrawerBackdrop');
        if (sidebarQueue) sidebarQueue.classList.add('mobile-drawer-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        document.getElementById('appContainer')?.classList.add('mobile-drawer-visible');
      });
    }

    if (this.ytmOptionsBtn) {
      this.ytmOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eqModal = document.getElementById('eqModal');
        const eqModalBackdrop = document.getElementById('eqModalBackdrop');
        if (eqModal && eqModalBackdrop) {
          this.setupWebAudio();
          eqModalBackdrop.classList.add('show');
          eqModal.classList.add('show');
        }
      });
    }

    // 4. Mobile Fullscreen Scrubber Bar
    if (this.ytmScrubberBar) {
      const handleYtmScrub = (clientX) => {
        const rect = this.ytmScrubberBar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const curTrack = this.tracks[this.currentTrackIndex] || {};
        const dur = (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady)
          ? (this.ytPlayer.getDuration() || curTrack.duration || 180)
          : (this.audio.duration || curTrack.duration || 180);
        const targetTime = ratio * dur;
        if (this.ytmScrubberPlayed) this.ytmScrubberPlayed.style.width = `${ratio * 100}%`;
        if (this.ytmCurrentTime) this.ytmCurrentTime.textContent = this.formatTime(targetTime);
        return targetTime;
      };

      this.ytmScrubberBar.addEventListener('click', (e) => {
        const targetTime = handleYtmScrub(e.clientX);
        this.seekTo(targetTime);
      });

      this.ytmScrubberBar.addEventListener('touchstart', (e) => {
        if (!e.touches.length) return;
        this.isScrubbing = true;
        handleYtmScrub(e.touches[0].clientX);

        const onTouchMove = (moveEv) => {
          if (this.isScrubbing && moveEv.touches.length) {
            handleYtmScrub(moveEv.touches[0].clientX);
          }
        };

        const onTouchEnd = (endEv) => {
          if (this.isScrubbing) {
            this.isScrubbing = false;
            const clientX = endEv.changedTouches?.[0]?.clientX || 0;
            const targetTime = handleYtmScrub(clientX);
            this.seekTo(targetTime);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
          }
        };

        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd);
      }, { passive: true });
    }

    // 5. Mobile Fullscreen Playback Buttons
    if (this.ytmPlayBtn) {
      this.ytmPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }

    if (this.ytmPrevBtn) {
      this.ytmPrevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prevTrack();
      });
    }

    if (this.ytmNextBtn) {
      this.ytmNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextTrack();
      });
    }

    if (this.ytmShuffleBtn) {
      this.ytmShuffleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleShuffle();
      });
    }

    if (this.ytmRepeatBtn) {
      this.ytmRepeatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleRepeat();
      });
    }
  }

  openMobileFullscreenPlayer() {
    this.closeAllDrawers();
    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
      appContainer.classList.add('mobile-player-fullscreen');
    }
    this.mobilePlayerFullscreen = true;
    if (this.tabPlayerView) this.tabPlayerView.click();
    if (this.isPlaying) this.startVisualizer();
  }

  closeMobileFullscreenPlayer() {
    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
      appContainer.classList.remove('mobile-player-fullscreen');
    }
    this.mobilePlayerFullscreen = false;
  }

  setMediaViewMode(mode) {
    this.mediaViewMode = mode;
    const isSong = mode === 'song';
    if (this.ytmSwitchSong) this.ytmSwitchSong.classList.toggle('active', isSong);
    if (this.ytmSwitchVideo) this.ytmSwitchVideo.classList.toggle('active', !isSong);

    const artworkContainer = document.getElementById('artworkContainer');
    const visualizerCanvas = document.getElementById('visualizerCanvas');
    const visualizerSettingsBar = document.getElementById('visualizerSettingsBar');

    if (isSong) {
      if (artworkContainer) artworkContainer.style.display = 'flex';
      if (visualizerCanvas) visualizerCanvas.style.display = 'block';
      if (visualizerSettingsBar) visualizerSettingsBar.style.display = 'flex';
      if (this.ytmStageVideoWrapper) this.ytmStageVideoWrapper.style.display = 'none';
      if (this.isPlaying) this.startVisualizer();
    } else {
      if (artworkContainer) artworkContainer.style.display = 'none';
      if (visualizerCanvas) visualizerCanvas.style.display = 'none';
      if (visualizerSettingsBar) visualizerSettingsBar.style.display = 'none';
      if (this.ytmStageVideoWrapper) this.ytmStageVideoWrapper.style.display = 'flex';

      // Ensure video is mounted in stage video frame
      const currentTrack = this.tracks[this.currentTrackIndex];
      const videoId = currentTrack?.youtubeVideoId || (currentTrack?.id?.startsWith('yt-') ? currentTrack.id.replace('yt-', '') : null);
      if (videoId && !document.getElementById('youtubePlayer')) {
        const frame = document.getElementById('ytStageVideoFrame');
        if (frame) frame.innerHTML = '<div id="youtubePlayer"></div>';
        if (typeof YT !== 'undefined' && YT.Player) {
          try {
            this.ytPlayer = new YT.Player('youtubePlayer', {
              height: '100%',
              width: '100%',
              videoId: videoId,
              playerVars: { autoplay: 1, controls: 1, modestbranding: 1, playsinline: 1 },
              events: {
                onReady: (ev) => {
                  this.ytReady = true;
                  try { ev.target.mute(); } catch(e) {}
                  try { ev.target.playVideo(); } catch(e) {}
                }
              }
            });
          } catch(e) {}
        }
      }
    }
  }

  /* --------------------------------------------------------------------------
     Modals: Equalizer, Sleep Timer, Shortcuts
     -------------------------------------------------------------------------- */
  initModals() {
    // Equalizer
    const openEqBtn = document.getElementById('openEqBtn');
    const closeEqBtn = document.getElementById('closeEqBtn');
    const saveEqBtn = document.getElementById('saveEqBtn');
    const resetEqBtn = document.getElementById('resetEqBtn');

    openEqBtn.addEventListener('click', () => {
      this.setupWebAudio();
      this.eqModalBackdrop.classList.add('open');
    });

    const closeEq = () => this.eqModalBackdrop.classList.remove('open');
    closeEqBtn.addEventListener('click', closeEq);
    saveEqBtn.addEventListener('click', closeEq);

    // EQ Sliders
    const sliders = [
      { id: 'eq60', label: 'dbVal60', nodeIdx: 0 },
      { id: 'eq250', label: 'dbVal250', nodeIdx: 1 },
      { id: 'eq1k', label: 'dbVal1k', nodeIdx: 2 },
      { id: 'eq4k', label: 'dbVal4k', nodeIdx: 3 },
      { id: 'eq16k', label: 'dbVal16k', nodeIdx: 4 },
    ];

    sliders.forEach(s => {
      const sliderEl = document.getElementById(s.id);
      const labelEl = document.getElementById(s.label);
      sliderEl.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        labelEl.textContent = `${val > 0 ? '+' : ''}${val} dB`;
        if (this.eqNodes[s.nodeIdx]) {
          this.eqNodes[s.nodeIdx].gain.value = val;
        }
      });
    });

    // EQ Presets
    const presets = {
      flat: [0, 0, 0, 0, 0],
      bass: [6, 4, 0, -2, -2],
      electronic: [5, 3, -1, 3, 5],
      vocal: [-2, -1, 4, 3, 1],
      treble: [-3, -1, 1, 4, 6]
    };

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const vals = presets[btn.dataset.preset] || presets.flat;
        sliders.forEach((s, idx) => {
          const sliderEl = document.getElementById(s.id);
          const labelEl = document.getElementById(s.label);
          sliderEl.value = vals[idx];
          labelEl.textContent = `${vals[idx] > 0 ? '+' : ''}${vals[idx]} dB`;
          if (this.eqNodes[s.nodeIdx]) {
            this.eqNodes[s.nodeIdx].gain.value = vals[idx];
          }
        });
        this.showToast(`EQ Preset: ${btn.textContent}`, "ri-equalizer-line");
      });
    });

    resetEqBtn.addEventListener('click', () => {
      document.querySelector('.preset-btn[data-preset="flat"]').click();
    });

    // Sleep Timer Modal
    const openTimerBtn = document.getElementById('openTimerBtn');
    const closeTimerBtn = document.getElementById('closeTimerBtn');
    const closeTimerModalBtn = document.getElementById('closeTimerModalBtn');
    const cancelTimerBtn = document.getElementById('cancelTimerBtn');

    openTimerBtn.addEventListener('click', () => this.timerModalBackdrop.classList.add('open'));
    const closeTimer = () => this.timerModalBackdrop.classList.remove('open');
    closeTimerBtn.addEventListener('click', closeTimer);
    closeTimerModalBtn.addEventListener('click', closeTimer);

    document.querySelectorAll('.timer-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timer-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const min = parseInt(btn.dataset.minutes, 10);
        this.startSleepTimer(min);
      });
    });

    cancelTimerBtn.addEventListener('click', () => {
      this.clearSleepTimer();
      this.showToast("Sleep timer deactivated", "ri-timer-line");
    });

    // Shortcuts Modal
    const openShortcutsBtn = document.getElementById('openShortcutsBtn');
    const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');
    openShortcutsBtn.addEventListener('click', () => this.shortcutsModalBackdrop.classList.add('open'));
    closeShortcutsBtn.addEventListener('click', () => this.shortcutsModalBackdrop.classList.remove('open'));

    // Close on backdrop click
    [this.eqModalBackdrop, this.timerModalBackdrop, this.shortcutsModalBackdrop, this.youtubeModalBackdrop].forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('open');
      });
    });

    // YouTube Modal
    this.initYoutubeModal();

    // Fullscreen Toggle
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        fullscreenIcon.className = 'ri-fullscreen-exit-line';
        this.showToast("Immersive Fullscreen Mode", "ri-fullscreen-line");
      } else {
        document.exitFullscreen().catch(() => {});
        fullscreenIcon.className = 'ri-fullscreen-line';
      }
    });
  }

  /* --------------------------------------------------------------------------
     Keyboard Shortcuts
     -------------------------------------------------------------------------- */
  initShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts if typing in search input
      if (document.activeElement === this.searchInput) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const curTime = (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady)
            ? (this.ytPlayer.getCurrentTime() || 0)
            : (this.audio.currentTime || 0);
          this.seekTo(curTime + 5);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const curTime = (this.isYoutubeTrackActive && this.ytPlayer && this.ytReady)
            ? (this.ytPlayer.getCurrentTime() || 0)
            : (this.audio.currentTime || 0);
          this.seekTo(Math.max(0, curTime - 5));
          break;
        }
        case 'KeyN':
          this.nextTrack();
          break;
        case 'KeyP':
          this.prevTrack();
          break;
        case 'KeyL':
          this.toggleLikeCurrentTrack();
          break;
        case 'KeyM':
          this.muteBtn.click();
          break;
        case 'KeyS':
          this.toggleShuffle();
          break;
        case 'KeyR':
          this.toggleRepeat();
          break;
        case 'KeyF':
          document.getElementById('fullscreenBtn').click();
          break;
        case 'KeyY':
          document.getElementById('openYoutubeBtn').click();
          break;
      }
    });
  }

  /* --------------------------------------------------------------------------
     YouTube Modal Initialization
     -------------------------------------------------------------------------- */
  initYoutubeModal() {
    const openYoutubeBtn = document.getElementById('openYoutubeBtn');
    const closeYoutubeBtn = document.getElementById('closeYoutubeBtn');
    const closeYoutubeModalBtn = document.getElementById('closeYoutubeModalBtn');
    const ytClearHistoryBtn = document.getElementById('ytClearHistoryBtn');

    openYoutubeBtn.addEventListener('click', () => {
      this.youtubeModalBackdrop.classList.add('open');
      this.renderYtRecentList();
      this.youtubeUrlInput.focus();
    });

    const closeYt = () => this.youtubeModalBackdrop.classList.remove('open');
    closeYoutubeBtn.addEventListener('click', closeYt);
    closeYoutubeModalBtn.addEventListener('click', closeYt);

    // Stream button
    this.youtubeAddBtn.addEventListener('click', () => this.handleYoutubeStream());

    // Enter key on input
    this.youtubeUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleYoutubeStream();
      }
    });

    // Clear history
    ytClearHistoryBtn.addEventListener('click', () => this.clearYtRecentStreams());

    // Render initial recent list
    this.renderYtRecentList();
  }

  handleYoutubeStream() {
    const url = this.youtubeUrlInput.value.trim();
    if (!url) {
      this.showYtError('Please enter a YouTube URL');
      return;
    }

    const videoId = this.extractYouTubeVideoId(url);
    if (!videoId) {
      this.showYtError('Invalid YouTube URL. Try pasting a full link like: youtube.com/watch?v=...');
      return;
    }

    this.ytErrorMsg.style.display = 'none';
    this.youtubeAddBtn.classList.add('loading');
    this.youtubeAddBtn.innerHTML = '<i class="ri-loader-4-line"></i> Loading...';

    // Small delay for visual feedback
    setTimeout(() => {
      this.streamYouTubeVideo(videoId);
      this.youtubeAddBtn.classList.remove('loading');
      this.youtubeAddBtn.innerHTML = '<i class="ri-play-circle-line"></i> Stream';
    }, 300);
  }

  /* --------------------------------------------------------------------------
     YouTube Direct Search & Dropdown Implementation
     -------------------------------------------------------------------------- */
  initSearchFeature() {
    if (!this.searchInput) return;

    // Open dropdown on focus if input has value
    this.searchInput.addEventListener('focus', () => {
      if (this.searchInput.value.trim().length > 0) {
        this.openSearchDropdown();
      }
    });

    // Input typing with debounce
    this.searchInput.addEventListener('input', () => {
      const query = this.searchInput.value.trim();
      this.clearSearchBtn.style.display = query ? 'block' : 'none';

      // Also filter main queue if search dropdown is closed or user wants filtered queue
      this.renderQueue();

      if (!query) {
        this.closeSearchDropdown();
        this.currentYtSearchResults = [];
        if (this.ytResultCountBadge) this.ytResultCountBadge.textContent = '0';
        if (this.localResultCountBadge) this.localResultCountBadge.textContent = '0';
        return;
      }

      this.openSearchDropdown();
      this.showSearchLoader(true);

      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }

      this.searchDebounceTimer = setTimeout(() => {
        this.executeSearch(query);
      }, 350);
    });

    // Clear button
    this.clearSearchBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearSearchBtn.style.display = 'none';
      this.closeSearchDropdown();
      this.currentYtSearchResults = [];
      this.renderQueue();
      this.searchInput.focus();
    });

    // Tab buttons (YouTube vs Library)
    if (this.ytSearchTabYt) {
      this.ytSearchTabYt.addEventListener('click', () => this.switchSearchTab('yt'));
    }
    if (this.ytSearchTabLocal) {
      this.ytSearchTabLocal.addEventListener('click', () => this.switchSearchTab('local'));
    }

    // Add all button
    if (this.ytSearchAddAllBtn) {
      this.ytSearchAddAllBtn.addEventListener('click', () => this.addAllYtResultsToQueue());
    }

    // Music Filter Chips
    this.filterChips = document.querySelectorAll('.yt-filter-chip');
    this.filterChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const filter = chip.dataset.filter || 'music';
        this.setMusicFilter(filter);
      });
    });

    // Keyboard navigation (Enter, Escape, ArrowDown, ArrowUp)
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSearchDropdown();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateSearchResults(1);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateSearchResults(-1);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const query = this.searchInput.value.trim();
        if (!query) return;

        // If an item is highlighted via arrow keys, play it
        if (this.searchHighlightedIndex >= 0) {
          const items = this.ytSearchResultsList.querySelectorAll('.yt-search-item');
          if (items[this.searchHighlightedIndex]) {
            items[this.searchHighlightedIndex].click();
            return;
          }
        }

        // If results already loaded, play top result
        if (this.currentYtSearchResults.length > 0 && this.searchActiveTab === 'yt') {
          this.playYouTubeSearchResult(this.currentYtSearchResults[0]);
          return;
        }

        // If not yet loaded or searching, immediately execute and autoplay first
        this.executeSearch(query, true);
      }
    });

    // Close on click outside (prevent premature close on mobile nav or results)
    document.addEventListener('click', (e) => {
      if (e.target.closest('#navSearchContainer') || 
          e.target.closest('#mobileBottomNav') || 
          e.target.closest('.yt-search-dropdown') ||
          e.target.closest('.yt-search-item')) {
        return;
      }
      this.closeSearchDropdown();
    });
  }

  openSearchDropdown() {
    if (!this.ytSearchDropdown) return;
    this.ytSearchDropdown.style.display = 'flex';
    this.navSearchContainer?.classList.add('active-search');
    this.isSearchOpen = true;
    if (this.ytFilterBar) {
      this.ytFilterBar.style.display = this.searchActiveTab === 'yt' ? 'flex' : 'none';
    }
  }

  closeSearchDropdown() {
    if (!this.ytSearchDropdown) return;
    this.ytSearchDropdown.style.display = 'none';
    this.navSearchContainer?.classList.remove('active-search');
    this.isSearchOpen = false;
    this.searchHighlightedIndex = -1;
  }

  showSearchLoader(show) {
    if (this.searchLoader) {
      this.searchLoader.style.display = show ? 'flex' : 'none';
    }
  }

  switchSearchTab(tab) {
    this.searchActiveTab = tab;
    if (this.ytSearchTabYt) this.ytSearchTabYt.classList.toggle('active', tab === 'yt');
    if (this.ytSearchTabLocal) this.ytSearchTabLocal.classList.toggle('active', tab === 'local');
    if (this.ytFilterBar) {
      this.ytFilterBar.style.display = tab === 'yt' ? 'flex' : 'none';
    }
    this.renderSearchTabContent();
  }

  setMusicFilter(filter) {
    this.currentMusicFilter = filter;
    if (this.filterChips) {
      this.filterChips.forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
    }

    // Instant in-memory filter if raw results are already cached
    if (this.rawYtSearchResults && this.rawYtSearchResults.length > 0) {
      this.applyCurrentMusicFilter();
    } else {
      const q = this.searchInput.value.trim();
      if (q) {
        this.executeSearch(q);
      }
    }
  }

  applyCurrentMusicFilter() {
    let filtered = [];
    if (this.currentMusicFilter === 'official') {
      filtered = this.rawYtSearchResults.filter(r => r.music_type === 'official');
    } else if (this.currentMusicFilter === 'lyrics') {
      filtered = this.rawYtSearchResults.filter(r => r.music_type === 'lyrics');
    } else if (this.currentMusicFilter === 'live') {
      filtered = this.rawYtSearchResults.filter(r => r.music_type === 'live');
    } else if (this.currentMusicFilter === 'all') {
      filtered = [...this.rawYtSearchResults];
    } else {
      // Default: music only
      filtered = this.rawYtSearchResults.filter(r => r.is_music);
    }

    this.currentYtSearchResults = filtered;
    if (this.ytResultCountBadge) {
      this.ytResultCountBadge.textContent = filtered.length;
    }

    const nonMusicCount = this.rawYtSearchResults.filter(r => !r.is_music).length;
    if (this.ytSearchStatus) {
      if (this.currentMusicFilter === 'all') {
        this.ytSearchStatus.textContent = `${filtered.length} total results`;
      } else if (this.currentMusicFilter === 'official') {
        this.ytSearchStatus.innerHTML = `<i class="ri-verified-badge-fill" style="color: #A380FF;"></i> ${filtered.length} official tracks`;
      } else if (this.currentMusicFilter === 'lyrics') {
        this.ytSearchStatus.innerHTML = `<i class="ri-text" style="color: #00F2FE;"></i> ${filtered.length} lyric videos`;
      } else if (this.currentMusicFilter === 'live') {
        this.ytSearchStatus.innerHTML = `<i class="ri-mic-line" style="color: #FFAA00;"></i> ${filtered.length} live tracks`;
      } else {
        this.ytSearchStatus.innerHTML = `<i class="ri-music-2-fill" style="color: #00F5A0;"></i> ${filtered.length} music tracks ${nonMusicCount > 0 ? `<small style="opacity: 0.7;">(${nonMusicCount} non-music hidden)</small>` : ''}`;
      }
    }

    this.renderYouTubeResultsList(filtered);
  }

  navigateSearchResults(direction) {
    if (!this.ytSearchResultsList) return;
    const items = this.ytSearchResultsList.querySelectorAll('.yt-search-item');
    if (items.length === 0) return;

    items.forEach(el => el.classList.remove('highlighted'));

    this.searchHighlightedIndex += direction;
    if (this.searchHighlightedIndex < 0) {
      this.searchHighlightedIndex = items.length - 1;
    } else if (this.searchHighlightedIndex >= items.length) {
      this.searchHighlightedIndex = 0;
    }

    const target = items[this.searchHighlightedIndex];
    if (target) {
      target.classList.add('highlighted');
      target.scrollIntoView({ block: 'nearest' });
    }
  }

  async executeSearch(query, autoPlayFirst = false) {
    this.showSearchLoader(true);
    this.searchHighlightedIndex = -1;

    // Check if query is a direct YouTube URL
    const directVideoId = this.extractYouTubeVideoId(query);
    if (directVideoId) {
      this.showSearchLoader(false);
      this.renderDirectUrlCard(directVideoId, query);
      if (autoPlayFirst) {
        this.streamYouTubeVideo(directVideoId);
        this.closeSearchDropdown();
      }
      return;
    }

    // 1. Search local library tracks matching query
    const lowerQ = query.toLowerCase();
    const localMatches = this.tracks.filter(t =>
      t.title.toLowerCase().includes(lowerQ) ||
      t.artist.toLowerCase().includes(lowerQ) ||
      (t.album && t.album.toLowerCase().includes(lowerQ))
    );
    if (this.localResultCountBadge) {
      this.localResultCountBadge.textContent = localMatches.length;
    }

    // 2. Search YouTube
    try {
      if (this.ytSearchStatus) this.ytSearchStatus.textContent = 'Searching YouTube...';
      const ytResults = await this.fetchYouTubeSearch(query);
      this.currentYtSearchResults = ytResults;
      if (this.ytResultCountBadge) {
        this.ytResultCountBadge.textContent = ytResults.length;
      }
      
      const nonMusicCount = this.filteredCount || 0;
      if (this.ytSearchStatus) {
        if (this.currentMusicFilter === 'all') {
          this.ytSearchStatus.textContent = `${ytResults.length} total results`;
        } else if (this.currentMusicFilter === 'official') {
          this.ytSearchStatus.innerHTML = `<i class="ri-verified-badge-fill" style="color: #A380FF;"></i> ${ytResults.length} official tracks`;
        } else if (this.currentMusicFilter === 'lyrics') {
          this.ytSearchStatus.innerHTML = `<i class="ri-text" style="color: #00F2FE;"></i> ${ytResults.length} lyric videos`;
        } else if (this.currentMusicFilter === 'live') {
          this.ytSearchStatus.innerHTML = `<i class="ri-mic-line" style="color: #FFAA00;"></i> ${ytResults.length} live tracks`;
        } else {
          this.ytSearchStatus.innerHTML = `<i class="ri-music-2-fill" style="color: #00F5A0;"></i> ${ytResults.length} music tracks ${nonMusicCount > 0 ? `<small style="opacity: 0.7;">(${nonMusicCount} non-music hidden)</small>` : ''}`;
        }
      }

      this.renderSearchTabContent(localMatches);

      if (autoPlayFirst && ytResults.length > 0 && this.searchActiveTab === 'yt') {
        this.playYouTubeSearchResult(ytResults[0]);
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      this.renderSearchError(err.message || 'Failed to search YouTube');
    } finally {
      this.showSearchLoader(false);
    }
  }

  async fetchYouTubeSearch(query) {
    // 1. First try our custom server search proxy endpoint
    try {
      const searchUrl = this.getApiEndpoint(`/api/search?q=${encodeURIComponent(query)}&filter=${this.currentMusicFilter}`);
      const resp = await fetch(searchUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.results)) {
          this.rawYtSearchResults = data.all_results || data.results;
          this.filteredCount = data.filtered_count || 0;
          this.musicCount = data.music_count || data.results.length;
          return data.results;
        }
      }
    } catch (e) {
      console.warn('Local search proxy error, attempting fallback...', e);
    }

    // 2. Client-side fallback: try public Invidious instances
    const fallbackInstances = [
      'https://invidious.nerdvpn.de',
      'https://inv.nadeko.net',
      'https://invidious.private.coffee'
    ];

    for (const inst of fallbackInstances) {
      try {
        const resp = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
          signal: AbortSignal.timeout(4000)
        });
        if (resp.ok) {
          const items = await resp.json();
          if (Array.isArray(items)) {
            const mapped = items.map(item => {
              const classification = this.clientClassifyYouTubeItem(item.title, item.author || '');
              return {
                id: item.videoId,
                title: item.title,
                author: item.author || 'YouTube Artist',
                duration: this.formatTime(item.lengthSeconds || 0),
                views: item.viewCount ? `${(item.viewCount / 1000000).toFixed(1)}M views` : '',
                thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${item.videoId}`,
                is_music: classification.is_music,
                music_type: classification.music_type,
                badge: classification.badge
              };
            });
            this.rawYtSearchResults = mapped;
            this.filteredCount = mapped.filter(m => !m.is_music).length;
            this.musicCount = mapped.filter(m => m.is_music).length;
            if (this.currentMusicFilter === 'all') return mapped;
            return mapped.filter(m => m.is_music);
          }
        }
      } catch (err) {}
    }

    throw new Error('Unable to connect to YouTube search. Please verify your connection.');
  }

  clientClassifyYouTubeItem(title, author) {
    const titleL = (title || '').toLowerCase();
    const authorL = (author || '').toLowerCase();
    const nonMusicRegex = /\b(reaction|reacting|reacts|review|reviewed|unboxing|podcast|interview|gameplay|gaming|tutorial|how to|behind the scenes|making of|vlog|episode|season|trailer|teaser|roast|explained|prank|street food|food|recipe)\b/i;
    
    if (nonMusicRegex.test(titleL)) {
      return { is_music: false, music_type: 'video', badge: 'Video' };
    }
    if (/\b(official (music )?video|official audio)\b/i.test(titleL) || author.endsWith(' - Topic')) {
      return { is_music: true, music_type: 'official', badge: 'Official' };
    }
    if (/\b(lyrics?|karaoke)\b/i.test(titleL)) {
      return { is_music: true, music_type: 'lyrics', badge: 'Lyrics' };
    }
    if (/\b(live|concert|acoustic)\b/i.test(titleL)) {
      return { is_music: true, music_type: 'live', badge: 'Live' };
    }
    if (/\b(remix|lofi|slowed)\b/i.test(titleL)) {
      return { is_music: true, music_type: 'remix', badge: 'Remix' };
    }
    return { is_music: true, music_type: 'music', badge: 'Music' };
  }

  renderSearchTabContent(localMatches = null) {
    if (!this.ytSearchResultsList) return;

    if (this.searchActiveTab === 'yt') {
      this.renderYouTubeResultsList(this.currentYtSearchResults);
    } else {
      if (!localMatches) {
        const query = this.searchInput.value.trim().toLowerCase();
        localMatches = this.tracks.filter(t =>
          t.title.toLowerCase().includes(query) ||
          t.artist.toLowerCase().includes(query) ||
          (t.album && t.album.toLowerCase().includes(query))
        );
      }
      this.renderLocalResultsList(localMatches);
    }
  }

  renderYouTubeResultsList(results) {
    if (!results || results.length === 0) {
      this.ytSearchResultsList.innerHTML = `
        <div class="yt-search-empty-state">
          <i class="ri-youtube-line"></i>
          <span>No YouTube videos found for "${this.escapeHtml(this.searchInput.value)}"</span>
        </div>
      `;
      if (this.ytSearchAddAllBtn) this.ytSearchAddAllBtn.style.display = 'none';
      return;
    }

    if (this.ytSearchAddAllBtn) this.ytSearchAddAllBtn.style.display = 'inline-flex';

    this.ytSearchResultsList.innerHTML = results.map((res, index) => {
      const isCurrentPlaying = this.isYoutubeTrackActive && this.activeYtVideoId === res.id;
      let badgeHtml = '';
      if (res.badge) {
        const type = res.music_type || (res.is_music ? 'music' : 'non-music');
        let icon = 'ri-music-2-line';
        if (type === 'official') icon = 'ri-verified-badge-fill';
        else if (type === 'lyrics') icon = 'ri-text';
        else if (type === 'live') icon = 'ri-mic-line';
        else if (type === 'remix') icon = 'ri-disc-line';
        else if (type === 'video' || type === 'non-music') icon = 'ri-movie-line';

        badgeHtml = `<span class="yt-music-tag ${type}"><i class="${icon}"></i> ${this.escapeHtml(res.badge)}</span>`;
      }

      return `
        <div class="yt-search-item ${isCurrentPlaying ? 'is-playing' : ''}" data-index="${index}" data-id="${res.id}">
          <div class="yt-search-thumb-box">
            <img src="${res.thumbnail}" alt="${this.escapeHtml(res.title)}" class="yt-search-thumb" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${res.id}/hqdefault.jpg'">
            <div class="yt-search-thumb-overlay">
              <i class="${isCurrentPlaying ? 'ri-volume-up-line' : 'ri-play-fill'}"></i>
            </div>
            ${res.duration ? `<span class="yt-search-duration-tag">${res.duration}</span>` : ''}
          </div>
          <div class="yt-search-info">
            <div class="yt-search-title" title="${this.escapeHtml(res.title)}">
              ${this.escapeHtml(res.title)}
              ${badgeHtml}
            </div>
            <div class="yt-search-sub">
              <span class="yt-search-author"><i class="ri-youtube-fill" style="color: #FF0033;"></i> ${this.escapeHtml(res.author)}</span>
              ${res.views ? `<span class="yt-search-views">&bull; ${res.views}</span>` : ''}
            </div>
          </div>
          <div class="yt-search-actions">
            <button type="button" class="yt-search-play-btn" data-action="play" title="Play Now">
              <i class="ri-play-fill"></i> Play
            </button>
            <button type="button" class="yt-search-queue-btn" data-action="queue" title="Add to Queue">
              <i class="ri-add-line"></i>
            </button>
            <button type="button" class="yt-search-dl-btn" data-action="download" title="Save for Offline">
              <i class="ri-download-cloud-line"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events
    const items = this.ytSearchResultsList.querySelectorAll('.yt-search-item');
    items.forEach(item => {
      const idx = parseInt(item.dataset.index, 10);
      const res = results[idx];
      if (!res) return;

      // Entire row or Play button plays immediately
      item.addEventListener('click', (e) => {
        if (e.target.closest('.yt-search-queue-btn') || e.target.closest('.yt-search-dl-btn')) return;
        this.playYouTubeSearchResult(res);
      });

      // Queue button
      const queueBtn = item.querySelector('.yt-search-queue-btn');
      if (queueBtn) {
        queueBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.queueYouTubeSearchResult(res, queueBtn);
        });
      }

      // Download for Offline button
      const dlBtn = item.querySelector('.yt-search-dl-btn');
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadTrackByIdForOffline(res, dlBtn);
        });
      }
    });
  }

  renderLocalResultsList(tracks) {
    if (this.ytSearchAddAllBtn) this.ytSearchAddAllBtn.style.display = 'none';

    if (!tracks || tracks.length === 0) {
      this.ytSearchResultsList.innerHTML = `
        <div class="yt-search-empty-state">
          <i class="ri-music-2-line"></i>
          <span>No tracks found in your library for "${this.escapeHtml(this.searchInput.value)}"</span>
        </div>
      `;
      return;
    }

    this.ytSearchResultsList.innerHTML = tracks.map((track) => {
      const actualIndex = this.tracks.findIndex(t => t.id === track.id);
      const isCurrent = actualIndex === this.currentTrackIndex;
      return `
        <div class="yt-search-item ${isCurrent ? 'is-playing' : ''}" data-track-index="${actualIndex}">
          <div class="yt-search-thumb-box">
            <img src="${track.coverArt}" alt="${this.escapeHtml(track.title)}" class="yt-search-thumb">
            <div class="yt-search-thumb-overlay">
              <i class="${isCurrent && this.isPlaying ? 'ri-volume-up-line' : 'ri-play-fill'}"></i>
            </div>
            <span class="yt-search-duration-tag">${this.formatTime(track.duration || 180)}</span>
          </div>
          <div class="yt-search-info">
            <div class="yt-search-title">${this.escapeHtml(track.title)}${track.isYoutube ? ' <span class="yt-badge"><i class="ri-youtube-line"></i> YT</span>' : ''}</div>
            <div class="yt-search-sub">
              <span class="yt-search-author">${this.escapeHtml(track.artist)}</span>
              ${track.album ? `<span>&bull; ${this.escapeHtml(track.album)}</span>` : ''}
            </div>
          </div>
          <div class="yt-search-actions">
            <button type="button" class="yt-search-play-btn" style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));">
              <i class="ri-play-fill"></i> Play
            </button>
          </div>
        </div>
      `;
    }).join('');

    const items = this.ytSearchResultsList.querySelectorAll('.yt-search-item');
    items.forEach(item => {
      const idx = parseInt(item.dataset.trackIndex, 10);
      item.addEventListener('click', () => {
        if (idx >= 0) {
          this.loadTrack(idx, true);
          this.closeSearchDropdown();
        }
      });
    });
  }

  renderDirectUrlCard(videoId, rawUrl) {
    if (!this.ytSearchResultsList) return;
    this.ytSearchResultsList.innerHTML = `
      <div class="yt-search-direct-link-card">
        <div>
          <div class="yt-direct-text">
            <i class="ri-link" style="color: #FF0033;"></i> Direct YouTube Video Link
            <small>Video ID: ${videoId}</small>
          </div>
        </div>
        <button type="button" class="yt-search-play-btn" id="directStreamBtn">
          <i class="ri-play-fill"></i> Stream Now
        </button>
      </div>
    `;
    const btn = document.getElementById('directStreamBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.streamYouTubeVideo(videoId);
        this.closeSearchDropdown();
      });
    }
  }

  renderSearchError(errorMsg) {
    if (!this.ytSearchResultsList) return;
    this.ytSearchResultsList.innerHTML = `
      <div class="yt-search-empty-state">
        <i class="ri-error-warning-line" style="color: #FF5577;"></i>
        <span>${this.escapeHtml(errorMsg)}</span>
      </div>
    `;
  }

  playYouTubeSearchResult(result) {
    if (!result || !result.id) return;
    this.streamYouTubeVideo(result.id, result);
    this.closeSearchDropdown();
    this.showToast(`Playing "${result.title}"`, 'ri-youtube-line');
  }

  queueYouTubeSearchResult(result, btn) {
    if (!result || !result.id) return;
    const ytTrack = {
      id: `yt-${result.id}`,
      title: result.title,
      artist: result.author || 'YouTube',
      album: 'YouTube Stream',
      duration: result.duration ? this.parseDurationToSeconds(result.duration) : 0,
      genre: 'YouTube Stream',
      color: '#FF0033',
      accentColor: '#FF5577',
      audioUrl: '',
      isYoutube: true,
      youtubeVideoId: result.id,
      coverArt: result.thumbnail || `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg`,
      lyrics: `[00:00.00] Streaming: ${result.title}\n[00:05.00] Channel: ${result.author}\n[00:10.00] Video ID: ${result.id}\n[00:15.00] Audio streamed via YouTube IFrame API`
    };

    const existingIdx = this.tracks.findIndex(t => t.id === `yt-${result.id}`);
    if (existingIdx < 0) {
      this.tracks.push(ytTrack);
      this.updateLikedCounts();
      this.renderQueue();
    }

    if (btn) {
      btn.classList.add('added');
      btn.innerHTML = '<i class="ri-check-line"></i> Added';
      setTimeout(() => {
        btn.classList.remove('added');
        btn.innerHTML = '<i class="ri-add-line"></i>';
      }, 2000);
    }

    this.showToast(`Added to queue: "${result.title}"`, 'ri-play-list-add-line');
  }

  addAllYtResultsToQueue() {
    if (!this.currentYtSearchResults || this.currentYtSearchResults.length === 0) return;
    let addedCount = 0;
    this.currentYtSearchResults.forEach(res => {
      const existing = this.tracks.find(t => t.id === `yt-${res.id}`);
      if (!existing) {
        this.tracks.push({
          id: `yt-${res.id}`,
          title: res.title,
          artist: res.author || 'YouTube',
          album: 'YouTube Stream',
          duration: res.duration ? this.parseDurationToSeconds(res.duration) : 0,
          genre: 'YouTube Stream',
          color: '#FF0033',
          accentColor: '#FF5577',
          audioUrl: '',
          isYoutube: true,
          youtubeVideoId: res.id,
          coverArt: res.thumbnail || `https://i.ytimg.com/vi/${res.id}/hqdefault.jpg`,
          lyrics: `[00:00.00] Streaming: ${res.title}\n[00:05.00] Channel: ${res.author}\n[00:10.00] Video ID: ${res.id}\n[00:15.00] Audio streamed via YouTube IFrame API`
        });
        addedCount++;
      }
    });

    this.updateLikedCounts();
    this.renderQueue();
    this.showToast(`Added ${addedCount} tracks to queue`, 'ri-play-list-add-line');
  }

  /* --------------------------------------------------------------------------
     Offline Music Storage & PWA Android Engine
     -------------------------------------------------------------------------- */
  async renderOfflineQueue() {
    this.queueList.innerHTML = `<div style="text-align: center; padding: 24px;"><i class="ri-loader-4-line spin-icon" style="font-size: 1.5rem; color: #00F5A0;"></i></div>`;
    const offlineList = await offlineStorage.getAllTracks();
    const totalMb = await offlineStorage.getTotalStorageMb();
    this.queueCount.textContent = `${offlineList.length} offline tracks (${totalMb} MB)`;
    this.queueList.innerHTML = '';

    if (offlineList.length === 0) {
      this.queueList.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted); font-size: 0.82rem;">
          <i class="ri-download-cloud-line" style="font-size: 2.4rem; color: #00F5A0; display: block; margin-bottom: 10px;"></i>
          <strong style="color: #fff; font-size: 0.95rem;">No offline tracks downloaded</strong>
          <p style="margin-top: 6px; font-size: 0.74rem; opacity: 0.8; line-height: 1.4;">
            Play any song from YouTube and tap the <strong>Download icon</strong> in the player dock or search tab to save it for offline playback!
          </p>
        </div>
      `;
      return;
    }

    offlineList.forEach((cachedTrack) => {
      const item = document.createElement('div');
      item.className = 'queue-item';
      const isCurrent = this.tracks[this.currentTrackIndex]?.id === cachedTrack.id;
      if (isCurrent) item.classList.add('active');

      item.innerHTML = `
        <img src="${cachedTrack.coverArt}" alt="${cachedTrack.title}" class="queue-thumb">
        <div class="queue-item-info">
          <div class="queue-item-title">${cachedTrack.title} <span class="offline-badge"><i class="ri-checkbox-circle-fill"></i> ${cachedTrack.sizeMb}MB</span></div>
          <div class="queue-item-artist">${cachedTrack.artist}</div>
        </div>
        <div class="queue-item-right" style="gap: 8px;">
          <button type="button" class="icon-subtle-btn delete-offline-btn" title="Delete from offline storage" style="color: var(--text-muted); font-size: 1rem;">
            <i class="ri-delete-bin-line"></i>
          </button>
          <span class="queue-duration">${this.formatTime(cachedTrack.duration || 180)}</span>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-offline-btn')) return;
        this.playOfflineCachedTrack(cachedTrack);
      });

      const deleteBtn = item.querySelector('.delete-offline-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = confirm(`Delete "${cachedTrack.title}" from offline storage?`);
          if (ok) {
            await offlineStorage.deleteTrack(cachedTrack.id);
            this.updateOfflineCounts();
            this.renderOfflineQueue();
            this.checkIfCurrentTrackIsCached();
            this.showToast("Deleted from offline storage", "ri-delete-bin-line");
          }
        });
      }

      this.queueList.appendChild(item);
    });
  }

  async updateOfflineCounts() {
    try {
      const tracks = await offlineStorage.getAllTracks();
      if (this.countOffline) this.countOffline.textContent = tracks.length;
      const dot = document.getElementById('mobileOfflineDot');
      if (dot) dot.style.display = tracks.length > 0 ? 'block' : 'none';
    } catch(e) {}
  }

  async checkIfCurrentTrackIsCached() {
    const cur = this.tracks[this.currentTrackIndex];
    if (!cur) return;
    const isCached = await offlineStorage.isTrackCached(cur.id);
    this.updateOfflineDownloadButtons(isCached);
  }

  updateOfflineDownloadButtons(isDownloaded) {
    const iconClass = isDownloaded ? 'ri-checkbox-circle-fill' : 'ri-download-cloud-line';
    const titleText = isDownloaded ? 'Saved for Offline Playback (Click to manage)' : 'Save Song for Offline Playback';

    if (this.dockDownloadBtn) {
      this.dockDownloadBtn.classList.toggle('downloaded', isDownloaded);
      this.dockDownloadBtn.classList.remove('downloading');
      this.dockDownloadBtn.title = titleText;
      if (this.dockDownloadIcon) this.dockDownloadIcon.className = iconClass;
    }
    if (this.ytmDownloadBtn) {
      this.ytmDownloadBtn.classList.toggle('downloaded', isDownloaded);
      this.ytmDownloadBtn.classList.remove('downloading');
      this.ytmDownloadBtn.title = titleText;
      if (this.ytmDownloadIcon) this.ytmDownloadIcon.className = iconClass;
      if (this.ytmDownloadLabel) this.ytmDownloadLabel.textContent = isDownloaded ? 'Saved' : 'Download';
    }
    if (this.ytDownloadBtn) {
      this.ytDownloadBtn.classList.toggle('downloaded', isDownloaded);
      this.ytDownloadBtn.classList.remove('downloading');
      this.ytDownloadBtn.title = titleText;
      if (this.ytDownloadIcon) this.ytDownloadIcon.className = iconClass;
    }
    if (this.ytMinDownloadBtn) {
      this.ytMinDownloadBtn.classList.toggle('downloaded', isDownloaded);
      this.ytMinDownloadBtn.classList.remove('downloading');
      this.ytMinDownloadBtn.title = titleText;
      if (this.ytMinDownloadIcon) this.ytMinDownloadIcon.className = iconClass;
    }
  }

  setDownloadButtonState(state) {
    if (state === 'downloading') {
      const icon = 'ri-loader-4-line spin-icon';
      if (this.dockDownloadBtn) {
        this.dockDownloadBtn.classList.add('downloading');
        if (this.dockDownloadIcon) this.dockDownloadIcon.className = icon;
      }
      if (this.ytmDownloadBtn) {
        this.ytmDownloadBtn.classList.add('downloading');
        if (this.ytmDownloadIcon) this.ytmDownloadIcon.className = icon;
        if (this.ytmDownloadLabel) this.ytmDownloadLabel.textContent = 'Saving...';
      }
      if (this.ytDownloadBtn) {
        this.ytDownloadBtn.classList.add('downloading');
        if (this.ytDownloadIcon) this.ytDownloadIcon.className = icon;
      }
      if (this.ytMinDownloadBtn) {
        this.ytMinDownloadBtn.classList.add('downloading');
        if (this.ytMinDownloadIcon) this.ytMinDownloadIcon.className = icon;
      }
    } else {
      this.checkIfCurrentTrackIsCached();
    }
  }

  async downloadCurrentTrackForOffline() {
    const track = this.tracks[this.currentTrackIndex];
    if (!track) return;

    const videoId = track.youtubeVideoId || (track.id.startsWith('yt-') ? track.id.replace('yt-', '') : null);

    const isCached = await offlineStorage.isTrackCached(track.id);
    if (isCached) {
      const confirmDelete = confirm(`"${track.title}" is already saved offline. Would you like to remove it from offline storage?`);
      if (confirmDelete) {
        await offlineStorage.deleteTrack(track.id);
        this.updateOfflineDownloadButtons(false);
        this.updateOfflineCounts();
        if (this.activeFilter === 'offline') this.renderOfflineQueue();
        this.showToast("Removed from offline storage", "ri-delete-bin-line");
      }
      return;
    }

    this.setDownloadButtonState('downloading');
    this.showToast(`Downloading "${track.title}" for offline playback...`, "ri-download-cloud-line");

    try {
      const streamUrl = videoId
        ? this.getApiEndpoint(`/api/stream?id=${encodeURIComponent(videoId)}`)
        : track.audioUrl;
      const resp = await fetch(streamUrl);
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

      const blob = await resp.blob();
      if (!blob || blob.size < 5000) throw new Error("Invalid audio stream received");

      await offlineStorage.saveTrack(track, blob);
      this.updateOfflineDownloadButtons(true);
      this.updateOfflineCounts();
      if (this.activeFilter === 'offline') this.renderOfflineQueue();
      const mb = (blob.size / (1024 * 1024)).toFixed(1);
      this.showToast(`Saved "${track.title}" (${mb} MB) for offline playback!`, "ri-checkbox-circle-fill");
    } catch(err) {
      console.error('Offline download error:', err);
      this.setDownloadButtonState('normal');
      this.showToast(`Download failed: ${err.message || 'Network error'}`, "ri-error-warning-line");
    }
  }

  async downloadTrackByIdForOffline(result, btnEl) {
    if (!result || !result.id) return;
    const trackId = `yt-${result.id}`;

    const isCached = await offlineStorage.isTrackCached(trackId);
    if (isCached) {
      this.showToast(`"${result.title}" is already downloaded!`, "ri-checkbox-circle-fill");
      return;
    }

    if (btnEl) {
      btnEl.classList.add('downloading');
      btnEl.innerHTML = '<i class="ri-loader-4-line spin-icon"></i>';
    }
    this.showToast(`Downloading "${result.title}" for offline...`, "ri-download-cloud-line");

    try {
      const streamUrl = this.getApiEndpoint(`/api/stream?id=${encodeURIComponent(result.id)}`);
      const resp = await fetch(streamUrl);
      if (!resp.ok) throw new Error("Download server error");
      const blob = await resp.blob();

      const trackMeta = {
        id: trackId,
        youtubeVideoId: result.id,
        title: result.title,
        artist: result.author || 'YouTube Artist',
        album: 'YouTube Stream',
        duration: result.duration ? this.parseDurationToSeconds(result.duration) : 0,
        coverArt: result.thumbnail || `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg`,
        lyrics: `[00:00.00] ${result.title}\n[00:05.00] ${result.author || 'YouTube'}\n[00:10.00] Offline Cached Track`
      };

      await offlineStorage.saveTrack(trackMeta, blob);
      this.updateOfflineCounts();
      if (btnEl) {
        btnEl.classList.remove('downloading');
        btnEl.classList.add('downloaded');
        btnEl.innerHTML = '<i class="ri-checkbox-circle-fill"></i>';
      }
      const mb = (blob.size / (1024 * 1024)).toFixed(1);
      this.showToast(`Saved "${result.title}" (${mb} MB) offline!`, "ri-checkbox-circle-fill");
    } catch(err) {
      if (btnEl) {
        btnEl.classList.remove('downloading');
        btnEl.innerHTML = '<i class="ri-download-cloud-line"></i>';
      }
      this.showToast(`Download failed: ${err.message}`, "ri-error-warning-line");
    }
  }

  async playOfflineCachedTrack(cachedRecord) {
    this.stopYouTubePlayback();
    this.isYoutubeTrackActive = false;

    // Check if in tracks queue, otherwise add
    let idx = this.tracks.findIndex(t => t.id === cachedRecord.id);
    if (idx < 0) {
      this.tracks.unshift({
        id: cachedRecord.id,
        title: cachedRecord.title,
        artist: cachedRecord.artist,
        album: cachedRecord.album || 'Offline Cache',
        duration: cachedRecord.duration,
        genre: 'Offline Music',
        color: '#00F5A0',
        accentColor: '#00D9F5',
        coverArt: cachedRecord.coverArt,
        lyrics: cachedRecord.lyrics,
        isOffline: true,
        audioBlob: cachedRecord.audioBlob
      });
      idx = 0;
    }

    this.currentTrackIndex = idx;
    const curTrack = this.tracks[idx];

    // Load track metadata into UI
    this.headlineTitle.textContent = cachedRecord.title;
    this.headlineArtist.textContent = cachedRecord.artist;
    this.headlineAlbum.textContent = "Offline Storage";
    this.trackGenreTag.textContent = "Offline AAC";
    this.trackBpmTag.textContent = `${cachedRecord.sizeMb || '3.5'} MB`;
    this.mainArtworkImg.src = cachedRecord.coverArt;
    this.dockThumbImg.src = cachedRecord.coverArt;
    this.pillArtworkImg.src = cachedRecord.coverArt;
    this.dockTitle.textContent = cachedRecord.title;
    this.dockArtist.textContent = cachedRecord.artist;
    this.lyricsTrackName.textContent = `${cachedRecord.title} — ${cachedRecord.artist}`;
    this.parseAndRenderLyrics(cachedRecord.lyrics || "");

    // Set blob audio
    const blobUrl = URL.createObjectURL(cachedRecord.audioBlob);
    this.audio.src = blobUrl;
    this.updateFidelityInfo({ isLocal: true, fileType: 'm4a' });
    this.updateOfflineDownloadButtons(true);
    this.updateMediaSession(curTrack);

    await this.play();
    this.showToast(`Playing from offline cache (${cachedRecord.sizeMb} MB)`, "ri-download-cloud-fill");
  }

  initPWA() {
    // 1. Register Service Worker for offline shell support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('XYZ Player ServiceWorker active:', reg.scope);
        }).catch((err) => {
          console.warn('ServiceWorker registration error:', err);
        });
      });
    }

    // 2. Android PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPwaPrompt = e;
      if (this.pwaInstallBanner) {
        this.pwaInstallBanner.style.display = 'flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPwaPrompt = null;
      if (this.pwaInstallBanner) this.pwaInstallBanner.style.display = 'none';
      this.showToast("XYZ Player installed to your home screen!", "ri-check-line");
    });

    if (this.pwaInstallBtn) {
      this.pwaInstallBtn.addEventListener('click', async () => {
        if (!this.deferredPwaPrompt) {
          this.showToast("Open this app in Chrome over HTTPS to install it", "ri-information-line");
          return;
        }
        this.deferredPwaPrompt.prompt();
        const { outcome } = await this.deferredPwaPrompt.userChoice;
        if (outcome === 'accepted') {
          this.showToast("XYZ Player installed to your Android home screen!", "ri-check-line");
        }
        this.deferredPwaPrompt = null;
        if (this.pwaInstallBanner) this.pwaInstallBanner.style.display = 'none';
      });
    }

    if (this.pwaDismissBtn) {
      this.pwaDismissBtn.addEventListener('click', () => {
        if (this.pwaInstallBanner) this.pwaInstallBanner.style.display = 'none';
      });
    }

    // 3. Online/Offline network monitoring
    window.addEventListener('online', () => {
      if (this.offlineIndicator) this.offlineIndicator.style.display = 'none';
      this.showToast("Back online • YouTube streams enabled", "ri-wifi-line");
    });

    window.addEventListener('offline', () => {
      if (this.offlineIndicator) this.offlineIndicator.style.display = 'flex';
      this.showToast("You are offline • Playing from cached library", "ri-wifi-off-line");
    });

    if (!navigator.onLine && this.offlineIndicator) {
      this.offlineIndicator.style.display = 'flex';
    }
  }

  updateMediaSession(track) {
    if (!('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'XYZ Player',
        artwork: [
          { src: track.coverArt, sizes: '96x96', type: 'image/png' },
          { src: track.coverArt, sizes: '192x192', type: 'image/png' },
          { src: track.coverArt, sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seekTo(details.seekTime);
      });
    } catch(e) {}
  }

  parseDurationToSeconds(str) {
    if (!str || typeof str !== 'string') return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return (parts[0] * 60) + parts[1];
    } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return 0;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.obsidianApp = new ObsidianMusicApp();
});

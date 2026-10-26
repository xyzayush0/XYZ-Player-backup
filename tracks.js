// Pre-loaded tracks with rich metadata and full LRC synced lyrics
export const TRACKS_DATA = [
  {
    id: "track-1",
    title: "Midnight Horizon",
    artist: "XYZ Synth",
    album: "Neon Odyssey",
    duration: 32,
    genre: "Synthwave / Cyberpunk",
    color: "#7F52FF",
    accentColor: "#00F2FE",
    audioUrl: "audio/midnight-horizon.wav",
    coverArt: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231a0836"/><stop offset="50%" stop-color="%2343167a"/><stop offset="100%" stop-color="%2300f2fe"/></linearGradient><radialGradient id="sun" cx="50%" cy="60%" r="40%"><stop offset="0%" stop-color="%23ff007f"/><stop offset="100%" stop-color="%237f52ff" stop-opacity="0"/></radialGradient></defs><rect width="600" height="600" fill="url(%23g1)"/><circle cx="300" cy="330" r="140" fill="url(%23sun)"/><path d="M0 420 L600 420 M0 450 L600 450 M0 490 L600 490 M0 540 L600 540 M0 600 L600 600" stroke="%2300f2fe" stroke-width="2" opacity="0.4"/><polygon points="300,160 380,310 220,310" fill="none" stroke="%23ffffff" stroke-width="3" opacity="0.8"/><text x="300" y="560" font-family="sans-serif" font-weight="900" font-size="28" fill="%23ffffff" letter-spacing="8" text-anchor="middle" opacity="0.9">MIDNIGHT HORIZON</text></svg>`,
    bpm: 110,
    scale: ["C4", "D#4", "F4", "G4", "A#4", "C5"],
    lyrics: `[00:00.00] (Instrumental Neon Prelude)
[00:04.50] Neon lights reflection on the glass
[00:08.00] Speeding through the grid where the memories pass
[00:12.40] Electric pulses synchronizing in the dark
[00:16.80] In this cyber city, every shadow leaves a mark
[00:20.50] Can you hear the rhythm calling through the wire?
[00:24.90] Burning through the night with a violet fire
[00:28.20] Midnight horizon, guiding us home`
  },
  {
    id: "track-2",
    title: "Ethereal Echoes",
    artist: "Aura Soundscape",
    album: "Floating Islands",
    duration: 30,
    genre: "Ambient / Lo-Fi Chill",
    color: "#00F5A0",
    accentColor: "#00D2FF",
    audioUrl: "audio/ethereal-echoes.wav",
    coverArt: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23041c1f"/><stop offset="50%" stop-color="%23083d3b"/><stop offset="100%" stop-color="%2300f5a0"/></linearGradient></defs><rect width="600" height="600" fill="url(%23bg)"/><circle cx="300" cy="280" r="160" fill="none" stroke="%2300d2ff" stroke-width="2" opacity="0.4"/><circle cx="300" cy="280" r="100" fill="none" stroke="%2300f5a0" stroke-width="4" opacity="0.6"/><circle cx="300" cy="280" r="40" fill="%23ffffff" opacity="0.8"/><text x="300" y="520" font-family="sans-serif" font-weight="700" font-size="24" fill="%23ffffff" letter-spacing="6" text-anchor="middle">ETHEREAL ECHOES</text><text x="300" y="555" font-family="sans-serif" font-weight="400" font-size="16" fill="%2300f5a0" letter-spacing="4" text-anchor="middle">AURA SOUNDSCAPE</text></svg>`,
    bpm: 85,
    scale: ["D4", "F#4", "A4", "B4", "D5"],
    lyrics: `[00:00.00] (Gentle Rain & Lo-fi Chords)
[00:05.50] Floating above the mist of quiet thoughts
[00:10.00] Untangling the webs and every riddle knot
[00:15.50] A soft breath carries the morning chime
[00:20.00] Suspended outside the boundaries of time
[00:25.50] Feel the weight release, watch the river bend`
  },
  {
    id: "track-3",
    title: "Cyber Pulse",
    artist: "Nova Drift",
    album: "Supernova 2026",
    duration: 28,
    genre: "Future Bass / Melodic",
    color: "#FF2A85",
    accentColor: "#7F52FF",
    audioUrl: "audio/cyber-pulse.wav",
    coverArt: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%232b002a"/><stop offset="50%" stop-color="%23700b52"/><stop offset="100%" stop-color="%23ff2a85"/></linearGradient></defs><rect width="600" height="600" fill="url(%23bg3)"/><path d="M 150 450 Q 300 100 450 450" fill="none" stroke="%23ffffff" stroke-width="4" opacity="0.7"/><circle cx="300" cy="260" r="70" fill="%23ff2a85" opacity="0.6"/><circle cx="300" cy="260" r="35" fill="%23ffffff"/><text x="300" y="520" font-family="sans-serif" font-weight="800" font-size="26" fill="%23ffffff" letter-spacing="6" text-anchor="middle">CYBER PULSE</text></svg>`,
    bpm: 128,
    scale: ["F4", "G#4", "A#4", "C5", "D#5"],
    lyrics: `[00:00.00] (Speeding Up Particles)
[00:05.00] Breaking through the atmosphere at speed of light
[00:10.50] Leaving all the gravitational pulls behind tonight
[00:15.00] Supercharged engines ignite the starry trace
[00:20.50] Dancing through the infinite wonders of space
[00:25.00] Velocity maximum, burning bright`
  },
  {
    id: "track-4",
    title: "Quantum Realm",
    artist: "Kuroshio Resonance",
    album: "Deep Matter",
    duration: 30,
    genre: "Dark Electro / Minimal",
    color: "#9D4EDD",
    accentColor: "#E0AAFF",
    audioUrl: "audio/quantum-realm.wav",
    coverArt: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><radialGradient id="darkBg" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="%23240046"/><stop offset="60%" stop-color="%2310002b"/><stop offset="100%" stop-color="%2305010a"/></radialGradient></defs><rect width="600" height="600" fill="url(%23darkBg)"/><rect x="200" y="200" width="200" height="200" rx="20" fill="none" stroke="%23c77dff" stroke-width="4" transform="rotate(45 300 300)" opacity="0.8"/><text x="300" y="530" font-family="sans-serif" font-weight="800" font-size="24" fill="%23ffffff" letter-spacing="5" text-anchor="middle">QUANTUM REALM</text></svg>`,
    bpm: 95,
    scale: ["E4", "G4", "A4", "B4", "D5"],
    lyrics: `[00:00.00] (Sub Bass Rumble & Atmospheric Tension)
[00:05.00] Under the monolith we stand
[00:10.00] Shadows stretching far across the glassland
[00:15.00] Sub-frequencies shaking the foundation deep
[00:20.00] Secrets that the midnight circuits keep
[00:25.00] Resonate, vibrate, elevate the sound`
  },
  {
    id: "track-5",
    title: "Solar Drift",
    artist: "Solaris Duo",
    album: "Warmth",
    duration: 32,
    genre: "Acoustic / Warm Pop",
    color: "#FF9E00",
    accentColor: "#FF5400",
    audioUrl: "audio/solar-drift.wav",
    coverArt: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="warm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23370617"/><stop offset="50%" stop-color="%239d0208"/><stop offset="85%" stop-color="%23ff9e00"/><stop offset="100%" stop-color="%23ffea00"/></linearGradient></defs><rect width="600" height="600" fill="url(%23warm)"/><circle cx="300" cy="300" r="120" fill="%23ffffff" opacity="0.3"/><circle cx="300" cy="300" r="80" fill="%23ffea00" opacity="0.8"/><text x="300" y="530" font-family="sans-serif" font-weight="900" font-size="26" fill="%23ffffff" letter-spacing="6" text-anchor="middle">SOLAR DRIFT</text></svg>`,
    bpm: 78,
    scale: ["C4", "E4", "G4", "A4", "C5"],
    lyrics: `[00:00.00] (Warm Strumming & Chords)
[00:05.00] Sun dipping low over the coastal line
[00:10.00] Golden reflections like aged vintage wine
[00:15.00] We sat by the water, watching colors blend
[00:20.00] Wishing this moment would never have an end
[00:26.00] Golden hour glow, keep me in your light`
  }
];

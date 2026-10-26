/**
 * XYZ Player — High-Performance IndexedDB Offline Storage Engine
 * Stores full audio blobs, metadata, synchronized lyrics, and artwork for offline playback
 */

const DB_NAME = 'XYZPlayerOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_songs';

class OfflineStorageEngine {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('artist', 'artist', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  /**
   * Save a track and its audio blob into IndexedDB
   */
  async saveTrack(trackMeta, audioBlob) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id: trackMeta.id,
        videoId: trackMeta.youtubeVideoId || trackMeta.id.replace('yt-', ''),
        title: trackMeta.title,
        artist: trackMeta.artist || 'YouTube Artist',
        album: trackMeta.album || 'Offline Cache',
        duration: trackMeta.duration || 0,
        coverArt: trackMeta.coverArt || `https://i.ytimg.com/vi/${trackMeta.youtubeVideoId || trackMeta.id}/hqdefault.jpg`,
        lyrics: trackMeta.lyrics || '',
        audioBlob: audioBlob,
        mimeType: audioBlob.type || 'audio/mp4',
        sizeBytes: audioBlob.size,
        sizeMb: (audioBlob.size / (1024 * 1024)).toFixed(2),
        cachedAt: Date.now(),
        isOffline: true
      };

      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get track by ID (including audio Blob)
   */
  async getTrack(id) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Check if track is cached
   */
  async isTrackCached(id) {
    await this.initPromise;
    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getKey(id);

      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  }

  /**
   * Get all cached tracks sorted by newest first
   */
  async getAllTracks() {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
        resolve(list);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Delete track from offline storage
   */
  async deleteTrack(id) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Calculate total storage used in MB
   */
  async getTotalStorageMb() {
    const tracks = await this.getAllTracks();
    const totalBytes = tracks.reduce((sum, t) => sum + (t.sizeBytes || 0), 0);
    return (totalBytes / (1024 * 1024)).toFixed(1);
  }
}

export const offlineStorage = new OfflineStorageEngine();

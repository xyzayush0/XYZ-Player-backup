#!/usr/bin/env python3
"""
Custom development server for XYZ Player.
Provides static file serving + intelligent YouTube music search proxy (/api/search?q=...&filter=...).
Filters out non-music content (reactions, reviews, podcasts, tutorials, vlogs, gameplay, etc.).
"""

import http.server
import json
import os
import re
import socketserver
import subprocess
import sys
import urllib.parse
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

NON_MUSIC_REGEX = re.compile(
    r'\b(reaction|reacting|reacts|review|reviewed|reviewing|unboxing|podcast|'
    r'interview|interviewed|talk show|gameplay|gaming|walkthrough|playthrough|let\'s play|'
    r'speedrun|highlights|tutorial|how to|behind the scenes|making of|bloopers|'
    r'vlog|daily vlog|episode|ep\s*\d+|season\s*\d+|full movie|documentary|'
    r'news|breaking news|parody|roast|explained|explaining|tier list|'
    r'meme|memes|compilation|prank|street food|food|recipe|'
    r'try not to laugh|mukbang|challenge|q&a|haul|comedy|skit|pubg|bgmi|gta|minecraft)\b',
    re.IGNORECASE
)

MUSIC_CHANNEL_KEYWORDS = [
    'records', 'music', 'sound', 'label', 'audio', 't-series', 'sony',
    'zee', 'tips', 'yrf', 'universal', 'warner', 'def jam', 'atlantic',
    'interscope', 'columbia', 'spinnin', 'monstercat', 'anjunabeats',
    'saregama', 'speed records', 'desimusicfactory', 'tseries'
]

def classify_youtube_item(title, author, is_verified_artist, duration_text):
    title_lower = title.lower()
    author_lower = author.lower()

    # 1. Immediate non-music disqualifiers
    if NON_MUSIC_REGEX.search(title_lower):
        return {
            'is_music': False,
            'music_type': 'video',
            'badge': 'Video'
        }

    # 2. Length check: single songs are rarely > 20 mins
    is_very_long = False
    if duration_text:
        parts = duration_text.split(':')
        if len(parts) == 3 and int(parts[0]) > 0:
            is_very_long = True
        elif len(parts) == 2 and int(parts[0]) > 20:
            is_very_long = True

    is_topic = author.endswith(' - Topic')
    has_vevo = 'vevo' in author_lower or 'vevo' in title_lower
    has_record_label = any(lbl in author_lower for lbl in MUSIC_CHANNEL_KEYWORDS)

    # 3. Categorized Music Badges
    if re.search(r'\b(official (music )?video|official audio|official lyrical)\b', title_lower):
        badge = 'Official Video' if 'video' in title_lower else 'Official Audio'
        return {'is_music': True, 'music_type': 'official', 'badge': badge}

    if is_topic:
        return {'is_music': True, 'music_type': 'official', 'badge': 'Official Track'}

    if is_verified_artist:
        return {'is_music': True, 'music_type': 'official', 'badge': 'Verified Artist'}

    if re.search(r'\b(lyrics?|lyric video|karaoke|sing along)\b', title_lower):
        return {'is_music': True, 'music_type': 'lyrics', 'badge': 'Lyrics'}

    if re.search(r'\b(live( at| in| performance)?|concert|acoustic|unplugged|orchestral)\b', title_lower):
        return {'is_music': True, 'music_type': 'live', 'badge': 'Live'}

    if re.search(r'\b(remix|slowed|reverb|bass boosted|lofi|lo-fi|flip|mix|mashup)\b', title_lower):
        return {'is_music': True, 'music_type': 'remix', 'badge': 'Remix'}

    if re.search(r'\b(cover|rendition|acoustic cover)\b', title_lower):
        return {'is_music': True, 'music_type': 'cover', 'badge': 'Cover'}

    # 4. General music indicators
    music_indicators = re.search(
        r'\b(song|track|audio|visualizer|album|ep|single|prod\.|feat\.|ft\.|ost|soundtrack|instrumental)\b',
        title_lower
    )
    if music_indicators or has_vevo or has_record_label or (' x ' in title_lower) or (' feat ' in title_lower):
        return {'is_music': True, 'music_type': 'music', 'badge': 'Music'}

    # 5. Formats like "Artist - Title" without non-music red flags
    if (' - ' in title or ' | ' in title) and not is_very_long:
        if any(w in author_lower for w in ['artist', 'band', 'dj', 'official', 'singer', 'composer', 'beats']):
            return {'is_music': True, 'music_type': 'music', 'badge': 'Music'}

    return {'is_music': False, 'music_type': 'video', 'badge': 'Video'}


def fetch_raw_youtube(query):
    url = 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false'
    payload = json.dumps({
        'context': {
            'client': {
                'clientName': 'WEB',
                'clientVersion': '2.20230515.01.00',
                'hl': 'en',
                'gl': 'US'
            }
        },
        'query': query
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    )

    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    results = []
    section_list = (
        data.get('contents', {})
        .get('twoColumnSearchResultsRenderer', {})
        .get('primaryContents', {})
        .get('sectionListRenderer', {})
        .get('contents', [])
    )

    for sec in section_list:
        item_sec = sec.get('itemSectionRenderer', {}).get('contents', [])
        for item in item_sec:
            vr = item.get('videoRenderer')
            if not vr:
                continue
            vid = vr.get('videoId')
            if not vid:
                continue

            title_runs = vr.get('title', {}).get('runs', [])
            title = ''.join(r.get('text', '') for r in title_runs) if title_runs else ''

            owner_runs = vr.get('ownerText', {}).get('runs', [])
            author = ''.join(r.get('text', '') for r in owner_runs) if owner_runs else 'YouTube Creator'

            owner_badges = vr.get('ownerBadges', [])
            is_verified_artist = False
            for b in owner_badges:
                mb = b.get('metadataBadgeRenderer', {})
                icon_type = mb.get('icon', {}).get('iconType', '')
                tooltip = mb.get('tooltip', '').lower()
                style = mb.get('style', '')
                if 'OFFICIAL_ARTIST' in icon_type or 'artist' in tooltip or 'VERIFIED_ARTIST' in style:
                    is_verified_artist = True

            length_text = vr.get('lengthText', {}).get('simpleText', '')
            view_text = vr.get('shortViewCountText', {}).get('simpleText', '')

            thumbs = vr.get('thumbnail', {}).get('thumbnails', [])
            thumb = thumbs[-1].get('url') if thumbs else f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg'
            if thumb.startswith('//'):
                thumb = 'https:' + thumb

            classification = classify_youtube_item(title, author, is_verified_artist, length_text)

            results.append({
                'id': vid,
                'title': title,
                'author': author,
                'duration': length_text,
                'views': view_text,
                'thumbnail': thumb,
                'url': f'https://www.youtube.com/watch?v={vid}',
                'is_music': classification['is_music'],
                'music_type': classification['music_type'],
                'badge': classification['badge']
            })

    return results


class XYZRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/api/search':
            self.handle_youtube_search(parsed)
            return

        if parsed.path == '/api/stream':
            self.handle_audio_stream(parsed)
            return

        if parsed.path == '/api/info':
            self.handle_video_info(parsed)
            return

        super().do_GET()

    def handle_youtube_search(self, parsed):
        params = urllib.parse.parse_qs(parsed.query)
        query = params.get('q', [''])[0].strip()
        filter_mode = params.get('filter', ['music'])[0].strip().lower()

        if not query:
            self.send_json_response(400, {'error': 'Query parameter "q" is required', 'results': []})
            return

        try:
            # First search with raw query
            raw_items = fetch_raw_youtube(query)

            # Check if query yielded few music results
            music_candidates = [r for r in raw_items if r['is_music']]
            seen_ids = set(r['id'] for r in raw_items)

            # If user wants music and query has < 8 music tracks, also query music variation
            query_lower = query.lower()
            has_explicit_music_term = any(t in query_lower for t in ['song', 'music', 'audio', 'track', 'album', 'remix', 'lyrics'])
            if filter_mode in ('music', 'official', 'lyrics', 'live') and len(music_candidates) < 8 and not has_explicit_music_term:
                try:
                    supplementary = fetch_raw_youtube(f"{query} song")
                    for sup in supplementary:
                        if sup['id'] not in seen_ids:
                            seen_ids.add(sup['id'])
                            raw_items.append(sup)
                except Exception:
                    pass

            # Final classification counts
            music_tracks = [r for r in raw_items if r['is_music']]
            non_music_count = len(raw_items) - len(music_tracks)

            # Filter results based on mode
            if filter_mode == 'official':
                filtered_results = [r for r in raw_items if r['music_type'] == 'official']
            elif filter_mode == 'lyrics':
                filtered_results = [r for r in raw_items if r['music_type'] == 'lyrics']
            elif filter_mode == 'live':
                filtered_results = [r for r in raw_items if r['music_type'] == 'live']
            elif filter_mode == 'all':
                filtered_results = raw_items
            else:
                # Default: pure music tracks only!
                filtered_results = music_tracks

            self.send_json_response(200, {
                'query': query,
                'filter': filter_mode,
                'results': filtered_results[:25],
                'all_results': raw_items[:35],
                'music_count': len(music_tracks),
                'filtered_count': non_music_count,
                'total_found': len(raw_items)
            })

        except Exception as e:
            self.send_json_response(500, {'error': str(e), 'results': []})

    def handle_audio_stream(self, parsed):
        params = urllib.parse.parse_qs(parsed.query)
        video_id = params.get('id', [''])[0].strip()

        if not video_id or not re.match(r'^[a-zA-Z0-9_-]{8,15}$', video_id):
            self.send_json_response(400, {'error': 'Valid video "id" parameter is required'})
            return

        try:
            cmd = ['node', 'stream_helper.js', video_id, 'stream']
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

            self.send_response(200)
            self.send_header('Content-Type', 'audio/mp4')
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=86400')
            self.end_headers()

            while True:
                chunk = proc.stdout.read(64 * 1024)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break

            proc.kill()
        except Exception as e:
            try:
                self.send_json_response(500, {'error': str(e)})
            except Exception:
                pass

    def handle_video_info(self, parsed):
        params = urllib.parse.parse_qs(parsed.query)
        video_id = params.get('id', [''])[0].strip()
        if not video_id:
            self.send_json_response(400, {'error': 'Valid video "id" is required'})
            return
        try:
            out = subprocess.check_output(['node', 'stream_helper.js', video_id, 'info'], timeout=12)
            data = json.loads(out.decode())
            self.send_json_response(200, data)
        except Exception as e:
            self.send_json_response(500, {'error': str(e)})

    def send_json_response(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), XYZRequestHandler) as httpd:
        print(f"XYZ Player Server running on http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

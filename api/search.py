"""Vercel serverless endpoint for public YouTube Music search."""

from http.server import BaseHTTPRequestHandler
import json
import re
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

NON_MUSIC = re.compile(
    r'\b(reaction|review|podcast|interview|gameplay|walkthrough|tutorial|vlog|'
    r'full movie|documentary|news|meme|compilation|prank|food|recipe|challenge)\b',
    re.IGNORECASE,
)


def music_metadata(title, author, verified, duration):
    text = f"{title} {author}".lower()
    if NON_MUSIC.search(title):
        return False, 'video', 'Video'
    if re.search(r'\b(official (music )?video|official audio)\b', text) or author.endswith(' - Topic') or verified:
        return True, 'official', 'Official Track'
    if re.search(r'\b(lyrics?|karaoke|sing along)\b', title, re.I):
        return True, 'lyrics', 'Lyrics'
    if re.search(r'\b(live|concert|acoustic|unplugged)\b', title, re.I):
        return True, 'live', 'Live'
    if re.search(r'\b(remix|slowed|reverb|lofi|lo-fi|mix|mashup|cover)\b', title, re.I):
        return True, 'remix', 'Remix'
    indicators = r'\b(song|track|audio|visualizer|album|single|feat\.|ft\.|ost|soundtrack|instrumental)\b'
    labels = r'(records|music|sound|label|audio|vevo|t-series|sony|universal|warner|saregama)'
    if re.search(indicators, title, re.I) or re.search(labels, author, re.I) or ' - ' in title:
        return True, 'music', 'Music'
    return False, 'video', 'Video'


def youtube_search(query):
    payload = json.dumps({
        'context': {'client': {'clientName': 'WEB', 'clientVersion': '2.20230515.01.00', 'hl': 'en', 'gl': 'US'}},
        'query': query,
    }).encode()
    request = Request('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', payload, {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; XYZPlayer/2.5)',
    })
    with urlopen(request, timeout=10) as response:
        data = json.loads(response.read().decode())

    sections = data.get('contents', {}).get('twoColumnSearchResultsRenderer', {}).get('primaryContents', {}).get('sectionListRenderer', {}).get('contents', [])
    results = []
    for section in sections:
        for item in section.get('itemSectionRenderer', {}).get('contents', []):
            video = item.get('videoRenderer', {})
            video_id = video.get('videoId')
            if not video_id:
                continue
            title = ''.join(run.get('text', '') for run in video.get('title', {}).get('runs', []))
            author = ''.join(run.get('text', '') for run in video.get('ownerText', {}).get('runs', [])) or 'YouTube Creator'
            duration = video.get('lengthText', {}).get('simpleText', '')
            verified = any('OFFICIAL_ARTIST' in badge.get('metadataBadgeRenderer', {}).get('icon', {}).get('iconType', '') for badge in video.get('ownerBadges', []))
            is_music, music_type, badge = music_metadata(title, author, verified, duration)
            thumbs = video.get('thumbnail', {}).get('thumbnails', [])
            thumbnail = thumbs[-1].get('url') if thumbs else f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg'
            results.append({
                'id': video_id, 'title': title, 'author': author, 'duration': duration,
                'views': video.get('shortViewCountText', {}).get('simpleText', ''),
                'thumbnail': 'https:' + thumbnail if thumbnail.startswith('//') else thumbnail,
                'url': f'https://www.youtube.com/watch?v={video_id}',
                'is_music': is_music, 'music_type': music_type, 'badge': badge,
            })
    return results


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._headers()
        self.end_headers()

    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        query = params.get('q', [''])[0].strip()
        mode = params.get('filter', ['music'])[0].lower()
        if not query:
            return self._json(400, {'error': 'Query parameter "q" is required', 'results': []})
        try:
            items = youtube_search(query)
            music = [item for item in items if item['is_music']]
            if mode == 'official':
                results = [item for item in items if item['music_type'] == 'official']
            elif mode in ('lyrics', 'live'):
                results = [item for item in items if item['music_type'] == mode]
            elif mode == 'all':
                results = items
            else:
                results = music
            self._json(200, {'query': query, 'filter': mode, 'results': results[:25], 'all_results': items[:35], 'music_count': len(music), 'filtered_count': len(items) - len(music), 'total_found': len(items)})
        except Exception as error:
            self._json(502, {'error': f'YouTube search is temporarily unavailable: {error}', 'results': []})

    def _headers(self):
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')

    def _json(self, status, body):
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self._headers()
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

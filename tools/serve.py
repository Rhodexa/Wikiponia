#!/usr/bin/env python3
"""Static server for testing on a phone: like `python -m http.server`, but tells browsers not to cache,
so a refresh always gets the files you just changed."""
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
http.server.ThreadingHTTPServer(('0.0.0.0', port), NoCache).serve_forever()

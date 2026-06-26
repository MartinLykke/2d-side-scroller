"""Tiny static server for Kingdom — Crown of Embers.
Serves the game with no-cache headers so the browser always gets the latest
files (no stale game.js after edits). Serves from this file's own folder."""
import http.server, socketserver, os

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Kingdom serving on http://localhost:{PORT}/")
    httpd.serve_forever()

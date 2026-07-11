"""Tiny static server for Kingdom — Crown of Embers.
Serves the game with no-cache (but revalidatable) headers so the browser
always gets the latest files after edits, while unchanged files come back
as cheap 304s. Threaded + HTTP/1.1 keep-alive so the ~54 ES module
requests don't queue up serially. Serves from this file's own folder."""
import http.server, os

PORT = int(os.environ.get("PORT", 8000))
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive: reuse connections across module requests

    def end_headers(self):
        # no-cache (not no-store): browser must revalidate, but a 304 avoids re-download
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
    print(f"Kingdom serving on http://localhost:{PORT}/")
    httpd.serve_forever()

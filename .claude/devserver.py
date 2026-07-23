# 개발용 정적 서버 — 브라우저가 ES 모듈을 캐시해 편집분이 반영 안 되는 것을 막기 위해
# 모든 응답에 no-store 를 붙인다. 프로덕션과 무관한 로컬 프리뷰 전용.
import sys
from http.server import SimpleHTTPRequestHandler, test


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    test(HandlerClass=NoCacheHandler, port=port, bind="127.0.0.1")

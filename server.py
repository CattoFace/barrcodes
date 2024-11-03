from http.server import HTTPServer, SimpleHTTPRequestHandler

with open('index.html', 'rb') as file:
    data = file.read()
class CustomHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        if(self.path.split('/')[-1].find(".")!=-1):
            super().do_GET()
        else:
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(data)

if __name__ == "__main__":
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, CustomHandler)
    httpd.serve_forever()


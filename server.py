import web
from os import path

test_resp="""{
  "status": {
    "code": 200,
    "response": "OK"
  },
  "elapsed_time": "create took 27.8198719025 ms",
  "result": {
    "added": 16,
    "job_id": 2103,
    "status_url": "http:\/\/data.labs.freebase.com\/spreadsheet\/2103",
    "loader": "<freeq.client.loader.tripleloader.TripleLoader instance at 0x3621b00>",
    "queue": "spreadsheet",
    "action_type": "LOAD_TRIPLE"
  },
  "timestamp": "2009-12-05 22:52:24.902485"
}"""

test_status="""{
  "status": {
    "code": 200,
    "response": "OK"
  },
  "elapsed_time": "show took 13611.1028194 ms",
  "result": {
    "count": 16,
    "attr_info": null,
    "job_id": 2103,
    "finish_time": null,
    "fb_user": "\/user\/revdokimov",
    "attr_guid": "\/user\/revdokimov\/attr\/1",
    "mdo_guid": "\/guid\/9202a8c04000641f80000000120bd7fc",
    "agent": "TripleLoader",
    "running": true,
    "create_time": "2009-12-05 22:52:24.875",
    "comments": null,
    "mdo_info": "",
    "graphport": "sandbox",
    "fb_operator": "\/user\/spreadsheet_bot",
    "details": [
      {
        "status": "noop",
        "count": "%d",
        "min": "00:00:00.013",
        "max": "00:00:01.056",
        "sum": "00:00:01.671",
        "action": "LOAD_TRIPLE",
        "avg": "00:00:00.104"
      }
    ]
  },
  "timestamp": "2009-12-05 22:53:37.013149"
}"""

noop=16

rootdir = path.abspath('.')
def getFile(filename):
    filename = path.join(rootdir, filename)
    print filename
    if (not filename.startswith(rootdir)):
        return None
    if (not path.exists(filename)):
        return None
    f = open(filename, 'r')
    contents = f.read()
    f.close()
    return contents

class index:
    def handle(self, filename, i):
        if (filename == ""):
            filename = "recon.html"
            web.header('Content-type','text/html')
        if (filename== "freeq/spreadsheet/"):
            web.header('Content-type','application/json')
            return test_resp
        global noop
        if (filename== "freeq/spreadsheet/2103"):
            web.header('Content-type','application/json')
            if noop: noop-=1
            return test_status % noop

        contents = getFile(filename)
        if ("data" in i):
            data = i.data.replace("'", "\\'")
            return contents.replace("<!--    POSTed data goes here      -->",
                                    "<script language='javascript'>handlePOSTdata('%s')</script>" % data)
        return contents
        
    def POST(self, filename):
        return self.handle(filename, web.input())
    def GET(self, filename):
        return self.handle(filename, web.input())
        

web.config.debug = False
urls = ('/(.*)', 'index')
app = web.application(urls, globals())
if __name__ == "__main__":
    web.httpserver.runsimple(app.wsgifunc(), ("localhost",9777))

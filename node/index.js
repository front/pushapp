var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");

var handle = {}
handle["/"] = requestHandlers.start;
handle["/start"] = requestHandlers.start;
handle["/upload"] = requestHandlers.upload;
handle["/show"] = requestHandlers.show;
handle["/ticker"] = requestHandlers.ticker;
handle["/sendtext"] = requestHandlers.sendtext;
handle["/receive_postmark_data"] = requestHandlers.receive_postmark_data;




server.start(router.route, handle);
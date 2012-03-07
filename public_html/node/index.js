var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");

var handle = {}
handle["/moderate"] = requestHandlers.moderate;
handle["/receive_postmark_data"] = requestHandlers.receive_postmark_data;



server.start(router.route, handle);
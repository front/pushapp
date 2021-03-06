var http = require("http");
var url = require("url");
var config = require('./config');



function start(route, handle) {
  function onRequest(request, response) {
    var pathname = url.parse(request.url).pathname;
    console.log("Request for " + pathname + " received.");
    route(handle, pathname, response, request);
  
    var postData = "";
  
  request.setEncoding("utf8");
  
  request.addListener("data", function(postDataChunk) {
    postData += postDataChunk;
    //console.log("Received POST data chunk '" + postDataChunk + "'.");
  });
  
  request.addListener("end", function() {
    if (postData)
      {
      console.log("GOT POST DATA");
      require('./requestHandlers.js').handlePostData(pathname, response, request, postData);
      }    
      else{
        console.log("NO POST DATA");
        //console.log(request);
      }
      
  });
}

  http.createServer(onRequest).listen(config.serverPort);
  console.log("Server has started.");
}

exports.start = start;
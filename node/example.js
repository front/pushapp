var http = require('http');
var express = require('express');
var io = require('socket.io');
var url = require('url');





var app = express.createServer();
var io = io.listen(app);





io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});




app.get('/',function(req,res){
  res.send('Hello W');
  var pathname = url.parse(req.url).pathname;
  res.send(pathname);
  console.log(pathname);

})

app.listen(3000);

/*http.createServer(function (request, response) {
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end('Hello World\n');
}).listen(8124);
*/
console.log('Server running at http://127.0.0.1:8124/');
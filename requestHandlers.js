var querystring = require("querystring"),
    fs = require("fs"),
    formidable = require("formidable"),
    Pusher = require("node-pusher");
    //redis = require("redis");
    
    
    
    //var publisher = redis.createClient();
    var pusher = new Pusher({
          appId: '15933',
          key: 'b060dbe058972b568c93',
          secret: 'f5be4e8224711cb58a4b'
        });

        var channel = 'messages';
    var socket_id = '1302.1081607';
    var form = new formidable.IncomingForm();
    

/*
 *  START
 */
function start(response) {
  console.log("Request handler 'start' was called.");

  var body = '<html>'+
    '<head>'+
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'+
    '</head>'+
    '<body>'+
    '<form action="/upload" enctype="multipart/form-data" method="post">'+
    '<input type="file" name="upload" multiple="multiple">'+
    '<input type="submit" value="Upload file" />'+
    '</form>'+
    '</body>'+
    '</html>';

    response.writeHead(200, {"Content-Type": "text/html"});
    response.write(body);
    response.end();
}

/*
 *  UPLOAD
 */
function upload(response, request) {
  console.log("Request handler 'upload' was called.");

//  var form = new formidable.IncomingForm();
  //form.uploadDir = "/img";
  console.log("about to parse:");
  console.log( request );
  form.parse(request, function(error, fields, files) {
    console.log( "files:");
    console.log( files );
    //var old_path = files.upload.path; 
    //var new_path = "img/img1.png";
    //console.log( old_path + " ---> " + new_path);
    
/*
    fs.readFile(old_path, function (err, data) {
      console.log("err1" + err);
      fs.writeFile(new_path, data, function (err) {
        console.log("err2" + err);
      });
    });
    */
    //save link to db
    //publisher.rpush("img", new_path, redis.print);
    
    
    

    /* Possible error on Windows systems:
       tried to rename to an already existing file */
  /*  fs.rename(files.upload.path, "/tmp/test.png", function(err) {
      if (err) {
        fs.unlink("/tmp/test.png");
        fs.rename(files.upload.path, "/tmp/test.png");
      }
    });*/
    response.writeHead(200, {"Content-Type": "text/html"});
    response.write("received image:<br/>");
    response.write("<img src='/show' />");
    response.end();
  });
}

/*
 *  SHOW
 */

function show(response) {
  console.log("Request handler 'show' was called.");
  fs.readFile("/tmp/test.png", "binary", function(error, file) {
    if(error) {
      response.writeHead(500, {"Content-Type": "text/plain"});
      response.write(error + "\n");
      response.end();
    } else {
      response.writeHead(200, {"Content-Type": "image/png"});
      response.write(file, "binary");
      response.end();
    }
  });
}



/*
 *  TICKER
 */
function ticker(response, request){

      var data = {
        from: 'Jaewoong',
        content: 'Hellojj, World'
      };
  
  response.writeHead(200,{"Content-Type": "text/html"});
  response.write("Ticker");
  
  var event = 'new_image';

  pusher.trigger(channel, event, data, socket_id, function(error, request, response) {
   
   /* 
  var subscriber = redis.createClient(), publisher2 = redis.createClient(), msg_count = 0;
  subscriber.on("subscribe", function (channel, count) {
        publisher2.publish("mychannel", "I am sending a message.");
        publisher2.publish("mychannel", "I am sending a second message.");
        publisher2.publish("mychannel", "I am sending my last message.");
    });
    subscriber.on("message", function (channel, message) {
        console.log("subscriber channel " + channel + ": " + message);
        msg_count += 1;
        if (msg_count === 3) {
            subscriber.unsubscribe();
            subscriber.end();
            publisher2.end();
        }
    });

    subscriber.incr("did a thing");
    subscriber.subscribe("mychannel");
  
  */
    
  });
  response.end();
}

/*
* TEXTSEND
*/
function sendtext(res,req){
  
  if (req.method = "GET"){

    var body ='';
    body = '<html>'+
    '<head>'+
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'+
    '</head>'+
    '<body>'+
    '<form action="/sendtext"  method="POST">'+
    '<input type="text" name="sendtext">'+
    '<input type="submit" value="sendtext" />' +
    '</form>'+
    '</body>'+
    '</html>';

    res.writeHead(200, { "Content-Type": "text/html" });
    res.write(body);
    res.method = "POST";
    res.end();

  }
  else{ console.log("Error, was expecting GET data"); } 
}

/*
 *  handlePostData
 *
 *  This is called from server each time there is postdata attached to the request.
 *  It will always recevie the full batch of postdata.
 */ 
function handlePostData(pathname, response, request, postData) {
  
   var json = querystring.parse(postData);   
   
   var event = "new_text";
   pusher.trigger(channel, event, json, socket_id, function(error, request, response) {});
  
  }

exports.start = start;
exports.upload = upload;
exports.show = show;
exports.ticker = ticker;
exports.sendtext = sendtext;
exports.handlePostData = handlePostData;

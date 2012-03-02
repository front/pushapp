var querystring = require("qs"),
    fs = require("fs"),
    formidable = require("formidable"),
    Pusher = require("node-pusher");
    //MailParser = require("mailparser").MailParser;

var redis = require("redis");
var redis_client = redis.createClient();

var temp = require('temp');
    
    
    
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
  //console.log("about to parse:");
  //console.log( request );
  form.parse(request, function(error, fields, files) {
    //console.log( "files:");
    //console.log( files );
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
 
 
 /*
 *  Function that returns 8 random characters.
 */
function randomString() {
 	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
 	var string_length = 8;
 	var randomstring = '';
 	for (var i=0; i<string_length; i++) {
 		var rnum = Math.floor(Math.random() * chars.length);
 		randomstring += chars.substring(rnum,rnum+1);
 	}
 	return randomstring;
}

function pushToFrontEnd( event, json){
  pusher.trigger(channel, event, json, socket_id, function(error, request, response) {});
  
}


function handlePostData(pathname, response, request, postData) {

  response.on("end", function(){
    console.log("this is the end");
    var json = JSON.parse(postData);    
  })
  
  
  
  
  var json = JSON.parse(postData);
   
  if ( pathname == "/sendtext" ) {
      pusher.trigger(channel, event, json, socket_id, function(error, request, response) {});
  }
  
  
  if (pathname == "/receive_postmark_data"){
    
    var fileContent = json.Attachments[0].Content;
    fileContent = decode64(fileContent);
    var fileName = json.Attachments[0].Name;
    var fullFilePath = __dirname + "/images/" + randomString() + fileName;
    console.log("fullfilepath:" + fullFilePath);
    
    
    // Write image to file
    try {
      
      fs.writeFile( fullFilePath, fileContent, function(err){
        if (!err) {
          console.log( "File saved: " + fullFilePath );
          
          // TODO: if successful, write filepath to redis
          redis_client.on("error", function (err) {
              console.log("Redis Error " + err);
          });
          redis_client.rpush("images", fullFilePath);
          
          
          
          // Push batch to server
          var batch = {};
          batch.new_img = fullFilePath;
          var json = JSON.stringify(batch);
          pushToFrontEnd ("new_image", json);
        }  else { 
          console.log(" Error saving file: " + err );
          }   
      });
      
      
      
      
    } 
      catch(e){console.log("WARNING: Error when saving. No attachment?");}


/*
  if (json.Attachments){
      for(var i=0; i<json.Attachments.length; i++) {
        
      }
        
		}()
*/
    response.end();
  }
}


function receive_postmark_data(res,req){
  //console.log("in receive postmark data");

  res.end();
}

function decode64(input) {
  
  var keyStr = "ABCDEFGHIJKLMNOP" +
               "QRSTUVWXYZabcdef" +
               "ghijklmnopqrstuv" +
               "wxyz0123456789+/" +
               "=";
  
     var output = "";
     var chr1, chr2, chr3 = "";
     var enc1, enc2, enc3, enc4 = "";
     var i = 0;

     // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
     var base64test = /[^A-Za-z0-9\+\/\=]/g;
     if (base64test.exec(input)) {
        alert("There were invalid base64 characters in the input text.\n" +
              "Valid base64 characters are A-Z, a-z, 0-9, ´+´, ´/´, and ´=´\n" +
              "Expect errors in decoding.");
     }
     input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

     do {
        enc1 = keyStr.indexOf(input.charAt(i++));
        enc2 = keyStr.indexOf(input.charAt(i++));
        enc3 = keyStr.indexOf(input.charAt(i++));
        enc4 = keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 != 64) {
           output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
           output = output + String.fromCharCode(chr3);
        }

        chr1 = chr2 = chr3 = "";
        enc1 = enc2 = enc3 = enc4 = "";

     } while (i < input.length);

     return output;
  }

exports.start = start;
exports.upload = upload;
exports.show = show;
exports.ticker = ticker;
exports.sendtext = sendtext;
exports.handlePostData = handlePostData;
exports.receive_postmark_data = receive_postmark_data;

// Modules

var querystring = require("qs");
var fs = require("fs");
var formidable = require("formidable");
var Pusher = require("node-pusher");
var redis = require("redis");
//var temp = require('temp');
//var MailParser = require("mailparser").MailParser;


// Setup Redis
var redis_client = redis.createClient();
redis_client.on("error", function (err) {
    console.log("Redis Error " + err);
});

// Setup Pusher    
var pusher = new Pusher({
  appId: '15933',
  key: 'b060dbe058972b568c93',
  secret: 'f5be4e8224711cb58a4b'
});
var channel = 'messages';
var socket_id = '1302.1081607';

// Setup formidable (not needed?)
var form = new formidable.IncomingForm();
 
  
/*
 *  START (for testing only)
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
 *  UPLOAD (for testing only)
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
 *  SHOW (for testing only)
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
 *  TICKER (for testing only)
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
 * TEXTSEND (for testing only)
 */
function sendtext(res,req){
  
/*
 *  Helperfunction that returns 8 random characters.
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

/*
* Helperfunction to push data to pusher
*/
function pushToFrontEnd( event, json){
  pusher.trigger(channel, event, json, socket_id, function(error, request, response) {});
  
}

/*
 *  handlePostData
 *
 *  This is called from server each time there is postdata attached to the request.
 *  It will always recevie the full batch of postdata. TODO: Break this up into smaller pieces
 */
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
    
    
    var batch = {};
    
    //Grab Subject if it exists
    if (json.Subject){
      var mailSubject = json.Subject;
      redis_client.rpush("content", mailSubject);
      batch.new_subject = mailSubject;
      console.log("Subject: " + mailSubject);
    } 
    else { console.log("WARNING No subject") }
    
    
    // Grab the first attachment if it exists
    if (json.Attachments[0]) {
      var fileContent = json.Attachments[0].Content;
      var decodedFileContent = new Buffer(fileContent, 'base64').toString('ascii');
    
      // Create full path for the file to be created. Add 8 random characters in beginning of filename to avoid duplicate names.
      var fileName = json.Attachments[0].Name;
      var fullFilePath = __dirname + "/images/" + randomString() + fileName;
    
      // Write attachment to file
      fs.writeFile( fullFilePath, decodedFileContent, function(err){
        if (!err) {
          console.log( "File saved: " + fullFilePath );
          
          // If successful, write filepath to redis
          redis_client.rpush("content", fullFilePath);
          
          // Push batch to server with event new_image.
          batch.new_img = fullFilePath;
        } else {console.log("Error writing to file " + fullFilePath);}           
      }); //end fs.write 
          
      var json = JSON.stringify(batch);
      pushToFrontEnd ("new_image", json);
      } 
    else { console.log(" WARNING No attachment: "); }
    
  }  
  
  response.end();
}


function receive_postmark_data(res,req){
  //console.log("in receive postmark data");

  res.end();
}

exports.start = start;
exports.upload = upload;
exports.show = show;
exports.ticker = ticker;
exports.sendtext = sendtext;
exports.handlePostData = handlePostData;
exports.receive_postmark_data = receive_postmark_data;

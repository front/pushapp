var TWITTER_ACTIVE = false;
var EMAIL_ACTIVE = true;
var TWITTER_SEARCH_TERM = "#help";
var MILLISECONDS_EACH_ITEM_SHOULD_STAY_ON_SCREEN = 5000; // in milliseconds

// Try experiment with these to give more or less weight to the two parameters that determine the queue algorithm
var TIMES_SHOWN_WEIGHT = 1;
var TIME_SINCE_ADDED_WEIGTH = 100;

// Modules
var querystring = require("qs");
var fs = require("fs");
var Pusher = require("node-pusher");
var redis = require("redis");
var TwitterNode = require("twitter-node").TwitterNode;
var PriorityQueue = require("Priority-Queue-NodeJS");
var path = require('path');
var priorityQueue = new PriorityQueue();

//var temp = require('temp');
//var MailParser = require("mailparser").MailParser;

// UGLY: global variable. Because of redis datastructure I see no other way...
var last_saved = 0;
var last_pushed = 0;

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

// Setup twitter

if (TWITTER_ACTIVE){
  var twit = new TwitterNode({
     user: 'henrikakselsen', 
     password: 'tr.ai4Dawin',
     //host: 'my_proxy.my_company.com',         // proxy server name or ip addr
     //port: 8080,                              // proxy port!
     track: [ TWITTER_SEARCH_TERM ]         // sports!
     //follow: [12345, 67890],                  // follow these random users
     //locations: [-122.75, 36.8, -121.75, 37.8] // tweets in SF
   });
 
   twit.addListener('tweet', function(tweet) {
       //console.log("New tweet: " + tweet.text);
       saveTweet(tweet);
     })
     twit.addListener('error', function(error) {
       console.log("twitter error: " + error.message);
     });

  twit.stream();
}
  
  function saveTweet(tweet){
    saveToDatabase( tweet.text, "http://api.twitter.com/1/users/profile_image?screen_name="+tweet.user.screen_name+"&size=bigger");
  }
  
/*
 *  Helperfunction that returns 8 random characters.
 */

function randomString() {
 	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
 	var string_length = 8;
 	var randomstring = '';
 	for (var i=0; i < string_length; i++) {
 		var rnum = Math.floor(Math.random() * chars.length);
 		randomstring += chars.substring(rnum,rnum+1);
 	}
 	return randomstring;
}


function start(){
  //TODO: Rebuild priorityQueue if it exists items in the db already.
  setInterval(pushToFrontEnd, MILLISECONDS_EACH_ITEM_SHOULD_STAY_ON_SCREEN);
}

function pow (x, n) {
 	if(n < 0){
 		return 0;
 	}

 	if(n === 0){
 		return 1;
 	}
 	var temp = pow(x, Math.floor(n/2));
 	if(n % 2 === 0){
 		return temp * temp;
 	}
 	else{
 		return temp * temp * x;
 	}
};

 /*
  * Gets the most prioritized item and push it
  */
function pushToFrontEnd(){
  var currentTopPri = priorityQueue.getTopPri();
  var nextInLine = priorityQueue.pop();
  if (!nextInLine) return;

  if (nextInLine === last_pushed){
    currentTopPri = priorityQueue.getTopPri();
    nextInLine = priorityQueue.pop();
    if (!nextInLine) return;
    
    // TODO: calculate new priority
  }
  console.log( "Priority winning: " + currentTopPri);

  // Get the currently most prioritized hash
  var query = redis_client.hgetall( "content:" + nextInLine, function(err,res) {
    if(!err) {
      var now = new Date().getTime();
      var timesShown = res.timesShown;
      var timesShownNeg = timesShown * -1;
      var timeAdded = res.timeAdded;
      var hoursSinceAdded = (now - timeAdded)/(1000*60*60);
            
      // Push
      var json = { text: res.text, image: res.image};
      json = JSON.stringify(json);
      pusher.trigger(channel, "new_message", json, socket_id, function(error, request, response) {
        if(!err) {
          //console.log("successfully pushed")
          }
        else {console.log("error while pushing");}
        
      });

      // calculate new priority. This is the heart of the queue algorithm and based on the (p - 1) / (t + 2)^1.5
      // algorithm, with added weights for experimentation.
      var newPri = ((timesShownNeg-1) * TIMES_SHOWN_WEIGHT)/((hoursSinceAdded+2) * TIME_SINCE_ADDED_WEIGTH);
      //var newPri = (timesShownNeg * TIMES_SHOWN_WEIGHT)/(hoursSinceAdded * TIME_SINCE_ADDED_WEIGTH);
      
      var newPri = pow( newPri, 1.5 );
      
      
      console.log("item "+nextInLine+" -> timesShown:" + timesShown +  " | newPri: " + newPri + " | hoursSinceAdded: " + hoursSinceAdded );
      
      // Increase times shown
      timesShown++;
      redis_client.hset( "content:" + nextInLine, "timesShown", timesShown );
      
      // TODO Push the nextInLine back in the queue with lower pri
      priorityQueue.push(nextInLine,newPri );
      last_pushed=nextInLine;  
    }
    else console.log("WARNING no elements fetched from redis db: " + err);
  });
 
}

/*
 *  saveToDatabase(text,image)
 *  Receives 
 */
function saveToDatabase(text,image ){
  var id = redis_client.incr( "id", function( err, index ){
    var now = new Date().getTime();
    //console.log("DATE: " + d);
    if(!err) redis_client.hmset( "content:" + index, "text", text, "image", image, "timeAdded", now, "timesShown", 1,  function(err,res){
      last_saved = index;
      priorityQueue.push( last_saved, 100); 
      
      // Push new saved node to admin
      var json = { index:index, text: text, image: image};
      json = JSON.stringify(json);
      pusher.trigger(channel, "new_unmoderated", json, socket_id, function(error, request, response) {});
        
      
    });
  }); 
} 

/*
 *  handlePostData
 *
 *  This is called from server each time there is postdata attached to the request.
 *  It will always recevie the full batch of postdata. TODO: Break this up into smaller pieces
 */ 
 function remove(index){
   
   //Remove from db
   redis_client.hdel("content:"+index, "text","image","timeAdded","timesShown");
   
   //Remove from queue
   
   
 }
 
 
function handlePostData(pathname, response, request, postData) {

  response.on("end", function(){
    console.log("this is the end");
    var json = JSON.parse(postData);    
  });
  
  var json = JSON.parse(postData);
   
  if ( pathname == "/moderate" ) {
      console.log("OK, will moderate");
      console.log(json.index);
      remove(json.index);
  }
  
  
  if (pathname == "/receive_postmark_data"){
    
    console.log("receive postmark data");        
    //Grab Subject if it exists
    if (json.Subject){
      //saveToDatabase("message", json.Subject);
      console.log("Subject: " + json.Subject);
    } 
    else { console.log("WARNING No subject"); }
    
    
    // Grab the first attachment if it exists
    if (json.Attachments[0]) {
      var fileContent = json.Attachments[0].Content;
      var decodedFileContent = new Buffer(fileContent, 'base64');
    
      // Create full path for the file to be created. Add 8 random characters in beginning of filename to avoid duplicate names.
      var fileName = json.Attachments[0].Name;
      var fullFilePath = "postmark_images/" + randomString() + fileName;
    
      // Write attachment to file
      fs.writeFile( fullFilePath, decodedFileContent, function(err){
        if (!err) {
          console.log( "File saved: " + fullFilePath );
          
          // If successful, write filepath to redis
          //redis_client.rpush("content", fullFilePath);
          saveToDatabase (json.Subject,"node/" + fullFilePath);
          //getTime
        } else { console.log("Error writing to file " + fullFilePath); }           
      }); //end fs.write 
    } //end if attachment
    else { console.log(" WARNING No attachment: "); }
  }  
  
  response.end();
}

function receive_postmark_data(res,req){
  console.log("in receive postmark data");

  res.end();
}

function moderate(res,req){
  console.log("in moderate");
  res.writeHead(200, {'Content-Type': 'text/plain'});
  
  res.end('Hello World\n');
}

start();

exports.handlePostData = handlePostData;
exports.receive_postmark_data = receive_postmark_data;
exports.moderate = moderate;
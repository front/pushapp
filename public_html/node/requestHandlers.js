var config = require('./config');


// Modules
var querystring = require("qs");
var fs = require("fs");
var Pusher = require("node-pusher");
var redis = require("redis");
var TwitterNode = require("twitter-node").TwitterNode;
var PriorityQueue = require("Priority-Queue-NodeJS");
var path = require('path');

// UGLY: global variable. Because of redis datastructure I see no other way...
var priorityQueue = new PriorityQueue();
var last_saved = 0;
var last_pushed = 0;

// Setup Redis
var db = redis.createClient();
db.on("error", function (err) {
    console.log("Redis Error " + err);
});

// Setup Pusher    
var pusher = new Pusher({
  appId: config.pusherAppID,
  key: config.pusherKey,
  secret: config.pusherSecret
});

// Setup twitter
if (config.twitterActive) {
  
  var twit = new TwitterNode({
     user: config.twitterUser
     ,password: config.twitterPassword
     //host: 'my_proxy.my_company.com',         // proxy server name or ip addr
     //port: 8080,                              // proxy port!
     ,track: [ config.twitterSearchTerm ]         // sports!
     ,follow: [18601762]                  // follow these random users
     //locations: [-122.75, 36.8, -121.75, 37.8] // tweets in SF
   });
 
   twit.addListener('tweet', function(tweet) {
       saveTweet(tweet);
     })
     twit.addListener('error', function(error) {
       console.log("twitter error: " + error.message);
     });

  twit.stream();
}
  
function saveTweet(tweet){
    //saveToDatabase( tweet.text, "http://api.twitter.com/1/users/profile_image?screen_name="+tweet.user.screen_name+"&size=bigger");
    if (tweet.entities.media){
      //console.log("here");
      //console.log(tweet.entities.media);
      if(tweet.entities.media[0].media_url){
        //console.log("and here");
       //console.log(tweet.entities.media.media_url);
       saveToDatabase( tweet.text, tweet.entities.media[0].media_url + ":" + config.twitterImageSize);
       console.log( tweet.entities.media[0].media_url + ":" + config.twitterImageSize);
       console.log( tweet.text);
      }
     }
     else{
       saveToDatabase( tweet.text, "http://img.tweetimag.es/i/"+tweet.user.screen_name+"_o");
       console.log("Couldn't find tweet image, so sent user image instead");
  }
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
  setInterval(pushToFrontEnd, config.timeInterval);
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

function pushContent(text,image){
  var json = { text: text, image: image};
  json = JSON.stringify(json);
  pusher.trigger(config.channel, "new_message", json, config.socket_id, function(err, req, res) {
    if(err) console.log( err );  
  });
}

function l(text){
  console.log(text);
}
function getNewPri( timesShown, timeAdded ){

  var hoursSinceAdded = (new Date().getTime() - timeAdded)/(1000*60*60);
  var newPri = (((timesShown * -1) - 1) * config.timesShownWeight)/((hoursSinceAdded + 2) * config.ageWeight);  
  newPri = pow( newPri, 1.5 );
  
  return newPri;
}
function getItemFromDB(index){
  var query = db.hgetall( "content:" + index, function(err,res) {
    return res;
  });
}

 /*
  * Gets the most prioritized item and push it
  */
function pushToFrontEnd(){
  
  // Get the score for the top item
  var currentTopPri = priorityQueue.getTopPri();
  
  // pop the top item
  var nextIndex = priorityQueue.pop();
  
  // If it exist...
  if (!nextIndex) return;

  // ...check if it is the item currently on the screen
  if (nextIndex === last_pushed && last_pushed != 0 ){
    console.log("next in line is the same as last");
    
    // If it is, then get that item...
    var query = db.hgetall( "content:" + nextIndex, function(err,item) {
    
      // ...and set a new priority
      var timesShown = item.timesShown;
      var newPri = getNewPri (timesShown, ++timesShown);
    
      nextIndex = priorityQueue.pop();
      if (!nextIndex) return;
    });
  }
  //console.log( "Priority winning: " + currentTopPri);

  // Get the currently most prioritized hash
    
  var query = db.hgetall( "content:" + nextIndex, function(err,item) {

    // PushContent
    pushContent(item.text, item.image);

    // calculate new priority. This is the heart of the queue algorithm and based on the (p - 1) / (t + 2)^1.5
    // algorithm, with added weights for experimentation.
    var newPri = getNewPri (item.timesShown, item.timeAdded);
    //console.log("item "+ nextIndex + " -> timesShown:" + item.timesShown +  " | newPri: " + newPri + " | timeAdded: " + item.timeAdded );
    // Push the nextIndex back in the queue with lower pri
    priorityQueue.push(nextIndex,newPri );  
    // Increase times shown
    var timesShown = item.timesShown;
    db.hset( "content:" + nextIndex, "timesShown", ++timesShown );
  

    last_pushed=nextIndex;  
    rebuildQueue();
});
}

/*
 *  saveToDatabase(text,image)
 *  Receives 
 */
function saveToDatabase(text,image ){
  var id = db.incr( "id", function( err, index ){
    var now = new Date().getTime();
    //console.log("DATE: " + d);
    if(!err) db.hmset( "content:" + index, "text", text, "image", image, "timeAdded", now, "timesShown", 1,  function(err,res){
      last_saved = index;
      priorityQueue.push( last_saved, 100); 
      
      // Push new saved node to admin
      var json = { index:index, text: text, image: image};
      json = JSON.stringify(json);
      pusher.trigger(config.channel, "new_unmoderated", json, config.socket_id, function(error, request, response) {});
        
      
    });
  }); 
} 

/*
 *  handlePostData
 *
 *  This is called from server each time there is postdata attached to the request.
 *  It will always recevie the full batch of postdata. TODO: Break this up into smaller pieces
 */ 
 function removeItem(index){
   
   //Remove from db
   db.hdel("content:"+index, "text","image","timeAdded","timesShown");
   
   //Remove from queue
  
 }
 
 
function handlePostData(pathname, response, request, postData) {
  
  var json = JSON.parse(postData);
   
  if ( pathname == "/moderate" ) {
      console.log("Item received for moderation");
      console.log(json.index);
      removeItem(json.index);
  }
  
  
  if (pathname == "/receive_postmark_data"){
    
    console.log("receive postmark data");  
    
    var Subject = (json.Subject) ? json.Subject : "";
    
    // Grab the first attachment if it exists
    if (json.Attachments[0]) {
      
      var decodedFileContent = new Buffer(json.Attachments[0].Content, 'base64');
    
      // Create full path for the file to be created. Add 8 random characters in beginning of filename to avoid duplicate names.
      var fileName = json.Attachments[0].Name;
      var fullFilePath = "postmark_images/" + randomString() + fileName;
    
      // Write attachment to file
      fs.writeFile( fullFilePath, decodedFileContent, function(err){
        if (!err) {
          console.log( "File saved: " + fullFilePath );
          
          // If successful, write filepath to redis
          saveToDatabase (Subject,"node/" + fullFilePath);
        } else { 
          console.log("Error writing to file " + fullFilePath); 
          saveToDatabase (Subject,null);
          } 
                
      });  
    }
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

function rebuildQueue(){
	var i=0;
	var len =  priorityQueue.len();
	//l(len);
	
	priorityQueue = new PriorityQueue();
  
	for( i=0;  i < 10; i++ ){
	  l(i);
	  db.hgetall( "content:"+i,function(err,res){
	    var newPri = getNewPri( res.timesShown,res.timeAdded );
	    priorityQueue.push( i, newPri);
	    l("pushed index " + i + " with priority " + newPri);
	  });
	}
}

function sendAllContentToFrontEnd(){
  
}

start();

exports.handlePostData = handlePostData;
exports.receive_postmark_data = receive_postmark_data;
exports.moderate = moderate;
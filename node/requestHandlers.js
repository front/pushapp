var TWITTER_SEARCH_TERM = "#help";
var TIME_TO_STAY_ON_SCREEN = 1000; // in milliseconds

// Modules
var querystring = require("qs");
var fs = require("fs");
var Pusher = require("node-pusher");
var redis = require("redis");
var TwitterNode = require("twitter-node").TwitterNode;
var PriorityQueue = require("Priority-Queue-NodeJS");

var priorityQueue = new PriorityQueue();

//var temp = require('temp');
//var MailParser = require("mailparser").MailParser;

// UGLY: global variable. Because of redis datastructure I see no other way...
var last_saved = 0;
var last_shown = 0;

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

pushAlgorithm();

function pushAlgorithm(){
  setInterval(pushToFrontEnd, TIME_TO_STAY_ON_SCREEN);
}

/*
 * Gets the most prioritized item and push it
 */
 
var pow = function(x, n) {
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

function pushToFrontEnd(){
  
  //Change to pop later
  var nextInLine = priorityQueue.pop();
  //var timesShown = hgetA
  //console.log("nextInLine: " + nextInLine );
  
  // Get the currently most prioritized hash
  var query = redis_client.hgetall( "content:" + nextInLine, function(err,res) {
    if(!err) {
      var now = new Date().getTime();
      var timesShown = res.timesShown;
      //console.log("timesShown = " +  res.timeAdded);
      var timesShownNeg = timesShown * -1;
      var timeAdded = res.timeAdded;
      var hoursSinceAdded = (now - timeAdded)/(1000*60*60);
      
      //console.log( "timesShown=" +  timesShown + " | timeAdded=" + timeAdded);
      
      // Push
      var json = { text: res.text, image: res.image};
      json = JSON.stringify(json);
      pusher.trigger(channel, "new_message", json, socket_id, function(error, request, response) {
        if(!err) {
          //console.log("successfully pushed")
          }
        else {console.log("error while pushing");}
        
      });
      
      

      
      
      // calculate new priority
      var newPri = (timesShownNeg-1)/(hoursSinceAdded+2);
      //console.log("newpri " + newPri);
      var newPri = pow( newPri, 1.5 );
      console.log("For item "+nextInLine+" -> timesShown:" + timesShown +  " | newPri: " + newPri + " | hoursSinceAdded: " + hoursSinceAdded );
      
      // Increase times shown
      timesShown++;
      redis_client.hset( "content:" + nextInLine, "timesShown", timesShown );
      
      // TODO Push the nextInLine back in the queue with lower pri
      priorityQueue.push(nextInLine,newPri );
      
    }
    
    else console.log("WARNING no elements fetched from redis db: " + err);
  });
 
}
  
function saveToDatabase(text,image ){
  var id = redis_client.incr( "id", function( err, index ){
    var seconds = new Date().getTime();
    //console.log("DATE: " + d);
    if(!err) redis_client.hmset( "content:" + index, "text", text, "image", image, "timeAdded", seconds, "timesShown", 1,  function(err,res){
      // if(!err)console.log( "Saving to redis -> content:" + index);
      last_saved = index;
      //console.log("last saved set to " + last_saved);
    
      priorityQueue.push( last_saved, 100);
      
    });
    
    }); 
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
  });
  
  var json = JSON.parse(postData);
   
  if ( pathname == "/sendtext" ) {
      pusher.trigger(channel, event, json, socket_id, function(error, request, response) {});
  }
  
  
  if (pathname == "/receive_postmark_data"){
            
    //Grab Subject if it exists
    if (json.Subject){
      saveToDatabase("message", json.Subject);
      console.log("Subject: " + json.Subject);
    } 
    else { console.log("WARNING No subject"); }
    
    
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
          //redis_client.rpush("content", fullFilePath);
          saveToDatabase (json.Subject,fullFilePath);
          //getTime
        } else { console.log("Error writing to file " + fullFilePath); }           
      }); //end fs.write 
    } //end if attachment
    else { console.log(" WARNING No attachment: "); }
    
  }  
  
  response.end();
}





function receive_postmark_data(res,req){
  //console.log("in receive postmark data");

  res.end();
}

exports.handlePostData = handlePostData;
exports.receive_postmark_data = receive_postmark_data;
/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

var moment = require('moment');

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

var request = require('request');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

var weather_base_url = appEnv.getServiceURL("multiregion_weatherinsights");
var cloudant_creds = appEnv.getServiceCreds("multiregion_cloudant");

var Cloudant = require('cloudant');
var cloudant_client = Cloudant({account:cloudant_creds.username, password:cloudant_creds.password});
var db = cloudant_client.db.use('postcards');

// create a new express server
var app = express();
app.set('view engine', 'html');
app.set('layout', 'layout');
app.enable('view cache');
app.engine('html', require('hogan-express'));

var REGIONS = {
    "ibm:yp:us-south": "Dallas",
    "ibm:yp:eu-gb": "London",
    "ibm:yp:au-syd": "Sydney",
};

var region = REGIONS[process.env.BLUEMIX_REGION];
if (typeof region === "undefined") {
	region = 'Sydney';
}

var GEOCODES = {
    "Dallas": "32.8,-96.8",
    "London": "51.5,-0.1",
    "Sydney": "-33.9,151.2"
};

var geocode = GEOCODES[region];
var callURL = weather_base_url + "api/weather/v2/observations/current" +
      "?geocode=" + geocode + "&language=en-US&units=m";
  
function getDoc(doc) {
	var id = doc.id;
	return new Promise(function(resolve, reject) {
			db.get(id, function(err, body){
        			resolve(body);
        		});
		});
}                                                                                                  

function getCards() {
	return new Promise(function(resolve, reject) {
			db.list(function(err, body) {
					if (!err) {
						var promises = body.rows.map(getDoc);
		       			Promise.all(promises).then(function(cards){
		       						cards.sort(compareCards);
									resolve(cards);
								});     
					}               
				});
		});
}

function getBackgroundPath() {
	return new Promise(function(resolve, reject){
		request.get(callURL, function (error, response, body) {
		        body = JSON.parse(body);
		        
		        //day_ind is "D" for day, "N" for night
		    	//defaults to day if not 'N'
		        if (body.observation.day_ind === "N") {
		            resolve("images/" + region + "-night.jpg");
		        } else {
		        	resolve("images/" + region + "-day.jpg");
		   		}
		
		});
	});
}

function deleteDoc(doc) {
	var id = doc.id;
	var rev = doc.value.rev;
	return new Promise(function(resolve, reject) {
			db.destroy(id, rev, function(err, body) {
	  			if (!err) {
	 			   resolve(body);
	 			} else {
	 			   console.log(err);
	 			   
	 			   //we still want to try to delete other cards so we will not reject
	 			   resolve(err);
	 			}
			});
		});
}

function deleteCards(){
	return new Promise(function(resolve, reject) {
			db.list(function(err, body) {
					if (!err) {
						var promises = body.rows.map(deleteDoc);
		       			Promise.all(promises).then(function(responses){
									resolve(responses);
								});     
					}               
				});
		});
}

function convertToRelativeTime(card) {
	card.time = moment(card.time).fromNow();
	return card;
}

function compareCards(a, b) {
	if (a.time < b.time) {return -1;}
	else if (a.time > b.time) {return 1;}
	return 0;
}

function uploadDefaultStamp(body) {
	/*
		All default stamp images can be found at the Wikimedia Commons urls below:
		
		Dallas-stamp(https://commons.wikimedia.org/wiki/File:The_Margaret_Hunt_Hill_Bridge.02.jpg) 							- CC BY 2.0
		London-stamp(https://commons.wikimedia.org/wiki/London#/media/File:Bigben.jpg) 										- CC BY-SA 3.0
		Sydney-stamp(https://commons.wikimedia.org/wiki/Sydney_Opera_House#/media/File:Sydney_opera_house_side_view.jpg) 	- CC BY-SA 3.0
		
		The images use the following Creative Commons Licensing:
		
		CC BY 2.0 		- https://creativecommons.org/licenses/by/2.0/deed.en
		CC BY-SA 3.0 	- https://creativecommons.org/licenses/by-sa/3.0/deed.en
	 */
	
	var fs = require('fs');
	var default_stamp = __dirname + '/views/public/images/' + region + '-stamp.jpg';
	var id = body.id;
	var rev = body.rev;
	return new Promise(function(resolve, reject) {
			fs.createReadStream(default_stamp).pipe(db.attachment.insert(id, 'stamp.jpeg', null, 'image/jpeg', {rev: rev}, 
				function(err, response) {
						if (err) {console.log(err);}
						resolve(response);
					}));
			});
}

app.get('/', function(req, res){
	/*
		All background images can be found at the Wikimedia Commons urls below:
		
		Dallas-day(https://commons.wikimedia.org/wiki/Dallas,_Texas#/media/File:Dallas_Downtown.jpg) 					- CC BY-SA 2.0
		Dallas-night(https://commons.wikimedia.org/wiki/File:Dallas_at_Night_from_South.jpg) 							- CC BY 3.0
		Dallas-dusk(https://commons.wikimedia.org/wiki/File:Dallas_skyline.jpg) 										- CC BY-SA 2.0	
		London-day(https://commons.wikimedia.org/wiki/London#/media/File:London_Skyline.jpg) 							- CC BY-SA 3.0
		London-night(https://commons.wikimedia.org/wiki/London#/media/File:PalaceOfWestminsterAtNight.jpg) 				- CC BY-SA 2.0
		London-dusk(https://commons.wikimedia.org/wiki/London#/media/File:London_Thames_Sunset_panorama_-_Feb_2008.jpg)	- CC BY 3.0
		Sydney-day(https://commons.wikimedia.org/wiki/Sydney#/media/File:S%C3%ADdney-Australia30.JPG) 					- CC BY-SA 3.0
		Sydney-night(https://commons.wikimedia.org/wiki/File:Sydney,_Australia.jpg)										- CC BY 2.0
		Sydney-dusk(https://commons.wikimedia.org/wiki/Sydney#/media/File:Sydney_skyline_at_dusk_-_Dec_2008.jpg)		- CC BY-SA 3.0
		
		The images use the following Creative Commons Licensing:
		
		CC BY 2.0 		- https://creativecommons.org/licenses/by/2.0/deed.en
		CC BY-SA 2.0 	- https://creativecommons.org/licenses/by-sa/2.0/deed.en
		CC BY 3.0 		- https://creativecommons.org/licenses/by/3.0/deed.en
		CC BY-SA 3.0 	- https://creativecommons.org/licenses/by-sa/3.0/deed.en
	*/
	
	var background_prom = getBackgroundPath();
	var cards_prom = getCards();
	var promises = [background_prom, cards_prom];
	Promise.all(promises).then(function(results) {
						res.locals = {background: results[0], 
									  region: region, 
									  account:cloudant_creds.username};
						res.render('template', {cards: results[1].map(convertToRelativeTime)});
					});
});

app.post('/add', function(req, res) {
	/*
		Stamp images are randomly returned by lorempixel.com.
		Images supplied by lorempixel.com are released under the Creative Commons License (CC BY-SA) http://creativecommons.org/licenses/
		If for some reason an image can not be retrieved from lorempixel.com, a default image is provided via uploadDefaultStamp()		
	*/
	
	//may want to add more error handling
	db.insert({region: region, time: moment().valueOf()},
		function(err, body) {
			if (err) {
		  		console.log("Error on add");
		  		console.log(err);
		  	} else {
			  	request('http://lorempixel.com/80/100/', 
			  		function(err, resp, bod) {
			  			//added to handle pipe error when lorempixel is down
			  			if (err) {uploadDefaultStamp(body).then(res.redirect('back'));}
			  		})
			  	.pipe(db.attachment.insert(body.id, 'stamp.jpeg', null, 'image/jpeg', {rev: body.rev}, 
				  	function(err, response) {
			  			if (err) {console.log(err);}
			  			res.redirect('back');
			  		}));
	  		}
  		});
});

app.post('/delete', function(req, res) {
	deleteCards().then(function(responses) {res.redirect('back');});
});

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/views/public'));

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {

	// print a message when the server starts listening
    console.log("server starting on " + appEnv.url);
    console.log("region: " + region);
    console.log("geocode: " + geocode);
});
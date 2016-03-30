/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------


// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

var request = require('request');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

var weather_base_url = appEnv.getServiceURL("multi-region_weatherinsights");
var cloudant_creds = appEnv.getServiceCreds("multi-region_cloudant");

var Cloudant = require('cloudant');
var cloudant_client = Cloudant({account:cloudant_creds.username, password:cloudant_creds.password});
var db = cloudant_client.db.use('my_sample_db');
  
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
		        			console.log("CARDS FROM DB:");
							console.log(cards);
							resolve(cards);
					});     
			}               
		});
	});
}

function getBackgroundPath(callUrl, region) {
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
if (region === null) {
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

app.get('/', function(req, res){
	var background_prom = getBackgroundPath(callURL, region);
	var cards_prom = getCards();
	var promises = [background_prom, cards_prom];
	Promise.all(promises).then(function(results) {
						res.locals = {background: results[0], region: region};
						res.render('template', {cards: results[1]});
					});
});

app.post('/add', function(req, res) {
	var date = new Date();                                                                             
	db.insert({region: region, time: date.toUTCString()}, function(err, body) {
		if (err) {
	  		console.log("Error on add");
	  		console.log(err);
	  	}
		res.redirect('back');
	});
});

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/views/public'));

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {

	// print a message when the server starts listening
    console.log("server starting on " + appEnv.url);
    console.log("region: " + region);
    console.log("geocode: " + geocode);
    console.log("weather_base_url: " + weather_base_url);
    console.log("callURL: " + callURL);
});

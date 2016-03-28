/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------


// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

var request = require('request');

//var SunCalc = require('suncalc');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();
var weather_base_url = appEnv.getServiceURL("multi-region_weatherinsights");
var cloudant_creds = appEnv.getServiceCreds("multi-region_cloudant");

console.log(cloudant_creds);

// create a new express server
var app = express();
app.set('view engine', 'html');
app.set('layout', 'layout');
app.enable('view cache');
app.engine('html', require('hogan-express'));

var REGIONS = {
    "ibm:yp:us-south": "dallas",
    "ibm:yp:eu-gb": "london",
    "ibm:yp:au-syd": "sydney",
};

var region = REGIONS[process.env.BLUEMIX_REGION];

var GEOCODES = {
    "dallas": "32.8,-96.8",
    "london": "51.5,-0.1",
    "sydney": "-33.9,151.2"
};
var geocode = GEOCODES[region];
var callURL = weather_base_url + "api/weather/v2/observations/current" +
      "?geocode=" + geocode + "&language=en-US&units=m";

      
app.get("/background-image.jpg", function(req, res, next){
    console.log("got a request");
    request.get(callURL, function (error, response, body) {
        if(error) return next(error);
        
        body = JSON.parse(body);

        //day_ind is "D" for day, "N" for night
        if (body.observation.day_ind === "D") {
            res.sendFile(__dirname + "/views/public/images/" + region + "-day.jpg");
        } else if (body.observation.day_ind === "N") {
            res.sendFile(__dirname + "/views/public/images/" + region + "-night.jpg");
        } else res.send("Neither day nor night!?");
    });
});

/*
var background_image = '';
request.get(callURL, function (error, response, body) {
        //if(error) return next(error);
        
        body = JSON.parse(body);

        //day_ind is "D" for day, "N" for night
    	//defaults to day if not 'N'
        if (body.observation.day_ind === "N") {
            background_image = __dirname + "/views/public/images/" + region + "-night.jpg";
        } else {
        	background_image = __dirname + "/views/public/images/" + region + "-day.jpg";
   		}

});
 */

var cards = [{region: "Dallas", time:"now"}, {region: "Sydney", time:"yesterday"}, {region: "London", time:"March 21, 2016"}, {region: "Dallas", time:"now"}];

app.get('/', function(req,res){
	//res.locals = {background-image: ''}
	res.render('template', {cards: cards});                                                  
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

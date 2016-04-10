/*eslint-env node*/
var express = require('express');
var request = require('request');
var moment = require('moment');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

var weather_base_url = appEnv.getServiceURL("multiregion_weatherinsights");

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
var weather_observations_url = weather_base_url + "api/weather/v2/observations/current" +
    "?geocode=" + geocode + "&language=en-US&units=m";

var cloudant_creds = appEnv.getServiceCreds("multiregion_cloudant");

var Cloudant = require('cloudant');
var cloudant_client = Cloudant({
    account: cloudant_creds.username,
    password: cloudant_creds.password
});

var db = cloudant_client.db.use('postcards');

// create a new express server
var app = express();
app.set('view engine', 'html');
app.set('layout', 'layout');
app.enable('view cache');
app.engine('html', require('hogan-express'));

// create a new postcards database if needed
cloudant_client.db.create('postcards', function(err) {
    if (err && err.error !== 'file_exists') {
        console.error(err);
    }

    // grant universal read permissions for the database
    var permissions = {
        cloudant: {
            nobody: ["_reader"]
        }
    };

    cloudant_client.request({
        db: 'postcards',
        method: 'put',
        doc: '_security',
        body: permissions
    }, function(err) {
        if (err) {
            console.error(err);
        }

        // wait for the db, then start server on the specified port and binding host
        app.listen(appEnv.port, function() {
            console.log("server starting on " + appEnv.url + " in region " + region);
        });
    });
});

function getDoc(doc) {
    var id = doc.id;
    return new Promise(function(resolve, reject) {
        db.get(id, function(err, body) {
            resolve(body);
        });
    });
}

function getCards() {
    return new Promise(function(resolve, reject) {
        db.list(function(err, body) {
            if (!err) {
                var promises = body.rows.map(getDoc);
                Promise.all(promises).then(function(cards) {
                    cards.sort(compareCards);
                    resolve(cards);
                });
            }
        });
    });
}

function getBackgroundPath() {
    return new Promise(function(resolve, reject) {
        var requestObj = {
            uri: weather_observations_url,
            json: true
        };
        request.get(requestObj, function(err, response, body) {
            //day_ind is "D" for day, "N" for night
            //default to day if not N (or in case of error)
            if (!err && body.observation.day_ind === "N") {
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
                console.error(err);

                //we still want to try to delete other cards so we will not reject
                resolve(err);
            }
        });
    });
}

function deleteCards() {
    return new Promise(function(resolve, reject) {
        db.list(function(err, body) {
            if (err) {
                reject(err);
            } else {
                var promises = body.rows.map(deleteDoc);
                Promise.all(promises).then(function(responses) {
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
    if (a.time < b.time) {
        return -1;
    } else if (a.time > b.time) {
        return 1;
    }
    return 0;
}

function uploadDefaultStamp(body) {
    var fs = require('fs');
    var default_stamp = __dirname + '/views/public/images/' + region + '-stamp.jpg';
    var id = body.id;
    var rev = body.rev;
    return new Promise(function(resolve, reject) {
        fs.createReadStream(default_stamp).pipe(db.attachment.insert(id, 'stamp.jpeg', null, 'image/jpeg', {
            rev: rev
        }, function(err, response) {
            if (err) {
                console.error(err);
            }
            resolve(response);
        }));
    });
}

app.get('/', function(req, res) {
    var background_prom = getBackgroundPath();
    var cards_prom = getCards();
    var promises = [background_prom, cards_prom];
    Promise.all(promises).then(function(results) {
        res.locals = {
            background: results[0],
            region: region,
            account: cloudant_creds.username
        };
        res.render('template', {
            cards: results[1].map(convertToRelativeTime)
        });
    });
});

app.post('/add', function(req, res) {
    db.insert({
        region: region,
        time: moment().valueOf()
    }, function(err, body) {
        if (err) {
            console.error("Error on add");
            console.error(err);
        } else {
            // retrieve and attach a random stamp image from lorempixel.com
            var r = request('http://lorempixel.com/80/100/');
            r.on('error', function(err) {
                console.log("Error retrieving a random image from lorempixel: " + err);
                console.log("Using default image instead");
                uploadDefaultStamp(body).then(res.redirect('back'));
            });
            r.on('response', function(imageResponse) {
                if(imageResponse.statusCode === 200) {
                    r.pipe(db.attachment.insert(body.id, 'stamp.jpeg', null, 'image/jpeg', {
                        rev: body.rev
                    }, function(err) {
                        if (err) {
                            console.error(err);
                        }
                        res.redirect('back');
                    }));
                } else {
                    console.log("Error retrieving a random image from lorempixel: " + JSON.stringify(imageResponse));
                    console.log("Using default image instead");
                    uploadDefaultStamp(body).then(res.redirect('back'));
                }
            });
        }
    });
});

app.post('/delete', function(req, res) {
    deleteCards().then(function() {
        res.redirect('back');
    });
});

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/views/public'));
var express = require('express');
var router = express.Router();
var recom = require('./recommender');
var passport = require('passport');
var SpotifyStrategy = require('../node_modules/passport-spotify/lib/passport-spotify/index').Strategy;
var path = require('path');
var request = require('request');
var User = require('../public/model/user');
const fs = require('fs');
var franc = require('franc-min') //for language detection


var playlist = [];

appKey = 'a1d9f15f6ba54ef5aea0c5c4e19c0d2c',
    appSecret = 'b368bdb3003747ec861e62d3bf381ba0',

    // Passport session setup.
    //   To support persistent login sessions, Passport needs to be able to
    //   serialize users into and deserialize users out of the session. Typically,
    //   this will be as simple as storing the user ID when serializing, and finding
    //   the user by ID when deserializing. However, since this example does not
    //   have a database of user records, the complete spotify profile is serialized
    //   and deserialized.
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});


// Use the SpotifyStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and spotify
//   profile), and invoke a callback with a user object.
passport.use(new SpotifyStrategy({
        clientID: appKey,
        clientSecret: appSecret,
        callbackURL: 'http://spotifybot.us-3.evennode.com/callback'
        //callbackURL: 'http://localhost:3000/callback'
    },
    function(accessToken, refreshToken, profile, done) {
        // asynchronous verification, for effect...

        process.nextTick(function() {
            // To keep the example simple, the user's spotify profile is returned to
            // represent the logged-in user. In a typical application, you would want
            // to associate the spotify account with a user record in your database,
            // and return that user instead.
            return done(null, profile, {
                accessToken: accessToken,
                refreshToken: refreshToken
            });
        });

    }));

router.post("/addRecord", function(req, res) {
    var user = new User({
        timestamp: req.body.timestamp,
        id: req.body.id,
        setting: req.body.setting,
        duration: req.body.duration,
        rating: req.body.rating,
        likedTime: req.body.likedTime,
        lowSortingTime: req.body.lowSortingTime,
        lowRemovingTime: req.body.lowRemovingTime,
        lowRatingTimes: req.body.lowRatingTime,
        middleDraggingTime: req.body.middleDraggingTime,
        middleLoadMoreTime: req.body.middleLoadMoreTime,
        highSliderTime: req.body.highSliderTime,
        highSortingTime: req.body.highSortingTime,
        detailTime: req.body.detailTime
    });
    user.save(function(err) {
        if (err)
            res.send(err);
        res.json({
            message: "user profile is updated"
        })
    })
});

router.get("/getRecord", function(req, res) {
    User.find({}, function(err, user) {
        if (err)
            res.send(err);
        else {
            res.send(user)
        }
    })
});

router.get('/index', function(req, res) {
    res.render('index', {
        data: req.user
    })
})

router.get('/logout', function(req, res) {
    res.render('login', {
        data: null
    })
})

/*
 route for web API
 */

router.get('/searchTrack', function(req, res) {
    var result = {}
    var token = req.query.token
    recom(token).searchTrack(req.query.q).then(function(data) {
        getAudioFeatures(token, data.tracks.items).then(function(data2) {
            result.tracks = data2;
            playlist = data2
            res.json(result)
        })
    })
})

router.get('/searchArtist', function(req, res) {
    var result = {}
    var token = req.query.token
    recom(token).searchArtist(req.query.q).then(function(data) {
        recom(token).getArtistTopTracks(data.artists.items[0].id, "SE").then(function(data2) {
            getAudioFeatures(token, data2.tracks).then(function(data3) {
                result.tracks = data3;
                playlist = data3
                res.json(result)
            })
        })
    })
})

router.get('/searchPlaylist', function(req, res) {
    var result = {}
    var token = req.query.token
    recom(token).searchPlaylist(req.query.q).then(function(data) {
        var lang;
        if (req.query.q == "english songs")
            lang = "English"
        else if (req.query.q == "spainish songs")
            lang = "Spainish"
        else if (req.query.q == "japanese songs")
            lang = "Japanese"
        else if (req.query.q == "korean songs")
            lang = "Korean"
        else if (req.query.q == "chinese songs")
            lang = "Chinese"
        else if (req.query.q == "hong kong songs")
            lang = "Cantonese"
        else if (req.query.q == "german songs")
            lang = "German"
        else if (req.query.q == "french songs")
            lang = "French"
        else if (req.query.q == "russian songs")
            lang = "Russian"
        else if (req.query.q == "portuguese songs")
            lang = "Portuguese"
        else if (req.query.q == "italian songs")
            lang = "Italian"

        recom(token).getPlaylistTracks(data.playlists.items[0].id).then(function(data2) {
            var tracks = [];

            for (var index in data2.items) {
                data2.items[index].track.language = lang
                if (data2.items[index].track.id)
                    tracks.push(data2.items[index].track)
            }
            if(tracks.length>50)
                tracks = tracks.slice(0,50)
            getAudioFeatures(token, tracks).then(function(data3) {
                result.tracks = data3;
                playlist = data3
                res.json(result)
            })
        })
    })
})

router.get('/searchPlaylistByCategory', function(req, res) {
    var result = {}
    var token = req.query.token
    recom(token).getPlaylistByCategory(req.query.genre).then(function(data) {
        recom(token).getPlaylistTracks(data.playlists.items[0].id).then(function(data2) {
            var tracks = [];
            for (var index in data2.items) {
                if (data2.items[index].track.id)
                    tracks.push(data2.items[index].track)
            }
            getAudioFeatures(token, tracks).then(function(data3) {
                result.tracks = data3;
                playlist = data3
                res.json(result)
            })
        })
    })
})


router.get('/getArtist', function(req, res) {
    var result = {}
    recom(req.query.token).getTopArtists().then(function(data) {
        result.items = data;
        res.json(result)
    })
})

router.get('/getTrack', function(req, res) {
    var result = {}
    recom(req.query.token).getTopTracks().then(function(data) {
        result.items = data;
        res.json(result)
    })
})

router.get('/getGenre', function(req, res) {
    var result = {}
    recom(req.query.token).getTopGenres().then(function(data) {
        result.items = data;
        res.json(result)
    })
})


router.get('/getRecom', function(req, res) {
    var result = {}
    var token = req.query.token
    recom(token).getRecommendation(req.query.artistSeeds, req.query.trackSeeds, req.query.genreSeeds, req.query.min_valence, req.query.target_valence, req.query.max_valence, req.query.target_energy,
        req.query.target_danceability, req.query.target_liveness,
        req.query.target_speechiness, req.query.target_popularity,
        req.query.min_tempo, req.query.max_tempo).then(function(data) {
        getAudioFeatures(token, data).then(function(data2) {
            result.tracks = data2;
            playlist = data2
            res.json(result)
        })
    })
})

router.get('/getRecomByFollowSimilar', function(req, res) {
    var result = {}
    recom(req.query.token).getArtistRelatedArtists(req.query.id).then(function(data) {
        var selectedRelated = data.slice(0, 5);
        result.similar = selectedRelated
        return selectedRelated
    }).then(function(data) {
        recom(req.query.token).getRecommendationByFollowedArtist(data, 'US').then(function(data) {
            result.items = data
            res.json(result)
        })
    })
})

router.get('/getAccount', function(req, res) {
    recom(req.query.token).getRecommendationByGenre().then(function(data) {
        res.json(data)
    })
})


var getAudioFeatures = function(token, data) {
    var artistIds = [],
        trackIds = [],
        visData = [];
    for (var index in data) {
        var oneRecommendation = {};
        oneRecommendation.id = data[index].id;
        oneRecommendation.name = data[index].name;
        if (!data[index].lan){
            var lang = franc(oneRecommendation.name, {
                whitelist: ['cmn', 'eng', 'jpn', 'kor'],
                minLength: 1
            })
            if(lang == 'cmn')
                oneRecommendation.language = "Chinese"
            else if(lang == 'eng')
                oneRecommendation.language = "English"
            else if(lang == 'jpn')
                oneRecommendation.language = "Japanese"
            else if(lang == 'kor')
                oneRecommendation.language = "Korean"
        }
        else {
            oneRecommendation.language = data[index].lan;
        }
        oneRecommendation.popularity = data[index].popularity;
        oneRecommendation.artist = data[index].artists[0].name;
        oneRecommendation.link = data[index].preview_url;
        visData.push(oneRecommendation)
        artistIds.push(data[index].artists[0].id)
        trackIds.push(oneRecommendation.id)

    }

    return recom(token).getAudioFeatures(trackIds).then(function(data) {
        for (var index in data.audio_features) {
            visData[index].danceability = data.audio_features[index].danceability;
            visData[index].energy = data.audio_features[index].energy;
            visData[index].speechiness = data.audio_features[index].speechiness;
            visData[index].tempo = data.audio_features[index].tempo;
            visData[index].liveness = data.audio_features[index].liveness;
            visData[index].valence = data.audio_features[index].valence;
        }

        return recom(token).getGenresForArtists(artistIds).then(function(data2) {
            for (var index in data2.artists) {
                visData[index].genre = data2.artists[index].genres[0]
            }
        }).then(function() {
            return visData
        }, function(err) {
            return err;
        })
    })
}

router.get('/initiate', function(req, res) {
    //pass token to the webAPI used by recommender

    var reqData = {};
    reqData.artist = [], reqData.track = [], reqData.genre = []
    var oneArtistSeed, oneTrackSeed;
    var token = req.query.token;
    var userID = req.user.id;
    var account;


    var getTopArtists =
        recom(token).getTopArtists(10).then(function(data) {
            reqData.artist.push(data);
            oneArtistSeed = data[0];
        });


    var getTracks =
        recom(token).getTopTracks(10).then(function(data) {
            reqData.track.push(data);
            oneTrackSeed = data[0];
        });

    var getGenres =
        recom(token).getTopGenres().then(function(data) {
            reqData.genre.push(data);
        });

    Promise.all([getTopArtists, getTracks, getGenres]).then(function() {
        recom(token).getRecommendation(oneArtistSeed.id, oneTrackSeed.id).then(function(data) {
            getAudioFeatures(token, data).then(function(data2) {
                playlist = data2;

                User.findOne({
                    id: userID
                }, function(err, doc) {
                    if (err)
                        console.log(err)
                    if (doc) {
                        account = doc
                    } else {
                        var user = new User({
                            id: userID,
                            preferenceData: {
                                artist: oneArtistSeed.name,
                                genre: oneArtistSeed.genres[0],
                                language: "English",
                                popularity: 80,
                                danceability: 0.5,
                                energy: 0.5,
                                speechiness: 0.5,
                                liveness: 0.5,
                                valence: 0.5,
                                tempo: 100,
                                timestamp: new Date(),
                            },
                            attributeWeight: {
                                artistWeight: 0.1,
                                genreWeight: 0.1,
                                languageWeight: 0.1,
                                popularityWeight: 0.1,
                                danceabilityWeight: 0.1,
                                energyWeight: 0.1,
                                speechinessWeight: 0.1,
                                livenessWeight: 0.1,
                                valenceWeight: 0.1,
                                tempoWeight: 0.1,
                                timestamp: new Date(),
                            }
                        });

                        account = user
                        //save a new user
                        user.save(function(err) {
                            if (err)
                                console.log(err)
                            console.log("user profile is added")
                        })
                    }

                    res.json({
                        seed: reqData,
                        vis: data2,
                        user: account
                    })
                })
            })
        })
    });
})

// GET /auth/spotify
//   Use passport.authenticate() as route middleware to authenticate the
//   request. The first step in spotify authentication will involve redirecting
//   the user to spotify.com. After authorization, spotify will redirect the user
//   back to this application at /auth/spotify/callback
router.get('/',
    passport.authenticate('spotify', {
        scope: ['user-read-email', 'user-read-private', 'user-top-read'],
        showDialog: true
    }),
    function(req, res) {
        // The request will be redirected to spotify for authentication, so this
        // function will not be called.
    });

// GET /auth/spotify/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request. If authentication fails, the user will be redirected back to the
//   login page. Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/callback',
    passport.authenticate('spotify', {
        failureRedirect: '/'
    }),
    function(req, res) {

        res.cookie('spotify-token', req.authInfo.accessToken, {
            maxAge: 3600000
        });

        res.cookie('refresh-token', req.authInfo.refreshToken, {
            maxAge: 3600000
        });

        res.redirect('/index');

    });


router.get('/refresh-token', function(req, res) {

    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (new Buffer(appKey + ':' + appSecret).toString('base64'))
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            var refresh_token = body.refresh_token;
            res.json({
                'access_token': access_token,
                'refresh_token': refresh_token
            });
        }
    });
});

router.get('/logout', function(req, res) {
    req.logout();
    res.redirect("/logout")
});


//-------------------------------system critiquing--------------------------------//

// const fs = require('fs');
// const csv = require('csv-parser');
const sysCritique = require('./systemProposedCritiques.js');
const _ = require('lodash');

class UserData {
    constructor(id, preferenceData, preferenceData_variance, attributeWeight) {
        this.id = id;
        this.preferenceData = preferenceData;
        this.preferenceData_variance = preferenceData_variance;
        this.attributeWeight = attributeWeight;
    }
};

// Item attributes 
let numericalAttributes = ['popularity', 'danceability', 'energy', 'speechiness', 'tempo', 'liveness', 'valence'];
let nominalAttributes = ['artist', 'genre', 'language'];
let attributes = numericalAttributes.concat(nominalAttributes);


// User Data
// Get user id and corresponding data, including preference data and attribute weight for each attribute of item
// if user is new user, we set default preference / weight for he/her.

// let userId = '5';
// let defaultWeight = 1 / (numericalAttributes.length + nominalAttributes.length);
let default_varience = 0.01;


let preferenceData_variance = {
    'popularity': 3,
    'danceability': default_varience,
    'energy': default_varience,
    'speechiness': default_varience,
    'tempo': default_varience,
    'liveness': default_varience,
    'valence': default_varience
};

var generateCritiquing = function(user) {

    let preferenceData = {
        'artist': user.preferenceData.artist,
        'genre': user.preferenceData.genre,
        'language': user.preferenceData.language,
        'popularity': user.preferenceData.popularity,
        'danceability': user.preferenceData.danceability,
        'energy': user.preferenceData.energy,
        'speechiness': user.preferenceData.speechiness,
        'tempo': user.preferenceData.tempo,
        'liveness': user.preferenceData.liveness,
        'valence':  user.preferenceData.valence
    };

    let attributeWeight = {
        'artist': user.attributeWeight.artistWeight,
        'genre': user.attributeWeight.genreWeight,
        'language': user.attributeWeight.languageWeight,
        'popularity': user.attributeWeight.popularityWeight,
        'danceability': user.attributeWeight.danceabilityWeight,
        'energy': user.attributeWeight.energyWeight,
        'speechiness': user.attributeWeight.speechinessWeight,
        'tempo': user.attributeWeight.tempoWeight,
        'liveness': user.attributeWeight.livenessWeight,
        'valence': user.attributeWeight.valenceWeight
    };

    let userdata = new UserData(user.id, preferenceData, preferenceData_variance, attributeWeight);

    console.log(playlist[2])
    console.log("------------------------------------------------");
    console.log("Total Item Data: " + playlist.length + " records");
    console.log("Read Music Data Finished!");
    console.log("------------------------------------------------");

    // Step 1: Find a top recommended item using Spotify API
    // Suppose top recommended item 
    let topRecItem = playlist[2];

    // Step 2: Produce critiques using Apriori algorithm and select the most favorite critique with higher tradeoff utility

    start = new Date().getTime();
    // control parameter
    let numfCompoundCritiques = [2, 3];
    let supportValue = 0.2;
    let numOfUtilityCritiques = 3;
    let numOfDiversifiedCritiques = 3; // the number of items that satisfy favorite critique and that will be presented

    // user.preferenceData_variance = preferenceData_variance
    // get favor critique and diversified critique 
    let systemCritiquing = sysCritique(userdata, playlist, topRecItem, nominalAttributes, numericalAttributes, numfCompoundCritiques,
        supportValue, numOfUtilityCritiques, numOfDiversifiedCritiques);

    end = new Date().getTime();
    console.log("------------------------------------------------");
    console.log('-----Execution time: ' + (end - start) + 'ms.');
    console.log("------------------------------------------------");

    console.log("favor critique: ");
    console.log(systemCritiquing.favorCritique);
    console.log("diversify critique: ");
    console.log(systemCritiquing.diversifyCritique);

    return systemCritiquing;
}

router.post("/generateCritiquing", function(req, res) {
    var critique = generateCritiquing(req.body)
    res.json(critique)
});

module.exports = router;
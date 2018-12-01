'use strict';

const socket = io();

const outputYou = document.querySelector('.output-you');
const outputBot = document.querySelector('.output-bot');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();


const totalRecomsNum = 20;
var recom = {}, trackAttributes={};
var storage = window.localStorage;
var xhrList = [];
var isInitialized = true;
var spotifyToken = $.cookie('spotify-token')
var refreshToken = $.cookie('refresh-token')

var loggingSys = {}
loggingSys.timestamp = new Date();
loggingSys.id = '';
loggingSys.duration = new Date();
loggingSys.setting = window.location.pathname;
loggingSys.rating = {
    id:[],
    likes:[]
};
loggingSys.likedTime = 0;
loggingSys.lowSortingTime = 0;
loggingSys.lowRemovingTime = 0;
loggingSys.lowRatingTime = 0;
loggingSys.middleDraggingTime = 0;
loggingSys.middleLoadMoreTime = 0;
loggingSys.highSliderTime = 0;
loggingSys.highSortingTime = 0;
loggingSys.detailTime = 0;

$(document).ready(function () {

    //alert("Please make sure you have submitted the pre-study questionnaire!")
    //refresh the token
  setInterval(function () {
      $.ajax("/refresh-token?refresh_token="+refreshToken, function (data, err) {
          if(err)
              console.log(err)
          else{
              console.log(data)
              spotifyToken = data.access_token
              refreshToken = data.refresh_token
          }
      })
  }, 3600*1000)

  console.log(spotifyToken)

  $.ajax({
        url: "/initiate?token="+spotifyToken,
        success: function (data) {
            // loggingSys.id = data.seed.id;
            // loading the recommendations

            // if(data.seed.artist.length<3 || data.seed.track.length<3){
            //   alert("Sorry, you are not eligible for this study :( Because you have no sufficient usage data on Spotify to generate recommendations.")
            //   window.location.href = "/logout";
            // }

            var seed_artists = data.seed.artist[0][0].id;
            var seed_tracks = data.seed.track[0][0].id;

            var target_valence = 0.5;
            var target_energy = 0.5;
            var target_danceability = 0.5;
            var target_liveness = 0.5;
            var target_speechiness = 0.5;
            var target_popularity = 50;
            var target_tempo = 80; // 60 90 130 180
  
            var playlists = data.vis;
            console.log(data)

            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            var songIndex = 0;
            var timeoutResumeInfinity;

            document.querySelector('button#voice').addEventListener('click', () => {
              recognition.start();
            });

            document.querySelector('button#text').addEventListener('click', () => {
              var text = document.querySelector('input#message').value
              socket.emit('chat message', text);
              outputYou.textContent = text;

              if(text.indexOf("next")>-1){
                if(songIndex==data.vis.length-1)
                  songIndex = 0
                else
                  songIndex++;
              }
            });

            recognition.addEventListener('speechstart', () => {
              console.log('Speech has been detected.');
            });

            recognition.addEventListener('result', (e) => {
              console.log('Result has been detected.');

              let last = e.results.length - 1;
              let text = e.results[last][0].transcript;

              outputYou.textContent = text;
              console.log('Confidence: ' + e.results[0][0].confidence);

              socket.emit('chat message', text);
            });

            recognition.addEventListener('speechend', () => {
              recognition.stop();
            });

            recognition.addEventListener('error', (e) => {
              outputBot.textContent = 'Error: ' + e.error;
            });


            /*
            This fuction parses the returned data from Dialog flow
            */
            function synthVoice(text) {
              const synth = window.speechSynthesis;
              const utterance = new SpeechSynthesisUtterance();
              var player = document.querySelector("audio")

              utterance.onstart = function(event) {
                  resumeInfinity();
              };

              /*fields for returned data
              artist
              music-features
              music-languages
              music-genres
              feature-actions
              music-valence
              song
              */

              var action = text.parameters["feature-actions"][0]
              var feature = text.parameters["music-features"][0]
              var valence = text.parameters["music-valence"][0]

              var artist = text.parameters["artist"][0]
              var song = text.parameters["song"][0]
              var language = text.parameters["music-languages"][0]
              var genre = text.parameters["music-genres"][0]
              
              var response = text.fulfillment.speech;


              var requestLink;
              //search by artist
              if(artist)
                requestLink = 'https://api.spotify.com/v1/search?q='+artist+'&type=artist'
              else if(song)
                requestLink = 'https://api.spotify.com/v1/search?q='+song+'&type=track'
              else if(language)
                requestLink = 'https://api.spotify.com/v1/search?q='+language+'&type=playlist'
              else if(genre)
                requestLink = 'https://api.spotify.com/v1/search?q=genre:'+genre+'&type=artist'
              else if(valence){
                if(action=="increase" && target_valence<1)
                  target_valence+=0.1
                else if(action=="decrease" && target_valence>0.1)
                  target_valence-=0.1
                requestLink = 'https://api.spotify.com/v1/recommendations?seed_artists='+seed_artists+'&seed_tracks='+seed_tracks+'&target_valence='+target_valence;
              }

              console.log(feature, seed_artists, seed_tracks)

              if(feature){
                if(feature=="energy"){                
                  if(action=="increase" && target_energy<1)
                    target_energy+=0.1
                  else if(action=="decrease" && target_energy>0.1)
                    target_energy-=0.1
                  requestLink = 'https://api.spotify.com/v1/recommendations?seed_artists='+seed_artists+'&seed_tracks='+seed_tracks+'&target_energy='+target_energy;
                }
                else if(feature=="danceability"){
                  if(action=="increase" && target_danceability<1)
                    target_danceability+=0.1
                  else if(action=="decrease" && target_danceability>0.1)
                    target_danceability-=0.1
                  requestLink = 'https://api.spotify.com/v1/recommendations?seed_artists='+seed_artists+'&seed_tracks='+seed_tracks+'&target_danceability='+target_danceability;
                }
                else if(feature=="liveness"){
                  if(action=="increase" && target_liveness<1)
                    target_liveness+=0.1
                  else if(action=="decrease" && target_liveness>0.1)
                    target_liveness-=0.1
                  requestLink = 'https://api.spotify.com/v1/recommendations?seed_artists='+seed_artists+'&seed_tracks='+seed_tracks+'&target_liveness='+target_liveness;
                }
                else if(feature=="speech"){
                  if(action=="increase" && target_speechiness<1)
                    target_speechiness+=0.1
                  else if(action=="decrease" && target_speechiness>0.1)
                    target_speechiness-=0.1
                  requestLink = 'https://api.spotify.com/v1/recommendations?seed_artists='+seed_artists+'&seed_tracks='+seed_tracks+'&target_speechiness='+target_speechiness;
                }
                else if(feature=="popularity"){
                  if(action=="increase" && target_popularity<1)
                    target_popularity+=0.1
                  else if(action=="decrease" && target_popularity>0.1)
                    target_popularity-=0.1
                  requestLink = 'https://api.spotify.com/v1/recommendations?seed_artists='+seed_artists+'&seed_tracks='+seed_tracks+'&target_popularity='+target_popularity;
                }
                else if(feature=="tempo"){
                  if(action=="increase" && target_tempo<1)
                    target_tempo+=0.1
                  else if(action=="decrease" && target_tempo>0.1)
                    target_tempo-=0.1
                  requestLink = 'https://api.spotify.com/v1/recommendations?seed_artists='+seed_artists+'&seed_tracks='+seed_tracks+'&target_tempo='+target_tempo;
                }
              }

              console.log(requestLink)
              
              $.ajax({
                url: requestLink,
                data: {},
                beforeSend: function(request) {
                    request.setRequestHeader("Authorization", 'Bearer ' + spotifyToken);
                },
                dataType: 'JSON',
                type: 'GET',
                success: function (res) {
                  console.log(res)
                  var oldList = playlists.concat();
                  playlists = []
                  songIndex = 0
                  if(res.seeds){
                    var songs = res.tracks
                        oldList = playlists.concat();
                        playlists = []
                        songIndex = 0
                        for (var index in songs){
                          if(songs[index].preview_url){
                            var newSong = {}
                            newSong["id"] = songs[index].id
                            newSong["url"] = songs[index].preview_url
                            playlists.push(newSong)
                          }
                        }
                        if(playlists.length<1)
                          playlists = oldList
                        console.log(playlists)
                        speakandsing(response)

                  }
                  else if(res.tracks){
                    var songs = res.tracks.items
                        oldList = playlists.concat();
                        playlists = []
                        songIndex = 0
                        for (var index in songs){
                          if(songs[index].preview_url){
                            var newSong = {}
                            newSong["id"] = songs[index].id
                            newSong["url"] = songs[index].preview_url
                            playlists.push(newSong)
                          }
                        }
                        if(playlists.length<1)
                          playlists = oldList
                        console.log(playlists)
                        speakandsing(response)

                  }
                  else if(res.artists){
                    var artistID = res.artists.items[0].id;
                    $.ajax({
                      url: "https://api.spotify.com/v1/artists/"+artistID+"/top-tracks?country=SE",
                      data: {},
                      beforeSend: function(request) {
                          request.setRequestHeader("Authorization", 'Bearer ' + spotifyToken);
                      },
                      dataType: 'JSON',
                      type: 'GET',
                      success: function (res) {
                        console.log(res)
                        var songs = res.tracks
                        oldList = playlists.concat();
                        playlists = []
                        songIndex = 0
                        for (var index in songs){
                          if(songs[index].preview_url){
                            var newSong = {}
                            newSong["id"] = songs[index].id
                            newSong["url"] = songs[index].preview_url
                            playlists.push(newSong)
                          }
                        }
                        
                        if(playlists.length<1)
                          playlists = oldList
                        console.log(playlists)
                        speakandsing(response)
                      }
                    })
                  }
                  else if(res.playlists){
                    var listID = res.playlists.items[0].id;
                    $.ajax({
                      url: "https://api.spotify.com/v1/playlists/"+listID+"/tracks?limit=50",
                      data: {},
                      beforeSend: function(request) {
                          request.setRequestHeader("Authorization", 'Bearer ' + spotifyToken);
                      },
                      dataType: 'JSON',
                      type: 'GET',
                      success: function (res) {

                        console.log(res)

                        var songs = res.items
                        oldList = playlists.concat();
                        playlists = []
                        songIndex = 0
                        for (var index in songs){
                          if(songs[index].track.preview_url){
                            var newSong = {}
                            newSong["id"] = songs[index].track.id
                            newSong["url"] = songs[index].track.preview_url

                            playlists.push(newSong)
                          }
                        }

                        if(playlists.length<1)
                          playlists = oldList
                        console.log(playlists)
                        speakandsing(response)

                      }
                    })
                  }

                  // for(var index in songs.tracks.items){
                  //     if(songs.tracks.items[index].preview_url){
                  //         var oneRecommendation = {};
                  //         oneRecommendation.artist = songs.tracks.items[index].artists[0].name;
                  //         oneRecommendation.song = songs.tracks.items[index].name;
                  //         oneRecommendation.popularity =  songs.tracks.items[index].popularity;
                  //         oneRecommendation.link = songs.tracks.items[index].preview_url;
                  //         oneRecommendation.trackID = songs.tracks.items[index].id;
                  //         playlists.push(oneRecommendation)
                  //     }
                  // }

                },
                error: function (err) {
                  console.log(err)
                }
              });
              
              function speakandsing(text){
                utterance.text = text;
                synth.speak(utterance);
                // if(text == '') 
                //   text = '(No answer...)';
                outputBot.textContent = text;

                player.src=playlists[songIndex].url
                document.querySelector('iframe').src='https://open.spotify.com/embed/track/'+playlists[songIndex].id+' width='
              }

              utterance.onend = function(event) {
                clearTimeout(timeoutResumeInfinity);
                player.play();
              }

              player.onended=function(){
                if(songIndex==playlists.length-1)
                  songIndex = 0
                else
                  songIndex++;
                setTimeout(function(){
                  player.src=playlists[songIndex].url
                  document.querySelector('iframe').src='https://open.spotify.com/embed/track/'+playlists[songIndex].id+' width='

                  player.play();
                },2000)
              }

          }

            socket.on('bot reply', function(data) {
              console.log(data)
              synthVoice(data);
            });

            function resumeInfinity() {
                window.speechSynthesis.resume();
                timeoutResumeInfinity = setTimeout(resumeInfinity, 1000);
            }

          
        },
        error: function (jqXHR, err) {
            console.log(err);
            if(err === "timeout"){
                $.ajax(this)
            }
        },

        beforeSend: function () {
        },

        complete: function () {
        }

    });
})
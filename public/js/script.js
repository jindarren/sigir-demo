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
  }, 3500*1000)

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

            
            var playlists = data.vis;
            console.log(playlists)

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

            function synthVoice(text) {
              const synth = window.speechSynthesis;
              const utterance = new SpeechSynthesisUtterance();
              var player = document.querySelector("audio")

              utterance.onstart = function(event) {
                  resumeInfinity();
              };

              if(text.indexOf('artist:')>=0 || text.indexOf('genre:')>=0){
                  var keywords = text.substr(text.indexOf(":") + 1)
                  text = "Play a song of " + keywords
                  $.ajax({
                    url: 'https://api.spotify.com/v1/search?q='+keywords+'&type=track',
                    data: {},
                    beforeSend: function(request) {
                        request.setRequestHeader("Authorization", 'Bearer ' + spotifyToken);
                    },
                    dataType: 'JSON',
                    type: 'GET',
                    success: function (songs) {
                      var oldList = playlists.concat();
                      playlists = []
                      songIndex = 0

                      for(var index in songs.tracks.items){
                          if(songs.tracks.items[index].preview_url){
                              var oneRecommendation = {};
                              oneRecommendation.artist = songs.tracks.items[index].artists[0].name;
                              oneRecommendation.song = songs.tracks.items[index].name;
                              oneRecommendation.popularity =  songs.tracks.items[index].popularity;
                              oneRecommendation.link = songs.tracks.items[index].preview_url;
                              oneRecommendation.trackID = songs.tracks.items[index].id;
                              playlists.push(oneRecommendation)
                          }
                      }
                      if(playlists.length<1)
                        playlists = oldList
                      console.log(playlists)
                      speakandsing(text)
                    },
                    error: function (err) {
                      console.log(err)
                    }
                });
              }else{
                speakandsing(text)
              }

              function speakandsing(text){
                utterance.text = text;
                synth.speak(utterance);
                // if(text == '') 
                //   text = '(No answer...)';
                outputBot.textContent = text;

                console.log(playlists[songIndex].link)
                player.src=playlists[songIndex].link
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
                  player.src=playlists[songIndex].link
                  player.play();
                },2000)
              }

          }

            socket.on('bot reply', function(replyText) {
              synthVoice(replyText);
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
'use strict';

const socket = io();

const outputYou = document.querySelector('.output-you');
const outputBot = document.querySelector('.output-bot');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

var spotifyToken = $.cookie('spotify-token')
var refreshToken = $.cookie('refresh-token')

var skipTimes = 0;

$(document).ready(function() {
  //alert("Please make sure you have submitted the pre-study questionnaire!")
  //refresh the token
  setInterval(function() {
    $.ajax("/refresh-token?refresh_token=" + refreshToken, function(data, err) {
      if (err)
        console.log(err)
      else {
        console.log(data)
        spotifyToken = data.access_token
        refreshToken = data.refresh_token
      }
    })
  }, 3600 * 1000)

  console.log(spotifyToken)

  $.ajax({
    url: "/initiate?token=" + spotifyToken,
    success: function(data) {
      // loggingSys.id = data.seed.id;
      // loading the recommendations

      // if(data.seed.artist.length<3 || data.seed.track.length<3){
      //   alert("Sorry, you are not eligible for this study :( Because you have no sufficient usage data on Spotify to generate recommendations.")
      //   window.location.href = "/logout";
      // }

      console.log(data)
      var seed_artists = data.seed.artist[0][0].id;
      var seed_tracks = data.seed.track[0][0].id;

      var target_energy = 0.5;
      var target_danceability = 0.5;
      var target_liveness = 0.5;
      var target_speechiness = 0.5;
      var target_popularity = 50;
      var target_tempo = 80; // 60 90 130 180

      var playlists = data.vis,
        oldList = [];

      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      var songIndex = 0;
      var timeoutResumeInfinity;
      var critiques = [],
        critiquesIndex = 0;
      var needReply = false;

      document.querySelector('button#voice').addEventListener('click', () => {
        recognition.start();
      });

      document.querySelector('button#text').addEventListener('click', () => {
        var text = document.querySelector('input#message').value
        socket.emit('chat message', text);
        outputYou.textContent = text;

        if (text.indexOf("next") > -1) {
          if (songIndex == data.vis.length - 1)
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
        var intent = text.action;
        var response = text.fulfillment.speech;

        var requestLink;
        //search by artist
        if (intent == "music_player_control.skip_forward") {
          if (skipTimes == 2) {
            //if skip more than 2 times, then critique


            //-------------------Start critiquing-------------------//
            needReply = true;

            $.ajax({
              url: "/generateCritiquing",
              type: "POST",
              contentType: "application/json;charset=utf-8",
              data: JSON.stringify(data.user),
              dataType: "json",
              success: function(result) {

                for (var crt in result.favorCritique) {

                  var wording = "Do you want try ";
                  var songType = "",
                    features = "";
                  var actionSet = {},
                    action = [];

                  for (var index in result.favorCritique[crt]) {

                    if (result.favorCritique[crt][index].split("-")[0] == "language") {
                      var actionItem = {}
                      actionItem.prop = "language"
                      actionItem.val = result.favorCritique[crt][index].split("-")[1]
                      actionItem.type = "equal"
                      action.push(actionItem)
                      songType += actionItem.val + " "
                    } else if (result.favorCritique[crt][index].split("-")[0] == "genre") {
                      var actionItem = {}
                      actionItem.prop = "genre"
                      actionItem.val = result.favorCritique[crt][index].split("-")[1]
                      actionItem.type = "equal"
                      action.push(actionItem)
                      songType += actionItem.val + " "
                    } else if (result.favorCritique[crt][index].split("-")[0] == "artist") {
                      var actionItem = {}
                      actionItem.prop = "artist"
                      actionItem.val = result.favorCritique[crt][index].split("-")[1]
                      actionItem.type = "equal"
                      action.push(actionItem)
                      songType += action.artist + " "
                    } else if (result.favorCritique[crt][index].split("-")[1] == "lower") {
                      var actionItem = {}
                      actionItem.prop = result.favorCritique[crt][index].split("-")[0]
                      actionItem.val = -0.01
                      actionItem.type = "less"
                      action.push(actionItem)
                      features += "lower " + result.favorCritique[crt][index].split("-")[0] + " "
                    } else if (result.favorCritique[crt][index].split("-")[1] == "higher") {
                      var actionItem = {}
                      actionItem.prop = result.favorCritique[crt][index].split("-")[0]
                      actionItem.val = 0.01
                      actionItem.type = "more"
                      action.push(actionItem)
                      features += "higher " + result.favorCritique[crt][index].split("-")[0] + " "
                    }
                  }

                  if (songType && !features)
                    wording += songType + "music "
                  else if (!songType && features)
                    wording += "songs with " + features
                  else if (songType && features) {
                    wording += songType + "songs with " + features
                  }
                  actionSet.speech = wording
                  actionSet.action = action

                  critiques.push(actionSet)
                }

                console.log(critiques)
                player.pause()

                utterance.text = critiques[critiquesIndex].speech;
                synth.speak(utterance);
                outputBot.textContent = critiques[critiquesIndex].speech;
              },
              error: function(msg) {
                console.log(msg)
              }

              //-------------------end critiquing-------------------//
            })

            skipTimes = 0
          } else {
            skipTimes++;
            if (songIndex == playlists.length - 1)
              songIndex = 0
            else
              songIndex++;
          }
        } else if (intent == "music.play") {
          var artist = text.parameters["artist"]
          var song = text.parameters["song"]
          var language = text.parameters["music-languages"]
          var genre = text.parameters["music-genres"]
          if (artist.length > 0)
            requestLink = '/searchArtist?q=' + artist[0] + '&token=' + spotifyToken;
          else if (song)
            requestLink = '/searchTrack?q=' + song + '&token=' + spotifyToken;
          else if (language)
            requestLink = '/searchPlaylist?q=' + language + '&token=' + spotifyToken;
          else if (genre)
            requestLink = '/searchPlaylistByCategory?genre=' + genre + "&token=" + spotifyToken;
          else
            requestLink = ''
        } else if (intent == "critique.response") {
          needReply = false;
          var response = text.parameters["RESPONSE"]
          if (response == "yes") {
            oldList = playlists.concat()
            //perform critiquing on existing set
            for (var index in critiques) {
              for (var index2 in critiques[index].action) {
                var newlist = []
                playlists.map(function(track) {
                  if (critiques[index].action[index2].type == "equal") {
                    if (track[critiques[index].action[index2].prop] == critiques[index].action[index2].val) {
                      newlist.push(track)
                      playlists = newlist.concat()
                    }
                  } else if (critiques[index].action[index2].type == "less") {
                    if (track[critiques[index].action[index2].prop] < 0.5 + critiques[index].action[index2].val) {
                      newlist.push(track)
                      playlists = newlist.concat()
                    }
                  } else if (critiques[index].action[index2].type == "more") {
                    if (track[critiques[index].action[index2].prop] > 0.5 + critiques[index].action[index2].val) {
                      newlist.push(track)
                      playlists = newlist.concat()
                    }
                  }
                })
              }
            }
            console.log(playlists)
            songIndex = 0
          } else if (response == "no") {
            if (critiquesIndex < 2) {
              needReply = true;
              critiquesIndex++;
              player.pause()
              utterance.text = critiques[critiquesIndex].speech;
              synth.speak(utterance);
              outputBot.textContent = critiques[critiquesIndex].speech;
            } else if (critiquesIndex == 2) {
              critiquesIndex = 0
              speakandsing("OK")
            }
          }
        } else if (intent == "music.search") {
          var valence = text.parameters["music-valence"]
          var action = text.parameters["feature-actions"]
          var feature = text.parameters["music-features"]

          if (valence) {
            if (valence == "happy")
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&seed_tracks=' + seed_tracks + '&min_valence=0.7&token=' + spotifyToken;
            else if (valence == "neutral")
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&seed_tracks=' + seed_tracks + '&target_valence=0.5&token=' + spotifyToken;
            else if (valence == "sad")
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&seed_tracks=' + seed_tracks + '&max_valence=0.3&token=' + spotifyToken;
          } else if (feature) {
            console.log(feature)
            if (feature == "energy") {
              if (action == "increase" && target_energy < 1)
                target_energy += 0.1
              else if (action == "decrease" && target_energy > 0.1)
                target_energy -= 0.1
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&target_energy=' + target_energy + "&token=" + spotifyToken;
            } else if (feature == "danceability") {
              if (action == "increase" && target_danceability < 1)
                target_danceability += 0.1
              else if (action == "decrease" && target_danceability > 0.1)
                target_danceability -= 0.1
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&target_danceability=' + target_danceability + "&token=" + spotifyToken;
            } else if (feature == "liveness") {
              if (action == "increase" && target_liveness < 1)
                target_liveness += 0.1
              else if (action == "decrease" && target_liveness > 0.1)
                target_liveness -= 0.1
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&target_liveness=' + target_liveness + "&token=" + spotifyToken;
            } else if (feature == "speech") {
              if (action == "increase" && target_speechiness < 1)
                target_speechiness += 0.1
              else if (action == "decrease" && target_speechiness > 0.1)
                target_speechiness -= 0.1
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&target_speechiness=' + target_speechiness + "&token=" + spotifyToken;
            } else if (feature == "popularity") {
              if (action == "increase" && target_popularity < 1)
                target_popularity += 0.1
              else if (action == "decrease" && target_popularity > 0.1)
                target_popularity -= 0.1
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&target_popularity=' + target_popularity + "&token=" + spotifyToken;
            } else if (feature == "tempo") {
              if (action == "increase")
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&min_tempo=120&token="+spotifyToken;'
              else if (action == "decrease")
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&max_tempo=60&token="+spotifyToken;'
            }
          }
        }

        console.log(requestLink)

        if (requestLink) {
          $.get(requestLink, function(res) {
            console.log(res)
            oldList = playlists.concat()
            playlists = res.tracks
            songIndex = 0
            speakandsing(response)
          })
        } else {
          if (!needReply)
            speakandsing("Ok")
        }

        function speakandsing(text) {

          utterance.text = text;
          synth.speak(utterance);

          // if(text == '') 
          //   text = '(No answer...)';
          outputBot.textContent = text;

          if (playlists[songIndex].link)
            player.src = playlists[songIndex].link
          else
            player.src = "/res/preview.mp3"
          document.querySelector('iframe').src = 'https://open.spotify.com/embed/track/' + playlists[songIndex].id + ' width='

        }

        utterance.onend = function(event) {
          if (!needReply) {
            clearTimeout(timeoutResumeInfinity);
            player.play();
          }
        }

        player.onended = function() {
          if (songIndex == playlists.length - 1)
            songIndex = 0
          else
            songIndex++;
          setTimeout(function() {
            if (playlists[songIndex].link)
              player.src = playlists[songIndex].link
            else
              player.src = "/res/preview.mp3"
            document.querySelector('iframe').src = 'https://open.spotify.com/embed/track/' + playlists[songIndex].id + ' width='

            player.play();
          }, 2000)
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
    error: function(jqXHR, err) {
      console.log(err);
      if (err === "timeout") {
        $.ajax(this)
      }
    },

    beforeSend: function() {},

    complete: function() {}

  });
})
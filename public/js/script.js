const socket = io();

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

var spotifyToken = $.cookie('spotify-token')
var refreshToken = $.cookie('refresh-token')

var storage = window.localStorage;

var skipTimes = 0;

var playlist=[];
var numberOfLikedSongs = 0;
var isPreStudy = true
var isFirstScenario = false;
var isSecondScenario = false;
var isSystemCrit=1;
var listenedSongs = []
var isFinished = false
var topRecommendedSong;
var critiqueList = [];
var nextTimes = 0;
var showNextSong, showCurrentSong, showNextSong2, showNextSong3, showCurrentSong2, showFeedback, showTry;
const synth = window.speechSynthesis;

var loggers = [], logger = {};
logger.dialog = []
logger.exp_energy = []
logger.exp_danceability = []
logger.exp_speechiness = []
logger.exp_tempo = []
logger.exp_valence = []
logger.exp_artist = []
logger.exp_lang = []
logger.exp_category = []
logger.exp_feature = []

var nextSongUtters = ["Great, here is another song.", "OK, maybe you also like this song.", "Good, please try the next song."],
    rateUtters = ["Please rate your liked song.", "Don't forget to rate the song.","You also need to rate the song."]


var systemLang = storage.language

if(systemLang=="zh")
 $("#user-id").show()

$(window).off('beforeunload');

$(document).ready(function() {
  setInterval(function() {
    $.ajax("/refresh-token?refresh_token=" + refreshToken, function(data, err) {
      if (err)
        console.log(err)
      else {
        spotifyToken = data.access_token
      }
    })
  }, 3600 * 1000)
  
  var userID = JSON.parse(storage.profile).id

  if(isPreStudy){
    $("#popup").show()
    $("#user-id span").text(userID)
    if(systemLang == "en")
      $("#popup iframe").attr("src",'https://docs.google.com/forms/d/e/1FAIpQLSfZuPzYDYLSkyE5ktc5cy3daXWMU_WQKvyc2rF4Pg1d8DGprA/viewform?embedded=true&usp=pp_url&entry.1954960706='+userID)
    else if(systemLang == "zh")
      $("#popup iframe").attr("src","https://www.wjx.cn/jq/37653170.aspx")
  }

  $(".exp").on("mouseenter", function(){
    var feature = $(this).text()
    if(feature == "Energy:")
      logger.exp_energy.push(new Date().getTime())
    else if(feature == "Danceability:")
      logger.exp_danceability.push(new Date().getTime())
    else if(feature == "Speechiness:")
      logger.exp_speechiness.push(new Date().getTime())
    else if(feature == "Tempo:")
      logger.exp_tempo.push(new Date().getTime())
    else if(feature == "Valence:")
      logger.exp_valence.push(new Date().getTime())
  })


  $("h3").on("click", function(){
    var title = $(this).text()
    if(title == "Explanation of features")
      logger.exp_feature.push(new Date().getTime())
    else if(title == "Explanation of music categories")
      logger.exp_category.push(new Date().getTime())
    else if(title == "Explanation of music language")
      logger.exp_lang.push(new Date().getTime())
    else if(title == "Explanation of artists")
      logger.exp_artist.push(new Date().getTime())
  })

  var windowHeight = $("#container").height() * 0.90;
  // $(".iphone-x").height(windowHeight)
  // $(".iphone-x").width(windowHeight * 36 / 78)


  $("#accordion").accordion({
      heightStyle: "fill"
    });
  $('[data-toggle="popover"]').popover({trigger:"hover"})



  //alert("Please make sure you have submitted the pre-study questionnaire!")
  //refresh the token
var allGenres=[], distinctGenres=[], genreTimes=[], listenedGenres=[];

  $.ajax({
    url: "/initiate?token="+spotifyToken+"&scenario=summer",
    type: "POST",
    contentType: "application/json;charset=utf-8",
    data: storage.profile,
    dataType: "json",
    success: function(data) {
      topRecommendedSong = data.vis[0];
      data.topRecommendedSong = topRecommendedSong


      for(var index=0; index<50; index++){
        if(data.vis[index].link)
          playlist.push(data.vis[index])
        if(data.vis[50+index].link)
          playlist.push(data.vis[50+index])
        if(data.vis[100+index].link)
          playlist.push(data.vis[100+index])
      }

      data.vis = playlist.concat()

      console.log(data)

      var songIndex = 0;

      /******************** music visualization ***********************/

      for(var index in playlist){
        allGenres.push(playlist[index].genre)
      }

      var mapGenres = allGenres.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())
      // 所有次数
      genreTimes = Array.from(mapGenres.values())
      //去重后的值
      distinctGenres = Array.from(mapGenres.keys())

      //小众的genres的数量，已经小众的genres列表
      var fewGenres=[]
      for(var index in genreTimes){
        if(genreTimes[index]<3){
          fewGenres.push(distinctGenres[index])
        }
      }

      allGenres = []
      for(var index in playlist){
        for(var index2 in fewGenres){
          if(playlist[index].genre==fewGenres[index2])
            playlist[index].genre = "other"
        }
        allGenres.push(playlist[index].genre)
      }

      //过滤完other重新统计
      mapGenres = allGenres.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())

      // 所有次数
      genreTimes = Array.from(mapGenres.values())
      //去重后的值
      distinctGenres = Array.from(mapGenres.keys())

      console.log(playlist)

      //计算这个为了统计每一类音乐里面不同属性的分布
      var genreCategoryForMSFeatures = []

      bubbleData = {
        "children": []
      };

      for (var index in distinctGenres) {
        //至少有3首歌   
        var item = {}
        item.genre = distinctGenres[index]
        item.num = genreTimes[index]
        item.played = 0
        bubbleData.children.push(item)
        //针对每一个genre创建一个新的对象集合
        var newItem = {}
        newItem.items = playlist.filter(function (obj) {
            return obj.genre == distinctGenres[index]
        });

        newItem.genre = distinctGenres[index]
        genreCategoryForMSFeatures.push(newItem)
      }

      console.log(bubbleData)

      console.log(genreCategoryForMSFeatures)

      function getPlayedGenre(item){
        return genreCategoryForMSFeatures.filter(function(obj){
          return obj.genre == item.genre
        })
      }
  
      function musicalFeaturesStat(items){
        var stats = [], danceabilityList =[0,0,0,0,0], tempoList = [0,0,0,0,0], valenceList = [0,0,0,0,0], energyList = [0,0,0,0,0], popularityList=[0,0,0,0,0]
        for(var index in items){
          var danceability = items[index].danceability
          var energy = items[index].energy
          var valence = items[index].valence
          var tempo = items[index].tempo
          var popularity = items[index].popularity

          if(danceability>0 && danceability<=0.2){
            danceabilityList[0]++;
          }else if(danceability>0.2 && danceability<=0.4){
            danceabilityList[1]++;
          }else if(danceability>0.4 && danceability<=0.6){
            danceabilityList[2]++;
          }else if(danceability>0.6 && danceability<=0.8){
            danceabilityList[3]++;
          }else if(danceability>0.8 && danceability<=1){
            danceabilityList[4]++;
          }

          if(energy>0 && energy<=0.2){
            energyList[0]++;
          }else if(energy>0.2 && energy<=0.4){
            energyList[1]++;
          }else if(energy>0.4 && energy<=0.6){
            energyList[2]++;
          }else if(energy>0.6 && energy<=0.8){
            energyList[3]++;
          }else if(energy>0.8 && energy<=1){
            energyList[4]++;
          }

          if(valence>0 && valence<=0.2){
            valenceList[0]++;
          }else if(valence>0.2 && valence<=0.4){
            valenceList[1]++;
          }else if(valence>0.4 && valence<=0.6){
            valenceList[2]++;
          }else if(valence>0.6 && valence<=0.8){
            valenceList[3]++;
          }else if(valence>0.8 && valence<=1){
            valenceList[4]++;
          }

          if(popularity>0 && popularity<=20){
            popularityList[0]++;
          }else if(popularity>20 && popularity<=40){
            popularityList[1]++;
          }else if(popularity>40 && popularity<=60){
            popularityList[2]++;
          }else if(popularity>60 && popularity<=80){
            popularityList[3]++;
          }else if(popularity>80 && popularity<=100){
            popularityList[4]++;
          }

          if(tempo>0 && tempo<=40){
            tempoList[0]++;
          }else if(tempo>40 && tempo<=80){
            tempoList[1]++;
          }else if(tempo>80 && tempo<=120){
            tempoList[2]++;
          }else if(tempo>120 && tempo<=160){
            tempoList[3]++;
          }else if(tempo>160 && tempo<=200){
            tempoList[4]++;
          } 
        }
        stats.push([{name:"danceability",range:"very low",num:danceabilityList[0],played:0},{range:"low",num:danceabilityList[1],played:0},{range:"medium",num:danceabilityList[2],played:0},{range:"high",num:danceabilityList[3],played:0},{range:"very high",num:danceabilityList[4],played:0}])
        stats.push([{name:"energy",range:"very low",num:energyList[0],played:0},{range:"low",num:energyList[1],played:0},{range:"medium",num:energyList[2],played:0},{range:"high",num:energyList[3],played:0},{range:"very high",num:energyList[4],played:0}])
        stats.push([{name:"valence",range:"very low",num:valenceList[0],played:0},{range:"low",num:valenceList[1],played:0},{range:"medium",num:valenceList[2],played:0},{range:"high",num:valenceList[3],played:0},{range:"very high",num:valenceList[4],played:0}])
        stats.push([{name:"popularity",range:"very low",num:popularityList[0],played:0},{range:"low",num:popularityList[1],played:0},{range:"medium",num:popularityList[2],played:0},{range:"high",num:popularityList[3],played:0},{range:"very high",num:popularityList[4],played:0}])
        stats.push([{name:"tempo",range:"very low",num:tempoList[0],played:0},{range:"low",num:tempoList[1],played:0},{range:"medium",num:tempoList[2],played:0},{range:"high",num:tempoList[3],played:0},{range:"very high",num:tempoList[4],played:0}])

        return stats
      }

      var chartWidth = $("#bubble").width();
      var chartHeight = $("#bubble").height();

      var bubble = d3.pack(bubbleData)
          .size([chartWidth, chartHeight])
          .padding(4);

      var svg = d3.select("#bubble")
          .append("svg")
          .attr("width", chartWidth)
          .attr("height", chartHeight)
          .attr("class", "bubble");

      var nodes = d3.hierarchy(bubbleData)
          .sum(function(d) { return d.num; });

      var node = svg.selectAll(".node")
          .data(bubble(nodes).descendants())
          .enter()
          .filter(function(d){
              return  !d.children
          })
          .append("g")
          .attr("class", "node")
          .attr("transform", function(d) {
              return "translate(" + d.x + "," + d.y + ")";
          });

      node.append("title")
          .text(function(d) {
              return d.data.genre + "(Total: "+d.data.num+" Listened: "+d.data.played+")";
          });

      node.append("circle")
          .attr("id",function(d) {
              return d.data.genre.replace(" ","")
          })
          .attr("r", function(d) {
              return d.r;
          })
          .attr("fill",function(d){
            return "rgba(0,0,255,"+(d.data.played/d.data.num)+0.01+")"
          })
          .attr("stroke","#B3B3B3")
          .attr("stroke-width", 1);


      node.append("text")
          .attr("dy", ".2em")
          .style("text-anchor", "middle")
          .text(function(d) {
              return d.data.genre.substring(0, d.r / 3);
          })
          .attr("font-family", "sans-serif")
          .attr("font-size", function(d){
              return d.r/2;
          })
          .attr("fill", "#041528");

      node.append("text")
          .attr("dy", "1.3em")
          .style("text-anchor", "middle")
          .text(function(d) {
              return d.data.num;
          })
          .attr("font-family",  "Gill Sans", "Gill Sans MT")
          .attr("font-size", function(d){
              return d.r/2;
          })
          .attr("fill", "#041528");

      d3.select(self.frameElement)
          .style("height", chartHeight + "px");


    /***************barChart*****************/

      var toListenGenre = getPlayedGenre(playlist[songIndex])
      
      var datas = musicalFeaturesStat(toListenGenre[0]["items"])

      console.log(datas)
      var barData = datas[0]
      var selectedAttr = 0

      $('#barchart-control').change(function(){
          selected_value = $("input[name='mode']:checked").val();
          console.log(selected_value)
          if(selected_value==="danceability"){
              barData = datas[0]
              selectedAttr = 0
          }else if(selected_value==="energy"){
              barData = datas[1]
              selectedAttr = 1
          }else if(selected_value==="valence"){
              barData = datas[2]
              selectedAttr = 2
          }else if(selected_value==="popularity"){
              barData = datas[3]
              selectedAttr = 3
          }else if(selected_value==="tempo"){
              barData = datas[4]
              selectedAttr = 4
          }
          redrawBar(barData)
      });
                
      redrawBar(barData)

      function redrawBar(barData){
        $("#barchart-svg").empty()

        // set the dimensions and margins of the graph
        chartWidth = $("#barchart-svg").width();
        chartHeight = $("#barchart-svg").height();
        var margin = {top: 20, right: 20, bottom: 30, left: 40},
            chartWidth = chartWidth - margin.left - margin.right,
            chartHeight = chartHeight - margin.top - margin.bottom;

        // set the ranges
        var x = d3.scaleBand()
                  .range([0, chartWidth])
                  .padding(0.1);
        var y = d3.scaleLinear()
                  .range([chartHeight, 0]);

        var svg = d3.select("#barchart-svg").append("svg")
          .attr("width", chartWidth + margin.left + margin.right)
          .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
          .attr("transform", 
                "translate(" + margin.left + "," + margin.top + ")");

        // format the data
        barData.forEach(function(d) {
          d.percent = +d.percent;
        });

        // Scale the range of the data in the domains
        x.domain(barData.map(function(d) { return d.range; }));
        y.domain([0, d3.max(barData, function(d) { return d.num; })]);

        // append the rectangles for the bar chart
        svg.selectAll(".bar")
            .data(barData)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", function(d) { return x(d.range); })
            .attr("width", x.bandwidth())
            .attr("y", function(d) { return y(d.num); })
            .attr("height", function(d) { return chartHeight - y(d.num); })
            .style("fill",function(d){
              return "rgba(0,0,255,"+(d.played/d.num)+0.01+")"
            })
            .attr("stroke","#B3B3B3")
            .attr("stroke-width", 1);

        // add the x Axis
        svg.append("g")
            .attr("transform", "translate(0," + chartHeight + ")")
            .call(d3.axisBottom(x));

        // add the y Axis
        svg.append("g")
            .call(d3.axisLeft(y));

      }
      

      /******************** music visualization ***********************/


      /******************** music player ***********************/
      var aud = document.getElementById("myAudio");
      function loadSong(songIndex){
        //更新歌曲播放
        aud.src = playlist[songIndex].link
        $("#title").text(playlist[songIndex].name)
        $("#artist").text(playlist[songIndex].artist)

        var playedGenre = playlist[songIndex]["genre"]

        //高亮genre
        $("circle#"+playedGenre.replace(" ","")).attr("stroke","red")

        //更新bar chart
        toListenGenre = getPlayedGenre(playlist[songIndex])      
        datas = musicalFeaturesStat(toListenGenre[0]["items"])
        console.log(datas)
        barData = datas[selectedAttr]              
        redrawBar(barData)

        //更新透明度

        for (var index in bubbleData.children) {
          if (bubbleData.children[index].genre == playedGenre){
            bubbleData.children[index].played += 1
            console.log((bubbleData.children[index].played/bubbleData.children[index].num))
            $("circle#"+playedGenre.replace(" ","")).attr("style","fill:rgba(0,0,255,"+(bubbleData.children[index].played/bubbleData.children[index].num)+")")
          }
        }
        


        console.log("start: ",playlist[songIndex]["genre"])

        aud.play()
      }

      setTimeout(function() {
        loadSong(songIndex)
      }, 2000);

      aud.onended = function() {
        console.log("end: ",playlist[songIndex]["genre"])

        $("circle#"+playlist[songIndex]["genre"].replace(" ","")).attr("stroke","#B3B3B3")

        songIndex++
        loadSong(songIndex)
        
      };

      /******************** music player ***********************/


      var copyPlaylist = data.vis.concat()

      var danceabilityList = [],
          energyList = [],
          popularityList = [],
          speechinessList = [],
          tempoList = [],
          valenceList = [];

      for(var index=0; index<copyPlaylist.length-1; index++){
        danceabilityList.push(copyPlaylist[index].danceability)
        energyList.push(copyPlaylist[index].energy)
        popularityList.push(copyPlaylist[index].popularity)
        speechinessList.push(copyPlaylist[index].speechiness)
        tempoList.push(copyPlaylist[index].tempo)
        valenceList.push(copyPlaylist[index].valence)
      }

      var featureList = [
      {
        name:"danceability",
        value:danceabilityList
      },
      {
        name:"energy",
        value:energyList
      },
      {
        name:"popularity",
        value:popularityList
      },
      {
        name:"speechiness",
        value:speechinessList
      },
      {
        name:"tempo",
        value:tempoList
      },
      {
        name:"valence",
        value:valenceList
      }]

      data.user.preferenceData_variance = {};

      var sum = function(x,y){ return x+y;};
      var square = function(x){ return x*x;};

      for(var index in featureList){
        var featureData = featureList[index].value
        var mean = featureData.reduce(sum)/featureData.length;
        var deviations = featureData.map(function(x){return x-mean;});
        data.user.preferenceData_variance[featureList[index].name] = Math.sqrt(deviations.map(square).reduce(sum)/(featureData.length-1));
      }

      // function compare(property){
      //   return function(a,b){
      //       var value1 = a[property];
      //       var value2 = b[property];
      //       return value2-value1;
      //   }
      // }

      // copyPlaylist.sort(compare('danceability'))
      // data.user.preferenceData.danceability = copyPlaylist[copyPlaylist.length/2-1].danceability
      // data.user.preferenceData.danceability_low = copyPlaylist[2*copyPlaylist.length/3-1].danceability
      // data.user.preferenceData.danceability_high = copyPlaylist[copyPlaylist.length/3-1].danceability

      // copyPlaylist = data.vis.concat()
      // copyPlaylist.sort(compare('energy'))
      // data.user.preferenceData.energy = copyPlaylist[copyPlaylist.length/2-1].energy
      // data.user.preferenceData.energy_low = copyPlaylist[2*copyPlaylist.length/3-1].energy
      // data.user.preferenceData.energy_high = copyPlaylist[copyPlaylist.length/3-1].energy

      // copyPlaylist = data.vis.concat()
      // copyPlaylist.sort(compare('popularity'))
      // data.user.preferenceData.popularity = copyPlaylist[copyPlaylist.length/2-1].popularity
      // data.user.preferenceData.popularity_low = copyPlaylist[2*copyPlaylist.length/3-1].popularity
      // data.user.preferenceData.popularity_high = copyPlaylist[copyPlaylist.length/3-1].popularity

      // copyPlaylist = data.vis.concat()
      // copyPlaylist.sort(compare('speechiness'))
      // data.user.preferenceData.speechiness = copyPlaylist[copyPlaylist.length/2-1].speechiness
      // data.user.preferenceData.speechiness_low = copyPlaylist[2*copyPlaylist.length/3-1].speechiness
      // data.user.preferenceData.speechiness_high = copyPlaylist[copyPlaylist.length/3-1].speechiness

      // copyPlaylist = data.vis.concat()
      // copyPlaylist.sort(compare('tempo'))
      // data.user.preferenceData.tempo = copyPlaylist[copyPlaylist.length/2-1].tempo
      // data.user.preferenceData.tempo_low = copyPlaylist[2*copyPlaylist.length/3-1].tempo
      // data.user.preferenceData.tempo_high = copyPlaylist[copyPlaylist.length/3-1].tempo

      // copyPlaylist = data.vis.concat()
      // copyPlaylist.sort(compare('valence'))
      // data.user.preferenceData.valence = copyPlaylist[copyPlaylist.length/2-1].valence
      // data.user.preferenceData.valence_low = copyPlaylist[2*copyPlaylist.length/3-1].valence
      // data.user.preferenceData.valence_high = copyPlaylist[copyPlaylist.length/3-1].valence

      $(".loading").hide()
      $(".window, #message, .voice").show()

      $("#popup i").on("click",function () {
        if(isPreStudy){
            // var r0=confirm("Make sure you have submitted the questionnaire");
            // if (r0==true)
            // {
                $("#popup").hide()
                //Initializae
                updateChat(robot, 'Hello. Welcome to play music bot! To warm up for study, you can read some tips on right side and try to talk with bot for good music. For example, type "Play a song"');

                showTry = setTimeout(function(){
                  updateChat(robot, "Once you are ready for the study, you can click the 'Start study' button on the left side. You can rate a recommended song after listening to it for a while.")
                },12000)
            // }
        }else if(isFirstScenario){
            //$("#next-task").show()
            // var r1=confirm("Make sure you have submitted the questionnaire");
            // if (r1==true)
            // {
                $("#popup").hide()
                $("#questionnaire-1").hide()
                clearTimeout(showFeedback)
                clearTimeout(showNextSong)
                clearTimeout(showCurrentSong)
                clearTimeout(showCurrentSong2)
                clearTimeout(showNextSong2)
                clearTimeout(showNextSong3)

                // $("#next-task").show()

                logger = {}
                logger.dialog = []
                logger.exp_energy = []
                logger.exp_danceability = []
                logger.exp_speechiness = []
                logger.exp_tempo = []
                logger.exp_valence = []
                logger.exp_artist = []
                logger.exp_lang = []
                logger.exp_category = []
                logger.exp_feature = []
                logger.rating = []

                playlist = data.vis
                songIndex = 0
                logger.task2 = new Date().getTime()
                isFinished = false

                //clear the chat content for new scenario
                $(".chat").empty()

                updateChat(robot, 'Hi there. Just imagine you are celebrating your birthday with your friends.');
                setTimeout(function(){
                  updateChat(robot, "Now you need to find 5 good songs to warm up the party.")
                },5000)


                //
                  $.ajax({
                    url: "/initiate?token="+spotifyToken+"&scenario=party",
                    type: "POST",
                    contentType: "application/json;charset=utf-8",
                    data: storage.profile,
                    dataType: "json",
                    success: function(data2) {
                      topRecommendedSong = data2.vis[0];
                      data.topRecommendedSong = topRecommendedSong

                      playlist = []
                      for(var index=0; index<50; index++){
                        playlist.push(data2.vis[index])
                        playlist.push(data2.vis[50+index])
                        playlist.push(data2.vis[100+index])
                      }

                      data.vis = playlist.concat()
                      copyPlaylist = data.vis.concat()


                      listenedSongs = []
                      numberOfLikedSongs = 0
                      isFirstScenario = false;
                      isSecondScenario = true;
                      isSystemCrit = 1-isSystemCrit
                      $("#next-task, #task1").hide()
                      //$('body').css("background-image", 'url("../img/party.png")')
                      $(".list-group").empty()

                      setTimeout(function(){
                        if(listenedSongs.indexOf(playlist[songIndex].id)<0){
                          listenedSongs.push(playlist[songIndex].id)
                          setTimeout(function(){
                            var explaination = ""
                            if(playlist[songIndex].danceability>=data.user.preferenceData.danceabilityRange[0]&&playlist[songIndex].danceability<=data.user.preferenceData.danceabilityRange[1])
                              explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.danceabilityRange[2]+" danceability"
                            else if(playlist[songIndex].energy>=data.user.preferenceData.energyRange[0]&&playlist[songIndex].energy<=data.user.preferenceData.energyRange[1])
                              explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.energyRange[2]+" energy"
                            else if(playlist[songIndex].speechiness>=data.user.preferenceData.speechinessRange[0]&&playlist[songIndex].speechiness<=data.user.preferenceData.speechinessRange[1])
                              explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.speechinessRange[2]+" speechiness"
                            else if(playlist[songIndex].tempo>=data.user.preferenceData.tempoRange[0]&&playlist[songIndex].tempo<=data.user.preferenceData.tempoRange[1])
                              explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.tempoRange[2]+" tempo"
                            else if(playlist[songIndex].valence>=data.user.preferenceData.valenceRange[0]&&playlist[songIndex].valence<=data.user.preferenceData.valenceRange[1])
                              explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.valenceRange[2]+" valence"
                            else
                              explaination = "We recommend this song because you like music"

                            if(playlist[songIndex].seedType == "artist")
                              explaination += ", and "+ playlist[songIndex].seed+"'s songs."
                            else if(playlist[songIndex].seedType == "track")
                              explaination += ", and the songs "+ playlist[songIndex].seed+"."
                            else if(playlist[songIndex].seedType == "genre")
                              explaination += ", and the songs of "+ playlist[songIndex].seed+"."
                            if(explaination!="")
                              updateChat(robot, explaination)
                            
                          }, 1000)

                          setTimeout(function(){
                            showMusic(playlist[songIndex].id)
                          },4000)

                        }else{
                          checkMusic()
                        }
                      },8000)

                }
              })

            }
        // }
        else if(isSecondScenario){
            // var r2=confirm("Make sure you have submitted the questionnaire.");
            // if (r2==true)
            // {
                $("#popup").hide()
                $("#questionnaire-2").hide()
                window.location="/success"
            // }
        }
      })

      var seed_artists = data.user.preferenceData.artist[0]
      var seed_tracks = data.user.preferenceData.track[0]
      var seed_genres = data.user.preferenceData.genre[0]

      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      var timeoutResumeInfinity;
      var critiques = [],
        critiquesIndex = 0;
      var needReply = false;

      /******************** music chat function ***********************/

      // chat aliases
      var you = 'you';
      var robot = 'robot';
      var crit = 'crit';
      var skip = 'skip';
      var round = 0;

      // initialize
      // var bot = new chatBot();
      var chat = $('.chat');


      $("#start-task").on("click", function(){
        synth.cancel()
        clearTimeout(showTry)
        clearTimeout(showFeedback)
        clearTimeout(showNextSong)
        clearTimeout(showCurrentSong)
        clearTimeout(showCurrentSong2)
        clearTimeout(showNextSong2)
        clearTimeout(showNextSong3)
        logger = {}
        logger.rating = []
        logger.task1 = new Date().getTime()
        logger.dialog = []
        logger.exp_energy = []
        logger.exp_danceability = []
        logger.exp_speechiness = []
        logger.exp_tempo = []
        logger.exp_valence = []

        logger.exp_artist = []
        logger.exp_lang = []
        logger.exp_category = []
        logger.exp_feature = []
        playlist = data.vis
        songIndex = 0

        isFinished = false
        isPreStudy = false
        isFirstScenario = true

        //clear the chat content for new scenario
        $(".chat").empty()

        numberOfLikedSongs = 0
        songIndex = 0

        //clear the chat content for new scenario
        listenedSongs = []
        numberOfLikedSongs = 0
        $(".list-group").empty()
        
        if(Math.random()>0.5){
          isSystemCrit=0
        }

        $("#start-task").hide()
        //$('body').css("background-image", 'url("../img/metro.png")')
        $(".list-group-item").hide()

        // initial chat state
        updateChat(robot, 'Hi there. Just imagine you are taking subway to your home from the univeristy.');
        setTimeout(function(){
          updateChat(robot, "Now you need to find 5 good songs that you would like to listen to on the trip.")
        },6000)
        setTimeout(function(){
          updateChat(robot, "I have found some songs for you based on your preference, but you can also search for other songs by using the tips shown on the right side.")
        },12000)

        $.ajax({
          url: "/initiate?token="+spotifyToken+"&scenario=party",
          type: "POST",
          contentType: "application/json;charset=utf-8",
          data: storage.profile,
          dataType: "json",
          success: function(data2) {
            topRecommendedSong = data2.vis[0];
            data.topRecommendedSong = topRecommendedSong

            playlist = []
            for(var index=0; index<50; index++){
              playlist.push(data2.vis[index])
              playlist.push(data2.vis[50+index])
              playlist.push(data2.vis[100+index])
            }

            data.vis = playlist.concat()
            copyPlaylist = data.vis.concat()

            setTimeout(function(){
              if(listenedSongs.indexOf(playlist[songIndex].id)<0){
                listenedSongs.push(playlist[songIndex].id)
                setTimeout(function(){
                  var explaination = ""
                  if(playlist[songIndex].danceability>=data.user.preferenceData.danceabilityRange[0]&&playlist[songIndex].danceability<=data.user.preferenceData.danceabilityRange[1])
                    explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.danceabilityRange[2]+" danceability"
                  else if(playlist[songIndex].energy>=data.user.preferenceData.energyRange[0]&&playlist[songIndex].energy<=data.user.preferenceData.energyRange[1])
                    explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.energyRange[2]+" energy"
                  else if(playlist[songIndex].speechiness>=data.user.preferenceData.speechinessRange[0]&&playlist[songIndex].speechiness<=data.user.preferenceData.speechinessRange[1])
                    explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.speechinessRange[2]+" speechiness"
                  else if(playlist[songIndex].tempo>=data.user.preferenceData.tempoRange[0]&&playlist[songIndex].tempo<=data.user.preferenceData.tempoRange[1])
                    explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.tempoRange[2]+" tempo"
                  else if(playlist[songIndex].valence>=data.user.preferenceData.valenceRange[0]&&playlist[songIndex].valence<=data.user.preferenceData.valenceRange[1])
                    explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.valenceRange[2]+" valence"
                  else
                    explaination = "We recommend this song because you like music"

                  if(playlist[songIndex].seedType == "artist")
                    explaination += ", and "+ playlist[songIndex].seed+"'s songs."
                  else if(playlist[songIndex].seedType == "track")
                    explaination += ", and the songs "+ playlist[songIndex].seed+"."
                  else if(playlist[songIndex].seedType == "genre")
                    explaination += ", and the songs of "+ playlist[songIndex].seed+"."
                  if(explaination!="")
                    updateChat(robot, explaination)
                },1000)

                setTimeout(function(){
                  showMusic(playlist[songIndex].id)
                },4000)

              }else{
                checkMusic()
              }
            },16000)
          }
        })
        
      })

      function checkMusic(){

        if(listenedSongs.indexOf(playlist[songIndex].id)<0){
          listenedSongs.push(playlist[songIndex].id)
          setTimeout(function(){
            showMusic(playlist[songIndex].id)
          },500)

        }else{
          if(songIndex<playlist.length-1){
            songIndex++
            data.topRecommendedSong = playlist[songIndex]
            checkMusic()
          }else{
            updateChat(robot, "Sorry, we have no more recommendation for you. Please try to tell us what kind of music you want to listen to.")
            playlist = data.vis
            songIndex = 0
            checkMusic()
          }
        }
      }

      function nextSong(){
        if(songIndex<playlist.length-1){
          playlist.splice( playlist.indexOf(playlist[songIndex].id), 1 );
          songIndex++;
          data.topRecommendedSong = playlist[songIndex]
        }
        else{
          songIndex=0;
          playlist = data.vis
          updateChat(robot, "Sorry, we have no more recommendation for you. Please try to tell us what kind of music you want to listen to.")
        }
      }

      // add a new line to the chat
      var updateChat = function(party, text, modality, scenario) {

        var dialog = {}
        dialog.agent=party
        dialog.text = text
        if(party == you)
          dialog.modality = modality
        dialog.timestamp = new Date().getTime()
        logger.dialog.push(dialog)

        const utterance = new SpeechSynthesisUtterance();
        //match chinese chars
        var reg = /[\u4e00-\u9fa5]/g;

        round++;
        $('#message').val('');

        var style = 'you';
        if(party == you){
          style = 'you';
          var line = $('<div class="speak"><span class="dialog"></span></div>');
          line.addClass(style)
          line.find('.dialog').text(text);
        }
        else if (party == robot) {
          style = 'robot';
          var line = $('<div class="speak"><span class="dialog"></span></div>');
          line.addClass(style)
          line.find('.dialog').text(text);
          
          if(reg.test(text)){
            $.get("/topinyin?text="+text,function(data,err){
              utterance.text = data.pinyin;
              synth.speak(utterance);
            })
          }else{
            utterance.text = text;
            
            synth.speak(utterance);
          }
        }
        else if (party == crit) {
          style = 'robot';
          var line = $('<div id="round'+round+'" class="speak"><span class="dialog"></span><button type="button" id="yes" class="feedback">Yes</button><button type="button" id="no" class="feedback">No</button></div>');
          line.addClass(style)
          line.find('.dialog').text(text);
          utterance.text = text;
          synth.speak(utterance);
        }
        else if (party == skip) {
          style = 'robot';
          var line = $('<div id="round'+round+'" class="speak"><span class="dialog"></span><button type="button" id="suggest" class="feedback">Let bot suggest</button></div>');
          line.addClass(style)
          line.find('.dialog').text(text);
          utterance.text = text;
          synth.speak(utterance);
          chat.append(line);

          $("#round"+round+" .feedback").click(function(){
            nextTimes=0
            $("#round"+round+" .feedback").fadeOut()
            updateChat(you, "I need some suggestions", "btn")
            var line = $('<div class="speak"><div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div></div>');
            chat.append(line);

            // $.ajax({
            //   url: "/initiate?token=" + spotifyToken+"&scenario="+scenario,
            //   type: "POST",
            //   contentType: "application/json;charset=utf-8",
            //   data: storage.profile,
            //   dataType: "json",
            //   success: function(data2) {}
            // })

            playlist=[]

                for(var index=0; index<50; index++){
                  playlist.push(data.vis[index])
                  playlist.push(data.vis[50+index])
                  playlist.push(data.vis[100+index])
                }

                data.topRecommendedSong = playlist[songIndex]

                for(var item in playlist){
                  if(playlist[item] == undefined)
                    playlist.splice(item,1)
                }
                data.playlist = playlist
                console.log(data)

                //-------------------Start critiquing-------------------//

                $.ajax({
                  url: "/generateCritiquing?id=" + data.user.id,
                  type: "POST",
                  contentType: "application/json;charset=utf-8",
                  data: JSON.stringify(data),
                  dataType: "json",
                  success: function(result) {
                    critiques = [];
                    critiquesIndex = 0;

                    console.log(result)

                    for (var crt in result.diversifyCritique) {

                      var wording = "Based on your music preference, we think you might like the ";
                      var songType = "",
                        features = "";
                      var actionSet = {},
                        action = [];

                      for (var index in result.diversifyCritique[crt]) {

                        if (result.diversifyCritique[crt][index].split("|")[0] == "language") {
                          var actionItem = {}
                          actionItem.prop = "language"
                          actionItem.val = result.diversifyCritique[crt][index].split("|")[1]
                          actionItem.type = "equal"
                          action.push(actionItem)
                          songType += actionItem.val + " "
                          //data.user.attributeWeight.languageWeight += 1;

                        } else if (result.diversifyCritique[crt][index].split("|")[0] == "genre") {
                          var actionItem = {}
                          actionItem.prop = "genre"
                          actionItem.val = result.diversifyCritique[crt][index].split("|")[1]
                          actionItem.type = "equal"
                          action.push(actionItem)
                          songType += actionItem.val + " "
                          //data.user.attributeWeight.genreWeight +=1;

                        } else if (result.diversifyCritique[crt][index].split("|")[0] == "artist") {
                          var actionItem = {}
                          actionItem.prop = "artist"
                          actionItem.val = result.diversifyCritique[crt][index].split("|")[1]
                          actionItem.type = "equal"
                          action.push(actionItem)
                          songType += action.artist + " "
                          //data.user.attributeWeight.artistWeight += 1;

                        } else if (result.diversifyCritique[crt][index].split("|")[1] == "lower") {
                          var actionItem = {}
                          actionItem.prop = result.diversifyCritique[crt][index].split("|")[0]
                          // actionItem.val = -0.1
                          actionItem.type = "lower"
                          action.push(actionItem)
                          features += "lower " + result.diversifyCritique[crt][index].split("|")[0] + ", "
                        } else if (result.diversifyCritique[crt][index].split("|")[1] == "higher") {
                          var actionItem = {}
                          actionItem.prop = result.diversifyCritique[crt][index].split("|")[0]
                          // actionItem.val = 0.1
                          actionItem.type = "higher"
                          action.push(actionItem)
                          features += "higher " + result.diversifyCritique[crt][index].split("|")[0] + ", "
                        } else if (result.diversifyCritique[crt][index].split("|")[1] == "similar") {
                          var actionItem = {}
                          actionItem.prop = result.diversifyCritique[crt][index].split("|")[0]
                          // actionItem.val = 0.1
                          actionItem.type = "similar"
                          action.push(actionItem)
                          features += "similar " + result.diversifyCritique[crt][index].split("|")[0] + ", "
                        }

                        // if(result.diversifyCritique[crt][index].split("|")[0]=="popularity")
                        //   data.user.attributeWeight.popularityWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="danceability")
                        //   data.user.attributeWeight.danceabilityWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="energy")
                        //   data.user.attributeWeight.energyWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="speechiness")
                        //   data.user.attributeWeight.speechinessWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="tempo")
                        //   data.user.attributeWeight.tempoWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="valence")
                        //   data.user.attributeWeight.valenceWeight += 1;
                      }

                      if (songType && !features){
                        wording += songType + "music"
                        actionSet.speech = wording+"?"
                      }
                      else if (!songType && features){
                        wording += "songs with " + features
                        actionSet.speech = wording.substr(0,wording.length-2)+"?"
                      }
                      else if (songType && features) {
                        wording += songType + "songs with " + features
                        actionSet.speech = wording.substr(0,wording.length-2)+"?"
                      }

                      actionSet.action = action
                      critiques.push(actionSet)
                    }

                    console.log(critiques)

                    $('.spinner').remove();
                    updateChat(crit, critiques[critiquesIndex].speech);

                  },
                  error: function(msg) {
                    console.log(msg)
                  }
                })

          })
        }

        chat.append(line);
        chat.stop().animate({
          scrollTop: chat.prop("scrollHeight")
        });

        $("#round"+round+" #yes").click(function() {
            $("#round"+round+" button").fadeOut()
            updateChat(you, "Yes, please!", "btn")

            //perform critiquing on existing set

              var newlist = data.vis.concat()

              // while(true){
              //   if(critiqueList.indexOf(critiques[critiquesIndex])<0){
              //     critiqueList.push(critiques[critiquesIndex])
              //     break;
              //   }
              //   else
              //     critiquesIndex++
              // }

              for (var index2 in critiques[critiquesIndex].action) {
                var templist = []

                var critAttr = critiques[critiquesIndex].action[index2].prop
                var critType = critiques[critiquesIndex].action[index2].type
                data.user.attributeWeight[critAttr+"Weight"] += 1;

                newlist.map(function(track) {
                  if (critType == "equal") {
                    console.log(critiques[critiquesIndex].action[index2].val)
                    if (track[critAttr] == critiques[critiquesIndex].action[index2].val) {
                      templist.push(track)
                    }
                  } else if (critType == "lower") {
                    console.log(data.user.preferenceData[critAttr])
                    if (track[critAttr] < data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr]) {
                      templist.push(track)
                      data.user.preferenceData[critAttr+"Range"][0]=0
                      data.user.preferenceData[critAttr+"Range"][1]=data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][2]="low"
                    }
                  } else if (critType == "higher") {
                    console.log(data.user.preferenceData[critAttr])
                    if (track[critAttr] > data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]) {
                      templist.push(track)
                      data.user.preferenceData[critAttr+"Range"][0]=data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][1]=1
                      data.user.preferenceData[critAttr+"Range"][2]="high"
                    }
                  } else if (critType == "similar") {
                    console.log(data.user.preferenceData[critAttr])
                    if (track[critAttr] >= data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr] && track[critAttr] <= data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]) {
                      templist.push(track)
                      data.user.preferenceData[critAttr+"Range"][0]=data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][1]=data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][2]="middle"
                    }
                  }
                })
                newlist = templist.concat()
                console.log(newlist)
              }
              playlist = newlist.concat()

            console.log(playlist)
            songIndex = 0
            checkMusic()

        })

        $("#round"+round+" #no").click(function() {
          $("#round"+round+" button").fadeOut()
          updateChat(you, "I don't want.", "btn")
          if (critiquesIndex < critiques.length-1) {
            needReply = true;
            critiquesIndex++;
            updateChat(crit, critiques[critiquesIndex].speech);

          } else if (critiquesIndex == critiques.length-1) {
            critiquesIndex = 0
            updateChat(robot, "Sorry, I have no any other suggestions:(");
            playlist = data.vis
            checkMusic()
          }
        })
      }

      var showMusic = function(id, noExp, scenario) {

        var dialog = {}
        dialog.agent="robot"
        dialog.text = id
        dialog.timestamp = new Date().getTime()
        logger.dialog.push(dialog)

        showCurrentSong = setTimeout(function() {
          if(isSystemCrit==1){
            var line = $('<div id="speak'+id+'" class="speak"><iframe src="https://open.spotify.com/embed/track/' + id + '" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe></div>')
            showFeedback = setTimeout(function(){
              $("#speak"+id).append('<div class="feedback-box"><button type="button" id="like" class="feedback">Like</button><button type="button" id="next" class="feedback">Next</button><button type="button" id="suggest" class="feedback">Let bot suggest</button></div>')

              $("#speak"+id+" #like").click(function() {
                updateChat(you, "I like this song.", "btn")
                setTimeout(function(){
                  updateChat(robot, rateUtters[parseInt((rateUtters.length*Math.random()))])
                },50)
                nextTimes=0
                if(!isFinished){
                  $("#speak"+id+" .feedback-box").fadeOut()
            
                  if (numberOfLikedSongs < 5) {
                    if(data.user.preferenceData.track.length<5)
                      data.user.preferenceData.track.push(playlist[songIndex].id)
                    else
                      data.user.preferenceData.track[5]=playlist[songIndex].id

                    $(".list-group").append("<li class='list-group-item' id='" + playlist[songIndex].id + "'>" + playlist[songIndex].name + "&nbsp;&nbsp;<i class='fa fa-close'></i><input type='number' class='rating' data-size='xs'></li>")
                    $("#"+playlist[songIndex].id+" .rating").rating({min:1, max:5, step:1});
                    $("#"+playlist[songIndex].id+" .rating").on('rating:change', function(event, value, caption) {
                        $("#"+playlist[songIndex].id+" .rating").rating('refresh', {disabled: true, showClear: false, showCaption: true});
                        $("#" + playlist[songIndex].id+ "> .fa-close").hide()
                        numberOfLikedSongs++
                        if(numberOfLikedSongs<5){
                          updateChat(robot, nextSongUtters[parseInt((nextSongUtters.length*Math.random()))])
                          showNextSong = setTimeout(function(){
                            nextSong()
                            $("#speak"+id+" div").fadeOut();
                            if(listenedSongs.indexOf(playlist[songIndex].id)<0){
                              listenedSongs.push(playlist[songIndex].id)
                              showNextSong3 = setTimeout(function(){
                                showMusic(playlist[songIndex].id)
                              },1000)


                            }else{
                              checkMusic()
                            }

                          },10)

                        }

                        if(numberOfLikedSongs == 5&&isFirstScenario){
                          isFinished = true
                          $("#popup").show()
                          $("#user-id span").text(isSystemCrit+"|"+userID)
                          if(systemLang == "en")
                            $("#popup iframe").attr("src","https://docs.google.com/forms/d/e/1FAIpQLScZwPQ6CUJcE8_B4VGmshN3mGbS1bcZUZpizxW8w2oRDAiB8w/viewform?usp=pp_url&entry.1866900769="+isSystemCrit+"|"+userID)
                          else if(systemLang == "zh")
                            $("#popup iframe").attr("src","https://www.wjx.cn/jq/37654389.aspx")

                          logger.task1 = new Date().getTime() - logger.task1
                          logger.listenedSongs = listenedSongs.concat()
                          logger.rating = []
                          $("li.list-group-item").each(function(i){
                            var rating = {}
                            rating.id = $(this).attr("id")
                            rating.value = $(this).find(".rating-stars").attr("title")
                            logger.rating.push(rating)
                          })
                          loggers.push(logger)


                        }else if(numberOfLikedSongs == 5&&isSecondScenario){
                          isFinished = true
                          $("#popup").show()
                          $("#user-id span").text(isSystemCrit+"|"+userID)
                          if(systemLang == "en")
                            $("#popup iframe").attr("src","https://docs.google.com/forms/d/e/1FAIpQLSdael2pmsVQw8Cp-LJ0R9pgofyqpl4gwu7FuQHi61mQHqSaxA/viewform?usp=pp_url&entry.1977006307="+isSystemCrit+"|"+userID)
                          else if(systemLang == "zh")
                            $("#popup iframe").attr("src","https://www.wjx.cn/jq/37652495.aspx")

                          logger.task2 = new Date().getTime() - logger.task2
                          logger.listenedSongs = listenedSongs.concat()
                          logger.rating = []
                          $("li.list-group-item").each(function(i){
                            var rating = {}
                            rating.id = $(this).attr("id")
                            rating.value = $(this).find(".rating-stars").attr("title")
                            logger.rating.push(rating)
                          })

                          loggers.push(logger)
                          
                          data.user.logger = loggers
                          console.log(data.user)

                          $.ajax({
                            url: '/addRecord',
                            type: 'POST',
                            contentType:'application/json',
                            data: JSON.stringify(data),
                            dataType:'json'
                          });
                          }else if(numberOfLikedSongs == 5&&isPreStudy){
                            updateChat(robot, "Now, you should be familiar with the system. You can click the 'start study' button to start.")
                          }
                    });

                    // remove a liked song
                    $("#" + playlist[songIndex].id+ "> .fa-close").click(function() {
                      // numberOfLikedSongs--
                      $(this).parent().remove()
                    })
                  }
                }
              })

              $("#speak"+id+" #next").click(function() {
                nextTimes++;
                if(nextTimes<3){
                  $("#speak"+id+" .feedback-box").fadeOut()
                  updateChat(you, "Next song.", "btn")
            
                  nextSong()
                  showNextSong2 = setTimeout(function(){
                    $("#speak"+id+" div").fadeOut();
                    if(listenedSongs.indexOf(playlist[songIndex].id)<0){
                      listenedSongs.push(playlist[songIndex].id)

                      setTimeout(function(){
                        showMusic(playlist[songIndex].id, true)
                      },1000)

                    }else{
                      checkMusic()
                    }
                  },500)
                }else{
                  $("#speak"+id+" .feedback-box").fadeOut()
                  updateChat(you, "Next song.", "btn")
                  setTimeout(function(){
                    $("#speak"+id+" div").fadeOut();
                    updateChat(skip, 'Since you have skipped many songs, you can click the "Let bot suggest" button to get suggestions, or you can just tell me what kind of music you want to listen to?');
                  },300)
                }

              })

              $("#speak"+id+" #suggest").click(function() {
                nextTimes=0
                $("#speak"+id+" .feedback-box").fadeOut()
                updateChat(you, "I need some suggestions", "btn")
                $("#speak"+id+" div").fadeOut();
                var line = $('<div class="speak"><div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div></div>');
                chat.append(line);
                
                playlist=[]

                for(var index=0; index<50; index++){
                  playlist.push(data.vis[index])
                  playlist.push(data.vis[50+index])
                  playlist.push(data.vis[100+index])
                }

                for(var item in playlist){
                  if(playlist[item] == undefined)
                    playlist.splice(item,1)
                }

                data.topRecommendedSong = playlist[songIndex]


                data.playlist = playlist
                console.log(data)

                //-------------------Start critiquing-------------------//

                $.ajax({
                  url: "/generateCritiquing?id=" + data.user.id,
                  type: "POST",
                  contentType: "application/json;charset=utf-8",
                  data: JSON.stringify(data),
                  dataType: "json",
                  success: function(result) {
                    critiques = [];
                    critiquesIndex = 0;

                    console.log(result)

                    for (var crt in result.diversifyCritique) {

                      var wording = "Based on your music preference, we think you might like the ";
                      var songType = "",
                        features = "";
                      var actionSet = {},
                        action = [];

                      for (var index in result.diversifyCritique[crt]) {

                        if (result.diversifyCritique[crt][index].split("|")[0] == "language") {
                          var actionItem = {}
                          actionItem.prop = "language"
                          actionItem.val = result.diversifyCritique[crt][index].split("|")[1]
                          actionItem.type = "equal"
                          action.push(actionItem)
                          songType += actionItem.val + " "
                          //data.user.attributeWeight.languageWeight += 1;

                        } else if (result.diversifyCritique[crt][index].split("|")[0] == "genre") {
                          var actionItem = {}
                          actionItem.prop = "genre"
                          actionItem.val = result.diversifyCritique[crt][index].split("|")[1]
                          actionItem.type = "equal"
                          action.push(actionItem)
                          songType += actionItem.val + " "
                          //data.user.attributeWeight.genreWeight +=1;

                        } else if (result.diversifyCritique[crt][index].split("|")[0] == "artist") {
                          var actionItem = {}
                          actionItem.prop = "artist"
                          actionItem.val = result.diversifyCritique[crt][index].split("|")[1]
                          actionItem.type = "equal"
                          action.push(actionItem)
                          songType += action.artist + " "
                          //data.user.attributeWeight.artistWeight += 1;

                        } else if (result.diversifyCritique[crt][index].split("|")[1] == "lower") {
                          var actionItem = {}
                          actionItem.prop = result.diversifyCritique[crt][index].split("|")[0]
                          // actionItem.val = -0.1
                          actionItem.type = "lower"
                          action.push(actionItem)
                          features += "lower " + result.diversifyCritique[crt][index].split("|")[0] + ", "
                        } else if (result.diversifyCritique[crt][index].split("|")[1] == "higher") {
                          var actionItem = {}
                          actionItem.prop = result.diversifyCritique[crt][index].split("|")[0]
                          // actionItem.val = 0.1
                          actionItem.type = "higher"
                          action.push(actionItem)
                          features += "higher " + result.diversifyCritique[crt][index].split("|")[0] + ", "
                        } else if (result.diversifyCritique[crt][index].split("|")[1] == "similar") {
                          var actionItem = {}
                          actionItem.prop = result.diversifyCritique[crt][index].split("|")[0]
                          // actionItem.val = 0.1
                          actionItem.type = "similar"
                          action.push(actionItem)
                          features += "similar " + result.diversifyCritique[crt][index].split("|")[0] + ", "
                        }

                        // if(result.diversifyCritique[crt][index].split("|")[0]=="popularity")
                        //   data.user.attributeWeight.popularityWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="danceability")
                        //   data.user.attributeWeight.danceabilityWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="energy")
                        //   data.user.attributeWeight.energyWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="speechiness")
                        //   data.user.attributeWeight.speechinessWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="tempo")
                        //   data.user.attributeWeight.tempoWeight += 1;
                        // else if(result.diversifyCritique[crt][index].split("|")[0]=="valence")
                        //   data.user.attributeWeight.valenceWeight += 1;
                      }

                      if (songType && !features){
                        wording += songType + "music"
                        actionSet.speech = wording+"?"
                      }
                      else if (!songType && features){
                        wording += "songs with " + features
                        actionSet.speech = wording.substr(0,wording.length-2)+"?"
                      }
                      else if (songType && features) {
                        wording += songType + "songs with " + features
                        actionSet.speech = wording.substr(0,wording.length-2)+"?"
                      }

                      actionSet.action = action
                      critiques.push(actionSet)
                    }

                    console.log(critiques)

                    $('.spinner').remove();
                    updateChat(crit, critiques[critiquesIndex].speech);

                  },
                  error: function(msg) {
                    console.log(msg)
                  }
                })
              })
              chat.stop().animate({
                scrollTop: chat.prop("scrollHeight")
              });

            },3000)
          }
          else{
            var line = $('<div id="speak'+id+'" class="speak"><iframe src="https://open.spotify.com/embed/track/' + id + '" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe></div>')
            showFeedback = setTimeout(function(){
              $("#speak"+id).append('<div class="feedback-box"><button type="button" id="like" class="feedback">Like</button><button type="button" id="next" class="feedback">Next</button></div>')

              $("#speak"+id+" #like").click(function() {
                updateChat(you, "I like this song.", "btn")
                setTimeout(function(){
                  updateChat(robot, rateUtters[parseInt((rateUtters.length*Math.random()))])
                },50)

                nextTimes=0

                if(!isFinished){
                  $("#speak"+id+" .feedback-box").fadeOut()
                  //updateChat(you, "I like this song.", "btn")

                  if (numberOfLikedSongs < 5) {
                    // console.log(data.user.preferenceData.track)
                    if(data.user.preferenceData.track.length<5)
                      data.user.preferenceData.track.push(playlist[songIndex].id)
                    else
                      data.user.preferenceData.track[5]=playlist[songIndex].id

                    $(".list-group").append("<li class='list-group-item' id='" + playlist[songIndex].id + "'>" + playlist[songIndex].name + "&nbsp;&nbsp;<i class='fa fa-close'></i><input type='number' class='rating' data-size='xs'></li>")
                    $("#"+playlist[songIndex].id+" .rating").rating({min:1, max:5, step:1});
                    $("#"+playlist[songIndex].id+" .rating").on('rating:change', function(event, value, caption) {
                        $("#"+playlist[songIndex].id+" .rating").rating('refresh', {disabled: true, showClear: false, showCaption: true});
                        $("#" + playlist[songIndex].id+ "> .fa-close").hide()
                        numberOfLikedSongs++
                        if(numberOfLikedSongs<5){
                          updateChat(robot, nextSongUtters[parseInt((nextSongUtters.length*Math.random()))])
                          showNextSong = setTimeout(function(){
                            nextSong()
                            $("#speak"+id+" div").fadeOut();

                            if(listenedSongs.indexOf(playlist[songIndex].id)<0){
                              listenedSongs.push(playlist[songIndex].id)

                              showNextSong3 = setTimeout(function(){
                                showMusic(playlist[songIndex].id)
                              },1000)

                            }else{
                              checkMusic()
                            }

                          },10)
                        }

                        if(numberOfLikedSongs == 5 && isFirstScenario){
                          $("#popup").show()
                          $("#user-id span").text(isSystemCrit+"|"+userID)
                          if(systemLang == "en")
                            $("#popup iframe").attr("src","https://docs.google.com/forms/d/e/1FAIpQLScZwPQ6CUJcE8_B4VGmshN3mGbS1bcZUZpizxW8w2oRDAiB8w/viewform?usp=pp_url&entry.1866900769="+isSystemCrit+"|"+userID)
                          else if(systemLang == "zh")
                            $("#popup iframe").attr("src","https://www.wjx.cn/jq/37654389.aspx")

                          logger.task1 = new Date().getTime() - logger.task1
                          logger.listenedSongs = listenedSongs.concat()
                          logger.rating = []
                          $("li.list-group-item").each(function(i){
                            var rating = {}
                            rating.id = $(this).attr("id")
                            rating.value = $(this).find(".rating-stars").attr("title")
                            logger.rating.push(rating)
                          })
                          loggers.push(logger)

                        }else if(numberOfLikedSongs == 5 && isSecondScenario){
                          console.log("scenario2")
                          $("#popup").show()
                          $("#user-id span").text(isSystemCrit+"|"+userID)
                          if(systemLang == "en")
                            $("#popup iframe").attr("src","https://docs.google.com/forms/d/e/1FAIpQLSdael2pmsVQw8Cp-LJ0R9pgofyqpl4gwu7FuQHi61mQHqSaxA/viewform?usp=pp_url&entry.1977006307="+isSystemCrit+"|"+userID)
                          else if(systemLang == "zh")
                            $("#popup iframe").attr("src","https://www.wjx.cn/jq/37652495.aspx")
                          
                          logger.task2 = new Date().getTime() - logger.task2
                          logger.listenedSongs = listenedSongs.concat()
                          logger.rating = []
                          $("li.list-group-item").each(function(i){
                            var rating = {}
                            rating.id = $(this).attr("id")
                            rating.value = $(this).find(".rating-stars").attr("title")
                            logger.rating.push(rating)
                          })

                          loggers.push(logger)
                          data.user.logger = loggers
                          console.log(data.user)

                          $.ajax({
                            url: '/addRecord',
                            type: 'POST',
                            contentType:'application/json',
                            data: JSON.stringify(data),
                            dataType:'json'
                          });
                          }else if(numberOfLikedSongs == 5&&isPreStudy){
                            updateChat(robot, "Now, you should be familiar with the system. You click the 'start study' button to start.")
                          }
                    });
                    // remove a liked song
                    $("#" + playlist[songIndex].id + "> .fa-close").click(function() {
                      // numberOfLikedSongs--
                      $(this).parent().remove()
                    })

                  }
                }
              })

              $("#speak"+id+" #next").click(function() {
                nextTimes++
                if(nextTimes<3){
                  $("#speak"+id+" .feedback-box").fadeOut()
                  updateChat(you, "Next song.", "btn")
            
                  nextSong()
                  setTimeout(function(){
                    $("#speak"+id+" div").fadeOut();
                    if(listenedSongs.indexOf(playlist[songIndex].id)<0){
                      listenedSongs.push(playlist[songIndex].id)

                      setTimeout(function(){
                        showMusic(playlist[songIndex].id, true)
                      },1000)

                    }else{
                      checkMusic()
                    }
                  },300)
                }else{
                  $("#speak"+id+" .feedback-box").fadeOut()
                  updateChat(you, "Next song.", "btn")
                  setTimeout(function(){
                    $("#speak"+id+" div").fadeOut();
                    updateChat(robot, 'Since you have skipped many songs, can you tell me what kind of music you want to listen to?');
                  },300)
                }

              })

              chat.stop().animate({
                scrollTop: chat.prop("scrollHeight")
              });

            },3000)
          }

          line.addClass("other")
          chat.append(line);
          chat.stop().animate({
            scrollTop: chat.prop("scrollHeight")
          });

        }, 1000)
      }

      var rec, baiduTimeout

      // document.querySelector('.boxContainer').addEventListener('click', () => {
      //   $('.fa-microphone').show()
      //   $('.boxContainer').hide()

      //   clearTimeout(baiduTimeout)
      //   rec.stop(function(blob,duration){//到达指定条件停止录音，拿到blob对象想干嘛就干嘛：立即播放、上传
      //     //console.log(URL.createObjectURL(blob),"时长:"+duration+"ms");
          
      //     var formData = new FormData();
      //     formData.append('file', blob);

      //     console.log(blob)

      //     $.ajax({
      //       url: "/upload",
      //       type: "POST",
      //       data: formData,
      //       enctype: 'multipart/form-data',
      //       processData: false,
      //       contentType: false,
      //       success: function(data) {
      //         console.log(data)

      //         var objData = JSON.parse(data)
      //         let text="";
      //         if(objData.result)
      //           text = objData.result[0];

      //         if(text!=""){
      //           synth.cancel()
      //           $(".feedback").remove()
      //           clearTimeout(showFeedback)
      //           clearTimeout(showNextSong)
      //           clearTimeout(showCurrentSong)
      //           clearTimeout(showCurrentSong2)
      //           clearTimeout(showNextSong2)
      //           clearTimeout(showNextSong3)
      //           nextTimes = 0
      //           updateChat(you, text, "voice");
      //           socket.emit('chat message', text);
      //         }

      //       },
      //       error: function(e) {
      //         updateChat(robot, 'Sorry, we find an error during voice recognition.');
      //         console.log('Result: Error occurred: ' + e.message)
      //       }
      //     });

      //     rec.close();//释放录音资源
      //   },function(msg){
      //       console.log("录音失败:"+msg);
      //   });

      // })
            
      // document.querySelector('.fa-microphone').addEventListener('click', () => {
      //   $('.fa-microphone').hide()
      //   $('.boxContainer').show() 

      //   if(systemLang == "en"){
      //     recognition.start();
      //   }else if(systemLang == "zh"){
      //     rec=Recorder({
      //         type:"wav",
      //         bitRate:16,
      //         sampleRate:16000,
      //         bufferSize:4096
      //     });
      //     rec.open(function(){//打开麦克风授权获得相关资源
      //       rec.start();//开始录音
              
      //       baiduTimeout = setTimeout(function(){
      //         $('.fa-microphone').show()
      //         $('.boxContainer').hide() 
      //         rec.stop(function(blob,duration){//到达指定条件停止录音，拿到blob对象想干嘛就干嘛：立即播放、上传
      //             //console.log(URL.createObjectURL(blob),"时长:"+duration+"ms");
                  
      //             var formData = new FormData();
      //             formData.append('file', blob);

      //             console.log(blob)

      //             $.ajax({
      //               url: "/upload",
      //               type: "POST",
      //               data: formData,
      //               enctype: 'multipart/form-data',
      //               processData: false,
      //               contentType: false,
      //               success: function(data) {
      //                 console.log(data)

      //                 var objData = JSON.parse(data)

      //                 let text="";
      //                 if(objData.result)
      //                   text = objData.result[0];

      //                 if(text!=""){
      //                   synth.cancel()
      //                   $(".feedback").remove()
      //                   clearTimeout(showFeedback)
      //                   clearTimeout(showNextSong)
      //                   clearTimeout(showCurrentSong)
      //                   clearTimeout(showCurrentSong2)
      //                   clearTimeout(showNextSong2)
      //                   clearTimeout(showNextSong3)
      //                   nextTimes = 0
      //                   updateChat(you, text, "voice");
      //                   socket.emit('chat message', text);
      //                 }

      //               },
      //               error: function(e) {
      //                 updateChat(robot, 'Sorry, we find an error during voice recognition.');
      //                 console.log('Result: Error occurred: ' + e.message)
      //               }
      //             });
      //             rec.close();//释放录音资源
      //         },function(msg){
      //             console.log("录音失败:"+msg);
      //         });
      //     },3000);
      //     },function(msg){//未授权或不支持
      //         console.log("无法录音:"+msg);
      //     });
      //   }
      // });


      $('input#message').bind('keypress', function(event) {
        var text = document.querySelector('input#message').value
        if (event.keyCode == "13") {

          if(text!=""){
            synth.cancel()
            $(".feedback").remove()
            clearTimeout(showFeedback)
            clearTimeout(showNextSong)
            clearTimeout(showCurrentSong)
            clearTimeout(showCurrentSong2)
            clearTimeout(showNextSong2)
            clearTimeout(showNextSong3)
            nextTimes = 0
            socket.emit('chat message', text);
            updateChat(you, text, "typing");

            if (text.indexOf("next") > -1) {
              nextSong()
            }
          }
        }
      })

      recognition.addEventListener('speechstart', () => {
        console.log('Speech has been detected.');
      });

      recognition.addEventListener('result', (e) => {
        console.log('Result has been detected.');
        let last = e.results.length - 1;
        let text = e.results[last][0].transcript;

        if(text!=""){
          synth.cancel()
          $(".feedback").remove()
          clearTimeout(showFeedback)
          clearTimeout(showNextSong)
          clearTimeout(showCurrentSong)
          clearTimeout(showCurrentSong2)
          clearTimeout(showNextSong2)
          clearTimeout(showNextSong3)
          nextTimes = 0
          updateChat(you, text, "voice");
          console.log('Confidence: ' + e.results[0][0].confidence);
          socket.emit('chat message', text);
        }
      });

      recognition.addEventListener('speechend', () => {
        recognition.stop();
        $('.fa-microphone').show()
        $('.boxContainer').hide()
      });

      recognition.addEventListener('error', (e) => {
        updateChat(robot, 'Sorry, we find an error during voice recognition.');
      });


      var numberOfMiss = 0;

      /*
      This fuction parses the returned data from Dialog flow
      */
      function synthVoice(text) {
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance();
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

        var artist, song, language, genre, valence, tempo, action, feature;
        var explaination = ""

        utterance.onstart = function(event) {
          resumeInfinity();
        };

        var requestLink;

        var isMissed = false
        //search by artist
        if (intent == "music_player_control.skip_forward") {
          skipTimes++;
          nextSong()
        } else if (intent == "music.search") {
          artist = text.parameters["artist"]
          song = text.parameters["song"]
          language = text.parameters["music-languages"]
          genre = text.parameters["genre"]
          if (artist.length > 0) {
            requestLink = '/searchArtist?q=' + artist[0] + '&token=' + spotifyToken;
            data.user.attributeWeight.artistWeight += 1;
            explaination = "OK, I recommend this song to you, because you like "+artist+"'s songs."
          } else if (song){
            requestLink = '/searchTrack?q=' + song + '&token=' + spotifyToken;
            explaination = "OK, I recommend this song to you, because you like the song "+song+"."
          } else if (language){
            requestLink = '/searchPlaylist?q=' + language + '&token=' + spotifyToken;
            data.user.attributeWeight.languageWeight += 1;
            explaination = "OK, I recommend this song to you, because you like the "+language+"."
          } else if (genre) {
            requestLink = '/searchPlaylist?q=' + genre + "&token=" + spotifyToken;
            data.user.attributeWeight.genreWeight += 1;
            explaination = "OK, I recommend this song to you, because you like the songs of "+genre+"."
          } else
            requestLink = ''

          // playRequestLink(requestLink)
        } else if (intent == "critique.response") {
          needReply = false;
          var response = text.parameters["RESPONSE"]
          if (response == "yes") {
            //perform critiquing on existing set

              // while(true){
              //   if(critiqueList.indexOf(critiques[critiquesIndex])<0){
              //     critiqueList.push(critiques[critiquesIndex])
              //     break;
              //   }
              //   else
              //     critiquesIndex++
              // }

              var newlist = data.vis.concat()
              for (var index2 in critiques[critiquesIndex].action) {
                var templist = []
                newlist.map(function(track) {
                  var critAttr = critiques[critiquesIndex].action[index2].prop
                  var critType = critiques[critiquesIndex].action[index2].type
                  if (critType == "equal") {
                    console.log(critiques[critiquesIndex].action[index2].val)
                    if (track[critAttr] == critiques[critiquesIndex].action[index2].val) {
                      templist.push(track)
                      data.user.preferenceData[critAttr+"Range"][0]=0
                      data.user.preferenceData[critAttr+"Range"][1]=data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][2]="low"
                    }
                  } else if (critType == "lower") {
                    console.log(data.user.preferenceData[critAttr])
                    if (track[critAttr] < data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr]) {
                      templist.push(track)
                    }
                  } else if (critType == "higher") {
                    console.log(data.user.preferenceData[critAttr])
                    if (track[critAttr] > data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]) {
                      templist.push(track)
                      data.user.preferenceData[critAttr+"Range"][0]=data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][1]=1
                      data.user.preferenceData[critAttr+"Range"][2]="high"
                    }
                  } else if (critType == "similar") {
                    console.log(data.user.preferenceData[critAttr])
                    if (track[critAttr] >= data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr] && track[critAttr] <= data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]) {
                      templist.push(track)
                      data.user.preferenceData[critAttr+"Range"][0]=data.topRecommendedSong[critAttr] - data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][1]=data.topRecommendedSong[critAttr] + data.user.preferenceData_variance[critAttr]
                      data.user.preferenceData[critAttr+"Range"][2]="middle"
                    }
                  }
                })
                newlist = templist.concat()
                console.log(newlist)
              }
              playlist = newlist.concat()

            console.log(playlist)
            songIndex = 0
          } else if (response == "no") {
            if (critiquesIndex < critiques.length-1) {
              needReply = true;
              critiquesIndex++;
              updateChat(robot, critiques[critiquesIndex].speech);

            } else if (critiquesIndex == critiques.length-1) {
              critiquesIndex = 0
              speakandsing("OK, I have no more suggestions, but maybe you want to try this song.", false)
            }
          }
        } else if (intent == "music_player_control.features") {
          valence = text.parameters["music-valence"]
          tempo = text.parameters["music-tempo"]
          action = text.parameters["feature-actions"]
          feature = text.parameters["music-features"]
          if (valence) {
            if (valence == "happy"){
              //userCrit("valence","higher")
              //data.user.preferenceData.valence += data.user.preferenceData_variance.valence
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&seed_tracks=' + seed_tracks +'&genreSeeds=' + seed_genres + '&min_valence='+data.user.preferenceData.valence+'&token=' + spotifyToken;
            }
            else if (valence == "neutral"){
              //userCrit("valence","similar")
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&seed_tracks=' + seed_tracks +'&genreSeeds=' + seed_genres + '&target_valence='+data.user.preferenceData.valence+'&token=' + spotifyToken;
            }           
            else if (valence == "sad"){
              //userCrit("valence","lower")
              //data.user.preferenceData.valence -= data.user.preferenceData_variance.valence
              requestLink = '/getRecom?artistSeeds=' + seed_artists + '&seed_tracks=' + seed_tracks +'&genreSeeds=' + seed_genres + '&max_valence='+data.user.preferenceData.valence+'&token=' + spotifyToken;
            }
            data.user.attributeWeight.valenceWeight += 1;
            explaination = "OK, I recommend this song to you, because you like the "+valence+" songs"
          }else if(tempo){
              if (tempo == "fast"){
                //userCrit("tempo","higher")
                //data.user.preferenceData.tempo += data.user.preferenceData_variance.tempo
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&genreSeeds=' + seed_genres + '&min_tempo='+data.user.preferenceData.tempo+'&token='+spotifyToken;
              }
              else if (tempo == "normal"){
                //userCrit("tempo","similar")
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&genreSeeds=' + seed_genres + '&target_tempo='+data.user.preferenceData.tempo+'&token='+spotifyToken;
              }             else if (tempo == "slow"){
                //userCrit("tempo","lower")
                //data.user.preferenceData.tempo -= data.user.preferenceData_variance.tempo
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&genreSeeds=' + seed_genres + '&max_tempo='+data.user.preferenceData.tempo+'&token='+spotifyToken;
              }
              data.user.attributeWeight.tempoWeight += 1;
              explaination = "OK, I recommend this song to you, because you like the "+tempo+" songs"
          }else if (feature) {
            if (feature == "energy") {
              if (action == "increase"){
                //userCrit("energy","higher")
                //data.user.preferenceData.energy += data.user.preferenceData_variance.energy
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&min_energy=' + data.user.preferenceData.energy + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher energy."
              }
              else if (action == "decrease"){
                //userCrit("energy","lower")
                //data.user.preferenceData.energy -= data.user.preferenceData_variance.energy
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&max_energy=' + data.user.preferenceData.energy + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of lower energy."
              }
              else if (action==""){
                //userCrit("energy","higher")
                //data.user.preferenceData.energy += data.user.preferenceData_variance.energy
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + 'min_energy=' + data.user.preferenceData.energy + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher energy."
              }
              data.user.attributeWeight.energyWeight += 1;
            } else if (feature == "danceability") {
              if (action == "increase"){
                //userCrit("danceability","higher")
                //data.user.preferenceData.danceability += data.user.preferenceData_variance.danceability
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&min_danceability=' + data.user.preferenceData.danceability + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher danceability."
              }
              else if (action == "decrease"){
                //userCrit("danceability","lower")
                //data.user.preferenceData.danceability -= data.user.preferenceData_variance.danceability
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&max_danceability=' + data.user.preferenceData.danceability + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of lower danceability."
              }
              else if (action==""){
                //userCrit("danceability","higher")
                //data.user.preferenceData.danceability += data.user.preferenceData_variance.danceability
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&min_danceability=' + data.user.preferenceData.danceability + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher danceability."
              }
              data.user.attributeWeight.danceabilityWeight += 1;
            } else if (feature == "speech") {
              if (action == "increase"){
                //userCrit("speechiness","higher")
                //data.user.preferenceData.speechiness += data.user.preferenceData.speechiness
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&min_speechiness=' + data.user.preferenceData.speechiness + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher speechiness."
              }
              else if (action == "decrease"){
                //userCrit("speechiness","lower")
                // data.user.preferenceData.speechiness -= data.user.preferenceData.speechiness
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&max_speechiness=' + data.user.preferenceData.speechiness + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of lower speechiness."
              }
              else if (action==""){
                //userCrit("speechiness","higher")
                // data.user.preferenceData.speechiness += data.user.preferenceData.speechiness
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks +'&genreSeeds=' + seed_genres + '&min_speechiness=' + data.user.preferenceData.speechiness + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher speechiness."
              }
              data.user.attributeWeight.speechinessWeight += 1;
            } 
            else if (feature == "popularity") {
              if (action == "increase"){
                // data.user.preferenceData.popularity += data.user.preferenceData.popularity
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&genreSeeds=' + seed_genres +'&min_popularity=' + data.user.preferenceData.popularity + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher popularity."
              }
              else if (action == "decrease"){
                // data.user.preferenceData.popularity -= data.user.preferenceData.popularity
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&genreSeeds=' + seed_genres +'&max_popularity=' + data.user.preferenceData.popularity + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of lower popularity."
              }
              else if (action==""){
                // data.user.preferenceData.popularity += data.user.preferenceData.popularity
                requestLink = '/getRecom?artistSeeds=' + seed_artists + '&trackSeeds=' + seed_tracks + '&genreSeeds=' + seed_genres +'&min_popularity=' + data.user.preferenceData.popularity + "&token=" + spotifyToken;
                explaination = "OK, I recommend this song to you, because you like the songs of higher popularity."
              }
              data.user.attributeWeight.popularityWeight += 1;
            } 
          }
        } else if (!intent){
          requestLink = ''
          isMissed = true
          // playRequestLink(requestLink)
        }
        
        //function playRequestLink (requestLink){
          if (requestLink) {
          //show loading animation
          var line = $('<div class="speak"><div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div></div>');
          chat.append(line);
          $.get(requestLink, function(res) {
            //remove loading animation
            $('.spinner').remove();
            console.log(res)
            playlist = res.tracks
            songIndex = 0
            speakandsing(response,true)
          })
        } else if(!requestLink && isMissed){
          if(numberOfMiss<2){
            numberOfMiss++;
            updateChat(robot, "Sorry, I do not understand. Can you rephrase the sentence?")
          }else{
            numberOfMiss = 0
            var random =  Math.random()
            if (random>=0 && random<0.3)
              updateChat(robot, "You can try to say 'I like fast songs' or 'I like pop music'")
            else if(random>=0.3 && random <0.6)
              updateChat(robot, "You can try to say 'Play a song for dancing' or 'I feel happy'")
            else if(random>=0.6 && random < 1)
              updateChat(robot, "You can try to say 'I need more energy' or 'I like Chinese songs'")
          }
        } else {
          if (!needReply)
            speakandsing("Ok, I found a song for you.", false)
        }
        //}
        

        function speakandsing(text,isUser) {
          updateChat(robot, text);
          if(listenedSongs.indexOf(playlist[songIndex].id)<0){
            listenedSongs.push(playlist[songIndex].id)
            setTimeout(function(){

              if(!isUser){
                if(playlist[songIndex].danceability>=data.user.preferenceData.danceabilityRange[0]&&playlist[songIndex].danceability<=data.user.preferenceData.danceabilityRange[1])
                  explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.danceabilityRange[2]+" danceability"
                else if(playlist[songIndex].energy>=data.user.preferenceData.energyRange[0]&&playlist[songIndex].energy<=data.user.preferenceData.energyRange[1])
                  explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.energyRange[2]+" energy"
                else if(playlist[songIndex].speechiness>=data.user.preferenceData.speechinessRange[0]&&playlist[songIndex].speechiness<=data.user.preferenceData.speechinessRange[1])
                  explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.speechinessRange[2]+" speechiness"
                else if(playlist[songIndex].tempo>=data.user.preferenceData.tempoRange[0]&&playlist[songIndex].tempo<=data.user.preferenceData.tempoRange[1])
                  explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.tempoRange[2]+" tempo"
                else if(playlist[songIndex].valence>=data.user.preferenceData.valenceRange[0]&&playlist[songIndex].valence<=data.user.preferenceData.valenceRange[1])
                  explaination = "We recommend this song because you like the songs of "+data.user.preferenceData.valenceRange[2]+" valence"
                else
                  explaination = "We recommend this song because you like music"
                
                if(playlist[songIndex].seedType == "artist")
                  explaination += ", and "+ playlist[songIndex].seed+"'s songs."
                else if(playlist[songIndex].seedType == "track")
                  explaination += ", and the songs "+ playlist[songIndex].seed+"."
                else if(playlist[songIndex].seedType == "genre")
                  explaination += ", and the songs of "+ playlist[songIndex].seed+"."
              }
                if(explaination!="")
                  updateChat(robot, explaination)
             
              }, 500)

            showCurrentSong2 = setTimeout(function(){
              showMusic(playlist[songIndex].id)
            },4000)

          }else{
            checkMusic()
          }
        }

        utterance.onend = function(event) {
          clearTimeout(timeoutResumeInfinity);
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

  });
})
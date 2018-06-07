request = require('request-promise')
express = require('express')
mongoose = require('mongoose')
app = express()

// Set the view engine in order to render UI
app.set('view engine', 'ejs');

// Declare location of static files
app.use(express.static(__dirname + '/views'));

// Object for storing data for display
function Entry(name=null, date, time, lat, long, discharge, depth, weather) {
  this.data = {"name":name, "date":date, "time":time, "lat":lat, "long":long, "discharge":discharge, "depth":depth, "weather":weather}
}

// Python for the win!
function range(i){
  return [...Array(i).keys()]
}


//Connect to MongoDB and begin server only after succesfully connected
const PORT = process.env.PORT || 3000
const URI = "mongodb://"+ process.env.USER_MLAB + ":" + process.env.PASSWORD_MLAB + "@ds053469.mlab.com:53469/wwtracker"

mongoose.connect(URI)

var db = mongoose.connection

// Check for errors
db.on("error",(err) => console.log(err))

// Begin server if database is succesfully opened
db.once("open",() => {

  // Begin server using express
  app.listen(PORT, () => {
    console.log('\nServer started! --> visit localhost:' + PORT + "\n")
  })

})





// Get USGS data
app.get('/usgs', (req, res) => {

  ids = req.query.ids

  request({
    //Get USGS data from USGS instantaneous value api
    "method": "GET",
    "uri": "https://waterservices.usgs.gov/nwis/iv/?format=json&indent=on&sites=" + ids + "&parameterCd=00060,00065&siteStatus=active",
    "json": true,
  }).then((data) => {

    console.log("DATA: ",data)

    entries = []//one entry in list per site requested

    //Process data retrieved form usgs api
    // Make an entry for each id in the query
    for (i = 0; i < ids.split(",").length; i++) {

      // Name
      name = data.value.timeSeries[i * 2].sourceInfo.siteName

      // Date/Time of data collection
      datetime = data.value.timeSeries[i * 2].values[0].value[0].dateTime
      date = datetime.split("T")[0]
      time = datetime.split("T")[1].split(".")[0]

      // Geospatial information
      lat = data.value.timeSeries[i * 2].sourceInfo.geoLocation.geogLocation.latitude
      long = data.value.timeSeries[i * 2].sourceInfo.geoLocation.geogLocation.longitude

      // Discharge
      discharge = data.value.timeSeries[i * 2].values[0].value[0].value

      // Depth --> data retrieved at same time just different timeseries
      depth = data.value.timeSeries[i * 2 + 1].values[0].value[0].value

      // Create Entry
      entry = new Entry(name, date, time, lat, long, discharge, depth, "eh")
      entries.push(entry)

    }

    return entries

  }).then((data)=> {

    // Get weather data based on usgs site lat/long
    //TODO: may be cool to include alerts
    promises = []
    for( i in range(data.length)){
      uri = "https://api.darksky.net/forecast/ad2ab1a25b1a0318391b04f1662de721/" + data[i].data["lat"] + "," + data[i].data["long"]

      promises.push(
        request({
          //Get USGS data from USGS instantaneous value api
          "method": "GET",
          "uri": uri,
          "json": true,
        })
      )
    }

    return Promise.all(promises)

  }).then((data) => {

    for( i=0; i<data.length; i++){
      entries[i].data["weather"] = data[i].currently.summary
    }

    res.render('index.ejs',{datas:entries})
  })

})

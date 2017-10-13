// https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false
/* global google */

function initialize() {

  // Create the map
  const map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 11,
    center: new google.maps.LatLng(37.76173100956567, -122.4386811010743)
  });

  window.map = map;

  const geocoder = new google.maps.Geocoder();

  let markers = 30;

  console.log('Loading Events...');

  fetch(new Request('https://api.apify.com/v1/execs/vq85wTaPKxsoGpYYz/results?format=json'))
    .then(response => response.json())
    .then(json => {

      console.log('Events loaded', json);

      (function addMarker(index) {
        let event = json[index];

        if (event.pageFunctionResult) {
          console.log(`Adding Event ${index}...`, event);
          geocoder.geocode({ address: event.pageFunctionResult.address }, (results, status) => {

            if (status != 'OK') {
              console.error(status, event);
              return;
            }

            new google.maps.Marker({
              map: map,
              position: results[0].geometry.location,
              title: event.pageFunctionResult.title,
              animation: google.maps.Animation.DROP
            });

            if (index < markers)
              addMarker(++index);  
          });
        } else {
          addMarker(++index);
        }
        
      })(0);

    });

}

// Initialize the map
google.maps.event.addDomListener(window, 'load', initialize);


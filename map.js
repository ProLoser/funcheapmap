/* global google */

// Initialize the map
google.maps.event.addDomListener(window, 'load', initialize);

function initialize() {

  // Create the map
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 11,
    center: new google.maps.LatLng(37.76173100956567, -122.4386811010743),
    disableDefaultUI: true,
    zoomControl: true
  });
  
  // Create the datastore
  window.events = new Events();
  
  // Bind infoWindow.close() shortcuts
  window.addEventListener('keyup', event => {
    switch (event.keyCode) {
      case 27: // esc
        Events.infoWindow().close();  
        break;  
    }
  });
  google.maps.event.addListener(window.map, 'click', function(event) {
      Events.infoWindow().close();
  });

  console.log('Loading Events...');
  window.events.load()
    .then(events => {
      events.forEach(event => {
        if (!event.title) return; // skip empty events just in case
        event.marker = new google.maps.Marker({
          map: window.map,
          position: event.geometry,
          title: event.title,
          animation: google.maps.Animation.DROP
        });
        event.marker.addListener('click', function () {
          Events.infoWindow(event).open(window.map, event.marker);
        });
      });

      // Apply URL filters
      let filters = {};
      if (document.location.search) {
        document.location.search.substr(1).split('&').forEach(param => {
          param = param.split('=');
          filters[decodeURIComponent(param[0])] = decodeURIComponent(param[1]);
        });
      }
    
      // Default to today's date
      if (!filters.date) {
        let date = new Date();
        var mm = date.getMonth() + 1;
        var dd = date.getDate();
        filters.date = `${date.getFullYear()}-${(mm>9 ? '' : '0') + mm}-${(dd>9 ? '' : '0') + dd}`;
      }
      window.filter(filters);
    });

}

let options = {};

/**
 * Callback for datepicker, filters all visible events to specified date and category
 * @param {object} filters
 * @param {string} [filters.date]
 * @param {string} [filters.category]
 */
window.filter = function (filters = {}) {
  Object.assign(options, filters);

  // Apply filters to DOM and URL
  let query = [];
  for (let option in options) {
    let element = document.getElementById(option);
    if (element)
      element.value = options[option];
    query.push(encodeURIComponent(option) + '=' + encodeURIComponent(options[option]));
  }
  window.history.replaceState({}, '', '?' + query.join('&'));

  let date;
  if (options.date) {
    date = options.date.replace(/-/gi, '/');
    date = new Date(date);
  }
    
  // Filter events
  let count = window.events.get().filter(event => {
    if (!event.title) return; // skip empty events
    event.visible = true;

    // check date
    if (date) {
      let eventDate = new Date(event.date);
      if (date.getFullYear() !== eventDate.getFullYear() ||
        date.getMonth() !== eventDate.getMonth() ||
        date.getDate() !== eventDate.getDate()
      )
        event.visible = false;
    }
    // check category
    if (options.category && !~event.categories.indexOf(options.category)) {
      event.visible = false;
    }

    event.marker.setVisible(event.visible);
    
    return event.visible;
  }).length;
  
  document.getElementById('count').innerText = count;
};


/**
 * Utility class for managing event data
 */
class Events {

  /**
   * Generates and returns a google maps info window
   * 
   * @param {object} [event] - If passed, sets the content
   * @returns {google.maps.InfoWindow}
   */
  static infoWindow(event) {
    if (!this.cachedInfoWindow)
      this.cachedInfoWindow = new google.maps.InfoWindow({});

    if (event) {
      const time = event.time.split(' to ')
      const start = new Date(`${event.date_text} ${time[0]}`)
      const startDate = start.toISOString().substr(0,10)
      let endToken
      if (time[1]) {
        if (time[1] > time[0]) { // same day
          endToken = `${startDate} ${time[1]}`
        } else { // overnight
          let endDate = new Date(start)
          endDate.setDate(endDate.getDate() + 1)
          endToken = `${endDate.toISOString().substr(0,10)} ${time[1]}`
        }
      } else { // default 1 hour duration
        endToken = start.getTime() + 60*60*1000
      }
      const end = new Date(endToken)
      const headerContent = document.createElement('div')
      headerContent.innerHTML = `
        <h2><a target="_blank" href="${event.url}" title="FunCheapSF Page">${event.title}</a></h2>
        <h3>
          <a target="_blank" href="https://maps.google.com/?q=${encodeURIComponent(event.venue)}&amp;ll=${event.geometry.lat},${event.geometry.lng}" title="Venue Details on Google Maps">${event.venue}</a>
          |
          <a target="_blank" href="${event.eventUrl}" title="Event Page">${event.cost}</a>
          <br>
          <span>${event.date_text}</span>
          |
          <span>${event.time}</span>
        </h3>
      `
      this.cachedInfoWindow.setHeaderContent(headerContent)
      this.cachedInfoWindow.setContent(`
        <div class="info-header">
          <p>
            ${event.cost_details}
          </p>
          <p>Categories: ${event.categories.map(category => `<a onclick="filter({category:'${category}'})">${category}</a>`).join('')}</p>
          <add-to-calendar-button
            name="${event.title.replaceAll('"',"'")}"
            description="${event.eventUrl}"
            startDate="${startDate}"
            startTime="${start.toTimeString().substr(0,5)}"
            endDate="${end.toISOString().substr(0,10)}"
            endTime="${end.toTimeString().substr(0,5)}"
            location="${event.venue}"
            timeZone="America/Los_Angeles"
            listStyle="modal"
            debug
          />
        </div>
        <div class="info-body">
          <input id="moreInfo" type="checkbox">
          <label for="moreInfo">+ Expand Details +</label>
          <div>
            <!-- event_series: ${event.event_series || ''} -->
            ${event.details||''}
          </div>
        </div>
      `);
    }

    return this.cachedInfoWindow;
  }

  /**
   * Loads event data from cache
   * 
   * @returns {object[]} events
   */
  get() {
    if (this.cache)
      return this.cache;
    
    this.cache = window.localStorage.getItem('events');

    if (this.cache)
      this.cache = JSON.parse(this.cache);
    
    return this.cache;
  }

  /**
   * Stores the event data to cache and adds a timestamp
   * 
   * @param {object[]} events 
   * @returns {object[]} events
   */
  set(events) {
    window.localStorage.setItem('events', JSON.stringify(events));
    window.localStorage.setItem('events_age', Date.now());
    this.cache = events;
    return this.cache;
  }

  /**
   * Returns the age of the cache
   * 
   * @returns {number} events_age - Timestamp
   */
  age() {
    return window.localStorage.getItem('events_age');
  }

  /**
   * Specifies if the age of the cache is old. Defaults to 24 hours
   * 
   * @param {number} [old=86400] - How long ago is considered old. Default: 24 hours
   * @returns {boolean} 
   */
  isFresh(old = 86400) {
    let age = this.age();
    return age && age > (Date.now() - old);
  }

  /**
   * Checks if the cache is old and updates it
   * 
   * @returns {Promise}
   */
  load() {
    if (this.isFresh()) {
      return Promise.resolve(this.get());
    } else {
      return this.query()
        .then(this.set.bind(this));
    }
  }

  /**
   * Queries the crawler API
   *
   * @returns {Promise}
   */
  query() {
    return fetch(new Request(Events.API))
      .then(response => response.json());
  }
}

Events.API = 'https://api.apify.com/v2/acts/apify~web-scraper/runs/last/dataset/items?token=apify_api_1U4gg8GRgTkFBjyfEkxKNtS9n4gUUw3wUjUV';

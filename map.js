/* global google ics angular */

// Initialize the map
google.maps.event.addDomListener(window, 'load', initialize);

function initialize() {

  // Create the map
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 11,
    center: new google.maps.LatLng(37.76173100956567, -122.4386811010743)
  });
  
  // Create the datastore
  window.events = new Events();

  

  console.log('Loading Events...');
  window.events.load()
    .then(events => {
      events.forEach(event => {
        event.marker = new google.maps.Marker({
          map: window.map,
          position: event.location,
          title: event.title,
          animation: google.maps.Animation.DROP
        });
        event.marker.addListener('click', function () {
          Events.infoWindow(event).open(window.map, event.marker);
        });
      });

      // Apply preloaded filters
      if (document.location.search) {
        let filters = {};
        document.location.search.substr(1).split('&').forEach(param => {
          param = param.split('=');
          filters[decodeURIComponent(param[0])] = decodeURIComponent(param[1]);
        });
        window.filter(filters);
      }
    });

}


angular.module('funcheapsf', [])
  .config(function ($locationProvider) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false
    });
  })
  .controller('controller', function ($scope, $location, $filter) {
    $scope.filters = {};
    $scope.events = window.events;
    $scope.filter = function () {
      let filters = angular.copy($scope.filters);
      if (filters.date)
        filters.date = $filter('date')(filters.date, 'shortDate');
      $location.search(filters);
      $location.replace();
      window.events.filter($scope.filters).forEach(event => {
        event.marker.setVisible(event.visible);
      });
    };
  });


let options = {};

/**
 * Callback for datepicker, filters all visible events to specified date
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
    
  window.events.get().forEach(event => {
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
  });
};

window.addEventListener('keyup', event => {
  switch (event.keyCode) {
    case 27: // esc
      Events.infoWindow().close();  
      break;  
  }
});

window.bookmark = function (url) {
  let event = window.events.get().find(event => event.url === url);
  event.bookmarked = !event.bookmarked;
};

window.exportBookmarked = function () {
  let events = window.events.get().filter(event => event.url === url);
  let cal = Events.calendarize(events);
  cal.download('FunCheapSF Event');
};

window.exportBookmarked = function () {
  let events = window.events.filter({ bookmarked: true });
  let cal = Events.calendarize(events);
  cal.download('FunCheapSF Bookmarked');
};

window.exportVisible = function () {
  let date;
  if (options.date) {
    date = options.date.replace(/-/gi, '/');
    date = new Date(date);
  }
  let events = window.events.filter({ date: date, category: options.category });
  let cal = Events.calendarize(events);
  cal.download('FunCheapSF Visible');
};

class Events {

  static calendarize(events) {
    let cal = ics();
    events.forEach(event => {
      cal.addEvent(event.title, event.summary, event.address, event.date, event.date);
    });
    return cal; // cal.download('filename');
  }

  /**
   * Generates and returns a google maps info window
   * 
   * @param {object} [event] - If passed, sets the content
   * @returns {google.maps.InfoWindow}
   */
  static infoWindow(event) {
    if (!this.cachedInfoWindow)
      this.cachedInfoWindow = new google.maps.InfoWindow({});

    if (event)
      this.cachedInfoWindow.setContent(`
        <div class="info-header">
          <h2><a href="${event.details}" target="_new">${event.title}</a></h2>
          <p>
            <strong>${event.date_text}</strong>
            - <strong>${event.time}</strong>
            at <strong>${event.venue}</strong>
            for <strong>${event.cost}</strong>
            <a onclick="bookmark('${event.url}')">[BOOKMARK]</a>
            <a onclick="exportEvent('${event.url}')">[EXPORT]</a>
          </p>
          <p><small>${event.cost_details}</small></p>
          <p>Categories: ${event.categories.map(category => `<a onclick="filter({category:'${category}'})">${category}</a>`).join(', ')}</p>
        </div>
        <div class="info-body">
          <input id="moreInfo" type="checkbox">
          <label for="moreInfo">More Info</label>
          <div>
            ${event.description||''}
            ${event.event_series || ''}
          </div>
        </div>
      `);

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
    
    return this.cache || [];
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

  filter(filters = {}) {
    return this.get().filter(event => {
      let matches = true;

      // check date
      if (filters.date) {
        let date = new Date(event.date);
        if (filters.date.getFullYear() !== date.getFullYear() ||
          filters.date.getMonth() !== date.getMonth() ||
          filters.date.getDate() !== date.getDate()
        )
          matches = false;
      }

      // check category
      if (filters.category && !~event.categories.indexOf(filters.category))
        matches = false;
      
      // check bookmarked
      if (filters.bookmarked && !event.bookmarked)
        matches = false;
      
      return matches;
    });
  }
}

Events.API = 'https://api.apify.com/v1/5ruPS4AXbEd9crJk7/crawlers/A8kHv2Fcvtqdeu8pv/lastExec/results?token=tKFdZqEmnys6ogqYmCu8vRkZJ&status=SUCCEEDED&simplified=1&skipFailedPages=1';

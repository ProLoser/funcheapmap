/* global google */

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
        new google.maps.Marker({
          map: window.map,
          position: event.location,
          title: event.title,
          animation: google.maps.Animation.DROP
        });
      });
    });

}

class Events {
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

Events.API = 'https://api.apify.com/v1/5ruPS4AXbEd9crJk7/crawlers/A8kHv2Fcvtqdeu8pv/lastExec/results?token=tKFdZqEmnys6ogqYmCu8vRkZJ&status=SUCCEEDED&simplified=1&skipFailedPages=1';

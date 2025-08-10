/* global google */

const intersectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('drop');
      intersectionObserver.unobserve(entry.target);
    }
  }
});

// Initialize the map
window.addEventListener('load', initialize)

async function initialize() {
  // Request needed libraries.
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
  // Create the map
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 12,
    center: new google.maps.LatLng(37.76173100956567, -122.4386811010743),
    disableDefaultUI: true,
    zoomControl: true,
    mapId: 'c46bf4bc0e87c92b'
  });
  
  // Create the datastore
  window.events = new Events();
  
  // Bind infoWindow.close() shortcuts
  document.getElementById('user-location-button').addEventListener('click', showUserLocation)
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
      let minDate, maxDate;

      events.forEach(event => {
        if (!event.title) return; // skip empty events just in case
        if (!event.geometry) console.error('Event Geometry Missing', { event });

        // Calculate min/max date
        if (event.date) {
          const eventDate = new Date(event.date);
          if (!minDate || eventDate < minDate) {
            minDate = eventDate;
          }
          if (!maxDate || eventDate > maxDate) {
            maxDate = eventDate;
          }
        }

        const pinElement = new PinElement();
        const content = pinElement.element;
        event.marker = new AdvancedMarkerElement({
          map: window.map,
          position: event.geometry,
          title: event.title,
          content: content,
        });

        content.style.opacity = '0';
        content.addEventListener('animationend', (event) => {
          content.classList.remove('drop');
          content.style.opacity = '1';
        });
        const time = Math.random(); // Random delay up to 1 second
        content.style.setProperty('--delay-time', time + 's');
        intersectionObserver.observe(content);

        event.marker.addListener('gmp-click', function () {
          Events.infoWindow(event).open(window.map, event.marker);
        });
      });

      // Update the date picker
      if (minDate && maxDate) {
        const dateInput = document.getElementById('date');
        dateInput.min = minDate.toLocaleDateString('fr-ca');
        dateInput.max = maxDate.toLocaleDateString('fr-ca');
      }

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

  let date;
  if (options.date) {
    date = options.date.replace(/-/gi, '/');
    date = new Date(date);
  }

  let categories = [];
  if (options.category) {
    categories = options.category.split(',')
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
    if (categories.length && !event.categories.some(category => categories.includes(category))) {
      event.visible = false;
    }

    if (!event.visible) {
      intersectionObserver.observe(event.marker.content);
      event.marker.content.style.opacity = '0';
    }
    event.marker.content.style.display = event.visible ? 'block' : 'none';
    
    return event.visible;
  }).length;
  
  // Apply filters to DOM and URL
  let query = [];
  for (let option in options) {
    let element = document.getElementById(option);
    if (element) {
      if (element.type === 'select-multiple') {
        const selected = options[option].split(',');
        for (const option of element.options) {
          option.selected = selected.includes(option.value)
        }
        setTimeout(() => {
          element.querySelector('option:checked')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
        query.push(encodeURIComponent(option) + '=' + categories.map(category => encodeURIComponent(category)).join(','));
      } else {
        element.value = options[option];
        query.push(encodeURIComponent(option) + '=' + encodeURIComponent(options[option]));
      }
    }
  }
  window.history.replaceState({}, '', '?' + query.join('&'));
  document.getElementById('count').innerText = count;
};

/**
 * Gets the user's location and displays it on the map
 */
function showUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        map.setCenter(pos);
        map.setZoom(15);

        new google.maps.Marker({
          position: pos,
          map: window.map,
          title: "Your Location",
          icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        });
      },
      () => {
        alert('Error: The Geolocation service failed.');
      }
    );
  } else {
    // Browser doesn't support Geolocation
    alert("Error: Your browser doesn't support geolocation.");
  }
}


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
      const startDate = start.toLocaleDateString('sv-SE') // outputs yyyy-mm-dd
      let endToken
      if (time[1]) {
        // Is event overnight?
        if (time[1].substr(-2) == 'am' && time[0].substr(-2) == 'pm') {
          let endDate = new Date(start)
          endDate.setDate(endDate.getDate() + 1)
          endToken = `${endDate.toLocaleDateString('sv-SE').replace(/-/gi, '/')} ${time[1]}`
        } else { // same day
          endToken = `${startDate.replace(/-/gi, '/')} ${time[1]}`
        }
      } else { // default 1 hour duration
        endToken = start.getTime() + 60*60*1000
      }
      const end = new Date(endToken)
      const headerContent = document.createElement('div')
      headerContent.innerHTML = `
        <h2><a target="_blank" href="${event.url}" title="FunCheapSF Page">${event.title}</a></h2>
        <add-to-calendar-button
            name="${event.title.replaceAll('"',"'")}"
            description="${event.eventUrl}"
            startDate="${startDate}"
            options="'Apple','Google','iCal','Outlook.com'"
            startTime="${start.toTimeString().substr(0,5)}"
            endDate="${end.toLocaleDateString('sv-SE')}"
            endTime="${end.toTimeString().substr(0,5)}"
            location="${event.venue}"
            listStyle="modal"
            buttonStyle="default"
            timeZone="America/Los_Angeles"
            size="4"
            hideTextLabelButton
            hideCheckmark
            debug
        ></add-to-calendar-button>
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

      const content = document.createElement('div')
      content.innerHTML = `
        <div class="info-header">
          <p>
            ${event.cost_details}
          </p>
          <p class="categories">Categories: ${event.categories.map(category => `<a onclick="filter({category:'${category}'})">${category}</a>`).join('')}</p>
        </div>
        <div class="info-body">
          <input id="moreInfo" type="checkbox" onchange=>
          <label for="moreInfo">+ Expand Details +</label>
          <div id="details">
            ${event.details}
          </div>
        </div>
      `
      // Reposition after expanding
      content.querySelector('input').addEventListener('change', () => {
        this.cachedInfoWindow.open(window.map, event.marker);
      })
      this.cachedInfoWindow.setContent(content);
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
    try {
      // Known to throw QuotaExceededException on Safari
      window.localStorage.setItem('events', JSON.stringify(events));
      window.localStorage.setItem('events_age', Date.now());
    } catch (e) {
      console.error(e)
    }
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

Events.API = 'https://api.apify.com/v2/acts/apify~cheerio-scraper/runs/last/dataset/items?token=apify_api_1U4gg8GRgTkFBjyfEkxKNtS9n4gUUw3wUjUV';

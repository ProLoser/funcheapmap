/* global google */
const intersectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('drop');
      intersectionObserver.unobserve(entry.target);
    }
  }
});

// Global variable to track user location marker
let userLocationMarker = null;

// Initialize the map
// window.addEventListener('load', initialize)
async function initialize() {
  // Check if we're using the new API loading method
  let AdvancedMarkerElement, PinElement;
  
  if (google.maps.importLibrary) {
    // New API loading method
    const { Map } = await google.maps.importLibrary("maps");
    const markerLibrary = await google.maps.importLibrary("marker");
    AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
    PinElement = markerLibrary.PinElement;
  } else {
    // Legacy API - AdvancedMarkerElement should be available globally
    AdvancedMarkerElement = google.maps.marker?.AdvancedMarkerElement || google.maps.AdvancedMarkerElement;
    PinElement = google.maps.marker?.PinElement || google.maps.PinElement;
    
    // Fallback to regular Marker if AdvancedMarkerElement is not available
    if (!AdvancedMarkerElement) {
      console.warn('AdvancedMarkerElement not available, falling back to legacy Marker');
    }
  }
  // Create the map
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 12,
    center: new google.maps.LatLng(37.76173100956567, -122.4386811010743),
    disableDefaultUI: true,
    zoomControl: true,
    fullscreenControl: true,
    mapId: 'c46bf4bc0e87c92b'
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

  // Add "You Are Here" button
  if (navigator.geolocation) {
    const locationButton = document.createElement("button");
    locationButton.classList.add("ui-button");
    locationButton.id = "myLocation";
    locationButton.title = "My Location";
    locationButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"></path>
    </svg>`;
    locationButton.addEventListener("click", showUserLocation);
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);
  }

  console.log('Loading Events...');
  window.events.load()
    .then(events => {
      let minDate, maxDate, categories = new Set();
      events.forEach(event => {
        if (!event.title) return console.warn('Event Title Missing', { event });
        if (!event.geometry) return console.warn('Event Geometry Missing', { event });
        // Add categories to the set
        if (event.categories) {
          event.categories.forEach(category => !category.includes('Weekend Events Guide') && categories.add(category));
        }
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
        // Create marker - use AdvancedMarkerElement if available, otherwise fall back to legacy Marker
        if (AdvancedMarkerElement && PinElement) {
          const pinElement = new PinElement();
          const content = pinElement.element;
          event.marker = new AdvancedMarkerElement({
            map: window.map,
            position: event.geometry,
            title: event.title,
            content: content,
          });
        } else {
          // Fallback to legacy Marker
          event.marker = new google.maps.Marker({
            map: window.map,
            position: event.geometry,
            title: event.title,
          });
        }
        // Animation setup (only for AdvancedMarkerElement)
        if (AdvancedMarkerElement && PinElement) {
          const content = event.marker.content;
          content.style.opacity = '0';
          const time = Math.random(); // Random delay between 0 and 1 second
          content.style.setProperty('--delay-time', time + 's');
          intersectionObserver.observe(content);
          event.marker.addListener('gmp-click', function () {
            Events.infoWindow(event).open(window.map, event.marker);
          });
        } else {
          event.marker.addListener('click', function () {
            Events.infoWindow(event).open(window.map, event.marker);
          });
        }
      });
      const form = document.getElementById('controls');
      form.addEventListener('reset', window.filter);
      map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(form);
      map.controls[google.maps.ControlPosition.LEFT_TOP].push(document.getElementById('feedback'));
      // Update the date picker
      if (minDate && maxDate) {
        form.elements['date'].min = minDate.toLocaleDateString('fr-ca');
        form.elements['date'].max = maxDate.toLocaleDateString('fr-ca');
      }
      // Update the category select
      form.elements['category'].innerHTML = Array.from(categories).sort().map(category => 
        `<option value="${category}">${category.replace(/\*/g,'')}</option>`
      ).join('');
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
  if (options.date && options.date !== '') {
    date = options.date.replace(/-/gi, '/');
    date = new Date(date);
  }
  let categories = [];
  if (options.category) {
    categories = options.category.split(',')
  }
    
  // Filter events
  let count = window.events.get()?.filter(event => {
    if (!event.title || !event.geometry) return; // skip corrupt events
    event.visible = true;
    // check date
    if (date) {
      if (!event.date) {
        // If filtering by date but event has no date, hide it
        event.visible = false;
      } else {
        let eventDate = new Date(event.date);
        // Make sure the date is valid
        if (isNaN(eventDate.getTime())) {
          event.visible = false;
        } else if (date.getFullYear() !== eventDate.getFullYear() ||
          date.getMonth() !== eventDate.getMonth() ||
          date.getDate() !== eventDate.getDate()
        ) {
          event.visible = false;
        }
      }
    }
    // check category
    if (categories.length && !event.categories.some(category => categories.includes(category))) {
      event.visible = false;
    }
    
    // Update marker visibility
    if (event.marker) {
      if (event.marker.content) {
        // AdvancedMarkerElement - use map property to show/hide
        event.marker.map = event.visible ? window.map : null;
        // Reset animation for visible markers
        if (event.visible && event.marker.content.style.opacity === '0') {
          intersectionObserver.observe(event.marker.content);
        }
      } else {
        // Legacy marker - use setVisible method
        event.marker.setVisible(event.visible);
      }
    }
    
    return event.visible;
  }).length;
  
  // Apply filters to DOM and URL
  const query = [], 
    form = document.getElementById('controls');

  for (let option in options) {
    let element = form.elements[option];
    if (element) {
      if (element.type === 'select-multiple') {
        const selected = options[option].split(',');
        for (const option of element.options) {
          option.selected = selected.includes(option.value)
        }
        setTimeout(element => {
          element.querySelector('option:checked')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200, element);
        query.push(encodeURIComponent(option) + '=' + categories.map(category => encodeURIComponent(category)).join(','));
      } else {
        element.value = options[option];
        query.push(encodeURIComponent(option) + '=' + encodeURIComponent(options[option]));
      }
    }
  }
  window.history.replaceState({}, '', '?' + query.join('&'));
  form.elements['countEvents'].innerText = count;
  form.elements['countCategories'].innerText = categories.length || 'All';
};

/**
 * Gets the user's location and displays it on the map
 */
window.showUserLocation = async function () {
  if (navigator.geolocation) {
    // Check if we need to import libraries or if they're globally available
    let AdvancedMarkerElement, PinElement;
    
    if (google.maps.importLibrary) {
      // New API loading method
      const markerLibrary = await google.maps.importLibrary("marker");
      AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
      PinElement = markerLibrary.PinElement;
    } else {
      // Legacy API
      AdvancedMarkerElement = google.maps.marker?.AdvancedMarkerElement || google.maps.AdvancedMarkerElement;
      PinElement = google.maps.marker?.PinElement || google.maps.PinElement;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setCenter(pos);
        map.setZoom(15);
        
        // Create user location marker
        if (!userLocationMarker) {
          if (AdvancedMarkerElement && PinElement) {
            // Use AdvancedMarkerElement with custom blue pin
            const userPinElement = new PinElement({
              background: "#4285F4",
              borderColor: "#ffffff",
              glyphColor: "#ffffff",
              scale: 1.2
            });
            
            userLocationMarker = new AdvancedMarkerElement({
              map: window.map,
              position: pos,
              title: "Your Location",
              content: userPinElement.element,
            });
          } else {
            // Fallback to legacy Marker
            userLocationMarker = new google.maps.Marker({
              position: pos,
              map: window.map,
              title: "Your Location",
              icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            });
          }
        }
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
  static API_TOKEN = '__APIFY_TOKEN__';
  static API = `https://api.apify.com/v2/acts/apify~cheerio-scraper/runs/last/dataset/items?clean=true&token=${Events.API_TOKEN}`;
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
            forceOverlay
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
      .then(response => {
        if (!response.ok) {
          const error = new Error(`Events Query Failed! ${response.status}`);
          error.response = response;
          throw error;
        }
        return response.json();
      });
  }
}

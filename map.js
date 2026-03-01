/* global google */
// Delimiter for multiple category selections (must not appear in category names and not require URI encoding)
const CATEGORY_DELIMITER = '~';

/**
 * Maps category names to PinElement color options.
 * First matching category in an event's category list wins.
 */
const CATEGORY_COLORS = {
  '*Top Pick*': { background: '#FBBC04', borderColor: '#EA8600', glyphColor: '#000000' },
  'Live Music':            { background: '#9334E6', borderColor: '#7B1FA2', glyphColor: '#ffffff' },
  'Club / DJ':             { background: '#9334E6', borderColor: '#7B1FA2', glyphColor: '#ffffff' },
  'Art & Museums':         { background: '#1A73E8', borderColor: '#185ABC', glyphColor: '#ffffff' },
  'Theater & Performance': { background: '#1A73E8', borderColor: '#185ABC', glyphColor: '#ffffff' },
  'Movies':                { background: '#1A73E8', borderColor: '#185ABC', glyphColor: '#ffffff' },
  'Literature':            { background: '#1A73E8', borderColor: '#185ABC', glyphColor: '#ffffff' },
  'Fairs & Festivals':     { background: '#E91E63', borderColor: '#C2185B', glyphColor: '#ffffff' },
  'Outdoors':              { background: '#007B83', borderColor: '#005F64', glyphColor: '#ffffff' },
  'Walks & Tours':         { background: '#007B83', borderColor: '#005F64', glyphColor: '#ffffff' },
  'Sports & Wellness':     { background: '#007B83', borderColor: '#005F64', glyphColor: '#ffffff' },
  'Kids & Families':       { background: '#FA7B17', borderColor: '#D56E0C', glyphColor: '#ffffff' },
  'Comedy':                { background: '#FA7B17', borderColor: '#D56E0C', glyphColor: '#ffffff' },
  'Eating & Drinking':     { background: '#FA7B17', borderColor: '#D56E0C', glyphColor: '#ffffff' },
  'LGBTQ+':                { background: '#E040FB', borderColor: '#A100BA', glyphColor: '#ffffff' },
  'Geek Event':            { background: '#24C1E0', borderColor: '#098591', glyphColor: '#ffffff' },
  'Lectures & Workshops':  { background: '#24C1E0', borderColor: '#098591', glyphColor: '#ffffff' },
};

/**
 * Returns PinElement constructor options based on event category, then cost.
 * Category colors take priority; free events get green when no category matches;
 * everything else falls back to the default Google Maps red pin.
 * @param {object} event
 * @returns {object} PinElement options
 */
function getMarkerPinOptions(event) {
  if (event.categories) {
    for (const category of event.categories) {
      if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
    }
  }
  if (event.cost && /free/i.test(event.cost)) {
    return { background: '#34A853', borderColor: '#137333', glyphColor: '#ffffff' };
  }
  return {};
}

/**
 * Returns the computed end Date for an event, or null if it cannot be determined.
 * @param {object} event
 * @returns {Date|null}
 */
function getEventEndTime(event) {
  if (!event.date_text || !event.time) return null;
  const time = event.time.split(' to ');
  const start = new Date(`${event.date_text} ${time[0]}`);
  if (isNaN(start.getTime())) return null;
  const startDateStr = start.toLocaleDateString('sv-SE').replace(/-/gi, '/');
  let endToken;
  if (time[1]) {
    if (time[1].slice(-2) === 'am' && time[0].slice(-2) === 'pm') {
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 1);
      endToken = `${endDate.toLocaleDateString('sv-SE').replace(/-/gi, '/')} ${time[1]}`;
    } else {
      endToken = `${startDateStr} ${time[1]}`;
    }
  } else {
    return new Date(start.getTime() + 60 * 60 * 1000);
  }
  const end = new Date(endToken);
  return isNaN(end.getTime()) ? null : end;
}

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

// Global variable to track cluster markers
let clusterMarkers = [];

// Initialize the map
// window.addEventListener('load', initialize)
async function initialize() {
  // Load required libraries
  const { Map } = await google.maps.importLibrary("maps");
  const markerLibrary = await google.maps.importLibrary("marker");
  const AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
  const PinElement = markerLibrary.PinElement;
  // Create the map
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 12,
    center: new google.maps.LatLng(37.76173100956567, -122.4386811010743),
    disableDefaultUI: true,
    zoomControl: true,
    // fullscreenControl: true,
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
        // Create marker
        const pinElement = new PinElement(getMarkerPinOptions(event));
        const content = pinElement.element;
        event.marker = new AdvancedMarkerElement({
          map: window.map,
          position: event.geometry,
          title: event.title,
          content: content,
        });
        
        // Animation setup
        content.style.opacity = '0';
        const time = Math.random(); // Random delay between 0 and 1 second
        content.style.setProperty('--delay-time', time + 's');
        intersectionObserver.observe(content);
        event.marker.addListener('gmp-click', function () {
          Events.infoWindow(event).open(window.map, event.marker);
        });
      });
      const form = document.getElementById('controls');
      form.addEventListener('reset', window.filter);
      map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(form);
      map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(document.getElementById('feedback'));
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
window.filter = async function (filters = {}) {
  Object.assign(options, filters);
  let date;
  if (options.date && options.date !== '') {
    date = options.date.replace(/-/gi, '/');
    date = new Date(date);
  }
  const today = new Date();
  const isViewingToday = date &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  let categories = [];
  if (options.category) {
    categories = options.category.split(CATEGORY_DELIMITER)
  }
    
  // Clear existing cluster markers
  clusterMarkers.forEach(marker => {
    marker.map = null;
  });
  clusterMarkers = [];
    
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
    
    return event.visible;
  }).length;
  
  // Group visible events by location for clustering
  // First, hide all markers
  window.events.get()?.forEach(event => {
    if (!event.title || !event.geometry) return;
    if (event.marker) {
      event.marker.map = null;
    }
  });
  
  // Group visible events by location
  const locationGroups = new Map();
  
  window.events.get()?.forEach(event => {
    if (!event.title || !event.geometry || !event.visible) return;
    
    // Create location key with rounded coordinates (to handle minor differences)
    const locationKey = `${event.geometry.lat.toFixed(6)},${event.geometry.lng.toFixed(6)}`;
    
    if (!locationGroups.has(locationKey)) {
      locationGroups.set(locationKey, []);
    }
    locationGroups.get(locationKey).push(event);
  });
  
  // Load marker library
  const markerLibrary = await google.maps.importLibrary("marker");
  const AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
  const PinElement = markerLibrary.PinElement;
  
  // Create markers based on grouping
  locationGroups.forEach((eventsAtLocation, locationKey) => {
    if (eventsAtLocation.length === 1) {
      // Single event - show normal marker
      const event = eventsAtLocation[0];
      if (event.marker) {
        event.marker.map = window.map;
        if (event.marker.content.style.opacity === '0') {
          intersectionObserver.observe(event.marker.content);
        }
        const eventEnd = getEventEndTime(event);
        if (isViewingToday && eventEnd && eventEnd < today) {
          event.marker.content.classList.add('ended');
        } else {
          event.marker.content.classList.remove('ended');
        }
      }
    } else {
      // Multiple events at same location - create cluster marker
      // Hide individual markers
      eventsAtLocation.forEach(event => {
        if (event.marker) {
          event.marker.map = null;
        }
      });
      
      // Create cluster marker
      const position = eventsAtLocation[0].geometry;
      const clusterCount = eventsAtLocation.length;
      
      // Create custom cluster pin with count
      const clusterPin = new PinElement({
        background: "#EA4335",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2,
        glyph: clusterCount.toString()
      });
      
      const clusterMarker = new AdvancedMarkerElement({
        map: window.map,
        position: position,
        title: `${clusterCount} events at ${eventsAtLocation[0].venue}`,
        content: clusterPin.element,
      });
      
      clusterMarker.addListener('gmp-click', function () {
        showClusterInfo(eventsAtLocation, clusterMarker);
      });
      
      clusterMarkers.push(clusterMarker);
    }
  });
  
  // Apply filters to DOM and URL
  const query = [], 
    form = document.getElementById('controls');

  for (let option in options) {
    let element = form.elements[option];
    if (element) {
      if (element.type === 'select-multiple') {
        const selected = options[option].split(CATEGORY_DELIMITER);
        for (const option of element.options) {
          option.selected = selected.includes(option.value)
        }
        setTimeout(element => {
          element.querySelector('option:checked')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200, element);
        query.push(encodeURIComponent(option) + '=' + categories.map(category => encodeURIComponent(category)).join(CATEGORY_DELIMITER));
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
 * Shows info window with multiple events
 * @param {Array} events - Array of events at the same location
 * @param {object} marker - The cluster marker
 */
function showClusterInfo(events, marker) {
  const infoWindow = Events.infoWindow();
  
  // Check if date filter is active
  const dateSelected = options.date && options.date !== '';
  
  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => {
    // Extract start time from time string (e.g., "7:00 pm to 9:00 pm")
    const getStartTime = (event) => {
      const timeStr = event.time.split(' to ')[0];
      const date = new Date(`${event.date_text} ${timeStr}`);
      return date.getTime();
    };
    
    return getStartTime(a) - getStartTime(b);
  });
  
  // Create header
  const headerContent = document.createElement('div');
  const firstEvent = sortedEvents[0];
  headerContent.innerHTML = `
    <h2>${sortedEvents.length} Events at <a target="_blank" href="https://maps.google.com/?q=${encodeURIComponent(firstEvent.venue)}&ll=${firstEvent.geometry.lat},${firstEvent.geometry.lng}" title="Venue Details on Google Maps">${firstEvent.venue}</a></h2>
  `;
  infoWindow.setHeaderContent(headerContent);
  
  // Create content with list of events
  const content = document.createElement('div');
  content.className = 'cluster-info';
  content.innerHTML = `
    <div class="cluster-events">
      ${sortedEvents.map((event, index) => `
        <div class="cluster-event" data-event-index="${index}">
          <h3>${event.title}</h3>
          <p>
            <strong>${!dateSelected ? event.date_text + ' | ' : ''}${event.time}</strong> | ${event.cost}
          </p>
        </div>
      `).join('<hr>')}
    </div>
  `;
  
  // Add click listeners to each row
  content.querySelectorAll('.cluster-event').forEach((row, index) => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      viewEventDetails(index, true, marker);
    });
  });
  
  infoWindow.setContent(content);
  infoWindow.open(window.map, marker);
  
  // Store sorted events for detail viewing
  window.clusterEvents = sortedEvents;
}

/**
 * Shows detailed info for a specific event from a cluster
 * @param {number} eventIndex - Index of the event in the cluster
 */
window.viewEventDetails = function(eventIndex) {
  if (window.clusterEvents?.[eventIndex]) {
    Events.infoWindow(window.clusterEvents[eventIndex], true);
  }
};

/**
 * Gets the user's location and displays it on the map
 */
window.showUserLocation = async function () {
  if (navigator.geolocation) {
    // Load marker library
    const markerLibrary = await google.maps.importLibrary("marker");
    const AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
    const PinElement = markerLibrary.PinElement;
    
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
   * @param {boolean} [expanded]
   * @returns {google.maps.InfoWindow}
   */
  static infoWindow(event, expanded = false) {
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
          <p class="categories">Categories: ${event.categories.map(category => `<a onclick="filter({category:'${category}'})">${category}</a>`).join(', ')}</p>
        </div>
        <div class="info-body">
          <details ${expanded ? 'open' : ''}>
            <summary>Expand Details</summary>
            <div id="details">
              ${event.details}
            </div>
          </details>
        </div>
      `
      // Reposition after expanding
      content.querySelector('details').addEventListener('toggle', () => {
        const { lat, lng } = this.cachedInfoWindow.getPosition();
        window.map.panTo({ lat: lat() + 0.03, lng: lng()});
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

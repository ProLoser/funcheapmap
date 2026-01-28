/* global google */
// Delimiter for multiple category selections (must not appear in category names and not require URI encoding)
const CATEGORY_DELIMITER = '~';

// Venue geocoding data - best guess coordinates for major cities and venues
const VENUE_GEOCODING = {
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'San Francisco, CA': { lat: 37.7749, lng: -122.4194 },
  'Washington, DC': { lat: 38.9072, lng: -77.0369 },
  'Fairfax, VA': { lat: 38.8462, lng: -77.3064 },
  'Frederick, MD': { lat: 39.4143, lng: -77.4105 },
  'Richmond, VA': { lat: 37.5407, lng: -77.4360 },
  'Baltimore, MD': { lat: 39.2904, lng: -76.6122 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'Los Angeles, CA': { lat: 34.0522, lng: -118.2437 },
  'Seattle, WA': { lat: 47.6062, lng: -122.3321 },
  'Miami': { lat: 25.7617, lng: -80.1918 },
  'Miami, FL': { lat: 25.7617, lng: -80.1918 },
  'Hollywood, FL': { lat: 26.0112, lng: -80.1495 },
  'Fort Lauderdale, FL': { lat: 26.1224, lng: -80.1373 },
  'West Palm Beach, FL': { lat: 26.7153, lng: -80.0534 },
  'Miami Beach, FL': { lat: 25.7907, lng: -80.1300 },
  'Miami Beach': { lat: 25.7907, lng: -80.1300 },
  'Oakland': { lat: 37.8044, lng: -122.2712 },
  'Oakland, CA': { lat: 37.8044, lng: -122.2712 },
  'Berkeley': { lat: 37.8715, lng: -122.2730 },
  'Berkeley, CA': { lat: 37.8715, lng: -122.2730 },
  'San Jose': { lat: 37.3382, lng: -121.8863 },
  'San Jose, CA': { lat: 37.3382, lng: -121.8863 },
  'Long Beach': { lat: 33.7701, lng: -118.1937 },
  'Long Beach, CA': { lat: 33.7701, lng: -118.1937 },
  'San Diego': { lat: 32.7157, lng: -117.1611 },
  'San Diego, CA': { lat: 32.7157, lng: -117.1611 },
  'Santa Ana': { lat: 33.7455, lng: -117.8677 },
  'Santa Ana, CA': { lat: 33.7455, lng: -117.8677 },
  'Van Nuys': { lat: 34.1900, lng: -118.4514 },
  'Van Nuys, CA': { lat: 34.1900, lng: -118.4514 },
  'Davis': { lat: 38.5449, lng: -121.7405 },
  'Davis, CA': { lat: 38.5449, lng: -121.7405 },
  'Santa Rosa': { lat: 38.4404, lng: -122.7141 },
  'Santa Rosa, CA': { lat: 38.4404, lng: -122.7141 },
  'El Centro': { lat: 32.7920, lng: -115.5630 },
  'El Centro, CA': { lat: 32.7920, lng: -115.5630 }
};

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Parse CSV text and return array of rows
 */
function parseCSV(csvText) {
  const rows = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const values = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"' && nextChar === '"') {
        currentValue += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue); // Add last value
    rows.push(values);
  }
  
  return rows;
}

/**
 * Extract city from venue string (e.g., "Venue Name (City, State)" -> "City, State")
 */
function extractCity(venueString) {
  const match = venueString.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
}

/**
 * Get coordinates for a venue based on city
 */
function getVenueCoordinates(venueString) {
  const city = extractCity(venueString);
  if (!city) return null;
  
  // Try exact match first
  if (VENUE_GEOCODING[city]) {
    return VENUE_GEOCODING[city];
  }
  
  // Try matching just the city name (before comma)
  const cityName = city.split(',')[0].trim();
  for (const [key, coords] of Object.entries(VENUE_GEOCODING)) {
    if (key.startsWith(cityName)) {
      return coords;
    }
  }
  
  // Default to San Francisco if no match found
  console.warn(`No geocoding data for: ${city}, using default coordinates`);
  return VENUE_GEOCODING['San Francisco'];
}

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelDateToJSDate(serialDate) {
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  return new Date(excelEpoch.getTime() + serialDate * msPerDay);
}

/**
 * Load and parse a CSV file from 19hz folder
 */
async function load19hzCSV(filename) {
  try {
    const response = await fetch(`19hz/${filename}`);
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
    return rows.map(row => {
      if (row.length < 11) return null;
      
      const [dateText, title, genre, venue, time, cost, ageRestriction, artists, url, url2, serialDate] = row;
      
      // Parse the date
      const date = serialDate ? excelDateToJSDate(parseFloat(serialDate)) : null;
      
      // Get coordinates
      const geometry = getVenueCoordinates(venue);
      
      return {
        title: title,
        venue: venue,
        geometry: geometry,
        date: date ? date.toISOString().split('T')[0] : null,
        date_text: dateText,
        time: time,
        cost: cost,
        cost_details: cost,
        categories: genre && genre.trim() ? genre.split(',').map(g => g.trim()).filter(g => g) : ['19hz'],
        details: `<p><strong>Genre:</strong> ${escapeHtml(genre || 'N/A')}</p>
                  <p><strong>Age:</strong> ${escapeHtml(ageRestriction || 'N/A')}</p>
                  ${artists ? `<p><strong>Artists:</strong> ${escapeHtml(artists)}</p>` : ''}`,
        url: url,
        eventUrl: url,
        source: '19hz'
      };
    }).filter(event => event !== null && event.title && event.geometry && event.geometry.lat && event.geometry.lng);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return [];
  }
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
  // Create the map - centered on North America
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 4,
    center: new google.maps.LatLng(39.8283, -98.5795),
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
        const pinElement = new PinElement();
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
          <p class="categories">Categories: ${event.categories.map(category => `<a onclick="filter({category:'${category}'})">${category}</a>`).join('')}</p>
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
   * Queries the FuncheapSF crawler API and loads 19hz CSV files
   *
   * @returns {Promise<Array>} Promise that resolves to an array of event objects from both sources
   */
  async query() {
    // Load FuncheapSF events from API
    const funcheapsfPromise = fetch(new Request(Events.API))
      .then(response => {
        if (!response.ok) {
          console.warn(`FuncheapSF Query Failed! ${response.status}`);
          return [];
        }
        return response.json();
      })
      .catch(error => {
        console.error('Error loading FuncheapSF events:', error);
        return [];
      });
    
    // Load 19hz CSV files
    const csvFiles = ['events_BayArea.csv', 'events_DC.csv', 'events_LosAngeles.csv', 'events_Miami.csv', 'events_Seattle.csv'];
    const csvPromises = csvFiles.map(file => load19hzCSV(file));
    
    // Wait for all data to load
    const [funcheapsfEvents, ...csvEventsArrays] = await Promise.all([funcheapsfPromise, ...csvPromises]);
    
    // Merge all events
    const csvEvents = csvEventsArrays.flat();
    const allEvents = [...funcheapsfEvents, ...csvEvents];
    
    console.log(`Loaded ${funcheapsfEvents.length} FuncheapSF events and ${csvEvents.length} 19hz events`);
    
    return allEvents;
  }
}

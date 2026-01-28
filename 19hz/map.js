/* global google */
// Delimiter for multiple category selections (must not appear in category names and not require URI encoding)
const CATEGORY_DELIMITER = '~';

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
async function initialize() {
  // Load required libraries
  const { Map } = await google.maps.importLibrary("maps");
  const markerLibrary = await google.maps.importLibrary("marker");
  const AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
  const PinElement = markerLibrary.PinElement;
  // Create the map - centered on North America
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 4,
    center: new google.maps.LatLng(39.8283, -98.5795), // Center of USA
    disableDefaultUI: true,
    zoomControl: true,
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
      let minDate, maxDate, categories = new Set(), regions = new Set();
      events.forEach(event => {
        if (!event.title) return console.warn('Event Title Missing', { event });
        if (!event.geometry) return console.warn('Event Geometry Missing', { event });
        // Add categories to the set
        if (event.categories) {
          event.categories.forEach(category => categories.add(category));
        }
        // Add region to the set
        if (event.region) {
          regions.add(event.region);
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
      // Update the region select
      if (regions.size > 1) {
        form.elements['region'].innerHTML = '<option value="">All Regions</option>' + 
          Array.from(regions).sort().map(region => 
            `<option value="${region}">${region}</option>`
          ).join('');
      }
      // Update the category select
      form.elements['category'].innerHTML = Array.from(categories).sort().map(category => 
        `<option value="${category}">${category}</option>`
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
 * @param {string} [filters.region]
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
  let selectedRegion = options.region || '';
    
  // Clear existing cluster markers
  clusterMarkers.forEach(marker => {
    marker.map = null;
  });
  clusterMarkers = [];
    
  // Filter events
  let count = window.events.get()?.filter(event => {
    if (!event.title || !event.geometry) return; // skip corrupt events
    event.visible = true;
    // check region
    if (selectedRegion && event.region !== selectedRegion) {
      event.visible = false;
    }
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
      const timeStr = event.time.split('-')[0].trim();
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
  static REGIONS_URL = 'regions.json';
  static DEFAULT_VENUES_URL = 'venues.json';
  
  /**
   * Normalizes venue name for matching
   * @param {string} venueName - Raw venue name from CSV
   * @returns {string} Normalized venue name
   */
  static normalizeVenueName(venueName) {
    // Extract venue name from "Venue Name (City)" format
    const match = venueName.match(/^(.+?)\s*\(/);
    const baseName = match ? match[1] : venueName;
    
    // Normalize: lowercase, remove extra spaces, hyphens, special chars
    return baseName
      .toLowerCase()
      .replace(/[-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Parses CSV date format "Tue: Jan 27" to ISO date
   * @param {string} dateStr - Date string from CSV
   * @returns {string} ISO date string (YYYY-MM-DD)
   */
  static parseCSVDate(dateStr) {
    // Extract month and day from "Tue: Jan 27" format
    const parts = dateStr.split(':');
    if (parts.length < 2) return null;
    
    const datePart = parts[1].trim();
    const [monthStr, dayStr] = datePart.split(' ');
    
    const months = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const month = months[monthStr];
    const day = parseInt(dayStr);
    
    if (month === undefined || isNaN(day)) return null;
    
    // Use current year, but handle year transitions
    const now = new Date();
    let year = now.getFullYear();
    
    // If the event month is much earlier than current month, it's probably next year
    // (e.g., if it's December and event is in January)
    if (now.getMonth() === 11 && month === 0) {
      year++;
    } else if (now.getMonth() === 0 && month === 11) {
      year--;
    }
    
    const eventDate = new Date(year, month, day);
    return eventDate.toISOString().split('T')[0];
  }
  
  /**
   * Parses CSV text into array of rows
   * @param {string} csvText - Raw CSV text
   * @returns {Array<Array<string>>} Array of rows, each row is array of fields
   */
  static parseCSV(csvText) {
    const rows = [];
    const lines = csvText.split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const row = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped quote
            currentField += '"';
            i++;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          row.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      
      // Add last field
      row.push(currentField.trim());
      rows.push(row);
    }
    
    return rows;
  }
  
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
      const time = event.time.split('-');
      const start = new Date(`${event.date} ${time[0]}`);
      const startDate = start.toLocaleDateString('sv-SE'); // outputs yyyy-mm-dd
      let endToken;
      if (time[1]) {
        // Is event overnight?
        if (time[1].includes('am') && time[0].includes('pm')) {
          let endDate = new Date(start);
          endDate.setDate(endDate.getDate() + 1);
          endToken = `${endDate.toLocaleDateString('sv-SE').replace(/-/gi, '/')} ${time[1]}`;
        } else { // same day
          endToken = `${startDate.replace(/-/gi, '/')} ${time[1]}`;
        }
      } else { // default 1 hour duration
        endToken = start.getTime() + 60*60*1000;
      }
      const end = new Date(endToken);
      const headerContent = document.createElement('div');
      headerContent.innerHTML = `
        <h2><a target="_blank" href="${event.url}" title="Event Page">${event.title}</a></h2>
        <add-to-calendar-button
            name="${event.title.replaceAll('"',"'")}"
            description="${event.url}"
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
      `;
      this.cachedInfoWindow.setHeaderContent(headerContent);
      const content = document.createElement('div');
      content.innerHTML = `
        <div class="info-header">
          <p>
            ${event.cost_details}
          </p>
          <p class="categories">Genres: ${event.categories.map(category => `<a onclick="filter({category:'${category}'})">${category}</a>`).join(', ')}</p>
        </div>
        <div class="info-body">
          <details ${expanded ? 'open' : ''}>
            <summary>Expand Details</summary>
            <div id="details">
              ${event.details}
            </div>
          </details>
        </div>
      `;
      // Reposition after expanding
      content.querySelector('details').addEventListener('toggle', () => {
        const { lat, lng } = this.cachedInfoWindow.getPosition();
        window.map.panTo({ lat: lat() + 0.03, lng: lng()});
      });
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
    
    this.cache = window.localStorage.getItem('events_19hz');
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
      window.localStorage.setItem('events_19hz', JSON.stringify(events));
      window.localStorage.setItem('events_19hz_age', Date.now());
    } catch (e) {
      console.error(e);
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
    return window.localStorage.getItem('events_19hz_age');
  }
  
  /**
   * Specifies if the age of the cache is old. Defaults to 24 hours
   * 
   * @param {number} [old=86400000] - How long ago is considered old. Default: 24 hours
   * @returns {boolean} 
   */
  isFresh(old = 86400000) {
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
   * Queries the CSV API and loads venues for all configured regions
   *
   * @returns {Promise}
   */
  async query() {
    console.log('Loading regions configuration from', Events.REGIONS_URL);
    
    // Load regions configuration
    const regionsResponse = await fetch(new Request(Events.REGIONS_URL));
    
    if (!regionsResponse.ok) {
      const error = new Error(`Regions Config Fetch Failed! ${regionsResponse.status}`);
      error.response = regionsResponse;
      throw error;
    }
    
    const regions = await regionsResponse.json();
    console.log(`Found ${regions.length} configured regions`);
    
    // Load all regions in parallel
    const allEvents = [];
    
    for (const region of regions) {
      try {
        console.log(`Loading region: ${region.name}`);
        const events = await this.queryRegion(region);
        console.log(`  Loaded ${events.length} events from ${region.name}`);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Failed to load region ${region.name}:`, error);
        // Continue loading other regions even if one fails
      }
    }
    
    console.log(`Total events loaded: ${allEvents.length}`);
    return allEvents;
  }
  
  /**
   * Queries a single region's CSV and venues
   *
   * @param {object} region - Region configuration object
   * @returns {Promise}
   */
  async queryRegion(region) {
    const csvUrl = `./${region.csvFile}`;
    const venuesUrl = region.venuesFile ? `./${region.venuesFile}` : Events.DEFAULT_VENUES_URL;
    
    console.log(`  Fetching CSV from ${csvUrl}`);
    console.log(`  Loading venues from ${venuesUrl}`);
    
    // Load both CSV and venues in parallel
    const [csvResponse, venuesResponse] = await Promise.all([
      fetch(new Request(csvUrl)),
      fetch(new Request(venuesUrl))
    ]);
    
    if (!csvResponse.ok) {
      const error = new Error(`CSV Fetch Failed for ${region.name}! ${csvResponse.status}`);
      error.response = csvResponse;
      throw error;
    }
    
    if (!venuesResponse.ok) {
      const error = new Error(`Venues Fetch Failed for ${region.name}! ${venuesResponse.status}`);
      error.response = venuesResponse;
      throw error;
    }
    
    const csvText = await csvResponse.text();
    const venues = await venuesResponse.json();
    
    console.log(`  Loaded ${venues.length} venues`);
    
    // Create venue lookup map
    const venueMap = new Map();
    venues.forEach(venue => {
      const normalizedName = Events.normalizeVenueName(venue.name);
      venueMap.set(normalizedName, venue);
    });
    
    // Parse CSV
    const rows = Events.parseCSV(csvText);
    console.log(`  Parsed ${rows.length} CSV rows`);
    
    // Transform rows to events
    const events = [];
    const unmatchedVenues = new Set();
    
    rows.forEach((row, index) => {
      // CSV structure:
      // 0: Date, 1: Title, 2: Genres, 3: Venue, 4: Time, 
      // 5: Cost, 6: Age, 7: Artists, 8: URL1, 9: URL2, 10: Numeric
      
      if (row.length < 8) {
        return;
      }
      
      const rawVenue = row[3];
      const normalizedVenue = Events.normalizeVenueName(rawVenue);
      const venueData = venueMap.get(normalizedVenue);
      
      if (!venueData) {
        unmatchedVenues.add(rawVenue);
        return; // Skip events with unmatched venues
      }
      
      const parsedDate = Events.parseCSVDate(row[0]);
      if (!parsedDate) {
        return;
      }
      
      // Build event object
      const event = {
        title: row[1],
        venue: venueData.name,
        geometry: venueData.geometry,
        date: parsedDate,
        date_text: row[0],
        time: row[4],
        cost: row[5],
        cost_details: `${row[6]} | Artists: ${row[7] || 'TBA'}`,
        categories: row[2] ? row[2].split(',').map(g => g.trim()) : [],
        url: row[8] || row[9] || '#',
        eventUrl: row[8] || row[9] || '#',
        region: region.name,
        details: `
          <p><strong>Region:</strong> ${region.name}</p>
          <p><strong>Genres:</strong> ${row[2]}</p>
          <p><strong>Artists:</strong> ${row[7] || 'TBA'}</p>
          <p><strong>Age:</strong> ${row[6]}</p>
          <p><strong>Cost:</strong> ${row[5]}</p>
          ${row[8] ? `<p><a href="${row[8]}" target="_blank">Event Link</a></p>` : ''}
          ${row[9] ? `<p><a href="${row[9]}" target="_blank">Additional Link</a></p>` : ''}
        `
      };
      
      events.push(event);
    });
    
    if (unmatchedVenues.size > 0) {
      console.warn(`  Unmatched venues in ${region.name} (${unmatchedVenues.size}):`, Array.from(unmatchedVenues).slice(0, 10));
    }
    
    return events;
  }
}

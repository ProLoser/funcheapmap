/* global google */
// Delimiter for multiple category selections (must not appear in category names and not require URI encoding)
const CATEGORY_DELIMITER = '~';

// Spotify API configuration
// For production, these should be loaded from environment variables or a secure backend
const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = 'YOUR_SPOTIFY_CLIENT_SECRET';

// Cache for Spotify access token
let spotifyAccessToken = null;
let spotifyTokenExpiry = null;

// Cache for artist IDs to avoid repeated API calls
const artistIdCache = new Map();

const intersectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('drop');
      intersectionObserver.unobserve(entry.target);
    }
  }
});

/**
 * Gets a Spotify access token using client credentials flow
 * @returns {Promise<string>} Access token
 */
async function getSpotifyAccessToken() {
  if (SPOTIFY_CLIENT_ID === 'YOUR_SPOTIFY_CLIENT_ID' || 
      SPOTIFY_CLIENT_SECRET === 'YOUR_SPOTIFY_CLIENT_SECRET') {
    console.warn('Spotify API credentials not configured. Please add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
    return null;
  }
  
  if (spotifyAccessToken && spotifyTokenExpiry && Date.now() < spotifyTokenExpiry) {
    return spotifyAccessToken;
  }
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      throw new Error(`Spotify auth failed: ${response.status}`);
    }
    
    const data = await response.json();
    spotifyAccessToken = data.access_token;
    spotifyTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    
    return spotifyAccessToken;
  } catch (error) {
    console.error('Failed to get Spotify access token:', error);
    return null;
  }
}

/**
 * Searches Spotify for an artist and returns their ID
 * @param {string} artistName - Name of the artist to search for
 * @returns {Promise<string|null>} Spotify artist ID or null if not found
 */
async function searchSpotifyArtist(artistName) {
  if (artistIdCache.has(artistName)) {
    return artistIdCache.get(artistName);
  }
  
  const token = await getSpotifyAccessToken();
  if (!token) {
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=artist:${encodeURIComponent(artistName)}&type=artist&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Spotify search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.artists && data.artists.items && data.artists.items.length > 0) {
      const artistId = data.artists.items[0].id;
      artistIdCache.set(artistName, artistId);
      return artistId;
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to search for artist "${artistName}":`, error);
    return null;
  }
}

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
  // Create the map
  window.map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 4,
    center: new google.maps.LatLng(39, -100),
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
      let minDate, maxDate, categories = new Set();
      events.forEach(event => {
        if (!event.title) return console.warn('Event Title Missing', { event });
        if (!event.geometry) return console.warn('Event Geometry Missing', { event });
        // Add categories to the set
        if (event.categories) {
          event.categories.forEach(category => categories.add(category));
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
 * Updates the Spotify player to search for a specific artist
 * @param {string} artistName - The artist name to search for
 */
window.updateSpotifyPlayer = async function(artistName) {
  const spotifyPlayer = document.getElementById('spotify-player');
  if (!spotifyPlayer) {
    return;
  }
  
  const container = spotifyPlayer.parentElement;
  
  // Show loading state
  spotifyPlayer.style.display = 'none';
  if (!container.querySelector('.spotify-loading')) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'spotify-loading';
    loadingDiv.style.cssText = 'text-align: center; padding: 20px; color: #666; font-size: 14px;';
    loadingDiv.textContent = `Loading ${artistName}...`;
    container.appendChild(loadingDiv);
  }
  
  try {
    const artistId = await searchSpotifyArtist(artistName);
    
    const loadingDiv = container.querySelector('.spotify-loading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
    
    if (artistId) {
      // Use the proper artist embed URL with the artist ID and enable autoplay
      spotifyPlayer.src = `https://open.spotify.com/embed/artist/${artistId}?autoplay=1`;
      spotifyPlayer.style.display = 'block';
    } else {
      console.warn(`Could not find Spotify artist ID for: ${artistName}`);
      spotifyPlayer.style.display = 'none';
      
      // Show error message
      const errorDiv = document.createElement('div');
      errorDiv.className = 'spotify-error';
      errorDiv.style.cssText = 'text-align: center; padding: 20px; color: #999; font-size: 12px;';
      errorDiv.textContent = `Artist "${artistName}" not found on Spotify`;
      container.appendChild(errorDiv);
      
      // Remove error after 3 seconds
      setTimeout(() => errorDiv.remove(), 3000);
    }
  } catch (error) {
    console.error(`Error updating Spotify player for ${artistName}:`, error);
    const loadingDiv = container.querySelector('.spotify-loading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
    spotifyPlayer.style.display = 'none';
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
  static API_TOKEN = 'apify_api_2VVNvbl0l5Bo3S3xLVENJRKAt9GW2P1RcRX6';
  static API = `https://api.apify.com/v2/actor-tasks/proloser~19hz-csv-crawler/runs/last/dataset/items?clean=true&token=${Events.API_TOKEN}`;
  static VENUES_URL = 'venues.json';
  
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
   * Normalizes category name by trimming whitespace and removing the word 'music'
   * @param {string} category - Raw category name
   * @returns {string} Normalized category name
   */
  static normalizeCategory(category) {
    return category
      .trim()
      .replace(/\s+music$/i, '')
      .trim();
  }
  
  /**
   * Extracts artist names from event title
   * @param {string} title - Event title
   * @returns {string} Comma-separated artist names or empty string
   */
  static extractArtistsFromTitle(title) {
    if (!title) return '';
    
    // Remove common event keywords and patterns
    let cleanedTitle = title
      .replace(/\s*-\s*(tour|show|live|concert|presents?|feat(?:uring)?\.?|w\/|with)\s*/gi, ' - ')
      .replace(/\s+Night$/i, '')
      .replace(/^\d+s\s+Night:?\s*/i, '')
      .replace(/^(Nightlife|Dance Party|Just Dance|Bad Bunny Night):?\s*/i, '')
      .trim();
    
    // Handle different title formats
    // Format: "Event Name: Artist1, Artist2"
    if (cleanedTitle.includes(':')) {
      const parts = cleanedTitle.split(':');
      if (parts.length >= 2) {
        cleanedTitle = parts.slice(1).join(':').trim();
      }
    }
    
    // Format: "Event Name - Artist1, Artist2" or "Artist1 - Event Name"
    if (cleanedTitle.includes(' - ')) {
      const parts = cleanedTitle.split(' - ');
      // Take the first substantial part that looks like artists
      const firstPart = parts[0].trim();
      const secondPart = parts.length > 1 ? parts[1].trim() : '';
      
      // Prefer the part with commas (likely multiple artists)
      if (secondPart && secondPart.includes(',')) {
        cleanedTitle = secondPart;
      } else if (firstPart && firstPart.includes(',')) {
        cleanedTitle = firstPart;
      } else if (secondPart) {
        // Use second part if it exists (common format: "Event - Artists")
        cleanedTitle = secondPart;
      } else {
        cleanedTitle = firstPart;
      }
    }
    
    // Remove phrases that indicate it's not an artist
    cleanedTitle = cleanedTitle
      .replace(/\s*(presents?|feat(?:uring)?\.?|w\/|with)\s+/gi, ', ')
      .replace(/\s+(?:and|&)\s+/gi, ', ')
      .replace(/\s+b2b\s+/gi, ', ')
      .trim();
    
    // If the result is too short or looks like an event name, return empty
    if (cleanedTitle.length < 2 || /^(free|party|night|event|show|live)$/i.test(cleanedTitle)) {
      return '';
    }
    
    return cleanedTitle;
  }
  
  /**
   * Parses CSV date format "Tue: Jan 27" to ISO date
   * @param {string} dateStr - Date string from CSV
   * @returns {object} Object with iso (YYYY-MM-DD) and text (Jan 27, YYYY) formats
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
    return {
      iso: eventDate.toISOString().split('T')[0],
      text: `${monthStr} ${day}, ${year}`
    };
  }
  
  /**
   * Parses time in 12-hour format (e.g., "9:30pm") and converts to 24-hour format
   * @param {string} timeStr - Time string in 12-hour format (e.g., "9:30pm", "10am")
   * @returns {{hours: number, minutes: number}} Object with hours (0-23) and minutes (0-59) in 24-hour format
   */
  static parseTime12Hour(timeStr) {
    const trimmed = timeStr.trim().toLowerCase();
    const isPM = trimmed.includes('pm');
    const isAM = trimmed.includes('am');
    
    // Validate that time has am/pm indicator
    if (!isPM && !isAM) {
      console.warn(`Time string "${timeStr}" missing am/pm indicator, defaulting to PM`);
    }
    
    // Remove am/pm and any spaces
    const timeOnly = trimmed.replace(/am|pm/g, '').trim();
    
    // Split hours and minutes
    const parts = timeOnly.split(':');
    let hours = parseInt(parts[0]);
    const minutes = parts[1] ? parseInt(parts[1]) : 0;
    
    // Validate parsed values
    if (isNaN(hours) || hours < 1 || hours > 12) {
      console.error(`Invalid hours value in time string "${timeStr}"`);
      hours = 12; // Default to noon/midnight
    }
    if (isNaN(minutes) || minutes < 0 || minutes > 59) {
      console.error(`Invalid minutes value in time string "${timeStr}"`);
      minutes = 0; // Default to :00
    }
    
    // Convert to 24-hour format
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (isAM && hours === 12) {
      hours = 0;
    } else if (!isPM && !isAM) {
      // Default to PM if no indicator
      if (hours !== 12) {
        hours += 12;
      }
    }
    
    return { hours, minutes };
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
      
      // Parse start time properly
      const startTime = Events.parseTime12Hour(time[0]);
      // Parse date string as local date to avoid timezone issues
      const [year, month, day] = event.date.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      start.setHours(startTime.hours, startTime.minutes, 0, 0);
      const startDate = start.toLocaleDateString('sv-SE'); // outputs yyyy-mm-dd
      
      let end;
      if (time[1]) {
        const endTime = Events.parseTime12Hour(time[1]);
        // Reuse parsed date components from start date
        end = new Date(year, month - 1, day);
        end.setHours(endTime.hours, endTime.minutes, 0, 0);
        
        // Is event overnight? (end time is earlier than start time)
        if (end < start) {
          end.setDate(end.getDate() + 1);
        }
      } else { 
        // default 1 hour duration
        end = new Date(start.getTime() + 60*60*1000);
      }
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
      const ageInfo = event.cost_details || 'N/A';
      const artistsInfo = event.extractedArtists || 'TBA';
      
      // Check if artists are valid (not TBA, TBD, or empty)
      const hasValidArtists = artistsInfo && 
        artistsInfo.trim() !== '' && 
        artistsInfo.toUpperCase() !== 'TBA' && 
        artistsInfo.toUpperCase() !== 'TBD';
      
      let artistsHTML = '';
      let spotifyPlayerHTML = '';
      
      if (hasValidArtists) {
        const artists = artistsInfo.split(',').map(artist => artist.trim());
        const firstArtist = artists[0];
        
        // Create artist links with speaker icons
        artistsHTML = artists.map((artist, index) => {
          const speakerIcon = `<svg class="speaker-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; cursor: pointer; margin-left: 4px;" onclick="event.preventDefault(); event.stopPropagation(); updateSpotifyPlayer('${artist.replace(/'/g, "\\'")}')">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>`;
          return `<a href="https://open.spotify.com/search/${encodeURIComponent(artist)}" target="_blank">${artist}</a>${speakerIcon}`;
        }).join(', ');
        
        // Create Spotify embed player placeholder
        spotifyPlayerHTML = `
          <iframe id="spotify-player" 
            style="border-radius: 12px; margin-top: 10px;" 
            src="" 
            width="100%" 
            height="152" 
            frameBorder="0" 
            allowfullscreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
          </iframe>
        `;
      }
      
      content.innerHTML = `
        <div class="info-header">
          <p><strong>Genres:</strong> ${event.categories.map(category => `<a onclick="filter({category:'${category}'})">${category}</a>`).join(', ')}</p>
          ${hasValidArtists ? `<p><strong>Artists:</strong> ${artistsHTML}</p>` : ''}
          <p><strong>Age:</strong> ${ageInfo}</p>
        </div>
        <div class="info-body">
          ${spotifyPlayerHTML}
        </div>
      `;
      
      this.cachedInfoWindow.setContent(content);
      
      // Load first artist after content is set
      if (hasValidArtists) {
        const artists = artistsInfo.split(',').map(artist => artist.trim());
        updateSpotifyPlayer(artists[0]);
      }
    }
    return this.cachedInfoWindow;
  }
  
  get() {
    if (this.cache) return this.cache;
    this.cache = window.localStorage.getItem('events');
    if (this.cache) this.cache = JSON.parse(this.cache);
    return this.cache;
  }

  set(events) {
    try {
      window.localStorage.setItem('events', JSON.stringify(events));
      window.localStorage.setItem('events_age', Date.now());
    } catch (e) {
      console.error(e);
    }
    this.cache = events;
    return this.cache;
  }

  age() {
    return window.localStorage.getItem('events_age');
  }

  isFresh(old = 86400) {
    const age = this.age();
    return age && age > (Date.now() - old);
  }

  load() {
    if (this.isFresh()) return Promise.resolve(this.get());
    return this.query().then(this.set.bind(this));
  }
  
  async query() {
    console.log('Fetching events from', Events.API);
    console.log('Loading venues from', Events.VENUES_URL);
    const [apiResponse, venuesResponse] = await Promise.all([
      fetch(new Request(Events.API)),
      fetch(new Request(Events.VENUES_URL))
    ]);
    if (!apiResponse.ok) {
      const error = new Error(`Events Query Failed! ${apiResponse.status}`);
      error.response = apiResponse;
      throw error;
    }
    if (!venuesResponse.ok) {
      const error = new Error(`Venues Fetch Failed! ${venuesResponse.status}`);
      error.response = venuesResponse;
      throw error;
    }
    const [items, venues] = await Promise.all([apiResponse.json(), venuesResponse.json()]);
    console.log(`Loaded ${items.length} items from API, ${venues.length} venues`);
    const venueMap = new Map();
    venues.forEach(venue => {
      venueMap.set(Events.normalizeVenueName(venue.name), venue);
    });
    const events = [];
    const unmatchedVenues = new Set();
    items.forEach((row, index) => {
      if (!row.title || !row.venue) {
        console.warn(`Row ${index} has insufficient fields:`, row);
        return;
      }
      const venueData = venueMap.get(Events.normalizeVenueName(row.venue));
      if (!venueData) {
        unmatchedVenues.add(row.venue);
        return;
      }
      const parsedDate = Events.parseCSVDate(row.date);
      if (!parsedDate) {
        console.warn(`Could not parse date: ${row.date}`);
        return;
      }
      const extractedArtists = Events.extractArtistsFromTitle(row.title) || 'TBA';
      const genresList = row.tags ? row.tags.split(',').map(genre => Events.normalizeCategory(genre)).filter(category => category) : [];
      const eventUrl = row.url1 || row.url2 || '#';
      events.push({
        title: row.title,
        venue: venueData.name,
        geometry: venueData.geometry,
        date: parsedDate.iso,
        date_text: parsedDate.text,
        time: row.time,
        cost: row.price,
        cost_details: row.age,
        extractedArtists,
        categories: genresList,
        url: eventUrl,
        eventUrl,
        promoter: row.organizers || '',
        details: `
          <p><strong>Genres:</strong> ${genresList.length ? genresList.join(', ') : 'N/A'}</p>
          <p><strong>Artists:</strong> ${extractedArtists}</p>
          ${row.organizers ? `<p><strong>Promoter:</strong> ${row.organizers}</p>` : ''}
          <p><strong>Age:</strong> ${row.age}</p>
          <p><strong>Cost:</strong> ${row.price}</p>
          ${row.url1 ? `<p><a href="${row.url1}" target="_blank">Event Link</a></p>` : ''}
          ${row.url2 ? `<p><a href="${row.url2}" target="_blank">Additional Link</a></p>` : ''}
        `
      });
    });
    console.log(`Successfully processed ${events.length} events`);
    if (unmatchedVenues.size > 0) {
      console.warn(`Unmatched venues (${unmatchedVenues.size}):`, Array.from(unmatchedVenues).sort());
    }
    return events;
  }
}

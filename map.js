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

// Floating card state
let cardModeEnabled = localStorage.getItem('cardMode') !== 'false';
let visibleEventsList = [];
let currentCardIndex = -1;
const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3; // px/ms
const CARD_TRANSITION = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';

function updateCardToggleButton() {
  const button = document.getElementById('card-mode-toggle');
  if (!button) return;
  button.classList.toggle('active', cardModeEnabled);
  button.title = cardModeEnabled ? 'Disable floating cards' : 'Enable floating cards';
}

function buildCardContent(container, event) {
  const titleEl = container.querySelector('.event-card-title');
  titleEl.innerHTML = '';
  const titleLink = document.createElement('a');
  titleLink.target = '_blank';
  titleLink.href = event.url;
  titleLink.textContent = event.title;
  titleEl.appendChild(titleLink);

  const metaEl = container.querySelector('.event-card-meta');
  metaEl.innerHTML = '';
  const venueLink = document.createElement('a');
  venueLink.target = '_blank';
  venueLink.href = `https://maps.google.com/?q=${encodeURIComponent(event.venue)}&ll=${event.geometry.lat},${event.geometry.lng}`;
  venueLink.textContent = event.venue;
  metaEl.appendChild(venueLink);
  metaEl.appendChild(document.createTextNode(` | ${event.date_text} | ${event.time}`));

  const costEl = container.querySelector('.event-card-cost');
  costEl.innerHTML = '';
  const costLink = document.createElement('a');
  costLink.target = '_blank';
  costLink.href = event.eventUrl;
  costLink.textContent = event.cost;
  costEl.appendChild(costLink);
  if (event.cost_details) {
    costEl.appendChild(document.createTextNode(' — ' + event.cost_details));
  }
}

function showEventCard(event) {
  currentCardIndex = visibleEventsList.indexOf(event);
  const current = document.getElementById('event-card-current');
  current.style.transition = 'none';
  current.style.transform = 'translateX(0)';
  buildCardContent(current, event);
  document.getElementById('event-card-counter').textContent =
    `${currentCardIndex + 1} of ${visibleEventsList.length}`;
  document.getElementById('event-card').classList.add('visible');
  Events.infoWindow(event).open(window.map, event.marker);
}

function hideEventCard() {
  document.getElementById('event-card').classList.remove('visible');
  Events.infoWindow().close();
}

function commitNavigation(direction) {
  if (!visibleEventsList.length) return;
  const slider = document.getElementById('event-card-slider');
  const current = document.getElementById('event-card-current');
  const peek = document.getElementById('event-card-peek');
  const width = slider.offsetWidth;
  const newIndex = (currentCardIndex + direction + visibleEventsList.length) % visibleEventsList.length;

  buildCardContent(peek, visibleEventsList[newIndex]);
  peek.style.transition = 'none';
  current.style.transition = 'none';
  peek.style.transform = `translateX(${direction > 0 ? width : -width}px)`;
  current.style.transform = 'translateX(0)';

  // Force reflow so transition fires
  peek.offsetWidth;

  peek.style.transition = CARD_TRANSITION;
  current.style.transition = CARD_TRANSITION;
  current.style.transform = `translateX(${direction > 0 ? -width : width}px)`;
  peek.style.transform = 'translateX(0)';

  current.addEventListener('transitionend', () => finishNavigation(current, peek, newIndex), { once: true });
}

function finishNavigation(current, peek, newIndex) {
  currentCardIndex = newIndex;
  current.style.transition = 'none';
  peek.style.transition = 'none';
  current.style.transform = 'translateX(0)';
  peek.style.transform = '';
  buildCardContent(current, visibleEventsList[currentCardIndex]);
  document.getElementById('event-card-counter').textContent =
    `${currentCardIndex + 1} of ${visibleEventsList.length}`;
  const ev = visibleEventsList[currentCardIndex];
  if (ev?.marker) {
    window.map.panTo(ev.geometry);
    Events.infoWindow(ev).open(window.map, ev.marker);
  }
}

function initEventCard() {
  const card = document.getElementById('event-card');
  const slider = document.getElementById('event-card-slider');
  const current = document.getElementById('event-card-current');
  const peek = document.getElementById('event-card-peek');

  let touchStartX = 0, touchStartY = 0;
  let lastMoveX = 0, lastMoveTime = 0, swipeVelocity = 0;
  let gestureAxis = null; // 'horizontal' | 'vertical'
  let peekDirection = 0;  // 1 = peek is on right (next), -1 = peek is on left (prev)

  card.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    lastMoveX = touchStartX;
    lastMoveTime = Date.now();
    swipeVelocity = 0;
    gestureAxis = null;
    peekDirection = 0;
    current.style.transition = 'none';
    peek.style.transition = 'none';
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    if (!gestureAxis) {
      if (Math.abs(deltaX) > 8) gestureAxis = 'horizontal';
      else if (Math.abs(deltaY) > 8) gestureAxis = 'vertical';
      else return;
    }
    if (gestureAxis !== 'horizontal') return;

    const now = Date.now();
    const dt = now - lastMoveTime;
    if (dt > 0) swipeVelocity = (e.touches[0].clientX - lastMoveX) / dt;
    lastMoveX = e.touches[0].clientX;
    lastMoveTime = now;

    const width = slider.offsetWidth;
    const newDir = deltaX < 0 ? 1 : -1; // 1=next, -1=prev

    if (peekDirection !== newDir) {
      peekDirection = newDir;
      const peekIndex = (currentCardIndex + newDir + visibleEventsList.length) % visibleEventsList.length;
      buildCardContent(peek, visibleEventsList[peekIndex]);
      peek.style.transition = 'none';
      peek.style.transform = `translateX(${newDir > 0 ? width : -width}px)`;
    }

    current.style.transform = `translateX(${deltaX}px)`;
    peek.style.transform = `translateX(${(peekDirection > 0 ? width : -width) + deltaX}px)`;
  }, { passive: true });

  card.addEventListener('touchend', e => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    if (gestureAxis === 'vertical') {
      if (deltaY > SWIPE_THRESHOLD) hideEventCard();
      return;
    }

    if (gestureAxis !== 'horizontal' || !peekDirection) {
      return;
    }

    const width = slider.offsetWidth;
    const shouldCommit = Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(swipeVelocity) > VELOCITY_THRESHOLD;
    const commitDir = deltaX < 0 ? 1 : -1;

    if (shouldCommit) {
      const newIndex = (currentCardIndex + commitDir + visibleEventsList.length) % visibleEventsList.length;
      current.style.transition = CARD_TRANSITION;
      peek.style.transition = CARD_TRANSITION;
      current.style.transform = `translateX(${commitDir > 0 ? -width : width}px)`;
      peek.style.transform = 'translateX(0)';

      current.addEventListener('transitionend', () => finishNavigation(current, peek, newIndex), { once: true });
    } else {
      current.style.transition = CARD_TRANSITION;
      peek.style.transition = CARD_TRANSITION;
      current.style.transform = 'translateX(0)';
      peek.style.transform = `translateX(${peekDirection > 0 ? width : -width}px)`;
    }

    gestureAxis = null;
    peekDirection = 0;
  }, { passive: true });

  document.getElementById('event-card-prev').addEventListener('click', () => commitNavigation(-1));
  document.getElementById('event-card-next').addEventListener('click', () => commitNavigation(1));
  document.getElementById('event-card-close').addEventListener('click', hideEventCard);

  document.getElementById('event-card-details').addEventListener('click', () => {
    const detailsEl = Events.infoWindow().getContent()?.querySelector('details');
    if (detailsEl) detailsEl.open = !detailsEl.open;
  });

  window.addEventListener('keydown', e => {
    if (!document.getElementById('event-card').classList.contains('visible')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); commitNavigation(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); commitNavigation(1); }
  });

  const toggleButton = document.getElementById('card-mode-toggle');
  updateCardToggleButton();
  toggleButton.addEventListener('click', () => {
    cardModeEnabled = !cardModeEnabled;
    localStorage.setItem('cardMode', cardModeEnabled);
    updateCardToggleButton();
    if (!cardModeEnabled) hideEventCard();
  });
}


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
        hideEventCard();
        break;  
    }
  });
  google.maps.event.addListener(window.map, 'click', function(event) {
      Events.infoWindow().close();
      hideEventCard();
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
          if (cardModeEnabled) {
            showEventCard(event);
          } else {
            Events.infoWindow(event).open(window.map, event.marker);
          }
        });
      });
      const form = document.getElementById('controls');
      form.addEventListener('reset', window.filter);
      map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(form);
      map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(document.getElementById('feedback'));
      map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(document.getElementById('card-mode-toggle'));
      initEventCard();
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

function isEventEnded(event) {
  if (!event.time || !event.date_text) return false;
  const timeParts = event.time.split(' to ');
  const start = new Date(`${event.date_text} ${timeParts[0]}`);
  if (isNaN(start.getTime())) return false;
  let end;
  if (timeParts[1]) {
    const startDate = start.toLocaleDateString('sv-SE');
    if (timeParts[1].slice(-2) === 'am' && timeParts[0].slice(-2) === 'pm') {
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 1);
      end = new Date(`${endDate.toLocaleDateString('sv-SE').replace(/-/gi, '/')} ${timeParts[1]}`);
    } else {
      end = new Date(`${startDate.replace(/-/gi, '/')} ${timeParts[1]}`);
    }
  } else {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }
  return end < new Date();
}

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
  const isToday = date &&
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
        if (isToday && isEventEnded(event)) {
          event.marker.content.classList.add('event-ended');
        } else {
          event.marker.content.classList.remove('event-ended');
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
  // Update the cached visible events list for card navigation
  visibleEventsList = window.events.get()?.filter(e => e.visible && e.title && e.geometry) || [];
  // Dismiss the card when filters change since the current event may no longer be visible
  hideEventCard();
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
  static API_TOKEN = 'apify_api_2VVNvbl0l5Bo3S3xLVENJRKAt9GW2P1RcRX6';
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

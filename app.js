/**
 * Commute Dashboard 2.0 - Main Application
 * State management, UI rendering, and event handling
 */

const App = {
  // Application State
  state: {
    theme: 'dark',
    activeTab: 'drive',
    selectedLine: '117N',
    selectedStation: {
      '117N': '35254',  // 112th / Northglenn
      '113G': '34781',  // Union Station
      '113B': '34782',  // Union Station
    },
    weather: null,
    driveTime: {
      morning: null,
      evening: null,
    },
    transitData: {},
    vehiclePositions: {
      vehicles: [],
      timestamp: null,
      routeSummary: { '117N': 0, '113G': 0, '113B': 0 }
    },
    loading: {
      initial: true,
      weather: false,
      drive: false,
      transit: false,
    },
    lastRefresh: new Date(),
    avoidHighways: false,
  },

  // Configuration
  config: {
    locations: {
      home: {
        address: '11625 Community Center Drive, Northglenn, CO',
        lat: null,
        lng: null
      },
      garage: {
        address: '1801 California Street, Denver, CO 80202',
        lat: null,
        lng: null
      },
      work: {
        address: '707 17th Street, Denver, CO 80202',
        lat: null,
        lng: null
      },
    },
    // Your preferred station for each line
    myStations: {
      '117N': '35254',  // 112th / Northglenn (primary stop ID)
      '113G': '34781',  // Union Station
      '113B': '34782',  // Union Station
    },
    // N Line directional platforms - used for fetching combined data
    nLinePlatforms: {
      '35365': { platforms: ['35365'], directions: ['southbound'] },  // Eastlake - northern terminus (only departs SB)
      '35254': { platforms: ['35254', '35255'], directions: ['northbound', 'southbound'] },  // 112th - mid-line (both directions)
      '35246': { platforms: ['35246', '35247'], directions: ['northbound', 'southbound'] },  // 48th - mid-line (both directions)
      '34668': { platforms: ['34668'], directions: ['northbound'] },  // Union - southern terminus (only departs NB)
    },
    stations: {
      '117N': [
        { id: '35365', name: 'Eastlake & 124th' },
        { id: '35254', name: '112th / Northglenn' },
        { id: '35246', name: '48th & Brighton' },
        { id: '34668', name: 'Union Station' },
      ],
      '113G': [
        { id: '34510', name: 'Ward Station / Wheat Ridge' },
        { id: '34541', name: 'Olde Town Arvada' },
        { id: '34525', name: 'Gold Strike' },
        { id: '34544', name: 'Pecos Junction' },
        { id: '34781', name: 'Union Station' },
      ],
      '113B': [
        { id: '34560', name: 'Westminster' },
        { id: '34544', name: 'Pecos Junction' },
        { id: '34782', name: 'Union Station' },
      ],
    },
    refreshIntervals: {
      weather: 5 * 60 * 1000, // 5 minutes
      drive: 5 * 60 * 1000, // 5 minutes
      transit: 30 * 1000, // 30 seconds
    },
  },

  /**
   * Initialize the application
   */
  async init() {
    console.log('🚀 Initializing Commute Dashboard 2.0');

    // Load saved preferences
    this.loadPreferences();

    // Set initial theme
    this.updateTheme();

    // Set up event listeners
    this.setupEventListeners();

    // Load all data
    await this.loadInitialData();

    // Hide loading screen, show app
    this.state.loading.initial = false;
    this.render();

    // Set up auto-refresh
    this.setupAutoRefresh();

    console.log('✅ App initialized successfully');
  },

  /**
   * Load saved preferences from localStorage
   */
  loadPreferences() {
    const saved = localStorage.getItem('commutePreferences');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        this.state.theme = prefs.theme || 'dark';
        this.state.avoidHighways = prefs.avoidHighways || false;
        this.state.selectedStation = prefs.selectedStation || this.state.selectedStation;
      } catch (e) {
        console.error('Failed to load preferences:', e);
      }
    }
  },

  /**
   * Save preferences to localStorage
   */
  savePreferences() {
    const prefs = {
      theme: this.state.theme,
      avoidHighways: this.state.avoidHighways,
      selectedStation: this.state.selectedStation,
    };
    localStorage.setItem('commutePreferences', JSON.stringify(prefs));
  },

  /**
   * Load all initial data
   */
  async loadInitialData() {
    this.state.loading.weather = true;
    this.state.loading.drive = true;
    this.state.loading.transit = true;

    // Load all data in parallel
    await Promise.all([
      this.fetchWeather(),
      this.fetchDriveTimes(),
      this.fetchTransitData(),
      this.fetchVehiclePositions(),
    ]);

    this.state.loading.weather = false;
    this.state.loading.drive = false;
    this.state.loading.transit = false;
    this.state.lastRefresh = new Date();
  },

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address) {
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (data.results && data.results[0]) {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      }
      return null;
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  },

  /**
   * Fetch weather data
   */
  async fetchWeather() {
    let home = this.config.locations.home;

    // Geocode if we don't have coordinates yet
    if (!home.lat || !home.lng) {
      const coords = await this.geocodeAddress(home.address);
      if (coords) {
        home.lat = coords.lat;
        home.lng = coords.lng;
      }
    }

    this.state.weather = await API.getWeather(home.lat, home.lng);
  },

  /**
   * Fetch drive times (home -> work via garage)
   */
  async fetchDriveTimes() {
    const { home, garage, work } = this.config.locations;

    // Geocode addresses if needed
    for (const location of [home, garage, work]) {
      if (!location.lat || !location.lng) {
        const coords = await this.geocodeAddress(location.address);
        if (coords) {
          location.lat = coords.lat;
          location.lng = coords.lng;
        }
      }
    }

    // Morning commute (home -> garage for parking)
    this.state.driveTime.morning = await API.getDriveTimes(
      home,
      garage,
      this.state.avoidHighways
    );

    // Evening commute (garage -> home)
    this.state.driveTime.evening = await API.getDriveTimes(
      garage,
      home,
      this.state.avoidHighways
    );
  },

  /**
   * Fetch transit data for ALL stations on all lines
   */
  async fetchTransitData() {
    const lines = ['117N', '113G', '113B'];

    console.log('🚆 Fetching transit data for all lines and stations...');

    for (const lineId of lines) {
      const stations = this.config.stations[lineId] || [];
      const lineData = {};

      // Fetch data for each station on this line
      for (const station of stations) {
        let data;

        // Special handling for N Line - fetch from platforms and filter directions
        if (lineId === '117N' && this.config.nLinePlatforms[station.id]) {
          const config = this.config.nLinePlatforms[station.id];
          const platformIds = config.platforms;
          const allowedDirections = config.directions;

          console.log(`🔍 Fetching ${station.name}: platforms=${platformIds.join(', ')}, directions=${allowedDirections.join(', ')}`);

          const allNorthbound = [];
          const allSouthbound = [];

          // Fetch from each platform
          for (const platformId of platformIds) {
            const platformData = await API.getLineArrivals(platformId, lineId);
            console.log(`  → Platform ${platformId}:`, platformData);

            if (allowedDirections.includes('northbound')) {
              allNorthbound.push(...(platformData.northbound || []));
            }
            if (allowedDirections.includes('southbound')) {
              allSouthbound.push(...(platformData.southbound || []));
            }
          }

          // Sort combined data by time
          allNorthbound.sort((a, b) => a.time - b.time);
          allSouthbound.sort((a, b) => a.time - b.time);

          data = {
            northbound: allNorthbound,
            southbound: allSouthbound,
            stopName: station.name,
          };

          console.log(`✅ ${lineId} - ${station.name}: Merged ${platformIds.length} platforms - NB: ${data.northbound.length} trains, SB: ${data.southbound.length} trains`);
        } else {
          // Standard fetch for G&B lines
          data = await API.getLineArrivals(station.id, lineId);
        }

        console.log(`📍 ${lineId} - ${station.name} (${station.id}):`, {
          hasNorthbound: !!data.northbound,
          hasSouthbound: !!data.southbound,
          nbCount: data.northbound?.length || 0,
          sbCount: data.southbound?.length || 0,
          sample: data.northbound?.[0] || data.southbound?.[0],
        });

        lineData[station.id] = {
          ...data,
          stationName: station.name,
        };
      }

      this.state.transitData[lineId] = lineData;
      console.log(`✅ ${lineId}: Loaded ${stations.length} stations`);
    }

    console.log('✅ Transit data fetch complete');
  },

  /**
   * Fetch vehicle positions for live GPS tracking
   */
  async fetchVehiclePositions() {
    console.log('🚆 Fetching vehicle positions...');
    const data = await API.getVehiclePositions();
    this.state.vehiclePositions = data;
    console.log(`✅ Got ${data.vehicles.length} vehicles:`, data.routeSummary);
  },

  /**
   * Set up auto-refresh timers
   */
  setupAutoRefresh() {
    // Weather refresh
    setInterval(() => {
      if (!this.state.loading.weather) {
        this.fetchWeather().then(() => this.render());
      }
    }, this.config.refreshIntervals.weather);

    // Drive time refresh
    setInterval(() => {
      if (!this.state.loading.drive) {
        this.fetchDriveTimes().then(() => this.render());
      }
    }, this.config.refreshIntervals.drive);

    // Transit refresh
    setInterval(() => {
      if (!this.state.loading.transit) {
        this.fetchTransitData().then(() => this.render());
      }
    }, this.config.refreshIntervals.transit);

    // Vehicle positions refresh (10 seconds for live tracking)
    setInterval(() => {
      this.fetchVehiclePositions().then(() => this.render());
    }, 10000);
  },

  /**
   * Manual refresh
   */
  async handleRefresh() {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
      btn.textContent = '⏳ Refreshing...';
      btn.disabled = true;
    }

    await this.loadInitialData();
    this.render();

    if (btn) {
      btn.textContent = '✓ Refreshed';
      setTimeout(() => {
        btn.textContent = '🔄 Refresh';
        btn.disabled = false;
      }, 2000);
    }
  },

  /**
   * Toggle theme
   */
  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.updateTheme();
    this.savePreferences();
  },

  /**
   * Update theme in DOM
   */
  updateTheme() {
    document.documentElement.setAttribute('data-theme', this.state.theme);
  },

  /**
   * Switch tabs
   */
  switchTab(tabName) {
    this.state.activeTab = tabName;
    if (tabName !== 'drive') {
      this.state.selectedLine = tabName;
    }
    this.render();
  },

  /**
   * Change station
   */
  changeStation(lineId, stationId) {
    this.state.selectedStation[lineId] = stationId;
    this.savePreferences();

    // Reload transit data for this line
    this.state.loading.transit = true;
    this.render();

    API.getLineArrivals(stationId, lineId).then(data => {
      this.state.transitData[lineId] = data;
      this.state.loading.transit = false;
      this.render();
    });
  },

  /**
   * Toggle avoid highways
   */
  toggleAvoidHighways() {
    this.state.avoidHighways = !this.state.avoidHighways;
    this.savePreferences();

    // Reload drive times
    this.state.loading.drive = true;
    this.render();

    this.fetchDriveTimes().then(() => {
      this.state.loading.drive = false;
      this.render();
    });
  },

  /**
   * Switch selected line
   */
  switchLine(lineId) {
    this.state.selectedLine = lineId;
    this.render();
  },

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // These will be attached via onclick in the HTML
    window.appRefresh = () => this.handleRefresh();
    window.appToggleTheme = () => this.toggleTheme();
    window.appSwitchTab = (tab) => this.switchTab(tab);
    window.appSwitchLine = (lineId) => this.switchLine(lineId);
    window.appChangeStation = (line, station) => this.changeStation(line, station);
    window.appToggleHighways = () => this.toggleAvoidHighways();
  },

  /**
   * Get greeting based on time
   */
  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  },

  /**
   * Format time ago
   */
  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  },

  /**
   * Main render function
   */
  render() {
    const app = document.getElementById('app');
    if (!app) return;

    // Show loading screen on initial load
    if (this.state.loading.initial) {
      app.innerHTML = this.renderLoadingScreen();
      return;
    }

    // Concept 1: Single-page layout (no old tabs)
    app.innerHTML = `
      ${this.renderHeader()}
      ${this.renderContent()}
    `;
  },

  /**
   * Render loading screen
   */
  renderLoadingScreen() {
    return `
      <div class="loading-screen">
        <div>
          <h1 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem;">
            Taskify
          </h1>
          <p style="color: var(--primary); font-size: 1.25rem; margin-bottom: 2rem;">
            Commute Dashboard
          </p>
        </div>
        <div class="spinner"></div>
        <p style="color: var(--text-muted); font-size: 0.875rem;">
          Loading your commute data...
        </p>
      </div>
    `;
  },

  /**
   * Render header
   */
  renderHeader() {
    const weather = this.state.weather;

    return `
      <header class="header">
        <div class="container">
          <div class="header-content">
            <div class="header-title">
              <h1>Commute</h1>
              <p class="header-subtitle">
                ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p class="header-greeting">${this.getGreeting()}</p>
            </div>

            <div class="header-controls">
              ${weather && !weather._isFallback ? `
                <div class="weather-widget">
                  <img src="https://openweathermap.org/img/wn/${weather.icon}@2x.png"
                       alt="${weather.description}"
                       class="weather-icon">
                  <div>
                    <div class="weather-temp">${weather.temp}°F</div>
                    <div class="weather-description">${weather.description}</div>
                    <div class="weather-details">
                      <span>💧 ${weather.humidity}%</span>
                      <span>💨 ${weather.windSpeed} mph</span>
                    </div>
                  </div>
                </div>
              ` : ''}

              <button id="refreshBtn" class="btn btn-primary" onclick="appRefresh()">
                🔄 Refresh
              </button>

              <button class="btn btn-secondary" onclick="appToggleTheme()">
                ${this.state.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          </div>

          <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--text-muted);">
            Last updated: ${this.timeAgo(this.state.lastRefresh)}
          </div>
        </div>
      </header>
    `;
  },

  /**
   * Render tabs
   */
  renderTabs() {
    const tabs = [
      { id: 'drive', label: '🚗 Drive', },
      { id: '117N', label: '🚆 N Line' },
      { id: '113G', label: '🚆 G Line' },
      { id: '113B', label: '🚆 B Line' },
    ];

    return `
      <div class="container">
        <div class="tabs">
          ${tabs.map(tab => `
            <button class="tab ${this.state.activeTab === tab.id ? 'active' : ''}"
                    onclick="appSwitchTab('${tab.id}')">
              ${tab.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render main content - Concept 1: Single Page Dashboard
   */
  renderContent() {
    const lineId = this.state.selectedLine;
    const lineData = this.state.transitData[lineId] || {};
    const vehicles = this.state.vehiclePositions.vehicles.filter(v => v.routeId === lineId);
    const myStation = this.config.myStations[lineId];

    return `
      <div class="container dashboard">
        <!-- Compact Drive Cards -->
        ${this.renderCompactDriveCards()}

        <!-- Line Tabs -->
        ${this.renderLineTabs()}

        <!-- Visual Track with Active Count -->
        ${this.renderVisualTrackReference(lineId, vehicles.length)}

        <!-- Your Station Focus -->
        ${this.renderYourStation(lineData[myStation], lineId)}

        <!-- All Stations Quick View -->
        ${this.renderAllStationsQuickView(lineId, lineData)}
      </div>
    `;
  },

  /**
   * CONCEPT 1 RENDER FUNCTIONS
   */

  /**
   * Render compact drive time cards
   */
  renderCompactDriveCards() {
    const { morning, evening } = this.state.driveTime;

    if (!morning || !evening) {
      return `
        <div class="compact-drive-section">
          <div class="skeleton" style="height: 80px;"></div>
        </div>
      `;
    }

    return `
      <div class="compact-drive-section">
        <h3 class="section-title">🚗 Drive Times</h3>
        <div class="compact-drive-cards">
          <div class="compact-drive-card">
            <div class="compact-drive-icon">☀️</div>
            <div class="compact-drive-info">
              <div class="compact-drive-label">Morning (Home → Garage)</div>
              <div class="compact-drive-time">${morning.minutes} min</div>
              <div class="compact-drive-distance">${morning.distance} mi</div>
            </div>
          </div>
          <div class="compact-drive-card">
            <div class="compact-drive-icon">🌙</div>
            <div class="compact-drive-info">
              <div class="compact-drive-label">Evening (Garage → Home)</div>
              <div class="compact-drive-time">${evening.minutes} min</div>
              <div class="compact-drive-distance">${evening.distance} mi</div>
            </div>
          </div>
        </div>
        <div class="drive-toggle compact">
          <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem;">
            🛣️ Avoid Highways
          </div>
          <label class="toggle">
            <input type="checkbox"
                   ${this.state.avoidHighways ? 'checked' : ''}
                   onchange="appToggleHighways()">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  },

  /**
   * Render line selector tabs
   */
  renderLineTabs() {
    const lines = [
      { id: '117N', label: 'N Line', color: '#FF6B6B' },
      { id: '113G', label: 'G Line', color: '#4ECDC4' },
      { id: '113B', label: 'B Line', color: '#95E1D3' }
    ];

    return `
      <div class="line-tabs">
        ${lines.map(line => `
          <button class="line-tab ${this.state.selectedLine === line.id ? 'active' : ''}"
                  style="--line-color: ${line.color}"
                  onclick="appSwitchLine('${line.id}')">
            🚆 ${line.label}
          </button>
        `).join('')}
      </div>
    `;
  },

  /**
   * Render visual track reference with active train count
   */
  renderVisualTrackReference(lineId, activeCount) {
    const stationConfigs = {
      '117N': [
        { id: '34668', name: 'Union', pos: 3 },
        { id: '35246', name: '48th', pos: 25 },
        { id: '35254', name: '112th', pos: 70 },
        { id: '35365', name: '124th', pos: 97 }
      ],
      '113G': [
        { id: '34781', name: 'Union', pos: 5 },
        { id: '34544', name: 'Pecos', pos: 35 },
        { id: '34541', name: 'Olde Town', pos: 70 },
        { id: '34510', name: 'Ward', pos: 95 }
      ],
      '113B': [
        { id: '34782', name: 'Union', pos: 5 },
        { id: '34544', name: 'Pecos', pos: 50 },
        { id: '34560', name: 'Westminster', pos: 95 }
      ]
    };

    const stations = stationConfigs[lineId] || [];
    const myStation = this.config.myStations[lineId];

    return `
      <div class="visual-track-reference">
        <div class="track-header">
          <div class="track-title">🚆 ${lineId} Route Map</div>
          <div class="track-count">${activeCount} Active Train${activeCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="track-line-simple">
          ${stations.map(station => `
            <div class="track-station-simple ${station.id === myStation ? 'my-station' : ''}"
                 style="left: ${station.pos}%">
              <div class="station-dot-simple"></div>
              <div class="station-label-simple">
                ${station.id === myStation ? '⭐ ' : ''}${station.name}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render "Your Station" focus area
   */
  renderYourStation(stationData, lineId) {
    const myStationId = this.config.myStations[lineId];
    const stationName = this.config.stations[lineId].find(s => s.id === myStationId)?.name || 'Your Station';

    // Defensive: Check if data exists and has the expected structure
    if (!stationData || stationData._isFallback || !stationData.northbound || !stationData.southbound) {
      console.log(`⚠️ No valid data for ${lineId} station ${myStationId}:`, stationData);
      return `
        <div class="your-station-section">
          <h3 class="section-title">⭐ ${stationName}</h3>
          <div class="no-trains">
            <div class="no-trains-icon">🚉</div>
            <p class="no-trains-subtitle">No upcoming trains available</p>
          </div>
        </div>
      `;
    }

    const nextNB = (stationData.northbound || []).slice(0, 2);
    const nextSB = (stationData.southbound || []).slice(0, 2);

    return `
      <div class="your-station-section">
        <h3 class="section-title">⭐ ${stationName}</h3>
        <div class="your-station-grid">
          <div class="direction-column">
            <div class="direction-header northbound">
              <span class="direction-icon">⬆️</span>
              <span class="direction-label">Northbound</span>
            </div>
            <div class="train-list-compact">
              ${nextNB.length > 0 ? nextNB.map(train => {
                const minutesAway = Math.max(0, train.minutesAway);

                // Determine status from GTFS data
                let status = 'Scheduled';
                if (minutesAway <= 1) {
                  status = 'Arriving';
                } else if (minutesAway <= 5) {
                  status = 'Approaching';
                }

                return `
                  <div class="train-item-compact">
                    <div class="train-info-left">
                      <div class="train-time-compact">
                        ${new Date(train.time * 1000).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                      <div class="train-status-label">${status}</div>
                    </div>
                    <div class="train-countdown-compact ${
                      minutesAway < 2 ? 'imminent' :
                      minutesAway < 5 ? 'soon' : ''
                    }">
                      ${minutesAway < 1 ? 'Now' : `${minutesAway} min`}
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="no-trains-compact">No trains scheduled</div>
              `}
            </div>
          </div>

          <div class="direction-column">
            <div class="direction-header southbound">
              <span class="direction-icon">⬇️</span>
              <span class="direction-label">Southbound</span>
            </div>
            <div class="train-list-compact">
              ${nextSB.length > 0 ? nextSB.map(train => {
                const minutesAway = Math.max(0, train.minutesAway);

                // Determine status from GTFS data
                let status = 'Scheduled';
                if (minutesAway <= 1) {
                  status = 'Arriving';
                } else if (minutesAway <= 5) {
                  status = 'Approaching';
                }

                return `
                  <div class="train-item-compact">
                    <div class="train-info-left">
                      <div class="train-time-compact">
                        ${new Date(train.time * 1000).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                      <div class="train-status-label">${status}</div>
                    </div>
                    <div class="train-countdown-compact ${
                      minutesAway < 2 ? 'imminent' :
                      minutesAway < 5 ? 'soon' : ''
                    }">
                      ${minutesAway < 1 ? 'Now' : `${minutesAway} min`}
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="no-trains-compact">No trains scheduled</div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render all stations quick view
   */
  renderAllStationsQuickView(lineId, lineData) {
    const stations = this.config.stations[lineId] || [];
    const myStationId = this.config.myStations[lineId];

    return `
      <div class="all-stations-section">
        <h3 class="section-title">📊 All Stations</h3>
        <div class="stations-table">
          <div class="stations-table-header">
            <div class="station-name-col">Station</div>
            <div class="station-next-col">Next NB</div>
            <div class="station-next-col">Next SB</div>
          </div>
          ${stations.map(station => {
            const data = lineData[station.id];
            const nextNB = data?.northbound?.[0];
            const nextSB = data?.southbound?.[0];
            const isMyStation = station.id === myStationId;

            // Handle negative times
            const nbMinutes = nextNB ? Math.max(0, nextNB.minutesAway) : null;
            const sbMinutes = nextSB ? Math.max(0, nextSB.minutesAway) : null;

            return `
              <div class="stations-table-row ${isMyStation ? 'my-station-row' : ''}">
                <div class="station-name-col">
                  ${isMyStation ? '⭐ ' : ''}${station.name}
                </div>
                <div class="station-next-col">
                  ${nextNB ? `
                    <span class="next-train-time">${nbMinutes < 1 ? 'Now' : `${nbMinutes} min`}</span>
                    <span class="next-train-clock">${new Date(nextNB.time * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  ` : '<span class="no-train">—</span>'}
                </div>
                <div class="station-next-col">
                  ${nextSB ? `
                    <span class="next-train-time">${sbMinutes < 1 ? 'Now' : `${sbMinutes} min`}</span>
                    <span class="next-train-clock">${new Date(nextSB.time * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  ` : '<span class="no-train">—</span>'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render drive tab
   */
  renderDriveTab() {
    const { morning, evening } = this.state.driveTime;
    const weather = this.state.weather;

    return `
      <div class="drive-cards fade-in">
        ${this.renderDriveCard('Morning Commute', '☀️', morning, weather)}
        ${this.renderDriveCard('Evening Commute', '🌙', evening, weather)}
      </div>
    `;
  },

  /**
   * Render individual drive card
   */
  renderDriveCard(title, icon, driveData, weather) {
    if (!driveData) {
      return `
        <div class="card drive-card">
          <div class="skeleton" style="height: 200px;"></div>
        </div>
      `;
    }

    const trafficContext = weather && !weather._isFallback
      ? `Light traffic expected; ${weather.description} with temperatures around ${weather.temp}°F`
      : 'Traffic conditions updating...';

    return `
      <div class="card drive-card">
        <div class="card-header">
          <div class="card-title">${icon} ${title}</div>
          <div style="font-size: 1.5rem;">🚗</div>
        </div>

        <div class="drive-time">${driveData.minutes} min</div>

        <div class="drive-context">${trafficContext}</div>

        ${driveData._isFallback ? `
          <div style="background: var(--warning); color: white; padding: 0.5rem; border-radius: 0.5rem; margin-top: 1rem; font-size: 0.875rem; text-align: center;">
            ⚠️ Using estimated times
          </div>
        ` : ''}

        <div class="drive-toggle">
          <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
            🛣️ Avoid Highways
          </div>
          <label class="toggle">
            <input type="checkbox"
                   ${this.state.avoidHighways ? 'checked' : ''}
                   onchange="appToggleHighways()">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="drive-updated">
          Updated ${this.timeAgo(this.state.lastRefresh)}
        </div>
      </div>
    `;
  },

  /**
   * Render transit tab
   */
  renderTransitTab() {
    const lineId = this.state.selectedLine;
    const data = this.state.transitData[lineId];
    const stations = this.config.stations[lineId] || [];
    const selectedStation = this.state.selectedStation[lineId];

    if (this.state.loading.transit || !data) {
      return `
        <div class="card">
          <div class="skeleton" style="height: 400px;"></div>
        </div>
      `;
    }

    // Get next train
    const allArrivals = [...data.northbound, ...data.southbound];
    const nextTrain = allArrivals.length > 0 ? allArrivals[0] : null;

    return `
      <div class="card transit-card fade-in">
        <div class="station-selector">
          <select onchange="appChangeStation('${lineId}', this.value)">
            ${stations.map(station => `
              <option value="${station.id}" ${selectedStation === station.id ? 'selected' : ''}>
                ${station.name}
              </option>
            `).join('')}
          </select>
        </div>

        ${this.renderVisualTrack(lineId)}

        <div class="station-board">
          <div class="station-board-header">
            <h3 class="station-board-title">📍 ${data.stopName}</h3>
            ${nextTrain ? `
              <div class="next-train-badge">
                🔔 Next train: ${nextTrain.minutesAway} min
              </div>
            ` : ''}
          </div>

          ${allArrivals.length > 0 ? `
            ${data.northbound.length > 0 ? `
              <div class="station-section">
                <div class="section-header arriving">
                  <span class="section-icon">🚆</span>
                  <h4 class="section-title">Trains Arriving</h4>
                  <span class="section-subtitle">Northbound</span>
                </div>
                <div class="train-list">
                  ${data.northbound.map(train => `
                    <div class="train-item fade-in">
                      <div class="train-time">${new Date(train.time * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                      <div class="train-countdown ${train.minutesAway < 5 ? 'imminent' : train.minutesAway < 15 ? 'soon' : ''}">
                        ${train.minutesAway} min
                      </div>
                      <div class="train-status">Arriving</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${data.southbound.length > 0 ? `
              <div class="station-section">
                <div class="section-header departing">
                  <span class="section-icon">🚀</span>
                  <h4 class="section-title">Trains Departing</h4>
                  <span class="section-subtitle">Southbound</span>
                </div>
                <div class="train-list">
                  ${data.southbound.map(train => `
                    <div class="train-item fade-in">
                      <div class="train-time">${new Date(train.time * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                      <div class="train-countdown ${train.minutesAway < 5 ? 'imminent' : train.minutesAway < 15 ? 'soon' : ''}">
                        ${train.minutesAway} min
                      </div>
                      <div class="train-status">Departing</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          ` : `
            <div class="no-trains">
              <div class="no-trains-icon">🚉</div>
              <p class="no-trains-title">No upcoming trains</p>
              <p class="no-trains-subtitle">Service may be limited at this time</p>
            </div>
          `}
        </div>
      </div>
    `;
  },

  /**
   * Render visual track with live train positions
   */
  renderVisualTrack(lineId) {
    const vehicles = this.state.vehiclePositions.vehicles.filter(v => v.routeId === lineId);

    // Station configurations for each line
    const stationConfigs = {
      '117N': [
        { id: '34668', name: 'Union', pos: 3 },
        { id: '35246', name: '48th', pos: 25 },
        { id: '35254', name: '112th', pos: 70 },
        { id: '35365', name: '124th', pos: 97 }
      ],
      '113G': [
        { id: '34781', name: 'Union', pos: 5 },
        { id: '34544', name: 'Pecos', pos: 35 },
        { id: '34541', name: 'Olde Town', pos: 70 },
        { id: '34510', name: 'Ward', pos: 95 }
      ],
      '113B': [
        { id: '34782', name: 'Union', pos: 5 },
        { id: '34544', name: 'Pecos', pos: 50 },
        { id: '34560', name: 'Westminster', pos: 95 }
      ]
    };

    const stations = stationConfigs[lineId] || [];

    return `
      <div class="visual-track-reference">
        <div class="track-header">
          <div class="track-title">🚆 ${lineId} Line</div>
          <div class="track-count">${vehicles.length} Active</div>
        </div>

        <div class="track-line-simple">
          ${stations.map(station => `
            <div class="track-station-simple" style="left: ${station.pos}%">
              <div class="station-dot-simple"></div>
              <div class="station-label-simple">${station.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render direction section
   */
  renderDirection(title, arrow, arrivals) {
    return `
      <div class="direction-section">
        <h4>${arrow} ${title}</h4>
        <div class="arrival-list">
          ${arrivals.length > 0 ? arrivals.map(arrival => `
            <div class="arrival-item">
              <div class="arrival-time">
                ${new Date(arrival.time * 1000).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
              <div class="arrival-countdown ${
                arrival.minutesAway < 5 ? 'imminent' :
                arrival.minutesAway < 15 ? 'soon' : ''
              }">
                ${arrival.minutesAway} min
              </div>
            </div>
          `).join('') : `
            <div style="text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.875rem;">
              No trains scheduled
            </div>
          `}
        </div>
      </div>
    `;
  },
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

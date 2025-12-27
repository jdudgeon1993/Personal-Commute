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
      home: { lat: 39.9526, lng: -105.0008 }, // Northglenn
      work: { lat: 39.7392, lng: -104.9903 }, // Denver Downtown
    },
    stations: {
      '117N': [
        { id: '35365', name: 'Eastlake & 124th (SB)' },
        { id: '35254', name: '112th / Northglenn (SB)' },
        { id: '35246', name: '48th & Brighton (SB)' },
        { id: '35255', name: '112th / Northglenn (NB)' },
        { id: '35247', name: '48th & Brighton (NB)' },
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
   * Fetch weather data
   */
  async fetchWeather() {
    const { lat, lng } = this.config.locations.home;
    this.state.weather = await API.getWeather(lat, lng);
  },

  /**
   * Fetch drive times (both morning and evening)
   */
  async fetchDriveTimes() {
    const { home, work } = this.config.locations;

    // Morning commute (home -> work)
    this.state.driveTime.morning = await API.getDriveTimes(
      home,
      work,
      this.state.avoidHighways
    );

    // Evening commute (work -> home)
    this.state.driveTime.evening = await API.getDriveTimes(
      work,
      home,
      this.state.avoidHighways
    );
  },

  /**
   * Fetch transit data for all lines
   */
  async fetchTransitData() {
    const lines = ['117N', '113G', '113B'];

    console.log('🚆 Fetching transit data for all lines...');
    for (const line of lines) {
      const stationId = this.state.selectedStation[line];
      console.log(`  → Line ${line}: Station ${stationId}`);
      this.state.transitData[line] = await API.getLineArrivals(stationId, line);
      console.log(`  ✓ Line ${line}: ${this.state.transitData[line].arrivals.length} arrivals`);
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
   * Set up event listeners
   */
  setupEventListeners() {
    // These will be attached via onclick in the HTML
    window.appRefresh = () => this.handleRefresh();
    window.appToggleTheme = () => this.toggleTheme();
    window.appSwitchTab = (tab) => this.switchTab(tab);
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

    app.innerHTML = `
      ${this.renderHeader()}
      ${this.renderTabs()}
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
   * Render main content
   */
  renderContent() {
    return `
      <div class="container" style="margin-top: 2rem; margin-bottom: 2rem;">
        ${this.state.activeTab === 'drive' ? this.renderDriveTab() : this.renderTransitTab()}
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

        <div class="transit-header">
          <div class="station-name">
            📍 ${data.stopName}
          </div>
          ${nextTrain ? `
            <div class="next-train-badge">
              🔔 Next: ${nextTrain.minutesAway} min
            </div>
          ` : ''}
        </div>

        <div class="arrivals-grid">
          ${this.renderDirection('Northbound', '↑', data.northbound)}
          ${this.renderDirection('Southbound', '↓', data.southbound)}
        </div>

        ${allArrivals.length === 0 ? `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🚉</div>
            <p style="font-weight: 600;">No upcoming trains</p>
            <p style="font-size: 0.875rem; margin-top: 0.5rem;">
              Service may be limited at this time
            </p>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Render visual track with live train positions
   */
  renderVisualTrack(lineId) {
    const vehicles = this.state.vehiclePositions.vehicles.filter(v => v.routeId === lineId);

    if (vehicles.length === 0) {
      return ''; // Don't show track if no vehicles
    }

    // Station configurations for each line
    const stationConfigs = {
      '117N': [
        { id: '34668', name: 'Union', lat: 39.7539, lng: -105.0000, pos: 3 },
        { id: '35246', name: '48th', lat: 39.7809, lng: -104.9693, pos: 25 },
        { id: '35254', name: '112th', lat: 39.9158, lng: -104.9872, pos: 70 },
        { id: '35365', name: '124th', lat: 39.9308, lng: -104.9900, pos: 97 }
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
    const northbound = vehicles.filter(v => v.directionId === 0);
    const southbound = vehicles.filter(v => v.directionId === 1);

    // Calculate train position on track (0-100%)
    const getTrainPosition = (vehicle) => {
      if (!vehicle.latitude || !vehicle.longitude || !stations[0].lat) {
        return 50; // Fallback
      }

      const trainLat = vehicle.latitude;
      const trainLng = vehicle.longitude;

      // Find closest stations
      const distances = stations.map((station, idx) => {
        const latDiff = trainLat - station.lat;
        const lngDiff = trainLng - station.lng;
        const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        return { station, idx, dist };
      });

      distances.sort((a, b) => a.dist - b.dist);
      const closest = distances[0];
      const secondClosest = distances[1];

      const station1 = closest.idx < secondClosest.idx ? closest : secondClosest;
      const station2 = closest.idx < secondClosest.idx ? secondClosest : closest;

      const totalDist = station1.dist + station2.dist;
      const ratio = station1.dist / totalDist;

      const position = station1.station.pos + (station2.station.pos - station1.station.pos) * ratio;
      return Math.max(1, Math.min(99, position));
    };

    return `
      <div class="visual-track">
        <div class="track-header">
          <div class="track-title">🚆 Live Train Positions</div>
          <div class="track-count">${vehicles.length}</div>
        </div>

        ${northbound.length > 0 ? `
          <div class="track-direction">
            <div class="track-label">⬆️ Northbound</div>
            <div class="track-line">
              ${stations.map(station => `
                <div class="track-station" style="left: ${station.pos}%">
                  <div class="station-dot"></div>
                  <div class="station-label">${station.name}</div>
                </div>
              `).join('')}
              ${northbound.map(vehicle => `
                <div class="train-marker" style="left: ${getTrainPosition(vehicle)}%">
                  <div class="train-icon">🚆</div>
                  <div class="train-label">${vehicle.label || ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${southbound.length > 0 ? `
          <div class="track-direction">
            <div class="track-label">⬇️ Southbound</div>
            <div class="track-line">
              ${stations.map(station => `
                <div class="track-station" style="left: ${station.pos}%">
                  <div class="station-dot"></div>
                  <div class="station-label">${station.name}</div>
                </div>
              `).join('')}
              ${southbound.map(vehicle => `
                <div class="train-marker" style="left: ${getTrainPosition(vehicle)}%">
                  <div class="train-icon">🚆</div>
                  <div class="train-label">${vehicle.label || ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
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

/**
 * Commute Dashboard 2.0 - API Client
 * Clean separation of API calls and data transformation
 */

const API = {
  baseURL: window.location.origin,

  /**
   * Generic fetch wrapper with error handling
   */
  async fetch(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  },

  /**
   * Weather API
   */
  async getWeather(lat, lon) {
    try {
      const data = await this.fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      return {
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed),
        _isFallback: false,
      };
    } catch (error) {
      console.error('Weather API failed, using fallback');
      return this.getFallbackWeather();
    }
  },

  getFallbackWeather() {
    return {
      temp: 50,
      feelsLike: 48,
      description: 'Unavailable',
      icon: '01d',
      humidity: 50,
      windSpeed: 5,
      _isFallback: true,
    };
  },

  /**
   * Drive Time API
   */
  async getDriveTimes(origin, destination, avoidHighways = false) {
    try {
      const body = {
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng,
            },
          },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: avoidHighways,
          avoidFerries: true,
        },
        languageCode: 'en-US',
        units: 'IMPERIAL',
      };

      const data = await this.fetch('/api/routes', {
        method: 'POST',
        headers: {
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.staticDuration,routes.description',
        },
        body: JSON.stringify(body),
      });

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const duration = parseInt(route.duration);
        const minutes = Math.round(duration / 60);

        return {
          minutes,
          distance: Math.round(route.distanceMeters * 0.000621371), // meters to miles
          description: route.description || '',
          _isFallback: false,
        };
      } else {
        throw new Error('No routes found');
      }
    } catch (error) {
      console.error('Drive time API failed, using fallback');
      return this.getFallbackDriveTime();
    }
  },

  getFallbackDriveTime() {
    return {
      minutes: 30,
      distance: 15,
      description: 'Estimated',
      _isFallback: true,
    };
  },

  /**
   * RTD Transit API - Vehicle Positions
   */
  async getVehiclePositions() {
    try {
      const data = await this.fetch('/api/rtd/vehicle-positions');
      return {
        vehicles: data.vehicles || [],
        timestamp: data.timestamp,
        feedAgeSeconds: data.feedAgeSeconds,
        _isFallback: false,
      };
    } catch (error) {
      console.error('Vehicle positions API failed');
      return {
        vehicles: [],
        timestamp: Date.now(),
        feedAgeSeconds: 0,
        _isFallback: true,
      };
    }
  },

  /**
   * RTD Transit API - Station Arrivals
   */
  async getStationArrivals(stopId, routeId) {
    try {
      let endpoint = '';

      // Route to correct API based on line
      if (routeId === '117N') {
        endpoint = `/api/rtd/arrivals/${stopId}`;
      } else {
        endpoint = `/api/rtd/gline/${stopId}`;
      }

      console.log(`🚆 Fetching arrivals: ${endpoint} for route ${routeId}`);
      const data = await this.fetch(endpoint);
      console.log(`📊 API Response for ${stopId}:`, data);

      // Normalize the response
      const arrivals = (data.arrivals || [])
        .filter(arrival => {
          const matches = arrival.routeId === routeId;
          if (!matches) {
            console.log(`⏭️ Skipping arrival with routeId ${arrival.routeId} (looking for ${routeId})`);
          }
          return matches;
        })
        .map(arrival => ({
          time: arrival.arrivalTime || arrival.departureTime,
          timeFormatted: arrival.arrivalTimeFormatted || arrival.departureTimeFormatted,
          routeId: arrival.routeId,
          directionId: arrival.directionId,
          tripId: arrival.tripId,
          minutesAway: Math.round((arrival.arrivalTime - Date.now() / 1000) / 60),
        }))
        .sort((a, b) => a.time - b.time);

      console.log(`✅ Processed ${arrivals.length} arrivals for ${routeId} at ${stopId}`);

      return {
        stopId,
        stopName: data.stopName || stopId,
        arrivals,
        timestamp: data.timestamp,
        _isFallback: false,
      };
    } catch (error) {
      console.error(`❌ Station arrivals API failed for ${stopId}:`, error);
      return {
        stopId,
        stopName: stopId,
        arrivals: [],
        timestamp: Date.now(),
        _isFallback: true,
      };
    }
  },

  /**
   * Get all arrivals for a line with direction grouping
   */
  async getLineArrivals(stopId, routeId) {
    const data = await this.getStationArrivals(stopId, routeId);

    // Group by direction
    const northbound = data.arrivals.filter(a => a.directionId === 0);
    const southbound = data.arrivals.filter(a => a.directionId === 1);

    return {
      ...data,
      northbound: northbound.slice(0, 3), // Limit to next 3 trains
      southbound: southbound.slice(0, 3),
    };
  },
};

// Export for use in other modules
window.API = API;

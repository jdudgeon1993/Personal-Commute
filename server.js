const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// API Keys from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Google Maps Routes API endpoint
app.post('/api/routes', async (req, res) => {
  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': req.headers['x-goog-fieldmask'] || 'routes.duration,routes.distanceMeters,routes.staticDuration'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Google Maps API error' });
    }

    res.json(data);
  } catch (error) {
    console.error('Routes API error:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// Google Maps Geocoding API endpoint
app.get('/api/geocode', async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Geocoding API error' });
    }

    res.json(data);
  } catch (error) {
    console.error('Geocoding API error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// OpenWeather API endpoint
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude parameters are required' });
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=imperial`
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Weather API error' });
    }

    res.json(data);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

// RTD N Line API proxy (optional - can call directly from frontend since it's public)
app.get('/api/rtd/arrivals/:stopId', async (req, res) => {
  try {
    const { stopId } = req.params;
    const response = await fetch(
      `https://rtd-n-line-api.onrender.com/api/rtd/arrivals/${stopId}?t=${Date.now()}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'RTD API error' });
    }

    res.json(data);
  } catch (error) {
    console.error('RTD API error:', error);
    res.status(500).json({ error: 'Failed to fetch RTD data' });
  }
});

// RTD G Line API - Back to rtd-n-line-api but with better error handling
app.get('/api/rtd/gline/:stopId', async (req, res) => {
  try {
    const { stopId } = req.params;
    console.log(`🔍 Fetching G Line data for stop ${stopId}`);

    const response = await fetch(
      `https://rtd-n-line-api.onrender.com/api/rtd/arrivals/${stopId}?t=${Date.now()}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    console.log(`📊 G Line response for stop ${stopId}:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      return res.status(response.status).json({ error: 'RTD G Line API error' });
    }

    res.json(data);
  } catch (error) {
    console.error('❌ RTD G Line API error:', error);
    res.status(500).json({ error: 'Failed to fetch G Line data', details: error.message });
  }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Commute Dashboard server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);

  // Verify API keys are loaded
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️  WARNING: GOOGLE_MAPS_API_KEY not found in environment variables');
  }
  if (!OPENWEATHER_API_KEY) {
    console.warn('⚠️  WARNING: OPENWEATHER_API_KEY not found in environment variables');
  }
});

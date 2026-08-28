const https = require('https');

// Kurse-Cache (in-memory für Vercel serverless)
let cache = {
  data: {},
  timestamp: 0
};

const CACHE_DURATION = 30 * 60 * 1000; // 30 Minuten

// Ticker-Mapping
const tickers = {
  'DE000VY3C2P9': 'INTC',
  'DE000GN0QA05': 'BAY.DE',
  'DE000LB65Q99': 'RWE.DE',
  'DE000BD30TZ1': 'PRY.MI',
  'DE000BD317G0': 'INTC',
  'DE000GN1XS70': 'LHA.DE',
  'DE000GN2NKL1': 'ADS.DE',
  'DE000PJ8HUR1': 'BEI.DE',
  'DE000LB34H98': 'VOW3.DE'
};

function fetchKurs(ticker) {
  return new Promise((resolve) => {
    // Versuche über Alpha Vantage (kostenlos, aber langsam)
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const price = json?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw;
          resolve(price ? parseFloat(price).toFixed(2) : null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function updateKurse() {
  const kurse = {};
  
  // Nur UNIQUE Tickers holen (INTC kommt 2x vor)
  const uniqueTickers = [...new Set(Object.values(tickers))];
  
  for (const ticker of uniqueTickers) {
    const kurs = await fetchKurs(ticker);
    if (kurs) {
      kurse[ticker] = kurs;
    }
  }
  
  return kurse;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  // Cache-Check
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return res.status(200).json({ kurse: cache.data, cached: true });
  }
  
  // Neue Kurse holen
  const kurse = await updateKurse();
  
  // Cache updaten
  cache.data = kurse;
  cache.timestamp = now;
  
  // Response mit Mapping
  const response = {};
  Object.entries(tickers).forEach(([isin, ticker]) => {
    response[isin] = kurse[ticker] || null;
  });
  
  res.status(200).json({ kurse: response, cached: false });
};

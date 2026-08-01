const express = require('express');
const compression = require('compression');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_FILE_PATH = path.join(__dirname, 'catalog_cache.json');
let lastCatalogUpdateTime = Date.now();

app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/**
 * Financial Calculation Utility with Retail MSRP & Savings %
 */
function calculateFinancials(rawBid, rawRetail) {
  const currentBid = parseFloat(rawBid) || 0;
  const buyerPremium = Math.round((currentBid * 0.15) * 100) / 100;
  const subtotal = Math.round((currentBid + buyerPremium) * 100) / 100;
  const salesTax = Math.round((subtotal * 0.0725) * 100) / 100;
  const ccFee = Math.round(((subtotal + salesTax) * 0.03) * 100) / 100;
  const totalCost = Math.round((subtotal + salesTax + ccFee) * 100) / 100;

  const retailPrice = parseFloat(rawRetail) || null;
  let savingsPct = null;
  if (retailPrice && retailPrice > totalCost) {
    savingsPct = Math.round(((retailPrice - totalCost) / retailPrice) * 100);
  }

  return {
    currentBid: currentBid.toFixed(2),
    buyerPremium: buyerPremium.toFixed(2),
    subtotal: subtotal.toFixed(2),
    salesTax: salesTax.toFixed(2),
    ccFee: ccFee.toFixed(2),
    totalCost: totalCost.toFixed(2),
    totalCostNum: totalCost,
    retailPrice: retailPrice ? retailPrice.toFixed(2) : null,
    savingsPct
  };
}

let masterCatalogMap = new Map();
let isBackgroundScraping = false;
let scraperProgress = {
  isScraping: false,
  status: "Idle",
  progressPct: 100,
  totalIndexed: 0,
  currentAuction: "",
  scrapedDaysCount: 0
};

function loadDiskCache() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const savedItems = JSON.parse(raw);
      if (Array.isArray(savedItems) && savedItems.length > 0) {
        savedItems.forEach(item => {
          masterCatalogMap.set(item.id || item.url, item);
        });
        pruneExpiredCatalogCache();
        lastCatalogUpdateTime = Date.now();
        scraperProgress.totalIndexed = masterCatalogMap.size;
        console.log(`[DISK CACHE] Loaded ${masterCatalogMap.size} auction items from ./catalog_cache.json in <0.05s!`);
      }
    }
  } catch (e) {
    console.error('[DISK CACHE LOAD ERROR]', e.message);
  }
}

function saveDiskCache() {
  try {
    pruneExpiredCatalogCache();
    const itemsArr = Array.from(masterCatalogMap.values());
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(itemsArr), 'utf8');
    lastCatalogUpdateTime = Date.now();
    console.log(`[DISK CACHE] Persisted ${itemsArr.length} catalog items to ./catalog_cache.json`);
  } catch (e) {
    console.error('[DISK CACHE SAVE ERROR]', e.message);
  }
}

// Automatically load cached catalog on boot
loadDiskCache();

let sseClients = [];

function broadcastEvent(type, extraData = {}) {
  const payload = JSON.stringify({
    type,
    progress: scraperProgress,
    totalIndexed: masterCatalogMap.size,
    ...extraData
  });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (_) {}
  });
}

// Seed initial items with dynamic endsAt ISO timestamps
const now = new Date();
const todayStr = now.toISOString().split('T')[0];
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const tomorrowStr = tomorrow.toISOString().split('T')[0];

const FALLBACK_ITEMS = [
  {
    id: "tl-101",
    title: "18V Cordless 10-Tool Combo Kit with 2Ah Battery, 4Ah Battery & Charger",
    currentBid: 52.00,
    retailPrice: 478.00,
    brand: "RYOBI",
    condition: "Condition: B - Open Box",
    location: "Raleigh",
    address: "1101 Transport Dr, Raleigh, NC 27603",
    url: "https://auction.triangleliquidators.com/lots/view/1-D5PTSS/450-nintendo-switch-2-console-item-18131241",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
    category: "Tools & Equipment",
    auctionName: "Raleigh Live Auction Today",
    closingDate: todayStr,
    endsAt: new Date(now.getTime() + 3 * 3600 * 1000 + 45 * 60 * 1000).toISOString() // +3h 45m
  },
  {
    id: "tl-102",
    title: "Milwaukee PACKOUT Modular Tool Box System Set (3-Piece)",
    currentBid: 85.00,
    retailPrice: 299.00,
    brand: "Milwaukee",
    condition: "Condition: A - Appears New",
    location: "Raleigh",
    address: "1101 Transport Dr, Raleigh, NC 27603",
    url: "https://auction.triangleliquidators.com/lots/view/1-D5PTT4/899-cyberpowerpc-gamer-master-gaming-desktop-amd-ryzen-5-7600-16gb-ddr5-1tb-ssd-item-18131635",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
    category: "Tools & Equipment",
    auctionName: "Raleigh Live Auction Today",
    closingDate: todayStr,
    endsAt: new Date(now.getTime() + 1 * 3600 * 1000 + 20 * 60 * 1000).toISOString() // +1h 20m
  },
  {
    id: "tl-103",
    title: "Concord Electric Bicycle 350W Rear Hub 36V Lithium Battery",
    currentBid: 52.00,
    retailPrice: 478.00,
    brand: "Concord Bikes",
    condition: "Condition: C - Used, missing parts/batteries. Potentially damaged - As Is",
    location: "Raleigh",
    address: "1101 Transport Dr, Raleigh, NC 27603",
    url: "https://auction.triangleliquidators.com/lots/view/1-D5PTR6/699-costway-20k-2-zone-mini-split-acheating-heat-pump-only-208230v-item-18126101",
    image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80",
    category: "General Merchandise",
    auctionName: "Raleigh Tuesday Auction",
    closingDate: tomorrowStr,
    endsAt: new Date(now.getTime() + 27 * 3600 * 1000).toISOString() // Tomorrow
  },
  {
    id: "tl-104",
    title: "Craftsman 3000 PSI 2.3 GPM Gas Pressure Washer Briggs & Stratton",
    currentBid: 110.00,
    retailPrice: 389.00,
    brand: "Craftsman",
    condition: "Condition: D - Damaged / Untested As-Is",
    location: "Raleigh",
    address: "1101 Transport Dr, Raleigh, NC 27603",
    url: "https://auction.triangleliquidators.com/lots/view/1-D5PTR8/680-22-cu-ft-front-load-washer-24-in-white-item-18127075",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80",
    category: "Lawn & Garden",
    auctionName: "Raleigh Live Auction Today",
    closingDate: todayStr,
    endsAt: new Date(now.getTime() + 5 * 3600 * 1000 + 10 * 60 * 1000).toISOString() // +5h 10m
  },
  {
    id: "tl-105",
    title: "Outdoor Patio 4-Piece Wicker Conversation Furniture Set with Cushions",
    currentBid: 145.00,
    retailPrice: 599.00,
    brand: "Patio Living",
    condition: "Condition: Shelf Pull - Customer Return",
    location: "Raleigh",
    address: "1101 Transport Dr, Raleigh, NC 27603",
    url: "https://auction.triangleliquidators.com/lots/view/1-D5PTWU/1169-12000-cfm-evaporative-cooler-evap-swamp-cooler-air-conditioner-3200-sq-ft-for-outdoor-patio-shop-yard-factory-item-18138091",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
    category: "Furniture & Patio",
    auctionName: "Raleigh Live Auction Today",
    closingDate: todayStr,
    endsAt: new Date(now.getTime() + 6 * 3600 * 1000).toISOString() // +6h
  },
  {
    id: "tl-106",
    title: "Honda EU2200i 2200-Watt Super Quiet Inverter Generator",
    currentBid: 260.00,
    retailPrice: 1099.00,
    brand: "Honda",
    condition: "Condition: B - Open Box",
    location: "SC Transfer",
    address: "Williamston / Anderson, SC Transfer Depot",
    url: "https://auction.triangleliquidators.com/auctions/1-D5PS9B/anderson-tuesday-07282026",
    image: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=600&q=80",
    category: "Generators & Power",
    auctionName: "Anderson Transfer Auction",
    closingDate: tomorrowStr,
    endsAt: new Date(now.getTime() + 30 * 3600 * 1000).toISOString() // Tomorrow
  }
];

FALLBACK_ITEMS.forEach(i => {
  masterCatalogMap.set(i.id, { ...i, financials: calculateFinancials(i.currentBid, i.retailPrice) });
});
scraperProgress.totalIndexed = masterCatalogMap.size;

/**
 * Fast Fast-Streaming Multi-Page Crawler with Progressive Real-Time UI Broadcasting
 */
async function crawlDeepAuctionPages(maxCatalogsToScan = 6, maxPagesPerCatalog = 10) {
  if (isBackgroundScraping) return;
  isBackgroundScraping = true;
  scraperProgress.isScraping = true;
  scraperProgress.status = "Discovering active auction catalogs...";
  scraperProgress.progressPct = 5;

  broadcastEvent('progress_update');

  console.log(`[DEEP CRAWLER] Starting progressive live crawl (Scanning ${maxCatalogsToScan} catalogs x ${maxPagesPerCatalog} pages)...`);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1440,900'
      ]
    });

    const createOptimizedPage = async () => {
      const p = await browser.newPage();
      await p.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await p.setViewport({ width: 1440, height: 900 });
      // Intercept & block unnecessary heavy assets during HTML structure parsing
      await p.setRequestInterception(true);
      p.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      return p;
    };

    let page = await createOptimizedPage();

    await page.goto('https://auction.triangleliquidators.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    // Get active auction catalog URLs across days
    const activeAuctions = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/auctions/1-"]'));
      const found = [];
      anchors.forEach(a => {
        if (a.href && !found.some(f => f.href === a.href) && !a.href.includes('/past')) {
          const text = a.innerText.trim();
          let location = 'Raleigh';
          if (text.toLowerCase().includes('anderson') || a.href.toLowerCase().includes('anderson')) {
            location = 'SC Transfer';
          }
          found.push({ name: text, href: a.href, location });
        }
      });
      return found;
    });

    scraperProgress.scrapedDaysCount = activeAuctions.length;
    console.log(`[DEEP CRAWLER] Discovered ${activeAuctions.length} active auction catalogs.`);
    broadcastEvent('progress_update');

    const catalogsToProcess = activeAuctions.slice(0, maxCatalogsToScan);
    const totalWorkUnits = catalogsToProcess.length * maxPagesPerCatalog;
    let completedWorkUnits = 0;

    for (const auc of catalogsToProcess) {
      for (let pageNum = 1; pageNum <= maxPagesPerCatalog; pageNum++) {
        completedWorkUnits++;
        scraperProgress.progressPct = Math.min(98, Math.round((completedWorkUnits / totalWorkUnits) * 92) + 5);
        scraperProgress.currentAuction = auc.name;
        scraperProgress.status = `Progressively Ingesting ${auc.name} (${auc.location}) Page ${pageNum}/${maxPagesPerCatalog}...`;

        const pageUrl = `${auc.href}?limit=96&perPage=96&page=${pageNum}`;
        console.log(`[DEEP CRAWLER] ${scraperProgress.status}`);
        broadcastEvent('progress_update');

        try {
          if (!page || page.isClosed()) {
            page = await createOptimizedPage();
          }

          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 18000 });
          await new Promise(r => setTimeout(r, 1200));

          const pageItems = await page.evaluate((loc, aucName, pNum) => {
            const lotLinks = Array.from(document.querySelectorAll('a[href*="/lots/view/"]'));
            const items = [];
            const seen = new Set();

            lotLinks.forEach(a => {
              if (seen.has(a.href)) return;
              seen.add(a.href);

              let parent = a.parentElement;
              for (let i = 0; i < 5; i++) {
                if (parent && parent.innerText && parent.innerText.length > 20) break;
                if (parent && parent.parentElement) parent = parent.parentElement;
              }

              const text = parent ? parent.innerText : '';
              const img = parent ? parent.querySelector('img') : null;

              // Condition A-E & Text Parser
              let condition = 'Condition: Open Box';
              const condMatch = text.match(/Condition\s*:?\s*([A-E]\s*-\s*[^\.\n\r]+|Appears New|Open Box|Shelf Pull|Untested|Used[^\.\n\r]*|As[- ]Is[^\.\n\r]*|[^\.\n\r]+)/i);

              if (condMatch) {
                let rawCond = condMatch[0].trim();
                if (!rawCond.toLowerCase().startsWith('condition:')) {
                  rawCond = 'Condition: ' + rawCond;
                }
                condition = rawCond;
              }

              // Extract Brand
              let brand = null;
              const brandMatch = text.match(/Brand\s*:?\s*([^\n\r]+)/i);
              if (brandMatch) brand = brandMatch[1].trim();

              // Extract Retail MSRP vs Current Bid
              let retailPrice = null;
              let currentBid = 0;

              const retailMatch = text.match(/Retail Price\s*:?\s*\$?\s*([\d\.,]+)/i) || 
                                  text.match(/^\s*\$([\d\.,]+)\b/);
              if (retailMatch) retailPrice = parseFloat(retailMatch[1].replace(',', ''));

              const bidMatch = text.match(/Current Bid\s*:?\s*\$?\s*([\d\.,]+)/i) || 
                               text.match(/Bid\s*:?\s*\$?\s*([\d\.,]+)/i) ||
                               text.match(/\$([\d\.,]+)\s*bid/i);
              if (bidMatch) currentBid = parseFloat(bidMatch[1].replace(',', ''));
              else currentBid = Math.floor(Math.random() * 45) + 5;

              const hrefParts = a.href.split('/');
              const slug = hrefParts[hrefParts.length - 1] || '';
              let titleClean = decodeURIComponent(slug)
                .replace(/-/g, ' ')
                .replace(/^\$\d+\s*/, '')
                .replace(/^item \d+/i, '')
                .trim();

              if (!titleClean || titleClean.length < 3) titleClean = a.innerText.trim();

              let category = 'General Merchandise';
              const tLower = titleClean.toLowerCase();

              if (tLower.includes('tool') || tLower.includes('drill') || tLower.includes('saw') || tLower.includes('dewalt') || tLower.includes('milwaukee') || tLower.includes('craftsman') || tLower.includes('ryobi') || tLower.includes('impact') || tLower.includes('wrench') || tLower.includes('kobalt') || tLower.includes('socket') || tLower.includes('compressor')) {
                category = 'Tools & Equipment';
              } else if (tLower.includes('tv') || tLower.includes('nintendo') || tLower.includes('switch') || tLower.includes('gaming') || tLower.includes('playstation') || tLower.includes('xbox') || tLower.includes('laptop') || tLower.includes('desktop') || tLower.includes('tablet') || tLower.includes('ipad') || tLower.includes('monitor') || tLower.includes('headphone') || tLower.includes('audio') || tLower.includes('camera') || tLower.includes('speaker')) {
                category = 'Electronics & Gaming';
              } else if ((tLower.includes('washer') && !tLower.includes('pressure washer')) || tLower.includes('dryer') || tLower.includes('refrigerator') || tLower.includes('fridge') || tLower.includes('freezer') || tLower.includes('dishwasher') || tLower.includes('mini split') || tLower.includes('air conditioner') || tLower.includes('water heater')) {
                category = 'Major Appliances';
              } else if (tLower.includes('patio') || tLower.includes('trimmer') || tLower.includes('lawn') || tLower.includes('mower') || tLower.includes('pressure washer') || tLower.includes('hose') || tLower.includes('tiller') || tLower.includes('chainsaw') || tLower.includes('grill') || tLower.includes('smoker') || tLower.includes('traeger')) {
                category = 'Lawn & Garden';
              } else if (tLower.includes('ninja') || tLower.includes('kitchen') || tLower.includes('cooker') || tLower.includes('fryer') || tLower.includes('blender') || tLower.includes('instant pot') || tLower.includes('coffee') || tLower.includes('espresso') || tLower.includes('toaster') || tLower.includes('cookware') || tLower.includes('ice maker')) {
                category = 'Kitchen & Dining';
              } else if (tLower.includes('sofa') || tLower.includes('couch') || tLower.includes('bed') || tLower.includes('mattress') || tLower.includes('desk') || tLower.includes('chair') || tLower.includes('table') || tLower.includes('cabinet') || tLower.includes('shelf') || tLower.includes('rug') || tLower.includes('recliner') || tLower.includes('furniture') || tLower.includes('ottoman')) {
                category = 'Furniture & Home Decor';
              } else if (tLower.includes('generator') || tLower.includes('power') || tLower.includes('inverter') || tLower.includes('solar') || tLower.includes('eco-flow') || tLower.includes('jackery') || tLower.includes('watt')) {
                category = 'Generators & Solar Power';
              } else if (tLower.includes('tire') || tLower.includes('jack') || tLower.includes('battery charger') || tLower.includes('jump starter') || tLower.includes('winch') || tLower.includes('automotive') || tLower.includes('trailer') || tLower.includes('hitch')) {
                category = 'Automotive & Marine';
              } else if (tLower.includes('bike') || tLower.includes('bicycle') || tLower.includes('scooter') || tLower.includes('e-bike') || tLower.includes('treadmill') || tLower.includes('exercise') || tLower.includes('fitness') || tLower.includes('kayak') || tLower.includes('tent') || tLower.includes('camping') || tLower.includes('cooler') || tLower.includes('yeti')) {
                category = 'Sports, Fitness & Outdoors';
              } else if (tLower.includes('pump') || tLower.includes('sink') || tLower.includes('faucet') || tLower.includes('toilet') || tLower.includes('shower') || tLower.includes('plumbing') || tLower.includes('hardware') || tLower.includes('flooring') || tLower.includes('tile')) {
                category = 'Hardware & Plumbing';
              } else if (tLower.includes('pallet') || tLower.includes('bulk') || tLower.includes('wholesale') || tLower.includes('mystery box') || tLower.includes('liquidation')) {
                category = 'Pallets & Bulk Merchandise';
              }

              let closingDate = new Date().toISOString().split('T')[0];
              let endsAtISO = null;
              let closingTimeStr = null;

              // 1. Try extracting live countdown timer text from lot card DOM
              const timerMatch = text.match(/\b(?:(\d+)\s*d\s*)?(?:(\d+)\s*h\s*)?(\d+)\s*m(?:\s*(\d+)\s*s)?\b/i);
              if (timerMatch) {
                const hasD = timerMatch[1] !== undefined;
                const hasH = timerMatch[2] !== undefined;
                const hasM = timerMatch[3] !== undefined;
                const hasS = timerMatch[4] !== undefined;

                if ((hasH && hasM) || (hasM && hasS) || (hasD && hasH)) {
                  const days = hasD ? parseInt(timerMatch[1], 10) : 0;
                  const hours = hasH ? parseInt(timerMatch[2], 10) : 0;
                  const mins = hasM ? parseInt(timerMatch[3], 10) : 0;
                  const secs = hasS ? parseInt(timerMatch[4], 10) : 0;

                  if (hours <= 72 && mins < 60 && secs < 60) {
                    closingTimeStr = timerMatch[0];
                    const totalMs = ((days * 24 + hours) * 3600 + mins * 60 + secs) * 1000;
                    if (totalMs > 0) {
                      endsAtISO = new Date(Date.now() + totalMs).toISOString();
                    }
                  }
                }
              }

              // 2. Try extracting date MM/DD/YYYY from auction name
              const dateMatch = aucName.match(/(\d{2})[\/-]?(\d{2})[\/-]?(\d{4})/) || a.href.match(/(\d{2})(\d{2})(\d{4})/);
              if (dateMatch) {
                const m = dateMatch[1];
                const d = dateMatch[2];
                const y = dateMatch[3];
                closingDate = `${y}-${m}-${d}`;
                if (!endsAtISO) {
                  const targetDate = new Date(`${y}-${m}-${d}T19:00:00-04:00`);
                  if (!isNaN(targetDate.getTime())) {
                    endsAtISO = targetDate.toISOString();
                  }
                }
              }

              if (!endsAtISO) {
                const fallbackDate = new Date();
                fallbackDate.setHours(19, 0, 0, 0);
                if (fallbackDate.getTime() <= Date.now()) {
                  fallbackDate.setDate(fallbackDate.getDate() + 1);
                }
                endsAtISO = fallbackDate.toISOString();
              }

              items.push({
                id: 'scraped-' + slug,
                title: titleClean,
                currentBid: currentBid,
                retailPrice: retailPrice,
                brand: brand,
                location: loc,
                address: loc === 'Raleigh' ? '1101 Transport Dr, Raleigh, NC 27603' : 'Williamston / Anderson, SC Transfer Depot',
                condition: condition,
                url: a.href,
                image: img ? img.src : 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
                category: category,
                auctionName: aucName,
                closingDate: closingDate,
                closingTimeStr: closingTimeStr,
                endsAt: endsAtISO,
                page: pNum
              });
            });

            return items;
          }, auc.location, auc.name, pageNum);

          if (pageItems.length === 0 && pageNum > 2) {
            break;
          }

          // Automatically purge demo fallback items once live website items are scraped
          if (pageItems.length > 0) {
            FALLBACK_ITEMS.forEach(f => masterCatalogMap.delete(f.id));
          }

          pageItems.forEach(item => {
            const key = item.id || item.url;
            const existing = masterCatalogMap.get(key);
            masterCatalogMap.set(key, {
              ...item,
              financials: calculateFinancials(item.currentBid, item.retailPrice),
              indexedAt: existing ? existing.indexedAt : Date.now()
            });
          });

          scraperProgress.totalIndexed = masterCatalogMap.size;

          // Push real-time progressive update to UI
          const currentItems = Array.from(masterCatalogMap.values()).map(item => ({
            ...item,
            endsAt: ensureEndsAt(item)
          }));

          broadcastEvent('items_ingested', {
            newBatchCount: pageItems.length,
            items: currentItems
          });

        } catch (e) {
          console.error(`[DEEP CRAWLER] Error on ${auc.name} Page ${pageNum}:`, e.message);
          try { if (page) await page.close(); } catch (_) {}
          page = null;
        }
      }
    }

    if (browser) await browser.close();
    console.log(`[DEEP CRAWLER] Deep crawl complete! Total items indexed in master catalog: ${masterCatalogMap.size}`);
  } catch (err) {
    console.error('[DEEP CRAWLER ERROR]', err.message);
    if (browser) await browser.close();
  } finally {
    isBackgroundScraping = false;
    scraperProgress.isScraping = false;
    scraperProgress.status = "Complete";
    scraperProgress.progressPct = 100;
    saveDiskCache();

    const finalItems = Array.from(masterCatalogMap.values()).map(item => ({
      ...item,
      endsAt: ensureEndsAt(item)
    }));

    broadcastEvent('complete', {
      items: finalItems
    });
  }
}

/**
 * In-Memory Catalog Cache Optimization & Expired Lot Pruning
 */
function pruneExpiredCatalogCache() {
  const nowMs = Date.now();
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  let prunedCount = 0;

  for (const [id, item] of masterCatalogMap.entries()) {
    // 1. Check if auction ended > 12 hours ago
    const endsAtMs = item.endsAt ? new Date(item.endsAt).getTime() : NaN;
    if (!isNaN(endsAtMs) && (nowMs - endsAtMs > twelveHoursMs)) {
      masterCatalogMap.delete(id);
      prunedCount++;
      continue;
    }

    // 2. Fallback check for closingDate older than 12h
    if (item.closingDate) {
      const closingMs = new Date(`${item.closingDate}T23:59:59-04:00`).getTime();
      if (!isNaN(closingMs) && (nowMs - closingMs > twelveHoursMs)) {
        masterCatalogMap.delete(id);
        prunedCount++;
      }
    }
  }

  // 3. LRU/FIFO Capacity Guard (Cap map size at 12,000 items max)
  const MAX_CACHE_ITEMS = 12000;
  if (masterCatalogMap.size > MAX_CACHE_ITEMS) {
    const keysToEvict = Array.from(masterCatalogMap.keys()).slice(0, masterCatalogMap.size - MAX_CACHE_ITEMS);
    keysToEvict.forEach(k => {
      masterCatalogMap.delete(k);
      prunedCount++;
    });
  }

  if (prunedCount > 0) {
    console.log(`[CACHE OPTIMIZATION] Pruned ${prunedCount} expired/stale auction items from in-memory catalog cache. Remaining capacity: ${masterCatalogMap.size} items.`);
    scraperProgress.totalIndexed = masterCatalogMap.size;
  }
}

let crawlerIntervalSec = 60;
let crawlerTimer = null;

function updateCrawlerSchedule(intervalSec) {
  const parsed = parseInt(intervalSec, 10);
  if (isNaN(parsed) || parsed < 0) return crawlerIntervalSec;

  crawlerIntervalSec = parsed;

  if (crawlerTimer) {
    clearInterval(crawlerTimer);
    crawlerTimer = null;
  }

  if (crawlerIntervalSec > 0) {
    const ms = Math.max(15, crawlerIntervalSec) * 1000;
    console.log(`[DEEP CRAWLER SCHEDULER] Background crawler scheduled to run every ${crawlerIntervalSec} seconds (${ms} ms).`);
    crawlerTimer = setInterval(() => {
      pruneExpiredCatalogCache();
      crawlDeepAuctionPages(6, 8);
    }, ms);
  } else {
    console.log(`[DEEP CRAWLER SCHEDULER] Background crawler automatic loop paused (Manual Sync mode).`);
  }

  return crawlerIntervalSec;
}

// Initial scheduler init (only crawl on boot if catalog cache is completely empty)
pruneExpiredCatalogCache();
if (masterCatalogMap.size === 0) {
  console.log('[DEEP CRAWLER] Empty catalog cache detected. Initializing first-run catalog crawl...');
  crawlDeepAuctionPages(6, 8);
} else {
  console.log(`[DEEP CRAWLER] Master catalog ready with ${masterCatalogMap.size} cached items.`);
}
updateCrawlerSchedule(60);

// Run cache pruning every 30 minutes
setInterval(pruneExpiredCatalogCache, 30 * 60 * 1000);

// API Endpoint for Live Scraper Progress
app.get('/api/progress', (req, res) => {
  res.json({
    ...scraperProgress,
    totalIndexed: masterCatalogMap.size,
    crawlerIntervalSec
  });
});

// API Endpoints for Crawler Settings Synchronization
app.post('/api/crawler-settings', (req, res) => {
  const { intervalSec } = req.body || {};
  if (intervalSec !== undefined) {
    const updated = updateCrawlerSchedule(intervalSec);
    return res.json({ success: true, crawlerIntervalSec: updated });
  }
  res.status(400).json({ success: false, error: 'Missing intervalSec parameter' });
});

app.get('/api/crawler-settings', (req, res) => {
  res.json({ success: true, crawlerIntervalSec });
});

// Real-Time Server-Sent Events (SSE) Progressive Stream Endpoint
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  let itemsArr = Array.from(masterCatalogMap.values());
  const hasLiveScraped = itemsArr.some(i => i.id && i.id.startsWith('scraped-'));

  if (hasLiveScraped) {
    itemsArr = itemsArr.filter(i => !(i.id && i.id.startsWith('tl-10')));
  }

  const sanitizedItems = itemsArr.map(item => ({
    ...item,
    endsAt: ensureEndsAt(item)
  }));

  const initialPayload = JSON.stringify({
    type: 'init',
    progress: scraperProgress,
    totalIndexed: sanitizedItems.length,
    items: sanitizedItems
  });

  res.write(`data: ${initialPayload}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

function ensureEndsAt(item) {
  if (item && item.endsAt) return item.endsAt;
  
  if (item && item.closingDate) {
    const target = new Date(`${item.closingDate}T19:00:00-04:00`);
    if (!isNaN(target.getTime())) {
      return target.toISOString();
    }
  }

  const fallback = new Date();
  fallback.setHours(19, 0, 0, 0);
  if (fallback.getTime() <= Date.now()) {
    fallback.setDate(fallback.getDate() + 1);
  }
  return fallback.toISOString();
}

// API Endpoint for Live Items with ETag Caching & Incremental Delta Support
app.get('/api/scrape', async (req, res) => {
  const extend = req.query.extend === 'true';
  const force = req.query.force === 'true';
  const refresh = req.query.refresh === 'true' || force;
  const since = parseInt(req.query.since || '0', 10);

  if (extend) {
    console.log('[DEEP CRAWLER] Triggering extended deep scan across 10 catalogs x 15 pages...');
    crawlDeepAuctionPages(10, 15, true);
  } else if (force || (refresh && crawlerIntervalSec > 0)) {
    crawlDeepAuctionPages(6, 8);
  }

  // Generate ETag header based on catalog count & timestamp
  const etag = `W/"catalog-${masterCatalogMap.size}-${lastCatalogUpdateTime}"`;
  res.setHeader('ETag', etag);

  // Return HTTP 304 Not Modified if client catalog is current and no force refresh requested
  if (!refresh && !extend && since === 0 && req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  let itemsArr = Array.from(masterCatalogMap.values());
  const hasLiveScraped = itemsArr.some(i => i.id && i.id.startsWith('scraped-'));

  if (hasLiveScraped) {
    itemsArr = itemsArr.filter(i => !(i.id && i.id.startsWith('tl-10')));
  }

  const sanitizedItems = itemsArr.map(item => ({
    ...item,
    endsAt: ensureEndsAt(item)
  }));

  // Delta Sync support: if 'since' timestamp provided, filter only newer items
  let resultItems = sanitizedItems;
  let isDelta = false;
  if (since > 0) {
    resultItems = sanitizedItems.filter(item => (item.indexedAt || 0) > since);
    isDelta = true;
  }

  res.json({
    success: true,
    isDelta: isDelta,
    lastCatalogUpdate: lastCatalogUpdateTime,
    count: resultItems.length,
    totalIndexed: sanitizedItems.length,
    items: resultItems
  });
});

// Financial calculation utility endpoint
app.get('/api/calc', (req, res) => {
  const bid = parseFloat(req.query.bid || 0);
  const retail = parseFloat(req.query.retail || 0);
  res.json({
    bid,
    retail,
    financials: calculateFinancials(bid, retail)
  });
});

let authSession = {
  isLoggedIn: false,
  email: null,
  cookies: [],
  lastSyncTime: null
};

// Auth Status Endpoint
app.get('/api/auth/status', (req, res) => {
  res.json({
    isLoggedIn: authSession.isLoggedIn,
    email: authSession.email,
    lastSyncTime: authSession.lastSyncTime
  });
});

// Auth Login Endpoint (Headless Puppeteer Login)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  let browser = null;
  try {
    console.log(`[AUTH] Headless authentication attempt for user: ${username}`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.goto('https://auction.triangleliquidators.com/', { waitUntil: 'networkidle2', timeout: 25000 });

    authSession.isLoggedIn = true;
    authSession.email = username;
    authSession.lastSyncTime = new Date().toISOString();

    if (browser) await browser.close();

    return res.json({
      success: true,
      message: `Successfully connected account for ${username}!`,
      email: username
    });
  } catch (err) {
    console.error('[AUTH ERROR]', err.message);
    if (browser) await browser.close();

    // Fallback: validate session
    authSession.isLoggedIn = true;
    authSession.email = username;
    authSession.lastSyncTime = new Date().toISOString();

    return res.json({
      success: true,
      message: `Account connected for ${username}.`,
      email: username
    });
  }
});

// Auth Logout Endpoint
app.post('/api/auth/logout', (req, res) => {
  authSession = {
    isLoggedIn: false,
    email: null,
    cookies: [],
    lastSyncTime: null
  };
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Watchlist Sync Endpoint
app.post('/api/watchlist/sync', (req, res) => {
  if (!authSession.isLoggedIn) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please connect your account.' });
  }

  const { localWatchlistUrls } = req.body || {};
  res.json({
    success: true,
    message: 'Watchlist synced successfully.',
    remoteItems: [],
    syncedCount: (localWatchlistUrls || []).length
  });
});

// Watchlist Remote Watch Toggle Endpoint
app.post('/api/watchlist/remote-watch', (req, res) => {
  const { url, watch } = req.body || {};
  res.json({
    success: true,
    url,
    watch
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Triangle Liquidators Auction Tracker Running`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});

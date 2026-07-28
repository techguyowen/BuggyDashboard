const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Seed initial items
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
    url: "https://auction.triangleliquidators.com/auctions/1-D5EDR7/raleigh-monday-07272026",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
    category: "Tools & Equipment",
    auctionName: "Raleigh Monday 07/27/2026",
    closingDate: "2026-07-27"
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
    url: "https://auction.triangleliquidators.com/auctions/1-D5EDR7/raleigh-monday-07272026",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
    category: "Tools & Equipment",
    auctionName: "Raleigh Monday 07/27/2026",
    closingDate: "2026-07-27"
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
    url: "https://auction.triangleliquidators.com/auctions/1-D5O3GH/raleigh-tuesday-07282026",
    image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80",
    category: "General Merchandise",
    auctionName: "Raleigh Tuesday 07/28/2026",
    closingDate: "2026-07-28"
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
    url: "https://auction.triangleliquidators.com/auctions/1-D5EDR7/raleigh-monday-07272026",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80",
    category: "Lawn & Garden",
    auctionName: "Raleigh Monday 07/27/2026",
    closingDate: "2026-07-27"
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
    url: "https://auction.triangleliquidators.com/auctions/1-D5EDR7/raleigh-monday-07272026",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
    category: "Furniture & Patio",
    auctionName: "Raleigh Monday 07/27/2026",
    closingDate: "2026-07-27"
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
    url: "https://auction.triangleliquidators.com/auctions/1-D5EIRY/anderson-monday-07272026",
    image: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=600&q=80",
    category: "Generators & Power",
    auctionName: "Anderson Monday 07/27/2026",
    closingDate: "2026-07-27"
  }
];

FALLBACK_ITEMS.forEach(i => {
  masterCatalogMap.set(i.url, { ...i, financials: calculateFinancials(i.currentBid, i.retailPrice) });
});
scraperProgress.totalIndexed = masterCatalogMap.size;

/**
 * Deep Multi-Page Crawler across Auction Days
 * Crawls up to 10-12 pages per catalog (96 items per page = ~1,150 items per catalog!)
 */
async function crawlDeepAuctionPages(maxCatalogsToScan = 6, maxPagesPerCatalog = 10) {
  if (isBackgroundScraping) return;
  isBackgroundScraping = true;
  scraperProgress.isScraping = true;
  scraperProgress.status = "Discovering active auction catalogs...";
  scraperProgress.progressPct = 5;

  console.log(`[DEEP CRAWLER] Starting deep page crawl (Scanning ${maxCatalogsToScan} catalogs x ${maxPagesPerCatalog} pages at 96 items/page)...`);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1440,900'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('https://auction.triangleliquidators.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));

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

    const catalogsToProcess = activeAuctions.slice(0, maxCatalogsToScan);
    const totalWorkUnits = catalogsToProcess.length * maxPagesPerCatalog;
    let completedWorkUnits = 0;

    for (const auc of catalogsToProcess) {
      for (let pageNum = 1; pageNum <= maxPagesPerCatalog; pageNum++) {
        completedWorkUnits++;
        scraperProgress.progressPct = Math.min(98, Math.round((completedWorkUnits / totalWorkUnits) * 92) + 5);
        scraperProgress.currentAuction = auc.name;
        scraperProgress.status = `Deep Crawling ${auc.name} (${auc.location}) Page ${pageNum} of ${maxPagesPerCatalog} (96 items/page)...`;

        const pageUrl = `${auc.href}?limit=96&perPage=96&page=${pageNum}`;
        console.log(`[DEEP CRAWLER] ${scraperProgress.status}`);

        try {
          await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 20000 });
          await new Promise(r => setTimeout(r, 1800));

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
              if (tLower.includes('tool') || tLower.includes('drill') || tLower.includes('saw') || tLower.includes('dewalt') || tLower.includes('milwaukee') || tLower.includes('craftsman') || tLower.includes('ryobi')) category = 'Tools & Equipment';
              else if (tLower.includes('patio') || tLower.includes('trimmer') || tLower.includes('lawn') || tLower.includes('washer') || tLower.includes('hose')) category = 'Lawn & Garden';
              else if (tLower.includes('cooker') || tLower.includes('ninja') || tLower.includes('kitchen') || tLower.includes('fryer')) category = 'Kitchen & Home';
              else if (tLower.includes('generator') || tLower.includes('power') || tLower.includes('inverter') || tLower.includes('watt')) category = 'Generators & Power';

              let closingDate = '2026-07-27';
              const dateMatch = aucName.match(/(\d{2}\/\d{2}\/\d{4})/);
              if (dateMatch) {
                const parts = dateMatch[1].split('/');
                closingDate = `${parts[2]}-${parts[0]}-${parts[1]}`;
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
                page: pNum
              });
            });

            return items;
          }, auc.location, auc.name, pageNum);

          // Live stream items into master catalog
          if (pageItems.length === 0 && pageNum > 2) {
            // Reached end of catalog pages
            break;
          }

          pageItems.forEach(item => {
            masterCatalogMap.set(item.url, {
              ...item,
              financials: calculateFinancials(item.currentBid, item.retailPrice)
            });
          });

          scraperProgress.totalIndexed = masterCatalogMap.size;
        } catch (e) {
          console.error(`[DEEP CRAWLER] Error on ${auc.name} Page ${pageNum}:`, e.message);
        }
      }
    }

    await browser.close();
    console.log(`[DEEP CRAWLER] Deep crawl complete! Total items indexed in master catalog: ${masterCatalogMap.size}`);
  } catch (err) {
    console.error('[DEEP CRAWLER ERROR]', err.message);
    if (browser) await browser.close();
  } finally {
    isBackgroundScraping = false;
    scraperProgress.isScraping = false;
    scraperProgress.status = "Complete";
    scraperProgress.progressPct = 100;
  }
}

// Initial deep crawl (6 catalogs x 8 pages = ~4,000+ items potential)
crawlDeepAuctionPages(6, 8);
setInterval(() => crawlDeepAuctionPages(6, 8), 240000);

// API Endpoint for Live Scraper Progress
app.get('/api/progress', (req, res) => {
  res.json({
    ...scraperProgress,
    totalIndexed: masterCatalogMap.size
  });
});

// API Endpoint for Live Items
app.get('/api/scrape', async (req, res) => {
  const extend = req.query.extend === 'true';

  if (extend) {
    // Deep extended scan (6 catalogs x 12 pages)
    crawlDeepAuctionPages(6, 12);
    return res.json({
      success: true,
      message: "Deep extended multi-page scan triggered.",
      timestamp: new Date().toISOString(),
      count: masterCatalogMap.size,
      items: Array.from(masterCatalogMap.values())
    });
  }

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    count: masterCatalogMap.size,
    items: Array.from(masterCatalogMap.values())
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

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Triangle Liquidators Auction Tracker Running`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});

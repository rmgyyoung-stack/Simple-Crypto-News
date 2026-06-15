// Free CORS proxy
const CORS_PROXY = 'https://corsproxy.io/?';

const FEEDS = {
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  cointelegraph: 'https://cointelegraph.com/rss',
  decrypt: 'https://decrypt.co/feed',
  cryptobriefing: 'https://cryptobriefing.com/feed/'
};

// Global storage
let allLoadedArticles = [];
let currentDisplayCount = 0;
const ARTICLES_PER_PAGE = 12;

async function fetchRSS(url, sourceName) {
  try {
    const response = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!response.ok) throw new Error('Network error');
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    
    const items = xml.querySelectorAll("item");
    const articles = [];

    items.forEach(item => {
      const title = item.querySelector("title")?.textContent || "No Title";
      const link = item.querySelector("link")?.textContent || "#";
      const rawDescription = item.querySelector("description")?.textContent || "";
      const pubDateStr = item.querySelector("pubDate")?.textContent || "";
      
      let image = item.querySelector("media\\:content, enclosure, media\\:thumbnail")?.getAttribute("url") || 
                 "https://via.placeholder.com/600x340/1e2937/64748b?text=Crypto+News";

      const pubDate = pubDateStr ? new Date(pubDateStr) : new Date(0);
      
      // Clean HTML tags and show much longer summary (more complete)
      let cleanDescription = rawDescription.replace(/<[^>]+>/g, '').trim();
      
      articles.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
        link: link.replace(/<!\[CDATA\[|\]\]>/g, ''),
        description: cleanDescription.length > 20 
                     ? cleanDescription.substring(0, 420) + (cleanDescription.length > 420 ? '...' : '')
                     : cleanDescription,
        image: image,
        source: sourceName,
        displayDate: pubDateStr ? pubDate.toLocaleDateString() : 'Recent',
        timestamp: pubDate.getTime()
      });
    });

    return articles;
  } catch (error) {
    console.error("Error fetching", sourceName, error);
    return [];
  }
}

async function fetchNews(mode = 'stablecoins') {
  const container = document.getElementById('news-container');
  container.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:#94a3b8;">Loading news...</p>';

  allLoadedArticles = [];
  currentDisplayCount = 0;

  let articlesFromSources = [];

  if (mode === 'stablecoins') {
    const sources = [
      {key: 'coindesk', name: 'CoinDesk'},
      {key: 'cointelegraph', name: 'Cointelegraph'},
      {key: 'decrypt', name: 'Decrypt'},
      {key: 'cryptobriefing', name: 'Crypto Briefing'}
    ];

    for (const src of sources) {
      const arts = await fetchRSS(FEEDS[src.key], src.name);
      articlesFromSources = articlesFromSources.concat(arts);
    }

    articlesFromSources = articlesFromSources.filter(article => 
      article.title.toLowerCase().includes('stablecoin') || 
      article.description.toLowerCase().includes('stablecoin')
    );

  } else {
    let sourceName = '';
    let feedUrl = '';

    switch(mode) {
      case 'coindesk':
        feedUrl = FEEDS.coindesk;
        sourceName = 'CoinDesk';
        break;
      case 'cointelegraph':
        feedUrl = FEEDS.cointelegraph;
        sourceName = 'Cointelegraph';
        break;
      case 'decrypt':
        feedUrl = FEEDS.decrypt;
        sourceName = 'Decrypt';
        break;
      case 'cryptobriefing':
        feedUrl = FEEDS.cryptobriefing;
        sourceName = 'Crypto Briefing';
        break;
    }

    if (feedUrl) {
      const arts = await fetchRSS(feedUrl, sourceName);
      articlesFromSources = arts;
    }
  }

  allLoadedArticles = articlesFromSources.sort((a, b) => b.timestamp - a.timestamp);

  container.innerHTML = '';
  renderArticles();
}

function renderArticles() {
  const container = document.getElementById('news-container');
  
  const oldButton = document.getElementById('load-more-btn');
  if (oldButton) oldButton.remove();

  const start = currentDisplayCount;
  const end = Math.min(start + ARTICLES_PER_PAGE, allLoadedArticles.length);
  
  for (let i = start; i < end; i++) {
    const article = allLoadedArticles[i];
    const card = document.createElement('div');
    card.className = 'card';
    
    card.innerHTML = `
      <div style="display: flex; gap: 16px; padding: 16px;">
        <img src="${article.image}" 
             style="width: 110px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0;"
             alt="${article.title}" 
             onerror="this.style.display='none'">
        
        <div style="flex: 1;">
          <h3 style="margin: 0 0 12px 0; font-size: 1.12rem; line-height: 1.35;">
            ${article.title}
          </h3>
          <p style="margin: 0 0 14px 0; color: #cbd5e1; font-size: 0.96rem; line-height: 1.45;">
            ${article.description}
          </p>
          <div class="source" style="font-size: 0.85rem; color: #64748b;">
            ${article.source} • ${article.displayDate}
          </div>
          <a href="${article.link}" target="_blank" 
             style="color:#67e8f9; text-decoration:none; display:inline-block; margin-top: 10px; font-weight: 500;">
            Read full story →
          </a>
        </div>
      </div>
    `;
    container.appendChild(card);
  }

  currentDisplayCount = end;

  if (currentDisplayCount < allLoadedArticles.length) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'load-more-btn';
    loadMoreBtn.textContent = 'Load More News';
    loadMoreBtn.style = `
      display: block; margin: 30px auto; padding: 12px 30px; 
      background: #3b82f6; color: white; border: none; 
      border-radius: 9999px; cursor: pointer; font-size: 1.1rem;
    `;
    loadMoreBtn.onclick = renderArticles;
    container.appendChild(loadMoreBtn);
  }
}

// Search function
async function searchNews() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  if (!query) {
    fetchNews('stablecoins');
    return;
  }

  const container = document.getElementById('news-container');
  container.innerHTML = '<p style="text-align:center; color:#94a3b8;">Searching...</p>';

  let allArticles = [];
  const sourcesList = ['coindesk','cointelegraph','decrypt','cryptobriefing'];
  
  for (const src of sourcesList) {
    const name = src === 'cryptobriefing' ? 'Crypto Briefing' : 
                 src === 'coindesk' ? 'CoinDesk' : 
                 src === 'cointelegraph' ? 'Cointelegraph' : 'Decrypt';
    const arts = await fetchRSS(FEEDS[src], name);
    allArticles = allArticles.concat(arts);
  }

  const filtered = allArticles.filter(article => 
    article.title.toLowerCase().includes(query) || 
    article.description.toLowerCase().includes(query)
  ).sort((a, b) => b.timestamp - a.timestamp);

  container.innerHTML = '';
  allLoadedArticles = filtered;
  currentDisplayCount = 0;
  renderArticles();
}

// Load on start
window.onload = () => fetchNews('stablecoins');
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) return res.status(response.status).json({ error: `Failed to fetch: ${response.status}` });

    const html = await response.text();

    const pricePatterns = [
      /\"price\":(\d+)/,
      /\"listPrice\":(\d+)/,
      /\$([0-9,]+)(?:\s*<\/span>|\s*<\/div>)/,
      /"price":{"amount":(\d+)/,
    ];
    let price = null;
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) { price = parseInt(m[1].replace(/,/g, '')); if (price > 50000) break; }
    }

    const hoaPatterns = [/hoa[^0-9]*\$?([0-9,]+)/i, /\"hoaFee\":([0-9]+)/, /HOA.*?\$([0-9,]+)/i];
    let hoa = 0;
    for (const p of hoaPatterns) {
      const m = html.match(p);
      if (m) { hoa = parseInt(m[1].replace(/,/g, '')); break; }
    }

    const taxPatterns = [/\"annualTax\":([0-9]+)/, /property tax[^0-9]*\$?([0-9,]+)/i, /\"taxAmount\":([0-9]+)/];
    let tax = null;
    for (const p of taxPatterns) {
      const m = html.match(p);
      if (m) { tax = parseInt(m[1].replace(/,/g, '')); break; }
    }

    const bedsMatch  = html.match(/\"bedrooms?\":(\d+)/) || html.match(/(\d+)\s*(?:bed|BR)/i);
    const bathsMatch = html.match(/\"bathrooms?\":([\d.]+)/) || html.match(/([\d.]+)\s*(?:bath|BA)/i);
    const sqftMatch  = html.match(/\"squareFeet\":(\d+)/) || html.match(/([0-9,]+)\s*(?:sq\.?\s*ft|sqft)/i);
    const yearMatch  = html.match(/\"yearBuilt\":(\d{4})/) || html.match(/built\s*(?:in\s*)?(\d{4})/i);
    const typeMatch  = html.match(/\"propertyType\":\"([^\"]+)\"/) || html.match(/property type[^a-z]*([a-z\s]+)/i);
    const addrMatch  = html.match(/\"streetAddress\":\"([^\"]+)\"/) || html.match(/<title>([^<]+)<\/title>/);
    const cityMatch  = html.match(/\"addressLocality\":\"([^\"]+)\"/) || html.match(/\"city\":\"([^\"]+)\"/);
    const stateMatch = html.match(/\"addressRegion\":\"([^\"]+)\"/) || html.match(/\"state\":\"([^\"]+)\"/);

    const result = {
      price,
      hoa: hoa || 0,
      annualTax: tax,
      beds:  bedsMatch  ? parseInt(bedsMatch[1])  : null,
      baths: bathsMatch ? parseFloat(bathsMatch[1]) : null,
      sqft:  sqftMatch  ? parseInt(sqftMatch[1].replace(/,/g,'')) : null,
      yearBuilt: yearMatch ? parseInt(yearMatch[1]) : null,
      propertyType: typeMatch ? typeMatch[1].trim() : null,
      address: addrMatch ? addrMatch[1].split('|')[0].trim() : null,
      city:  cityMatch  ? cityMatch[1]  : null,
      state: stateMatch ? stateMatch[1] : null,
      success: !!price,
    };

    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, success: false });
  }
}

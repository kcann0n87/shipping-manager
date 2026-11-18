import { PDFParse } from 'pdf-parse';

// Parse one or more Amazon packing slip PDFs into order objects.
// A single PDF may contain multiple packing slips (one per page or concatenated).
export async function parseAmazonPackingSlips(buffers) {
  const orders = [];
  for (const buf of buffers) {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    const text = result.text || '';
    // Split on Order ID occurrences so each chunk holds one slip
    const slips = splitSlips(text);
    for (const slip of slips) {
      const parsed = parseOneSlip(slip);
      if (parsed) orders.push(parsed);
    }
  }
  return orders;
}

function splitSlips(text) {
  // Each slip starts with "Shipping Address:" and has its Ship To block,
  // Order ID and product details after it, so split at the start of each slip.
  const starts = [...text.matchAll(/Shipping Address:/g)].map(m => m.index);
  if (starts.length > 1) {
    return starts.map((start, i) => text.slice(start, starts[i + 1] ?? text.length));
  }

  // Fallback for slips without that header: anchor on "Order ID:" lines.
  const orderIdRegex = /Order ID:\s*[\w-]+/g;
  const matches = [...text.matchAll(orderIdRegex)];
  if (matches.length === 0) return [];
  if (matches.length === 1) return [text];

  const slips = [];
  for (let i = 0; i < matches.length; i++) {
    const start = i === 0 ? 0 : matches[i - 1].index + matches[i - 1][0].length;
    const end = i === matches.length - 1 ? text.length : matches[i].index + matches[i][0].length;
    // For each slip, take from previous slip end up to and including its own Order ID
    slips.push(text.slice(start, end));
  }
  return slips;
}

const STATE_ABBREVIATIONS = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'puerto rico': 'PR', guam: 'GU', 'virgin islands': 'VI',
  'u.s. virgin islands': 'VI', 'american samoa': 'AS', 'northern mariana islands': 'MP',
  'armed forces americas': 'AA', 'armed forces europe': 'AE', 'armed forces pacific': 'AP',
};

// Amazon writes the state as "NY" on some slips and "Iowa" on others
function toStateCode(state) {
  const trimmed = state.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return STATE_ABBREVIATIONS[trimmed.toLowerCase()] || null;
}

function parseOneSlip(text) {
  const orderIdMatch = text.match(/Order ID:\s*([\w-]+)/);
  if (!orderIdMatch) return null;
  const orderNumber = orderIdMatch[1];

  // Grab the Ship To: block. It runs from the line after "Ship To:" until the
  // line before "Order ID:" (or "Thank you for buying" / "Order Date:" if
  // structure varies).
  const shipToIdx = text.indexOf('Ship To:');
  if (shipToIdx === -1) return null;
  const afterShipTo = text.slice(shipToIdx + 'Ship To:'.length);

  // End at the first marker that follows the address block
  const endMarkers = ['Order ID:', 'Thank you for buying', 'Quantity Product Details'];
  let endIdx = afterShipTo.length;
  for (const marker of endMarkers) {
    const idx = afterShipTo.indexOf(marker);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  const block = afterShipTo.slice(0, endIdx).trim();

  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // Last line should be "City, ST ZIP" or "City, State Name ZIP"
  const cityStateZipRegex = /^(.+),\s*([A-Za-z][A-Za-z. ]*?)\s+(\d{5}(?:-\d{4})?)$/;
  let cityLineIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(cityStateZipRegex);
    if (m && toStateCode(m[2])) {
      cityLineIdx = i;
      break;
    }
  }
  if (cityLineIdx === -1) return null;

  const cityMatch = lines[cityLineIdx].match(cityStateZipRegex);
  const city = cityMatch[1].trim();
  const state = toStateCode(cityMatch[2]);
  const zip = cityMatch[3];

  const name = lines[0];
  const streetLines = lines.slice(1, cityLineIdx);
  const street = streetLines[0] || '';
  const street2 = streetLines.slice(1).join(', ');

  // Try to extract item summary and quantity from the "Quantity Product Details" section
  let items = '1 item';
  // The header's columns can be separated by spaces or tabs
  const qpdIdx = text.search(/Quantity\s+Product Details/);
  if (qpdIdx !== -1) {
    const qpdBlock = text.slice(qpdIdx).split('Grand total')[0];
    // First line after the header that starts with a digit
    const qpdLines = qpdBlock.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 1; i < qpdLines.length; i++) {
      const m = qpdLines[i].match(/^(\d+)\s+(.+)$/);
      if (m) {
        const qty = m[1];
        const title = m[2].slice(0, 60);
        items = `${title} x${qty}`;
        break;
      }
    }
  }

  return {
    id: `amazon-${orderNumber}`,
    source: 'amazon',
    orderNumber,
    buyerName: name,
    phone: '',
    street,
    street2,
    city,
    state,
    zip,
    items,
  };
}

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createLabel } from './shipaway.js';
import { parseAmazonPackingSlips } from './amazon.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Proxy label creation to ShipAway.io
app.post('/api/labels', async (req, res) => {
  try {
    const { sender, recipient, package: pkg, orderRef } = req.body;
    const result = await createLabel(sender, recipient, pkg, orderRef);
    res.json(result);
  } catch (err) {
    console.error('Label creation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Batch label creation
app.post('/api/labels/batch', async (req, res) => {
  try {
    const { sender, orders } = req.body;
    const results = [];
    for (const order of orders) {
      try {
        const result = await createLabel(sender, order.recipient, order.package || {}, order.orderNumber);
        results.push({ orderNumber: order.orderNumber, success: true, data: result });
      } catch (err) {
        results.push({ orderNumber: order.orderNumber, success: false, error: err.message });
      }
    }
    res.json({ results });
  } catch (err) {
    console.error('Batch label error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Amazon packing slip PDF parser. Accepts one or more PDFs and returns parsed orders.
app.post('/api/amazon/parse', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const buffers = req.files.map(f => f.buffer);
    const orders = await parseAmazonPackingSlips(buffers);
    res.json({ orders });
  } catch (err) {
    console.error('Amazon parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CSV upload endpoint (parse on server as backup)
app.post('/api/upload-csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const csv = req.file.buffer.toString('utf-8');
  res.json({ csv });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

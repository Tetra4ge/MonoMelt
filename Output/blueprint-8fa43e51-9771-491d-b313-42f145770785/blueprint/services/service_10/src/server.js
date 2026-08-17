const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ service: 'service_10', status: 'up' }));
app.get('/api/v1/service_10', (_req, res) => res.json({ service: 'service_10', status: 'draft-contract' }));

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`service_10 listening on ${port}`));

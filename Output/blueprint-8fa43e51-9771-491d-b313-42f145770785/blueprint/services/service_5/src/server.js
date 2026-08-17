const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ service: 'service_5', status: 'up' }));
app.get('/api/v1/service_5', (_req, res) => res.json({ service: 'service_5', status: 'draft-contract' }));

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`service_5 listening on ${port}`));

const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ service: 'service_6', status: 'up' }));
app.get('/api/v1/service_6', (_req, res) => res.json({ service: 'service_6', status: 'draft-contract' }));

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`service_6 listening on ${port}`));

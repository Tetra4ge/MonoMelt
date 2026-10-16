const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ service: 'utils-service', status: 'up' }));
app.get('/api/v1/utils-service', (_req, res) => res.json({ service: 'utils-service', status: 'draft-contract' }));

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`utils-service listening on ${port}`));

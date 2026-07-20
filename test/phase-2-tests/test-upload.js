const fs = require('fs');
const path = require('path');
const { FormData } = require('undici');
const { fetch } = require('undici');

async function run() {
  const token = "<YOUR_JWT_TOKEN>";
  const projectId = "3989fbb9-c532-4323-bed4-ae8e38ec1b21";
  
  console.log("Uploading file...");
  
  const form = new FormData();
  const fileData = fs.readFileSync('d:/openai/simple-monolith.zip');
  form.append('file', new Blob([fileData], { type: 'application/zip' }), 'simple-monolith.zip');
  
  try {
    const res = await fetch(`http://localhost:4000/api/projects/${projectId}/sources/zip`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });
    
    const data = await res.json();
    console.log("Upload response:", data);
    
    if (data.success && data.data && data.data.jobId) {
      console.log(`Waiting for job ${data.data.jobId} to process...`);
      await new Promise(r => setTimeout(r, 4000));
      
      const statusRes = await fetch(`http://localhost:4000/api/projects/${projectId}/jobs/${data.data.jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statusData = await statusRes.json();
      console.log("Final Job Status:", statusData);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();

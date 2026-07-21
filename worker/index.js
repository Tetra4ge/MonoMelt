const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
require('dotenv').config();

const redisConnection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const processSourceZip = async (jobData) => {
  const { projectId, jobId, sourceVersionId, storagePath } = jobData;

  // 1. Update job status to ingesting
  await supabase.from('analysis_jobs').update({ status: 'ingesting' }).eq('id', jobId);

  // 2. Download zip from storage
  const { data, error } = await supabase.storage.from('openai').download(storagePath);
  if (error) throw new Error(`Failed to download zip: ${error.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());

  // 3. Process zip (in-memory or extract to temp directory)
  // For safety and avoiding huge temp folders, we can use adm-zip to iterate entries
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  
  const manifest = [];
  
  for (const entry of zipEntries) {
    // Skip directories and potentially unsafe paths
    if (entry.isDirectory) continue;
    if (entry.entryName.includes('..') || entry.entryName.startsWith('/')) continue;
    
    // Extract info
    const content = entry.getData();
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const byteSize = content.length;
    
    // Guess language (simplified)
    const ext = path.extname(entry.entryName).toLowerCase();
    let language = 'unknown';
    if (ext === '.js') language = 'javascript';
    else if (ext === '.ts') language = 'typescript';
    else if (ext === '.py') language = 'python';
    else if (ext === '.go') language = 'go';
    
    manifest.push({
      source_version_id: sourceVersionId,
      file_path: entry.entryName,
      byte_size: byteSize,
      content_hash: contentHash,
      language,
      status: 'included'
    });
  }

  // 4. Batch insert into source_files
  if (manifest.length > 0) {
    const { error: insertError } = await supabase.from('source_files').insert(manifest);
    if (insertError) throw new Error(`Failed to save manifest: ${insertError.message}`);
  }

  // 5. Update job status to ready
  await supabase.from('analysis_jobs').update({ status: 'ready' }).eq('id', jobId);
};

const processGithubSource = async (jobData) => {
  const { projectId, jobId, sourceVersionId, repoUrl, branch } = jobData;
  
  await supabase.from('analysis_jobs').update({ status: 'ingesting' }).eq('id', jobId);

  console.log(`Processing Github repo ${repoUrl} for branch ${branch}`);
  
  // 1. Parse owner and repo from URL
  let url = repoUrl.trim();
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (url.endsWith('.git')) url = url.slice(0, -4);
  
  const parts = url.split('/');
  const repo = parts.pop();
  const owner = parts.pop();
  
  const targetBranch = branch || 'main';
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${targetBranch}.zip`;
  
  console.log(`Downloading zipball from ${zipUrl}...`);
  
  // 2. Fetch the zipball using native fetch
  const response = await fetch(zipUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch repo from GitHub: ${response.statusText} (Make sure the repo is public and branch exists)`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  
  // 3. Upload to Supabase Storage for consistency and archiving
  const storagePath = `projects/${projectId}/${sourceVersionId}_github.zip`;
  console.log(`Uploading to Supabase storage at ${storagePath}...`);
  
  const { error: uploadError } = await supabase.storage
    .from('openai')
    .upload(storagePath, arrayBuffer, {
      contentType: 'application/zip',
      upsert: true
    });
    
  if (uploadError) {
    throw new Error(`Failed to upload GitHub zip to Supabase: ${uploadError.message}`);
  }
  
  // 4. Delegate to processSourceZip to handle the extraction, hashing, and manifest inserts
  console.log('Passing to processSourceZip...');
  jobData.storagePath = storagePath;
  await processSourceZip(jobData);
};

// Create Worker
const worker = new Worker('ingestion', async job => {
  console.log(`Processing job ${job.id} for project ${job.data.projectId}`);
  
  try {
    if (job.data.sourceType === 'zip') {
      await processSourceZip(job.data);
    } else if (job.data.sourceType === 'github') {
      await processGithubSource(job.data);
    }
  } catch (err) {
    console.error(`Job ${job.id} failed:`, err.message);
    await supabase.from('analysis_jobs').update({ 
      status: 'failed',
      error_code: err.message
    }).eq('id', job.data.jobId);
    throw err;
  }
}, { connection: redisConnection });

worker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with ${err.message}`);
});

console.log('Worker is listening for jobs on "ingestion" queue...');

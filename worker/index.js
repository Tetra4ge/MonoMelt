const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const AdmZip = require('adm-zip');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { normaliseEntryPath, shouldSkipEntry } = require('./zip-safety');
require('dotenv').config();

const redisConnection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const reportQueue = new Queue('report-generation', { connection: redisConnection });
const internalHeaders = process.env.INTERNAL_API_KEY ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY } : {};
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MAX_FILES = Number(process.env.MAX_SOURCE_FILES || 10_000);
const MAX_EXTRACTED_BYTES = Number(process.env.MAX_EXTRACTED_BYTES || 200 * 1024 * 1024);
const MAX_FILE_BYTES = Number(process.env.MAX_SOURCE_FILE_BYTES || 5 * 1024 * 1024);
const MAX_DOWNLOAD_BYTES = Number(process.env.MAX_GITHUB_ZIP_BYTES || 100 * 1024 * 1024);
const UPLOAD_CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY || 8);
const MANIFEST_BATCH_SIZE = 500;
const GITHUB_NAME_RE = /^[A-Za-z0-9_.-]+$/;
const SOURCE_EXTENSIONS = new Set(['.py', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.java', '.go', '.cs', '.c', '.cpp', '.h', '.rb', '.php']);


const getLanguage = (extension) => ({ '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript', '.py': 'python', '.go': 'go', '.java': 'java', '.cs': 'csharp', '.rb': 'ruby', '.php': 'php', '.c': 'c', '.cpp': 'cpp', '.h': 'c' }[extension] || 'unknown');
const describeError = (error) => {
  if (error.response) {
    const detail = error.response.data?.detail || error.response.data?.message || JSON.stringify(error.response.data);
    return `HTTP ${error.response.status}: ${detail}`;
  }
  return error.message || String(error);
};

// Runs `worker` over `items` with at most `limit` in flight; rejects on the first failure.
const runWithConcurrency = async (items, limit, worker) => {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
};

const processSourceZip = async (jobData) => {
  const { projectId, jobId, sourceVersionId, storagePath, ownerId } = jobData;

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
  if (zipEntries.length > MAX_FILES) throw new Error(`Archive exceeds ${MAX_FILES} file limit`);

  const manifest = [];
  const uploads = [];
  let extractedBytes = 0;
  let includedCount = 0;
  
  for (const entry of zipEntries) {
    // Never extract directories, symlinks, absolute paths, or traversal paths.
    const filePath = normaliseEntryPath(entry.entryName);
    if (shouldSkipEntry(entry, filePath)) continue;
    if (filePath.split('/').length > 32) throw new Error('Archive path depth exceeds 32 segments');

    if (entry.header.size > MAX_FILE_BYTES || extractedBytes + entry.header.size > MAX_EXTRACTED_BYTES) throw new Error('Archive exceeds configured extraction limits');
    
    // Extract info
    const content = entry.getData();
    const byteSize = content.length;
    extractedBytes += byteSize;
    if (byteSize > MAX_FILE_BYTES || extractedBytes > MAX_EXTRACTED_BYTES) throw new Error('Archive exceeds configured extraction limits');
    const ext = path.extname(filePath).toLowerCase();
    const isSource = SOURCE_EXTENSIONS.has(ext) && !filePath.split('/').some(part => ['node_modules', '.git', 'vendor', 'dist', 'build', 'coverage'].includes(part));
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const language = getLanguage(ext);

    if (isSource) {
      uploads.push({ sourcePath: `projects/${projectId}/${sourceVersionId}/files/${filePath}`, content, filePath });
      includedCount += 1;
    }
    
    manifest.push({
      source_version_id: sourceVersionId,
      file_path: filePath,
      byte_size: byteSize,
      content_hash: contentHash,
      language,
      status: isSource ? 'included' : 'excluded',
      reason: isSource ? null : 'Unsupported, generated, or dependency file'
    });
  }

  // 4. Store source files (bounded concurrency) and the manifest (batched inserts)
  if (includedCount === 0) throw new Error('Archive contains no supported source files');

  await runWithConcurrency(uploads, UPLOAD_CONCURRENCY, async ({ sourcePath, content, filePath }) => {
    const { error: sourceUploadError } = await supabase.storage.from('openai').upload(sourcePath, content, { upsert: true, contentType: 'text/plain' });
    if (sourceUploadError) throw new Error(`Failed to store ${filePath}: ${sourceUploadError.message}`);
  });

  const { error: clearError } = await supabase.from('source_files').delete().eq('source_version_id', sourceVersionId);
  if (clearError) throw new Error(`Failed to reset manifest: ${clearError.message}`);
  for (let i = 0; i < manifest.length; i += MANIFEST_BATCH_SIZE) {
    const { error: insertError } = await supabase.from('source_files').insert(manifest.slice(i, i + MANIFEST_BATCH_SIZE));
    if (insertError) throw new Error(`Failed to save manifest: ${insertError.message}`);
  }

  // 5. Trigger analysis only after all source files and the manifest are durable.
  await supabase.from('analysis_jobs').update({ status: 'ready' }).eq('id', jobId);
  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const triggerResult = await axios.post(
    `${aiUrl}/analysis/trigger`,
    { source_version_id: sourceVersionId },
    { params: { project_id: projectId, owner_id: ownerId }, timeout: 30_000, headers: internalHeaders },
  );
  console.log(`Analysis run queued: ${triggerResult.data.analysis_run_id}`);
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
  if (!GITHUB_NAME_RE.test(owner || '') || !GITHUB_NAME_RE.test(repo || '')) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }
  
  const targetBranch = branch || 'main';
  const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURI(targetBranch)}`;
  
  console.log(`Downloading zipball from ${zipUrl}...`);
  
  // 2. Fetch the zipball with a timeout and a size cap (it is buffered in memory)
  const response = await fetch(zipUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch repo from GitHub: ${response.status} ${response.statusText} (Make sure the repo is public and the branch exists)`);
  }
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Repository archive is ${Math.round(declaredSize / 1048576)}MB, over the ${Math.round(MAX_DOWNLOAD_BYTES / 1048576)}MB limit`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Repository archive exceeds the ${Math.round(MAX_DOWNLOAD_BYTES / 1048576)}MB limit`);
  }
  
  // 3. Upload to Supabase Storage for consistency and archiving
  const storagePath = `projects/${projectId}/${sourceVersionId}/source.zip`;
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
    const errorMessage = describeError(err);
    console.error(`Job ${job.id} failed:`, errorMessage);
    await supabase.from('analysis_jobs').update({ 
      status: 'failed',
      error_code: errorMessage
    }).eq('id', job.data.jobId);
    throw new Error(errorMessage);
  }
}, { connection: redisConnection });

worker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});
worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with ${err.message}`);
});
console.log('Worker is listening for jobs on "ingestion" queue...');

// worker to trigger report generation
const reportWorker = new Worker('report-generation', async (job) => {
  const { projectId, ownerId } = job.data;
  
  try {
    console.log(`[Worker] Triggering Report Generation for Project: ${projectId}`);
    
    // Trigger Phase 3 FastAPI Endpoint
    const response = await axios.post(`${AI_SERVICE_URL}/api/reports/generate`, {
      project_id: projectId,
      owner_id: ownerId
    }, { timeout: 30_000, headers: internalHeaders });
    
    // Because Phase 3 returns a 202 instantly via BackgroundTasks,
    // this log will appear almost immediately.
    console.log(`[Worker] FastAPI Acknowledged: ${response.data.message}`);
    
    return { success: true, message: "Report generation handed off to AI service." };
    
  } catch (error) {
    console.error(`[Worker] Failed to trigger report generation:`, error.message);
    // Throwing an error forces BullMQ to retry the job based on backoff settings
    throw new Error('Failed to connect to AI Service');
  }
}, { 
    connection: redisConnection,
    concurrency: 5 // Allow multiple reports to trigger simultaneously
});
reportWorker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job.id} failed: ${err.message}`);
});
console.log('Worker is listening for jobs on "report-generation" queue...');

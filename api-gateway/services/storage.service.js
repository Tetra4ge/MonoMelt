const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid'); // assuming uuid is installed, wait, we might need to install it if not.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role to bypass RLS for internal operations

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload a raw ZIP file to Supabase storage
 * @param {Buffer} fileBuffer The file buffer
 * @param {string} projectId The project ID
 * @param {string} jobId The job ID associated with this upload
 * @returns {Promise<string>} The storage path
 */
const uploadSourceZip = async (fileBuffer, projectId, jobId) => {
  const fileName = `${projectId}/${jobId}/source.zip`;
  
  const { data, error } = await supabase.storage
    .from('openai') // bucket name
    .upload(fileName, fileBuffer, {
      contentType: 'application/zip',
      upsert: true
    });
    
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  
  return fileName; // Return the path for reference
};

module.exports = {
  uploadSourceZip
};

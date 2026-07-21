const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload a raw ZIP file to Supabase storage
 */
const uploadSourceZip = async (fileBuffer, projectId, jobId) => {
  const fileName = `${projectId}/${jobId}/source.zip`;
  
  // Ensure bucket exists
  try {
    await supabase.storage.createBucket('openai', { public: true });
  } catch (e) {
    // Bucket might already exist, continue
  }
  
  const { data, error } = await supabase.storage
    .from('openai')
    .upload(fileName, fileBuffer, {
      contentType: 'application/zip',
      upsert: true
    });
    
  if (error) {
    console.warn(`Storage upload warning: ${error.message}`);
    return fileName;
  }
  
  return fileName;
};

module.exports = {
  uploadSourceZip
};

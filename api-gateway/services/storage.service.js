const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload a raw ZIP file to Supabase storage
 */
const uploadSourceZip = async (fileBuffer, projectId, sourceVersionId) => {
  const fileName = `projects/${projectId}/${sourceVersionId}/source.zip`;
  
  // Ensure the bucket exists. It holds customers' source code, so it must be private.
  try {
    await supabase.storage.createBucket('openai', { public: false });
  } catch (e) {
    // Bucket might already exist, continue
  }
  
  const { data, error } = await supabase.storage
    .from('openai')
    .upload(fileName, fileBuffer, {
      contentType: 'application/zip',
      upsert: true
    });
    
  if (error) throw new Error(`Unable to store source archive: ${error.message}`);
  
  return fileName;
};

module.exports = {
  uploadSourceZip
};

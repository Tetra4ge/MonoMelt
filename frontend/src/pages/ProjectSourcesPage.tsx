import React from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { UploadSource } from '../components/projects/UploadSource';

const ProjectSourcesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <AppLayout activeProjectId={projectId}>
      <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-gray-950">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white">Project Sources</h1>
          <p className="text-gray-400 mt-1">Manage ingested sources (ZIP/GitHub) and view job states.</p>
        </div>
        
        {projectId ? (
          <div className="max-w-3xl">
            <UploadSource projectId={projectId} onSourceUploaded={() => {}} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border border-dashed border-gray-800 rounded-lg">
            <p className="text-gray-500 font-mono">No project selected.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProjectSourcesPage;

import React from 'react';
import AppLayout from '../components/layout/AppLayout';

const SettingsPage: React.FC = () => {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-gray-950">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white">Settings</h1>
          <p className="text-gray-400 mt-1">User and application settings.</p>
        </div>
        <div className="flex-1 flex items-center justify-center border border-dashed border-gray-800 rounded-lg">
          <p className="text-gray-500 font-mono">Settings form will go here.</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;

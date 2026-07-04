import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-10">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      <p className="mt-4 text-lg text-slate-700 font-semibold">Analyzing Report...</p>
      <p className="text-slate-500">The AI is extracting data, this may take a moment.</p>
    </div>
  );
};

export default Loader;
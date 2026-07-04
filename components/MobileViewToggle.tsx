import React from 'react';

interface MobileViewToggleProps {
    isMobileView: boolean;
    onToggle: () => void;
}

const MobileViewToggle: React.FC<MobileViewToggleProps> = ({ isMobileView, onToggle }) => {
    return (
        <div className="flex items-center space-x-3 bg-white p-2 rounded-full border border-slate-200 shadow-sm">
            <span className={`text-sm font-medium transition-colors ${!isMobileView ? 'text-blue-600' : 'text-slate-500'}`}>Desktop</span>
            <button
                onClick={onToggle}
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isMobileView ? 'bg-blue-600' : 'bg-slate-300'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500`}
                aria-pressed={isMobileView}
            >
                <span className="sr-only">Toggle mobile view</span>
                <span
                    className={`${
                        isMobileView ? 'translate-x-6' : 'translate-x-1'
                    } inline-block w-4 h-4 transform bg-white rounded-full transition-transform shadow-sm`}
                />
            </button>
            <span className={`text-sm font-medium transition-colors ${isMobileView ? 'text-blue-600' : 'text-slate-500'}`}>Mobile</span>
        </div>
    );
};

export default MobileViewToggle;
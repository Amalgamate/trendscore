import React from 'react';
import CalendarView from './CalendarView';
import SchemesOfWork from './SchemesOfWork';
import TimetablePage from '../TimetablePage';

const PlannerLayout = ({ currentPage, onNavigate }) => {
    const renderContent = () => {
        switch (currentPage) {
            case 'planner-calendar':
                return <CalendarView />;
            case 'planner-schemes':
                return <SchemesOfWork onNavigate={onNavigate} />;
            case 'planner-timetable':
                return <TimetablePage />;
            default:
                return <CalendarView />;
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden bg-[#eef3f8] p-4">
                {renderContent()}
            </div>
        </div>
    );
};

export default PlannerLayout;

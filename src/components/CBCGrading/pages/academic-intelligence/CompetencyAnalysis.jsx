import React from 'react';
import HolisticDevelopmentSummary from '../HolisticDevelopmentSummary';

const CompetencyAnalysis = ({ learners = [] }) => (
  <HolisticDevelopmentSummary learners={learners} competencyOnly />
);

export default CompetencyAnalysis;

import React from 'react';
import {
  EvaluationAndJournalView,
  EvaluationAndJournalViewProps,
} from '../../components/ProductionAndJournalView';

export type ScentMemoryTrainerViewProps = Omit<EvaluationAndJournalViewProps, 'mode'>;

export const ScentMemoryTrainerView: React.FC<ScentMemoryTrainerViewProps> = (props) => {
  return <EvaluationAndJournalView {...props} mode="memory" />;
};

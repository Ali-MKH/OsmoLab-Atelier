import React from 'react';
import {
  EvaluationAndJournalView as BaseEvaluationAndJournalView,
  EvaluationAndJournalViewProps,
} from '../../components/ProductionAndJournalView';

export type { EvaluationAndJournalViewProps };

export const EvaluationAndJournalView: React.FC<EvaluationAndJournalViewProps> = (props) => {
  return <BaseEvaluationAndJournalView {...props} />;
};

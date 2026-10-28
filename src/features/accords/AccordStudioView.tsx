import React from 'react';
import {
  MaterialCatalogView,
  MaterialCatalogViewProps,
} from '../../components/MaterialsAndInventoryView';

export type AccordStudioViewProps = Omit<MaterialCatalogViewProps, 'mode'>;

export const AccordStudioView: React.FC<AccordStudioViewProps> = (props) => {
  return <MaterialCatalogView {...props} mode="accords" />;
};

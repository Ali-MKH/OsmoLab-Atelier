import React from 'react';
import {
  MaterialCatalogView as BaseMaterialCatalogView,
  MaterialCatalogViewProps,
} from '../../components/MaterialsAndInventoryView';

export type { MaterialCatalogViewProps };

export const MaterialCatalogView: React.FC<MaterialCatalogViewProps> = (props) => {
  return <BaseMaterialCatalogView {...props} />;
};
